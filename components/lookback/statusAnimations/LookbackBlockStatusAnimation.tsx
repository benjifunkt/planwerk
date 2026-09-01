import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SummaryStatus } from '../lookbackModel';

type AnimatedBlockStatus = Exclude<SummaryStatus, 'noReflections'>;
type LookbackBlockColorRole = 'color' | 'black' | 'grey';
type LookbackBlockColorId = 'blue' | 'green' | 'red' | 'yellow' | 'black' | 'grey';

type LookbackBlockColor = {
  id: LookbackBlockColorId;
  role: LookbackBlockColorRole;
  color: string;
  darkColor: string;
};

type LookbackBlockStatusConfig = {
  activeStartRow: number;
  activeRows: number;
  blocksPerRow: number;
  blockTickMs: number;
  rowPauseMs: number;
  colorPercent: number;
  blackPercent: number;
  blackEvery?: number;
};

type LookbackBlockVariant = {
  rowSeedOffset: number;
  colorOffset: number;
  characterOffset: number;
};

type LookbackBlockPosition = {
  column: number;
  row: number;
};

type LookbackBlock = LookbackBlockPosition & {
  id: number;
  color: LookbackBlockColor;
  jitterX: number;
  jitterY: number;
  rotation: number;
};

type LookbackBlockAnimationState = {
  status: AnimatedBlockStatus;
  config: LookbackBlockStatusConfig;
  variant: LookbackBlockVariant;
  blocks: LookbackBlock[];
  currentRowIndex: number;
  currentRowPlan: number[];
  currentColumnIndex: number;
  nextBlockIndex: number;
  isRowPause: boolean;
};

export const LOOKBACK_BLOCK_TOWER_BASE_CONFIG = {
  columns: 7,
  visibleRows: 5,
} as const;

export const LOOKBACK_BLOCK_MAX_RUN_MS = 60_000;

export const LOOKBACK_BLOCK_STATUS_CONFIG: Record<AnimatedBlockStatus, LookbackBlockStatusConfig> = {
  veryStrong: {
    activeStartRow: 0,
    activeRows: 5,
    blocksPerRow: 5,
    blockTickMs: 92,
    rowPauseMs: 190,
    colorPercent: 86,
    blackPercent: 14,
    blackEvery: 7,
  },
  goodRange: {
    activeStartRow: 1,
    activeRows: 4,
    blocksPerRow: 5,
    blockTickMs: 170,
    rowPauseMs: 360,
    colorPercent: 35,
    blackPercent: 25,
  },
  keepEye: {
    activeStartRow: 2,
    activeRows: 3,
    blocksPerRow: 4,
    blockTickMs: 300,
    rowPauseMs: 630,
    colorPercent: 0,
    blackPercent: 30,
  },
  recalibrate: {
    activeStartRow: 3,
    activeRows: 2,
    blocksPerRow: 4,
    blockTickMs: 550,
    rowPauseMs: 1150,
    colorPercent: 0,
    blackPercent: 45,
  },
  reprioritize: {
    activeStartRow: 4,
    activeRows: 1,
    blocksPerRow: 3,
    blockTickMs: 1000,
    rowPauseMs: 2000,
    colorPercent: 0,
    blackPercent: 10,
  },
} as const;

export const LOOKBACK_BLOCK_COLORS: LookbackBlockColor[] = [
  { id: 'blue', role: 'color', color: '#2383f6', darkColor: '#4b9dff' },
  { id: 'green', role: 'color', color: '#4fd466', darkColor: '#63df78' },
  { id: 'red', role: 'color', color: '#ff3048', darkColor: '#ff5367' },
  { id: 'yellow', role: 'color', color: '#ffd33d', darkColor: '#ffdc5f' },
  { id: 'black', role: 'black', color: '#111111', darkColor: '#f5f5f5' },
  { id: 'grey', role: 'grey', color: '#d8d8d8', darkColor: '#737373' },
];

export const LOOKBACK_BLOCK_ROW_SEEDS = [
  1, 4, 2, 6, 0, 3, 5,
  2, 6, 1, 5, 3, 0, 4,
  5, 2, 0, 6, 4, 1, 3,
] as const;

const DEFAULT_LOOKBACK_BLOCK_VARIANT: LookbackBlockVariant = {
  rowSeedOffset: 0,
  colorOffset: 0,
  characterOffset: 0,
};

