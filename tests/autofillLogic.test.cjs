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

const isoInDays = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const localIsoInDays = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createTask = ({
  id,
  duration = 30,
  priority = 3,
  dueDate = isoInDays(30),
  status = 'backlog',
  orderIndex = 0,
  isDone = false,
}) => ({
  id,
  title: id,
  duration,
  dueDate,
  priority,
  projectId: null,
  status,
  isDone,
  reflectionValue: 0,
  createdAt: 1,
  updatedAt: 1,
  completedAt: null,
  reflectedAt: null,
  orderIndex,
});

test('autofill target days from current weekday stop at the end of the visible week', () => {
  const { createAutofillTargetDays } = loadTsModule('utils/autofillUtils.ts');
  const targetDays = createAutofillTargetDays(['mon', 'tue', 'wed', 'thu', 'fri'], 4, 'current-weekday');

  assert.deepEqual(targetDays, ['thu', 'fri']);
});

test('autofill target days from current weekday use the full visible week after it has passed', () => {
  const { createAutofillTargetDays } = loadTsModule('utils/autofillUtils.ts');
  const targetDays = createAutofillTargetDays(['mon', 'tue', 'wed'], 4, 'current-weekday');

  assert.deepEqual(targetDays, ['mon', 'tue', 'wed']);
});

test('autofill target days from current weekday fill a fresh visible week on Sunday after Friday', () => {
  const { createAutofillTargetDays } = loadTsModule('utils/autofillUtils.ts');
  const targetDays = createAutofillTargetDays(['mon', 'tue', 'wed', 'thu', 'fri'], 0, 'current-weekday');

  assert.deepEqual(targetDays, ['mon', 'tue', 'wed', 'thu', 'fri']);
});

test('autofill target days from current weekday keep future visible days before the first visible day', () => {
  const { createAutofillTargetDays } = loadTsModule('utils/autofillUtils.ts');
  const targetDays = createAutofillTargetDays(['wed', 'thu', 'fri'], 1, 'current-weekday');

  assert.deepEqual(targetDays, ['wed', 'thu', 'fri']);
});

test('autofill target days for full week include all visible days', () => {
  const { createAutofillTargetDays } = loadTsModule('utils/autofillUtils.ts');
  const targetDays = createAutofillTargetDays(['mon', 'tue', 'wed', 'thu', 'fri'], 4, 'full-week');

  assert.deepEqual(targetDays, ['mon', 'tue', 'wed', 'thu', 'fri']);
});

test('autofill full week starts on the configured weekday and skips hidden days', () => {
  const { createAutofillTargetDays } = loadTsModule('utils/autofillUtils.ts');
  const targetDays = createAutofillTargetDays(['mon', 'wed', 'fri', 'sun'], 1, 'full-week', 'wed');

  assert.deepEqual(targetDays, ['wed', 'fri', 'sun', 'mon']);
});

test('autofill from today stops at the configured end of week', () => {
  const { createAutofillTargetDays } = loadTsModule('utils/autofillUtils.ts');
  const mondayTargets = createAutofillTargetDays(['mon', 'tue', 'wed', 'thu', 'fri'], 1, 'current-weekday', 'wed');
  const tuesdayTargets = createAutofillTargetDays(['mon', 'tue', 'wed', 'thu', 'fri'], 2, 'current-weekday', 'wed');

  assert.deepEqual(mondayTargets, ['mon', 'tue']);
  assert.deepEqual(tuesdayTargets, ['tue']);
});

test('autofill target days are resolved in calendar order', () => {
  const { createAutofillTargetDays } = loadTsModule('utils/autofillUtils.ts');
  const targetDays = createAutofillTargetDays(['fri', 'mon', 'thu'], 4, 'current-weekday');

  assert.deepEqual(targetDays, ['thu', 'fri']);
});

