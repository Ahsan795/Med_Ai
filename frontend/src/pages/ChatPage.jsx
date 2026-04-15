import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, speechService, locationService } from '../services/api';
import HospitalCard from '../components/HospitalCard';
import PrescriptionCard from '../components/PrescriptionCard';

const QUICK_PROMPTS = [
  { icon: '🤒', label: 'Fever & Headache', text: 'I have a fever and severe headache since yesterday' },
  { icon: '❤️', label: 'Chest Pain', text: 'I have chest pain and shortness of breath' },
  { icon: '🩸', label: 'Diabetes Signs', text: 'I have symptoms of diabetes - excessive thirst and fatigue' },
  { icon: '🦴', label: 'Joint Pain', text: 'I have severe joint and back pain' },
  { icon: '😮‍💨', label: 'Breathing Issues', text: 'I am having difficulty breathing and chest tightness' },
  { icon: '🤕', label: 'Migraine', text: 'I have a very bad migraine with nausea' },
];

const STAGE_CONFIG = {
  initial: { label: 'Initial Stage', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', emoji: '🟢' },
  medium: { label: 'Medium Stage', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', emoji: '🟡' },
  high: { label: 'High Stage', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', emoji: '🔴' },
};

function parseReply(text) {
  let stage = null, needsHospital = false, prescription = null;
  if (text.includes('[STAGE:INITIAL]')) stage = 'initial';
  if (text.includes('[STAGE:MEDIUM]')) stage = 'medium';
  if (text.includes('[STAGE:HIGH]')) stage = 'high';
  needsHospital = text.includes('[NEEDS_HOSPITAL:true]');
  
  const rxMatch = text.match(/\[RX_START\]([\s\S]*?)\[RX_END\]/);
  if (rxMatch) prescription = rxMatch[1].trim();
  
  let clean = text
    .replace(/\[STAGE:\w+\]/g, '').replace(/\[NEEDS_HOSPITAL:\w+\]/g, '')
    .replace(/\[PRESCRIPTION:\w+\]/g, '').replace(/\[RX_START\][\s\S]*?\[RX_END\]/g, '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/•/g, '→')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  clean = '<p>' + clean + '</p>';
  
  return { clean, stage, needsHospital, prescription };
}

export default function ChatPage({ userId }) {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, 100);
  }, []);

  const addMessage = useCallback((role, content, meta = {}) => {
    const msg = { id: Date.now() + Math.random(), role, content, meta, ts: new Date() };
    setMessages(prev => [...prev, msg]);
    scrollToBottom();
    return msg;
  }, [scrollToBottom]);

  const sendToAI = useCallback(async (text, isInit = false) => {
    const newHistory = isInit
      ? [{ role: 'user', content: text }]
      : [...history, { role: 'user', content: text }];
    
    setHistory(newHistory);
    setLoading(true);

    try {
      let result;
      try {
        result = await api.chatDirect(newHistory);
      } catch {
        result = await api.chat(newHistory, userLocation);
      }

      const { clean, stage, needsHospital, prescription } = parseReply(result.reply);
      setHistory(prev => [...prev, { role: 'assistant', content: result.reply }]);
      
      addMessage('ai', clean, { stage, needsHospital, prescription, raw: result.reply });

      if (autoSpeak) {
        setSpeaking(true);
        speechService.speak(result.reply, () => setSpeaking(false));
      }

      if (needsHospital && userLocation) {
        const data = await api.getNearbyHospitals(userLocation.lat, userLocation.lng);
        setHospitals(data.hospitals || []);
      }
    } catch (err) {
      addMessage('ai', `<p style="color:#ef4444">⚠️ Connection error. Please check your API key and try again.</p>`);
    } finally {
      setLoading(false);
    }
  }, [history, userLocation, autoSpeak, addMessage]);

  useEffect(() => {
    const init = async () => {
      const loc = await locationService.getCurrentPosition();
      setUserLocation(loc);
      await sendToAI("Hello, I just opened MediAI. Please give me a warm professional welcome as MediAI health assistant.", true);
      setInitialized(true);
    };
    init();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addMessage('user', text);
    await sendToAI(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleVoiceInput = () => {
    if (listening) {
      speechService.stopListening();
      setListening(false);
      return;
    }
    setListening(true);
    speechService.startListening(
      (text) => { setInput(text); setListening(false); },
      (err) => { console.error('STT:', err); setListening(false); }
    );
  };

  const toggleSpeak = (text) => {
    if (speaking) { speechService.stopSpeaking(); setSpeaking(false); }
    else { setSpeaking(true); speechService.speak(text, () => setSpeaking(false)); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      <div className="page-bg" />
      
      {/* Header */}
      <div style={{
        padding: '16px 28px', borderBottom: '1px solid #1e3558',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(8,13,24,0.85)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50
      }}>
        <div>
          <h2 style={{ fontFamily: 'Syne', fontSize: 18, color: '#e8f0ff', marginBottom: 2 }}>AI Health Assistant</h2>
          <div style={{ fontSize: 12, color: '#4a6080' }}>Describe your symptoms to get personalized health guidance</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setAutoSpeak(v => !v)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              background: autoSpeak ? 'rgba(37,99,235,0.15)' : 'transparent',
              border: `1px solid ${autoSpeak ? 'rgba(37,99,235,0.4)' : '#1e3558'}`,
              color: autoSpeak ? '#60a5fa' : '#64748b', transition: 'all 0.2s'
            }}
          >
            {autoSpeak ? '🔊 Auto-speak ON' : '🔇 Auto-speak OFF'}
          </button>
          <button onClick={() => { setMessages([]); setHistory([]); setHospitals([]); setInitialized(false); window.location.reload(); }}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              background: 'transparent', border: '1px solid #1e3558', color: '#64748b' }}>
            🔄 New Chat
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}
            >
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 2,
                background: msg.role === 'ai' ? 'linear-gradient(135deg,#1d4ed8,#0d9488)' : 'linear-gradient(135deg,#7c3aed,#db2777)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
              }}>
                {msg.role === 'ai' ? '🩺' : '👤'}
              </div>

              <div style={{ maxWidth: '72%' }}>
                {/* Main bubble */}
                <div style={{
                  background: msg.role === 'ai' ? 'var(--surface2)' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                  border: msg.role === 'ai' ? '1px solid var(--border)' : 'none',
                  borderRadius: 16,
                  borderTopLeftRadius: msg.role === 'ai' ? 4 : 16,
                  borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                  padding: '14px 18px',
                  fontSize: 15, lineHeight: 1.65, color: '#e8f0ff'
                }}
                  dangerouslySetInnerHTML={{ __html: msg.content }}
                />

                {/* Stage card */}
                {msg.meta?.stage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      marginTop: 10, padding: '16px 18px', borderRadius: 14,
                      background: STAGE_CONFIG[msg.meta.stage].bg,
                      border: `1px solid ${STAGE_CONFIG[msg.meta.stage].border}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{STAGE_CONFIG[msg.meta.stage].emoji}</span>
                      <span style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 700, color: STAGE_CONFIG[msg.meta.stage].color }}>
                        {STAGE_CONFIG[msg.meta.stage].label} Detected
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: '#94a3b8' }}>
                      {msg.meta.stage === 'initial' && 'Early stage condition. Home remedies and monitoring recommended.'}
                      {msg.meta.stage === 'medium' && 'Medical attention required within 24-48 hours. Consider visiting a clinic.'}
                      {msg.meta.stage === 'high' && 'URGENT: Seek immediate medical care at the nearest hospital.'}
                    </p>
                  </motion.div>
                )}

                {/* Prescription card */}
                {msg.meta?.prescription && <PrescriptionCard text={msg.meta.prescription} />}

                {/* Hospital section */}
                {msg.meta?.needsHospital && hospitals.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8,
                      textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏥 Nearest Hospitals</div>
                    {hospitals.slice(0, 3).map(h => <HospitalCard key={h.id} hospital={h} />)}
                    {/* Map */}
                    {userLocation && (
                      <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', height: 200 }}>
                        <iframe
                          title="Hospital Map"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${userLocation.lng-0.05},${userLocation.lat-0.05},${userLocation.lng+0.05},${userLocation.lat+0.05}&layer=mapnik&marker=${userLocation.lat},${userLocation.lng}`}
                          style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Speak button for AI messages */}
                {msg.role === 'ai' && (
                  <button
                    onClick={() => toggleSpeak(msg.meta?.raw || msg.content)}
                    style={{
                      marginTop: 6, background: 'transparent', border: 'none',
                      color: '#4a6080', fontSize: 11, cursor: 'pointer', padding: '2px 0'
                    }}
                  >
                    {speaking ? '⏹ Stop' : '🔊 Listen'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1d4ed8,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🩺</div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16, borderTopLeftRadius: 4, padding: '14px 18px', display: 'flex', gap: 6 }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#4a6080',
                  animation: 'bounce 1.2s infinite', animationDelay: `${d}s`
                }} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '16px 28px 24px', borderTop: '1px solid #1e3558',
        background: 'rgba(8,13,24,0.9)', backdropFilter: 'blur(12px)'
      }}>
        {/* Quick prompts */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {QUICK_PROMPTS.map(qp => (
            <button key={qp.label}
              onClick={() => { setInput(qp.text); inputRef.current?.focus(); }}
              style={{
                padding: '5px 12px', background: 'var(--surface2)', border: '1px solid var(--border)',
                color: '#94a3b8', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.color = '#60a5fa'; }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = '#94a3b8'; }}
            >
              {qp.icon} {qp.label}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          {/* Voice button */}
          <button
            onClick={handleVoiceInput}
            style={{
              width: 46, height: 46, borderRadius: 12, border: `1px solid ${listening ? 'var(--red)' : 'var(--border)'}`,
              background: listening ? 'rgba(239,68,68,0.1)' : 'var(--surface2)',
              color: listening ? '#ef4444' : '#64748b', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: listening ? 'pulse 1s infinite' : 'none', transition: 'all 0.2s'
            }}
            title={listening ? 'Stop Recording' : 'Start Voice Input'}
          >
            {listening ? '⏹' : '🎤'}
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Listening… speak now' : 'Describe your symptoms or ask a health question…'}
            rows={1}
            style={{
              flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '12px 16px', color: '#e8f0ff',
              fontFamily: 'DM Sans, sans-serif', fontSize: 15, resize: 'none',
              outline: 'none', minHeight: 46, maxHeight: 120, lineHeight: 1.5,
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#2563eb'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="btn-primary"
            style={{ width: 46, height: 46, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, borderRadius: 12 }}
          >➤</button>
        </div>
        <div style={{ fontSize: 11, color: '#4a6080', textAlign: 'center', marginTop: 10 }}>
          ⚕️ MediAI provides general health guidance only. Always consult a licensed physician for medical decisions.
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)} }
      `}</style>
    </div>
  );
}
