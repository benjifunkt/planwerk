import React, { useEffect, useMemo, useState } from 'react';

const LINE_COUNT = 5;
const COLUMN_COUNT = LINE_COUNT;
const MOVE_MS = 1500;
const HOLD_MS = 2000;
const LINE_WIDTH = 8;
const CARD_WIDTH = 22;
const CARD_HEIGHT = 18;
const LINE_X_POSITIONS = [48, 90, 132, 174, 216];
const BETWEEN_LINE_SLOT_X_POSITIONS = LINE_X_POSITIONS.slice(0, -1).map((lineX, index) => (
  ((lineX + LINE_WIDTH / 2) + (LINE_X_POSITIONS[index + 1] + LINE_WIDTH / 2)) / 2
));
const START_SLOT_X_POSITION = (LINE_X_POSITIONS[0] + LINE_WIDTH / 2) - (
  BETWEEN_LINE_SLOT_X_POSITIONS[0] - (LINE_X_POSITIONS[0] + LINE_WIDTH / 2)
);
const SLOT_X_POSITIONS = [START_SLOT_X_POSITION, ...BETWEEN_LINE_SLOT_X_POSITIONS];
const CARD_Y_POSITION = 16;

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

const getRandomColumn = (currentColumn: number) => {
  if (COLUMN_COUNT <= 1) return 0;

  let nextColumn = Math.floor(Math.random() * COLUMN_COUNT);
  if (nextColumn === currentColumn) {
    nextColumn = (nextColumn + 1) % COLUMN_COUNT;
  }
  return nextColumn;
};

export const AnimatedBoardDragLogo: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeColumn, setActiveColumn] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsDragging(false);
      return;
    }

    let holdTimeout: number | undefined;
    let moveTimeout: number | undefined;

    const scheduleNextMove = () => {
      holdTimeout = window.setTimeout(() => {
        setIsDragging(true);
        setActiveColumn(currentColumn => getRandomColumn(currentColumn));

        moveTimeout = window.setTimeout(() => {
          setIsDragging(false);
          scheduleNextMove();
        }, MOVE_MS);
      }, HOLD_MS);
    };

    scheduleNextMove();

    return () => {
      if (holdTimeout !== undefined) window.clearTimeout(holdTimeout);
      if (moveTimeout !== undefined) window.clearTimeout(moveTimeout);
    };
  }, [prefersReducedMotion]);

  const cardPosition = useMemo(() => {
    const renderedColumn = prefersReducedMotion ? 2 : activeColumn;
    return {
      x: SLOT_X_POSITIONS[renderedColumn] - CARD_WIDTH / 2,
      y: CARD_Y_POSITION,
    };
  }, [activeColumn, prefersReducedMotion]);

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
      <div
        className={`absolute bg-neutral-950 dark:bg-neutral-100 ${isDragging ? 'shadow-sm' : 'shadow-none'}`}
        style={{
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
          transform: `translate(${cardPosition.x}px, ${cardPosition.y}px) ${isDragging ? 'scale(1.12)' : 'scale(1)'}`,
          transition: prefersReducedMotion ? 'none' : `transform ${MOVE_MS}ms ease-in-out, box-shadow 180ms ease-out`,
        }}
      />
    </div>
  );
};
