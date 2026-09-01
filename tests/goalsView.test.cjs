const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const readSource = (relativePath) => (
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
);

test('goal placeholder keeps animated example text between rotations', () => {
  const source = readSource('components/GoalsView.tsx');

  assert.match(source, /useState\(\(\) => GOAL_EXAMPLES_BY_LANGUAGE\[language\]\[0\]\.slice\(0, 1\)\)/);
  assert.match(source, /}, 3000\)/);
  assert.doesNotMatch(source, /placeholder=\{animatedPlaceholder \|\| t\('goals\.inputPlaceholder'\)\}/);
});

test('goal row focus area does not draw a ring on click', () => {
  const source = readSource('components/GoalRows.tsx');

  assert.match(source, /focus-visible:outline-none/);
  assert.doesNotMatch(source, /focus:ring-2 focus:ring-black/);
});

test('weekly goal UI is rendered above the 3-month goal UI', () => {
  const source = readSource('components/GoalsView.tsx');

  const weeklyGoalIndex = source.indexOf('<WeeklyGoalPanel');
  const threeMonthGoalIndex = source.indexOf("t('goals.activeTitle')");

  assert.notEqual(weeklyGoalIndex, -1);
  assert.notEqual(threeMonthGoalIndex, -1);
  assert.ok(weeklyGoalIndex < threeMonthGoalIndex);
});

test('weekly goal composer uses a one-time mount baseline and then waits for three goals', () => {
  const source = readSource('components/WeeklyGoalPanel.tsx');

  assert.match(source, /const initialShouldShowWeeklyComposerRef = useRef\(openGoalCount > 0 \|\| Boolean\(activeWeeklyGoal\)\)/);
  assert.match(source, /useState\(\(\) => initialShouldShowWeeklyComposerRef\.current\)/);
  assert.match(source, /!initialShouldShowWeeklyComposerRef\.current && openGoalCount >= 3/);
  assert.doesNotMatch(source, /const hasAnyOpenGoal = openGoalCount > 0;/);
  assert.doesNotMatch(source, /const shouldRender = hasAnyOpenGoal \|\|/);
});

test('weekly goal field saves on blur without a plus submit button', () => {
  const source = readSource('components/WeeklyGoalPanel.tsx');

  assert.match(source, /onBlur=\{handleWeeklyGoalBlur\}/);
  assert.match(source, /onUpdateWeeklyGoal/);
  assert.match(source, /onClearOpenWeeklyGoal/);
  assert.match(source, /disabled=\{!canCompleteWeeklyGoal \|\| isCelebrating\}/);
  assert.doesNotMatch(source, /title=\{t\('goals\.defineWeeklyGoal'\)\}/);
  assert.doesNotMatch(source, /<div className="mt-1 text-\[10px\] font-bold uppercase tracking-\[0\.2em\] text-neutral-400 dark:text-neutral-500">\s*\{t\('goals\.weeklyTitle'\)\}\s*<\/div>/);
});

