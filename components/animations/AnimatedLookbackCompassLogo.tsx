import React, { useEffect, useMemo, useState } from 'react';

const COMPASS_WIDTH = 512;
const COMPASS_HEIGHT = 160;
const COMPASS_CENTER_X = COMPASS_WIDTH / 2;
const COMPASS_CENTER_Y = COMPASS_HEIGHT / 2;
const COMPASS_DOT_SIZE = 20;
const COMPASS_GRID_STEP = 26;
const HOLD_MS = 900;
const SETTLE_MS = 900;
const DIRECTION_SEQUENCE = [-35, 28, -12, 0];

const createCompassDot = (id: string, axis: number, lane: number) => {
  const axisOffset = axis * COMPASS_GRID_STEP;
  const laneOffset = lane * COMPASS_GRID_STEP;

  return {
    id,
    radius: Math.hypot(axisOffset, laneOffset),
    angleOffset: Math.atan2(laneOffset, axisOffset) * 180 / Math.PI,
  };
};

const COMPASS_DOT_POLARS = [
  createCompassDot('tip', 5, 0),
  createCompassDot('head-top-one', 4, -1),
  createCompassDot('head-center-one', 4, 0),
  createCompassDot('head-bottom-one', 4, 1),
  createCompassDot('head-top-two', 3, -2),
  createCompassDot('head-top-mid', 3, -1),
  createCompassDot('head-center-two', 3, 0),
  createCompassDot('head-bottom-mid', 3, 1),
  createCompassDot('head-bottom-two', 3, 2),
  createCompassDot('shaft-three', 2, 0),
  createCompassDot('shaft-two', 1, 0),
  createCompassDot('center', 0, 0),
  createCompassDot('tail-one', -1, 0),
  createCompassDot('tail-two', -2, 0),
  createCompassDot('tail-top', -3, -1),
  createCompassDot('tail-center', -3, 0),
  createCompassDot('tail-bottom', -3, 1),
];

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

interface AnimatedLookbackCompassLogoProps {
  compact?: boolean;
  stopAfterMs?: number;
}

export const AnimatedLookbackCompassLogo: React.FC<AnimatedLookbackCompassLogoProps> = ({ compact = false, stopAfterMs }) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDirection(0);
      return;
    }

    let directionIndex = 0;
    const startedAt = Date.now();
    let timeout: number | undefined;

    const scheduleDirection = () => {
      timeout = window.setTimeout(() => {
        const elapsedMs = Date.now() - startedAt;
        if (stopAfterMs !== undefined && elapsedMs >= stopAfterMs) {
          setDirection(0);
          return;
        }

        const nextIndex = directionIndex % DIRECTION_SEQUENCE.length;
        setDirection(DIRECTION_SEQUENCE[nextIndex]);
        directionIndex += 1;
        scheduleDirection();
      }, HOLD_MS);
    };

    scheduleDirection();

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [prefersReducedMotion, stopAfterMs]);

  const dotPositions = useMemo(() => (
    COMPASS_DOT_POLARS.map(dot => {
      const angleRadians = (direction + dot.angleOffset) * Math.PI / 180;
      const x = COMPASS_CENTER_X + Math.cos(angleRadians) * dot.radius - COMPASS_DOT_SIZE / 2;
      const y = COMPASS_CENTER_Y + Math.sin(angleRadians) * dot.radius - COMPASS_DOT_SIZE / 2;
      return { ...dot, x, y };
    })
  ), [direction]);

  const compass = (
    <div className="relative h-40 w-[32rem]" aria-hidden="true">
      {dotPositions.map(dot => (
        <div
          key={dot.id}
          className="absolute bg-neutral-950 dark:bg-neutral-100"
          style={{
            width: `${COMPASS_DOT_SIZE}px`,
            height: `${COMPASS_DOT_SIZE}px`,
            transform: `translate(${dot.x}px, ${dot.y}px)`,
            transition: prefersReducedMotion
              ? 'none'
              : `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.85, 0.2, 1)`,
          }}
        />
      ))}
    </div>
  );

  if (!compact) return compass;

  return (
    <div className="flex h-28 w-64 items-center justify-center overflow-hidden" aria-hidden="true">
      <div className="origin-center scale-50">
        {compass}
      </div>
    </div>
  );
};
