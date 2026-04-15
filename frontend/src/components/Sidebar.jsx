import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/chat', icon: '💬', label: 'AI Assistant' },
  { path: '/vitals', icon: '❤️', label: 'Vitals Monitor' },
  { path: '/hospitals', icon: '🏥', label: 'Hospitals' },
  { path: '/appointments', icon: '📅', label: 'Appointments' },
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
];

export default function Sidebar() {
  return (
    <motion.aside
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        width: 240, zIndex: 100,
        background: 'rgba(10,16,28,0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid #1e3558',
        display: 'flex', flexDirection: 'column',
        padding: '0 0 24px'
      }}
    >
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid #1e3558',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 38, height: 38,
            background: 'linear-gradient(135deg, #2563eb, #0d9488)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18
          }}>🩺</div>
          <div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 18, fontWeight: 700,
              background: 'linear-gradient(90deg, #60a5fa, #34d399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>MediAI</div>
            <div style={{ fontSize: 10, color: '#4a6080', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Health Platform
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0 12px' }}>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '11px 12px',
              borderRadius: 10,
              marginBottom: 4,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? '#e8f0ff' : '#64748b',
              background: isActive ? 'rgba(37,99,235,0.12)' : 'transparent',
              border: isActive ? '1px solid rgba(37,99,235,0.2)' : '1px solid transparent',
              transition: 'all 0.2s'
            })}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '0 20px' }}>
        <div style={{
          background: 'rgba(37,99,235,0.08)',
          border: '1px solid rgba(37,99,235,0.2)',
          borderRadius: 10,
          padding: '12px 14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px #10b981'
            }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>AI Online</span>
          </div>
          <div style={{ fontSize: 11, color: '#4a6080' }}>claude-sonnet-4</div>
        </div>
      </div>
    </motion.aside>
  );
}
