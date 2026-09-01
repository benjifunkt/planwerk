import type { AutofillMode, DayColumnId, MaxHoursByDay, Task } from '../types';
import { getOrderedDayColumnIds } from '../constants';
import { compareTasksByPriorityScore } from './scoreUtils';

export interface AutofillAssignment {
  taskId: string;
  day: DayColumnId;
  orderIndex: number;
}

interface DayFillState {
  day: DayColumnId;
  remaining: number;
  nextOrderIndex: number;
}

const getUsedPlannedMinutes = (tasks: Task[], day: DayColumnId): number => (
  tasks
    .filter(task => task.status === day)
    .reduce((sum, task) => sum + task.duration, 0)
);

const getNextOrderIndex = (tasks: Task[], day: DayColumnId): number => {
  const maxOrderIndex = tasks
    .filter(task => task.status === day)
    .reduce((max, task) => Math.max(max, task.orderIndex), -1);

  return maxOrderIndex + 1;
};

export const createAutofillTargetDays = (
  visibleDays: DayColumnId[],
  todayDayIndex: number,
  autofillMode: AutofillMode,
  weekStartDay: DayColumnId = 'mon'
): DayColumnId[] => {
  const nativeDayIds: DayColumnId[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const fullWeek = getOrderedDayColumnIds(weekStartDay);
  const orderedDays = fullWeek.filter(day => visibleDays.includes(day));

  if (autofillMode === 'full-week') return orderedDays;

  const today = nativeDayIds[todayDayIndex] || weekStartDay;
  const todayOffset = fullWeek.indexOf(today);
  const remainingWeekDays = orderedDays.filter(day => fullWeek.indexOf(day) >= todayOffset);
  return remainingWeekDays.length > 0 ? remainingWeekDays : orderedDays;
};

export const createAutofillAssignments = (
  tasks: Task[],
  targetDays: DayColumnId[],
  maxHoursPerDayByDay: MaxHoursByDay
): AutofillAssignment[] => {
  const remainingTasks = tasks
    .filter(task => task.status === 'backlog' && !task.isDone);

  const dayStates: DayFillState[] = targetDays.map(day => ({
    day,
    remaining: Math.max(0, maxHoursPerDayByDay[day] * 60 - getUsedPlannedMinutes(tasks, day)),
    nextOrderIndex: getNextOrderIndex(tasks, day),
  }));

  const assignments: AutofillAssignment[] = [];

  for (const dayState of dayStates) {
    remainingTasks.sort(compareTasksByPriorityScore);
    let fittingTaskIndex = remainingTasks.findIndex(task => task.duration <= dayState.remaining);

    while (fittingTaskIndex !== -1) {
      const [task] = remainingTasks.splice(fittingTaskIndex, 1);
      assignments.push({
        taskId: task.id,
        day: dayState.day,
        orderIndex: dayState.nextOrderIndex,
      });

      dayState.remaining -= task.duration;
      dayState.nextOrderIndex += 1;
      fittingTaskIndex = remainingTasks.findIndex(candidate => candidate.duration <= dayState.remaining);
    }
  }

  return assignments;
};
