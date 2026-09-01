import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Goal, Task, Project, ReflectionValue, WeeklyGoal } from '../types';
import { getReflectionHistoryGroup } from '../utils/dateUtils';
import { TranslationKey, useI18n } from '../i18n';
import { PrimaryButton, SecondaryButton, TertiaryButton, SubSideMenuButton } from './Buttons';
import { SubSideMenu } from './SubSideMenu';

import { ThreeMonthGoalRow, WeeklyGoalRow } from './GoalRows';
import { WeeklyGoalPanel } from './WeeklyGoalPanel';

interface ReflectionViewProps {
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
  generalGoal: string;
  onEvaluate: (taskId: string, value: ReflectionValue) => void;
  onCompleteGoal: (id: string) => void;
  onUndoCompleteGoal: (id: string) => void;
  onCompleteWeeklyGoal: (id: string) => void;
  onUndoCompleteWeeklyGoal: (id: string) => void;
  onDefineWeeklyGoal: (title: string) => string | null;
  onUpdateWeeklyGoal: (id: string, title: string) => void;
  onClearOpenWeeklyGoal: () => void;
  onNavigateToGoals: () => void;
  onNavigateToLookback: () => void;
}

type ReflectionTab = 'active' | 'history';

type ReflectionHistoryItem = {
  task: Task;
  projectName: string;
  timestamp: number;
};

type ReflectionHistoryGroup = {
  key: string;
  label: string;
  order: number;
  items: ReflectionHistoryItem[];
};

const REFLECTION_OPTIONS = [
  { value: ReflectionValue.NotUseful, labelKey: 'reflection.notUseful' as TranslationKey },
  { value: ReflectionValue.SomewhatUseful, labelKey: 'reflection.somewhatUseful' as TranslationKey },
  { value: ReflectionValue.Useful, labelKey: 'reflection.useful' as TranslationKey },
];

const getTaskHistoryTimestamp = (task: Task) => (
  task.completedAt ?? task.reflectedAt ?? task.updatedAt
);

const getProjectName = (projectId: string | null, projectNameById: Map<string, string>, noProjectLabel: string) => {
  if (!projectId) return noProjectLabel;
  return projectNameById.get(projectId) || noProjectLabel;
};

const sortVisibleThreeMonthGoals = (a: Goal, b: Goal) => {
  if ((a.completedAt == null) !== (b.completedAt == null)) return a.completedAt == null ? -1 : 1;
  if (a.isFocused !== b.isFocused) return a.isFocused ? -1 : 1;
  return a.createdAt - b.createdAt;
};

const sortVisibleWeeklyGoals = (a: WeeklyGoal, b: WeeklyGoal) => {
  if ((a.completedAt == null) !== (b.completedAt == null)) return a.completedAt == null ? -1 : 1;
  return a.createdAt - b.createdAt;
};

interface ReflectionNavProps {
  activeTab: ReflectionTab;
  onSelectTab: (tab: ReflectionTab) => void;
}

const ReflectionNav: React.FC<ReflectionNavProps> = ({ activeTab, onSelectTab }) => {
  const { t } = useI18n();

  return (
    <SubSideMenu>
      <SubSideMenuButton
        isActive={activeTab === 'active'}
        onClick={() => onSelectTab('active')}
      >
        {t('reflection.active')}
      </SubSideMenuButton>
      <SubSideMenuButton
        isActive={activeTab === 'history'}
        onClick={() => onSelectTab('history')}
      >
        {t('reflection.history')}
      </SubSideMenuButton>
    </SubSideMenu>
  );
};

interface ReflectionGoalCheckPanelProps {
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
  onCompleteGoal: (id: string) => void;
  onUndoCompleteGoal: (id: string) => void;
  onCompleteWeeklyGoal: (id: string) => void;
  onUndoCompleteWeeklyGoal: (id: string) => void;
  onDefineWeeklyGoal: (title: string) => string | null;
  onUpdateWeeklyGoal: (id: string, title: string) => void;
  onClearOpenWeeklyGoal: () => void;
  onContinue: () => void;
  onNavigateToGoals: () => void;
}

interface GoalCheckSectionProps {
  delaySeconds: number;
  children: React.ReactNode;
}

