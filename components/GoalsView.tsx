import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Goal, Project, Task, WeeklyGoal } from '../types';
import { getReflectionHistoryGroup } from '../utils/dateUtils';
import { ResolvedLanguage, TranslationKey, useI18n } from '../i18n';
import { buildDefineWithAiPrompt } from './goals/defineWithAiPrompt';
import { writeTextToClipboard } from './goals/clipboard';
import { IconPlus, IconTrash, IconWand } from './Icons';
import { ThreeMonthGoalRow } from './GoalRows';
import { SubSideMenuButton } from './Buttons';
import { SubSideMenu } from './SubSideMenu';
import { WeeklyGoalPanel } from './WeeklyGoalPanel';


interface GoalsViewProps {
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
  tasks: Task[];
  projects: Project[];
  onAddGoal: (title: string) => void;
  onToggleGoalFocus: (id: string) => void;
  onCompleteGoal: (id: string) => void;
  onUndoCompleteGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onDefineWeeklyGoal: (title: string) => string | null;
  onUpdateWeeklyGoal: (id: string, title: string) => void;
  onClearOpenWeeklyGoal: () => void;
  onDeleteWeeklyGoal: (id: string) => void;
  onCompleteWeeklyGoal: (id: string) => void;
  onUndoCompleteWeeklyGoal: (id: string) => void;
}

type GoalsTab = 'active' | 'history';

type GoalHistoryItem = {
  type: 'three-month';
  goal: Goal;
  timestamp: number;
} | {
  type: 'weekly';
  goal: WeeklyGoal;
  timestamp: number;
};

type GoalHistoryGroup = {
  key: string;
  label: string;
  order: number;
  items: GoalHistoryItem[];
};

