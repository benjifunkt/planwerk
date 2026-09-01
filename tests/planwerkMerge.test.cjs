const assert = require('assert');
const test = require('node:test');

const loadMergeModule = () => import('../planwerkMerge.js');

const baseData = () => ({
  tasks: [
    { id: 'task_1', title: 'Base', duration: 30, updatedAt: 1 },
    { id: 'task_2', title: 'Second', duration: 30, updatedAt: 1 },
  ],
  projects: [{ id: 'proj_1', name: 'General' }],
  templates: [],
  settings: { theme: 'light', language: 'en', visibleDays: ['mon', 'tue'] },
  analytics: { generalGoal: 'Base goal' },
});

test('external change without local change replaces state', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  const local = structuredClone(base);
  const external = structuredClone(base);
  external.tasks[0].title = 'External';

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.equal(result.data.tasks[0].title, 'External');
});

test('combines local and external changes to different tasks', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.tasks[0].title = 'Local task';
  external.tasks[1].title = 'External task';

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.equal(result.data.tasks.find(task => task.id === 'task_1').title, 'Local task');
  assert.equal(result.data.tasks.find(task => task.id === 'task_2').title, 'External task');
});

test('combines local and external changes to different fields of same task', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.tasks[0].title = 'Local title';
  external.tasks[0].duration = 45;

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.equal(result.data.tasks[0].title, 'Local title');
  assert.equal(result.data.tasks[0].duration, 45);
});

test('conflicts when both sides change same field differently', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.tasks[0].title = 'Local';
  external.tasks[0].title = 'External';

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, false);
  assert.match(result.reason, /tasks task_1 title/);
});

test('conflicts on delete versus edit', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.tasks = local.tasks.filter(task => task.id !== 'task_1');
  external.tasks[0].title = 'External edit';

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, false);
  assert.match(result.reason, /deleted locally and changed externally/);
});

test('merges settings and analytics field by field', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.settings.theme = 'dark';
  external.analytics.generalGoal = 'External goal';

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.equal(result.data.settings.theme, 'dark');
  assert.equal(result.data.analytics.generalGoal, 'External goal');
});

test('keeps the earliest first reflection timestamp across concurrent changes', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  base.analytics.firstReflectionAt = null;
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.analytics.firstReflectionAt = 200;
  external.analytics.firstReflectionAt = 300;

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.equal(result.data.analytics.firstReflectionAt, 200);
});

test('combines local and external changes to different goals', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  base.analytics = {
    generalGoal: 'Run a steady launch\nBuild a writing habit',
    goals: [
      { id: 'goal_1', title: 'Run a steady launch', isFocused: true, createdAt: 1, updatedAt: 1, completedAt: null },
      { id: 'goal_2', title: 'Build a writing habit', isFocused: true, createdAt: 2, updatedAt: 2, completedAt: null },
    ],
  };
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.analytics.goals[0].isFocused = false;
  local.analytics.goals[0].updatedAt = 3;
  local.analytics.generalGoal = 'Build a writing habit';
  external.analytics.goals[1].title = 'Build a daily writing habit';
  external.analytics.goals[1].updatedAt = 4;
  external.analytics.generalGoal = 'Run a steady launch\nBuild a daily writing habit';

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.equal(result.data.analytics.goals.find(goal => goal.id === 'goal_1').isFocused, false);
  assert.equal(result.data.analytics.goals.find(goal => goal.id === 'goal_2').title, 'Build a daily writing habit');
  assert.equal(result.data.analytics.generalGoal, 'Build a daily writing habit');
});

test('keeps goal merge clean when only derived generalGoal differs', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  base.analytics = {
    generalGoal: 'Ship the beta',
    goals: [
      { id: 'goal_1', title: 'Ship the beta', isFocused: true, createdAt: 1, updatedAt: 1, completedAt: null },
    ],
  };
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.analytics.generalGoal = 'Ship the beta';
  external.analytics.generalGoal = 'Ship the beta\n';

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.equal(result.data.analytics.generalGoal, 'Ship the beta');
  assert.deepEqual(result.data.analytics.goals, base.analytics.goals);
});

test('combines local and external changes to different weekly goals', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  base.analytics = {
    generalGoal: 'Ship the beta',
    goals: [
      { id: 'goal_1', title: 'Ship the beta', isFocused: true, createdAt: 1, updatedAt: 1, completedAt: null },
    ],
    weeklyGoals: [
      { id: 'weekly_goal_1', title: 'Write launch notes', createdAt: 1, updatedAt: 1, completedAt: null },
      { id: 'weekly_goal_2', title: 'Call three users', createdAt: 2, updatedAt: 2, completedAt: null },
    ],
  };
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.analytics.weeklyGoals[0].completedAt = 3;
  local.analytics.weeklyGoals[0].updatedAt = 3;
  external.analytics.weeklyGoals[1].title = 'Call five users';
  external.analytics.weeklyGoals[1].updatedAt = 4;

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.equal(result.data.analytics.weeklyGoals.find(goal => goal.id === 'weekly_goal_1').completedAt, 3);
  assert.equal(result.data.analytics.weeklyGoals.find(goal => goal.id === 'weekly_goal_2').title, 'Call five users');
});

test('keeps weekly goal analytics compatible with old files', async () => {
  const { mergePlanwerkData } = await loadMergeModule();
  const base = baseData();
  base.analytics = {
    generalGoal: 'Ship the beta',
    goals: [
      { id: 'goal_1', title: 'Ship the beta', isFocused: true, createdAt: 1, updatedAt: 1, completedAt: null },
    ],
  };
  const local = structuredClone(base);
  const external = structuredClone(base);
  local.analytics.weeklyGoals = [
    { id: 'weekly_goal_1', title: 'Write launch notes', createdAt: 2, updatedAt: 2, completedAt: null },
  ];

  const result = mergePlanwerkData(base, local, external);

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.analytics.weeklyGoals, local.analytics.weeklyGoals);
});
