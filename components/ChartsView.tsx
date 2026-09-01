import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Project, Task } from '../types';
import { TranslationKey, useI18n } from '../i18n';
import { LookbackDetails } from './lookback/LookbackDetails';
import { LookbackOverview } from './lookback/LookbackOverview';
import { LookbackPeriodCard } from './lookback/LookbackPeriodCard';
import {
  AnalyticsSectionId,
  buildLookbackSections,
  DistributionKey,
  getCombinedStatusKey,
  getCombinedStatusTextKey,
  getLookbackAvailability,
  mergeProjectConcerns,
} from './lookback/lookbackModel';

interface ChartsViewProps {
  tasks: Task[];
  projects: Project[];
  firstReflectionAt: number | null;
}

const LOOKBACK_NOW_REFRESH_MS = 60 * 1000;
const LOOKBACK_REVEAL_ANIMATION_MS = 300;
const LOOKBACK_DETAILS_EXIT_MS = 300;
const LOOKBACK_OVERVIEW_RETURN_FADE_MS = 300;
const LOOKBACK_REVEAL_PAUSE_MS = 500;
const LOOKBACK_REVEAL_STEP_MS = LOOKBACK_REVEAL_ANIMATION_MS + LOOKBACK_REVEAL_PAUSE_MS;

const sectionTitleKeys: Record<AnalyticsSectionId, TranslationKey> = {
  last2Weeks: 'analytics.last2Weeks',
  last3Months: 'analytics.last3Months',
  overall: 'analytics.overall',
};

