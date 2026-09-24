"""
Alerts API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import List
from datetime import datetime

from database import database
from models import Alert, AlertResponse, AlertLog

router = APIRouter()


@router.get("/")
async def get_alerts(
    status: str = None,
    room_id: str = None,
    limit: int = 100
):
    """Get all alerts with optional filters"""
    try:
        collection = database.get_collection("alerts")
        query = {}
        
        if status:
            query["status"] = status
        if room_id:
            query["room_id"] = room_id
        
        cursor = collection.find(query).sort("timestamp", -1).limit(limit)
        alerts = []
        
        async for doc in cursor:
            alert_dict = {
                "id": str(doc["_id"]),
                "_id": str(doc["_id"]),
                "alert_type": doc.get("alert_type"),
                "room_id": doc.get("room_id"),
                "patient_id": doc.get("patient_id"),
                "description": doc.get("description"),
                "status": doc.get("status"),
                "confidence": doc.get("confidence"),
                "timestamp": doc.get("timestamp"),
                "acknowledged": doc.get("acknowledged", False),
                "acknowledged_by": doc.get("acknowledged_by"),
                "acknowledged_at": doc.get("acknowledged_at"),
                "escalation_level": doc.get("escalation_level", 0),
                "last_escalation_at": doc.get("last_escalation_at")
            }
            alerts.append(alert_dict)
        
        return alerts
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{alert_id}", response_model=Alert)
async def get_alert(alert_id: str):
    """Get a specific alert"""
    try:
        collection = database.get_collection("alerts")
        doc = await collection.find_one({"_id": alert_id})
        
        if not doc:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        doc["_id"] = str(doc["_id"])
        return Alert(**doc)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, request: Request):
    """Acknowledge an alert"""
    try:
        # Get acknowledged_by from request body
        body = await request.json()
        acknowledged_by = body.get("acknowledged_by", "Unknown")
        
        alert_manager = request.app.state.alert_manager
        success = await alert_manager.acknowledge_alert(alert_id, acknowledged_by)
        
        if success:
            # Broadcast update via WebSocket
            ws_manager = request.app.state.ws_manager
            await ws_manager.broadcast({
                "type": "alert_acknowledged",
                "alert_id": alert_id,
                "acknowledged_by": acknowledged_by
            })
            
            return {
                "success": True,
                "message": "Alert acknowledged successfully",
                "alert_id": alert_id
            }
        else:
            raise HTTPException(status_code=404, detail="Alert not found")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(alert_id: str, resolved_by: str = None, request: Request = None):
    """Resolve an alert"""
    try:
        alert_manager = request.app.state.alert_manager
        success = await alert_manager.resolve_alert(alert_id, resolved_by)
        
        if success:
            # Broadcast update via WebSocket
            ws_manager = request.app.state.ws_manager
            await ws_manager.broadcast({
                "type": "alert_resolved",
                "alert_id": alert_id
            })
            
            return AlertResponse(
                success=True,
                message="Alert resolved successfully",
                alert_id=alert_id
            )
        else:
            raise HTTPException(status_code=404, detail="Alert not found")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{alert_id}/logs", response_model=List[AlertLog])
async def get_alert_logs(alert_id: str):
    """Get logs for a specific alert"""
    try:
        collection = database.get_collection("alert_logs")
        cursor = collection.find({"alert_id": alert_id}).sort("timestamp", 1)
        logs = []
        
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            logs.append(AlertLog(**doc))
        
        return logs
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _to_obj_id(cid: str):
    try:
        from bson import ObjectId
        return ObjectId(cid)
    except Exception:
        return cid


@router.delete("/clear")
@router.delete("/all")
async def clear_all_alerts(request: Request):
    """Delete all alerts and alert logs from database and active memory"""
    try:
        alerts_col = database.get_collection("alerts")
        logs_col = database.get_collection("alert_logs")
        
        res1 = await alerts_col.delete_many({})
        res2 = await logs_col.delete_many({})
        
        if hasattr(request.app.state, "alert_manager"):
            mgr = request.app.state.alert_manager
            mgr.active_alerts.clear()
            for t in list(mgr.alert_tasks.values()):
                t.cancel()
            mgr.alert_tasks.clear()

        if hasattr(request.app.state, "ws_manager"):
            await request.app.state.ws_manager.broadcast({
                "type": "alerts_cleared"
            })

        return {
            "success": True,
            "message": "All alert logs deleted successfully",
            "deleted_alerts": res1.deleted_count,
            "deleted_logs": res2.deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, request: Request):
    """Delete an individual alert log"""
    try:
        query_id = _to_obj_id(alert_id)
        alerts_col = database.get_collection("alerts")
        logs_col = database.get_collection("alert_logs")
        
        res1 = await alerts_col.delete_one({"$or": [{"_id": query_id}, {"_id": alert_id}]})
        await logs_col.delete_many({"alert_id": alert_id})
        
        if hasattr(request.app.state, "alert_manager"):
            mgr = request.app.state.alert_manager
            if alert_id in mgr.active_alerts:
                del mgr.active_alerts[alert_id]
            if alert_id in mgr.alert_tasks:
                mgr.alert_tasks[alert_id].cancel()
                del mgr.alert_tasks[alert_id]

        if hasattr(request.app.state, "ws_manager"):
            await request.app.state.ws_manager.broadcast({
                "type": "alert_deleted",
                "alert_id": alert_id
            })

        if res1.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Alert not found")

        return {"success": True, "message": "Alert log deleted successfully", "alert_id": alert_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
