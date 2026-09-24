"""
Configuration settings for CarePulse backend
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "CarePulse"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS - Allow all origins for mobile access
    CORS_ORIGINS: List[str] = ["*"]  # Allow all origins (update for production)
    
    # MongoDB
    MONGODB_URL: str = ""
    MONGO_URI: str = ""
    MONGODB_DB_NAME: str = "carepulse"
    
    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = ""
    FIREBASE_PROJECT_ID: str = ""
    
    # Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    
    # Alert Settings
    ALERT_ESCALATION_TIMEOUT: int = 30  # seconds
    MAX_ESCALATION_ATTEMPTS: int = 3
    
    # AI Detection Settings
    GESTURE_THRESHOLD: int = 3  # Number of waves/taps to trigger
    GESTURE_TIME_WINDOW: int = 5  # seconds
    FALL_HEIGHT_THRESHOLD: float = 0.3  # Relative height drop
    VOICE_KEYWORDS: List[str] = ["help", "nurse", "doctor", "emergency"]
    
    # Video Processing
    MAX_CONCURRENT_STREAMS: int = 10
    FRAME_SKIP: int = 2  # Default frame skip
    AI_FRAME_SKIP: int = 6  # AI decimation (process every 6th frame ~5 FPS)
    VIDEO_QUALITY: int = 50  # JPEG quality for streaming (0-100)
    
    # Privacy
    ENABLE_FACE_BLUR: bool = True
    BLUR_KERNEL_SIZE: int = 51
    
    # Vosk Model Path
    VOSK_MODEL_PATH: str = "models/vosk-model-small-en-us-0.15"

    # Phone normalization
    DEFAULT_COUNTRY_CODE: str = "+1"  # Used to format bare numbers to E.164
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