const GOAL_EXAMPLES_BY_LANGUAGE: Record<ResolvedLanguage, string[]> = {
  en: [
    'Bring my idea to a point where I can test it with real people',
    'Turn my rough concept into a first version I can confidently share',
    'Get my side project ready for a small beta with selected users',
    'Clarify whether my business idea is worth pursuing further',
    'Create enough structure around my work so I know what truly matters each week',
    'Reduce my active projects to a realistic number I can actually move forward',
    'Bring one neglected project to a clear decision: finish, pause, or let go',
    'Make my current project ready for review, handover, or launch',
    'Build a repeatable weekly planning routine that helps me stay focused',
    'Set up a simple review habit so I can see what work is actually useful',
    'Create a healthier work rhythm that still functions during busy weeks',
    'Prepare my portfolio so I feel ready to show my work again',
    'Clarify my next career step and define what I want to move toward',
    'Create a clear offer for my work that I can explain without overthinking it',
    'Validate one service or product idea with real conversations and feedback',
    'Build a small audience signal around one topic I care about',
    'Turn my expertise into a first talk, workshop, or learning format',
    'Document my most important workflows so recurring work becomes easier',
    'Create a cleaner digital workspace that supports focused work again',
    'Build a realistic financial overview that helps me make better decisions',
    'Create a learning path that helps me noticeably improve one skill',
    'Turn scattered notes and ideas into one clear direction for the next phase',
    'Create a stronger foundation for independent work or freelancing',
    'Improve one recurring work process so it saves time every week',
    'Collect enough proof of my work to communicate my value more clearly',
    'Finish the first usable version of a tool that solves a real problem for me',
    'Create a content direction I can realistically maintain for three months',
    'Move one important relationship, client, or network topic forward',
    'Make my workload feel more intentional and less reactive',
    'Reach a point where I can confidently decide what to continue next quarter',
  ],
  de: [
    'Meine Idee so weit bringen, dass ich sie mit echten Menschen testen kann',
    'Mein grobes Konzept in eine erste Version verwandeln, die ich zeigen kann',
    'Mein Side Project für eine kleine Beta mit ausgewählten Nutzer:innen vorbereiten',
    'Klären, ob meine Geschäftsidee es wert ist, weiterverfolgt zu werden',
    'Genug Struktur in meine Arbeit bringen, dass ich jede Woche weiß, was wirklich zählt',
    'Meine aktiven Projekte auf eine realistische Anzahl reduzieren, die ich wirklich bewegen kann',
    'Mein liegen gebliebenes Projekt zu einer klaren Entscheidung bringen: abschließen, pausieren oder loslassen',
    'Mein aktuelles Projekt bereit für Review, Übergabe oder Launch machen',
    'Eine wiederholbare Wochenplanung aufbauen, die mir hilft, fokussiert zu bleiben',
    'Eine einfache Review-Routine etablieren, mit der ich erkenne, welche Arbeit wirklich nützlich ist',
    'Einen gesünderen Arbeitsrhythmus entwickeln, der auch in vollen Wochen funktioniert',
    'Mein Portfolio so überarbeiten, dass ich meine Arbeit wieder selbstbewusst zeigen kann',
    'Meinen nächsten Karriereschritt klären und definieren, wohin ich mich entwickeln möchte',
    'Ein klares Angebot für meine Arbeit entwickeln, das ich ohne langes Erklären beschreiben kann',
    'Eine Service- oder Produktidee mit echten Gesprächen und Feedback validieren',
    'Ein erstes sichtbares Signal rund um ein Thema aufbauen, das mir wichtig ist',
    'Meine Expertise in einen ersten Vortrag, Workshop oder ein Lernformat übersetzen',
    'Meine wichtigsten Workflows dokumentieren, damit wiederkehrende Arbeit leichter wird',
    'Meinen digitalen Arbeitsbereich so aufräumen, dass fokussiertes Arbeiten wieder leichter wird',
    'Eine realistische Finanzübersicht erstellen, die mir bessere Entscheidungen ermöglicht',
    'Einen Lernpfad erstellen, mit dem ich eine Fähigkeit spürbar weiterentwickle',
    'Meine verstreuten Notizen und Ideen in eine klare Richtung für die nächste Phase bringen',
    'Eine stärkere Grundlage für selbstständige Arbeit oder Freelancing schaffen',
    'Einen wiederkehrenden Arbeitsprozess so verbessern, dass er jede Woche Zeit spart',
    'Genug Nachweise meiner Arbeit sammeln, um meinen Wert klarer kommunizieren zu können',
    'Eine erste nutzbare Version eines Tools fertigstellen, das ein echtes Problem für mich löst',
    'Eine Content-Richtung entwickeln, die ich drei Monate realistisch durchhalten kann',
    'Ein wichtiges Netzwerk-, Kunden- oder Beziehungsthema spürbar voranbringen',
    'Meine Arbeit bewusster und weniger reaktiv organisieren',
    'An einen Punkt kommen, an dem ich klar entscheiden kann, was ich im nächsten Quartal weiterführe',
  ],
};

const getTypingDelay = (char: string): number => {
  const base = char === ' ' ? 9 : 12;
  const punctuationPause = /[.,:;]/.test(char) ? 30 : 0;
  return base + punctuationPause + Math.round(Math.random() * 18);
};

const FOCUS_WARNING_REVEAL_MS = 300;
const FOCUS_WARNING_ARROW_REVEAL_MS = 160;
const FOCUS_WARNING_ARROW_STAGGER_MS = 55;
const FOCUS_WARNING_MAX_ARROWS = 10;
const FOCUS_WARNING_ARROW_ENTRY_ROTATION_DEG = 35;
const FOCUS_WARNING_ARROW_ROTATION_DEGREES = 365;
const FOCUS_WARNING_FOCUSED_ARROW_COUNT = 3;
const FOCUS_WARNING_ARROW_SQUARE_SIZE = 4;
const FOCUS_WARNING_ARROW_GRID_STEP = 5;
const FOCUS_WARNING_ARROW_CANVAS_SIZE = 24;

const createFocusWarningArrowSquare = (id: string, axis: number, lane: number) => ({
  id,
  x: FOCUS_WARNING_ARROW_CANVAS_SIZE / 2 + axis * FOCUS_WARNING_ARROW_GRID_STEP - FOCUS_WARNING_ARROW_SQUARE_SIZE / 2,
  y: FOCUS_WARNING_ARROW_CANVAS_SIZE / 2 + lane * FOCUS_WARNING_ARROW_GRID_STEP - FOCUS_WARNING_ARROW_SQUARE_SIZE / 2,
});

