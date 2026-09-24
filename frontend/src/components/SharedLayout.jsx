import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LiquidMetal, LiquidMetalBorder } from './ui/LiquidMetal';

export function GlassCard({ 
  children, 
  strong = false, 
  className = '', 
  innerClassName = '',
  borderWidth = 5, // Slightly thicker than normal (5px) as requested
  borderRadius = 'rounded-[2.5rem]',
  metalConfig
}) {
  const innerBg = strong 
    ? 'bg-neutral-950/90 backdrop-blur-3xl' 
    : 'bg-neutral-950/85 backdrop-blur-2xl';

  return (
    <LiquidMetalBorder
      borderWidth={borderWidth}
      borderRadius={borderRadius}
      className={className}
      innerClassName={`relative p-6 sm:p-8 ${innerBg} ${innerClassName}`}
      metalConfig={metalConfig}
    >
      {children}
    </LiquidMetalBorder>
  );
}

export function PageLayout({ title, subtitle, showBackButton = true, children }) {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">

      {showBackButton && (
        <button
          onClick={() => navigate(-1)}
          className="fixed top-8 left-8 z-50 group cursor-pointer border-none bg-transparent p-0 outline-none transition-transform active:scale-95"
          title="Go Back"
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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </div>
          </div>
        </button>
      )}

      {/* Background */}
      <div className="fixed inset-0 bg-black" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-screen [background-image:url('https://grainy-gradients.vercel.app/noise.svg')]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.92))]" />

      {/* Glow Orbs - with floating animation and positioned at top right */}
      <div 
        className="pointer-events-none fixed right-[-10%] top-[-10%] h-[600px] w-[600px] rounded-full bg-white/[0.08] blur-[150px]" 
        style={{ animation: 'floatOrb 8s ease-in-out infinite' }}
      />
      <div 
        className="pointer-events-none fixed left-[-5%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-white/[0.05] blur-[150px]" 
        style={{ animation: 'floatOrb 10s ease-in-out infinite reverse' }}
      />
      <div 
        className="pointer-events-none fixed left-[20%] top-[40%] h-[300px] w-[300px] rounded-full bg-white/[0.03] blur-[120px]" 
        style={{ animation: 'floatOrb 12s ease-in-out infinite 2s' }}
      />

      <style>{`
        @keyframes floatOrb {
          0% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-30px) translateX(20px); }
          100% { transform: translateY(0px) translateX(0px); }
        }
      `}</style>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-44">

        {/* HERO */}
        {title && (
          <section className="mb-24">
            <LiquidMetalBorder
              borderWidth={3}
              borderRadius="rounded-full"
              className="mb-8 inline-block"
              innerClassName="inline-flex items-center gap-3 bg-neutral-950/80 px-6 py-2.5 backdrop-blur-2xl"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              <span className="text-sm uppercase tracking-[0.28em] text-white/80 font-medium">
                Care Pulse System
              </span>
            </LiquidMetalBorder>

            <h1 className="text-[14vw] font-black leading-[0.82] tracking-[-0.09em] text-white sm:text-[10vw] lg:text-[7vw]">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/50 md:text-2xl">
                {subtitle}
              </p>
            )}
          </section>
        )}

        {/* CONTENT */}
        {children}
      </div>
    </div>
  );
}