export const ChartsView: React.FC<ChartsViewProps> = ({ tasks, projects, firstReflectionAt }) => {
  const { language, t } = useI18n();
  const isDark = document.documentElement.classList.contains('dark');
  const [selectedPeriodId, setSelectedPeriodId] = useState<AnalyticsSectionId | null>(null);
  const [exitingPeriodId, setExitingPeriodId] = useState<AnalyticsSectionId | null>(null);
  const [overviewReturnRunId, setOverviewReturnRunId] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const detailsExitTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const intervalId = window.setInterval(updateNow, LOOKBACK_NOW_REFRESH_MS);
    window.addEventListener('focus', updateNow);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', updateNow);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (detailsExitTimeoutRef.current !== null) {
        window.clearTimeout(detailsExitTimeoutRef.current);
      }
    };
  }, []);

  const { analyticsSections, availability } = useMemo(() => {
    return {
      analyticsSections: buildLookbackSections(tasks, projects, t('analytics.unknownProject'), now),
      availability: getLookbackAvailability(firstReflectionAt, now),
    };
  }, [firstReflectionAt, now, projects, tasks, t]);

  const projectConcerns = useMemo(
    () => mergeProjectConcerns(analyticsSections, availability),
    [analyticsSections, availability]
  );
  const combinedStatusKey = useMemo(
    () => getCombinedStatusKey(analyticsSections, availability),
    [analyticsSections, availability]
  );
  const combinedStatusTextKey = useMemo(
    () => getCombinedStatusTextKey(combinedStatusKey, analyticsSections),
    [analyticsSections, combinedStatusKey]
  );
  const selectedSection = selectedPeriodId && availability[selectedPeriodId].isUnlocked
    ? analyticsSections.find(section => section.id === selectedPeriodId) ?? null
    : null;
  const detailsPeriodId = selectedPeriodId ?? exitingPeriodId;
  const detailsSection = detailsPeriodId && availability[detailsPeriodId].isUnlocked
    ? analyticsSections.find(section => section.id === detailsPeriodId) ?? null
    : null;
  const isShowingDetails = Boolean(selectedPeriodId && selectedSection);
  const isDetailsExiting = Boolean(exitingPeriodId && !selectedPeriodId);
  const isRenderingDetails = Boolean(detailsPeriodId && detailsSection);
  const isOverviewVisible = !isShowingDetails && !isDetailsExiting;

  const clearDetailsExitTimeout = () => {
    if (detailsExitTimeoutRef.current === null) return;
    window.clearTimeout(detailsExitTimeoutRef.current);
    detailsExitTimeoutRef.current = null;
  };

  const handleSelectPeriod = (periodId: AnalyticsSectionId) => {
    clearDetailsExitTimeout();
    if (selectedPeriodId === periodId) {
      setExitingPeriodId(periodId);
      setSelectedPeriodId(null);
      detailsExitTimeoutRef.current = window.setTimeout(() => {
        setExitingPeriodId(null);
        setOverviewReturnRunId(runId => runId + 1);
        detailsExitTimeoutRef.current = null;
      }, LOOKBACK_DETAILS_EXIT_MS);
      return;
    }
    setExitingPeriodId(null);
    setSelectedPeriodId(periodId);
  };

  const getDistributionColor = (key: DistributionKey): string => {
    if (key === 'Useful') return isDark ? '#ffffff' : '#000000';
    if (key === 'Somewhat') return '#737373';
    return isDark ? '#404040' : '#d4d4d4';
  };
  const getDistributionTextColor = (key: DistributionKey): string => {
    if (key === 'Useful') return isDark ? '#000000' : '#ffffff';
    if (key === 'Somewhat') return '#ffffff';
    return isDark ? '#ffffff' : '#000000';
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-transparent p-8 text-black dark:text-neutral-100">
      <style>{`
        @keyframes lookback-content-reveal {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lookback-content-reveal {
          animation: lookback-content-reveal 280ms ease-out both;
        }
        @keyframes lookback-content-exit {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(8px); }
        }
        .lookback-content-exit {
          animation: lookback-content-exit ${LOOKBACK_DETAILS_EXIT_MS}ms ease-in both;
          pointer-events: none;
        }
        @keyframes lookback-segment-detail-reveal {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lookback-segment-detail-reveal {
          animation: lookback-segment-detail-reveal 300ms ease-in-out both;
        }
        @keyframes lookback-overview-item-reveal {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .lookback-overview-item-reveal {
          opacity: 0;
          animation: lookback-overview-item-reveal ${LOOKBACK_REVEAL_ANIMATION_MS}ms ease-out var(--lookback-reveal-delay-ms, 0ms) both;
        }
        @keyframes lookback-overview-separator-dot-reveal {
          from { opacity: 0; transform: scale(0.75); }
          to { opacity: 1; transform: scale(1); }
        }
        .lookback-overview-separator-dot {
          opacity: 0;
          animation: lookback-overview-separator-dot-reveal ${LOOKBACK_REVEAL_ANIMATION_MS}ms ease-out var(--lookback-reveal-delay-ms, 0ms) both;
        }
        @keyframes lookback-overview-separator-line-reveal {
          from { opacity: 0; transform: scaleX(0); }
          to { opacity: 1; transform: scaleX(1); }
        }
        .lookback-overview-separator-line {
          opacity: 0;
          animation: lookback-overview-separator-line-reveal ${LOOKBACK_REVEAL_ANIMATION_MS}ms ease-out var(--lookback-reveal-delay-ms, 0ms) both;
        }
        @keyframes lookback-overview-text-reveal {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lookback-overview-text-reveal {
          opacity: 0;
          animation: lookback-overview-text-reveal ${LOOKBACK_REVEAL_ANIMATION_MS}ms ease-out var(--lookback-reveal-delay-ms, 0ms) both;
        }
        @keyframes lookback-overview-return-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .lookback-overview-return-fade {
          animation: lookback-overview-return-fade var(--lookback-overview-return-fade-ms, ${LOOKBACK_OVERVIEW_RETURN_FADE_MS}ms) ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .lookback-content-reveal { animation: none; }
          .lookback-content-exit { animation: none; opacity: 1; transform: none; }
          .lookback-segment-detail-reveal { animation: none; }
          .lookback-overview-item-reveal,
          .lookback-overview-separator-dot,
          .lookback-overview-separator-line,
          .lookback-overview-text-reveal,
          .lookback-overview-return-fade {
            opacity: 1;
            transform: none;
            animation: none;
          }
        }
      `}</style>

      <div className="relative mx-auto w-full max-w-6xl">
        <h2 className="mb-10 border-b border-neutral-200 pb-4 text-4xl font-black uppercase tracking-tighter dark:border-neutral-700">
          {t('analytics.title')}
        </h2>

        <div className="overflow-x-auto pb-6">
          <div className="mx-auto grid w-full min-w-[34rem] max-w-4xl grid-cols-3 gap-5 px-1 pt-1 sm:gap-7">
            {analyticsSections.map((section, sectionIndex) => (
              <LookbackPeriodCard
                key={section.id}
                section={section}
                title={t(sectionTitleKeys[section.id])}
                availability={availability[section.id]}
                isSelected={selectedPeriodId === section.id && availability[section.id].isUnlocked}
                isDimmed={selectedPeriodId !== null && selectedPeriodId !== section.id && availability[section.id].isUnlocked}
                revealDelayMs={sectionIndex * LOOKBACK_REVEAL_STEP_MS}
                onSelect={() => handleSelectPeriod(section.id)}
                getDistributionColor={getDistributionColor}
                t={t}
              />
            ))}
          </div>
        </div>

        {isRenderingDetails && detailsPeriodId && detailsSection ? (
          <LookbackDetails
            key={detailsPeriodId}
            className={isDetailsExiting ? 'lookback-content-exit' : undefined}
            section={detailsSection}
            sectionTitle={t(sectionTitleKeys[detailsPeriodId])}
            language={language}
            getDistributionColor={getDistributionColor}
            getDistributionTextColor={getDistributionTextColor}
            t={t}
          />
        ) : null}

        <div
          aria-hidden={!isOverviewVisible}
          className={!isOverviewVisible
            ? 'pointer-events-none absolute inset-x-0 top-0 opacity-0'
            : 'relative opacity-100'
          }
        >
          <LookbackOverview
            projectConcerns={projectConcerns}
            combinedStatusKey={combinedStatusKey}
            combinedStatusTextKey={combinedStatusTextKey}
            baseRevealIndex={analyticsSections.length}
            revealAnimationMs={LOOKBACK_REVEAL_ANIMATION_MS}
            revealRunId={0}
            revealStepMs={LOOKBACK_REVEAL_STEP_MS}
            summaryReturnRunId={overviewReturnRunId}
            returnFadeMs={LOOKBACK_OVERVIEW_RETURN_FADE_MS}
            t={t}
          />
        </div>
      </div>
    </div>
  );
};
