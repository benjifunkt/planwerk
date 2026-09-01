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

const readSource = (relativePath) => (
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
);

const maxHours = {
  mon: 4,
  tue: 4,
  wed: 4,
  thu: 4,
  fri: 4,
  sat: 0,
  sun: 0,
};

const createTask = ({
  id,
  status = 'backlog',
  duration = 30,
  isDone = false,
}) => ({
  id,
  title: id,
  duration,
  dueDate: null,
  priority: 3,
  projectId: null,
  status,
  isDone,
  reflectionValue: 0,
  createdAt: 1,
  updatedAt: 1,
  completedAt: isDone ? 1 : null,
  reflectedAt: null,
  orderIndex: 0,
});

test('weekly sidebar icon ignores backlog, done and hidden days when deciding whether to replace PW', () => {
  const { buildWeeklySidebarIconBars } = loadTsModule('utils/weeklySidebarIcon.ts');
  const bars = buildWeeklySidebarIconBars({
    tasks: [
      createTask({ id: 'backlog', status: 'backlog', duration: 120 }),
      createTask({ id: 'done', status: 'done', duration: 60, isDone: true }),
      createTask({ id: 'hidden-thu', status: 'thu', duration: 90 }),
    ],
    visibleDays: ['mon', 'tue', 'wed'],
    maxHoursPerDayByDay: maxHours,
  });

  assert.deepEqual(bars, []);
});

test('weekly sidebar icon keeps one bar per visible day and scales planned and done minutes', () => {
  const { buildWeeklySidebarIconBars } = loadTsModule('utils/weeklySidebarIcon.ts');
  const bars = buildWeeklySidebarIconBars({
    tasks: [
      createTask({ id: 'mon-open', status: 'mon', duration: 90 }),
      createTask({ id: 'mon-done', status: 'mon', duration: 30, isDone: true }),
      createTask({ id: 'tue-open', status: 'tue', duration: 240 }),
      createTask({ id: 'tue-done', status: 'tue', duration: 60, isDone: true }),
    ],
    visibleDays: ['mon', 'tue', 'wed'],
    maxHoursPerDayByDay: maxHours,
  });

  assert.deepEqual(bars, [
    { day: 'mon', totalMinutes: 120, doneMinutes: 30, heightPercent: 40, donePercent: 25 },
    { day: 'tue', totalMinutes: 300, doneMinutes: 60, heightPercent: 100, donePercent: 20 },
    { day: 'wed', totalMinutes: 0, doneMinutes: 0, heightPercent: 0, donePercent: 0 },
  ]);
});

test('collapsed sidebar renders the weekly icon only when the visible week has planned tasks', () => {
  const appSource = readSource('App.tsx');

  assert.match(appSource, /import \{ WeeklySidebarIcon, buildWeeklySidebarIconBars \} from '\.\/components\/WeeklySidebarIcon';/);
  assert.match(appSource, /const weeklySidebarIconBars = useMemo\(\(\) => buildWeeklySidebarIconBars\(/);
  assert.match(appSource, /visibleDays: getOrderedDayColumnIds\(state\.weekStartDay\)\.filter/);
  assert.match(appSource, /weeklySidebarIconBars\.length > 0 \?/);
  assert.match(appSource, /<WeeklySidebarIcon bars=\{weeklySidebarIconBars\} \/>/);
  assert.match(appSource, /<span className="text-lg font-black tracking-tighter uppercase whitespace-nowrap">PW<\/span>/);
  assert.match(appSource, /<h1 className="text-xl md:text-3xl font-black tracking-tighter hidden md:block uppercase">Planwerk<\/h1>/);
});

test('weekly sidebar icon aligns the miniature week bars from the top edge', () => {
  const iconSource = readSource('components/WeeklySidebarIcon.tsx');

  assert.match(iconSource, /className="flex h-7 w-9 items-start justify-center gap-0\.5"/);
  assert.match(iconSource, /className="flex h-full min-w-0 flex-1 items-start overflow-hidden bg-transparent"/);
  assert.doesNotMatch(iconSource, /items-end overflow-hidden bg-transparent/);
});
