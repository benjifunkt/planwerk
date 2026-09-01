import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Task, Goal, WeeklyGoal, Project, RecurringTemplate, ColumnId, DayColumnId, MaxHoursByDay, Priority, ColumnSortMode, ReflectionValue, Language, PlanwerkData, PlanwerkFileResult, PlanwerkSettings, AutofillMode, McpPostTaskPayload, McpPostProjectPayload, McpUpdateTaskFields, McpPostGoalPayload, McpSetGoalFocusPayload, OnboardingState, ProjectDeletionResolution } from '../types';
import { DEFAULT_MAX_HOURS_PER_DAY, DAY_COLUMN_IDS, DEFAULT_VISIBLE_DAYS, createDefaultMaxHoursByDay } from '../constants';
import { compareTasksByColumnSortMode } from '../utils/taskSortUtils';
import { createAutofillAssignments, createAutofillTargetDays } from '../utils/autofillUtils';
import { calculateInitialNextGenDate } from '../utils/dateUtils';
import { createRecurringTasksUpdate } from '../utils/recurringTasks';
import { getFocusedOpenGoalSummary, normalizeGoals, normalizeWeeklyGoals } from '../utils/goalNormalization';
import { LEGACY_IMPORT_LIMITS, keepNewIds, parseLegacyImportData, type LegacyImportData } from '../utils/legacyImportUtils';
import { recordTaskReflection, resolveFirstReflectionAt } from '../utils/reflectionTimeline';
import { applyTaskColumnTransition } from '../utils/taskColumnTransitions';
import { mergePlanwerkData, planwerkDataFingerprint } from '../planwerkMerge.js';
import type { ResolvedLanguage } from '../i18n';

type PersistedAppState = Omit<Partial<AppState>, 'maxHoursPerDayByDay' | 'visibleDays'> & {
  maxHoursPerDay?: number;
  maxHoursPerDayByDay?: Partial<MaxHoursByDay>;
  visibleDays?: ColumnId[];
};

type PlanwerkMergeResult =
  | { ok: true; data: PlanwerkData }
  | { ok: false; reason?: string };

export interface PlanwerkStorageStatus {
  isElectron: boolean;
  isLoading: boolean;
  hasOpenFile: boolean;
  needsFileSelection: boolean;
  filePath: string | null;
  fileName: string | null;
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  pendingConflict: PlanwerkConflict | null;
}

export interface PlanwerkConflict {
  reason: string;
  localData: PlanwerkData;
  externalData: PlanwerkData;
  localUpdatedAt: string;
  externalUpdatedAt: string | null;
  externalSignature: string | null;
}

const sanitizeMaxHours = (value: unknown, fallback = DEFAULT_MAX_HOURS_PER_DAY) => {
  if (value == null || value === '') return fallback;

  const numeric = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  if (!Number.isFinite(numeric)) return fallback;

  return Math.max(0, Math.trunc(numeric * 10) / 10);
};

const normalizeMaxHoursByDay = (
  maxHoursPerDayByDay?: Partial<MaxHoursByDay>,
  storedMaxHoursPerDay?: unknown
): MaxHoursByDay => {
  const fallback = sanitizeMaxHours(storedMaxHoursPerDay);
  const hasStoredFallback = storedMaxHoursPerDay != null && storedMaxHoursPerDay !== '';
  const defaults = createDefaultMaxHoursByDay();

  return DAY_COLUMN_IDS.reduce((acc, day) => {
    const hasExplicitDay = maxHoursPerDayByDay && day in maxHoursPerDayByDay;
    acc[day] = hasExplicitDay
      ? sanitizeMaxHours(maxHoursPerDayByDay?.[day], fallback)
      : hasStoredFallback ? fallback : defaults[day];
    return acc;
  }, defaults);
};

const normalizeVisibleDays = (visibleDays?: ColumnId[] | null): DayColumnId[] => {
  const normalized = DAY_COLUMN_IDS.filter(day => visibleDays?.includes(day));
  return normalized.length > 0 ? normalized : [...DEFAULT_VISIBLE_DAYS];
};

const deriveVisibleDaysFromMaxHours = (
  maxHoursPerDayByDay: MaxHoursByDay,
  fallbackVisibleDays?: ColumnId[] | null
): DayColumnId[] => {
  const visibleDays = DAY_COLUMN_IDS.filter(day => maxHoursPerDayByDay[day] > 0);
  if (visibleDays.length > 0) return visibleDays;

  return normalizeVisibleDays(fallbackVisibleDays);
};

const syncMaxHoursWithVisibleDays = (
  maxHoursPerDayByDay: MaxHoursByDay,
  visibleDays: DayColumnId[],
  originalVisibleDays?: ColumnId[] | null
): MaxHoursByDay => {
  const synced = DAY_COLUMN_IDS.reduce((acc, day) => {
    acc[day] = originalVisibleDays
      ? visibleDays.includes(day) ? maxHoursPerDayByDay[day] : 0
      : maxHoursPerDayByDay[day];
    return acc;
  }, {} as MaxHoursByDay);

  if (DAY_COLUMN_IDS.some(day => synced[day] > 0)) return synced;

  const fallbackDay = visibleDays[0] || DEFAULT_VISIBLE_DAYS[0];
  return {
    ...synced,
    [fallbackDay]: DEFAULT_MAX_HOURS_PER_DAY,
  };
};

const isDayColumnId = (status: ColumnId): status is DayColumnId => (
  DAY_COLUMN_IDS.includes(status as DayColumnId)
);

const normalizeLanguage = (language?: unknown): Language => (
  language === 'system' || language === 'en' || language === 'de' ? language : 'system'
);

const normalizeAutofillMode = (autofillMode?: unknown): AutofillMode => (
  autofillMode === 'full-week' ? 'full-week' : 'current-weekday'
);

const normalizeWeekStartDay = (weekStartDay?: unknown): DayColumnId => (
  typeof weekStartDay === 'string' && DAY_COLUMN_IDS.includes(weekStartDay as DayColumnId)
    ? weekStartDay as DayColumnId
    : 'mon'
);

const createOnboardingState = (
  workWeek: boolean,
  createTask: boolean,
  board: boolean,
  autofill: boolean,
  cleanup: boolean,
  reflection: boolean,
  lookback: boolean,
  goals: boolean,
  weeklyReflectionReminderShown = false
): OnboardingState => ({
  version: 1,
  tutorial: {
    workWeek,
    createTask,
    board,
    autofill,
    cleanup,
    reflection,
    lookback,
    goals,
  },
  hints: {
    bulkTaskShortcut: {
      firstTaskCreated: false,
      shown: board,
    },
    weeklyReflectionReminder: {
      shown: weeklyReflectionReminderShown,
      cleanupTutorialCompletedAt: null,
    },
  },
});

