import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AlertsPanel } from './components/index';
import ContactsManager from './components/ContactsManager';
import ScreenCapture from './components/ScreenCapture';
import SystemHealth from './components/SystemHealth';
import { MobileCamera } from './components/MobileCamera';

import { useTheme } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import alertSoundManager from './utils/alertSounds';
import { exportAlertsToCSV } from './utils/exportUtils';
import { API_BASE, WS_BASE } from './config';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import { ScreenCaptureProvider } from './contexts/ScreenCaptureContext';


function LandingGate({ alerts }) {
  const visited = (() => {
    try {
      return sessionStorage.getItem('visitedLanding') === '1';
    } catch {
      return false;
    }
  })();

  return <Landing alerts={alerts} />;
}


function AppContent() {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const [alerts, setAlerts] = useState([]);
  const wsRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const websocket = new WebSocket(`${WS_BASE}/ws`);

      websocket.onopen = () => {};

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      websocket.onclose = () => {
        setTimeout(connectWebSocket, 3000);
      };

      websocket.onerror = () => {};

      wsRef.current = websocket;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleWebSocketMessage = (data) => {
    if (data.type && data.type.includes('alert')) {
      fetchAlerts();
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/alerts`);
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  // alert sound
  useEffect(() => {
    if (alerts.length > 0) {
      const activeAlerts = alerts.filter(a => a.status === 'active');
      if (activeAlerts.length > 0) {
        const latestAlert = activeAlerts[0];
        alertSoundManager.playAlert(latestAlert.alert_type);
      }
    }
  }, [alerts.length]);

  // keyboard shortcuts
  useKeyboardShortcuts({
    acknowledgeAlert: () => {
      const activeAlert = alerts.find(a => a.status === 'active');
      if (activeAlert) {
        console.log('Acknowledge alert shortcut pressed');
      }
    },
    toggleDarkMode: toggleTheme,
    toggleMute: () => {
      const isEnabled = alertSoundManager.isEnabled();
      alertSoundManager.setEnabled(!isEnabled);
    },
    navigateTo: (path) => navigate(path),
    exportData: () => exportAlertsToCSV(alerts)
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">

      <main>
        <Routes>

          <Route path="/landing" element={<Landing alerts={alerts} />} />
          <Route path="/" element={<LandingGate alerts={alerts} />} />

          <Route path="/dashboard" element={<Dashboard alerts={alerts} />} />
          <Route path="/alerts" element={<div className="container py-8"><AlertsPanel alerts={alerts} onAlertsUpdate={fetchAlerts} /></div>} />
          <Route path="/contacts" element={<div className="container py-8"><ContactsManager /></div>} />
          <Route path="/screen-capture" element={<div className="container py-8"><ScreenCapture /></div>} />
          <Route path="/mobile" element={<div className="container py-8"><MobileCamera /></div>} />
          <Route path="/system" element={<div className="container py-8"><SystemHealth /></div>} />

          {/* removed Automation route (deleted file) */}

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </main>
    </div>
  );
}


// Theme toggle
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-700"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}


// Sound toggle
function SoundToggle() {
  const [muted, setMuted] = useState(!alertSoundManager.isEnabled());

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    alertSoundManager.setEnabled(!newMuted);
  };

  return (
    <button
      onClick={toggleMute}
      className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-700"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}


function App() {
  return (
    <ToastProvider>
      <ScreenCaptureProvider>
        <Router>
          <AppContent />
        </Router>
      </ScreenCaptureProvider>
    </ToastProvider>
  );
}

export default App;