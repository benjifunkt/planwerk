const assert = require('node:assert/strict');
const test = require('node:test');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const {
  DEFAULT_ENDPOINT,
  DEFAULT_PORT,
  createMcpToolHandlers,
  hasValidBearerToken,
  isAllowedHostHeader,
  isAllowedOriginHeader,
  startMcpServer,
} = require('../mcpServer.cjs');

const FIXED_NOW = new Date(2026, 4, 26, 12, 0, 0).getTime();
const timestamp = (day, hour = 12) => new Date(2026, 4, day, hour, 0, 0).getTime();
const createTask = (values) => ({
  duration: 30,
  dueDate: null,
  priority: 3,
  projectId: null,
  status: 'backlog',
  isDone: false,
  reflectionValue: 0,
  createdAt: timestamp(1),
  updatedAt: timestamp(1),
  completedAt: null,
  reflectedAt: null,
  orderIndex: 0,
  ...values,
});
const createWeeklyGoal = (values) => ({
  createdAt: timestamp(1),
  updatedAt: timestamp(1),
  completedAt: null,
  ...values,
});
const createThreeMonthGoal = (values) => ({
  isFocused: false,
  createdAt: timestamp(1),
  updatedAt: timestamp(1),
  completedAt: null,
  ...values,
});

const SAMPLE_STATE = {
  defaultProjectId: 'proj_a',
  defaultPriority: 2,
  defaultDuration: 45,
  visibleDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  maxHoursPerDayByDay: { mon: 4, tue: 2, wed: 3, thu: 4, fri: 5, sat: 1, sun: 1 },
  projects: [
    { id: 'proj_a', name: 'Alpha' },
    { id: 'proj_b', name: 'Beta' },
  ],
  tasks: [
    createTask({ id: 'monday', title: 'Shared title', priority: 2, dueDate: '2026-05-25', projectId: 'proj_a', orderIndex: 1 }),
    createTask({ id: 'today', title: 'Today work', dueDate: '2026-05-26', status: 'tue', projectId: 'proj_a' }),
    createTask({ id: 'scheduled_done', title: 'Shared Title', priority: 5, dueDate: '2026-05-29', status: 'wed', projectId: 'proj_b', isDone: true, completedAt: timestamp(26, 10) }),
    createTask({ id: 'hidden_day', title: 'Weekend task', priority: 5, dueDate: '2026-05-30', status: 'sat', projectId: 'proj_b' }),
    createTask({ id: 'recent_done', title: 'Recent done', priority: 1, dueDate: '2026-05-20', status: 'done', projectId: 'proj_b', isDone: true, completedAt: timestamp(25) }),
    createTask({ id: 'old_done', title: 'Old done', dueDate: '2026-05-19', status: 'done', projectId: 'proj_a', isDone: true, completedAt: timestamp(1) }),
    createTask({ id: 'undated', title: 'Undated', priority: 5, dueDate: null, projectId: 'proj_a', orderIndex: 2 }),
  ],
  weeklyGoals: [
    createWeeklyGoal({ id: 'weekly_current', title: 'Focus this week', createdAt: timestamp(25), updatedAt: timestamp(25) }),
    createWeeklyGoal({ id: 'weekly_extra_open', title: 'Unexpected extra open goal', createdAt: timestamp(26), updatedAt: timestamp(26) }),
    ...Array.from({ length: 9 }, (_, index) => createWeeklyGoal({
      id: `weekly_done_${index + 1}`,
      title: `Weekly done ${index + 1}`,
      completedAt: timestamp(10 + index),
    })),
  ],
  goals: [
    createThreeMonthGoal({ id: 'open_unfocused', title: 'Explore calmly', createdAt: timestamp(1) }),
    createThreeMonthGoal({ id: 'open_focused_late', title: 'Ship steadily', isFocused: true, createdAt: timestamp(3) }),
    createThreeMonthGoal({ id: 'open_focused_early', title: 'Clarify direction', isFocused: true, createdAt: timestamp(2) }),
    ...Array.from({ length: 9 }, (_, index) => createThreeMonthGoal({
      id: `three_done_${index + 1}`,
      title: `Three month done ${index + 1}`,
      isFocused: index % 2 === 0,
      completedAt: timestamp(10 + index),
    })),
  ],
};
const aprilTimestamp = (day, hour = 12) => new Date(2026, 3, day, hour, 0, 0).getTime();
const januaryTimestamp = (day, hour = 12) => new Date(2026, 0, day, hour, 0, 0).getTime();
const LOOKBACK_STATE = {
  ...SAMPLE_STATE,
  tasks: [
    createTask({
      id: 'useful_recent',
      title: 'Meaningful work',
      duration: 60,
      priority: 4,
      dueDate: '2026-05-26',
      projectId: 'proj_a',
      status: 'done',
      isDone: true,
      reflectionValue: 3,
      completedAt: timestamp(26, 10),
      reflectedAt: timestamp(26, 11),
    }),
    createTask({
      id: 'somewhat_recent',
      title: 'Partial progress',
      duration: 30,
      projectId: 'proj_a',
      status: 'done',
      isDone: true,
      reflectionValue: 2,
      updatedAt: timestamp(24),
      reflectedAt: timestamp(25),
    }),
    createTask({
      id: 'not_useful_recent',
      title: 'Low value effort',
      duration: 30,
      projectId: 'proj_b',
      status: 'done',
      isDone: true,
      reflectionValue: 1,
      completedAt: timestamp(20),
    }),
    createTask({
      id: 'older_three_month',
      title: 'Earlier useful effort',
      duration: 120,
      projectId: 'missing_project',
      status: 'done',
      isDone: true,
      reflectionValue: 3,
      completedAt: aprilTimestamp(1),
    }),
    createTask({
      id: 'outside_three_months',
      title: 'Old partial effort',
      duration: 30,
      status: 'done',
      isDone: true,
      reflectionValue: 2,
      completedAt: januaryTimestamp(1),
    }),
    createTask({
      id: 'not_done',
      title: 'Not finished',
      isDone: false,
      reflectionValue: 3,
      completedAt: timestamp(26),
    }),
    createTask({
      id: 'unreflected_done',
      title: 'Awaiting reflection',
      status: 'done',
      isDone: true,
      reflectionValue: 0,
      completedAt: timestamp(26),
    }),
  ],
};

const ids = (result) => result.tasks.map(task => task.id);
const goalIds = (goals) => goals.map(goal => goal.id);
const createHandlers = (state = SAMPLE_STATE, overrides = {}) => createMcpToolHandlers({
  getState: async () => state,
  now: () => FIXED_NOW,
  ...overrides,
});

