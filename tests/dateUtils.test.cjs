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

test('local ISO date helper adds configured default offsets', () => {
  const { getLocalISODateWithOffset } = loadTsModule('utils/dateUtils.ts');
  const baseDate = new Date(2026, 5, 5, 12, 0, 0);

  assert.equal(getLocalISODateWithOffset(0, baseDate), '2026-06-05');
  assert.equal(getLocalISODateWithOffset(1, baseDate), '2026-06-06');
  assert.equal(getLocalISODateWithOffset(2, baseDate), '2026-06-07');
  assert.equal(getLocalISODateWithOffset(7, baseDate), '2026-06-12');
  assert.equal(getLocalISODateWithOffset(13, baseDate), '2026-06-18');
});

test('day column due dates stay inside the current monday based week', () => {
  const { getCurrentWeekDayColumnISO } = loadTsModule('utils/dateUtils.ts');
  const friday = new Date(2026, 5, 5, 12, 0, 0);
  const sunday = new Date(2026, 5, 7, 12, 0, 0);
  const monday = new Date(2026, 5, 1, 12, 0, 0);

  assert.equal(getCurrentWeekDayColumnISO('mon', friday), '2026-06-01');
  assert.equal(getCurrentWeekDayColumnISO('fri', friday), '2026-06-05');
  assert.equal(getCurrentWeekDayColumnISO('sun', friday), '2026-06-07');
  assert.equal(getCurrentWeekDayColumnISO('mon', sunday), '2026-06-01');
  assert.equal(getCurrentWeekDayColumnISO('sun', sunday), '2026-06-07');
  assert.equal(getCurrentWeekDayColumnISO('mon', monday), '2026-06-01');
});

test('day column due dates follow a configured wednesday through tuesday planning week', () => {
  const { getCurrentWeekDayColumnISO } = loadTsModule('utils/dateUtils.ts');
  const monday = new Date(2026, 5, 8, 12, 0, 0);

  assert.equal(getCurrentWeekDayColumnISO('wed', monday, 'wed'), '2026-06-03');
  assert.equal(getCurrentWeekDayColumnISO('mon', monday, 'wed'), '2026-06-08');
  assert.equal(getCurrentWeekDayColumnISO('tue', monday, 'wed'), '2026-06-09');
});

test('week day ordering rotates from the configured first day', () => {
  const { getOrderedDayColumnIds } = loadTsModule('constants.ts');

  assert.deepEqual(getOrderedDayColumnIds('mon'), ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  assert.deepEqual(getOrderedDayColumnIds('wed'), ['wed', 'thu', 'fri', 'sat', 'sun', 'mon', 'tue']);
  assert.deepEqual(getOrderedDayColumnIds('sun'), ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
});

test('historical reflection week groups remain monday based', () => {
  const { getReflectionHistoryGroup } = loadTsModule('utils/dateUtils.ts');
  const monday = new Date(2026, 5, 8, 12, 0, 0).getTime();
  const wednesday = new Date(2026, 5, 10, 12, 0, 0).getTime();

  assert.equal(getReflectionHistoryGroup(monday, 'en', wednesday).key, 'this-week');
});

test('compact hour-minute formatter always includes hours and minutes', () => {
  const { formatCompactHourMinutes } = loadTsModule('utils/dateUtils.ts');

  assert.equal(formatCompactHourMinutes(0), '0h 0m');
  assert.equal(formatCompactHourMinutes(30), '0h 30m');
  assert.equal(formatCompactHourMinutes(60), '1h 0m');
  assert.equal(formatCompactHourMinutes(90), '1h 30m');
  assert.equal(formatCompactHourMinutes(60, '▲'), '▲1h 0m');
});
