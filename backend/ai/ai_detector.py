"""
CarePulse Optimized AI Detector Module
Lightweight Hand Bounding Box Detection with Motion-First Wake-Up Cascade
and Frame Rate Decimation (~5 FPS AI Inference on 30 FPS Video Input).
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Dict, List, Optional, Tuple

import cv2
import httpx
import numpy as np
from dotenv import load_dotenv
import mediapipe as mp

load_dotenv()
logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
CAMERA_INDEX = 0
BACKEND_ALERT_URL = os.getenv("BACKEND_ALERT_URL", "http://localhost:8000/api/alert")

# Patient zones in normalized [0, 1] coordinates: (xmin, ymin, xmax, ymax)
PATIENT_ZONES: Dict[str, Tuple[float, float, float, float]] = {
    "P-01": (0.00, 0.00, 0.33, 0.50),
    "P-02": (0.33, 0.00, 0.66, 0.50),
    "P-03": (0.66, 0.00, 1.00, 0.50),
    "P-04": (0.00, 0.50, 0.33, 1.00),
    "P-05": (0.33, 0.50, 0.66, 1.00),
    "P-06": (0.66, 0.50, 1.00, 1.00),
}

# Optimization settings
AI_DECIMATION_INTERVAL = 6  # Process AI every 6th frame (~5 FPS at 30 FPS stream)
MOTION_THRESHOLD = 0.015   # 1.5% pixel change in patient zone to trigger AI wake-up
DELTA_X_THRESH = 0.05      # Horizontal hand movement threshold
COUNT_TARGET = 3           # Direction reversals required for distress wave
TIMEOUT_SEC = 3.0          # Seconds window for distress wave detection


# -----------------------------------------------------------------------------
# 1. Motion-First "Wake-Up" Cascade (Gatekeeper)
# -----------------------------------------------------------------------------
class MotionGatekeeper:
    """Uses OpenCV frame differencing per PATIENT_ZONE to wake up AI only when motion occurs."""

    def __init__(self, diff_threshold: int = 25):
        self.diff_threshold = diff_threshold
        self.prev_zone_frames: Dict[str, np.ndarray] = {}

    def check_motion(self, frame: np.ndarray, zones: Dict[str, Tuple[float, float, float, float]]) -> Dict[str, bool]:
        """
        Check for motion in each patient zone using background subtraction.

        Returns:
            Dict mapping zone_id -> bool (True if motion > MOTION_THRESHOLD)
        """
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        active_zones: Dict[str, bool] = {}

        for zone_id, (xmin, ymin, xmax, ymax) in zones.items():
            # Convert normalized zone to pixel coordinates
            px_xmin = int(xmin * w)
            px_ymin = int(ymin * h)
            px_xmax = int(xmax * w)
            px_ymax = int(ymax * h)

            zone_crop = gray[px_ymin:px_ymax, px_xmin:px_xmax]

            if zone_crop.size == 0:
                active_zones[zone_id] = False
                continue

            if zone_id not in self.prev_zone_frames:
                self.prev_zone_frames[zone_id] = zone_crop
                active_zones[zone_id] = True  # Initial frame triggers AI
                continue

            prev_crop = self.prev_zone_frames[zone_id]

            # Ensure shapes match (in case of dynamic resize)
            if prev_crop.shape != zone_crop.shape:
                self.prev_zone_frames[zone_id] = zone_crop
                active_zones[zone_id] = True
                continue

            # Compute frame difference
            frame_diff = cv2.absdiff(prev_crop, zone_crop)
            _, thresh = cv2.threshold(frame_diff, self.diff_threshold, 255, cv2.THRESH_BINARY)
            
            # Calculate ratio of pixels with motion
            motion_pixels = cv2.countNonZero(thresh)
            total_pixels = zone_crop.shape[0] * zone_crop.shape[1]
            motion_ratio = motion_pixels / float(total_pixels) if total_pixels > 0 else 0.0

            # Update reference frame
            self.prev_zone_frames[zone_id] = zone_crop

            # Active if motion exceeds threshold
            active_zones[zone_id] = motion_ratio >= MOTION_THRESHOLD

        return active_zones


# -----------------------------------------------------------------------------
# 2. Lightweight Hand Bounding Box Detector
# -----------------------------------------------------------------------------
class LightweightHandDetector:
    """Lightweight Hand Detection using MediaPipe Hands for Bounding Box extraction."""

    def __init__(self, max_hands: int = 4, min_detection_confidence: float = 0.5):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=max_hands,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=0.5
        )

    def detect_hand_bboxes(self, frame: np.ndarray) -> List[Dict[str, float]]:
        """
        Detect hands and compute bounding boxes in normalized coordinates [0, 1].

        Returns:
            List of dicts containing bbox (xmin, ymin, xmax, ymax), center (x, y), and wrist (x, y)
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)

        detected_hands = []
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                xs = [lm.x for lm in hand_landmarks.landmark]
                ys = [lm.y for lm in hand_landmarks.landmark]

                xmin, xmax = max(0.0, min(xs)), min(1.0, max(xs))
                ymin, ymax = max(0.0, min(ys)), min(1.0, max(ys))

                cx = (xmin + xmax) / 2.0
                cy = (ymin + ymax) / 2.0

                wrist_lm = hand_landmarks.landmark[self.mp_hands.HandLandmark.WRIST]

                detected_hands.append({
                    "xmin": xmin,
                    "ymin": ymin,
                    "xmax": xmax,
                    "ymax": ymax,
                    "center_x": cx,
                    "center_y": cy,
                    "wrist_x": wrist_lm.x,
                    "wrist_y": wrist_lm.y,
                })

        return detected_hands

    def close(self):
        self.hands.close()


