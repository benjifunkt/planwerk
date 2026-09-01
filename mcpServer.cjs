const crypto = require('crypto');
const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3789;
const DEFAULT_ENDPOINT = `http://${DEFAULT_HOST}:${DEFAULT_PORT}/mcp`;
const ALLOWED_ORIGINS = new Set(['http://127.0.0.1:3000', 'http://localhost:3000']);
const DAY_COLUMNS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const TASK_COLUMNS = new Set(['backlog', ...DAY_COLUMNS, 'done']);
const GERMAN_WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const TASK_MODES = new Set([
  'all',
  'today',
  'this_week',
  'scheduled_this_week',
  'backlog',
  'done_last_2_weeks',
  'all_done',
  'by_project',
  'by_date',
  'by_id',
  'by_name',
]);
const STATUS_MODES = new Set(['open', 'done', 'all']);
const SORT_MODES = new Set(['date', 'priority', 'urgency_score']);
const DATE_COMPARISONS = new Set(['on', 'before', 'after']);
const FIXED_STATUS_MODES = new Set(['scheduled_this_week', 'done_last_2_weeks', 'all_done']);
const GOAL_MODES = new Set(['current', 'completed_weekly_last_8', 'completed_three_month_last_8', 'all_completed']);
const POST_GOAL_TYPES = new Set(['weekly', 'three_month']);
const LOOKBACK_TIMES = new Set(['last_2_weeks', 'last_3_months', 'all']);
const LOOKBACK_DETAILS = new Set(['summary', 'detailed']);
const UPDATE_TASK_TARGET_MODES = new Set(['by_id', 'by_name', 'by_project', 'by_date']);
const UPDATE_TASK_FIELDS = new Set(['title', 'duration', 'priority', 'projectName', 'dueDate', 'column', 'isDone']);
const REFLECTION_LABELS = new Map([[1, 'not_useful'], [2, 'somewhat_useful'], [3, 'useful']]);
const ALL_REFLECTION_LABELS = new Map([[0, 'unreflected'], ...REFLECTION_LABELS]);
const DAY_MS = 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * DAY_MS;

const timingSafeTokenEqual = (actual, expected) => {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const hasValidBearerToken = (authorizationHeader, expectedToken) => {
  if (typeof authorizationHeader !== 'string' || typeof expectedToken !== 'string') return false;
  const prefix = 'Bearer ';
  if (!authorizationHeader.startsWith(prefix)) return false;
  return timingSafeTokenEqual(authorizationHeader.slice(prefix.length), expectedToken);
};

const isAllowedHostHeader = (hostHeader, port = DEFAULT_PORT) => {
  if (typeof hostHeader !== 'string') return false;
  const normalized = hostHeader.toLowerCase();
  return normalized === `127.0.0.1:${port}` || normalized === `localhost:${port}`;
};

const isAllowedOriginHeader = (originHeader) => {
  if (originHeader == null) return true;
  if (typeof originHeader !== 'string') return false;
  return ALLOWED_ORIGINS.has(originHeader);
};

const createMcpRequestGuard = ({ token, port }) => (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!isAllowedHostHeader(req.headers.host, port)) {
    return res.status(403).json({ error: 'Invalid local MCP host.' });
  }
  if (!isAllowedOriginHeader(req.headers.origin)) {
    return res.status(403).json({ error: 'Invalid local MCP origin.' });
  }
  if (!hasValidBearerToken(req.headers.authorization, token)) {
    return res.status(401).json({ error: 'Missing or invalid local MCP token.' });
  }
  return next();
};

const handleMcpJsonParseError = (error, _req, res, next) => {
  if (!error) return next();
  if (res.headersSent) return next(error);

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Local MCP request body is too large.' });
  }
  return res.status(400).json({ error: 'Invalid local MCP JSON request.' });
};

