import React from 'react';
import { AnimatedKeyboardKeys } from './AnimatedKeyboardKeys';

const PRESS_INTERVAL_MS = 2400;

export const AnimatedSpaceKeyLogo: React.FC = () => {
  return (
    <AnimatedKeyboardKeys
      keys={[{
        symbol: <span className="block h-px w-16 bg-neutral-400 dark:bg-neutral-500" />,
        width: 'wide',
      }]}
      mode="single"
      cycleMs={PRESS_INTERVAL_MS}
      className="w-64"
    />
  );
};
