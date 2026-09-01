const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const moduleCache = new Map();

const resolveTsPath = (fromDir, request) => {
  const resolved = path.resolve(fromDir, request);
  const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`];
  const match = candidates.find(candidate => fs.existsSync(candidate));
  if (!match) throw new Error(`Cannot resolve ${request} from ${fromDir}`);
  return match;
};

const loadTsModule = (relativePath) => {
  const absPath = path.resolve(repoRoot, relativePath);
  if (moduleCache.has(absPath)) return moduleCache.get(absPath).exports;

  const source = fs.readFileSync(absPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = { exports: {} };
  moduleCache.set(absPath, mod);
  const localRequire = request => request.startsWith('.')
    ? loadTsModule(path.relative(repoRoot, resolveTsPath(path.dirname(absPath), request)))
    : require(request);
  new Function('require', 'module', 'exports', output)(localRequire, mod, mod.exports);
  return mod.exports;
};

const {
  hasCurrentWeekUnreflectedCompletion,
  isAfterLocalCalendarDay,
  isAtOrAfterLastVisibleWeekDay,
  shouldShowWeeklyReflectionReminderAfterCleanup,
  shouldShowWeeklyReflectionReminderAfterTaskCompletion,
} = loadTsModule('utils/weeklyReflectionReminder.ts');

const friday = new Date(2026, 7, 28, 12);
const thursday = new Date(2026, 7, 27, 12);
const previousFriday = new Date(2026, 7, 21, 12).getTime();

const createOnboarding = ({ cleanup = true, shown = false, cleanupTutorialCompletedAt = thursday.getTime() } = {}) => ({
  version: 1,
  tutorial: {
    workWeek: true,
    createTask: true,
    board: true,
    autofill: true,
    cleanup,
    reflection: false,
    lookback: false,
    goals: false,
  },
  hints: {
    bulkTaskShortcut: { firstTaskCreated: true, shown: true },
    weeklyReflectionReminder: { shown, cleanupTutorialCompletedAt },
  },
});

const createTask = (overrides = {}) => ({
  id: overrides.id || 'task_1',
  title: 'Task',
  duration: 30,
  dueDate: null,
  priority: 3,
  projectId: null,
  status: overrides.status || 'fri',
  isDone: overrides.isDone ?? true,
  reflectionValue: overrides.reflectionValue ?? 0,
  createdAt: friday.getTime(),
  updatedAt: friday.getTime(),
  completedAt: overrides.completedAt === undefined ? friday.getTime() : overrides.completedAt,
  reflectedAt: null,
  orderIndex: 0,
});

test('week end follows the configured start day and last visible day', () => {
  assert.equal(isAtOrAfterLastVisibleWeekDay(['mon', 'wed', 'fri'], 'mon', thursday), false);
  assert.equal(isAtOrAfterLastVisibleWeekDay(['mon', 'wed', 'fri'], 'mon', friday), true);
  assert.equal(isAtOrAfterLastVisibleWeekDay(['wed', 'fri', 'tue'], 'wed', friday), false);
  assert.equal(isAtOrAfterLastVisibleWeekDay(['wed', 'fri', 'tue'], 'wed', new Date(2026, 8, 1, 12)), true);
  assert.equal(isAtOrAfterLastVisibleWeekDay([], 'mon', friday), false);
});

test('current week completion must still be unreflected', () => {
  assert.equal(hasCurrentWeekUnreflectedCompletion([createTask()], 'mon', friday), true);
  assert.equal(hasCurrentWeekUnreflectedCompletion([createTask({ completedAt: previousFriday })], 'mon', friday), false);
  assert.equal(hasCurrentWeekUnreflectedCompletion([createTask({ reflectionValue: 3 })], 'mon', friday), false);
  assert.equal(hasCurrentWeekUnreflectedCompletion([createTask({ isDone: false, completedAt: null })], 'mon', friday), false);
});

test('cleanup reminder unlocks on the next local calendar day', () => {
  assert.equal(isAfterLocalCalendarDay(thursday.getTime(), thursday), false);
  assert.equal(isAfterLocalCalendarDay(thursday.getTime(), friday), true);
  assert.equal(isAfterLocalCalendarDay(null, friday), false);
});

test('cleanup reminder allows unfinished planned work after the tutorial day', () => {
  const tasks = [
    createTask(),
    createTask({ id: 'open', status: 'thu', isDone: false, completedAt: null }),
  ];
  const context = {
    tasks,
    visibleDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weekStartDay: 'mon',
    onboarding: createOnboarding(),
  };

  assert.equal(shouldShowWeeklyReflectionReminderAfterCleanup({ ...context, now: friday }), true);
  assert.equal(shouldShowWeeklyReflectionReminderAfterCleanup({ ...context, now: thursday }), false);
  assert.equal(shouldShowWeeklyReflectionReminderAfterCleanup({ ...context, onboarding: createOnboarding({ cleanup: false }), now: friday }), false);
  assert.equal(shouldShowWeeklyReflectionReminderAfterCleanup({ ...context, onboarding: createOnboarding({ shown: true }), now: friday }), false);
  assert.equal(shouldShowWeeklyReflectionReminderAfterCleanup({ ...context, onboarding: createOnboarding({ cleanupTutorialCompletedAt: null }), now: friday }), false);
  assert.equal(shouldShowWeeklyReflectionReminderAfterCleanup({ ...context, tasks: [createTask({ reflectionValue: 3 })], now: friday }), false);
});

test('automatic reminder requires the completed visible task to finish all planned work', () => {
  const doneTask = createTask();
  const backlogTask = createTask({ id: 'backlog', status: 'backlog', isDone: false, completedAt: null });
  const context = {
    visibleDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weekStartDay: 'mon',
    onboarding: createOnboarding(),
    completedTaskId: doneTask.id,
    now: friday,
  };

  assert.equal(shouldShowWeeklyReflectionReminderAfterTaskCompletion({ ...context, tasks: [doneTask, backlogTask] }), true);
  assert.equal(shouldShowWeeklyReflectionReminderAfterTaskCompletion({
    ...context,
    tasks: [doneTask, createTask({ id: 'open', status: 'thu', isDone: false, completedAt: null })],
  }), false);
  assert.equal(shouldShowWeeklyReflectionReminderAfterTaskCompletion({
    ...context,
    tasks: [createTask({ id: doneTask.id, status: 'backlog' })],
  }), false);
});