test('MCP endpoint and request guard stay local and bearer protected', () => {
  assert.equal(DEFAULT_ENDPOINT, 'http://127.0.0.1:3789/mcp');
  assert.equal(isAllowedHostHeader(`127.0.0.1:${DEFAULT_PORT}`), true);
  assert.equal(isAllowedHostHeader(`localhost:${DEFAULT_PORT}`), true);
  assert.equal(isAllowedHostHeader('example.com:3789'), false);
  assert.equal(isAllowedOriginHeader(undefined), true);
  assert.equal(isAllowedOriginHeader('http://127.0.0.1:3000'), true);
  assert.equal(isAllowedOriginHeader('https://example.com'), false);
  assert.equal(hasValidBearerToken('Bearer 0123456789abcdef01234567', '0123456789abcdef01234567'), true);
  assert.equal(hasValidBearerToken('Bearer wrong', '0123456789abcdef01234567'), false);
});

test('MCP server rejects host overrides to preserve the loopback-only boundary', async () => {
  await assert.rejects(
    startMcpServer({
      token: 'test-loopback-only-token-12345678',
      host: '0.0.0.0',
      port: DEFAULT_PORT + 100,
      getState: async () => null,
    }),
    /host is fixed to 127\.0\.0\.1 and cannot be overridden/,
  );
});

test('MCP handlers expose queries and explicit project and task writes', async () => {
  const handlers = createHandlers();

  assert.deepEqual(Object.keys(handlers).sort(), [
    'get_all_data', 'get_current_date', 'get_goals', 'get_lookback', 'get_projects', 'get_tasks', 'post_goal', 'post_project', 'post_task', 'set_goal_focus', 'update_task',
  ]);
  assert.deepEqual(await handlers.get_current_date(), { currentDate: 'Dienstag 26.05.2026' });
  assert.deepEqual(await createHandlers(null).get_current_date(), { currentDate: 'Dienstag 26.05.2026' });
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'all' })), ['monday', 'today', 'hidden_day', 'undated']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'all', status: 'done' })), ['old_done', 'recent_done', 'scheduled_done']);
  assert.equal((await handlers.get_tasks({ mode: 'all', status: 'all' })).tasks.length, SAMPLE_STATE.tasks.length);
});

test('get_projects lists current project names alphabetically and requires a workspace', async () => {
  assert.deepEqual(await createHandlers().get_projects(), { projects: ['Alpha', 'Beta'] });
  await assert.rejects(createHandlers(null).get_projects(), /Open a Planwerk file/);
});

test('post_project trims new names, rejects duplicates and requires a workspace', async () => {
  const posted = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    postProject: async (payload) => {
      posted.push(payload);
      return { id: 'proj_new', name: payload.name };
    },
  });

  assert.deepEqual(await handlers.post_project({ name: '  Gamma  ' }), {
    project: { id: 'proj_new', name: 'Gamma' },
  });
  assert.deepEqual(posted, [{ name: 'Gamma' }]);
  await assert.rejects(handlers.post_project({ name: ' alpha ' }), /already exists/);
  await assert.rejects(handlers.post_project({ name: ' ' }), /name/);
  await assert.rejects(createHandlers(null).post_project({ name: 'Gamma' }), /Open a Planwerk file/);
});

test('post_task applies workspace defaults and returns the created task', async () => {
  const posted = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    postTask: async (payload) => {
      posted.push(payload);
      return createTask({
        id: 'created_default',
        ...payload,
      });
    },
  });

  const result = await handlers.post_task({ title: '  Plan quietly  ' });

  assert.deepEqual(posted, [{
    title: 'Plan quietly',
    duration: 45,
    priority: 2,
    dueDate: '2026-05-26',
    projectId: 'proj_a',
    status: 'backlog',
  }]);
  assert.deepEqual(result.task, {
    id: 'created_default',
    title: 'Plan quietly',
    duration: 45,
    priority: 2,
    dueDate: '2026-05-26',
    projectName: 'Alpha',
    status: 'backlog',
    isDone: false,
    completedAt: null,
  });
  assert.equal(result.capacity, null);
  assert.deepEqual(result.affectedColumnCapacities, []);
});

test('post_task accepts explicit fields, keeps visible days and falls hidden days back to backlog', async () => {
  const posted = [];
  const mutableState = structuredClone(SAMPLE_STATE);
  const handlers = createHandlers(mutableState, {
    postTask: async (payload) => {
      posted.push(payload);
      const task = createTask({ id: `created_${posted.length}`, ...payload });
      mutableState.tasks.push(task);
      return task;
    },
  });

  const visible = await handlers.post_task({
    title: 'Ship',
    duration: 90,
    priority: 5,
    projectName: 'bEtA',
    dueDate: '2026-05-29',
    column: 'fri',
  });
  const hidden = await handlers.post_task({ title: 'Weekend', column: 'sat' });

  assert.equal(visible.task.projectName, 'Beta');
  assert.equal(visible.task.status, 'fri');
  assert.deepEqual(visible.capacity, { column: 'fri', plannedMinutes: 90, maximumMinutes: 300 });
  assert.deepEqual(visible.affectedColumnCapacities, [
    { column: 'fri', scheduledMinutes: 90, openMinutes: 90, maximumMinutes: 300 },
  ]);
  assert.equal(hidden.task.status, 'backlog');
  assert.equal(hidden.capacity, null);
  assert.deepEqual(hidden.affectedColumnCapacities, []);
  assert.equal(posted[1].status, 'backlog');
});

test('post_task validates project, date and column input and supports creating a done task', async () => {
  const posted = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    postTask: async (payload) => {
      posted.push(payload);
      return createTask({
        id: 'created_done',
        ...payload,
        isDone: payload.status === 'done',
        completedAt: payload.status === 'done' ? FIXED_NOW : null,
      });
    },
  });

  await assert.rejects(handlers.post_task({}), /title/);
  await assert.rejects(handlers.post_task({ title: 'X', duration: 0 }), /duration/);
  await assert.rejects(handlers.post_task({ title: 'X', priority: 7 }), /priority/);
  await assert.rejects(handlers.post_task({ title: 'X', dueDate: '2026-02-30' }), /dueDate/);
  await assert.rejects(handlers.post_task({ title: 'X', projectName: 'Missing' }), /get_projects/);
  await assert.rejects(handlers.post_task({ title: 'X', column: 'later' }), /column/);
  await assert.rejects(createHandlers(null).post_task({ title: 'X' }), /Open a Planwerk file/);

  const done = await handlers.post_task({ title: 'Finished', dueDate: null, column: 'done' });
  assert.equal(done.task.status, 'done');
  assert.equal(done.task.isDone, true);
  assert.equal(done.task.dueDate, '2026-05-26');
  assert.equal(done.task.completedAt, new Date(FIXED_NOW).toISOString());
  assert.equal(done.capacity, null);
  assert.deepEqual(done.affectedColumnCapacities, []);
});

