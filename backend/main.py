"""
MediAI Health Assistant - FastAPI Backend
Full-featured health AI with STT/TTS, vitals simulation, hospital finder
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import asyncio
import json
import os
import io
import base64
import math
import random
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel

# Try to import optional dependencies gracefully
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    print("WARNING: anthropic not installed. Run: pip install anthropic")

try:
    import speech_recognition as sr
    SR_AVAILABLE = True
except ImportError:
    SR_AVAILABLE = False
    print("WARNING: speech_recognition not installed. Run: pip install SpeechRecognition")

try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False
    print("WARNING: gTTS not installed. Run: pip install gTTS")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

app = FastAPI(title="MediAI Health Assistant API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_location: Optional[dict] = None

class VitalsRequest(BaseModel):
    measurement_type: str  # "bp" | "fever" | "spo2"
    duration_seconds: int = 10

class AppointmentRequest(BaseModel):
    hospital_id: str
    patient_name: str
    date: str
    time: str
    reason: str

class HealthCheckIn(BaseModel):
    user_id: str
    responses: dict

# ─── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are MediAI, a sophisticated and empathetic AI health assistant. You help patients understand their health conditions.

PROTOCOL:
1. Welcome warmly when patient first connects
2. Ask focused clinical questions ONE AT A TIME (max 4-5 questions): age, symptom duration, severity (1-10), associated symptoms, existing conditions, medications
3. After gathering info, provide comprehensive assessment

ASSESSMENT FORMAT - use these EXACT markers in responses:
[STAGE:INITIAL] - mild/early symptoms, home treatment sufficient
[STAGE:MEDIUM] - needs medical attention within 24-48 hours
[STAGE:HIGH] - urgent/emergency care needed immediately

For medium/high always add: [NEEDS_HOSPITAL:true]
For initial stage: [PRESCRIPTION:true]

PRESCRIPTION FORMAT (for initial stage):
[RX_START]
- Medication/Remedy: dosage and frequency
- Diet: specific foods to eat/avoid
- Activity: rest/exercise recommendations  
- Monitoring: what symptoms to watch
- Duration: expected recovery time
[RX_END]

Be warm, empathetic, clinical but understandable. Use patient-friendly language. Never be alarmist but be honest about severity."""

