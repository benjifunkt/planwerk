const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const readSource = (relativePath) => (
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
);

test('missing planwerk file renders the full welcome screen instead of the old startup dialog', () => {
  const appSource = readSource('App.tsx');
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');

  assert.match(appSource, /import \{ PlanwerkWelcomeScreen \} from '\.\/components\/PlanwerkWelcomeScreen';/);
  assert.match(appSource, /import \{ PlanwerkCreateTaskOnboardingScreen \} from '\.\/components\/PlanwerkCreateTaskOnboardingScreen';/);
  assert.match(appSource, /<PlanwerkWelcomeScreen/);
  assert.match(appSource, /onCreatePlanwerkFile=\{handleCreatePlanwerkFileFromWelcome\}/);
  assert.match(appSource, /onOpenPlanwerkFile=\{openPlanwerkFile\}/);
  assert.doesNotMatch(appSource, /PlanwerkStartupDialog/);

  assert.match(welcomeSource, /role="main"/);
  assert.match(welcomeSource, /AnimatedPlanwerkLogo/);
  assert.match(welcomeSource, /import \{ PrimaryButton, SecondaryButton, TertiaryButton \} from '\.\/Buttons';/);
  assert.match(welcomeSource, /t\('file\.welcomeTitle'\)/);
  assert.match(welcomeSource, /t\('file\.welcomeBody'\)/);
  assert.doesNotMatch(welcomeSource, /t\('file\.welcomeFileHint'\)/);
  assert.match(welcomeSource, /icon=\{<IconPlus \/>}/);
  assert.match(welcomeSource, /icon=\{<IconFolderOpen \/>}/);
  assert.match(welcomeSource, /t\('settings\.newPlanwerk'\)/);
  assert.match(welcomeSource, /t\('settings\.openPlanwerk'\)/);
  assert.match(welcomeSource, /overflow-y-auto/);
  assert.doesNotMatch(welcomeSource, /<p className="mt-10/);
});

test('new planwerk files show a stored work week onboarding step before the board', () => {
  const appSource = readSource('App.tsx');
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');
  const i18nSource = readSource('i18n.tsx');
  const useStoreSource = readSource('hooks/useStore.ts');

  assert.match(appSource, /shouldShowIntroOnboarding/);
  assert.match(appSource, /hasCompletedIntroOnboarding/);
  assert.match(appSource, /const handleCompleteWelcomeIntro = useCallback\(\(\) =>/);
  assert.match(appSource, /const handleSkipWelcomeOnboarding = useCallback\(\(\) =>/);
  assert.match(appSource, /onCompleteIntro=\{handleCompleteWelcomeIntro\}/);
  assert.match(appSource, /onSkipOnboarding=\{handleSkipWelcomeOnboarding\}/);
  assert.match(appSource, /shouldShowWorkWeekOnboarding/);
  assert.match(appSource, /handleCreatePlanwerkFileFromWelcome/);
  assert.doesNotMatch(appSource, /setShowWelcomeWorkWeekSetup/);
  assert.match(appSource, /handleOpenPlanwerkFileFromWelcome/);
  assert.match(appSource, /hasCompletedIntroOnboarding && !state\.onboarding\.tutorial\.workWeek/);
  assert.match(appSource, /const handleCompleteWelcomeWorkWeekSetup = useCallback\(\(\) =>/);
  assert.match(appSource, /workWeek: true/);
  assert.match(appSource, /onCompleteWorkWeekSetup=\{handleCompleteWelcomeWorkWeekSetup\}/);
  assert.match(useStoreSource, /createOnboardingState\(false, false, false, false, false, false, false, false\)/);

  assert.match(welcomeSource, /mode\?: 'file' \| 'intro' \| 'workWeek'/);
  assert.match(welcomeSource, /mode === 'intro'/);
  assert.match(welcomeSource, /mode === 'workWeek'/);
  assert.doesNotMatch(welcomeSource, /isWorkWeekStep/);
  assert.match(welcomeSource, /WorkWeekSettings/);
  assert.match(welcomeSource, /variant="welcome"/);
  assert.match(welcomeSource, /t\('welcome\.workWeekTitle'\)/);
  assert.match(welcomeSource, /t\('welcome\.workWeekBody'\)/);
  assert.match(welcomeSource, /t\('welcome\.continueToBoard'\)/);

  assert.match(i18nSource, /'welcome\.workWeekTitle': 'Half your time is enough\.'/);
  assert.match(i18nSource, /'welcome\.workWeekTitle': 'Die Hälfte deiner Zeit reicht\.'/);
  assert.match(i18nSource, /Working 8 hours\? Plan 4/);
  assert.match(i18nSource, /Arbeitest du 8 Stunden\? Plane 4/);
  assert.doesNotMatch(i18nSource, /Plane am besten nur die Hälfte deiner echten Arbeitszeit/);
  assert.match(i18nSource, /'welcome\.continueToBoard': 'Weiter'/);
});

test('mini intro screen uses welcome layout without a visual and can skip all onboarding', () => {
  const appSource = readSource('App.tsx');
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');
  const i18nSource = readSource('i18n.tsx');
  const introBranchStart = welcomeSource.indexOf("mode === 'intro'");
  const introBranchEnd = welcomeSource.indexOf("      ) : (", introBranchStart);
  const introBranchSource = welcomeSource.slice(introBranchStart, introBranchEnd);

  assert.match(appSource, /workWeek: true,\s*createTask: true,\s*board: true,\s*autofill: true,\s*cleanup: true,\s*reflection: true,\s*lookback: true,\s*goals: true/);
  assert.match(appSource, /setHasCompletedIntroOnboarding\(false\)/);
  assert.match(appSource, /onboarding: markWeeklyReflectionReminderShown\([\s\S]*markBulkTaskShortcutHintShown\(\{[\s\S]*tutorial: COMPLETED_ONBOARDING_TUTORIAL/);

  assert.match(welcomeSource, /import \{ PrimaryButton, SecondaryButton, TertiaryButton \} from '\.\/Buttons';/);
  assert.match(introBranchSource, /<OnboardingReveal key=\{`title-\$\{screenKey\}`\} delaySeconds=\{0\.5\}>/);
  assert.match(introBranchSource, /<OnboardingReveal key=\{`body-\$\{screenKey\}`\} delaySeconds=\{0\.7\}>/);
  assert.match(introBranchSource, /<OnboardingReveal key=\{`actions-\$\{screenKey\}`\} delaySeconds=\{2\.5\}>/);
  assert.match(welcomeSource, /t\('welcome\.introTitle'\)/);
  assert.match(welcomeSource, /t\('welcome\.introBody'\)/);
  assert.match(welcomeSource, /t\('welcome\.introStart'\)/);
  assert.match(welcomeSource, /t\('welcome\.introSkip'\)/);
  assert.match(welcomeSource, /<TertiaryButton[\s\S]*onClick=\{handleSkipOnboarding\}/);
  assert.match(welcomeSource, /onboarding-screen-exit/);
  assert.match(welcomeSource, /@keyframes onboarding-screen-exit/);
  assert.match(welcomeSource, /transform: translateY\(10px\)/);
  assert.match(welcomeSource, /window\.setTimeout\(callback, ONBOARDING_SCREEN_EXIT_MS\)/);
  assert.doesNotMatch(introBranchSource, /Animated[A-Za-z]+Logo/);

  assert.match(i18nSource, /'welcome\.introTitle': 'Plan less\. Achieve more\.'/);
  assert.match(i18nSource, /'welcome\.introBody': 'Before we start: Planwerk works a little differently than classic to-do apps\./);
  assert.match(i18nSource, /'welcome\.introStart': 'Let’s go'/);
  assert.match(i18nSource, /'welcome\.introSkip': 'I know this already'/);
  assert.match(i18nSource, /'welcome\.introTitle': 'Weniger planen\. Mehr erreichen\.'/);
  assert.match(i18nSource, /'welcome\.introBody': 'Bevor wir loslegen: Planwerk funktioniert etwas anders als klassische To-do-Apps\./);
  assert.match(i18nSource, /'welcome\.introStart': 'Los gehts'/);
  assert.match(i18nSource, /'welcome\.introSkip': 'Kenne ich schon'/);
});

test('work week completion routes into create task onboarding before the board', () => {
  const appSource = readSource('App.tsx');
  const createTaskSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(appSource, /const shouldShowCreateTaskOnboarding = storageStatus\.hasOpenFile && state\.onboarding\.tutorial\.workWeek && !state\.onboarding\.tutorial\.createTask/);
  assert.match(appSource, /if \(shouldShowCreateTaskOnboarding\)/);
  assert.match(appSource, /<PlanwerkCreateTaskOnboardingScreen/);
  assert.match(appSource, /onCreateTask=\{handleCreateOnboardingTask\}/);
  assert.match(appSource, /onComplete=\{handleCompleteCreateTaskOnboarding\}/);
  assert.match(appSource, /createTask: true/);
  assert.match(appSource, /addTask\(title, duration, priority, dueDate, finalProjectId, 'backlog', false\)/);

  assert.match(createTaskSource, /export const PlanwerkCreateTaskOnboardingScreen/);
  assert.match(createTaskSource, /AnimatedWorkWeekTimeLogo/);
  assert.match(createTaskSource, /TaskModalForm/);
  assert.match(createTaskSource, /variant="onboarding"/);
  assert.match(createTaskSource, /const ONBOARDING_FIELDS: TaskOnboardingField\[\] = \['title', 'duration', 'priority', 'dueDate', 'project'\]/);
  assert.match(createTaskSource, /const TITLE_FOCUS_DELAY_MS = 3800/);
  assert.match(createTaskSource, /@keyframes create-task-copy-fade/);
  assert.match(createTaskSource, /create-task-copy-fade 0\.5s/);
  assert.match(createTaskSource, /opacity-0/);
  assert.match(createTaskSource, /delaySeconds=\{3\.7\}/);
  assert.match(createTaskSource, /delaySeconds=\{3\.9\}/);

  assert.match(i18nSource, /'welcome\.createTaskTitleTitle': 'Create your first task'/);
  assert.match(i18nSource, /'welcome\.createTaskDurationTitle': 'Keep tasks small'/);
  assert.match(i18nSource, /'welcome\.createTaskPriorityTitle': 'What really matters\?'/);
  assert.match(i18nSource, /'welcome\.createTaskPriorityBody': 'If everything is important, nothing is important\. Trust your gut\.'/);
  assert.match(i18nSource, /'welcome\.createTaskDueDateTitle': 'Make it concrete'/);
  assert.match(i18nSource, /'welcome\.createTaskDueDateBody': 'Someday is not a date\. Give every task a point in time\. Otherwise, it stays just an idea\.'/);
  assert.match(i18nSource, /'welcome\.createTaskProjectTitle': 'Give it a home'/);
  assert.match(i18nSource, /'welcome\.createTaskProjectBody': 'Similar tasks belong together\. Assign it to an area\. That gives you orientation later\.'/);
  assert.match(i18nSource, /'welcome\.createTaskTitleTitle': 'Erstelle deine erste Aufgabe'/);
  assert.match(i18nSource, /'welcome\.createTaskPriorityTitle': 'Was zählt wirklich\?'/);
  assert.match(i18nSource, /'welcome\.createTaskPriorityBody': 'Wenn alles wichtig ist, ist nichts wichtig\. Vertraue deinem Bauchgefühl\.'/);
  assert.match(i18nSource, /'welcome\.createTaskDueDateTitle': 'Mach sie konkret'/);
  assert.match(i18nSource, /'welcome\.createTaskDueDateBody': 'Irgendwann ist kein Datum\. Gib jeder Aufgabe einen Zeitpunkt\. Sonst bleibt sie nur eine Idee\.'/);
  assert.match(i18nSource, /'welcome\.createTaskProjectTitle': 'Gib ihr ein Zuhause'/);
  assert.match(i18nSource, /'welcome\.createTaskProjectBody': 'Ähnliche Aufgaben gehören zusammen\. Ordne sie einem Bereich zu\. Das gibt dir später Orientierung\.'/);
});

test('create task onboarding explains the saved task card before showing the board', () => {
  const appSource = readSource('App.tsx');
  const createTaskSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');
  const scoreExplanationSource = readSource('components/OnboardingScoreExplanation.tsx');
  const previewSource = readSource('components/OnboardingTaskCardPreview.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(appSource, /const createdTask = addTask\(title, duration, priority, dueDate, finalProjectId, 'backlog', false\)/);
  assert.match(appSource, /return createdTask/);

  assert.match(createTaskSource, /import \{ OnboardingTaskCardPreview, TaskCardReviewStep \} from '\.\/OnboardingTaskCardPreview';/);
  assert.match(createTaskSource, /type OnboardingPhase = 'form' \| 'cardReview'/);
  assert.match(createTaskSource, /const CARD_REVIEW_STEPS: TaskCardReviewStep\[\] = \['card', 'duration', 'score'\]/);
  assert.match(createTaskSource, /const \[phase, setPhase\] = React\.useState<OnboardingPhase>\('form'\)/);
  assert.match(createTaskSource, /const \[createdTask, setCreatedTask\] = React\.useState<Task \| null>\(null\)/);
  assert.match(createTaskSource, /setPhase\('cardReview'\)/);
  assert.match(createTaskSource, /setReviewStepIndex\(0\)/);
  assert.match(createTaskSource, /onComplete\(\)/);
  assert.match(createTaskSource, /create-task-form-exit/);
  assert.match(createTaskSource, /\.create-task-form-exit-centered\s*\{[\s\S]*transform: translate\(-50%, calc\(-50% \+ 10px\)\);/);
  assert.match(createTaskSource, /\.create-task-form-exit-button\s*\{[\s\S]*transform: translate\(-50%, 10px\);/);
  assert.doesNotMatch(createTaskSource, /\.create-task-form-exit\s*\{[\s\S]*transform: translateY\(-10px\);/);
  assert.match(createTaskSource, /create-task-card-review-enter/);
  assert.match(createTaskSource, /create-task-card-review-exit/);
  assert.match(createTaskSource, /<OnboardingTaskCardPreview/);
  assert.match(createTaskSource, /highlightStep=\{activeReviewStep\}/);
  assert.match(createTaskSource, /pointer-events-none/);
  assert.match(createTaskSource, /activeReviewStep === 'score' \? \(/);
  assert.match(createTaskSource, /CARD_REVIEW_STEPS\.slice\(0, 2\)\.map/);
  assert.match(createTaskSource, /aria-hidden=\{!isActive && !hasPassed\}/);
  assert.match(createTaskSource, /welcome\.taskCardReviewScoreFormula/);
  assert.match(createTaskSource, /welcome\.taskCardReviewScoreExplain/);
  assert.match(createTaskSource, /isScoreExplanationOpen/);
  assert.match(createTaskSource, /<OnboardingScoreExplanation/);
  assert.match(createTaskSource, /handleOpenScoreExplanation/);
  assert.match(createTaskSource, /handleCloseScoreExplanation/);
  assert.doesNotMatch(createTaskSource, />2 × 9 = 18</);
  assert.doesNotMatch(createTaskSource, />5 × 7 = 35</);
  assert.doesNotMatch(createTaskSource, /welcome\.taskCardReviewScoreTodayExample/);
  assert.doesNotMatch(createTaskSource, /welcome\.taskCardReviewScoreSoonExample/);
  assert.doesNotMatch(createTaskSource, /welcome\.taskCardReviewScoreTakeaway/);

  assert.match(scoreExplanationSource, /const URGENCIES = \[9, 8, 7, 6, 5, 4, 3, 2, 1\] as const/);
  assert.match(scoreExplanationSource, /priority: Priority\.Critical/);
  assert.match(scoreExplanationSource, /urgency: 9/);
  assert.match(scoreExplanationSource, /role="grid"/);
  assert.match(scoreExplanationSource, /role="gridcell"/);
  assert.match(scoreExplanationSource, /aria-selected=\{isPinned\}/);
  assert.match(scoreExplanationSource, /tabIndex=\{isRoving \? 0 : -1\}/);
  assert.match(scoreExplanationSource, /onMouseMove=\{\(\) =>/);
  assert.match(scoreExplanationSource, /onFocus=\{\(\) =>/);
  assert.match(scoreExplanationSource, /setPinnedSelection\(selection\)/);
  assert.match(scoreExplanationSource, /event\.key === 'ArrowLeft'/);
  assert.match(scoreExplanationSource, /event\.key === 'ArrowRight'/);
  assert.match(scoreExplanationSource, /event\.key === 'ArrowUp'/);
  assert.match(scoreExplanationSource, /event\.key === 'ArrowDown'/);
  assert.match(scoreExplanationSource, /event\.key !== 'Escape'/);
  assert.match(scoreExplanationSource, /min-h-11/);
  assert.match(scoreExplanationSource, /dark:/);

  assert.match(previewSource, /export type TaskCardReviewStep = 'card' \| 'duration' \| 'score'/);
  assert.match(previewSource, /PIXELS_PER_MINUTE/);
  assert.match(previewSource, /calculatePriorityScore/);
  assert.match(previewSource, /scoreProgressPercent/);
  assert.match(previewSource, /draggable=\{false\}/);
  assert.doesNotMatch(previewSource, /onClick=/);
  assert.match(previewSource, /duration-highlight/);
  assert.match(previewSource, /score-highlight/);
  assert.match(previewSource, /opacity-20/);
  assert.match(previewSource, /const muteBorder = highlightStep === 'score'/);
  assert.match(previewSource, /muteBorder \? 'border border-neutral-300 dark:border-neutral-700' : 'border border-black dark:border-neutral-700'/);

  assert.match(i18nSource, /'welcome\.taskCardReviewCardTitle': 'This is your task'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewDurationTitle': 'The height shows the duration'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewScoreTitle': 'When you need orientation'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewScoreBody': 'The score combines importance and due date\. It can help you decide what comes next\.'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewScoreFormula': 'Importance × urgency = score'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewScoreExplain': 'Explain in detail'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsTitle': 'How the score works'/);
  assert.match(i18nSource, /inspired by the Eisenhower method/);
  assert.match(i18nSource, /The score offers orientation—it does not decide for you\./);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency9': 'Today or overdue'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency7': 'This week'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency6': 'Next week'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency5': 'This month'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency4': 'Next month'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency3': 'This quarter'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency2': 'Next quarter'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency1': 'This year or later'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewCardTitle': 'Das ist deine Aufgabe'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewScoreTitle': 'Wenn du Orientierung brauchst'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewScoreBody': 'Der Score verbindet Wichtigkeit und Fälligkeit\. Er kann dir helfen zu entscheiden, was als Nächstes dran ist\.'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewScoreFormula': 'Wichtigkeit × Dringlichkeit = Score'/);
  assert.match(i18nSource, /'welcome\.taskCardReviewScoreExplain': 'Genauer erklären'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsTitle': 'So funktioniert der Score'/);
  assert.match(i18nSource, /an die Eisenhower-Methode angelehnt/);
  assert.match(i18nSource, /Der Score gibt Orientierung – er entscheidet nicht für dich\./);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency9': 'Heute oder überfällig'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency7': 'Diese Woche'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency6': 'Nächste Woche'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency5': 'Diesen Monat'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency4': 'Nächsten Monat'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency3': 'Dieses Quartal'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency2': 'Nächstes Quartal'/);
  assert.match(i18nSource, /'welcome\.scoreDetailsUrgency1': 'Dieses Jahr oder später'/);
  assert.doesNotMatch(i18nSource, /welcome\.scoreDetailsFactors/);
});

test('board tutorial is persisted after the in-app bottom panel', () => {
  const appSource = readSource('App.tsx');
  const panelSource = readSource('components/InAppTutorialPanel.tsx');
  const boardAnimationSource = readSource('components/animations/AnimatedBoardDragLogo.tsx');
  const boardReadyAnimationSource = readSource('components/animations/AnimatedBoardReadyLogo.tsx');
  const spaceKeyAnimationSource = readSource('components/animations/AnimatedSpaceKeyLogo.tsx');
  const keyboardKeysSource = readSource('components/animations/AnimatedKeyboardKeys.tsx');
  const animationIndexSource = readSource('components/animations/index.ts');
  const i18nSource = readSource('i18n.tsx');
  const useStoreSource = readSource('hooks/useStore.ts');
  const planwerkFileSource = readSource('planwerkFile.cjs');

  assert.match(useStoreSource, /createOnboardingState\(false, false, false, false, false, false, false, false\)/);
  assert.match(useStoreSource, /fallbackBoard = true/);
  assert.match(useStoreSource, /const board = 'board' in tutorial && typeof tutorial\.board === 'boolean'/);
  assert.match(planwerkFileSource, /createOnboardingState\(true, true, true, true, true, true, true, true, true\)/);
  assert.match(planwerkFileSource, /const board = normalizeBoolean\(tutorial\.board, `\$\{field\}\.tutorial\.board`, true\)/);
  assert.match(planwerkFileSource, /shown: normalizeBoolean\([\s\S]*bulkTaskShortcut\.shown[\s\S]*board/);

  assert.match(appSource, /import \{ InAppTutorialPanel \} from '\.\/components\/InAppTutorialPanel';/);
  assert.match(appSource, /import \{ AnimatedAutofillLogo,[^\n]*AnimatedSpaceKeyLogo \} from '\.\/components\/animations';/);
  assert.match(appSource, /type BoardTutorialStep = 'drag' \| 'spaceShortcut' \| 'ready'/);
  assert.match(appSource, /const BOARD_ENTER_FADE_MS = 1000/);
  assert.match(appSource, /shouldShowBoardTutorial = storageStatus\.hasOpenFile && state\.onboarding\.tutorial\.workWeek && state\.onboarding\.tutorial\.createTask && !state\.onboarding\.tutorial\.board/);
  assert.match(appSource, /setIsBoardEnteringFromOnboarding\(true\)/);
  assert.match(appSource, /window\.setTimeout\(\(\) => setIsBoardEnteringFromOnboarding\(false\), BOARD_ENTER_FADE_MS\)/);
  assert.match(appSource, /if \(shouldShowBoardTutorial && boardTutorialStep === 'drag'\) \{[\s\S]*setBoardTutorialStep\('spaceShortcut'\)/);
  assert.match(appSource, /if \(boardTutorialStep === 'drag'\) \{[\s\S]*setBoardTutorialStep\('spaceShortcut'\)/);
  assert.match(appSource, /if \(boardTutorialStep === 'spaceShortcut'\) \{[\s\S]*setBoardTutorialStep\('ready'\)/);
  assert.match(appSource, /board: true/);
  assert.match(appSource, /board-enter-fade 1s/);
  assert.match(appSource, /<InAppTutorialPanel/);
  assert.match(appSource, /boardTutorialStep === 'spaceShortcut'[\s\S]*t\('welcome\.boardTutorialSpaceShortcutTitle'\)/);
  assert.match(appSource, /boardTutorialStep === 'spaceShortcut'[\s\S]*t\('welcome\.boardTutorialSpaceShortcutBody'\)/);
  assert.match(appSource, /buttonLabel=\{boardTutorialStep === 'ready' \? t\('welcome\.boardTutorialStart'\) : t\('welcome\.continue'\)\}/);
  assert.match(appSource, /boardTutorialStep === 'spaceShortcut'[\s\S]*<AnimatedSpaceKeyLogo \/>/);
  assert.match(appSource, /if \(e\.code === 'Space' && shouldShowBoardTutorial && boardTutorialStep === 'drag'\) \{[\s\S]*e\.preventDefault\(\);[\s\S]*return;/);
  assert.match(appSource, /if \(shouldShowBoardTutorial && boardTutorialStep === 'spaceShortcut'\) \{[\s\S]*setBoardTutorialStep\('ready'\);/);

  assert.match(panelSource, /export interface InAppTutorialPanelProps/);
  assert.match(panelSource, /in-app-tutorial-panel-enter/);
  assert.match(panelSource, /in-app-tutorial-panel-exit/);
  assert.match(panelSource, /@keyframes in-app-tutorial-slide-in/);
  assert.match(panelSource, /@keyframes in-app-tutorial-slide-out/);
  assert.match(panelSource, /fixed inset-x-0 bottom-0/);
  assert.match(panelSource, /border-t border-neutral-200/);
  assert.match(panelSource, /AnimatedWorkWeekTimeLogo/);
  assert.match(panelSource, /prefers-reduced-motion/);
  assert.match(panelSource, /text-2xl font-black tracking-tight md:text-3xl/);
  assert.doesNotMatch(panelSource, /text-2xl font-black uppercase tracking-tight md:text-3xl/);
  assert.match(panelSource, /\{body && \(/);

  assert.match(i18nSource, /'welcome\.boardTutorialDragTitle': 'Drag tasks into your week'/);
  assert.match(i18nSource, /'welcome\.boardTutorialDragBody': 'Plan with drag and drop and instantly see how full your week already is\.'/);
  assert.match(i18nSource, /'welcome\.boardTutorialSpaceShortcutTitle': 'Press the space bar to create a new task faster\.'/);
  assert.match(i18nSource, /'welcome\.boardTutorialSpaceShortcutBody': ''/);
  assert.match(i18nSource, /'welcome\.boardTutorialReadyTitle': 'You are ready to plan!'/);
  assert.match(i18nSource, /'welcome\.boardTutorialReadyBody': ''/);
  assert.match(i18nSource, /'welcome\.boardTutorialDragTitle': 'Zieh Aufgaben in deine Woche'/);
  assert.match(i18nSource, /'welcome\.boardTutorialDragBody': 'Plane per Drag & Drop und sieh sofort, wie voll deine Woche schon ist\.'/);
  assert.match(i18nSource, /'welcome\.boardTutorialSpaceShortcutTitle': 'Drücke die Leertaste, um schneller eine neue Aufgabe zu erstellen\.'/);
  assert.match(i18nSource, /'welcome\.boardTutorialSpaceShortcutBody': ''/);
  assert.match(i18nSource, /'welcome\.boardTutorialReadyTitle': 'Du bist bereit zum Planen!'/);
  assert.match(i18nSource, /'welcome\.boardTutorialReadyBody': ''/);

  assert.match(boardAnimationSource, /export const AnimatedBoardDragLogo/);
  assert.match(boardAnimationSource, /const LINE_COUNT = 5/);
  assert.match(boardAnimationSource, /const COLUMN_COUNT = LINE_COUNT/);
  assert.match(boardAnimationSource, /const MOVE_MS = 1500/);
  assert.match(boardAnimationSource, /const HOLD_MS = 2000/);
  assert.match(boardAnimationSource, /const LINE_X_POSITIONS/);
  assert.match(boardAnimationSource, /const LINE_WIDTH = 8/);
  assert.match(boardAnimationSource, /const START_SLOT_X_POSITION/);
  assert.match(boardAnimationSource, /const BETWEEN_LINE_SLOT_X_POSITIONS = LINE_X_POSITIONS\.slice\(0, -1\)\.map/);
  assert.match(boardAnimationSource, /const SLOT_X_POSITIONS = \[START_SLOT_X_POSITION, \.\.\.BETWEEN_LINE_SLOT_X_POSITIONS\]/);
  assert.match(boardAnimationSource, /const CARD_Y_POSITION = 16/);
  assert.doesNotMatch(boardAnimationSource, /CARD_Y_POSITIONS/);
  assert.match(boardAnimationSource, /lineX \+ LINE_WIDTH \/ 2/);
  assert.match(boardAnimationSource, /LINE_X_POSITIONS\[index \+ 1\] \+ LINE_WIDTH \/ 2/);
  assert.match(boardAnimationSource, /Math\.floor\(Math\.random\(\) \* COLUMN_COUNT\)/);
  assert.match(boardAnimationSource, /setIsDragging\(true\)/);
  assert.match(boardAnimationSource, /setIsDragging\(false\)/);
  assert.match(boardAnimationSource, /const scheduleNextMove = \(\) =>/);
  assert.match(boardAnimationSource, /scheduleNextMove\(\)/);
  assert.match(boardAnimationSource, /\}, \[prefersReducedMotion\]\);\n\n  const cardPosition/);
  assert.match(boardAnimationSource, /Array\.from\(\{ length: LINE_COUNT \}/);
  assert.match(boardAnimationSource, /transition: prefersReducedMotion \? 'none' : `transform \$\{MOVE_MS\}ms/);
  assert.match(boardAnimationSource, /scale\(1\.12\)/);
  assert.match(boardAnimationSource, /ease-in-out/);
  assert.match(boardAnimationSource, /shadow-sm/);
  assert.doesNotMatch(boardAnimationSource, /shadow-\[4px_4px_0px_rgba\(0,0,0,0\.18\)\]/);
  assert.doesNotMatch(boardAnimationSource, /rounded/);
  assert.match(boardAnimationSource, /prefers-reduced-motion/);

  assert.match(boardReadyAnimationSource, /export const AnimatedBoardReadyLogo/);
  assert.match(boardReadyAnimationSource, /const LINE_COUNT = 5/);
  assert.match(boardReadyAnimationSource, /const TASK_REVEAL_MS = 300/);
  assert.match(boardReadyAnimationSource, /const MAX_TASKS_PER_COLUMN = 2/);
  assert.match(boardReadyAnimationSource, /const TASK_VERTICAL_GAP = 4/);
  assert.match(boardReadyAnimationSource, /const LINE_CENTER_POSITIONS = LINE_X_POSITIONS\.map\(lineX => lineX \+ LINE_WIDTH \/ 2\)/);
  assert.match(boardReadyAnimationSource, /const END_SLOT_X_POSITION/);
  assert.match(boardReadyAnimationSource, /const SLOT_X_POSITIONS = \[START_SLOT_X_POSITION, \.\.\.BETWEEN_LINE_SLOT_X_POSITIONS, END_SLOT_X_POSITION\]/);
  assert.match(boardReadyAnimationSource, /const createColumnTasks = \(heights: number\[\]\)/);
  assert.match(boardReadyAnimationSource, /const COLUMN_TASKS/);
  assert.match(boardReadyAnimationSource, /createColumnTasks\(\[24\]\)/);
  assert.match(boardReadyAnimationSource, /height: task\.height/);
  assert.match(boardReadyAnimationSource, /transitionDelay: prefersReducedMotion \? '0ms' : `\$\{task\.sequenceIndex \* TASK_REVEAL_MS\}ms`/);
  assert.match(boardReadyAnimationSource, /transform: isTaskVisible \? 'scaleY\(1\)' : 'scaleY\(0\)'/);
  assert.match(boardReadyAnimationSource, /transformOrigin: 'top center'/);
  assert.match(boardReadyAnimationSource, /Array\.from\(\{ length: LINE_COUNT \}/);
  assert.match(boardReadyAnimationSource, /prefers-reduced-motion/);

  assert.match(animationIndexSource, /export \{ AnimatedSpaceKeyLogo \} from '\.\/AnimatedSpaceKeyLogo';/);
  assert.match(animationIndexSource, /export \{ AnimatedKeyboardKeys \} from '\.\/AnimatedKeyboardKeys';/);
  assert.match(spaceKeyAnimationSource, /export const AnimatedSpaceKeyLogo/);
  assert.match(spaceKeyAnimationSource, /const PRESS_INTERVAL_MS = 2400/);
  assert.match(spaceKeyAnimationSource, /<AnimatedKeyboardKeys/);
  assert.match(spaceKeyAnimationSource, /width: 'wide'/);
  assert.match(spaceKeyAnimationSource, /mode="single"/);
  assert.match(spaceKeyAnimationSource, /cycleMs=\{PRESS_INTERVAL_MS\}/);
  assert.match(keyboardKeysSource, /key\.width === 'wide' \? 'w-48 px-5' : 'w-28 px-3'/);
  assert.match(keyboardKeysSource, /prefersReducedMotion[\s\S]*\? 'none'/);
  assert.match(keyboardKeysSource, /prefers-reduced-motion: reduce/);

  assert.match(i18nSource, /'welcome\.boardTutorialDragTitle': 'Drag tasks into your week'/);
  assert.match(i18nSource, /'welcome\.boardTutorialReadyTitle': 'You are ready to plan!'/);
  assert.match(i18nSource, /'welcome\.boardTutorialDragTitle': 'Zieh Aufgaben in deine Woche'/);
  assert.match(i18nSource, /'welcome\.boardTutorialStart': 'Los gehts'/);
});

test('secondary board tutorials trigger on first autofill and cleanup clicks', () => {
  const appSource = readSource('App.tsx');
  const autofillAnimationSource = readSource('components/animations/AnimatedAutofillLogo.tsx');
  const cleanupAnimationSource = readSource('components/animations/AnimatedCleanupLogo.tsx');
  const i18nSource = readSource('i18n.tsx');
  const useStoreSource = readSource('hooks/useStore.ts');
  const planwerkFileSource = readSource('planwerkFile.cjs');

  assert.match(useStoreSource, /const autofill = 'autofill' in tutorial && typeof tutorial\.autofill === 'boolean'/);
  assert.match(useStoreSource, /const cleanup = 'cleanup' in tutorial && typeof tutorial\.cleanup === 'boolean'/);
  assert.match(planwerkFileSource, /autofill: normalizeBoolean\(tutorial\.autofill, `\$\{field\}\.tutorial\.autofill`, true\)/);
  assert.match(planwerkFileSource, /cleanup: normalizeBoolean\(tutorial\.cleanup, `\$\{field\}\.tutorial\.cleanup`, true\)/);

  assert.match(appSource, /type SecondaryTutorialKey = 'autofill' \| 'cleanup'/);
  assert.match(appSource, /const \[activeSecondaryTutorial, setActiveSecondaryTutorial\] = useState<SecondaryTutorialKey \| null>\(null\)/);
  assert.match(appSource, /const shouldRenderSecondaryTutorial = activeSecondaryTutorial !== null && !shouldRenderBoardTutorial/);
  assert.match(appSource, /const handleAutofillClick = useCallback/);
  assert.match(appSource, /!state\.onboarding\.tutorial\.autofill/);
  assert.match(appSource, /setActiveSecondaryTutorial\('autofill'\)/);
  assert.match(appSource, /const handleCleanupClick = useCallback/);
  assert.match(appSource, /!state\.onboarding\.tutorial\.cleanup/);
  assert.match(appSource, /setActiveSecondaryTutorial\('cleanup'\)/);
  assert.match(appSource, /const completeSecondaryTutorial = useCallback/);
  assert.match(appSource, /\[activeSecondaryTutorial\]: true/);
  assert.match(appSource, /activeSecondaryTutorial === 'autofill' \? autofillWeek\(\) : cleanupBoard\(\)/);
  assert.match(appSource, /import \{ AnimatedAutofillLogo,[^\n]*AnimatedSpaceKeyLogo \} from '\.\/components\/animations';/);
  assert.match(appSource, /visual=\{activeSecondaryTutorial === 'autofill' \? <AnimatedAutofillLogo \/> : <AnimatedCleanupLogo \/>}/);
  assert.match(appSource, /title=\{activeSecondaryTutorial === 'autofill' \? t\('welcome\.autofillTutorialTitle'\) : t\('welcome\.cleanupTutorialTitle'\)\}/);
  assert.match(appSource, /onClick=\{handleAutofillClick\}/);
  assert.match(appSource, /onClick=\{handleCleanupClick\}/);

  assert.match(autofillAnimationSource, /export const AnimatedAutofillLogo/);
  assert.match(autofillAnimationSource, /const LINE_COUNT = 5/);
  assert.match(autofillAnimationSource, /const MOVE_MS = 1500/);
  assert.match(autofillAnimationSource, /const HOLD_MS = 2000/);
  assert.match(autofillAnimationSource, /const START_DELAY_MS = 1000/);
  assert.match(autofillAnimationSource, /const START_FADE_MS = 500/);
  assert.match(autofillAnimationSource, /const RESET_FADE_MS = 500/);
  assert.match(autofillAnimationSource, /const LOOP_MS = START_DELAY_MS \+ START_FADE_MS \+ MOVE_MS \+ HOLD_MS \+ RESET_FADE_MS/);
  assert.match(autofillAnimationSource, /const FADE_IN_START_PERCENT = START_DELAY_MS \/ LOOP_MS \* 100/);
  assert.match(autofillAnimationSource, /const MOVE_START_PERCENT = \(START_DELAY_MS \+ START_FADE_MS\) \/ LOOP_MS \* 100/);
  assert.match(autofillAnimationSource, /const staticTasks = \[/);
  assert.match(autofillAnimationSource, /const movingTasks = \[/);
  assert.match(autofillAnimationSource, /startSlotIndex: 0, targetSlotIndex: 1/);
  assert.match(autofillAnimationSource, /startSlotIndex: 0, targetSlotIndex: 2/);
  assert.match(autofillAnimationSource, /@keyframes autofill-loop-fade/);
  assert.match(autofillAnimationSource, /0%, \$\{FADE_IN_START_PERCENT\}% \{ opacity: 0; \}/);
  assert.match(autofillAnimationSource, /\$\{MOVE_START_PERCENT\}%, \$\{HOLD_END_PERCENT\}% \{ opacity: 1; \}/);
  assert.match(autofillAnimationSource, /100% \{ opacity: 0; \}/);
  assert.match(autofillAnimationSource, /@keyframes autofill-card-first/);
  assert.match(autofillAnimationSource, /@keyframes autofill-card-second/);
  assert.match(autofillAnimationSource, /animation: autofill-card-first \$\{LOOP_MS\}ms ease-in-out infinite/);
  assert.match(autofillAnimationSource, /animation: autofill-card-second \$\{LOOP_MS\}ms ease-in-out infinite/);
  assert.match(autofillAnimationSource, /prefers-reduced-motion/);

  assert.match(cleanupAnimationSource, /export const AnimatedCleanupLogo/);
  assert.match(cleanupAnimationSource, /const LINE_COUNT = 5/);
  assert.match(cleanupAnimationSource, /const MOVE_MS = 1500/);
  assert.match(cleanupAnimationSource, /const HOLD_MS = 2000/);
  assert.match(cleanupAnimationSource, /const START_DELAY_MS = 1000/);
  assert.match(cleanupAnimationSource, /const START_FADE_MS = 500/);
  assert.match(cleanupAnimationSource, /const RESET_FADE_MS = 500/);
  assert.match(cleanupAnimationSource, /const LOOP_MS = START_DELAY_MS \+ START_FADE_MS \+ MOVE_MS \+ HOLD_MS \+ RESET_FADE_MS/);
  assert.match(cleanupAnimationSource, /const LINE_TOP = 12/);
  assert.match(cleanupAnimationSource, /const CARD_HEIGHT = 18/);
  assert.match(cleanupAnimationSource, /const CARD_STACK_GAP = 8/);
  assert.match(cleanupAnimationSource, /const STACK_TOPS = \[LINE_TOP, LINE_TOP \+ CARD_HEIGHT \+ CARD_STACK_GAP\]/);
  assert.match(cleanupAnimationSource, /const END_SLOT_X_POSITION = LINE_CENTER_POSITIONS\[LINE_CENTER_POSITIONS\.length - 1\] \+ SLOT_SPACING/);
  assert.match(cleanupAnimationSource, /const SLOT_X_POSITIONS = \[START_SLOT_X_POSITION, \.\.\.BETWEEN_LINE_SLOT_X_POSITIONS, END_SLOT_X_POSITION\]/);
  assert.match(cleanupAnimationSource, /const cleanupTasks = \[/);
  assert.match(cleanupAnimationSource, /id: 'black-one', tone: 'black', startSlotIndex: 2, targetSlotIndex: 0, startStackIndex: 0, targetStackIndex: 0/);
  assert.match(cleanupAnimationSource, /id: 'gray-one', tone: 'gray', startSlotIndex: 2, targetSlotIndex: 5, startStackIndex: 1, targetStackIndex: 0/);
  assert.match(cleanupAnimationSource, /id: 'black-two', tone: 'black', startSlotIndex: 3, targetSlotIndex: 0, startStackIndex: 0, targetStackIndex: 1/);
  assert.match(cleanupAnimationSource, /id: 'gray-two', tone: 'gray', startSlotIndex: 3, targetSlotIndex: 5, startStackIndex: 1, targetStackIndex: 1/);
  assert.match(cleanupAnimationSource, /const stackIndex = phase === 'target' \? task\.targetStackIndex : task\.startStackIndex/);
  assert.match(cleanupAnimationSource, /@keyframes cleanup-loop-fade/);
  assert.match(cleanupAnimationSource, /@keyframes cleanup-card-black-one/);
  assert.match(cleanupAnimationSource, /@keyframes cleanup-card-gray-one/);
  assert.match(cleanupAnimationSource, /@keyframes cleanup-card-black-two/);
  assert.match(cleanupAnimationSource, /@keyframes cleanup-card-gray-two/);
  assert.match(cleanupAnimationSource, /\$\{MOVE_END_PERCENT\}% \{ transform: \$\{getTaskTransform\('black-one', 'target'\)\}; \}/);
  assert.match(cleanupAnimationSource, /\$\{MOVE_END_PERCENT\}% \{ transform: \$\{getTaskTransform\('gray-one', 'target'\)\}; \}/);
  assert.match(cleanupAnimationSource, /\$\{MOVE_END_PERCENT\}% \{ transform: \$\{getTaskTransform\('black-two', 'target'\)\}; \}/);
  assert.match(cleanupAnimationSource, /\$\{MOVE_END_PERCENT\}% \{ transform: \$\{getTaskTransform\('gray-two', 'target'\)\}; \}/);
  assert.match(cleanupAnimationSource, /animation: cleanup-card-black-one \$\{LOOP_MS\}ms ease-in-out infinite/);
  assert.match(cleanupAnimationSource, /bg-neutral-300 dark:bg-neutral-700/);
  assert.match(cleanupAnimationSource, /prefers-reduced-motion/);

  assert.match(i18nSource, /'welcome\.autofillTutorialTitle': 'Fill your week automatically'/);
  assert.match(i18nSource, /'welcome\.cleanupTutorialTitle': 'Clean up your board'/);
  assert.match(i18nSource, /'welcome\.autofillTutorialTitle': 'Fülle deine Woche automatisch'/);
  assert.match(i18nSource, /'welcome\.cleanupTutorialTitle': 'Räume dein Board auf'/);
});

test('week end reflection reminder reuses the bottom panel with two direct actions', () => {
  const appSource = readSource('App.tsx');
  const panelSource = readSource('components/InAppTutorialPanel.tsx');
  const i18nSource = readSource('i18n.tsx');
  const useStoreSource = readSource('hooks/useStore.ts');
  const planwerkFileSource = readSource('planwerkFile.cjs');

  assert.match(appSource, /shouldShowWeeklyReflectionReminderAfterCleanup/);
  assert.match(appSource, /shouldShowWeeklyReflectionReminderAfterTaskCompletion/);
  assert.match(appSource, /recordCleanupTutorialCompleted\(completedOnboarding, Date\.now\(\)\)/);
  assert.match(appSource, /const \[isWeeklyReflectionReminderOpen, setIsWeeklyReflectionReminderOpen\] = useState\(false\)/);
  assert.match(appSource, /const tasksAfterToggle = state\.tasks\.map/);
  assert.match(appSource, /completedTaskId: id/);
  assert.match(appSource, /cleanupBoard\(\);[\s\S]*if \(shouldOpenReflectionReminder\) \{[\s\S]*openWeeklyReflectionReminder\(\)/);
  assert.match(appSource, /reflection: true,[\s\S]*setViewMode\('reflection'\)/);
  assert.match(appSource, /secondaryButtonLabel=\{t\('weeklyReflectionReminder\.continue'\)\}/);
  assert.match(appSource, /visual=\{<AnimatedReflectionChoiceLogo \/>\}/);
  assert.match(appSource, /onContinue=\{\(\) => closeWeeklyReflectionReminder\(true\)\}/);
  assert.match(appSource, /onSecondary=\{\(\) => closeWeeklyReflectionReminder\(false\)\}/);

  assert.match(panelSource, /secondaryButtonLabel\?: string/);
  assert.match(panelSource, /onSecondary\?: \(\) => void/);
  assert.match(panelSource, /SecondaryButton/);
  assert.match(i18nSource, /'weeklyReflectionReminder\.title': 'Take a quick look back at your week'/);
  assert.match(i18nSource, /'weeklyReflectionReminder\.title': 'Schau kurz auf deine Woche zurück'/);
  assert.match(i18nSource, /'weeklyReflectionReminder\.body': 'Ein paar Minuten reichen: Halte fest, was dich wirklich weitergebracht hat\.'/);

  assert.match(useStoreSource, /weeklyReflectionReminderShown = false/);
  assert.match(useStoreSource, /cleanupTutorialCompletedAt: null/);
  assert.match(useStoreSource, /weeklyReflectionReminder:[\s\S]*shown: weeklyReflectionReminderShown/);
  assert.match(useStoreSource, /weeklyReflectionReminder\.shown[\s\S]*: true/);
  assert.match(planwerkFileSource, /weeklyReflectionReminder\.shown,[\s\S]*true/);
});

test('reflection lookback and goals open a main-area intro before the first view visit', () => {
  const appSource = readSource('App.tsx');
  const introSource = readSource('components/ViewIntroTutorialScreen.tsx');
  const reflectionAnimationSource = readSource('components/animations/AnimatedReflectionChoiceLogo.tsx');
  const lookbackAnimationSource = readSource('components/animations/AnimatedLookbackCompassLogo.tsx');
  const goalsAnimationSource = readSource('components/animations/AnimatedGoalsMagnetLogo.tsx');
  const animationIndexSource = readSource('components/animations/index.ts');
  const i18nSource = readSource('i18n.tsx');
  const useStoreSource = readSource('hooks/useStore.ts');
  const planwerkFileSource = readSource('planwerkFile.cjs');

  assert.match(useStoreSource, /const reflection = 'reflection' in tutorial && typeof tutorial\.reflection === 'boolean'/);
  assert.match(useStoreSource, /const lookback = 'lookback' in tutorial && typeof tutorial\.lookback === 'boolean'/);
  assert.match(useStoreSource, /const goals = 'goals' in tutorial && typeof tutorial\.goals === 'boolean'/);
  assert.match(planwerkFileSource, /reflection: normalizeBoolean\(tutorial\.reflection, `\$\{field\}\.tutorial\.reflection`, true\)/);
  assert.match(planwerkFileSource, /lookback: normalizeBoolean\(tutorial\.lookback, `\$\{field\}\.tutorial\.lookback`, true\)/);
  assert.match(planwerkFileSource, /goals: normalizeBoolean\(tutorial\.goals, `\$\{field\}\.tutorial\.goals`, true\)/);

  assert.match(appSource, /import \{ ViewIntroTutorialScreen \} from '\.\/components\/ViewIntroTutorialScreen';/);
  assert.match(appSource, /AnimatedReflectionChoiceLogo/);
  assert.match(appSource, /AnimatedLookbackCompassLogo/);
  assert.match(appSource, /AnimatedGoalsMagnetLogo/);
  assert.match(appSource, /type ViewIntroTutorialKey = 'reflection' \| 'lookback' \| 'goals'/);
  assert.match(appSource, /const VIEW_INTRO_TUTORIAL_VIEW: Record<ViewIntroTutorialKey, ViewMode> = \{/);
  assert.match(appSource, /lookback: 'charts'/);
  assert.match(appSource, /const \[pendingViewTutorial, setPendingViewTutorial\] = useState<ViewIntroTutorialKey \| null>\(null\)/);
  assert.match(appSource, /const effectiveViewMode = pendingViewTutorial \? VIEW_INTRO_TUTORIAL_VIEW\[pendingViewTutorial\] : viewMode/);
  assert.match(appSource, /const handleNavigateToView = useCallback\(\(targetView: ViewMode, tutorialKey\?: ViewIntroTutorialKey\) =>/);
  assert.match(appSource, /if \(tutorialKey && !state\.onboarding\.tutorial\[tutorialKey\]\) \{/);
  assert.match(appSource, /setPendingViewTutorial\(tutorialKey\)/);
  assert.match(appSource, /setViewMode\(targetView\)/);
  assert.match(appSource, /const completeViewIntroTutorial = useCallback/);
  assert.match(appSource, /\[pendingViewTutorial\]: true/);
  assert.match(appSource, /setViewMode\(VIEW_INTRO_TUTORIAL_VIEW\[pendingViewTutorial\]\)/);
  assert.match(appSource, /onClick=\{\(\) => handleNavigateToView\('reflection', 'reflection'\)\}/);
  assert.match(appSource, /onClick=\{\(\) => handleNavigateToView\('charts', 'lookback'\)\}/);
  assert.match(appSource, /onClick=\{\(\) => handleNavigateToView\('goals', 'goals'\)\}/);
  assert.match(appSource, /pendingViewTutorial \? \(/);
  assert.match(appSource, /<ViewIntroTutorialScreen/);
  assert.match(appSource, /title=\{t\(VIEW_INTRO_TUTORIAL_COPY\[pendingViewTutorial\]\.title\)\}/);
  assert.match(appSource, /buttonLabel=\{t\('viewIntroTutorial\.button'\)\}/);
  assert.match(appSource, /visual=\{\s*pendingViewTutorial === 'reflection'\s*\? <AnimatedReflectionChoiceLogo \/>\s*: pendingViewTutorial === 'lookback'\s*\? <AnimatedLookbackCompassLogo \/>\s*: pendingViewTutorial === 'goals'\s*\? <AnimatedGoalsMagnetLogo \/>\s*: undefined\s*\}/);
  assert.match(appSource, /onContinue=\{completeViewIntroTutorial\}/);

  assert.match(introSource, /export interface ViewIntroTutorialScreenProps/);
  assert.match(introSource, /AnimatedBoardReadyLogo/);
  assert.match(introSource, /view-intro-tutorial-reveal/);
  assert.match(introSource, /@keyframes view-intro-tutorial-reveal/);
  assert.match(introSource, /prefers-reduced-motion/);
  assert.match(introSource, /max-w-2xl text-3xl font-black leading-tight tracking-tight md:text-4xl/);
  assert.doesNotMatch(introSource, /max-w-2xl text-3xl font-black uppercase leading-tight tracking-tight md:text-4xl/);
  assert.match(introSource, /mt-4 max-w-xl text-sm font-medium leading-relaxed/);
  assert.match(introSource, /mb-6 scale-75/);
  assert.match(introSource, /PrimaryButton/);

  assert.match(animationIndexSource, /export \{ AnimatedReflectionChoiceLogo \} from '\.\/AnimatedReflectionChoiceLogo';/);
  assert.match(animationIndexSource, /export \{ AnimatedLookbackCompassLogo \} from '\.\/AnimatedLookbackCompassLogo';/);
  assert.match(animationIndexSource, /export \{ AnimatedGoalsMagnetLogo \} from '\.\/AnimatedGoalsMagnetLogo';/);
  assert.match(reflectionAnimationSource, /export const AnimatedReflectionChoiceLogo/);
  assert.match(reflectionAnimationSource, /const CHOICE_COUNT = 3/);
  assert.match(reflectionAnimationSource, /const ACTIVE_MS = 300/);
  assert.match(reflectionAnimationSource, /const PAUSE_MS = 1000/);
  assert.match(reflectionAnimationSource, /const TRANSITION_MS = 200/);
  assert.match(reflectionAnimationSource, /Math\.floor\(Math\.random\(\) \* CHOICE_COUNT\)/);
  assert.match(reflectionAnimationSource, /scale-95/);
  assert.match(reflectionAnimationSource, /bg-neutral-950 dark:bg-neutral-100/);
  assert.match(reflectionAnimationSource, /bg-neutral-300 dark:bg-neutral-700/);
  assert.match(reflectionAnimationSource, /border-neutral-300/);
  assert.match(reflectionAnimationSource, /transition-\[transform,background-color,border-color\]/);
  assert.match(reflectionAnimationSource, /prefersReducedMotion/);

  assert.match(lookbackAnimationSource, /export const AnimatedLookbackCompassLogo/);
  assert.match(lookbackAnimationSource, /const COMPASS_WIDTH = 512/);
  assert.match(lookbackAnimationSource, /const COMPASS_HEIGHT = 160/);
  assert.match(lookbackAnimationSource, /const COMPASS_DOT_SIZE = 20/);
  assert.match(lookbackAnimationSource, /const COMPASS_GRID_STEP = 26/);
  assert.match(lookbackAnimationSource, /const DIRECTION_SEQUENCE = \[-35, 28, -12, 0\]/);
  assert.match(lookbackAnimationSource, /const COMPASS_DOT_POLARS/);
  assert.match(lookbackAnimationSource, /createCompassDot/);
  assert.match(lookbackAnimationSource, /axis \* COMPASS_GRID_STEP/);
  assert.match(lookbackAnimationSource, /lane \* COMPASS_GRID_STEP/);
  assert.match(lookbackAnimationSource, /Math\.atan2\(laneOffset, axisOffset\)/);
  assert.match(lookbackAnimationSource, /angleOffset/);
  assert.match(lookbackAnimationSource, /Math\.cos\(angleRadians\) \* dot\.radius/);
  assert.match(lookbackAnimationSource, /Math\.sin\(angleRadians\) \* dot\.radius/);
  assert.match(lookbackAnimationSource, /setDirection\(DIRECTION_SEQUENCE\[nextIndex\]\)/);
  assert.match(lookbackAnimationSource, /cubic-bezier\(0\.2, 0\.85, 0\.2, 1\)/);
  assert.match(lookbackAnimationSource, /className="relative h-40 w-\[32rem\]"/);
  assert.match(lookbackAnimationSource, /prefersReducedMotion/);

  assert.match(goalsAnimationSource, /export const AnimatedGoalsMagnetLogo/);
  assert.match(goalsAnimationSource, /const GOALS_ARROW_COUNT = 3/);
  assert.match(goalsAnimationSource, /const HOLD_MS = 900/);
  assert.match(goalsAnimationSource, /const SETTLE_MS = 900/);
  assert.match(goalsAnimationSource, /const FOCUS_PROBABILITY = 0\.55/);
  assert.match(goalsAnimationSource, /const ARROW_SQUARE_SIZE = 14/);
  assert.match(goalsAnimationSource, /const ARROW_GRID_STEP = 18/);
  assert.match(goalsAnimationSource, /const ARROW_CANVAS_SIZE = 128/);
  assert.match(goalsAnimationSource, /const SOFT_ARROW_BLUR = 'blur\(1\.8px\)'/);
  assert.match(goalsAnimationSource, /const ARROW_DIRECTIONS = \[-135, -90, -45\]/);
  assert.match(goalsAnimationSource, /const ARROW_SQUARES/);
  assert.match(goalsAnimationSource, /type ArrowState = 'focused' \| 'soft'/);
  assert.match(goalsAnimationSource, /const createArrowSquare = \(id: string, axis: number, lane: number\)/);
  assert.match(goalsAnimationSource, /x: ARROW_CANVAS_SIZE \/ 2 \+ axis \* ARROW_GRID_STEP - ARROW_SQUARE_SIZE \/ 2/);
  assert.match(goalsAnimationSource, /y: ARROW_CANVAS_SIZE \/ 2 \+ lane \* ARROW_GRID_STEP - ARROW_SQUARE_SIZE \/ 2/);
  assert.match(goalsAnimationSource, /const pickNextArrowState = \(\): ArrowState =>/);
  assert.match(goalsAnimationSource, /Math\.random\(\) < FOCUS_PROBABILITY/);
  assert.match(goalsAnimationSource, /const updateOneRandomArrow = \(currentStates: ArrowState\[\]\): ArrowState\[\] =>/);
  assert.match(goalsAnimationSource, /const selectedIndex = Math\.floor\(Math\.random\(\) \* GOALS_ARROW_COUNT\)/);
  assert.match(goalsAnimationSource, /nextStates\[selectedIndex\] = pickNextArrowState\(\)/);
  assert.match(goalsAnimationSource, /setArrowStates\(currentStates => updateOneRandomArrow\(currentStates\)\)/);
  assert.match(goalsAnimationSource, /bg-neutral-950 dark:bg-neutral-100/);
  assert.match(goalsAnimationSource, /bg-neutral-300 dark:bg-neutral-700/);
  assert.match(goalsAnimationSource, /transform: `rotate\(\$\{ARROW_DIRECTIONS\[index\]\}deg\) \$\{isSoft \? 'scale\(0\.96\)' : 'scale\(1\)'\}`/);
  assert.match(goalsAnimationSource, /filter: isSoft \? SOFT_ARROW_BLUR : 'blur\(0px\)'/);
  assert.match(goalsAnimationSource, /transition: prefersReducedMotion\s*\? 'none'\s*: `background-color \$\{SETTLE_MS\}ms cubic-bezier\(0\.2, 0\.85, 0\.2, 1\), opacity \$\{SETTLE_MS\}ms cubic-bezier\(0\.2, 0\.85, 0\.2, 1\), filter \$\{SETTLE_MS\}ms cubic-bezier\(0\.2, 0\.85, 0\.2, 1\), transform \$\{SETTLE_MS\}ms cubic-bezier\(0\.2, 0\.85, 0\.2, 1\)`/);
  assert.doesNotMatch(goalsAnimationSource, /clipPath/);
  assert.doesNotMatch(goalsAnimationSource, /GoalAction/);
  assert.doesNotMatch(goalsAnimationSource, /GOAL_BAR_DELAY_MS/);
  assert.doesNotMatch(goalsAnimationSource, /collapsedGoalIds/);
  assert.match(goalsAnimationSource, /prefersReducedMotion/);

  assert.match(i18nSource, /'viewIntroTutorial\.button': 'Alles klar, los gehts'/);
  assert.match(i18nSource, /'viewIntroTutorial\.reflectionTitle': 'Nimm Erfolge wahr'/);
  assert.match(i18nSource, /Bewerte erledigte Aufgaben mit 1, 2 oder 3 in wenigen Minuten/);
  assert.match(i18nSource, /'viewIntroTutorial\.lookbackTitle': 'Erkenne deine Muster'/);
  assert.match(i18nSource, /Der Rückblick ist wie ein Kompass für dich/);
  assert.match(i18nSource, /'viewIntroTutorial\.goalsTitle': 'Gib deiner Woche Richtung'/);
  assert.match(i18nSource, /Ziele helfen dir zu erkennen, was dir wirklich wichtig ist und was nicht/);
  assert.match(i18nSource, /Goals help you recognize what really matters to you and what does not/);
  assert.match(i18nSource, /Notice your wins/);
  assert.match(i18nSource, /Lookback is like a compass for you/);
});

test('create task title step uses a focused task field animation', () => {
  const createTaskSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');
  const animationSource = readSource('components/animations/AnimatedTaskTitleFocusLogo.tsx');

  assert.match(createTaskSource, /AnimatedTaskTitleFocusLogo,[\s\S]*from '\.\/animations';/);
  assert.match(createTaskSource, /const activeAnimation = copyField === 'title'/);
  assert.match(createTaskSource, /\? <AnimatedTaskTitleFocusLogo \/>/);

  assert.match(animationSource, /const FOCUS_SEGMENT_COUNT = 5/);
  assert.match(animationSource, /const MIN_SWITCH_MS = 1000/);
  assert.match(animationSource, /const MAX_SWITCH_MS = 2000/);
  assert.match(animationSource, /Math\.random\(\) \* \(MAX_SWITCH_MS - MIN_SWITCH_MS\)/);
  assert.match(animationSource, /prefers-reduced-motion/);
  assert.match(animationSource, /renderedActiveSegment === 0/);
  assert.match(animationSource, /renderedActiveSegment === index \+ 1/);
  assert.match(animationSource, /w-44/);
  assert.match(animationSource, /grid-cols-4/);
});

test('create task duration step uses an overlong bar splitting animation', () => {
  const createTaskSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');
  const animationSource = readSource('components/animations/AnimatedTaskDurationSplitLogo.tsx');

  assert.match(createTaskSource, /AnimatedTaskDurationSplitLogo,[\s\S]*from '\.\/animations';/);
  assert.match(createTaskSource, /copyField === 'duration' \? <AnimatedTaskDurationSplitLogo \/>/);
  assert.doesNotMatch(createTaskSource, /<AnimatedTaskDurationSplitLogo size="compact" \/>/);

  assert.match(animationSource, /const SEPARATOR_COUNT = 2/);
  assert.match(animationSource, /size\?: 'default' \| 'compact'/);
  assert.match(animationSource, /size = 'default'/);
  assert.match(animationSource, /size === 'compact'/);
  assert.match(animationSource, /const PIVOT_X_PERCENT = 92/);
  assert.match(animationSource, /transform-origin: \$\{PIVOT_X_PERCENT\}% 50%/);
  assert.match(animationSource, /transform-origin: left center/);
  assert.match(animationSource, /@keyframes duration-bar-transform/);
  assert.match(animationSource, /@keyframes duration-bar-tilt/);
  assert.match(animationSource, /const ANIMATION_DURATION_MS = 5800/);
  assert.doesNotMatch(animationSource, /scaleX\(0\.7\)/);
  assert.match(animationSource, /0%, 34%/);
  assert.match(animationSource, /92%/);
  assert.match(animationSource, /94%/);
  assert.match(animationSource, /scaleX\(1\)/);
  assert.match(animationSource, /scaleX\(0\)/);
  assert.match(animationSource, /rotate\(-5deg\)/);
  assert.match(animationSource, /cubic-bezier\(0\.2, 0\.85, 0\.2, 1\)/);
  assert.match(animationSource, /@keyframes duration-separator-reveal/);
  assert.match(animationSource, /bg-white dark:bg-neutral-950/);
  assert.match(animationSource, /prefersReducedMotion/);
});

test('create task priority step uses eight simultaneous bars with calm priority offsets', () => {
  const createTaskSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');
  const animationSource = readSource('components/animations/AnimatedTaskPriorityLogo.tsx');

  assert.match(createTaskSource, /AnimatedTaskPriorityLogo,[\s\S]*from '\.\/animations';/);
  assert.match(createTaskSource, /copyField === 'priority' \? <AnimatedTaskPriorityLogo \/>/);

  assert.match(animationSource, /const PRIORITY_RECTANGLE_COUNT = 8/);
  assert.match(animationSource, /const BASE_PRIORITY = 3/);
  assert.match(animationSource, /const MAX_PRIORITY_OFFSET_PX = 8/);
  assert.match(animationSource, /const HOLD_MS = 2000/);
  assert.match(animationSource, /Math\.floor\(Math\.random\(\) \* 5\) \+ 1/);
  assert.match(animationSource, /priorityToOffset/);
  assert.match(animationSource, /BASE_PRIORITY - priority/);
  assert.match(animationSource, /setIsVisible\(true\)/);
  assert.match(animationSource, /setIsVisible\(false\)/);
  assert.match(animationSource, /activeIndex/);
  assert.match(animationSource, /Array\.from\(\{ length: PRIORITY_RECTANGLE_COUNT \}/);
  assert.match(animationSource, /bg-neutral-950 dark:bg-neutral-100/);
  assert.match(animationSource, /transition-\[transform,opacity\]/);
  assert.match(animationSource, /prefersReducedMotion/);
});

test('create task due date step uses a synced timeline marker animation', () => {
  const createTaskSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');
  const animationSource = readSource('components/animations/AnimatedTaskDueDateLogo.tsx');

  assert.match(createTaskSource, /AnimatedTaskDueDateLogo,[\s\S]*from '\.\/animations';/);
  assert.match(createTaskSource, /copyField === 'dueDate' \? <AnimatedTaskDueDateLogo \/>/);

  assert.match(animationSource, /const TIMELINE_GROW_MS = 3000/);
  assert.match(animationSource, /const MIN_MARKER_PERCENT = 18/);
  assert.match(animationSource, /const MAX_MARKER_PERCENT = 82/);
  assert.match(animationSource, /const FADE_OUT_MS = 300/);
  assert.match(animationSource, /Math\.random\(\) \* \(MAX_MARKER_PERCENT - MIN_MARKER_PERCENT\)/);
  assert.match(animationSource, /markerDelayMs/);
  assert.match(animationSource, /markerPercent \/ 100 \* TIMELINE_GROW_MS/);
  assert.match(animationSource, /setMarkerVisible\(true\)/);
  assert.match(animationSource, /setTimelineVisible\(false\)/);
  assert.match(animationSource, /transformOrigin: 'left center'/);
  assert.match(animationSource, /transition: renderedTimelineVisible \? `transform \$\{TIMELINE_GROW_MS\}ms linear` : 'none'/);
  assert.match(animationSource, /transition-opacity duration-300/);
  assert.match(animationSource, /left: `\$\{renderedMarkerPercent\}%`/);
  assert.match(animationSource, /bg-neutral-300 dark:bg-neutral-700/);
  assert.match(animationSource, /bg-neutral-950 dark:bg-neutral-100/);
  assert.match(animationSource, /prefersReducedMotion/);
});

test('create task project step uses a dropdown option animation', () => {
  const createTaskSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');
  const animationSource = readSource('components/animations/AnimatedTaskProjectDropdownLogo.tsx');

  assert.match(createTaskSource, /AnimatedTaskProjectDropdownLogo,[\s\S]*from '\.\/animations';/);
  assert.match(createTaskSource, /copyField === 'project' \? <AnimatedTaskProjectDropdownLogo \/>/);

  assert.match(animationSource, /const OPTION_COUNT = 3/);
  assert.match(animationSource, /const TAP_STEP_MS = 300/);
  assert.match(animationSource, /const OPEN_HOLD_MS = 2000/);
  assert.match(animationSource, /const CLOSED_HOLD_MS = 2000/);
  assert.match(animationSource, /const HANDOFF_OVERLAP_MS = 420/);
  assert.match(animationSource, /Math\.floor\(Math\.random\(\) \* OPTION_COUNT\)/);
  assert.match(animationSource, /setOptionsVisible\(true\)/);
  assert.match(animationSource, /setOptionsVisible\(false\)/);
  assert.match(animationSource, /activeOptionIndex/);
  assert.match(animationSource, /const CLOSED_TOP_OFFSET_PX = 38/);
  assert.match(animationSource, /const OPEN_TOP_OFFSET_PX = 0/);
  assert.match(animationSource, /const rootOffsetPx = renderedOptionsVisible \? OPEN_TOP_OFFSET_PX : CLOSED_TOP_OFFSET_PX/);
  assert.match(animationSource, /const isRootActive = renderedActiveOptionIndex < 0 \|\| handoffActive/);
  assert.match(animationSource, /const closingOptionIndex = !renderedOptionsVisible && renderedActiveOptionIndex >= 0 \? renderedActiveOptionIndex : null/);
  assert.match(animationSource, /const isClosingSelectedOption = closingOptionIndex === index/);
  assert.match(animationSource, /setHandoffActive\(true\)/);
  assert.match(animationSource, /setHandoffActive\(false\)/);
  assert.match(animationSource, /Array\.from\(\{ length: OPTION_COUNT \}/);
  assert.match(animationSource, /translateY\(\$\{optionOffsetPx\}px\)/);
  assert.match(animationSource, /isClosingSelectedOption \? 'z-20 opacity-100'/);
  assert.match(animationSource, /bg-neutral-950 dark:bg-neutral-100/);
  assert.match(animationSource, /bg-neutral-300 dark:bg-neutral-700/);
  assert.match(animationSource, /transition-transform duration-300/);
  assert.match(animationSource, /transition-\[transform,opacity,background-color\]/);
  assert.match(animationSource, /prefersReducedMotion/);
});

test('create task onboarding separates the one-time Enter hint from the contextual Tab hint', () => {
  const createTaskSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(createTaskSource, /import \{ InAppTutorialPanel \} from '\.\/InAppTutorialPanel';/);
  assert.match(createTaskSource, /AnimatedTabKeyLogo,[\s\S]*from '\.\/animations';/);
  assert.match(createTaskSource, /const \[hasUsedTabToAdvance, setHasUsedTabToAdvance\] = React\.useState\(false\)/);
  assert.match(createTaskSource, /const \[hasShownEnterHint, setHasShownEnterHint\] = React\.useState\(false\)/);
  assert.match(createTaskSource, /type KeyboardHintState =[\s\S]*reason: 'enter'; returnField: TaskOnboardingField[\s\S]*reason: 'dueDate'/);
  assert.match(createTaskSource, /const \[keyboardHint, setKeyboardHint\] = React\.useState<KeyboardHintState>\(null\)/);
  assert.match(createTaskSource, /onKeyDownCapture=\{handleOnboardingKeyDownCapture\}/);
  assert.match(createTaskSource, /e\.key === 'Enter'[\s\S]*!e\.nativeEvent\.isComposing/);
  assert.match(createTaskSource, /const targetField = ONBOARDING_FIELDS\.find\(field => fieldRefs\.current\[field\] === e\.target\)/);
  assert.match(createTaskSource, /isSelectingProjectOption/);
  assert.match(createTaskSource, /handleContinue\(!hasShownEnterHint\)/);
  assert.match(createTaskSource, /const handleContinue = React\.useCallback\(\(showEnterHint = false\) =>/);
  assert.match(createTaskSource, /updateActiveField\(nextField\);[\s\S]*if \(showEnterHint\) \{[\s\S]*setHasShownEnterHint\(true\);[\s\S]*setKeyboardHint\(\{ reason: 'enter', returnField: nextField \}\)/);
  assert.match(createTaskSource, /focusField\(keyboardHint\.returnField\)/);
  assert.match(createTaskSource, /if \(e\.key === 'Tab' && !e\.shiftKey\) \{/);
  assert.match(createTaskSource, /setHasUsedTabToAdvance\(true\)/);
  assert.match(createTaskSource, /if \(keyboardHint\) \{/);
  assert.match(createTaskSource, /if \(e\.key === 'Tab'\) \{[\s\S]*setHasUsedTabToAdvance\(true\);[\s\S]*dismissKeyboardHint\(\)/);
  assert.doesNotMatch(createTaskSource, /e\.key === 'Tab' \|\| e\.key === 'Enter'/);
  assert.match(createTaskSource, /e\.preventDefault\(\)/);
  assert.match(createTaskSource, /dismissKeyboardHint\(\)/);
  assert.match(createTaskSource, /const handleOnboardingPointerDownCapture = React\.useCallback/);
  assert.match(createTaskSource, /if \(target === fieldRefs\.current\.dueDate && !hasUsedTabToAdvance && activeField !== 'dueDate'\) \{/);
  assert.match(createTaskSource, /onPointerDownCapture=\{handleOnboardingPointerDownCapture\}/);
  assert.match(createTaskSource, /activeField === 'priority' && nextField === 'dueDate' && !hasUsedTabToAdvance/);
  assert.match(createTaskSource, /setKeyboardHint\(\{ reason: 'dueDate' \}\)/);
  assert.match(createTaskSource, /if \(keyboardHint\.reason === 'dueDate'\) \{[\s\S]*updateActiveField\('dueDate'\);[\s\S]*focusField\('dueDate'\)/);
  assert.match(createTaskSource, /<InAppTutorialPanel/);
  assert.match(createTaskSource, /title=\{t\(keyboardHint\.reason === 'enter' \? 'welcome\.enterHintTitle' : 'welcome\.tabHintTitle'\)\}/);
  assert.match(createTaskSource, /body=""/);
  assert.match(createTaskSource, /buttonLabel=\{t\('welcome\.tabHintOk'\)\}/);
  assert.match(createTaskSource, /visual=\{<AnimatedTabKeyLogo variant=\{keyboardHint\.reason === 'enter' \? 'combined' : 'tab'\} \/>}/);
  assert.match(createTaskSource, /onContinue=\{dismissKeyboardHint\}/);
  assert.match(createTaskSource, /onClick=\{\(\) => handleContinue\(\)\}/);

  assert.match(i18nSource, /'welcome\.enterHintTitle': 'Enter usually saves the whole task\. In onboarding, it only takes you to the next field\. Tab works too\.'/);
  assert.match(i18nSource, /'welcome\.tabHintTitle': 'Press Tab to get to the next field faster\.'/);
  assert.match(i18nSource, /'welcome\.tabHintOk': 'Ok'/);
  assert.match(i18nSource, /'welcome\.enterHintTitle': 'Enter speichert normalerweise die ganze Aufgabe\. Im Onboarding bringt es dich nur zum nächsten Feld\. Tab funktioniert auch\.'/);
  assert.match(i18nSource, /'welcome\.tabHintTitle': 'Drücke Tab, um schneller ins nächste Feld zu gelangen\.'/);
  assert.match(i18nSource, /'welcome\.tabHintOk': 'Ok'/);
});

test('keyboard hint animation presses Enter before Tab and respects reduced motion', () => {
  const animationIndexSource = readSource('components/animations/index.ts');
  const animationSource = readSource('components/animations/AnimatedTabKeyLogo.tsx');
  const keyboardKeysSource = readSource('components/animations/AnimatedKeyboardKeys.tsx');

  assert.match(animationIndexSource, /export \{ AnimatedTabKeyLogo \} from '\.\/AnimatedTabKeyLogo';/);
  assert.match(animationIndexSource, /export \{ AnimatedKeyboardKeys \} from '\.\/AnimatedKeyboardKeys';/);
  assert.match(animationSource, /export const AnimatedTabKeyLogo/);
  assert.match(animationSource, /const PRESS_INTERVAL_MS = 3200/);
  assert.match(animationSource, /variant\?: 'combined' \| 'tab'/);
  assert.match(animationSource, /const isTabOnly = variant === 'tab'/);
  assert.match(animationSource, /<AnimatedKeyboardKeys/);
  assert.match(animationSource, /mode=\{isTabOnly \? 'single' : 'sequential'\}/);
  assert.ok(animationSource.indexOf("label: 'Enter'") < animationSource.lastIndexOf("label: 'Tab'"));
  assert.match(animationSource, /symbol: '↵'/);
  assert.match(animationSource, /symbol: '->\|'/);
  assert.match(keyboardKeysSource, /type AnimatedKeyboardKeysMode = 'single' \| 'simultaneous' \| 'sequential'/);
  assert.match(keyboardKeysSource, /@keyframes animated-keyboard-key-press/);
  assert.match(keyboardKeysSource, /mode === 'sequential' \? index \* SEQUENTIAL_PRESS_DELAY_MS : 0/);
  assert.match(keyboardKeysSource, /animation: prefersReducedMotion[\s\S]*\? 'none'/);
  assert.match(keyboardKeysSource, /translateY\(3px\) scale\(0\.98\)/);
  assert.match(keyboardKeysSource, /box-shadow: 1px 1px 0 rgba\(0, 0, 0, 0\.18\)/);
});


test('new planwerk files use the resolved interface language for initial projects', () => {
  const appSource = readSource('App.tsx');

  assert.match(appSource, /const \{ t, language: resolvedLanguage \} = useI18n\(\);/);
  assert.match(appSource, /createPlanwerkFile\(resolvedLanguage\)/);
  assert.match(appSource, /onCreatePlanwerkFile=\{handleCreatePlanwerkFileFromSettings\}/);
});

test('initial planwerk loading does not flash the welcome screen for existing files', () => {
  const appSource = readSource('App.tsx');

  assert.match(appSource, /if \(storageStatus\.isLoading && !storageStatus\.needsFileSelection && !storageStatus\.hasOpenFile\)/);
  assert.match(appSource, /aria-label=\{t\('file\.loading'\)\}/);
  assert.match(appSource, /if \(!storageStatus\.hasOpenFile \|\| storageStatus\.needsFileSelection \|\| shouldShowIntroOnboarding \|\| shouldShowWorkWeekOnboarding\)/);
});

test('work week setup uses the half-time headline with its own time animation', () => {
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');
  const workWeekAnimationSource = readSource('components/animations/AnimatedWorkWeekTimeLogo.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(welcomeSource, /import \{ AnimatedPlanwerkLogo, AnimatedWorkWeekTimeLogo \} from '\.\/animations';/);
  assert.match(welcomeSource, /<AnimatedWorkWeekTimeLogo \/>/);
  assert.match(welcomeSource, /<AnimatedPlanwerkLogo \/>/);
  assert.match(welcomeSource, /workweek-onboarding-stage/);
  assert.match(welcomeSource, /workweek-intro-shift/);
  assert.match(welcomeSource, /workweek-settings-center/);
  assert.match(welcomeSource, /workweek-continue-position/);
  assert.match(welcomeSource, /@keyframes workweek-intro-shift/);
  assert.match(welcomeSource, /top: calc\(50% - clamp\(11rem, 28vh, 16rem\)\)/);
  assert.match(welcomeSource, /top: calc\(50% \+ clamp\(1rem, 3vh, 2rem\)\)/);
  assert.match(welcomeSource, /top: calc\(50% \+ clamp\(11rem, 26vh, 14rem\)\)/);
  assert.match(welcomeSource, /mt-20 w-full/);
  assert.match(workWeekAnimationSource, /const RECTANGLE_COUNT = 8/);
  assert.match(workWeekAnimationSource, /const BLACK_RECTANGLE_COUNT = 4/);
  assert.match(workWeekAnimationSource, /const BLACK_FILL_START_STEP = 6/);
  assert.match(workWeekAnimationSource, /const HOLD_MS = 3000/);
  assert.match(workWeekAnimationSource, /prefers-reduced-motion/);
  assert.match(workWeekAnimationSource, /Array\.from\(\{ length: RECTANGLE_COUNT \}/);
  assert.match(workWeekAnimationSource, /index < BLACK_RECTANGLE_COUNT/);
  assert.match(i18nSource, /'welcome\.workWeekTitle': 'Half your time is enough\.'/);
  assert.match(i18nSource, /'welcome\.workWeekTitle': 'Die Hälfte deiner Zeit reicht\.'/);
  assert.doesNotMatch(i18nSource, /'welcome\.workWeekTitle': 'Wie sieht deine Arbeitswoche aus\?'/);
});

test('welcome and work week content reveal in calm sequential sections', () => {
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');

  assert.match(welcomeSource, /OnboardingReveal/);
  assert.match(welcomeSource, /const screenKey = mode/);
  assert.match(welcomeSource, /@keyframes onboarding-reveal/);
  assert.match(welcomeSource, /translateY\(12px\)/);
  assert.match(welcomeSource, /animation: `onboarding-reveal 1s ease-out \$\{delaySeconds\}s forwards`/);
  assert.match(welcomeSource, /<OnboardingReveal key=\{`title-\$\{screenKey\}`\} delaySeconds=\{0\.5\}>/);
  assert.match(welcomeSource, /<OnboardingReveal key=\{`body-\$\{screenKey\}`\} delaySeconds=\{0\.7\}>/);
  assert.match(welcomeSource, /<OnboardingReveal key=\{`actions-\$\{screenKey\}`\} delaySeconds=\{3\.7\}>/);
  assert.match(welcomeSource, /<OnboardingReveal key=\{`continue-\$\{screenKey\}`\} delaySeconds=\{3\.9\}>/);
});

test('new planwerk defaults use weekdays with four hours and hidden weekend hours', () => {
  const constantsSource = readSource('constants.ts');

  assert.match(constantsSource, /export const DEFAULT_MAX_HOURS_PER_DAY = 4/);
  assert.match(constantsSource, /export const DEFAULT_VISIBLE_DAYS: DayColumnId\[\] = \['mon', 'tue', 'wed', 'thu', 'fri'\]/);
  assert.match(constantsSource, /sat: 0/);
  assert.match(constantsSource, /sun: 0/);
});

test('animated planwerk logo uses five tight random stepped bars without an app-icon box', () => {
  const source = readSource('components/animations/AnimatedPlanwerkLogo.tsx');

  assert.match(source, /const BAR_COUNT = 5/);
  assert.match(source, /const GRAY_STEP_DELAY_MS = 1500/);
  assert.match(source, /const GRAY_START_DELAY_MS = 1000/);
  assert.match(source, /Array\.from\(\{ length: BAR_COUNT \}/);
  assert.match(source, /60 \+ Math\.random\(\) \* 40/);
  assert.match(source, /Math\.random\(\)/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /grayFillPercent/);
  assert.match(source, /className="flex h-40/);
  assert.match(source, /gap-1/);
  assert.match(source, /className="relative w-4/);
  assert.doesNotMatch(source, /rounded-\[/);
  assert.doesNotMatch(source, /shadow-\[/);
  assert.doesNotMatch(source, /border-2/);
});

test('shared buttons accept icons without custom button markup on the welcome screen', () => {
  const buttonSource = readSource('components/Buttons.tsx');
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');

  assert.match(buttonSource, /icon\?: React\.ReactNode/);
  assert.match(buttonSource, /renderButtonContent/);
  assert.match(welcomeSource, /<PrimaryButton[\s\S]*icon=\{<IconPlus \/>}/);
  assert.match(welcomeSource, /<SecondaryButton[\s\S]*icon=\{<IconFolderOpen \/>}/);
  assert.match(welcomeSource, /<PrimaryButton[\s\S]*className="w-auto !px-6 !py-2 text-xs"[\s\S]*t\('welcome\.continueToBoard'\)/);
  assert.match(welcomeSource, /mt-8 flex w-full max-w-sm flex-col gap-3/);
  assert.doesNotMatch(welcomeSource, /sm:flex-row/);
});

test('welcome copy is localized in calm onboarding language', () => {
  const source = readSource('i18n.tsx');

  assert.match(source, /'file\.welcomeTitle': 'Welcome to Planwerk'/);
  assert.match(source, /'file\.welcomeBody': 'Planwerk helps you spend five minutes a day planning the right things/);
  assert.match(source, /'file\.welcomeTitle': 'Willkommen bei Planwerk'/);
  assert.match(source, /'file\.welcomeBody': 'Planwerk hilft dir, mit fünf Minuten Planung am Tag an den richtigen Dingen zu arbeiten/);
  assert.doesNotMatch(source, /file\.welcomeFileHint/);
});
