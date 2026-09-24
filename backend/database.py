"""
MongoDB database connection and utilities
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from config import settings

logger = logging.getLogger(__name__)


class Database:
    """MongoDB database manager"""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
    
    async def connect(self):
        """Connect directly to the configured MongoDB Atlas database"""
        mongodb_url = settings.MONGO_URI if settings.MONGO_URI else settings.MONGODB_URL
        if not mongodb_url:
            raise ValueError("No MONGO_URI specified in environment")
        
        self.client = AsyncIOMotorClient(mongodb_url, serverSelectionTimeoutMS=10000)
        await self.client.admin.command('ping')
        self.db = self.client[settings.MONGODB_DB_NAME]
        logger.info(f"Successfully connected to MongoDB Atlas database: {settings.MONGODB_DB_NAME}")
        
        # Create indexes
        await self._create_indexes()
    
    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")
    
    async def is_connected(self) -> bool:
        """Check if database is connected"""
        try:
            if self.client:
                await self.client.admin.command('ping')
                return True
        except Exception:
            pass
        return False
    
    async def _create_indexes(self):
        """Create database indexes for optimal performance"""
        try:
            # Alerts indexes
            await self.db.alerts.create_index("timestamp")
            await self.db.alerts.create_index("room_id")
            await self.db.alerts.create_index("status")
            await self.db.alerts.create_index([("acknowledged", 1), ("timestamp", -1)])
            
            # Drop obsolete collections if they exist
            try:
                colls = await self.db.list_collection_names()
                if "patients" in colls:
                    await self.db.patients.drop()
                    logger.info("Dropped obsolete 'patients' collection")
                if "rooms" in colls:
                    await self.db.rooms.drop()
                    logger.info("Dropped obsolete 'rooms' collection")
            except Exception as e:
                logger.debug(f"Non-fatal error checking/dropping obsolete collections: {e}")
            
            # Contacts indexes
            try:
                contacts = self.db.contacts
                # Drop legacy wrong unique index on 'phone' if it exists
                try:
                    indexes = await contacts.index_information()
                    if "phone_1" in indexes:
                        await contacts.drop_index("phone_1")
                        logger.info("Dropped legacy contacts index 'phone_1'")
                except Exception as e:
                    logger.warning(f"Could not inspect/drop legacy contacts index: {e}")
                # Ensure unique index on phone_number, ignoring missing/empty values
                await contacts.create_index(
                    "phone_number",
                    name="phone_number_unique",
                    unique=True,
                    partialFilterExpression={"phone_number": {"$exists": True, "$type": "string"}},
                )
            except Exception as e:
                logger.error(f"Error ensuring contacts indexes: {e}")
            
            # Alert logs indexes
            await self.db.alert_logs.create_index("alert_id")
            await self.db.alert_logs.create_index("timestamp")
            
            logger.info("Database indexes created successfully")
        except Exception as e:
            logger.error(f"Error creating indexes: {e}")
    
    def get_collection(self, name: str):
        """Get a collection from the database"""
        if self.db is None:
            raise RuntimeError("Database not connected")
        return self.db[name]


# Global database instance
database = Database()
