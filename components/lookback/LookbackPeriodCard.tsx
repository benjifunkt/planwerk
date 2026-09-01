import React from 'react';
import { TranslationKey } from '../../i18n';
import {
  AnalyticsSectionData,
  DistributionKey,
  PeriodAvailability,
  SummaryStatus,
} from './lookbackModel';
import { LookbackStatusAnimation } from './statusAnimations';

interface LookbackPeriodCardProps {
  section: AnalyticsSectionData;
  title: string;
  availability: PeriodAvailability;
  isSelected: boolean;
  isDimmed: boolean;
  revealDelayMs?: number;
  revealRunId?: number;
  onSelect: () => void;
  getDistributionColor: (key: DistributionKey) => string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const statusKeys: Record<SummaryStatus, TranslationKey> = {
  veryStrong: 'analytics.status.veryStrong',
  goodRange: 'analytics.status.goodRange',
  keepEye: 'analytics.status.keepEye',
  recalibrate: 'analytics.status.recalibrate',
  reprioritize: 'analytics.status.reprioritize',
  noReflections: 'analytics.status.noReflections',
};

const lookbackStatusAnimationStartDelays: Record<AnalyticsSectionData['id'], number> = {
  last2Weeks: 0,
  last3Months: 200,
  overall: 400,
};

const getLockMessage = (
  availability: PeriodAvailability,
  t: LookbackPeriodCardProps['t']
): string => {
  if (availability.lockReason === 'needsFirstReflection') {
    return t('analytics.lock.needsFirstReflection');
  }
  if (availability.lockReason === 'waitingForFirstReflection') {
    return t('analytics.lock.waitingForFirstReflection');
  }
  if (availability.daysRemaining === 1) {
    return t('analytics.lock.availableInOneDay');
  }
  return t('analytics.lock.availableInDays', { count: availability.daysRemaining ?? 0 });
};

export const LookbackPeriodCard: React.FC<LookbackPeriodCardProps> = ({
  section,
  title,
  availability,
  isSelected,
  isDimmed,
  revealDelayMs = 0,
  revealRunId = 0,
  onSelect,
  getDistributionColor,
  t,
}) => {
  const status = t(statusKeys[section.summaryData.status]);
  const lockMessage = availability.isUnlocked ? null : getLockMessage(availability, t);
  const ariaLabel = availability.isUnlocked
    ? t(isSelected ? 'analytics.periodCard.selectedAria' : 'analytics.periodCard.aria', { title, status })
    : t('analytics.periodCard.lockedAria', { title, message: lockMessage ?? '' });

  return (
    <div
      className="lookback-overview-item-reveal w-full min-w-[10rem]"
      data-lookback-reveal-run={revealRunId}
      style={{
        '--lookback-reveal-delay-ms': `${revealDelayMs}ms`,
      } as React.CSSProperties}
    >
      <button
        type="button"
        disabled={!availability.isUnlocked}
        aria-pressed={isSelected}
        aria-label={ariaLabel}
        onClick={onSelect}
        className={`group relative flex aspect-square w-full min-w-[10rem] overflow-hidden border text-left transition-[transform,box-shadow,opacity,background-color,border-color] duration-200 motion-reduce:transition-none ${availability.isUnlocked
          ? `${isSelected ? 'border-black shadow-sm dark:border-neutral-500' : 'border-neutral-200 dark:border-neutral-700'} bg-white text-black hover:-translate-y-1 hover:border-neutral-400 hover:shadow-sm focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 focus-visible:shadow-sm motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-500 dark:focus-visible:ring-white ${isDimmed ? 'opacity-30 hover:opacity-70 focus-visible:opacity-70' : 'opacity-100'}`
          : 'cursor-not-allowed border-neutral-300 bg-neutral-100 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-500'
        }`}
      >
        {availability.isUnlocked ? (
          <>
            <div className="absolute inset-x-0 top-0 bottom-[4.25rem] overflow-hidden">
              <LookbackStatusAnimation
                status={section.summaryData.status}
                variantKey={section.id}
                startDelayMs={lookbackStatusAnimationStartDelays[section.id]}
              />
            </div>
            <div className="absolute inset-x-0 bottom-3 flex h-14 items-center justify-center border-t border-neutral-200 bg-white px-4 text-center dark:border-neutral-700 dark:bg-neutral-900">
              <p className="text-sm font-black leading-tight tracking-tight sm:text-base">
                {status}
              </p>
            </div>
            <div
              className="absolute inset-x-0 bottom-0 flex h-3 overflow-hidden border-t border-neutral-200 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-700"
              aria-hidden="true"
            >
              {section.distributionData.map(segment => (
                segment.percent > 0 && (
                  <span
                    key={segment.key}
                    className="h-full min-w-0"
                    style={{
                      width: `${segment.percent}%`,
                      backgroundColor: getDistributionColor(segment.key),
                    }}
                  />
                )
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="m-auto max-w-[12rem] px-4 text-center text-xs font-bold leading-relaxed sm:text-sm">
              {lockMessage}
            </p>
            <div className="absolute inset-x-0 bottom-0 h-3 border-t border-neutral-200 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-700" aria-hidden="true" />
          </>
        )}
      </button>
      <p className={`mt-3 text-center text-xs font-black uppercase tracking-widest ${availability.isUnlocked
        ? 'text-black dark:text-neutral-100'
        : 'text-neutral-400 dark:text-neutral-600'
      }`}>
        {title}
      </p>
    </div>
  );
};
