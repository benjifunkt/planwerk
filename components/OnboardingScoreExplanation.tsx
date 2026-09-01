import React from 'react';
import { getPriorityLabelKey, TranslationKey, useI18n } from '../i18n';
import { Priority } from '../types';
import { PrimaryButton, TertiaryButton } from './Buttons';

interface OnboardingScoreExplanationProps {
  isOpen: boolean;
  onBack: () => void;
  onContinue: () => void;
}

interface ScoreSelection {
  priority: Priority;
  urgency: number;
}

const PRIORITIES: Priority[] = [
  Priority.Marginal,
  Priority.Helpful,
  Priority.Important,
  Priority.Necessary,
  Priority.Critical,
];

const URGENCIES = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

const urgencyLabelKeys: Record<number, TranslationKey> = {
  9: 'welcome.scoreDetailsUrgency9',
  8: 'welcome.scoreDetailsUrgency8',
  7: 'welcome.scoreDetailsUrgency7',
  6: 'welcome.scoreDetailsUrgency6',
  5: 'welcome.scoreDetailsUrgency5',
  4: 'welcome.scoreDetailsUrgency4',
  3: 'welcome.scoreDetailsUrgency3',
  2: 'welcome.scoreDetailsUrgency2',
  1: 'welcome.scoreDetailsUrgency1',
};

const DEFAULT_SELECTION: ScoreSelection = {
  priority: Priority.Critical,
  urgency: 9,
};

const isSameSelection = (a: ScoreSelection, b: ScoreSelection) => (
  a.priority === b.priority && a.urgency === b.urgency
);

const getCellKey = ({ priority, urgency }: ScoreSelection) => `${priority}-${urgency}`;

