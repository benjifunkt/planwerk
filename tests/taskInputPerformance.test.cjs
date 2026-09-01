const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const readSource = (relativePath) => (
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
);

test('task modal uses a theme-aware static overlay instead of backdrop blur', () => {
  const source = readSource('components/TaskCreateModal.tsx');

  assert.match(source, /const TaskModalBackdrop = React\.memo/);
  assert.match(source, /export const TaskModalForm: React\.FC/);
  assert.match(source, /bg-white\/95 dark:bg-neutral-950\/95/);
  assert.match(source, /shadow-\[0px_0px_200px_200px_rgba\(255,255,255,0\.8\)\]/);
  assert.match(source, /dark:shadow-\[0px_0px_200px_200px_rgba\(15,15,15,0\.8\)\]/);
  assert.match(source, /if \(!isOpen\) return null/);
  assert.doesNotMatch(source, /TASK_MODAL_TRANSITION_MS/);
  assert.doesNotMatch(source, /shouldRender/);
  assert.doesNotMatch(source, /isClosing/);
  assert.doesNotMatch(source, /task-modal-enter/);
  assert.doesNotMatch(source, /task-modal-exit/);
  assert.doesNotMatch(source, /task-modal-slide-in/);
  assert.doesNotMatch(source, /task-modal-slide-out/);
  assert.doesNotMatch(source, /transition-\[opacity,background-color\]/);
  assert.doesNotMatch(source, /backdrop-blur-sm/);
  assert.doesNotMatch(source, /backdrop-filter/);
  assert.match(source, /export const TaskCreateModal = React\.memo/);
});

