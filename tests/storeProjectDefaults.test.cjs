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
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;

  const mod = { exports: {} };
  moduleCache.set(absPath, mod);

  const localRequire = (request) => {
    if (request.startsWith('.')) {
      const resolved = resolveTsPath(path.dirname(absPath), request);
      return loadTsModule(path.relative(repoRoot, resolved));
    }
    return require(request);
  };

  const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', output);
  fn(localRequire, mod, mod.exports, path.dirname(absPath), absPath);
  return mod.exports;
};

const createTask = (projectId, overrides = {}) => ({
  id: overrides.id || 'task_1',
  title: 'Prepare',
  duration: 30,
  dueDate: null,
  priority: 3,
  projectId,
  status: overrides.status || 'backlog',
  isDone: overrides.isDone || false,
  reflectionValue: overrides.reflectionValue || 0,
  createdAt: 1,
  updatedAt: 1,
  completedAt: null,
  reflectedAt: null,
  orderIndex: 0,
});

const createTemplate = (id, projectId) => ({
  id,
  title: 'Weekly review',
  duration: 30,
  priority: 3,
  projectId,
  recurrenceType: 'weekly',
  dayOfWeek: 1,
  timeOfDay: '09:00',
  nextGenerationDate: 1,
});

test('new app state localizes its required default project', () => {
  const { createDefaultState, normalizeOnboardingState } = loadTsModule('hooks/useStore.ts');

  const english = createDefaultState('en');
  const german = createDefaultState('de');

  assert.deepEqual(english.projects, [{ id: 'proj_default', name: 'General' }]);
  assert.equal(english.defaultProjectId, 'proj_default');
  assert.equal(english.firstReflectionAt, null);
  assert.equal(english.defaultDueDateOffsetDays, 0);
  assert.equal(english.weekStartDay, 'mon');
  assert.equal(english.backlogPinned, true);
  assert.equal(english.maxHoursPerDayByDay.mon, 4);
  assert.equal(english.maxHoursPerDayByDay.sat, 0);
  assert.equal(english.maxHoursPerDayByDay.sun, 0);
  assert.deepEqual(english.onboarding.tutorial, {
    workWeek: false,
    createTask: false,
    board: false,
    autofill: false,
    cleanup: false,
    reflection: false,
    lookback: false,
    goals: false,
  });
  assert.deepEqual(english.onboarding.hints, {
    bulkTaskShortcut: {
      firstTaskCreated: false,
      shown: false,
    },
    weeklyReflectionReminder: {
      shown: false,
      cleanupTutorialCompletedAt: null,
    },
  });
  assert.deepEqual(german.projects, [{ id: 'proj_default', name: 'Allgemein' }]);
  assert.equal(german.defaultProjectId, 'proj_default');
  assert.equal(german.defaultDueDateOffsetDays, 0);

  const migratedExistingOnboarding = normalizeOnboardingState({
    version: 1,
    tutorial: english.onboarding.tutorial,
    hints: {
      bulkTaskShortcut: english.onboarding.hints.bulkTaskShortcut,
    },
  });
  assert.equal(migratedExistingOnboarding.hints.weeklyReflectionReminder.shown, true);
  assert.equal(normalizeOnboardingState(english.onboarding).hints.weeklyReflectionReminder.shown, false);
});

test('backlog starts pinned but preserves an explicitly stored unpinned preference', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'hooks/useStore.ts'), 'utf8');
  const { createDefaultState } = loadTsModule('hooks/useStore.ts');

  assert.equal(createDefaultState('en').backlogPinned, true);
  assert.match(source, /backlogPinned: savedState\?\.backlogPinned \?\? defaultState\.backlogPinned/);
  assert.match(source, /backlogPinned: state\.backlogPinned/);
});