test('post_task keeps due date separate from board column and reports scheduled versus open minutes', async () => {
  const mutableState = structuredClone(SAMPLE_STATE);
  const handlers = createHandlers(mutableState, {
    postTask: async (payload) => {
      const task = createTask({ id: 'created_due_only', ...payload });
      mutableState.tasks.push(task);
      return task;
    },
  });

  const result = await handlers.post_task({
    title: 'Deadline only',
    dueDate: '2026-05-27',
  });

  assert.equal(result.task.status, 'backlog');
  assert.equal(result.task.dueDate, '2026-05-27');
  assert.equal(result.capacity, null);
  assert.deepEqual(result.affectedColumnCapacities, []);
});

test('update_task selects matching open tasks and normalizes updated task fields', async () => {
  const updates = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    updateTasks: async (payload) => {
      updates.push(payload);
      return SAMPLE_STATE.tasks
        .filter(task => payload.ids.includes(task.id))
        .map(task => ({ ...task, ...payload.updates }));
    },
  });

  const result = await handlers.update_task({
    target: { mode: 'by_project', projectName: 'alpha' },
    updates: {
      title: '  Moved together  ',
      duration: 20,
      priority: 2,
      projectName: 'Beta',
      dueDate: null,
      column: 'sat',
    },
  });

  assert.deepEqual(updates, [{
    ids: ['monday', 'today', 'undated'],
    updates: {
      title: 'Moved together',
      duration: 20,
      priority: 2,
      projectId: 'proj_b',
      dueDate: '2026-05-26',
      status: 'backlog',
    },
  }]);
  assert.deepEqual(ids(result), ['monday', 'today', 'undated']);
  assert.equal(result.tasks[0].projectName, 'Beta');
  assert.deepEqual(result.affectedColumnCapacities, []);
});

test('update_task supports explicit ids, status scopes and exact-date bulk matching', async () => {
  const calls = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    updateTasks: async (payload) => {
      calls.push(payload);
      return SAMPLE_STATE.tasks.filter(task => payload.ids.includes(task.id));
    },
  });

  await handlers.update_task({
    target: { mode: 'by_id', ids: ['recent_done', 'old_done'], status: 'done' },
    updates: { priority: 4 },
  });
  await handlers.update_task({
    target: { mode: 'by_name', name: 'shared title', status: 'all' },
    updates: { duration: 60 },
  });
  await handlers.update_task({
    target: { mode: 'by_date', date: '2026-05-26' },
    updates: { title: 'Today only' },
  });

  assert.deepEqual(calls.map(call => call.ids), [
    ['recent_done', 'old_done'],
    ['monday', 'scheduled_done'],
    ['today'],
  ]);
});

test('update_task returns affected visible day capacities after mutation', async () => {
  const mutableState = structuredClone(SAMPLE_STATE);
  const handlers = createHandlers(mutableState, {
    updateTasks: async (payload) => {
      const changed = [];
      mutableState.tasks = mutableState.tasks.map((task) => {
        if (!payload.ids.includes(task.id)) return task;
        const next = { ...task, ...payload.updates };
        changed.push(next);
        return next;
      });
      return changed;
    },
  });

  const moved = await handlers.update_task({
    target: { mode: 'by_id', id: 'monday', status: 'all' },
    updates: { column: 'wed', duration: 45 },
  });
  assert.deepEqual(moved.affectedColumnCapacities, [
    { column: 'wed', scheduledMinutes: 75, openMinutes: 45, maximumMinutes: 180 },
  ]);

  const multiple = await handlers.update_task({
    target: { mode: 'by_name', name: 'shared title', status: 'all' },
    updates: { title: 'Still shared' },
  });
  assert.deepEqual(multiple.affectedColumnCapacities, [
    { column: 'wed', scheduledMinutes: 75, openMinutes: 45, maximumMinutes: 180 },
  ]);
});

test('update_task reports multiple affected visible columns and counts done work only as scheduled', async () => {
  const mutableState = {
    ...structuredClone(SAMPLE_STATE),
    tasks: [
      createTask({ id: 'visible_a', title: 'Capacity sample', status: 'tue', duration: 25, projectId: 'proj_a' }),
      createTask({ id: 'visible_b', title: 'Capacity sample', status: 'wed', duration: 40, projectId: 'proj_a', isDone: true }),
      createTask({ id: 'visible_c', title: 'Capacity sample', status: 'wed', duration: 15, projectId: 'proj_a' }),
    ],
  };
  const handlers = createHandlers(mutableState, {
    updateTasks: async (payload) => {
      const changed = [];
      mutableState.tasks = mutableState.tasks.map((task) => {
        if (!payload.ids.includes(task.id)) return task;
        const next = { ...task, ...payload.updates };
        changed.push(next);
        return next;
      });
      return changed;
    },
  });

  const result = await handlers.update_task({
    target: { mode: 'by_name', name: 'capacity sample', status: 'all' },
    updates: { priority: 4 },
  });

  assert.deepEqual(result.affectedColumnCapacities, [
    { column: 'tue', scheduledMinutes: 25, openMinutes: 25, maximumMinutes: 120 },
    { column: 'wed', scheduledMinutes: 55, openMinutes: 15, maximumMinutes: 180 },
  ]);
});

test('update_task validates atomic targets, update values and completion rules', async () => {
  const calls = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    updateTasks: async (payload) => {
      calls.push(payload);
      return SAMPLE_STATE.tasks.filter(task => payload.ids.includes(task.id));
    },
  });

  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', id: 'missing' }, updates: { priority: 2 } }), /No tasks found/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', ids: ['today', 'missing'] }, updates: { priority: 2 } }), /not found/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', id: 'today', ids: ['today'] }, updates: { priority: 2 } }), /either/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_date', date: '2026-02-30' }, updates: { priority: 2 } }), /date/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_project', projectName: 'Missing' }, updates: { priority: 2 } }), /Project not found/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', id: 'today' }, updates: {} }), /updates/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', id: 'today' }, updates: { title: ' ' } }), /title/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', id: 'today' }, updates: { duration: 0 } }), /duration/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', id: 'today' }, updates: { priority: 7 } }), /priority/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', id: 'today' }, updates: { projectName: 'Missing' } }), /get_projects/);
  await assert.rejects(handlers.update_task({ target: { mode: 'by_id', id: 'today' }, updates: { column: 'later' } }), /column/);
  await assert.rejects(createHandlers(null).update_task({ target: { mode: 'by_id', id: 'today' }, updates: { priority: 2 } }), /Open a Planwerk file/);

  await handlers.update_task({
    target: { mode: 'by_id', id: 'today' },
    updates: { column: 'done', isDone: false },
  });
  await handlers.update_task({
    target: { mode: 'by_id', id: 'recent_done', status: 'done' },
    updates: { isDone: false, projectName: null },
  });
  assert.deepEqual(calls, [
    { ids: ['today'], updates: { status: 'done', isDone: true } },
    { ids: ['recent_done'], updates: { projectId: 'proj_a', isDone: false } },
  ]);
});