export const createLookbackBlockVariant = (variantKey: string): LookbackBlockVariant => {
  const variantSeed = variantKey.split('').reduce((total, character, index) => (
    total + character.charCodeAt(0) * (index + 1)
  ), 0);

  return {
    rowSeedOffset: variantSeed % LOOKBACK_BLOCK_ROW_SEEDS.length,
    colorOffset: variantSeed % LOOKBACK_BLOCK_COLORS.length,
    characterOffset: variantSeed % 17,
  };
};

const getMaxRenderedRow = (config: LookbackBlockStatusConfig): number => (
  Math.min(
    LOOKBACK_BLOCK_TOWER_BASE_CONFIG.visibleRows,
    config.activeStartRow + config.activeRows
  )
);

export const createSparseRowPlan = (
  rowIndex: number,
  config: LookbackBlockStatusConfig,
  variant: LookbackBlockVariant = DEFAULT_LOOKBACK_BLOCK_VARIANT
): number[] => {
  const columns = Array.from(
    { length: LOOKBACK_BLOCK_TOWER_BASE_CONFIG.columns },
    (_, column) => column
  );
  const rowSeed = LOOKBACK_BLOCK_ROW_SEEDS[
    (rowIndex + variant.rowSeedOffset) % LOOKBACK_BLOCK_ROW_SEEDS.length
  ];

  for (let index = columns.length - 1; index > 0; index -= 1) {
    const swapIndex = (rowSeed + rowIndex * 3 + index * 5 + variant.rowSeedOffset) % (index + 1);
    const current = columns[index];
    columns[index] = columns[swapIndex];
    columns[swapIndex] = current;
  }

  return columns.slice(0, config.blocksPerRow);
};

const getNeighborColorIds = (
  blocks: LookbackBlock[],
  position: LookbackBlockPosition
): Set<LookbackBlockColor['id']> => {
  const blockedColors = new Set<LookbackBlockColor['id']>();

  blocks
    .filter(block => (
      block.row === position.row &&
      Math.abs(block.column - position.column) === 1
    ))
    .forEach(block => blockedColors.add(block.color.id));

  blocks
    .filter(block => (
      block.column === position.column &&
      Math.abs(block.row - position.row) === 1
    ))
    .forEach(block => blockedColors.add(block.color.id));

  return blockedColors;
};

const getPreferredColorRole = (
  blockIndex: number,
  position: LookbackBlockPosition,
  config: LookbackBlockStatusConfig,
  variant: LookbackBlockVariant
): LookbackBlockColorRole => {
  if (config.blackEvery) {
    return (blockIndex + variant.colorOffset) % config.blackEvery === 0 ? 'black' : 'color';
  }

  const slot = (
    blockIndex * 37 +
    position.column * 11 +
    position.row * 17 +
    variant.colorOffset * 13
  ) % 100;

  if (slot < config.colorPercent) return 'color';
  if (slot < config.colorPercent + config.blackPercent) return 'black';

  return 'grey';
};

export const getNextBlockColor = (
  blocks: LookbackBlock[],
  blockIndex: number,
  position: LookbackBlockPosition,
  config: LookbackBlockStatusConfig,
  variant: LookbackBlockVariant = DEFAULT_LOOKBACK_BLOCK_VARIANT
): LookbackBlockColor => {
  const blockedColors = getNeighborColorIds(blocks, position);
  const preferredRole = getPreferredColorRole(blockIndex, position, config, variant);
  const colorIsAllowed = config.colorPercent > 0;
  const greyIsAllowed = config.colorPercent + config.blackPercent < 100;
  const allowedColors = LOOKBACK_BLOCK_COLORS.filter(color => (
    (color.role !== 'color' || colorIsAllowed) &&
    (color.role !== 'grey' || greyIsAllowed)
  ));
  const preferredColors = LOOKBACK_BLOCK_COLORS.filter(color => (
    color.role === preferredRole &&
    (color.role !== 'color' || colorIsAllowed) &&
    (color.role !== 'grey' || greyIsAllowed) &&
    !blockedColors.has(color.id)
  ));
  const neutralFallback = allowedColors.filter(color => (
    (color.role === 'black' || color.role === 'grey') &&
    !blockedColors.has(color.id)
  ));
  const openFallback = allowedColors.filter(color => !blockedColors.has(color.id));
  const palette = preferredColors.length > 0
    ? preferredColors
    : neutralFallback.length > 0
      ? neutralFallback
      : openFallback.length > 0
        ? openFallback
        : allowedColors;

  return palette[(blockIndex * 3 + position.column + position.row + variant.colorOffset) % palette.length];
};

