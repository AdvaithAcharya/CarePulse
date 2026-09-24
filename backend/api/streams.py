"""
Video Streams API endpoints
"""
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from typing import List
import asyncio
import logging

from models import VideoStreamConfig

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_stream(config: VideoStreamConfig, request: Request):
    """Start a new video stream"""
    try:
        video_manager = request.app.state.video_manager
        success = await video_manager.add_stream(config)
        
        if success:
            return {"message": f"Stream started for room {config.room_id}", "success": True}
        else:
            raise HTTPException(status_code=400, detail="Failed to start stream")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop/{room_id}")
async def stop_stream(room_id: str, request: Request):
    """Stop a video stream"""
    try:
        video_manager = request.app.state.video_manager
        success = await video_manager.remove_stream(room_id)
        
        if success:
            return {"message": f"Stream stopped for room {room_id}", "success": True}
        else:
            raise HTTPException(status_code=404, detail="Stream not found")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_id}/frame")
async def get_stream_frame(room_id: str, request: Request):
    """Get the latest frame from a stream as JPEG"""
    try:
        video_manager = request.app.state.video_manager
        frame_bytes = video_manager.get_stream_frame(room_id)
        
        if frame_bytes:
            return StreamingResponse(
                iter([frame_bytes]),
                media_type="image/jpeg",
                headers={"Cache-Control": "no-cache"}
            )
        else:
            raise HTTPException(status_code=404, detail="No frame available")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_id}/stream")
