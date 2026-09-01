import type { LookbackCombinedStatusTranslationKey } from '../../i18n/lookbackCombinedStatus';

export type AnalyticsSectionId = 'last2Weeks' | 'last3Months' | 'overall';
export type SummaryStatus = 'veryStrong' | 'goodRange' | 'keepEye' | 'recalibrate' | 'reprioritize' | 'noReflections';
export type CombinedStatusToken = SummaryStatus | 'locked';
export type CombinedStatusKey = `${CombinedStatusToken}|${CombinedStatusToken}|${CombinedStatusToken}`;
export type LookbackLockReason = 'needsFirstReflection' | 'waitingForFirstReflection' | 'countdown' | null;

export interface PeriodAvailability {
  isUnlocked: boolean;
  unlockAt: number | null;
  daysRemaining: number | null;
  lockReason: LookbackLockReason;
}

export type LookbackAvailability = Record<AnalyticsSectionId, PeriodAvailability>;

interface ReflectionTimestampTask {
  isDone: boolean;
  reflectionValue: number;
  reflectedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
}

interface StatusSectionLike {
  id: AnalyticsSectionId;
  summaryData: { status: SummaryStatus; usefulPercent?: number };
}

interface ProjectDataLike {
  projectId: string;
  name: string;
  AverageValue: number;
}

interface ProjectSectionLike {
  id: AnalyticsSectionId;
  projectData: ProjectDataLike[];
}

interface AvailabilityLike {
  last2Weeks: { isUnlocked: boolean };
  last3Months: { isUnlocked: boolean };
  overall: { isUnlocked: boolean };
}

export interface ProjectConcernItem {
  projectId: string;
  name: string;
}

export type ProjectConcernCategory = 'urgent' | 'warning' | 'improved';

export interface ProjectConcernData {
  urgent: ProjectConcernItem[];
  warning: ProjectConcernItem[];
  improved: ProjectConcernItem[];
}

export type DistributionKey = 'NotUseful' | 'Somewhat' | 'Useful';

export interface ValueDistributionData {
  key: DistributionKey;
  minutes: number;
  percent: number;
}

export interface SummaryData {
  status: SummaryStatus;
  averageScore: number | null;
  usefulPercent: number;
  somewhatPercent: number;
  notUsefulPercent: number;
}

export interface ProjectEfficacyData {
  projectId: string;
  name: string;
  AverageValue: number;
  Duration: number;
  distributionData: ValueDistributionData[];
}

export interface ProjectAwardIds {
  mostSuccessful: string[];
  mostTime: string[];
}

export interface AnalyticsSectionData {
  id: AnalyticsSectionId;
  summaryData: SummaryData;
  distributionData: ValueDistributionData[];
  distributionTotalMinutes: number;
  projectData: ProjectEfficacyData[];
}

interface LookbackTaskLike extends ReflectionTimestampTask {
  id: string;
  duration: number;
  projectId: string | null;
}

interface ProjectLike {
  id: string;
  name: string;
}