test('task modal form can run inline for create task onboarding without changing modal backdrop behavior', () => {
  const source = readSource('components/TaskCreateModal.tsx');
  const onboardingSource = readSource('components/PlanwerkCreateTaskOnboardingScreen.tsx');

  assert.match(source, /export type TaskOnboardingField = 'title' \| 'duration' \| 'priority' \| 'dueDate' \| 'project'/);
  assert.match(source, /variant\?: 'modal' \| 'onboarding'/);
  assert.match(source, /activeOnboardingField\?: TaskOnboardingField/);
  assert.match(source, /onOnboardingFieldFocus\?: \(field: TaskOnboardingField\) => void/);
  assert.match(source, /onRegisterOnboardingField\?: \(field: TaskOnboardingField, element: HTMLInputElement \| null\) => void/);
  assert.match(source, /onRegisterOnboardingContinue\?: \(handler: \(\) => boolean\) => void/);
  assert.match(source, /variant === 'onboarding'/);
  assert.match(source, /opacity-25/);
  assert.match(source, /opacity-100/);
  assert.match(source, /return false/);
  assert.match(source, /titleInputRef\.current\?\.focus\(\)/);
  assert.match(source, /hideFooter/);
  assert.match(source, /hideTitle/);

  assert.match(onboardingSource, /const continueHandlerRef = React\.useRef<\(\(\) => boolean\) \| null>\(null\)/);
  assert.match(onboardingSource, /continueHandlerRef\.current\?\.\(\) \?\? true/);
  assert.match(onboardingSource, /focusField\(nextField\)/);
  assert.match(onboardingSource, /onRegisterOnboardingContinue=\{\(handler\) => \{/);
  assert.match(onboardingSource, /onRegisterOnboardingField=\{handleRegisterField\}/);
});

test('task modal shows an inline title validation hint instead of native required popup', () => {
  const source = readSource('components/TaskCreateModal.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /interface TaskModalInlineHintProps/);
  assert.match(source, /const TaskModalInlineHint: React\.FC<TaskModalInlineHintProps> = \(\{/);
  assert.match(source, /const \[showTitleError, setShowTitleError\] = useState\(false\)/);
  assert.match(source, /const titleErrorId = 'task-title-error'/);
  assert.match(source, /setShowTitleError\(true\)/);
  assert.match(source, /setShowTitleError\(false\)/);
  assert.match(source, /aria-invalid=\{showTitleError\}/);
  assert.match(source, /aria-describedby=\{showTitleError \? titleErrorId : undefined\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /transition-\[max-height,opacity\]/);
  assert.match(source, /duration-200/);
  assert.match(source, /motion-reduce:transition-none/);
  assert.match(source, /inlineSpacingClassName = 'px-3 py-1'/);
  assert.match(source, /floatingSpacingClassName = 'px-3 pb-1 pt-\[5px\]'/);
  assert.match(source, /translate-y-0/);
  assert.match(source, /-translate-y-full/);
  assert.doesNotMatch(source, /scale-y-100/);
  assert.doesNotMatch(source, /scale-y-0/);
  assert.doesNotMatch(source, /transition-\[grid-template-rows/);
  assert.doesNotMatch(source, /grid-rows-\[/);
  assert.doesNotMatch(source, /\srequired\s*$/m);

  assert.match(i18nSource, /'task\.titleRequired': 'Give your task a title'/);
  assert.match(i18nSource, /'task\.titleRequired': 'Gib deiner Aufgabe einen Titel'/);
});

test('task modal bulk-adds new tasks with Cmd Enter while keeping the form open', () => {
  const source = readSource('components/TaskCreateModal.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /type TaskSubmitMode = 'close' \| 'bulk'/);
  assert.match(source, /const BULK_SAVE_FEEDBACK_CHAR_MS = 10/);
  assert.match(source, /const BULK_SAVE_FEEDBACK_HIDE_MS = 1600/);
  assert.match(source, /const \[bulkSaveFeedbackText, setBulkSaveFeedbackText\] = useState\(''\)/);
  assert.match(source, /const bulkSaveFeedbackIntervalRef = useRef<number \| null>\(null\)/);
  assert.match(source, /const bulkSaveFeedbackHideTimerRef = useRef<number \| null>\(null\)/);
  assert.match(source, /const clearBulkSaveFeedbackTimers = useCallback\(\(\) => \{/);
  assert.match(source, /window\.setInterval\(\(\) => \{/);
  assert.match(source, /BULK_SAVE_FEEDBACK_CHAR_MS/);
  assert.match(source, /window\.setTimeout\(\(\) => \{/);
  assert.match(source, /BULK_SAVE_FEEDBACK_HIDE_MS/);
  assert.match(source, /t\('task\.bulkSaved', \{ title: savedTitle \}\)/);
  assert.match(source, /const submitTask = useCallback\(\(mode: TaskSubmitMode = 'close'\) => \{/);
  assert.match(source, /onSave\(mode === 'bulk' \? null : initialTask\?\.id \|\| null, title\.trim\(\), finalDuration, finalPriority as Priority, iso, projId, newProjName\)/);
  assert.match(source, /if \(mode === 'bulk' && !initialTask\) \{/);
  assert.match(source, /const savedTitle = title\.trim\(\)/);
  assert.match(source, /showBulkSaveFeedback\(savedTitle\)/);
  assert.match(source, /setTitle\(''\)/);
  assert.match(source, /window\.requestAnimationFrame\(\(\) => titleInputRef\.current\?\.focus\(\)\)/);
  assert.match(source, /onClose\(\)/);
  assert.match(source, /if \(e\.key === 'Enter' && \(e\.ctrlKey \|\| e\.metaKey\)\) \{/);
  assert.match(source, /e\.preventDefault\(\)/);
  assert.match(source, /submitTask\(!initialTask \? 'bulk' : 'close'\)/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /bulkSaveFeedbackText/);

  assert.match(i18nSource, /'task\.bulkSaved': '\{title\} saved!'/);
  assert.match(i18nSource, /'task\.bulkSaved': '\{title\} gespeichert!'/);
});

test('task modal shows the persisted bulk shortcut hint once on the second regular task', () => {
  const source = readSource('components/TaskCreateModal.tsx');
  const keyboardKeysSource = readSource('components/animations/AnimatedKeyboardKeys.tsx');
  const appSource = readSource('App.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /showBulkTaskShortcutHint\?: boolean/);
  assert.match(source, /onBulkTaskShortcutHintShown\?: \(\) => void/);
  assert.match(source, /const \[isBulkTaskShortcutHintVisible, setIsBulkTaskShortcutHintVisible\] = useState\(false\)/);
  assert.match(source, /if \(!isOpen\) \{\s+setIsBulkTaskShortcutHintVisible\(false\)/);
  assert.match(source, /if \(!initialTask && showBulkTaskShortcutHint && !isBulkTaskShortcutHintVisible\)/);
  assert.match(source, /onBulkTaskShortcutHintShown\?\.\(\)/);
  assert.match(source, /const BulkTaskShortcutHint: React\.FC/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /<AnimatedKeyboardKeys/);
  assert.match(source, /label: modifierKey, \.\.\.\(modifierKey === 'Cmd' \? \{ symbol: '⌘' \} : \{\}\)/);
  assert.match(source, /label: 'Enter', symbol: '↵'/);
  assert.match(source, /mode="simultaneous"/);
  assert.match(source, /separator="\+"/);
  assert.match(source, /\/Mac\/i\.test\(navigator\.userAgent\)/);
  assert.match(source, /border-t border-black/);
  assert.match(source, /flex flex-col gap-4 sm:flex-row/);
  assert.match(keyboardKeysSource, /aria-hidden="true"/);
  assert.match(keyboardKeysSource, /<kbd/);
  assert.match(keyboardKeysSource, /mode === 'sequential' \? index \* SEQUENTIAL_PRESS_DELAY_MS : 0/);

  assert.match(appSource, /recordTaskCreatedForBulkShortcutHint\(state\.onboarding\)/);
  assert.match(appSource, /markBulkTaskShortcutHintShown\(state\.onboarding\)/);
  assert.match(appSource, /showBulkTaskShortcutHint=\{shouldShowBulkTaskShortcutHint\}/);
  assert.match(appSource, /onBulkTaskShortcutHintShown=\{handleBulkTaskShortcutHintShown\}/);

  assert.match(i18nSource, /'task\.bulkShortcutHintTitle': 'Adding several tasks\?'/);
  assert.match(i18nSource, /'task\.bulkShortcutHintBody': 'Press \{key\} \+ Enter to save this task and start the next one right away\.'/);
  assert.match(i18nSource, /'task\.bulkShortcutHintTitle': 'Mehrere Aufgaben hintereinander\?'/);
  assert.match(i18nSource, /'task\.bulkShortcutHintBody': 'Mit \{key\} \+ Enter speicherst du die Aufgabe und kannst direkt die nächste erstellen\.'/);
});

test('task modal uses an accessible project combobox with a calm new-project action', () => {
  const source = readSource('components/TaskCreateModal.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /useMemo/);
  assert.match(source, /import \{ IconChevronDown, IconPlus \} from '\.\/Icons';/);
  assert.match(source, /const projectLookup = useMemo\(\(\) =>/);
  assert.match(source, /normalizedName: project\.name\.toLowerCase\(\)/);
  assert.match(source, /const matchingProject = useMemo\(\(\) => getMatchingProject\(projectNameInput, projectLookup\), \[projectNameInput, projectLookup\]\)/);
  assert.match(source, /normalizedName\.startsWith\(normalizedProjectInput\)/);
  assert.match(source, /const isCreateProjectAction = isCreatingProject\s+\|\| \(normalizedProjectInput\.length > 0 && visibleProjects\.length === 0\)/);
  assert.match(source, /if \(exactProject\) \{\s+projId = exactProject\.id;\s+\} else if \(isCreatingProject\) \{\s+newProjName = projectNameInput\.trim\(\);\s+\} else if \(matchingProject\) \{\s+projId = matchingProject\.id/);
  assert.match(source, /const nextExactProject = projectLookup\.find\(\(\{ normalizedName \}\) => normalizedName === normalizedNextProjectName\)/);
  assert.match(source, /if \(nextExactProject\) \{\s+setIsCreatingProject\(false\)/);
  assert.match(source, /if \(exactProject && isCreatingProject\) \{\s+setIsCreatingProject\(false\)/);
  assert.match(source, /if \(isCreatingProject && newProjName\) \{\s+setIsCreatingProject\(false\)/);
  assert.match(source, /if \(exactProject\) \{\s+setProjectNameInput\(''\);\s+\}\s+setIsCreatingProject\(true\)/);
  assert.match(source, /if \(!isCreatingProject && matchingProject\) \{\s+setProjectNameInput\(matchingProject\.name\)/);
  assert.match(source, /setShowAllProjectOptions\(Boolean\(exactProject\) \|\| !normalizedProjectInput\)/);
  assert.match(source, /setProjectNameInput\(''\)/);
  assert.match(source, /projects\.find\(project => project\.id === defaultProjectId\) \|\| projects\[0\] \|\| null/);
  assert.match(source, /else if \(defaultProject\) \{\s+projId = defaultProject\.id/);
  assert.match(source, /const handleProjectControlBlur = \(e: React\.FocusEvent<HTMLDivElement>\) => \{/);
  assert.match(source, /if \(!projectNameInput\.trim\(\) && defaultProject\) \{\s+setProjectNameInput\(defaultProject\.name\);\s+setIsCreatingProject\(false\)/);
  assert.match(source, /onBlur=\{handleProjectControlBlur\}/);
  assert.match(source, /<div className=\{`flex flex-col \$\{getOnboardingFieldClassName\('project'\)\}`\}>/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-autocomplete="list"/);
  assert.match(source, /aria-expanded=\{isProjectMenuOpen\}/);
  assert.match(source, /aria-activedescendant=\{activeProjectOptionId\}/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /<IconChevronDown/);
  assert.match(source, /e\.key === 'ArrowDown' \|\| e\.key === 'ArrowUp'/);
  assert.match(source, /e\.key === 'Escape' && isProjectMenuOpen/);
  assert.match(source, /handleOutsidePointerDown/);
  assert.match(source, /newProjName = projectNameInput\.trim\(\)/);
  assert.match(source, /left-\[-1px\] right-\[-1px\] top-full/);
  assert.match(source, /className=\{`flex min-h-10 w-full items-center/);
  assert.match(source, /const projectActionToneClassName = isCreateProjectAction/);
  assert.match(source, /'bg-black text-white hover:bg-neutral-800'/);
  assert.match(source, /<span aria-hidden="true" className="flex w-5 shrink-0 items-center justify-start">[\s\S]*<IconPlus className="h-4 w-4" \/>/);
  assert.match(source, /t\(isCreateProjectAction \? 'task\.createProjectAction' : 'task\.newProjectAction'\)/);
  assert.doesNotMatch(source, /<datalist/);
  assert.doesNotMatch(source, /list=\{projectListId\}/);
  assert.doesNotMatch(source, /t\('task\.newProjectHint'\)/);

  assert.match(i18nSource, /'task\.newProjectAction': 'New project'/);
  assert.match(i18nSource, /'task\.createProjectAction': 'Creates new project'/);
  assert.match(i18nSource, /'task\.openProjectList': 'Open project list'/);
  assert.match(i18nSource, /'task\.newProjectAction': 'Neues Projekt'/);
  assert.match(i18nSource, /'task\.createProjectAction': 'Erstellt neues Projekt'/);
  assert.match(i18nSource, /'task\.openProjectList': 'Projektliste öffnen'/);
});

test('task modal shows one calm duration guidance block for oversized tasks', () => {
  const source = readSource('components/TaskCreateModal.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /import \{ [^\n]*AnimatedTaskDurationSplitLogo \} from '\.\/animations';/);
  assert.match(source, /const shouldShowDurationGuidance = numericDuration > 180 \|\| isDurationTooLong/);
  assert.match(source, /const shouldUseMaxDayDurationGuidance = maxTaskCapacityMinutes > 0 && maxTaskCapacityMinutes < 180/);
  assert.match(source, /const durationGuidanceBodyKey: TranslationKey = shouldUseMaxDayDurationGuidance/);
  assert.match(source, /t\(durationGuidanceBodyKey, \{ duration: formatWarningDuration\(maxTaskCapacityMinutes\) \}\)/);
  assert.match(source, /<AnimatedTaskDurationSplitLogo size="compact" \/>/);
  assert.match(source, /<AnimatedTaskDurationSplitLogo size="compact" \/>[\s\S]*<div className="flex flex-col gap-1">/);
  assert.match(source, /items-start/);
  assert.doesNotMatch(source, /t\('task\.durationTooLongWarning'\)/);
  assert.doesNotMatch(source, /t\('task\.longestDayDuration'/);
  assert.doesNotMatch(source, /t\('task\.durationRecommendedMaxWarning'\)/);

  assert.match(i18nSource, /'task\.durationGuidanceTitle': 'This task feels big\.'/);
  assert.match(i18nSource, /'task\.durationGuidanceBody': 'Small tasks are easier to plan and finish\. Keep them under 3 hours\.'/);
  assert.match(i18nSource, /'task\.durationGuidanceMaxDayBody': 'Small tasks are easier to plan and finish\. Keep them under 3 hours\. For your week, that means at most \{duration\}\.'/);
  assert.match(i18nSource, /'task\.durationGuidanceTitle': 'Diese Aufgabe wirkt groß\.'/);
  assert.match(i18nSource, /'task\.durationGuidanceBody': 'Kleine Aufgaben lassen sich leichter planen und erledigen\. Also nicht länger als 3 Stunden\.'/);
  assert.match(i18nSource, /'task\.durationGuidanceMaxDayBody': 'Kleine Aufgaben lassen sich leichter planen und erledigen\. Also nicht länger als 3 Stunden\. Für deine Woche heißt das: höchstens \{duration\}\.'/);
});

test('task modal formats max-day guidance duration in full words with singular labels', () => {
  const source = readSource('components/TaskCreateModal.tsx');

  assert.match(source, /if \(hours > 0\) parts\.push\(`\$\{hours\} \$\{hours === 1 \? 'Stunde' : 'Stunden'\}`\)/);
  assert.match(source, /if \(remainingMinutes > 0\) parts\.push\(`\$\{remainingMinutes\} \$\{remainingMinutes === 1 \? 'Minute' : 'Minuten'\}`\)/);
  assert.match(source, /if \(hours > 0\) parts\.push\(`\$\{hours\} \$\{hours === 1 \? 'hour' : 'hours'\}`\)/);
  assert.match(source, /if \(remainingMinutes > 0\) parts\.push\(`\$\{remainingMinutes\} \$\{remainingMinutes === 1 \? 'minute' : 'minutes'\}`\)/);
  assert.doesNotMatch(source, /Std\./);
  assert.doesNotMatch(source, /\$\{h\}h/);
});

test('new task creation receives contextual initial due dates and done state', () => {
  const appSource = readSource('App.tsx');
  const modalSource = readSource('components/TaskCreateModal.tsx');

  assert.match(modalSource, /initialDueDate\?: string \| null/);
  assert.match(modalSource, /initialTask \? initialTask\.dueDate : initialDueDate/);
  assert.match(appSource, /newTaskInitialDueDate/);
  assert.match(appSource, /getCurrentWeekDayColumnISO/);
  assert.match(appSource, /getLocalISODateWithOffset/);
  assert.match(appSource, /addTask\(title, duration, priority, dueDate, finalProjectId, newTaskColumn, newTaskColumn === 'done'\)/);
  assert.match(appSource, /initialDueDate=\{newTaskInitialDueDate\}/);
});

test('task modal due date preview is an overlay that does not change layout', () => {
  const source = readSource('components/TaskCreateModal.tsx');

  assert.match(source, /import \{ formatSmartDateDraft, getSmartDatePreviewParts, parseSmartDateInput \} from '\.\.\/utils\/smartDateInput';/);
  assert.match(source, /const dueDatePreview = useMemo\(\(\) => getSmartDatePreviewParts\(dueDate\), \[dueDate\]\)/);
  assert.match(source, /const dueDateInputTextClassName = shouldShowDueDatePreview/);
  assert.match(source, /const \[isDueDateFocused, setIsDueDateFocused\] = useState\(false\)/);
  assert.match(source, /const shouldShowDueDatePreview = Boolean\(dueDatePreview\?\.suffix\)/);
  assert.match(source, /const shouldShowDueDatePreviewCaret = shouldShowDueDatePreview && isDueDateFocused/);
  assert.match(source, /setDueDate\(formatSmartDateDraft\(e\.target\.value, dueDate\)\)/);
  assert.match(source, /parseSmartDateInput\(dueDate\)/);
  assert.match(source, /setIsDueDateFocused\(true\)/);
  assert.match(source, /setIsDueDateFocused\(false\)/);
  assert.match(source, /caret-transparent/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden p-2 font-mono text-center/);
  assert.match(source, /<span className="whitespace-pre">/);
  assert.match(source, /className="text-transparent"/);
  assert.match(source, /\{dueDatePreview\.spacer\}/);
  assert.match(source, /className="text-black dark:text-white"/);
  assert.match(source, /\{dueDatePreview\.typedText\}/);
  assert.match(source, /shouldShowDueDatePreviewCaret && \(/);
  assert.match(source, /inline-block h-\[1\.2em\] w-0 border-l border-black align-\[-0\.18em\] dark:border-white/);
  assert.match(source, /className="text-neutral-400 dark:text-neutral-500"/);
  assert.doesNotMatch(source, /dueDatePreviewOffset/);
});

test('spacebar new task shortcut still works after toggling a task checkbox', () => {
  const taskCardSource = readSource('components/TaskCard.tsx');

  assert.match(taskCardSource, /onClick=\{\(e\) => \{\s+e\.stopPropagation\(\);\s+e\.currentTarget\.blur\(\);\s+\}\}/);
});

test('spacebar new task shortcut activates at its board onboarding hint', () => {
  const appSource = readSource('App.tsx');

  assert.match(appSource, /if \(!storageStatus\.hasOpenFile \|\| !state\.onboarding\.tutorial\.createTask\) return;/);
  assert.match(appSource, /if \(e\.code === 'Space' && shouldShowBoardTutorial && boardTutorialStep === 'drag'\) \{[\s\S]*e\.preventDefault\(\);[\s\S]*return;/);
  assert.match(appSource, /if \(!isInput && !isModalOpen\) \{[\s\S]*if \(shouldShowBoardTutorial && boardTutorialStep === 'spaceShortcut'\) \{[\s\S]*setBoardTutorialStep\('ready'\);[\s\S]*handleOpenNewTask\('backlog'\)/);
  assert.match(appSource, /\[boardTutorialStep, isModalOpen, handleOpenNewTask, shouldShowBoardTutorial, state\.onboarding\.tutorial\.createTask, storageStatus\.hasOpenFile\]/);
});

test('duration input uses the same single focus treatment as neighboring task fields', () => {
  const source = readSource('components/TaskCreateModal.tsx');
  const durationStart = source.indexOf('{/* 2. Duration */}');
  const priorityStart = source.indexOf('{/* 3. Priority */}', durationStart);
  const durationSource = source.slice(durationStart, priorityStart);

  assert.match(durationSource, /border-neutral-200 text-black focus:ring-black/);
  assert.match(durationSource, /dark:border-neutral-700 dark:text-white dark:focus:ring-white/);
  assert.doesNotMatch(durationSource, /focus:border-black/);
  assert.doesNotMatch(durationSource, /dark:focus:border-white/);
});

test('task cards keep their lifted offset hover shadow', () => {
  const taskCardSource = readSource('components/TaskCard.tsx');

  assert.match(taskCardSource, /hover:-translate-y-1/);
  assert.match(taskCardSource, /hover:shadow-\[4px_4px_0px_0px_rgba\(0,0,0,1\)\]/);
  assert.match(taskCardSource, /dark:hover:shadow-\[4px_4px_0px_0px_rgba\(80,80,80,1\)\]/);
  assert.doesNotMatch(taskCardSource, /hover:-translate-y-0\.5 hover:shadow-sm/);
});

test('task cards share the 22 minute minimum height without stretching longer durations', () => {
  const constantsSource = readSource('constants.ts');
  const taskCardSource = readSource('components/TaskCard.tsx');
  const onboardingPreviewSource = readSource('components/OnboardingTaskCardPreview.tsx');

  assert.match(constantsSource, /export const PIXELS_PER_MINUTE = 4;/);
  assert.match(constantsSource, /export const MIN_TASK_CARD_DURATION_MINUTES = 22;/);

  assert.equal(Math.max(20, 22) * 4, 88);
  assert.equal(Math.max(22, 22) * 4, 88);
  assert.equal(Math.max(23, 22) * 4, 92);

  for (const source of [taskCardSource, onboardingPreviewSource]) {
    assert.match(source, /import \{ MIN_TASK_CARD_DURATION_MINUTES, PIXELS_PER_MINUTE \} from '\.\.\/constants';/);
    assert.match(source, /const effectiveDuration = Math\.max\(task\.duration, MIN_TASK_CARD_DURATION_MINUTES\);/);
    assert.match(source, /const heightStyle = effectiveDuration \* PIXELS_PER_MINUTE;/);
  }
});

test('board rendering components are memoized for storage status updates', () => {
  const expectedMemoizedExports = [
    ['components/Board.tsx', /export const Board = React\.memo/],
    ['components/ColumnView.tsx', /export const ColumnView = React\.memo/],
    ['components/TaskCard.tsx', /export const TaskCard = React\.memo/],
  ];

  for (const [relativePath, pattern] of expectedMemoizedExports) {
    assert.match(readSource(relativePath), pattern, relativePath);
  }
});

test('column add-task button text leaves the plus to the icon', () => {
  const columnSource = readSource('components/ColumnView.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(columnSource, /<IconPlus className="h-4 w-4" \/>/);
  assert.match(i18nSource, /'column\.addTask': 'Add Task'/);
  assert.match(i18nSource, /'column\.addTask': 'Aufgabe hinzufügen'/);
  assert.doesNotMatch(i18nSource, /'column\.addTask': '\+ Add Task'/);
  assert.doesNotMatch(i18nSource, /'column\.addTask': '\+ Aufgabe hinzufügen'/);
});

test('day column header shows planned, open, and over-capacity labels above the unchanged bar', () => {
  const source = readSource('components/ColumnView.tsx');

  assert.match(source, /import \{ formatCompactHourMinutes \} from '\.\.\/utils\/dateUtils';/);
  assert.match(source, /const openMinutes = openTasks\.reduce\(\(sum, t\) => sum \+ t\.duration, 0\)/);
  assert.match(source, /const plannedMinutes = tasks\.reduce\(\(sum, t\) => sum \+ t\.duration, 0\)/);
  assert.match(source, /const overCapacityMinutes = Math\.max\(0, plannedMinutes - maxCapacityMinutes\)/);
  assert.match(source, /const effectiveCapacityMinutes = Math\.max\(maxCapacityMinutes, plannedMinutes\)/);
  assert.match(source, /const shouldShowOpenMinutes = openMinutes > 0 && openMinutes < plannedMinutes/);
  assert.match(source, /formatCompactHourMinutes\(openMinutes\)/);
  assert.match(source, /formatCompactHourMinutes\(plannedMinutes\)/);
  assert.match(source, /formatCompactHourMinutes\(overCapacityMinutes\)/);
  assert.match(source, /isOverCapacity = isDay && plannedMinutes > maxCapacityMinutes/);
  assert.match(source, /const capacityPct = isDay && effectiveCapacityMinutes > 0/);
  assert.match(source, /Math\.min\(100, \(openMinutes \/ effectiveCapacityMinutes\) \* 100\)/);
  assert.match(source, /className="h-20 px-4 pt-2 pb-3 border-b border-neutral-200/);
  assert.match(source, /<div className="flex justify-between items-baseline min-h-\[28px\]">/);
  assert.match(source, /text-\[10px\]/);
  assert.match(source, /text-\[8px\]/);
  assert.match(source, /<span className="text-\[6px\]">▲<\/span>/);
  assert.match(source, /<div className="h-1\.5 w-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden shrink-0 mt-2">/);
  assert.doesNotMatch(source, /toFixed\(1\)/);
  assert.doesNotMatch(source, /\/ \{/);
  assert.doesNotMatch(source, /displayPlannedMinutes/);
});

test('current day column uses the column hover tint at subtle opacity behind existing priority states', () => {
  const source = readSource('components/ColumnView.tsx');

  assert.match(source, /const isCurrentDay = id === dayIdMap\[todayIndex\]/);
  assert.match(source, /isPinned \? 'sticky left-0 z-20 bg-white dark:bg-neutral-900' : isDragOver \? 'bg-neutral-100 dark:bg-neutral-800' : isCurrentDay \? 'bg-neutral-100\/40 dark:bg-neutral-800\/40/);
  assert.doesNotMatch(source, /isCurrentDay \? 'bg-neutral-100\/15 dark:bg-neutral-800\/15/);
  assert.doesNotMatch(source, /isCurrentDay \? 'bg-neutral-100\/10 dark:bg-neutral-800\/10/);
  assert.doesNotMatch(source, /isCurrentDay \? 'bg-neutral-50 dark:bg-neutral-800\/50/);
  assert.doesNotMatch(source, /isCurrentDay \? 'bg-red-50\/40 dark:bg-red-950\/10/);
});

test('column header exposes the next four-step sort mode on hover and focus', () => {
  const columnSource = readSource('components/ColumnView.tsx');
  const boardSource = readSource('components/Board.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(columnSource, /nextSortMode: ColumnSortMode/);
  assert.match(columnSource, /onSortColumn: \(columnId: ColumnId, mode: ColumnSortMode\) => void/);
  assert.match(columnSource, /onClick=\{\(\) => onSortColumn\(id, nextSortMode\)\}/);
  assert.match(columnSource, /t\('column\.sortHint', \{ criterion: sortCriterion, arrow: isUpSort \? '▲' : '▼' \}\)/);
  assert.match(columnSource, /aria-label=\{sortLabel\}/);
  assert.match(columnSource, /group-hover:opacity-100/);
  assert.match(columnSource, /group-focus-visible:opacity-100/);
  assert.doesNotMatch(columnSource, /group-focus-within:opacity-100/);
  assert.match(columnSource, /text-neutral-500 dark:text-neutral-400/);

  assert.match(boardSource, /useState<Record<ColumnId, ColumnSortMode>>/);
  assert.match(boardSource, /onSortColumn\(colId, mode\)/);
  assert.match(boardSource, /\[colId\]: getNextColumnSortMode\(mode\)/);
  assert.match(boardSource, /\[sourceCol\]: INITIAL_COLUMN_SORT_MODE/);
  assert.match(boardSource, /\[targetCol\]: INITIAL_COLUMN_SORT_MODE/);
  assert.match(boardSource, /onDropTask=\{handleDropTask\}/);

  assert.match(i18nSource, /'column\.sortHint': 'sort · \{criterion\} \{arrow\}'/);
  assert.match(i18nSource, /'column\.sortHint': 'sortieren · \{criterion\} \{arrow\}'/);
  assert.match(i18nSource, /'column\.sortCriterionDate': 'Date'/);
  assert.match(i18nSource, /'column\.sortCriterionDate': 'Datum'/);
  assert.match(i18nSource, /'column\.sortScoreDesc': 'Sort \{title\} by score – highest first'/);
  assert.match(i18nSource, /'column\.sortDateDesc': '\{title\} nach Datum sortieren – spätestes zuerst'/);
});