test('get_tasks filters due dates and currently scheduled visible days', async () => {
  const handlers = createHandlers();

  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'today' })), ['today']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'this_week' })), ['monday', 'today', 'hidden_day']);
  const scheduled = await handlers.get_tasks({ mode: 'scheduled_this_week' });
  assert.deepEqual(ids(scheduled), ['today', 'scheduled_done']);
  assert.deepEqual(scheduled.capacity, { plannedMinutes: 30, maximumMinutes: 1080 });
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'backlog' })), ['monday', 'undated']);
  assert.equal(Object.hasOwn(await handlers.get_tasks({ mode: 'today' }), 'capacity'), false);
});

test('get_tasks filters completed tasks by completion time and formats result details', async () => {
  const handlers = createHandlers();
  const handlersWithFutureCompletion = createHandlers({
    ...SAMPLE_STATE,
    tasks: [...SAMPLE_STATE.tasks, createTask({ id: 'future_done', isDone: true, completedAt: timestamp(27) })],
  });

  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'done_last_2_weeks' })), ['scheduled_done', 'recent_done']);
  assert.deepEqual(ids(await handlersWithFutureCompletion.get_tasks({ mode: 'done_last_2_weeks' })), ['scheduled_done', 'recent_done']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'all_done' })), ['scheduled_done', 'recent_done', 'old_done']);

  const task = (await handlers.get_tasks({ mode: 'by_id', id: 'scheduled_done', status: 'all' })).tasks[0];
  assert.deepEqual(task, {
    id: 'scheduled_done',
    title: 'Shared Title',
    duration: 30,
    priority: 5,
    dueDate: '2026-05-29',
    projectName: 'Beta',
    status: 'wed',
    isDone: true,
    completedAt: new Date(timestamp(26, 10)).toISOString(),
  });
});

test('get_tasks supports project, due-date, id and exact case-insensitive name queries', async () => {
  const handlers = createHandlers();

  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'by_project', projectName: 'ALPHA' })), ['monday', 'today', 'undated']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'by_date', date: '2026-05-26', dateComparison: 'on' })), ['today']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'by_date', date: '2026-05-26', dateComparison: 'before', status: 'all' })), ['old_done', 'recent_done', 'monday']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'by_date', date: '2026-05-26', dateComparison: 'after', status: 'all' })), ['scheduled_done', 'hidden_day']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'by_id', id: 'recent_done', status: 'done' })), ['recent_done']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'by_name', name: 'shared TITLE', status: 'all' })), ['monday', 'scheduled_done']);
});

test('get_tasks validates mode-specific inputs and fixed-status modes', async () => {
  const handlers = createHandlers();

  await assert.rejects(handlers.get_tasks({ mode: 'by_project' }), /projectName/);
  await assert.rejects(handlers.get_tasks({ mode: 'by_project', projectName: 'Missing' }), /Project not found/);
  await assert.rejects(handlers.get_tasks({ mode: 'by_date', date: '2026-02-30', dateComparison: 'on' }), /date/);
  await assert.rejects(handlers.get_tasks({ mode: 'by_date', date: '2026-05-26' }), /dateComparison/);
  await assert.rejects(handlers.get_tasks({ mode: 'by_id' }), /id/);
  await assert.rejects(handlers.get_tasks({ mode: 'by_name' }), /name/);
  await assert.rejects(handlers.get_tasks({ mode: 'scheduled_this_week', status: 'open' }), /status/);
  await assert.rejects(handlers.get_tasks({ mode: 'all_done', status: 'done' }), /status/);
});

test('get_tasks sorts by date, priority or the Planwerk urgency score', async () => {
  const handlers = createHandlers();

  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'all', sort: 'date' })), ['monday', 'today', 'hidden_day', 'undated']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'all', sort: 'priority' })), ['hidden_day', 'undated', 'today', 'monday']);
  assert.deepEqual(ids(await handlers.get_tasks({ mode: 'all', sort: 'urgency_score' })), ['hidden_day', 'today', 'monday', 'undated']);
});

test('get_tasks gives a clear result until a Planwerk file is open', async () => {
  const handlers = createHandlers(null);
  await assert.rejects(handlers.get_tasks({ mode: 'all' }), /Open a Planwerk file/);
});

