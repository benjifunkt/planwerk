import type { Task } from '../types';

const isUsableTimestamp = (value: number | null | undefined): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const earliestTimestamp = (timestamps: number[]): number | null => (
  timestamps.length > 0 ? Math.min(...timestamps) : null
);

const getBestKnownTaskTimestamp = (task: Task): number | null => {
  if (isUsableTimestamp(task.reflectedAt)) return task.reflectedAt;
  if (isUsableTimestamp(task.completedAt)) return task.completedAt;
  if (isUsableTimestamp(task.updatedAt)) return task.updatedAt;
  return isUsableTimestamp(task.createdAt) ? task.createdAt : null;
};

export const deriveLegacyFirstReflectionAt = (tasks: Task[]): number | null => {
  const reflectedAt = earliestTimestamp(
    tasks
      .filter(task => task.reflectionValue !== 0 || isUsableTimestamp(task.reflectedAt))
      .map(getBestKnownTaskTimestamp)
      .filter(isUsableTimestamp)
  );
  if (reflectedAt !== null) return reflectedAt;

  return earliestTimestamp(
    tasks
      .filter(task => task.isDone)
      .map(getBestKnownTaskTimestamp)
      .filter(isUsableTimestamp)
  );
};

export const resolveFirstReflectionAt = (
  storedFirstReflectionAt: number | null | undefined,
  hasStoredFirstReflectionAt: boolean,
  tasks: Task[]
): number | null => (
  hasStoredFirstReflectionAt
    ? storedFirstReflectionAt ?? null
    : deriveLegacyFirstReflectionAt(tasks)
);

export const recordTaskReflection = (
  tasks: Task[],
  firstReflectionAt: number | null,
  taskId: string,
  value: Task['reflectionValue'],
  now: number
): { tasks: Task[]; firstReflectionAt: number | null } => {
  const task = tasks.find(item => item.id === taskId);
  if (!task) return { tasks, firstReflectionAt };

  return {
    firstReflectionAt: firstReflectionAt ?? task.reflectedAt ?? now,
    tasks: tasks.map(item => item.id === taskId
      ? {
        ...item,
        reflectionValue: value,
        reflectedAt: item.reflectedAt ?? now,
        updatedAt: now,
      }
      : item),
  };
};
