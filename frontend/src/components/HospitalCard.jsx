import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HospitalCard({ hospital: h, expanded }) {
  const [showCab, setShowCab] = useState(false);
  const ratingColor = h.rating >= 4.5 ? '#10b981' : h.rating >= 4 ? '#f59e0b' : '#94a3b8';

  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 10,
      transition: 'border-color 0.2s, background 0.2s',
      borderColor: expanded ? 'rgba(37,99,235,0.4)' : 'var(--border)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, color: '#e8f0ff' }}>{h.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{h.distance_label} away</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: ratingColor }}>★ {h.rating}</div>
          <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, marginTop: 3,
            background: h.type === 'Private' ? 'rgba(37,99,235,0.12)' : 'rgba(16,185,129,0.12)',
            color: h.type === 'Private' ? '#60a5fa' : '#10b981' }}>
            {h.type}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {h.emergency && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>🚨 Emergency</span>}
        {h.accepts_appointments && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>📅 Appointments</span>}
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>⏱ {h.avg_wait_min}min wait</span>
      </div>

      {/* Specialties */}
      {h.specialties && (
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
          {h.specialties.slice(0, 3).join(' · ')}
          {h.specialties.length > 3 && ` +${h.specialties.length - 3}`}
        </div>
      )}

      {/* Fee */}
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
        💊 Consultation: <strong style={{ color: '#e8f0ff' }}>PKR {h.consultation_fee_pkr?.toLocaleString()}</strong>
      </div>

      {/* Cab estimates */}
      {h.cab_estimate && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={e => { e.stopPropagation(); setShowCab(v => !v); }}
            style={{ background: 'transparent', border: '1px solid #1e3558', borderRadius: 8, padding: '5px 12px',
              fontSize: 11, color: '#64748b', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            🚕 Cab Estimates {showCab ? '▲' : '▼'} · ~{h.cab_estimate.estimated_time_min} min
          </button>
          <AnimatePresence>
            {showCab && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
                  {[
                    { name: 'InDriver', price: h.cab_estimate.indriver, color: '#10b981' },
                    { name: 'Uber', price: h.cab_estimate.uber, color: '#3b82f6' },
                    { name: 'Bykea', price: h.cab_estimate.bykea, color: '#f59e0b' },
                  ].map(cab => (
                    <div key={cab.name} style={{ background: 'var(--surface3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{cab.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: cab.color }}>PKR {cab.price}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <a href={h.directions_url || `https://www.google.com/maps/search/${encodeURIComponent(h.name)}`}
          target="_blank" rel="noreferrer"
          style={{ flex: 1, padding: '8px', textAlign: 'center', background: 'linear-gradient(135deg,#1d4ed8,#0d9488)',
            border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}
          onClick={e => e.stopPropagation()}>
          🗺️ Directions
        </a>
        {h.accepts_appointments && (
          <a href={h.appointment_url || '#'} target="_blank" rel="noreferrer"
            style={{ flex: 1, padding: '8px', textAlign: 'center', background: 'transparent',
              border: '1px solid rgba(37,99,235,0.4)', borderRadius: 8, color: '#60a5fa', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}
            onClick={e => e.stopPropagation()}>
            📅 Book Online
          </a>
        )}
        {h.phone && (
          <a href={`tel:${h.phone}`}
            style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #1e3558',
              borderRadius: 8, color: '#64748b', fontSize: 12, textDecoration: 'none' }}
            onClick={e => e.stopPropagation()}>
            📞
          </a>
        )}
      </div>
    </div>
  );
}