export const normalizeOnboardingState = (
  onboarding: unknown,
  fallbackWorkWeek = true,
  fallbackCreateTask = true,
  fallbackBoard = true,
  fallbackAutofill = true,
  fallbackCleanup = true,
  fallbackReflection = true,
  fallbackLookback = true,
  fallbackGoals = true
): OnboardingState => {
  if (!onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) {
    return createOnboardingState(
      fallbackWorkWeek,
      fallbackCreateTask,
      fallbackBoard,
      fallbackAutofill,
      fallbackCleanup,
      fallbackReflection,
      fallbackLookback,
      fallbackGoals,
      true
    );
  }

  const tutorial = 'tutorial' in onboarding ? onboarding.tutorial : null;
  if (!tutorial || typeof tutorial !== 'object' || Array.isArray(tutorial)) {
    return createOnboardingState(
      fallbackWorkWeek,
      fallbackCreateTask,
      fallbackBoard,
      fallbackAutofill,
      fallbackCleanup,
      fallbackReflection,
      fallbackLookback,
      fallbackGoals,
      true
    );
  }

  const workWeek = 'workWeek' in tutorial && typeof tutorial.workWeek === 'boolean'
    ? tutorial.workWeek
    : fallbackWorkWeek;
  const createTask = 'createTask' in tutorial && typeof tutorial.createTask === 'boolean'
    ? tutorial.createTask
    : fallbackCreateTask;
  const board = 'board' in tutorial && typeof tutorial.board === 'boolean'
    ? tutorial.board
    : fallbackBoard;
  const autofill = 'autofill' in tutorial && typeof tutorial.autofill === 'boolean'
    ? tutorial.autofill
    : fallbackAutofill;
  const cleanup = 'cleanup' in tutorial && typeof tutorial.cleanup === 'boolean'
    ? tutorial.cleanup
    : fallbackCleanup;
  const reflection = 'reflection' in tutorial && typeof tutorial.reflection === 'boolean'
    ? tutorial.reflection
    : fallbackReflection;
  const lookback = 'lookback' in tutorial && typeof tutorial.lookback === 'boolean'
    ? tutorial.lookback
    : fallbackLookback;
  const goals = 'goals' in tutorial && typeof tutorial.goals === 'boolean'
    ? tutorial.goals
    : fallbackGoals;

  const fallbackOnboarding = createOnboardingState(
    workWeek,
    createTask,
    board,
    autofill,
    cleanup,
    reflection,
    lookback,
    goals
  );
  const hints = 'hints' in onboarding && onboarding.hints && typeof onboarding.hints === 'object' && !Array.isArray(onboarding.hints)
    ? onboarding.hints
    : null;
  const bulkTaskShortcut = hints && 'bulkTaskShortcut' in hints && hints.bulkTaskShortcut && typeof hints.bulkTaskShortcut === 'object' && !Array.isArray(hints.bulkTaskShortcut)
    ? hints.bulkTaskShortcut
    : null;
  const weeklyReflectionReminder = hints && 'weeklyReflectionReminder' in hints && hints.weeklyReflectionReminder && typeof hints.weeklyReflectionReminder === 'object' && !Array.isArray(hints.weeklyReflectionReminder)
    ? hints.weeklyReflectionReminder
    : null;
  const cleanupTutorialCompletedAt = weeklyReflectionReminder && 'cleanupTutorialCompletedAt' in weeklyReflectionReminder
    ? weeklyReflectionReminder.cleanupTutorialCompletedAt
    : undefined;
  const hasCleanupTutorialCompletedAt = Boolean(
    weeklyReflectionReminder && (
      cleanupTutorialCompletedAt === null
      || (
        typeof cleanupTutorialCompletedAt === 'number'
        && Number.isFinite(cleanupTutorialCompletedAt)
        && cleanupTutorialCompletedAt >= 0
      )
    )
  );

  return {
    ...fallbackOnboarding,
    hints: {
      bulkTaskShortcut: {
        firstTaskCreated: bulkTaskShortcut && 'firstTaskCreated' in bulkTaskShortcut && typeof bulkTaskShortcut.firstTaskCreated === 'boolean'
          ? bulkTaskShortcut.firstTaskCreated
          : false,
        shown: bulkTaskShortcut && 'shown' in bulkTaskShortcut && typeof bulkTaskShortcut.shown === 'boolean'
          ? bulkTaskShortcut.shown
          : board,
      },
      weeklyReflectionReminder: {
        shown: weeklyReflectionReminder && 'shown' in weeklyReflectionReminder && typeof weeklyReflectionReminder.shown === 'boolean'
          ? weeklyReflectionReminder.shown
          : true,
        ...(hasCleanupTutorialCompletedAt
          ? { cleanupTutorialCompletedAt: cleanupTutorialCompletedAt as number | null }
          : {}),
      },
    },
  };
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const createDefaultState = (language: ResolvedLanguage = 'en'): AppState => ({
  tasks: [],
  projects: [{ id: 'proj_default', name: language === 'de' ? 'Allgemein' : 'General' }],
  templates: [],
  defaultProjectId: 'proj_default',
  defaultPriority: Priority.Important,
  defaultDuration: 30,
  defaultDueDateOffsetDays: 0,
  theme: 'system',
  language: 'system',
  autofillMode: 'current-weekday',
  weekStartDay: 'mon',
  maxHoursPerDayByDay: createDefaultMaxHoursByDay(),
  visibleDays: [...DEFAULT_VISIBLE_DAYS],
  backlogPinned: true,
  sidebarCollapsed: false,
  onboarding: createOnboardingState(false, false, false, false, false, false, false, false),
  firstReflectionAt: null,
  generalGoal: '',
  goals: [],
  weeklyGoals: [],
});

export const mergeLegacyImportData = (state: AppState, importedData: LegacyImportData): AppState | null => {
  const projects = [...state.projects, ...keepNewIds(state.projects, importedData.projects)];
  const templates = [...state.templates, ...keepNewIds(state.templates, importedData.templates)];
  const goals = [...state.goals, ...keepNewIds(state.goals, importedData.goals)];
  const weeklyGoals = [...state.weeklyGoals, ...keepNewIds(state.weeklyGoals, importedData.weeklyGoals)];
  const tasks = [...state.tasks, ...importedData.tasks];

  if (
    tasks.length > LEGACY_IMPORT_LIMITS.tasks
    || projects.length > LEGACY_IMPORT_LIMITS.projects
    || templates.length > LEGACY_IMPORT_LIMITS.templates
    || goals.length > LEGACY_IMPORT_LIMITS.goals
    || weeklyGoals.length > LEGACY_IMPORT_LIMITS.weeklyGoals
  ) {
    return null;
  }

  return {
    ...state,
    tasks,
    projects,
    templates,
    goals,
    weeklyGoals,
    generalGoal: getFocusedOpenGoalSummary(goals),
  };
};

const defaultState = createDefaultState();

export const deleteProjectFromState = (
  state: AppState,
  id: string,
  resolution: ProjectDeletionResolution,
  now = Date.now()
): AppState => {
  if (state.projects.length <= 1 || !state.projects.some(project => project.id === id)) {
    return state;
  }

  const projects = state.projects.filter(project => project.id !== id);

  if (resolution?.mode === 'move') {
    const targetProjectId = resolution.targetProjectId;
    if (!projects.some(project => project.id === targetProjectId)) {
      return state;
    }

    return {
      ...state,
      projects,
      tasks: state.tasks.map(task => task.projectId === id
        ? { ...task, projectId: targetProjectId, updatedAt: now }
        : task),
      templates: state.templates.map(template => template.projectId === id
        ? { ...template, projectId: targetProjectId }
        : template),
      defaultProjectId: state.defaultProjectId === id ? targetProjectId : state.defaultProjectId,
    };
  }

  if (resolution?.mode !== 'delete') {
    return state;
  }

  return {
    ...state,
    projects,
    tasks: state.tasks.filter(task => task.projectId !== id),
    templates: state.templates.filter(template => template.projectId !== id),
    defaultProjectId: state.defaultProjectId === id ? projects[0].id : state.defaultProjectId,
  };
};

export const setDefaultProjectInState = (state: AppState, id: string | null): AppState => (
  id && state.projects.some(project => project.id === id)
    ? { ...state, defaultProjectId: id }
    : state
);

const normalizeState = (savedState?: PersistedAppState | null): AppState => {
  const tasks = Array.isArray(savedState?.tasks) ? savedState.tasks : defaultState.tasks;
  const legacyGeneralGoal = typeof savedState?.generalGoal === 'string' ? savedState.generalGoal : defaultState.generalGoal;
  const goals = normalizeGoals(savedState?.goals, legacyGeneralGoal);
  const weeklyGoals = normalizeWeeklyGoals(savedState?.weeklyGoals);
  const normalizedVisibleDays = normalizeVisibleDays(savedState?.visibleDays);
  const maxHoursPerDayByDay = syncMaxHoursWithVisibleDays(
    normalizeMaxHoursByDay(savedState?.maxHoursPerDayByDay, savedState?.maxHoursPerDay),
    normalizedVisibleDays,
    savedState?.visibleDays
  );

  return {
    tasks,
    projects: Array.isArray(savedState?.projects) ? savedState.projects : defaultState.projects,
    templates: Array.isArray(savedState?.templates) ? savedState.templates : defaultState.templates,
    defaultProjectId: savedState && 'defaultProjectId' in savedState ? savedState.defaultProjectId : defaultState.defaultProjectId,
    defaultPriority: savedState?.defaultPriority ?? defaultState.defaultPriority,
    defaultDuration: savedState?.defaultDuration ?? defaultState.defaultDuration,
    defaultDueDateOffsetDays: savedState?.defaultDueDateOffsetDays ?? defaultState.defaultDueDateOffsetDays,
    theme: savedState?.theme ?? defaultState.theme,
    language: normalizeLanguage(savedState?.language),
    autofillMode: normalizeAutofillMode(savedState?.autofillMode),
    weekStartDay: normalizeWeekStartDay(savedState?.weekStartDay),
    maxHoursPerDayByDay,
    visibleDays: deriveVisibleDaysFromMaxHours(maxHoursPerDayByDay, savedState?.visibleDays),
    backlogPinned: savedState?.backlogPinned ?? defaultState.backlogPinned,
    sidebarCollapsed: savedState?.sidebarCollapsed ?? defaultState.sidebarCollapsed,
    onboarding: normalizeOnboardingState(savedState?.onboarding),
    firstReflectionAt: resolveFirstReflectionAt(
      savedState?.firstReflectionAt,
      Boolean(savedState && 'firstReflectionAt' in savedState),
      tasks
    ),
    generalGoal: getFocusedOpenGoalSummary(goals),
    goals,
    weeklyGoals,
  };
};

const appStateToPlanwerkData = (state: AppState): PlanwerkData => ({
  tasks: state.tasks,
  projects: state.projects,
  templates: state.templates,
  settings: {
    defaultProjectId: state.defaultProjectId ?? null,
    defaultPriority: state.defaultPriority,
    defaultDuration: state.defaultDuration,
    defaultDueDateOffsetDays: state.defaultDueDateOffsetDays,
    theme: state.theme,
    language: state.language,
    autofillMode: state.autofillMode,
    weekStartDay: state.weekStartDay,
    maxHoursPerDayByDay: state.maxHoursPerDayByDay,
    visibleDays: state.visibleDays,
    backlogPinned: state.backlogPinned,
    sidebarCollapsed: state.sidebarCollapsed,
    onboarding: state.onboarding,
  },
  analytics: {
    firstReflectionAt: state.firstReflectionAt,
    generalGoal: getFocusedOpenGoalSummary(state.goals),
    goals: state.goals,
    weeklyGoals: state.weeklyGoals,
  },
});

const planwerkDataToAppState = (data?: PlanwerkData | null): AppState => {
  const settings = (data?.settings || {}) as PlanwerkSettings;
  const analytics = data?.analytics || {};
  const tasks = data?.tasks || [];

  return normalizeState({
    tasks,
    projects: data?.projects,
    templates: data?.templates,
    ...settings,
    goals: analytics.goals,
    weeklyGoals: analytics.weeklyGoals,
    firstReflectionAt: resolveFirstReflectionAt(
      analytics.firstReflectionAt,
      Object.prototype.hasOwnProperty.call(analytics, 'firstReflectionAt'),
      tasks
    ),
    generalGoal: typeof analytics.generalGoal === 'string' ? analytics.generalGoal : '',
  });
};

export const LEGACY_STORAGE_KEYS = [
  'planwerk_offline_state',
  'planwerk_generalGoal',
  'planwerk_sidebar_collapsed',
] as const;

export const clearLegacyStorage = (storage?: Pick<Storage, 'removeItem'>): void => {
  try {
    const target = storage ?? window.localStorage;
    LEGACY_STORAGE_KEYS.forEach(key => target.removeItem(key));
  } catch (error) {
    console.warn('Could not remove obsolete Planwerk browser data.', error);
  }
};

export const useStore = () => {
  const [state, setState] = useState<AppState>(() => createDefaultState());
  const stateRef = useRef(state);
  const hasLoadedFileRef = useRef(false);
  const baseDataRef = useRef<PlanwerkData | null>(null);
  const baseSignatureRef = useRef<string | null>(null);
  const baseUpdatedAtRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);
  const [storageStatus, setStorageStatus] = useState<PlanwerkStorageStatus>({
    isElectron: Boolean(window.planwerkFile),
    isLoading: true,
    hasOpenFile: false,
    needsFileSelection: false,
    filePath: null,
    fileName: null,
    error: null,
    isSaving: false,
    saveError: null,
    pendingConflict: null,
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    clearLegacyStorage();
  }, []);

  const getMcpState = useCallback(() => stateRef.current, []);

  const commitMcpState = useCallback((updater: (current: AppState) => AppState) => {
    const nextState = updater(stateRef.current);
    stateRef.current = nextState;
    setState(nextState);
    return nextState;
  }, []);

  const setBasePlanwerk = useCallback((data: PlanwerkData, signature?: string | null, updatedAt?: string | null) => {
    baseDataRef.current = data;
    baseSignatureRef.current = signature || null;
    baseUpdatedAtRef.current = updatedAt || null;
  }, []);

  const applyLoadedPlanwerk = useCallback((result: PlanwerkFileResult) => {
    if (!result.data) return;

    const loadedState = planwerkDataToAppState(result.data);
    const normalizedData = appStateToPlanwerkData(loadedState);
    const shouldPersistFirstReflectionMigration = (
      !Object.prototype.hasOwnProperty.call(result.data.analytics, 'firstReflectionAt')
      && loadedState.firstReflectionAt !== null
    );

    hasLoadedFileRef.current = true;
    skipNextSaveRef.current = !shouldPersistFirstReflectionMigration;
    setBasePlanwerk(normalizedData, result.signature, result.updatedAt);
    setState(loadedState);
    setStorageStatus(prev => ({
      ...prev,
      isElectron: true,
      isLoading: false,
      hasOpenFile: true,
      needsFileSelection: false,
      filePath: result.path || null,
      fileName: result.name || null,
      error: null,
      saveError: null,
      pendingConflict: null,
    }));
  }, [setBasePlanwerk]);

  const handleExternalPlanwerkChange = useCallback((result: PlanwerkFileResult) => {
    if (!result.ok || !result.data) {
      if (result.reason === 'missing-current-path') {
        hasLoadedFileRef.current = false;
        baseDataRef.current = null;
        baseSignatureRef.current = null;
        baseUpdatedAtRef.current = null;
        setStorageStatus(prev => ({
          ...prev,
          hasOpenFile: false,
          needsFileSelection: true,
          filePath: null,
          fileName: null,
          error: null,
          saveError: null,
          pendingConflict: null,
        }));
        return;
      }

      setStorageStatus(prev => ({
        ...prev,
        saveError: result.message || 'file.openFailed',
      }));
      return;
    }

    const baseData = baseDataRef.current;
    const localData = appStateToPlanwerkData(stateRef.current);
    const externalState = planwerkDataToAppState(result.data);
    const externalData = appStateToPlanwerkData(externalState);

    if (!baseData || planwerkDataFingerprint(localData) === planwerkDataFingerprint(baseData)) {
      applyLoadedPlanwerk({ ...result, data: externalData });
      return;
    }

    const mergeResult = mergePlanwerkData(baseData, localData, externalData) as PlanwerkMergeResult;
    if (mergeResult.ok) {
      setBasePlanwerk(externalData, result.signature, result.updatedAt);
      setState(planwerkDataToAppState(mergeResult.data));
      setStorageStatus(prev => ({
        ...prev,
        filePath: result.path || prev.filePath,
        fileName: result.name || prev.fileName,
        saveError: null,
        pendingConflict: null,
      }));
      return;
    }

    setStorageStatus(prev => ({
      ...prev,
      filePath: result.path || prev.filePath,
      fileName: result.name || prev.fileName,
      isSaving: false,
      pendingConflict: {
        reason: mergeResult.reason || 'file.conflictReason',
        localData,
        externalData,
        localUpdatedAt: new Date().toISOString(),
        externalUpdatedAt: result.updatedAt || null,
        externalSignature: result.signature || null,
      },
    }));
  }, [applyLoadedPlanwerk, setBasePlanwerk]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialPlanwerk = async () => {
      const api = window.planwerkFile;
      if (!api) {
        hasLoadedFileRef.current = false;
        setStorageStatus(prev => ({
          ...prev,
          isElectron: false,
          isLoading: false,
          hasOpenFile: false,
          needsFileSelection: true,
          error: 'file.browserUnsupported',
        }));
        return;
      }

      try {
        const result = await api.loadCurrent();
        if (cancelled) return;

        if (result.ok && result.data) {
          applyLoadedPlanwerk(result);
          return;
        }

        hasLoadedFileRef.current = false;
        setStorageStatus(prev => ({
          ...prev,
          isElectron: true,
          isLoading: false,
          hasOpenFile: false,
          needsFileSelection: true,
          filePath: result.path || null,
          fileName: result.name || null,
          error: result.reason === 'load-failed'
            ? (result.message || 'file.openFailed')
            : null,
        }));
      } catch (error) {
        if (cancelled) return;
        hasLoadedFileRef.current = false;
        setStorageStatus(prev => ({
          ...prev,
          isElectron: true,
          isLoading: false,
          hasOpenFile: false,
          needsFileSelection: true,
          error: error instanceof Error ? error.message : 'file.openFailed',
        }));
      }
    };

    loadInitialPlanwerk();

    return () => {
      cancelled = true;
    };
  }, [applyLoadedPlanwerk]);

  useEffect(() => {
    const api = window.planwerkFile;
    if (!api) return;

    return api.onExternalChange(handleExternalPlanwerkChange);
  }, [handleExternalPlanwerkChange]);

  useEffect(() => {
    const api = window.planwerkFile;
    if (!api?.onFileOpened) return;

    return api.onFileOpened((result) => {
      if (result.ok && result.data) {
        applyLoadedPlanwerk(result);
        return;
      }

      setStorageStatus(prev => ({
        ...prev,
        isElectron: true,
        isLoading: false,
        error: result.message || 'file.openFailed',
      }));
    });
  }, [applyLoadedPlanwerk]);

  useEffect(() => {
    if (
      !hasLoadedFileRef.current ||
      !storageStatus.hasOpenFile ||
      storageStatus.isLoading ||
      storageStatus.pendingConflict ||
      !window.planwerkFile
    ) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    let cancelled = false;
    const nextData = appStateToPlanwerkData(state);
    setStorageStatus(prev => ({ ...prev, isSaving: true, saveError: null }));

    window.planwerkFile.save(nextData, { expectedSignature: baseSignatureRef.current }).then(result => {
      if (cancelled) return;

      if (result.ok) {
        setBasePlanwerk(nextData, result.signature, result.updatedAt);
      } else if (result.reason === 'signature-conflict' && result.external) {
        handleExternalPlanwerkChange(result.external);
      } else if (result.reason === 'missing-current-path') {
        hasLoadedFileRef.current = false;
        baseDataRef.current = null;
        baseSignatureRef.current = null;
        baseUpdatedAtRef.current = null;
      }

      setStorageStatus(prev => ({
        ...prev,
        isSaving: false,
        hasOpenFile: result.reason === 'missing-current-path' ? false : (result.ok ? true : prev.hasOpenFile),
        needsFileSelection: result.reason === 'missing-current-path' ? true : prev.needsFileSelection,
        filePath: result.reason === 'missing-current-path' ? null : (result.ok ? (result.path || prev.filePath) : prev.filePath),
        fileName: result.reason === 'missing-current-path' ? null : (result.ok ? (result.name || prev.fileName) : prev.fileName),
        error: result.reason === 'missing-current-path' ? null : prev.error,
        saveError: result.ok || result.reason === 'signature-conflict' || result.reason === 'missing-current-path' ? null : (result.message || 'file.saveFailed'),
        pendingConflict: result.reason === 'missing-current-path' ? null : prev.pendingConflict,
      }));
    }).catch(error => {
      if (cancelled) return;
      setStorageStatus(prev => ({
        ...prev,
        isSaving: false,
        saveError: error instanceof Error ? error.message : 'file.saveFailed',
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [handleExternalPlanwerkChange, setBasePlanwerk, state, storageStatus.hasOpenFile, storageStatus.isLoading, storageStatus.pendingConflict]);

  const addTask = useCallback((
    title: string,
    duration: number,
    priority: Priority,
    dueDate: string | null,
    projectId: string | null,
    status: ColumnId = 'backlog',
    isDone = false
  ) => {
    const now = Date.now();
    const newTask: Task = {
      id: `task_${generateId()}`,
      title,
      duration: duration || state.defaultDuration || 30,
      dueDate: dueDate || null,
      priority: priority || state.defaultPriority || Priority.Important,
      projectId: projectId || state.defaultProjectId || null,
      status,
      isDone,
      reflectionValue: ReflectionValue.Unreflected,
      createdAt: now,
      updatedAt: now,
      completedAt: isDone ? now : null,
      reflectedAt: null,
      orderIndex: state.tasks.filter(t => t.status === status).length,
    };
    setState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    return newTask;
  }, [state.defaultDuration, state.defaultPriority, state.defaultProjectId, state.tasks]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id === id) {
          const updated = { ...t, ...updates, updatedAt: Date.now() };
          // Handle isDone completion timestamp
          if (updates.isDone === true && !t.isDone) {
            updated.completedAt = Date.now();
          } else if (updates.isDone === false && t.isDone) {
            updated.completedAt = null;
          }
          return updated;
        }
        return t;
      })
    }));
  }, []);

  const updateMcpTasks = useCallback((ids: string[], updates: McpUpdateTaskFields) => {
    const selectedIds = new Set(ids);
    const updatedAt = Date.now();
    const applyUpdates = (task: Task): Task => {
      const updated = { ...task, ...updates, updatedAt };
      if (updates.status === 'done' || updates.isDone === true) {
        updated.isDone = true;
        if (!task.isDone) updated.completedAt = updatedAt;
      } else if (updates.isDone === false) {
        updated.isDone = false;
        updated.completedAt = null;
        if (task.status === 'done' && updates.status === undefined) {
          updated.status = 'backlog';
        }
      }
      return updated;
    };
    const updatedTasks = stateRef.current.tasks
      .filter(task => selectedIds.has(task.id))
      .map(applyUpdates);
    commitMcpState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => selectedIds.has(task.id) ? applyUpdates(task) : task),
    }));
    return updatedTasks;
  }, [commitMcpState]);

  const deleteTask = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id)
    }));
  }, []);

  const moveTask = useCallback((taskId: string, targetColumn: ColumnId, targetIndex?: number) => {
    setState(prev => {
      const taskIndex = prev.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return prev;

      const task = prev.tasks[taskIndex];
      const newTasks = [...prev.tasks];

      if (task.status === targetColumn) {
        // Reordering within the same column
        const colTasks = newTasks.filter(t => t.status === targetColumn).sort((a, b) => a.orderIndex - b.orderIndex);
        const oldColIndex = colTasks.findIndex(t => t.id === taskId);
        if (oldColIndex === -1) return prev;

        colTasks.splice(oldColIndex, 1);
        colTasks.splice(targetIndex !== undefined ? targetIndex : colTasks.length, 0, task);

        colTasks.forEach((t, i) => {
          const idx = newTasks.findIndex(nt => nt.id === t.id);
          newTasks[idx] = { ...newTasks[idx], orderIndex: i };
        });

        return { ...prev, tasks: newTasks };
      }

      // Moving to a new column
      const updatedAt = Date.now();
      const movedTask = applyTaskColumnTransition(task, targetColumn, updatedAt);

      const targetColTasks = newTasks.filter(t => t.status === targetColumn && t.id !== taskId).sort((a, b) => a.orderIndex - b.orderIndex);
      targetColTasks.splice(targetIndex !== undefined ? targetIndex : targetColTasks.length, 0, movedTask);

      targetColTasks.forEach((t, i) => {
        const idx = newTasks.findIndex(nt => nt.id === t.id);
        newTasks[idx] = { ...newTasks[idx], ...t, orderIndex: i, status: targetColumn };
      });

      return { ...prev, tasks: newTasks };
    });
  }, []);

  const cleanupBoard = useCallback(() => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        // Rule 1: Done goes to 'done'
        if (t.isDone) {
          return { ...t, status: 'done', updatedAt: Date.now() };
        }
        // Rule 2: Undone in Mon-Sun goes to 'backlog'
        if (!t.isDone && isDayColumnId(t.status)) {
          return { ...t, status: 'backlog', updatedAt: Date.now() };
        }
        return t;
      })
    }));
  }, []);

  const autofillWeek = useCallback(() => {
    setState(prev => {
      const newTasks = [...prev.tasks];
      const visibleDays = prev.visibleDays || DEFAULT_VISIBLE_DAYS;
      const targetDays = createAutofillTargetDays(
        visibleDays,
        new Date().getDay(),
        prev.autofillMode || 'current-weekday',
        prev.weekStartDay || 'mon'
      );

      const maxHoursPerDayByDay = prev.maxHoursPerDayByDay || createDefaultMaxHoursByDay();
      const assignments = createAutofillAssignments(newTasks, targetDays, maxHoursPerDayByDay);
      const updatedAt = Date.now();

      assignments.forEach(assignment => {
        const taskIndex = newTasks.findIndex(t => t.id === assignment.taskId);
        if (taskIndex === -1) return;

        newTasks[taskIndex] = {
          ...newTasks[taskIndex],
          status: assignment.day,
          orderIndex: assignment.orderIndex,
          updatedAt,
        };
      });

      return { ...prev, tasks: newTasks };
    });
  }, []);

  const sortColumn = useCallback((columnId: ColumnId, mode: ColumnSortMode = 'score-desc') => {
    setState(prev => {
      const newTasks = [...prev.tasks];
      const colTasks = newTasks.filter(t => t.status === columnId);

      colTasks.sort((a, b) => compareTasksByColumnSortMode(a, b, mode));

      // Update orderIndex
      colTasks.forEach((t, i) => {
        const idx = newTasks.findIndex(nt => nt.id === t.id);
        newTasks[idx] = { ...newTasks[idx], orderIndex: i };
      });

      return { ...prev, tasks: newTasks };
    });
  }, []);

  const evaluateReflection = useCallback((taskId: string, value: ReflectionValue) => {
    const now = Date.now();
    setState(prev => {
      const reflectionResult = recordTaskReflection(
        prev.tasks,
        prev.firstReflectionAt,
        taskId,
        value,
        now
      );
      if (reflectionResult.tasks === prev.tasks) return prev;

      return {
        ...prev,
        tasks: reflectionResult.tasks,
        firstReflectionAt: reflectionResult.firstReflectionAt,
      };
    });
  }, []);

  const addProject = useCallback((name: string) => {
    const id = `proj_${generateId()}`;
    setState(prev => ({
      ...prev,
      projects: [...prev.projects, { id, name }]
    }));
    return id;
  }, []);

  const postMcpProject = useCallback((payload: McpPostProjectPayload): Project => {
    const project = { id: `proj_${generateId()}`, name: payload.name };
    commitMcpState(prev => ({
      ...prev,
      projects: [...prev.projects, project],
    }));
    return project;
  }, [commitMcpState]);

  const deleteProject = useCallback((id: string, resolution: ProjectDeletionResolution) => {
    setState(prev => deleteProjectFromState(prev, id, resolution));
  }, []);

  const updateProject = useCallback((id: string, newName: string) => {
    setState(prev => ({
      ...prev,
      projects: prev.projects.map(p => p.id === id ? { ...p, name: newName } : p)
    }));
  }, []);

  const setDefaultProject = useCallback((id: string | null) => {
    setState(prev => setDefaultProjectInState(prev, id));
  }, []);

  const setVisibleDays = useCallback((days: DayColumnId[]) => {
    if (days.length === 0) return; // Enforce at least 1 day

    setState(prev => {
      // Find days that are being hidden
      const hiddenDays = (prev.visibleDays || DEFAULT_VISIBLE_DAYS).filter(d => !days.includes(d));

      let newTasks = prev.tasks;
      if (hiddenDays.length > 0) {
        newTasks = prev.tasks.map(t => {
          if (isDayColumnId(t.status) && hiddenDays.includes(t.status)) {
            if (t.isDone) {
              return { ...t, status: 'done', updatedAt: Date.now() };
            } else {
              return { ...t, status: 'backlog', updatedAt: Date.now() };
            }
          }
          return t;
        });
      }

      return {
        ...prev,
        visibleDays: days,
        tasks: newTasks
      };
    });
  }, []);

  const setGoals = useCallback((updater: (goals: Goal[]) => Goal[]) => {
    setState(prev => {
      const goals = updater(prev.goals);
      return {
        ...prev,
        goals,
        generalGoal: getFocusedOpenGoalSummary(goals),
      };
    });
  }, []);

  const addGoal = useCallback((title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const now = Date.now();
    setGoals(goals => {
      const focusedOpenCount = goals.filter(goal => goal.isFocused && goal.completedAt == null).length;

      return [
        ...goals,
        {
          id: `goal_${generateId()}`,
          title: trimmedTitle,
          isFocused: focusedOpenCount < 3,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        },
      ];
    });
  }, [setGoals]);

  const toggleGoalFocus = useCallback((id: string) => {
    setGoals(goals => goals.map(goal => (
      goal.id === id && goal.completedAt == null
        ? { ...goal, isFocused: !goal.isFocused, updatedAt: Date.now() }
        : goal
    )));
  }, [setGoals]);

  const updateGoal = useCallback((id: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setGoals(goals => goals.map(goal => (
      goal.id === id
        ? { ...goal, title: trimmedTitle, updatedAt: Date.now() }
        : goal
    )));
  }, [setGoals]);

  const completeGoal = useCallback((id: string) => {
    const now = Date.now();
    setGoals(goals => goals.map(goal => (
      goal.id === id && goal.completedAt == null
        ? { ...goal, completedAt: now, updatedAt: now }
        : goal
    )));
  }, [setGoals]);

  const uncompleteGoal = useCallback((id: string) => {
    const now = Date.now();
    setGoals(goals => goals.map(goal => (
      goal.id === id && goal.completedAt != null
        ? { ...goal, completedAt: null, updatedAt: now }
        : goal
    )));
  }, [setGoals]);

  const deleteGoal = useCallback((id: string) => {
    setGoals(goals => goals.filter(goal => goal.id !== id));
  }, [setGoals]);

  const setWeeklyGoals = useCallback((updater: (weeklyGoals: WeeklyGoal[]) => WeeklyGoal[]) => {
    setState(prev => ({
      ...prev,
      weeklyGoals: updater(prev.weeklyGoals),
    }));
  }, []);

  const postMcpTask = useCallback((payload: McpPostTaskPayload): Task => {
    const now = Date.now();
    const current = stateRef.current;
    const task: Task = {
      id: `task_${generateId()}`,
      title: payload.title,
      duration: payload.duration,
      dueDate: payload.dueDate,
      priority: payload.priority,
      projectId: payload.projectId,
      status: payload.status,
      isDone: payload.status === 'done',
      reflectionValue: ReflectionValue.Unreflected,
      createdAt: now,
      updatedAt: now,
      completedAt: payload.status === 'done' ? now : null,
      reflectedAt: null,
      orderIndex: current.tasks.filter(taskItem => taskItem.status === payload.status).length,
    };
    commitMcpState(prev => ({ ...prev, tasks: [...prev.tasks, task] }));
    return task;
  }, [commitMcpState]);

  const postMcpGoal = useCallback((payload: McpPostGoalPayload): Goal | WeeklyGoal => {
    const now = Date.now();
    if (payload.type === 'weekly') {
      const currentGoal = stateRef.current.weeklyGoals.find(goal => goal.completedAt == null);
      const goal: WeeklyGoal = currentGoal
        ? { ...currentGoal, title: payload.title, updatedAt: now }
        : {
          id: `weekly_goal_${generateId()}`,
          title: payload.title,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        };

      commitMcpState(prev => {
        const openIndex = prev.weeklyGoals.findIndex(candidate => candidate.completedAt == null);
        const weeklyGoals = openIndex < 0
          ? [...prev.weeklyGoals, goal]
          : prev.weeklyGoals.map((candidate, index) => index === openIndex ? goal : candidate);
        return { ...prev, weeklyGoals };
      });
      return goal;
    }

    const goal: Goal = {
      id: `goal_${generateId()}`,
      title: payload.title,
      isFocused: payload.isFocused,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    commitMcpState(prev => {
      const goals = [...prev.goals, goal];
      return { ...prev, goals, generalGoal: getFocusedOpenGoalSummary(goals) };
    });
    return goal;
  }, [commitMcpState]);

  const setMcpGoalFocus = useCallback((payload: McpSetGoalFocusPayload): Goal | null => {
    const goal = stateRef.current.goals.find(candidate => candidate.id === payload.id && candidate.completedAt == null);
    if (!goal) return null;
    if (goal.isFocused === payload.isFocused) return goal;

    const updatedGoal = { ...goal, isFocused: payload.isFocused, updatedAt: Date.now() };
    commitMcpState(prev => {
      const goals = prev.goals.map(candidate => (
        candidate.id === payload.id && candidate.completedAt == null ? updatedGoal : candidate
      ));
      return { ...prev, goals, generalGoal: getFocusedOpenGoalSummary(goals) };
    });
    return updatedGoal;
  }, [commitMcpState]);

  const defineWeeklyGoal = useCallback((title: string): string | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return null;

    const now = Date.now();
    const id = `weekly_goal_${generateId()}`;
    setWeeklyGoals(weeklyGoals => {
      if (weeklyGoals.some(goal => goal.completedAt == null)) return weeklyGoals;

      return [
        ...weeklyGoals,
        {
          id,
          title: trimmedTitle,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        },
      ];
    });
    return id;
  }, [setWeeklyGoals]);

  const updateWeeklyGoal = useCallback((id: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const now = Date.now();
    setWeeklyGoals(weeklyGoals => weeklyGoals.map(goal => (
      goal.id === id && goal.completedAt == null
        ? { ...goal, title: trimmedTitle, updatedAt: now }
        : goal
    )));
  }, [setWeeklyGoals]);

  const clearOpenWeeklyGoal = useCallback(() => {
    setWeeklyGoals(weeklyGoals => weeklyGoals.filter(goal => goal.completedAt != null));
  }, [setWeeklyGoals]);

  const deleteWeeklyGoal = useCallback((id: string) => {
    setWeeklyGoals(weeklyGoals => weeklyGoals.filter(goal => goal.id !== id));
  }, [setWeeklyGoals]);

  const completeWeeklyGoal = useCallback((id: string) => {
    const now = Date.now();
    setWeeklyGoals(weeklyGoals => weeklyGoals.map(goal => (
      goal.id === id && goal.completedAt == null
        ? { ...goal, completedAt: now, updatedAt: now }
        : goal
    )));
  }, [setWeeklyGoals]);

  const uncompleteWeeklyGoal = useCallback((id: string) => {
    const now = Date.now();
    setWeeklyGoals(weeklyGoals => weeklyGoals.map(goal => (
      goal.id === id && goal.completedAt != null
        ? { ...goal, completedAt: null, updatedAt: now }
        : goal
    )));
  }, [setWeeklyGoals]);

  const updateSettings = useCallback((updates: Partial<AppState>) => {
    setState(prev => {
      const goals = updates.goals ? normalizeGoals(updates.goals) : prev.goals;
      const weeklyGoals = updates.weeklyGoals ? normalizeWeeklyGoals(updates.weeklyGoals) : prev.weeklyGoals;

      return {
        ...prev,
        ...updates,
        maxHoursPerDayByDay: updates.maxHoursPerDayByDay
          ? normalizeMaxHoursByDay(updates.maxHoursPerDayByDay)
          : prev.maxHoursPerDayByDay,
        visibleDays: updates.visibleDays
          ? normalizeVisibleDays(updates.visibleDays)
          : prev.visibleDays,
        onboarding: updates.onboarding
          ? normalizeOnboardingState(updates.onboarding)
          : prev.onboarding,
        weekStartDay: updates.weekStartDay
          ? normalizeWeekStartDay(updates.weekStartDay)
          : prev.weekStartDay,
        goals,
        weeklyGoals,
        generalGoal: getFocusedOpenGoalSummary(goals),
      };
    });
  }, []);

  const addTemplate = useCallback((template: Omit<RecurringTemplate, 'id' | 'nextGenerationDate'>) => {
    const nextGen = calculateInitialNextGenDate(
      template.recurrenceType,
      template.dayOfWeek,
      template.dayOfMonth,
      template.timeOfDay
    );
    setState(prev => ({
      ...prev,
      templates: [...prev.templates, { ...template, id: `tpl_${generateId()}`, nextGenerationDate: nextGen }]
    }));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      templates: prev.templates.filter(t => t.id !== id)
    }));
  }, []);

  const generateRecurringTasks = useCallback(() => {
    setState(prev => {
      const update = createRecurringTasksUpdate({
        tasks: prev.tasks,
        templates: prev.templates,
        createId: () => generateId(),
      });

      if (update.hasChanges) {
        return { ...prev, tasks: update.tasks, templates: update.templates };
      }
      return prev;
    });
  }, []);

  const exportDataAsJSON = useCallback((): string => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importDataFromJSON = useCallback((jsonString: string): { success: boolean; messageKey: string } => {
    try {
      const parsed: unknown = JSON.parse(jsonString);
      const importedData = parseLegacyImportData(parsed);
      if (!importedData) {
        return { success: false, messageKey: 'import.invalidStructure' as const };
      }

      const nextState = mergeLegacyImportData(stateRef.current, importedData);
      if (!nextState) {
        return { success: false, messageKey: 'import.tooMany' as const };
      }

      stateRef.current = nextState;
      setState(nextState);

      return { success: true, messageKey: 'import.success' as const };
    } catch (e) {
      return { success: false, messageKey: 'import.parseError' as const };
    }
  }, []);

  const deleteAllTasks = useCallback(() => {
    setState(prev => ({ ...prev, tasks: [] }));
  }, []);

  const createPlanwerkFile = useCallback(async (language: ResolvedLanguage = 'en') => {
    const api = window.planwerkFile;
    if (!api) {
      setStorageStatus(prev => ({ ...prev, error: 'file.browserUnsupported' }));
      return false;
    }

    try {
      setStorageStatus(prev => ({ ...prev, isLoading: true, error: null }));
      const initialState = createDefaultState(language);
      const result = await api.create({ initialData: appStateToPlanwerkData(initialState) });

      if (result.ok && result.data) {
        applyLoadedPlanwerk(result);
        return true;
      }

      setStorageStatus(prev => ({
        ...prev,
        isLoading: false,
        needsFileSelection: !prev.hasOpenFile,
        error: result.canceled ? prev.error : (result.message || 'file.createFailed'),
      }));
      return false;
    } catch (error) {
      setStorageStatus(prev => ({
        ...prev,
        isLoading: false,
        needsFileSelection: !prev.hasOpenFile,
        error: error instanceof Error ? error.message : 'file.createFailed',
      }));
      return false;
    }
  }, [applyLoadedPlanwerk]);

  const openPlanwerkFile = useCallback(async () => {
    const api = window.planwerkFile;
    if (!api) {
      setStorageStatus(prev => ({ ...prev, error: 'file.browserUnsupported' }));
      return false;
    }

    try {
      setStorageStatus(prev => ({ ...prev, isLoading: true, error: null }));
      const result = await api.open();

      if (result.ok && result.data) {
        applyLoadedPlanwerk(result);
        return true;
      }

      setStorageStatus(prev => ({
        ...prev,
        isLoading: false,
        needsFileSelection: !prev.hasOpenFile,
        error: result.canceled ? prev.error : (result.message || 'file.openFailed'),
      }));
      return false;
    } catch (error) {
      setStorageStatus(prev => ({
        ...prev,
        isLoading: false,
        needsFileSelection: !prev.hasOpenFile,
        error: error instanceof Error ? error.message : 'file.openFailed',
      }));
      return false;
    }
  }, [applyLoadedPlanwerk]);

  const closePlanwerkFile = useCallback(async () => {
    const api = window.planwerkFile;
    if (!api) {
      setStorageStatus(prev => ({ ...prev, error: 'file.browserUnsupported' }));
      return;
    }

    try {
      setStorageStatus(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        saveError: null,
        pendingConflict: null,
      }));

      const result = await api.close();
      if (result.ok) {
        hasLoadedFileRef.current = false;
        baseDataRef.current = null;
        baseSignatureRef.current = null;
        baseUpdatedAtRef.current = null;
        skipNextSaveRef.current = true;
        setState(defaultState);
        setStorageStatus(prev => ({
          ...prev,
          isLoading: false,
          hasOpenFile: false,
          needsFileSelection: true,
          filePath: null,
          fileName: null,
          error: null,
          saveError: null,
          pendingConflict: null,
        }));
        return;
      }

      setStorageStatus(prev => ({
        ...prev,
        isLoading: false,
        error: result.message || 'file.closeFailed',
      }));
    } catch (error) {
      setStorageStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'file.closeFailed',
      }));
    }
  }, []);

  const resolvePlanwerkConflict = useCallback(async (resolution: 'local' | 'external' | 'both') => {
    const conflict = storageStatus.pendingConflict;
    const api = window.planwerkFile;
    if (!conflict || !api) return;

    if (resolution === 'external') {
      skipNextSaveRef.current = true;
      setBasePlanwerk(conflict.externalData, conflict.externalSignature, conflict.externalUpdatedAt);
      setState(planwerkDataToAppState(conflict.externalData));
      setStorageStatus(prev => ({ ...prev, pendingConflict: null, saveError: null }));
      return;
    }

    setStorageStatus(prev => ({ ...prev, isSaving: true, saveError: null }));

    try {
      if (resolution === 'both') {
        const copyResult = await api.copyExternalVersion({ data: conflict.externalData });
        if (!copyResult.ok) {
          setStorageStatus(prev => ({
            ...prev,
            isSaving: false,
            saveError: copyResult.message || 'file.copyFailed',
          }));
          return;
        }
      }

      const saveResult = await api.save(conflict.localData, { expectedSignature: conflict.externalSignature });
      if (saveResult.ok) {
        setBasePlanwerk(conflict.localData, saveResult.signature, saveResult.updatedAt);
        skipNextSaveRef.current = true;
        setState(planwerkDataToAppState(conflict.localData));
        setStorageStatus(prev => ({
          ...prev,
          isSaving: false,
          pendingConflict: null,
          saveError: null,
          filePath: saveResult.path || prev.filePath,
          fileName: saveResult.name || prev.fileName,
        }));
        return;
      }

      if (saveResult.reason === 'signature-conflict' && saveResult.external) {
        handleExternalPlanwerkChange(saveResult.external);
        return;
      }

      setStorageStatus(prev => ({
        ...prev,
        isSaving: false,
        saveError: saveResult.message || 'file.saveFailed',
      }));
    } catch (error) {
      setStorageStatus(prev => ({
        ...prev,
        isSaving: false,
        saveError: error instanceof Error ? error.message : 'file.saveFailed',
      }));
    }
  }, [handleExternalPlanwerkChange, setBasePlanwerk, storageStatus.pendingConflict]);

  return {
    state,
    getMcpState,
    storageStatus,
    addTask,
    postMcpTask,
    updateTask,
    updateMcpTasks,
    deleteTask,
    moveTask,
    cleanupBoard,
    autofillWeek,
    evaluateReflection,
    addProject,
    postMcpProject,
    deleteProject,
    updateProject,
    setDefaultProject,
    setVisibleDays,
    addGoal,
    postMcpGoal,
    setMcpGoalFocus,
    toggleGoalFocus,
    updateGoal,
    completeGoal,
    uncompleteGoal,
    deleteGoal,
    defineWeeklyGoal,
    updateWeeklyGoal,
    clearOpenWeeklyGoal,
    deleteWeeklyGoal,
    completeWeeklyGoal,
    uncompleteWeeklyGoal,
    addTemplate,
    deleteTemplate,
    generateRecurringTasks,
    updateSettings,
    exportDataAsJSON,
    importDataFromJSON,
    deleteAllTasks,
    createPlanwerkFile,
    openPlanwerkFile,
    closePlanwerkFile,
    resolvePlanwerkConflict,
    sortColumn,
  };
};
