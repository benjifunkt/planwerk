import React, { useMemo } from 'react';
import { Goal, WeeklyGoal } from '../types';
import { useI18n } from '../i18n';
import { IconCheck, IconTrash } from './Icons';

export type DoodleParticle = {
  id: number;
  angle: number;
  distance: number;
  delay: number;
  size: number;
  duration: number;
  rot: number;
  type: 'star' | 'plus' | 'circle';
};

interface CompletionButtonProps {
  isCompleted: boolean;
  isCelebrating: boolean;
  title: string;
  ariaLabel: string;
  label: string;
  onClick: () => void;
}

interface GoalDeleteButtonProps {
  onDelete?: () => void;
}

interface ThreeMonthGoalRowProps extends GoalDeleteButtonProps {
  goal: Goal;
  isCelebrating: boolean;
  onToggleComplete: () => void;
  onToggleFocus?: () => void;
  registerElement?: (element: HTMLDivElement | null) => void;
  showFocusStatus?: boolean;
}

interface WeeklyGoalRowProps extends GoalDeleteButtonProps {
  goal: WeeklyGoal;
  isCelebrating: boolean;
  onToggleComplete: () => void;
}

export const useDoodleParticles = () => (
  useMemo<DoodleParticle[]>(() => (
    Array.from({ length: 16 }).map((_, i) => {
      const angle = (i * 360) / 16 + (Math.random() * 15 - 7.5);
      const distance = 80 + Math.random() * 60;
      const delay = Math.random() * 0.12;
      const size = 8 + Math.random() * 10;
      const duration = 0.8 + Math.random() * 0.5;
      const rot = Math.random() * 360;

      return {
        id: i,
        angle,
        distance,
        delay,
        size,
        duration,
        rot,
        type: i % 3 === 0 ? 'star' : i % 3 === 1 ? 'plus' : 'circle',
      };
    })
  ), [])
);

export const GoalDoodleSparkles: React.FC<{ particles: DoodleParticle[] }> = ({ particles }) => (
  <>
    {particles.map((particle) => {
      const rad = (particle.angle * Math.PI) / 180;
      const x = Math.cos(rad) * particle.distance;
      const y = Math.sin(rad) * particle.distance;

      return (
        <div
          key={`doodle-${particle.id}`}
          className="absolute flex items-center justify-center text-black dark:text-white"
          style={{
            '--tx': `${x}px`,
            '--ty': `${y}px`,
            '--rot': `${particle.rot}deg`,
            animation: `doodle-sparkle-fly ${particle.duration}s cubic-bezier(0.15, 0.85, 0.35, 1) ${particle.delay}s both`,
          } as React.CSSProperties}
        >
          {particle.type === 'star' && (
            <svg className="fill-current" width={particle.size} height={particle.size} viewBox="0 0 24 24">
              <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
            </svg>
          )}
          {particle.type === 'plus' && (
            <span className="font-black leading-none" style={{ fontSize: particle.size }}>+</span>
          )}
          {particle.type === 'circle' && (
            <div className="rounded-full bg-current" style={{ width: particle.size / 2, height: particle.size / 2 }} />
          )}
        </div>
      );
    })}
  </>
);

const GoalCompletionButton: React.FC<CompletionButtonProps> = ({
  isCompleted,
  isCelebrating,
  title,
  ariaLabel,
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isCelebrating}
    className={`absolute left-0 top-0 bottom-0 z-10 overflow-hidden flex items-center justify-start border-r transition-all duration-300 ease-out select-none cursor-pointer focus:outline-none ${isCompleted
      ? 'w-[68px] border-black bg-black text-white hover:bg-white hover:text-black dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-900 dark:hover:text-white'
      : isCelebrating
        ? 'w-[68px] border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
        : 'w-max max-w-[68px] hover:max-w-[220px] group/btn border-neutral-300 text-neutral-300 hover:border-black hover:bg-black hover:text-white dark:border-neutral-700 dark:hover:border-white dark:hover:bg-white dark:hover:text-black'
    }`}
    title={title}
    aria-label={ariaLabel}
  >
    <div className="flex items-center h-full gap-2 shrink-0">
      <div className="flex items-center justify-center w-[66px] shrink-0">
        <IconCheck className="h-4 w-4 shrink-0" />
      </div>
      {!isCompleted && !isCelebrating && (
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 delay-75 whitespace-nowrap pr-6">
          {label}
        </span>
      )}
    </div>
  </button>
);

const GoalDeleteButton: React.FC<Required<GoalDeleteButtonProps>> = ({ onDelete }) => {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onDelete}
      className="flex h-10 w-10 shrink-0 items-center justify-center self-center text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
      title={t('goals.deleteGoal')}
      aria-label={t('goals.deleteGoal')}
    >
      <IconTrash className="h-4 w-4" />
    </button>
  );
};

const GoalSparkleLayer: React.FC<{ isCelebrating: boolean }> = ({ isCelebrating }) => {
  const particles = useDoodleParticles();

  return (
    <div className="absolute left-0 top-0 bottom-0 w-[68px] pointer-events-none z-30 overflow-visible flex items-center justify-center">
      {isCelebrating && <GoalDoodleSparkles particles={particles} />}
    </div>
  );
};

