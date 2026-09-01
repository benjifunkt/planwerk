import type { ColumnId, Task } from '../types';

export type TaskTerminalColumn = Extract<ColumnId, 'backlog' | 'done'>;

export interface PendingTaskMove {
  targetColumn: TaskTerminalColumn;
  remainingSeconds: number;
}

export const getTaskToggleMoveTarget = (
  task: Pick<Task, 'status'>,
  isDone: boolean,
): TaskTerminalColumn | null => {
  if (task.status === 'backlog' && isDone) return 'done';
  if (task.status === 'done' && !isDone) return 'backlog';
  return null;
};

export const isPendingTaskMoveValid = (
  task: Pick<Task, 'status' | 'isDone'>,
  targetColumn: TaskTerminalColumn,
): boolean => (
  targetColumn === 'done'
    ? task.status === 'backlog' && task.isDone
    : task.status === 'done' && !task.isDone
);

export const applyTaskColumnTransition = (
  task: Task,
  targetColumn: ColumnId,
  updatedAt: number,
): Task => {
  const terminalState = targetColumn === 'done'
    ? {
        isDone: true,
        completedAt: task.isDone && task.completedAt != null ? task.completedAt : updatedAt,
      }
    : targetColumn === 'backlog'
      ? { isDone: false, completedAt: null }
      : {};

  return {
    ...task,
    status: targetColumn,
    updatedAt,
    ...terminalState,
  };
};
