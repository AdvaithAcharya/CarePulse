"""
Optimized Video Stream Processor for CarePulse
Handles low-latency 30 FPS streaming to frontend while executing AI detection
decimated at ~5 FPS with a Motion-First Wake-Up Cascade.
"""
import cv2
import asyncio
import numpy as np
from typing import Dict, Optional, Tuple, List
from datetime import datetime
import logging
import queue

from config import settings
from ai import PrivacyFilter
from ai.ai_detector import MotionGatekeeper, LightweightHandDetector, PATIENT_ZONES, get_patient_zone, DistressWaveTracker
from models import Alert, AlertType, VideoStreamConfig

logger = logging.getLogger(__name__)


class VideoStream:
    """Handles a single video stream with 30 FPS preview & 5 FPS AI Decimation"""

    def __init__(self, room_id: str, camera_url: str, config: VideoStreamConfig):
        self.room_id = room_id
        self.camera_url = camera_url
        self.config = config

        # Video capture
        self.capture = None
        self.is_running = False
        self.latest_frame: Optional[np.ndarray] = None
        self.frame_count = 0

        # Optimizations: AI Decimation & Motion Cascade
        self.ai_skip_interval = getattr(settings, "AI_FRAME_SKIP", 6)  # Process AI every 6th frame (~5 FPS)
        self.gatekeeper = MotionGatekeeper()
        self.hand_detector = LightweightHandDetector() if config.enable_gesture_detection else None
        self.wave_tracker = DistressWaveTracker() if config.enable_gesture_detection else None

        # Privacy filter
        self.privacy_filter = PrivacyFilter() if config.enable_privacy_filter else None

        # Alert state tracking
        self.last_alert_time: Dict[AlertType, datetime] = {}
        self.alert_cooldown = 10  # seconds between duplicate alerts

    async def start(self) -> bool:
        """Start video stream capture"""
        try:
            self.capture = cv2.VideoCapture(self.camera_url)

            if not self.capture.isOpened():
                logger.warning(f"Failed to open {self.camera_url} with default backend, trying CAP_FFMPEG")
                self.capture = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)

                if not self.capture.isOpened():
                    logger.error(f"Failed to open camera stream: {self.camera_url}")
                    return False

            self.is_running = True
            logger.info(f"Video stream started for room {self.room_id}: {self.camera_url}")
            return True

        except Exception as e:
            logger.error(f"Error starting video stream for {self.room_id}: {e}")
            return False

    def stop(self):
        """Stop video stream capture"""
        self.is_running = False
        if self.capture:
            self.capture.release()
        if self.hand_detector:
            self.hand_detector.close()
        logger.info(f"Video stream stopped for room {self.room_id}")

    async def read_frame(self) -> Optional[np.ndarray]:
        """
        Read frame at native 30 FPS.
        Always updates self.latest_frame for smooth UI preview.
        """
        if not self.capture or not self.is_running:
            return None

        try:
            ret, frame = self.capture.read()
            if not ret:
                return None

            self.frame_count += 1

            # Apply privacy filter to streaming frame if enabled
            display_frame = frame.copy()
            if self.privacy_filter and self.config.enable_privacy_filter:
                display_frame = self.privacy_filter.apply(display_frame)

            self.latest_frame = display_frame
            return frame

        except Exception as e:
            logger.error(f"Error reading frame from {self.room_id}: {e}")
            return None

    async def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, List[Alert]]:
        """
        Process frame with Decimation (5 FPS) and Motion Cascade.

        Returns:
            Tuple of (display_frame, detected_alerts)
        """
        alerts: List[Alert] = []
        display_frame = self.latest_frame if self.latest_frame is not None else frame
        h, w = frame.shape[:2]

        try:
            # --- OPTIMIZATION 3: Frame Rate Decimation ---
            # AI inference runs only on every Nth frame (e.g. every 6th frame)
            if self.frame_count % self.ai_skip_interval != 0:
                return display_frame, alerts

            # --- OPTIMIZATION 2: Motion-First Wake-Up Cascade ---
            zone_motion = self.gatekeeper.check_motion(frame, PATIENT_ZONES)
            any_motion = any(zone_motion.values())

            if not any_motion:
                return display_frame, alerts

            # --- OPTIMIZATION 1: Lightweight Bounding Box Hand Detector ---
            if self.hand_detector and self.config.enable_gesture_detection:
                hands = self.hand_detector.detect_hand_bboxes(frame)

                for hand in hands:
                    pid = get_patient_zone(hand["center_x"], hand["center_y"])
                    is_distress = False

                    # Only execute wave analysis if patient zone had motion
                    if pid and zone_motion.get(pid, False):
                        is_distress = self.wave_tracker.update(pid, hand["wrist_x"])
                        if is_distress and self._can_create_alert(AlertType.GESTURE):
                            alert = Alert(
                                alert_type=AlertType.GESTURE,
                                room_id=self.room_id,
                                description=f"Distress wave detected for Patient {pid} in Room {self.room_id}",
                                confidence=0.92
                            )
                            alerts.append(alert)
                            self.last_alert_time[AlertType.GESTURE] = datetime.now()

            return display_frame, alerts

        except Exception as e:
            logger.error(f"Error processing AI for frame in {self.room_id}: {e}")
            return display_frame, []

    def _can_create_alert(self, alert_type: AlertType) -> bool:
        """Enforce alert cooldown period"""
        if alert_type not in self.last_alert_time:
            return True
        elapsed = (datetime.now() - self.last_alert_time[alert_type]).total_seconds()
        return elapsed >= self.alert_cooldown

    def get_latest_frame_jpeg(self) -> Optional[bytes]:
        """Get latest frame as JPEG bytes at 30 FPS preview speed"""
        if self.latest_frame is None:
            return None

        try:
            _, buffer = cv2.imencode('.jpg', self.latest_frame, [cv2.IMWRITE_JPEG_QUALITY, settings.VIDEO_QUALITY])
            return buffer.tobytes()
        except Exception as e:
            logger.error(f"Error encoding frame for {self.room_id}: {e}")
            return None