test('get_all_data returns complete analysis context and open board capacity', async () => {
  const state = {
    ...SAMPLE_STATE,
    tasks: [
      ...SAMPLE_STATE.tasks,
      createTask({
        id: 'reflected_latest',
        title: 'Reflected task',
        projectId: 'missing_project',
        status: 'done',
        isDone: true,
        reflectionValue: 3,
        createdAt: timestamp(20),
        updatedAt: timestamp(27),
        completedAt: timestamp(26),
        reflectedAt: timestamp(27),
      }),
    ],
  };

  const result = await createHandlers(state).get_all_data({});

  assert.equal(result.tasks[0].id, 'reflected_latest');
  assert.deepEqual(result.tasks[0], {
    id: 'reflected_latest',
    title: 'Reflected task',
    duration: 30,
    priority: 3,
    dueDate: null,
    projectName: null,
    status: 'done',
    isDone: true,
    reflectionValue: 3,
    reflectionLabel: 'useful',
    createdAt: new Date(timestamp(20)).toISOString(),
    updatedAt: new Date(timestamp(27)).toISOString(),
    completedAt: new Date(timestamp(26)).toISOString(),
    reflectedAt: new Date(timestamp(27)).toISOString(),
  });
  assert.equal(result.tasks.find(task => task.id === 'today').reflectionLabel, 'unreflected');
  assert.deepEqual(result.projects, SAMPLE_STATE.projects);
  assert.equal(result.goals.weeklyGoals[0].id, 'weekly_current');
  assert.equal(result.goals.weeklyGoals.at(-1).id, 'weekly_done_1');
  assert.equal(result.goals.threeMonthGoals[0].id, 'open_focused_early');
  assert.equal(result.goals.threeMonthGoals.at(-1).id, 'three_done_1');
  assert.deepEqual(result.planning.defaults, { duration: 45, priority: 2, projectName: 'Alpha' });
  assert.deepEqual(result.planning.visibleDays, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.deepEqual(result.planning.capacityByDay, [
    { column: 'mon', plannedMinutes: 0, maximumMinutes: 240 },
    { column: 'tue', plannedMinutes: 30, maximumMinutes: 120 },
    { column: 'wed', plannedMinutes: 0, maximumMinutes: 180 },
    { column: 'thu', plannedMinutes: 0, maximumMinutes: 240 },
    { column: 'fri', plannedMinutes: 0, maximumMinutes: 300 },
  ]);
  assert.deepEqual(result.planning.weekCapacity, { plannedMinutes: 30, maximumMinutes: 1080 });
  assert.equal(Object.hasOwn(result, 'templates'), false);
});

test('get_all_data requires an open Planwerk file', async () => {
  await assert.rejects(createHandlers(null).get_all_data({}), /Open a Planwerk file/);
});

test('get_goals returns the current weekly goal and open three-month goals in UI order', async () => {
  const result = await createHandlers().get_goals({ mode: 'current' });

  assert.deepEqual(result.weeklyGoals, [{
    id: 'weekly_current',
    title: 'Focus this week',
    completedAt: null,
  }]);
  assert.deepEqual(goalIds(result.threeMonthGoals), ['open_focused_early', 'open_focused_late', 'open_unfocused']);
  assert.deepEqual(result.threeMonthGoals[0], {
    id: 'open_focused_early',
    title: 'Clarify direction',
    isFocused: true,
    completedAt: null,
  });
});

test('get_goals returns the last eight completed goals for one goal type', async () => {
  const handlers = createHandlers();
  const weekly = await handlers.get_goals({ mode: 'completed_weekly_last_8' });
  const threeMonth = await handlers.get_goals({ mode: 'completed_three_month_last_8' });

  assert.deepEqual(goalIds(weekly.weeklyGoals), [
    'weekly_done_9', 'weekly_done_8', 'weekly_done_7', 'weekly_done_6',
    'weekly_done_5', 'weekly_done_4', 'weekly_done_3', 'weekly_done_2',
  ]);
  assert.deepEqual(weekly.threeMonthGoals, []);
  assert.deepEqual(goalIds(threeMonth.threeMonthGoals), [
    'three_done_9', 'three_done_8', 'three_done_7', 'three_done_6',
    'three_done_5', 'three_done_4', 'three_done_3', 'three_done_2',
  ]);
  assert.deepEqual(threeMonth.weeklyGoals, []);
  assert.equal(weekly.weeklyGoals[0].completedAt, new Date(timestamp(18)).toISOString());
});

test('get_goals returns all completed goals in descending completion order', async () => {
  const result = await createHandlers().get_goals({ mode: 'all_completed' });

  assert.deepEqual(goalIds(result.weeklyGoals), [
    'weekly_done_9', 'weekly_done_8', 'weekly_done_7', 'weekly_done_6', 'weekly_done_5',
    'weekly_done_4', 'weekly_done_3', 'weekly_done_2', 'weekly_done_1',
  ]);
  assert.deepEqual(goalIds(result.threeMonthGoals), [
    'three_done_9', 'three_done_8', 'three_done_7', 'three_done_6', 'three_done_5',
    'three_done_4', 'three_done_3', 'three_done_2', 'three_done_1',
  ]);
});

test('get_goals rejects invalid modes and gives a clear result until a Planwerk file is open', async () => {
  const handlers = createHandlers();

  await assert.rejects(handlers.get_goals({}), /mode/);
  await assert.rejects(handlers.get_goals({ mode: 'missing' }), /mode/);
  await assert.rejects(createHandlers(null).get_goals({ mode: 'current' }), /Open a Planwerk file/);
});

test('post_goal updates or creates a weekly goal through the focused write adapter', async () => {
  const posted = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    postGoal: async (payload) => {
      posted.push(payload);
      return createWeeklyGoal({ id: 'weekly_current', title: payload.title });
    },
  });
  const withoutOpenWeekly = {
    ...SAMPLE_STATE,
    weeklyGoals: SAMPLE_STATE.weeklyGoals.filter(goal => goal.completedAt != null),
  };
  const createHandlersWithoutOpen = createHandlers(withoutOpenWeekly, {
    postGoal: async (payload) => {
      posted.push(payload);
      return createWeeklyGoal({ id: 'weekly_new', title: payload.title });
    },
  });

  assert.deepEqual(await handlers.post_goal({ type: 'weekly', title: '  A clearer week  ' }), {
    type: 'weekly',
    goal: { id: 'weekly_current', title: 'A clearer week', completedAt: null },
  });
  assert.deepEqual(await createHandlersWithoutOpen.post_goal({ type: 'weekly', title: 'New week' }), {
    type: 'weekly',
    goal: { id: 'weekly_new', title: 'New week', completedAt: null },
  });
  assert.deepEqual(posted, [
    { type: 'weekly', title: 'A clearer week' },
    { type: 'weekly', title: 'New week' },
  ]);
});

test('post_goal creates three-month goals with explicit or existing-UI focus defaults', async () => {
  const posted = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    postGoal: async (payload) => {
      posted.push(payload);
      return createThreeMonthGoal({ id: `created_${posted.length}`, title: payload.title, isFocused: payload.isFocused });
    },
  });
  const threeFocusedState = {
    ...SAMPLE_STATE,
    goals: [
      createThreeMonthGoal({ id: 'focus_1', title: 'One', isFocused: true }),
      createThreeMonthGoal({ id: 'focus_2', title: 'Two', isFocused: true }),
      createThreeMonthGoal({ id: 'focus_3', title: 'Three', isFocused: true }),
    ],
  };
  const fullHandlers = createHandlers(threeFocusedState, {
    postGoal: async (payload) => {
      posted.push(payload);
      return createThreeMonthGoal({ id: `created_${posted.length}`, title: payload.title, isFocused: payload.isFocused });
    },
  });

  const explicit = await handlers.post_goal({ type: 'three_month', title: 'Park this', isFocused: false });
  const defaultFocused = await handlers.post_goal({ type: 'three_month', title: 'Focus this' });
  const defaultParked = await fullHandlers.post_goal({ type: 'three_month', title: 'Later' });

  assert.equal(explicit.goal.isFocused, false);
  assert.equal(defaultFocused.goal.isFocused, true);
  assert.equal(defaultParked.goal.isFocused, false);
  assert.deepEqual(posted, [
    { type: 'three_month', title: 'Park this', isFocused: false },
    { type: 'three_month', title: 'Focus this', isFocused: true },
    { type: 'three_month', title: 'Later', isFocused: false },
  ]);
});

