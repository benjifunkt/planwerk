import assert from 'node:assert/strict';
import test from 'node:test';

const timelineModuleUrl = new URL('../utils/reflectionTimeline.ts', import.meta.url);
const timeline = await import(timelineModuleUrl).catch(() => null);

const getTimeline = () => {
  assert.ok(timeline, 'reflection timeline helpers should exist');
  return timeline;
};

const task = (overrides = {}) => ({
  id: 'task',
  title: 'Task',
  duration: 30,
  dueDate: null,
  priority: 3,
  projectId: null,
  status: 'done',
  isDone: true,
  reflectionValue: 0,
  createdAt: 100,
  updatedAt: 100,
  completedAt: null,
  reflectedAt: null,
  orderIndex: 0,
  ...overrides,
});

test('legacy lookback start prefers the earliest real reflection timestamp', () => {
  const { deriveLegacyFirstReflectionAt } = getTimeline();
  const tasks = [
    task({ id: 'completed', completedAt: 10 }),
    task({ id: 'later-reflection', isDone: false, reflectionValue: 3, reflectedAt: 50 }),
    task({ id: 'first-reflection', reflectionValue: 1, reflectedAt: 40, completedAt: 30 }),
  ];

  assert.equal(deriveLegacyFirstReflectionAt(tasks), 40);
});

test('legacy reflected tasks without their own timestamp use their completion time', () => {
  const { deriveLegacyFirstReflectionAt } = getTimeline();
  const tasks = [
    task({ id: 'modern', reflectionValue: 3, reflectedAt: 50, completedAt: 45 }),
    task({ id: 'legacy', reflectionValue: 2, reflectedAt: null, completedAt: 20 }),
    task({ id: 'unreflected', reflectionValue: 0, completedAt: 10 }),
  ];

  assert.equal(deriveLegacyFirstReflectionAt(tasks), 20);
});

test('legacy lookback start falls back to the earliest completed task', () => {
  const { deriveLegacyFirstReflectionAt } = getTimeline();
  const tasks = [
    task({ id: 'unfinished', isDone: false, updatedAt: 5 }),
    task({ id: 'later', completedAt: 30 }),
    task({ id: 'first', completedAt: 20 }),
    task({ id: 'legacy-done', completedAt: null, updatedAt: 25 }),
  ];

  assert.equal(deriveLegacyFirstReflectionAt(tasks), 20);
  assert.equal(deriveLegacyFirstReflectionAt([]), null);
});

test('stored null keeps a new workspace locked while a missing legacy field is derived', () => {
  const { resolveFirstReflectionAt } = getTimeline();
  const tasks = [task({ completedAt: 20 })];

  assert.equal(resolveFirstReflectionAt(null, true, tasks), null);
  assert.equal(resolveFirstReflectionAt(undefined, false, tasks), 20);
  assert.equal(resolveFirstReflectionAt(15, true, tasks), 15);
});

test('recording reflections sets timestamps once and preserves them on later edits', () => {
  const { recordTaskReflection } = getTimeline();
  const tasks = [task({ id: 'rated' })];

  const first = recordTaskReflection(tasks, null, 'rated', 3, 500);
  assert.equal(first.firstReflectionAt, 500);
  assert.equal(first.tasks[0].reflectedAt, 500);
  assert.equal(first.tasks[0].updatedAt, 500);
  assert.equal(first.tasks[0].reflectionValue, 3);

  const edited = recordTaskReflection(first.tasks, first.firstReflectionAt, 'rated', 1, 900);
  assert.equal(edited.firstReflectionAt, 500);
  assert.equal(edited.tasks[0].reflectedAt, 500);
  assert.equal(edited.tasks[0].updatedAt, 900);
  assert.equal(edited.tasks[0].reflectionValue, 1);
});

test('recording an unknown task does not start the lookback', () => {
  const { recordTaskReflection } = getTimeline();
  const tasks = [task({ id: 'known' })];
  const result = recordTaskReflection(tasks, null, 'missing', 3, 500);

  assert.equal(result.firstReflectionAt, null);
  assert.equal(result.tasks, tasks);
});
