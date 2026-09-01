import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ColumnView } from './ColumnView';
import { COLUMNS, DEFAULT_VISIBLE_DAYS, getOrderedDayColumnIds } from '../constants';
import { Task, Project, ColumnId, DayColumnId, MaxHoursByDay, WeeklyGoal, ColumnSortMode } from '../types';
import { getDayLabelKey, useI18n } from '../i18n';
import { getNextColumnSortMode, INITIAL_COLUMN_SORT_MODE } from '../utils/taskSortUtils';
import type { PendingTaskMove } from '../utils/taskColumnTransitions';

interface BoardProps {
  tasks: Task[];
  projects: Project[];
  visibleDays?: DayColumnId[];
  weekStartDay?: DayColumnId;
  maxHoursPerDayByDay: MaxHoursByDay;
  maxTaskCapacityMinutes: number;
  onDropTask: (taskId: string, targetCol: ColumnId, targetIndex?: number) => void;
  onToggleDone: (taskId: string, isDone: boolean) => void;
  onEditTask: (task: Task) => void;
  onAddTaskClick: (colId: ColumnId) => void;
  onSortColumn: (colId: ColumnId, mode: ColumnSortMode) => void;
  pendingTaskMoves?: Record<string, PendingTaskMove>;
  backlogPinned?: boolean;
  onToggleBacklogPin?: () => void;
  activeWeeklyGoal?: WeeklyGoal | null;
  onNavigateToGoals?: () => void;
}

const DAY_COLUMN_BY_NATIVE_DAY: Record<number, DayColumnId> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

const createInitialSortModes = (): Record<ColumnId, ColumnSortMode> => ({
  backlog: INITIAL_COLUMN_SORT_MODE,
  mon: INITIAL_COLUMN_SORT_MODE,
  tue: INITIAL_COLUMN_SORT_MODE,
  wed: INITIAL_COLUMN_SORT_MODE,
  thu: INITIAL_COLUMN_SORT_MODE,
  fri: INITIAL_COLUMN_SORT_MODE,
  sat: INITIAL_COLUMN_SORT_MODE,
  sun: INITIAL_COLUMN_SORT_MODE,
  done: INITIAL_COLUMN_SORT_MODE,
});

const BoardComponent: React.FC<BoardProps> = ({ 
  tasks, 
  projects, 
  visibleDays = DEFAULT_VISIBLE_DAYS,
  weekStartDay = 'mon',
  maxHoursPerDayByDay,
  maxTaskCapacityMinutes,
  onDropTask, 
  onToggleDone, 
  onEditTask, 
  onAddTaskClick, 
  onSortColumn,
  pendingTaskMoves = {},
  backlogPinned = false,
  onToggleBacklogPin,
  activeWeeklyGoal,
  onNavigateToGoals
}) => {
  const { t } = useI18n();
  const boardRef = useRef<HTMLDivElement>(null);
  const backlogColumnRef = useRef<HTMLDivElement>(null);
  const currentDayColumnRef = useRef<HTMLDivElement>(null);
  const currentDayId = DAY_COLUMN_BY_NATIVE_DAY[new Date().getDay()];
  const visibleDaysKey = visibleDays.join(',');
  const [nextSortModes, setNextSortModes] = useState<Record<ColumnId, ColumnSortMode>>(createInitialSortModes);
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const getColumnTitle = (id: ColumnId) => {
    if (id === 'backlog') return t('column.backlog');
    if (id === 'done') return t('column.done');
    return t(getDayLabelKey(id as DayColumnId));
  };
  const handleSortColumn = useCallback((colId: ColumnId, mode: ColumnSortMode) => {
    onSortColumn(colId, mode);
    setNextSortModes(prev => ({
      ...prev,
      [colId]: getNextColumnSortMode(mode),
    }));
  }, [onSortColumn]);
  const handleDropTask = useCallback((taskId: string, targetCol: ColumnId, targetIndex?: number) => {
    const sourceCol = tasks.find(task => task.id === taskId)?.status;
    onDropTask(taskId, targetCol, targetIndex);
    setNextSortModes(prev => ({
      ...prev,
      ...(sourceCol ? { [sourceCol]: INITIAL_COLUMN_SORT_MODE } : {}),
      [targetCol]: INITIAL_COLUMN_SORT_MODE,
    }));
  }, [onDropTask, tasks]);
  const orderedDayIds = getOrderedDayColumnIds(weekStartDay);
  const orderedColumns = [
    COLUMNS.find(column => column.id === 'backlog')!,
    ...orderedDayIds
      .filter(day => visibleDays.includes(day))
      .map(day => COLUMNS.find(column => column.id === day)!),
    COLUMNS.find(column => column.id === 'done')!,
  ];
  const alignCurrentDay = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;

    const currentDayColumn = currentDayColumnRef.current;
    if (!currentDayColumn) {
      board.scrollLeft = 0;
      return;
    }

    const maxScrollLeft = Math.max(0, board.scrollWidth - board.clientWidth);
    const boardLeft = board.getBoundingClientRect().left;
    const currentDayLeft = currentDayColumn.getBoundingClientRect().left - boardLeft + board.scrollLeft;
    const pinnedBacklogWidth = backlogPinned
      ? (backlogColumnRef.current?.getBoundingClientRect().width ?? 0)
      : 0;
    const targetScrollLeft = currentDayLeft - pinnedBacklogWidth;

    board.scrollLeft = Math.min(maxScrollLeft, Math.max(0, targetScrollLeft));
  }, [backlogPinned]);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    let frameId = window.requestAnimationFrame(alignCurrentDay);
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(alignCurrentDay);
    });
    const handleWindowFocus = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(alignCurrentDay);
    };

    resizeObserver.observe(board);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [alignCurrentDay, currentDayId, visibleDaysKey, weekStartDay]);

  return (
    <div ref={boardRef} className="flex h-full overflow-x-auto overflow-y-hidden w-full items-stretch pb-4">
      {orderedColumns.map(col => {
        let colTasks = tasks.filter(t => t.status === col.id);
        if (col.id === 'done') {
          colTasks = colTasks.filter(t => {
            const time = t.completedAt || t.updatedAt;
            return time > twoWeeksAgo;
          });
        }
        colTasks = colTasks.sort((a, b) => a.orderIndex - b.orderIndex);

        return (
          <ColumnView
            key={col.id}
            id={col.id}
            title={getColumnTitle(col.id)}
            isDay={col.isDay}
            tasks={colTasks}
            projects={projects}
            maxHoursPerDayByDay={maxHoursPerDayByDay}
            maxTaskCapacityMinutes={maxTaskCapacityMinutes}
            onDropTask={handleDropTask}
            onToggleDone={onToggleDone}
            onEditTask={onEditTask}
            onAddTaskClick={onAddTaskClick}
            onSortColumn={handleSortColumn}
            nextSortMode={nextSortModes[col.id]}
            pendingTaskMoves={pendingTaskMoves}
            isPinned={col.id === 'backlog' ? backlogPinned : false}
            onTogglePin={col.id === 'backlog' ? onToggleBacklogPin : undefined}
            activeWeeklyGoal={col.id === 'backlog' ? activeWeeklyGoal : undefined}
            onNavigateToGoals={col.id === 'backlog' ? onNavigateToGoals : undefined}
            columnRef={col.id === 'backlog' ? backlogColumnRef : col.id === currentDayId ? currentDayColumnRef : undefined}
          />
        );
      })}
    </div>
  );
};

export const Board = React.memo(BoardComponent);
