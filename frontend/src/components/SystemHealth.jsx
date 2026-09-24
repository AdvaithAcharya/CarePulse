import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { exportSystemHealthReport } from '../utils/exportUtils';
import { PageLayout, GlassCard } from './SharedLayout';
import { LiquidMetalBorder, LiquidMetalButton } from './ui/LiquidMetal';
import { API_BASE } from '../config';

export const SystemHealth = () => {
  const [health, setHealth] = useState({
    websocketConnected: false,
    apiStatus: 'unknown',
    databaseConnected: false,
    activeStreams: 0,
    totalAlerts: 0,
    activeAlerts: 0,
    apiResponseTime: 0,
    lastUpdated: new Date()
  });

  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    fps: 0
  });

  useEffect(() => {
    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSystemHealth = async () => {
    const startTime = Date.now();
    
    try {
      // Check API health
      const response = await fetch(`${API_BASE}/health`);
      const apiResponseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        setHealth(prev => ({
          ...prev,
          apiStatus: 'healthy',
          databaseConnected: data.database || false,
          activeStreams: data.active_streams || 0,
          apiResponseTime,
          lastUpdated: new Date()
        }));
      } else {
        setHealth(prev => ({ ...prev, apiStatus: 'degraded', apiResponseTime }));
      }
    } catch (error) {
      setHealth(prev => ({
        ...prev,
        apiStatus: 'down',
        lastUpdated: new Date()
      }));
    }

    // Fetch alerts count
    try {
      const alertsRes = await fetch(`${API_BASE}/api/alerts`);
      if (alertsRes.ok) {
        const alerts = await alertsRes.json();
        setHealth(prev => ({
          ...prev,
          totalAlerts: alerts.length,
          activeAlerts: alerts.filter(a => a.status === 'active').length
        }));
      }
    } catch (error) {
      console.error('Error fetching alerts for health:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'text-white bg-white/10';
      case 'degraded':
        return 'text-white/70 bg-white/5';
      case 'down':
      case 'disconnected':
        return 'text-white/50 bg-white/5';
      default:
        return 'text-white/30 bg-white/5';
    }
  };

  const getStatusIndicator = (isHealthy) => {
    return isHealthy
      ? '○'
      : '●';
  };

  const handleExport = () => {
    exportSystemHealthReport(health);
  };

  return (
    <PageLayout 
      title="System Health" 
      subtitle="Monitor system performance and status"
    >
      <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex justify-end items-center"
      >
        <div className="flex space-x-3">
          <LiquidMetalButton
            onClick={handleExport}
            size="sm"
            borderWidth={3}
          >
            Export Report
          </LiquidMetalButton>
          <LiquidMetalButton
            onClick={fetchSystemHealth}
            size="sm"
            borderWidth={3}
          >
            Refresh
          </LiquidMetalButton>
        </div>
      </motion.div>

      {/* Status Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* API Status */}
        <LiquidMetalBorder 
          borderWidth={3}
          borderRadius="rounded-2xl"
          innerClassName="p-6 bg-neutral-950/85"
          className="hover:-translate-y-1 transition-transform"
        >
          <div className="flex items-center justify-between mb-2 relative z-10">
            <h3 className="text-sm font-semibold text-white/50">API Status</h3>
            <span className="text-3xl text-white/70">{getStatusIndicator(health.apiStatus === 'healthy')}</span>
          </div>
          <p className="text-2xl font-bold text-white relative z-10">
            {health.apiStatus.toUpperCase()}
          </p>
          <p className="text-sm text-white/50 mt-1 relative z-10">
            Response: {health.apiResponseTime}ms
          </p>
        </LiquidMetalBorder>

        {/* Database */}
        <LiquidMetalBorder 
          borderWidth={3}
          borderRadius="rounded-2xl"
          innerClassName="p-6 bg-neutral-950/85"
          className="hover:-translate-y-1 transition-transform"
        >
          <div className="flex items-center justify-between mb-2 relative z-10">
            <h3 className="text-sm font-semibold text-white/50">Database</h3>
            <span className="text-3xl text-white/70">{getStatusIndicator(health.databaseConnected)}</span>
          </div>
          <p className="text-2xl font-bold text-white relative z-10">
            {health.databaseConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </p>
        </LiquidMetalBorder>

        {/* Active Streams */}
        <LiquidMetalBorder 
          borderWidth={3}
          borderRadius="rounded-2xl"
          innerClassName="p-6 bg-neutral-950/85"
          className="hover:-translate-y-1 transition-transform"
        >
          <div className="flex items-center justify-between mb-2 relative z-10">
            <h3 className="text-sm font-semibold text-white/50">Video Streams</h3>
          </div>
          <p className="text-3xl font-bold text-white relative z-10">{health.activeStreams}</p>
          <p className="text-sm text-white/50 relative z-10">Active streams</p>
        </LiquidMetalBorder>

        {/* Alerts */}
        <LiquidMetalBorder 
          borderWidth={3}
          borderRadius="rounded-2xl"
          innerClassName="p-6 bg-neutral-950/85"
          className="hover:-translate-y-1 transition-transform"
        >
          <div className="flex items-center justify-between mb-2 relative z-10">
            <h3 className="text-sm font-semibold text-white/50">Alerts</h3>
          </div>
          <p className="text-3xl font-bold text-white relative z-10">{health.activeAlerts}</p>
          <p className="text-sm text-white/50 relative z-10">
            of {health.totalAlerts} total
          </p>
        </LiquidMetalBorder>
      </motion.div>

      {/* Detailed Metrics */}
      <GlassCard className="p-8 relative overflow-hidden mt-6">
        {/* inner glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[90px]" />
        
        <div className="relative z-10">
          <div className="mb-10 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">
                Performance
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
                System Metrics
              </h2>
            </div>
          </div>
        
        <div className="space-y-4">
          {/* API Response Time */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-white/70">API Response Time</span>
              <span className="text-sm font-medium text-white/70">{health.apiResponseTime}ms</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  health.apiResponseTime < 100
                    ? 'bg-white'
                    : health.apiResponseTime < 300
                    ? 'bg-white/60'
                    : 'bg-white/30'
                }`}
                style={{ width: `${Math.min((health.apiResponseTime / 500) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Memory (Simulated) */}
          <div className="mt-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-white/70">Memory Usage</span>
              <span className="text-sm font-medium text-white/70">{metrics.memory}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  metrics.memory < 70 ? 'bg-white' : metrics.memory < 85 ? 'bg-white/60' : 'bg-white/30'
                }`}
                style={{ width: `${metrics.memory}%` }}
              ></div>
            </div>
          </div>

          {/* Uptime */}
          <div className="mt-6">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-white/70">Last Updated</span>
              <span className="text-sm text-white/50">
                {health.lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          </div>
          </div>
        </div>
      </GlassCard>

      </div>
    </PageLayout>
  );
};

export default SystemHealth;
