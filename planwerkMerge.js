const clone = (value) => structuredClone(value);

const sortForStringify = (value) => {
  if (Array.isArray(value)) return value.map(sortForStringify);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortForStringify(value[key]);
    return acc;
  }, {});
};

const stableStringify = (value) => JSON.stringify(sortForStringify(value));

const isEqual = (a, b) => stableStringify(a) === stableStringify(b);

const hasChanged = (baseValue, nextValue) => !isEqual(baseValue, nextValue);

const byId = (items = []) => new Map(items.map(item => [item.id, item]));

const union = (...arrays) => Array.from(new Set(arrays.flat()));

const timestampValue = (value) => typeof value === 'number' ? value : 0;

const mergeObjectFields = (kind, id, base = {}, local = {}, external = {}) => {
  const merged = {};
  const keys = union(Object.keys(base), Object.keys(local), Object.keys(external));

  for (const key of keys) {
    const baseValue = base[key];
    const localValue = local[key];
    const externalValue = external[key];

    if (key === 'firstReflectionAt') {
      const timestamps = [baseValue, localValue, externalValue]
        .filter(value => typeof value === 'number' && Number.isFinite(value));
      merged[key] = timestamps.length > 0 ? Math.min(...timestamps) : null;
      continue;
    }

    if (key === 'updatedAt') {
      merged[key] = Math.max(
        timestampValue(baseValue),
        timestampValue(localValue),
        timestampValue(externalValue)
      );
      continue;
    }

    if (isEqual(localValue, externalValue)) {
      merged[key] = clone(localValue);
    } else if (isEqual(localValue, baseValue)) {
      merged[key] = clone(externalValue);
    } else if (isEqual(externalValue, baseValue)) {
      merged[key] = clone(localValue);
    } else {
      return {
        ok: false,
        reason: `${kind} ${id} ${key} changed locally and externally`,
      };
    }
  }

  return { ok: true, value: merged };
};

const mergeEntityArray = (kind, baseItems = [], localItems = [], externalItems = []) => {
  const baseMap = byId(baseItems);
  const localMap = byId(localItems);
  const externalMap = byId(externalItems);
  const ids = union(
    baseItems.map(item => item.id),
    localItems.map(item => item.id),
    externalItems.map(item => item.id)
  );
  const merged = [];

  for (const id of ids) {
    const base = baseMap.get(id);
    const local = localMap.get(id);
    const external = externalMap.get(id);

    if (!base) {
      if (local && external && !isEqual(local, external)) {
        return { ok: false, reason: `${kind} ${id} created locally and externally differently` };
      }
      if (local || external) merged.push(clone(local || external));
      continue;
    }

    const localChanged = local ? hasChanged(base, local) : true;
    const externalChanged = external ? hasChanged(base, external) : true;

    if (!local && !external) continue;
    if (!local && externalChanged) {
      return { ok: false, reason: `${kind} ${id} deleted locally and changed externally` };
    }
    if (!external && localChanged) {
      return { ok: false, reason: `${kind} ${id} deleted externally and changed locally` };
    }
    if (!local || !external) continue;

    if (!localChanged && !externalChanged) {
      merged.push(clone(base));
    } else if (!localChanged) {
      merged.push(clone(external));
    } else if (!externalChanged) {
      merged.push(clone(local));
    } else {
      const fieldMerge = mergeObjectFields(kind, id, base, local, external);
      if (!fieldMerge.ok) return fieldMerge;
      merged.push(fieldMerge.value);
    }
  }

  return { ok: true, value: merged };
};

const mergePlainObject = (kind, base = {}, local = {}, external = {}) => {
  const fieldMerge = mergeObjectFields(kind, kind, base, local, external);
  if (!fieldMerge.ok) return fieldMerge;

  return { ok: true, value: fieldMerge.value };
};

const focusedOpenGoalTitles = (goals = []) => (
  goals
    .filter(goal => goal && goal.isFocused && goal.completedAt == null)
    .map(goal => typeof goal.title === 'string' ? goal.title.trim() : '')
    .filter(Boolean)
);

const deriveGeneralGoal = (goals = []) => focusedOpenGoalTitles(goals).join('\n');

