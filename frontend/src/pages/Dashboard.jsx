import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLayout, GlassCard } from '../components/SharedLayout';
import { LiquidMetal, LiquidMetalBorder, LiquidMetalButton } from '../components/ui/LiquidMetal';

export default function Dashboard({ alerts = [] }) {
  const navigate = useNavigate();
  const [activityFeed, setActivityFeed] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Convert alerts → cinematic activity feed
  useEffect(() => {
    const recentActivity = alerts.slice(0, 5).map((alert, idx) => ({
      id: idx,
      title: `Alert: ${alert.alert_type || 'Unknown'}`,
      description: alert.message || 'System alert triggered',
      severity: alert.alert_type || 'normal',
      timestamp: alert.created_at || new Date().toISOString(),
    }));

    setActivityFeed(recentActivity);
  }, [alerts]);

  const stats = useMemo(() => {
    const activeCount = alerts.filter((a) => a.status === 'active').length;

    return {
      active: activeCount,
      total: alerts.length,
    };
  }, [alerts]);

  return (
    <div className="relative">
      {/* Top Right Dropdown Menu */}
      <div className="fixed top-8 right-8 z-50">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="relative group cursor-pointer border-none bg-transparent p-0 outline-none transition-transform active:scale-95"
          title="Navigation Menu"
        >
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-full overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
            style={{ padding: '4px' }}
          >
            <LiquidMetal
              colorBack="#707078"
              colorTint="#ffffff"
              speed={0.5}
              repetition={4}
              distortion={0.16}
              className="absolute inset-0 z-0 rounded-full"
            />
            <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-neutral-950/90 text-white group-hover:bg-neutral-900 transition-colors">
              <motion.div
                animate={menuOpen ? "open" : "closed"}
                className="flex flex-col gap-1.5"
              >
                <motion.span
                  variants={{
                    closed: { rotate: 0, y: 0 },
                    open: { rotate: 45, y: 8 }
                  }}
                  className="h-0.5 w-6 bg-white block"
                />
                <motion.span
                  variants={{
                    closed: { opacity: 1 },
                    open: { opacity: 0 }
                  }}
                  className="h-0.5 w-6 bg-white block"
                />
                <motion.span
                  variants={{
                    closed: { rotate: 0, y: 0 },
                    open: { rotate: -45, y: -8 }
                  }}
                  className="h-0.5 w-6 bg-white block"
                />
              </motion.div>
            </div>
          </div>
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-4 w-64 z-50 shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
            >
              <LiquidMetalBorder
                borderWidth={4}
                borderRadius="rounded-3xl"
                innerClassName="p-2 bg-neutral-950/95 backdrop-blur-3xl"
              >
                {[
                  { path: '/alerts', label: 'Alerts' },
                  { path: '/contacts', label: 'Contacts' },
                  { path: '/screen-capture', label: 'Screen Capture' },
                  { path: '/system', label: 'System Health' }
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(item.path);
                    }}
                    className="w-full text-left px-5 py-3.5 rounded-2xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-all font-semibold text-sm flex items-center justify-between group"
                  >
                    <span>{item.label}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </button>
                ))}
              </LiquidMetalBorder>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    <PageLayout 
      title="Dashboard" 
      subtitle="Real-time intelligence monitoring with AI-driven threat detection, system automation, and adaptive security response."
      showBackButton={false}
    >
      {/* GRID */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">

        {/* LEFT PANEL */}
        <div className="lg:col-span-2">
          <GlassCard className="p-8 relative overflow-hidden">

            {/* inner glow */}
            <div className="pointer-events-none absolute -top-24 left-1/2 h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[90px]" />

            <div className="relative z-10">

              <div className="mb-10 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">
                    Live System Feed
                  </p>
                  <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
                    Recent Activity
                  </h2>
                </div>

                <LiquidMetalBorder
                  borderWidth={3}
                  borderRadius="rounded-[2rem]"
                  innerClassName="bg-neutral-950/90 px-6 py-5"
                >
                  <div className="text-xs uppercase tracking-[0.3em] text-white/40">
                    Total
                  </div>
                  <div className="mt-2 text-4xl font-black">{stats.total}</div>
                </LiquidMetalBorder>
              </div>

              <div className="space-y-5">
                {activityFeed.length === 0 ? (
                  <div className="text-white/50">No activity yet.</div>
                ) : (
                  activityFeed.map((a) => (
                    <div
                      key={a.id}
                      className="flex gap-4 rounded-[2rem] border border-white/10 bg-white/[0.02] p-5 hover:border-white/20 transition-colors"
                    >
                      <div
                        className={`mt-2 h-3 w-3 rounded-full ${
                          a.severity === 'critical'
                            ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                            : a.severity === 'warning'
                              ? 'bg-white/60'
                              : 'bg-white/30'
                        }`}
                      />

                      <div>
                        <div className="text-lg font-bold">{a.title}</div>
                        <div className="mt-2 text-sm text-white/50">
                          {a.description}
                        </div>
                        <div className="mt-3 text-xs text-white/35 font-mono">
                          {new Date(a.timestamp).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour12: true,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })} IST
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </GlassCard>
        </div>

        {/* RIGHT PANEL */}
        <div>
          <GlassCard strong className="p-8 sticky top-10">

            <h3 className="text-4xl font-black">Quick Stats</h3>

            <div className="mt-10 space-y-5">
              <div className="flex justify-between border-b border-white/10 pb-4">
                <span className="text-white/45">Active Alerts</span>
                <span className="font-black text-white">{stats.active}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-4">
                <span className="text-white/45">Total Alerts</span>
                <span className="font-black">{stats.total}</span>
              </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="mt-10 space-y-4">
              <LiquidMetalButton
                onClick={() => navigate('/screen-capture')}
                size="md"
                borderWidth={4}
                className="w-full"
                icon={
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }
              >
                Ward Live Monitor
              </LiquidMetalButton>

              <LiquidMetalButton
                onClick={() => navigate('/contacts')}
                size="md"
                borderWidth={4}
                className="w-full"
                icon={
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
              >
                Manage On-Duty Nurses
              </LiquidMetalButton>
            </div>

          </GlassCard>
        </div>

      </section>
    </PageLayout>
    </div>
  );
}