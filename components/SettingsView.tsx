import React, { useEffect, useState, useRef } from 'react';
import { AppState, Project, RecurringTemplate, Priority, RecurrenceType, Task, Theme, Language, DayColumnId, MaxHoursByDay, AutofillMode, PlanwerkMcpStatus, PlanwerkUpdateStatus, ProjectDeletionResolution } from '../types';
import { DAY_COLUMN_IDS, DEFAULT_VISIBLE_DAYS, createDefaultMaxHoursByDay } from '../constants';
import { getFullDayColumnLabelKey, getFullDayLabelKey, getPriorityLabelKey, TFunction, TranslationKey, useI18n } from '../i18n';
import { formatMinutes } from '../utils/dateUtils';
import type { PlanwerkStorageStatus } from '../hooks/useStore';
import { PrimaryButton, SecondaryButton, SubSideMenuButton } from './Buttons';
import { PLANWERK_MCP_SKILL_MARKDOWN } from './mcp/planwerkSkill';
import { SubSideMenu } from './SubSideMenu';
import { WorkWeekSettings } from './WorkWeekSettings';
import { LEGACY_IMPORT_FILE_MAX_BYTES } from '../utils/legacyImportUtils';

interface SettingsViewProps {
  projects: Project[];
  templates: RecurringTemplate[];
  defaultProjectId: string | null;
  defaultPriority?: Priority;
  defaultDuration?: number;
  defaultDueDateOffsetDays?: number;
  visibleDays?: DayColumnId[];
  theme?: Theme;
  language?: Language;
  autofillMode?: AutofillMode;
  weekStartDay?: DayColumnId;
  maxHoursPerDayByDay?: MaxHoursByDay;
  onAddProject: (name: string) => void;
  onDeleteProject: (id: string, resolution: ProjectDeletionResolution) => void;
  onSetDefaultProject: (id: string) => void;
  onSetVisibleDays: (days: DayColumnId[]) => void;
  onAddTemplate: (tpl: Omit<RecurringTemplate, 'id' | 'nextGenerationDate'>) => void;
  onDeleteTemplate: (id: string) => void;
  onUpdateSettings: (updates: Partial<AppState>) => void;
  onUpdateProject: (id: string, newName: string) => void;
  tasks?: Task[];
  onExportData?: () => string;
  onImportData?: (jsonString: string) => { success: boolean; messageKey: string };
  storageStatus?: PlanwerkStorageStatus;
  onCreatePlanwerkFile?: () => Promise<boolean>;
  onOpenPlanwerkFile?: () => Promise<boolean>;
  onClosePlanwerkFile?: () => Promise<void>;
  mcpStatus?: PlanwerkMcpStatus | null;
  onSetMcpEnabled?: (enabled: boolean) => Promise<void>;
  onRegenerateMcpToken?: () => Promise<void>;
  onCopyMcpText?: (text: string) => Promise<void>;
  updateStatus?: PlanwerkUpdateStatus | null;
  onSetAutomaticUpdatesEnabled?: (enabled: boolean) => Promise<void>;
  onCheckForUpdates?: () => Promise<void>;
}

const formatSchedule = (template: RecurringTemplate, t: TFunction) => {
  const day = t(getFullDayLabelKey(template.dayOfWeek || 0));
  if (template.recurrenceType === 'daily') return t('settings.scheduleDaily', { time: template.timeOfDay });
  if (template.recurrenceType === 'weekly') return t('settings.scheduleWeekly', { day, time: template.timeOfDay });
  if (template.recurrenceType === 'biweekly') return t('settings.scheduleBiweekly', { day, time: template.timeOfDay });
  if (template.recurrenceType === 'monthly') return t('settings.scheduleMonthly', { day: template.dayOfMonth || 1, time: template.timeOfDay });
  return t('settings.scheduleCustom');
};

const formatPriorityOption = (priority: Priority, t: TFunction): string => (
  `${priority} - ${t(getPriorityLabelKey(priority))}`
);

type SettingsTab = 'workWeek' | 'routines' | 'planning' | 'appData';

interface SettingsNavProps {
  activeTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
}

const SettingsNav: React.FC<SettingsNavProps> = ({ activeTab, onSelectTab }) => {
  const { t } = useI18n();

  return (
    <SubSideMenu>
      <SubSideMenuButton
        className="h-32"
        isActive={activeTab === 'workWeek'}
        onClick={() => onSelectTab('workWeek')}
      >
        {t('settings.workWeek')}
      </SubSideMenuButton>
      <SubSideMenuButton
        className="h-32"
        isActive={activeTab === 'routines'}
        onClick={() => onSelectTab('routines')}
      >
        {t('settings.routines')}
      </SubSideMenuButton>
      <SubSideMenuButton
        className="h-32"
        isActive={activeTab === 'planning'}
        onClick={() => onSelectTab('planning')}
      >
        {t('settings.planning')}
      </SubSideMenuButton>
      <SubSideMenuButton
        className="h-32"
        isActive={activeTab === 'appData'}
        onClick={() => onSelectTab('appData')}
      >
        {t('settings.appAndData')}
      </SubSideMenuButton>
    </SubSideMenu>
  );
};