interface MissingGoalNoticeProps {
  title: string;
  body: string;
  buttonLabel: string;
  onClick: () => void;
}

const GoalCheckFadeStyles: React.FC = () => (
  <style>{`
    @keyframes reflection-goal-check-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes reflection-goal-check-fade-out {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
  `}</style>
);

const GoalCheckSection: React.FC<GoalCheckSectionProps> = ({ delaySeconds, children }) => (
  <div
    className="opacity-0"
    style={{
      animation: `reflection-goal-check-fade-in 1s ease-out ${delaySeconds}s forwards`,
    }}
  >
    {children}
  </div>
);

const MissingGoalNotice: React.FC<MissingGoalNoticeProps> = ({
  title,
  body,
  buttonLabel,
  onClick,
}) => (
  <div className="border border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-700 dark:bg-neutral-950">
    <h4 className="mb-2 text-lg font-black tracking-tighter uppercase">
      {title}
    </h4>
    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
      {body}
    </p>
    <TertiaryButton onClick={onClick} className="mt-3">
      {buttonLabel}
    </TertiaryButton>
  </div>
);

const ReflectionGoalCheckPanel: React.FC<ReflectionGoalCheckPanelProps> = ({
  goals,
  weeklyGoals,
  onCompleteGoal,
  onUndoCompleteGoal,
  onCompleteWeeklyGoal,
  onUndoCompleteWeeklyGoal,
  onDefineWeeklyGoal,
  onUpdateWeeklyGoal,
  onClearOpenWeeklyGoal,
  onContinue,
  onNavigateToGoals,
}) => {
  const { t } = useI18n();
  const timersRef = useRef<Map<string, number>>(new Map());
  const continueTimerRef = useRef<number | null>(null);
  const [celebratingKeys, setCelebratingKeys] = useState<Set<string>>(() => new Set());
  const [isDismissingGoalCheck, setIsDismissingGoalCheck] = useState(false);
  const [hasCompletedThreeMonthGoalInCheck, setHasCompletedThreeMonthGoalInCheck] = useState(false);
  const [hasStartedReflectionWeeklyGoalFlow, setHasStartedReflectionWeeklyGoalFlow] = useState(false);
  const [reflectionCompletedWeeklyGoalId, setReflectionCompletedWeeklyGoalId] = useState<string | null>(null);
  const [canStartNewReflectionWeeklyGoal, setCanStartNewReflectionWeeklyGoal] = useState(false);
  const [undoableCompletedGoalIds, setUndoableCompletedGoalIds] = useState<Set<string>>(() => new Set());
  const [undoableCompletedWeeklyGoalIds, setUndoableCompletedWeeklyGoalIds] = useState<Set<string>>(() => new Set());

  useEffect(() => () => {
    timersRef.current.forEach(timer => window.clearTimeout(timer));
    timersRef.current.clear();
    if (continueTimerRef.current != null) {
      window.clearTimeout(continueTimerRef.current);
    }
  }, []);

  const startCompletion = (
    key: string,
    options: { onComplete: () => void; marksFooterComplete: boolean }
  ) => {
    if (timersRef.current.has(key)) return;

    if (options.marksFooterComplete) setHasCompletedThreeMonthGoalInCheck(true);
    setCelebratingKeys(prev => new Set(prev).add(key));
    const timer = window.setTimeout(() => {
      options.onComplete();
      setCelebratingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      timersRef.current.delete(key);
    }, 4000);
    timersRef.current.set(key, timer);
  };

  const handleToggleWeeklyGoal = (goal: WeeklyGoal) => {
    if (goal.completedAt != null) {
      onUndoCompleteWeeklyGoal(goal.id);
      setUndoableCompletedWeeklyGoalIds(prev => {
        const next = new Set(prev);
        next.delete(goal.id);
        return next;
      });
      setReflectionCompletedWeeklyGoalId(null);
      setCanStartNewReflectionWeeklyGoal(false);
      return;
    }

    startCompletion(`weekly:${goal.id}`, {
      marksFooterComplete: false,
      onComplete: () => {
        onCompleteWeeklyGoal(goal.id);
        setUndoableCompletedWeeklyGoalIds(prev => new Set(prev).add(goal.id));
        setHasStartedReflectionWeeklyGoalFlow(true);
        setReflectionCompletedWeeklyGoalId(goal.id);
        setCanStartNewReflectionWeeklyGoal(true);
      },
    });
  };

  const handleToggleGoal = (goal: Goal) => {
    if (goal.completedAt != null) {
      onUndoCompleteGoal(goal.id);
      setUndoableCompletedGoalIds(prev => {
        const next = new Set(prev);
        next.delete(goal.id);
        return next;
      });
      return;
    }

    startCompletion(`goal:${goal.id}`, {
      marksFooterComplete: true,
      onComplete: () => {
        onCompleteGoal(goal.id);
        setUndoableCompletedGoalIds(prev => new Set(prev).add(goal.id));
      },
    });
  };

  const handleContinue = () => {
    if (continueTimerRef.current != null) return;

    setIsDismissingGoalCheck(true);
    continueTimerRef.current = window.setTimeout(() => {
      onContinue();
      continueTimerRef.current = null;
    }, 1000);
  };

  const visibleWeeklyGoals = useMemo(() => (
    weeklyGoals
      .filter(goal => goal.completedAt == null || undoableCompletedWeeklyGoalIds.has(goal.id))
      .sort(sortVisibleWeeklyGoals)
  ), [undoableCompletedWeeklyGoalIds, weeklyGoals]);
  const visibleGoals = useMemo(() => (
    goals
      .filter(goal => goal.completedAt == null || undoableCompletedGoalIds.has(goal.id))
      .sort(sortVisibleThreeMonthGoals)
  ), [goals, undoableCompletedGoalIds]);
  const hasVisibleWeeklyGoal = visibleWeeklyGoals.length > 0;
  const hasVisibleThreeMonthGoal = visibleGoals.length > 0;
  const hasVisibleGoals = hasVisibleWeeklyGoal || hasVisibleThreeMonthGoal;

  if (!hasVisibleGoals) {
    return (
      <>
        <GoalCheckFadeStyles />
        <div
          className="flex min-h-full flex-col items-center justify-center px-4 text-center text-black opacity-0 dark:text-neutral-100"
          style={{ animation: 'reflection-goal-check-fade-in 1s ease-out forwards' }}
        >
          <h2 className="mb-4 text-4xl font-black tracking-tighter uppercase">{t('reflection.findGoalsTitle')}</h2>
          <p className="mb-8 max-w-md text-neutral-500 dark:text-neutral-400">
            {t('reflection.findGoalsBody')}
          </p>
          <SecondaryButton onClick={onNavigateToGoals}>
            {t('reflection.findGoals')}
          </SecondaryButton>
        </div>
      </>
    );
  }

  return (
    <div
      className="max-w-5xl mx-auto pb-8 text-black dark:text-neutral-100"
      style={isDismissingGoalCheck ? { animation: 'reflection-goal-check-fade-out 1s ease-out forwards' } : undefined}
    >
      <GoalCheckFadeStyles />

      <GoalCheckSection delaySeconds={0}>
        <div className="mb-10 border-b border-neutral-200 pb-4 dark:border-neutral-700">
          <h2 className="text-4xl font-black tracking-tighter uppercase">
            {t('reflection.goalCheckTitle')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {hasVisibleGoals ? t('reflection.goalCheckBody') : t('reflection.goalCheckEmpty')}
          </p>
        </div>
      </GoalCheckSection>

      <GoalCheckSection delaySeconds={1}>
        <>
          {hasVisibleWeeklyGoal ? (
            hasStartedReflectionWeeklyGoalFlow ? (
              <WeeklyGoalPanel
                openGoalCount={0}
                weeklyGoals={weeklyGoals}
                onDefineWeeklyGoal={onDefineWeeklyGoal}
                onUpdateWeeklyGoal={onUpdateWeeklyGoal}
                onClearOpenWeeklyGoal={onClearOpenWeeklyGoal}
                onCompleteWeeklyGoal={onCompleteWeeklyGoal}
                onUndoCompleteWeeklyGoal={onUndoCompleteWeeklyGoal}
                showWhenIdle={false}
                onDeleteWeeklyGoal={undefined}
                completedWeeklyGoalId={reflectionCompletedWeeklyGoalId}
                canStartNewWeeklyGoal={canStartNewReflectionWeeklyGoal}
                onCompletedWeeklyGoalIdChange={setReflectionCompletedWeeklyGoalId}
                onCanStartNewWeeklyGoalChange={setCanStartNewReflectionWeeklyGoal}
              />
            ) : (
              <section className="mb-10">
                <h3 className="mb-3 block text-xl font-black tracking-tighter uppercase">
                  {t('goals.weeklyTitle')}
                </h3>
                <div className="space-y-3">
                  {visibleWeeklyGoals.map(goal => (
                    <WeeklyGoalRow
                      key={goal.id}
                      goal={goal}
                      isCelebrating={celebratingKeys.has(`weekly:${goal.id}`)}
                      onToggleComplete={() => handleToggleWeeklyGoal(goal)}
                    />
                  ))}
                </div>
              </section>
            )
          ) : (
            <section className="mb-10">
              <MissingGoalNotice
                title={t('reflection.missingWeeklyGoalTitle')}
                body={t('reflection.missingWeeklyGoalBody')}
                buttonLabel={t('reflection.findWeeklyGoal')}
                onClick={onNavigateToGoals}
              />
            </section>
          )}
        </>
      </GoalCheckSection>

      <GoalCheckSection delaySeconds={2}>
        <section className="mb-10">
          {hasVisibleThreeMonthGoal ? (
            <>
              <h3 className="mb-3 block text-xl font-black tracking-tighter uppercase">
                {t('goals.activeTitle')}
              </h3>
              <div className="border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900 ">
                {visibleGoals.map(goal => (
                  <ThreeMonthGoalRow
                    key={goal.id}
                    goal={goal}
                    isCelebrating={celebratingKeys.has(`goal:${goal.id}`)}
                    onToggleComplete={() => handleToggleGoal(goal)}
                  />
                ))}
              </div>
            </>
          ) : (
            <MissingGoalNotice
              title={t('reflection.missingThreeMonthGoalTitle')}
              body={t('reflection.missingThreeMonthGoalBody')}
              buttonLabel={t('reflection.findThreeMonthGoal')}
              onClick={onNavigateToGoals}
            />
          )}
        </section>
      </GoalCheckSection>

      <GoalCheckSection delaySeconds={3}>
        <div className="mt-10 flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
          <TertiaryButton onClick={hasCompletedThreeMonthGoalInCheck ? handleContinue : onNavigateToGoals} className="self-start sm:self-auto">
            {hasCompletedThreeMonthGoalInCheck ? t('reflection.continue') : t('reflection.changeGoals')}
          </TertiaryButton>
          <SecondaryButton onClick={hasCompletedThreeMonthGoalInCheck ? onNavigateToGoals : handleContinue} className="w-full sm:w-auto">
            {hasCompletedThreeMonthGoalInCheck ? t('reflection.findNewGoals') : t('reflection.continue')}
          </SecondaryButton>
        </div>
      </GoalCheckSection>
    </div>
  );
};

const ReflectionDonePanel: React.FC<{ onNavigateToLookback: () => void }> = ({ onNavigateToLookback }) => {
  const { t } = useI18n();

  return (
    <>
      <GoalCheckFadeStyles />
      <div
        className="flex min-h-full flex-col items-center justify-center px-4 text-center text-black opacity-0 dark:text-neutral-100"
        style={{ animation: 'reflection-goal-check-fade-in 1s ease-out forwards' }}
      >
        <h2 className="mb-4 text-4xl font-black tracking-tighter uppercase">{t('reflection.allCaughtUp')}</h2>
        <p className="mb-8 max-w-md text-neutral-500 dark:text-neutral-400">
          {t('reflection.noCompleted')}
        </p>
        <PrimaryButton onClick={onNavigateToLookback}>
          {t('reflection.viewLookback')}
        </PrimaryButton>
      </div>
    </>
  );
};

interface ActiveReflectionPanelProps {
  tasks: Task[];
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
  projectNameById: Map<string, string>;
  onEvaluate: (taskId: string, value: ReflectionValue) => void;
  onCompleteGoal: (id: string) => void;
  onUndoCompleteGoal: (id: string) => void;
  onCompleteWeeklyGoal: (id: string) => void;
  onUndoCompleteWeeklyGoal: (id: string) => void;
  onDefineWeeklyGoal: (title: string) => string | null;
  onUpdateWeeklyGoal: (id: string, title: string) => void;
  onClearOpenWeeklyGoal: () => void;
  onNavigateToGoals: () => void;
  onNavigateToLookback: () => void;
}

const ActiveReflectionPanel: React.FC<ActiveReflectionPanelProps> = ({
  tasks,
  goals,
  weeklyGoals,
  projectNameById,
  onEvaluate,
  onCompleteGoal,
  onUndoCompleteGoal,
  onCompleteWeeklyGoal,
  onUndoCompleteWeeklyGoal,
  onDefineWeeklyGoal,
  onUpdateWeeklyGoal,
  onClearOpenWeeklyGoal,
  onNavigateToGoals,
  onNavigateToLookback,
}) => {
  const { t } = useI18n();
  const unreflectedTasks = tasks.filter(t => t.isDone && t.reflectionValue === ReflectionValue.Unreflected);
  const evaluationTimerRef = useRef<number | null>(null);

  // Keep track of the initial count for the progress bar
  const [initialCount, setInitialCount] = useState(unreflectedTasks.length);
  const [animatingValue, setAnimatingValue] = useState<ReflectionValue | null>(null);
  const [isFinishingReflection, setIsFinishingReflection] = useState(false);
  const [hasReflectedInSession, setHasReflectedInSession] = useState(false);
  const [hasDismissedGoalCheck, setHasDismissedGoalCheck] = useState(false);
  const currentTask = unreflectedTasks[0];

  useEffect(() => () => {
    if (evaluationTimerRef.current != null) {
      window.clearTimeout(evaluationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (unreflectedTasks.length > initialCount) {
      setInitialCount(unreflectedTasks.length);
    }
  }, [initialCount, unreflectedTasks.length]);

  const triggerScore = (val: ReflectionValue) => {
    if (!currentTask || animatingValue !== null) return;

    const isLastReflectionTask = unreflectedTasks.length === 1;
    setAnimatingValue(val);
    setIsFinishingReflection(isLastReflectionTask);

    evaluationTimerRef.current = window.setTimeout(() => {
      onEvaluate(currentTask.id, val);
      setHasReflectedInSession(true);
      setHasDismissedGoalCheck(false);
      setIsFinishingReflection(false);
      setAnimatingValue(null);
      evaluationTimerRef.current = null;
    }, isLastReflectionTask ? 1000 : 300);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (animatingValue !== null || unreflectedTasks.length === 0) return;

      if (e.key === '1') triggerScore(ReflectionValue.NotUseful);
      if (e.key === '2') triggerScore(ReflectionValue.SomewhatUseful);
      if (e.key === '3') triggerScore(ReflectionValue.Useful);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [animatingValue, unreflectedTasks]);

  if (unreflectedTasks.length === 0) {
    if (!hasReflectedInSession || hasDismissedGoalCheck) {
      return <ReflectionDonePanel onNavigateToLookback={onNavigateToLookback} />;
    }

    return (
      <ReflectionGoalCheckPanel
        goals={goals}
        weeklyGoals={weeklyGoals}
        onCompleteGoal={onCompleteGoal}
        onUndoCompleteGoal={onUndoCompleteGoal}
        onCompleteWeeklyGoal={onCompleteWeeklyGoal}
        onUndoCompleteWeeklyGoal={onUndoCompleteWeeklyGoal}
        onDefineWeeklyGoal={onDefineWeeklyGoal}
        onUpdateWeeklyGoal={onUpdateWeeklyGoal}
        onClearOpenWeeklyGoal={onClearOpenWeeklyGoal}
        onContinue={() => setHasDismissedGoalCheck(true)}
        onNavigateToGoals={onNavigateToGoals}
      />
    );
  }

  // Since tasks are removed from unreflectedTasks when evaluated, the current task is always the first one.
  const currentIndex = initialCount - unreflectedTasks.length;
  const projectName = getProjectName(currentTask.projectId, projectNameById, t('reflection.noProject'));

  return (
    <div className={`flex min-h-full flex-col max-w-4xl mx-auto px-1 text-black transition-opacity duration-1000 ease-out dark:text-neutral-100 ${
      isFinishingReflection ? 'opacity-0' : 'opacity-100'
    }`}>
      <div className="flex-1 flex flex-col justify-center max-w-2xl w-full mx-auto">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-bold text-neutral-400 dark:text-neutral-500 tracking-widest uppercase">
            {t('reflection.progress', { current: currentIndex + 1, total: initialCount })}
          </span>
          {projectName && (
            <span className="text-xs font-bold px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 tracking-widest uppercase">
              {projectName}
            </span>
          )}
        </div>

        <h1 className="text-5xl md:text-6xl font-black mb-16 leading-tight tracking-tighter">
          {currentTask.title}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => triggerScore(ReflectionValue.NotUseful)}
            className={`flex flex-col items-center p-8 border transition-all group duration-200
              ${animatingValue === ReflectionValue.NotUseful
                ? 'bg-black dark:bg-white text-white dark:text-black scale-95 border-black dark:border-white'
                : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'}`}
          >
            <span className="text-2xl font-black mb-2">1</span>
            <span className={`font-bold uppercase tracking-wider text-sm
              ${animatingValue === ReflectionValue.NotUseful
                ? 'text-white dark:text-black'
                : 'text-neutral-500 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white'}`}>{t('reflection.notUseful')}</span>
          </button>

          <button
            onClick={() => triggerScore(ReflectionValue.SomewhatUseful)}
            className={`flex flex-col items-center p-8 border transition-all group duration-200
              ${animatingValue === ReflectionValue.SomewhatUseful
                ? 'bg-black dark:bg-white text-white dark:text-black scale-95 border-black dark:border-white'
                : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'}`}
          >
            <span className="text-2xl font-black mb-2">2</span>
            <span className={`font-bold uppercase tracking-wider text-sm
              ${animatingValue === ReflectionValue.SomewhatUseful
                ? 'text-white dark:text-black'
                : 'text-neutral-500 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white'}`}>{t('reflection.somewhat')}</span>
          </button>

          <button
            onClick={() => triggerScore(ReflectionValue.Useful)}
            className={`flex flex-col items-center p-8 border border-neutral-200 dark:border-neutral-700 transition-all group duration-200
              ${animatingValue === ReflectionValue.Useful
                ? 'bg-black dark:bg-white text-white dark:text-black scale-95'
                : 'hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'}`}
          >
            <span className="text-2xl font-black mb-2">3</span>
            <span className={`font-bold uppercase tracking-wider text-sm
              ${animatingValue === ReflectionValue.Useful
                ? 'text-white dark:text-black'
                : 'group-hover:text-white dark:group-hover:text-black'}`}>{t('reflection.useful')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ReflectionHistoryPanelProps {
  tasks: Task[];
  projectNameById: Map<string, string>;
  onEvaluate: (taskId: string, value: ReflectionValue) => void;
}

const ReflectionHistoryPanel: React.FC<ReflectionHistoryPanelProps> = ({ tasks, projectNameById, onEvaluate }) => {
  const { language, t } = useI18n();
  const historyGroups = useMemo<ReflectionHistoryGroup[]>(() => {
    const grouped = new Map<string, ReflectionHistoryGroup>();

    const reflectedTasks = tasks
      .filter(t => t.isDone && t.reflectionValue !== ReflectionValue.Unreflected)
      .map(task => ({
        task,
        projectName: getProjectName(task.projectId, projectNameById, t('reflection.noProject')),
        timestamp: getTaskHistoryTimestamp(task),
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    reflectedTasks.forEach(item => {
      const group = getReflectionHistoryGroup(item.timestamp, language);
      const existing = grouped.get(group.key);

      if (existing) {
        existing.items.push(item);
        return;
      }

      grouped.set(group.key, {
        key: group.key,
        label: group.label,
        order: group.order,
        items: [item],
      });
    });

    return Array.from(grouped.values()).sort((a, b) => b.order - a.order);
  }, [language, projectNameById, t, tasks]);

  if (historyGroups.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 text-center animate-in fade-in duration-500 text-black dark:text-neutral-100">
        <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase">{t('reflection.noHistory')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
          {t('reflection.noHistoryBody')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="mb-10 border-b border-neutral-200 dark:border-neutral-700 pb-4">
        <h2 className="text-4xl font-black tracking-tighter uppercase">{t('reflection.historyTitle')}</h2>
        <p className="mt-3 text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {t('reflection.historyBody')}
        </p>
      </div>

      {historyGroups.map(group => (
        <section key={group.key} className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
              {group.label}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              {t('reflection.tasksCount', {
                count: group.items.length,
                taskLabel: t(group.items.length === 1 ? 'reflection.taskSingular' : 'reflection.taskPlural'),
              })}
            </span>
          </div>

          <div className="border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm ">
            {group.items.map(item => (
              <div
                key={item.task.id}
                className="flex flex-col gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 dark:border-neutral-800 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold leading-tight text-black dark:text-neutral-100">
                    {item.task.title}
                  </h4>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                    {item.projectName}
                  </div>
                </div>

                <div className="w-full md:w-56 shrink-0">
                  <select
                    value={item.task.reflectionValue}
                    onChange={(e) => onEvaluate(item.task.id, Number(e.target.value) as ReflectionValue)}
                    className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 font-bold text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                    aria-label={t('reflection.scoreAria', { title: item.task.title })}
                  >
                    {REFLECTION_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export const ReflectionView: React.FC<ReflectionViewProps> = ({
  tasks,
  projects,
  goals,
  weeklyGoals,
  generalGoal,
  onEvaluate,
  onCompleteGoal,
  onUndoCompleteGoal,
  onCompleteWeeklyGoal,
  onUndoCompleteWeeklyGoal,
  onDefineWeeklyGoal,
  onUpdateWeeklyGoal,
  onClearOpenWeeklyGoal,
  onNavigateToGoals,
  onNavigateToLookback,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ReflectionTab>('active');

  const projectNameById = useMemo(
    () => new Map(projects.map(project => [project.id, project.name])),
    [projects]
  );
  const activeWeeklyGoal = weeklyGoals.find(goal => goal.completedAt == null) ?? null;
  const activeThreeMonthGoals = goals
    .filter(goal => goal.completedAt == null && goal.isFocused)
    .sort(sortVisibleThreeMonthGoals);
  const hasReflectionGoalHeader = Boolean(activeWeeklyGoal) || activeThreeMonthGoals.length > 0;

  return (
    <div className="flex h-full w-full flex-row animate-in slide-in-from-bottom-8 duration-500 text-black dark:text-neutral-100 bg-transparent">
      <ReflectionNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'active' ? (
            <ActiveReflectionPanel
              tasks={tasks}
              goals={goals}
              weeklyGoals={weeklyGoals}
              projectNameById={projectNameById}
              onEvaluate={onEvaluate}
              onCompleteGoal={onCompleteGoal}
              onUndoCompleteGoal={onUndoCompleteGoal}
              onCompleteWeeklyGoal={onCompleteWeeklyGoal}
              onUndoCompleteWeeklyGoal={onUndoCompleteWeeklyGoal}
              onDefineWeeklyGoal={onDefineWeeklyGoal}
              onUpdateWeeklyGoal={onUpdateWeeklyGoal}
              onClearOpenWeeklyGoal={onClearOpenWeeklyGoal}
              onNavigateToGoals={onNavigateToGoals}
              onNavigateToLookback={onNavigateToLookback}
            />
          ) : (
            <ReflectionHistoryPanel
              tasks={tasks}
              projectNameById={projectNameById}
              onEvaluate={onEvaluate}
            />
          )}
        </div>

        {hasReflectionGoalHeader && (
          <div className="mt-8 max-h-[calc(25%_-_2rem)] shrink-0 overflow-y-auto border-t border-neutral-200 pt-4 pr-2 dark:border-neutral-800">
            {activeWeeklyGoal && (
              <div className="mb-4 last:mb-0">
                <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500">
                  {t('goals.weeklyTitle')}
                </div>
                <div className="max-w-2xl text-sm font-bold leading-snug text-neutral-500 dark:text-neutral-400">
                  {activeWeeklyGoal.title}
                </div>
              </div>
            )}
            {activeThreeMonthGoals.length > 0 && (
              <div className="mb-4 last:mb-0">
                <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500">
                  {t('goals.activeTitle')}
                </div>
                <div className="space-y-1">
                  {activeThreeMonthGoals.map(goal => (
                    <div key={goal.id} className="max-w-2xl text-sm font-bold leading-snug text-neutral-500 dark:text-neutral-400">
                      {goal.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