# -----------------------------------------------------------------------------
# 3. Zone Mapping & Distress Wave Tracker
# -----------------------------------------------------------------------------
def get_patient_zone(center_x: float, center_y: float) -> Optional[str]:
    """Map hand center coordinates to patient zone ID."""
    for pid, (xmin, ymin, xmax, ymax) in PATIENT_ZONES.items():
        if xmin <= center_x <= xmax and ymin <= center_y <= ymax:
            return pid
    return None


class DistressWaveTracker:
    """Tracks horizontal movement reversals of hand bounding boxes per patient zone."""

    def __init__(self):
        # WAVE_STATE per patient: {"count": int, "last_dir": int, "last_x": float, "last_time": float}
        self.states: Dict[str, Dict[str, float]] = {}

    def update(self, patient_id: str, hand_x: float) -> bool:
        now = time.monotonic()
        state = self.states.get(patient_id, {"count": 0, "last_dir": 0, "last_x": hand_x, "last_time": now})

        # Reset on timeout
        if (now - state["last_time"]) > TIMEOUT_SEC:
            state = {"count": 0, "last_dir": 0, "last_x": hand_x, "last_time": now}

        dx = hand_x - state["last_x"]
        curr_dir = 1 if dx > DELTA_X_THRESH else (-1 if dx < -DELTA_X_THRESH else 0)

        if curr_dir != 0:
            if state["last_dir"] != 0 and curr_dir != state["last_dir"]:
                state["count"] += 1
            state["last_dir"] = curr_dir
            state["last_x"] = hand_x
            state["last_time"] = now

        self.states[patient_id] = state
        return state["count"] >= COUNT_TARGET


# -----------------------------------------------------------------------------
# Backend Alert Notification
# -----------------------------------------------------------------------------
async def notify_backend(patient_id: str):
    """Send alert to backend asynchronously via HTTP POST."""
    payload = {
        "patient_id": patient_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "type": "gesture"
    }
    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            resp = await client.post(BACKEND_ALERT_URL, json=payload)
            logger.info(f"Notified backend for patient {patient_id}: status {resp.status_code}")
        except Exception as e:
            logger.warning(f"Failed to send backend alert for {patient_id}: {e}")


# -----------------------------------------------------------------------------
# Main Optimized Processing Loop (Standalone or Reference Worker)
# -----------------------------------------------------------------------------
async def run_live():
    """Live camera processing loop with Decimation and Motion-First Cascade."""
    gatekeeper = MotionGatekeeper()
    detector = LightweightHandDetector()
    tracker = DistressWaveTracker()

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        logger.error(f"[ai_detector] Cannot open camera index {CAMERA_INDEX}")
        return

    frame_counter = 0
    logger.info(f"AI Detector active. Decimation: every {AI_DECIMATION_INTERVAL} frames (~5 FPS AI inference).")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                await asyncio.sleep(0.01)
                continue

            frame_counter += 1

            # --- OPTIMIZATION 3: Frame Rate Decimation ---
            # Stream runs at 30 FPS; AI executes only every Nth frame (~5 FPS)
            if frame_counter % AI_DECIMATION_INTERVAL != 0:
                await asyncio.sleep(0.001)
                continue

            # --- OPTIMIZATION 2: Motion-First Wake-Up Cascade ---
            zone_motion = gatekeeper.check_motion(frame, PATIENT_ZONES)
            active_zones = [zid for zid, has_motion in zone_motion.items() if has_motion]

            if not active_zones:
                # All patients still/sleeping - AI sleeps
                await asyncio.sleep(0.001)
                continue

            # --- OPTIMIZATION 1: Lightweight Hand Bounding Box Detector ---
            hands = detector.detect_hand_bboxes(frame)

            for hand in hands:
                pid = get_patient_zone(hand["center_x"], hand["center_y"])
                if not pid or not zone_motion.get(pid, False):
                    continue

                # Check for distress wave
                is_distress = tracker.update(pid, hand["wrist_x"])
                if is_distress:
                    logger.warning(f"Distress wave detected for Patient {pid}!")
                    await notify_backend(pid)

            await asyncio.sleep(0.001)

    finally:
        detector.close()
        cap.release()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(run_live())
    except KeyboardInterrupt:
        logger.info("AI Detector stopped by user.")
