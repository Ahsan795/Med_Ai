# 🩺 MediAI — Full-Stack Health Intelligence Platform

An AI-powered personal health assistant with voice recognition, vitals monitoring,
hospital finder, appointment booking, and daily health check-ins.

---

## 📁 Project Structure

```
mediAI/
├── backend/
│   ├── main.py            # FastAPI server — all REST + WebSocket endpoints
│   ├── voice_engine.py    # Python STT/TTS engine (gTTS + SpeechRecognition)
│   ├── scheduler.py       # Daily health check-in scheduler (runs every 12h)
│   ├── requirements.txt   # Python dependencies
│   └── .env.example       # Environment variables template
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      # Router + daily check-in trigger
│   │   ├── main.jsx                     # React entry point
│   │   ├── index.css                    # Global styles (dark theme)
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx             # 💬 AI chat with voice I/O
│   │   │   ├── VitalsPage.jsx           # ❤️  BP / Fever / SpO2 measurement
│   │   │   ├── HospitalsPage.jsx        # 🏥 Hospital finder + map
│   │   │   ├── AppointmentsPage.jsx     # 📅 Online appointment booking
│   │   │   └── DashboardPage.jsx        # 📊 Health trends & history
│   │   ├── components/
│   │   │   ├── Sidebar.jsx              # Navigation sidebar
│   │   │   ├── HospitalCard.jsx         # Hospital info + cab estimates
│   │   │   ├── PrescriptionCard.jsx     # AI prescription display
│   │   │   └── CheckInModal.jsx         # Daily health check-in popup
│   │   └── services/
│   │       └── api.js                   # All API calls + speechService + locationService
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
└── README.md
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Health Chat** | Claude-powered assistant asks 4-5 clinical questions, then gives Initial/Medium/High stage diagnosis |
| 🎤 **Voice Input (STT)** | Browser Web Speech API (frontend) + Python SpeechRecognition (backend) |
| 🔊 **Voice Output (TTS)** | Browser SpeechSynthesis + Python gTTS + pyttsx3 fallback |
| 🫀 **BP Measurement** | Simulated photoplethysmography (PPG) — systolic/diastolic/pulse |
| 🌡️ **Temperature Scan** | Simulated infrared skin scan — °C and °F |
| 💨 **SpO2 Monitoring** | Simulated pulse oximetry — oxygen saturation % |
| 🏥 **Hospital Finder** | Nearest hospitals with distance, rating, specialties, wait time |
| 🚕 **Cab Estimates** | InDriver / Uber / Bykea fare + travel time to each hospital |
| 📅 **Appointments** | Book online at Al-Shifa, Shifa International, IDC, and more |
| ✅ **Daily Check-in** | Twice-daily health check-in popup (auto-scheduled, 12h intervals) |
| 📊 **Dashboard** | Health score trends, vitals history charts, check-in streaks |
| 🗺️ **Live Map** | OpenStreetMap embed showing your location + nearby hospitals |

---

## 🚀 Quick Start

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd mediAI
```

### 2. Backend Setup (Python)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start the server
python main.py
# Server runs at: http://localhost:8000
# API docs at:    http://localhost:8000/docs
```

### 3. Frontend Setup (React)

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — add VITE_ANTHROPIC_API_KEY for direct API calls
# (or leave VITE_API_URL pointing to your backend)

# Start dev server
npm run dev
# App runs at: http://localhost:5173
```

### 4. Voice Engine (Optional — Python)

```bash
cd backend

# Test all voice components
python voice_engine.py --mode test

# Start voice-only chat session
python voice_engine.py

# Text-to-speech only
python voice_engine.py --mode tts --text "Hello from MediAI"

# Speech-to-text from microphone
python voice_engine.py --mode stt
```

### 5. Daily Check-in Scheduler (Optional)

```bash
cd backend

# Run scheduler (every 12 hours)
python scheduler.py

# Single check-in now
python scheduler.py --once

# Custom interval (every 8 hours)
python scheduler.py --interval 8

# View history
python scheduler.py --history
```

---

## 🔑 Environment Variables

### Backend (`backend/.env`)
```env
ANTHROPIC_API_KEY=sk-ant-...
PORT=8000
HOST=0.0.0.0
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:8000
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

> **Note:** If `VITE_ANTHROPIC_API_KEY` is set, the frontend calls the Anthropic API directly
> (no backend needed for chat). For production, always route through the backend.

---

## 🏥 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to AI health assistant |
| POST | `/api/tts` | Convert text to MP3 speech |
| POST | `/api/stt` | Convert uploaded audio to text |
| POST | `/api/vitals/measure` | Measure BP / temperature / SpO2 |
| GET  | `/api/hospitals/nearby` | Get hospitals near lat/lng |
| POST | `/api/appointments/book` | Book a hospital appointment |
| POST | `/api/checkin` | Submit daily health check-in |
| GET  | `/api/checkin/{id}/history` | Get check-in history |
| WS   | `/ws/vitals/{type}` | Real-time vitals measurement stream |

Full interactive docs: **http://localhost:8000/docs**

---

## 🗺️ Hospital Appointment Portals

These hospitals support online appointment booking:

| Hospital | Portal URL |
|----------|-----------|
| Al-Shifa International | https://al-shifa.org.pk |
| Shifa International | https://shifa.com.pk/patient-portal |
| Islamabad Diagnostic Centre | https://idc.com.pk |

---

## 🧠 AI Diagnosis Protocol

1. Patient describes symptoms
2. AI asks **4-5 targeted questions**: age, duration, severity (1-10), associated symptoms, existing conditions, medications
3. AI classifies severity:
   - 🟢 **INITIAL STAGE** → Home remedies, OTC medications, diet/lifestyle advice
   - 🟡 **MEDIUM STAGE** → Doctor visit within 24-48 hours, nearest clinic suggested
   - 🔴 **HIGH STAGE** → Immediate emergency care, hospital directions + cab fare shown

---

## 🔧 Production Deployment

```bash
# Backend (with gunicorn)
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend build
cd frontend
npm run build
# Serve dist/ with nginx or any static host
```

---

## ⚠️ Disclaimer

MediAI provides **general health guidance only** and is not a substitute for professional
medical advice, diagnosis, or treatment. Always consult a licensed physician for medical decisions.

---

## 📦 Dependencies

### Python
- `fastapi` — Web framework
- `anthropic` — Claude AI SDK
- `SpeechRecognition` — Microphone STT
- `gTTS` — Google Text-to-Speech
- `pyttsx3` — Offline TTS fallback
- `pygame` — Audio playback
- `uvicorn` — ASGI server

### JavaScript/React
- `react` + `react-router-dom` — UI framework
- `framer-motion` — Animations
- `recharts` — Health trend charts
- `lucide-react` — Icons
- Web Speech API — Browser STT/TTS (built-in)
