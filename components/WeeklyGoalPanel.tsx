import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WeeklyGoal } from '../types';
import { useI18n } from '../i18n';
import { IconCheck } from './Icons';
import { TertiaryButton } from './Buttons';
import { GoalDoodleSparkles, WeeklyGoalRow, useDoodleParticles } from './GoalRows';

interface WeeklyGoalPanelProps {
  openGoalCount: number;
  weeklyGoals: WeeklyGoal[];
  onDefineWeeklyGoal: (title: string) => string | null;
  onUpdateWeeklyGoal: (id: string, title: string) => void;
  onClearOpenWeeklyGoal: () => void;
  onCompleteWeeklyGoal: (id: string) => void;
  onDeleteWeeklyGoal?: (id: string) => void;
  onUndoCompleteWeeklyGoal: (id: string) => void;
  showWhenIdle?: boolean;
  completedWeeklyGoalId?: string | null;
  canStartNewWeeklyGoal?: boolean;
  onCompletedWeeklyGoalIdChange?: (id: string | null) => void;
  onCanStartNewWeeklyGoalChange?: (canStart: boolean) => void;
}

export const WeeklyGoalPanel: React.FC<WeeklyGoalPanelProps> = ({
  openGoalCount,
  weeklyGoals,
  onDefineWeeklyGoal,
  onUpdateWeeklyGoal,
  onClearOpenWeeklyGoal,
  onCompleteWeeklyGoal,
  onDeleteWeeklyGoal,
  onUndoCompleteWeeklyGoal,
  showWhenIdle = true,
  completedWeeklyGoalId: controlledCompletedWeeklyGoalId,
  canStartNewWeeklyGoal: controlledCanStartNewWeeklyGoal,
  onCompletedWeeklyGoalIdChange,
  onCanStartNewWeeklyGoalChange,
}) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompletingWeeklyGoalRef = useRef(false);
  const revealNewGoalTimerRef = useRef<number | null>(null);
  const savedFeedbackTimerRef = useRef<number | null>(null);
  const activeWeeklyGoal = useMemo(
    () => weeklyGoals.find(goal => goal.completedAt == null) ?? null,
    [weeklyGoals]
  );
  const initialShouldShowWeeklyComposerRef = useRef(openGoalCount > 0 || Boolean(activeWeeklyGoal));
  const previousOpenGoalCountRef = useRef(openGoalCount);
  const [draftTitle, setDraftTitle] = useState(() => activeWeeklyGoal?.title ?? '');
  const [showWeeklyComposer, setShowWeeklyComposer] = useState(() => initialShouldShowWeeklyComposerRef.current);
  const [internalCompletedWeeklyGoalId, setInternalCompletedWeeklyGoalId] = useState<string | null>(null);
  const [internalCanStartNewWeeklyGoal, setInternalCanStartNewWeeklyGoal] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const doodleParticles = useDoodleParticles();
  const completedWeeklyGoalId = controlledCompletedWeeklyGoalId !== undefined
    ? controlledCompletedWeeklyGoalId
    : internalCompletedWeeklyGoalId;
  const canStartNewWeeklyGoal = controlledCanStartNewWeeklyGoal !== undefined
    ? controlledCanStartNewWeeklyGoal
    : internalCanStartNewWeeklyGoal;
  const completedWeeklyGoal = useMemo(
    () => completedWeeklyGoalId
      ? weeklyGoals.find(goal => goal.id === completedWeeklyGoalId && goal.completedAt != null) ?? null
      : null,
    [completedWeeklyGoalId, weeklyGoals]
  );

  const setCompletedWeeklyGoalId = (id: string | null) => {
    setInternalCompletedWeeklyGoalId(id);
    onCompletedWeeklyGoalIdChange?.(id);
  };

  const setCanStartNewWeeklyGoal = (canStart: boolean) => {
    setInternalCanStartNewWeeklyGoal(canStart);
    onCanStartNewWeeklyGoalChange?.(canStart);
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);

  useEffect(() => {
    const previousOpenGoalCount = previousOpenGoalCountRef.current;
    if (showWhenIdle && !activeWeeklyGoal && !initialShouldShowWeeklyComposerRef.current && openGoalCount >= 3 && previousOpenGoalCount < 3) {
      setShouldAnimate(true);
      setShowWeeklyComposer(true);
    }
    previousOpenGoalCountRef.current = openGoalCount;
  }, [activeWeeklyGoal, openGoalCount, showWhenIdle]);

  useEffect(() => {
    if (!showWeeklyComposer) return;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [showWeeklyComposer]);

  useEffect(() => () => {
    if (revealNewGoalTimerRef.current != null) {
      window.clearTimeout(revealNewGoalTimerRef.current);
    }
    if (savedFeedbackTimerRef.current != null) {
      window.clearTimeout(savedFeedbackTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (activeWeeklyGoal) {
      setDraftTitle(activeWeeklyGoal.title);
      setShowWeeklyComposer(false);
      setCompletedWeeklyGoalId(null);
      setCanStartNewWeeklyGoal(false);
    }
  }, [activeWeeklyGoal]);

  const showSavedGoalFeedback = () => {
    setShowSavedFeedback(true);
    if (savedFeedbackTimerRef.current != null) {
      window.clearTimeout(savedFeedbackTimerRef.current);
    }
    savedFeedbackTimerRef.current = window.setTimeout(() => {
      setShowSavedFeedback(false);
      savedFeedbackTimerRef.current = null;
    }, 1800);
  };

  const saveWeeklyGoalDraft = (): boolean => {
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      if (activeWeeklyGoal) onClearOpenWeeklyGoal();
      return false;
    }

    if (activeWeeklyGoal) {
      if (trimmedTitle !== activeWeeklyGoal.title) onUpdateWeeklyGoal(activeWeeklyGoal.id, trimmedTitle);
      showSavedGoalFeedback();
      return true;
    }

    const goalId = onDefineWeeklyGoal(trimmedTitle);
    if (!goalId) return false;

    showSavedGoalFeedback();
    return true;
  };

  const handleWeeklyGoalBlur = () => {
    if (isCompletingWeeklyGoalRef.current) return;
    saveWeeklyGoalDraft();
  };

  const handleWeeklyGoalKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    saveWeeklyGoalDraft();
  };

  const handleCompleteWeeklyGoal = () => {
    try {
      const trimmedTitle = draftTitle.trim();
      if (!activeWeeklyGoal && !trimmedTitle) return;

      const goalId = activeWeeklyGoal?.id ?? onDefineWeeklyGoal(trimmedTitle);
      if (!goalId) return;

      onCompleteWeeklyGoal(goalId);
      setIsCelebrating(true);

      if (revealNewGoalTimerRef.current != null) {
        window.clearTimeout(revealNewGoalTimerRef.current);
      }
      revealNewGoalTimerRef.current = window.setTimeout(() => {
        setCompletedWeeklyGoalId(goalId);
        setCanStartNewWeeklyGoal(true);
        setIsCelebrating(false);
        revealNewGoalTimerRef.current = null;
      }, 4000);
    } finally {
      isCompletingWeeklyGoalRef.current = false;
    }
  };

  const onStartNewWeeklyGoal = () => {
    setCompletedWeeklyGoalId(null);
    setCanStartNewWeeklyGoal(false);
    setDraftTitle('');
    setShowWeeklyComposer(true);
  };

  const shouldRender = (showWhenIdle && initialShouldShowWeeklyComposerRef.current) || Boolean(activeWeeklyGoal) || Boolean(completedWeeklyGoal) || showWeeklyComposer;
  const canCompleteWeeklyGoal = Boolean(draftTitle.trim());

  useEffect(() => {
    if (!shouldRender) {
      setAnimationFinished(false);
      setShouldAnimate(false);
    }
  }, [shouldRender]);

  useLayoutEffect(() => {
    if (!shouldRender || !shouldAnimate || animationFinished || !panelRef.current) return;

    const element = panelRef.current;
    const fullHeight = element.scrollHeight;

    const animation = element.animate(
      [
        { height: '0px', opacity: 0 },
        { height: `${fullHeight}px`, opacity: 1 }
      ],
      {
        duration: 1000,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'both'
      }
    );

    animation.onfinish = () => {
      setAnimationFinished(true);
      setShouldAnimate(false);
    };
  }, [shouldRender, shouldAnimate, animationFinished]);

  if (!shouldRender) return null;

  return (
    <div
      ref={panelRef}
      style={
        shouldAnimate && !animationFinished
          ? { overflow: 'hidden', height: 0, opacity: 0 }
          : undefined
      }
    >
      <section className="mb-10">
        <div className="mb-3 flex items-baseline gap-3">
          <h3 className="block text-xl font-black tracking-tighter uppercase">
            {t('goals.weeklyTitle')}
          </h3>
          {showSavedFeedback && (
            <span className="text-[11px] font-semibold lowercase text-neutral-400 dark:text-neutral-500">
              {t('goals.saved')}
            </span>
          )}
        </div>

        {completedWeeklyGoal ? (
          <>
            <WeeklyGoalRow
              goal={completedWeeklyGoal}
              isCelebrating={false}
              onToggleComplete={() => onUndoCompleteWeeklyGoal(completedWeeklyGoal.id)}
              onDelete={onDeleteWeeklyGoal ? () => onDeleteWeeklyGoal(completedWeeklyGoal.id) : undefined}
            />

            {canStartNewWeeklyGoal && (
              <TertiaryButton
                type="button"
                onClick={onStartNewWeeklyGoal}
                className="mt-3"
              >
                {t('goals.defineNewWeeklyGoal')}
              </TertiaryButton>
            )}
          </>
        ) : (
          <div className={`group relative overflow-hidden flex min-h-[72px] items-stretch gap-3 border px-3 py-3 shadow-sm  ${activeWeeklyGoal || showWeeklyComposer
              ? 'border-neutral-200 bg-white text-black dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
              : 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400'
            }`}>
            {isCelebrating && (
              <div
                style={{
                  animation: 'weekly-goal-celebrate-expand 4s cubic-bezier(0.15, 0.85, 0.35, 1) both',
                }}
                className="absolute inset-0 bg-black dark:bg-white text-white dark:text-black z-20 flex items-center justify-center font-black text-2xl uppercase tracking-[0.25em] pointer-events-none select-none"
              >
                {t('goals.doneCelebration')}!
              </div>
            )}

            <div className="w-[60px] shrink-0 self-center" />

            <button
              type="button"
              onMouseDown={() => {
                isCompletingWeeklyGoalRef.current = true;
              }}
              onClick={handleCompleteWeeklyGoal}
              disabled={!canCompleteWeeklyGoal || isCelebrating}
              className={`absolute left-0 top-0 bottom-0 z-10 overflow-hidden flex items-center justify-start border-r transition-all duration-300 ease-out select-none focus:outline-none ${
                !canCompleteWeeklyGoal
                  ? 'w-[68px] cursor-not-allowed border-neutral-200 text-neutral-300 dark:border-neutral-800 dark:text-neutral-700 pointer-events-none'
                  : isCelebrating
                    ? 'w-[68px] border-black bg-black text-white dark:border-white dark:bg-white dark:text-black cursor-default'
                    : 'w-max max-w-[68px] hover:max-w-[220px] group/btn border-neutral-300 text-neutral-300 hover:border-black hover:bg-black hover:text-white dark:border-neutral-700 dark:hover:border-white dark:hover:bg-white dark:hover:text-black cursor-pointer'
              }`}
              title={t('goals.completeWeeklyGoal')}
              aria-label={t('goals.completeWeeklyGoal')}
            >
              <div className="flex items-center h-full gap-2 shrink-0">
                <div className="flex items-center justify-center w-[66px] shrink-0">
                  <IconCheck className="h-4 w-4 shrink-0" />
                </div>
                {!isCelebrating && (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 delay-75 whitespace-nowrap pr-6">
                    {t('goals.doneCelebration')}
                  </span>
                )}
              </div>
            </button>

            <div className="absolute left-0 top-0 bottom-0 w-[68px] pointer-events-none z-30 overflow-visible flex items-center justify-center">
              {isCelebrating && (
                <GoalDoodleSparkles particles={doodleParticles} />
              )}
            </div>

            <div className="min-w-0 flex-1 py-1">
              <input
                ref={inputRef}
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={handleWeeklyGoalBlur}
                onKeyDown={handleWeeklyGoalKeyDown}
                placeholder={t('goals.weeklyPlaceholder')}
                className="w-full border-0 border-b border-neutral-300 bg-transparent px-0 py-1 font-bold leading-tight text-black transition-colors placeholder:text-neutral-400 focus:outline-none focus:border-black dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-white"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
