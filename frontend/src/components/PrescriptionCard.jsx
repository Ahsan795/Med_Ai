import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function PrescriptionCard({ text }) {
  const [expanded, setExpanded] = useState(true);
  const lines = text.split('\n').filter(l => l.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: 10,
        background: 'rgba(13,148,136,0.06)',
        border: '1px solid rgba(13,148,136,0.25)',
        borderRadius: 14, overflow: 'hidden'
      }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', padding: '12px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💊</span>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600, color: '#14b8a6' }}>
            Treatment Prescription
          </span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(13,148,136,0.12)', color: '#0d9488' }}>
            Initial Stage
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
      </button>
      
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {lines.map((line, i) => {
            const isHeader = line.includes(':') && !line.startsWith('-') && !line.startsWith('•') && !line.startsWith('→');
            const [key, ...rest] = line.includes(':') ? line.split(':') : [null, line];
            
            return (
              <div key={i} style={{
                padding: '8px 0',
                borderBottom: i < lines.length - 1 ? '1px solid rgba(13,148,136,0.12)' : 'none',
                display: isHeader ? 'flex' : 'block',
                gap: isHeader ? 10 : 0
              }}>
                {isHeader ? (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', minWidth: 90, textTransform: 'capitalize' }}>
                      {key?.replace(/[-•→]/g, '').trim()}
                    </span>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{rest.join(':').trim()}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: '#94a3b8', paddingLeft: 8 }}>{line}</span>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: 12, fontSize: 11, color: '#4a6080', fontStyle: 'italic' }}>
            ⚕️ Always consult a licensed physician before taking any medication.
          </div>
        </div>
      )}
    </motion.div>
  );
}