test('post_goal validates goal writes and requires an open workspace', async () => {
  const handlers = createHandlers(SAMPLE_STATE, { postGoal: async () => null });

  await assert.rejects(handlers.post_goal({ type: 'weekly', title: ' ' }), /title/);
  await assert.rejects(handlers.post_goal({ type: 'later', title: 'X' }), /type/);
  await assert.rejects(handlers.post_goal({ type: 'weekly', title: 'X', isFocused: true }), /isFocused/);
  await assert.rejects(handlers.post_goal({ type: 'three_month', title: 'X', isFocused: 'yes' }), /isFocused/);
  await assert.rejects(createHandlers(null).post_goal({ type: 'weekly', title: 'X' }), /Open a Planwerk file/);
});

test('set_goal_focus updates only an open three-month goal and is idempotent', async () => {
  const focused = [];
  const handlers = createHandlers(SAMPLE_STATE, {
    setGoalFocus: async (payload) => {
      focused.push(payload);
      const goal = SAMPLE_STATE.goals.find(candidate => candidate.id === payload.id);
      return { ...goal, isFocused: payload.isFocused };
    },
  });

  const parked = await handlers.set_goal_focus({ id: 'open_focused_early', isFocused: false });
  const unchanged = await handlers.set_goal_focus({ id: 'open_unfocused', isFocused: false });

  assert.equal(parked.goal.isFocused, false);
  assert.equal(unchanged.goal.isFocused, false);
  assert.deepEqual(focused, [{ id: 'open_focused_early', isFocused: false }]);
  await assert.rejects(handlers.set_goal_focus({ id: 'missing', isFocused: true }), /open three-month goal/);
  await assert.rejects(handlers.set_goal_focus({ id: 'three_done_1', isFocused: false }), /open three-month goal/);
  await assert.rejects(handlers.set_goal_focus({ id: 'open_unfocused', isFocused: 'yes' }), /isFocused/);
  await assert.rejects(createHandlers(null).set_goal_focus({ id: 'open_unfocused', isFocused: true }), /Open a Planwerk file/);
});

test('get_lookback detailed returns evaluated completed tasks by analysis date and time window', async () => {
  const handlers = createHandlers(LOOKBACK_STATE);
  const recent = await handlers.get_lookback({ time: 'last_2_weeks', detail: 'detailed' });
  const threeMonths = await handlers.get_lookback({ time: 'last_3_months', detail: 'detailed' });
  const all = await handlers.get_lookback({ time: 'all', detail: 'detailed' });
  const updatedFallback = await createHandlers({
    ...SAMPLE_STATE,
    tasks: [createTask({ id: 'updated_only', status: 'done', isDone: true, reflectionValue: 3, updatedAt: timestamp(24) })],
  }).get_lookback({ time: 'all', detail: 'detailed' });

  assert.deepEqual(ids(recent), ['useful_recent', 'somewhat_recent', 'not_useful_recent']);
  assert.deepEqual(ids(threeMonths), ['useful_recent', 'somewhat_recent', 'not_useful_recent', 'older_three_month']);
  assert.deepEqual(ids(all), ['useful_recent', 'somewhat_recent', 'not_useful_recent', 'older_three_month', 'outside_three_months']);
  assert.deepEqual(recent.tasks[1], {
    id: 'somewhat_recent',
    title: 'Partial progress',
    duration: 30,
    priority: 3,
    dueDate: null,
    projectName: 'Alpha',
    completedAt: null,
    reflectedAt: new Date(timestamp(25)).toISOString(),
    analysisDate: new Date(timestamp(25)).toISOString(),
    reflectionValue: 2,
    reflectionLabel: 'somewhat_useful',
  });
  assert.equal(updatedFallback.tasks[0].analysisDate, new Date(timestamp(24)).toISOString());
});

test('get_lookback summary follows dashboard weighting, newest week order and project concerns', async () => {
  const result = await createHandlers(LOOKBACK_STATE).get_lookback({ time: 'last_2_weeks', detail: 'summary' });
  const warning = await createHandlers({
    ...SAMPLE_STATE,
    tasks: [
      createTask({
        id: 'warning_project',
        duration: 30,
        projectId: 'proj_a',
        status: 'done',
        isDone: true,
        reflectionValue: 2,
        completedAt: timestamp(26),
      }),
    ],
  }).get_lookback({ time: 'last_2_weeks', detail: 'summary' });

  assert.equal(result.time, 'last_2_weeks');
  assert.deepEqual(result.summary, {
    status: 'keep_eye',
    averageScore: 1.75,
    valueDistribution: {
      totalMinutes: 120,
      useful: { minutes: 60, percent: 50 },
      somewhatUseful: { minutes: 30, percent: 25 },
      notUseful: { minutes: 30, percent: 25 },
    },
    weeklyBreakdown: [
      { week: '2026-W21', usefulMinutes: 60, somewhatUsefulMinutes: 30, notUsefulMinutes: 0 },
      { week: '2026-W20', usefulMinutes: 0, somewhatUsefulMinutes: 0, notUsefulMinutes: 30 },
    ],
    projectEfficacy: [
      { projectName: 'Alpha', averageScore: 2.33, duration: 90 },
      { projectName: 'Beta', averageScore: 0, duration: 30 },
    ],
    projectConcerns: { urgent: ['Beta'], warning: [] },
  });
  assert.deepEqual(warning.summary.projectConcerns, { urgent: [], warning: ['Alpha'] });
});

test('get_lookback summary includes unknown projects, all-time concerns behavior and zero-duration fallback', async () => {
  const handlers = createHandlers(LOOKBACK_STATE);
  const threeMonths = await handlers.get_lookback({ time: 'last_3_months', detail: 'summary' });
  const all = await handlers.get_lookback({ time: 'all', detail: 'summary' });
  const empty = await createHandlers(SAMPLE_STATE).get_lookback({ time: 'all', detail: 'summary' });
  const zeroDuration = await createHandlers({
    ...SAMPLE_STATE,
    tasks: [
      createTask({ id: 'zero_useful', duration: 0, status: 'done', isDone: true, reflectionValue: 3, completedAt: timestamp(26) }),
      createTask({ id: 'zero_not_useful', duration: 0, status: 'done', isDone: true, reflectionValue: 1, completedAt: timestamp(25) }),
    ],
  }).get_lookback({ time: 'all', detail: 'summary' });

  assert.deepEqual(threeMonths.summary.projectEfficacy[0], { projectName: null, averageScore: 3, duration: 120 });
  assert.equal(all.summary.projectConcerns, null);
  assert.equal(empty.summary.status, 'no_reflections');
  assert.equal(empty.summary.averageScore, null);
  assert.equal(zeroDuration.summary.averageScore, 1.5);
  assert.equal(zeroDuration.summary.status, 'reprioritize');
  assert.deepEqual(zeroDuration.summary.valueDistribution, {
    totalMinutes: 0,
    useful: { minutes: 0, percent: 50 },
    somewhatUseful: { minutes: 0, percent: 0 },
    notUseful: { minutes: 0, percent: 50 },
  });
});

