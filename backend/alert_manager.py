"""
Alert Management System
Handles multi-channel alerts with Firebase push notifications and Twilio calls
"""
import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logging.warning("Firebase admin SDK not available")

try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    logging.warning("Twilio SDK not available")

from config import settings
from database import database
from models import Alert, AlertStatus, AlertLog

logger = logging.getLogger(__name__)


def _to_object_id(val: str):
    """Safely convert string to ObjectId if possible"""
    try:
        return ObjectId(val)
    except Exception:
        return val


class AlertManager:
    """Manages alert lifecycle, escalation, and notifications"""
    
    def __init__(self):
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_tasks: Dict[str, asyncio.Task] = {}
        
        # Firebase setup
        self.firebase_app = None
        if FIREBASE_AVAILABLE and settings.FIREBASE_CREDENTIALS_PATH:
            try:
                self._initialize_firebase()
            except Exception as e:
                logger.error(f"Failed to initialize Firebase: {e}")
        
        # Twilio setup
        self.twilio_client = None
        if TWILIO_AVAILABLE and settings.TWILIO_ACCOUNT_SID:
            try:
                self._initialize_twilio()
            except Exception as e:
                logger.error(f"Failed to initialize Twilio: {e}")
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            self.firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing Firebase: {e}")
            raise
    
    def _initialize_twilio(self):
        """Initialize Twilio client"""
        try:
            self.twilio_client = TwilioClient(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )
            logger.info("Twilio initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing Twilio: {e}")
            raise
    
    async def create_alert(self, alert: Alert) -> str:
        """
        Create and activate a new alert (with global deduplication)
        
        Args:
            alert: Alert object
            
        Returns:
            Alert ID
        """
        try:
            collection = database.get_collection("alerts")
            
            # Global Deduplication & Cooldown (120 seconds per room/patient & alert_type)
            two_mins_ago = datetime.utcnow() - timedelta(seconds=120)
            dedup_query = {
                "alert_type": alert.alert_type,
                "$or": [
                    {"status": AlertStatus.ACTIVE},
                    {"acknowledged": False},
                    {"timestamp": {"$gte": two_mins_ago}}
                ]
            }
            if alert.room_id:
                dedup_query["room_id"] = alert.room_id
            if hasattr(alert, 'patient_id') and alert.patient_id:
                dedup_query["patient_id"] = alert.patient_id

            existing = await collection.find_one(dedup_query)
            if existing:
                logger.info(f"Duplicate alert suppressed for room {alert.room_id} / patient {getattr(alert, 'patient_id', None)}. Existing alert: {existing['_id']}")
                return str(existing["_id"])

            # Save to database
            alert_dict = alert.model_dump(by_alias=True, exclude={"id"})
            result = await collection.insert_one(alert_dict)
            alert_id = str(result.inserted_id)
            alert.id = alert_id
            
            # Add to active alerts
            self.active_alerts[alert_id] = alert
            
            # Create alert log
            await self._log_alert_action(alert_id, "created", None, f"Alert created: {alert.description}")
            
            # Start alert processing task
            task = asyncio.create_task(self._process_alert(alert_id))
            self.alert_tasks[alert_id] = task
            
            logger.info(f"Alert created: {alert_id} - {alert.alert_type} in {alert.room_id}")
            
            return alert_id
        
        except Exception as e:
            logger.error(f"Error creating alert: {e}")
            raise
    
    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """
        Acknowledge an alert and stop escalation
        
        Args:
            alert_id: Alert ID
            acknowledged_by: Name/ID of person acknowledging
            
        Returns:
            Success status
        """
        try:
            query_id = _to_object_id(alert_id)
            
            # Try to get from active alerts first
            alert = self.active_alerts.get(alert_id)
            
            # If not in memory, try to load from database
            if not alert:
                logger.info(f"Alert {alert_id} not in memory, loading from database")
                collection = database.get_collection("alerts")
                doc = await collection.find_one({"$or": [{"_id": query_id}, {"_id": alert_id}]})
                if not doc:
                    logger.warning(f"Alert {alert_id} not found in database")
                    return False
                # Just update the database directly since alert is not in active processing
                result = await collection.update_one(
                    {"$or": [{"_id": query_id}, {"_id": alert_id}]},
                    {"$set": {
                        "acknowledged": True,
                        "acknowledged_by": acknowledged_by,
                        "acknowledged_at": datetime.utcnow(),
                        "status": AlertStatus.ACKNOWLEDGED
                    }}
                )
                if result.modified_count > 0:
                    await self._log_alert_action(
                        alert_id, "acknowledged", acknowledged_by,
                        f"Alert acknowledged by {acknowledged_by}"
                    )
                    logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by} (from database)")
                    return True
                return False
            
            # Update alert status
            alert.acknowledged = True
            alert.acknowledged_by = acknowledged_by
            alert.acknowledged_at = datetime.utcnow()
            alert.status = AlertStatus.ACKNOWLEDGED
            
            # Update database
            collection = database.get_collection("alerts")
            await collection.update_one(
                {"$or": [{"_id": query_id}, {"_id": alert_id}]},
                {"$set": {
                    "acknowledged": True,
                    "acknowledged_by": acknowledged_by,
                    "acknowledged_at": alert.acknowledged_at,
                    "status": AlertStatus.ACKNOWLEDGED
                }}
            )
            
            # Cancel escalation task
            if alert_id in self.alert_tasks:
                self.alert_tasks[alert_id].cancel()
                del self.alert_tasks[alert_id]
            
            # Log action
            await self._log_alert_action(
                alert_id, "acknowledged", acknowledged_by,
                f"Alert acknowledged by {acknowledged_by}"
            )
            
            logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
            
            return True
        
        except Exception as e:
            logger.error(f"Error acknowledging alert {alert_id}: {e}")
            return False
    
    async def resolve_alert(self, alert_id: str, resolved_by: Optional[str] = None) -> bool:
        """
        Resolve an alert
        
        Args:
            alert_id: Alert ID
            resolved_by: Name/ID of person resolving
            
        Returns:
            Success status
        """
        try:
            query_id = _to_object_id(alert_id)
            alert = self.active_alerts.get(alert_id)
            if not alert:
                collection = database.get_collection("alerts")
                await collection.update_one(
                    {"$or": [{"_id": query_id}, {"_id": alert_id}]},
                    {"$set": {"status": AlertStatus.RESOLVED}}
                )
                return True
            
            # Update status
            alert.status = AlertStatus.RESOLVED
            
            # Update database
            collection = database.get_collection("alerts")
            await collection.update_one(
                {"$or": [{"_id": query_id}, {"_id": alert_id}]},
                {"$set": {"status": AlertStatus.RESOLVED}}
            )
            
            # Remove from active alerts
            del self.active_alerts[alert_id]
            
            # Cancel task if exists
            if alert_id in self.alert_tasks:
                self.alert_tasks[alert_id].cancel()
                del self.alert_tasks[alert_id]
            
            # Log action
            await self._log_alert_action(alert_id, "resolved", resolved_by, "Alert resolved")
            
            logger.info(f"Alert {alert_id} resolved")
            
            return True
        
        except Exception as e:
            logger.error(f"Error resolving alert {alert_id}: {e}")
            return False
    
    async def _process_alert(self, alert_id: str):
        """Process alert notification to active contacts without escalation/leveling loop"""
        try:
            alert = self.active_alerts.get(alert_id)
            if not alert:
                return
            
            # Get active contacts
            contacts = await self._get_contacts()
            
            # Send notification immediately to active contacts
            await self._send_notifications(alert, contacts, 0)
        
        except asyncio.CancelledError:
            logger.info(f"Alert processing cancelled for {alert_id}")
        except Exception as e:
            logger.error(f"Error processing alert {alert_id}: {e}")
    
    async def _send_notifications(self, alert: Alert, contacts: List[dict], escalation_level: int):
        """
        Send notifications to contacts
        
        Args:
            alert: Alert object
            contacts: List of contact dicts
            escalation_level: Current escalation level
        """
        # Filter contacts by priority for this escalation level
        relevant_contacts = [c for c in contacts if c.get('priority', 1) <= escalation_level + 1 and c.get('active', True)]
        
        for contact in relevant_contacts:
            # Send Firebase push notification
            if contact.get('firebase_token'):
                await self._send_firebase_notification(alert, contact)
            
            # Send Twilio call
            if contact.get('phone_number'):
                await self._send_twilio_call(alert, contact)
    
    async def _send_firebase_notification(self, alert: Alert, contact: dict):
        """Send Firebase push notification"""
        if not FIREBASE_AVAILABLE or not self.firebase_app:
            logger.debug("Firebase not available, skipping push notification")
            return
        
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=f"🚨 {alert.alert_type.upper()} ALERT",
                    body=f"{alert.description} - Room {alert.room_id}"
                ),
                data={
                    "alert_id": alert.id,
                    "alert_type": alert.alert_type,
                    "room_id": alert.room_id,
                    "timestamp": alert.timestamp.isoformat()
                },
                token=contact.get('firebase_token'),
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        priority='max'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1
                        )
                    )
                )
            )
            
            response = messaging.send(message)
            logger.info(f"Firebase notification sent to {contact.get('name')}: {response}")
        
        except Exception as e:
            logger.error(f"Error sending Firebase notification: {e}")
    
    async def _send_twilio_call(self, alert: Alert, contact: dict):
        """Send Twilio voice call"""
        if not TWILIO_AVAILABLE or not self.twilio_client:
            logger.debug("Twilio not available, skipping call")
            return
        
        try:
            # Create TwiML for the call
            twiml = f"""
            <Response>
                <Say voice="alice">
                    Attention. This is CarePulse Alert System.
                    {alert.alert_type} alert detected in room {alert.room_id}.
                    {alert.description}.
                    Please acknowledge this alert immediately.
                </Say>
                <Pause length="2"/>
                <Say>Press any key to acknowledge.</Say>
                <Gather numDigits="1" action="/api/alerts/{alert.id}/acknowledge-call"/>
            </Response>
            """
            
            call = self.twilio_client.calls.create(
                twiml=twiml,
                to=contact.get('phone_number'),
                from_=settings.TWILIO_PHONE_NUMBER
            )
            
            logger.info(f"Twilio call initiated to {contact.get('name')}: {call.sid}")
        
        except Exception as e:
            logger.error(f"Error sending Twilio call: {e}")
    
    async def _get_contacts(self) -> List[dict]:
        """Get all active contacts sorted by priority"""
        try:
            collection = database.get_collection("contacts")
            cursor = collection.find({}).sort("priority", 1)
            contacts = []
            
            async for doc in cursor:
                active_val = doc.get("active")
                is_active = True if active_val is None else (
                    active_val.lower() in ("true", "1", "yes") if isinstance(active_val, str) else bool(active_val)
                )
                if not is_active:
                    continue

                contact_dict = {
                    "id": str(doc.get("_id", "")),
                    "name": doc.get("name") or doc.get("contact_name") or doc.get("full_name") or doc.get("username") or "Unnamed Contact",
                    "role": str(doc.get("role") or "nurse").lower(),
                    "phone_number": doc.get("phone_number") or doc.get("phone") or doc.get("mobile") or doc.get("phone_no") or "",
                    "firebase_token": doc.get("firebase_token"),
                    "email": doc.get("email"),
                    "priority": doc.get("priority", 1),
                    "active": is_active
                }
                contacts.append(contact_dict)
            
            return contacts
        
        except Exception as e:
            logger.error(f"Error fetching contacts: {e}")
            return []
    
    async def _log_alert_action(self, alert_id: str, action: str, performed_by: Optional[str], details: Optional[str]):
        """Log an alert action"""
        try:
            log = AlertLog(
                alert_id=alert_id,
                action=action,
                performed_by=performed_by,
                details=details
            )
            
            collection = database.get_collection("alert_logs")
            log_dict = log.model_dump(by_alias=True, exclude={"id"})
            await collection.insert_one(log_dict)
        
        except Exception as e:
            logger.error(f"Error logging alert action: {e}")
    
    async def process_alerts(self):
        """Background task to process alerts"""
        logger.info("Alert processing service started")
        while True:
            try:
                await asyncio.sleep(1)  # Keep service running
            except Exception as e:
                logger.error(f"Error in alert processing loop: {e}")
                await asyncio.sleep(5)
    
    def get_active_alert_count(self) -> int:
        """Get count of active alerts"""
        return len(self.active_alerts)
    
    def get_active_alerts(self) -> List[Alert]:
        """Get list of active alerts"""
        return list(self.active_alerts.values())
