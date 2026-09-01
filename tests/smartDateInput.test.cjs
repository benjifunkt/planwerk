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

const baseDate = new Date(2026, 5, 17, 12, 0, 0);
const earlyMonthDate = new Date(2026, 5, 3, 12, 0, 0);
const februaryDate = new Date(2028, 1, 17, 12, 0, 0);

test('smart date parser preserves current forgiving commit behavior', () => {
  const { parseSmartDateInput } = loadTsModule('utils/smartDateInput.ts');

  assert.deepEqual(parseSmartDateInput('', baseDate), {
    formatted: '17.06.2026',
    iso: '2026-06-17',
  });
  assert.deepEqual(parseSmartDateInput('2', baseDate), {
    formatted: '02.07.2026',
    iso: '2026-07-02',
  });
  assert.deepEqual(parseSmartDateInput('18', baseDate), {
    formatted: '18.06.2026',
    iso: '2026-06-18',
  });
  assert.deepEqual(parseSmartDateInput('22', baseDate), {
    formatted: '22.06.2026',
    iso: '2026-06-22',
  });
  assert.deepEqual(parseSmartDateInput('0', baseDate), {
    formatted: '01.07.2026',
    iso: '2026-07-01',
  });
  assert.deepEqual(parseSmartDateInput('0', earlyMonthDate), {
    formatted: '04.06.2026',
    iso: '2026-06-04',
  });
  assert.deepEqual(parseSmartDateInput('18.0', baseDate), {
    formatted: '18.06.2026',
    iso: '2026-06-18',
  });
  assert.deepEqual(parseSmartDateInput('2.0', baseDate), {
    formatted: '02.07.2026',
    iso: '2026-07-02',
  });
  assert.deepEqual(parseSmartDateInput('60', baseDate), {
    formatted: '30.06.2026',
    iso: '2026-06-30',
  });
  assert.deepEqual(parseSmartDateInput('01.01', baseDate), {
    formatted: '01.01.2027',
    iso: '2027-01-01',
  });
  assert.deepEqual(parseSmartDateInput('01.01.27', baseDate), {
    formatted: '01.01.2027',
    iso: '2027-01-01',
  });
});

test('smart date draft formatter keeps auto dots and typed separators', () => {
  const { formatSmartDateDraft } = loadTsModule('utils/smartDateInput.ts');

  assert.equal(formatSmartDateDraft('180', '18'), '18.0');
  assert.equal(formatSmartDateDraft('1807', '18.0'), '18.07');
  assert.equal(formatSmartDateDraft('2.', '2'), '2.');
  assert.equal(formatSmartDateDraft('2.7', '2.'), '2.7.');
  assert.equal(formatSmartDateDraft('18.07.2026', '1.07.2026', baseDate), '18');
  assert.equal(formatSmartDateDraft('4', '', baseDate), '4.');
  assert.equal(formatSmartDateDraft('45', '4', baseDate), '4.5');
  assert.equal(formatSmartDateDraft('18.7', '18.', baseDate), '18.7.');
  assert.equal(formatSmartDateDraft('18.72', '18.7', baseDate), '18.7.2');
  assert.equal(formatSmartDateDraft('18.12.2027', '18.1.2027', baseDate), '18.12');
  assert.equal(formatSmartDateDraft('3', '', februaryDate), '3.');
  assert.equal(formatSmartDateDraft('35', '3', februaryDate), '3.5');
  assert.equal(formatSmartDateDraft('18.07.20266', '18.07.2026'), '18.07.2026');
  assert.equal(formatSmartDateDraft('18.07.202', '18.07.2026'), '18.07.202');
});