async def stream_video(room_id: str, request: Request):
    """Stream video frames as MJPEG"""
    async def generate_frames():
        video_manager = request.app.state.video_manager
        
        while True:
            try:
                frame_bytes = video_manager.get_stream_frame(room_id)
                
                if frame_bytes:
                    yield (
                        b'--frame\r\n'
                        b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
                    )
                
                await asyncio.sleep(0.033)  # ~30 FPS
            
            except Exception as e:
                print(f"Error streaming frame: {e}")
                break
    
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/")
async def get_active_streams(request: Request):
    """Get list of active streams"""
    try:
        video_manager = request.app.state.video_manager
        stream_count = video_manager.get_active_stream_count()
        
        streams = []
        for room_id in video_manager.streams.keys():
            streams.append({"room_id": room_id})
        
        return {
            "count": stream_count,
            "streams": streams
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mobile/{room_id}/frame")
async def upload_mobile_frame(room_id: str, request: Request):
    """Receive video frame from mobile/screen capture"""
    try:
        import base64
        import numpy as np
        import cv2
        from ai import GestureDetector, PrivacyFilter
        from models import Alert, AlertType
        from datetime import datetime
        
        # Get JSON body with base64 encoded frame
        body = await request.json()
        frame_data = body.get('frame')
        
        if not frame_data:
            raise HTTPException(status_code=400, detail="No frame data provided")
        
        # Remove data URL prefix if present
        if 'base64,' in frame_data:
            frame_data = frame_data.split('base64,')[1]
        
        # Decode base64 to image
        img_bytes = base64.b64decode(frame_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        # Process frame directly with AI (no stream needed)
        alerts_detected = 0
        alert_manager = request.app.state.alert_manager
        
        # Initialize detectors if not in session
        if not hasattr(request.app.state, f'gesture_detector_{room_id}'):
            setattr(request.app.state, f'gesture_detector_{room_id}', GestureDetector())
            setattr(request.app.state, f'privacy_filter_{room_id}', PrivacyFilter())
            setattr(request.app.state, f'last_alert_time_{room_id}', {})
        
        gesture_detector = getattr(request.app.state, f'gesture_detector_{room_id}')
        privacy_filter = getattr(request.app.state, f'privacy_filter_{room_id}')
        last_alert_time = getattr(request.app.state, f'last_alert_time_{room_id}')
        
        # Apply face privacy blur
        frame = privacy_filter.apply(frame)

        # Gesture detection (hand raised > 10s)
        triggered, gesture_type, confidence, bboxes, hand_raised, raised_duration = gesture_detector.detect(frame)
        if triggered:
            now = datetime.now()
            last_time = last_alert_time.get('gesture')
            # Cooldown of 60 seconds per distress event
            if last_time is None or (now - last_time).total_seconds() > 60:
                alert = Alert(
                    alert_type=AlertType.GESTURE,
                    room_id=room_id,
                    description=f"Screen Monitor: Raised hand distress gesture detected ({int(confidence*100)}% confidence)",
                    confidence=confidence
                )
                await alert_manager.create_alert(alert)
                last_alert_time['gesture'] = now
                alerts_detected = 1
        
        return {
            "status": "success",
            "alerts_detected": alerts_detected,
            "room_id": room_id,
            "gesture_active": triggered,
            "hand_raised": hand_raised,
            "raised_duration": round(raised_duration, 1),
            "bboxes": bboxes
        }
    
    except HTTPException:
        raise
    except Exception as e:
        if e.__class__.__name__ == 'ClientDisconnect':
            return {"status": "disconnected", "alerts_detected": 0, "room_id": room_id}
        import traceback
        print(f"Error processing frame: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# Shared store for latest mobile camera stream frames per room
latest_mobile_frames = {}


@router.get("/mobile/{room_id}/mjpeg")
async def stream_mobile_mjpeg(room_id: str):
    """Stream live mobile camera frames as MJPEG to desktop Screen Monitoring page"""
    async def generate_frames():
        while True:
            frame_bytes = latest_mobile_frames.get(room_id)
            if frame_bytes:
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
                )
            await asyncio.sleep(0.033)  # ~30 FPS

    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.websocket("/ws")
@router.websocket("/mobile/{room_id}/ws")
async def process_video_stream_ws(websocket: WebSocket, room_id: str = "screen-monitor-session"):
    """Binary WebSocket stream endpoint with infinite persistent connection (never closes on idle)"""
    import numpy as np
    import cv2
    from ai import GestureDetector, PrivacyFilter
    from models import Alert, AlertType
    from datetime import datetime

    await websocket.accept()

    gesture_detector = GestureDetector()
    privacy_filter = PrivacyFilter()
    last_alert_time = {}

    while True:
        try:
            # Receive WebSocket message (never times out or auto-closes when idle)
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            bytes_data = message.get("bytes")
            text_data = message.get("text")

            # Respond to keepalive heartbeat pings to maintain permanent connection
            if text_data:
                if text_data.strip() in ("ping", '{"type":"ping"}'):
                    try:
                        await websocket.send_json({"type": "pong"})
                    except Exception:
                        pass
                continue

            if not bytes_data:
                continue

            # Store latest mobile camera frame in memory for desktop live monitor preview
            latest_mobile_frames[room_id] = bytes_data

            # Inner try-except per frame to ensure connection NEVER drops on any frame error
            try:
                # Decode bytes directly to OpenCV frame
                nparr = np.frombuffer(bytes_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is None:
                    continue

                # Process frame with lightweight AI gesture detector (~12-15ms)
                triggered, gesture_type, confidence, bboxes, hand_raised, raised_duration = gesture_detector.detect(frame)
                alerts_detected = 0

                if triggered:
                    now = datetime.now()
                    last_time = last_alert_time.get('gesture')
                    if last_time is None or (now - last_time).total_seconds() > 60:
                        alert = Alert(
                            alert_type=AlertType.GESTURE,
                            room_id=room_id,
                            description=f"Screen Monitor: Hand raised continuously >10s in Room {room_id}! Emergency assistance requested.",
                            confidence=confidence
                        )
                        alert_manager = websocket.app.state.alert_manager
                        await alert_manager.create_alert(alert)
                        last_alert_time['gesture'] = now
                        alerts_detected = 1

                # Respond instantly with bboxes, distress status, and live raised hand duration timer
                await websocket.send_json({
                    "status": "success",
                    "alerts_detected": alerts_detected,
                    "room_id": room_id,
                    "gesture_active": triggered,
                    "hand_raised": hand_raised,
                    "raised_duration": round(raised_duration, 1),
                    "bboxes": bboxes
                })
            except (WebSocketDisconnect, RuntimeError):
                logger.info(f"WebSocket client disconnected during send: {room_id}")
                break
            except Exception as frame_err:
                logger.error(f"Error processing frame: {frame_err}")
                await asyncio.sleep(0.001)

        except WebSocketDisconnect:
            logger.info(f"WebSocket client disconnected cleanly: {room_id}")
            break
        except Exception as ws_err:
            logger.error(f"WebSocket socket error: {ws_err}")
            break
