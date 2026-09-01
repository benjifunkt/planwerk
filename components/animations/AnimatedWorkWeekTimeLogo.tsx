import React, { useEffect, useState } from 'react';

const RECTANGLE_COUNT = 8;
const BLACK_RECTANGLE_COUNT = 4;
const BLACK_FILL_START_STEP = 6;
const STEP_MS = 240;
const HOLD_MS = 3000;
const BUILD_STEPS = BLACK_FILL_START_STEP + BLACK_RECTANGLE_COUNT;

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

export const AnimatedWorkWeekTimeLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [isCollapsing, setIsCollapsing] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) return;

    if (isCollapsing) {
      const timeout = window.setTimeout(() => {
        setStep(0);
        setIsCollapsing(false);
      }, STEP_MS);
      return () => window.clearTimeout(timeout);
    }

    if (step >= BUILD_STEPS) {
      const timeout = window.setTimeout(() => setIsCollapsing(true), HOLD_MS);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => setStep(current => current + 1), STEP_MS);
    return () => window.clearTimeout(timeout);
  }, [isCollapsing, prefersReducedMotion, step]);

  const renderStep = prefersReducedMotion ? BUILD_STEPS : step;

  return (
    <div className="flex h-16 items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: RECTANGLE_COUNT }, (_, index) => {
        const grayFillPercent = isCollapsing ? 0 : renderStep > index ? 100 : 0;
        const blackFillPercent = isCollapsing
          ? 0
          : index < BLACK_RECTANGLE_COUNT && renderStep > BLACK_FILL_START_STEP + index ? 100 : 0;

        return (
          <div key={index} className="relative h-5 w-5 overflow-hidden">
            <div
              className="absolute left-0 top-0 w-full bg-neutral-300 transition-[height] duration-200 ease-out dark:bg-neutral-700"
              style={{ height: `${grayFillPercent}%` }}
            />
            <div
              className="absolute left-0 top-0 w-full bg-neutral-950 transition-[height] duration-200 ease-out dark:bg-neutral-100"
              style={{ height: `${blackFillPercent}%` }}
            />
          </div>
        );
      })}
    </div>
  );
};
