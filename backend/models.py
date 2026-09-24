"""
Pydantic models for CarePulse
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AlertType(str, Enum):
    """Alert type enumeration"""
    GESTURE = "gesture"
    VOICE = "voice"
    FALL = "fall"


class AlertStatus(str, Enum):
    """Alert status enumeration"""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    ESCALATED = "escalated"




class Contact(BaseModel):
    """Nurse/Doctor contact model"""
    id: Optional[str] = Field(None, alias="_id")
    name: str
    role: Optional[str] = "staff"
    phone_number: str
    firebase_token: Optional[str] = None
    email: Optional[str] = None
    priority: int = 1  # Lower number = higher priority for escalation
    active: bool = True
    created_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
        json_schema_extra = {
            "example": {
                "name": "Jane Smith",
                "role": "nurse",
                "phone_number": "+1234567890",
                "priority": 1,
                "active": True
            }
        }


class Alert(BaseModel):
    """Alert model"""
    id: Optional[str] = Field(None, alias="_id")
    alert_type: AlertType
    room_id: Optional[str] = None
    patient_id: Optional[str] = None
    description: str
    status: AlertStatus = AlertStatus.ACTIVE
    confidence: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    escalation_level: int = 0
    last_escalation_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "alert_type": "gesture",
                "room_id": "room_101",
                "description": "Patient waved for help 3 times",
                "status": "active",
                "confidence": 0.95
            }
        }


class AlertLog(BaseModel):
    """Alert log model for tracking alert history"""
    id: Optional[str] = Field(None, alias="_id")
    alert_id: str
    action: str  # "created", "acknowledged", "escalated", "resolved"
    performed_by: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


class VideoStreamConfig(BaseModel):
    """Video stream configuration"""
    room_id: str
    camera_url: str
    enable_gesture_detection: bool = True
    enable_voice_detection: bool = True
    enable_fall_detection: bool = True
    enable_privacy_filter: bool = True


class AlertResponse(BaseModel):
    """Response model for alert operations"""
    success: bool
    message: str
    alert_id: Optional[str] = None