const FOCUS_WARNING_ARROW_SQUARES = [
  createFocusWarningArrowSquare('tip', 2, 0),
  createFocusWarningArrowSquare('head-top', 1, -1),
  createFocusWarningArrowSquare('head-center', 1, 0),
  createFocusWarningArrowSquare('head-bottom', 1, 1),
  createFocusWarningArrowSquare('shaft-one', 0, 0),
  createFocusWarningArrowSquare('tail-one', -1, 0),
  createFocusWarningArrowSquare('tail-two', -2, 0),
];

const getFocusWarningArrowCount = (focusedCount: number) => Math.min(focusedCount, FOCUS_WARNING_MAX_ARROWS);

const createFocusWarningArrowRotation = () => Math.random() * FOCUS_WARNING_ARROW_ROTATION_DEGREES;

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    mediaQuery.addEventListener?.('change', updatePreference);
    return () => mediaQuery.removeEventListener?.('change', updatePreference);
  }, []);

  return prefersReducedMotion;
};

interface GoalsNavProps {
  activeTab: GoalsTab;
  onSelectTab: (tab: GoalsTab) => void;
}

const GoalsNav: React.FC<GoalsNavProps> = ({ activeTab, onSelectTab }) => {
  const { t } = useI18n();

  return (
    <SubSideMenu>
      <SubSideMenuButton
        isActive={activeTab === 'active'}
        onClick={() => onSelectTab('active')}
      >
        {t('goals.active')}
      </SubSideMenuButton>
      <SubSideMenuButton
        isActive={activeTab === 'history'}
        onClick={() => onSelectTab('history')}
      >
        {t('goals.history')}
      </SubSideMenuButton>
    </SubSideMenu>
  );
};

const useAnimatedGoalPlaceholder = () => {
  const { language } = useI18n();
  const examples = GOAL_EXAMPLES_BY_LANGUAGE[language];
  const timeoutRef = useRef<number | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [visibleText, setVisibleText] = useState(() => GOAL_EXAMPLES_BY_LANGUAGE[language][0].slice(0, 1));

  useEffect(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const example = examples[exampleIndex % examples.length];
    setVisibleText(example.slice(0, 1));

    let charIndex = 1;
    const typeNextChar = () => {
      charIndex += 1;
      setVisibleText(example.slice(0, charIndex));

      if (charIndex < example.length) {
        timeoutRef.current = window.setTimeout(
          typeNextChar,
          getTypingDelay(example[charIndex] || '')
        );
        return;
      }

      timeoutRef.current = window.setTimeout(() => {
        setExampleIndex(prev => (prev + 1) % examples.length);
      }, 3000);
    };

    timeoutRef.current = window.setTimeout(typeNextChar, 150);

    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [exampleIndex, examples]);

  return visibleText;
};

interface ActiveGoalsPanelProps {
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
  tasks: Task[];
  projects: Project[];
  onAddGoal: (title: string) => void;
  onToggleGoalFocus: (id: string) => void;
  onCompleteGoal: (id: string) => void;
  onUndoCompleteGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onDefineWeeklyGoal: (title: string) => string | null;
  onUpdateWeeklyGoal: (id: string, title: string) => void;
  onClearOpenWeeklyGoal: () => void;
  onDeleteWeeklyGoal: (id: string) => void;
  onCompleteWeeklyGoal: (id: string) => void;
  onUndoCompleteWeeklyGoal: (id: string) => void;
}

const getActiveBodyKey = (goalCount: number): TranslationKey => {
  if (goalCount === 0) return 'goals.emptyBody';
  if (goalCount < 3) return 'goals.collectingBody';
  if (goalCount === 3) return 'goals.threeBody';
  return 'goals.manyBody';
};

