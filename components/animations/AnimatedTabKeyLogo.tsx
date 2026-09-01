import React from 'react';
import { AnimatedKeyboardKeys } from './AnimatedKeyboardKeys';

const PRESS_INTERVAL_MS = 3200;

interface AnimatedTabKeyLogoProps {
  variant?: 'combined' | 'tab';
}

export const AnimatedTabKeyLogo: React.FC<AnimatedTabKeyLogoProps> = ({ variant = 'combined' }) => {
  const isTabOnly = variant === 'tab';
  const keys = isTabOnly
    ? [{ label: 'Tab', symbol: '->|' }]
    : [
      { label: 'Enter', symbol: '↵' },
      { label: 'Tab', symbol: '->|' },
    ];

  return (
    <AnimatedKeyboardKeys
      keys={keys}
      mode={isTabOnly ? 'single' : 'sequential'}
      cycleMs={PRESS_INTERVAL_MS}
      className={isTabOnly ? 'w-28' : 'w-64'}
    />
  );
};
