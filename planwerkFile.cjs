const fs = require('fs/promises');
const { constants: fsConstants } = require('fs');
const crypto = require('crypto');
const path = require('path');

const PLANWERK_FORMAT = 'planwerk';
const PLANWERK_VERSION = 1;

const PACKAGE_FILES = {
  tasks: 'tasks.json',
  projects: 'projects.json',
  templates: 'templates.json',
  settings: 'settings.json',
  analytics: 'analytics.json',
};

const PLANWERK_JSON_FILE_MAX_BYTES = 5 * 1024 * 1024;
const PLANWERK_LIMITS = {
  tasks: 10000,
  projects: 2000,
  templates: 2000,
  goals: 5000,
};

const VALID_COLUMNS = new Set(['backlog', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'done']);
const VALID_PRIORITIES = new Set([1, 2, 3, 4, 5]);
const VALID_REFLECTION_VALUES = new Set([0, 1, 2, 3]);
const VALID_RECURRENCE_TYPES = new Set(['daily', 'weekly', 'biweekly', 'monthly']);
const VALID_THEMES = new Set(['light', 'dark', 'system']);
const VALID_LANGUAGES = new Set(['system', 'en', 'de']);
const VALID_AUTOFILL_MODES = new Set(['current-weekday', 'full-week']);
const DAY_COLUMN_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const VALID_WEEK_START_DAYS = new Set(DAY_COLUMN_IDS);

const emptyPlanwerkData = () => ({
  tasks: [],
  projects: [],
  templates: [],
  settings: {},
  analytics: {},
});

const ensurePlanwerkExtension = (targetPath) => (
  targetPath.toLowerCase().endsWith('.planwerk') ? targetPath : `${targetPath}.planwerk`
);

const isPlanwerkPackagePath = (targetPath) => (
  typeof targetPath === 'string' && targetPath.toLowerCase().endsWith('.planwerk')
);

const isMissingPlanwerkPackageError = (error) => (
  Boolean(error && error.code === 'ENOENT')
);

const failInvalidData = (field, detail) => {
  throw new Error(`Invalid Planwerk data: ${field} ${detail}.`);
};

const isPlainObject = (value) => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const requirePlainObject = (value, field) => {
  if (!isPlainObject(value)) failInvalidData(field, 'must be an object');
  return value;
};

const normalizeArray = (value, field, limit, normalizer) => {
  if (value == null) return [];
  if (!Array.isArray(value)) failInvalidData(field, 'must be an array');
  if (value.length > limit) failInvalidData(field, `must contain at most ${limit} entries`);
  return value.map((entry, index) => normalizer(entry, `${field}[${index}]`, index));
};

const normalizeString = (value, field, { max = 1000, fallback = '', required = false } = {}) => {
  if (value == null) {
    if (required) failInvalidData(field, 'is required');
    return fallback;
  }
  if (typeof value !== 'string') failInvalidData(field, 'must be a string');
  if (value.length > max) failInvalidData(field, `must be ${max} characters or fewer`);
  if (required && value.trim() === '') failInvalidData(field, 'must not be empty');
  return value;
};

const normalizeStringOrNull = (value, field, options = {}) => {
  if (value == null) return null;
  return normalizeString(value, field, options);
};

