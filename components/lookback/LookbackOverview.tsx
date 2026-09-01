import React from 'react';
import { TranslationKey } from '../../i18n';
import { CombinedStatusKey, ProjectConcernData, ProjectConcernItem } from './lookbackModel';

import { IconAlertTriangle, IconAlertCircle, IconCheckCircle } from '../Icons';

interface LookbackOverviewProps {
  projectConcerns: ProjectConcernData;
  combinedStatusKey: CombinedStatusKey;
  combinedStatusTextKey: TranslationKey;
  baseRevealIndex: number;
  revealAnimationMs: number;
  revealRunId: number;
  revealStepMs: number;
  summaryReturnRunId?: number;
  returnFadeMs?: number;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

interface ConcernGroupProps {
  title: string;
  projects: ProjectConcernItem[];
  tone: 'urgent' | 'warning' | 'improved';
  revealDelayMs: number;
  revealRunId: number;
}

type ConcernGroupData = Pick<ConcernGroupProps, 'title' | 'projects' | 'tone'>;

const CONCERN_TONE_CLASSES: Record<ConcernGroupProps['tone'], string> = {
  urgent: 'border-black bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800',
  warning: 'border-neutral-400 bg-white dark:border-neutral-700 dark:bg-neutral-900',
  improved: 'border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950',
};

const getConcernIcon = (tone: ConcernGroupProps['tone']) => {
  switch (tone) {
    case 'urgent': return <IconAlertTriangle className="h-4 w-4" />;
    case 'warning': return <IconAlertCircle className="h-4 w-4" />;
    case 'improved': return <IconCheckCircle className="h-4 w-4" />;
  }
};

const ConcernGroup: React.FC<ConcernGroupProps> = ({
  title,
  projects,
  tone,
  revealDelayMs,
  revealRunId,
}) => (
  <section
    className={`lookback-overview-item-reveal border p-4 shadow-sm sm:w-[calc((100%-2rem)/3)] sm:flex-none  ${CONCERN_TONE_CLASSES[tone]}`}
    data-lookback-reveal-run={revealRunId}
    style={{
      '--lookback-reveal-delay-ms': `${revealDelayMs}ms`,
    } as React.CSSProperties}
  >
    <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
      {getConcernIcon(tone)}
      {title}
    </h3>
    <ul className="mt-3 space-y-1">
      {projects.map(project => (
        <li key={project.projectId} className="text-sm font-bold leading-snug">
          {project.name}
        </li>
      ))}
    </ul>
  </section>
);

export const LookbackOverview: React.FC<LookbackOverviewProps> = ({
  projectConcerns,
  combinedStatusKey,
  combinedStatusTextKey,
  baseRevealIndex,
  revealAnimationMs,
  revealRunId,
  revealStepMs,
  summaryReturnRunId = 0,
  returnFadeMs = 300,
  t,
}) => {
  const concernGroups = [
    projectConcerns.urgent.length > 0
      ? {
          title: t('analytics.projectConcern.urgentTitle'),
          projects: projectConcerns.urgent,
          tone: 'urgent' as const,
        }
      : null,
    projectConcerns.warning.length > 0
      ? {
          title: t('analytics.projectConcern.warningTitle'),
          projects: projectConcerns.warning,
          tone: 'warning' as const,
        }
      : null,
    projectConcerns.improved.length > 0
      ? {
          title: t('analytics.projectConcern.improvedTitle'),
          projects: projectConcerns.improved,
          tone: 'improved' as const,
        }
      : null,
  ].filter((group): group is ConcernGroupData => group !== null);
  const hasProjectConcerns = concernGroups.length > 0;
  const separatorDelayMs = (baseRevealIndex + concernGroups.length) * revealStepMs;
  const summaryReturnClass = summaryReturnRunId > 0 ? 'lookback-overview-return-fade' : '';
  const summaryReturnStyle = {
    '--lookback-overview-return-fade-ms': `${returnFadeMs}ms`,
  } as React.CSSProperties;

  return (
    <div className="mx-auto mt-10 w-full max-w-4xl">
      {hasProjectConcerns && (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:flex-row sm:justify-center">
          {concernGroups.map((group, index) => (
            <ConcernGroup
              key={group.tone}
              title={group.title}
              projects={group.projects}
              tone={group.tone}
              revealDelayMs={(baseRevealIndex + index) * revealStepMs}
              revealRunId={revealRunId}
            />
          ))}
        </div>
      )}

      <React.Fragment key={`summary-${summaryReturnRunId}`}>
        <div className={`${hasProjectConcerns ? 'mt-10' : ''} flex items-center gap-5`} aria-hidden="true">
          <span
            className={`${summaryReturnClass} lookback-overview-separator-line lookback-overview-separator-line-left h-px flex-1 bg-black/20 dark:bg-white/20`}
            style={{
              ...summaryReturnStyle,
              '--lookback-reveal-delay-ms': `${separatorDelayMs + revealAnimationMs}ms`,
              transformOrigin: 'right center',
            } as React.CSSProperties}
          />
          <span
            className={`${summaryReturnClass} lookback-overview-separator-dot h-1.5 w-1.5 bg-black dark:bg-white`}
            style={{
              ...summaryReturnStyle,
              '--lookback-reveal-delay-ms': `${separatorDelayMs}ms`,
            } as React.CSSProperties}
          />
          <span
            className={`${summaryReturnClass} lookback-overview-separator-line lookback-overview-separator-line-right h-px flex-1 bg-black/20 dark:bg-white/20`}
            style={{
              ...summaryReturnStyle,
              '--lookback-reveal-delay-ms': `${separatorDelayMs + revealAnimationMs}ms`,
              transformOrigin: 'left center',
            } as React.CSSProperties}
          />
        </div>
        <p
          className={`${summaryReturnClass} lookback-overview-text-reveal mx-auto mt-8 max-w-2xl text-center text-xl font-black leading-snug tracking-tight sm:text-2xl`}
          data-status-combination={combinedStatusKey}
          data-status-text-key={combinedStatusTextKey}
          style={{
            ...summaryReturnStyle,
            '--lookback-reveal-delay-ms': `${separatorDelayMs + revealAnimationMs * 2}ms`,
          } as React.CSSProperties}
        >
          {t(combinedStatusTextKey)}
        </p>
      </React.Fragment>
    </div>
  );
};
