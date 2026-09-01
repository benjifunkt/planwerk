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

test('legacy JSON import rejects arrays above the local import limits', () => {
  const { LEGACY_IMPORT_LIMITS, parseLegacyImportData } = loadTsModule('utils/legacyImportUtils.ts');
  const cases = [
    ['tasks', LEGACY_IMPORT_LIMITS.tasks, index => ({ title: `Task ${index}` })],
    ['projects', LEGACY_IMPORT_LIMITS.projects, index => ({ id: `project_${index}`, name: `Project ${index}` })],
    ['templates', LEGACY_IMPORT_LIMITS.templates, index => ({ id: `template_${index}`, title: `Template ${index}` })],
    ['goals', LEGACY_IMPORT_LIMITS.goals, index => ({ title: `Goal ${index}` })],
    ['weeklyGoals', LEGACY_IMPORT_LIMITS.weeklyGoals, index => ({ title: `Week ${index}` })],
  ];

  cases.forEach(([field, limit, createEntry]) => {
    assert.equal(
      parseLegacyImportData({ [field]: Array.from({ length: limit + 1 }, (_, index) => createEntry(index)) }),
      null,
      `${field} should be limited`
    );
  });
});

test('legacy JSON import rejects oversized legacy goal text', () => {
  const { LEGACY_IMPORT_LIMITS, parseLegacyImportData } = loadTsModule('utils/legacyImportUtils.ts');

  assert.equal(
    parseLegacyImportData({ generalGoal: 'x'.repeat(LEGACY_IMPORT_LIMITS.generalGoalCharacters + 1) }),
    null
  );
  assert.equal(
    parseLegacyImportData({ generalGoal: Array.from({ length: LEGACY_IMPORT_LIMITS.goals + 1 }, (_, index) => `Goal ${index}`).join('\n') }),
    null
  );
});

test('legacy JSON import still accepts bounded data and missing collections', () => {
  const { parseLegacyImportData } = loadTsModule('utils/legacyImportUtils.ts');

  const imported = parseLegacyImportData({
    tasks: [{ title: 'Imported task', duration: 30 }],
    projects: [{ id: 'project_1', name: 'Project 1' }],
    goals: [{ title: 'Goal' }],
    weeklyGoals: [{ title: 'Week' }],
  });

  assert.equal(imported.tasks.length, 1);
  assert.equal(imported.projects.length, 1);
  assert.equal(imported.templates.length, 0);
  assert.equal(imported.goals.length, 1);
  assert.equal(imported.weeklyGoals.length, 1);
});