test('weekly goal field saves on Enter and shows localized saved feedback', () => {
  const source = readSource('components/WeeklyGoalPanel.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /const \[showSavedFeedback, setShowSavedFeedback\] = useState\(false\)/);
  assert.match(source, /savedFeedbackTimerRef/);
  assert.match(source, /const saveWeeklyGoalDraft = \(\): boolean => \{/);
  assert.match(source, /onKeyDown=\{handleWeeklyGoalKeyDown\}/);
  assert.match(source, /event\.key !== 'Enter'/);
  assert.match(source, /t\('goals\.saved'\)/);
  assert.match(i18nSource, /'goals\.saved': 'saved'/);
  assert.match(i18nSource, /'goals\.saved': 'gespeichert'/);
});

test('goal completion hover width follows localized label text', () => {
  const rowsSource = readSource('components/GoalRows.tsx');
  const goalsSource = readSource('components/GoalsView.tsx');
  const weeklyGoalPanelSource = readSource('components/WeeklyGoalPanel.tsx');
  const combinedSource = `${rowsSource}\n${goalsSource}\n${weeklyGoalPanelSource}`;

  assert.doesNotMatch(combinedSource, /hover:w-\[182px\]/);
  assert.doesNotMatch(combinedSource, /style=\{\{ width: '180px' \}\}/);
  assert.match(rowsSource, /w-max max-w-\[68px\] hover:max-w-\[220px\]/);
  assert.match(weeklyGoalPanelSource, /w-max max-w-\[68px\] hover:max-w-\[220px\]/);
});

test('weekly goal completion offers a tertiary define-new action', () => {
  const source = readSource('components/WeeklyGoalPanel.tsx');
  const buttonSource = readSource('components/Buttons.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /goals\.defineNewWeeklyGoal/);
  assert.match(source, /onStartNewWeeklyGoal/);
  assert.match(source, /TertiaryButton/);
  assert.match(buttonSource, /tracking-\[0\.18em\]/);
  assert.match(source, /canStartNewWeeklyGoal && \(/);
  assert.match(i18nSource, /'goals\.defineNewWeeklyGoal': 'Define a new weekly goal now'/);
  assert.match(i18nSource, /'goals\.defineNewWeeklyGoal': 'Jetzt ein neues Wochenziel definieren'/);
});

test('goal completion persists immediately and only clears celebration after animation', () => {
  const source = readSource('components/GoalsView.tsx');
  const weeklyGoalPanelSource = readSource('components/WeeklyGoalPanel.tsx');

  assert.match(weeklyGoalPanelSource, /onCompleteWeeklyGoal\(goalId\);\s+setIsCelebrating\(true\);/);
  assert.match(weeklyGoalPanelSource, /revealNewGoalTimerRef\.current = window\.setTimeout\(\(\) => \{\s+setCompletedWeeklyGoalId\(goalId\);/);
  assert.doesNotMatch(weeklyGoalPanelSource, /window\.setTimeout\(\(\) => \{\s+onCompleteWeeklyGoal\(goalId\);/);

  assert.match(source, /onCompleteGoal\(goal\.id\);\s+setUndoableCompletedGoalIds\(prev => new Set\(prev\)\.add\(goal\.id\)\);\s+setCelebratingGoalId\(goal\.id\);/);
  assert.match(source, /celebrationTimerRef\.current = window\.setTimeout\(\(\) => \{\s+setCelebratingGoalId\(null\);/);
  assert.doesNotMatch(source, /window\.setTimeout\(\(\) => \{\s+onCompleteGoal\(goal\.id\);/);
});

test('focused goals warning uses compact animated arrow guidance', () => {
  const source = readSource('components/GoalsView.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /const FOCUS_WARNING_REVEAL_MS = 300/);
  assert.match(source, /const FOCUS_WARNING_ARROW_REVEAL_MS = 160/);
  assert.match(source, /const FOCUS_WARNING_ARROW_STAGGER_MS = 55/);
  assert.match(source, /const FOCUS_WARNING_MAX_ARROWS = 10/);
  assert.match(source, /const FOCUS_WARNING_ARROW_ENTRY_ROTATION_DEG = 35/);
  assert.match(source, /const FOCUS_WARNING_ARROW_ROTATION_DEGREES = 365/);
  assert.match(source, /const FOCUS_WARNING_FOCUSED_ARROW_COUNT = 3/);
  assert.match(source, /const getFocusWarningArrowCount = \(focusedCount: number\) => Math\.min\(focusedCount, FOCUS_WARNING_MAX_ARROWS\)/);
  assert.match(source, /const createFocusWarningArrowRotation = \(\) => Math\.random\(\) \* FOCUS_WARNING_ARROW_ROTATION_DEGREES/);
  assert.doesNotMatch(source, /FOCUS_WARNING_ARROW_DIRECTIONS/);
  assert.match(source, /const FOCUS_WARNING_ARROW_SQUARES/);
  assert.match(source, /usePrefersReducedMotion/);
  assert.match(source, /prefersReducedMotion \? 1 : 0/);
  assert.match(source, /transitionDelay: prefersReducedMotion \? '0ms' : `\$\{index \* FOCUS_WARNING_ARROW_STAGGER_MS\}ms`/);
  assert.match(source, /const renderedRotation = isVisible \? rotation : rotation - FOCUS_WARNING_ARROW_ENTRY_ROTATION_DEG/);
  assert.match(source, /const isFocusedArrow = index < FOCUS_WARNING_FOCUSED_ARROW_COUNT/);
  assert.match(source, /isFocusedArrow \? 'absolute bg-neutral-950 dark:bg-neutral-100' : 'absolute bg-neutral-300 dark:bg-neutral-700'/);
  assert.match(source, /transform: `rotate\(\$\{renderedRotation\}deg\) scale\(\$\{isVisible \? 1 : 0\.82\}\)`/);
  assert.match(source, /renderedFocusWarningCount/);
  assert.match(source, /const showFocusWarning = focusedCount > 3/);
  assert.match(source, /const focusWarningArrowCount = getFocusWarningArrowCount\(focusedCount\)/);
  assert.match(source, /useState\(\(\) => \(showFocusWarning \? focusWarningArrowCount : 0\)\)/);
  assert.match(source, /setRenderedFocusWarningCount\(focusWarningArrowCount\)/);
  assert.match(source, /window\.setTimeout\(\(\) => setRenderedFocusWarningCount\(0\), FOCUS_WARNING_REVEAL_MS\)/);
  assert.match(source, /isExiting=\{!showFocusWarning\}/);
  assert.match(source, /<FocusedGoalsWarning/);
  assert.match(source, /arrowCount=\{renderedFocusWarningCount\}/);
  assert.match(source, /t\('goals\.focusWarningTitle'\)/);
  assert.match(source, /t\('goals\.focusWarningBody'\)/);
  assert.doesNotMatch(source, /t\('goals\.focusWarning'\)/);
  assert.match(source, /className="flex flex-col gap-3"/);
  assert.match(source, /className="flex shrink-0 flex-wrap items-center gap-0\.5"/);
  assert.doesNotMatch(source, /className="flex flex-col gap-3 sm:flex-row sm:items-center"/);

  assert.match(i18nSource, /'goals\.focusWarningTitle': 'Stay focused!'/);
  assert.match(i18nSource, /'goals\.focusWarningBody': 'Focus on no more than 3 goals\.'/);
  assert.match(i18nSource, /'goals\.focusWarningTitle': 'Bleib fokussiert!'/);
  assert.match(i18nSource, /'goals\.focusWarningBody': 'Fokussiere dich auf nicht mehr als 3 Ziele\.'/);
  assert.doesNotMatch(i18nSource, /More than three goals are focused/);
  assert.doesNotMatch(i18nSource, /Mehr als drei Ziele sind fokussiert/);
});

test('goal rows are extracted and reused by goals and reflection views', () => {
  const rowsSource = readSource('components/GoalRows.tsx');
  const goalsSource = readSource('components/GoalsView.tsx');
  const reflectionSource = readSource('components/ReflectionView.tsx');
  const weeklyGoalPanelSource = readSource('components/WeeklyGoalPanel.tsx');
  const cssSource = readSource('index.css');

  assert.match(rowsSource, /export const ThreeMonthGoalRow/);
  assert.match(rowsSource, /export const WeeklyGoalRow/);
  assert.match(cssSource, /@keyframes goal-celebrate-expand/);
  assert.match(cssSource, /@keyframes weekly-goal-celebrate-expand/);
  assert.match(goalsSource, /<ThreeMonthGoalRow/);
  assert.match(goalsSource, /<WeeklyGoalPanel/);
  assert.match(weeklyGoalPanelSource, /<WeeklyGoalRow/);
  assert.match(reflectionSource, /<ThreeMonthGoalRow/);
  assert.match(reflectionSource, /<WeeklyGoalRow/);
  assert.match(reflectionSource, /<WeeklyGoalPanel/);
});

test('goal and weekly goal rows use the lighter row border system', () => {
  const rowsSource = readSource('components/GoalRows.tsx');
  const weeklyGoalPanelSource = readSource('components/WeeklyGoalPanel.tsx');

  assert.match(rowsSource, /border-b border-neutral-200/);
  assert.match(rowsSource, /items-stretch gap-3 border px-3 py-3 shadow-sm/);
  assert.match(weeklyGoalPanelSource, /items-stretch gap-3 border px-3 py-3 shadow-sm/);
  assert.match(rowsSource, /border-r transition-all/);
  assert.match(weeklyGoalPanelSource, /border-r transition-all/);
  assert.doesNotMatch(rowsSource, /border-2/);
  assert.doesNotMatch(weeklyGoalPanelSource, /border-2/);
  assert.doesNotMatch(rowsSource, /border-r-2/);
  assert.doesNotMatch(weeklyGoalPanelSource, /border-r-2/);
});

test('views with a sub side menu keep the menu flush left instead of centering the whole layout', () => {
  const goalsSource = readSource('components/GoalsView.tsx');
  const reflectionSource = readSource('components/ReflectionView.tsx');

  assert.doesNotMatch(goalsSource, /flex h-full w-full max-w-7xl mx-auto flex-row/);
  assert.doesNotMatch(reflectionSource, /flex h-full w-full max-w-7xl mx-auto flex-row/);
  assert.match(goalsSource, /flex h-full w-full flex-row/);
  assert.match(reflectionSource, /flex h-full w-full flex-row/);
});

test('reflection goal check receives active goals and cannot delete them', () => {
  const appSource = readSource('App.tsx');
  const reflectionSource = readSource('components/ReflectionView.tsx');

  assert.match(appSource, /goals=\{state\.goals\}/);
  assert.match(appSource, /weeklyGoals=\{state\.weeklyGoals\}/);
  assert.match(appSource, /onNavigateToGoals=\{\(\) => handleNavigateToView\('goals', 'goals'\)\}/);
  assert.match(reflectionSource, /reflection\.goalCheckTitle/);
  assert.match(reflectionSource, /reflection\.changeGoals/);
  assert.match(reflectionSource, /reflection\.continue/);
  assert.doesNotMatch(reflectionSource, /onDelete=\{/);
});

test('reflection goals sit at the bottom in one scrollable block', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');
  const contentIndex = reflectionSource.indexOf('className="min-h-0 flex-1 overflow-y-auto"');
  const goalsIndex = reflectionSource.indexOf('mt-8 max-h-[calc(25%_-_2rem)]');

  assert.match(reflectionSource, /const activeWeeklyGoal = weeklyGoals\.find\(goal => goal\.completedAt == null\) \?\? null/);
  assert.match(reflectionSource, /const activeThreeMonthGoals = goals/);
  assert.match(reflectionSource, /\.filter\(goal => goal\.completedAt == null && goal\.isFocused\)/);
  assert.match(reflectionSource, /const hasReflectionGoalHeader = Boolean\(activeWeeklyGoal\) \|\| activeThreeMonthGoals\.length > 0/);
  assert.notEqual(contentIndex, -1);
  assert.notEqual(goalsIndex, -1);
  assert.ok(contentIndex < goalsIndex);
  assert.match(reflectionSource, /mt-8 max-h-\[calc\(25%_-_2rem\)\]/);
  assert.match(reflectionSource, /overflow-y-auto/);
  assert.match(reflectionSource, /t\('goals\.weeklyTitle'\)/);
  assert.match(reflectionSource, /t\('goals\.activeTitle'\)/);
  assert.match(reflectionSource, /text-neutral-500 dark:text-neutral-400/);
  assert.doesNotMatch(reflectionSource, /t\('reflection\.goal'/);
});

test('active reflection view removes the top separator progress bar', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');

  assert.doesNotMatch(reflectionSource, /mb-10 h-1 w-full bg-neutral-200 dark:bg-neutral-800/);
  assert.doesNotMatch(reflectionSource, /const progress = initialCount === 0 \? 0 : \(currentIndex \/ initialCount\) \* 100/);
  assert.doesNotMatch(reflectionSource, /max-w-4xl mx-auto px-1 pb-8/);
  assert.match(reflectionSource, /max-w-4xl mx-auto px-1 text-black/);
});

test('german analytics tab is labeled Rückblick', () => {
  const i18nSource = readSource('i18n.tsx');

  assert.match(i18nSource, /'app\.charts': 'Rückblick'/);
  assert.match(i18nSource, /'analytics\.title': 'Rückblick'/);
  assert.doesNotMatch(i18nSource, /'app\.charts': 'Auswertung'/);
  assert.doesNotMatch(i18nSource, /'analytics\.title': 'Auswertung'/);
});

test('english analytics tab is labeled Lookback', () => {
  const i18nSource = readSource('i18n.tsx');

  assert.match(i18nSource, /'app\.charts': 'Lookback'/);
  assert.match(i18nSource, /'analytics\.title': 'Lookback'/);
  assert.doesNotMatch(i18nSource, /'app\.charts': 'Charts'/);
  assert.doesNotMatch(i18nSource, /'analytics\.title': 'Analytics'/);
});

test('board weekly goal preview truncates after 200 characters and keeps full tooltip', () => {
  const source = readSource('components/ColumnView.tsx');

  assert.match(source, /const getWeeklyGoalPreview = \(title: string\) => \(/);
  assert.match(source, /title\.length > 200/);
  assert.match(source, /title\.slice\(0, 200\)\.trimEnd\(\) \+ '\.\.\.'/);
  assert.match(source, /const weeklyGoalPreview = activeWeeklyGoal \? getWeeklyGoalPreview\(activeWeeklyGoal\.title\) : ''/);
  assert.match(source, /title=\{activeWeeklyGoal\.title\}/);
  assert.match(source, /\{weeklyGoalPreview\}/);
  assert.doesNotMatch(source, />\s*\{activeWeeklyGoal\.title\}\s*<\/h4>/);
});

test('reflection goal check handles empty and partially defined goals', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(reflectionSource, /if \(!hasVisibleGoals\)/);
  assert.match(reflectionSource, /const hasVisibleWeeklyGoal = visibleWeeklyGoals\.length > 0/);
  assert.match(reflectionSource, /const hasVisibleThreeMonthGoal = visibleGoals\.length > 0/);
  assert.match(reflectionSource, /reflection\.findGoalsTitle/);
  assert.match(reflectionSource, /reflection\.findGoalsBody/);
  assert.match(reflectionSource, /reflection\.findGoals/);
  assert.match(reflectionSource, /reflection\.missingThreeMonthGoalTitle/);
  assert.match(reflectionSource, /reflection\.missingWeeklyGoalTitle/);
  assert.match(reflectionSource, /reflection\.missingThreeMonthGoalBody/);
  assert.match(reflectionSource, /reflection\.missingWeeklyGoalBody/);
  assert.match(reflectionSource, /reflection\.findThreeMonthGoal/);
  assert.match(reflectionSource, /reflection\.findWeeklyGoal/);
  assert.match(i18nSource, /Finde deine nächsten Ziele!/);
  assert.match(i18nSource, /Noch kein Wochenziel/);
  assert.match(i18nSource, /Noch kein 3-Monats-Ziel/);
  assert.match(i18nSource, /Wochenziel jetzt finden/);
  assert.match(i18nSource, /3-Monats-Ziel jetzt finden/);
});

test('reflection goal check swaps footer actions only after completing a 3-month goal', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(reflectionSource, /const \[hasCompletedThreeMonthGoalInCheck, setHasCompletedThreeMonthGoalInCheck\] = useState\(false\)/);
  assert.match(reflectionSource, /setHasCompletedThreeMonthGoalInCheck\(true\)/);
  assert.match(reflectionSource, /startCompletion\(`weekly:\$\{goal\.id\}`,[\s\S]*marksFooterComplete: false/);
  assert.match(reflectionSource, /startCompletion\(`goal:\$\{goal\.id\}`,[\s\S]*marksFooterComplete: true/);
  assert.match(reflectionSource, /const handleContinue = \(\) => \{/);
  assert.match(reflectionSource, /reflection-goal-check-fade-out 1s ease-out forwards/);
  assert.match(reflectionSource, /hasCompletedThreeMonthGoalInCheck \? t\('reflection\.continue'\) : t\('reflection\.changeGoals'\)/);
  assert.match(reflectionSource, /hasCompletedThreeMonthGoalInCheck \? t\('reflection\.findNewGoals'\) : t\('reflection\.continue'\)/);
  assert.match(i18nSource, /Neue Ziele finden/);
});

test('reflection goal check can define a new weekly goal inline after completing the weekly goal', () => {
  const appSource = readSource('App.tsx');
  const reflectionSource = readSource('components/ReflectionView.tsx');
  const sharedWeeklyGoalSource = readSource('components/WeeklyGoalPanel.tsx');

  assert.match(appSource, /onDefineWeeklyGoal=\{defineWeeklyGoal\}/);
  assert.match(appSource, /onUpdateWeeklyGoal=\{updateWeeklyGoal\}/);
  assert.match(appSource, /onClearOpenWeeklyGoal=\{clearOpenWeeklyGoal\}/);
  assert.match(reflectionSource, /import \{ WeeklyGoalPanel \} from '\.\/WeeklyGoalPanel';/);
  assert.match(reflectionSource, /onDefineWeeklyGoal: \(title: string\) => string \| null/);
  assert.match(reflectionSource, /onUpdateWeeklyGoal: \(id: string, title: string\) => void/);
  assert.match(reflectionSource, /onClearOpenWeeklyGoal: \(\) => void/);
  assert.match(reflectionSource, /<WeeklyGoalPanel[\s\S]*showWhenIdle=\{false\}[\s\S]*onDeleteWeeklyGoal=\{undefined\}/);
  assert.match(reflectionSource, /setReflectionCompletedWeeklyGoalId\(goal\.id\)/);
  assert.match(reflectionSource, /setCanStartNewReflectionWeeklyGoal\(true\)/);
  assert.match(sharedWeeklyGoalSource, /export const WeeklyGoalPanel/);
  assert.match(sharedWeeklyGoalSource, /showWhenIdle = true/);
  assert.match(sharedWeeklyGoalSource, /completedWeeklyGoalId: controlledCompletedWeeklyGoalId/);
  assert.match(sharedWeeklyGoalSource, /canStartNewWeeklyGoal: controlledCanStartNewWeeklyGoal/);
  assert.doesNotMatch(reflectionSource, /onDelete=\{/);
});

test('reflection goal check is only shown after reflecting in the current session', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');

  assert.match(reflectionSource, /const \[hasReflectedInSession, setHasReflectedInSession\] = useState\(false\)/);
  assert.match(reflectionSource, /setHasReflectedInSession\(true\)/);
  assert.match(reflectionSource, /!hasReflectedInSession \|\| hasDismissedGoalCheck/);
  assert.match(reflectionSource, /<ReflectionDonePanel onNavigateToLookback=\{onNavigateToLookback\} \/>/);
  assert.match(reflectionSource, /onContinue=\{\(\) => setHasDismissedGoalCheck\(true\)\}/);
});

test('all-caught-up reflection screen opens the lookback with a primary action', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');
  const appSource = readSource('App.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(reflectionSource, /import \{ PrimaryButton, SecondaryButton, TertiaryButton, SubSideMenuButton \} from '\.\/Buttons';/);
  assert.match(reflectionSource, /const ReflectionDonePanel: React\.FC<\{ onNavigateToLookback: \(\) => void \}>/);
  assert.match(reflectionSource, /<PrimaryButton onClick=\{onNavigateToLookback\}>[\s\S]*t\('reflection\.viewLookback'\)[\s\S]*<\/PrimaryButton>/);
  assert.doesNotMatch(reflectionSource, /<SecondaryButton onClick=\{onClose\}>[\s\S]*t\('reflection\.returnToBoard'\)[\s\S]*<\/SecondaryButton>/);
  assert.match(appSource, /onNavigateToLookback=\{\(\) => handleNavigateToView\('charts', 'lookback'\)\}/);
  assert.match(i18nSource, /'reflection\.viewLookback': 'View your lookback'/);
  assert.match(i18nSource, /'reflection\.viewLookback': 'Deinen Rückblick anschauen'/);
});

test('final reflection task transitions softly into goal check', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');

  assert.match(reflectionSource, /const \[isFinishingReflection, setIsFinishingReflection\] = useState\(false\)/);
  assert.match(reflectionSource, /const isLastReflectionTask = unreflectedTasks\.length === 1/);
  assert.match(reflectionSource, /setIsFinishingReflection\(isLastReflectionTask\)/);
  assert.match(reflectionSource, /isLastReflectionTask \? 1000 : 300/);
  assert.match(reflectionSource, /transition-opacity duration-1000 ease-out/);
  assert.doesNotMatch(reflectionSource, /translate-y-2 opacity-0/);
  assert.match(reflectionSource, /reflection-goal-check-fade-in 1s ease-out/);
});

test('empty goal and all-caught-up screens fade in with the shared reflection fade', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');

  assert.match(reflectionSource, /reflection\.findGoalsTitle/);
  assert.match(reflectionSource, /const ReflectionDonePanel/);
  assert.match(reflectionSource, /opacity-0/);
  assert.match(reflectionSource, /reflection-goal-check-fade-in 1s ease-out forwards/);
});

test('reflection goal check fades in four sections sequentially', () => {
  const reflectionSource = readSource('components/ReflectionView.tsx');

  assert.match(reflectionSource, /<GoalCheckSection delaySeconds=\{0\}>/);
  assert.match(reflectionSource, /<GoalCheckSection delaySeconds=\{1\}>/);
  assert.match(reflectionSource, /<GoalCheckSection delaySeconds=\{2\}>/);
  assert.match(reflectionSource, /<GoalCheckSection delaySeconds=\{3\}>/);
  assert.match(reflectionSource, /@keyframes reflection-goal-check-fade-in/);
});

test('goal history labels completed weekly goals and allows deleting them', () => {
  const source = readSource('components/GoalsView.tsx');

  assert.match(source, /goals\.weeklyHistoryLabel/);
  assert.match(source, /item\.type === 'weekly'/);
  assert.match(source, /type: 'three-month' as const/);
  assert.match(source, /onDeleteWeeklyGoal/);
  assert.match(source, /item\.type === 'weekly' \? onDeleteWeeklyGoal\(item\.goal\.id\) : onDeleteGoal\(item\.goal\.id\)/);
});

test('define with AI copies a dynamic prompt with task and project context', () => {
  const goalsSource = readSource('components/GoalsView.tsx');
  const promptSource = readSource('components/goals/defineWithAiPrompt.ts');
  const appSource = readSource('App.tsx');
  const i18nSource = readSource('i18n.tsx');
  const combinedGoalSource = `${goalsSource}\n${promptSource}`;

  assert.match(goalsSource, /tasks: Task\[\]/);
  assert.match(goalsSource, /projects: Project\[\]/);
  assert.match(appSource, /tasks=\{state\.tasks\}/);
  assert.match(appSource, /projects=\{state\.projects\}/);
  assert.match(goalsSource, /buildDefineWithAiPrompt/);
  assert.match(promptSource, /Ich nutze eine App, die mir helfen soll/);
  assert.match(promptSource, /I use an app that helps me plan/);
  assert.match(promptSource, /hasCurrentGoals/);
  assert.match(promptSource, /Einen kurzen ersten Eindruck/);
  assert.match(promptSource, /Versuche aus Aufgaben, Projekten und bisher erledigter Arbeit/);
  assert.match(promptSource, /Genau 5 Vorschläge für eine Richtung für die nächsten 3 Monate/);
  assert.match(promptSource, /Genau 3 Vorschläge für ein optionales Wochenziel/);
  assert.match(promptSource, /Genau 5 kurze Gegenfragen/);
  assert.match(promptSource, /Heute ist der \$\{formatTimestampDate\(Date\.now\(\), locale\)\}\./);
  assert.match(promptSource, /Today is \$\{formatTimestampDate\(Date\.now\(\), locale\)\}\./);
  assert.match(promptSource, /Beziehe dich dabei, soweit vorhanden, konkret auf meine aktuellen und zuletzt erreichten Ziele sowie auf offene Aufgaben/);
  assert.match(promptSource, /Where available, refer specifically to my current and most recently reached goals, as well as open tasks/);
  assert.match(promptSource, /Bitte keine KPI-, OKR-, Consulting- oder Projektmanagement-Sprache/);
  assert.match(promptSource, /spürbar überprüfbar/);
  assert.match(promptSource, /Nimm dir bewusst Zeit und denke gründlich nach/);
  assert.match(promptSource, /Schau vor allem auf das Gesamtbild/);
  assert.match(promptSource, /Bestehende Ziele sind Kontext, keine Grenze/);
  assert.match(promptSource, /Take your time and think carefully/);
  assert.match(promptSource, /Existing goals are context, not a boundary/);
  assert.match(promptSource, /Wochenziele: 6-14 Wörter/);
  assert.match(promptSource, /Drei-Monats-Richtungen: 10-22 Wörter/);
  assert.match(promptSource, /Start without a long introduction/);
  assert.match(promptSource, /Weekly goals: 6-14 words/);
  assert.match(promptSource, /3-month directions: 10-22 words/);
  assert.match(goalsSource, /toneInstruction: t\('goals\.defineWithAiToneInstruction'\)/);
  assert.match(promptSource, /sections\.push\(toneInstruction\)/);
  assert.match(i18nSource, /'goals\.defineWithAiToneInstruction': 'When answering, be motivating, give constructive criticism when needed, and focus on the positive\.'/);
  assert.match(i18nSource, /'goals\.defineWithAiToneInstruction': 'Sei beim Antworten motivierend, gib konstruktive Kritik wenn nötig und setze einen Fokus auf das Positive\.'/);
  assert.match(promptSource, /Offene Aufgaben:/);
  assert.match(promptSource, /Erledigte Aufgaben der letzten 14 Tage:/);
  assert.match(promptSource, /Kein Projekt/);
  assert.match(promptSource, /kein Fälligkeitsdatum/);
  assert.match(promptSource, /Bisher wurden keine passenden Aufgaben gefunden/);
  assert.match(promptSource, /filterRelevantOpenTasks/);
  assert.match(promptSource, /MAX_OPEN_TASKS_IN_AI_PROMPT = 20/);
  assert.doesNotMatch(combinedGoalSource, /Planwerk ist eine lokale Planungsapp/);
  assert.doesNotMatch(combinedGoalSource, /Planwerk context/);
  assert.doesNotMatch(combinedGoalSource, /Ich nutze Planwerk, um meine Zeit zu planen/);
  assert.doesNotMatch(combinedGoalSource, /The suggestions should be measurable/);
  assert.doesNotMatch(goalsSource, /Bitte stelle mir 3 kurze Fragen/);
});
