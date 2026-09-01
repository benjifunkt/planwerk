import { DayColumnId, RecurrenceType } from '../types';
import { getDayColumnOffset } from '../constants';
import type { ResolvedLanguage } from '../i18n';

const getLocale = (language: ResolvedLanguage = 'en') => (
  language === 'de' ? 'de-DE' : 'en-US'
);

const dateText: Record<ResolvedLanguage, Record<string, string>> = {
  en: {
    overdue: 'Overdue',
    today: 'Today',
    tomorrow: 'Tomorrow',
    nextWeek: 'Next week',
    thisMonth: 'This month',
    nextMonth: 'Next month',
    thisQuarter: 'This quarter',
    nextQuarter: 'Next quarter',
    future: 'Far in the future',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    lastWeek: 'Last Week',
  },
  de: {
    overdue: 'Überfällig',
    today: 'Heute',
    tomorrow: 'Morgen',
    nextWeek: 'Nächste Woche',
    thisMonth: 'Diesen Monat',
    nextMonth: 'Nächsten Monat',
    thisQuarter: 'Dieses Quartal',
    nextQuarter: 'Nächstes Quartal',
    future: 'Weit in der Zukunft',
    yesterday: 'Gestern',
    thisWeek: 'Diese Woche',
    lastWeek: 'Letzte Woche',
  },
};

const getStartOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getStartOfWeek = (date: Date): Date => {
  const normalized = getStartOfDay(date);
  const day = normalized.getDay(); // 0 = Sunday, 1 = Monday
  const diff = normalized.getDate() - day + (day === 0 ? -6 : 1);
  normalized.setDate(diff);
  return normalized;
};

const getStartOfMonth = (date: Date): Date => (
  new Date(date.getFullYear(), date.getMonth(), 1)
);

const formatLocalISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getLocalISODateWithOffset = (offsetDays: number, baseDate: Date = new Date()): string => {
  const date = getStartOfDay(baseDate);
  date.setDate(date.getDate() + offsetDays);
  return formatLocalISODate(date);
};

const nativeDayIndexes: Record<DayColumnId, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export const getCurrentWeekDayColumnISO = (
  day: DayColumnId,
  baseDate: Date = new Date(),
  weekStartDay: DayColumnId = 'mon'
): string => {
  const weekStart = getStartOfDay(baseDate);
  const daysSinceWeekStart = (weekStart.getDay() - nativeDayIndexes[weekStartDay] + 7) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceWeekStart + getDayColumnOffset(day, weekStartDay));
  return formatLocalISODate(weekStart);
};

export const formatMinutes = (mins: number, language: ResolvedLanguage = 'en'): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (language === 'de') {
    if (h > 0 && m > 0) return `${h} Std. ${m} Min.`;
    if (h > 0) return `${h} Std.`;
    return `${m} Min.`;
  }
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

export const formatCompactHourMinutes = (mins: number, prefix = ''): string => {
  const normalizedMinutes = Math.max(0, Math.round(mins));
  const h = Math.floor(normalizedMinutes / 60);
  const m = normalizedMinutes % 60;
  return `${prefix}${h}h ${m}m`;
};

export const getWeekString = (dateTs: number): string => {
  const d = new Date(dateTs);
  d.setHours(0, 0, 0, 0);
  // Simple week string format: YYYY-Www
  const startDate = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil(days / 7);
  return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
};

export const getTodayISO = (): string => {
  return formatLocalISODate(new Date());
};

export const getRelativeDueDateText = (dueDateStr: string | null, language: ResolvedLanguage = 'en'): string | null => {
  if (!dueDateStr) return null;
  const today = getStartOfDay(new Date());
  const text = dateText[language];

  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return text.overdue;
  if (diffDays === 0) return text.today;
  if (diffDays === 1) return text.tomorrow;

  const shortWeekday = new Intl.DateTimeFormat(getLocale(language), { weekday: 'short' }).format(dueDate);

  const currentWeekStart = getStartOfWeek(today);
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const twoWeeksStart = new Date(nextWeekStart);
  twoWeeksStart.setDate(twoWeeksStart.getDate() + 7);

  const isThisWeek = dueDate >= currentWeekStart && dueDate < nextWeekStart;

  if (isThisWeek || diffDays <= 7) {
    return shortWeekday;
  }

  const isNextWeek = dueDate >= nextWeekStart && dueDate < twoWeeksStart;
  if (isNextWeek) {
    return text.nextWeek;
  }

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const twoMonthsStart = new Date(today.getFullYear(), today.getMonth() + 2, 1);

  if (dueDate >= currentMonthStart && dueDate < nextMonthStart) return text.thisMonth;
  if (dueDate >= nextMonthStart && dueDate < twoMonthsStart) return text.nextMonth;

  const currentQuarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const nextQuarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 1);
  const twoQuartersStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 6, 1);

  if (dueDate >= currentQuarterStart && dueDate < nextQuarterStart) return text.thisQuarter;
  if (dueDate >= nextQuarterStart && dueDate < twoQuartersStart) return text.nextQuarter;

  return text.future;
};

export const getReflectionHistoryGroup = (
  dateTs: number,
  language: ResolvedLanguage = 'en',
  nowTs: number = Date.now()
) => {
  const targetDayStart = getStartOfDay(new Date(dateTs));
  const todayStart = getStartOfDay(new Date(nowTs));
  const text = dateText[language];

  if (targetDayStart.getTime() === todayStart.getTime()) {
    return { key: 'today', label: text.today, order: Number.MAX_SAFE_INTEGER };
  }

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (targetDayStart.getTime() === yesterdayStart.getTime()) {
    return { key: 'yesterday', label: text.yesterday, order: Number.MAX_SAFE_INTEGER - 1 };
  }

  const currentWeekStart = getStartOfWeek(todayStart);
  if (targetDayStart >= currentWeekStart) {
    return { key: 'this-week', label: text.thisWeek, order: Number.MAX_SAFE_INTEGER - 2 };
  }

  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  if (targetDayStart >= lastWeekStart) {
    return { key: 'last-week', label: text.lastWeek, order: Number.MAX_SAFE_INTEGER - 3 };
  }

  const monthStart = getStartOfMonth(targetDayStart);
  const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat(getLocale(language), { month: 'long', year: 'numeric' }).format(monthStart);

  return {
    key: `month-${monthKey}`,
    label: monthLabel,
    order: monthStart.getTime(),
  };
};

export const calculateInitialNextGenDate = (
  type: RecurrenceType,
  dayOfWeek: number = 1,
  dayOfMonth: number = 1,
  timeOfDay: string = "09:00"
): number => {
  const d = new Date();
  const [h, m] = timeOfDay.split(':').map(Number);
  d.setHours(h, m, 0, 0);

  // If the time today has already passed, start checking from tomorrow
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }

  while (true) {
    if (type === 'daily') break;
    if ((type === 'weekly' || type === 'biweekly') && d.getDay() === dayOfWeek) break;
    if (type === 'monthly') {
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(dayOfMonth, lastDay);
      if (d.getDate() === targetDay) break;
    }
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
};
