import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';

const QUESTIONS = [
  { key: 'overall_feeling', label: 'How are you feeling overall today?', options: ['great', 'good', 'fair', 'poor'] },
  { key: 'sleep_quality', label: 'How was your sleep last night?', options: ['excellent', 'good', 'fair', 'poor'] },
  { key: 'energy_level', label: 'What is your energy level?', options: ['high', 'normal', 'low', 'very low'] },
  { key: 'pain_level', label: 'Are you experiencing any pain?', options: ['none', 'mild', 'moderate', 'severe'] },
  { key: 'appetite', label: 'How is your appetite?', options: ['normal', 'increased', 'decreased', 'none'] },
  { key: 'hydration', label: 'Are you staying hydrated?', options: ['yes', 'mostly', 'somewhat', 'no'] },
];

const optionColors = {
  great: '#10b981', good: '#10b981', excellent: '#10b981', high: '#10b981', normal: '#10b981', yes: '#10b981',
  fair: '#f59e0b', mostly: '#f59e0b', moderate: '#f59e0b', increased: '#f59e0b',
  poor: '#ef4444', low: '#ef4444', severe: '#ef4444', none: '#ef4444', 'very low': '#ef4444', decreased: '#f59e0b',
};

export default function CheckInModal({ userId, onClose }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentQ = QUESTIONS[step];

  const handleAnswer = async (value) => {
    const newAnswers = { ...answers, [currentQ.key]: value };
    setAnswers(newAnswers);
    
    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1);
    } else {
      setLoading(true);
      try {
        let res;
        try { res = await api.submitCheckin(userId, newAnswers); }
        catch { res = { health_score: 75, streak: 1 }; }
        localStorage.setItem('mediAI_last_health_score', String(res.health_score));
        setResult(res);
      } finally { setLoading(false); }
    }
  };

  const progress = (step / QUESTIONS.length) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          background: '#0f1829', border: '1px solid #1e3558', borderRadius: 24,
          padding: 32, maxWidth: 440, width: '100%', position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 28 }}>🩺</div>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, color: '#e8f0ff' }}>Daily Health Check-in</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {result ? 'Complete!' : `Question ${step + 1} of ${QUESTIONS.length}`}
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none',
            color: '#4a6080', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {!result ? (
          <>
            {/* Progress */}
            <div style={{ height: 4, background: '#1e3558', borderRadius: 4, marginBottom: 24 }}>
              <motion.div animate={{ width: `${progress}%` }}
                style={{ height: '100%', background: 'linear-gradient(90deg,#2563eb,#0d9488)', borderRadius: 4 }} />
            </div>

            {/* Question */}
            <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 20, color: '#e8f0ff', lineHeight: 1.5 }}>
              {currentQ.label}
            </div>

            {/* Options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {currentQ.options.map(opt => (
                <motion.button
                  key={opt}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                  onClick={() => handleAnswer(opt)}
                  style={{
                    padding: '12px', borderRadius: 12, border: '1px solid #1e3558',
                    background: 'var(--surface2)', color: '#94a3b8', cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 14, textTransform: 'capitalize',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.target.style.borderColor = optionColors[opt] || '#94a3b8';
                    e.target.style.color = optionColors[opt] || '#94a3b8';
                  }}
                  onMouseLeave={e => {
                    e.target.style.borderColor = '#1e3558';
                    e.target.style.color = '#94a3b8';
                  }}
                >
                  {opt}
                </motion.button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {result.health_score >= 75 ? '😊' : result.health_score >= 50 ? '😐' : '😟'}
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, marginBottom: 8 }}>
              Health Score: {result.health_score}%
            </div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
              {result.health_score >= 75 ? 'Great health indicators today! Keep it up.' :
               result.health_score >= 50 ? 'Decent health day. Consider improving sleep and hydration.' :
               'Some health concerns detected. Consider speaking with MediAI.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={onClose} className="btn-primary" style={{ padding: '10px 24px' }}>
                Done ✓
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#4a6080', marginTop: 12 }}>
              Next check-in scheduled in 12 hours
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
