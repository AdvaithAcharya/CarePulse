import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { PageLayout, GlassCard } from './SharedLayout';
import { LiquidMetalBorder, LiquidMetalButton } from './ui/LiquidMetal';
import { useScreenCapture } from '../contexts/ScreenCaptureContext';

export function ScreenCapture() {
  const {
    capturing,
    startCapture,
    stopCapture,
    fps,
    setFps,
    stats,
    captureMode,
    setCaptureMode,
    monitorName,
    setMonitorName,
    mobileFeedUrl,
    mediaStream,
    videoRef,
    canvasRef
  } = useScreenCapture();

  useEffect(() => {
    if (videoRef?.current && mediaStream && captureMode !== 'mobile') {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    } else if (videoRef?.current) {
      videoRef.current.srcObject = null;
    }
  }, [mediaStream, capturing, captureMode, videoRef]);

  return (
    <PageLayout 
      title="Screen Monitoring" 
      subtitle="Capture and analyze your screen or mobile CCTV in real-time with intelligent hand tracking"
    >

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Control Panel */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-1 space-y-6"
          >
            <GlassCard strong className="p-8 relative overflow-hidden">
              {/* inner glow */}
              <div className="pointer-events-none absolute -top-24 left-1/2 h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[90px]" />
              
              <div className="relative z-10">
                <div className="mb-10">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Configuration</p>
                  <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">
                    Settings
                  </h2>
                </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Monitor Name
                  </label>
                  <input
                    type="text"
                    value={monitorName}
                    onChange={(e) => setMonitorName(e.target.value)}
                    disabled={capturing}
                    className="w-full px-4 py-3 border border-white/20 bg-white/5 text-white rounded-xl focus:ring-2 focus:ring-white/50 focus:border-transparent disabled:opacity-50 transition-all placeholder:text-white/30"
                    placeholder="e.g., ICU Ward Cameras"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-3">
                    Capture Mode
                  </label>
                  <div className="space-y-3">
                    {[
                      { value: 'camera', label: 'Web Camera Direct', desc: 'Local PC webcam stream' },
                      { value: 'mobile', label: 'Mobile Phone Camera', desc: 'Stream live from phone web app' },
                      { value: 'screen', label: 'Entire Screen', desc: 'Desktop monitor capture' }
                    ].map((mode) => {
                      const isSelected = captureMode === mode.value;
                      return (
                        <div key={mode.value} onClick={() => !capturing && setCaptureMode(mode.value)} className="cursor-pointer">
                          {isSelected ? (
                            <LiquidMetalBorder
                              borderWidth={3}
                              borderRadius="rounded-xl"
                              innerClassName="p-3.5 bg-neutral-900/90 flex items-center"
                            >
                              <input
                                type="radio"
                                value={mode.value}
                                checked={true}
                                onChange={() => {}}
                                disabled={capturing}
                                className="mr-3"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-bold text-white">{mode.label}</div>
                                <div className="text-xs text-white/70">{mode.desc}</div>
                              </div>
                            </LiquidMetalBorder>
                          ) : (
                            <div
                              className={`flex items-center p-3.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/[0.02] transition-all ${
                                capturing ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <input
                                type="radio"
                                value={mode.value}
                                checked={false}
                                onChange={() => {}}
                                disabled={capturing}
                                className="mr-3"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-bold text-white/80">{mode.label}</div>
                                <div className="text-xs text-white/50">{mode.desc}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {captureMode === 'mobile' && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs space-y-2">
                    <p className="font-bold flex items-center gap-1.5 text-sm text-emerald-200">
                      📱 Mobile Phone Stream Guide:
                    </p>
                    <p>1. Open this website on your mobile phone browser.</p>
                    <p>2. Go to <strong>Mobile Camera</strong> page and tap <strong>Start Streaming</strong>.</p>
                    <p>3. Tap <strong>Start Ward Monitoring</strong> below to preview the mobile stream with AI hand tracking & 10s Twilio alert!</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Frame Rate: {fps} FPS
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value))}
                    disabled={capturing}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-white/50 mt-1">
                    <span>5 FPS</span>
                    <span className="font-medium text-white/70">Higher = Better detection</span>
                    <span>30 FPS</span>
                  </div>
                </div>

                <div className="pt-2">
                  <LiquidMetalButton
                    onClick={capturing ? stopCapture : startCapture}
                    size="lg"
                    borderWidth={5}
                    className="w-full"
                    innerClassName={capturing ? "bg-red-950/90 text-red-200" : "bg-neutral-950 text-white"}
                    icon={
                      capturing ? (
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                      ) : (
                        <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )
                    }
                  >
                    {capturing ? 'Stop Ward Monitoring' : 'Start Ward Monitoring'}
                  </LiquidMetalButton>
                </div>
              </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Preview Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <GlassCard className="p-8 relative overflow-hidden h-full">
              {/* inner glow */}
              <div className="pointer-events-none absolute -top-24 left-1/2 h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[90px]" />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="mb-10 flex justify-between items-start">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">Feed</p>
                    <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">
                      Live Preview
                    </h2>
                  </div>
                {capturing && (
                  <span className="flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full border border-white/20">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    <span className="text-sm font-semibold text-white">RECORDING</span>
                  </span>
                )}
                </div>

              <LiquidMetalBorder
                borderWidth={capturing ? 5 : 3}
                borderRadius="rounded-[2rem]"
                innerClassName="relative bg-black overflow-hidden flex items-center justify-center"
                style={{ aspectRatio: '16/9' }}
              >
                {captureMode === 'mobile' && capturing && mobileFeedUrl ? (
                  <img
                    src={mobileFeedUrl}
                    className="w-full h-full object-contain"
                    alt="Mobile Phone Camera Stream"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    autoPlay
                    playsInline
                    muted
                  />
                )}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none object-contain"
                />
                {!capturing && (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center text-white">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-lg font-semibold mb-2">No capture active</p>
                        <p className="text-sm text-neutral-500">Click "Start Ward Monitoring" to begin monitoring</p>
                      </motion.div>
                    </div>
                  </div>
                )}
              </LiquidMetalBorder>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Stats Cards */}
        {capturing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"
          >
                <GlassCard className="p-6 border border-white/10">
                  <div className="text-sm font-semibold text-white/70 mb-2 relative z-10">Frames Analyzed</div>
                  <div className="text-3xl font-bold text-white relative z-10">
                    {stats.framesSent}
                  </div>
                </GlassCard>
                <GlassCard className="p-6 border border-white/10">
                  <div className="text-sm font-semibold text-white/70 mb-2 relative z-10">Alerts Detected</div>
                  <div className="text-3xl font-bold text-white relative z-10">
                    {stats.alertsDetected}
                  </div>
              </GlassCard>
            </motion.div>
        )}
    </PageLayout>
  );
}

export default ScreenCapture;