export const ThreeMonthGoalRow: React.FC<ThreeMonthGoalRowProps> = ({
  goal,
  isCelebrating,
  onToggleComplete,
  onToggleFocus,
  onDelete,
  registerElement,
  showFocusStatus = true,
}) => {
  const { t } = useI18n();
  const isCompleted = goal.completedAt != null;
  const canToggleFocus = !isCompleted && Boolean(onToggleFocus);
  const rowClassName = `group relative overflow-hidden flex min-h-[68px] items-stretch gap-3 border-b border-neutral-200 px-3 py-3 transition-colors last:border-b-0 dark:border-neutral-800 ${isCompleted
    ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-950 dark:text-neutral-500'
    : goal.isFocused
      ? 'bg-white text-black hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'
      : 'bg-neutral-50 text-neutral-400 opacity-75 hover:opacity-100 dark:bg-neutral-950 dark:text-neutral-500'
  }`;
  const content = (
    <>
      <h3 className={`font-bold leading-tight ${isCompleted ? 'line-through decoration-2' : ''}`}>
        {goal.title}
      </h3>
      {showFocusStatus && !isCompleted && (
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
          {canToggleFocus ? (
            <>
              <span className="group-hover:hidden group-focus-within:hidden">
                {goal.isFocused ? t('goals.focused') : t('goals.parked')}
              </span>
              <span className="hidden group-hover:inline group-focus-within:inline">
                {goal.isFocused ? t('goals.parkAction') : t('goals.focusAction')}
              </span>
            </>
          ) : (
            <span>
              {goal.isFocused ? t('goals.focused') : t('goals.parked')}
            </span>
          )}
        </div>
      )}
    </>
  );

  return (
    <div ref={registerElement} className={rowClassName}>
      {isCelebrating && (
        <div
          style={{
            animation: 'goal-celebrate-expand 4s cubic-bezier(0.15, 0.85, 0.35, 1) both',
          }}
          className="absolute inset-0 bg-black text-white z-20 flex items-center justify-center font-black text-2xl uppercase tracking-[0.25em] pointer-events-none select-none dark:bg-white dark:text-black"
        >
          {t('goals.doneCelebration')}!
        </div>
      )}

      <div className="w-[60px] shrink-0 self-center" />

      <GoalCompletionButton
        isCompleted={isCompleted}
        isCelebrating={isCelebrating}
        title={isCompleted ? t('goals.undoCompleteGoal') : t('goals.completeGoal')}
        ariaLabel={isCompleted ? t('goals.undoCompleteGoal') : t('goals.completeGoal')}
        label={t('goals.doneCelebration')}
        onClick={onToggleComplete}
      />

      <GoalSparkleLayer isCelebrating={isCelebrating} />

      {canToggleFocus ? (
        <button
          type="button"
          onClick={onToggleFocus}
          className={`min-w-0 flex-1 py-1 text-left focus:outline-none focus-visible:outline-none ${isCompleted ? 'cursor-default' : 'cursor-pointer'}`}
          aria-pressed={goal.isFocused}
        >
          {content}
        </button>
      ) : (
        <div className="min-w-0 flex-1 py-1 text-left">
          {content}
        </div>
      )}

      {onDelete && <GoalDeleteButton onDelete={onDelete} />}
    </div>
  );
};

export const WeeklyGoalRow: React.FC<WeeklyGoalRowProps> = ({
  goal,
  isCelebrating,
  onToggleComplete,
  onDelete,
}) => {
  const { t } = useI18n();
  const isCompleted = goal.completedAt != null;

  return (
    <div className={`group relative overflow-hidden flex min-h-[72px] items-stretch gap-3 border px-3 py-3 shadow-sm  ${isCompleted
      ? 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400'
      : 'border-neutral-200 bg-white text-black dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
    }`}>
      {isCelebrating && (
        <div
          style={{
            animation: 'weekly-goal-celebrate-expand 4s cubic-bezier(0.15, 0.85, 0.35, 1) both',
          }}
          className="absolute inset-0 bg-black text-white z-20 flex items-center justify-center font-black text-2xl uppercase tracking-[0.25em] pointer-events-none select-none dark:bg-white dark:text-black"
        >
          {t('goals.doneCelebration')}!
        </div>
      )}

      <div className="w-[60px] shrink-0 self-center" />

      <GoalCompletionButton
        isCompleted={isCompleted}
        isCelebrating={isCelebrating}
        title={isCompleted ? t('goals.undoCompleteGoal') : t('goals.completeWeeklyGoal')}
        ariaLabel={isCompleted ? t('goals.undoCompleteGoal') : t('goals.completeWeeklyGoal')}
        label={t('goals.doneCelebration')}
        onClick={onToggleComplete}
      />

      <GoalSparkleLayer isCelebrating={isCelebrating} />

      <div className="min-w-0 flex-1 py-1 flex flex-col justify-center">
        <h4 className={`font-bold leading-tight ${isCompleted ? 'line-through decoration-2' : ''}`}>
          {goal.title}
        </h4>
      </div>

      {onDelete && <GoalDeleteButton onDelete={onDelete} />}
    </div>
  );
};
