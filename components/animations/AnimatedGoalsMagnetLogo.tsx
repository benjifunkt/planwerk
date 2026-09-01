import React, { useEffect, useState } from 'react';

const GOALS_ARROW_COUNT = 3;
const HOLD_MS = 900;
const SETTLE_MS = 900;
const FOCUS_PROBABILITY = 0.55;
const ARROW_SQUARE_SIZE = 14;
const ARROW_GRID_STEP = 18;
const ARROW_CANVAS_SIZE = 128;
const SOFT_ARROW_BLUR = 'blur(1.8px)';
const ARROW_DIRECTIONS = [-135, -90, -45];

type ArrowState = 'focused' | 'soft';

const createArrowSquare = (id: string, axis: number, lane: number) => ({
  id,
  x: ARROW_CANVAS_SIZE / 2 + axis * ARROW_GRID_STEP - ARROW_SQUARE_SIZE / 2,
  y: ARROW_CANVAS_SIZE / 2 + lane * ARROW_GRID_STEP - ARROW_SQUARE_SIZE / 2,
});

const ARROW_SQUARES = [
  createArrowSquare('tip', 3, 0),
  createArrowSquare('head-top-one', 2, -1),
  createArrowSquare('head-center-one', 2, 0),
  createArrowSquare('head-bottom-one', 2, 1),
  createArrowSquare('head-top-two', 1, -2),
  createArrowSquare('head-top-mid', 1, -1),
  createArrowSquare('head-center-two', 1, 0),
  createArrowSquare('head-bottom-mid', 1, 1),
  createArrowSquare('head-bottom-two', 1, 2),
  createArrowSquare('shaft-two', 0, 0),
  createArrowSquare('shaft-one', -1, 0),
  createArrowSquare('tail-center', -2, 0),
  createArrowSquare('tail-top', -3, -1),
  createArrowSquare('tail-bottom', -3, 1),
];

const pickNextArrowState = (): ArrowState => (
  Math.random() < FOCUS_PROBABILITY ? 'focused' : 'soft'
);

const updateOneRandomArrow = (currentStates: ArrowState[]): ArrowState[] => {
  const nextStates = [...currentStates];
  const selectedIndex = Math.floor(Math.random() * GOALS_ARROW_COUNT);
  nextStates[selectedIndex] = pickNextArrowState();
  return nextStates;
};

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

export const AnimatedGoalsMagnetLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [arrowStates, setArrowStates] = useState<ArrowState[]>(() => ['focused', 'soft', 'focused']);

  useEffect(() => {
    if (prefersReducedMotion) {
      setArrowStates(['focused', 'soft', 'focused']);
      return;
    }

    let timeout: number | undefined;

    const scheduleArrowStates = () => {
      timeout = window.setTimeout(() => {
        setArrowStates(currentStates => updateOneRandomArrow(currentStates));
        scheduleArrowStates();
      }, HOLD_MS);
    };

    scheduleArrowStates();

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [prefersReducedMotion]);

  return (
    <div className="relative flex h-40 w-[32rem] items-center justify-center gap-6" aria-hidden="true">
      {arrowStates.map((state, index) => {
        const isSoft = state === 'soft';

        return (
          <div
            key={index}
            className="relative"
            style={{
              width: `${ARROW_CANVAS_SIZE}px`,
              height: `${ARROW_CANVAS_SIZE}px`,
              opacity: isSoft ? 0.48 : 1,
              filter: isSoft ? SOFT_ARROW_BLUR : 'blur(0px)',
              transform: `rotate(${ARROW_DIRECTIONS[index]}deg) ${isSoft ? 'scale(0.96)' : 'scale(1)'}`,
              transition: prefersReducedMotion
                ? 'none'
                : `background-color ${SETTLE_MS}ms cubic-bezier(0.2, 0.85, 0.2, 1), opacity ${SETTLE_MS}ms cubic-bezier(0.2, 0.85, 0.2, 1), filter ${SETTLE_MS}ms cubic-bezier(0.2, 0.85, 0.2, 1), transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.85, 0.2, 1)`,
            }}
          >
            {ARROW_SQUARES.map(square => (
              <div
                key={square.id}
                className={`absolute ${isSoft ? 'bg-neutral-300 dark:bg-neutral-700' : 'bg-neutral-950 dark:bg-neutral-100'}`}
                style={{
                  left: `${square.x}px`,
                  top: `${square.y}px`,
                  width: `${ARROW_SQUARE_SIZE}px`,
                  height: `${ARROW_SQUARE_SIZE}px`,
                  transition: prefersReducedMotion
                    ? 'none'
                    : `background-color ${SETTLE_MS}ms cubic-bezier(0.2, 0.85, 0.2, 1)`,
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};
