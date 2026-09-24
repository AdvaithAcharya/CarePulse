"""
CarePulse - Main FastAPI Application
Privacy-First Patient Distress Detection System
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import asyncio
from typing import List, Dict, Optional
import logging
import os
from datetime import datetime

from dotenv import load_dotenv

# Load environment variables from .env (in addition to pydantic settings)
load_dotenv()

from config import settings
from database import database
from models import Alert, Contact, AlertLog
from video_processor import VideoStreamManager
from alert_manager import AlertManager
from api import alerts, contacts, streams
from pydantic import BaseModel
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_IMPORT_OK = True
except Exception:
    TWILIO_IMPORT_OK = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Filter out repetitive frame POST requests & polling GET requests from uvicorn access logs
class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "POST /api/streams/mobile/" in message and "/frame" in message:
            return False
        if "GET /api/alerts" in message:
            return False
        return True

logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

# Global managers
video_manager = VideoStreamManager()
alert_manager = AlertManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    await database.connect()
    logger.info("Connected to MongoDB")

    # Initialize Twilio client (optional)
    app.state.twilio_client = None
    app.state.twilio_from_number = None
    if TWILIO_IMPORT_OK:
        sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '') or os.getenv('TWILIO_SID', '')
        token = getattr(settings, 'TWILIO_AUTH_TOKEN', '') or os.getenv('TWILIO_TOKEN', '')
        from_number = getattr(settings, 'TWILIO_PHONE_NUMBER', '') or os.getenv('TWILIO_PHONE_NUMBER', '')
        if sid and token and from_number:
            try:
                app.state.twilio_client = TwilioClient(sid, token)
                app.state.twilio_from_number = from_number
                logger.info("Twilio client initialized in main.py")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")
        else:
            logger.warning("Twilio credentials not set; voice call escalation disabled for /api/alert endpoint")
    else:
        logger.warning("Twilio SDK not installed; voice call escalation disabled for /api/alert endpoint")
    
    # Start background tasks
    asyncio.create_task(video_manager.process_streams())
    asyncio.create_task(alert_manager.process_alerts())
    
    yield
    
    # Shutdown
    await video_manager.stop_all()
    await database.disconnect()
    logger.info("Disconnected from MongoDB")


app = FastAPI(
    title="CarePulse API",
    description="Low-Cost, Privacy-First Patient Distress Detection System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
app.include_router(streams.router, prefix="/api/streams", tags=["streams"])


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connection. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")


manager = ConnectionManager()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "CarePulse",
        "status": "operational",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": await database.is_connected(),
        "active_streams": video_manager.get_active_stream_count(),
        "active_alerts": alert_manager.get_active_alert_count()
    }


@app.get("/status")
async def status():
    """Simple status endpoint (production-ready liveness)"""
    return {"ok": True, "service": "care_pulse_backend"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and receive messages
            data = await websocket.receive_text()
            # Echo back for debugging
            await websocket.send_json({"type": "echo", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# Make manager available to other modules
app.state.ws_manager = manager
app.state.video_manager = video_manager
app.state.alert_manager = alert_manager


class AlertPayload(BaseModel):
    patient_id: str
    timestamp: str
    type: Optional[str] = None  # e.g., 'distress', 'gesture', 'fall'


async def trigger_twilio_call(patient_id: str):
    """Initiate a Twilio voice call with a persistent message for the top-priority active contact.
    Runs in a background task to avoid blocking request handlers.
    """
    try:
        import anyio
        # Fetch top priority active contact
        collection = database.get_collection("contacts")
        doc = await collection.find({"active": True}).sort("priority", 1).limit(1).to_list(length=1)
        if not doc:
            logger.warning("No active contacts available for Twilio call")
            return
        to_number = doc[0].get("phone_number")
        if not to_number:
            logger.warning("Top contact has no phone_number; skipping call")
            return
        # Build TwiML with infinite loop (loop=0)
        twiml = (
            f"<Response>"
            f"<Say voice=\"alice\" loop=\"0\">"
            f"CarePulse critical alert for patient {patient_id}. Please check immediately."
            f"</Say>"
            f"</Response>"
        )
        # Resolve client/from number from either main app state or alert_manager
        client = getattr(app.state, 'twilio_client', None) or getattr(app.state.alert_manager, 'twilio_client', None)
        from_number = getattr(app.state, 'twilio_from_number', None) or getattr(settings, 'TWILIO_PHONE_NUMBER', '')
        if not client or not from_number:
            logger.warning("Twilio client or from number not configured; cannot place call")
            return
        def _call_sync():
            client.calls.create(twiml=twiml, to=to_number, from_=from_number)
        await anyio.to_thread.run_sync(_call_sync)
        logger.info(f"Twilio call initiated to {to_number} for patient {patient_id}")
    except Exception as e:
        logger.error(f"Error in trigger_twilio_call: {e}")


@app.post("/api/alert")
async def create_alert_endpoint(payload: AlertPayload, background_tasks: BackgroundTasks):
    """Receive alert from AI detector, store in Mongo, and escalate via Twilio in background."""
    try:
        # Normalize fields
        alert_type = (payload.type or "distress").lower()
        try:
            # Parse timestamp if provided; otherwise use now
            ts = datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00")) if payload.timestamp else datetime.utcnow()
        except Exception:
            ts = datetime.utcnow()
        description = f"AI detected {alert_type} for patient {payload.patient_id}"
        
        collection = database.get_collection("alerts")
        
        # Deduplicate alerts for same patient within 120 seconds
        from datetime import timedelta
        two_mins_ago = datetime.utcnow() - timedelta(seconds=120)
        existing = await collection.find_one({
            "patient_id": payload.patient_id,
            "$or": [
                {"status": "active"},
                {"acknowledged": False},
                {"created_at": {"$gte": two_mins_ago}}
            ]
        })
        if existing:
            logger.info(f"Suppressed duplicate alert for patient {payload.patient_id}")
            return {"ok": True, "alert_id": str(existing["_id"]), "duplicate": True}

        # Store alert in MongoDB with fields that the frontend expects
        doc = {
            "alert_type": alert_type,
            "room_id": None,
            "patient_id": payload.patient_id,
            "description": description,
            "status": "active",
            "confidence": None,
            "timestamp": ts,
            "acknowledged": False,
            "escalation_level": 0,
            "source": "ai_detector",
            "created_at": datetime.utcnow(),
        }
        result = await collection.insert_one(doc)
        alert_id = str(result.inserted_id)
        
        # Broadcast to dashboard via WebSocket
        try:
            await app.state.ws_manager.broadcast({
                "type": "alert_created",
                "alert_id": alert_id,
                "alert_type": alert_type,
                "patient_id": payload.patient_id,
                "timestamp": ts.isoformat()
            })
        except Exception as e:
            logger.debug(f"WS broadcast failed (non-fatal): {e}")
        
        # Trigger Twilio call in background
        background_tasks.add_task(trigger_twilio_call, payload.patient_id)
        return {"ok": True, "alert_id": alert_id}
    except Exception as e:
        logger.error(f"Error creating alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
