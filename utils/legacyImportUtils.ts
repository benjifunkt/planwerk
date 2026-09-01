import { DAY_COLUMN_IDS } from '../constants';
import { calculateInitialNextGenDate } from './dateUtils';
import { normalizeGoals, normalizeWeeklyGoals } from './goalNormalization';
import {
  ColumnId,
  DayColumnId,
  Goal,
  Priority,
  Project,
  RecurringTemplate,
  RecurrenceType,
  ReflectionValue,
  Task,
  WeeklyGoal,
} from '../types';

export interface LegacyImportData {
  tasks: Task[];
  projects: Project[];
  templates: RecurringTemplate[];
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
}

export const LEGACY_IMPORT_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const LEGACY_IMPORT_LIMITS = {
  tasks: 10000,
  projects: 2000,
  templates: 2000,
  goals: 5000,
  weeklyGoals: 5000,
  generalGoalCharacters: 5000,
};

const generateId = () => Math.random().toString(36).substring(2, 9);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isColumnId = (value: unknown): value is ColumnId => (
  value === 'backlog' || value === 'done' || (typeof value === 'string' && DAY_COLUMN_IDS.includes(value as DayColumnId))
);

const isPriority = (value: unknown): value is Priority => (
  typeof value === 'number' && Number.isInteger(value) && value >= Priority.Marginal && value <= Priority.Critical
);

const isReflectionValue = (value: unknown): value is ReflectionValue => (
  typeof value === 'number' && Number.isInteger(value) && value >= ReflectionValue.Unreflected && value <= ReflectionValue.Useful
);

const isRecurrenceType = (value: unknown): value is RecurrenceType => (
  value === 'daily' || value === 'weekly' || value === 'biweekly' || value === 'monthly'
);

const isTimestamp = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const normalizeNullableString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value : null
);

const normalizeImportedTask = (value: unknown, index: number, now: number): Task | null => {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title) return null;

  const isDone = typeof value.isDone === 'boolean' ? value.isDone : false;
  const status = isColumnId(value.status) ? value.status : (isDone ? 'done' : 'backlog');

  return {
    id: `task_${generateId()}`,
    title,
    duration: typeof value.duration === 'number' && Number.isFinite(value.duration) && value.duration > 0
      ? Math.round(value.duration)
      : 60,
    dueDate: typeof value.dueDate === 'string' && value.dueDate ? value.dueDate : null,
    priority: isPriority(value.priority) ? value.priority : Priority.Important,
    projectId: normalizeNullableString(value.projectId),
    status,
    isDone,
    reflectionValue: isReflectionValue(value.reflectionValue) ? value.reflectionValue : ReflectionValue.Unreflected,
    createdAt: now + index,
    updatedAt: now + index,
    completedAt: isTimestamp(value.completedAt) ? value.completedAt : null,
    reflectedAt: isTimestamp(value.reflectedAt) ? value.reflectedAt : null,
    orderIndex: isTimestamp(value.orderIndex) ? value.orderIndex : index,
  };
};

const normalizeImportedProject = (value: unknown): Project | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!id || !name) return null;
  return { id, name };
};

const normalizeImportedTemplate = (value: unknown): RecurringTemplate | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!id || !title) return null;

  const recurrenceType = isRecurrenceType(value.recurrenceType) ? value.recurrenceType : 'weekly';
  const dayOfWeek = typeof value.dayOfWeek === 'number' && Number.isInteger(value.dayOfWeek) && value.dayOfWeek >= 0 && value.dayOfWeek <= 6
    ? value.dayOfWeek
    : 1;
  const dayOfMonth = typeof value.dayOfMonth === 'number' && Number.isInteger(value.dayOfMonth) && value.dayOfMonth >= 1 && value.dayOfMonth <= 31
    ? value.dayOfMonth
    : 1;
  const timeOfDay = typeof value.timeOfDay === 'string' && /^\d{2}:\d{2}$/.test(value.timeOfDay)
    ? value.timeOfDay
    : '09:00';

  return {
    id,
    title,
    duration: typeof value.duration === 'number' && Number.isFinite(value.duration) && value.duration > 0
      ? Math.round(value.duration)
      : 30,
    priority: isPriority(value.priority) ? value.priority : Priority.Important,
    projectId: normalizeNullableString(value.projectId),
    recurrenceType,
    dayOfWeek,
    dayOfMonth,
    timeOfDay,
    dueDateOffsetDays: typeof value.dueDateOffsetDays === 'number' && Number.isInteger(value.dueDateOffsetDays)
      ? value.dueDateOffsetDays
      : null,
    nextGenerationDate: isTimestamp(value.nextGenerationDate)
      ? value.nextGenerationDate
      : calculateInitialNextGenDate(recurrenceType, dayOfWeek, dayOfMonth, timeOfDay),
  };
};

export const keepNewIds = <T extends { id: string }>(existingItems: T[], importedItems: T[]): T[] => {
  const existingIds = new Set(existingItems.map(item => item.id));
  return importedItems.filter(item => !existingIds.has(item.id));
};

const getBoundedLegacyArray = (value: unknown, limit: number): unknown[] | null => {
  if (!Array.isArray(value)) return [];
  return value.length <= limit ? value : null;
};

const getLegacyGoalLineCount = (value: string): number => (
  value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).length
);

export const parseLegacyImportData = (parsed: unknown): LegacyImportData | null => {
  if (!isRecord(parsed)) return null;

  const analytics = isRecord(parsed.analytics) ? parsed.analytics : null;
  const now = Date.now();
  const legacyGeneralGoal = typeof parsed.generalGoal === 'string'
    ? parsed.generalGoal
    : (typeof analytics?.generalGoal === 'string' ? analytics.generalGoal : '');
  const tasks = getBoundedLegacyArray(parsed.tasks, LEGACY_IMPORT_LIMITS.tasks);
  const projects = getBoundedLegacyArray(parsed.projects, LEGACY_IMPORT_LIMITS.projects);
  const templates = getBoundedLegacyArray(parsed.templates, LEGACY_IMPORT_LIMITS.templates);
  const goalSource = parsed.goals ?? analytics?.goals;
  const weeklyGoalSource = parsed.weeklyGoals ?? analytics?.weeklyGoals;
  const goals = getBoundedLegacyArray(goalSource, LEGACY_IMPORT_LIMITS.goals);
  const weeklyGoals = getBoundedLegacyArray(weeklyGoalSource, LEGACY_IMPORT_LIMITS.weeklyGoals);

  if (!tasks || !projects || !templates || !goals || !weeklyGoals) return null;
  if (legacyGeneralGoal.length > LEGACY_IMPORT_LIMITS.generalGoalCharacters) return null;
  if (!Array.isArray(goalSource) && getLegacyGoalLineCount(legacyGeneralGoal) > LEGACY_IMPORT_LIMITS.goals) return null;

  return {
    tasks: tasks
      .map((task, index) => normalizeImportedTask(task, index, now))
      .filter((task): task is Task => task != null),
    projects: projects
      .map(normalizeImportedProject)
      .filter((project): project is Project => project != null),
    templates: templates
      .map(normalizeImportedTemplate)
      .filter((template): template is RecurringTemplate => template != null),
    goals: normalizeGoals(Array.isArray(goalSource) ? goals : goalSource, legacyGeneralGoal),
    weeklyGoals: normalizeWeeklyGoals(Array.isArray(weeklyGoalSource) ? weeklyGoals : weeklyGoalSource),
  };
};
