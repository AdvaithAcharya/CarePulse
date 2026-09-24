// Sidebar.jsx
import { PageLayout, GlassCard } from './SharedLayout';
import { LiquidMetalButton } from './ui/LiquidMetal';

export function Sidebar() {
  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-md">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">CarePulse</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Patient Monitoring</p>
      </div>
      <nav className="mt-6">
        <a href="/" className="flex items-center px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
          <span>Dashboard</span>
        </a>
        <a href="/alerts" className="flex items-center px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
          <span>Alerts</span>
        </a>
        <a href="/contacts" className="flex items-center px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
          <span>Contacts</span>
        </a>
        <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
        <a href="/screen-capture" className="flex items-center px-6 py-3 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900">
          <span>Screen Monitoring</span>
        </a>
        <a href="/system" className="flex items-center px-6 py-3 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900">
          <span>System Health</span>
        </a>
      </nav>
    </aside>
  );
}

// Dashboard.jsx
export function Dashboard({ alerts }) {
  const activeAlerts = alerts.filter(a => a.status === 'active');
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Total Alerts</h3>
          <p className="text-3xl font-bold dark:text-white">{alerts.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Active Alerts</h3>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{activeAlerts.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">System Status</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">Online</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Recent Alerts</h2>
        <div className="space-y-2">
          {alerts.slice(0, 5).map(alert => (
            <div key={alert.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div>
                <p className="font-medium dark:text-white">{alert.description}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Room: {alert.room_id}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                alert.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>
                {alert.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// AlertsPanel.jsx
import { useState } from 'react';
import { exportAlertsToCSV } from '../utils/exportUtils';
import { useToast } from '../contexts/ToastContext';

export function AlertsPanel({ alerts = [], onAlertsUpdate }) {
  const toast = useToast();
  const [deletingId, setDeletingId] = useState(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const acknowledgeAlert = async (alert) => {
    const alertId = alert._id || alert.id;
    if (!alertId) {
      console.error('No alert ID found', alert);
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:8000/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'Nurse Admin' })
      });
      if (response.ok) {
        if (onAlertsUpdate) onAlertsUpdate();
        toast.success('Alert acknowledged successfully!');
      } else {
        const error = await response.text();
        toast.error(`Failed to acknowledge: ${error}`);
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  const deleteSingleAlert = async (alertId) => {
    setDeletingId(alertId);
    setConfirmDeleteId(null);
    try {
      const response = await fetch(`http://localhost:8000/api/alerts/${alertId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        toast.success('Alert log deleted successfully');
        if (onAlertsUpdate) onAlertsUpdate();
      } else {
        const error = await response.text();
        toast.error(`Failed to delete alert log: ${error}`);
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast.error(`Error deleting alert log: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const deleteAllAlerts = async () => {
    setIsClearingAll(true);
    setConfirmDeleteAll(false);
    try {
      const response = await fetch('http://localhost:8000/api/alerts/clear', {
        method: 'DELETE'
      });
      if (response.ok) {
        toast.success('All alert logs deleted successfully');
        if (onAlertsUpdate) onAlertsUpdate();
      } else {
        const error = await response.text();
        toast.error(`Failed to clear alerts: ${error}`);
      }
    } catch (error) {
      console.error('Error clearing alerts:', error);
      toast.error(`Error clearing alerts: ${error.message}`);
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <PageLayout title="Alert Management" subtitle="Manage, acknowledge, and clear system alert logs.">
      <GlassCard className="p-8 relative overflow-hidden">
        {/* inner glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[90px]" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Alert Logs ({alerts.length})</h2>
              <p className="text-xs text-white/40 mt-1">Real-time threat and system alert history</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <LiquidMetalButton
                onClick={() => exportAlertsToCSV(alerts)}
                disabled={alerts.length === 0}
                size="sm"
                borderWidth={3}
                icon={
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                }
              >
                Export CSV
              </LiquidMetalButton>

              {confirmDeleteAll ? (
                <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 p-1.5 rounded-full px-4">
                  <span className="text-xs text-red-300 font-medium">Delete all logs?</span>
                  <button
                    onClick={deleteAllAlerts}
                    disabled={isClearingAll}
                    className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full hover:bg-red-500 transition-colors shadow-lg"
                  >
                    {isClearingAll ? 'Deleting...' : 'Yes, Delete All'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteAll(false)}
                    className="px-2 py-1 text-xs text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  disabled={alerts.length === 0 || isClearingAll}
                  className="px-5 py-2.5 bg-red-500/10 text-red-400 text-sm font-semibold rounded-full border border-red-500/30 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete All Logs
                </button>
              )}
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="text-center py-16 border border-white/10 rounded-[2rem] bg-white/[0.02]">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-white/30">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white/70">No alert logs found</h3>
              <p className="text-sm text-white/40 mt-1">All incoming threat and system alerts will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map(alert => {
                const alertId = alert._id || alert.id;
                const isConfirmingDelete = confirmDeleteId === alertId;
                const isDeletingThis = deletingId === alertId;

                return (
                  <div key={alertId} className="border border-white/10 rounded-[2rem] p-5 bg-white/[0.03] hover:bg-white/[0.05] transition-all">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20">
                            {alert.alert_type}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            alert.status === 'active' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-white/5 text-white/50 border border-white/10'
                          }`}>
                            {alert.status}
                          </span>
                          {alert.room_id && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-white/60 border border-white/10">
                              Room: {alert.room_id}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-xl mb-1 text-white">{alert.description}</h3>
                        <p className="text-xs text-white/40 mt-2 font-mono">
                          {alert.timestamp ? new Date(alert.timestamp).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour12: true,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }) : 'Just now'} IST
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-start">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => acknowledgeAlert(alert)}
                            className="bg-white text-black px-5 py-2.5 rounded-full hover:bg-white/90 transition-colors font-bold text-sm shadow-lg flex items-center gap-1.5"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Acknowledge
                          </button>
                        )}

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 p-1 rounded-full px-3">
                            <span className="text-xs text-red-300 font-medium">Delete log?</span>
                            <button
                              onClick={() => deleteSingleAlert(alertId)}
                              disabled={isDeletingThis}
                              className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full hover:bg-red-500 transition-colors shadow-md"
                            >
                              {isDeletingThis ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-white/60 hover:text-white transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(alertId)}
                            title="Delete alert log"
                            className="p-2.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>
    </PageLayout>
  );
}

// VideoGrid.jsx
export function VideoGrid() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Video Feeds</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(room => (
          <div key={room} className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Room {room}</h3>
            <div className="bg-gray-200 aspect-video rounded flex items-center justify-center">
              <p className="text-gray-500">Camera feed would appear here</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ContactsManager.jsx
export function ContactsManager() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Contacts Management</h2>
      <div className="space-y-4">
        <p className="text-gray-600">Manage nurse and doctor contacts here.</p>
      </div>
    </div>
  );
}

export default { Sidebar, Dashboard, AlertsPanel, VideoGrid, ContactsManager };
