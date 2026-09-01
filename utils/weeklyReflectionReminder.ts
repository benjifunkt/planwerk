import { getDayColumnOffset } from '../constants';
import { DayColumnId, OnboardingState, ReflectionValue, Task } from '../types';

interface WeeklyReflectionReminderContext {
  tasks: Task[];
  visibleDays: DayColumnId[];
  weekStartDay: DayColumnId;
  onboarding: OnboardingState;
  now?: Date;
}

interface TaskCompletionReminderContext extends WeeklyReflectionReminderContext {
  completedTaskId: string;
}

const NATIVE_DAY_BY_COLUMN: Record<DayColumnId, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const startOfConfiguredWeek = (now: Date, weekStartDay: DayColumnId) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const daysSinceStart = (start.getDay() - NATIVE_DAY_BY_COLUMN[weekStartDay] + 7) % 7;
  start.setDate(start.getDate() - daysSinceStart);
  return start;
};

export const isAtOrAfterLastVisibleWeekDay = (
  visibleDays: DayColumnId[],
  weekStartDay: DayColumnId,
  now: Date = new Date()
) => {
  if (visibleDays.length === 0) return false;

  const currentOffset = (now.getDay() - NATIVE_DAY_BY_COLUMN[weekStartDay] + 7) % 7;
  const lastVisibleOffset = Math.max(...visibleDays.map(day => getDayColumnOffset(day, weekStartDay)));
  return currentOffset >= lastVisibleOffset;
};

export const hasCurrentWeekUnreflectedCompletion = (
  tasks: Task[],
  weekStartDay: DayColumnId,
  now: Date = new Date()
) => {
  const weekStart = startOfConfiguredWeek(now, weekStartDay).getTime();
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const weekEnd = nextWeekStart.getTime();

  return tasks.some(task => (
    task.isDone
    && task.reflectionValue === ReflectionValue.Unreflected
    && task.completedAt !== null
    && task.completedAt >= weekStart
    && task.completedAt < weekEnd
  ));
};

export const hasUnreflectedCompletion = (tasks: Task[]) => (
  tasks.some(task => task.isDone && task.reflectionValue === ReflectionValue.Unreflected)
);

export const isAfterLocalCalendarDay = (
  timestamp: number | null | undefined,
  now: Date = new Date()
) => {
  if (timestamp == null || !Number.isFinite(timestamp)) return false;

  const completedDay = new Date(timestamp);
  completedDay.setHours(0, 0, 0, 0);
  const currentDay = new Date(now);
  currentDay.setHours(0, 0, 0, 0);
  return currentDay.getTime() > completedDay.getTime();
};

export const shouldShowWeeklyReflectionReminderAfterCleanup = ({
  tasks,
  visibleDays,
  weekStartDay,
  onboarding,
  now = new Date(),
}: WeeklyReflectionReminderContext) => (
  onboarding.tutorial.cleanup
  && !onboarding.hints.weeklyReflectionReminder.shown
  && isAfterLocalCalendarDay(
    onboarding.hints.weeklyReflectionReminder.cleanupTutorialCompletedAt,
    now
  )
  && hasUnreflectedCompletion(tasks)
);

export const shouldShowWeeklyReflectionReminderAfterTaskCompletion = ({
  tasks,
  visibleDays,
  weekStartDay,
  onboarding,
  completedTaskId,
  now = new Date(),
}: TaskCompletionReminderContext) => {
  const completedTask = tasks.find(task => task.id === completedTaskId);
  if (!completedTask || !completedTask.isDone || !visibleDays.includes(completedTask.status as DayColumnId)) {
    return false;
  }

  return (
    onboarding.tutorial.cleanup
    && !onboarding.hints.weeklyReflectionReminder.shown
    && isAtOrAfterLastVisibleWeekDay(visibleDays, weekStartDay, now)
    && hasCurrentWeekUnreflectedCompletion(tasks, weekStartDay, now)
    && !tasks.some(task => visibleDays.includes(task.status as DayColumnId) && !task.isDone)
  );
};
