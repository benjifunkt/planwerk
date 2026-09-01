import React, { useEffect, useState } from 'react';

const FOCUS_SEGMENT_COUNT = 5;
const MIN_SWITCH_MS = 1000;
const MAX_SWITCH_MS = 2000;

const getNextDelay = () => (
  MIN_SWITCH_MS + Math.random() * (MAX_SWITCH_MS - MIN_SWITCH_MS)
);

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

export const AnimatedTaskTitleFocusLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeSegment, setActiveSegment] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const timeout = window.setTimeout(() => {
      setActiveSegment(current => (current + 1) % FOCUS_SEGMENT_COUNT);
    }, getNextDelay());

    return () => window.clearTimeout(timeout);
  }, [activeSegment, prefersReducedMotion]);

  const renderedActiveSegment = prefersReducedMotion ? 0 : activeSegment;

  return (
    <div className="flex h-16 w-56 flex-col items-center justify-center gap-2" aria-hidden="true">
      <div
        className={`h-5 w-44 transition-colors duration-300 ${renderedActiveSegment === 0 ? 'bg-neutral-950 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-700'}`}
      />
      <div className="grid w-44 grid-cols-4 gap-2">
        {Array.from({ length: FOCUS_SEGMENT_COUNT - 1 }, (_, index) => (
          <div
            key={index}
            className={`h-4 transition-colors duration-300 ${renderedActiveSegment === index + 1 ? 'bg-neutral-950 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-700'}`}
          />
        ))}
      </div>
    </div>
  );
};
