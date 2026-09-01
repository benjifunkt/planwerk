import React from 'react';
import { TranslationKey } from '../../i18n';
import {
  AnalyticsSectionData,
  DistributionKey,
  getProjectAwardIds,
} from './lookbackModel';
import {
  LookbackDistributionBar,
  LookbackDistributionLegend,
} from './LookbackDistributionBar';
import { IconStar, IconClock } from '../Icons';

interface LookbackDetailsProps {
  section: AnalyticsSectionData;
  sectionTitle: string;
  className?: string;
  language: 'en' | 'de';
  getDistributionColor: (key: DistributionKey) => string;
  getDistributionTextColor: (key: DistributionKey) => string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const sectionTitleClass = 'mb-5 text-sm font-black uppercase tracking-widest';

export const LookbackDetails: React.FC<LookbackDetailsProps> = ({
  section,
  sectionTitle,
  className,
  language,
  getDistributionColor,
  getDistributionTextColor,
  t,
}) => {
  const projectAwardIds = getProjectAwardIds(section.projectData);
  const mostSuccessfulIds = new Set(projectAwardIds.mostSuccessful);
  const mostTimeIds = new Set(projectAwardIds.mostTime);

  return (
    <section className={`${className ? `${className} ` : ''}lookback-content-reveal relative mx-auto mt-10 w-full max-w-4xl transition-[opacity,transform] duration-300 motion-reduce:transition-none`}>
      {section.distributionTotalMinutes === 0 ? (
        <p className="py-10 text-center text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          {t('analytics.emptyPeriod')}
        </p>
      ) : (
        <div className="flex flex-col gap-12">
          <div>
            <h3 className={sectionTitleClass}>{t('analytics.overallValueDistribution')}</h3>
            <LookbackDistributionBar
              data={section.distributionData}
              ariaLabel={t('analytics.valueDistributionByDuration', { title: sectionTitle })}
              language={language}
              getDistributionColor={getDistributionColor}
              getDistributionTextColor={getDistributionTextColor}
              t={t}
            />
          </div>

          <div>
            <h3 className={sectionTitleClass}>{t('analytics.projects')}</h3>
            {section.projectData.length === 0 ? (
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t('analytics.noProjectData')}
              </p>
            ) : (
              <div className="space-y-8">
                {section.projectData.map(project => (
                  <article key={project.projectId}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-black">{project.name}</h4>
                      {mostSuccessfulIds.has(project.projectId) && (
                        <span className="flex items-center gap-1 border border-neutral-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                          <IconStar className="h-3 w-3" />
                          {t('analytics.projectAward.mostSuccessful')}
                        </span>
                      )}
                      {mostTimeIds.has(project.projectId) && (
                        <span className="flex items-center gap-1 border border-neutral-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                          <IconClock className="h-3 w-3" />
                          {t('analytics.projectAward.mostTime')}
                        </span>
                      )}
                    </div>
                    <LookbackDistributionBar
                      data={project.distributionData}
                      ariaLabel={t('analytics.projectDistributionAria', { projectName: project.name })}
                      language={language}
                      getDistributionColor={getDistributionColor}
                      getDistributionTextColor={getDistributionTextColor}
                      t={t}
                    />
                  </article>
                ))}
              </div>
            )}
          </div>

          <LookbackDistributionLegend
            getDistributionColor={getDistributionColor}
            t={t}
          />
        </div>
      )}
    </section>
  );
};
