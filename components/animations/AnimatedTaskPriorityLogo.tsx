import React, { useEffect, useState } from 'react';

const PRIORITY_RECTANGLE_COUNT = 8;
const BASE_PRIORITY = 3;
const MAX_PRIORITY_OFFSET_PX = 8;
const STEP_MS = 260;
const ENTRY_MS = 320;
const HOLD_MS = 2000;
const COLLAPSE_MS = 360;

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

const createBasePriorities = () => (
  Array.from({ length: PRIORITY_RECTANGLE_COUNT }, () => BASE_PRIORITY)
);

const createRandomPriorities = () => (
  Array.from({ length: PRIORITY_RECTANGLE_COUNT }, () => Math.floor(Math.random() * 5) + 1)
);

const priorityToOffset = (priority: number) => (
  (BASE_PRIORITY - priority) * (MAX_PRIORITY_OFFSET_PX / 2)
);

export const AnimatedTaskPriorityLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [priorities, setPriorities] = useState(createBasePriorities);
  const [targetPriorities, setTargetPriorities] = useState(createRandomPriorities);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isVisible, setIsVisible] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let timer: number;

    if (!isVisible && !isCollapsing) {
      timer = window.setTimeout(() => {
        setTargetPriorities(createRandomPriorities());
        setPriorities(createBasePriorities());
        setIsVisible(true);
        setActiveIndex(0);
      }, ENTRY_MS);

      return () => window.clearTimeout(timer);
    }

    if (activeIndex >= 0 && activeIndex < PRIORITY_RECTANGLE_COUNT) {
      timer = window.setTimeout(() => {
        setPriorities((currentPriorities) => (
          currentPriorities.map((priority, index) => (
            index === activeIndex ? targetPriorities[index] : priority
          ))
        ));
        setActiveIndex((currentIndex) => currentIndex + 1);
      }, STEP_MS);

      return () => window.clearTimeout(timer);
    }

    if (activeIndex === PRIORITY_RECTANGLE_COUNT && !isCollapsing) {
      timer = window.setTimeout(() => {
        setIsCollapsing(true);
        setIsVisible(false);
      }, HOLD_MS);

      return () => window.clearTimeout(timer);
    }

    if (isCollapsing) {
      timer = window.setTimeout(() => {
        setPriorities(createBasePriorities());
        setActiveIndex(-1);
        setIsCollapsing(false);
      }, COLLAPSE_MS);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [activeIndex, isCollapsing, isVisible, prefersReducedMotion, targetPriorities]);

  const renderedPriorities = prefersReducedMotion
    ? [5, 4, 3, 2, 1, 3, 4, 5]
    : priorities;

  return (
    <div className="flex h-16 items-center justify-center gap-2" aria-hidden="true">
      {renderedPriorities.map((priority, index) => {
        const isShown = prefersReducedMotion || isVisible;
        const offset = isShown ? priorityToOffset(priority) : -14;

        return (
          <div
            key={index}
            className={`h-5 w-5 bg-neutral-950 dark:bg-neutral-100 transition-[transform,opacity] duration-300 ease-out ${isShown ? 'opacity-100' : 'opacity-0'}`}
            style={{ transform: `translateY(${offset}px)` }}
          />
        );
      })}
    </div>
  );
};