test('store persists one workspace reflection start and records task reflections atomically', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'hooks/useStore.ts'), 'utf8');

  assert.match(source, /firstReflectionAt: state\.firstReflectionAt/);
  assert.match(source, /resolveFirstReflectionAt/);
  assert.match(source, /recordTaskReflection/);
  assert.match(source, /firstReflectionAt: reflectionResult\.firstReflectionAt/);
  assert.match(source, /const shouldPersistFirstReflectionMigration/);
  assert.match(source, /skipNextSaveRef\.current = !shouldPersistFirstReflectionMigration/);
  assert.doesNotMatch(source, /updateTask\(taskId, \{ reflectionValue: value, reflectedAt: Date\.now\(\) \}\)/);
});

test('legacy hidden work week days are synced to zero hours in store normalization', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'hooks/useStore.ts'), 'utf8');

  assert.match(source, /const syncMaxHoursWithVisibleDays/);
  assert.match(source, /visibleDays\.includes\(day\) \? maxHoursPerDayByDay\[day\] : 0/);
  assert.match(source, /visibleDays: deriveVisibleDaysFromMaxHours\(maxHoursPerDayByDay, savedState\?\.visibleDays\)/);
  assert.match(source, /const maxHoursPerDayByDay = syncMaxHoursWithVisibleDays/);
});

test('week start day is persisted and invalid or missing values fall back to monday', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'hooks/useStore.ts'), 'utf8');

  assert.match(source, /weekStartDay: state\.weekStartDay/);
  assert.match(source, /weekStartDay: normalizeWeekStartDay\(savedState\?\.weekStartDay\)/);
  assert.match(source, /DAY_COLUMN_IDS\.includes\(weekStartDay as DayColumnId\)/);
  assert.match(source, /: 'mon'/);
});

test('new files stay clean while obsolete local storage keys are removed without reading them', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'hooks/useStore.ts'), 'utf8');
  const constantsSource = fs.readFileSync(path.join(repoRoot, 'constants.ts'), 'utf8');
  const { clearLegacyStorage, LEGACY_STORAGE_KEYS } = loadTsModule('hooks/useStore.ts');
  const removed = [];

  assert.match(source, /const initialState = createDefaultState\(language\)/);
  assert.doesNotMatch(source, /readLegacyState|hasLegacyData|getStateForNewPlanwerkFile|localStorage\.getItem/);
  assert.doesNotMatch(constantsSource, /STORAGE_KEY|planwerk_offline_state/);

  clearLegacyStorage({ removeItem: key => removed.push(key) });
  assert.deepEqual(removed, [...LEGACY_STORAGE_KEYS]);
  assert.deepEqual(removed, [
    'planwerk_offline_state',
    'planwerk_generalGoal',
    'planwerk_sidebar_collapsed',
  ]);
});

test('default project updates accept only a project that still exists', () => {
  const { createDefaultState, setDefaultProjectInState } = loadTsModule('hooks/useStore.ts');
  const state = {
    ...createDefaultState('en'),
    projects: [{ id: 'proj_default', name: 'General' }, { id: 'proj_other', name: 'Client' }],
  };

  assert.equal(setDefaultProjectInState(state, 'proj_other').defaultProjectId, 'proj_other');
  assert.equal(setDefaultProjectInState(state, null), state);
  assert.equal(setDefaultProjectInState(state, 'missing'), state);
});

test('the last remaining project cannot be deleted', () => {
  const { createDefaultState, deleteProjectFromState } = loadTsModule('hooks/useStore.ts');
  const state = createDefaultState('en');

  assert.equal(deleteProjectFromState(state, 'proj_default', { mode: 'delete' }), state);
});

test('moving a deleted default project transfers every task state and routine atomically', () => {
  const { createDefaultState, deleteProjectFromState } = loadTsModule('hooks/useStore.ts');
  const state = {
    ...createDefaultState('en'),
    projects: [
      { id: 'proj_default', name: 'General' },
      { id: 'proj_next', name: 'Next' },
      { id: 'proj_later', name: 'Later' },
    ],
    tasks: [
      createTask('proj_default', { id: 'task_open' }),
      createTask('proj_default', { id: 'task_done', status: 'done', isDone: true, reflectionValue: 3 }),
      createTask('proj_later', { id: 'task_untouched' }),
    ],
    templates: [
      createTemplate('tpl_move', 'proj_default'),
      createTemplate('tpl_keep', 'proj_later'),
    ],
  };

  const nextState = deleteProjectFromState(state, 'proj_default', { mode: 'move', targetProjectId: 'proj_next' }, 42);

  assert.deepEqual(nextState.projects.map(project => project.id), ['proj_next', 'proj_later']);
  assert.equal(nextState.defaultProjectId, 'proj_next');
  assert.deepEqual(nextState.tasks.map(task => task.projectId), ['proj_next', 'proj_next', 'proj_later']);
  assert.deepEqual(nextState.tasks.map(task => task.updatedAt), [42, 42, 1]);
  assert.deepEqual(nextState.templates.map(template => template.projectId), ['proj_next', 'proj_later']);
});