interface ProjectDeletionDialogProps {
  project: Project;
  projects: Project[];
  tasks: Task[];
  templates: RecurringTemplate[];
  defaultProjectId: string | null;
  onClose: () => void;
  onDeleteProject: (id: string, resolution: ProjectDeletionResolution) => void;
}

const ProjectDeletionDialog: React.FC<ProjectDeletionDialogProps> = ({
  project,
  projects,
  tasks,
  templates,
  defaultProjectId,
  onClose,
  onDeleteProject,
}) => {
  const { t } = useI18n();
  const remainingProjects = projects.filter(candidate => candidate.id !== project.id);
  const preferredTarget = remainingProjects.some(candidate => candidate.id === defaultProjectId)
    ? defaultProjectId as string
    : remainingProjects[0]?.id ?? '';
  const [mode, setMode] = useState<'move' | 'delete'>('move');
  const [step, setStep] = useState<'choice' | 'confirm'>('choice');
  const [targetProjectId, setTargetProjectId] = useState(preferredTarget);
  const [confirmationName, setConfirmationName] = useState('');
  const dialogFocusRef = useRef<HTMLDivElement>(null);

  const taskCount = tasks.filter(task => task.projectId === project.id).length;
  const routineCount = templates.filter(template => template.projectId === project.id).length;
  const hasLinkedItems = taskCount + routineCount > 0;
  const taskCountText = t(taskCount === 1
    ? 'settings.projectDelete.taskSingular'
    : 'settings.projectDelete.taskPlural', { count: taskCount });
  const routineCountText = t(routineCount === 1
    ? 'settings.projectDelete.routineSingular'
    : 'settings.projectDelete.routinePlural', { count: routineCount });
  const linkedItemsText = taskCount > 0 && routineCount > 0
    ? t('settings.projectDelete.itemsBoth', { tasks: taskCountText, routines: routineCountText })
    : taskCount > 0 ? taskCountText : routineCountText;
  const confirmationMatches = confirmationName.trim() === project.name;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogFocusRef.current) return;

      const focusableElements = Array.from(dialogFocusRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && (document.activeElement === firstElement || document.activeElement === dialogFocusRef.current)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    if (step === 'choice') dialogFocusRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, step]);

  const finishDeletion = (resolution: ProjectDeletionResolution) => {
    onDeleteProject(project.id, resolution);
    onClose();
  };

  const handleChoiceAction = () => {
    if (!hasLinkedItems) {
      finishDeletion({ mode: 'delete' });
      return;
    }

    if (mode === 'delete') {
      setStep('confirm');
      return;
    }

    if (targetProjectId) {
      finishDeletion({ mode: 'move', targetProjectId });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogFocusRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-delete-dialog-title"
        tabIndex={-1}
        className="w-full max-w-lg border border-neutral-200 bg-white p-6 text-black shadow-sm outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 sm:p-8"
      >
        {step === 'choice' ? (
          <>
            <h2 id="project-delete-dialog-title" className="text-2xl font-black uppercase tracking-tight">
              {t('settings.projectDelete.title', { projectName: project.name })}
            </h2>

            {hasLinkedItems ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {t('settings.projectDelete.intro', { items: linkedItemsText })}
                </p>

                <div className="mt-6 flex flex-col gap-3" role="radiogroup" aria-label={t('settings.projectDelete.choiceLabel')}>
                  <div className={`border p-4 transition-colors ${mode === 'move' ? 'border-black dark:border-white' : 'border-neutral-200 dark:border-neutral-700'}`}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="project-delete-mode"
                        value="move"
                        checked={mode === 'move'}
                        onChange={() => setMode('move')}
                        className="mt-0.5 h-4 w-4 accent-black dark:accent-white"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-bold uppercase tracking-wider">{t('settings.projectDelete.moveTasks')}</span>
                        {routineCount > 0 && (
                          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">{t('settings.projectDelete.moveRoutinesHint')}</span>
                        )}
                      </span>
                    </label>

                    {mode === 'move' && (
                      <label className="mt-4 block pl-7">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                          {t('settings.projectDelete.moveTo')}
                        </span>
                        <select
                          value={targetProjectId}
                          onChange={event => setTargetProjectId(event.target.value)}
                          className="w-full border border-neutral-300 bg-white p-2 text-black focus:outline-none focus:border-black dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
                        >
                          {remainingProjects.map(candidate => (
                            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <label className={`cursor-pointer border p-4 transition-colors ${mode === 'delete' ? 'border-red-600 dark:border-red-400' : 'border-neutral-200 dark:border-neutral-700'}`}>
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="project-delete-mode"
                        value="delete"
                        checked={mode === 'delete'}
                        onChange={() => setMode('delete')}
                        className="mt-0.5 h-4 w-4 accent-red-600"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-bold uppercase tracking-wider text-red-600 dark:text-red-300">{t('settings.projectDelete.deleteTasks')}</span>
                        {routineCount > 0 && (
                          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">{t('settings.projectDelete.deleteRoutinesHint')}</span>
                        )}
                      </span>
                    </span>
                  </label>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {t('settings.projectDelete.emptyBody')}
              </p>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <SecondaryButton onClick={onClose} className="px-5 py-2 text-xs">
                {t('task.cancel')}
              </SecondaryButton>
              <PrimaryButton
                onClick={handleChoiceAction}
                disabled={hasLinkedItems && mode === 'move' && !targetProjectId}
                className="px-5 py-2 text-xs"
              >
                {hasLinkedItems
                  ? t(mode === 'move' ? 'settings.projectDelete.moveAndDelete' : 'settings.projectDelete.continue')
                  : t('settings.projectDelete.deleteProject')}
              </PrimaryButton>
            </div>
          </>
        ) : (
          <>
            <h2 id="project-delete-dialog-title" className="text-2xl font-black uppercase tracking-tight">
              {t('settings.projectDelete.permanentTitle')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {t('settings.projectDelete.permanentBody', { items: linkedItemsText })}
            </p>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-medium text-neutral-600 dark:text-neutral-300">
                {t('settings.projectDelete.typeName', { projectName: project.name })}
              </span>
              <input
                type="text"
                autoFocus
                value={confirmationName}
                onChange={event => setConfirmationName(event.target.value)}
                className="w-full border border-neutral-300 bg-transparent p-3 text-black focus:outline-none focus:border-black dark:border-neutral-700 dark:text-white dark:focus:border-white"
              />
            </label>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <SecondaryButton onClick={onClose} className="px-5 py-2 text-xs">
                {t('task.cancel')}
              </SecondaryButton>
              <button
                type="button"
                disabled={!confirmationMatches}
                onClick={() => finishDeletion({ mode: 'delete' })}
                className="inline-flex items-center justify-center border border-red-600 bg-red-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-neutral-500 dark:border-red-400 dark:bg-red-500 dark:hover:bg-red-600 dark:disabled:border-neutral-700 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-500"
              >
                {t('settings.projectDelete.deletePermanently')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  projects, templates, defaultProjectId,
  defaultPriority = Priority.Important, defaultDuration = 30, defaultDueDateOffsetDays = 0, visibleDays = DEFAULT_VISIBLE_DAYS, theme = 'system', language = 'system', autofillMode = 'current-weekday', weekStartDay = 'mon', maxHoursPerDayByDay = createDefaultMaxHoursByDay(),
  onAddProject, onDeleteProject, onUpdateProject, onSetDefaultProject, onSetVisibleDays,
  onAddTemplate, onDeleteTemplate, onUpdateSettings,
  tasks = [], onExportData, onImportData, storageStatus, onCreatePlanwerkFile, onOpenPlanwerkFile, onClosePlanwerkFile,
  mcpStatus, onSetMcpEnabled, onRegenerateMcpToken, onCopyMcpText,
  updateStatus, onSetAutomaticUpdatesEnabled, onCheckForUpdates
}) => {
  const { t, language: resolvedLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('workWeek');
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [mcpCopyMessage, setMcpCopyMessage] = useState<{ key: TranslationKey; isError: boolean } | null>(null);

  const [tplTitle, setTplTitle] = useState('');
  const [tplDuration, setTplDuration] = useState(30);
  const [tplType, setTplType] = useState<RecurrenceType>('weekly');
  const [tplDayOfWeek, setTplDayOfWeek] = useState(1); // Mon
  const [tplDayOfMonth, setTplDayOfMonth] = useState(1);
  const [tplTimeOfDay, setTplTimeOfDay] = useState('09:00');
  const [tplPriority, setTplPriority] = useState<Priority>(Priority.Important);
  const [tplProjectId, setTplProjectId] = useState<string>(() => defaultProjectId || (projects[0]?.id ?? ''));
  const [tplDueDateOffset, setTplDueDateOffset] = useState<number>(0);
  const ticketLabel = t(tasks.length === 1 ? 'settings.ticketSingular' : 'settings.ticketPlural');
  const updateBusy = updateStatus?.phase === 'checking'
    || updateStatus?.phase === 'downloading';
  const updateStatusText = (() => {
    if (!updateStatus) return t('settings.updatesUnavailable');
    if (updateStatus.phase === 'unsupported') return t('settings.updatesUnavailable');
    if (updateStatus.phase === 'checking') return t('settings.updatesChecking');
    if (updateStatus.phase === 'available') return t('settings.updatesAvailable', { version: updateStatus.availableVersion || '' });
    if (updateStatus.phase === 'downloading') return t('settings.updatesDownloading');
    if (updateStatus.phase === 'ready') return t('settings.updatesReady', { version: updateStatus.availableVersion || '' });
    if (updateStatus.phase === 'upToDate') return t('settings.updatesCurrent');
    if (updateStatus.phase === 'error') return t('settings.updatesError');
    return t('settings.updatesIdle');
  })();

  useEffect(() => {
    if (!tplProjectId || !projects.some(p => p.id === tplProjectId)) {
      setTplProjectId(defaultProjectId || (projects[0]?.id ?? ''));
    }
  }, [defaultProjectId, projects, tplProjectId]);

  useEffect(() => {
    if (!mcpStatus?.enabled) {
      setMcpCopyMessage(null);
    }
  }, [mcpStatus?.enabled]);

  const getDueDateDropdownValue = () => {
    if ([0, 1, 2, 7].includes(tplDueDateOffset)) return String(tplDueDateOffset);
    return 'custom';
  };

  const getDefaultDueDateDropdownValue = () => {
    if ([0, 1, 2, 7].includes(defaultDueDateOffsetDays)) return String(defaultDueDateOffsetDays);
    return 'custom';
  };

  const handleDueDateDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      if ([0, 1, 2, 7].includes(tplDueDateOffset)) {
        setTplDueDateOffset(3);
      }
    } else {
      setTplDueDateOffset(Number(val));
    }
  };

  const handleDefaultDueDateDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      if ([0, 1, 2, 7].includes(defaultDueDateOffsetDays)) {
        onUpdateSettings({ defaultDueDateOffsetDays: 3 });
      }
    } else {
      onUpdateSettings({ defaultDueDateOffsetDays: Number(val) });
    }
  };

  const handleMcpCopy = async (text: string, successKey: TranslationKey) => {
    if (!onCopyMcpText) return;

    try {
      await onCopyMcpText(text);
      setMcpCopyMessage({ key: successKey, isError: false });
    } catch {
      setMcpCopyMessage({ key: 'settings.mcpCopyFailed', isError: true });
    }
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onAddProject(newProjectName.trim());
      setNewProjectName('');
    }
  };

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (tplTitle.trim()) {
      onAddTemplate({
        title: tplTitle.trim(),
        duration: tplDuration,
        recurrenceType: tplType,
        dayOfWeek: tplDayOfWeek,
        dayOfMonth: tplDayOfMonth,
        timeOfDay: tplTimeOfDay,
        priority: tplPriority,
        projectId: tplProjectId || null,
        dueDateOffsetDays: tplDueDateOffset
      });
      setTplTitle('');
      setTplDuration(30);
      setTplProjectId(defaultProjectId || (projects[0]?.id ?? ''));
      setTplDueDateOffset(0);
    }
  };

  const handleEditTemplate = (t: RecurringTemplate) => {
    setTplTitle(t.title);
    setTplDuration(t.duration);
    setTplType(t.recurrenceType || 'weekly');
    setTplDayOfWeek(t.dayOfWeek ?? 1);
    setTplDayOfMonth(t.dayOfMonth ?? 1);
    setTplTimeOfDay(t.timeOfDay || '09:00');
    setTplPriority(t.priority);
    setTplProjectId(t.projectId || '');
    setTplDueDateOffset(t.dueDateOffsetDays ?? 0);
    onDeleteTemplate(t.id);
  };

  const handleExport = () => {
    if (!onExportData) return;
    const json = onExportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planwerk-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportData) return;
    if (file.size > LEGACY_IMPORT_FILE_MAX_BYTES) {
      setImportMessage({ text: t('import.tooLarge'), isError: true });
      setTimeout(() => setImportMessage(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = onImportData(ev.target?.result as string);
      setImportMessage({ text: t(result.messageKey as TranslationKey), isError: !result.success });
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-full w-full flex-row text-black dark:text-neutral-100 bg-transparent">
      <SettingsNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full w-full max-w-6xl flex-col p-8 text-black dark:text-neutral-100 bg-transparent">
      <h2 className="text-4xl font-black tracking-tighter uppercase mb-12 border-b border-neutral-200 dark:border-neutral-700 pb-4">{t('settings.title')}</h2>

      {activeTab === 'planning' && (
        <div className="grid grid-cols-1 gap-16 lg:max-w-4xl">

        {/* Projects Section */}
        <section>
          <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">{t('settings.projects')}</h3>
          <ul className="mb-6 flex flex-col gap-2">
            {projects.map(p => (
              <li key={p.id} className="flex justify-between items-center p-3 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
                {editingProjectId === p.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingProjectName}
                    onChange={(e) => setEditingProjectName(e.target.value)}
                    onBlur={() => {
                      if (editingProjectName.trim() && editingProjectName.trim() !== p.name) {
                        onUpdateProject(p.id, editingProjectName.trim());
                      }
                      setEditingProjectId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingProjectName.trim() && editingProjectName.trim() !== p.name) {
                          onUpdateProject(p.id, editingProjectName.trim());
                        }
                        setEditingProjectId(null);
                      } else if (e.key === 'Escape') {
                        setEditingProjectId(null);
                      }
                    }}
                    className="font-bold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-black dark:text-white"
                  />
                ) : (
                  <span
                    className="font-bold cursor-pointer hover:underline"
                    onClick={() => {
                      setEditingProjectId(p.id);
                      setEditingProjectName(p.name);
                    }}
                    title={t('settings.clickToRename')}
                  >
                    {p.name}
                  </span>
                )}
                <button
                  onClick={() => setProjectToDeleteId(p.id)}
                  disabled={projects.length <= 1}
                  title={projects.length <= 1 ? t('settings.keepOneProject') : undefined}
                  className="text-xs font-bold uppercase hover:text-red-600 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:text-neutral-400 dark:hover:text-red-400 dark:disabled:text-neutral-600 dark:disabled:hover:text-neutral-600 transition-colors"
                >
                  {t('settings.delete')}
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddProject} className="flex gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder={t('settings.newProjectName')}
              className="flex-1 border border-neutral-200 dark:border-neutral-700 p-2 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white bg-transparent dark:bg-neutral-800 text-black dark:text-white"
            />
            <PrimaryButton type="submit" className="px-4 py-2 text-sm">{t('settings.add')}</PrimaryButton>
          </form>

          <div className="mt-8">
            <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">{t('settings.taskDefaults')}</h3>
            <div className="flex flex-col gap-4 border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900 shadow-sm ">

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.defaultProject')}</label>
                <select
                  value={defaultProjectId || ''}
                  onChange={e => onSetDefaultProject(e.target.value)}
                  className="border border-neutral-300 dark:border-neutral-700 p-2 bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.defaultPriority')}</label>
                <select
                  value={defaultPriority}
                  onChange={e => onUpdateSettings({ defaultPriority: Number(e.target.value) })}
                  className="border border-neutral-300 dark:border-neutral-700 p-2 bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                >
                  <option value={Priority.Marginal}>{formatPriorityOption(Priority.Marginal, t)}</option>
                  <option value={Priority.Helpful}>{formatPriorityOption(Priority.Helpful, t)}</option>
                  <option value={Priority.Important}>{formatPriorityOption(Priority.Important, t)}</option>
                  <option value={Priority.Necessary}>{formatPriorityOption(Priority.Necessary, t)}</option>
                  <option value={Priority.Critical}>{formatPriorityOption(Priority.Critical, t)}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.defaultDuration')}</label>
                <input
                  type="number"
                  value={defaultDuration}
                  onChange={e => onUpdateSettings({ defaultDuration: Number(e.target.value) })}
                  min="5" step="5"
                  className="border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white w-full bg-transparent dark:bg-neutral-800 text-black dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.dueDateLabel')}</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={getDefaultDueDateDropdownValue()}
                    onChange={handleDefaultDueDateDropdownChange}
                    className="flex-1 border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white bg-white dark:bg-neutral-800 text-black dark:text-white"
                  >
                    <option value="0">{t('settings.dueDate.sameDay')}</option>
                    <option value="1">{t('settings.dueDate.nextDay')}</option>
                    <option value="2">{t('settings.dueDate.after2Days')}</option>
                    <option value="7">{t('settings.dueDate.afterAWeek')}</option>
                    <option value="custom">{t('settings.dueDate.custom')}</option>
                  </select>

                  {getDefaultDueDateDropdownValue() === 'custom' && (
                    <div className="flex items-center gap-1.5 border border-neutral-300 dark:border-neutral-700 px-3 bg-transparent dark:bg-neutral-800 h-[38px]">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                        {t('settings.dueDate.customAfter')}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={defaultDueDateOffsetDays}
                        onChange={e => onUpdateSettings({ defaultDueDateOffsetDays: e.target.value ? Number(e.target.value) : 0 })}
                        className="w-12 py-1 focus:outline-none bg-transparent text-black dark:text-white text-center"
                      />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                        {t('settings.dueDate.customDays')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </section>
        </div>
      )}

      {activeTab === 'routines' && (
        <section>
          <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">{t('settings.recurring')}</h3>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <ul className="flex flex-col gap-2 lg:order-2">
            {templates.map(template => (
              <li key={template.id}
                onClick={() => handleEditTemplate(template)}
                className="flex justify-between items-start p-3 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 gap-2 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors group">
                <div className="flex flex-col">
                  <span className="font-bold leading-tight group-hover:underline">{template.title}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium mt-1">
                    {formatSchedule(template, t)} • {formatMinutes(template.duration, resolvedLanguage)}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteTemplate(template.id); }}
                  className="text-xs font-bold uppercase hover:text-red-600 dark:hover:text-red-400 transition-colors mt-0.5"
                >
                  {t('settings.delete')}
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddTemplate} className="flex flex-col gap-4 border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900 shadow-sm  lg:order-1">
            <h4 className="font-bold uppercase text-sm border-b border-neutral-200 pb-2 dark:border-neutral-700">{t('settings.newTemplate')}</h4>

            <input
              type="text"
              value={tplTitle}
              onChange={e => setTplTitle(e.target.value)}
              placeholder={t('settings.taskTitle')}
              required
              className="border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white w-full bg-transparent dark:bg-neutral-800 text-black dark:text-white"
            />

            <div className="flex gap-2">
              <input
                type="number"
                value={tplDuration}
                onChange={e => setTplDuration(Number(e.target.value))}
                min="5" step="5"
                placeholder={t('settings.mins')}
                className="w-24 border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white bg-transparent dark:bg-neutral-800 text-black dark:text-white"
              />
              <select
                value={tplType}
                onChange={e => setTplType(e.target.value as RecurrenceType)}
                className="flex-1 border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white bg-white dark:bg-neutral-800 text-black dark:text-white"
              >
                <option value="daily">{t('recurrence.daily')}</option>
                <option value="weekly">{t('recurrence.weekly')}</option>
                <option value="biweekly">{t('recurrence.biweekly')}</option>
                <option value="monthly">{t('recurrence.monthly')}</option>
              </select>
            </div>

            <div className="flex gap-2">
              {(tplType === 'weekly' || tplType === 'biweekly') && (
                <select
                  value={tplDayOfWeek}
                  onChange={e => setTplDayOfWeek(Number(e.target.value))}
                  className="flex-1 border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white bg-white dark:bg-neutral-800 text-black dark:text-white"
                >
                  <option value={1}>{t('column.monday')}</option>
                  <option value={2}>{t('column.tuesday')}</option>
                  <option value={3}>{t('column.wednesday')}</option>
                  <option value={4}>{t('column.thursday')}</option>
                  <option value={5}>{t('column.friday')}</option>
                  <option value={6}>{t('column.saturday')}</option>
                  <option value={0}>{t('column.sunday')}</option>
                </select>
              )}
              {tplType === 'monthly' && (
                <div className="flex-1 flex items-center border border-neutral-300 dark:border-neutral-700 px-2 bg-transparent dark:bg-neutral-800">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 mr-2 uppercase">{t('settings.day')}</span>
                  <input
                    type="number"
                    min="1" max="31"
                    value={tplDayOfMonth}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setTplDayOfMonth(1);
                      } else {
                        setTplDayOfMonth(Math.max(1, Math.min(31, Number(val))));
                      }
                    }}
                    className="w-full py-2 focus:outline-none bg-transparent"
                  />
                </div>
              )}
              <input
                type="time"
                value={tplTimeOfDay}
                onChange={e => setTplTimeOfDay(e.target.value)}
                required
                className="flex-1 border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white bg-transparent dark:bg-neutral-800 text-black dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={tplPriority}
                onChange={e => setTplPriority(Number(e.target.value))}
                className="flex-1 border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white bg-white dark:bg-neutral-800 text-black dark:text-white"
              >
                <option value={Priority.Marginal}>{formatPriorityOption(Priority.Marginal, t)}</option>
                <option value={Priority.Helpful}>{formatPriorityOption(Priority.Helpful, t)}</option>
                <option value={Priority.Important}>{formatPriorityOption(Priority.Important, t)}</option>
                <option value={Priority.Necessary}>{formatPriorityOption(Priority.Necessary, t)}</option>
                <option value={Priority.Critical}>{formatPriorityOption(Priority.Critical, t)}</option>
              </select>
              <select
                value={tplProjectId}
                onChange={e => setTplProjectId(e.target.value)}
                className="flex-1 border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white bg-white dark:bg-neutral-800 text-black dark:text-white"
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('settings.dueDateLabel')}
              </label>
              <div className="flex gap-2 items-center">
                <select
                  value={getDueDateDropdownValue()}
                  onChange={handleDueDateDropdownChange}
                  className="flex-1 border border-neutral-300 dark:border-neutral-700 p-2 focus:outline-none focus:border-black dark:focus:border-white bg-white dark:bg-neutral-800 text-black dark:text-white"
                >
                  <option value="0">{t('settings.dueDate.sameDay')}</option>
                  <option value="1">{t('settings.dueDate.nextDay')}</option>
                  <option value="2">{t('settings.dueDate.after2Days')}</option>
                  <option value="7">{t('settings.dueDate.afterAWeek')}</option>
                  <option value="custom">{t('settings.dueDate.custom')}</option>
                </select>

                {getDueDateDropdownValue() === 'custom' && (
                  <div className="flex items-center gap-1.5 border border-neutral-300 dark:border-neutral-700 px-3 bg-transparent dark:bg-neutral-800 h-[38px]">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                      {t('settings.dueDate.customAfter')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={tplDueDateOffset}
                      onChange={e => setTplDueDateOffset(e.target.value ? Number(e.target.value) : 0)}
                      className="w-12 py-1 focus:outline-none bg-transparent text-black dark:text-white text-center"
                    />
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                      {t('settings.dueDate.customDays')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <PrimaryButton type="submit" className="mt-2 py-2 text-sm">{t('settings.createTemplate')}</PrimaryButton>
          </form>
          </div>
        </section>

      )}

      {activeTab === 'workWeek' && (
      <section>
        <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">{t('settings.columnSettings')}</h3>
        <WorkWeekSettings
          visibleDays={visibleDays}
          weekStartDay={weekStartDay}
          maxHoursPerDayByDay={maxHoursPerDayByDay}
          onSetVisibleDays={onSetVisibleDays}
          onUpdateSettings={onUpdateSettings}
          variant="settings"
        />

        <div className="mt-8 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.autofill')}</label>
              <select
                value={autofillMode}
                onChange={e => onUpdateSettings({ autofillMode: e.target.value as AutofillMode })}
                className="border border-neutral-300 dark:border-neutral-700 p-2 bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
              >
                <option value="current-weekday">{t('settings.autofillCurrentWeekday')}</option>
                <option value="full-week">{t('settings.autofillFullWeek')}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4 border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.firstDayOfWeek')}</label>
              <select
                value={weekStartDay}
                onChange={e => onUpdateSettings({ weekStartDay: e.target.value as DayColumnId })}
                className="border border-neutral-300 dark:border-neutral-700 p-2 bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
              >
                {DAY_COLUMN_IDS.map(day => (
                  <option key={day} value={day}>{t(getFullDayColumnLabelKey(day))}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </section>

      )}

      {activeTab === 'appData' && (
        <>
      <section>
        <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">{t('settings.applicationSettings')}</h3>
        <div className="max-w-md flex flex-col gap-4 border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900 shadow-sm ">
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.appearance')}</label>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.theme')}</span>
              <select
                value={theme}
                onChange={e => onUpdateSettings({ theme: e.target.value as Theme })}
                className="border border-neutral-300 dark:border-neutral-700 p-2 bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
              >
                <option value="system">{t('settings.systemDefault')}</option>
                <option value="light">{t('settings.bright')}</option>
                <option value="dark">{t('settings.dark')}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.language')}</span>
              <select
                value={language}
                onChange={e => onUpdateSettings({ language: e.target.value as Language })}
                className="border border-neutral-300 dark:border-neutral-700 p-2 bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
              >
                <option value="system">{t('settings.systemDefault')}</option>
                <option value="en">{t('settings.english')}</option>
                <option value="de">{t('settings.german')}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.updates')}</span>
            {updateStatus?.automaticInstallationSupported && (
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span className="text-sm font-bold uppercase tracking-wider">{t('settings.updatesAutomatic')}</span>
                <input
                  type="checkbox"
                  checked={updateStatus.automaticUpdatesEnabled}
                  onChange={event => onSetAutomaticUpdatesEnabled?.(event.target.checked)}
                  disabled={!onSetAutomaticUpdatesEnabled}
                  className="h-5 w-5 cursor-pointer rounded-none accent-black disabled:cursor-not-allowed dark:accent-white"
                />
              </label>
            )}
            {updateStatus?.currentVersion && (
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                {t('settings.updatesVersion', { version: updateStatus.currentVersion })}
              </p>
            )}
            <SecondaryButton
              className="self-start px-5 py-2 text-xs"
              onClick={() => onCheckForUpdates?.()}
              disabled={!updateStatus?.updateCheckSupported || !onCheckForUpdates || updateBusy}
            >
              {t('settings.updatesCheckNow')}
            </SecondaryButton>
            <p aria-live="polite" className="text-sm text-neutral-500 dark:text-neutral-400">
              {updateStatusText}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">{t('settings.mcpAccess')}</h3>
        <p className="mb-6 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          {t('settings.mcpDescription')}
        </p>
        <div className="max-w-2xl flex flex-col gap-5 border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900 shadow-sm ">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm font-bold uppercase tracking-wider">{t('settings.mcpEnable')}</span>
            <input
              type="checkbox"
              checked={Boolean(mcpStatus?.enabled)}
              onChange={(event) => onSetMcpEnabled?.(event.target.checked)}
              disabled={!onSetMcpEnabled}
              className="h-5 w-5 cursor-pointer rounded-none accent-black disabled:cursor-not-allowed dark:accent-white"
            />
          </label>

          {mcpStatus?.error && (
            <div className="border border-red-600 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {mcpStatus.error}
            </div>
          )}

          {mcpStatus?.enabled && (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                {mcpStatus.running ? t('settings.mcpRunning') : t('settings.mcpNotRunning')}
              </p>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.mcpEndpoint')}</span>
                <code className="overflow-x-auto border border-neutral-300 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-800">{mcpStatus.endpoint}</code>
              </div>
              {mcpStatus.token && (
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.mcpToken')}</span>
                  <code className="overflow-x-auto border border-neutral-300 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-800">{mcpStatus.token}</code>
                  <div className="flex flex-wrap gap-3">
                    <SecondaryButton
                      className="px-5 py-2 text-xs"
                      onClick={() => handleMcpCopy(mcpStatus.token as string, 'settings.mcpTokenCopied')}
                      disabled={!onCopyMcpText}
                    >
                      {t('settings.mcpCopyToken')}
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-5 py-2 text-xs"
                      onClick={() => onRegenerateMcpToken?.()}
                    >
                      {t('settings.mcpRegenerateToken')}
                    </SecondaryButton>
                  </div>
                </div>
              )}
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('settings.mcpAuthorization')}
              </p>
              <div className="flex flex-wrap gap-3">
                <SecondaryButton
                  className="px-5 py-2 text-xs"
                  onClick={() => handleMcpCopy(PLANWERK_MCP_SKILL_MARKDOWN, 'settings.mcpSkillCopied')}
                  disabled={!onCopyMcpText}
                >
                  {t('settings.mcpCopySkill')}
                </SecondaryButton>
              </div>
              {mcpCopyMessage && (
                <p className={`text-sm ${mcpCopyMessage.isError ? 'text-red-700 dark:text-red-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {t(mcpCopyMessage.key)}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {(onExportData || onImportData || onCreatePlanwerkFile || onOpenPlanwerkFile || onClosePlanwerkFile) && (
        <section className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-6">
          <h3 className="text-2xl font-bold uppercase tracking-tight mb-6">{t('settings.dataManagement')}</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            {t('settings.dataDescription', { count: tasks.length, ticketLabel })}
          </p>
          {storageStatus?.filePath && (
            <p className="mb-6 border border-neutral-300 bg-neutral-50 p-3 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {t('settings.currentPlanwerk', { name: storageStatus.fileName || storageStatus.filePath })}
            </p>
          )}

          <div className="flex flex-wrap gap-4 items-start">
            {onCreatePlanwerkFile && (
              <PrimaryButton
                onClick={onCreatePlanwerkFile}
                disabled={storageStatus?.isLoading}
                className="gap-2 px-6 text-sm"
                aria-label={t('settings.newPlanwerkAria')}
                icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 5v14M5 12h14" /></svg>}
              >
                {t('settings.newPlanwerk')}
              </PrimaryButton>
            )}

            {onOpenPlanwerkFile && (
              <SecondaryButton
                onClick={onOpenPlanwerkFile}
                disabled={storageStatus?.isLoading}
                className="gap-2 px-6 text-sm"
                aria-label={t('settings.openPlanwerkAria')}
                icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 6h6l2 2h8v10H4z" /></svg>}
              >
                {t('settings.openPlanwerk')}
              </SecondaryButton>
            )}

            {onExportData && (
              <SecondaryButton
                onClick={handleExport}
                className="gap-2 px-6 text-sm"
                aria-label={t('settings.exportAria')}
                icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 5v14m0 0l-4-4m4 4l4-4M4 19h16" /></svg>}
              >
                {t('settings.exportJson')}
              </SecondaryButton>
            )}

            {/* Import Button + Hidden File Input */}
            {onImportData && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                  aria-label={t('settings.importFileAria')}
                />
                <SecondaryButton
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 px-6 text-sm"
                  aria-label={t('settings.importAria')}
                  icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 19V5m0 0l-4 4m4-4l4 4M4 5h16" /></svg>}
                >
                  {t('settings.importJson')}
                </SecondaryButton>
              </>
            )}

            {onClosePlanwerkFile && storageStatus?.hasOpenFile && (
              <SecondaryButton
                onClick={onClosePlanwerkFile}
                disabled={storageStatus?.isLoading || storageStatus?.isSaving}
                className="gap-2 px-6 text-sm"
                aria-label={t('settings.closePlanwerkAria')}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M5 5h10v14H5zM15 12h5m0 0l-2-2m2 2l-2 2" /></svg>
                {t('settings.closePlanwerk')}
              </SecondaryButton>
            )}
          </div>

          {importMessage && (
            <div className={`mt-4 border p-3 text-sm font-bold uppercase tracking-wider ${importMessage.isError ? 'border-red-600 text-red-600 bg-red-50 dark:bg-red-900/20' : 'border-neutral-300 text-black dark:border-neutral-700 dark:text-white bg-neutral-50 dark:bg-neutral-800'}`}>
              {importMessage.text}
            </div>
          )}

          {storageStatus?.saveError && (
            <div className="mt-4 border border-red-600 bg-red-50 p-3 text-sm font-bold uppercase tracking-wider text-red-600 dark:bg-red-900/20 dark:text-red-300">
              {storageStatus.saveError.startsWith('file.') ? t(storageStatus.saveError as TranslationKey) : storageStatus.saveError}
            </div>
          )}
        </section>
      )}

      <section className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          <span>{t('settings.aboutCare')}</span>
          <span aria-hidden="true">/</span>
          <span>{t('settings.aboutWebsite')}</span>
          <span aria-hidden="true">/</span>
          <span>{t('settings.aboutYear')}</span>
        </div>
      </section>

        </>
      )}
        </div>
      </div>
      {projectToDeleteId && projects.some(project => project.id === projectToDeleteId) && (
        <ProjectDeletionDialog
          project={projects.find(project => project.id === projectToDeleteId) as Project}
          projects={projects}
          tasks={tasks}
          templates={templates}
          defaultProjectId={defaultProjectId}
          onClose={() => setProjectToDeleteId(null)}
          onDeleteProject={onDeleteProject}
        />
      )}
    </div>
  );
};
