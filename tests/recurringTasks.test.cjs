const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

process.env.TZ = 'Europe/Berlin';

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

const createTemplate = (overrides = {}) => ({
  id: 'tpl_1',
  title: 'Plan week',
  duration: 30,
  priority: 3,
  projectId: 'proj_default',
  recurrenceType: 'daily',
  dayOfWeek: 1,
  dayOfMonth: 1,
  timeOfDay: '09:00',
  dueDateOffsetDays: 0,
  nextGenerationDate: new Date(2026, 5, 28, 1, 0, 0).getTime(),
  ...overrides,
});

test('recurring due dates use the local calendar day for early Berlin times', () => {
  const { createRecurringTasksUpdate } = loadTsModule('utils/recurringTasks.ts');
  const generationDate = new Date(2026, 5, 28, 1, 0, 0);
  const now = new Date(2026, 5, 28, 1, 5, 0).getTime();

  const result = createRecurringTasksUpdate({
    tasks: [],
    templates: [createTemplate({ nextGenerationDate: generationDate.getTime(), dueDateOffsetDays: 0 })],
    now,
    createId: () => 'generated',
  });

  assert.equal(result.hasChanges, true);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].dueDate, '2026-06-28');
});

test('custom recurring due-date offsets are added from the generation day', () => {
  const { createRecurringTasksUpdate } = loadTsModule('utils/recurringTasks.ts');
  const generationDate = new Date(2026, 5, 28, 1, 0, 0);
  const now = new Date(2026, 5, 28, 1, 5, 0).getTime();

  const result = createRecurringTasksUpdate({
    tasks: [],
    templates: [createTemplate({ nextGenerationDate: generationDate.getTime(), dueDateOffsetDays: 3 })],
    now,
    createId: () => 'generated',
  });

  assert.equal(result.tasks[0].dueDate, '2026-07-01');
});

test('recurring generation catches up all missed daily occurrences without duplicates', () => {
  const { createRecurringTasksUpdate } = loadTsModule('utils/recurringTasks.ts');
  const now = new Date(2026, 5, 30, 10, 0, 0).getTime();

  const first = createRecurringTasksUpdate({
    tasks: [],
    templates: [createTemplate({ nextGenerationDate: new Date(2026, 5, 28, 9, 0, 0).getTime() })],
    now,
    createId: (index) => `generated_${index}`,
  });

  assert.equal(first.tasks.length, 3);
  assert.deepEqual(first.tasks.map(task => task.dueDate), ['2026-06-28', '2026-06-29', '2026-06-30']);
  assert.equal(first.templates[0].nextGenerationDate, new Date(2026, 6, 1, 9, 0, 0).getTime());

  const second = createRecurringTasksUpdate({
    tasks: first.tasks,
    templates: first.templates,
    now,
    createId: (index) => `duplicate_${index}`,
  });

  assert.equal(second.hasChanges, false);
  assert.equal(second.tasks.length, 3);
  assert.equal(second.templates[0].nextGenerationDate, new Date(2026, 6, 1, 9, 0, 0).getTime());
});

test('recurring scheduler delay is due-aware and capped', () => {
  const {
    RECURRING_TASK_TIMER_MAX_DELAY_MS,
    getNextRecurringGenerationDelay,
  } = loadTsModule('utils/recurringTasks.ts');
  const now = new Date(2026, 5, 28, 12, 0, 0).getTime();

  assert.equal(getNextRecurringGenerationDelay([
    createTemplate({ nextGenerationDate: now - 1 }),
  ], now), 0);

  assert.equal(getNextRecurringGenerationDelay([
    createTemplate({ nextGenerationDate: now + 5000 }),
  ], now), 5000);

  assert.equal(getNextRecurringGenerationDelay([
    createTemplate({ nextGenerationDate: now + RECURRING_TASK_TIMER_MAX_DELAY_MS + 5000 }),
  ], now), RECURRING_TASK_TIMER_MAX_DELAY_MS);

  assert.equal(getNextRecurringGenerationDelay([], now), null);
});

test('app wires recurring generation to a one-shot timer and return-to-app events', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'App.tsx'), 'utf8');

  assert.match(source, /recurringGenerationTimerRef/);
  assert.match(source, /window\.setTimeout\(runRecurringGeneration/);
  assert.match(source, /window\.addEventListener\('focus', runRecurringGeneration\)/);
  assert.match(source, /document\.addEventListener\('visibilitychange', handleRecurringVisibilityChange\)/);
  assert.doesNotMatch(source, /setInterval\(\(\) => \{\s*generateRecurringTasks/s);
});
