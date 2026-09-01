import React, { useLayoutEffect, useRef, useState } from 'react';
import { TranslationKey } from '../../i18n';
import { formatMinutes } from '../../utils/dateUtils';
import { getClampedDistributionLabelLeft } from './lookbackDistributionLayout';
import { DistributionKey, ValueDistributionData } from './lookbackModel';

interface LookbackDistributionBarProps {
  data: ValueDistributionData[];
  ariaLabel: string;
  language: 'en' | 'de';
  getDistributionColor: (key: DistributionKey) => string;
  getDistributionTextColor: (key: DistributionKey) => string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

interface LookbackDistributionLegendProps {
  getDistributionColor: (key: DistributionKey) => string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

interface DistributionLabelPlacement {
  segmentKey: DistributionKey;
  left: number;
}

const DISTRIBUTION_KEYS: DistributionKey[] = ['NotUseful', 'Somewhat', 'Useful'];

const getDistributionLabelKey = (key: DistributionKey): TranslationKey => {
  if (key === 'Useful') return 'reflection.useful';
  if (key === 'Somewhat') return 'reflection.somewhatUseful';
  return 'reflection.notUseful';
};

const formatPercentage = (percent: number): string => `${Math.round(percent)}%`;

export const LookbackDistributionLegend: React.FC<LookbackDistributionLegendProps> = ({
  getDistributionColor,
  t,
}) => (
  <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-bold text-neutral-600 dark:text-neutral-300">
    {DISTRIBUTION_KEYS.map(key => (
      <li key={key} className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 border border-neutral-200 dark:border-neutral-700"
          style={{ backgroundColor: getDistributionColor(key) }}
          aria-hidden="true"
        />
        {t(getDistributionLabelKey(key))}
      </li>
    ))}
  </ul>
);

export const LookbackDistributionBar: React.FC<LookbackDistributionBarProps> = ({
  data,
  ariaLabel,
  language,
  getDistributionColor,
  getDistributionTextColor,
  t,
}) => {
  const [activeSegmentKey, setActiveSegmentKey] = useState<DistributionKey | null>(null);
  const [labelPlacement, setLabelPlacement] = useState<DistributionLabelPlacement | null>(null);
  const detailRowRef = useRef<HTMLDivElement>(null);
  const detailLabelRef = useRef<HTMLSpanElement>(null);
  const activeSegment = data.find(segment => segment.key === activeSegmentKey) ?? null;
  const activeSegmentIndex = activeSegment
    ? data.findIndex(segment => segment.key === activeSegment.key)
    : -1;
  const activeSegmentStartPercent = activeSegment && activeSegmentIndex >= 0
    ? data
      .slice(0, activeSegmentIndex)
      .reduce((offset, segment) => offset + segment.percent, 0)
    : 0;
  const activeLabelLeft = activeSegment !== null
    && labelPlacement?.segmentKey === activeSegment.key
    ? labelPlacement.left
    : null;

  useLayoutEffect(() => {
    if (!activeSegment || !detailRowRef.current || !detailLabelRef.current) return;

    const detailRow = detailRowRef.current;
    const detailLabel = detailLabelRef.current;
    const segmentKey = activeSegment.key;

    const updateLabelPlacement = () => {
      const left = getClampedDistributionLabelLeft(
        detailRow.clientWidth,
        detailLabel.offsetWidth,
        activeSegmentStartPercent
      );

      setLabelPlacement(current => (
        current?.segmentKey === segmentKey && current.left === left
          ? current
          : { segmentKey, left }
      ));
    };

    updateLabelPlacement();

    const resizeObserver = new ResizeObserver(updateLabelPlacement);
    resizeObserver.observe(detailRow);
    resizeObserver.observe(detailLabel);

    return () => resizeObserver.disconnect();
  }, [activeSegment?.key, activeSegmentStartPercent]);

  return (
    <div>
      <div
        className="flex h-8 w-full overflow-hidden border border-neutral-200 dark:border-neutral-700"
        role="group"
        aria-label={ariaLabel}
      >
        {data.map(segment => (
          segment.minutes > 0 && (
            <span
              key={segment.key}
              className="flex h-full min-w-0 items-center justify-center overflow-hidden text-xs font-black outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:focus-visible:ring-white"
              style={{
                width: `${segment.percent}%`,
                backgroundColor: getDistributionColor(segment.key),
                color: getDistributionTextColor(segment.key),
              }}
              tabIndex={0}
              aria-label={`${t(getDistributionLabelKey(segment.key))}: ${formatPercentage(segment.percent)} · ${formatMinutes(segment.minutes, language)}`}
              onMouseEnter={() => setActiveSegmentKey(segment.key)}
              onMouseLeave={() => setActiveSegmentKey(null)}
              onFocus={() => setActiveSegmentKey(segment.key)}
              onBlur={() => setActiveSegmentKey(null)}
            >
              {segment.percent >= 10 && (
                <span className="truncate px-1">{formatPercentage(segment.percent)}</span>
              )}
            </span>
          )
        ))}
      </div>

      <div
        ref={detailRowRef}
        className="min-h-5 overflow-hidden text-xs font-medium text-neutral-500 dark:text-neutral-400"
        aria-live="polite"
      >
        {activeSegment && (
          <span
            ref={detailLabelRef}
            key={activeSegment.key}
            className={`lookback-segment-detail-reveal flow-root w-max max-w-full ${activeLabelLeft !== null ? 'visible' : 'invisible'}`}
            style={{ marginLeft: `${activeLabelLeft ?? 0}px` }}
          >
            <span className="mt-1 block whitespace-normal">
              {t(getDistributionLabelKey(activeSegment.key))}: {' '}
              <strong className="font-black text-black dark:text-white">
                {formatMinutes(activeSegment.minutes, language)}
              </strong>
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