test('autofill fills leftover capacity with the next highest fitting task and retries skipped tasks next day', () => {
  const { createAutofillAssignments } = loadTsModule('utils/autofillUtils.ts');
  const assignments = createAutofillAssignments(
    [
      createTask({ id: 'score-45-two-hours', duration: 120, priority: 5, dueDate: isoInDays(0), orderIndex: 0 }),
      createTask({ id: 'score-40-three-hours', duration: 180, priority: 5, dueDate: isoInDays(1), orderIndex: 1 }),
      createTask({ id: 'score-36-fifteen-minutes', duration: 15, priority: 4, dueDate: isoInDays(0), orderIndex: 2 }),
    ],
    ['mon', 'tue'],
    { mon: 3, tue: 3, wed: 3, thu: 3, fri: 3, sat: 3, sun: 3 }
  );

  assert.deepEqual(assignments, [
    { taskId: 'score-45-two-hours', day: 'mon', orderIndex: 0 },
    { taskId: 'score-36-fifteen-minutes', day: 'mon', orderIndex: 1 },
    { taskId: 'score-40-three-hours', day: 'tue', orderIndex: 0 },
  ]);
});

test('autofill does not refill capacity already used by completed tasks', () => {
  const { createAutofillAssignments } = loadTsModule('utils/autofillUtils.ts');
  const assignments = createAutofillAssignments(
    [
      createTask({ id: 'completed-four-hours', duration: 240, status: 'wed', isDone: true }),
      createTask({ id: 'backlog-task', duration: 30 }),
    ],
    ['wed'],
    { mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 4, sun: 4 }
  );

  assert.deepEqual(assignments, []);
});

test('autofill subtracts completed and open tasks from the same day capacity', () => {
  const { createAutofillAssignments } = loadTsModule('utils/autofillUtils.ts');
  const assignments = createAutofillAssignments(
    [
      createTask({ id: 'completed-two-hours', duration: 120, status: 'wed', isDone: true, orderIndex: 0 }),
      createTask({ id: 'open-one-hour', duration: 60, status: 'wed', orderIndex: 1 }),
      createTask({ id: 'fits-remaining-hour', duration: 60, orderIndex: 0 }),
      createTask({ id: 'no-room-left', duration: 15, orderIndex: 1 }),
    ],
    ['wed'],
    { mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 4, sun: 4 }
  );

  assert.deepEqual(assignments, [
    { taskId: 'fits-remaining-hour', day: 'wed', orderIndex: 2 },
  ]);
});

test('autofill clamps remaining capacity to zero when completed work exceeds the daily limit', () => {
  const { createAutofillAssignments } = loadTsModule('utils/autofillUtils.ts');
  const assignments = createAutofillAssignments(
    [
      createTask({ id: 'completed-over-limit', duration: 300, status: 'wed', isDone: true }),
      createTask({ id: 'backlog-task', duration: 15 }),
    ],
    ['wed'],
    { mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 4, sun: 4 }
  );

  assert.deepEqual(assignments, []);
});

test('autofill moves on to later target days when completed tasks fill the first day', () => {
  const { createAutofillAssignments } = loadTsModule('utils/autofillUtils.ts');
  const assignments = createAutofillAssignments(
    [
      createTask({ id: 'completed-first-day', duration: 240, status: 'wed', isDone: true }),
      createTask({ id: 'backlog-task', duration: 60 }),
    ],
    ['wed', 'thu'],
    { mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 4, sun: 4 }
  );

  assert.deepEqual(assignments, [
    { taskId: 'backlog-task', day: 'thu', orderIndex: 0 },
  ]);
});

test('autofill leaves tasks in backlog when they fit no visible day', () => {
  const { createAutofillAssignments } = loadTsModule('utils/autofillUtils.ts');
  const assignments = createAutofillAssignments(
    [
      createTask({ id: 'too-long', duration: 240, priority: 5, dueDate: isoInDays(0) }),
      createTask({ id: 'fits', duration: 60, priority: 4, dueDate: isoInDays(0) }),
    ],
    ['mon'],
    { mon: 3, tue: 3, wed: 3, thu: 3, fri: 3, sat: 3, sun: 3 }
  );

  assert.deepEqual(assignments, [
    { taskId: 'fits', day: 'mon', orderIndex: 0 },
  ]);
});

test('autofill picks higher priority score before an earlier deadline when both fit', () => {
  const { createAutofillAssignments } = loadTsModule('utils/autofillUtils.ts');
  const assignments = createAutofillAssignments(
    [
      createTask({ id: 'lower-score-earlier-deadline', duration: 60, priority: 3, dueDate: isoInDays(0), orderIndex: 0 }),
      createTask({ id: 'higher-score-later-deadline', duration: 60, priority: 5, dueDate: isoInDays(8), orderIndex: 1 }),
    ],
    ['mon'],
    { mon: 3, tue: 3, wed: 3, thu: 3, fri: 3, sat: 3, sun: 3 }
  );

  assert.deepEqual(assignments, [
    { taskId: 'higher-score-later-deadline', day: 'mon', orderIndex: 0 },
    { taskId: 'lower-score-earlier-deadline', day: 'mon', orderIndex: 1 },
  ]);
});

