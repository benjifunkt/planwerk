import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from './hooks/useStore';
import { Board } from './components/Board';
import { TaskCreateModal } from './components/TaskCreateModal';
import { ReflectionView } from './components/ReflectionView';
import { GoalsView } from './components/GoalsView';
import { SettingsView } from './components/SettingsView';
import { UpdateAvailableDialog } from './components/UpdateAvailableDialog';
import { PlanwerkWelcomeScreen } from './components/PlanwerkWelcomeScreen';
import { PlanwerkCreateTaskOnboardingScreen } from './components/PlanwerkCreateTaskOnboardingScreen';
import { InAppTutorialPanel } from './components/InAppTutorialPanel';
import { ViewIntroTutorialScreen } from './components/ViewIntroTutorialScreen';
import { WeeklySidebarIcon, buildWeeklySidebarIconBars } from './components/WeeklySidebarIcon';
import { AnimatedAutofillLogo, AnimatedBoardDragLogo, AnimatedBoardReadyLogo, AnimatedCleanupLogo, AnimatedGoalsMagnetLogo, AnimatedLookbackCompassLogo, AnimatedReflectionChoiceLogo, AnimatedSpaceKeyLogo } from './components/animations';
import { IconPlus, IconRefresh, IconWand, IconChart, IconBrain, IconSettings, IconTarget, IconHalfCircle, IconTrail } from './components/Icons';
import { ReflectionValue, Task, Priority, ColumnId, DayColumnId, PlanwerkMcpStatus, PlanwerkUpdateStatus, OnboardingTutorialState } from './types';
import { I18nProvider, TranslationKey, useI18n } from './i18n';
import { DAY_COLUMN_IDS, getOrderedDayColumnIds } from './constants';
import { getCurrentWeekDayColumnISO, getLocalISODateWithOffset } from './utils/dateUtils';
import { getNextRecurringGenerationDelay } from './utils/recurringTasks';
import {
  markBulkTaskShortcutHintShown,
  markWeeklyReflectionReminderShown,
  recordCleanupTutorialCompleted,
  recordTaskCreatedForBulkShortcutHint,
  shouldOfferBulkTaskShortcutHint,
} from './utils/onboardingHints';
import {
  shouldShowWeeklyReflectionReminderAfterCleanup,
  shouldShowWeeklyReflectionReminderAfterTaskCompletion,
} from './utils/weeklyReflectionReminder';
import {
  getTaskToggleMoveTarget,
  isPendingTaskMoveValid,
  PendingTaskMove,
  TaskTerminalColumn,
} from './utils/taskColumnTransitions';

type ViewMode = 'board' | 'reflection' | 'charts' | 'goals' | 'settings';
type BoardTutorialStep = 'drag' | 'spaceShortcut' | 'ready';
type SecondaryTutorialKey = 'autofill' | 'cleanup';
type ViewIntroTutorialKey = 'reflection' | 'lookback' | 'goals';

const VIEW_INTRO_TUTORIAL_VIEW: Record<ViewIntroTutorialKey, ViewMode> = {
  reflection: 'reflection',
  lookback: 'charts',
  goals: 'goals',
};

const VIEW_INTRO_TUTORIAL_COPY: Record<ViewIntroTutorialKey, { title: TranslationKey; body: TranslationKey }> = {
  reflection: {
    title: 'viewIntroTutorial.reflectionTitle',
    body: 'viewIntroTutorial.reflectionBody',
  },
  lookback: {
    title: 'viewIntroTutorial.lookbackTitle',
    body: 'viewIntroTutorial.lookbackBody',
  },
  goals: {
    title: 'viewIntroTutorial.goalsTitle',
    body: 'viewIntroTutorial.goalsBody',
  },
};

const SIDEBAR_EXPANDED_MEDIA_QUERY = '(min-width: 768px)';
const BOARD_ENTER_FADE_MS = 1000;
const BOARD_TUTORIAL_EXIT_MS = 550;
const COMPLETED_ONBOARDING_TUTORIAL: OnboardingTutorialState = {
  workWeek: true,
  createTask: true,
  board: true,
  autofill: true,
  cleanup: true,
  reflection: true,
  lookback: true,
  goals: true,
};
const ChartsView = React.lazy(() => (
  import('./components/ChartsView').then(module => ({ default: module.ChartsView }))
));

const isInitialOnboardingTutorial = (tutorial: OnboardingTutorialState) => (
  Object.values(tutorial).every(value => value === false)
);

export default function App() {
  const store = useStore();

  return (
    <I18nProvider languageSetting={store.state.language || 'system'}>
      <AppContent store={store} />
    </I18nProvider>
  );
}

