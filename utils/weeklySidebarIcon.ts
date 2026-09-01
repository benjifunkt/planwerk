import type { DayColumnId, MaxHoursByDay, Task } from '../types';

export interface WeeklySidebarIconBar {
  day: DayColumnId;
  totalMinutes: number;
  doneMinutes: number;
  heightPercent: number;
  donePercent: number;
}

interface BuildWeeklySidebarIconBarsInput {
  tasks: Task[];
  visibleDays: DayColumnId[];
  maxHoursPerDayByDay: MaxHoursByDay;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getTaskMinutes = (task: Task) => Math.max(0, task.duration || 0);

export const buildWeeklySidebarIconBars = ({
  tasks,
  visibleDays,
  maxHoursPerDayByDay,
}: BuildWeeklySidebarIconBarsInput): WeeklySidebarIconBar[] => {
  const visibleDaySet = new Set<DayColumnId>(visibleDays);
  const visibleTasks = tasks.filter(task => visibleDaySet.has(task.status as DayColumnId));
  if (visibleTasks.length === 0) return [];

  const dayTotals = visibleDays.map(day => {
    const dayTasks = visibleTasks.filter(task => task.status === day);
    const totalMinutes = dayTasks.reduce((sum, task) => sum + getTaskMinutes(task), 0);
    const doneMinutes = dayTasks
      .filter(task => task.isDone)
      .reduce((sum, task) => sum + getTaskMinutes(task), 0);

    return { day, totalMinutes, doneMinutes };
  });

  const referenceMinutes = Math.max(
    ...dayTotals.map(({ day, totalMinutes }) => (
      Math.max((maxHoursPerDayByDay[day] || 0) * 60, totalMinutes)
    ))
  );

  return dayTotals.map(({ day, totalMinutes, doneMinutes }) => ({
    day,
    totalMinutes,
    doneMinutes,
    heightPercent: referenceMinutes > 0 ? clampPercent((totalMinutes / referenceMinutes) * 100) : 0,
    donePercent: totalMinutes > 0 ? clampPercent((doneMinutes / totalMinutes) * 100) : 0,
  }));
};
