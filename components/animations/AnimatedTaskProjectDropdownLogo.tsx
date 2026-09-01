import React, { useEffect, useState } from 'react';

const OPTION_COUNT = 3;
const TAP_STEP_MS = 300;
const OPEN_MS = 360;
const OPEN_HOLD_MS = 2000;
const CLOSED_HOLD_MS = 2000;
const OPTION_GAP_PX = 28;
const CLOSED_TOP_OFFSET_PX = 38;
const OPEN_TOP_OFFSET_PX = 0;
const HANDOFF_OVERLAP_MS = 420;

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

const createSelectedOptionIndex = () => (
  Math.floor(Math.random() * OPTION_COUNT)
);

export const AnimatedTaskProjectDropdownLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(createSelectedOptionIndex);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [handoffActive, setHandoffActive] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const nextSelectedOptionIndex = createSelectedOptionIndex();
    setOptionsVisible(false);
    setActiveOptionIndex(-1);
    setHandoffActive(false);
    setSelectedOptionIndex(nextSelectedOptionIndex);

    const timers: number[] = [];

    timers.push(window.setTimeout(() => {
      setOptionsVisible(true);
    }, CLOSED_HOLD_MS));

    Array.from({ length: nextSelectedOptionIndex + 1 }, (_, index) => {
      timers.push(window.setTimeout(() => {
        setActiveOptionIndex(index);
      }, CLOSED_HOLD_MS + OPEN_MS + index * TAP_STEP_MS));
    });

    const closeDelay = CLOSED_HOLD_MS + OPEN_MS + (nextSelectedOptionIndex + 1) * TAP_STEP_MS + OPEN_HOLD_MS;
    timers.push(window.setTimeout(() => {
      setOptionsVisible(false);
    }, closeDelay));

    timers.push(window.setTimeout(() => {
      setHandoffActive(true);
    }, closeDelay + OPEN_MS));

    timers.push(window.setTimeout(() => {
      setActiveOptionIndex(-1);
      setHandoffActive(false);
      setCycle((currentCycle) => currentCycle + 1);
    }, closeDelay + OPEN_MS + HANDOFF_OVERLAP_MS));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [cycle, prefersReducedMotion]);

  const renderedOptionsVisible = prefersReducedMotion || optionsVisible;
  const renderedActiveOptionIndex = prefersReducedMotion ? 1 : activeOptionIndex;
  const rootOffsetPx = renderedOptionsVisible ? OPEN_TOP_OFFSET_PX : CLOSED_TOP_OFFSET_PX;
  const isRootActive = renderedActiveOptionIndex < 0 || handoffActive;
  const closingOptionIndex = !renderedOptionsVisible && renderedActiveOptionIndex >= 0 ? renderedActiveOptionIndex : null;

  return (
    <div className="flex h-24 w-60 items-center justify-center" aria-hidden="true">
      <div className="relative h-20 w-48">
        <div
          className={`absolute left-0 top-0 z-10 h-5 w-full transition-transform duration-300 ease-out ${isRootActive ? 'bg-neutral-950 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-700'}`}
          style={{ transform: `translateY(${rootOffsetPx}px)` }}
        />

        {Array.from({ length: OPTION_COUNT }, (_, index) => {
          const optionOffsetPx = renderedOptionsVisible ? (index + 1) * OPTION_GAP_PX : CLOSED_TOP_OFFSET_PX;
          const isActive = renderedActiveOptionIndex === index;
          const isClosingSelectedOption = closingOptionIndex === index;

          return (
            <div
              key={index}
              className={`absolute left-0 top-0 h-5 w-full transition-[transform,opacity,background-color] duration-300 ease-out ${isClosingSelectedOption ? 'z-20 opacity-100' : renderedOptionsVisible ? 'z-0 opacity-100' : 'z-0 opacity-0'} ${isActive ? 'bg-neutral-950 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-700'}`}
              style={{ transform: `translateY(${optionOffsetPx}px)` }}
            />
          );
        })}
      </div>
    </div>
  );
};
