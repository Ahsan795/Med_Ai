import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api, locationService } from '../services/api';
import HospitalCard from '../components/HospitalCard';

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const init = async () => {
      const loc = await locationService.getCurrentPosition();
      setLocation(loc);
      try {
        const data = await api.getNearbyHospitals(loc.lat, loc.lng, 15);
        setHospitals(data.hospitals || []);
      } catch {
        setHospitals(FALLBACK_HOSPITALS);
      }
      setLoading(false);
    };
    init();
  }, []);

  const filtered = filter === 'all' ? hospitals
    : filter === 'appointment' ? hospitals.filter(h => h.accepts_appointments)
    : filter === 'emergency' ? hospitals.filter(h => h.emergency)
    : hospitals.filter(h => h.type?.toLowerCase() === filter);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div className="page-bg" />
      
      {/* Left panel */}
      <div style={{ width: 420, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid #1e3558', position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #1e3558', position: 'sticky', top: 0, background: 'rgba(8,13,24,0.95)', backdropFilter: 'blur(12px)', zIndex: 10 }}>
          <h1 style={{ fontFamily: 'Syne', fontSize: 20, marginBottom: 4 }}>Nearby Hospitals</h1>
          <p style={{ fontSize: 12, color: '#4a6080', marginBottom: 14 }}>
            {loading ? 'Finding hospitals near you…' : `${hospitals.length} hospitals found within 15 km`}
          </p>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'appointment', 'emergency', 'private', 'government'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: 'none',
                  background: filter === f ? 'rgba(37,99,235,0.2)' : 'var(--surface3)',
                  color: filter === f ? '#60a5fa' : '#64748b',
                  fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize'
                }}>
                {f === 'appointment' ? '📅 Appointments' : f === 'emergency' ? '🚨 Emergency' :
                 f === 'private' ? '🏢 Private' : f === 'government' ? '🏛️ Govt' : '🔍 All'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 16px' }}>
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} style={{ background: 'var(--surface2)', borderRadius: 14, padding: 18, marginBottom: 10, height: 120,
                animation: 'pulse 1.5s infinite', opacity: 0.6 }} />
            ))
          ) : filtered.map((h, i) => (
            <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(selected?.id === h.id ? null : h)}
              style={{ cursor: 'pointer' }}>
              <HospitalCard hospital={h} expanded={selected?.id === h.id} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Map panel */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        {location ? (
          <iframe
            title="Hospitals Map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng-0.08},${location.lat-0.06},${location.lng+0.08},${location.lat+0.06}&layer=mapnik&marker=${location.lat},${location.lng}`}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface)', color: '#64748b', fontSize: 14 }}>
            📍 Getting your location…
          </div>
        )}

        {/* Appointment hospitals callout */}
        <div style={{
          position: 'absolute', top: 16, right: 16, background: 'rgba(8,13,24,0.92)',
          backdropFilter: 'blur(12px)', border: '1px solid #1e3558', borderRadius: 14,
          padding: '14px 16px', maxWidth: 260
        }}>
          <div style={{ fontFamily: 'Syne', fontSize: 13, marginBottom: 8, color: '#60a5fa' }}>📅 Online Appointments</div>
          {hospitals.filter(h => h.accepts_appointments).slice(0, 3).map(h => (
            <a key={h.id} href={h.appointment_url || '#'} target="_blank" rel="noreferrer"
              style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5, textDecoration: 'none',
                ':hover': { color: '#e8f0ff' } }}>
              🏥 {h.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

const FALLBACK_HOSPITALS = [
  { id: 'h1', name: 'City General Hospital', type: 'Government', specialties: ['Emergency', 'General Medicine'],
    lat: 33.6844, lng: 73.0479, rating: 4.2, distance_km: 1.2, distance_label: '1.2 km',
    accepts_appointments: true, appointment_url: '#', emergency: true, avg_wait_min: 25,
    consultation_fee_pkr: 500, phone: '+92-51-9201234',
    cab_estimate: { indriver: 192, uber: 222, bykea: 162, estimated_time_min: 9 },
    directions_url: '#' },
];
