import React from 'react';
import { AnimatedLookbackCompassLogo } from '../../animations';
import { SummaryStatus } from '../lookbackModel';
import { LOOKBACK_BLOCK_MAX_RUN_MS, LookbackBlockStatusAnimation } from './LookbackBlockStatusAnimation';

interface LookbackStatusAnimationProps {
  status: SummaryStatus;
  variantKey: string;
  startDelayMs?: number;
}

export const LookbackStatusAnimation: React.FC<LookbackStatusAnimationProps> = ({
  status,
  variantKey,
  startDelayMs,
}) => {
  if (status === 'noReflections') {
    return <AnimatedLookbackCompassLogo compact stopAfterMs={LOOKBACK_BLOCK_MAX_RUN_MS} />;
  }

  return <LookbackBlockStatusAnimation status={status} variantKey={variantKey} startDelayMs={startDelayMs} />;
};
