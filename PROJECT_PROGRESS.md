# Care Pulse - Project Progress & Technical Audit Report

## 🏥 Core Problem Statement & Domain Context

In hospital wards, patients facing acute physical distress, post-operative complications, or sudden disorientation often cannot reach a traditional physical call button or shout for assistance.

**Care Pulse** solves this critical challenge with zero dedicated hardware overhead by turning existing ward monitors and CCTV camera feeds into an automated, privacy-first patient distress detection system:
- **Distress Criterion**: Patients are instructed to **raise their hand continuously for more than 10 seconds** when in need of emergency assistance.
- **Ward Monitor AI**: Care Pulse sits directly on the ward monitor capturing live CCTV footages of the ward in real-time.
- **Privacy First**: Patient faces are automatically blurred in real-time using OpenCV Gaussian filters before display, ensuring patient dignity and strict healthcare privacy compliance.
- **Nurse Alert Routing**: When distress is verified, emergency notifications and automated voice calls are routed immediately to the assigned nurses present in the Contact Management system.

---

## 🏗️ Technical Architecture & Streamlined Codebase

```
CarePulse/
├── backend/                        # Python FastAPI Backend
│   ├── ai/                        # AI Vision Pipeline
│   │   ├── gesture_detection.py   # MediaPipe 10s hand-raise duration state machine
│   │   ├── ai_detector.py         # Lightweight motion & bounding box detector
│   │   └── privacy_filter.py      # Real-time face blurring filter
│   ├── api/                       # REST & WebSocket Controllers
│   │   ├── alerts.py              # Alert query, acknowledge, resolve endpoints
│   │   ├── contacts.py            # Nurse & doctor contact CRUD operations
│   │   └── streams.py             # Binary WebSocket video feed & 10s distress ingest
│   ├── alert_manager.py           # Multi-channel notification & Twilio voice escalation
│   ├── video_processor.py         # Multi-camera frame ingest & decimation
│   ├── database.py                # MongoDB Atlas connection & index management
│   ├── models.py                  # Pydantic schemas (Alert, Contact, AlertLog)
│   ├── config.py                  # Environment configuration & threshold tuning
│   ├── main.py                    # FastAPI entry point & lifespan manager
│   ├── trigger_test_alert.py      # CLI utility to test alert dispatch & Twilio calls
│   ├── test_alert_system.py       # Integration verification script
│   └── requirements.txt           # Clean Python dependencies
│
├── frontend/                      # Modern React 18 Dashboard
│   ├── src/
│   │   ├── pages/                 # Landing, Dashboard, Notifications, Settings
│   │   ├── components/            # ScreenCapture, ContactsManager, VideoGrid, SystemHealth
│   │   ├── contexts/              # ScreenCaptureContext, ThemeContext, ToastContext
│   │   ├── hooks/                 # useKeyboardShortcuts, useLocalStorage
│   │   ├── utils/                 # alertSounds, exportUtils
│   │   ├── App.jsx                # Main application router
│   │   └── index.css              # Dark-mode medical UI styling tokens
│   ├── package.json
│   └── vite.config.js
│
├── SETUP.md                       # Setup and execution guide
├── README.md                      # Comprehensive project documentation
└── start.ps1                      # Automated Windows startup script
```

---

## 🔬 Component Progress & Verification Analysis

### 1. Distress Vision Engine (`backend/ai/gesture_detection.py`)
- **Keypoint Tracking**: MediaPipe Pose and Hands track normalized wrist coordinate $lm[16]$ relative to shoulder $lm[11]$.
- **10-Second Continuous Temporal Window**: When a patient elevates their hand, a continuous duration timer runs. If the hand is lowered before 10.0 seconds, the state machine resets cleanly.
- **Distress Firing**: When the raised duration reaches $\ge 10.0$ seconds, a high-confidence distress event is emitted, bounding boxes are locked, and the backend alert dispatcher is engaged.
- **Privacy Preservation**: Real-time Gaussian blur ($51 \times 51$) renders patient faces completely anonymized on all visual previews.

### 2. Contact Management & Alert Escalation (`backend/alert_manager.py`, `backend/api/contacts.py`)
- **Nurse Directory**: CRUD management of nurses and doctors with priorities, phone numbers, and active/inactive toggles.
- **Automated Twilio Voice Calling**: On alert creation, the highest-priority active nurse is automatically dialed with a persistent TwiML voice notification stating the distress event.
- **Real-Time WebSocket Dispatch**: The monitoring dashboard receives immediate JSON event broadcasts (`type: "alert_created"`), updating badge counters and playing audible alert tones.
- **Anti-Fatigue Cooldown**: 60–120 second deduplication window prevents duplicate calls and alarm flooding for the same ward feed.

