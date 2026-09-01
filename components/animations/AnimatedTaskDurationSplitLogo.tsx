import React, { useEffect, useState } from 'react';

const SEPARATOR_COUNT = 2;
const PIVOT_X_PERCENT = 92;
const ANIMATION_DURATION_MS = 5800;

type AnimatedTaskDurationSplitLogoProps = {
  size?: 'default' | 'compact';
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

const DurationSplitAnimationStyles: React.FC = () => (
  <style>{`
    @keyframes duration-bar-transform {
      0% {
        opacity: 1;
        transform: scaleX(0);
      }
      48% {
        opacity: 1;
        transform: scaleX(1);
      }
      92% {
        opacity: 1;
        transform: scaleX(1);
      }
      100% {
        opacity: 1;
        transform: scaleX(0);
      }
    }

    @keyframes duration-bar-tilt {
      0%, 34% {
        opacity: 1;
        transform: rotate(0deg) translateY(0);
      }
      48%, 66% {
        opacity: 1;
        transform: rotate(-5deg) translateY(0);
      }
      78%, 100% {
        opacity: 1;
        transform: rotate(0deg) translateY(-6px);
      }
    }

    @keyframes duration-separator-reveal {
      0%, 54% {
        opacity: 0;
      }
      62%, 94% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }

    .duration-split-bar {
      animation: duration-bar-transform ${ANIMATION_DURATION_MS}ms cubic-bezier(0.2, 0.85, 0.2, 1) infinite;
      transform-origin: left center;
    }

    .duration-split-inner {
      animation: duration-bar-tilt ${ANIMATION_DURATION_MS}ms cubic-bezier(0.2, 0.85, 0.2, 1) infinite;
      transform-origin: ${PIVOT_X_PERCENT}% 50%;
    }

    .duration-split-separator {
      animation: duration-separator-reveal ${ANIMATION_DURATION_MS}ms ease-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .duration-split-bar,
      .duration-split-inner,
      .duration-split-separator {
        animation: none !important;
      }
    }
  `}</style>
);

export const AnimatedTaskDurationSplitLogo: React.FC<AnimatedTaskDurationSplitLogoProps> = ({ size = 'default' }) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isCompact = size === 'compact';
  const containerClassName = isCompact
    ? 'flex h-10 w-36 items-center justify-start'
    : 'flex h-16 w-56 items-center justify-center';
  const barClassName = isCompact ? 'h-3 w-32' : 'h-5 w-48';
  const separatorClassName = isCompact ? 'w-1.5' : 'w-2';
  const reducedMotionOffsetClassName = isCompact ? 'translate-y-[-4px]' : 'translate-y-[-6px]';

  return (
    <div className={containerClassName} aria-hidden="true">
      <DurationSplitAnimationStyles />
      <div
        className={`duration-split-bar ${barClassName} ${prefersReducedMotion ? reducedMotionOffsetClassName : ''}`}
      >
        <div className="duration-split-inner relative h-full w-full overflow-hidden bg-neutral-950 dark:bg-neutral-100">
          {Array.from({ length: SEPARATOR_COUNT }, (_, index) => (
            <div
              key={index}
              className={`duration-split-separator absolute top-0 h-full ${separatorClassName} -translate-x-1/2 bg-white dark:bg-neutral-950 ${prefersReducedMotion ? 'opacity-100' : 'opacity-0'}`}
              style={{ left: `${(index + 1) * (100 / (SEPARATOR_COUNT + 1))}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