# ─── Chat Endpoint ────────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not ANTHROPIC_AVAILABLE:
        return {"reply": "Anthropic library not installed. Please run: pip install anthropic", "stage": None}
    
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {"reply": "ANTHROPIC_API_KEY not set in environment variables.", "stage": None}
    
    client = anthropic.Anthropic(api_key=api_key)
    
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1200,
            system=SYSTEM_PROMPT,
            messages=[{"role": m.role, "content": m.content} for m in request.messages]
        )
        reply = response.content[0].text
        
        stage = None
        if "[STAGE:INITIAL]" in reply: stage = "initial"
        elif "[STAGE:MEDIUM]" in reply: stage = "medium"
        elif "[STAGE:HIGH]" in reply: stage = "high"
        
        needs_hospital = "[NEEDS_HOSPITAL:true]" in reply
        has_prescription = "[PRESCRIPTION:true]" in reply
        
        return {
            "reply": reply,
            "stage": stage,
            "needs_hospital": needs_hospital,
            "has_prescription": has_prescription
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Text-to-Speech ───────────────────────────────────────────────────────────

@app.post("/api/tts")
async def text_to_speech(data: dict):
    text = data.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    if not GTTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="gTTS not installed. Run: pip install gTTS")
    
    try:
        clean_text = text
        for marker in ["[STAGE:INITIAL]","[STAGE:MEDIUM]","[STAGE:HIGH]",
                       "[NEEDS_HOSPITAL:true]","[PRESCRIPTION:true]","[RX_START]","[RX_END]"]:
            clean_text = clean_text.replace(marker, "")
        
        import re
        clean_text = re.sub(r'\*\*.*?\*\*', '', clean_text)
        clean_text = re.sub(r'\[.*?\]', '', clean_text)
        clean_text = clean_text[:500]
        
        tts = gTTS(text=clean_text, lang='en', slow=False)
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        return StreamingResponse(
            audio_buffer,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Speech-to-Text ───────────────────────────────────────────────────────────

@app.post("/api/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    if not SR_AVAILABLE:
        raise HTTPException(status_code=503, detail="speech_recognition not installed")
    
    try:
        audio_data = await audio.read()
        recognizer = sr.Recognizer()
        
        audio_buffer = io.BytesIO(audio_data)
        with sr.AudioFile(audio_buffer) as source:
            audio_content = recognizer.record(source)
        
        text = recognizer.recognize_google(audio_content)
        return {"text": text, "success": True}
    except sr.UnknownValueError:
        return {"text": "", "success": False, "error": "Could not understand audio"}
    except Exception as e:
        return {"text": "", "success": False, "error": str(e)}

# ─── Vitals Simulation (Fingerprint/Camera-based) ─────────────────────────────

@app.post("/api/vitals/measure")
async def measure_vitals(request: VitalsRequest):
    """
    Simulates photoplethysmography (PPG) based vitals measurement.
    In production, this would process actual camera/sensor data.
    Returns realistic randomized values for demonstration.
    """
    await asyncio.sleep(request.duration_seconds * 0.1)
    
    if request.measurement_type == "bp":
        systolic = random.randint(110, 145)
        diastolic = random.randint(70, 95)
        pulse = random.randint(60, 100)
        
        if systolic < 120 and diastolic < 80:
            status = "Normal"
            color = "green"
            advice = "Your blood pressure is in the normal range. Keep up healthy habits!"
        elif systolic < 130:
            status = "Elevated"
            color = "yellow"
            advice = "Your BP is slightly elevated. Monitor and reduce sodium intake."
        elif systolic < 140:
            status = "High Stage 1"
            color = "orange"
            advice = "Stage 1 hypertension detected. Consult a doctor soon."
        else:
            status = "High Stage 2"
            color = "red"
            advice = "Stage 2 hypertension. Please see a doctor promptly."
        
        return {
            "type": "blood_pressure",
            "systolic": systolic,
            "diastolic": diastolic,
            "pulse": pulse,
            "status": status,
            "color": color,
            "advice": advice,
            "timestamp": datetime.now().isoformat(),
            "unit": "mmHg"
        }
    
    elif request.measurement_type == "fever":
        temp_c = round(random.uniform(36.1, 39.5), 1)
        temp_f = round((temp_c * 9/5) + 32, 1)
        
        if temp_c < 37.5:
            status = "Normal"
            color = "green"
            advice = "Your temperature is normal. No fever detected."
        elif temp_c < 38.5:
            status = "Low-Grade Fever"
            color = "yellow"
            advice = "Low-grade fever. Rest, stay hydrated, monitor closely."
        elif temp_c < 39.5:
            status = "Moderate Fever"
            color = "orange"
            advice = "Moderate fever. Take antipyretics and see a doctor if it persists."
        else:
            status = "High Fever"
            color = "red"
            advice = "High fever! Seek medical attention immediately."
        
        return {
            "type": "temperature",
            "celsius": temp_c,
            "fahrenheit": temp_f,
            "status": status,
            "color": color,
            "advice": advice,
            "timestamp": datetime.now().isoformat(),
            "unit": "°C / °F"
        }
    
    elif request.measurement_type == "spo2":
        spo2 = random.randint(94, 99)
        pulse = random.randint(60, 100)
        
        if spo2 >= 95:
            status = "Normal"
            color = "green"
            advice = "Oxygen saturation is normal."
        elif spo2 >= 90:
            status = "Mild Hypoxemia"
            color = "yellow"
            advice = "Slightly low oxygen. Breathe deeply, monitor closely."
        else:
            status = "Hypoxemia"
            color = "red"
            advice = "Low oxygen saturation. Seek immediate medical care."
        
        return {
            "type": "spo2",
            "spo2": spo2,
            "pulse": pulse,
            "status": status,
            "color": color,
            "advice": advice,
            "timestamp": datetime.now().isoformat(),
            "unit": "%"
        }
    
    raise HTTPException(status_code=400, detail="Invalid measurement type")

# ─── Hospital Finder ──────────────────────────────────────────────────────────

HOSPITALS_DB = [
    {
        "id": "h1",
        "name": "City General Hospital",
        "type": "Government",
        "specialties": ["Emergency", "General Medicine", "Surgery", "Pediatrics"],
        "lat": 33.6844, "lng": 73.0479,
        "phone": "+92-51-9201234",
        "rating": 4.2,
        "beds": 500,
        "accepts_appointments": True,
        "appointment_url": "https://cghs.gov.pk/appointments",
        "emergency": True,
        "avg_wait_min": 25,
        "consultation_fee_pkr": 500
    },
    {
        "id": "h2",
        "name": "Al-Shifa International Hospital",
        "type": "Private",
        "specialties": ["Cardiology", "Oncology", "Neurology", "Orthopedics"],
        "lat": 33.6890, "lng": 73.0520,
        "phone": "+92-51-4446800",
        "rating": 4.7,
        "beds": 350,
        "accepts_appointments": True,
        "appointment_url": "https://al-shifa.org.pk",
        "emergency": True,
        "avg_wait_min": 15,
        "consultation_fee_pkr": 2500
    },
    {
        "id": "h3",
        "name": "PIMS Hospital",
        "type": "Government",
        "specialties": ["General Medicine", "Emergency", "Burns", "Psychiatry"],
        "lat": 33.7215, "lng": 73.0433,
        "phone": "+92-51-9260320",
        "rating": 3.9,
        "beds": 1500,
        "accepts_appointments": False,
        "appointment_url": None,
        "emergency": True,
        "avg_wait_min": 45,
        "consultation_fee_pkr": 200
    },
    {
        "id": "h4",
        "name": "Shifa International Hospital",
        "type": "Private",
        "specialties": ["Cardiology", "Gynecology", "Dermatology", "ENT"],
        "lat": 33.7006, "lng": 73.0479,
        "phone": "+92-51-8464646",
        "rating": 4.6,
        "beds": 424,
        "accepts_appointments": True,
        "appointment_url": "https://shifa.com.pk/patient-portal",
        "emergency": True,
        "avg_wait_min": 10,
        "consultation_fee_pkr": 3000
    },
    {
        "id": "h5",
        "name": "Islamabad Diagnostic Centre",
        "type": "Clinic",
        "specialties": ["Diagnostics", "Lab", "Radiology"],
        "lat": 33.6938, "lng": 73.0651,
        "phone": "+92-51-2871881",
        "rating": 4.4,
        "beds": 0,
        "accepts_appointments": True,
        "appointment_url": "https://idc.com.pk",
        "emergency": False,
        "avg_wait_min": 5,
        "consultation_fee_pkr": 1500
    }
]

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def estimate_cab_fare(distance_km: float) -> dict:
    """Estimate cab fare for Pakistani market (Islamabad)"""
    base_fare = 150
    per_km = 35
    indriver_fare = round(base_fare + distance_km * per_km * 0.85)
    uber_fare = round(base_fare + distance_km * per_km * 1.1)
    bykea_fare = round(base_fare + distance_km * per_km * 0.7)
    return {
        "indriver": indriver_fare,
        "uber": uber_fare,
        "bykea": bykea_fare,
        "estimated_time_min": round(distance_km * 3 + 5)
    }

@app.get("/api/hospitals/nearby")
async def get_nearby_hospitals(lat: float = 33.6844, lng: float = 73.0479, radius_km: float = 10):
    results = []
    for h in HOSPITALS_DB:
        dist = haversine(lat, lng, h["lat"], h["lng"])
        if dist <= radius_km:
            cab = estimate_cab_fare(dist)
            results.append({
                **h,
                "distance_km": round(dist, 2),
                "distance_label": f"{round(dist*1000)} m" if dist < 1 else f"{round(dist,1)} km",
                "cab_estimate": cab,
                "directions_url": f"https://www.google.com/maps/dir/{lat},{lng}/{h['lat']},{h['lng']}"
            })
    
    results.sort(key=lambda x: x["distance_km"])
    return {"hospitals": results, "total": len(results)}

# ─── Appointment System ───────────────────────────────────────────────────────

appointments_store = []

@app.post("/api/appointments/book")
async def book_appointment(request: AppointmentRequest):
    hospital = next((h for h in HOSPITALS_DB if h["id"] == request.hospital_id), None)
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    if not hospital["accepts_appointments"]:
        raise HTTPException(status_code=400, detail="This hospital doesn't support online appointments")
    
    appointment = {
        "id": f"APT{len(appointments_store)+1:04d}",
        "hospital_id": request.hospital_id,
        "hospital_name": hospital["name"],
        "patient_name": request.patient_name,
        "date": request.date,
        "time": request.time,
        "reason": request.reason,
        "status": "Confirmed",
        "confirmation_code": f"MED{random.randint(100000,999999)}",
        "created_at": datetime.now().isoformat()
    }
    appointments_store.append(appointment)
    return appointment

@app.get("/api/appointments/{appointment_id}")
async def get_appointment(appointment_id: str):
    apt = next((a for a in appointments_store if a["id"] == appointment_id), None)
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return apt

# ─── Daily Health Check-In ────────────────────────────────────────────────────

health_checkin_store = {}

@app.post("/api/checkin")
async def health_checkin(data: HealthCheckIn):
    checkin = {
        "user_id": data.user_id,
        "timestamp": datetime.now().isoformat(),
        "responses": data.responses,
        "next_checkin": (datetime.now() + timedelta(hours=12)).isoformat()
    }
    if data.user_id not in health_checkin_store:
        health_checkin_store[data.user_id] = []
    health_checkin_store[data.user_id].append(checkin)
    
    score = sum(1 for v in data.responses.values() if v in ["good", "normal", "yes"])
    total = len(data.responses)
    health_score = round((score / total) * 100) if total else 0
    
    return {
        "message": "Check-in recorded successfully",
        "health_score": health_score,
        "next_checkin": checkin["next_checkin"],
        "streak": len(health_checkin_store[data.user_id])
    }

@app.get("/api/checkin/{user_id}/history")
async def get_checkin_history(user_id: str):
    history = health_checkin_store.get(user_id, [])
    return {"history": history, "total_checkins": len(history)}

# ─── WebSocket for Real-time ──────────────────────────────────────────────────

@app.websocket("/ws/vitals/{measurement_type}")
async def vitals_websocket(websocket: WebSocket, measurement_type: str):
    await websocket.accept()
    try:
        for i in range(10):
            progress = (i + 1) * 10
            if NUMPY_AVAILABLE:
                signal_value = float(np.sin(i * 0.5) * 0.3 + random.uniform(-0.1, 0.1))
            else:
                import math
                signal_value = math.sin(i * 0.5) * 0.3 + random.uniform(-0.1, 0.1)
            
            await websocket.send_json({
                "progress": progress,
                "signal": round(signal_value, 3),
                "status": "measuring"
            })
            await asyncio.sleep(0.5)
        
        await websocket.send_json({"progress": 100, "status": "complete"})
    except WebSocketDisconnect:
        pass

# ─── Health Status ────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "services": {
            "anthropic": ANTHROPIC_AVAILABLE,
            "speech_recognition": SR_AVAILABLE,
            "gtts": GTTS_AVAILABLE,
            "numpy": NUMPY_AVAILABLE
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/")
async def root():
    return {"message": "MediAI Health Assistant API v2.0", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
