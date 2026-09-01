import React, { useEffect, useState } from 'react';

const LINE_COUNT = 5;
const LINE_WIDTH = 8;
const TASK_REVEAL_MS = 300;
const MAX_TASKS_PER_COLUMN = 2;
const TASK_VERTICAL_GAP = 4;
const LINE_X_POSITIONS = [48, 90, 132, 174, 216];
const LINE_CENTER_POSITIONS = LINE_X_POSITIONS.map(lineX => lineX + LINE_WIDTH / 2);
const BETWEEN_LINE_SLOT_X_POSITIONS = LINE_CENTER_POSITIONS.slice(0, -1).map((lineCenterX, index) => (
  (lineCenterX + LINE_CENTER_POSITIONS[index + 1]) / 2
));
const SLOT_SPACING = BETWEEN_LINE_SLOT_X_POSITIONS[0] - LINE_CENTER_POSITIONS[0];
const START_SLOT_X_POSITION = LINE_CENTER_POSITIONS[0] - SLOT_SPACING;
const END_SLOT_X_POSITION = LINE_CENTER_POSITIONS[LINE_CENTER_POSITIONS.length - 1] + SLOT_SPACING;
const SLOT_X_POSITIONS = [START_SLOT_X_POSITION, ...BETWEEN_LINE_SLOT_X_POSITIONS, END_SLOT_X_POSITION];
const TASK_WIDTH = 22;

const createColumnTasks = (heights: number[]) => {
  let top = 16;
  return heights.map(height => {
    const task = { height, top };
    top += height + TASK_VERTICAL_GAP;
    return task;
  });
};

const COLUMN_TASKS = [
  createColumnTasks([18]),
  createColumnTasks([28, 16]),
  createColumnTasks([22, 24]),
  createColumnTasks([32]),
  createColumnTasks([20, 18]),
  createColumnTasks([24]),
].map((tasks, columnIndex) => (
  tasks.slice(0, MAX_TASKS_PER_COLUMN).map((task, taskIndex) => ({
    ...task,
    columnIndex,
    sequenceIndex: columnIndex * MAX_TASKS_PER_COLUMN + taskIndex,
  }))
)).flat();

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

export const AnimatedBoardReadyLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isTaskVisible, setIsTaskVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsTaskVisible(true);
      return;
    }

    const timeout = window.setTimeout(() => setIsTaskVisible(true), 80);
    return () => window.clearTimeout(timeout);
  }, [prefersReducedMotion]);

  return (
    <div className="relative h-20 w-64" aria-hidden="true">
      <div className="absolute inset-0">
        {Array.from({ length: LINE_COUNT }, (_, index) => (
          <div
            key={index}
            className="absolute top-3 h-14 w-2 bg-neutral-300 dark:bg-neutral-700"
            style={{ left: `${LINE_X_POSITIONS[index]}px` }}
          />
        ))}
      </div>
      {COLUMN_TASKS.map(task => (
        <div
          key={`${task.columnIndex}-${task.sequenceIndex}`}
          className="absolute bg-neutral-950 dark:bg-neutral-100"
          style={{
            width: `${TASK_WIDTH}px`,
            height: task.height,
            left: `${SLOT_X_POSITIONS[task.columnIndex] - TASK_WIDTH / 2}px`,
            top: `${task.top}px`,
            transform: isTaskVisible ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'top center',
            transition: prefersReducedMotion ? 'none' : `transform ${TASK_REVEAL_MS}ms ease-out`,
            transitionDelay: prefersReducedMotion ? '0ms' : `${task.sequenceIndex * TASK_REVEAL_MS}ms`,
          }}
        />
      ))}
    </div>
  );
};