const normalizeGeneralGoal = (value) => (
  typeof value === 'string'
    ? value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n')
    : ''
);

const hasGoalsArray = (analytics = {}) => Array.isArray(analytics.goals);

const hasWeeklyGoalsArray = (analytics = {}) => Array.isArray(analytics.weeklyGoals);

const withoutGoalFields = (analytics = {}) => {
  const { goals, weeklyGoals, generalGoal, ...rest } = analytics;
  return rest;
};

const mergeAnalytics = (base = {}, local = {}, external = {}) => {
  const usesGoalList = hasGoalsArray(base) || hasGoalsArray(local) || hasGoalsArray(external);
  const usesWeeklyGoalList = hasWeeklyGoalsArray(base) || hasWeeklyGoalsArray(local) || hasWeeklyGoalsArray(external);

  if (!usesGoalList && !usesWeeklyGoalList) {
    return mergePlainObject('analytics', base, local, external);
  }

  const extraFields = mergePlainObject(
    'analytics',
    withoutGoalFields(base),
    withoutGoalFields(local),
    withoutGoalFields(external)
  );
  if (!extraFields.ok) return extraFields;

  const goals = mergeEntityArray(
    'goals',
    Array.isArray(base.goals) ? base.goals : [],
    Array.isArray(local.goals) ? local.goals : [],
    Array.isArray(external.goals) ? external.goals : []
  );
  if (!goals.ok) return goals;

  const weeklyGoals = mergeEntityArray(
    'weeklyGoals',
    Array.isArray(base.weeklyGoals) ? base.weeklyGoals : [],
    Array.isArray(local.weeklyGoals) ? local.weeklyGoals : [],
    Array.isArray(external.weeklyGoals) ? external.weeklyGoals : []
  );
  if (!weeklyGoals.ok) return weeklyGoals;

  return {
    ok: true,
    value: {
      ...extraFields.value,
      generalGoal: deriveGeneralGoal(goals.value) || normalizeGeneralGoal(local.generalGoal) || normalizeGeneralGoal(external.generalGoal),
      goals: goals.value,
      weeklyGoals: weeklyGoals.value,
    },
  };
};

const normalizeAnalyticsData = (analytics = {}) => {
  if (!analytics || typeof analytics !== 'object' || Array.isArray(analytics)) return {};
  if (!Array.isArray(analytics.goals)) return analytics;

  return {
    ...analytics,
    generalGoal: deriveGeneralGoal(analytics.goals),
  };
};

const normalizePlanwerkData = (data = {}) => ({
  tasks: Array.isArray(data.tasks) ? data.tasks : [],
  projects: Array.isArray(data.projects) ? data.projects : [],
  templates: Array.isArray(data.templates) ? data.templates : [],
  settings: data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
    ? data.settings
    : {},
  analytics: normalizeAnalyticsData(data.analytics),
});

export const planwerkDataFingerprint = (data) => stableStringify(normalizePlanwerkData(data));

export const mergePlanwerkData = (baseData, localData, externalData) => {
  const base = normalizePlanwerkData(baseData);
  const local = normalizePlanwerkData(localData);
  const external = normalizePlanwerkData(externalData);

  if (isEqual(local, external)) return { ok: true, data: clone(local) };
  if (isEqual(local, base)) return { ok: true, data: clone(external) };
  if (isEqual(external, base)) return { ok: true, data: clone(local) };

  const tasks = mergeEntityArray('tasks', base.tasks, local.tasks, external.tasks);
  if (!tasks.ok) return tasks;

  const projects = mergeEntityArray('projects', base.projects, local.projects, external.projects);
  if (!projects.ok) return projects;

  const templates = mergeEntityArray('templates', base.templates, local.templates, external.templates);
  if (!templates.ok) return templates;

  const settings = mergePlainObject('settings', base.settings, local.settings, external.settings);
  if (!settings.ok) return settings;

  const analytics = mergeAnalytics(base.analytics, local.analytics, external.analytics);
  if (!analytics.ok) return analytics;

  return {
    ok: true,
    data: {
      tasks: tasks.value,
      projects: projects.value,
      templates: templates.value,
      settings: settings.value,
      analytics: analytics.value,
    },
  };
};