test('get_lookback validates input and gives a clear result until a Planwerk file is open', async () => {
  const handlers = createHandlers(LOOKBACK_STATE);

  await assert.rejects(handlers.get_lookback({ detail: 'summary' }), /time/);
  await assert.rejects(handlers.get_lookback({ time: 'last_2_weeks' }), /detail/);
  await assert.rejects(handlers.get_lookback({ time: 'year', detail: 'summary' }), /time/);
  await assert.rejects(handlers.get_lookback({ time: 'all', detail: 'raw' }), /detail/);
  await assert.rejects(createHandlers(null).get_lookback({ time: 'all', detail: 'summary' }), /Open a Planwerk file/);
});

test('streamable HTTP MCP clients see and call query and write tools with a bearer token', async (t) => {
  const token = 'test-authorization-token-12345678';
  const port = DEFAULT_PORT + 101;
  const mutableState = structuredClone(LOOKBACK_STATE);
  const postedProjects = [];
  const postedTasks = [];
  const updatedTasks = [];
  const postedGoals = [];
  const focusedGoals = [];
  const runtime = await startMcpServer({
    token,
    port,
    now: () => FIXED_NOW,
    getState: async () => mutableState,
    postProject: async (payload) => {
      postedProjects.push(payload);
      const project = { id: 'proj_created', name: payload.name };
      mutableState.projects.push(project);
      return project;
    },
    postTask: async (payload) => {
      postedTasks.push(payload);
      const task = createTask({ id: 'task_created', ...payload });
      mutableState.tasks.push(task);
      return task;
    },
    updateTasks: async (payload) => {
      updatedTasks.push(payload);
      return mutableState.tasks
        .filter(task => payload.ids.includes(task.id))
        .map(task => ({ ...task, ...payload.updates }));
    },
    postGoal: async (payload) => {
      postedGoals.push(payload);
      if (payload.type === 'weekly') {
        return createWeeklyGoal({ id: 'weekly_written', title: payload.title });
      }
      const goal = createThreeMonthGoal({ id: 'goal_written', title: payload.title, isFocused: payload.isFocused });
      mutableState.goals.push(goal);
      return goal;
    },
    setGoalFocus: async (payload) => {
      focusedGoals.push(payload);
      const goal = mutableState.goals.find(candidate => candidate.id === payload.id);
      Object.assign(goal, { isFocused: payload.isFocused });
      return goal;
    },
  });
  t.after(() => runtime.close());
  assert.equal(runtime.endpoint, `http://127.0.0.1:${port}/mcp`);

  const unauthorized = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST' });
  assert.equal(unauthorized.status, 401);
  const foreignOrigin = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Origin: 'https://example.com' },
  });
  assert.equal(foreignOrigin.status, 403);

  const client = new Client({ name: 'planwerk-test-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  t.after(() => client.close());

  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(tool => tool.name), [
    'get_current_date', 'get_tasks', 'get_goals', 'get_lookback', 'get_projects', 'post_project', 'post_task', 'update_task', 'post_goal', 'set_goal_focus', 'get_all_data',
  ]);
  const toolByName = Object.fromEntries(listed.tools.map(tool => [tool.name, tool]));
  assert.match(toolByName.get_current_date.description, /current local date/i);
  assert.match(toolByName.get_tasks.description, /scheduled_this_week/);
  assert.match(toolByName.post_task.description, /dueDate.*deadline/i);
  assert.match(toolByName.post_task.description, /column.*board/i);
  assert.match(toolByName.post_task.description, /set a matching dueDate/i);
  assert.match(toolByName.post_task.description, /default.*today/i);
  assert.match(toolByName.post_task.description, /5.*180/);
  assert.match(toolByName.post_task.description, /1 low.*5 critical/i);
  assert.match(toolByName.update_task.description, /get_tasks/);
  assert.match(JSON.stringify(toolByName.post_task.inputSchema), /Board column/);
  assert.match(JSON.stringify(toolByName.post_task.inputSchema), /also set dueDate/);
  assert.match(JSON.stringify(toolByName.post_task.inputSchema), /deadline/i);
  assert.match(JSON.stringify(toolByName.update_task.inputSchema), /If you do not know the ID/);

  const currentDate = await client.callTool({ name: 'get_current_date', arguments: {} });
  assert.equal(currentDate.isError, undefined);
  assert.match(currentDate.content[0].text, /Dienstag 26\.05\.2026/);

  const called = await client.callTool({ name: 'get_tasks', arguments: { mode: 'by_project', projectName: 'Alpha', status: 'all' } });
  assert.equal(called.isError, undefined);
  assert.match(called.content[0].text, /Meaningful work/);

  const goals = await client.callTool({ name: 'get_goals', arguments: { mode: 'current' } });
  assert.equal(goals.isError, undefined);
  assert.match(goals.content[0].text, /Focus this week/);

  const lookbackSummary = await client.callTool({ name: 'get_lookback', arguments: { time: 'all', detail: 'summary' } });
  assert.equal(lookbackSummary.isError, undefined);
  assert.match(lookbackSummary.content[0].text, /projectEfficacy/);

  const lookbackDetailed = await client.callTool({ name: 'get_lookback', arguments: { time: 'all', detail: 'detailed' } });
  assert.equal(lookbackDetailed.isError, undefined);
  assert.match(lookbackDetailed.content[0].text, /Meaningful work/);

  const projects = await client.callTool({ name: 'get_projects', arguments: {} });
  assert.equal(projects.isError, undefined);
  assert.match(projects.content[0].text, /Alpha/);

  const project = await client.callTool({ name: 'post_project', arguments: { name: 'Gamma' } });
  assert.equal(project.isError, undefined);
  assert.deepEqual(postedProjects, [{ name: 'Gamma' }]);

  const task = await client.callTool({ name: 'post_task', arguments: { title: 'Write through MCP', projectName: 'Gamma', column: 'tue' } });
  assert.equal(task.isError, undefined);
  assert.match(task.content[0].text, /Gamma/);
  assert.match(task.content[0].text, /plannedMinutes/);
  assert.match(task.content[0].text, /affectedColumnCapacities/);
  assert.match(task.content[0].text, /openMinutes/);
  assert.equal(postedTasks[0].projectId, 'proj_created');
  assert.equal(postedTasks[0].status, 'tue');

  const scheduledAfterPost = await client.callTool({ name: 'get_tasks', arguments: { mode: 'scheduled_this_week' } });
  assert.equal(scheduledAfterPost.isError, undefined);
  assert.match(scheduledAfterPost.content[0].text, /Write through MCP/);
  assert.match(scheduledAfterPost.content[0].text, /plannedMinutes/);

  const updated = await client.callTool({
    name: 'update_task',
    arguments: { target: { mode: 'by_id', id: 'task_created' }, updates: { title: 'Updated through MCP' } },
  });
  assert.equal(updated.isError, undefined);
  assert.match(updated.content[0].text, /Updated through MCP/);
  assert.match(updated.content[0].text, /affectedColumnCapacities/);
  assert.deepEqual(updatedTasks, [{ ids: ['task_created'], updates: { title: 'Updated through MCP' } }]);

  const threeMonthGoal = await client.callTool({
    name: 'post_goal',
    arguments: { type: 'three_month', title: 'A calm direction', isFocused: false },
  });
  assert.equal(threeMonthGoal.isError, undefined);
  assert.match(threeMonthGoal.content[0].text, /A calm direction/);
  assert.deepEqual(postedGoals, [{ type: 'three_month', title: 'A calm direction', isFocused: false }]);

  const focusedGoal = await client.callTool({
    name: 'set_goal_focus',
    arguments: { id: 'goal_written', isFocused: true },
  });
  assert.equal(focusedGoal.isError, undefined);
  assert.match(focusedGoal.content[0].text, /true/);
  assert.deepEqual(focusedGoals, [{ id: 'goal_written', isFocused: true }]);

  const allData = await client.callTool({ name: 'get_all_data', arguments: {} });
  assert.equal(allData.isError, undefined);
  assert.match(allData.content[0].text, /weekCapacity/);
  assert.match(allData.content[0].text, /reflectionLabel/);
});

