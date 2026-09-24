# Care Pulse – Intelligent Patient Distress Detection System for Hospital Wards 
[care-pulse-jade.vercel.app](https://care-pulse-jade.vercel.app)

![Care Pulse Banner](https://img.shields.io/badge/Care%20Pulse-Patient%20Safety-blue)
![Python](https://img.shields.io/badge/Python-3.8+-green)
![React](https://img.shields.io/badge/React-18+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688)
![MediaPipe](https://img.shields.io/badge/MediaPipe-AI%20Vision-FF6F00)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🏥 Overview

**Care Pulse** is an automated, privacy-first patient distress detection system built for hospital wards. In critical medical environments, patients experiencing acute distress or needing urgent assistance often cannot reach physical call buttons or shout for help.

In Care Pulse-equipped wards, patients are instructed to **raise their hand continuously for more than 10 seconds** if they are in distress or need help. 

Care Pulse runs directly on the ward's monitor system, capturing live CCTV and video feeds in real-time. The AI vision engine continuously monitors patient postures, computes real-time bounding boxes with continuous hand-raise duration tracking, applies face-blurring privacy filters, and instantly escalates confirmed distress events to assigned nurses through automated voice calls and live dashboard notifications.

---

## ✨ Key Capabilities

- **⏱️ 10-Second Sustained Distress Detection**
  - Uses MediaPipe ultra-fast pose and hand tracking (~15ms per frame) to measure continuous hand elevation above shoulder level.
  - Requires continuous hand raising for **$\ge$ 10.0 seconds** before triggering an alert, eliminating false alarms from casual movements or momentary waves.
  - Real-time on-screen countdown and duration visualizer tracks the distress gesture live on the monitor feed.

- **🔒 Privacy-First Face Anonymization**
  - Real-time OpenCV Gaussian face blurring anonymizes patient faces before frames are displayed or broadcasted.
  - Video streams are processed locally in volatile memory without cloud video storage, ensuring compliance with patient dignity and healthcare privacy standards.

- **📞 Targeted Nurse Alerting & Voice Escalation**
  - **Twilio Voice Calls**: Automatically dials active nurses registered in Care Pulse's Contact Management system with automated emergency voice alerts.
  - **WebSocket Live Feeds**: Instantly pushes alert banners and audio cues to the hospital ward monitoring dashboard (`ws://localhost:8000/ws`).
  - **Global Deduplication & Cooldown**: Prevents alert fatigue by applying a 60–120 second cooldown per patient/ward feed.

- **🖥️ Live CCTV Ward Monitoring Dashboard**
  - Real-time CCTV streaming with low latency via binary WebSockets and MJPEG.
  - Responsive dark-mode dashboard with live alert feeds, acknowledgement workflows, system telemetry, and contact management.

---

## 🏗️ Architecture

```
CarePulse/
├── backend/                        # Python FastAPI Backend
│   ├── ai/                        # AI Vision Detection Pipeline
│   │   ├── gesture_detection.py   # MediaPipe 10-second hand raise tracker
│   │   ├── ai_detector.py         # Motion gatekeeper & bounding box extraction
│   │   └── privacy_filter.py      # Real-time face blurring filter
│   ├── api/                       # REST & WebSocket API Endpoints
│   │   ├── alerts.py              # Alert query, acknowledge, resolve endpoints
│   │   ├── contacts.py            # Nurse/doctor contact CRUD operations
│   │   └── streams.py             # Binary WebSocket & MJPEG video streaming
│   ├── alert_manager.py           # Multi-channel notification & Twilio escalation
│   ├── video_processor.py         # Multi-stream frame ingest & AI worker
│   ├── database.py                # MongoDB Atlas connection & index management
│   ├── models.py                  # Pydantic schemas (Alert, Contact, AlertLog)
│   ├── config.py                  # Environment settings & thresholds
│   ├── main.py                    # FastAPI application entry point
│   └── requirements.txt           # Python dependencies
│
├── frontend/                      # Modern React 18 Dashboard
│   ├── src/
│   │   ├── pages/                 # Landing, Dashboard, Notifications, Settings
│   │   ├── components/            # ScreenCapture, ContactsManager, VideoGrid, SystemHealth
│   │   ├── contexts/              # ScreenCaptureContext, ThemeContext, ToastContext
│   │   ├── hooks/                 # useKeyboardShortcuts, useLocalStorage
│   │   ├── utils/                 # alertSounds, exportUtils
│   │   ├── App.jsx                # Main application router
│   │   └── index.css              # Styling & design system tokens
│   ├── package.json
│   └── vite.config.js
│
├── SETUP.md                       # Complete setup & deployment guide
├── PROJECT_PROGRESS.md            # Detailed progress report & audit
├── start.ps1                      # Single-command startup script
└── README.md
```

### Data Pipeline

```
CCTV Live Feed
      │
      ▼
[ Privacy Filter (Face Blur) ]
      │
      ▼
[ AI Gesture Engine: Wrist Elevation Tracking ]
      │
      ├── Hand Raised < 10s ───► Live Monitor Duration Timer (No Alert)
      │
      └── Hand Raised ≥ 10s ───► 🚨 PATIENT DISTRESS CONFIRMED
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
         [ MongoDB Atlas ]                             [ Alert Dispatcher ]
       (Logged to 'alerts')                                       │
                                          ┌───────────────────────┴───────────────────────┐
                                          ▼                                               ▼
                              [ Twilio Voice Call ]                             [ WebSocket Broadcast ]
                          (Assigned Nurse Contacts)                           (Ward Monitoring Dashboard)
```

---

## 🛠️ Tech Stack

### Backend & AI Engine
- **FastAPI**: Asynchronous Python API and WebSocket server.
- **MediaPipe**: Real-time pose and hand landmark tracking.
- **OpenCV (`cv2`)**: Frame acquisition, image processing, and Gaussian blurring.
- **Motor / PyMongo**: Asynchronous MongoDB Atlas client.
- **Twilio SDK**: Automated voice calls to nurse phone numbers.
- **Pydantic v2**: High-performance data validation and typing.

### Frontend Dashboard
- **React 18**: UI component library.
- **Vite**: Modern development server and build tool.
- **TailwindCSS**: Responsive medical UI styling.
- **Framer Motion**: Smooth micro-interactions and transitions.
- **HTML5 Canvas & WebSockets**: Low-latency video canvas rendering and real-time streaming.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+ (Tested on Python 3.12)
- Node.js 16+ & npm
- MongoDB Atlas or local MongoDB instance

### Automated Start (Windows)
```powershell
.\start.ps1
```

### Manual Start

#### 1. Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
- **Backend API**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

#### 2. Frontend
```powershell
cd frontend
npm install
npm run dev
```
- **Ward Dashboard**: `http://localhost:5173`

---

## ⚙️ Configuration (`backend/.env`)

```env
# Application
APP_NAME=CarePulse
DEBUG=True
HOST=0.0.0.0
PORT=8000

# MongoDB Atlas
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?appName=Cluster1
MONGODB_DB_NAME=carepulse

# Twilio (Voice Alert Calls to Nurses)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Privacy
ENABLE_FACE_BLUR=True
BLUR_KERNEL_SIZE=51
```

---

## 📡 API Reference

### 🚨 Alerts API (`/api/alerts`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/alerts` | Retrieve alerts (filterable by `status`) |
| `GET` | `/api/alerts/{id}` | Get specific alert by ID |
| `POST` | `/api/alerts/{id}/acknowledge` | Acknowledge active alert |
| `POST` | `/api/alerts/{id}/resolve` | Resolve an alert |
| `GET` | `/api/alerts/{id}/logs` | Retrieve action audit logs |

### 👥 Contacts Management API (`/api/contacts`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/contacts` | Get list of all nurse and doctor contacts |
| `POST` | `/api/contacts` | Add new nurse contact with phone number and priority |
| `GET` | `/api/contacts/{id}` | Get specific contact details |
| `PUT` | `/api/contacts/{id}` | Update contact phone number, role, or active status |
| `DELETE` | `/api/contacts/{id}` | Remove a contact |

### 📹 Video & Monitoring Stream API (`/api/streams`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `WS` | `/api/streams/mobile/{id}/ws` | Binary WebSocket video stream with 10s hand-raise detection |
| `POST` | `/api/streams/mobile/{id}/frame`| HTTP base64 frame ingest with AI evaluation |
| `GET` | `/api/streams/mobile/{id}/mjpeg`| Live MJPEG preview feed |
| `WS` | `/ws` | Dashboard real-time alert event notifications |

---

## 🧪 Testing the Distress Alert Workflow

1. Open **Contact Management** (`http://localhost:5173/contacts`) and add an active nurse with a verified phone number.
2. Open **Screen Monitoring** (`http://localhost:5173/screen-capture`) and click **Start CCTV Monitoring**.
3. Raise your hand in front of the camera:
   - Notice the live duration timer counting upward (`1.2s`, `2.5s`, `5.0s`, ...).
   - If lowered before 10 seconds, the timer safely resets.
   - When held continuously for **$\ge$ 10.0 seconds**, the status turns red: `DISTRESS DETECTED`.
   - The alert is recorded in MongoDB Atlas, broadcast to the dashboard, and an automated Twilio voice call dials the nurse.
4. You can also trigger a test alert via CLI anytime:
   ```powershell
   cd backend
   python trigger_test_alert.py
   ```

---

## 📄 License
This project is licensed under the MIT License.
