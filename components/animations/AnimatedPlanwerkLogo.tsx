import React, { useEffect, useState } from 'react';

const BAR_COUNT = 5;
const STEP_MS = 240;
const GRAY_START_DELAY_MS = 1000;
const GRAY_STEP_DELAY_MS = 1500;
const CYCLE_PAUSE_MS = 900;

interface LogoBar {
  targetHeightPercent: number;
  blackHeightPercent: number;
  grayFillPercent: number;
}

const createEmptyBars = (): LogoBar[] => (
  Array.from({ length: BAR_COUNT }, () => ({
    targetHeightPercent: Math.round(60 + Math.random() * 40),
    blackHeightPercent: 0,
    grayFillPercent: 0,
  }))
);

const createReducedMotionBars = (): LogoBar[] => (
  [100, 76, 88, 100, 88].map((height, index) => ({
    targetHeightPercent: height,
    blackHeightPercent: height,
    grayFillPercent: index === 0 ? 100 : 0,
  }))
);

const nextFillPercent = (current: number) => (
  Math.min(100, current + Math.round(18 + Math.random() * 48))
);

export const AnimatedPlanwerkLogo: React.FC = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [bars, setBars] = useState<LogoBar[]>(() => createEmptyBars());

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setBars(createReducedMotionBars());
      return;
    }

    let timeoutId: number | null = null;
    let activeBars = createEmptyBars();
    let blackIndex = 0;
    let grayIndex = 0;

    setBars(activeBars);

    const updateBars = (nextBars: LogoBar[], delay = STEP_MS) => {
      activeBars = nextBars;
      setBars(nextBars);
      timeoutId = window.setTimeout(step, delay);
    };

    const step = () => {
      if (blackIndex < BAR_COUNT) {
        const nextBars = activeBars.map((bar, index) => (
          index === blackIndex
            ? { ...bar, blackHeightPercent: bar.targetHeightPercent }
            : bar
        ));
        blackIndex += 1;
        updateBars(nextBars, blackIndex >= BAR_COUNT ? GRAY_START_DELAY_MS : STEP_MS);
        return;
      }

      if (grayIndex < BAR_COUNT) {
        const currentFill = activeBars[grayIndex].grayFillPercent;
        const nextFill = nextFillPercent(currentFill);
        const nextBars = activeBars.map((bar, index) => (
          index === grayIndex
            ? { ...bar, grayFillPercent: nextFill }
            : bar
        ));

        if (nextFill >= 100) {
          grayIndex += 1;
        }

        updateBars(nextBars, GRAY_STEP_DELAY_MS);
        return;
      }

      activeBars = createEmptyBars();
      blackIndex = 0;
      grayIndex = 0;
      updateBars(activeBars, CYCLE_PAUSE_MS);
    };

    timeoutId = window.setTimeout(step, STEP_MS);

    return () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className="flex h-40 w-60 items-start justify-center gap-1"
      aria-hidden="true"
    >
      {bars.map((bar, index) => (
        <div
          key={index}
          className="relative w-4 overflow-hidden bg-transparent transition-[height] duration-300 ease-out"
          style={{ height: `${bar.blackHeightPercent}%` }}
        >
          <div className="absolute inset-0 bg-black dark:bg-white" />
          <div
            className="absolute left-0 top-0 w-full bg-neutral-400 transition-[height] duration-300 ease-out dark:bg-neutral-500"
            style={{ height: `${bar.grayFillPercent}%` }}
          />
        </div>
      ))}
    </div>
  );
};
