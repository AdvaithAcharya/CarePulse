"""
Gesture Detection Module using MediaPipe
Detects hand waves and taps to trigger alerts
"""
import cv2
import mediapipe as mp
import numpy as np
from typing import Optional, Tuple, List
from collections import deque
from datetime import datetime, timedelta
import logging

from config import settings

logger = logging.getLogger(__name__)


class GestureDetector:
    """Detects raised hands (wrist above shoulder) sustained for > 10 seconds to trigger distress alert"""
    
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.mp_draw = mp.solutions.drawing_utils
        
        # State tracking for hands raised > 3 seconds
        self.raised_start_time: Optional[datetime] = None
        self.required_duration_seconds = 3.0
        self.alert_has_fired = False  # Track if distress alert has fired for current continuous gesture
        self.distress_timestamps = deque(maxlen=45)  # 45 frames @ 15fps = 3 seconds
        
    def detect(self, frame: np.ndarray) -> Tuple[bool, Optional[str], float, List[dict], bool, float]:
        """
        Ultra-fast single-pass hand detection and bounding box extraction.
        Only tracks RAISED hands (ignores resting/lowered hands).
        Runs in ~15ms per frame.
        
        Returns:
            Tuple of (alert_triggered, gesture_type, confidence, bboxes, hand_raised, raised_duration)
        """
        # Downscale frame for ultra-fast 15ms MediaPipe inference
        h, w = frame.shape[:2]
        small_frame = cv2.resize(frame, (480, 270), interpolation=cv2.INTER_NEAREST)
        rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        # Single pass: process MediaPipe Hands first (~10-12ms)
        hand_results = self.hands.process(rgb_frame)
        bboxes = []
        hand_raised = False

        if hand_results.multi_hand_landmarks:
            for hand_landmarks in hand_results.multi_hand_landmarks:
                xs = [lm.x for lm in hand_landmarks.landmark]
                ys = [lm.y for lm in hand_landmarks.landmark]
                wrist = hand_landmarks.landmark[self.mp_hands.HandLandmark.WRIST]
                
                # ONLY track hand if it is physically raised (wrist y < 0.52 or fingers y < 0.40)
                is_this_hand_raised = (wrist.y < 0.52 or min(ys) < 0.40)
                if is_this_hand_raised:
                    hand_raised = True
                    pad_x = 0.05
                    pad_y = 0.05
                    bboxes.append({
                        "xmin": max(0.0, min(xs) - pad_x),
                        "ymin": max(0.0, min(ys) - pad_y),
                        "xmax": min(1.0, max(xs) + pad_x),
                        "ymax": min(1.0, max(ys) + pad_y),
                        "wrist_x": wrist.x,
                        "wrist_y": wrist.y
                    })

        # Only run MediaPipe Pose (~20ms) if hands weren't detected or to confirm shoulder level
        if not hand_raised:
            pose_results = self.pose.process(rgb_frame)
            if pose_results.pose_landmarks:
                landmarks = pose_results.pose_landmarks.landmark
                left_shoulder = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
                right_shoulder = landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
                left_wrist = landmarks[self.mp_pose.PoseLandmark.LEFT_WRIST]
                right_wrist = landmarks[self.mp_pose.PoseLandmark.RIGHT_WRIST]
                
                left_raised = (left_wrist.visibility > 0.3 and left_shoulder.visibility > 0.3 and left_wrist.y < left_shoulder.y - 0.03)
                right_raised = (right_wrist.visibility > 0.3 and right_shoulder.visibility > 0.3 and right_wrist.y < right_shoulder.y - 0.03)
                
                if left_raised or right_raised:
                    hand_raised = True
                    if not bboxes:
                        for wrist_idx in [self.mp_pose.PoseLandmark.LEFT_WRIST, self.mp_pose.PoseLandmark.RIGHT_WRIST]:
                            wrist = landmarks[wrist_idx]
                            if wrist.visibility > 0.3 and wrist.y < 0.52:
                                bboxes.append({
                                    "xmin": max(0.0, wrist.x - 0.12),
                                    "ymin": max(0.0, wrist.y - 0.12),
                                    "xmax": min(1.0, wrist.x + 0.12),
                                    "ymax": min(1.0, wrist.y + 0.12),
                                    "wrist_x": wrist.x,
                                    "wrist_y": wrist.y
                                })

        now = datetime.now()
        current_time = datetime.now().timestamp()
        alert_triggered = False
        gesture_type = None
        confidence = 0.0
        raised_duration = 0.0

        if hand_raised:
            if self.raised_start_time is None:
                self.raised_start_time = now
            self.distress_timestamps.append(current_time)

            raised_duration = (now - self.raised_start_time).total_seconds()

            # Trigger alert ONLY when hand is continuously raised for >= 10.0 seconds
            if raised_duration >= 10.0:
                if not self.alert_has_fired:
                    alert_triggered = True
                    self.alert_has_fired = True
                    gesture_type = "raised_hand_10s"
                    confidence = 0.98
                    logger.info(f"🚨 PATIENT DISTRESS DETECTED: Hand raised continuously >10 seconds! Triggering distress alert & emergency Twilio call.")

                # Turn off bounding tracking box & timer for patient once 10s threshold is reached / alert fired
                bboxes = []
        else:
            # Reset state when patient lowers hand before 10s or after event
            self.raised_start_time = None
            self.alert_has_fired = False
            self.distress_timestamps.clear()

        return alert_triggered, gesture_type, confidence, bboxes, hand_raised, raised_duration
    
    def _detect_wave(self) -> Tuple[bool, float]:
        """Detect horizontal waving motion"""
        if len(self.gesture_history) < 10:
            return False, 0.0
        
        # Get recent positions
        recent_positions = list(self.gesture_history)[-10:]
        x_positions = [pos[0] for pos in recent_positions]
        
        # Calculate horizontal movement
        x_range = max(x_positions) - min(x_positions)
        
        # Check for significant horizontal movement (wave)
        if x_range > 0.15:  # Threshold for wave detection
            # Check for direction change (left-right-left or right-left-right)
            direction_changes = 0
            for i in range(1, len(x_positions)):
                if i > 1:
                    prev_dir = x_positions[i-1] - x_positions[i-2]
                    curr_dir = x_positions[i] - x_positions[i-1]
                    if prev_dir * curr_dir < 0:  # Direction changed
                        direction_changes += 1
            
            # Wave detected if there's at least one direction change
            if direction_changes >= 1:
                confidence = min(0.95, 0.6 + (x_range * 2))
                return True, confidence
        
        return False, 0.0
    
    def _detect_tap(self) -> Tuple[bool, float]:
        """Detect vertical tapping motion"""
        if len(self.gesture_history) < 15:
            return False, 0.0
        
        # Get recent positions
        recent_positions = list(self.gesture_history)[-15:]
        y_positions = [pos[1] for pos in recent_positions]
        times = [pos[2] for pos in recent_positions]
        
        # Calculate vertical movement speed
        y_diff = abs(y_positions[-1] - y_positions[0])
        time_diff = (times[-1] - times[0]).total_seconds()
        
        if time_diff > 0:
            speed = y_diff / time_diff
            
            # Detect rapid vertical movement
            if speed > 0.5 and y_diff > 0.1:
                confidence = min(0.9, 0.5 + speed)
                return True, confidence
        
        return False, 0.0
    
    def draw_landmarks(self, frame: np.ndarray) -> np.ndarray:
        """Draw hand landmarks on frame for visualization"""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                self.mp_draw.draw_landmarks(
                    frame,
                    hand_landmarks,
                    self.mp_hands.HAND_CONNECTIONS
                )
        
        return frame
    
    def reset(self):
        """Reset gesture detection state"""
        self.gesture_history.clear()
        self.wave_count = 0
        self.last_wave_time = None
        self.wave_direction = None
    
    def __del__(self):
        """Cleanup resources"""
        if hasattr(self, 'hands'):
            self.hands.close()
