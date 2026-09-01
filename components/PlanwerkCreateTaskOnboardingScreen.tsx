import React from 'react';
import { Priority, Project, Task } from '../types';
import { TranslationKey, useI18n } from '../i18n';
import {
  AnimatedTabKeyLogo,
  AnimatedTaskDueDateLogo,
  AnimatedTaskDurationSplitLogo,
  AnimatedTaskPriorityLogo,
  AnimatedTaskProjectDropdownLogo,
  AnimatedTaskTitleFocusLogo,
  AnimatedWorkWeekTimeLogo,
} from './animations';
import { OnboardingTaskCardPreview, TaskCardReviewStep } from './OnboardingTaskCardPreview';
import { PrimaryButton, TertiaryButton } from './Buttons';
import { InAppTutorialPanel } from './InAppTutorialPanel';
import { OnboardingScoreExplanation } from './OnboardingScoreExplanation';
import { TaskModalForm, TaskOnboardingField } from './TaskCreateModal';

const ONBOARDING_FIELDS: TaskOnboardingField[] = ['title', 'duration', 'priority', 'dueDate', 'project'];
const CARD_REVIEW_STEPS: TaskCardReviewStep[] = ['card', 'duration', 'score'];
const TITLE_FOCUS_DELAY_MS = 3800;
const COPY_SWAP_DELAY_MS = 250;
const FORM_EXIT_DELAY_MS = 500;
const REVIEW_EXIT_DELAY_MS = 500;

type OnboardingPhase = 'form' | 'cardReview';

type KeyboardHintState =
  | { reason: 'enter'; returnField: TaskOnboardingField }
  | { reason: 'dueDate' }
  | null;

interface PlanwerkCreateTaskOnboardingScreenProps {
  projects: Project[];
  defaultProjectId: string | null;
  maxTaskCapacityMinutes: number;
  defaultDuration?: number;
  defaultPriority?: Priority;
  initialDueDate?: string | null;
  onCreateTask: (title: string, duration: number, priority: Priority, dueDate: string | null, projectId: string | null, newProjectName?: string) => Task;
  onComplete: () => void;
}

interface OnboardingRevealProps {
  delaySeconds: number;
  children: React.ReactNode;
}

const copyByField: Record<TaskOnboardingField, { title: TranslationKey; body: TranslationKey }> = {
  title: {
    title: 'welcome.createTaskTitleTitle',
    body: 'welcome.createTaskTitleBody',
  },
  duration: {
    title: 'welcome.createTaskDurationTitle',
    body: 'welcome.createTaskDurationBody',
  },
  priority: {
    title: 'welcome.createTaskPriorityTitle',
    body: 'welcome.createTaskPriorityBody',
  },
  dueDate: {
    title: 'welcome.createTaskDueDateTitle',
    body: 'welcome.createTaskDueDateBody',
  },
  project: {
    title: 'welcome.createTaskProjectTitle',
    body: 'welcome.createTaskProjectBody',
  },
};

const cardReviewCopy: Record<TaskCardReviewStep, { title: TranslationKey; body: TranslationKey }> = {
  card: {
    title: 'welcome.taskCardReviewCardTitle',
    body: 'welcome.taskCardReviewCardBody',
  },
  duration: {
    title: 'welcome.taskCardReviewDurationTitle',
    body: 'welcome.taskCardReviewDurationBody',
  },
  score: {
    title: 'welcome.taskCardReviewScoreTitle',
    body: 'welcome.taskCardReviewScoreBody',
  },
};

