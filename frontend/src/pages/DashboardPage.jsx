import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage({ userId }) {
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [checkinHistory, setCheckinHistory] = useState([]);
  const [healthScore, setHealthScore] = useState(null);

  useEffect(() => {
    const vh = JSON.parse(localStorage.getItem('mediAI_vitals_history') || '[]');
    setVitalsHistory(vh);
    api.getCheckinHistory(userId).then(d => setCheckinHistory(d.history || [])).catch(() => {});
    const score = localStorage.getItem('mediAI_last_health_score');
    if (score) setHealthScore(parseInt(score));
  }, [userId]);

  const bpData = vitalsHistory.filter(v => v.type === 'blood_pressure').slice(0, 10).reverse()
    .map((v, i) => ({ x: i + 1, sys: v.systolic, dia: v.diastolic, time: new Date(v.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) }));
  const tempData = vitalsHistory.filter(v => v.type === 'temperature').slice(0, 10).reverse()
    .map((v, i) => ({ x: i + 1, val: v.celsius, time: new Date(v.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) }));
  const spo2Data = vitalsHistory.filter(v => v.type === 'spo2').slice(0, 10).reverse()
    .map((v, i) => ({ x: i + 1, val: v.spo2, time: new Date(v.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) }));

  const stats = [
    { label: 'Total Measurements', value: vitalsHistory.length, icon: '📊', color: '#3b82f6' },
    { label: 'Check-ins', value: checkinHistory.length, icon: '✅', color: '#10b981' },
    { label: 'Health Score', value: healthScore ? `${healthScore}%` : '—', icon: '❤️', color: '#ef4444' },
    { label: 'Days Tracked', value: Math.ceil(checkinHistory.length / 2) || 0, icon: '📅', color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: 28, minHeight: '100vh', position: 'relative' }}>
      <div className="page-bg" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 24, marginBottom: 6 }}>Health Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Your personalized health overview and trends</p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
          {stats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontFamily: 'Syne', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <ChartCard title="Blood Pressure Trend" subtitle="Systolic/Diastolic (mmHg)" data={bpData} empty={bpData.length < 2}>
            {bpData.length >= 2 && (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={bpData}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#4a6080' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#4a6080' }} domain={[60, 180]} />
                  <Tooltip contentStyle={{ background: '#1c2940', border: '1px solid #1e3558', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="sys" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Systolic" />
                  <Line type="monotone" dataKey="dia" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Diastolic" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Temperature Trend" subtitle="Celsius (°C)" data={tempData} empty={tempData.length < 2}>
            {tempData.length >= 2 && (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={tempData}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#4a6080' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#4a6080' }} domain={[35, 42]} />
                  <Tooltip contentStyle={{ background: '#1c2940', border: '1px solid #1e3558', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="val" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Temperature" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="SpO₂ Trend" subtitle="Oxygen Saturation (%)" data={spo2Data} empty={spo2Data.length < 2}>
            {spo2Data.length >= 2 && (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={spo2Data}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#4a6080' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#4a6080' }} domain={[85, 100]} />
                  <Tooltip contentStyle={{ background: '#1c2940', border: '1px solid #1e3558', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="SpO₂" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Recent activity */}
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 15, marginBottom: 4 }}>Recent Activity</div>
            <div style={{ fontSize: 12, color: '#4a6080', marginBottom: 14 }}>Latest health events</div>
            {vitalsHistory.length === 0 && checkinHistory.length === 0 ? (
              <div style={{ color: '#4a6080', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No activity yet. Start with the Vitals Monitor!
              </div>
            ) : (
              [...vitalsHistory.slice(0, 3).map(v => ({
                icon: v.type === 'blood_pressure' ? '🫀' : v.type === 'temperature' ? '🌡️' : '💨',
                label: v.type === 'blood_pressure' ? `BP: ${v.systolic}/${v.diastolic}` : v.type === 'temperature' ? `Temp: ${v.celsius}°C` : `SpO₂: ${v.spo2}%`,
                time: new Date(v.ts).toLocaleString(), status: v.status, color: { green: '#10b981', yellow: '#f59e0b', orange: '#f97316', red: '#ef4444' }[v.color]
              })),
              ...checkinHistory.slice(0, 2).map(c => ({
                icon: '✅', label: 'Health Check-in', time: new Date(c.timestamp).toLocaleString(), status: 'Completed', color: '#10b981'
              }))].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1e3558' }}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#4a6080' }}>{item.time}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${item.color}18`, color: item.color }}>
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Check-in history */}
        {checkinHistory.length > 0 && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontFamily: 'Syne', fontSize: 16, marginBottom: 14 }}>Check-in History</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
              {checkinHistory.slice(0, 8).map((c, i) => (
                <div key={i} style={{ background: 'var(--surface3)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#4a6080', marginBottom: 4 }}>
                    {new Date(c.timestamp).toLocaleDateString()}
                  </div>
                  {Object.entries(c.responses).slice(0, 3).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ textTransform: 'capitalize' }}>{k}</span>
                      <span style={{ color: v === 'good' || v === 'normal' ? '#10b981' : '#f59e0b' }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
      <div style={{ fontFamily: 'Syne', fontSize: 15, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#4a6080', marginBottom: 14 }}>{subtitle}</div>
      {empty ? (
        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#4a6080', fontSize: 13, flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 28 }}>📈</span>
          <span>No data yet. Start measuring!</span>
        </div>
      ) : children}
    </div>
  );
}
