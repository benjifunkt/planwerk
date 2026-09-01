export enum Priority {
  Marginal = 1,
  Helpful = 2,
  Important = 3,
  Necessary = 4,
  Critical = 5
}

export enum ReflectionValue {
  Unreflected = 0,
  NotUseful = 1,
  SomewhatUseful = 2,
  Useful = 3
}

export type ColumnId = 'backlog' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'done';
export type DayColumnId = Exclude<ColumnId, 'backlog' | 'done'>;
export type MaxHoursByDay = Record<DayColumnId, number>;
export type SortDirection = 'desc' | 'asc';
export type PrioritySortDirection = SortDirection;
export type ColumnSortMode = 'score-desc' | 'date-asc' | 'score-asc' | 'date-desc';

export interface Project {
  id: string;
  name: string;
}

export type ProjectDeletionResolution =
  | { mode: 'move'; targetProjectId: string }
  | { mode: 'delete' };

export interface Goal {
  id: string;
  title: string;
  isFocused: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface Task {
  id: string;
  title: string;
  duration: number; // in minutes
  dueDate: string | null; // ISO string YYYY-MM-DD
  priority: Priority;
  projectId: string | null;
  status: ColumnId;
  isDone: boolean;
  reflectionValue: ReflectionValue;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  reflectedAt: number | null;
  orderIndex: number;
}

export type RecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type AutofillMode = 'current-weekday' | 'full-week';

export interface RecurringTemplate {
  id: string;
  title: string;
  duration: number;
  priority: Priority;
  projectId: string | null;
  recurrenceType: RecurrenceType;
  dayOfWeek?: number; // 0-6 (0 = Sunday)
  dayOfMonth?: number; // 1-31
  timeOfDay: string; // "HH:MM"
  dueDateOffsetDays?: number | null; // e.g. 2 means 2 days after it's generated
  nextGenerationDate: number; // timestamp
}

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'system' | 'en' | 'de';

export interface OnboardingTutorialState {
  workWeek: boolean;
  createTask: boolean;
  board: boolean;
  autofill: boolean;
  cleanup: boolean;
  reflection: boolean;
  lookback: boolean;
  goals: boolean;
}

export interface OnboardingHintState {
  bulkTaskShortcut: {
    firstTaskCreated: boolean;
    shown: boolean;
  };
  weeklyReflectionReminder: {
    shown: boolean;
    cleanupTutorialCompletedAt?: number | null;
  };
}

export interface OnboardingState {
  version: 1;
  tutorial: OnboardingTutorialState;
  hints: OnboardingHintState;
}

export interface AppState {
  tasks: Task[];
  projects: Project[];
  templates: RecurringTemplate[];
  defaultProjectId?: string | null;
  defaultPriority?: Priority;
  defaultDuration?: number;
  defaultDueDateOffsetDays?: number;
  theme?: Theme;
  language?: Language;
  autofillMode: AutofillMode;
  weekStartDay: DayColumnId;
  maxHoursPerDayByDay: MaxHoursByDay;
  visibleDays: DayColumnId[];
  backlogPinned: boolean;
  sidebarCollapsed: boolean;
  onboarding: OnboardingState;
  firstReflectionAt: number | null;
  generalGoal: string;
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
}

export interface PlanwerkSettings {
  defaultProjectId?: string | null;
  defaultPriority?: Priority;
  defaultDuration?: number;
  defaultDueDateOffsetDays?: number;
  theme?: Theme;
  language?: Language;
  autofillMode?: AutofillMode;
  weekStartDay?: DayColumnId;
  maxHoursPerDayByDay?: Partial<MaxHoursByDay>;
  visibleDays?: ColumnId[];
  backlogPinned?: boolean;
  sidebarCollapsed?: boolean;
  onboarding?: OnboardingState;
  maxHoursPerDay?: number;
}

export interface PlanwerkAnalytics {
  firstReflectionAt?: number | null;
  generalGoal?: string;
  goals?: Goal[];
  weeklyGoals?: WeeklyGoal[];
}

export interface PlanwerkData {
  tasks: Task[];
  projects: Project[];
  templates: RecurringTemplate[];
  settings: PlanwerkSettings;
  analytics: PlanwerkAnalytics;
}

export interface PlanwerkFileResult {
  ok: boolean;
  canceled?: boolean;
  reason?: string;
  message?: string;
  path?: string | null;
  name?: string | null;
  data?: PlanwerkData;
  hasWorkspace?: boolean;
  exists?: boolean;
  signature?: string | null;
  updatedAt?: string | null;
  externalPath?: string | null;
  external?: PlanwerkFileResult;
}

export interface PlanwerkClipboardResult {
  ok: boolean;
  reason?: string;
  message?: string;
}

export interface PlanwerkMcpStatus {
  ok: boolean;
  enabled: boolean;
  running: boolean;
  endpoint: string;
  token: string | null;
  error?: string | null;
}

export type PlanwerkUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'upToDate'
  | 'error'
  | 'unsupported';

export interface PlanwerkUpdateStatus {
  updateCheckSupported: boolean;
  automaticInstallationSupported: boolean;
  automaticUpdatesEnabled: boolean;
  currentVersion: string;
  phase: PlanwerkUpdatePhase;
  shouldNotify: boolean;
  availableVersion?: string;
  unsupportedReason?: 'unavailable';
}

export interface PlanwerkOpenReleaseResult {
  ok: boolean;
  reason?: 'invalid-release' | 'open-failed';
}

export interface McpPostTaskPayload {
  title: string;
  duration: number;
  priority: Priority;
  dueDate: string;
  projectId: string | null;
  status: ColumnId;
}

export interface McpPostProjectPayload {
  name: string;
}

export interface McpUpdateTaskFields {
  title?: string;
  duration?: number;
  priority?: Priority;
  dueDate?: string;
  projectId?: string | null;
  status?: ColumnId;
  isDone?: boolean;
}

export interface McpUpdateTasksPayload {
  ids: string[];
  updates: McpUpdateTaskFields;
}

export type McpPostGoalPayload =
  | { type: 'weekly'; title: string }
  | { type: 'three_month'; title: string; isFocused: boolean };

export interface McpSetGoalFocusPayload {
  id: string;
  isFocused: boolean;
}

declare global {
  interface Window {
    __MCP_GET_STATE__?: () => AppState | null;
    __MCP_POST_TASK__?: (payload: McpPostTaskPayload) => Task | null;
    __MCP_POST_PROJECT__?: (payload: McpPostProjectPayload) => Project | null;
    __MCP_UPDATE_TASKS__?: (payload: McpUpdateTasksPayload) => Task[] | null;
    __MCP_POST_GOAL__?: (payload: McpPostGoalPayload) => Goal | WeeklyGoal | null;
    __MCP_SET_GOAL_FOCUS__?: (payload: McpSetGoalFocusPayload) => Goal | null;
    planwerkFile?: {
      loadCurrent: () => Promise<PlanwerkFileResult>;
      create: (options?: { initialData?: PlanwerkData }) => Promise<PlanwerkFileResult>;
      open: () => Promise<PlanwerkFileResult>;
      close: () => Promise<PlanwerkFileResult>;
      save: (data: PlanwerkData, options?: { expectedSignature?: string | null }) => Promise<PlanwerkFileResult>;
      copyExternalVersion: (options: { data: PlanwerkData }) => Promise<PlanwerkFileResult>;
      getInfo: () => Promise<PlanwerkFileResult>;
      onExternalChange: (handler: (result: PlanwerkFileResult) => void) => () => void;
      onFileOpened: (handler: (result: PlanwerkFileResult) => void) => () => void;
    };
    planwerkClipboard?: {
      writeText: (text: string) => Promise<PlanwerkClipboardResult>;
    };
    planwerkMcp?: {
      getStatus: () => Promise<PlanwerkMcpStatus>;
      setEnabled: (enabled: boolean) => Promise<PlanwerkMcpStatus>;
      regenerateToken: () => Promise<PlanwerkMcpStatus>;
    };
    planwerkUpdater?: {
      getStatus: () => Promise<PlanwerkUpdateStatus>;
      setAutomaticUpdatesEnabled: (enabled: boolean) => Promise<PlanwerkUpdateStatus>;
      checkNow: () => Promise<PlanwerkUpdateStatus>;
      dismissAvailableVersion: (version: string) => Promise<PlanwerkUpdateStatus>;
      openReleasePage: (version: string) => Promise<PlanwerkOpenReleaseResult>;
      onStatus: (handler: (status: PlanwerkUpdateStatus) => void) => () => void;
    };
  }
}