const getBlockCharacter = (
  blockIndex: number,
  variant: LookbackBlockVariant
): Pick<LookbackBlock, 'jitterX' | 'jitterY' | 'rotation'> => {
  const characterIndex = blockIndex + variant.characterOffset;

  return {
    jitterX: ((characterIndex * 7) % 7) - 3,
    jitterY: ((characterIndex * 11) % 7) - 3,
    rotation: (((characterIndex * 13) % 9) - 4) * 0.55,
  };
};

const createBlockFromPosition = (
  blocks: LookbackBlock[],
  blockIndex: number,
  position: LookbackBlockPosition,
  config: LookbackBlockStatusConfig,
  variant: LookbackBlockVariant
): LookbackBlock => {
  const color = getNextBlockColor(blocks, blockIndex, position, config, variant);

  return {
    id: blockIndex,
    ...position,
    ...getBlockCharacter(blockIndex, variant),
    color,
  };
};

export const trimVisibleRows = (
  blocks: LookbackBlock[],
  config: LookbackBlockStatusConfig
): LookbackBlock[] => (
  blocks.filter(block => block.row <= getMaxRenderedRow(config))
);

export const shiftRowsDown = (blocks: LookbackBlock[]): LookbackBlock[] => (
  blocks.map(block => ({
    ...block,
    row: block.row + 1,
  }))
);

export const createInitialBlocks = (
  config: LookbackBlockStatusConfig,
  variant: LookbackBlockVariant = DEFAULT_LOOKBACK_BLOCK_VARIANT
): LookbackBlock[] => {
  const firstInitialRow = config.activeStartRow + 1;
  const lastInitialRow = getMaxRenderedRow(config) - 1;

  if (lastInitialRow < firstInitialRow) return [];

  const initialRows = Array.from(
    { length: lastInitialRow - firstInitialRow + 1 },
    (_, index) => firstInitialRow + index
  );

  return initialRows.reduce<LookbackBlock[]>((blocks, row) => {
    const rowPlan = createSparseRowPlan(row, config, variant);

    return rowPlan.reduce<LookbackBlock[]>((rowBlocks, column, columnIndex) => {
      const blockIndex = row * config.blocksPerRow + columnIndex;
      const nextBlock = createBlockFromPosition(rowBlocks, blockIndex, { column, row }, config, variant);

      return [...rowBlocks, nextBlock];
    }, blocks);
  }, []);
};

export const createNextBlock = (state: LookbackBlockAnimationState): LookbackBlock => (
  createBlockFromPosition(
    state.blocks,
    state.nextBlockIndex,
    {
      column: state.currentRowPlan[state.currentColumnIndex],
      row: state.config.activeStartRow,
    },
    state.config,
    state.variant
  )
);

export const advanceBlockTower = (state: LookbackBlockAnimationState): LookbackBlockAnimationState => {
  if (state.isRowPause) {
    const nextRowIndex = state.currentRowIndex + 1;

    return {
      ...state,
      blocks: trimVisibleRows(shiftRowsDown(state.blocks), state.config),
      currentRowIndex: nextRowIndex,
      currentRowPlan: createSparseRowPlan(nextRowIndex, state.config, state.variant),
      currentColumnIndex: 0,
      isRowPause: false,
    };
  }

  const nextBlock = createNextBlock(state);
  const nextColumnIndex = state.currentColumnIndex + 1;

  return {
    ...state,
    blocks: trimVisibleRows([...state.blocks, nextBlock], state.config),
    currentColumnIndex: nextColumnIndex,
    nextBlockIndex: state.nextBlockIndex + 1,
    isRowPause: nextColumnIndex >= state.currentRowPlan.length,
  };
};

const createInitialAnimationState = (
  status: AnimatedBlockStatus,
  variantKey: string
): LookbackBlockAnimationState => {
  const config = LOOKBACK_BLOCK_STATUS_CONFIG[status];
  const variant = createLookbackBlockVariant(variantKey);
  const blocks = createInitialBlocks(config, variant);
  const nextBlockIndex = blocks.reduce((highest, block) => Math.max(highest, block.id), 0) + 1;
  const currentRowIndex = LOOKBACK_BLOCK_TOWER_BASE_CONFIG.visibleRows + config.activeStartRow;

  return {
    status,
    config,
    variant,
    blocks,
    currentRowIndex,
    currentRowPlan: createSparseRowPlan(currentRowIndex, config, variant),
    currentColumnIndex: 0,
    nextBlockIndex,
    isRowPause: false,
  };
};

const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
};

interface LookbackBlockStatusAnimationProps {
  status: AnimatedBlockStatus;
  variantKey: string;
  startDelayMs?: number;
}

