import { ColumnId, DayColumnId, MaxHoursByDay } from './types';

export const DEFAULT_MAX_HOURS_PER_DAY = 4;
export const DAILY_CAPACITY_MINUTES = DEFAULT_MAX_HOURS_PER_DAY * 60;
export const PIXELS_PER_MINUTE = 4;
export const MIN_TASK_CARD_DURATION_MINUTES = 22;
export const DAY_COLUMN_IDS: DayColumnId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DEFAULT_VISIBLE_DAYS: DayColumnId[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
export const DAY_COLUMN_LABELS: Record<DayColumnId, string> = {
  mon: 'MON',
  tue: 'TUE',
  wed: 'WED',
  thu: 'THU',
  fri: 'FRI',
  sat: 'SAT',
  sun: 'SUN',
};
export const DAY_COLUMN_ORDER: Record<DayColumnId, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

export const getOrderedDayColumnIds = (weekStartDay: DayColumnId = 'mon'): DayColumnId[] => {
  const startIndex = DAY_COLUMN_IDS.indexOf(weekStartDay);
  const normalizedStartIndex = startIndex >= 0 ? startIndex : 0;
  return [
    ...DAY_COLUMN_IDS.slice(normalizedStartIndex),
    ...DAY_COLUMN_IDS.slice(0, normalizedStartIndex),
  ];
};

export const getDayColumnOffset = (day: DayColumnId, weekStartDay: DayColumnId = 'mon'): number => (
  getOrderedDayColumnIds(weekStartDay).indexOf(day)
);

export const createDefaultMaxHoursByDay = (): MaxHoursByDay => ({
  mon: DEFAULT_MAX_HOURS_PER_DAY,
  tue: DEFAULT_MAX_HOURS_PER_DAY,
  wed: DEFAULT_MAX_HOURS_PER_DAY,
  thu: DEFAULT_MAX_HOURS_PER_DAY,
  fri: DEFAULT_MAX_HOURS_PER_DAY,
  sat: 0,
  sun: 0,
});

export const COLUMNS: { id: ColumnId; title: string; isDay: boolean }[] = [
  { id: 'backlog', title: 'BACKLOG', isDay: false },
  { id: 'mon', title: 'MON', isDay: true },
  { id: 'tue', title: 'TUE', isDay: true },
  { id: 'wed', title: 'WED', isDay: true },
  { id: 'thu', title: 'THU', isDay: true },
  { id: 'fri', title: 'FRI', isDay: true },
  { id: 'sat', title: 'SAT', isDay: true },
  { id: 'sun', title: 'SUN', isDay: true },
  { id: 'done', title: 'DONE', isDay: false },
];
