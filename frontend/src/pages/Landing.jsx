import { motion, useScroll, useTransform } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { LiquidMetalBorder, LiquidMetalButton } from '../components/ui/LiquidMetal'

export default function Landing() {
  const navigate = useNavigate()
  const { scrollYProgress } = useScroll()

  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0])

  const onEnterExperience = async () => {
    try {
      sessionStorage.setItem('visitedLanding', '1')
    } catch {
      // ignore
    }

    // Smooth transition overlay + navigate to dashboard
    try {
      const mod = await import('../components/SmoothPageTransition');
      const { useSmoothPageTransition } = mod;
      if (typeof useSmoothPageTransition === 'function') {
      }
    } catch {
      // ignore
    }

    await new Promise((r) => setTimeout(r, 120));
    navigate('/dashboard');
  }


  return (
    <div className="relative w-full overflow-x-hidden bg-black text-white">
      {/* HERO */}
      <motion.section
        style={{ opacity: heroOpacity }}
        className="relative flex h-screen w-full items-center justify-center overflow-hidden"
      >
        {/* Noise + vignette */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen [background-image:url('https://grainy-gradients.vercel.app/noise.svg')]" />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.8))]" />

        {/* Main Content */}
        <div className="relative z-20 flex flex-col items-center justify-center">
          <LiquidMetalBorder
            borderWidth={3}
            borderRadius="rounded-full"
            className="mb-10 inline-block animate-slideUp"
            innerClassName="bg-black/60 px-8 py-2 backdrop-blur-md"
          >
            <p className="text-xl sm:text-2xl font-semibold tracking-wider uppercase liquid-metal-text">AI Safety Intelligence</p>
          </LiquidMetalBorder>

          <h1 className="relative z-20 text-[12vw] font-black leading-none tracking-[-0.08em] liquid-metal-text animate-fadeIn pb-2">
            CarePulse
          </h1>

          <div className="mt-20 animate-fadeInSlow text-center px-4">
            <p className="text-2xl sm:text-3xl font-light tracking-tight text-white/70">— Intelligent Hospital Ward Distress Detection & Patient Care</p>
          </div>
        </div>
      </motion.section>

      {/* SECOND SECTION */}
      <section className="relative flex min-h-screen items-center justify-center px-10 py-40">
        <div className="grid max-w-7xl grid-cols-1 gap-20 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="mb-6 text-sm uppercase tracking-[0.4em] font-bold liquid-metal-text">Threat Intelligence</p>
            <h2 className="max-w-2xl text-6xl font-black leading-[0.95] tracking-[-0.06em] md:text-8xl liquid-metal-text">
              Designed to protect.
            </h2>
          </div>

          <div className="flex items-end">
            <p className="max-w-xl text-xl leading-relaxed text-white/60 md:text-2xl">
              CarePulse continuously monitors hospital wards in real-time, detects patient distress gestures
              when hands are raised for more than 10 seconds, and delivers instant alerts to on-duty nurses.
            </p>
          </div>
        </div>

        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)]" />
      </section>

      {/* THIRD SECTION */}
      <section className="relative flex min-h-screen flex-col justify-center border-t border-white/10 px-10 py-32">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 lg:grid-cols-3">
          {['Real-Time Distress Detection', 'Privacy-First Face Anonymization', 'Intelligent Nurse Alert System'].map((item) => (
            <LiquidMetalBorder
              key={item}
              borderWidth={5}
              borderRadius="rounded-[2.5rem]"
              className="transition duration-700 hover:-translate-y-2"
              innerClassName="p-10 bg-neutral-950/85 backdrop-blur-2xl"
            >
              <div className="mb-12 h-[220px] rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/15 to-transparent relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_70%)]" />
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                  <span className="text-2xl">⚡</span>
                </div>
              </div>
              <h3 className="mb-4 text-3xl font-bold tracking-tight liquid-metal-text">{item}</h3>
              <p className="text-lg leading-relaxed text-white/55">
                Advanced AI systems engineered to identify risks, enhance digital safety,
                and create secure human-centered hospital ward environments.
              </p>
            </LiquidMetalBorder>
          ))}

        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_55%)]" />

        <div className="relative z-10 text-center">
          <p className="mb-6 text-sm uppercase tracking-[0.4em] font-bold liquid-metal-text">CarePulse Protocol</p>
          <h2 className="mb-10 text-7xl font-black tracking-[-0.08em] md:text-[10vw] liquid-metal-text">Secure The Future</h2>

          <LiquidMetalButton
            onClick={onEnterExperience}
            borderWidth={5}
            size="lg"
            className="text-lg font-bold"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            }
          >
            Enter Experience
          </LiquidMetalButton>
        </div>
      </section>

      <style jsx>{`
        @keyframes fadeDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeInSlow {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeDown {
          animation: fadeDown 0.8s cubic-bezier(0.22,1,0.36,1);
        }

        .animate-slideUp {
          animation: slideUp 1s cubic-bezier(0.22,1,0.36,1);
        }

        .animate-fadeIn {
          animation: fadeIn 1.2s cubic-bezier(0.22,1,0.36,1);
        }

        .animate-fadeInSlow {
          animation: fadeInSlow 1.8s ease;
        }
      `}</style>
    </div>
  )
}