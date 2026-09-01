import { Priority, PrioritySortDirection, Task } from '../types';

export const getDeadlineDistanceDays = (dueDateStr: string | null): number | null => {
  if (!dueDateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(dueDateStr);
  if (Number.isNaN(dueDate.getTime())) return null;
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const calculateUrgency = (dueDateStr: string | null): number => {
  if (!dueDateStr) return 1;

  const diffDays = getDeadlineDistanceDays(dueDateStr);
  if (diffDays == null) return 1;

  if (diffDays <= 0) return 9; // Today or overdue
  if (diffDays === 1) return 8; // Tomorrow
  if (diffDays <= 7) return 7; // This week (roughly)
  if (diffDays <= 14) return 6; // Next week
  if (diffDays <= 30) return 5; // This month
  if (diffDays <= 60) return 4; // Next month
  if (diffDays <= 90) return 3; // This quarter
  if (diffDays <= 180) return 2; // Next quarter
  return 1; // Later
};

export const calculatePriorityScore = (priority: Priority, dueDate: string | null): number => {
  const urgency = calculateUrgency(dueDate);
  return priority * urgency;
};

export const compareTasksByPriorityScore = (a: Task, b: Task, direction: PrioritySortDirection = 'desc'): number => {
  const scoreA = calculatePriorityScore(a.priority, a.dueDate);
  const scoreB = calculatePriorityScore(b.priority, b.dueDate);

  if (scoreA !== scoreB) {
    return direction === 'asc' ? scoreA - scoreB : scoreB - scoreA;
  }

  const deadlineA = getDeadlineDistanceDays(a.dueDate);
  const deadlineB = getDeadlineDistanceDays(b.dueDate);
  const hasDeadlineA = deadlineA != null;
  const hasDeadlineB = deadlineB != null;

  if (hasDeadlineA !== hasDeadlineB) {
    const datedFirst = hasDeadlineA ? -1 : 1;
    return direction === 'asc' ? -datedFirst : datedFirst;
  }

  if (deadlineA != null && deadlineB != null && deadlineA !== deadlineB) {
    return direction === 'asc' ? deadlineB - deadlineA : deadlineA - deadlineB;
  }

  return direction === 'asc' ? b.orderIndex - a.orderIndex : a.orderIndex - b.orderIndex;
};

export const getSortedTasks = (tasks: Task[]): Task[] => {
  return [...tasks].sort(compareTasksByPriorityScore);
};