test('priority comparator uses earlier deadline when priority scores tie', () => {
  const { compareTasksByPriorityScore } = loadTsModule('utils/scoreUtils.ts');
  const earlier = createTask({ id: 'earlier', priority: 5, dueDate: isoInDays(3), orderIndex: 1 });
  const later = createTask({ id: 'later', priority: 5, dueDate: isoInDays(6), orderIndex: 0 });

  const sorted = [later, earlier].sort(compareTasksByPriorityScore);

  assert.deepEqual(sorted.map(task => task.id), ['earlier', 'later']);
});

test('onboarding score matrix ranges match the urgency calculation', () => {
  const { calculatePriorityScore, calculateUrgency, getDeadlineDistanceDays } = loadTsModule('utils/scoreUtils.ts');
  const urgencyExamples = [
    [-1, 9],
    [0, 9],
    [1, 8],
    [2, 7],
    [7, 7],
    [8, 6],
    [14, 6],
    [15, 5],
    [30, 5],
    [31, 4],
    [60, 4],
    [61, 3],
    [90, 3],
    [91, 2],
    [180, 2],
    [181, 1],
  ];

  for (const [distanceDays, urgency] of urgencyExamples) {
    const dueDate = Array.from({ length: 7 }, (_, index) => localIsoInDays(distanceDays - 3 + index))
      .find(candidate => getDeadlineDistanceDays(candidate) === distanceDays);
    assert.ok(dueDate, `expected a date with deadline distance ${distanceDays}`);
    assert.equal(calculateUrgency(dueDate), urgency);
    for (let priority = 1; priority <= 5; priority += 1) {
      assert.equal(calculatePriorityScore(priority, dueDate), priority * urgency);
    }
  }

  assert.equal(calculateUrgency(null), 1);
});

test('priority comparator keeps priority score ahead of earlier deadline', () => {
  const { compareTasksByPriorityScore, calculatePriorityScore } = loadTsModule('utils/scoreUtils.ts');
  const higherScoreLaterDeadline = createTask({ id: 'higher-score-later-deadline', priority: 5, dueDate: isoInDays(8), orderIndex: 1 });
  const lowerScoreEarlierDeadline = createTask({ id: 'lower-score-earlier-deadline', priority: 3, dueDate: isoInDays(0), orderIndex: 0 });

  assert.ok(
    calculatePriorityScore(higherScoreLaterDeadline.priority, higherScoreLaterDeadline.dueDate)
      > calculatePriorityScore(lowerScoreEarlierDeadline.priority, lowerScoreEarlierDeadline.dueDate)
  );

  const sorted = [lowerScoreEarlierDeadline, higherScoreLaterDeadline].sort(compareTasksByPriorityScore);

  assert.deepEqual(sorted.map(task => task.id), ['higher-score-later-deadline', 'lower-score-earlier-deadline']);
});

test('priority comparator can reverse direction while keeping descending as the default', () => {
  const { compareTasksByPriorityScore } = loadTsModule('utils/scoreUtils.ts');
  const higherScore = createTask({ id: 'higher-score', priority: 5, dueDate: isoInDays(8), orderIndex: 1 });
  const lowerScore = createTask({ id: 'lower-score', priority: 3, dueDate: isoInDays(0), orderIndex: 0 });

  const descending = [lowerScore, higherScore].sort(compareTasksByPriorityScore);
  const ascending = [lowerScore, higherScore].sort((a, b) => compareTasksByPriorityScore(a, b, 'asc'));

  assert.deepEqual(descending.map(task => task.id), ['higher-score', 'lower-score']);
  assert.deepEqual(ascending.map(task => task.id), ['lower-score', 'higher-score']);
});

test('priority comparator puts undated tasks after dated tasks when scores tie', () => {
  const { compareTasksByPriorityScore } = loadTsModule('utils/scoreUtils.ts');
  const undated = createTask({ id: 'undated', priority: 1, dueDate: null, orderIndex: 0 });
  const dated = createTask({ id: 'dated', priority: 1, dueDate: isoInDays(220), orderIndex: 1 });

  const sorted = [undated, dated].sort(compareTasksByPriorityScore);

  assert.deepEqual(sorted.map(task => task.id), ['dated', 'undated']);
});

