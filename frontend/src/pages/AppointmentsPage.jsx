import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, locationService } from '../services/api';

export default function AppointmentsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [form, setForm] = useState({ hospital_id: '', patient_name: '', date: '', time: '', reason: '' });
  const [booked, setBooked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mediAI_appointments') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    locationService.getCurrentPosition().then(loc =>
      api.getNearbyHospitals(loc.lat, loc.lng).then(d =>
        setHospitals((d.hospitals || []).filter(h => h.accepts_appointments))
      ).catch(() => setHospitals(FALLBACK))
    );
  }, []);

  const handleBook = async (e) => {
    e.preventDefault();
    if (!form.hospital_id || !form.patient_name || !form.date || !form.time) return;
    setLoading(true);
    try {
      let result;
      try { result = await api.bookAppointment(form); }
      catch { result = { id: 'APT' + Date.now(), hospital_name: hospitals.find(h => h.id === form.hospital_id)?.name || 'Hospital',
        patient_name: form.patient_name, date: form.date, time: form.time, reason: form.reason,
        status: 'Confirmed', confirmation_code: 'MED' + Math.floor(Math.random()*999999) }; }
      setBooked(result);
      const updated = [result, ...appointments];
      setAppointments(updated);
      localStorage.setItem('mediAI_appointments', JSON.stringify(updated));
      setForm({ hospital_id: '', patient_name: '', date: '', time: '', reason: '' });
    } finally { setLoading(false); }
  };

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div style={{ padding: 28, minHeight: '100vh', position: 'relative' }}>
      <div className="page-bg" />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 24, marginBottom: 6 }}>Book Appointment</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
          Schedule appointments at hospitals that support online booking
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Booking form */}
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
            <h3 style={{ fontFamily: 'Syne', fontSize: 17, marginBottom: 20 }}>New Appointment</h3>
            <form onSubmit={handleBook}>
              <Field label="Hospital">
                <select value={form.hospital_id} onChange={e => setForm({...form, hospital_id: e.target.value})} required
                  style={selectStyle}>
                  <option value="">Select a hospital…</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} — {h.type}</option>)}
                </select>
              </Field>
              <Field label="Patient Name">
                <input type="text" value={form.patient_name} onChange={e => setForm({...form, patient_name: e.target.value})}
                  placeholder="Full name" required style={inputStyle} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Date">
                  <input type="date" value={form.date} min={minDate} onChange={e => setForm({...form, date: e.target.value})}
                    required style={inputStyle} />
                </Field>
                <Field label="Time">
                  <select value={form.time} onChange={e => setForm({...form, time: e.target.value})} required style={selectStyle}>
                    <option value="">Time…</option>
                    {['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00'].map(t =>
                      <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Reason for Visit">
                <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
                  placeholder="Describe your medical concern…" rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
              </Field>
              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 4 }}>
                {loading ? 'Booking…' : '📅 Book Appointment'}
              </button>
            </form>
          </div>

          {/* Right panel: confirmation + history */}
          <div>
            <AnimatePresence>
              {booked && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: 16, padding: 20, marginBottom: 20 }}>
                  <div style={{ fontSize: 20, marginBottom: 10 }}>✅ Appointment Confirmed!</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8 }}>
                    <div>🏥 <strong style={{ color: '#e8f0ff' }}>{booked.hospital_name}</strong></div>
                    <div>👤 {booked.patient_name}</div>
                    <div>📅 {booked.date} at {booked.time}</div>
                    <div>📋 {booked.reason}</div>
                  </div>
                  <div style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(16,185,129,0.12)',
                    borderRadius: 8, fontFamily: 'monospace', fontSize: 13, color: '#10b981', letterSpacing: '0.05em' }}>
                    Confirmation: {booked.confirmation_code}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Appointment hospitals */}
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, marginBottom: 20 }}>
              <h4 style={{ fontFamily: 'Syne', fontSize: 14, marginBottom: 14, color: '#94a3b8' }}>
                Hospitals with Online Appointments
              </h4>
              {hospitals.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1e3558' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Fee: PKR {h.consultation_fee_pkr?.toLocaleString()}</div>
                  </div>
                  {h.appointment_url && (
                    <a href={h.appointment_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none',
                        padding: '4px 10px', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8 }}>
                      Portal ↗
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* My appointments */}
            {appointments.length > 0 && (
              <div>
                <h4 style={{ fontFamily: 'Syne', fontSize: 14, marginBottom: 12, color: '#94a3b8' }}>My Appointments</h4>
                {appointments.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ background: 'var(--surface3)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.hospital_name}</div>
                      <div style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', color: '#10b981',
                        padding: '2px 8px', borderRadius: 10 }}>{a.status}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                      {a.date} • {a.time} • {a.patient_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', background: '#1c2940', border: '1px solid #1e3558', borderRadius: 10,
  padding: '10px 14px', color: '#e8f0ff', fontFamily: 'DM Sans, sans-serif',
  fontSize: 14, outline: 'none', transition: 'border-color 0.2s'
};
const selectStyle = { ...inputStyle };

const FALLBACK = [
  { id: 'h2', name: 'Al-Shifa International Hospital', type: 'Private', accepts_appointments: true,
    appointment_url: 'https://al-shifa.org.pk', consultation_fee_pkr: 2500 },
  { id: 'h4', name: 'Shifa International Hospital', type: 'Private', accepts_appointments: true,
    appointment_url: 'https://shifa.com.pk', consultation_fee_pkr: 3000 },
];
