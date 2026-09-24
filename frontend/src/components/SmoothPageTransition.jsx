import { useState } from 'react';

/**
 * Fullscreen transition overlay.
 * Usage:
 *   const [wrap, trigger] = useSmoothPageTransition();
 *   <div>{wrap(appContent)}</div>
 *   trigger(() => navigate('/dashboard'))
 */
export function useSmoothPageTransition({ durationMs = 700 } = {}) {
  const [isAnimating, setIsAnimating] = useState(false);

  const trigger = async (onDone) => {
    // start overlay
    setIsAnimating(true);

    // allow the overlay to paint
    await new Promise((r) => setTimeout(r, 20));

    // do navigation / state change
    if (typeof onDone === 'function') onDone();

    // keep overlay for duration
    await new Promise((r) => setTimeout(r, durationMs));

    setIsAnimating(false);
  };

  // Overlay element
  const overlay = (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100000] pointer-events-none transition-opacity duration-200 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.25),transparent_55%)]"
        style={{
          transform: isAnimating ? 'scale(1.1)' : 'scale(0.95)',
          transition: `transform ${durationMs}ms ease-in-out`,
        }}
      />
      <div className="absolute left-1/2 top-1/2 w-[120px] h-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-xl" />
    </div>
  );

  // Wrap helper: place overlay at root
  const wrap = (node) => node;

  return [overlay, trigger, wrap];
}

