import React, { useEffect, useState } from 'react';

export type AnimatedKeyboardKeysMode = 'single' | 'simultaneous' | 'sequential';

export interface AnimatedKeyboardKey {
  label?: React.ReactNode;
  symbol?: React.ReactNode;
  width?: 'standard' | 'wide';
}

interface AnimatedKeyboardKeysProps {
  keys: AnimatedKeyboardKey[];
  mode?: AnimatedKeyboardKeysMode;
  separator?: React.ReactNode;
  cycleMs?: number;
  className?: string;
}

const DEFAULT_CYCLE_MS = 3200;
const SEQUENTIAL_PRESS_DELAY_MS = 1400;
const RESTING_KEY_SHADOW = '4px 4px 0 rgba(0, 0, 0, 0.18)';

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

export const AnimatedKeyboardKeys: React.FC<AnimatedKeyboardKeysProps> = ({
  keys,
  mode = 'single',
  separator,
  cycleMs = DEFAULT_CYCLE_MS,
  className = '',
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={`inline-flex h-16 items-center justify-center gap-4 ${className}`}
      aria-hidden="true"
    >
      <style>{`
        @keyframes animated-keyboard-key-press {
          0%, 12%, 30%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: ${RESTING_KEY_SHADOW};
          }

          18%, 24% {
            transform: translateY(3px) scale(0.98);
            box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.18);
          }
        }
      `}</style>
      {keys.map((key, index) => {
        const pressDelayMs = mode === 'sequential' ? index * SEQUENTIAL_PRESS_DELAY_MS : 0;
        const hasLabelAndSymbol = key.label != null && key.symbol != null;

        return (
          <React.Fragment key={index}>
            {index > 0 && separator != null && (
              <span className="font-mono text-base font-black text-neutral-500 dark:text-neutral-400">
                {separator}
              </span>
            )}
            <kbd
              className={`flex h-12 ${key.width === 'wide' ? 'w-48 px-5' : 'w-28 px-3'} items-center border border-neutral-200 bg-white font-mono text-sm font-black text-black dark:border-neutral-300 dark:bg-neutral-950 dark:text-neutral-100 ${hasLabelAndSymbol ? 'justify-between' : 'justify-center'}`}
              style={{
                boxShadow: RESTING_KEY_SHADOW,
                animation: prefersReducedMotion
                  ? 'none'
                  : `animated-keyboard-key-press ${cycleMs}ms ease-in-out ${pressDelayMs}ms infinite`,
              }}
            >
              {key.label != null && <span>{key.label}</span>}
              {key.symbol != null && <span>{key.symbol}</span>}
            </kbd>
          </React.Fragment>
        );
      })}
    </div>
  );
};