const normalizeNumber = (value, field, { fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) => {
  if (value == null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) failInvalidData(field, 'must be a finite number');
  if (integer && !Number.isInteger(value)) failInvalidData(field, 'must be an integer');
  if (value < min || value > max) failInvalidData(field, `must be between ${min} and ${max}`);
  return value;
};

const normalizeNumberOrNull = (value, field, options = {}) => {
  if (value == null) return null;
  return normalizeNumber(value, field, options);
};

const normalizeBoolean = (value, field, fallback = false) => {
  if (value == null) return fallback;
  if (typeof value !== 'boolean') failInvalidData(field, 'must be a boolean');
  return value;
};

const normalizeEnum = (value, field, validValues, fallback) => {
  if (value == null) return fallback;
  if (!validValues.has(value)) failInvalidData(field, 'contains an unsupported value');
  return value;
};

const normalizeIsoDateOrNull = (value, field) => {
  if (value == null || value === '') return null;
  const date = normalizeString(value, field, { max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) failInvalidData(field, 'must be YYYY-MM-DD or null');
  return date;
};

const normalizeTimeOfDay = (value, field) => {
  const time = normalizeString(value, field, { max: 5, fallback: '09:00' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) failInvalidData(field, 'must be HH:MM');
  return time;
};

const normalizeDayColumns = (value, field) => {
  if (value == null) return undefined;
  if (!Array.isArray(value)) failInvalidData(field, 'must be an array');
  if (value.length > DAY_COLUMN_IDS.length) failInvalidData(field, 'contains too many entries');
  value.forEach((day, index) => {
    if (!DAY_COLUMN_IDS.includes(day)) failInvalidData(`${field}[${index}]`, 'must be a day column');
  });
  return [...new Set(value)];
};

const normalizeMaxHoursByDay = (value, field) => {
  if (value == null) return undefined;
  requirePlainObject(value, field);
  return DAY_COLUMN_IDS.reduce((acc, day) => {
    if (value[day] != null) {
      acc[day] = normalizeNumber(value[day], `${field}.${day}`, { min: 0, max: 24 });
    }
    return acc;
  }, {});
};

const createOnboardingState = (workWeek, createTask, board, autofill, cleanup, reflection, lookback, goals, weeklyReflectionReminderShown = false) => ({
  version: 1,
  tutorial: {
    workWeek,
    createTask,
    board,
    autofill,
    cleanup,
    reflection,
    lookback,
    goals,
  },
  hints: {
    bulkTaskShortcut: {
      firstTaskCreated: false,
      shown: board,
    },
    weeklyReflectionReminder: {
      shown: weeklyReflectionReminderShown,
      cleanupTutorialCompletedAt: null,
    },
  },
});

const normalizeOnboarding = (value, field) => {
  if (value == null) return createOnboardingState(true, true, true, true, true, true, true, true, true);

  const onboarding = requirePlainObject(value, field);
  const tutorial = onboarding.tutorial == null
    ? {}
    : requirePlainObject(onboarding.tutorial, `${field}.tutorial`);
  const hints = onboarding.hints == null
    ? {}
    : requirePlainObject(onboarding.hints, `${field}.hints`);
  const bulkTaskShortcut = hints.bulkTaskShortcut == null
    ? {}
    : requirePlainObject(hints.bulkTaskShortcut, `${field}.hints.bulkTaskShortcut`);
  const weeklyReflectionReminder = hints.weeklyReflectionReminder == null
    ? {}
    : requirePlainObject(hints.weeklyReflectionReminder, `${field}.hints.weeklyReflectionReminder`);
  const board = normalizeBoolean(tutorial.board, `${field}.tutorial.board`, true);

  const normalizedWeeklyReflectionReminder = {
    shown: normalizeBoolean(
      weeklyReflectionReminder.shown,
      `${field}.hints.weeklyReflectionReminder.shown`,
      true
    ),
  };
  if (Object.prototype.hasOwnProperty.call(weeklyReflectionReminder, 'cleanupTutorialCompletedAt')) {
    normalizedWeeklyReflectionReminder.cleanupTutorialCompletedAt = normalizeNumberOrNull(
      weeklyReflectionReminder.cleanupTutorialCompletedAt,
      `${field}.hints.weeklyReflectionReminder.cleanupTutorialCompletedAt`,
      { min: 0 }
    );
  }

  return {
    version: normalizeNumber(onboarding.version, `${field}.version`, { fallback: 1, min: 1, max: 1, integer: true }),
    tutorial: {
      workWeek: normalizeBoolean(tutorial.workWeek, `${field}.tutorial.workWeek`, true),
      createTask: normalizeBoolean(tutorial.createTask, `${field}.tutorial.createTask`, true),
      board,
      autofill: normalizeBoolean(tutorial.autofill, `${field}.tutorial.autofill`, true),
      cleanup: normalizeBoolean(tutorial.cleanup, `${field}.tutorial.cleanup`, true),
      reflection: normalizeBoolean(tutorial.reflection, `${field}.tutorial.reflection`, true),
      lookback: normalizeBoolean(tutorial.lookback, `${field}.tutorial.lookback`, true),
      goals: normalizeBoolean(tutorial.goals, `${field}.tutorial.goals`, true),
    },
    hints: {
      bulkTaskShortcut: {
        firstTaskCreated: normalizeBoolean(
          bulkTaskShortcut.firstTaskCreated,
          `${field}.hints.bulkTaskShortcut.firstTaskCreated`,
          false
        ),
        shown: normalizeBoolean(
          bulkTaskShortcut.shown,
          `${field}.hints.bulkTaskShortcut.shown`,
          board
        ),
      },
      weeklyReflectionReminder: normalizedWeeklyReflectionReminder,
    },
  };
};

const normalizeTask = (value, field, index) => {
  const task = requirePlainObject(value, field);
  return {
    id: normalizeString(task.id, `${field}.id`, { max: 128, fallback: `task_${index}` }),
    title: normalizeString(task.title, `${field}.title`, { max: 1000, required: true }),
    duration: normalizeNumber(task.duration, `${field}.duration`, { fallback: 30, min: 1, max: 24 * 60, integer: true }),
    dueDate: normalizeIsoDateOrNull(task.dueDate, `${field}.dueDate`),
    priority: normalizeEnum(task.priority, `${field}.priority`, VALID_PRIORITIES, 3),
    projectId: normalizeStringOrNull(task.projectId, `${field}.projectId`, { max: 128 }),
    status: normalizeEnum(task.status, `${field}.status`, VALID_COLUMNS, 'backlog'),
    isDone: normalizeBoolean(task.isDone, `${field}.isDone`, false),
    reflectionValue: normalizeEnum(task.reflectionValue, `${field}.reflectionValue`, VALID_REFLECTION_VALUES, 0),
    createdAt: normalizeNumber(task.createdAt, `${field}.createdAt`, { fallback: 0, min: 0 }),
    updatedAt: normalizeNumber(task.updatedAt, `${field}.updatedAt`, { fallback: 0, min: 0 }),
    completedAt: normalizeNumberOrNull(task.completedAt, `${field}.completedAt`, { min: 0 }),
    reflectedAt: normalizeNumberOrNull(task.reflectedAt, `${field}.reflectedAt`, { min: 0 }),
    orderIndex: normalizeNumber(task.orderIndex, `${field}.orderIndex`, { fallback: index, min: 0, integer: true }),
  };
};

const normalizeProject = (value, field, index) => {
  const project = requirePlainObject(value, field);
  return {
    id: normalizeString(project.id, `${field}.id`, { max: 128, fallback: `proj_${index}` }),
    name: normalizeString(project.name, `${field}.name`, { max: 500, required: true }),
  };
};

const normalizeGoal = (value, field, index, prefix = 'goal') => {
  const goal = requirePlainObject(value, field);
  return {
    id: normalizeString(goal.id, `${field}.id`, { max: 128, fallback: `${prefix}_${index}` }),
    title: normalizeString(goal.title, `${field}.title`, { max: 1000, required: true }),
    isFocused: normalizeBoolean(goal.isFocused, `${field}.isFocused`, true),
    createdAt: normalizeNumber(goal.createdAt, `${field}.createdAt`, { fallback: 0, min: 0 }),
    updatedAt: normalizeNumber(goal.updatedAt, `${field}.updatedAt`, { fallback: 0, min: 0 }),
    completedAt: normalizeNumberOrNull(goal.completedAt, `${field}.completedAt`, { min: 0 }),
  };
};

const normalizeWeeklyGoal = (value, field, index) => {
  const goal = requirePlainObject(value, field);
  return {
    id: normalizeString(goal.id, `${field}.id`, { max: 128, fallback: `weekly_goal_${index}` }),
    title: normalizeString(goal.title, `${field}.title`, { max: 1000, required: true }),
    createdAt: normalizeNumber(goal.createdAt, `${field}.createdAt`, { fallback: 0, min: 0 }),
    updatedAt: normalizeNumber(goal.updatedAt, `${field}.updatedAt`, { fallback: 0, min: 0 }),
    completedAt: normalizeNumberOrNull(goal.completedAt, `${field}.completedAt`, { min: 0 }),
  };
};

const normalizeTemplate = (value, field, index) => {
  const template = requirePlainObject(value, field);
  const normalized = {
    id: normalizeString(template.id, `${field}.id`, { max: 128, fallback: `template_${index}` }),
    title: normalizeString(template.title, `${field}.title`, { max: 1000, required: true }),
    duration: normalizeNumber(template.duration, `${field}.duration`, { fallback: 30, min: 1, max: 24 * 60, integer: true }),
    priority: normalizeEnum(template.priority, `${field}.priority`, VALID_PRIORITIES, 3),
    projectId: normalizeStringOrNull(template.projectId, `${field}.projectId`, { max: 128 }),
    recurrenceType: normalizeEnum(template.recurrenceType, `${field}.recurrenceType`, VALID_RECURRENCE_TYPES, 'weekly'),
    timeOfDay: normalizeTimeOfDay(template.timeOfDay, `${field}.timeOfDay`),
    dueDateOffsetDays: normalizeNumberOrNull(template.dueDateOffsetDays, `${field}.dueDateOffsetDays`, { min: 0, max: 365, integer: true }),
    nextGenerationDate: normalizeNumber(template.nextGenerationDate, `${field}.nextGenerationDate`, { fallback: 0, min: 0 }),
  };

  if (template.dayOfWeek != null) {
    normalized.dayOfWeek = normalizeNumber(template.dayOfWeek, `${field}.dayOfWeek`, { min: 0, max: 6, integer: true });
  }

  if (template.dayOfMonth != null) {
    normalized.dayOfMonth = normalizeNumber(template.dayOfMonth, `${field}.dayOfMonth`, { min: 1, max: 31, integer: true });
  }

  return normalized;
};

const normalizeSettings = (value) => {
  if (value == null) return { onboarding: createOnboardingState(true, true, true, true, true, true, true, true, true) };
  const settings = requirePlainObject(value, 'settings');
  const normalized = {};

  if ('defaultProjectId' in settings) normalized.defaultProjectId = normalizeStringOrNull(settings.defaultProjectId, 'settings.defaultProjectId', { max: 128 });
  if ('defaultPriority' in settings) normalized.defaultPriority = normalizeEnum(settings.defaultPriority, 'settings.defaultPriority', VALID_PRIORITIES, 3);
  if ('defaultDuration' in settings) normalized.defaultDuration = normalizeNumber(settings.defaultDuration, 'settings.defaultDuration', { min: 1, max: 24 * 60, integer: true });
  if ('defaultDueDateOffsetDays' in settings) normalized.defaultDueDateOffsetDays = normalizeNumber(settings.defaultDueDateOffsetDays, 'settings.defaultDueDateOffsetDays', { min: 0, max: 365, integer: true });
  if ('theme' in settings) normalized.theme = normalizeEnum(settings.theme, 'settings.theme', VALID_THEMES, 'system');
  if ('language' in settings) normalized.language = normalizeEnum(settings.language, 'settings.language', VALID_LANGUAGES, 'system');
  if ('autofillMode' in settings) normalized.autofillMode = normalizeEnum(settings.autofillMode, 'settings.autofillMode', VALID_AUTOFILL_MODES, 'current-weekday');
  if ('weekStartDay' in settings) {
    normalized.weekStartDay = VALID_WEEK_START_DAYS.has(settings.weekStartDay) ? settings.weekStartDay : 'mon';
  }
  if ('maxHoursPerDayByDay' in settings) normalized.maxHoursPerDayByDay = normalizeMaxHoursByDay(settings.maxHoursPerDayByDay, 'settings.maxHoursPerDayByDay');
  if ('visibleDays' in settings) normalized.visibleDays = normalizeDayColumns(settings.visibleDays, 'settings.visibleDays');
  if ('backlogPinned' in settings) normalized.backlogPinned = normalizeBoolean(settings.backlogPinned, 'settings.backlogPinned', false);
  if ('sidebarCollapsed' in settings) normalized.sidebarCollapsed = normalizeBoolean(settings.sidebarCollapsed, 'settings.sidebarCollapsed', false);
  normalized.onboarding = normalizeOnboarding(settings.onboarding, 'settings.onboarding');
  if ('maxHoursPerDay' in settings) normalized.maxHoursPerDay = normalizeNumber(settings.maxHoursPerDay, 'settings.maxHoursPerDay', { min: 1, max: 24 });

  return normalized;
};

const normalizeAnalytics = (value) => {
  if (value == null) return {};
  const analytics = requirePlainObject(value, 'analytics');
  const normalized = {};

  if ('firstReflectionAt' in analytics) {
    normalized.firstReflectionAt = normalizeNumberOrNull(
      analytics.firstReflectionAt,
      'analytics.firstReflectionAt',
      { min: 0 }
    );
  }

  if ('generalGoal' in analytics) {
    normalized.generalGoal = normalizeString(analytics.generalGoal, 'analytics.generalGoal', { max: 5000 });
  }

  if ('goals' in analytics) {
    normalized.goals = normalizeArray(analytics.goals, 'analytics.goals', PLANWERK_LIMITS.goals, (entry, field, index) => normalizeGoal(entry, field, index, 'goal'));
  }

  if ('weeklyGoals' in analytics) {
    normalized.weeklyGoals = normalizeArray(analytics.weeklyGoals, 'analytics.weeklyGoals', PLANWERK_LIMITS.goals, normalizeWeeklyGoal);
  }

  return normalized;
};

const openRegularPackageFile = async (filePath) => {
  const pathStats = await fs.lstat(filePath);
  if (!pathStats.isFile()) {
    throw new Error(`Planwerk package file must be a regular file: ${path.basename(filePath)}.`);
  }

  let handle = null;
  try {
    handle = await fs.open(filePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    const handleStats = await handle.stat();
    if (!handleStats.isFile() || pathStats.dev !== handleStats.dev || pathStats.ino !== handleStats.ino) {
      throw new Error(`Planwerk package file changed while opening: ${path.basename(filePath)}.`);
    }
    return { handle, stats: handleStats };
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    throw error;
  }
};

const readJsonFile = async (filePath, fallback) => {
  let opened = null;
  try {
    opened = await openRegularPackageFile(filePath);
    if (opened.stats.size > PLANWERK_JSON_FILE_MAX_BYTES) {
      throw new Error(`Planwerk JSON file is too large: ${path.basename(filePath)}.`);
    }
    const raw = await opened.handle.readFile('utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  } finally {
    if (opened) await opened.handle.close().catch(() => {});
  }
};

const createTempJsonFilePath = (filePath) => {
  const suffix = [
    process.pid,
    Date.now(),
    crypto.randomBytes(16).toString('hex'),
  ].join('-');
  return `${filePath}.${suffix}.tmp`;
};

const writeJsonFile = async (filePath, value) => {
  const tmpPath = createTempJsonFilePath(filePath);
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > PLANWERK_JSON_FILE_MAX_BYTES) {
    throw new Error(`Planwerk JSON file is too large: ${path.basename(filePath)}.`);
  }

  let handle = null;
  try {
    handle = await fs.open(tmpPath, 'wx', 0o600);
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
};

const signatureFileNames = () => ['manifest.json', ...Object.values(PACKAGE_FILES)];

const getPlanwerkPackageSignature = async (packagePath) => {
  const packageStats = await fs.stat(packagePath);
  if (!packageStats.isDirectory()) {
    throw new Error('Selected path is not a Planwerk directory.');
  }

  const entries = [];
  let latestMtimeMs = 0;

  for (const fileName of signatureFileNames()) {
    const filePath = path.join(packagePath, fileName);
    let opened = null;
    try {
      opened = await openRegularPackageFile(filePath);
      const { stats } = opened;
      entries.push({
        fileName,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      });
      latestMtimeMs = Math.max(latestMtimeMs, stats.mtimeMs);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        entries.push({ fileName, missing: true });
        continue;
      }
      throw error;
    } finally {
      if (opened) await opened.handle.close().catch(() => {});
    }
  }

  const signature = crypto
    .createHash('sha256')
    .update(JSON.stringify(entries))
    .digest('hex');

  return {
    signature,
    updatedAt: latestMtimeMs > 0 ? new Date(latestMtimeMs).toISOString() : null,
  };
};

const validatePlanwerkDirectory = async (packagePath) => {
  if (!isPlanwerkPackagePath(packagePath)) {
    throw new Error('Please select a .planwerk file.');
  }

  const stats = await fs.stat(packagePath);
  if (!stats.isDirectory()) {
    throw new Error('Selected path is not a Planwerk directory.');
  }

  const manifest = await readJsonFile(path.join(packagePath, 'manifest.json'), null);
  if (
    !manifest ||
    manifest.format !== PLANWERK_FORMAT ||
    manifest.version !== PLANWERK_VERSION
  ) {
    throw new Error('Selected directory is not a valid Planwerk file.');
  }

  return manifest;
};

const normalizePlanwerkData = (data = {}) => {
  const source = requirePlainObject(data, 'package');
  return {
    tasks: normalizeArray(source.tasks, 'tasks', PLANWERK_LIMITS.tasks, normalizeTask),
    projects: normalizeArray(source.projects, 'projects', PLANWERK_LIMITS.projects, normalizeProject),
    templates: normalizeArray(source.templates, 'templates', PLANWERK_LIMITS.templates, normalizeTemplate),
    settings: normalizeSettings(source.settings),
    analytics: normalizeAnalytics(source.analytics),
  };
};

const loadPlanwerkPackage = async (packagePath) => {
  await validatePlanwerkDirectory(packagePath);
  const defaults = emptyPlanwerkData();

  const [tasks, projects, templates, settings, analytics] = await Promise.all([
    readJsonFile(path.join(packagePath, PACKAGE_FILES.tasks), defaults.tasks),
    readJsonFile(path.join(packagePath, PACKAGE_FILES.projects), defaults.projects),
    readJsonFile(path.join(packagePath, PACKAGE_FILES.templates), defaults.templates),
    readJsonFile(path.join(packagePath, PACKAGE_FILES.settings), defaults.settings),
    readJsonFile(path.join(packagePath, PACKAGE_FILES.analytics), defaults.analytics),
  ]);

  return {
    path: packagePath,
    name: path.basename(packagePath, '.planwerk'),
    data: normalizePlanwerkData({ tasks, projects, templates, settings, analytics }),
    ...(await getPlanwerkPackageSignature(packagePath)),
  };
};

const writePlanwerkPackage = async (targetPath, data) => {
  const packagePath = ensurePlanwerkExtension(targetPath);
  const normalized = normalizePlanwerkData(data);

  await fs.mkdir(packagePath, { recursive: true });

  const manifest = {
    format: PLANWERK_FORMAT,
    version: PLANWERK_VERSION,
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    writeJsonFile(path.join(packagePath, 'manifest.json'), manifest),
    writeJsonFile(path.join(packagePath, PACKAGE_FILES.tasks), normalized.tasks),
    writeJsonFile(path.join(packagePath, PACKAGE_FILES.projects), normalized.projects),
    writeJsonFile(path.join(packagePath, PACKAGE_FILES.templates), normalized.templates),
    writeJsonFile(path.join(packagePath, PACKAGE_FILES.settings), normalized.settings),
    writeJsonFile(path.join(packagePath, PACKAGE_FILES.analytics), normalized.analytics),
  ]);

  return {
    path: packagePath,
    name: path.basename(packagePath, '.planwerk'),
    data: normalized,
    ...(await getPlanwerkPackageSignature(packagePath)),
  };
};

const formatTimestampForPath = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-');
};

const copyPlanwerkPackageWithTimestamp = async (sourcePath, data, date = new Date()) => {
  const parentDir = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath, '.planwerk');
  let targetPath = path.join(parentDir, `${baseName}.external-${formatTimestampForPath(date)}.planwerk`);
  let suffix = 2;

  while (true) {
    try {
      await fs.stat(targetPath);
      targetPath = path.join(parentDir, `${baseName}.external-${formatTimestampForPath(date)}-${suffix}.planwerk`);
      suffix += 1;
    } catch (error) {
      if (error && error.code === 'ENOENT') break;
      throw error;
    }
  }

  return writePlanwerkPackage(targetPath, data);
};

module.exports = {
  PLANWERK_FORMAT,
  PLANWERK_JSON_FILE_MAX_BYTES,
  PLANWERK_VERSION,
  copyPlanwerkPackageWithTimestamp,
  emptyPlanwerkData,
  ensurePlanwerkExtension,
  getPlanwerkPackageSignature,
  isMissingPlanwerkPackageError,
  isPlanwerkPackagePath,
  loadPlanwerkPackage,
  normalizePlanwerkData,
  writePlanwerkPackage,
};
