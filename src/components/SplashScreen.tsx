import React, { useEffect, useState } from 'react';
import { PickleballLogoMark } from './PickleballIcons';

interface SplashScreenProps {
  onComplete: () => void;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setProgress(100);
      const timer = window.setTimeout(onComplete, 3000);
      return () => window.clearTimeout(timer);
    }

    // Exact 3-second splash duration: 2700ms smooth circle fill + 300ms at 100%
    const durationMs = 2700;
    const holdAtFullMs = 300;
    let rafId = 0;
    let doneTimer = 0;
    const startTime = performance.now();

    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      onComplete();
    };

    const safetyTimer = window.setTimeout(finish, durationMs + holdAtFullMs + 300);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const raw = Math.min(1, elapsed / durationMs);
      // Smooth ease-in-out cubic progression from 0% to 100%
      const eased =
        raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      const pct = Math.min(100, Math.round(eased * 100));
      setProgress(pct);

      if (raw < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setProgress(100);
        doneTimer = window.setTimeout(finish, holdAtFullMs);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(doneTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [onComplete]);

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress / 100);

  return (
    <div
      className="min-h-dvh w-full bg-[#831843] bg-[radial-gradient(circle_at_50%_30%,_rgba(244,114,182,0.45),_rgba(131,24,67,1)_68%)] text-white flex flex-col items-center justify-center p-6 sm:p-10 select-none"
      role="status"
      aria-label="Loading Openline Court"
    >
      <div className="flex flex-col items-center gap-7 sm:gap-9 max-w-md w-full text-center">
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 2xl:w-36 2xl:h-36 flex items-center justify-center">
          <svg
            className="w-full h-full -rotate-90"
            viewBox="0 0 108 108"
            shapeRendering="geometricPrecision"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="54"
              cy="54"
              r={RADIUS}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="4.5"
            />
            <circle
              cx="54"
              cy="54"
              r={RADIUS}
              stroke="#F472B6"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <PickleballLogoMark className="w-8 h-8 sm:w-9 sm:h-9 text-white" />
          </div>
        </div>

        <h1 className="font-display text-[clamp(1.65rem,4vw,2.75rem)] font-bold tracking-[0.14em] text-white leading-tight">
          OPENLINE COURT
        </h1>
      </div>
    </div>
  );
};