export const OnboardingScoreExplanation: React.FC<OnboardingScoreExplanationProps> = ({
  isOpen,
  onBack,
  onContinue,
}) => {
  const { t } = useI18n();
  const [pinnedSelection, setPinnedSelection] = React.useState<ScoreSelection>(DEFAULT_SELECTION);
  const [previewSelection, setPreviewSelection] = React.useState<ScoreSelection | null>(null);
  const [rovingSelection, setRovingSelection] = React.useState<ScoreSelection>(DEFAULT_SELECTION);
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const cellRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const activeSelection = previewSelection ?? pinnedSelection;
  const activePriorityLabel = t(getPriorityLabelKey(activeSelection.priority));
  const activeUrgencyLabel = t(urgencyLabelKeys[activeSelection.urgency]);
  const activeScore = activeSelection.priority * activeSelection.urgency;

  React.useEffect(() => {
    if (isOpen) headingRef.current?.focus();
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onBack();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onBack]);

  const focusCell = React.useCallback((selection: ScoreSelection) => {
    setRovingSelection(selection);
    window.requestAnimationFrame(() => {
      cellRefs.current[getCellKey(selection)]?.focus();
    });
  }, []);

  const handleCellKeyDown = React.useCallback((
    event: React.KeyboardEvent<HTMLButtonElement>,
    selection: ScoreSelection
  ) => {
    const priorityIndex = PRIORITIES.indexOf(selection.priority);
    const urgencyIndex = URGENCIES.indexOf(selection.urgency as typeof URGENCIES[number]);
    let nextPriorityIndex = priorityIndex;
    let nextUrgencyIndex = urgencyIndex;

    if (event.key === 'ArrowLeft') nextPriorityIndex = Math.max(0, priorityIndex - 1);
    else if (event.key === 'ArrowRight') nextPriorityIndex = Math.min(PRIORITIES.length - 1, priorityIndex + 1);
    else if (event.key === 'ArrowUp') nextUrgencyIndex = Math.max(0, urgencyIndex - 1);
    else if (event.key === 'ArrowDown') nextUrgencyIndex = Math.min(URGENCIES.length - 1, urgencyIndex + 1);
    else return;

    event.preventDefault();
    focusCell({
      priority: PRIORITIES[nextPriorityIndex],
      urgency: URGENCIES[nextUrgencyIndex],
    });
  }, [focusCell]);

  return (
    <section className="create-task-copy-fade w-full max-w-5xl py-4" aria-labelledby="score-details-title">
      <div className="mx-auto max-w-3xl text-center">
        <h1
          ref={headingRef}
          id="score-details-title"
          tabIndex={-1}
          className="text-4xl font-black leading-none tracking-tight outline-none sm:text-5xl"
        >
          {t('welcome.scoreDetailsTitle')}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
          {t('welcome.scoreDetailsBody')}
        </p>
      </div>

      <div className="mx-auto mt-7 max-w-4xl">
        <div
          className="border-y border-neutral-200 py-4 dark:border-neutral-700"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="text-center text-base font-black tracking-tight sm:text-xl">
            {t('welcome.scoreDetailsSelection', {
              priorityLabel: activePriorityLabel,
              priority: activeSelection.priority,
              urgencyLabel: activeUrgencyLabel,
              urgency: activeSelection.urgency,
              score: activeScore,
            })}
          </p>
        </div>

        <div className="mt-5 overflow-x-auto pb-1">
          <p className="mb-2 ml-12 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 sm:ml-36 sm:text-[10px] dark:text-neutral-500">
            {t('welcome.scoreDetailsPriorityAxis')}
          </p>
          <div
            role="grid"
            aria-label={t('welcome.scoreDetailsMatrixAria')}
            className="min-w-[278px] space-y-1.5"
            onMouseLeave={() => setPreviewSelection(null)}
          >
            <div
              role="row"
              className="grid grid-cols-[3rem_repeat(5,minmax(44px,1fr))] gap-1.5 sm:grid-cols-[9rem_repeat(5,minmax(44px,1fr))]"
            >
              <div
                role="columnheader"
                className="flex min-h-11 items-end pb-2 text-[9px] font-bold uppercase leading-tight tracking-[0.12em] text-neutral-400 sm:text-[10px]"
              >
                {t('welcome.scoreDetailsUrgencyAxis')}
              </div>
              {PRIORITIES.map((priority) => {
                const isActiveColumn = activeSelection.priority === priority;
                return (
                  <div
                    key={priority}
                    role="columnheader"
                    aria-label={`${priority} – ${t(getPriorityLabelKey(priority))}`}
                    className={`flex min-h-11 flex-col items-center justify-end pb-2 text-center transition-colors ${
                      isActiveColumn ? 'text-black dark:text-white' : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    <span className="text-base font-black leading-none">{priority}</span>
                    <span className="mt-1 hidden max-w-full truncate text-[9px] font-semibold uppercase tracking-wider sm:block">
                      {t(getPriorityLabelKey(priority))}
                    </span>
                  </div>
                );
              })}
            </div>

            {URGENCIES.map((urgency) => {
              const isActiveRow = activeSelection.urgency === urgency;
              return (
                <div
                  key={urgency}
                  role="row"
                  className="grid grid-cols-[3rem_repeat(5,minmax(44px,1fr))] gap-1.5 sm:grid-cols-[9rem_repeat(5,minmax(44px,1fr))]"
                >
                  <div
                    role="rowheader"
                    aria-label={`${urgency} – ${t(urgencyLabelKeys[urgency])}`}
                    className={`flex min-h-11 items-center gap-2 pr-1 transition-colors sm:pr-3 ${
                      isActiveRow ? 'text-black dark:text-white' : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    <span className="w-full text-center text-base font-black sm:w-5 sm:text-left">{urgency}</span>
                    <span className="hidden min-w-0 text-[9px] font-semibold uppercase leading-tight tracking-wider sm:block">
                      {t(urgencyLabelKeys[urgency])}
                    </span>
                  </div>

                  {PRIORITIES.map((priority) => {
                    const selection = { priority, urgency };
                    const isPinned = isSameSelection(selection, pinnedSelection);
                    const isActive = isSameSelection(selection, activeSelection);
                    const isRoving = isSameSelection(selection, rovingSelection);
                    const score = priority * urgency;
                    const priorityLabel = t(getPriorityLabelKey(priority));
                    const urgencyLabel = t(urgencyLabelKeys[urgency]);

                    return (
                      <button
                        key={priority}
                        ref={(element) => {
                          cellRefs.current[getCellKey(selection)] = element;
                        }}
                        type="button"
                        role="gridcell"
                        tabIndex={isRoving ? 0 : -1}
                        aria-selected={isPinned}
                        aria-label={t('welcome.scoreDetailsCellAria', {
                          priorityLabel,
                          priority,
                          urgencyLabel,
                          urgency,
                          score,
                        })}
                        onMouseMove={() => {
                          if (!isSameSelection(selection, previewSelection ?? pinnedSelection)) {
                            setPreviewSelection(selection);
                          }
                        }}
                        onFocus={() => {
                          setRovingSelection(selection);
                          setPreviewSelection(selection);
                        }}
                        onBlur={() => setPreviewSelection(null)}
                        onClick={() => {
                          setPinnedSelection(selection);
                          setRovingSelection(selection);
                          setPreviewSelection(selection);
                        }}
                        onKeyDown={(event) => handleCellKeyDown(event, selection)}
                        className={`min-h-11 border text-sm font-semibold outline-none transition-[background-color,border-color,color] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-neutral-900 ${
                          isPinned
                            ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                            : isActive
                              ? 'border-black bg-neutral-100 text-black dark:border-white dark:bg-neutral-800 dark:text-white'
                              : 'border-neutral-200 bg-neutral-100/70 text-neutral-500 hover:border-neutral-400 hover:text-black dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-white'
                        }`}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
        {t('welcome.scoreDetailsTakeaway')}
      </p>

      <div className="mt-7 flex flex-col-reverse items-stretch justify-center gap-2 sm:flex-row sm:items-center">
        <TertiaryButton onClick={onBack} className="sm:min-w-32">
          {t('welcome.scoreDetailsBack')}
        </TertiaryButton>
        <PrimaryButton onClick={onContinue} className="!px-6 !py-2 text-xs sm:min-w-32">
          {t('welcome.continueToBoard')}
        </PrimaryButton>
      </div>
    </section>
  );
};
