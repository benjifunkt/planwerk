import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Priority, Project, Task } from '../types';
import { TranslationKey, useI18n } from '../i18n';
import { AnimatedKeyboardKeys, AnimatedTaskDurationSplitLogo } from './animations';
import { IconChevronDown, IconPlus } from './Icons';
import { formatSmartDateDraft, getSmartDatePreviewParts, parseSmartDateInput } from '../utils/smartDateInput';

export type TaskOnboardingField = 'title' | 'duration' | 'priority' | 'dueDate' | 'project';

type TaskSubmitMode = 'close' | 'bulk';

const BULK_SAVE_FEEDBACK_CHAR_MS = 10;
const BULK_SAVE_FEEDBACK_HIDE_MS = 1600;

interface TaskCreateModalProps {
  isOpen: boolean;
  initialTask: Task | null;
  onClose: () => void;
  onSave: (id: string | null, title: string, duration: number, priority: Priority, dueDate: string | null, projectId: string | null, newProjectName?: string) => void;
  onDelete?: (id: string) => void;
  projects: Project[];
  defaultProjectId: string | null;
  maxTaskCapacityMinutes: number;
  defaultDuration?: number;
  defaultPriority?: Priority;
  initialDueDate?: string | null;
  showBulkTaskShortcutHint?: boolean;
  onBulkTaskShortcutHintShown?: () => void;
}

type TaskModalFormProps = Omit<TaskCreateModalProps, 'isOpen' | 'showBulkTaskShortcutHint' | 'onBulkTaskShortcutHintShown'> & {
  variant?: 'modal' | 'onboarding';
  activeOnboardingField?: TaskOnboardingField;
  onOnboardingFieldFocus?: (field: TaskOnboardingField) => void;
  onRegisterOnboardingField?: (field: TaskOnboardingField, element: HTMLInputElement | null) => void;
  onRegisterOnboardingContinue?: (handler: () => boolean) => void;
};

interface BulkTaskShortcutHintProps {
  modifierKey: 'Cmd' | 'Ctrl';
}

interface TaskModalInlineHintProps {
  id: string;
  isVisible: boolean;
  role: 'alert' | 'status';
  layout?: 'inline' | 'floating';
  children: React.ReactNode;
}

type ProjectLookupItem = {
  project: Project;
  normalizedName: string;
};

const getTodayLocalISO = () => {
  const now = new Date();
  const localY = now.getFullYear();
  const localM = String(now.getMonth() + 1).padStart(2, '0');
  const localD = String(now.getDate()).padStart(2, '0');
  return `${localY}-${localM}-${localD}`;
};

const formatIsoDateForInput = (isoDate: string | null | undefined) => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
};

const getInitialProjectName = (initialTask: Task | null, defaultProjectId: string | null, projects: Project[]) => {
  const initialProjId = initialTask?.projectId ?? defaultProjectId;
  return projects.find(project => project.id === initialProjId)?.name
    || projects.find(project => project.id === defaultProjectId)?.name
    || projects[0]?.name
    || '';
};

const getMatchingProject = (projectNameInput: string, projectLookup: ProjectLookupItem[]) => {
  const currentInput = projectNameInput.trim().toLowerCase();
  if (!currentInput) return null;

  const matchingItem = projectLookup.find(({ normalizedName }) => normalizedName === currentInput)
    || projectLookup.find(({ normalizedName }) => normalizedName.startsWith(currentInput))
    || null;

  return matchingItem?.project || null;
};

const TaskModalInlineHint: React.FC<TaskModalInlineHintProps> = ({
  id,
  isVisible,
  role,
  layout = 'inline',
  children,
}) => {
  const isFloating = layout === 'floating';
  const containerClassName = isFloating
    ? `pointer-events-none absolute left-[-1px] right-[-1px] top-full z-20 overflow-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`
    : `overflow-hidden transition-[max-height,opacity] duration-200 ease-out motion-reduce:transition-none ${isVisible ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0'}`;
  const inlineSpacingClassName = 'px-3 py-1';
  const floatingSpacingClassName = 'px-3 pb-1 pt-[5px]';
  const hintSpacingClassName = isFloating ? floatingSpacingClassName : inlineSpacingClassName;
  const hintClassName = `${isFloating ? 'border-x border-b border-neutral-200 dark:border-neutral-700 ' : ''}bg-black ${hintSpacingClassName} text-xs font-bold text-white transition-transform duration-200 ease-out motion-reduce:transition-none dark:bg-white dark:text-black ${isVisible ? 'translate-y-0' : '-translate-y-full'}`;

  return (
    <div className={containerClassName}>
      <p
        id={id}
        role={role}
        className={hintClassName}
      >
        {children}
      </p>
    </div>
  );
};