export const LookbackBlockStatusAnimation: React.FC<LookbackBlockStatusAnimationProps> = ({
  status,
  variantKey,
  startDelayMs = 0,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const initialAnimationState = useMemo(
    () => createInitialAnimationState(status, variantKey),
    [status, variantKey]
  );
  const [animationState, setAnimationState] = useState<LookbackBlockAnimationState>(initialAnimationState);
  const [animationFrozen, setAnimationFrozen] = useState(false);
  const runStartedAtRef = useRef(Date.now());
  const hasAppliedStartDelayRef = useRef(false);
  const visibleBlocks = animationState.blocks.filter(block => block.row <= LOOKBACK_BLOCK_TOWER_BASE_CONFIG.visibleRows);

  useEffect(() => {
    runStartedAtRef.current = Date.now();
    hasAppliedStartDelayRef.current = false;
    setAnimationState(initialAnimationState);
    setAnimationFrozen(false);
  }, [initialAnimationState]);

  useEffect(() => {
    if (prefersReducedMotion || animationFrozen) return;

    const elapsedRunMs = Date.now() - runStartedAtRef.current;
    const remainingRunMs = LOOKBACK_BLOCK_MAX_RUN_MS - elapsedRunMs;

    if (animationState.isRowPause && remainingRunMs <= animationState.config.rowPauseMs) {
      const freezeDelayMs = Math.max(0, remainingRunMs);
      const timeoutId = window.setTimeout(() => setAnimationFrozen(true), freezeDelayMs);

      return () => window.clearTimeout(timeoutId);
    }

    const intervalMs = animationState.isRowPause
      ? animationState.config.rowPauseMs
      : animationState.config.blockTickMs;
    const initialTickDelayMs = hasAppliedStartDelayRef.current ? 0 : startDelayMs;
    const timeoutId = window.setTimeout(() => {
      hasAppliedStartDelayRef.current = true;
      setAnimationState(prev => advanceBlockTower(prev));
    }, intervalMs + initialTickDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    animationFrozen,
    animationState.config.blockTickMs,
    animationState.config.rowPauseMs,
    animationState.currentColumnIndex,
    animationState.currentRowIndex,
    animationState.isRowPause,
    prefersReducedMotion,
    startDelayMs,
  ]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes lookback-block-status-block-pop {
          0% { transform: var(--lookback-block-rotation) translate3d(0, -12%, 0) scale(0.86); filter: saturate(0.92); }
          72% { transform: var(--lookback-block-rotation) translate3d(0, 0, 0) scale(1.04); filter: saturate(1.18); }
          100% { transform: var(--lookback-block-rotation) translate3d(0, 0, 0) scale(1); filter: saturate(1); }
        }

        @keyframes lookback-block-status-row-shift {
          0% { transform: translate3d(0, -10%, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }

        .lookback-block-status-block {
          animation: lookback-block-status-block-pop 180ms cubic-bezier(0.18, 0.9, 0.26, 1.18) both;
          transition: top ${animationState.config.rowPauseMs}ms cubic-bezier(0.2, 0, 0, 1);
        }

        .lookback-block-status-tower {
          animation: lookback-block-status-row-shift ${animationState.config.rowPauseMs}ms cubic-bezier(0.2, 0, 0, 1);
        }

        @media (prefers-reduced-motion: reduce) {
          .lookback-block-status-block,
          .lookback-block-status-tower {
            animation: none;
            transition: none;
          }
        }
      `}</style>

      <div className="lookback-block-status-tower absolute inset-y-0 -left-[10%] -right-[10%] overflow-hidden">
        {visibleBlocks.map(block => {
          const left = `calc((100% / ${LOOKBACK_BLOCK_TOWER_BASE_CONFIG.columns}) * ${block.column} + ${block.jitterX}px)`;
          const top = `calc((100% / ${LOOKBACK_BLOCK_TOWER_BASE_CONFIG.visibleRows}) * ${block.row} + ${block.jitterY}px)`;

          return (
            <span
              key={`${animationState.status}-${block.id}`}
              className="lookback-block-status-block absolute bg-[var(--lookback-block-color)] dark:bg-[var(--lookback-block-dark-color)]"
              style={{
                '--lookback-block-color': block.color.color,
                '--lookback-block-dark-color': block.color.darkColor,
                '--lookback-block-rotation': `rotate(${block.rotation}deg)`,
                left,
                top,
                width: `calc(100% / ${LOOKBACK_BLOCK_TOWER_BASE_CONFIG.columns} - 2px)`,
                height: `calc(100% / ${LOOKBACK_BLOCK_TOWER_BASE_CONFIG.visibleRows} - 2px)`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
    </div>
  );
};