### 3. Ward CCTV Monitor Dashboard (`frontend/src/components/ScreenCapture.jsx`)
- **Multi-Source Video Ingest**: Supports Ward CCTV camera feeds, screen capture, and mobile camera feeds.
- **Ultra-Low Latency Binary WebSockets**: Transfers frames directly as binary buffers (`/api/streams/mobile/{id}/ws`), returning real-time landmark coordinates and the live seconds timer.
- **Overlay HUD**: Visualizes the hand-raise duration timer dynamically directly over the patient's video stream.

---

## 🧹 Codebase Cleanup & Waste Removal Audit

During the project audit, all obsolete, unneeded, or non-functional legacy artifacts were identified, reviewed, and cleanly purged:

| Component / File | Status | Rationale |
| :--- | :--- | :--- |
| `frontend/src/components/RoomsManager.jsx` | 🗑️ Removed | Called non-existent `/api/rooms`; superseded by direct CCTV monitor. |
| `frontend/src/pages/Home.jsx` | 🗑️ Removed | Broken duplicate of `Landing.jsx` with missing imports. |
| `frontend/src/pages/Analytics.jsx` | 🗑️ Removed | Unreferenced mockup disconnected from routing. |
| `frontend/src/components/GlobalSearch.jsx` | 🗑️ Removed | Unreferenced search modal mockup. |
| `frontend/src/hooks/useKeyboardShortcut.js` | 🗑️ Removed | Redundant single-shortcut hook (active hook is `useKeyboardShortcuts.js`). |
| `backend/ai/facial_detector.py` | 🗑️ Removed | Incomplete script referencing missing `face_landmarker.task`. |
| `backend/ai/fall_detection.py` | 🗑️ Removed | Unreferenced pose fall detection module. |
| `backend/ai/voice_detection.py` | 🗑️ Removed | Vosk speech recognition requiring missing 50MB model. |
| `backend/fix_phone_numbers.py` | 🗑️ Removed | One-off script containing hardcoded database credentials in plaintext. |
| `backend/test_contacts.py` | 🗑️ Removed | Scratch script containing hardcoded database credentials in plaintext. |
| `backend/test_api.py` | 🗑️ Removed | Redundant scratch test script. |
| `backend/test_crud.py` | 🗑️ Removed | Redundant scratch test script. |
| `backend/check_twilio_config.py` | 🗑️ Removed | Redundant print script. |
| `backend/models.py` (`Patient`, `Room`) | 🧹 Cleaned | Removed unused `Patient` and `Room` classes; made `Alert.room_id` optional. |
| `backend/database.py` (indexes & db) | 🧹 Cleaned & Migrated | Cleaned collection indexes; migrated database from `guardianai` to `carepulse`. |
| `frontend/src/hooks/useKeyboardShortcuts.js` | 🧹 Cleaned | Replaced dead `/rooms` and `/patients` links with `/screen-capture`, `/system`, `/settings`. |
| `frontend/src/components/VideoGrid.jsx` | 🛡️ Preserved & Hardened | Graceful fallback without `/api/rooms` dependency; preserves all frontend exports. |
| `frontend/src/components/index.jsx` | 🛡️ Preserved & Hardened | Maintained all core exports (`Sidebar`, `Dashboard`, `AlertsPanel`, `VideoGrid`, `ContactsManager`). |

---

## 🧪 Verification & Health Status

| Component | Test Method | Status |
| :--- | :--- | :--- |
| **FastAPI Backend Server** | `curl.exe http://localhost:8000/health` | ✅ Healthy (`database: true`, `200 OK`) |
| **Backend Module Imports** | `python -c "import main, models, database..."` | ✅ Verified (0 import errors) |
| **MongoDB Atlas Connection** | Direct `carepulse` cluster connection | ✅ Connected & operational |
| **Vite Frontend Production Build** | `npm run build` | ✅ Built with 0 errors |
| **Contacts Management API** | `GET/POST /api/contacts` | ✅ Operational |
| **Alert Dispatch & Twilio** | `python trigger_test_alert.py` | ✅ Operational |
| **CCTV Vision Stream** | Binary WebSocket `/api/streams/mobile/{id}/ws` | ✅ Operational with 10s timer |