test('smart date preview exposes typed text and gray suffix for valid drafts', () => {
  const { getSmartDatePreviewParts } = loadTsModule('utils/smartDateInput.ts');

  assert.deepEqual(getSmartDatePreviewParts('2', baseDate), {
    typedText: '2',
    spacer: '0',
    suffix: '.07.2026',
    formatted: '02.07.2026',
    iso: '2026-07-02',
  });
  assert.deepEqual(getSmartDatePreviewParts('0', baseDate), {
    typedText: '0',
    spacer: '',
    suffix: '1.07.2026',
    formatted: '01.07.2026',
    iso: '2026-07-01',
  });
  assert.deepEqual(getSmartDatePreviewParts('0', earlyMonthDate), {
    typedText: '0',
    spacer: '',
    suffix: '4.06.2026',
    formatted: '04.06.2026',
    iso: '2026-06-04',
  });
  assert.deepEqual(getSmartDatePreviewParts('4', baseDate), {
    typedText: '4',
    spacer: '0',
    suffix: '.07.2026',
    formatted: '04.07.2026',
    iso: '2026-07-04',
  });
  assert.deepEqual(getSmartDatePreviewParts('4.', baseDate), {
    typedText: '4.',
    spacer: '0',
    suffix: '07.2026',
    formatted: '04.07.2026',
    iso: '2026-07-04',
  });
  assert.deepEqual(getSmartDatePreviewParts('2.', baseDate), {
    typedText: '2.',
    spacer: '0',
    suffix: '07.2026',
    formatted: '02.07.2026',
    iso: '2026-07-02',
  });
  assert.deepEqual(getSmartDatePreviewParts('18', baseDate), {
    typedText: '18',
    spacer: '',
    suffix: '.06.2026',
    formatted: '18.06.2026',
    iso: '2026-06-18',
  });
  assert.deepEqual(getSmartDatePreviewParts('22', baseDate), {
    typedText: '22',
    spacer: '',
    suffix: '.06.2026',
    formatted: '22.06.2026',
    iso: '2026-06-22',
  });
  assert.deepEqual(getSmartDatePreviewParts('18.7', baseDate), {
    typedText: '18.7',
    spacer: '0',
    suffix: '.2026',
    formatted: '18.07.2026',
    iso: '2026-07-18',
  });
  assert.deepEqual(getSmartDatePreviewParts('18.7.', baseDate), {
    typedText: '18.7.',
    spacer: '0',
    suffix: '2026',
    formatted: '18.07.2026',
    iso: '2026-07-18',
  });
  assert.deepEqual(getSmartDatePreviewParts('18.0', baseDate), {
    typedText: '18.0',
    spacer: '',
    suffix: '6.2026',
    formatted: '18.06.2026',
    iso: '2026-06-18',
  });
  assert.deepEqual(getSmartDatePreviewParts('2.0', baseDate), {
    typedText: '2.0',
    spacer: '0',
    suffix: '7.2026',
    formatted: '02.07.2026',
    iso: '2026-07-02',
  });
  assert.deepEqual(getSmartDatePreviewParts('4.5', baseDate), {
    typedText: '4.5',
    spacer: '00',
    suffix: '.2027',
    formatted: '04.05.2027',
    iso: '2027-05-04',
  });
  assert.deepEqual(getSmartDatePreviewParts('3', februaryDate), {
    typedText: '3',
    spacer: '0',
    suffix: '.03.2028',
    formatted: '03.03.2028',
    iso: '2028-03-03',
  });
  assert.deepEqual(getSmartDatePreviewParts('18.07.2026', baseDate), {
    typedText: '18.07.2026',
    spacer: '',
    suffix: '',
    formatted: '18.07.2026',
    iso: '2026-07-18',
  });
});

test('smart date preview hides invalid drafts that only resolve by clamping', () => {
  const { getSmartDatePreviewParts } = loadTsModule('utils/smartDateInput.ts');

  assert.equal(getSmartDatePreviewParts('', baseDate), null);
  assert.equal(getSmartDatePreviewParts('00', baseDate), null);
  assert.equal(getSmartDatePreviewParts('60', baseDate), null);
  assert.equal(getSmartDatePreviewParts('0.13', baseDate), null);
  assert.equal(getSmartDatePreviewParts('18.00', baseDate), null);
  assert.equal(getSmartDatePreviewParts('18.13', baseDate), null);
  assert.equal(getSmartDatePreviewParts('31.04', baseDate), null);
});