const AppContent: React.FC<{ store: ReturnType<typeof useStore> }> = ({ store }) => {
  const { t, language: resolvedLanguage } = useI18n();
  const {
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
    createPlanwerkFile,
    openPlanwerkFile,
    closePlanwerkFile,
    resolvePlanwerkConflict,
    sortColumn
  } = store;

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskColumn, setNewTaskColumn] = useState<ColumnId>('backlog');
  const [newTaskInitialDueDate, setNewTaskInitialDueDate] = useState<string | null>(null);
  const [boardTutorialStep, setBoardTutorialStep] = useState<BoardTutorialStep>('drag');
  const [isBoardTutorialExiting, setIsBoardTutorialExiting] = useState(false);
  const [isBoardEnteringFromOnboarding, setIsBoardEnteringFromOnboarding] = useState(false);
  const [activeSecondaryTutorial, setActiveSecondaryTutorial] = useState<SecondaryTutorialKey | null>(null);
  const [isSecondaryTutorialExiting, setIsSecondaryTutorialExiting] = useState(false);
  const [isWeeklyReflectionReminderOpen, setIsWeeklyReflectionReminderOpen] = useState(false);
  const [isWeeklyReflectionReminderExiting, setIsWeeklyReflectionReminderExiting] = useState(false);
  const [pendingViewTutorial, setPendingViewTutorial] = useState<ViewIntroTutorialKey | null>(null);
  const [hasCompletedIntroOnboarding, setHasCompletedIntroOnboarding] = useState(false);
  const generatedRecurringForFileRef = React.useRef<string | null>(null);
  const recurringGenerationTimerRef = React.useRef<number | null>(null);
  const pendingTaskMoveTimersRef = React.useRef<Record<string, number>>({});
  const [pendingTaskMoves, setPendingTaskMoves] = useState<Record<string, PendingTaskMove>>({});
  const [recurringGenerationRunNonce, setRecurringGenerationRunNonce] = useState(0);
  const [mcpStatus, setMcpStatus] = useState<PlanwerkMcpStatus | null>(null);
  const [updateStatus, setUpdateStatus] = useState<PlanwerkUpdateStatus | null>(null);
  const [updateDialogVersion, setUpdateDialogVersion] = useState<string | null>(null);
  const [isSidebarExpandable, setIsSidebarExpandable] = useState(() => (
    typeof window === 'undefined' || window.matchMedia(SIDEBAR_EXPANDED_MEDIA_QUERY).matches
  ));
  const sidebarCollapsed = state.sidebarCollapsed;
  const effectiveSidebarCollapsed = sidebarCollapsed || !isSidebarExpandable;
  const effectiveViewMode = pendingViewTutorial ? VIEW_INTRO_TUTORIAL_VIEW[pendingViewTutorial] : viewMode;
  const weeklySidebarIconBars = useMemo(() => buildWeeklySidebarIconBars({
    tasks: state.tasks,
    visibleDays: getOrderedDayColumnIds(state.weekStartDay).filter(day => state.visibleDays.includes(day)),
    maxHoursPerDayByDay: state.maxHoursPerDayByDay,
  }), [state.maxHoursPerDayByDay, state.tasks, state.visibleDays, state.weekStartDay]);
  const toggleSidebarCollapsed = useCallback(() => {
    if (!isSidebarExpandable) return;
    updateSettings({ sidebarCollapsed: !sidebarCollapsed });
  }, [isSidebarExpandable, sidebarCollapsed, updateSettings]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(SIDEBAR_EXPANDED_MEDIA_QUERY);
    const handleChange = () => setIsSidebarExpandable(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const clearPendingTaskMove = useCallback((id: string) => {
    const timerId = pendingTaskMoveTimersRef.current[id];
    if (timerId !== undefined) {
      window.clearInterval(timerId);
      delete pendingTaskMoveTimersRef.current[id];
    }

    setPendingTaskMoves(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const startPendingTaskMove = useCallback((id: string, targetColumn: TaskTerminalColumn) => {
    clearPendingTaskMove(id);

    let remainingSeconds = 5;
    setPendingTaskMoves(prev => ({
      ...prev,
      [id]: { targetColumn, remainingSeconds },
    }));

    const timerId = window.setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        window.clearInterval(timerId);
        delete pendingTaskMoveTimersRef.current[id];
        setPendingTaskMoves(prev => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        moveTask(id, targetColumn);
        return;
      }

      setPendingTaskMoves(prev => (
        id in prev
          ? { ...prev, [id]: { targetColumn, remainingSeconds } }
          : prev
      ));
    }, 1000);

    pendingTaskMoveTimersRef.current[id] = timerId;
  }, [clearPendingTaskMove, moveTask]);

  useEffect(() => {
    return () => {
      Object.values(pendingTaskMoveTimersRef.current).forEach(timerId => window.clearInterval(timerId));
      pendingTaskMoveTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!window.planwerkMcp) return;

    let isMounted = true;
    window.planwerkMcp.getStatus().then((status) => {
      if (isMounted) setMcpStatus(status);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!window.planwerkUpdater) return;

    let isMounted = true;
    window.planwerkUpdater.getStatus().then((status) => {
      if (isMounted) setUpdateStatus(status);
    });
    const unsubscribe = window.planwerkUpdater.onStatus((status) => {
      if (isMounted) setUpdateStatus(status);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (
      updateStatus?.phase === 'available'
      && updateStatus.shouldNotify
      && !updateStatus.automaticInstallationSupported
      && updateStatus.availableVersion
    ) {
      setUpdateDialogVersion(updateStatus.availableVersion);
    }
  }, [updateStatus]);

  const runRecurringGeneration = useCallback(() => {
    if (!storageStatus.hasOpenFile) return;
    generateRecurringTasks();
    setRecurringGenerationRunNonce(value => value + 1);
  }, [generateRecurringTasks, storageStatus.hasOpenFile]);

  // Run generator once immediately per opened Planwerk file.
  useEffect(() => {
    if (!storageStatus.hasOpenFile) return;
    const generationKey = storageStatus.filePath || 'open-planwerk';
    if (generatedRecurringForFileRef.current === generationKey) return;

    generatedRecurringForFileRef.current = generationKey;
    runRecurringGeneration();
  }, [runRecurringGeneration, storageStatus.filePath, storageStatus.hasOpenFile]);

  useEffect(() => {
    if (!storageStatus.hasOpenFile) return;

    const delay = getNextRecurringGenerationDelay(state.templates);
    if (delay == null) return;

    const timerId = window.setTimeout(runRecurringGeneration, delay);
    recurringGenerationTimerRef.current = timerId;

    return () => {
      window.clearTimeout(timerId);
      if (recurringGenerationTimerRef.current === timerId) {
        recurringGenerationTimerRef.current = null;
      }
    };
  }, [recurringGenerationRunNonce, runRecurringGeneration, state.templates, storageStatus.hasOpenFile]);

  useEffect(() => {
    if (!storageStatus.hasOpenFile) return;

    const handleRecurringVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRecurringGeneration();
      }
    };

    window.addEventListener('focus', runRecurringGeneration);
    document.addEventListener('visibilitychange', handleRecurringVisibilityChange);

    return () => {
      window.removeEventListener('focus', runRecurringGeneration);
      document.removeEventListener('visibilitychange', handleRecurringVisibilityChange);
    };
  }, [runRecurringGeneration, storageStatus.hasOpenFile]);

  useEffect(() => {
    if (!storageStatus.hasOpenFile) {
      generatedRecurringForFileRef.current = null;
    }
  }, [storageStatus.hasOpenFile]);

  useEffect(() => {
    setHasCompletedIntroOnboarding(false);
  }, [storageStatus.filePath]);

  // Theme observer
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (state.theme === 'dark') {
      applyTheme(true);
    } else if (state.theme === 'light') {
      applyTheme(false);
    } else {
      // System
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [state.theme]);

  const unreflectedCount = useMemo(() => (
    state.tasks.filter(t => t.isDone && t.reflectionValue === ReflectionValue.Unreflected).length
  ), [state.tasks]);
  const maxTaskCapacityMinutes = useMemo(() => {
    const visibleDays = state.visibleDays || [];
    if (visibleDays.length === 0) return 0;

    return Math.max(...visibleDays.map(day => (state.maxHoursPerDayByDay[day] || 0) * 60));
  }, [state.maxHoursPerDayByDay, state.visibleDays]);
  const isAtInitialOnboarding = isInitialOnboardingTutorial(state.onboarding.tutorial);
  const shouldShowIntroOnboarding = storageStatus.hasOpenFile && isAtInitialOnboarding && !hasCompletedIntroOnboarding;
  const shouldShowWorkWeekOnboarding = storageStatus.hasOpenFile && hasCompletedIntroOnboarding && !state.onboarding.tutorial.workWeek;
  const shouldShowCreateTaskOnboarding = storageStatus.hasOpenFile && state.onboarding.tutorial.workWeek && !state.onboarding.tutorial.createTask;
  const shouldShowBoardTutorial = storageStatus.hasOpenFile && state.onboarding.tutorial.workWeek && state.onboarding.tutorial.createTask && !state.onboarding.tutorial.board;
  const shouldRenderBoardTutorial = shouldShowBoardTutorial && viewMode === 'board' && !isBoardEnteringFromOnboarding;
  const shouldRenderWeeklyReflectionReminder = isWeeklyReflectionReminderOpen && !shouldRenderBoardTutorial && activeSecondaryTutorial === null;
  const shouldRenderSecondaryTutorial = activeSecondaryTutorial !== null && !shouldRenderBoardTutorial && !isWeeklyReflectionReminderOpen;
  const shouldShowBulkTaskShortcutHint = shouldOfferBulkTaskShortcutHint(state.onboarding);

  const openWeeklyReflectionReminder = useCallback(() => {
    if (isWeeklyReflectionReminderOpen) return;

    updateSettings({
      onboarding: markWeeklyReflectionReminderShown(state.onboarding),
    });
    setIsWeeklyReflectionReminderExiting(false);
    setIsWeeklyReflectionReminderOpen(true);
  }, [isWeeklyReflectionReminderOpen, state.onboarding, updateSettings]);

  const handleOpenNewTask = useCallback((colId: ColumnId = 'backlog') => {
    setNewTaskColumn(colId);
    setNewTaskInitialDueDate(
      DAY_COLUMN_IDS.includes(colId as DayColumnId)
        ? getCurrentWeekDayColumnISO(colId as DayColumnId, new Date(), state.weekStartDay)
        : getLocalISODateWithOffset(state.defaultDueDateOffsetDays ?? 0)
    );
    setEditingTask(null);
    setIsModalOpen(true);
  }, [state.defaultDueDateOffsetDays, state.weekStartDay]);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  }, []);

  const handleCloseTaskModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSaveTask = useCallback((id: string | null, title: string, duration: number, priority: Priority, dueDate: string | null, projectId: string | null, newProjectName?: string) => {
    let finalProjectId = projectId;

    // Auto-create new project if typed in the combobox
    if (!projectId && newProjectName) {
      finalProjectId = addProject(newProjectName);
    }

    if (id) {
      updateTask(id, { title, duration, priority, dueDate, projectId: finalProjectId });
    } else {
      addTask(title, duration, priority, dueDate, finalProjectId, newTaskColumn, newTaskColumn === 'done');

      const nextOnboarding = recordTaskCreatedForBulkShortcutHint(state.onboarding);
      if (nextOnboarding !== state.onboarding) {
        updateSettings({ onboarding: nextOnboarding });
      }
    }
  }, [addProject, addTask, newTaskColumn, state.onboarding, updateSettings, updateTask]);

  const handleBulkTaskShortcutHintShown = useCallback(() => {
    const nextOnboarding = markBulkTaskShortcutHintShown(state.onboarding);
    if (nextOnboarding !== state.onboarding) {
      updateSettings({ onboarding: nextOnboarding });
    }
  }, [state.onboarding, updateSettings]);

  useEffect(() => {
    Object.entries(pendingTaskMoves).forEach(([id, pendingMove]) => {
      const task = state.tasks.find(t => t.id === id);
      if (!task || !isPendingTaskMoveValid(task, pendingMove.targetColumn)) {
        clearPendingTaskMove(id);
      }
    });
  }, [clearPendingTaskMove, pendingTaskMoves, state.tasks]);

  const handleToggleDone = useCallback((id: string, isDone: boolean) => {
    const task = state.tasks.find(t => t.id === id);
    const now = new Date();
    const tasksAfterToggle = state.tasks.map(currentTask => currentTask.id === id
      ? {
          ...currentTask,
          isDone,
          completedAt: isDone ? currentTask.completedAt ?? now.getTime() : null,
        }
      : currentTask
    );
    const shouldOpenReflectionReminder = (
      isDone
      && task?.isDone === false
      && viewMode === 'board'
      && !shouldRenderBoardTutorial
      && !activeSecondaryTutorial
      && !isWeeklyReflectionReminderOpen
      && pendingViewTutorial === null
      && shouldShowWeeklyReflectionReminderAfterTaskCompletion({
        tasks: tasksAfterToggle,
        visibleDays: state.visibleDays,
        weekStartDay: state.weekStartDay,
        onboarding: state.onboarding,
        completedTaskId: id,
        now,
      })
    );

    updateTask(id, { isDone });
    const targetColumn = task ? getTaskToggleMoveTarget(task, isDone) : null;
    if (targetColumn) {
      startPendingTaskMove(id, targetColumn);
    } else {
      clearPendingTaskMove(id);
    }
    if (shouldOpenReflectionReminder) {
      openWeeklyReflectionReminder();
    }
  }, [activeSecondaryTutorial, clearPendingTaskMove, isWeeklyReflectionReminderOpen, openWeeklyReflectionReminder, pendingViewTutorial, shouldRenderBoardTutorial, startPendingTaskMove, state.onboarding, state.tasks, state.visibleDays, state.weekStartDay, updateTask, viewMode]);

  const handleDropTask = useCallback((taskId: string, targetCol: ColumnId, targetIndex?: number) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (task?.status !== targetCol) {
      clearPendingTaskMove(taskId);
    }
    moveTask(taskId, targetCol, targetIndex);
    if (shouldShowBoardTutorial && boardTutorialStep === 'drag') {
      setBoardTutorialStep('spaceShortcut');
    }
  }, [boardTutorialStep, clearPendingTaskMove, moveTask, shouldShowBoardTutorial, state.tasks]);

  const handleDeleteTask = useCallback((id: string) => {
    clearPendingTaskMove(id);
    deleteTask(id);
  }, [clearPendingTaskMove, deleteTask]);

  const handleToggleBacklogPin = useCallback(() => {
    updateSettings({ backlogPinned: !state.backlogPinned });
  }, [state.backlogPinned, updateSettings]);

  const handleNavigateToView = useCallback((targetView: ViewMode, tutorialKey?: ViewIntroTutorialKey) => {
    if (tutorialKey && !state.onboarding.tutorial[tutorialKey]) {
      setPendingViewTutorial(tutorialKey);
      return;
    }

    setPendingViewTutorial(null);
    setViewMode(targetView);
  }, [state.onboarding.tutorial]);

  const completeViewIntroTutorial = useCallback(() => {
    if (!pendingViewTutorial) return;

    updateSettings({
      onboarding: {
        ...state.onboarding,
        tutorial: {
          ...state.onboarding.tutorial,
          [pendingViewTutorial]: true,
        },
      },
    });
    setViewMode(VIEW_INTRO_TUTORIAL_VIEW[pendingViewTutorial]);
    setPendingViewTutorial(null);
  }, [pendingViewTutorial, state.onboarding, updateSettings]);

  const handleCreatePlanwerkFileFromWelcome = useCallback(async () => {
    return createPlanwerkFile(resolvedLanguage);
  }, [createPlanwerkFile, resolvedLanguage]);

  const handleCreatePlanwerkFileFromSettings = useCallback(
    () => createPlanwerkFile(resolvedLanguage),
    [createPlanwerkFile, resolvedLanguage]
  );

  const handleOpenPlanwerkFileFromWelcome = useCallback(async () => {
    return openPlanwerkFile();
  }, [openPlanwerkFile]);

  const handleCompleteWelcomeIntro = useCallback(() => {
    setHasCompletedIntroOnboarding(true);
  }, []);

  const handleSkipWelcomeOnboarding = useCallback(() => {
    updateSettings({
      onboarding: markWeeklyReflectionReminderShown(
        markBulkTaskShortcutHintShown({
          ...state.onboarding,
          tutorial: COMPLETED_ONBOARDING_TUTORIAL,
        })
      ),
    });
  }, [state.onboarding, updateSettings]);

  const handleCompleteWelcomeWorkWeekSetup = useCallback(() => {
    updateSettings({
      onboarding: {
        ...state.onboarding,
        tutorial: {
          ...state.onboarding.tutorial,
          workWeek: true,
        },
      },
    });
  }, [state.onboarding, updateSettings]);

  const handleCreateOnboardingTask = useCallback((
    title: string,
    duration: number,
    priority: Priority,
    dueDate: string | null,
    projectId: string | null,
    newProjectName?: string
  ) => {
    let finalProjectId = projectId;

    if (!projectId && newProjectName) {
      finalProjectId = addProject(newProjectName);
    }

    const createdTask = addTask(title, duration, priority, dueDate, finalProjectId, 'backlog', false);
    return createdTask;
  }, [addProject, addTask]);

  const handleCompleteCreateTaskOnboarding = useCallback(() => {
    updateSettings({
      onboarding: {
        ...state.onboarding,
        tutorial: {
          ...state.onboarding.tutorial,
          createTask: true,
        },
      },
    });
    setViewMode('board');
    setBoardTutorialStep('drag');
    setIsBoardTutorialExiting(false);
    setIsBoardEnteringFromOnboarding(true);
    window.setTimeout(() => setIsBoardEnteringFromOnboarding(false), BOARD_ENTER_FADE_MS);
  }, [state.onboarding, updateSettings]);

  const handleBoardTutorialContinue = useCallback(() => {
    if (boardTutorialStep === 'drag') {
      setBoardTutorialStep('spaceShortcut');
      return;
    }

    if (boardTutorialStep === 'spaceShortcut') {
      setBoardTutorialStep('ready');
      return;
    }

    setIsBoardTutorialExiting(true);
    window.setTimeout(() => {
      updateSettings({
        onboarding: {
          ...state.onboarding,
          tutorial: {
            ...state.onboarding.tutorial,
            board: true,
          },
        },
      });
      setIsBoardTutorialExiting(false);
    }, BOARD_TUTORIAL_EXIT_MS);
  }, [boardTutorialStep, state.onboarding, updateSettings]);

  const handleAutofillClick = useCallback(() => {
    if (shouldRenderBoardTutorial || activeSecondaryTutorial || isWeeklyReflectionReminderOpen) return;

    if (!state.onboarding.tutorial.autofill) {
      setActiveSecondaryTutorial('autofill');
      setIsSecondaryTutorialExiting(false);
      return;
    }

    autofillWeek();
  }, [activeSecondaryTutorial, autofillWeek, isWeeklyReflectionReminderOpen, shouldRenderBoardTutorial, state.onboarding.tutorial.autofill]);

  const handleCleanupClick = useCallback(() => {
    if (shouldRenderBoardTutorial || activeSecondaryTutorial || isWeeklyReflectionReminderOpen) return;

    if (!state.onboarding.tutorial.cleanup) {
      setActiveSecondaryTutorial('cleanup');
      setIsSecondaryTutorialExiting(false);
      return;
    }

    const shouldOpenReflectionReminder = shouldShowWeeklyReflectionReminderAfterCleanup({
      tasks: state.tasks,
      visibleDays: state.visibleDays,
      weekStartDay: state.weekStartDay,
      onboarding: state.onboarding,
    });
    cleanupBoard();
    if (shouldOpenReflectionReminder) {
      openWeeklyReflectionReminder();
    }
  }, [activeSecondaryTutorial, cleanupBoard, isWeeklyReflectionReminderOpen, openWeeklyReflectionReminder, shouldRenderBoardTutorial, state.onboarding, state.tasks, state.visibleDays, state.weekStartDay]);

  const completeSecondaryTutorial = useCallback(() => {
    if (!activeSecondaryTutorial) return;

    setIsSecondaryTutorialExiting(true);
    window.setTimeout(() => {
      const completedOnboarding = {
        ...state.onboarding,
        tutorial: {
          ...state.onboarding.tutorial,
          [activeSecondaryTutorial]: true,
        },
      };
      updateSettings({
        onboarding: activeSecondaryTutorial === 'cleanup'
          ? recordCleanupTutorialCompleted(completedOnboarding, Date.now())
          : completedOnboarding,
      });
      activeSecondaryTutorial === 'autofill' ? autofillWeek() : cleanupBoard();
      setActiveSecondaryTutorial(null);
      setIsSecondaryTutorialExiting(false);
    }, BOARD_TUTORIAL_EXIT_MS);
  }, [activeSecondaryTutorial, autofillWeek, cleanupBoard, state.onboarding, updateSettings]);

  const closeWeeklyReflectionReminder = useCallback((openReflection: boolean) => {
    setIsWeeklyReflectionReminderExiting(true);
    window.setTimeout(() => {
      if (openReflection) {
        updateSettings({
          onboarding: markWeeklyReflectionReminderShown({
            ...state.onboarding,
            tutorial: {
              ...state.onboarding.tutorial,
              reflection: true,
            },
          }),
        });
        setPendingViewTutorial(null);
        setViewMode('reflection');
      }
      setIsWeeklyReflectionReminderOpen(false);
      setIsWeeklyReflectionReminderExiting(false);
    }, BOARD_TUTORIAL_EXIT_MS);
  }, [state.onboarding, updateSettings]);

  // Global spacebar shortcut for new task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!storageStatus.hasOpenFile || !state.onboarding.tutorial.createTask) return;

      if (e.code === 'Space' && shouldShowBoardTutorial && boardTutorialStep === 'drag') {
        e.preventDefault();
        return;
      }

      if (e.code === 'Space') {
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable
        );

        if (!isInput && !isModalOpen) {
          e.preventDefault();
          if (shouldShowBoardTutorial && boardTutorialStep === 'spaceShortcut') {
            setBoardTutorialStep('ready');
          }
          handleOpenNewTask('backlog');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boardTutorialStep, isModalOpen, handleOpenNewTask, shouldShowBoardTutorial, state.onboarding.tutorial.createTask, storageStatus.hasOpenFile]);

  // Expose only the active workspace actions needed by the local MCP adapter.
  useEffect(() => {
    window.__MCP_GET_STATE__ = () => storageStatus.hasOpenFile ? getMcpState() : null;
    window.__MCP_POST_PROJECT__ = (payload) => {
      if (!storageStatus.hasOpenFile) return null;
      return postMcpProject(payload);
    };
    window.__MCP_POST_TASK__ = (payload) => {
      if (!storageStatus.hasOpenFile) return null;
      return postMcpTask(payload);
    };
    window.__MCP_UPDATE_TASKS__ = (payload) => {
      if (!storageStatus.hasOpenFile) return null;
      return updateMcpTasks(payload.ids, payload.updates);
    };
    window.__MCP_POST_GOAL__ = (payload) => {
      if (!storageStatus.hasOpenFile) return null;
      return postMcpGoal(payload);
    };
    window.__MCP_SET_GOAL_FOCUS__ = (payload) => {
      if (!storageStatus.hasOpenFile) return null;
      return setMcpGoalFocus(payload);
    };

    return () => {
      delete window.__MCP_GET_STATE__;
      delete window.__MCP_POST_PROJECT__;
      delete window.__MCP_POST_TASK__;
      delete window.__MCP_UPDATE_TASKS__;
      delete window.__MCP_POST_GOAL__;
      delete window.__MCP_SET_GOAL_FOCUS__;
    };
  }, [getMcpState, postMcpGoal, postMcpProject, postMcpTask, setMcpGoalFocus, storageStatus.hasOpenFile, updateMcpTasks]);

  const handleSetMcpEnabled = useCallback(async (enabled: boolean) => {
    if (!window.planwerkMcp) return;
    setMcpStatus(await window.planwerkMcp.setEnabled(enabled));
  }, []);

  const handleRegenerateMcpToken = useCallback(async () => {
    if (!window.planwerkMcp) return;
    setMcpStatus(await window.planwerkMcp.regenerateToken());
  }, []);

  const handleSetAutomaticUpdatesEnabled = useCallback(async (enabled: boolean) => {
    if (!window.planwerkUpdater) return;
    setUpdateStatus(await window.planwerkUpdater.setAutomaticUpdatesEnabled(enabled));
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (!window.planwerkUpdater) return;
    setUpdateStatus(await window.planwerkUpdater.checkNow());
  }, []);

  const handleDismissUpdateDialog = useCallback(async () => {
    const version = updateDialogVersion;
    setUpdateDialogVersion(null);
    if (!version || !window.planwerkUpdater) return;
    setUpdateStatus(await window.planwerkUpdater.dismissAvailableVersion(version));
  }, [updateDialogVersion]);

  const handleOpenUpdateRelease = useCallback(async () => {
    const version = updateDialogVersion;
    if (!version || !window.planwerkUpdater) return;
    const result = await window.planwerkUpdater.openReleasePage(version);
    if (result.ok) await handleDismissUpdateDialog();
  }, [handleDismissUpdateDialog, updateDialogVersion]);

  const handleCopyMcpText = useCallback(async (text: string) => {
    const result = await window.planwerkClipboard?.writeText(text);
    if (!result?.ok) {
      throw new Error(result?.message || 'Could not copy to the clipboard.');
    }
  }, []);

  if (storageStatus.isLoading && !storageStatus.needsFileSelection && !storageStatus.hasOpenFile) {
    return (
      <div
        aria-label={t('file.loading')}
        className="h-screen w-full bg-transparent"
      />
    );
  }

  if (shouldShowCreateTaskOnboarding) {
    return (
      <PlanwerkCreateTaskOnboardingScreen
        projects={state.projects}
        defaultProjectId={state.defaultProjectId || null}
        maxTaskCapacityMinutes={maxTaskCapacityMinutes}
        defaultDuration={state.defaultDuration}
        defaultPriority={state.defaultPriority}
        initialDueDate={getLocalISODateWithOffset(state.defaultDueDateOffsetDays ?? 0)}
        onCreateTask={handleCreateOnboardingTask}
        onComplete={handleCompleteCreateTaskOnboarding}
      />
    );
  }

  if (!storageStatus.hasOpenFile || storageStatus.needsFileSelection || shouldShowIntroOnboarding || shouldShowWorkWeekOnboarding) {
    return (
      <PlanwerkWelcomeScreen
        storageStatus={storageStatus}
        onCreatePlanwerkFile={handleCreatePlanwerkFileFromWelcome}
        onOpenPlanwerkFile={handleOpenPlanwerkFileFromWelcome}
        mode={shouldShowIntroOnboarding ? 'intro' : shouldShowWorkWeekOnboarding ? 'workWeek' : 'file'}
        onCompleteIntro={handleCompleteWelcomeIntro}
        onSkipOnboarding={handleSkipWelcomeOnboarding}
        visibleDays={state.visibleDays}
        weekStartDay={state.weekStartDay}
        maxHoursPerDayByDay={state.maxHoursPerDayByDay}
        onSetVisibleDays={setVisibleDays}
        onUpdateSettings={updateSettings}
        onCompleteWorkWeekSetup={handleCompleteWelcomeWorkWeekSetup}
      />
    );
  }

  return (
    <div className={`flex h-screen w-full bg-transparent text-black dark:text-neutral-100 font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black ${isBoardEnteringFromOnboarding ? 'board-enter-fade' : ''}`}>
      <style>{`
        @keyframes board-enter-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .board-enter-fade {
          animation: board-enter-fade 1s ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .board-enter-fade {
            animation-duration: 0.01s;
          }
        }
      `}</style>
      <aside className={`${effectiveSidebarCollapsed ? 'w-16' : 'w-64'} flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-transparent shrink-0 z-20 transition-all duration-200`}>
        <div
          className={`border-b border-neutral-200 dark:border-neutral-800 h-20 flex items-center select-none ${isSidebarExpandable ? 'cursor-pointer' : 'cursor-default'} ${effectiveSidebarCollapsed ? 'justify-center px-2' : 'p-4 md:p-6'}`}
          onClick={toggleSidebarCollapsed}
          role="button"
          aria-label={effectiveSidebarCollapsed ? t('app.expandSidebar') : t('app.collapseSidebar')}
          aria-disabled={!isSidebarExpandable}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSidebarCollapsed(); } }}
        >
          {effectiveSidebarCollapsed ? (
            weeklySidebarIconBars.length > 0 ? (
              <WeeklySidebarIcon bars={weeklySidebarIconBars} />
            ) : (
              <span className="text-lg font-black tracking-tighter uppercase whitespace-nowrap">PW</span>
            )
          ) : (
            <>
              <h1 className="text-xl md:text-3xl font-black tracking-tighter hidden md:block uppercase">Planwerk</h1>
              <span className="text-2xl font-black md:hidden">PW</span>
            </>
          )}
        </div>

        <nav className={`flex-1 flex flex-col ${effectiveSidebarCollapsed ? 'p-2' : 'p-2 md:p-4'} gap-2`}>
          <button
            onClick={() => handleOpenNewTask('backlog')}
            className={`flex items-center ${effectiveSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors font-bold uppercase tracking-wider text-sm ${effectiveSidebarCollapsed ? '' : 'md:mb-6'} shadow-sm`}
            title={t('app.newTask')}
          >
            <IconPlus /> {!effectiveSidebarCollapsed && <span className="hidden md:block">{t('app.newTask')}</span>}
          </button>

          <button
            onClick={() => handleNavigateToView('board')}
            className={`flex items-center ${effectiveSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 font-bold uppercase tracking-wider text-sm transition-colors border ${effectiveViewMode === 'board' ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
            title={t('app.board')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeWidth={2} d="M6 4v16M12 4v16M18 4v7" /></svg>
            {!effectiveSidebarCollapsed && <span className="hidden md:block">{t('app.board')}</span>}
          </button>

          <button
            onClick={() => handleNavigateToView('reflection', 'reflection')}
            className={`flex items-center ${effectiveSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 font-bold uppercase tracking-wider text-sm transition-colors border relative ${effectiveViewMode === 'reflection' ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
            title={t('app.reflection')}
          >
            <IconHalfCircle /> {!effectiveSidebarCollapsed && <span className="hidden md:block">{t('app.reflection')}</span>}
            {unreflectedCount > 0 && (
              <span className={`${effectiveSidebarCollapsed ? 'absolute top-1 right-1' : 'absolute top-2 right-2 md:static md:ml-auto'} bg-black dark:bg-white text-white dark:text-black text-[10px] px-1.5 py-0.5 rounded-full`}>{unreflectedCount}</span>
            )}
          </button>

          <button
            onClick={() => handleNavigateToView('charts', 'lookback')}
            className={`flex items-center ${effectiveSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 font-bold uppercase tracking-wider text-sm transition-colors border ${effectiveViewMode === 'charts' ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
            title={t('app.charts')}
          >
            <IconTrail /> {!effectiveSidebarCollapsed && <span className="hidden md:block">{t('app.charts')}</span>}
          </button>

          <button
            onClick={() => handleNavigateToView('goals', 'goals')}
            className={`flex items-center ${effectiveSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 font-bold uppercase tracking-wider text-sm transition-colors border ${effectiveViewMode === 'goals' ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
            title={t('app.goals')}
          >
            <IconTarget /> {!effectiveSidebarCollapsed && <span className="hidden md:block">{t('app.goals')}</span>}
          </button>

          <div className="mt-auto flex flex-col gap-2">
            {effectiveViewMode === 'board' && (
              <>
                <button
                  onClick={handleAutofillClick}
                  className={`flex items-center ${effectiveSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white font-bold uppercase tracking-wider text-sm transition-colors border border-transparent hover:bg-black/5 dark:hover:bg-white/5`}
                  title={t('app.autoFillTitle')}
                >
                  <IconWand /> {!effectiveSidebarCollapsed && <span className="hidden md:block">{t('app.autoFill')}</span>}
                </button>
                <button
                  onClick={handleCleanupClick}
                  className={`flex items-center ${effectiveSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white font-bold uppercase tracking-wider text-sm transition-colors border border-transparent hover:bg-black/5 dark:hover:bg-white/5`}
                  title={t('app.cleanupTitle')}
                >
                  <IconRefresh /> {!effectiveSidebarCollapsed && <span className="hidden md:block">{t('app.cleanup')}</span>}
                </button>
              </>
            )}
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => handleNavigateToView('settings')}
                className={`w-full flex items-center ${effectiveSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 font-bold uppercase tracking-wider text-sm transition-colors border ${effectiveViewMode === 'settings' ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
                title={t('app.settings')}
              >
                <IconSettings /> {!effectiveSidebarCollapsed && <span className="hidden md:block">{t('app.settings')}</span>}
              </button>
            </div>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden relative bg-transparent">

        {pendingViewTutorial ? (
          <ViewIntroTutorialScreen
            title={t(VIEW_INTRO_TUTORIAL_COPY[pendingViewTutorial].title)}
            body={t(VIEW_INTRO_TUTORIAL_COPY[pendingViewTutorial].body)}
            buttonLabel={t('viewIntroTutorial.button')}
            visual={
              pendingViewTutorial === 'reflection'
                ? <AnimatedReflectionChoiceLogo />
                : pendingViewTutorial === 'lookback'
                  ? <AnimatedLookbackCompassLogo />
                  : pendingViewTutorial === 'goals'
                    ? <AnimatedGoalsMagnetLogo />
                    : undefined
            }
            onContinue={completeViewIntroTutorial}
          />
        ) : (
          <>
            {viewMode === 'board' && (
              <Board
                tasks={state.tasks}
                projects={state.projects}
                visibleDays={state.visibleDays}
                weekStartDay={state.weekStartDay}
                maxHoursPerDayByDay={state.maxHoursPerDayByDay}
                maxTaskCapacityMinutes={maxTaskCapacityMinutes}
                onDropTask={handleDropTask}
                onToggleDone={handleToggleDone}
                onEditTask={handleEditTask}
                onAddTaskClick={handleOpenNewTask}
                onSortColumn={sortColumn}
                pendingTaskMoves={pendingTaskMoves}
                backlogPinned={state.backlogPinned}
                onToggleBacklogPin={handleToggleBacklogPin}
                activeWeeklyGoal={state.weeklyGoals.find(g => g.completedAt == null) ?? null}
                onNavigateToGoals={() => handleNavigateToView('goals', 'goals')}
              />
            )}

            {viewMode === 'reflection' && (
              <ReflectionView
                tasks={state.tasks}
                projects={state.projects}
                goals={state.goals}
                weeklyGoals={state.weeklyGoals}
                generalGoal={state.generalGoal}
                onEvaluate={evaluateReflection}
                onCompleteGoal={completeGoal}
                onUndoCompleteGoal={uncompleteGoal}
                onCompleteWeeklyGoal={completeWeeklyGoal}
                onUndoCompleteWeeklyGoal={uncompleteWeeklyGoal}
                onDefineWeeklyGoal={defineWeeklyGoal}
                onUpdateWeeklyGoal={updateWeeklyGoal}
                onClearOpenWeeklyGoal={clearOpenWeeklyGoal}
                onNavigateToGoals={() => handleNavigateToView('goals', 'goals')}
                onNavigateToLookback={() => handleNavigateToView('charts', 'lookback')}
              />
            )}

            {viewMode === 'charts' && (
              <React.Suspense fallback={null}>
                <ChartsView
                  tasks={state.tasks}
                  projects={state.projects}
                  firstReflectionAt={state.firstReflectionAt}
                />
              </React.Suspense>
            )}

            {viewMode === 'goals' && (
              <GoalsView
                goals={state.goals}
                weeklyGoals={state.weeklyGoals}
                tasks={state.tasks}
                projects={state.projects}
                onAddGoal={addGoal}
                onToggleGoalFocus={toggleGoalFocus}
                onCompleteGoal={completeGoal}
                onUndoCompleteGoal={uncompleteGoal}
                onDeleteGoal={deleteGoal}
                onDefineWeeklyGoal={defineWeeklyGoal}
                onUpdateWeeklyGoal={updateWeeklyGoal}
                onClearOpenWeeklyGoal={clearOpenWeeklyGoal}
                onDeleteWeeklyGoal={deleteWeeklyGoal}
                onCompleteWeeklyGoal={completeWeeklyGoal}
                onUndoCompleteWeeklyGoal={uncompleteWeeklyGoal}
              />
            )}

            {viewMode === 'settings' && (
              <SettingsView
                projects={state.projects}
                templates={state.templates}
                defaultProjectId={state.defaultProjectId || null}
                defaultPriority={state.defaultPriority}
                defaultDuration={state.defaultDuration}
                defaultDueDateOffsetDays={state.defaultDueDateOffsetDays}
                visibleDays={state.visibleDays}
                theme={state.theme}
                language={state.language}
                autofillMode={state.autofillMode}
                weekStartDay={state.weekStartDay}
                maxHoursPerDayByDay={state.maxHoursPerDayByDay}
                onAddProject={addProject}
                onDeleteProject={deleteProject}
                onUpdateProject={updateProject}
                onSetDefaultProject={setDefaultProject}
                onSetVisibleDays={setVisibleDays}
                onAddTemplate={addTemplate}
                onDeleteTemplate={deleteTemplate}
                onUpdateSettings={updateSettings}
                tasks={state.tasks}
                onExportData={exportDataAsJSON}
                onImportData={importDataFromJSON}
                storageStatus={storageStatus}
                onCreatePlanwerkFile={handleCreatePlanwerkFileFromSettings}
                onOpenPlanwerkFile={openPlanwerkFile}
                onClosePlanwerkFile={closePlanwerkFile}
                mcpStatus={mcpStatus}
                onSetMcpEnabled={handleSetMcpEnabled}
                onRegenerateMcpToken={handleRegenerateMcpToken}
                onCopyMcpText={handleCopyMcpText}
                updateStatus={updateStatus}
                onSetAutomaticUpdatesEnabled={handleSetAutomaticUpdatesEnabled}
                onCheckForUpdates={handleCheckForUpdates}
              />
            )}
          </>
        )}

      </main>

      <TaskCreateModal
        isOpen={isModalOpen}
        initialTask={editingTask}
        onClose={handleCloseTaskModal}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        projects={state.projects}
        defaultProjectId={state.defaultProjectId || null}
        maxTaskCapacityMinutes={maxTaskCapacityMinutes}
        defaultDuration={state.defaultDuration}
        defaultPriority={state.defaultPriority}
        initialDueDate={newTaskInitialDueDate}
        showBulkTaskShortcutHint={shouldShowBulkTaskShortcutHint}
        onBulkTaskShortcutHintShown={handleBulkTaskShortcutHintShown}
      />

      {updateDialogVersion && (
        <UpdateAvailableDialog
          version={updateDialogVersion}
          onLater={handleDismissUpdateDialog}
          onOpenRelease={handleOpenUpdateRelease}
        />
      )}

      <PlanwerkConflictDialog
        storageStatus={storageStatus}
        onResolveConflict={resolvePlanwerkConflict}
      />

      {shouldRenderBoardTutorial && (
        <InAppTutorialPanel
          title={
            boardTutorialStep === 'drag'
              ? t('welcome.boardTutorialDragTitle')
              : boardTutorialStep === 'spaceShortcut'
                ? t('welcome.boardTutorialSpaceShortcutTitle')
                : t('welcome.boardTutorialReadyTitle')
          }
          body={
            boardTutorialStep === 'drag'
              ? t('welcome.boardTutorialDragBody')
              : boardTutorialStep === 'spaceShortcut'
                ? t('welcome.boardTutorialSpaceShortcutBody')
                : t('welcome.boardTutorialReadyBody')
          }
          buttonLabel={boardTutorialStep === 'ready' ? t('welcome.boardTutorialStart') : t('welcome.continue')}
          visual={
            boardTutorialStep === 'drag'
              ? <AnimatedBoardDragLogo />
              : boardTutorialStep === 'spaceShortcut'
                ? <AnimatedSpaceKeyLogo />
                : <AnimatedBoardReadyLogo />
          }
          isExiting={isBoardTutorialExiting}
          onContinue={handleBoardTutorialContinue}
        />
      )}

      {shouldRenderSecondaryTutorial && activeSecondaryTutorial && (
        <InAppTutorialPanel
          title={activeSecondaryTutorial === 'autofill' ? t('welcome.autofillTutorialTitle') : t('welcome.cleanupTutorialTitle')}
          body={activeSecondaryTutorial === 'autofill' ? t('welcome.autofillTutorialBody') : t('welcome.cleanupTutorialBody')}
          buttonLabel={t('welcome.continue')}
          visual={activeSecondaryTutorial === 'autofill' ? <AnimatedAutofillLogo /> : <AnimatedCleanupLogo />}
          isExiting={isSecondaryTutorialExiting}
          onContinue={completeSecondaryTutorial}
        />
      )}

      {shouldRenderWeeklyReflectionReminder && (
        <InAppTutorialPanel
          title={t('weeklyReflectionReminder.title')}
          body={t('weeklyReflectionReminder.body')}
          buttonLabel={t('weeklyReflectionReminder.reflectNow')}
          secondaryButtonLabel={t('weeklyReflectionReminder.continue')}
          visual={<AnimatedReflectionChoiceLogo />}
          isExiting={isWeeklyReflectionReminderExiting}
          onContinue={() => closeWeeklyReflectionReminder(true)}
          onSecondary={() => closeWeeklyReflectionReminder(false)}
        />
      )}

    </div>
  );
};

interface PlanwerkConflictDialogProps {
  storageStatus: ReturnType<typeof useStore>['storageStatus'];
  onResolveConflict: (resolution: 'local' | 'external' | 'both') => Promise<void>;
}

const formatConflictTimestamp = (value: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const PlanwerkConflictDialog: React.FC<PlanwerkConflictDialogProps> = ({
  storageStatus,
  onResolveConflict,
}) => {
  const { t } = useI18n();
  const conflict = storageStatus.pendingConflict;
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={t('file.conflictTitle')}>
      <div className="w-full max-w-2xl border border-neutral-200 bg-white p-8 text-black shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
        <h2 className="mb-4 text-2xl font-black uppercase tracking-tight">{t('file.conflictTitle')}</h2>
        <p className="mb-6 text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
          {t('file.conflictDescription')}
        </p>

        <div className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
          <div className="border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('file.localVersion')}</div>
            <div className="mt-2 font-bold">{formatConflictTimestamp(conflict.localUpdatedAt)}</div>
          </div>
          <div className="border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('file.externalVersion')}</div>
            <div className="mt-2 font-bold">{formatConflictTimestamp(conflict.externalUpdatedAt)}</div>
          </div>
        </div>

        <div className="mb-6 border border-neutral-300 bg-neutral-50 p-3 text-xs font-bold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {conflict.reason}
        </div>

        {storageStatus.saveError && (
          <div className="mb-6 border border-red-600 bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {storageStatus.saveError.startsWith('file.') ? t(storageStatus.saveError as TranslationKey) : storageStatus.saveError}
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row">
          <button
            onClick={() => onResolveConflict('local')}
            disabled={storageStatus.isSaving}
            className="flex-1 bg-black px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {t('file.keepLocal')}
          </button>
          <button
            onClick={() => onResolveConflict('external')}
            disabled={storageStatus.isSaving}
            className="flex-1 border border-neutral-200 px-4 py-3 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800"
          >
            {t('file.useExternal')}
          </button>
          <button
            onClick={() => onResolveConflict('both')}
            disabled={storageStatus.isSaving}
            className="flex-1 border border-neutral-200 px-4 py-3 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800"
          >
            {t('file.keepBoth')}
          </button>
        </div>
      </div>
    </div>
  );
};
