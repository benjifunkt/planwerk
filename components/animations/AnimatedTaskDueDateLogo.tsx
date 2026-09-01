import React, { useEffect, useState } from 'react';

const TIMELINE_GROW_MS = 3000;
const MIN_MARKER_PERCENT = 18;
const MAX_MARKER_PERCENT = 82;
const RESET_HOLD_MS = 900;
const RESET_MS = 260;
const FADE_OUT_MS = 300;

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

const createMarkerPercent = () => (
  MIN_MARKER_PERCENT + Math.random() * (MAX_MARKER_PERCENT - MIN_MARKER_PERCENT)
);

const calculateMarkerDelayMs = (markerPercent: number) => (
  markerPercent / 100 * TIMELINE_GROW_MS
);

export const AnimatedTaskDueDateLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [markerPercent, setMarkerPercent] = useState(createMarkerPercent);
  const [isGrowing, setIsGrowing] = useState(false);
  const [markerVisible, setMarkerVisible] = useState(false);
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const nextMarkerPercent = createMarkerPercent();
    setIsGrowing(false);
    setMarkerVisible(false);
    setTimelineVisible(false);
    setMarkerPercent(nextMarkerPercent);

    const growTimer = window.setTimeout(() => {
      setTimelineVisible(true);
      setIsGrowing(true);
    }, RESET_MS);

    const markerDelayMs = calculateMarkerDelayMs(nextMarkerPercent);
    const markerTimer = window.setTimeout(() => {
      setMarkerVisible(true);
    }, RESET_MS + markerDelayMs);

    const resetTimer = window.setTimeout(() => {
      setTimelineVisible(false);
      setMarkerVisible(false);
    }, RESET_MS + TIMELINE_GROW_MS + RESET_HOLD_MS);

    const cycleTimer = window.setTimeout(() => {
      setIsGrowing(false);
      setCycle((currentCycle) => currentCycle + 1);
    }, RESET_MS + TIMELINE_GROW_MS + RESET_HOLD_MS + FADE_OUT_MS);

    return () => {
      window.clearTimeout(growTimer);
      window.clearTimeout(markerTimer);
      window.clearTimeout(resetTimer);
      window.clearTimeout(cycleTimer);
    };
  }, [cycle, prefersReducedMotion]);

  const renderedMarkerPercent = prefersReducedMotion ? 64 : markerPercent;
  const renderedIsGrowing = prefersReducedMotion || isGrowing;
  const renderedMarkerVisible = prefersReducedMotion || markerVisible;
  const renderedTimelineVisible = prefersReducedMotion || timelineVisible;

  return (
    <div className="flex h-16 w-60 items-center justify-center" aria-hidden="true">
      <div className={`relative h-8 w-52 transition-opacity duration-300 ease-out ${renderedTimelineVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute left-0 top-1/2 h-5 w-full -translate-y-1/2 overflow-hidden">
          <div
            className="h-full w-full bg-neutral-300 dark:bg-neutral-700"
            style={{
              transform: `scaleX(${renderedIsGrowing ? 1 : 0})`,
              transformOrigin: 'left center',
              transition: renderedTimelineVisible ? `transform ${TIMELINE_GROW_MS}ms linear` : 'none',
            }}
          />
        </div>

        <div
          className={`absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 bg-neutral-950 dark:bg-neutral-100 transition-[opacity,transform] duration-200 ease-out ${renderedMarkerVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
          style={{ left: `${renderedMarkerPercent}%` }}
        />
      </div>
    </div>
  );
};
