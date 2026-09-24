"""
Contacts API endpoints
"""
from fastapi import APIRouter, HTTPException
from typing import List
from bson import ObjectId

from database import database
from models import Contact
from config import settings
from fastapi import HTTPException
import re

router = APIRouter()

def _format_phone(raw: str) -> str:
    if not raw:
        return ""
    # Strip spaces, dashes, parentheses
    cleaned = re.sub(r"[^\d+]", "", str(raw).strip())
    if not cleaned.startswith("+"):
        cleaned = "+91" + cleaned if len(cleaned) == 10 else "+" + cleaned
    return cleaned


def _to_obj_id(cid: str):
    try:
        return ObjectId(cid)
    except Exception:
        return cid


@router.get("/")
async def get_contacts(active_only: bool = False):
    """Get all contacts"""
    try:
        collection = database.get_collection("contacts")
        cursor = collection.find({}).sort("priority", 1)
        contacts = []
        
        async for doc in cursor:
            active_val = doc.get("active")
            is_active = True if active_val is None else (
                active_val.lower() in ("true", "1", "yes") if isinstance(active_val, str) else bool(active_val)
            )
            
            if active_only and not is_active:
                continue

            cid = str(doc.get("_id", ""))
            name = doc.get("name") or doc.get("contact_name") or doc.get("full_name") or doc.get("username") or doc.get("phone") or "Unnamed Contact"
            role = str(doc.get("role") or "nurse").lower()
            phone_number = doc.get("phone_number") or doc.get("phone") or doc.get("mobile") or doc.get("phone_no") or ""

            contact_dict = {
                "id": cid,
                "name": name,
                "role": role,
                "phone_number": phone_number,
                "firebase_token": doc.get("firebase_token", ""),
                "email": doc.get("email", ""),
                "priority": doc.get("priority", 1),
                "active": is_active,
                "created_at": doc.get("created_at")
            }
            contacts.append(contact_dict)
        
        return contacts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{contact_id}")
async def get_contact(contact_id: str):
    """Get a specific contact"""
    try:
        collection = database.get_collection("contacts")
        query_id = _to_obj_id(contact_id)
        doc = await collection.find_one({"$or": [{"_id": query_id}, {"_id": contact_id}]})
        
        if not doc:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        name = doc.get("name") or doc.get("contact_name") or doc.get("full_name") or doc.get("username") or "Unnamed Contact"
        role = str(doc.get("role") or "nurse").lower()
        phone_number = doc.get("phone_number") or doc.get("phone") or doc.get("mobile") or doc.get("phone_no") or ""
        active_val = doc.get("active")
        is_active = True if active_val is None else (
            active_val.lower() in ("true", "1", "yes") if isinstance(active_val, str) else bool(active_val)
        )

        return {
            "id": str(doc.get("_id", "")),
            "name": name,
            "role": role,
            "phone_number": phone_number,
            "firebase_token": doc.get("firebase_token", ""),
            "email": doc.get("email", ""),
            "priority": doc.get("priority", 1),
            "active": is_active,
            "created_at": doc.get("created_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_contact(contact: Contact):
    """Create a new contact"""
    try:
        from datetime import datetime
        collection = database.get_collection("contacts")
        formatted_phone = _format_phone(contact.phone_number)
        contact_dict = {
            "name": contact.name,
            "role": (contact.role or "staff").lower(),
            "phone_number": formatted_phone,
            "firebase_token": contact.firebase_token,
            "email": contact.email,
            "priority": contact.priority,
            "active": contact.active,
            "created_at": datetime.utcnow()
        }
        result = await collection.insert_one(contact_dict)
        
        return {
            "id": str(result.inserted_id),
            "name": contact.name,
            "role": (contact.role or "staff").lower(),
            "phone_number": formatted_phone,
            "firebase_token": contact.firebase_token,
            "email": contact.email,
            "priority": contact.priority,
            "active": contact.active,
            "created_at": contact_dict["created_at"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{contact_id}")
async def update_contact(contact_id: str, contact: Contact):
    """Update a contact"""
    try:
        collection = database.get_collection("contacts")
        query_id = _to_obj_id(contact_id)
        formatted_phone = _format_phone(contact.phone_number)
        contact_dict = {
            "name": contact.name,
            "role": (contact.role or "staff").lower(),
            "phone_number": formatted_phone,
            "firebase_token": contact.firebase_token,
            "email": contact.email,
            "priority": contact.priority,
            "active": contact.active
        }
        
        result = await collection.update_one(
            {"$or": [{"_id": query_id}, {"_id": contact_id}]},
            {"$set": contact_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        return {
            "id": contact_id,
            "name": contact.name,
            "role": (contact.role or "staff").lower(),
            "phone_number": formatted_phone,
            "firebase_token": contact.firebase_token,
            "email": contact.email,
            "priority": contact.priority,
            "active": contact.active,
            "created_at": contact.created_at
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete a contact"""
    try:
        collection = database.get_collection("contacts")
        query_id = _to_obj_id(contact_id)
        result = await collection.delete_one({"$or": [{"_id": query_id}, {"_id": contact_id}]})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        return {"message": "Contact deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
