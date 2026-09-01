import React, { useState } from 'react';
import { ColumnId, DayColumnId, MaxHoursByDay, Task, Project, WeeklyGoal, ColumnSortMode } from '../types';
import { TaskCard } from './TaskCard';
import { IconPin, IconPlus } from './Icons';
import { useI18n } from '../i18n';
import { formatCompactHourMinutes } from '../utils/dateUtils';
import type { PendingTaskMove } from '../utils/taskColumnTransitions';

interface ColumnViewProps {
  id: ColumnId;
  title: string;
  isDay: boolean;
  tasks: Task[];
  projects: Project[];
  maxHoursPerDayByDay: MaxHoursByDay;
  maxTaskCapacityMinutes: number;
  onDropTask: (taskId: string, targetCol: ColumnId, targetIndex?: number) => void;
  onToggleDone: (taskId: string, isDone: boolean) => void;
  onEditTask: (task: Task) => void;
  onAddTaskClick: (colId: ColumnId) => void;
  onSortColumn: (columnId: ColumnId, mode: ColumnSortMode) => void;
  nextSortMode: ColumnSortMode;
  pendingTaskMoves?: Record<string, PendingTaskMove>;
  isPinned?: boolean;
  onTogglePin?: () => void;
  activeWeeklyGoal?: WeeklyGoal | null;
  onNavigateToGoals?: () => void;
  columnRef?: React.Ref<HTMLDivElement>;
}

const getWeeklyGoalPreview = (title: string) => (
  title.length > 200 ? title.slice(0, 200).trimEnd() + '...' : title
);