test('streamable HTTP MCP clients receive clear tool errors without an open Planwerk file', async (t) => {
  const token = 'test-empty-workspace-token-12345678';
  const port = DEFAULT_PORT + 102;
  const runtime = await startMcpServer({
    token,
    port,
    now: () => FIXED_NOW,
    getState: async () => null,
  });
  t.after(() => runtime.close());

  const client = new Client({ name: 'planwerk-empty-workspace-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  t.after(() => client.close());

  await client.connect(transport);
  const currentDate = await client.callTool({ name: 'get_current_date', arguments: {} });
  assert.equal(currentDate.isError, undefined);
  assert.match(currentDate.content[0].text, /Dienstag 26\.05\.2026/);

  const result = await client.callTool({ name: 'get_tasks', arguments: { mode: 'all' } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Open a Planwerk file/);

  const goals = await client.callTool({ name: 'get_goals', arguments: { mode: 'current' } });
  assert.equal(goals.isError, true);
  assert.match(goals.content[0].text, /Open a Planwerk file/);

  const lookback = await client.callTool({ name: 'get_lookback', arguments: { time: 'all', detail: 'summary' } });
  assert.equal(lookback.isError, true);
  assert.match(lookback.content[0].text, /Open a Planwerk file/);

  const projects = await client.callTool({ name: 'get_projects', arguments: {} });
  assert.equal(projects.isError, true);
  assert.match(projects.content[0].text, /Open a Planwerk file/);

  const postedProject = await client.callTool({ name: 'post_project', arguments: { name: 'Gamma' } });
  assert.equal(postedProject.isError, true);
  assert.match(postedProject.content[0].text, /Open a Planwerk file/);

  const postedTask = await client.callTool({ name: 'post_task', arguments: { title: 'No file' } });
  assert.equal(postedTask.isError, true);
  assert.match(postedTask.content[0].text, /Open a Planwerk file/);

  const updatedTask = await client.callTool({
    name: 'update_task',
    arguments: { target: { mode: 'by_id', id: 'missing' }, updates: { title: 'No file' } },
  });
  assert.equal(updatedTask.isError, true);
  assert.match(updatedTask.content[0].text, /Open a Planwerk file/);

  const postedGoal = await client.callTool({
    name: 'post_goal',
    arguments: { type: 'weekly', title: 'No file' },
  });
  assert.equal(postedGoal.isError, true);
  assert.match(postedGoal.content[0].text, /Open a Planwerk file/);

  const focusedGoal = await client.callTool({
    name: 'set_goal_focus',
    arguments: { id: 'missing', isFocused: true },
  });
  assert.equal(focusedGoal.isError, true);
  assert.match(focusedGoal.content[0].text, /Open a Planwerk file/);

  const allData = await client.callTool({ name: 'get_all_data', arguments: {} });
  assert.equal(allData.isError, true);
  assert.match(allData.content[0].text, /Open a Planwerk file/);
});

test('MCP HTTP guard runs before JSON parsing and parser errors stay terse', async (t) => {
  const token = 'test-parser-guard-token-12345678';
  const port = DEFAULT_PORT + 103;
  const runtime = await startMcpServer({
    token,
    port,
    now: () => FIXED_NOW,
    getState: async () => SAMPLE_STATE,
  });
  t.after(() => runtime.close());

  const endpoint = `http://127.0.0.1:${port}/mcp`;
  const oversizedJson = JSON.stringify({ data: 'x'.repeat(33 * 1024) });
  const postJson = (headers, body) => fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });

  const malformedWithoutToken = await postJson({}, '{');
  assert.equal(malformedWithoutToken.status, 401);
  assert.doesNotMatch(await malformedWithoutToken.text(), /SyntaxError|PayloadTooLargeError|<html/i);

  const malformedWithInvalidOrigin = await postJson({
    Authorization: `Bearer ${token}`,
    Origin: 'https://example.com',
  }, '{');
  assert.equal(malformedWithInvalidOrigin.status, 403);
  assert.doesNotMatch(await malformedWithInvalidOrigin.text(), /SyntaxError|PayloadTooLargeError|<html/i);

  const oversizedWithoutToken = await postJson({}, oversizedJson);
  assert.equal(oversizedWithoutToken.status, 401);
  assert.doesNotMatch(await oversizedWithoutToken.text(), /SyntaxError|PayloadTooLargeError|<html/i);

  const malformedWithToken = await postJson({ Authorization: `Bearer ${token}` }, '{');
  assert.equal(malformedWithToken.status, 400);
  assert.match(malformedWithToken.headers.get('content-type') || '', /application\/json/);
  assert.doesNotMatch(await malformedWithToken.text(), /SyntaxError|PayloadTooLargeError|<html/i);

  const oversizedWithToken = await postJson({ Authorization: `Bearer ${token}` }, oversizedJson);
  assert.equal(oversizedWithToken.status, 413);
  assert.match(oversizedWithToken.headers.get('content-type') || '', /application\/json/);
  assert.doesNotMatch(await oversizedWithToken.text(), /SyntaxError|PayloadTooLargeError|<html/i);
});
