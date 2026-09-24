# Care Pulse – Setup & Execution Guide

This document contains step-by-step instructions for installing, configuring, running, and verifying the **Care Pulse Patient Distress Detection System**.

---

## 📋 System Prerequisites

Ensure the following tools are installed on your environment:
- **Python**: Version 3.8 or higher (Tested on Python 3.12)
- **Node.js**: Version 16 or higher (Tested on Node.js v20)
- **PowerShell / Terminal**: Windows PowerShell or standard Bash shell
- **MongoDB Atlas or local MongoDB**: Connection string specified in `backend/.env`.

---

## ⚡ Quick Start (Automated Script)

To automatically launch both the backend API server and frontend dashboard on Windows:

```powershell
.\start.ps1
```

---

## 🛠️ Step-by-Step Manual Setup

### Step 1: Backend Setup

1. **Navigate to the Backend Directory**:
   ```powershell
   cd backend
   ```

2. **Create and Activate Python Virtual Environment**:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Verify or edit `backend/.env`:
   ```env
   # Application Configuration
   APP_NAME=CarePulse
   DEBUG=True
   HOST=0.0.0.0
   PORT=8000

   # MongoDB Atlas Connection
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?appName=Cluster1
   MONGODB_DB_NAME=carepulse

   # Twilio Voice Alerting (For calling nurses upon distress)
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_PHONE_NUMBER=+1234567890

   # Privacy Face Blurring
   ENABLE_FACE_BLUR=True
   BLUR_KERNEL_SIZE=51
   ```

5. **Start the Backend API Server**:
   ```powershell
   python main.py
   ```
   - **Backend API**: `http://localhost:8000`
   - **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`
   - **Health Check**: `http://localhost:8000/health`

---

### Step 2: Frontend Setup

1. **Navigate to the Frontend Directory**:
   Open a separate PowerShell window:
   ```powershell
   cd frontend
   ```

2. **Install Node Dependencies**:
   ```powershell
   npm install
   ```

3. **Start the Frontend Development Server**:
   ```powershell
   npm run dev
   ```
   - **Care Pulse Dashboard**: `http://localhost:5173`

---

## 🧪 Testing System Endpoints & Distress Workflow

### 1. Test Backend API Health
```powershell
curl.exe -s http://localhost:8000/health
```
Expected response:
```json
{"status":"healthy","database":true,"active_streams":0,"active_alerts":0}
```

### 2. Add an On-Duty Nurse Contact
```powershell
curl.exe -X POST http://localhost:8000/api/contacts `
  -H "Content-Type: application/json" `
  -d '{
    "name": "Nurse Sarah",
    "role": "nurse",
    "phone_number": "+1234567890",
    "priority": 1,
    "active": true
  }'
```

### 3. Retrieve Registered Contacts
```powershell
curl.exe -s http://localhost:8000/api/contacts
```

### 4. Trigger a Test Distress Alert via CLI
```powershell
cd backend
python trigger_test_alert.py
```
This directly tests:
1. Alert record insertion in MongoDB Atlas (`carepulse` database).
2. Real-time WebSocket event dispatch to all connected dashboard clients.
3. Automated voice call initiation via Twilio to the top-priority active nurse.

### 5. Test Live CCTV Vision Detection (10-Second Hand Raise)
1. Open `http://localhost:5173` and navigate to **Screen Monitoring** (`/screen-capture`).
2. Select your camera and click **Start CCTV Monitoring**.
3. Raise your hand in front of the camera:
   - MediaPipe will detect the raised wrist above shoulder level.
   - The on-screen tracking timer will count: `1.0s`, `2.0s`, ..., up to `10.0s`.
   - Lowering your hand resets the timer immediately.
   - Holding your hand continuously for **$\ge$ 10.0 seconds** triggers a confirmed distress alert and dispatches emergency notifications to the on-duty nurse.

---

## 🔍 Service Ports Overview

| Component | Protocol | Port | URL / Path |
| :--- | :--- | :--- | :--- |
| **FastAPI Backend** | HTTP | `8000` | `http://localhost:8000` |
| **API Docs (Swagger)**| HTTP | `8000` | `http://localhost:8000/docs` |
| **WebSocket Stream** | WS | `8000` | `ws://localhost:8000/ws` |
| **Vite Frontend** | HTTP | `5173` | `http://localhost:5173` |