interface ReflectedTask {
  task: LookbackTaskLike;
  timestamp: number;
  duration: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const addCalendarMonthsClamped = (timestamp: number, months: number): number => {
  const original = new Date(timestamp);
  const target = new Date(timestamp);
  const originalDay = original.getDate();

  target.setDate(1);
  target.setMonth(target.getMonth() + months);

  const lastTargetDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();
  target.setDate(Math.min(originalDay, lastTargetDay));

  return target.getTime();
};

const resolveAvailability = (unlockAt: number, now: number): PeriodAvailability => {
  const isUnlocked = now >= unlockAt;
  return {
    isUnlocked,
    unlockAt,
    daysRemaining: isUnlocked ? 0 : Math.max(1, Math.ceil((unlockAt - now) / DAY_MS)),
    lockReason: isUnlocked ? null : 'countdown',
  };
};

export const getLookbackAvailability = (
  firstReflectionAt: number | null,
  now: number
): LookbackAvailability => {
  if (firstReflectionAt === null) {
    return {
      last2Weeks: {
        isUnlocked: false,
        unlockAt: null,
        daysRemaining: null,
        lockReason: 'needsFirstReflection',
      },
      last3Months: {
        isUnlocked: false,
        unlockAt: null,
        daysRemaining: null,
        lockReason: 'waitingForFirstReflection',
      },
      overall: {
        isUnlocked: false,
        unlockAt: null,
        daysRemaining: null,
        lockReason: 'waitingForFirstReflection',
      },
    };
  }

  return {
    last2Weeks: {
      isUnlocked: true,
      unlockAt: firstReflectionAt,
      daysRemaining: 0,
      lockReason: null,
    },
    last3Months: resolveAvailability(firstReflectionAt + (21 * DAY_MS), now),
    overall: resolveAvailability(addCalendarMonthsClamped(firstReflectionAt, 3), now),
  };
};

export const getSummaryStatus = (averageScore: number, notUsefulRate: number): SummaryStatus => {
  if (averageScore < 1.0 || notUsefulRate >= 40) return 'reprioritize';
  if (averageScore < 1.5 || notUsefulRate >= 30) return 'recalibrate';
  if (averageScore < 2.1 || notUsefulRate >= 20) return 'keepEye';
  if (averageScore >= 2.6 && notUsefulRate <= 10) return 'veryStrong';
  return 'goodRange';
};

const getReflectionScore = (reflectionValue: number): number => {
  if (reflectionValue === 3) return 3;
  if (reflectionValue === 2) return 1;
  return 0;
};

const buildDistributionData = (
  items: ReflectedTask[]
): { distributionData: ValueDistributionData[]; distributionTotalMinutes: number } => {
  const totals: Record<DistributionKey, number> = {
    NotUseful: 0,
    Somewhat: 0,
    Useful: 0,
  };

  items.forEach(({ task, duration }) => {
    if (task.reflectionValue === 1) totals.NotUseful += duration;
    if (task.reflectionValue === 2) totals.Somewhat += duration;
    if (task.reflectionValue === 3) totals.Useful += duration;
  });

  const distributionTotalMinutes = totals.NotUseful + totals.Somewhat + totals.Useful;
  const distributionData: ValueDistributionData[] = (['NotUseful', 'Somewhat', 'Useful'] as const)
    .map(key => ({
      key,
      minutes: totals[key],
      percent: distributionTotalMinutes > 0 ? (totals[key] / distributionTotalMinutes) * 100 : 0,
    }));

  return { distributionData, distributionTotalMinutes };
};

const buildSummaryData = (
  items: ReflectedTask[],
  distributionData: ValueDistributionData[],
  distributionTotalMinutes: number
): SummaryData => {
  if (items.length === 0) {
    return {
      status: 'noReflections',
      averageScore: null,
      usefulPercent: 0,
      somewhatPercent: 0,
      notUsefulPercent: 0,
    };
  }

  if (distributionTotalMinutes === 0) {
    const usefulCount = items.filter(item => item.task.reflectionValue === 3).length;
    const somewhatCount = items.filter(item => item.task.reflectionValue === 2).length;
    const notUsefulCount = items.filter(item => item.task.reflectionValue === 1).length;
    const averageScore = items.reduce((sum, item) => (
      sum + getReflectionScore(item.task.reflectionValue)
    ), 0) / items.length;
    const usefulPercent = (usefulCount / items.length) * 100;
    const somewhatPercent = (somewhatCount / items.length) * 100;
    const notUsefulPercent = (notUsefulCount / items.length) * 100;

    return {
      status: getSummaryStatus(averageScore, notUsefulPercent),
      averageScore,
      usefulPercent,
      somewhatPercent,
      notUsefulPercent,
    };
  }

  const weightedScore = items.reduce((sum, item) => (
    sum + (getReflectionScore(item.task.reflectionValue) * item.duration)
  ), 0);
  const averageScore = weightedScore / distributionTotalMinutes;
  const usefulPercent = distributionData.find(item => item.key === 'Useful')?.percent ?? 0;
  const somewhatPercent = distributionData.find(item => item.key === 'Somewhat')?.percent ?? 0;
  const notUsefulPercent = distributionData.find(item => item.key === 'NotUseful')?.percent ?? 0;

  return {
    status: getSummaryStatus(averageScore, notUsefulPercent),
    averageScore,
    usefulPercent,
    somewhatPercent,
    notUsefulPercent,
  };
};

const buildProjectData = (
  items: ReflectedTask[],
  projectNameById: Map<string, string>,
  unknownProjectLabel: string
): ProjectEfficacyData[] => {
  const dataMap: Record<string, {
    name: string;
    weightedScore: number;
    totalMinutes: number;
    distributionMinutes: Record<DistributionKey, number>;
  }> = {};

  items.forEach(({ task, duration }) => {
    if (!task.projectId) return;

    dataMap[task.projectId] ??= {
      name: projectNameById.get(task.projectId) || unknownProjectLabel,
      weightedScore: 0,
      totalMinutes: 0,
      distributionMinutes: { NotUseful: 0, Somewhat: 0, Useful: 0 },
    };
    dataMap[task.projectId].weightedScore += getReflectionScore(task.reflectionValue) * duration;
    dataMap[task.projectId].totalMinutes += duration;
    if (task.reflectionValue === 1) dataMap[task.projectId].distributionMinutes.NotUseful += duration;
    if (task.reflectionValue === 2) dataMap[task.projectId].distributionMinutes.Somewhat += duration;
    if (task.reflectionValue === 3) dataMap[task.projectId].distributionMinutes.Useful += duration;
  });

  return Object.entries(dataMap)
    .filter(([, data]) => data.totalMinutes > 0)
    .sort(([, a], [, b]) => (
      b.totalMinutes - a.totalMinutes
      || a.name.localeCompare(b.name)
    ))
    .map(([projectId, data]) => ({
      projectId,
      name: data.name,
      AverageValue: Number((data.weightedScore / data.totalMinutes).toFixed(2)),
      Duration: data.totalMinutes,
      distributionData: (['NotUseful', 'Somewhat', 'Useful'] as const).map(key => ({
        key,
        minutes: data.distributionMinutes[key],
        percent: (data.distributionMinutes[key] / data.totalMinutes) * 100,
      })),
    }));
};

export const buildLookbackSections = (
  tasks: LookbackTaskLike[],
  projects: ProjectLike[],
  unknownProjectLabel: string,
  now: number
): AnalyticsSectionData[] => {
  const reflectedTasks: ReflectedTask[] = tasks
    .filter(task => task.isDone && task.reflectionValue !== 0)
    .map(task => ({
      task,
      timestamp: task.reflectedAt ?? task.completedAt ?? task.updatedAt,
      duration: Math.max(0, task.duration || 0),
    }));
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const windows: Array<{ id: AnalyticsSectionId; startTs: number | null }> = [
    { id: 'last2Weeks', startTs: now - (14 * DAY_MS) },
    { id: 'last3Months', startTs: threeMonthsAgo.getTime() },
    { id: 'overall', startTs: null },
  ];
  const projectNameById = new Map(projects.map(project => [project.id, project.name]));

  return windows.map(window => {
    const scopedTasks = reflectedTasks.filter(item => (
      window.startTs === null || item.timestamp >= window.startTs
    ));
    const distribution = buildDistributionData(scopedTasks);

    return {
      id: window.id,
      summaryData: buildSummaryData(
        scopedTasks,
        distribution.distributionData,
        distribution.distributionTotalMinutes
      ),
      ...distribution,
      projectData: buildProjectData(scopedTasks, projectNameById, unknownProjectLabel),
    };
  });
};

const STATUS_SECTION_ORDER: AnalyticsSectionId[] = ['last2Weeks', 'last3Months', 'overall'];

export const getProjectAwardIds = (
  projects: Array<Pick<ProjectEfficacyData, 'projectId' | 'AverageValue' | 'Duration'>>
): ProjectAwardIds => {
  if (projects.length === 0) {
    return { mostSuccessful: [], mostTime: [] };
  }

  const highestScore = Math.max(...projects.map(project => project.AverageValue));
  const longestDuration = Math.max(...projects.map(project => project.Duration));

  return {
    mostSuccessful: projects
      .filter(project => project.AverageValue === highestScore)
      .map(project => project.projectId),
    mostTime: projects
      .filter(project => project.Duration === longestDuration)
      .map(project => project.projectId),
  };
};

export const classifyProjectConcern = (
  last2WeeksScore: number | null,
  last3MonthsScore: number | null
): ProjectConcernCategory | null => {
  if (last2WeeksScore === null) return null;
  if (last2WeeksScore < 1) return 'urgent';

  const improvement = last3MonthsScore === null
    ? null
    : Number((last2WeeksScore - last3MonthsScore).toFixed(2));
  if (
    last3MonthsScore !== null
    && last3MonthsScore < 2
    && last2WeeksScore >= 2
    && improvement !== null
    && improvement >= 0.4
  ) {
    return 'improved';
  }

  if (
    (last2WeeksScore >= 1 && last2WeeksScore < 2)
    || (
      last2WeeksScore >= 2
      && last3MonthsScore !== null
      && last3MonthsScore >= 1
      && last3MonthsScore < 2
    )
  ) {
    return 'warning';
  }

  return null;
};

export const getCombinedStatusKey = (
  sections: StatusSectionLike[],
  availability: AvailabilityLike
): CombinedStatusKey => STATUS_SECTION_ORDER.map(sectionId => {
  if (!availability[sectionId].isUnlocked) return 'locked';
  return sections.find(section => section.id === sectionId)?.summaryData.status ?? 'noReflections';
}).join('|') as CombinedStatusKey;

const normalizeCombinedStatusToken = (token: CombinedStatusToken): SummaryStatus => (
  token === 'locked' ? 'noReflections' : token
);

const hasFullyUsefulRecentPeriods = (sections: StatusSectionLike[]): boolean => {
  const last2Weeks = sections.find(section => section.id === 'last2Weeks');
  const last3Months = sections.find(section => section.id === 'last3Months');

  return last2Weeks?.summaryData.usefulPercent === 100
    && last3Months?.summaryData.usefulPercent === 100;
};

export const getCombinedStatusTextKey = (
  combinedStatusKey: CombinedStatusKey,
  sections: StatusSectionLike[]
): LookbackCombinedStatusTranslationKey => {
  const normalizedTokens = combinedStatusKey
    .split('|')
    .map(token => normalizeCombinedStatusToken(token as CombinedStatusToken));
  const normalizedKey = normalizedTokens.join('|') as `${SummaryStatus}|${SummaryStatus}|${SummaryStatus}`;

  if (
    normalizedKey === 'veryStrong|veryStrong|veryStrong'
    && hasFullyUsefulRecentPeriods(sections)
  ) {
    return 'analytics.combinedStatus.veryStrong.veryStrong.veryStrong.allUsefulRecent';
  }

  return `analytics.combinedStatus.${normalizedTokens.join('.')}` as LookbackCombinedStatusTranslationKey;
};

export const mergeProjectConcerns = (
  sections: ProjectSectionLike[],
  availability: AvailabilityLike
): ProjectConcernData => {
  const sortByName = (a: ProjectConcernItem, b: ProjectConcernItem) => a.name.localeCompare(b.name);
  const emptyConcerns = (): ProjectConcernData => ({ urgent: [], warning: [], improved: [] });
  if (!availability.last2Weeks.isUnlocked) return emptyConcerns();

  const last2Weeks = sections.find(section => section.id === 'last2Weeks');
  if (!last2Weeks) return emptyConcerns();

  const last3Months = availability.last3Months.isUnlocked
    ? sections.find(section => section.id === 'last3Months')
    : undefined;
  const last3MonthsByProjectId = new Map(
    last3Months?.projectData.map(project => [project.projectId, project.AverageValue]) ?? []
  );
  const concerns: Record<ProjectConcernCategory, Map<string, ProjectConcernItem>> = {
    urgent: new Map(),
    warning: new Map(),
    improved: new Map(),
  };

  last2Weeks.projectData.forEach(project => {
    const category = classifyProjectConcern(
      project.AverageValue,
      last3MonthsByProjectId.get(project.projectId) ?? null
    );
    if (!category) return;

    concerns[category].set(project.projectId, {
      projectId: project.projectId,
      name: project.name,
    });
  });

  return {
    urgent: [...concerns.urgent.values()].sort(sortByName),
    warning: [...concerns.warning.values()].sort(sortByName),
    improved: [...concerns.improved.values()].sort(sortByName),
  };
};