const TaskModalBackdrop = React.memo(() => (
  <div
    className="absolute inset-0 bg-white/95 dark:bg-neutral-950/95"
  />
));
TaskModalBackdrop.displayName = 'TaskModalBackdrop';

const BulkTaskShortcutHint: React.FC<BulkTaskShortcutHintProps> = ({ modifierKey }) => {
  const { t } = useI18n();

  return (
    <section
      role="status"
      aria-live="polite"
      className="border-t border-black px-5 py-4 text-black dark:border-neutral-500 dark:text-neutral-100 sm:px-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
        <AnimatedKeyboardKeys
          keys={[
            { label: modifierKey, ...(modifierKey === 'Cmd' ? { symbol: '⌘' } : {}) },
            { label: 'Enter', symbol: '↵' },
          ]}
          mode="simultaneous"
          separator="+"
          className="shrink-0 self-start"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-black leading-tight">
            {t('task.bulkShortcutHintTitle')}
          </p>
          <p className="text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
            {t('task.bulkShortcutHintBody', { key: modifierKey })}
          </p>
        </div>
      </div>
    </section>
  );
};

export const TaskModalForm: React.FC<TaskModalFormProps> = ({
  initialTask,
  onClose,
  onSave,
  onDelete,
  projects,
  defaultProjectId,
  maxTaskCapacityMinutes,
  defaultDuration,
  defaultPriority,
  initialDueDate,
  variant = 'modal',
  activeOnboardingField = 'title',
  onOnboardingFieldFocus,
  onRegisterOnboardingField,
  onRegisterOnboardingContinue,
}) => {
  const { language, t } = useI18n();
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const durationInputRef = useRef<HTMLInputElement | null>(null);
  const priorityInputRef = useRef<HTMLInputElement | null>(null);
  const dueDateInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const projectControlRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(() => initialTask?.title || '');
  const [durationInput, setDurationInput] = useState<string>(() => String(initialTask?.duration || defaultDuration || 60));
  const [priorityInput, setPriorityInput] = useState<string>(() => initialTask ? String(initialTask.priority) : String(defaultPriority || 4));
  const [isPriorityFocused, setIsPriorityFocused] = useState(false);
  const [isDueDateFocused, setIsDueDateFocused] = useState(false);
  const [dueDate, setDueDate] = useState<string>(() => formatIsoDateForInput(initialTask ? initialTask.dueDate : initialDueDate || getTodayLocalISO()));
  const [projectNameInput, setProjectNameInput] = useState<string>(() => getInitialProjectName(initialTask, defaultProjectId, projects));
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [showAllProjectOptions, setShowAllProjectOptions] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [activeProjectOptionIndex, setActiveProjectOptionIndex] = useState(-1);
  const [showTitleError, setShowTitleError] = useState(false);
  const [bulkSaveFeedbackText, setBulkSaveFeedbackText] = useState('');
  const bulkSaveFeedbackIntervalRef = useRef<number | null>(null);
  const bulkSaveFeedbackHideTimerRef = useRef<number | null>(null);
  const titleErrorId = 'task-title-error';

  const clearBulkSaveFeedbackTimers = useCallback(() => {
    if (bulkSaveFeedbackIntervalRef.current != null) {
      window.clearInterval(bulkSaveFeedbackIntervalRef.current);
      bulkSaveFeedbackIntervalRef.current = null;
    }
    if (bulkSaveFeedbackHideTimerRef.current != null) {
      window.clearTimeout(bulkSaveFeedbackHideTimerRef.current);
      bulkSaveFeedbackHideTimerRef.current = null;
    }
  }, []);

  const showBulkSaveFeedback = useCallback((savedTitle: string) => {
    clearBulkSaveFeedbackTimers();
    const feedbackText = t('task.bulkSaved', { title: savedTitle });
    let nextLength = 0;

    setBulkSaveFeedbackText('');
    bulkSaveFeedbackIntervalRef.current = window.setInterval(() => {
      nextLength += 1;
      setBulkSaveFeedbackText(feedbackText.slice(0, nextLength));

      if (nextLength >= feedbackText.length) {
        if (bulkSaveFeedbackIntervalRef.current != null) {
          window.clearInterval(bulkSaveFeedbackIntervalRef.current);
          bulkSaveFeedbackIntervalRef.current = null;
        }
        bulkSaveFeedbackHideTimerRef.current = window.setTimeout(() => {
          setBulkSaveFeedbackText('');
          bulkSaveFeedbackHideTimerRef.current = null;
        }, BULK_SAVE_FEEDBACK_HIDE_MS);
      }
    }, BULK_SAVE_FEEDBACK_CHAR_MS);
  }, [clearBulkSaveFeedbackTimers, t]);

  useEffect(() => {
    setTitle(initialTask?.title || '');
    setDurationInput(String(initialTask?.duration || defaultDuration || 60));
    setPriorityInput(initialTask ? String(initialTask.priority) : String(defaultPriority || 4));
    setDueDate(formatIsoDateForInput(initialTask ? initialTask.dueDate : initialDueDate || getTodayLocalISO()));
    setProjectNameInput(getInitialProjectName(initialTask, defaultProjectId, projects));
    setIsProjectMenuOpen(false);
    setShowAllProjectOptions(false);
    setIsCreatingProject(false);
    setActiveProjectOptionIndex(-1);
    setShowTitleError(false);
    clearBulkSaveFeedbackTimers();
    setBulkSaveFeedbackText('');
  }, [initialTask, defaultProjectId, defaultDuration, defaultPriority, initialDueDate, clearBulkSaveFeedbackTimers]);

  useEffect(() => clearBulkSaveFeedbackTimers, [clearBulkSaveFeedbackTimers]);

  const numericDuration = parseInt(durationInput, 10) || 0;
  const isDurationTooLong = maxTaskCapacityMinutes > 0 && numericDuration > maxTaskCapacityMinutes;
  const shouldShowDurationGuidance = numericDuration > 180 || isDurationTooLong;
  const shouldUseMaxDayDurationGuidance = maxTaskCapacityMinutes > 0 && maxTaskCapacityMinutes < 180;
  const durationGuidanceBodyKey: TranslationKey = shouldUseMaxDayDurationGuidance
    ? 'task.durationGuidanceMaxDayBody'
    : 'task.durationGuidanceBody';
  const hideTitle = variant === 'onboarding';
  const hideFooter = variant === 'onboarding';
  const isOnboarding = variant === 'onboarding';
  const projectInputId = isOnboarding ? 'onboarding-project-input' : 'project-input';
  const projectListboxId = isOnboarding ? 'onboarding-project-listbox' : 'project-listbox';
  const projectActionOptionId = `${projectListboxId}-new-project`;
  const projectLookup = useMemo(() => (
    projects.map(project => ({
      project,
      normalizedName: project.name.toLowerCase(),
    }))
  ), [projects]);
  const defaultProject = useMemo(() => (
    projects.find(project => project.id === defaultProjectId) || projects[0] || null
  ), [defaultProjectId, projects]);
  const matchingProject = useMemo(() => getMatchingProject(projectNameInput, projectLookup), [projectNameInput, projectLookup]);
  const normalizedProjectInput = projectNameInput.trim().toLowerCase();
  const exactProject = useMemo(() => (
    projectLookup.find(({ normalizedName }) => normalizedName === normalizedProjectInput)?.project || null
  ), [normalizedProjectInput, projectLookup]);
  const visibleProjects = useMemo(() => {
    if (isCreatingProject && !normalizedProjectInput) return [];
    if (showAllProjectOptions || !normalizedProjectInput) return projects;

    return projectLookup
      .filter(({ normalizedName }) => normalizedName.startsWith(normalizedProjectInput))
      .map(({ project }) => project);
  }, [isCreatingProject, normalizedProjectInput, projectLookup, projects, showAllProjectOptions]);
  const isCreateProjectAction = isCreatingProject
    || (normalizedProjectInput.length > 0 && visibleProjects.length === 0);
  const projectOptionCount = visibleProjects.length + 1;
  const isProjectActionActive = activeProjectOptionIndex === visibleProjects.length;
  const projectActionToneClassName = isCreateProjectAction
    ? isProjectActionActive
      ? 'bg-neutral-800 text-white'
      : 'bg-black text-white hover:bg-neutral-800'
    : isProjectActionActive
      ? 'bg-neutral-100 text-black dark:bg-neutral-700 dark:text-white'
      : 'text-neutral-600 hover:bg-neutral-100 hover:text-black dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-white';
  const activeProjectOptionId = activeProjectOptionIndex < 0
    ? undefined
    : activeProjectOptionIndex < visibleProjects.length
      ? `${projectListboxId}-option-${visibleProjects[activeProjectOptionIndex].id}`
      : projectActionOptionId;
  const dueDatePreview = useMemo(() => getSmartDatePreviewParts(dueDate), [dueDate]);
  const shouldShowDueDatePreview = Boolean(dueDatePreview?.suffix);
  const shouldShowDueDatePreviewCaret = shouldShowDueDatePreview && isDueDateFocused;
  const dueDateInputTextClassName = shouldShowDueDatePreview
    ? 'text-transparent caret-transparent'
    : 'text-black dark:text-white';

  useEffect(() => {
    if (!isProjectMenuOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!projectControlRef.current?.contains(event.target as Node)) {
        setIsProjectMenuOpen(false);
        setActiveProjectOptionIndex(-1);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isProjectMenuOpen]);

  useEffect(() => {
    setActiveProjectOptionIndex(currentIndex => (
      currentIndex >= projectOptionCount ? projectOptionCount - 1 : currentIndex
    ));
  }, [projectOptionCount]);

  useEffect(() => {
    if (exactProject && isCreatingProject) {
      setIsCreatingProject(false);
    }
  }, [exactProject, isCreatingProject]);

  const registerOnboardingField = useCallback((
    field: TaskOnboardingField,
    ref: React.MutableRefObject<HTMLInputElement | null>
  ) => (element: HTMLInputElement | null) => {
    ref.current = element;
    onRegisterOnboardingField?.(field, element);
  }, [onRegisterOnboardingField]);

  const handleOnboardingFieldFocus = useCallback((field: TaskOnboardingField) => {
    if (isOnboarding) {
      onOnboardingFieldFocus?.(field);
    }
  }, [isOnboarding, onOnboardingFieldFocus]);

  const getOnboardingFieldClassName = useCallback((field: TaskOnboardingField) => (
    isOnboarding
      ? `transition-opacity duration-300 ${activeOnboardingField === field ? 'opacity-100' : 'opacity-25'}`
      : 'opacity-100'
  ), [activeOnboardingField, isOnboarding]);

  const formatWarningDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (language === 'de') {
      const parts = [];
      if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`);
      if (remainingMinutes > 0) parts.push(`${remainingMinutes} ${remainingMinutes === 1 ? 'Minute' : 'Minuten'}`);
      return parts.join(' ') || '0 Minuten';
    }

    const parts = [];
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    if (remainingMinutes > 0) parts.push(`${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`);
    return parts.join(' ') || '0 minutes';
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    const cleaned = val === '' ? '' : String(parseInt(val, 10));
    setDurationInput(cleaned);
  };

  const handleDurationBlur = () => {
    if (!durationInput.trim()) {
      setDurationInput(String(defaultDuration || 60));
    }
  };

  const getPriorityDisplayText = (prioStr: string) => {
    const prioVal = parseInt(prioStr, 10);
    if (isNaN(prioVal) || prioVal < 1 || prioVal > 5) return prioStr;

    let labelKey: TranslationKey = 'priority.important';
    if (prioVal === 1) labelKey = 'priority.marginal';
    if (prioVal === 2) labelKey = 'priority.helpful';
    if (prioVal === 3) labelKey = 'priority.important';
    if (prioVal === 4) labelKey = 'priority.necessary';
    if (prioVal === 5) labelKey = 'priority.critical';

    return `${prioVal} - ${t(labelKey)}`;
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^1-5]/g, '').slice(-1);
    setPriorityInput(val);
  };

  const handlePriorityBlur = () => {
    setIsPriorityFocused(false);
    if (!priorityInput.trim()) {
      setPriorityInput(initialTask ? String(initialTask.priority) : String(defaultPriority || 4));
    }
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDueDate(formatSmartDateDraft(e.target.value, dueDate));
  };

  const handleDueDateBlur = () => {
    const { formatted } = parseSmartDateInput(dueDate);
    setDueDate(formatted);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTitle = e.target.value;
    setTitle(nextTitle);
    if (nextTitle.trim()) {
      setShowTitleError(false);
    }
  };

  const submitTask = useCallback((mode: TaskSubmitMode = 'close') => {
    if (!title.trim()) {
      setShowTitleError(true);
      titleInputRef.current?.focus();
      return false;
    }
    setShowTitleError(false);

    const { iso } = parseSmartDateInput(dueDate);
    const parsedDuration = parseInt(durationInput, 10);
    const finalDuration = isNaN(parsedDuration) ? (defaultDuration || 60) : Math.max(0, parsedDuration);
    const finalPriority = parseInt(priorityInput) || defaultPriority || Priority.Necessary;

    let projId: string | null = null;
    let newProjName = '';

    if (projectNameInput.trim()) {
      if (exactProject) {
        projId = exactProject.id;
      } else if (isCreatingProject) {
        newProjName = projectNameInput.trim();
      } else if (matchingProject) {
        projId = matchingProject.id;
      } else {
        newProjName = projectNameInput.trim();
      }
    } else if (defaultProject) {
      projId = defaultProject.id;
    }

    onSave(mode === 'bulk' ? null : initialTask?.id || null, title.trim(), finalDuration, finalPriority as Priority, iso, projId, newProjName);

    if (mode === 'bulk' && !initialTask) {
      const savedTitle = title.trim();
      showBulkSaveFeedback(savedTitle);
      if (isCreatingProject && newProjName) {
        setIsCreatingProject(false);
      }
      setTitle('');
      window.requestAnimationFrame(() => titleInputRef.current?.focus());
      return true;
    }

    onClose();
    return true;
  }, [defaultDuration, defaultPriority, defaultProject, dueDate, durationInput, exactProject, initialTask, isCreatingProject, matchingProject, onClose, onSave, priorityInput, projectNameInput, showBulkSaveFeedback, title]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isOnboarding) return;
    submitTask();
  };

  const handleOnboardingContinue = useCallback(() => {
    if (!title.trim()) {
      setShowTitleError(true);
      titleInputRef.current?.focus();
      return false;
    }

    if (activeOnboardingField === 'project') {
      return submitTask();
    }

    return true;
  }, [activeOnboardingField, submitTask, title]);

  useEffect(() => {
    if (!isOnboarding || !onRegisterOnboardingContinue) return;
    onRegisterOnboardingContinue(handleOnboardingContinue);
  }, [handleOnboardingContinue, isOnboarding, onRegisterOnboardingContinue]);

  const handleDelete = () => {
    if (initialTask && onDelete) {
      onDelete(initialTask.id);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isOnboarding) return;
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitTask(!initialTask ? 'bulk' : 'close');
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const selectProject = useCallback((project: Project) => {
    setProjectNameInput(project.name);
    setIsProjectMenuOpen(false);
    setShowAllProjectOptions(false);
    setIsCreatingProject(false);
    setActiveProjectOptionIndex(-1);
    window.requestAnimationFrame(() => projectInputRef.current?.focus());
  }, []);

  const handleProjectAction = useCallback(() => {
    if (isCreateProjectAction) {
      setIsCreatingProject(true);
      setIsProjectMenuOpen(false);
      setActiveProjectOptionIndex(-1);
      window.requestAnimationFrame(() => projectInputRef.current?.focus());
      return;
    }

    if (exactProject) {
      setProjectNameInput('');
    }
    setIsCreatingProject(true);
    setShowAllProjectOptions(false);
    setIsProjectMenuOpen(true);
    setActiveProjectOptionIndex(0);
    window.requestAnimationFrame(() => projectInputRef.current?.focus());
  }, [exactProject, isCreateProjectAction]);

  const handleProjectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextProjectName = e.target.value;
    const normalizedNextProjectName = nextProjectName.trim().toLowerCase();
    const nextExactProject = projectLookup.find(({ normalizedName }) => normalizedName === normalizedNextProjectName);

    setProjectNameInput(nextProjectName);
    setShowAllProjectOptions(false);
    setIsProjectMenuOpen(true);
    setActiveProjectOptionIndex(-1);

    if (nextExactProject) {
      setIsCreatingProject(false);
    }
  };

  const handleProjectControlBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;

    if (!projectNameInput.trim() && defaultProject) {
      setProjectNameInput(defaultProject.name);
      setIsCreatingProject(false);
    }
    setIsProjectMenuOpen(false);
    setShowAllProjectOptions(false);
    setActiveProjectOptionIndex(-1);
  };

  const handleProjectMenuToggle = () => {
    if (isProjectMenuOpen) {
      setIsProjectMenuOpen(false);
      setActiveProjectOptionIndex(-1);
      return;
    }

    setShowAllProjectOptions(Boolean(exactProject) || !normalizedProjectInput);
    setIsProjectMenuOpen(true);
    setActiveProjectOptionIndex(-1);
    window.requestAnimationFrame(() => projectInputRef.current?.focus());
  };

  const handleProjectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();

      if (!isProjectMenuOpen) {
        const shouldShowEveryProject = Boolean(exactProject) || !normalizedProjectInput;
        const nextProjectOptionCount = (shouldShowEveryProject ? projects.length : visibleProjects.length) + 1;
        setShowAllProjectOptions(shouldShowEveryProject);
        setIsProjectMenuOpen(true);
        setActiveProjectOptionIndex(e.key === 'ArrowDown' ? 0 : nextProjectOptionCount - 1);
        return;
      }

      const direction = e.key === 'ArrowDown' ? 1 : -1;
      setActiveProjectOptionIndex(currentIndex => {
        if (currentIndex < 0) return direction > 0 ? 0 : projectOptionCount - 1;
        return (currentIndex + direction + projectOptionCount) % projectOptionCount;
      });
      return;
    }

    if (e.key === 'Escape' && isProjectMenuOpen) {
      e.preventDefault();
      e.stopPropagation();
      setIsProjectMenuOpen(false);
      setActiveProjectOptionIndex(-1);
      return;
    }

    if (e.key === 'Enter' && isProjectMenuOpen && activeProjectOptionIndex >= 0) {
      e.preventDefault();
      if (activeProjectOptionIndex < visibleProjects.length) {
        selectProject(visibleProjects[activeProjectOptionIndex]);
      } else {
        handleProjectAction();
      }
      return;
    }

    if (e.key === 'Tab' || e.key === 'Enter') {
      if (!isCreatingProject && matchingProject) {
        setProjectNameInput(matchingProject.name);
      }
      setIsProjectMenuOpen(false);
      setShowAllProjectOptions(false);
      setActiveProjectOptionIndex(-1);
    }
  };

  return (
    <>
      {!hideTitle && (
        <h2 className="text-2xl sm:text-3xl font-black mb-6 uppercase tracking-tight">
          {initialTask ? t('task.editTitle') : t('task.newTitle')}
        </h2>
      )}

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex flex-col gap-6">

        {/* 1. Title */}
        <div className={getOnboardingFieldClassName('title')}>
          <input
            ref={registerOnboardingField('title', titleInputRef)}
            autoFocus={!isOnboarding}
            type="text"
            value={title}
            onChange={handleTitleChange}
            onFocus={() => handleOnboardingFieldFocus('title')}
            placeholder={t('task.titlePlaceholder')}
            className="w-full min-w-0 text-xl sm:text-2xl font-medium border-b border-neutral-300 dark:border-neutral-700 pb-2 bg-transparent focus:outline-none focus:border-black dark:focus:border-white placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-black dark:text-white"
            aria-invalid={showTitleError}
            aria-describedby={showTitleError ? titleErrorId : undefined}
          />
          <TaskModalInlineHint id={titleErrorId} isVisible={showTitleError} role="alert">
            {t('task.titleRequired')}
          </TaskModalInlineHint>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* 2. Duration */}
          <div className={`flex flex-col gap-1 ${getOnboardingFieldClassName('duration')}`}>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('task.duration')}</label>
            <input
              ref={registerOnboardingField('duration', durationInputRef)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={durationInput}
              onChange={handleDurationChange}
              onBlur={handleDurationBlur}
              onFocus={(e) => {
                handleOnboardingFieldFocus('duration');
                handleInputFocus(e);
              }}
              className={`w-full min-w-0 border bg-transparent p-2 font-mono text-center focus:outline-none focus:ring-1 ${isDurationTooLong ? 'border-red-600 text-red-600 focus:ring-red-600 dark:border-red-400 dark:text-red-400 dark:focus:ring-red-400' : 'border-neutral-200 text-black focus:ring-black dark:border-neutral-700 dark:text-white dark:focus:ring-white'}`}
            />
          </div>

          {/* 3. Priority */}
          <div className={`flex flex-col gap-1 ${getOnboardingFieldClassName('priority')}`}>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('task.priority')}</label>
            <input
              ref={registerOnboardingField('priority', priorityInputRef)}
              type="text"
              value={isPriorityFocused ? priorityInput : getPriorityDisplayText(priorityInput)}
              onChange={handlePriorityChange}
              onFocus={(e) => {
                handleOnboardingFieldFocus('priority');
                setIsPriorityFocused(true);
                const target = e.target;
                setTimeout(() => {
                  target.select();
                }, 0);
              }}
              onBlur={handlePriorityBlur}
              placeholder="4"
              className="w-full min-w-0 border border-neutral-200 dark:border-neutral-700 bg-transparent p-2 text-center focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-black dark:text-white"
            />
          </div>

          {/* 4. Due Date */}
          <div className={`flex flex-col gap-1 ${getOnboardingFieldClassName('dueDate')}`}>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('task.dueDate')}</label>
            <div className="relative">
              <input
                ref={registerOnboardingField('dueDate', dueDateInputRef)}
                type="text"
                value={dueDate}
                onChange={handleDueDateChange}
                onBlur={() => {
                  setIsDueDateFocused(false);
                  handleDueDateBlur();
                }}
                onFocus={(e) => {
                  setIsDueDateFocused(true);
                  handleOnboardingFieldFocus('dueDate');
                  handleInputFocus(e);
                }}
                placeholder={t('task.dueDatePlaceholder')}
                className={`relative z-10 w-full min-w-0 border border-neutral-200 dark:border-neutral-700 bg-transparent p-2 font-mono text-center focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white ${dueDateInputTextClassName}`}
              />
              {shouldShowDueDatePreview && dueDatePreview && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden p-2 font-mono text-center"
                >
                  <span className="whitespace-pre">
                    <span className="text-transparent">
                      {dueDatePreview.spacer}
                    </span>
                    <span className="text-black dark:text-white">
                      {dueDatePreview.typedText}
                    </span>
                    {shouldShowDueDatePreviewCaret && (
                      <span className="inline-block h-[1.2em] w-0 border-l border-black align-[-0.18em] dark:border-white" />
                    )}
                    <span className="text-neutral-400 dark:text-neutral-500">
                      {dueDatePreview.suffix}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 5. Project */}
          <div className={`flex flex-col ${getOnboardingFieldClassName('project')}`}>
            <label htmlFor={projectInputId} className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('task.project')}</label>
            <div ref={projectControlRef} onBlur={handleProjectControlBlur} className="group/project-control relative overflow-visible border border-neutral-200 bg-white focus-within:ring-1 focus-within:ring-black dark:border-neutral-700 dark:bg-neutral-800 dark:focus-within:ring-white">
              <div className="flex min-w-0 items-stretch">
                <input
                  id={projectInputId}
                  ref={registerOnboardingField('project', projectInputRef)}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={isProjectMenuOpen}
                  aria-controls={projectListboxId}
                  aria-activedescendant={activeProjectOptionId}
                  value={projectNameInput}
                  onChange={handleProjectInputChange}
                  onFocus={(e) => {
                    handleOnboardingFieldFocus('project');
                    handleInputFocus(e);
                  }}
                  onKeyDown={handleProjectKeyDown}
                  placeholder={projects[0]?.name || t('task.projectPlaceholder')}
                  className="w-full min-w-0 bg-transparent p-2 pr-1 text-black focus:outline-none dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleProjectMenuToggle}
                  aria-label={t('task.openProjectList')}
                  aria-expanded={isProjectMenuOpen}
                  aria-controls={projectListboxId}
                  className="flex w-8 shrink-0 items-center justify-center text-neutral-500 hover:text-black focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-black dark:text-neutral-400 dark:hover:text-white dark:focus-visible:ring-white"
                >
                  <IconChevronDown className={`h-4 w-4 transition-transform duration-150 motion-reduce:transition-none ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isProjectMenuOpen && (
                <ul
                  id={projectListboxId}
                  role="listbox"
                  aria-label={t('task.project')}
                  className="absolute left-[-1px] right-[-1px] top-full z-30 max-h-56 overflow-y-auto border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {visibleProjects.map((project, index) => {
                    const optionId = `${projectListboxId}-option-${project.id}`;
                    const isActive = activeProjectOptionIndex === index;

                    return (
                      <li key={project.id} role="presentation">
                        <button
                          id={optionId}
                          type="button"
                          role="option"
                          aria-selected={exactProject?.id === project.id}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveProjectOptionIndex(index)}
                          onClick={() => selectProject(project)}
                          className={`w-full px-3 py-2 text-left text-sm text-black focus:outline-none dark:text-white ${isActive ? 'bg-neutral-100 dark:bg-neutral-700' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
                        >
                          {project.name}
                        </button>
                      </li>
                    );
                  })}
                  <li role="presentation" className="border-t border-neutral-200 dark:border-neutral-700">
                    <button
                      id={projectActionOptionId}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveProjectOptionIndex(visibleProjects.length)}
                      onClick={handleProjectAction}
                      className={`flex min-h-10 w-full items-center px-3 py-2 text-left text-xs font-bold focus:outline-none ${projectActionToneClassName}`}
                    >
                      <span aria-hidden="true" className="flex w-5 shrink-0 items-center justify-start">
                        <IconPlus className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 whitespace-normal leading-snug">
                        {t(isCreateProjectAction ? 'task.createProjectAction' : 'task.newProjectAction')}
                      </span>
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {shouldShowDurationGuidance && (
          <div className="flex flex-col items-start gap-3 border-l border-neutral-300 pl-3 text-left text-black dark:border-neutral-700 dark:text-neutral-100" role="status">
            <AnimatedTaskDurationSplitLogo size="compact" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-black leading-tight">
                {t('task.durationGuidanceTitle')}
              </p>
              <p className="max-w-xl text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
                {t(durationGuidanceBodyKey, { duration: formatWarningDuration(maxTaskCapacityMinutes) })}
              </p>
            </div>
          </div>
        )}

        {!hideFooter && (
          <div className="mt-4">
            {!initialTask && (
              <div className="min-h-[18px] pb-1 text-left">
                {bulkSaveFeedbackText && (
                  <p role="status" aria-live="polite" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {bulkSaveFeedbackText}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <div className="w-full sm:w-auto">
                {initialTask && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full sm:w-auto px-4 py-2 font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors uppercase tracking-wider text-sm"
                  >
                    {t('task.delete')}
                  </button>
                )}
              </div>
              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:gap-4">
                <button type="button" onClick={onClose} className="w-full sm:w-auto px-6 py-3 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors uppercase tracking-wider text-sm text-black dark:text-neutral-100">{t('task.cancel')}</button>
                <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors uppercase tracking-wider text-sm">
                  {initialTask ? t('task.saveChanges') : t('task.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </>
  );
};

const TaskCreateModalComponent: React.FC<TaskCreateModalProps> = ({
  isOpen,
  initialTask,
  onClose,
  onSave,
  onDelete,
  projects,
  defaultProjectId,
  maxTaskCapacityMinutes,
  defaultDuration,
  defaultPriority,
  initialDueDate,
  showBulkTaskShortcutHint = false,
  onBulkTaskShortcutHintShown,
}) => {
  const [isBulkTaskShortcutHintVisible, setIsBulkTaskShortcutHintVisible] = useState(false);
  const modifierKey: BulkTaskShortcutHintProps['modifierKey'] = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
    ? 'Cmd'
    : 'Ctrl';

  useEffect(() => {
    if (!isOpen) {
      setIsBulkTaskShortcutHintVisible(false);
      return;
    }

    if (!initialTask && showBulkTaskShortcutHint && !isBulkTaskShortcutHintVisible) {
      setIsBulkTaskShortcutHintVisible(true);
      onBulkTaskShortcutHintShown?.();
    }
  }, [initialTask, isBulkTaskShortcutHintVisible, isOpen, onBulkTaskShortcutHintShown, showBulkTaskShortcutHint]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <TaskModalBackdrop />
      <div className="relative z-10 w-full max-w-2xl max-h-[calc(100vh-1.5rem)] overflow-y-auto border border-black bg-white text-black shadow-[0px_0px_200px_200px_rgba(255,255,255,0.8)] dark:border-neutral-500 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-[0px_0px_200px_200px_rgba(15,15,15,0.8)] sm:max-h-[calc(100vh-2rem)]">
        <div className="p-5 sm:p-8">
          <TaskModalForm
            initialTask={initialTask}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
            projects={projects}
            defaultProjectId={defaultProjectId}
            maxTaskCapacityMinutes={maxTaskCapacityMinutes}
            defaultDuration={defaultDuration}
            defaultPriority={defaultPriority}
            initialDueDate={initialDueDate}
          />
        </div>
        {isBulkTaskShortcutHintVisible && (
          <BulkTaskShortcutHint modifierKey={modifierKey} />
        )}
      </div>
    </div>
  );
};

export const TaskCreateModal = React.memo(TaskCreateModalComponent);