const ColumnViewComponent: React.FC<ColumnViewProps> = ({
  id,
  title,
  isDay,
  tasks,
  projects,
  maxHoursPerDayByDay,
  maxTaskCapacityMinutes,
  onDropTask,
  onToggleDone,
  onEditTask,
  onAddTaskClick,
  onSortColumn,
  nextSortMode,
  pendingTaskMoves = {},
  isPinned = false,
  onTogglePin,
  activeWeeklyGoal,
  onNavigateToGoals,
  columnRef
}) => {
  const { t } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const computeInsertionIndex = (container: Element, clientY: number): number => {
    const cards = Array.from(container.querySelectorAll('[data-task-card]')) as HTMLElement[];
    let targetIndex = tasks.length;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      if (clientY < middle) {
        targetIndex = i;
        break;
      }
    }
    return targetIndex;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
    // Compute and update the insertion index for the visual indicator
    const insertIdx = computeInsertionIndex(e.currentTarget, e.clientY);
    setDragOverIndex(insertIdx);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if actually leaving the column (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragOverIndex(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      const targetIndex = computeInsertionIndex(e.currentTarget, e.clientY);
      onDropTask(taskId, id, targetIndex);
    }
  };
  const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onSortColumn(id, nextSortMode);
  };

  // Calculate capacities for header display and progress bar
  const openTasks = tasks.filter(t => !t.isDone);
  const openMinutes = openTasks.reduce((sum, t) => sum + t.duration, 0);
  const plannedMinutes = tasks.reduce((sum, t) => sum + t.duration, 0);
  const maxCapacityMinutes = isDay ? maxHoursPerDayByDay[id as DayColumnId] * 60 : 0;
  const overCapacityMinutes = Math.max(0, plannedMinutes - maxCapacityMinutes);
  const effectiveCapacityMinutes = Math.max(maxCapacityMinutes, plannedMinutes);
  const shouldShowOpenMinutes = openMinutes > 0 && openMinutes < plannedMinutes;
  const isOverCapacity = isDay && plannedMinutes > maxCapacityMinutes;
  const capacityPct = isDay && effectiveCapacityMinutes > 0
    ? Math.min(100, (openMinutes / effectiveCapacityMinutes) * 100)
    : 0;

  const todayIndex = new Date().getDay();
  const dayIdMap: Record<number, string> = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 0: 'sun' };
  const isCurrentDay = id === dayIdMap[todayIndex];

  const getProjectName = (pid: string | null) => projects.find(p => p.id === pid)?.name;
  const weeklyGoalPreview = activeWeeklyGoal ? getWeeklyGoalPreview(activeWeeklyGoal.title) : '';
  const isScoreSort = nextSortMode.startsWith('score');
  const isUpSort = nextSortMode === 'score-desc' || nextSortMode === 'date-asc';
  const sortCriterion = t(isScoreSort ? 'column.sortCriterionScore' : 'column.sortCriterionDate');
  const sortLabel = (() => {
    switch (nextSortMode) {
      case 'date-asc':
        return t('column.sortDateAsc', { title });
      case 'score-asc':
        return t('column.sortScoreAsc', { title });
      case 'date-desc':
        return t('column.sortDateDesc', { title });
      case 'score-desc':
      default:
        return t('column.sortScoreDesc', { title });
    }
  })();

  return (
    <div
      ref={columnRef}
      className={`flex flex-col flex-1 min-w-[280px] border-r border-neutral-200 dark:border-neutral-800 shrink-0 ${isPinned ? 'sticky left-0 z-20 bg-white dark:bg-neutral-900' : isDragOver ? 'bg-neutral-100 dark:bg-neutral-800' : isCurrentDay ? 'bg-neutral-100/40 dark:bg-neutral-800/40' : 'bg-transparent'} transition-colors duration-200`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="h-20 px-4 pt-2 pb-3 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-inherit z-10 transition-colors duration-200 flex flex-col justify-between cursor-pointer group"
        onClick={() => onSortColumn(id, nextSortMode)}
        onKeyDown={handleHeaderKeyDown}
        role="button"
        tabIndex={0}
        title={sortLabel}
        aria-label={sortLabel}
      >
        <div className="flex justify-between items-baseline min-h-[28px]">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="text-xl font-black tracking-tighter uppercase">{title}</h2>
            <span className="pointer-events-none text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              {t('column.sortHint', { criterion: sortCriterion, arrow: isUpSort ? '▲' : '▼' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onTogglePin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
                className={`p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-none transition-all ${isPinned ? 'opacity-100 text-black dark:text-white' : 'opacity-0 group-hover:opacity-100 text-neutral-400'}`}
                title={isPinned ? t('column.unpin') : t('column.pin')}
              >
                <IconPin className="w-4 h-4" filled={isPinned} />
              </button>
            )}
          </div>
        </div>

        {isDay ? (
          <div className="relative">
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex items-end justify-between text-[10px] font-bold leading-none">
              <span className="text-neutral-500 dark:text-neutral-400">
                {shouldShowOpenMinutes ? formatCompactHourMinutes(openMinutes) : ''}
              </span>
              <span className={`flex flex-col items-end gap-1 ${isOverCapacity ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                <span>{formatCompactHourMinutes(plannedMinutes)}</span>
                {overCapacityMinutes > 0 && (
                  <span className="text-[8px]">
                    <span className="text-[6px]">▲</span>{formatCompactHourMinutes(overCapacityMinutes)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden shrink-0 mt-2">
              <div
                className={`h-full transition-all duration-500 ${isOverCapacity ? 'bg-red-600 dark:bg-red-500' : 'bg-black dark:bg-white'}`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="h-1.5 w-full bg-transparent shrink-0 mt-2" />
        )}
      </div>

      <div className="flex-1 p-3 overflow-y-auto overflow-x-hidden flex flex-col">
        {id === 'backlog' && activeWeeklyGoal && (
          <div className="-mx-3 -mt-3 mb-4 flex flex-col shrink-0">
            <button
              onClick={onNavigateToGoals}
              title={activeWeeklyGoal.title}
              className="text-left w-full relative flex flex-col px-4 py-3 bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/20 text-black dark:text-neutral-100 cursor-pointer transition-colors duration-150 select-none border-0 rounded-none focus:outline-none"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500 mb-1">
                {t('goals.weeklyTitle')}
              </div>
              <h4 className="font-bold text-sm text-black dark:text-neutral-100 leading-tight">
                {weeklyGoalPreview}
              </h4>
            </button>
            <div className="border-b border-neutral-200 dark:border-neutral-800 shrink-0" />
          </div>
        )}

        {tasks.map((task, idx) => (
          <React.Fragment key={task.id}>
            {isDragOver && dragOverIndex === idx && (
              <div className="h-0.5 bg-black dark:bg-white mx-0 -mt-[2px] -mb-[-10px] relative z-10 transition-all duration-150 shrink-0" />
            )}
            <div data-task-card className="shrink-0">
              <TaskCard
                task={task}
                onToggleDone={onToggleDone}
                onEditTask={onEditTask}
                projectName={getProjectName(task.projectId)}
                maxTaskCapacityMinutes={maxTaskCapacityMinutes}
                pendingMove={pendingTaskMoves[task.id]}
              />
            </div>
          </React.Fragment>
        ))}
        {/* Indicator at end of list */}
        {isDragOver && dragOverIndex === tasks.length && tasks.length > 0 && (
          <div className="h-0.5 bg-black dark:bg-white mx-0 -mt-[2px] -mb-[-10px] relative z-10 transition-all duration-150 shrink-0" />
        )}

        {tasks.length === 0 ? (
          <button
            onClick={() => onAddTaskClick(id)}
            className="group mt-4 flex w-full cursor-pointer items-center justify-center gap-2 border border-neutral-200 bg-white/40 p-8 text-sm font-medium text-neutral-400 transition-colors hover:border-neutral-300 hover:bg-white hover:text-black dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-600 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-white"
          >
            <IconPlus className="h-4 w-4" />
            <span className="group-hover:hidden">{t('column.dropHere')}</span>
            <span className="hidden group-hover:inline">{t('column.addHere')}</span>
          </button>
        ) : (
          <button
            onClick={() => onAddTaskClick(id)}
            className="mt-2 flex w-full items-center justify-center gap-2 border border-transparent py-3 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-colors hover:border-neutral-200 hover:bg-white/60 hover:text-black dark:text-neutral-500 dark:hover:border-neutral-800 dark:hover:bg-neutral-900/50 dark:hover:text-white"
          >
            <IconPlus className="h-4 w-4" />
            {t('column.addTask')}
          </button>
        )}
      </div>
    </div>
  );
};

export const ColumnView = React.memo(ColumnViewComponent);
