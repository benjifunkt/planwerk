import React, { useEffect, useState } from 'react';

const LINE_COUNT = 5;
const LINE_WIDTH = 8;
const CARD_WIDTH = 22;
const LINE_TOP = 12;
const CARD_HEIGHT = 18;
const CARD_STACK_GAP = 8;
const STACK_TOPS = [LINE_TOP, LINE_TOP + CARD_HEIGHT + CARD_STACK_GAP];
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

const cleanupTasks = [
  { id: 'black-one', tone: 'black', startSlotIndex: 2, targetSlotIndex: 0, startStackIndex: 0, targetStackIndex: 0 },
  { id: 'gray-one', tone: 'gray', startSlotIndex: 2, targetSlotIndex: 5, startStackIndex: 1, targetStackIndex: 0 },
  { id: 'black-two', tone: 'black', startSlotIndex: 3, targetSlotIndex: 0, startStackIndex: 0, targetStackIndex: 1 },
  { id: 'gray-two', tone: 'gray', startSlotIndex: 3, targetSlotIndex: 5, startStackIndex: 1, targetStackIndex: 1 },
] as const;

type CleanupTaskId = typeof cleanupTasks[number]['id'];
type CleanupTaskPhase = 'start' | 'target';

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

const getTaskTransform = (taskId: CleanupTaskId, phase: CleanupTaskPhase) => {
  const task = cleanupTasks.find(currentTask => currentTask.id === taskId);
  if (!task) return getCardTransform(0, STACK_TOPS[0]);

  const slotIndex = phase === 'target' ? task.targetSlotIndex : task.startSlotIndex;
  const stackIndex = phase === 'target' ? task.targetStackIndex : task.startStackIndex;
  return getCardTransform(slotIndex, STACK_TOPS[stackIndex]);
};

export const AnimatedCleanupLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative h-20 w-64" aria-hidden="true">
      <style>{`
        @keyframes cleanup-loop-fade {
          0%, ${FADE_IN_START_PERCENT}% { opacity: 0; }
          ${MOVE_START_PERCENT}%, ${HOLD_END_PERCENT}% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes cleanup-card-black-one {
          0%, ${MOVE_START_PERCENT}% { transform: ${getTaskTransform('black-one', 'start')}; animation-timing-function: ease-in-out; }
          ${MOVE_END_PERCENT}% { transform: ${getTaskTransform('black-one', 'target')}; }
          100% { transform: ${getTaskTransform('black-one', 'target')}; }
        }

        @keyframes cleanup-card-gray-one {
          0%, ${MOVE_START_PERCENT}% { transform: ${getTaskTransform('gray-one', 'start')}; animation-timing-function: ease-in-out; }
          ${MOVE_END_PERCENT}% { transform: ${getTaskTransform('gray-one', 'target')}; }
          100% { transform: ${getTaskTransform('gray-one', 'target')}; }
        }

        @keyframes cleanup-card-black-two {
          0%, ${MOVE_START_PERCENT}% { transform: ${getTaskTransform('black-two', 'start')}; animation-timing-function: ease-in-out; }
          ${MOVE_END_PERCENT}% { transform: ${getTaskTransform('black-two', 'target')}; }
          100% { transform: ${getTaskTransform('black-two', 'target')}; }
        }

        @keyframes cleanup-card-gray-two {
          0%, ${MOVE_START_PERCENT}% { transform: ${getTaskTransform('gray-two', 'start')}; animation-timing-function: ease-in-out; }
          ${MOVE_END_PERCENT}% { transform: ${getTaskTransform('gray-two', 'target')}; }
          100% { transform: ${getTaskTransform('gray-two', 'target')}; }
        }

        .cleanup-logo-loop {
          animation: cleanup-loop-fade ${LOOP_MS}ms ease-in-out infinite;
        }

        .cleanup-card-black-one {
          animation: cleanup-card-black-one ${LOOP_MS}ms ease-in-out infinite;
        }

        .cleanup-card-gray-one {
          animation: cleanup-card-gray-one ${LOOP_MS}ms ease-in-out infinite;
        }

        .cleanup-card-black-two {
          animation: cleanup-card-black-two ${LOOP_MS}ms ease-in-out infinite;
        }

        .cleanup-card-gray-two {
          animation: cleanup-card-gray-two ${LOOP_MS}ms ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .cleanup-logo-loop,
          .cleanup-card-black-one,
          .cleanup-card-gray-one,
          .cleanup-card-black-two,
          .cleanup-card-gray-two {
            animation: none;
          }
        }
      `}</style>
      <div className={prefersReducedMotion ? 'absolute inset-0' : 'cleanup-logo-loop absolute inset-0'}>
        {Array.from({ length: LINE_COUNT }, (_, index) => (
          <div
            key={index}
            className="absolute w-2 bg-neutral-300 dark:bg-neutral-700"
            style={{ left: `${LINE_X_POSITIONS[index]}px`, top: `${LINE_TOP}px`, height: '56px' }}
          />
        ))}
        {cleanupTasks.map(task => (
          <div
            key={task.id}
            className={`absolute ${
              task.tone === 'black'
                ? 'bg-neutral-950 dark:bg-neutral-100'
                : 'bg-neutral-300 dark:bg-neutral-700'
            } ${prefersReducedMotion ? '' : `cleanup-card-${task.id}`}`}
            style={{
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
              transform: prefersReducedMotion
                ? getTaskTransform(task.id, 'target')
                : getTaskTransform(task.id, 'start'),
            }}
          />
        ))}
      </div>
    </div>
  );
};
