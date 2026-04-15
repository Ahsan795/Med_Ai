import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';

const VITALS = [
  { type: 'bp', icon: '🫀', label: 'Blood Pressure', sublabel: 'PPG Fingerprint Scan', color: '#ef4444', duration: 15 },
  { type: 'fever', icon: '🌡️', label: 'Body Temperature', sublabel: 'Infrared Skin Scan', color: '#f59e0b', duration: 10 },
  { type: 'spo2', icon: '💨', label: 'Oxygen Saturation', sublabel: 'Pulse Oximetry Scan', color: '#3b82f6', duration: 8 },
];

function GaugeChart({ value, min, max, color, unit }) {
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const angle = -135 + pct * 270;
  const r = 70, cx = 90, cy = 90;
  const toXY = (deg, radius) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };
  const [sx, sy] = toXY(-135, r);
  const [ex, ey] = toXY(135, r);
  const [px, py] = toXY(angle, r - 8);

  return (
    <svg viewBox="0 0 180 120" style={{ width: '100%', maxWidth: 200, margin: '0 auto', display: 'block' }}>
      <path d={`M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`} fill="none" stroke="#1e3558" strokeWidth={12} strokeLinecap="round" />
      <path d={`M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
        strokeDasharray={`${pct * 314} 314`} opacity={0.8} />
      <circle cx={px} cy={py} r={6} fill={color} />
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={22} fontWeight={700} fill="#e8f0ff" fontFamily="Syne, sans-serif">
        {value}
      </text>
      <text x={cx} y={cy + 34} textAnchor="middle" fontSize={10} fill="#4a6080">{unit}</text>
    </svg>
  );
}

function WaveAnimation({ color, active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = active ? 8 : 0;
      ctx.shadowColor = color;

      for (let x = 0; x < W; x++) {
        const t = (x + offsetRef.current) * 0.05;
        const y = H / 2 + (active ? Math.sin(t) * 20 + Math.sin(t * 2.5) * 8 : Math.sin(t) * 3);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (active) offsetRef.current += 3;
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [color, active]);

  return <canvas ref={canvasRef} width={300} height={60} style={{ width: '100%', maxWidth: 300 }} />;
}

export default function VitalsPage() {
  const [selected, setSelected] = useState(null);
  const [measuring, setMeasuring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mediAI_vitals_history') || '[]'); }
    catch { return []; }
  });

  const startMeasurement = async (vital) => {
    setSelected(vital);
    setResult(null);
    setProgress(0);
    setMeasuring(true);

    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + (100 / vital.duration) * 0.1;
      });
    }, 100);

    try {
      const data = await api.measureVitals(vital.type, vital.duration);
      clearInterval(interval);
      setProgress(100);
      setResult(data);
      setMeasuring(false);

      const entry = { ...data, vital_type: vital.type, ts: new Date().toISOString() };
      const updated = [entry, ...history].slice(0, 20);
      setHistory(updated);
      localStorage.setItem('mediAI_vitals_history', JSON.stringify(updated));
    } catch (err) {
      clearInterval(interval);
      setMeasuring(false);
      setResult({ error: 'Measurement failed. Please ensure backend is running.' });
    }
  };

  const colorMap = { green: '#10b981', yellow: '#f59e0b', orange: '#f97316', red: '#ef4444' };

  return (
    <div style={{ padding: '28px', minHeight: '100vh', position: 'relative' }}>
      <div className="page-bg" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 24, marginBottom: 6 }}>Vitals Monitor</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
          Simulate vital sign measurements using photoplethysmography (PPG) technology
        </p>

        {/* Vital selection cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 32 }}>
          {VITALS.map(v => (
            <motion.div
              key={v.type}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => !measuring && startMeasurement(v)}
              style={{
                background: selected?.type === v.type ? 'rgba(37,99,235,0.1)' : 'var(--surface2)',
                border: `1px solid ${selected?.type === v.type ? 'rgba(37,99,235,0.35)' : 'var(--border)'}`,
                borderRadius: 16, padding: 20, cursor: measuring ? 'not-allowed' : 'pointer',
                opacity: measuring && selected?.type !== v.type ? 0.5 : 1, transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>{v.icon}</div>
              <div style={{ fontFamily: 'Syne', fontSize: 16, marginBottom: 4 }}>{v.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{v.sublabel}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: `${v.color}20`, color: v.color, border: `1px solid ${v.color}40`
                }}>
                  {measuring && selected?.type === v.type ? 'Measuring…' : 'Start Scan'}
                </div>
                <span style={{ fontSize: 11, color: '#4a6080' }}>{v.duration}s</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Measurement display */}
        <AnimatePresence>
          {(measuring || result) && selected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 20, padding: 28, marginBottom: 24
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>{selected.icon}</span>
                <div>
                  <div style={{ fontFamily: 'Syne', fontSize: 18 }}>{selected.label}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    {measuring ? `Scanning… ${Math.round(progress)}%` : 'Measurement Complete'}
                  </div>
                </div>
                {result && !result.error && (
                  <div style={{
                    marginLeft: 'auto', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    background: `${colorMap[result.color] || '#94a3b8'}20`,
                    color: colorMap[result.color] || '#94a3b8'
                  }}>
                    {result.status}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: '#1e3558', borderRadius: 4, marginBottom: 20 }}>
                <motion.div
                  style={{ height: '100%', borderRadius: 4, background: selected.color }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>

              {/* Wave */}
              <div style={{ marginBottom: 20 }}>
                <WaveAnimation color={selected.color} active={measuring} />
              </div>

              {/* Results */}
              {result && !result.error && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
                  {result.type === 'blood_pressure' && (
                    <>
                      <div style={{ background: 'var(--surface3)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 700, color: selected.color }}>
                          {result.systolic}/{result.diastolic}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>mmHg</div>
                      </div>
                      <div style={{ background: 'var(--surface3)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 700, color: '#60a5fa' }}>{result.pulse}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>BPM</div>
                      </div>
                    </>
                  )}
                  {result.type === 'temperature' && (
                    <>
                      <div style={{ background: 'var(--surface3)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 700, color: selected.color }}>{result.celsius}°C</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Celsius</div>
                      </div>
                      <div style={{ background: 'var(--surface3)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 700, color: '#f97316' }}>{result.fahrenheit}°F</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Fahrenheit</div>
                      </div>
                    </>
                  )}
                  {result.type === 'spo2' && (
                    <>
                      <div style={{ background: 'var(--surface3)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 700, color: selected.color }}>{result.spo2}%</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>SpO₂</div>
                      </div>
                      <div style={{ background: 'var(--surface3)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 700, color: '#60a5fa' }}>{result.pulse}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>BPM</div>
                      </div>
                    </>
                  )}
                  <div style={{ background: `${colorMap[result.color] || '#94a3b8'}10`, borderRadius: 12, padding: 16, gridColumn: '1/-1', borderLeft: `3px solid ${colorMap[result.color] || '#94a3b8'}` }}>
                    <p style={{ fontSize: 14, color: '#94a3b8' }}>{result.advice}</p>
                  </div>
                </div>
              )}
              {result?.error && <p style={{ color: '#ef4444', fontSize: 14 }}>⚠️ {result.error}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && (
          <div>
            <h3 style={{ fontFamily: 'Syne', fontSize: 16, marginBottom: 14, color: '#94a3b8' }}>Recent Measurements</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.slice(0, 8).map((h, i) => (
                <div key={i} style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ marginRight: 8 }}>
                      {h.type === 'blood_pressure' ? '🫀' : h.type === 'temperature' ? '🌡️' : '💨'}
                    </span>
                    <span>
                      {h.type === 'blood_pressure' ? `${h.systolic}/${h.diastolic} mmHg, ${h.pulse} BPM` :
                       h.type === 'temperature' ? `${h.celsius}°C / ${h.fahrenheit}°F` :
                       `SpO₂ ${h.spo2}%, ${h.pulse} BPM`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12,
                      background: `${colorMap[h.color] || '#94a3b8'}15`, color: colorMap[h.color] || '#94a3b8' }}>
                      {h.status}
                    </span>
                    <span style={{ fontSize: 11, color: '#4a6080' }}>
                      {new Date(h.ts).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