class VideoStreamManager:
    """Manages multiple video streams asynchronously"""

    def __init__(self):
        self.streams: Dict[str, VideoStream] = {}
        self.is_running = False
        self.alert_callback = None

    async def add_stream(self, config: VideoStreamConfig) -> bool:
        """Add a new video stream"""
        try:
            if config.room_id in self.streams:
                logger.warning(f"Stream for room {config.room_id} already exists")
                return False

            if len(self.streams) >= settings.MAX_CONCURRENT_STREAMS:
                logger.error(f"Maximum concurrent streams ({settings.MAX_CONCURRENT_STREAMS}) reached")
                return False

            stream = VideoStream(config.room_id, config.camera_url, config)
            success = await stream.start()

            if success:
                self.streams[config.room_id] = stream
                logger.info(f"Stream added for room {config.room_id}")
                return True

            return False

        except Exception as e:
            logger.error(f"Error adding stream: {e}")
            return False

    async def remove_stream(self, room_id: str) -> bool:
        """Remove a video stream"""
        if room_id in self.streams:
            self.streams[room_id].stop()
            del self.streams[room_id]
            logger.info(f"Stream removed for room {room_id}")
            return True
        return False

    async def stop_all(self):
        """Stop all video streams"""
        self.is_running = False
        for stream in self.streams.values():
            stream.stop()
        self.streams.clear()
        logger.info("All video streams stopped")

    async def process_streams(self):
        """Main processing loop for all streams"""
        self.is_running = True
        logger.info("Optimized video stream processing started")

        while self.is_running:
            try:
                for room_id, stream in list(self.streams.items()):
                    if not stream.is_running:
                        continue

                    # Ingest frame at 30 FPS
                    frame = await stream.read_frame()
                    if frame is None:
                        continue

                    # Process AI with 5 FPS decimation & motion cascade
                    _, alerts = await stream.process_frame(frame)

                    # Trigger alert callback if alerts detected
                    if alerts and self.alert_callback:
                        for alert in alerts:
                            await self.alert_callback(alert)

                await asyncio.sleep(0.001)

            except Exception as e:
                logger.error(f"Error in stream processing loop: {e}")
                await asyncio.sleep(1)

    def set_alert_callback(self, callback):
        """Set callback function for alert detection"""
        self.alert_callback = callback

    def get_stream(self, room_id: str) -> Optional[VideoStream]:
        return self.streams.get(room_id)

    def get_active_stream_count(self) -> int:
        return len(self.streams)

    def get_stream_frame(self, room_id: str) -> Optional[bytes]:
        stream = self.streams.get(room_id)
        if stream:
            return stream.get_latest_frame_jpeg()
        return None