const CreateTaskOnboardingStyles: React.FC = () => (
  <style>{`
    @keyframes create-task-onboarding-reveal {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes create-task-intro-shift {
      from {
        top: 50%;
      }
      to {
        top: calc(50% - clamp(11rem, 28vh, 16rem));
      }
    }

    @keyframes create-task-copy-fade {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes create-task-card-review-enter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes create-task-card-scale-enter {
      from {
        opacity: 0;
        transform: translateY(18px) scale(0);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes create-task-card-review-exit {
      from {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateY(12px) scale(0.96);
      }
    }

    .create-task-intro-shift {
      animation: create-task-intro-shift 900ms ease-in-out 2.5s forwards;
    }

    .create-task-form-center {
      top: calc(50% + clamp(1rem, 3vh, 2rem));
    }

    .create-task-continue-position {
      top: calc(50% + clamp(13rem, 30vh, 17rem));
    }

    .create-task-copy-fade {
      animation: create-task-copy-fade 0.5s ease-out;
    }

    .create-task-form-exit {
      opacity: 0;
      transition: opacity 0.5s ease-out, transform 0.5s ease-out;
    }

    .create-task-form-exit-centered {
      transform: translate(-50%, calc(-50% + 10px));
    }

    .create-task-form-exit-button {
      transform: translate(-50%, 10px);
    }

    .create-task-card-review-enter {
      animation: create-task-card-review-enter 0.7s ease-out forwards;
    }

    .create-task-card-scale-enter {
      animation: create-task-card-scale-enter 0.7s cubic-bezier(0.2, 0.85, 0.2, 1) forwards;
      transform-origin: center center;
    }

    .create-task-card-review-exit {
      animation: create-task-card-review-exit 0.5s ease-in forwards;
      transform-origin: center center;
    }

    @media (prefers-reduced-motion: reduce) {
      .create-task-onboarding-reveal {
        animation-duration: 1ms !important;
        animation-delay: 0s !important;
        transform: none !important;
      }

      .create-task-intro-shift {
        animation: none !important;
        top: calc(50% - clamp(11rem, 28vh, 16rem));
      }

      .create-task-copy-fade {
        animation-duration: 1ms !important;
      }

      .create-task-form-exit {
        transition-duration: 1ms !important;
      }

      .create-task-card-review-enter,
      .create-task-card-scale-enter,
      .create-task-card-review-exit {
        animation-duration: 1ms !important;
      }
    }
  `}</style>
);

const OnboardingReveal: React.FC<OnboardingRevealProps> = ({ delaySeconds, children }) => (
  <div
    className="create-task-onboarding-reveal flex w-full flex-col items-center opacity-0"
    style={{
      animation: `create-task-onboarding-reveal 1s ease-out ${delaySeconds}s forwards`,
    }}
  >
    {children}
  </div>
);

