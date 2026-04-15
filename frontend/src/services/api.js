// MediAI Frontend API Service
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = {
  async chat(messages, userLocation = null) {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, user_location: userLocation })
    });
    if (!res.ok) throw new Error(`Chat error: ${res.status}`);
    return res.json();
  },

  async tts(text) {
    const res = await fetch(`${BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('TTS failed');
    return res.blob();
  },

  async stt(audioBlob) {
    const form = new FormData();
    form.append('audio', audioBlob, 'audio.wav');
    const res = await fetch(`${BASE_URL}/api/stt`, {
      method: 'POST',
      body: form
    });
    if (!res.ok) throw new Error('STT failed');
    return res.json();
  },

  async measureVitals(type, duration = 10) {
    const res = await fetch(`${BASE_URL}/api/vitals/measure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ measurement_type: type, duration_seconds: duration })
    });
    if (!res.ok) throw new Error('Vitals measurement failed');
    return res.json();
  },

  async getNearbyHospitals(lat, lng, radius = 10) {
    const res = await fetch(
      `${BASE_URL}/api/hospitals/nearby?lat=${lat}&lng=${lng}&radius_km=${radius}`
    );
    if (!res.ok) throw new Error('Hospital fetch failed');
    return res.json();
  },

  async bookAppointment(data) {
    const res = await fetch(`${BASE_URL}/api/appointments/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Appointment booking failed');
    return res.json();
  },

  async submitCheckin(userId, responses) {
    const res = await fetch(`${BASE_URL}/api/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, responses })
    });
    if (!res.ok) throw new Error('Check-in failed');
    return res.json();
  },

  async getCheckinHistory(userId) {
    const res = await fetch(`${BASE_URL}/api/checkin/${userId}/history`);
    if (!res.ok) throw new Error('History fetch failed');
    return res.json();
  },

  // Fallback: direct Anthropic API call from frontend (no backend needed)
  async chatDirect(messages) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('No API key');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: `You are MediAI, a sophisticated and empathetic AI health assistant.

PROTOCOL:
1. Welcome warmly when patient first connects
2. Ask focused clinical questions ONE AT A TIME (max 4-5): age, symptom duration, severity (1-10), associated symptoms, existing conditions, medications
3. After gathering info, provide comprehensive assessment

ASSESSMENT - use EXACT markers:
[STAGE:INITIAL] - mild/early, home treatment ok
[STAGE:MEDIUM] - needs doctor within 24-48 hrs
[STAGE:HIGH] - urgent/emergency care needed

For medium/high add: [NEEDS_HOSPITAL:true]
For initial add: [PRESCRIPTION:true]

PRESCRIPTION FORMAT (initial stage only):
[RX_START]
• Medication/Remedy: dosage and frequency
• Diet: specific foods to eat/avoid
• Activity: rest/exercise
• Monitoring: symptoms to watch
• Duration: expected recovery
[RX_END]

Be warm, empathetic, clinical but understandable.`,
        messages
      })
    });
    if (!res.ok) throw new Error('API call failed');
    const data = await res.json();
    const reply = data.content[0].text;
    let stage = null;
    if (reply.includes('[STAGE:INITIAL]')) stage = 'initial';
    else if (reply.includes('[STAGE:MEDIUM]')) stage = 'medium';
    else if (reply.includes('[STAGE:HIGH]')) stage = 'high';
    return {
      reply,
      stage,
      needs_hospital: reply.includes('[NEEDS_HOSPITAL:true]'),
      has_prescription: reply.includes('[PRESCRIPTION:true]')
    };
  }
};

// Browser-based Speech Recognition (Web Speech API)
export const speechService = {
  recognition: null,
  synthesis: window.speechSynthesis,

  startListening(onResult, onError) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError('Speech recognition not supported in this browser');
      return;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.onresult = (e) => onResult(e.results[0][0].transcript);
    this.recognition.onerror = (e) => onError(e.error);
    this.recognition.start();
  },

  stopListening() {
    if (this.recognition) this.recognition.stop();
  },

  speak(text, onEnd) {
    if (!this.synthesis) return;
    this.synthesis.cancel();
    const clean = text
      .replace(/\[.*?\]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/•/g, '')
      .slice(0, 400);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voices = this.synthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang === 'en-US')
      || voices.find(v => v.lang === 'en-US')
      || voices[0];
    if (preferred) utterance.voice = preferred;
    if (onEnd) utterance.onend = onEnd;
    this.synthesis.speak(utterance);
  },

  stopSpeaking() {
    if (this.synthesis) this.synthesis.cancel();
  }
};

// Geolocation helper
export const locationService = {
  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        resolve({ lat: 33.6844, lng: 73.0479 }); // Default: Islamabad
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 33.6844, lng: 73.0479 }),
        { timeout: 5000 }
      );
    });
  }
};

// Notification helper
export const notificationService = {
  async requestPermission() {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  },

  send(title, body, icon = '🩺') {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon });
    }
  },

  scheduleCheckin(intervalHours = 12) {
    const nextTime = new Date(Date.now() + intervalHours * 3600000);
    localStorage.setItem('mediAI_next_checkin', nextTime.toISOString());
    return nextTime;
  },

  shouldCheckin() {
    const next = localStorage.getItem('mediAI_next_checkin');
    if (!next) return true;
    return new Date() >= new Date(next);
  }
};