test('column sort modes follow the four-step cycle', () => {
  const { getNextColumnSortMode } = loadTsModule('utils/taskSortUtils.ts');

  const modes = [];
  let mode = 'score-desc';
  for (let index = 0; index < 5; index += 1) {
    modes.push(mode);
    mode = getNextColumnSortMode(mode);
  }

  assert.deepEqual(modes, [
    'score-desc',
    'date-asc',
    'score-asc',
    'date-desc',
    'score-desc',
  ]);
});

test('column sort mode dispatcher applies score and date criteria in both directions', () => {
  const { compareTasksByColumnSortMode } = loadTsModule('utils/taskSortUtils.ts');
  const higherScoreLaterDate = createTask({
    id: 'higher-score-later-date',
    priority: 5,
    dueDate: isoInDays(8),
    orderIndex: 0,
  });
  const lowerScoreEarlierDate = createTask({
    id: 'lower-score-earlier-date',
    priority: 3,
    dueDate: isoInDays(0),
    orderIndex: 1,
  });
  const tasks = [lowerScoreEarlierDate, higherScoreLaterDate];
  const sortedIds = mode => [...tasks]
    .sort((a, b) => compareTasksByColumnSortMode(a, b, mode))
    .map(task => task.id);

  assert.deepEqual(sortedIds('score-desc'), ['higher-score-later-date', 'lower-score-earlier-date']);
  assert.deepEqual(sortedIds('date-asc'), ['lower-score-earlier-date', 'higher-score-later-date']);
  assert.deepEqual(sortedIds('score-asc'), ['lower-score-earlier-date', 'higher-score-later-date']);
  assert.deepEqual(sortedIds('date-desc'), ['higher-score-later-date', 'lower-score-earlier-date']);
});

test('date comparator sorts nearest and latest due dates first', () => {
  const { compareTasksByDueDate } = loadTsModule('utils/taskSortUtils.ts');
  const earlier = createTask({ id: 'earlier', dueDate: '2026-08-21', orderIndex: 1 });
  const later = createTask({ id: 'later', dueDate: '2026-09-10', orderIndex: 0 });

  const nearestFirst = [later, earlier].sort((a, b) => compareTasksByDueDate(a, b, 'asc'));
  const latestFirst = [earlier, later].sort((a, b) => compareTasksByDueDate(a, b, 'desc'));

  assert.deepEqual(nearestFirst.map(task => task.id), ['earlier', 'later']);
  assert.deepEqual(latestFirst.map(task => task.id), ['later', 'earlier']);
});

test('date comparator preserves manual order for matching due dates', () => {
  const { compareTasksByDueDate } = loadTsModule('utils/taskSortUtils.ts');
  const first = createTask({ id: 'first', dueDate: '2026-08-21', orderIndex: 0 });
  const second = createTask({ id: 'second', dueDate: '2026-08-21', orderIndex: 1 });

  const ascending = [second, first].sort((a, b) => compareTasksByDueDate(a, b, 'asc'));
  const descending = [second, first].sort((a, b) => compareTasksByDueDate(a, b, 'desc'));

  assert.deepEqual(ascending.map(task => task.id), ['first', 'second']);
  assert.deepEqual(descending.map(task => task.id), ['first', 'second']);
});

test('date comparator treats missing and invalid due dates as latest', () => {
  const { compareTasksByDueDate } = loadTsModule('utils/taskSortUtils.ts');
  const dated = createTask({ id: 'dated', dueDate: '2026-08-21', orderIndex: 2 });
  const undated = createTask({ id: 'undated', dueDate: null, orderIndex: 0 });
  const invalid = createTask({ id: 'invalid', dueDate: '2026-02-31', orderIndex: 1 });

  const nearestFirst = [undated, invalid, dated].sort((a, b) => compareTasksByDueDate(a, b, 'asc'));
  const latestFirst = [dated, invalid, undated].sort((a, b) => compareTasksByDueDate(a, b, 'desc'));

  assert.deepEqual(nearestFirst.map(task => task.id), ['dated', 'undated', 'invalid']);
  assert.deepEqual(latestFirst.map(task => task.id), ['undated', 'invalid', 'dated']);
});