const requireState = async (getState) => {
  const state = await getState();
  if (!state) {
    throw new Error('Open a Planwerk file in the app before using this tool.');
  }
  return state;
};

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDisplayDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${GERMAN_WEEKDAYS[date.getDay()]} ${day}.${month}.${year}`;
};

const parseLocalDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getStartOfLocalDay = (nowValue) => {
  const date = new Date(nowValue);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getStartOfLocalWeek = (nowValue) => {
  const date = getStartOfLocalDay(nowValue);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date;
};

const calculateUrgency = (dueDateStr, nowValue = Date.now()) => {
  if (!dueDateStr) return 1;
  const today = getStartOfLocalDay(nowValue);
  const dueDate = parseLocalDate(dueDateStr);
  if (!dueDate) return 1;
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 9;
  if (diffDays === 1) return 8;
  if (diffDays <= 7) return 7;
  if (diffDays <= 14) return 6;
  if (diffDays <= 30) return 5;
  if (diffDays <= 60) return 4;
  if (diffDays <= 90) return 3;
  if (diffDays <= 180) return 2;
  return 1;
};

const calculatePriorityScore = (priority, dueDate, nowValue = Date.now()) => (
  priority * calculateUrgency(dueDate, nowValue)
);

const validateTextParameter = (input, fieldName) => {
  if (typeof input[fieldName] !== 'string' || input[fieldName].trim() === '') {
    throw new Error(`Field "${fieldName}" is required for mode "${input.mode}".`);
  }
  if (input[fieldName].trim().length > 500) {
    throw new Error(`Field "${fieldName}" must be 500 characters or fewer.`);
  }
  return input[fieldName].trim();
};

const validateTaskQuery = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  if (!TASK_MODES.has(input.mode)) throw new Error('Field "mode" contains an unsupported task query.');
  if (input.status != null && !STATUS_MODES.has(input.status)) throw new Error('Field "status" is invalid.');
  if (input.sort != null && !SORT_MODES.has(input.sort)) throw new Error('Field "sort" is invalid.');
  if (FIXED_STATUS_MODES.has(input.mode) && input.status != null) {
    throw new Error(`Field "status" is not allowed for mode "${input.mode}".`);
  }

  const expectedFields = {
    projectName: 'by_project',
    date: 'by_date',
    dateComparison: 'by_date',
    id: 'by_id',
    name: 'by_name',
  };
  Object.entries(expectedFields).forEach(([field, mode]) => {
    if (input[field] != null && input.mode !== mode) {
      throw new Error(`Field "${field}" is only allowed for mode "${mode}".`);
    }
  });

  const query = {
    mode: input.mode,
    status: input.status || 'open',
    sort: input.sort || 'date',
  };
  if (input.mode === 'by_project') query.projectName = validateTextParameter(input, 'projectName');
  if (input.mode === 'by_id') query.id = validateTextParameter(input, 'id');
  if (input.mode === 'by_name') query.name = validateTextParameter(input, 'name');
  if (input.mode === 'by_date') {
    if (!parseLocalDate(input.date)) throw new Error('Field "date" must be a valid YYYY-MM-DD date.');
    if (!DATE_COMPARISONS.has(input.dateComparison)) {
      throw new Error('Field "dateComparison" is required for mode "by_date".');
    }
    query.date = input.date;
    query.dateComparison = input.dateComparison;
  }
  return query;
};

const validatePostProjectInput = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  if (typeof input.name !== 'string' || input.name.trim() === '') {
    throw new Error('Field "name" is required and must be a non-empty string.');
  }
  const name = input.name.trim();
  if (name.length > 500) throw new Error('Field "name" must be 500 characters or fewer.');
  return { name };
};

const validatePostTaskInput = (input = {}, state, nowValue) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  if (typeof input.title !== 'string' || input.title.trim() === '') {
    throw new Error('Field "title" is required and must be a non-empty string.');
  }
  const title = input.title.trim();
  if (title.length > 500) throw new Error('Field "title" must be 500 characters or fewer.');

  const duration = input.duration ?? state.defaultDuration ?? 30;
  if (!Number.isInteger(duration) || duration < 1 || duration > 24 * 60) {
    throw new Error('Field "duration" must be an integer between 1 and 1440.');
  }

  const priority = input.priority ?? state.defaultPriority ?? 3;
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw new Error('Field "priority" must be an integer between 1 and 5.');
  }

  let dueDate;
  if (input.dueDate == null || input.dueDate === '') {
    dueDate = getLocalDateString(getStartOfLocalDay(nowValue));
  } else {
    if (!parseLocalDate(input.dueDate)) {
      throw new Error('Field "dueDate" must be a valid YYYY-MM-DD date.');
    }
    dueDate = input.dueDate;
  }

  const projects = Array.isArray(state.projects) ? state.projects : [];
  let projectId = state.defaultProjectId || null;
  if (input.projectName != null && input.projectName !== '') {
    if (typeof input.projectName !== 'string' || input.projectName.trim() === '') {
      throw new Error('Field "projectName" must be a non-empty string.');
    }
    const projectName = input.projectName.trim();
    if (projectName.length > 500) throw new Error('Field "projectName" must be 500 characters or fewer.');
    const project = projects.find(candidate => candidate.name?.toLowerCase() === projectName.toLowerCase());
    if (!project) throw new Error('Project not found. Call "get_projects" to see available project names.');
    projectId = project.id;
  }

  let status = input.column ?? 'backlog';
  if (typeof status !== 'string' || !TASK_COLUMNS.has(status)) {
    throw new Error('Field "column" contains an unsupported column.');
  }
  if (DAY_COLUMNS.has(status) && !(state.visibleDays || []).includes(status)) {
    status = 'backlog';
  }

  return { title, duration, priority, dueDate, projectId, status };
};

const validateUpdateTaskTarget = (target = {}) => {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new Error('Field "target" is required and must be an object.');
  }
  if (!UPDATE_TASK_TARGET_MODES.has(target.mode)) {
    throw new Error('Field "target.mode" contains an unsupported task selector.');
  }
  if (target.status != null && !STATUS_MODES.has(target.status)) {
    throw new Error('Field "target.status" is invalid.');
  }
  const selection = { mode: target.mode, status: target.status || 'open' };
  if (target.mode === 'by_id') {
    const hasId = target.id != null;
    const hasIds = target.ids != null;
    if (hasId === hasIds) {
      throw new Error('Provide either field "target.id" or "target.ids" for mode "by_id".');
    }
    if (hasId) {
      selection.ids = [validateTextParameter({ mode: 'by_id', id: target.id }, 'id')];
      return selection;
    }
    if (!Array.isArray(target.ids) || target.ids.length === 0) {
      throw new Error('Field "target.ids" must be a non-empty list of task IDs.');
    }
    selection.ids = target.ids.map(id => validateTextParameter({ mode: 'by_id', id }, 'id'));
    if (new Set(selection.ids).size !== selection.ids.length) {
      throw new Error('Field "target.ids" must not contain duplicate task IDs.');
    }
    return selection;
  }
  if (target.id != null || target.ids != null) {
    throw new Error('Fields "target.id" and "target.ids" are only allowed for mode "by_id".');
  }
  if (target.mode === 'by_name') {
    selection.name = validateTextParameter({ mode: 'by_name', name: target.name }, 'name');
    return selection;
  }
  if (target.mode === 'by_project') {
    selection.projectName = validateTextParameter({ mode: 'by_project', projectName: target.projectName }, 'projectName');
    return selection;
  }
  if (!parseLocalDate(target.date)) {
    throw new Error('Field "target.date" must be a valid YYYY-MM-DD date.');
  }
  selection.date = target.date;
  return selection;
};

const validateUpdateTaskChanges = (updates, state, nowValue) => {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new Error('Field "updates" is required and must be an object.');
  }
  const fields = Object.keys(updates);
  if (fields.length === 0) throw new Error('Field "updates" must contain at least one task field.');
  const unsupportedField = fields.find(field => !UPDATE_TASK_FIELDS.has(field));
  if (unsupportedField) throw new Error(`Field "updates.${unsupportedField}" is not supported.`);

  const normalized = {};
  if (Object.hasOwn(updates, 'title')) {
    if (typeof updates.title !== 'string' || updates.title.trim() === '') {
      throw new Error('Field "updates.title" must be a non-empty string.');
    }
    normalized.title = updates.title.trim();
    if (normalized.title.length > 500) {
      throw new Error('Field "updates.title" must be 500 characters or fewer.');
    }
  }
  if (Object.hasOwn(updates, 'duration')) {
    if (!Number.isInteger(updates.duration) || updates.duration < 1 || updates.duration > 24 * 60) {
      throw new Error('Field "updates.duration" must be an integer between 1 and 1440.');
    }
    normalized.duration = updates.duration;
  }
  if (Object.hasOwn(updates, 'priority')) {
    if (!Number.isInteger(updates.priority) || updates.priority < 1 || updates.priority > 5) {
      throw new Error('Field "updates.priority" must be an integer between 1 and 5.');
    }
    normalized.priority = updates.priority;
  }
  if (Object.hasOwn(updates, 'projectName')) {
    let projectId = state.defaultProjectId || null;
    if (updates.projectName != null && updates.projectName !== '') {
      if (typeof updates.projectName !== 'string' || updates.projectName.trim() === '') {
        throw new Error('Field "updates.projectName" must be a non-empty string or null.');
      }
      const projectName = updates.projectName.trim();
      if (projectName.length > 500) {
        throw new Error('Field "updates.projectName" must be 500 characters or fewer.');
      }
      const project = (state.projects || []).find(candidate => (
        candidate.name?.toLowerCase() === projectName.toLowerCase()
      ));
      if (!project) throw new Error('Project not found. Call "get_projects" to see available project names.');
      projectId = project.id;
    }
    normalized.projectId = projectId;
  }
  if (Object.hasOwn(updates, 'dueDate')) {
    if (updates.dueDate == null || updates.dueDate === '') {
      normalized.dueDate = getLocalDateString(getStartOfLocalDay(nowValue));
    } else {
      if (!parseLocalDate(updates.dueDate)) {
        throw new Error('Field "updates.dueDate" must be a valid YYYY-MM-DD date.');
      }
      normalized.dueDate = updates.dueDate;
    }
  }
  if (Object.hasOwn(updates, 'column')) {
    if (typeof updates.column !== 'string' || !TASK_COLUMNS.has(updates.column)) {
      throw new Error('Field "updates.column" contains an unsupported column.');
    }
    normalized.status = DAY_COLUMNS.has(updates.column) && !(state.visibleDays || []).includes(updates.column)
      ? 'backlog'
      : updates.column;
  }
  if (Object.hasOwn(updates, 'isDone')) {
    if (typeof updates.isDone !== 'boolean') {
      throw new Error('Field "updates.isDone" must be a boolean.');
    }
    normalized.isDone = updates.isDone;
  }
  if (normalized.status === 'done') normalized.isDone = true;
  return normalized;
};

const compareTieBreaker = (a, b) => {
  const orderDifference = (a.orderIndex || 0) - (b.orderIndex || 0);
  return orderDifference || String(a.id).localeCompare(String(b.id));
};

const compareDueDates = (a, b) => {
  const dueA = a.dueDate ? parseLocalDate(a.dueDate)?.getTime() : null;
  const dueB = b.dueDate ? parseLocalDate(b.dueDate)?.getTime() : null;
  if (dueA == null && dueB != null) return 1;
  if (dueA != null && dueB == null) return -1;
  if (dueA != null && dueB != null && dueA !== dueB) return dueA - dueB;
  return compareTieBreaker(a, b);
};

const compareCompletedDates = (a, b) => {
  if (a.completedAt == null && b.completedAt != null) return 1;
  if (a.completedAt != null && b.completedAt == null) return -1;
  if (a.completedAt != null && b.completedAt != null && a.completedAt !== b.completedAt) {
    return b.completedAt - a.completedAt;
  }
  return compareTieBreaker(a, b);
};

const sortTasks = (tasks, query, nowValue) => {
  const isDoneMode = query.mode === 'done_last_2_weeks' || query.mode === 'all_done';
  const relevantDateComparison = isDoneMode ? compareCompletedDates : compareDueDates;
  return [...tasks].sort((a, b) => {
    if (query.sort === 'priority' && a.priority !== b.priority) return b.priority - a.priority;
    if (query.sort === 'urgency_score') {
      const difference = calculatePriorityScore(b.priority, b.dueDate, nowValue)
        - calculatePriorityScore(a.priority, a.dueDate, nowValue);
      if (difference !== 0) return difference;
      return compareDueDates(a, b);
    }
    return relevantDateComparison(a, b);
  });
};

const filterByStatus = (tasks, status) => {
  if (status === 'all') return tasks;
  return tasks.filter(task => status === 'done' ? task.isDone : !task.isDone);
};

const mapTaskResult = (task, projects) => ({
  id: task.id,
  title: task.title,
  duration: task.duration,
  priority: task.priority,
  dueDate: task.dueDate || null,
  projectName: projects.find(project => project.id === task.projectId)?.name || null,
  status: task.status,
  isDone: Boolean(task.isDone),
  completedAt: typeof task.completedAt === 'number' ? new Date(task.completedAt).toISOString() : null,
});

const toIsoTimestamp = (timestamp) => (
  typeof timestamp === 'number' ? new Date(timestamp).toISOString() : null
);

const getVisibleDays = (state) => (
  (state.visibleDays || []).filter(day => DAY_COLUMNS.has(day))
);

const getDayCapacity = (state, column) => ({
  column,
  plannedMinutes: (state.tasks || [])
    .filter(task => task.status === column && !task.isDone)
    .reduce((sum, task) => sum + (task.duration || 0), 0),
  maximumMinutes: (state.maxHoursPerDayByDay?.[column] || 0) * 60,
});

const getDayMutationCapacity = (state, column) => ({
  column,
  scheduledMinutes: (state.tasks || [])
    .filter(task => task.status === column)
    .reduce((sum, task) => sum + (task.duration || 0), 0),
  openMinutes: (state.tasks || [])
    .filter(task => task.status === column && !task.isDone)
    .reduce((sum, task) => sum + (task.duration || 0), 0),
  maximumMinutes: (state.maxHoursPerDayByDay?.[column] || 0) * 60,
});

const getAffectedColumnCapacities = (state, tasks) => {
  const affectedColumns = new Set((tasks || [])
    .map(task => task?.status)
    .filter(column => DAY_COLUMNS.has(column) && getVisibleDays(state).includes(column)));

  return getVisibleDays(state)
    .filter(column => affectedColumns.has(column))
    .map(column => getDayMutationCapacity(state, column));
};

const getWeekCapacity = (state) => getVisibleDays(state)
  .map(day => getDayCapacity(state, day))
  .reduce((capacity, day) => ({
    plannedMinutes: capacity.plannedMinutes + day.plannedMinutes,
    maximumMinutes: capacity.maximumMinutes + day.maximumMinutes,
  }), { plannedMinutes: 0, maximumMinutes: 0 });

const mapAnalysisTaskResult = (task, projects) => ({
  ...mapTaskResult(task, projects),
  reflectionValue: task.reflectionValue,
  reflectionLabel: ALL_REFLECTION_LABELS.get(task.reflectionValue) || 'unreflected',
  createdAt: toIsoTimestamp(task.createdAt),
  updatedAt: toIsoTimestamp(task.updatedAt),
  reflectedAt: toIsoTimestamp(task.reflectedAt),
});

const validateGoalQuery = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  if (!GOAL_MODES.has(input.mode)) throw new Error('Field "mode" contains an unsupported goal query.');
  return { mode: input.mode };
};

const validatePostGoalInput = (input = {}, state) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  if (!POST_GOAL_TYPES.has(input.type)) throw new Error('Field "type" contains an unsupported goal type.');
  if (typeof input.title !== 'string' || input.title.trim() === '') {
    throw new Error('Field "title" is required and must be a non-empty string.');
  }
  const title = input.title.trim();
  if (title.length > 500) throw new Error('Field "title" must be 500 characters or fewer.');
  if (input.type === 'weekly') {
    if (Object.hasOwn(input, 'isFocused')) {
      throw new Error('Field "isFocused" is only allowed for three-month goals.');
    }
    return { type: input.type, title };
  }
  if (Object.hasOwn(input, 'isFocused') && typeof input.isFocused !== 'boolean') {
    throw new Error('Field "isFocused" must be a boolean.');
  }
  const focusedOpenCount = (state.goals || []).filter(goal => goal.completedAt == null && goal.isFocused).length;
  return {
    type: input.type,
    title,
    isFocused: Object.hasOwn(input, 'isFocused') ? input.isFocused : focusedOpenCount < 3,
  };
};

const validateGoalFocusInput = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  if (typeof input.id !== 'string' || input.id.trim() === '') {
    throw new Error('Field "id" is required and must be a non-empty string.');
  }
  if (input.id.trim().length > 500) throw new Error('Field "id" must be 500 characters or fewer.');
  if (typeof input.isFocused !== 'boolean') throw new Error('Field "isFocused" must be a boolean.');
  return { id: input.id.trim(), isFocused: input.isFocused };
};

const compareCompletedGoals = (a, b) => (
  b.completedAt - a.completedAt
  || a.createdAt - b.createdAt
  || String(a.id).localeCompare(String(b.id))
);

const compareCurrentThreeMonthGoals = (a, b) => {
  if (a.isFocused !== b.isFocused) return a.isFocused ? -1 : 1;
  return a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id));
};

const mapWeeklyGoalResult = (goal) => ({
  id: goal.id,
  title: goal.title,
  completedAt: typeof goal.completedAt === 'number' ? new Date(goal.completedAt).toISOString() : null,
});

const mapThreeMonthGoalResult = (goal) => ({
  id: goal.id,
  title: goal.title,
  isFocused: Boolean(goal.isFocused),
  completedAt: typeof goal.completedAt === 'number' ? new Date(goal.completedAt).toISOString() : null,
});

const mapAnalysisWeeklyGoalResult = (goal) => ({
  ...mapWeeklyGoalResult(goal),
  createdAt: toIsoTimestamp(goal.createdAt),
  updatedAt: toIsoTimestamp(goal.updatedAt),
});

const mapAnalysisThreeMonthGoalResult = (goal) => ({
  ...mapThreeMonthGoalResult(goal),
  createdAt: toIsoTimestamp(goal.createdAt),
  updatedAt: toIsoTimestamp(goal.updatedAt),
});

const compareAnalysisWeeklyGoals = (a, b) => {
  if ((a.completedAt == null) !== (b.completedAt == null)) return a.completedAt == null ? -1 : 1;
  if (a.completedAt != null) return compareCompletedGoals(a, b);
  return a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id));
};

const compareAnalysisThreeMonthGoals = (a, b) => {
  if ((a.completedAt == null) !== (b.completedAt == null)) return a.completedAt == null ? -1 : 1;
  if (a.completedAt != null) return compareCompletedGoals(a, b);
  return compareCurrentThreeMonthGoals(a, b);
};

const validateLookbackQuery = (input = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  if (!LOOKBACK_TIMES.has(input.time)) throw new Error('Field "time" contains an unsupported lookback window.');
  if (!LOOKBACK_DETAILS.has(input.detail)) throw new Error('Field "detail" contains an unsupported lookback detail.');
  return { time: input.time, detail: input.detail };
};

const getLookbackTimestamp = (task) => task.completedAt ?? task.reflectedAt ?? task.updatedAt;

const getReflectionScore = (reflectionValue) => {
  if (reflectionValue === 3) return 3;
  if (reflectionValue === 2) return 1;
  return 0;
};

const getLookbackStart = (time, nowValue) => {
  if (time === 'last_2_weeks') return nowValue - TWO_WEEKS_MS;
  if (time === 'last_3_months') {
    const threeMonthsAgo = new Date(nowValue);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return threeMonthsAgo.getTime();
  }
  return null;
};

const getLookbackItems = (state, query, nowValue) => {
  const start = getLookbackStart(query.time, nowValue);
  return (Array.isArray(state.tasks) ? state.tasks : [])
    .filter(task => task.isDone && REFLECTION_LABELS.has(task.reflectionValue))
    .map(task => ({
      task,
      timestamp: getLookbackTimestamp(task),
      duration: Math.max(0, task.duration || 0),
    }))
    .filter(item => typeof item.timestamp === 'number' && (start == null || item.timestamp >= start))
    .sort((a, b) => b.timestamp - a.timestamp || String(a.task.id).localeCompare(String(b.task.id)));
};

const getLookbackStatus = (averageScore, notUsefulPercent) => {
  if (averageScore < 1.0 || notUsefulPercent >= 40) return 'reprioritize';
  if (averageScore < 1.5 || notUsefulPercent >= 30) return 'recalibrate';
  if (averageScore < 2.1 || notUsefulPercent >= 20) return 'keep_eye';
  if (averageScore >= 2.6 && notUsefulPercent <= 10) return 'very_strong';
  return 'good_range';
};

const buildLookbackDistribution = (items) => {
  const minutes = { useful: 0, somewhatUseful: 0, notUseful: 0 };
  const counts = { useful: 0, somewhatUseful: 0, notUseful: 0 };
  items.forEach(({ task, duration }) => {
    const key = task.reflectionValue === 3
      ? 'useful'
      : task.reflectionValue === 2 ? 'somewhatUseful' : 'notUseful';
    minutes[key] += duration;
    counts[key] += 1;
  });
  const totalMinutes = minutes.useful + minutes.somewhatUseful + minutes.notUseful;
  const denominator = totalMinutes > 0 ? totalMinutes : items.length;
  const getPercent = (key) => (
    denominator > 0 ? ((totalMinutes > 0 ? minutes[key] : counts[key]) / denominator) * 100 : 0
  );
  return {
    totalMinutes,
    useful: { minutes: minutes.useful, percent: getPercent('useful') },
    somewhatUseful: { minutes: minutes.somewhatUseful, percent: getPercent('somewhatUseful') },
    notUseful: { minutes: minutes.notUseful, percent: getPercent('notUseful') },
  };
};

const buildLookbackSummaryStatus = (items, valueDistribution) => {
  if (items.length === 0) return { status: 'no_reflections', averageScore: null };
  const totalScore = items.reduce((sum, item) => sum + (getReflectionScore(item.task.reflectionValue) * item.duration), 0);
  const averageScore = valueDistribution.totalMinutes > 0
    ? totalScore / valueDistribution.totalMinutes
    : items.reduce((sum, item) => sum + getReflectionScore(item.task.reflectionValue), 0) / items.length;
  return { status: getLookbackStatus(averageScore, valueDistribution.notUseful.percent), averageScore };
};

const getWeekString = (timestamp) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  const startDate = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startDate.getTime()) / DAY_MS);
  const weekNumber = Math.ceil(days / 7);
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const buildLookbackWeeklyBreakdown = (items) => {
  const dataByWeek = new Map();
  items.forEach(({ task, timestamp, duration }) => {
    const week = getWeekString(timestamp);
    const entry = dataByWeek.get(week) || {
      week,
      timestamp,
      usefulMinutes: 0,
      somewhatUsefulMinutes: 0,
      notUsefulMinutes: 0,
    };
    entry.timestamp = Math.max(entry.timestamp, timestamp);
    if (task.reflectionValue === 3) entry.usefulMinutes += duration;
    if (task.reflectionValue === 2) entry.somewhatUsefulMinutes += duration;
    if (task.reflectionValue === 1) entry.notUsefulMinutes += duration;
    dataByWeek.set(week, entry);
  });
  return [...dataByWeek.values()]
    .sort((a, b) => b.timestamp - a.timestamp || b.week.localeCompare(a.week))
    .map(({ timestamp, ...entry }) => entry);
};

const buildLookbackProjectEfficacy = (items, projects) => {
  const dataByProject = new Map();
  items.forEach(({ task, duration }) => {
    if (!task.projectId) return;
    const entry = dataByProject.get(task.projectId) || {
      projectName: projects.find(project => project.id === task.projectId)?.name || null,
      weightedScore: 0,
      duration: 0,
    };
    entry.weightedScore += getReflectionScore(task.reflectionValue) * duration;
    entry.duration += duration;
    dataByProject.set(task.projectId, entry);
  });
  return [...dataByProject.values()]
    .filter(project => project.duration > 0)
    .sort((a, b) => (b.weightedScore / b.duration) - (a.weightedScore / a.duration))
    .map(project => ({
      projectName: project.projectName,
      averageScore: Number((project.weightedScore / project.duration).toFixed(2)),
      duration: project.duration,
    }));
};

const mapLookbackTaskResult = (item, projects) => ({
  id: item.task.id,
  title: item.task.title,
  duration: item.task.duration,
  priority: item.task.priority,
  dueDate: item.task.dueDate || null,
  projectName: projects.find(project => project.id === item.task.projectId)?.name || null,
  completedAt: typeof item.task.completedAt === 'number' ? new Date(item.task.completedAt).toISOString() : null,
  reflectedAt: typeof item.task.reflectedAt === 'number' ? new Date(item.task.reflectedAt).toISOString() : null,
  analysisDate: new Date(item.timestamp).toISOString(),
  reflectionValue: item.task.reflectionValue,
  reflectionLabel: REFLECTION_LABELS.get(item.task.reflectionValue),
});

const createMcpToolHandlers = ({ getState, postProject, postTask, updateTasks, postGoal, setGoalFocus, now = Date.now }) => ({
  get_current_date: async () => ({
    currentDate: getDisplayDateString(new Date(now())),
  }),
  get_tasks: async (input) => {
    const query = validateTaskQuery(input);
    const state = await requireState(getState);
    const nowValue = now();
    const allTasks = Array.isArray(state.tasks) ? state.tasks : [];
    const projects = Array.isArray(state.projects) ? state.projects : [];
    let tasks;

    if (query.mode === 'scheduled_this_week') {
      const visibleDays = new Set((state.visibleDays || []).filter(day => DAY_COLUMNS.has(day)));
      tasks = allTasks.filter(task => visibleDays.has(task.status));
    } else if (query.mode === 'done_last_2_weeks') {
      tasks = allTasks.filter(task => (
        task.isDone
        && typeof task.completedAt === 'number'
        && task.completedAt >= nowValue - TWO_WEEKS_MS
        && task.completedAt <= nowValue
      ));
    } else if (query.mode === 'all_done') {
      tasks = allTasks.filter(task => task.isDone);
    } else {
      tasks = filterByStatus(allTasks, query.status);
      const today = getLocalDateString(getStartOfLocalDay(nowValue));
      const weekStart = getStartOfLocalWeek(nowValue);
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      switch (query.mode) {
        case 'today':
          tasks = tasks.filter(task => task.dueDate === today);
          break;
        case 'this_week':
          tasks = tasks.filter(task => {
            const dueDate = parseLocalDate(task.dueDate);
            return dueDate && dueDate >= weekStart && dueDate < nextWeekStart;
          });
          break;
        case 'backlog':
          tasks = tasks.filter(task => task.status === 'backlog');
          break;
        case 'by_project': {
          const project = projects.find(candidate => candidate.name?.toLowerCase() === query.projectName.toLowerCase());
          if (!project) throw new Error('Project not found.');
          tasks = tasks.filter(task => task.projectId === project.id);
          break;
        }
        case 'by_date':
          tasks = tasks.filter(task => {
            if (!task.dueDate) return false;
            if (query.dateComparison === 'on') return task.dueDate === query.date;
            if (query.dateComparison === 'before') return task.dueDate < query.date;
            return task.dueDate > query.date;
          });
          break;
        case 'by_id':
          tasks = tasks.filter(task => task.id === query.id);
          break;
        case 'by_name':
          tasks = tasks.filter(task => task.title?.toLowerCase() === query.name.toLowerCase());
          break;
        default:
          break;
      }
    }

    const result = { tasks: sortTasks(tasks, query, nowValue).map(task => mapTaskResult(task, projects)) };
    if (query.mode === 'scheduled_this_week') result.capacity = getWeekCapacity(state);
    return result;
  },
  get_goals: async (input) => {
    const query = validateGoalQuery(input);
    const state = await requireState(getState);
    const weeklyGoals = Array.isArray(state.weeklyGoals) ? state.weeklyGoals : [];
    const threeMonthGoals = Array.isArray(state.goals) ? state.goals : [];

    if (query.mode === 'current') {
      const activeWeeklyGoal = weeklyGoals.find(goal => goal.completedAt == null);
      return {
        weeklyGoals: activeWeeklyGoal ? [mapWeeklyGoalResult(activeWeeklyGoal)] : [],
        threeMonthGoals: threeMonthGoals
          .filter(goal => goal.completedAt == null)
          .sort(compareCurrentThreeMonthGoals)
          .map(mapThreeMonthGoalResult),
      };
    }

    const completedWeeklyGoals = weeklyGoals
      .filter(goal => typeof goal.completedAt === 'number')
      .sort(compareCompletedGoals);
    const completedThreeMonthGoals = threeMonthGoals
      .filter(goal => typeof goal.completedAt === 'number')
      .sort(compareCompletedGoals);

    if (query.mode === 'completed_weekly_last_8') {
      return {
        weeklyGoals: completedWeeklyGoals.slice(0, 8).map(mapWeeklyGoalResult),
        threeMonthGoals: [],
      };
    }
    if (query.mode === 'completed_three_month_last_8') {
      return {
        weeklyGoals: [],
        threeMonthGoals: completedThreeMonthGoals.slice(0, 8).map(mapThreeMonthGoalResult),
      };
    }
    return {
      weeklyGoals: completedWeeklyGoals.map(mapWeeklyGoalResult),
      threeMonthGoals: completedThreeMonthGoals.map(mapThreeMonthGoalResult),
    };
  },
  post_goal: async (input) => {
    const state = await requireState(getState);
    const payload = validatePostGoalInput(input, state);
    if (typeof postGoal !== 'function') throw new Error('Planwerk is not ready to create goals.');
    const goal = await postGoal(payload);
    if (!goal) throw new Error('Planwerk is not ready to create goals. Open a Planwerk file first.');
    return {
      type: payload.type,
      goal: payload.type === 'weekly' ? mapWeeklyGoalResult(goal) : mapThreeMonthGoalResult(goal),
    };
  },
  set_goal_focus: async (input) => {
    const state = await requireState(getState);
    const payload = validateGoalFocusInput(input);
    const goal = (state.goals || []).find(candidate => candidate.id === payload.id && candidate.completedAt == null);
    if (!goal) throw new Error('An open three-month goal with this ID was not found.');
    if (goal.isFocused === payload.isFocused) {
      return { type: 'three_month', goal: mapThreeMonthGoalResult(goal) };
    }
    if (typeof setGoalFocus !== 'function') throw new Error('Planwerk is not ready to update goal focus.');
    const updatedGoal = await setGoalFocus(payload);
    if (!updatedGoal) throw new Error('Planwerk is not ready to update goal focus. Open a Planwerk file first.');
    return { type: 'three_month', goal: mapThreeMonthGoalResult(updatedGoal) };
  },
  get_lookback: async (input) => {
    const query = validateLookbackQuery(input);
    const state = await requireState(getState);
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const items = getLookbackItems(state, query, now());
    if (query.detail === 'detailed') {
      return { time: query.time, tasks: items.map(item => mapLookbackTaskResult(item, projects)) };
    }
    const valueDistribution = buildLookbackDistribution(items);
    const summaryStatus = buildLookbackSummaryStatus(items, valueDistribution);
    const projectEfficacy = buildLookbackProjectEfficacy(items, projects);
    return {
      time: query.time,
      summary: {
        ...summaryStatus,
        valueDistribution,
        weeklyBreakdown: buildLookbackWeeklyBreakdown(items),
        projectEfficacy,
        projectConcerns: query.time === 'all' ? null : {
          urgent: projectEfficacy.filter(project => project.averageScore < 1).map(project => project.projectName),
          warning: projectEfficacy
            .filter(project => project.averageScore >= 1 && project.averageScore < 2)
            .map(project => project.projectName),
        },
      },
    };
  },
  get_all_data: async () => {
    const state = await requireState(getState);
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const weeklyGoals = Array.isArray(state.weeklyGoals) ? state.weeklyGoals : [];
    const threeMonthGoals = Array.isArray(state.goals) ? state.goals : [];
    const capacityByDay = getVisibleDays(state).map(day => getDayCapacity(state, day));
    const defaultProject = projects.find(project => project.id === state.defaultProjectId);

    return {
      tasks: [...tasks]
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || String(a.id).localeCompare(String(b.id)))
        .map(task => mapAnalysisTaskResult(task, projects)),
      projects,
      goals: {
        weeklyGoals: [...weeklyGoals].sort(compareAnalysisWeeklyGoals).map(mapAnalysisWeeklyGoalResult),
        threeMonthGoals: [...threeMonthGoals].sort(compareAnalysisThreeMonthGoals).map(mapAnalysisThreeMonthGoalResult),
      },
      planning: {
        visibleDays: getVisibleDays(state),
        defaults: {
          duration: state.defaultDuration ?? 30,
          priority: state.defaultPriority ?? 3,
          projectName: defaultProject?.name || null,
        },
        capacityByDay,
        weekCapacity: capacityByDay.reduce((capacity, day) => ({
          plannedMinutes: capacity.plannedMinutes + day.plannedMinutes,
          maximumMinutes: capacity.maximumMinutes + day.maximumMinutes,
        }), { plannedMinutes: 0, maximumMinutes: 0 }),
      },
    };
  },
  get_projects: async () => {
    const state = await requireState(getState);
    const projects = Array.isArray(state.projects)
      ? [...new Set(state.projects.filter(project => project?.name).map(project => project.name))]
        .sort((a, b) => a.localeCompare(b))
      : [];
    return { projects };
  },
  post_project: async (input) => {
    const state = await requireState(getState);
    const payload = validatePostProjectInput(input);
    const exists = (state.projects || []).some(project => project.name?.toLowerCase() === payload.name.toLowerCase());
    if (exists) throw new Error('Project already exists.');
    if (typeof postProject !== 'function') throw new Error('Planwerk is not ready to create projects.');
    const project = await postProject(payload);
    if (!project) throw new Error('Planwerk is not ready to create projects. Open a Planwerk file first.');
    return { project };
  },
  post_task: async (input) => {
    const state = await requireState(getState);
    const payload = validatePostTaskInput(input, state, now());
    if (typeof postTask !== 'function') throw new Error('Planwerk is not ready to create tasks.');
    const task = await postTask(payload);
    if (!task) throw new Error('Planwerk is not ready to create tasks. Open a Planwerk file first.');
    const updatedState = await requireState(getState);
    const isVisibleDay = DAY_COLUMNS.has(task.status) && getVisibleDays(updatedState).includes(task.status);
    return {
      task: mapTaskResult(task, Array.isArray(state.projects) ? state.projects : []),
      capacity: isVisibleDay ? getDayCapacity(updatedState, task.status) : null,
      affectedColumnCapacities: getAffectedColumnCapacities(updatedState, [task]),
    };
  },
  update_task: async (input = {}) => {
    const state = await requireState(getState);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Tool input must be an object.');
    }
    const target = validateUpdateTaskTarget(input.target);
    const updates = validateUpdateTaskChanges(input.updates, state, now());
    const projects = Array.isArray(state.projects) ? state.projects : [];
    const scopedTasks = filterByStatus(Array.isArray(state.tasks) ? state.tasks : [], target.status);
    let matchingTasks;

    if (target.mode === 'by_id') {
      matchingTasks = target.ids.map(id => scopedTasks.find(task => task.id === id)).filter(Boolean);
      if (target.ids.length > 1 && matchingTasks.length !== target.ids.length) {
        throw new Error('One or more requested task IDs were not found in the selected status scope.');
      }
    } else if (target.mode === 'by_name') {
      matchingTasks = scopedTasks.filter(task => task.title?.toLowerCase() === target.name.toLowerCase());
    } else if (target.mode === 'by_project') {
      const project = projects.find(candidate => candidate.name?.toLowerCase() === target.projectName.toLowerCase());
      if (!project) throw new Error('Project not found.');
      matchingTasks = scopedTasks.filter(task => task.projectId === project.id);
    } else {
      matchingTasks = scopedTasks.filter(task => task.dueDate === target.date);
    }

    if (matchingTasks.length === 0) throw new Error('No tasks found for the selected target.');
    if (typeof updateTasks !== 'function') throw new Error('Planwerk is not ready to update tasks.');
    const tasks = await updateTasks({ ids: matchingTasks.map(task => task.id), updates });
    if (!Array.isArray(tasks)) throw new Error('Planwerk is not ready to update tasks. Open a Planwerk file first.');
    const updatedState = await requireState(getState);
    return {
      tasks: tasks.map(task => mapTaskResult(task, projects)),
      affectedColumnCapacities: getAffectedColumnCapacities(updatedState, tasks),
    };
  },
});

const asToolResult = (payload) => ({
  content: [{ type: 'text', text: JSON.stringify(payload) }],
  structuredContent: payload,
});

const asToolCallback = (handler) => async (input = {}) => {
  try {
    return asToolResult(await handler(input));
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: error?.message || 'Local MCP tool failed.' }],
    };
  }
};

const registerMcpTools = (server, handlers) => {
  server.registerTool('get_current_date', {
    description: 'Read the current local date as a German weekday plus DD.MM.YYYY, useful before choosing relative dates or deadlines.',
  }, asToolCallback(handlers.get_current_date));
  server.registerTool('get_tasks', {
    description: 'Read tasks from the open Planwerk file with one clear filter mode. Use scheduled_this_week to inspect the visible board columns and week capacity; use by_name, by_project, by_date or by_id before updates when you need to find the right task IDs.',
    inputSchema: {
      mode: z.enum(['all', 'today', 'this_week', 'scheduled_this_week', 'backlog', 'done_last_2_weeks', 'all_done', 'by_project', 'by_date', 'by_id', 'by_name'])
        .describe('Filter mode. scheduled_this_week means the currently visible board day columns, not all tasks with a due date this week.'),
      status: z.enum(['open', 'done', 'all']).optional().describe('Optional status scope for modes that support it. Defaults to open.'),
      sort: z.enum(['date', 'priority', 'urgency_score']).optional().describe('Sort tasks by date, priority, or Planwerk urgency score. Defaults to date.'),
      projectName: z.string().optional().describe('Exact project name for by_project.'),
      date: z.string().optional().describe('YYYY-MM-DD date for by_date.'),
      dateComparison: z.enum(['on', 'before', 'after']).optional().describe('Date comparison for by_date.'),
      id: z.string().optional().describe('Exact task ID for by_id.'),
      name: z.string().optional().describe('Exact task title for by_name. Multiple matches are possible.'),
    },
  }, asToolCallback(handlers.get_tasks));
  server.registerTool('get_goals', {
    description: 'Read current or completed goals from the open Planwerk file.',
    inputSchema: {
      mode: z.enum(['current', 'completed_weekly_last_8', 'completed_three_month_last_8', 'all_completed']),
    },
  }, asToolCallback(handlers.get_goals));
  server.registerTool('get_lookback', {
    description: 'Read reflection history or lookback analytics from the open Planwerk file.',
    inputSchema: {
      time: z.enum(['last_2_weeks', 'last_3_months', 'all']),
      detail: z.enum(['summary', 'detailed']),
    },
  }, asToolCallback(handlers.get_lookback));
  server.registerTool('get_projects', {
    description: 'List existing Planwerk project names before creating a task.',
  }, asToolCallback(handlers.get_projects));
  server.registerTool('post_project', {
    description: 'Create a new Planwerk project explicitly.',
    inputSchema: {
      name: z.string(),
    },
  }, asToolCallback(handlers.post_project));
  server.registerTool('post_task', {
    description: 'Create a task in the open Planwerk file using existing projects. Think deliberately about duration, priority, project, deadline and board column: dueDate is only the deadline and does not place the task on the board; column is the board placement. If the user says a weekday such as Monday or Wednesday, pass the matching column. When you set a day column, also set a matching dueDate for that same day unless the user clearly wants a different deadline; otherwise Planwerk will use today as the default dueDate. If column is omitted, Planwerk intentionally uses backlog. Duration is minutes and is usually best between 5 and 180; split larger work into smaller tasks. Priority is independent from dueDate: 1 low, 2 helpful, 3 normal/important, 4 necessary, 5 critical. Do not default deadlines to today unless today is actually intended.',
    inputSchema: {
      title: z.string().describe('Task title. Keep it concrete and startable.'),
      duration: z.number().int().optional().describe('Duration in minutes. Prefer 5-180 minutes; split larger work into smaller concrete tasks.'),
      priority: z.number().int().optional().describe('Importance independent from the deadline: 1 low, 2 helpful, 3 normal/important, 4 necessary, 5 critical.'),
      projectName: z.string().nullable().optional().describe('Existing project name. Call get_projects first when unsure.'),
      dueDate: z.string().nullable().optional().describe('Deadline in YYYY-MM-DD. This does not set the board column and should not be today unless today is intended.'),
      column: z.enum(['backlog', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'done']).optional().describe('Board column placement. Use mon/tue/wed/thu/fri/sat/sun when the user asks for a specific visible day; also set dueDate for that day unless the deadline should differ. Omit only when backlog is intended.'),
    },
  }, asToolCallback(handlers.post_task));
  server.registerTool('update_task', {
    description: 'Update one or more tasks in the open Planwerk file with a clear target selector. If you do not know the ID, do not ask the user unnecessarily: use get_tasks first or target by exact name, project, or date when that safely identifies the intended tasks. dueDate is only the deadline; column is the board placement. When moving a task to a day column, also set dueDate intentionally if the deadline should match that day; column does not change dueDate by itself. Priority is independent from dueDate: 1 low, 2 helpful, 3 normal/important, 4 necessary, 5 critical. Duration is minutes and usually best between 5 and 180.',
    inputSchema: {
      target: z.object({
        mode: z.enum(['by_id', 'by_name', 'by_project', 'by_date']).describe('How to select tasks. If you do not know the ID, use get_tasks first or use by_name/by_project/by_date when safe.'),
        status: z.enum(['open', 'done', 'all']).optional().describe('Selection scope. Defaults to open.'),
        id: z.string().optional().describe('One exact task ID for by_id.'),
        ids: z.array(z.string()).optional().describe('Multiple exact task IDs for by_id. All IDs must exist in the selected status scope.'),
        name: z.string().optional().describe('Exact task title for by_name; can update multiple matching tasks.'),
        projectName: z.string().optional().describe('Exact project name for by_project.'),
        date: z.string().optional().describe('Exact YYYY-MM-DD dueDate for by_date.'),
      }).describe('Target selector. If you do not know the ID, call get_tasks to find it or use by_name/by_project/by_date when appropriate.'),
      updates: z.object({
        title: z.string().optional().describe('New task title.'),
        duration: z.number().int().optional().describe('Duration in minutes. Prefer 5-180 minutes; split larger work into smaller concrete tasks.'),
        priority: z.number().int().optional().describe('Importance independent from the deadline: 1 low, 2 helpful, 3 normal/important, 4 necessary, 5 critical.'),
        projectName: z.string().nullable().optional().describe('Existing project name, or null/empty to use the default project.'),
        dueDate: z.string().nullable().optional().describe('Deadline in YYYY-MM-DD. This does not set the board column and should not be today unless today is intended.'),
        column: z.enum(['backlog', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'done']).optional().describe('Board column placement. Use mon/tue/wed/thu/fri/sat/sun when moving the task onto a specific visible day. Moving to a day column does not change dueDate; set dueDate too if the deadline should match that day.'),
        isDone: z.boolean().optional().describe('Completion state. column done always marks the task done.'),
      }).describe('Fields to change. Omitted fields stay unchanged.'),
    },
  }, asToolCallback(handlers.update_task));
  server.registerTool('post_goal', {
    description: 'Set the current weekly goal or create a new three-month goal in the open Planwerk file.',
    inputSchema: {
      type: z.enum(['weekly', 'three_month']),
      title: z.string(),
      isFocused: z.boolean().optional(),
    },
  }, asToolCallback(handlers.post_goal));
  server.registerTool('set_goal_focus', {
    description: 'Focus or park one open three-month goal in the open Planwerk file.',
    inputSchema: {
      id: z.string(),
      isFocused: z.boolean(),
    },
  }, asToolCallback(handlers.set_goal_focus));
  server.registerTool('get_all_data', {
    description: 'Read all Planwerk tasks, reflections, goals and planning context for deep analysis only.',
  }, asToolCallback(handlers.get_all_data));
};

const startMcpServer = async (options) => {
  // The local HTTP threat model depends on this listener remaining unreachable from other devices.
  if (Object.prototype.hasOwnProperty.call(options, 'host')) {
    throw new Error(`Local MCP host is fixed to ${DEFAULT_HOST} and cannot be overridden.`);
  }

  const {
    token,
    getState,
    postProject,
    postTask,
    updateTasks,
    postGoal,
    setGoalFocus,
    now = Date.now,
    port = DEFAULT_PORT,
  } = options;
  const app = express();
  const handlers = createMcpToolHandlers({ getState, postProject, postTask, updateTasks, postGoal, setGoalFocus, now });
  const activeConnections = new Set();

  app.disable('x-powered-by');
  app.use('/mcp', createMcpRequestGuard({ token, port }));
  app.use('/mcp', express.json({ limit: '32kb', strict: true }));
  app.use('/mcp', handleMcpJsonParseError);
  app.post('/mcp', async (req, res) => {
    const server = new McpServer({ name: 'planwerk', version: '1.0.0' });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const connection = { server, transport };
    activeConnections.add(connection);

    try {
      registerMcpTools(server, handlers);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Local MCP request failed.' },
          id: null,
        });
      }
    } finally {
      activeConnections.delete(connection);
      await transport.close();
      await server.close();
    }
  });
  app.get('/mcp', (_req, res) => {
    res.status(405).json({ error: 'Method not allowed.' });
  });
  app.delete('/mcp', (_req, res) => {
    res.status(405).json({ error: 'Method not allowed.' });
  });

  const httpServer = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(port, DEFAULT_HOST, () => resolve(listeningServer));
    listeningServer.once('error', reject);
  });

  return {
    endpoint: `http://${DEFAULT_HOST}:${port}/mcp`,
    close: async () => {
      const listenerClosed = new Promise((resolve, reject) => {
        httpServer.close(error => error ? reject(error) : resolve());
      });
      if (typeof httpServer.closeAllConnections === 'function') {
        httpServer.closeAllConnections();
      }
      await Promise.allSettled([...activeConnections].map(async ({ server, transport }) => {
        await transport.close();
        await server.close();
      }));
      await listenerClosed;
    },
  };
};

module.exports = {
  ALLOWED_ORIGINS,
  DEFAULT_ENDPOINT,
  DEFAULT_HOST,
  DEFAULT_PORT,
  calculatePriorityScore,
  createMcpRequestGuard,
  createMcpToolHandlers,
  hasValidBearerToken,
  isAllowedHostHeader,
  isAllowedOriginHeader,
  registerMcpTools,
  startMcpServer,
};
