import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import ChatPage from './pages/ChatPage';
import VitalsPage from './pages/VitalsPage';
import HospitalsPage from './pages/HospitalsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import DashboardPage from './pages/DashboardPage';
import Sidebar from './components/Sidebar';
import CheckInModal from './components/CheckInModal';
import { notificationService } from './services/api';
import './index.css';

export default function App() {
  const [showCheckin, setShowCheckin] = useState(false);
  const [userId] = useState(() => {
    let id = localStorage.getItem('mediAI_userId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('mediAI_userId', id);
    }
    return id;
  });

  useEffect(() => {
    notificationService.requestPermission();
    
    const checkSchedule = () => {
      if (notificationService.shouldCheckin()) {
        setShowCheckin(true);
        notificationService.send('MediAI Health Check 🩺', 'Time for your daily health check-in!');
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 60 * 60 * 1000); // check every hour
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Navigate to="/chat" replace />} />
              <Route path="/chat" element={<ChatPage userId={userId} />} />
              <Route path="/vitals" element={<VitalsPage />} />
              <Route path="/hospitals" element={<HospitalsPage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/dashboard" element={<DashboardPage userId={userId} />} />
            </Routes>
          </AnimatePresence>
        </main>
        {showCheckin && (
          <CheckInModal
            userId={userId}
            onClose={() => {
              setShowCheckin(false);
              notificationService.scheduleCheckin(12);
            }}
          />
        )}
      </div>
    </BrowserRouter>
  );
}