const FocusedGoalsWarningStyles: React.FC = () => (
  <style>{`
    @keyframes focus-warning-reveal {
      from {
        max-height: 0;
        opacity: 0;
        transform: scaleY(0.96);
      }
      to {
        max-height: 12rem;
        opacity: 1;
        transform: scaleY(1);
      }
    }

    @keyframes focus-warning-exit {
      from {
        max-height: 12rem;
        opacity: 1;
        transform: scaleY(1);
      }
      to {
        max-height: 0;
        opacity: 0;
        transform: scaleY(0.96);
      }
    }

    .focus-warning-reveal {
      animation: focus-warning-reveal ${FOCUS_WARNING_REVEAL_MS}ms ease-out both;
      transform-origin: top;
    }

    .focus-warning-exit {
      animation: focus-warning-exit ${FOCUS_WARNING_REVEAL_MS}ms ease-in both;
    }

    @media (prefers-reduced-motion: reduce) {
      .focus-warning-reveal,
      .focus-warning-exit {
        animation-duration: 1ms !important;
        transform: none !important;
      }
    }
  `}</style>
);

interface FocusWarningArrowProps {
  index: number;
  rotation: number;
  prefersReducedMotion: boolean;
}

const FocusWarningArrow: React.FC<FocusWarningArrowProps> = ({
  index,
  rotation,
  prefersReducedMotion,
}) => {
  const [visibility, setVisibility] = useState(() => (prefersReducedMotion ? 1 : 0));
  const isVisible = visibility === 1;
  const renderedRotation = isVisible ? rotation : rotation - FOCUS_WARNING_ARROW_ENTRY_ROTATION_DEG;
  const isFocusedArrow = index < FOCUS_WARNING_FOCUSED_ARROW_COUNT;

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibility(1);
      return;
    }

    setVisibility(0);
    const frame = window.requestAnimationFrame(() => setVisibility(1));
    return () => window.cancelAnimationFrame(frame);
  }, [prefersReducedMotion]);

  return (
    <div
      className="relative shrink-0"
      style={{
        width: `${FOCUS_WARNING_ARROW_CANVAS_SIZE}px`,
        height: `${FOCUS_WARNING_ARROW_CANVAS_SIZE}px`,
        opacity: visibility,
        transform: `rotate(${renderedRotation}deg) scale(${isVisible ? 1 : 0.82})`,
        transition: prefersReducedMotion
          ? 'none'
          : `opacity ${FOCUS_WARNING_ARROW_REVEAL_MS}ms cubic-bezier(0.2, 0, 0, 1), transform ${FOCUS_WARNING_ARROW_REVEAL_MS}ms cubic-bezier(0.2, 0, 0, 1)`,
        transitionDelay: prefersReducedMotion ? '0ms' : `${index * FOCUS_WARNING_ARROW_STAGGER_MS}ms`,
      }}
    >
      {FOCUS_WARNING_ARROW_SQUARES.map(square => (
        <div
          key={square.id}
          className={isFocusedArrow ? 'absolute bg-neutral-950 dark:bg-neutral-100' : 'absolute bg-neutral-300 dark:bg-neutral-700'}
          style={{
            left: `${square.x}px`,
            top: `${square.y}px`,
            width: `${FOCUS_WARNING_ARROW_SQUARE_SIZE}px`,
            height: `${FOCUS_WARNING_ARROW_SQUARE_SIZE}px`,
          }}
        />
      ))}
    </div>
  );
};

