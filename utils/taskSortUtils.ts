import { ColumnSortMode, SortDirection, Task } from '../types';
import { compareTasksByPriorityScore } from './scoreUtils';

export const INITIAL_COLUMN_SORT_MODE: ColumnSortMode = 'score-desc';

const COLUMN_SORT_CYCLE: readonly ColumnSortMode[] = [
  'score-desc',
  'date-asc',
  'score-asc',
  'date-desc',
];

export const getNextColumnSortMode = (mode: ColumnSortMode): ColumnSortMode => {
  const currentIndex = COLUMN_SORT_CYCLE.indexOf(mode);
  return COLUMN_SORT_CYCLE[(currentIndex + 1) % COLUMN_SORT_CYCLE.length];
};

const getDueDateTimestamp = (dueDate: string | null): number | null => {
  if (!dueDate) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
};

export const compareTasksByDueDate = (
  a: Task,
  b: Task,
  direction: SortDirection = 'asc'
): number => {
  const dateA = getDueDateTimestamp(a.dueDate);
  const dateB = getDueDateTimestamp(b.dueDate);

  if (dateA == null || dateB == null) {
    if (dateA == null && dateB == null) return a.orderIndex - b.orderIndex;
    if (direction === 'asc') return dateA == null ? 1 : -1;
    return dateA == null ? -1 : 1;
  }

  if (dateA !== dateB) {
    return direction === 'asc' ? dateA - dateB : dateB - dateA;
  }

  return a.orderIndex - b.orderIndex;
};

export const compareTasksByColumnSortMode = (a: Task, b: Task, mode: ColumnSortMode): number => {
  switch (mode) {
    case 'date-asc':
      return compareTasksByDueDate(a, b, 'asc');
    case 'score-asc':
      return compareTasksByPriorityScore(a, b, 'asc');
    case 'date-desc':
      return compareTasksByDueDate(a, b, 'desc');
    case 'score-desc':
    default:
      return compareTasksByPriorityScore(a, b, 'desc');
  }
};