export const PlanwerkCreateTaskOnboardingScreen: React.FC<PlanwerkCreateTaskOnboardingScreenProps> = ({
  projects,
  defaultProjectId,
  maxTaskCapacityMinutes,
  defaultDuration,
  defaultPriority,
  initialDueDate,
  onCreateTask,
  onComplete,
}) => {
  const { t } = useI18n();
  const [phase, setPhase] = React.useState<OnboardingPhase>('form');
  const [activeField, setActiveField] = React.useState<TaskOnboardingField>('title');
  const [copyField, setCopyField] = React.useState<TaskOnboardingField>('title');
  const [isCopyVisible, setIsCopyVisible] = React.useState(true);
  const [createdTask, setCreatedTask] = React.useState<Task | null>(null);
  const createdTaskRef = React.useRef<Task | null>(null);
  const [reviewStepIndex, setReviewStepIndex] = React.useState(0);
  const [isScoreExplanationOpen, setIsScoreExplanationOpen] = React.useState(false);
  const [isFormExiting, setIsFormExiting] = React.useState(false);
  const [isReviewExiting, setIsReviewExiting] = React.useState(false);
  const [hasUsedTabToAdvance, setHasUsedTabToAdvance] = React.useState(false);
  const [hasShownEnterHint, setHasShownEnterHint] = React.useState(false);
  const [keyboardHint, setKeyboardHint] = React.useState<KeyboardHintState>(null);
  const fieldRefs = React.useRef<Partial<Record<TaskOnboardingField, HTMLInputElement | null>>>({});
  const copySwapTimerRef = React.useRef<number | null>(null);
  const continueHandlerRef = React.useRef<(() => boolean) | null>(null);
  const transitionTimerRef = React.useRef<number | null>(null);
  const scoreExplanationTriggerRef = React.useRef<HTMLDivElement | null>(null);

  const focusField = React.useCallback((field: TaskOnboardingField) => {
    window.setTimeout(() => {
      fieldRefs.current[field]?.focus();
    }, 0);
  }, []);

  const updateActiveField = React.useCallback((field: TaskOnboardingField) => {
    setActiveField(field);

    if (field === copyField) return;
    if (copySwapTimerRef.current !== null) {
      window.clearTimeout(copySwapTimerRef.current);
    }

    setIsCopyVisible(false);
    copySwapTimerRef.current = window.setTimeout(() => {
      setCopyField(field);
      setIsCopyVisible(true);
      copySwapTimerRef.current = null;
    }, COPY_SWAP_DELAY_MS);
  }, [copyField]);

  React.useEffect(() => (
    () => {
      if (copySwapTimerRef.current !== null) {
        window.clearTimeout(copySwapTimerRef.current);
      }
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    }
  ), []);

  React.useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      focusField('title');
    }, TITLE_FOCUS_DELAY_MS);

    return () => window.clearTimeout(focusTimer);
  }, [focusField]);

  const handleRegisterField = React.useCallback((field: TaskOnboardingField, element: HTMLInputElement | null) => {
    fieldRefs.current[field] = element;
  }, []);

  const handleCreateTask = React.useCallback((
    _id: string | null,
    title: string,
    duration: number,
    priority: Priority,
    dueDate: string | null,
    projectId: string | null,
    newProjectName?: string
  ) => {
    const task = onCreateTask(title, duration, priority, dueDate, projectId, newProjectName);
    createdTaskRef.current = task;
    setCreatedTask(task);
  }, [onCreateTask]);

  const dismissKeyboardHint = React.useCallback(() => {
    if (!keyboardHint) return;

    setKeyboardHint(null);
    if (keyboardHint.reason === 'dueDate') {
      setHasUsedTabToAdvance(true);
      updateActiveField('dueDate');
      focusField('dueDate');
      return;
    }

    focusField(keyboardHint.returnField);
  }, [focusField, keyboardHint, updateActiveField]);

  const handleOnboardingPointerDownCapture = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;

    if (target === fieldRefs.current.dueDate && !hasUsedTabToAdvance && activeField !== 'dueDate') {
      e.preventDefault();
      setKeyboardHint({ reason: 'dueDate' });
    }
  }, [activeField, hasUsedTabToAdvance]);

  const handleContinue = React.useCallback((showEnterHint = false) => {
    if (phase === 'cardReview') {
      const isLastReviewStep = reviewStepIndex === CARD_REVIEW_STEPS.length - 1;
      if (!isLastReviewStep) {
        setReviewStepIndex((currentIndex) => currentIndex + 1);
        return;
      }

      setIsReviewExiting(true);
      transitionTimerRef.current = window.setTimeout(() => {
        onComplete();
      }, REVIEW_EXIT_DELAY_MS);
      return;
    }

    const canContinue = continueHandlerRef.current?.() ?? true;
    if (!canContinue) {
      updateActiveField('title');
      focusField('title');
      return;
    }

    const currentIndex = ONBOARDING_FIELDS.indexOf(activeField);
    if (currentIndex === ONBOARDING_FIELDS.length - 1) {
      if (!createdTaskRef.current) return;

      setIsFormExiting(true);
      transitionTimerRef.current = window.setTimeout(() => {
        setReviewStepIndex(0);
        setPhase('cardReview');
        setIsFormExiting(false);
      }, FORM_EXIT_DELAY_MS);
      return;
    }

    const nextField = ONBOARDING_FIELDS[currentIndex + 1];
    if (activeField === 'priority' && nextField === 'dueDate' && !hasUsedTabToAdvance) {
      setKeyboardHint({ reason: 'dueDate' });
      return;
    }

    updateActiveField(nextField);
    if (showEnterHint) {
      setHasShownEnterHint(true);
      setKeyboardHint({ reason: 'enter', returnField: nextField });
      return;
    }
    focusField(nextField);
  }, [activeField, focusField, hasUsedTabToAdvance, onComplete, phase, reviewStepIndex, updateActiveField]);

  const handleOpenScoreExplanation = React.useCallback(() => {
    setIsScoreExplanationOpen(true);
  }, []);

  const handleCloseScoreExplanation = React.useCallback(() => {
    setIsScoreExplanationOpen(false);
    window.setTimeout(() => scoreExplanationTriggerRef.current?.querySelector('button')?.focus(), 0);
  }, []);

  const handleOnboardingKeyDownCapture = React.useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (phase !== 'form') return;

    if (keyboardHint) {
      if (e.key === 'Tab') {
        e.preventDefault();
        setHasUsedTabToAdvance(true);
        dismissKeyboardHint();
      }
      return;
    }

    if (
      e.key === 'Enter'
      && !e.altKey
      && !e.ctrlKey
      && !e.metaKey
      && !e.shiftKey
      && !e.nativeEvent.isComposing
    ) {
      const targetField = ONBOARDING_FIELDS.find(field => fieldRefs.current[field] === e.target);
      const isSelectingProjectOption = targetField === 'project'
        && fieldRefs.current.project?.getAttribute('aria-expanded') === 'true';

      if (targetField && !isSelectingProjectOption) {
        e.preventDefault();
        handleContinue(!hasShownEnterHint);
        return;
      }
    }

    if (e.key === 'Tab' && !e.shiftKey) {
      setHasUsedTabToAdvance(true);
    }
  }, [dismissKeyboardHint, handleContinue, hasShownEnterHint, keyboardHint, phase]);

  const activeCopy = copyByField[copyField];
  const activeReviewStep = CARD_REVIEW_STEPS[reviewStepIndex];
  const createdTaskProjectName = React.useMemo(() => (
    createdTask?.projectId
      ? projects.find(project => project.id === createdTask.projectId)?.name
      : undefined
  ), [createdTask?.projectId, projects]);
  const activeAnimation = copyField === 'title'
    ? <AnimatedTaskTitleFocusLogo />
      : copyField === 'duration' ? <AnimatedTaskDurationSplitLogo />
        : copyField === 'priority' ? <AnimatedTaskPriorityLogo />
          : copyField === 'dueDate' ? <AnimatedTaskDueDateLogo />
            : copyField === 'project' ? <AnimatedTaskProjectDropdownLogo /> : <AnimatedWorkWeekTimeLogo />;

  return (
    <main
      className="flex h-screen w-full items-start justify-center overflow-y-auto bg-transparent px-6 py-10 text-black selection:bg-black selection:text-white dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black"
      role="main"
      onKeyDownCapture={handleOnboardingKeyDownCapture}
      onPointerDownCapture={handleOnboardingPointerDownCapture}
    >
      <CreateTaskOnboardingStyles />
      <div
        className="create-task-onboarding-stage relative w-full max-w-5xl"
        style={{ minHeight: 'min(760px, calc(100vh - 5rem))' }}
      >
        {phase === 'cardReview' && createdTask ? (
          <div
            className={`create-task-card-review-enter flex min-h-[min(760px,calc(100vh-5rem))] w-full items-center justify-center opacity-0 ${isReviewExiting ? 'create-task-card-review-exit' : ''}`}
          >
            {activeReviewStep === 'score' && (
              <div className={isScoreExplanationOpen ? 'contents' : 'hidden'} aria-hidden={!isScoreExplanationOpen}>
                <OnboardingScoreExplanation
                  isOpen={isScoreExplanationOpen}
                  onBack={handleCloseScoreExplanation}
                  onContinue={() => handleContinue()}
                />
              </div>
            )}
            {!isScoreExplanationOpen && (
              <>
                <div className="grid w-full max-w-4xl items-center gap-12 md:grid-cols-[1fr_auto]">
                  <div className={`flex flex-col gap-8 transition-opacity duration-500 ${isReviewExiting ? 'opacity-0' : 'opacity-100'}`}>
                    {activeReviewStep === 'score' ? (
                      <section className="create-task-copy-fade max-w-xl">
                        <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
                          {t('welcome.taskCardReviewScoreTitle')}
                        </h1>
                        <p className="mt-5 text-base font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
                          {t('welcome.taskCardReviewScoreBody')}
                        </p>

                        <div className="mt-6 flex flex-col items-start justify-between gap-2 border-y border-neutral-200 py-3 dark:border-neutral-700 sm:flex-row sm:items-center">
                          <p className="text-lg font-black tracking-tight">
                            {t('welcome.taskCardReviewScoreFormula')}
                          </p>
                          <div ref={scoreExplanationTriggerRef}>
                            <TertiaryButton
                              onClick={handleOpenScoreExplanation}
                              className="-ml-3 sm:ml-0"
                            >
                              {t('welcome.taskCardReviewScoreExplain')}
                            </TertiaryButton>
                          </div>
                        </div>
                      </section>
                    ) : (
                      CARD_REVIEW_STEPS.slice(0, 2).map((step, index) => {
                        const copy = cardReviewCopy[step];
                        const isActive = index === reviewStepIndex;
                        const hasPassed = index < reviewStepIndex;

                        return (
                          <section
                            key={step}
                            aria-hidden={!isActive && !hasPassed}
                            className={`transition-opacity duration-500 ${isActive ? 'opacity-100' : hasPassed ? 'opacity-25' : 'opacity-0'}`}
                          >
                            <h1 className="max-w-xl text-4xl font-black leading-none tracking-tight sm:text-5xl">
                              {t(copy.title)}
                            </h1>
                            <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
                              {t(copy.body)}
                            </p>
                          </section>
                        );
                      })
                    )}
                  </div>

                  <div className={`create-task-card-scale-enter flex justify-center ${isReviewExiting ? 'create-task-card-review-exit' : ''}`}>
                    <OnboardingTaskCardPreview
                      task={createdTask}
                      projectName={createdTaskProjectName}
                      maxTaskCapacityMinutes={maxTaskCapacityMinutes}
                      highlightStep={activeReviewStep}
                    />
                  </div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                  <PrimaryButton
                    onClick={() => handleContinue()}
                    className="w-auto !px-6 !py-2 text-xs"
                  >
                    {t('welcome.continueToBoard')}
                  </PrimaryButton>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={`create-task-intro-shift absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center ${isFormExiting ? 'create-task-form-exit create-task-form-exit-centered' : ''}`}>
              {activeAnimation}

              <div
                key={copyField}
                className={`create-task-copy-fade flex w-full flex-col items-center transition-opacity duration-500 ${isCopyVisible ? 'opacity-100' : 'opacity-0'}`}
              >
                <h1 className="mt-8 max-w-xl text-4xl font-black leading-none tracking-tight sm:text-5xl">
                  {t(activeCopy.title)}
                </h1>
                <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {t(activeCopy.body)}
                </p>
              </div>
            </div>

            <div className={`create-task-form-center absolute left-1/2 w-full -translate-x-1/2 -translate-y-1/2 ${isFormExiting ? 'create-task-form-exit create-task-form-exit-centered pointer-events-none' : ''}`}>
              <OnboardingReveal delaySeconds={3.7}>
                <div className="mt-20 w-full max-w-4xl border border-neutral-200 bg-white p-5 text-left shadow-sm dark:border-neutral-700 dark:bg-neutral-900 ">
                  <TaskModalForm
                    initialTask={null}
                    onClose={() => {}}
                    onSave={handleCreateTask}
                    projects={projects}
                    defaultProjectId={defaultProjectId}
                    maxTaskCapacityMinutes={maxTaskCapacityMinutes}
                    defaultDuration={defaultDuration}
                    defaultPriority={defaultPriority}
                    initialDueDate={initialDueDate}
                    variant="onboarding"
                    activeOnboardingField={activeField}
                    onOnboardingFieldFocus={updateActiveField}
                    onRegisterOnboardingField={handleRegisterField}
                    onRegisterOnboardingContinue={(handler) => {
                      continueHandlerRef.current = handler;
                    }}
                  />
                </div>
              </OnboardingReveal>
            </div>

            <div className={`create-task-continue-position absolute left-1/2 -translate-x-1/2 ${isFormExiting ? 'create-task-form-exit create-task-form-exit-button pointer-events-none' : ''}`}>
              <OnboardingReveal delaySeconds={3.9}>
                <PrimaryButton
                  onClick={() => handleContinue()}
                  className="w-auto !px-6 !py-2 text-xs"
                >
                  {t('welcome.continueToBoard')}
                </PrimaryButton>
              </OnboardingReveal>
            </div>

            {keyboardHint && (
              <InAppTutorialPanel
                title={t(keyboardHint.reason === 'enter' ? 'welcome.enterHintTitle' : 'welcome.tabHintTitle')}
                body=""
                buttonLabel={t('welcome.tabHintOk')}
                visual={<AnimatedTabKeyLogo variant={keyboardHint.reason === 'enter' ? 'combined' : 'tab'} />}
                onContinue={dismissKeyboardHint}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
};
