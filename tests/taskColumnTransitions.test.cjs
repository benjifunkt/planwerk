const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');

const loadTransitions = () => {
  const filePath = path.join(repoRoot, 'utils/taskColumnTransitions.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', output)(require, mod, mod.exports);
  return mod.exports;
};

const createTask = (overrides = {}) => ({
  id: 'task_1',
  title: 'Prepare',
  duration: 30,
  dueDate: null,
  priority: 3,
  projectId: null,
  status: 'backlog',
  isDone: false,
  reflectionValue: 0,
  createdAt: 1,
  updatedAt: 1,
  completedAt: null,
  reflectedAt: null,
  orderIndex: 0,
  ...overrides,
});

test('checkbox changes schedule only the matching terminal-column move', () => {
  const { getTaskToggleMoveTarget } = loadTransitions();

  assert.equal(getTaskToggleMoveTarget(createTask({ status: 'backlog' }), true), 'done');
  assert.equal(getTaskToggleMoveTarget(createTask({ status: 'done' }), false), 'backlog');
  assert.equal(getTaskToggleMoveTarget(createTask({ status: 'backlog' }), false), null);
  assert.equal(getTaskToggleMoveTarget(createTask({ status: 'done' }), true), null);
  assert.equal(getTaskToggleMoveTarget(createTask({ status: 'mon' }), true), null);
});

test('pending moves remain valid only while their checked state and source column match', () => {
  const { isPendingTaskMoveValid } = loadTransitions();

  assert.equal(isPendingTaskMoveValid(createTask({ status: 'backlog', isDone: true }), 'done'), true);
  assert.equal(isPendingTaskMoveValid(createTask({ status: 'backlog', isDone: false }), 'done'), false);
  assert.equal(isPendingTaskMoveValid(createTask({ status: 'done', isDone: false }), 'backlog'), true);
  assert.equal(isPendingTaskMoveValid(createTask({ status: 'done', isDone: true }), 'backlog'), false);
  assert.equal(isPendingTaskMoveValid(createTask({ status: 'tue', isDone: true }), 'done'), false);
});

test('moving into Done completes a task and moving into Backlog reopens it', () => {
  const { applyTaskColumnTransition } = loadTransitions();
  const completed = applyTaskColumnTransition(createTask(), 'done', 50);

  assert.equal(completed.status, 'done');
  assert.equal(completed.isDone, true);
  assert.equal(completed.completedAt, 50);
  assert.equal(completed.updatedAt, 50);

  const reopened = applyTaskColumnTransition(completed, 'backlog', 75);
  assert.equal(reopened.status, 'backlog');
  assert.equal(reopened.isDone, false);
  assert.equal(reopened.completedAt, null);
  assert.equal(reopened.updatedAt, 75);
});

test('terminal transitions preserve an existing completion time and day moves preserve task state', () => {
  const { applyTaskColumnTransition } = loadTransitions();
  const completedTask = createTask({ status: 'wed', isDone: true, completedAt: 25 });
  const movedToDone = applyTaskColumnTransition(completedTask, 'done', 50);
  const movedToDay = applyTaskColumnTransition(completedTask, 'fri', 60);

  assert.equal(movedToDone.completedAt, 25);
  assert.equal(movedToDay.status, 'fri');
  assert.equal(movedToDay.isDone, true);
  assert.equal(movedToDay.completedAt, 25);
});

test('board countdown uses one target-aware timer path and localized copy', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'App.tsx'), 'utf8');
  const cardSource = fs.readFileSync(path.join(repoRoot, 'components/TaskCard.tsx'), 'utf8');
  const i18nSource = fs.readFileSync(path.join(repoRoot, 'i18n.tsx'), 'utf8');

  assert.match(appSource, /startPendingTaskMove = useCallback\(\(id: string, targetColumn: TaskTerminalColumn\)/);
  assert.match(appSource, /moveTask\(id, targetColumn\)/);
  assert.match(appSource, /getTaskToggleMoveTarget\(task, isDone\)/);
  assert.match(appSource, /clearPendingTaskMove\(taskId\)/);
  assert.match(appSource, /clearPendingTaskMove\(id\);\s+deleteTask\(id\)/);
  assert.doesNotMatch(appSource, /doneReturnCountdown/);

  assert.match(cardSource, /'task\.movingToDone'/);
  assert.match(cardSource, /'task\.movingToBacklog'/);
  assert.doesNotMatch(cardSource, /Moving to Backlog in \{/);

  assert.match(i18nSource, /'task\.movingToBacklog': 'Moving to Backlog in \{count\}s'/);
  assert.match(i18nSource, /'task\.movingToDone': 'Moving to Done in \{count\}s'/);
  assert.match(i18nSource, /'task\.movingToBacklog': 'Wird in \{count\} s ins Backlog verschoben'/);
  assert.match(i18nSource, /'task\.movingToDone': 'Wird in \{count\} s nach Erledigt verschoben'/);
});
