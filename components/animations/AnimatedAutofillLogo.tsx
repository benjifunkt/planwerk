import React, { useEffect, useState } from 'react';

const LINE_COUNT = 5;
const LINE_WIDTH = 8;
const CARD_WIDTH = 22;
const LINE_X_POSITIONS = [48, 90, 132, 174, 216];
const LINE_CENTER_POSITIONS = LINE_X_POSITIONS.map(lineX => lineX + LINE_WIDTH / 2);
const BETWEEN_LINE_SLOT_X_POSITIONS = LINE_CENTER_POSITIONS.slice(0, -1).map((lineCenterX, index) => (
  (lineCenterX + LINE_CENTER_POSITIONS[index + 1]) / 2
));
const SLOT_SPACING = BETWEEN_LINE_SLOT_X_POSITIONS[0] - LINE_CENTER_POSITIONS[0];
const START_SLOT_X_POSITION = LINE_CENTER_POSITIONS[0] - SLOT_SPACING;
const END_SLOT_X_POSITION = LINE_CENTER_POSITIONS[LINE_CENTER_POSITIONS.length - 1] + SLOT_SPACING;
const SLOT_X_POSITIONS = [START_SLOT_X_POSITION, ...BETWEEN_LINE_SLOT_X_POSITIONS, END_SLOT_X_POSITION];
const MOVE_MS = 1500;
const HOLD_MS = 2000;
const START_DELAY_MS = 1000;
const START_FADE_MS = 500;
const RESET_FADE_MS = 500;
const LOOP_MS = START_DELAY_MS + START_FADE_MS + MOVE_MS + HOLD_MS + RESET_FADE_MS;
const FADE_IN_START_PERCENT = START_DELAY_MS / LOOP_MS * 100;
const MOVE_START_PERCENT = (START_DELAY_MS + START_FADE_MS) / LOOP_MS * 100;
const MOVE_END_PERCENT = (START_DELAY_MS + START_FADE_MS + MOVE_MS) / LOOP_MS * 100;
const HOLD_END_PERCENT = (START_DELAY_MS + START_FADE_MS + MOVE_MS + HOLD_MS) / LOOP_MS * 100;

const staticTasks = [
  { slotIndex: 1, top: 16, height: 24 },
  { slotIndex: 2, top: 16, height: 20 },
  { slotIndex: 3, top: 16, height: 28 },
];

const movingTasks = [
  { id: 'first', startSlotIndex: 0, targetSlotIndex: 1, startTop: 16, targetTop: 44, height: 18 },
  { id: 'second', startSlotIndex: 0, targetSlotIndex: 2, startTop: 42, targetTop: 40, height: 22 },
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

const getCardTransform = (slotIndex: number, top: number) => (
  `translate(${SLOT_X_POSITIONS[slotIndex] - CARD_WIDTH / 2}px, ${top}px)`
);

export const AnimatedAutofillLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative h-20 w-64" aria-hidden="true">
      <style>{`
        @keyframes autofill-loop-fade {
          0%, ${FADE_IN_START_PERCENT}% { opacity: 0; }
          ${MOVE_START_PERCENT}%, ${HOLD_END_PERCENT}% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes autofill-card-first {
          0%, ${MOVE_START_PERCENT}% { transform: ${getCardTransform(0, 16)}; animation-timing-function: ease-in-out; }
          ${MOVE_END_PERCENT}% { transform: ${getCardTransform(1, 44)}; }
          100% { transform: ${getCardTransform(1, 44)}; }
        }

        @keyframes autofill-card-second {
          0%, ${MOVE_START_PERCENT}% { transform: ${getCardTransform(0, 42)}; animation-timing-function: ease-in-out; }
          ${MOVE_END_PERCENT}% { transform: ${getCardTransform(2, 40)}; }
          100% { transform: ${getCardTransform(2, 40)}; }
        }

        .autofill-logo-loop {
          animation: autofill-loop-fade ${LOOP_MS}ms ease-in-out infinite;
        }

        .autofill-card-first {
          animation: autofill-card-first ${LOOP_MS}ms ease-in-out infinite;
        }

        .autofill-card-second {
          animation: autofill-card-second ${LOOP_MS}ms ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .autofill-logo-loop,
          .autofill-card-first,
          .autofill-card-second {
            animation: none;
          }
        }
      `}</style>
      <div className={prefersReducedMotion ? 'absolute inset-0' : 'autofill-logo-loop absolute inset-0'}>
        {Array.from({ length: LINE_COUNT }, (_, index) => (
          <div
            key={index}
            className="absolute top-3 h-14 w-2 bg-neutral-300 dark:bg-neutral-700"
            style={{ left: `${LINE_X_POSITIONS[index]}px` }}
          />
        ))}
        {staticTasks.map(task => (
          <div
            key={`${task.slotIndex}-${task.top}`}
            className="absolute bg-neutral-950 dark:bg-neutral-100"
            style={{
              width: `${CARD_WIDTH}px`,
              height: `${task.height}px`,
              transform: getCardTransform(task.slotIndex, task.top),
            }}
          />
        ))}
        {movingTasks.map(task => (
          <div
            key={task.id}
            className={`absolute bg-neutral-950 dark:bg-neutral-100 ${prefersReducedMotion ? '' : task.id === 'first' ? 'autofill-card-first' : 'autofill-card-second'}`}
            style={{
              width: `${CARD_WIDTH}px`,
              height: `${task.height}px`,
              transform: prefersReducedMotion
                ? getCardTransform(task.targetSlotIndex, task.targetTop)
                : getCardTransform(task.startSlotIndex, task.startTop),
            }}
          />
        ))}
      </div>
    </div>
  );
};
