import React, { useEffect, useState } from 'react';

const CHOICE_COUNT = 3;
const ACTIVE_MS = 300;
const PAUSE_MS = 1000;
const TRANSITION_MS = 200;

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    mediaQuery.addEventListener?.('change', updatePreference);
    return () => mediaQuery.removeEventListener?.('change', updatePreference);
  }, []);

  return prefersReducedMotion;
};

export const AnimatedReflectionChoiceLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeChoice, setActiveChoice] = useState<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setActiveChoice(1);
      return;
    }

    let pauseTimeout: number | undefined;
    let activeTimeout: number | undefined;

    const schedulePulse = () => {
      pauseTimeout = window.setTimeout(() => {
        setActiveChoice(Math.floor(Math.random() * CHOICE_COUNT));
        activeTimeout = window.setTimeout(() => {
          setActiveChoice(null);
          schedulePulse();
        }, ACTIVE_MS);
      }, PAUSE_MS);
    };

    schedulePulse();

    return () => {
      window.clearTimeout(pauseTimeout);
      window.clearTimeout(activeTimeout);
    };
  }, [prefersReducedMotion]);

  return (
    <div className="flex h-20 w-64 items-center justify-center gap-3" aria-hidden="true">
      {Array.from({ length: CHOICE_COUNT }, (_, index) => {
        const isActive = activeChoice === index;
        return (
          <div
            key={index}
            className={`h-12 w-16 border transition-[transform,background-color,border-color] ease-out ${
              isActive
                ? 'scale-95 border-neutral-950 bg-neutral-950 dark:bg-neutral-100 dark:border-neutral-100'
                : 'scale-100 border-neutral-300 bg-neutral-300 dark:bg-neutral-700 dark:border-neutral-700'
            }`}
            style={{
              transitionDuration: prefersReducedMotion ? '0ms' : `${TRANSITION_MS}ms`,
            }}
          />
        );
      })}
    </div>
  );
};