test('permanent project deletion removes linked tasks and routines but keeps unrelated data', () => {
  const { createDefaultState, deleteProjectFromState } = loadTsModule('hooks/useStore.ts');
  const state = {
    ...createDefaultState('en'),
    projects: [
      { id: 'proj_default', name: 'General' },
      { id: 'proj_delete', name: 'Old client' },
    ],
    tasks: [
      createTask('proj_delete', { id: 'task_delete' }),
      createTask('proj_default', { id: 'task_keep' }),
    ],
    templates: [
      createTemplate('tpl_delete', 'proj_delete'),
      createTemplate('tpl_keep', 'proj_default'),
    ],
  };

  const nextState = deleteProjectFromState(state, 'proj_delete', { mode: 'delete' });

  assert.deepEqual(nextState.projects.map(project => project.id), ['proj_default']);
  assert.deepEqual(nextState.tasks.map(task => task.id), ['task_keep']);
  assert.deepEqual(nextState.templates.map(template => template.id), ['tpl_keep']);
  assert.equal(nextState.defaultProjectId, 'proj_default');
});

test('permanently deleting the default project selects the first remaining project', () => {
  const { createDefaultState, deleteProjectFromState } = loadTsModule('hooks/useStore.ts');
  const state = {
    ...createDefaultState('en'),
    projects: [
      { id: 'proj_default', name: 'General' },
      { id: 'proj_next', name: 'Next' },
      { id: 'proj_later', name: 'Later' },
    ],
  };

  const nextState = deleteProjectFromState(state, 'proj_default', { mode: 'delete' });

  assert.equal(nextState.defaultProjectId, 'proj_next');
});

test('project deletion ignores missing projects, missing resolutions, and invalid move targets', () => {
  const { createDefaultState, deleteProjectFromState } = loadTsModule('hooks/useStore.ts');
  const state = {
    ...createDefaultState('en'),
    projects: [
      { id: 'proj_default', name: 'General' },
      { id: 'proj_other', name: 'Other' },
    ],
  };

  assert.equal(deleteProjectFromState(state, 'missing', { mode: 'delete' }), state);
  assert.equal(deleteProjectFromState(state, 'proj_other'), state);
  assert.equal(deleteProjectFromState(state, 'proj_other', { mode: 'move', targetProjectId: 'missing' }), state);
  assert.equal(deleteProjectFromState(state, 'proj_other', { mode: 'move', targetProjectId: 'proj_other' }), state);
});

test('legacy import merging enforces limits against the complete workspace', () => {
  const { createDefaultState, mergeLegacyImportData } = loadTsModule('hooks/useStore.ts');
  const { LEGACY_IMPORT_LIMITS } = loadTsModule('utils/legacyImportUtils.ts');
  const state = {
    ...createDefaultState('en'),
    tasks: [createTask('proj_default', { id: 'existing' })],
  };
  const imported = {
    tasks: Array.from({ length: LEGACY_IMPORT_LIMITS.tasks }, (_, index) => createTask('proj_default', { id: `imported_${index}` })),
    projects: [],
    templates: [],
    goals: [],
    weeklyGoals: [],
  };

  assert.equal(mergeLegacyImportData(state, imported), null);

  const accepted = mergeLegacyImportData(state, { ...imported, tasks: imported.tasks.slice(0, -1) });
  assert.equal(accepted.tasks.length, LEGACY_IMPORT_LIMITS.tasks);
});