const FocusedGoalsWarning: React.FC<{ arrowCount: number; isExiting: boolean }> = ({ arrowCount, isExiting }) => {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const rotationsRef = useRef<number[]>([]);

  if (rotationsRef.current.length < arrowCount) {
    rotationsRef.current = [
      ...rotationsRef.current,
      ...Array.from(
        { length: arrowCount - rotationsRef.current.length },
        createFocusWarningArrowRotation
      ),
    ];
  } else if (rotationsRef.current.length > arrowCount) {
    rotationsRef.current = rotationsRef.current.slice(0, arrowCount);
  }

  const rotations = rotationsRef.current.slice(0, arrowCount);

  return (
    <div className={`focus-warning-reveal mb-4 overflow-hidden ${isExiting ? 'focus-warning-exit' : ''}`}>
      <FocusedGoalsWarningStyles />
      <div className="border border-neutral-200 bg-neutral-50 px-3 py-3 text-left dark:border-neutral-700 dark:bg-neutral-900/60">
        <div className="flex flex-col gap-3">
          <div className="flex shrink-0 flex-wrap items-center gap-0.5" aria-hidden="true">
            {rotations.map((rotation, index) => (
              <FocusWarningArrow
                key={`${index}-${rotation}`}
                index={index}
                rotation={rotation}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>
          <div className="min-w-0">
            <h4 className="text-base font-black leading-tight text-black dark:text-white">
              {t('goals.focusWarningTitle')}
            </h4>
            <p className="mt-1 text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
              {t('goals.focusWarningBody')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActiveGoalsPanel: React.FC<ActiveGoalsPanelProps> = ({
  goals,
  weeklyGoals,
  tasks,
  projects,
  onAddGoal,
  onToggleGoalFocus,
  onCompleteGoal,
  onUndoCompleteGoal,
  onDeleteGoal,
  onDefineWeeklyGoal,
  onUpdateWeeklyGoal,
  onClearOpenWeeklyGoal,
  onDeleteWeeklyGoal,
  onCompleteWeeklyGoal,
  onUndoCompleteWeeklyGoal,
}) => {
  const { language, locale, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const notificationTimerRef = useRef<number | null>(null);
  const goalElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousGoalRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const animatedPlaceholder = useAnimatedGoalPlaceholder();
  const [draftTitle, setDraftTitle] = useState('');
  const [celebratedTitle, setCelebratedTitle] = useState<string | null>(null);
  const [copyNotificationKey, setCopyNotificationKey] = useState<TranslationKey | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [shouldAnimateNotification, setShouldAnimateNotification] = useState(false);
  const [animationNotificationFinished, setAnimationNotificationFinished] = useState(false);
  const [undoableCompletedGoalIds, setUndoableCompletedGoalIds] = useState<Set<string>>(() => new Set());
  const [celebratingGoalId, setCelebratingGoalId] = useState<string | null>(null);

  const visibleGoals = useMemo(() => (
    goals
      .filter(goal => goal.completedAt == null || undoableCompletedGoalIds.has(goal.id))
      .sort((a, b) => {
        if ((a.completedAt == null) !== (b.completedAt == null)) return a.completedAt == null ? -1 : 1;
        if (a.isFocused !== b.isFocused) return a.isFocused ? -1 : 1;
        return a.createdAt - b.createdAt;
      })
  ), [goals, undoableCompletedGoalIds]);

  const openGoalCount = visibleGoals.filter(goal => goal.completedAt == null).length;
  const focusedCount = visibleGoals.filter(goal => goal.completedAt == null && goal.isFocused).length;
  const focusWarningArrowCount = getFocusWarningArrowCount(focusedCount);
  const showFocusWarning = focusedCount > 3;
  const statusBodyKey = getActiveBodyKey(openGoalCount);
  const [renderedFocusWarningCount, setRenderedFocusWarningCount] = useState(() => (showFocusWarning ? focusWarningArrowCount : 0));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => () => {
    if (celebrationTimerRef.current != null) {
      window.clearTimeout(celebrationTimerRef.current);
    }
    if (notificationTimerRef.current != null) {
      window.clearTimeout(notificationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!copyNotificationKey) {
      setAnimationNotificationFinished(false);
      setShouldAnimateNotification(false);
    }
  }, [copyNotificationKey]);

  useEffect(() => {
    if (showFocusWarning) {
      setRenderedFocusWarningCount(focusWarningArrowCount);
      return;
    }

    if (renderedFocusWarningCount <= 0) return;

    const timeout = window.setTimeout(() => setRenderedFocusWarningCount(0), FOCUS_WARNING_REVEAL_MS);
    return () => window.clearTimeout(timeout);
  }, [showFocusWarning, focusWarningArrowCount, renderedFocusWarningCount]);

  useLayoutEffect(() => {
    if (!copyNotificationKey || !shouldAnimateNotification || animationNotificationFinished || !notificationRef.current) return;

    const element = notificationRef.current;
    const fullHeight = element.scrollHeight;

    const animation = element.animate(
      [
        { height: '0px', opacity: 0 },
        { height: `${fullHeight}px`, opacity: 1 }
      ],
      {
        duration: 1000,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'both'
      }
    );

    animation.onfinish = () => {
      setAnimationNotificationFinished(true);
      setShouldAnimateNotification(false);
    };
  }, [copyNotificationKey, shouldAnimateNotification, animationNotificationFinished]);

  useLayoutEffect(() => {
    const previousRects = previousGoalRectsRef.current;
    const nextRects = new Map<string, DOMRect>();

    visibleGoals.forEach(goal => {
      const element = goalElementRefs.current.get(goal.id);
      if (!element) return;

      const nextRect = element.getBoundingClientRect();
      const previousRect = previousRects.get(goal.id);
      nextRects.set(goal.id, nextRect);

      if (!previousRect) return;

      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaY) < 1) return;

      element.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: 'translateY(0)' },
        ],
        {
          duration: 260,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
        }
      );
    });

    previousGoalRectsRef.current = nextRects;
  }, [visibleGoals]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) return;

    onAddGoal(trimmedTitle);
    setDraftTitle('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleCompleteGoal = (goal: Goal) => {
    if (goal.completedAt != null) {
      onUndoCompleteGoal(goal.id);
      setUndoableCompletedGoalIds(prev => {
        const next = new Set(prev);
        next.delete(goal.id);
        return next;
      });
      return;
    }

    onCompleteGoal(goal.id);
    setUndoableCompletedGoalIds(prev => new Set(prev).add(goal.id));
    setCelebratingGoalId(goal.id);

    if (celebrationTimerRef.current != null) {
      window.clearTimeout(celebrationTimerRef.current);
    }
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebratingGoalId(null);
      celebrationTimerRef.current = null;
    }, 4000);
  };

  const showCopyNotification = (key: TranslationKey) => {
    setCopyNotificationKey(key);
    setShouldAnimateNotification(true);
    setAnimationNotificationFinished(false);
    if (notificationTimerRef.current != null) {
      window.clearTimeout(notificationTimerRef.current);
    }
    notificationTimerRef.current = window.setTimeout(() => {
      setCopyNotificationKey(null);
      notificationTimerRef.current = null;
    }, 5000);
  };

  const handleDefineWithAi = async () => {
    const promptToCopy = buildDefineWithAiPrompt({
      language,
      locale,
      toneInstruction: t('goals.defineWithAiToneInstruction'),
      goals,
      weeklyGoals,
      tasks,
      projects,
    });

    try {
      await writeTextToClipboard(promptToCopy);
      showCopyNotification('goals.copiedToClipboard');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showCopyNotification('goals.copyFailed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-8 text-black dark:text-neutral-100">
      <div className="mb-10 border-b border-neutral-200 dark:border-neutral-700 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-4xl font-black tracking-tighter uppercase">{t('app.goals')}</h2>
          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0 relative">
            <button
              type="button"
              onClick={handleDefineWithAi}
              className="inline-flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-black dark:text-white transition-all select-none cursor-pointer focus:outline-none shrink-0 self-start sm:self-auto"
            >
              <IconWand className="h-4 w-4" />
              <span>
                {t('goals.defineWithAi')}
              </span>
            </button>
            {copyNotificationKey && (
              <div
                ref={notificationRef}
                style={
                  shouldAnimateNotification && !animationNotificationFinished
                    ? { overflow: 'hidden', height: 0, opacity: 0 }
                    : { overflow: 'hidden' }
                }
                className="w-full shrink-0 flex flex-col items-start sm:items-end"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {t(copyNotificationKey)}
                </span>
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {openGoalCount === 0
            ? `${t('goals.emptyTitle')} ${t(statusBodyKey)}`
            : t(statusBodyKey)}
        </p>
      </div>

      {celebratedTitle && (
        <div className="mb-6 border border-neutral-200 bg-black px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-sm dark:border-white dark:bg-white dark:text-black">
          {t('goals.celebration', { goal: celebratedTitle })}
        </div>
      )}

      <WeeklyGoalPanel
        openGoalCount={openGoalCount}
        weeklyGoals={weeklyGoals}
        onDefineWeeklyGoal={onDefineWeeklyGoal}
        onUpdateWeeklyGoal={onUpdateWeeklyGoal}
        onClearOpenWeeklyGoal={onClearOpenWeeklyGoal}
        onCompleteWeeklyGoal={onCompleteWeeklyGoal}
        onDeleteWeeklyGoal={onDeleteWeeklyGoal}
        onUndoCompleteWeeklyGoal={onUndoCompleteWeeklyGoal}
      />

      <form onSubmit={handleSubmit} className="mb-8">
        <label htmlFor="goal-title-input" className="mb-3 block text-xl font-black tracking-tighter uppercase">
          {t('goals.activeTitle')}
        </label>
        <div className="flex items-stretch gap-3">
          <input
            id="goal-title-input"
            ref={inputRef}
            type="text"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder={animatedPlaceholder}
            className="min-w-0 flex-1 border-0 border-b border-neutral-300 bg-transparent px-0 py-3 text-lg font-bold text-black transition-colors placeholder:text-neutral-400 focus:outline-none focus:border-black dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-white"
          />
          <button
            type="submit"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-200 bg-black text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-900 dark:hover:text-white dark:disabled:border-neutral-700 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
            title={t('goals.addGoal')}
            aria-label={t('goals.addGoal')}
            disabled={!draftTitle.trim()}
          >
            <IconPlus className="h-5 w-5" />
          </button>
        </div>
      </form>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
          {t('goals.goalsCount', {
            count: openGoalCount,
            goalLabel: t(openGoalCount === 1 ? 'goals.goalSingular' : 'goals.goalPlural'),
          })}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
          {focusedCount} {t('goals.focused')}
        </div>
      </div>

      {renderedFocusWarningCount > 0 && (
        <FocusedGoalsWarning
          arrowCount={renderedFocusWarningCount}
          isExiting={!showFocusWarning}
        />
      )}

      {visibleGoals.length > 0 && (
        <div className="border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm ">
          {visibleGoals.map(goal => (
            <ThreeMonthGoalRow
              key={goal.id}
              goal={goal}
              isCelebrating={celebratingGoalId === goal.id}
              registerElement={(element) => {
                  if (element) {
                    goalElementRefs.current.set(goal.id, element);
                    return;
                  }
                  goalElementRefs.current.delete(goal.id);
              }}
              onToggleComplete={() => handleCompleteGoal(goal)}
              onToggleFocus={() => onToggleGoalFocus(goal.id)}
              onDelete={() => onDeleteGoal(goal.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface GoalsHistoryPanelProps {
  goals: Goal[];
  weeklyGoals: WeeklyGoal[];
  onDeleteGoal: (id: string) => void;
  onDeleteWeeklyGoal: (id: string) => void;
}

const GoalsHistoryPanel: React.FC<GoalsHistoryPanelProps> = ({ goals, weeklyGoals, onDeleteGoal, onDeleteWeeklyGoal }) => {
  const { language, locale, t } = useI18n();
  const [confirmingGoalId, setConfirmingGoalId] = useState<string | null>(null);

  const historyGroups = useMemo<GoalHistoryGroup[]>(() => {
    const grouped = new Map<string, GoalHistoryGroup>();

    const completedThreeMonthGoals: GoalHistoryItem[] = goals
      .filter(goal => goal.completedAt != null)
      .map(goal => ({
        type: 'three-month' as const,
        goal,
        timestamp: goal.completedAt ?? goal.updatedAt,
      }));
    const completedWeeklyGoals: GoalHistoryItem[] = weeklyGoals
      .filter(goal => goal.completedAt != null)
      .map(goal => ({
        type: 'weekly' as const,
        goal,
        timestamp: goal.completedAt ?? goal.updatedAt,
      }));

    [...completedThreeMonthGoals, ...completedWeeklyGoals]
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(item => {
        const group = getReflectionHistoryGroup(item.timestamp, language);
        const existing = grouped.get(group.key);

        if (existing) {
          existing.items.push(item);
          return;
        }

        grouped.set(group.key, {
          key: group.key,
          label: group.label,
          order: group.order,
          items: [item],
        });
      });

    return Array.from(grouped.values()).sort((a, b) => b.order - a.order);
  }, [goals, language, weeklyGoals]);

  const formatCompletedDate = (timestamp: number) => (
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(timestamp))
  );

  if (historyGroups.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 text-center animate-in fade-in duration-500 text-black dark:text-neutral-100">
        <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase">{t('goals.noHistory')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
          {t('goals.noHistoryBody')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-8 text-black dark:text-neutral-100">
      <div className="mb-10 border-b border-neutral-200 dark:border-neutral-700 pb-4">
        <h2 className="text-4xl font-black tracking-tighter uppercase">{t('goals.historyTitle')}</h2>
        <p className="mt-3 text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {t('goals.historyBody')}
        </p>
      </div>

      {historyGroups.map(group => (
        <section key={group.key} className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
              {group.label}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              {t('goals.goalsCount', {
                count: group.items.length,
                goalLabel: t(group.items.length === 1 ? 'goals.goalSingular' : 'goals.goalPlural'),
              })}
            </span>
          </div>

          <div className="border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm ">
            {group.items.map(item => {
              const isWeekly = item.type === 'weekly';
              const isConfirming = confirmingGoalId === `${item.type}:${item.goal.id}`;

              return (
                <div
                  key={`${item.type}:${item.goal.id}`}
                  className="group flex flex-col gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 dark:border-neutral-800 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    {isWeekly && (
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500">
                        {t('goals.weeklyHistoryLabel')}
                      </div>
                    )}
                    <h4 className="font-bold leading-tight text-black dark:text-neutral-100">
                      {item.goal.title}
                    </h4>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                      {formatCompletedDate(item.timestamp)}
                    </div>
                  </div>

                  {isConfirming ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-300">
                        {t('goals.confirmDelete')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmingGoalId(null)}
                        className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800"
                      >
                        {t('task.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          item.type === 'weekly' ? onDeleteWeeklyGoal(item.goal.id) : onDeleteGoal(item.goal.id);
                          setConfirmingGoalId(null);
                        }}
                        className="border border-red-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-900/20"
                      >
                        {t('goals.deleteForever')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingGoalId(`${item.type}:${item.goal.id}`)}
                      className="self-start p-2 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-300 md:self-center"
                      title={t('goals.deleteGoal')}
                      aria-label={t('goals.deleteGoal')}
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  weeklyGoals,
  tasks,
  projects,
  onAddGoal,
  onToggleGoalFocus,
  onCompleteGoal,
  onUndoCompleteGoal,
  onDeleteGoal,
  onDefineWeeklyGoal,
  onUpdateWeeklyGoal,
  onClearOpenWeeklyGoal,
  onDeleteWeeklyGoal,
  onCompleteWeeklyGoal,
  onUndoCompleteWeeklyGoal,
}) => {
  const [activeTab, setActiveTab] = useState<GoalsTab>('active');

  return (
    <div className="flex h-full w-full flex-row animate-in slide-in-from-bottom-8 duration-500 text-black dark:text-neutral-100 bg-transparent">
      <GoalsNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'active' ? (
            <ActiveGoalsPanel
              goals={goals}
              weeklyGoals={weeklyGoals}
              tasks={tasks}
              projects={projects}
              onAddGoal={onAddGoal}
              onToggleGoalFocus={onToggleGoalFocus}
              onCompleteGoal={onCompleteGoal}
              onUndoCompleteGoal={onUndoCompleteGoal}
              onDeleteGoal={onDeleteGoal}
              onDefineWeeklyGoal={onDefineWeeklyGoal}
              onUpdateWeeklyGoal={onUpdateWeeklyGoal}
              onClearOpenWeeklyGoal={onClearOpenWeeklyGoal}
              onDeleteWeeklyGoal={onDeleteWeeklyGoal}
              onCompleteWeeklyGoal={onCompleteWeeklyGoal}
              onUndoCompleteWeeklyGoal={onUndoCompleteWeeklyGoal}
            />
          ) : (
            <GoalsHistoryPanel
              goals={goals}
              weeklyGoals={weeklyGoals}
              onDeleteGoal={onDeleteGoal}
              onDeleteWeeklyGoal={onDeleteWeeklyGoal}
            />
          )}
        </div>
      </div>
    </div>
  );
};
