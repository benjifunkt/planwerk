import { Goal, WeeklyGoal } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 9);

export const getFocusedOpenGoalSummary = (goals: Goal[]): string => (
  goals
    .filter(goal => goal.isFocused && goal.completedAt == null)
    .map(goal => goal.title.trim())
    .filter(Boolean)
    .join('\n')
);

const createLegacyGoals = (generalGoal: string, now: number): Goal[] => (
  generalGoal
    .split(/\r?\n/)
    .map(title => title.trim())
    .filter(Boolean)
    .map((title, index) => ({
      id: `goal_${generateId()}`,
      title,
      isFocused: true,
      createdAt: now + index,
      updatedAt: now + index,
      completedAt: null,
    }))
);

export const normalizeGoals = (goals: unknown, legacyGeneralGoal: string = ''): Goal[] => {
  const now = Date.now();

  if (!Array.isArray(goals)) {
    return createLegacyGoals(legacyGeneralGoal, now);
  }

  return goals.reduce<Goal[]>((acc, goal, index) => {
    if (!goal || typeof goal !== 'object') return acc;
    const candidate = goal as Partial<Goal>;
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    if (!title) return acc;

    const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : now + index;
    const updatedAt = typeof candidate.updatedAt === 'number' ? candidate.updatedAt : createdAt;
    const completedAt = typeof candidate.completedAt === 'number' ? candidate.completedAt : null;

    acc.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `goal_${generateId()}`,
      title,
      isFocused: typeof candidate.isFocused === 'boolean' ? candidate.isFocused : completedAt == null,
      createdAt,
      updatedAt,
      completedAt,
    });
    return acc;
  }, []);
};

export const normalizeWeeklyGoals = (weeklyGoals: unknown): WeeklyGoal[] => {
  const now = Date.now();

  if (!Array.isArray(weeklyGoals)) return [];

  return weeklyGoals.reduce<WeeklyGoal[]>((acc, goal, index) => {
    if (!goal || typeof goal !== 'object') return acc;
    const candidate = goal as Partial<WeeklyGoal>;
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    if (!title) return acc;

    const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : now + index;
    const updatedAt = typeof candidate.updatedAt === 'number' ? candidate.updatedAt : createdAt;
    const completedAt = typeof candidate.completedAt === 'number' ? candidate.completedAt : null;

    acc.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `weekly_goal_${generateId()}`,
      title,
      createdAt,
      updatedAt,
      completedAt,
    });
    return acc;
  }, []);
};
