const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const readSource = (relativePath) => (
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
);

test('settings view uses the shared sub side menu with four tabs', () => {
  const source = readSource('components/SettingsView.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /import \{ SubSideMenu \} from '\.\/SubSideMenu';/);
  assert.match(source, /import \{[^}]*SubSideMenuButton[^}]*\} from '\.\/Buttons';/s);
  assert.match(source, /type SettingsTab = 'workWeek' \| 'routines' \| 'planning' \| 'appData'/);
  assert.match(source, /useState<SettingsTab>\('workWeek'\)/);
  assert.match(source, /<SettingsNav/);
  assert.match(source, /settings\.workWeek/);
  assert.match(source, /settings\.routines/);
  assert.match(source, /settings\.planning/);
  assert.match(source, /settings\.appAndData/);

  assert.match(i18nSource, /'settings\.workWeek': 'Work Week'/);
  assert.match(i18nSource, /'settings\.routines': 'Routines'/);
  assert.match(i18nSource, /'settings\.planning': 'Planning'/);
  assert.match(i18nSource, /'settings\.appAndData': 'App & Data'/);
  assert.match(i18nSource, /'settings\.workWeek': 'Arbeitswoche'/);
  assert.match(i18nSource, /'settings\.routines': 'Routinen'/);
  assert.match(i18nSource, /'settings\.planning': 'Planung'/);
  assert.match(i18nSource, /'settings\.appAndData': 'App und Daten'/);
});

test('planning and routine priority options include their numeric scale', () => {
  const source = readSource('components/SettingsView.tsx');

  assert.match(source, /const formatPriorityOption = \(priority: Priority, t: TFunction\): string => \(\s*`\$\{priority\} - \$\{t\(getPriorityLabelKey\(priority\)\)\}`\s*\);/s);
  assert.equal((source.match(/formatPriorityOption\(Priority\.Important, t\)/g) || []).length, 2);
});

test('settings sub side menu stays flush left and content scrolls beside it', () => {
  const source = readSource('components/SettingsView.tsx');

  assert.doesNotMatch(source, /flex flex-col h-full max-w-4xl mx-auto/);
  assert.match(source, /flex h-full w-full flex-row/);
  assert.match(source, /<div className="min-h-0 flex-1 overflow-y-auto">/);
});

test('settings sections are grouped into the requested tabs without losing existing anchors', () => {
  const source = readSource('components/SettingsView.tsx');

  assert.match(source, /activeTab === 'workWeek'/);
  assert.match(source, /activeTab === 'routines'/);
  assert.match(source, /activeTab === 'planning'/);
  assert.match(source, /activeTab === 'appData'/);
  assert.match(source, /lg:grid-cols-\[minmax\(280px,360px\)_minmax\(0,1fr\)\]/);

  assert.match(source, /t\('settings\.columnSettings'\)/);
  assert.match(source, /t\('settings\.recurring'\)/);
  assert.match(source, /t\('settings\.projects'\)/);
  assert.match(source, /t\('settings\.taskDefaults'\)/);
  assert.match(source, /t\('settings\.applicationSettings'\)/);
  assert.match(source, /t\('settings\.dataManagement'\)/);
  assert.match(source, /t\('settings\.aboutCare'\)/);
});

test('application settings expose calm desktop update controls and safe status text', () => {
  const source = readSource('components/SettingsView.tsx');
  const dialogSource = readSource('components/UpdateAvailableDialog.tsx');
  const appSource = readSource('App.tsx');
  const preload = readSource('preload.cjs');
  const types = readSource('types.ts');
  const i18nSource = readSource('i18n.tsx');
  const workWeekSection = source.slice(
    source.lastIndexOf("activeTab === 'workWeek'"),
    source.lastIndexOf("activeTab === 'appData'")
  );
  const appDataSection = source.slice(source.lastIndexOf("activeTab === 'appData'"));

  assert.doesNotMatch(workWeekSection, /settings\.updates/);
  assert.match(appDataSection, /settings\.applicationSettings[\s\S]*settings\.updates/);
  assert.match(source, /settings\.updatesAutomatic/);
  assert.match(source, /settings\.updatesCheckNow/);
  assert.match(source, /updateStatus\?\.automaticInstallationSupported/);
  assert.match(source, /updateStatus\?\.updateCheckSupported/);
  assert.doesNotMatch(source, /settings\.updatesAutomaticHint/);
  assert.match(source, /aria-live="polite"/);
  assert.match(dialogSource, /role="dialog"/);
  assert.match(dialogSource, /aria-modal="true"/);
  assert.match(dialogSource, /event\.key !== 'Tab'/);
  assert.match(dialogSource, /previouslyFocusedElement\?\.focus\(\)/);
  assert.match(dialogSource, /settings\.updateDialogOpenRelease/);
  assert.match(dialogSource, /settings\.updateDialogLater/);
  assert.match(appSource, /window\.planwerkUpdater\.getStatus\(\)/);
  assert.match(appSource, /window\.planwerkUpdater\.onStatus/);
  assert.match(appSource, /window\.planwerkUpdater\.dismissAvailableVersion/);
  assert.match(appSource, /window\.planwerkUpdater\.openReleasePage/);
  assert.match(appSource, /<UpdateAvailableDialog/);
  assert.match(preload, /planwerkUpdater/);
  assert.match(preload, /planwerk:update-check-now/);
  assert.match(preload, /planwerk:update-dismiss-version/);
  assert.match(preload, /planwerk:update-open-release-page/);
  assert.match(types, /PlanwerkUpdateStatus/);
  assert.match(types, /updateCheckSupported: boolean/);
  assert.match(types, /automaticInstallationSupported: boolean/);
  assert.match(types, /planwerkUpdater/);
  assert.match(i18nSource, /'settings\.updatesAutomatic': 'Install updates automatically'/);
  assert.match(i18nSource, /'settings\.updatesAutomatic': 'Updates automatisch installieren'/);
  assert.doesNotMatch(i18nSource, /settings\.updatesAutomaticHint/);
  assert.doesNotMatch(i18nSource, /settings\.updatesUnsignedMac/);
});

test('settings view reuses shared work week settings controls', () => {
  const source = readSource('components/SettingsView.tsx');
  const workWeekSource = readSource('components/WorkWeekSettings.tsx');

  assert.match(source, /import \{ WorkWeekSettings \} from '\.\/WorkWeekSettings';/);
  assert.match(source, /<WorkWeekSettings/);
  assert.doesNotMatch(source, /DAY_COLUMN_IDS\.map\(\(day\) =>/);
  assert.match(workWeekSource, /visibleDays: DayColumnId\[\]/);
  assert.match(workWeekSource, /maxHoursPerDayByDay: MaxHoursByDay/);
  assert.match(workWeekSource, /onSetVisibleDays: \(days: DayColumnId\[\]\) => void/);
  assert.match(workWeekSource, /onUpdateSettings: \(updates: Partial<AppState>\) => void/);
  assert.match(workWeekSource, /variant\?: 'settings' \| 'welcome'/);
});

test('work week settings only show visible days and max hours without horizontal scrolling', () => {
  const workWeekSource = readSource('components/WorkWeekSettings.tsx');
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');

  assert.doesNotMatch(workWeekSource, /autofillMode/);
  assert.doesNotMatch(workWeekSource, /settings\.autofill/);
  assert.doesNotMatch(workWeekSource, /settings\.maxHoursHint/);
  assert.doesNotMatch(workWeekSource, /overflow-x-auto/);
  assert.doesNotMatch(workWeekSource, /min-w-\[720px\]/);
  assert.match(workWeekSource, /w-full/);
  assert.match(workWeekSource, /repeat\(7,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(workWeekSource, /type="checkbox"/);
  assert.doesNotMatch(workWeekSource, /settings\.visibleDays/);
  assert.match(workWeekSource, /Math\.max\(0, Math\.trunc\(numeric \* 10\) \/ 10\)/);
  assert.match(workWeekSource, /nextValue <= 0/);
  assert.match(workWeekSource, /visibleDays\.length === 1 && visibleDays\.includes\(day\)/);
  assert.match(workWeekSource, /onSetVisibleDays\(nextVisibleDays\)/);
  assert.match(workWeekSource, /const wrapperClassName = 'flex flex-col gap-4 border border-neutral-200/);
  assert.doesNotMatch(workWeekSource, /variant === 'welcome'\s*\?/);

  assert.doesNotMatch(welcomeSource, /autofillMode=/);
});

test('settings view exposes autofill mode separately from shared work week controls', () => {
  const source = readSource('components/SettingsView.tsx');
  const workWeekSource = readSource('components/WorkWeekSettings.tsx');
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');

  assert.match(source, /value=\{autofillMode\}/);
  assert.match(source, /onUpdateSettings\(\{ autofillMode: e\.target\.value as AutofillMode \}\)/);
  assert.match(source, /<option value="current-weekday">\{t\('settings\.autofillCurrentWeekday'\)\}<\/option>/);
  assert.match(source, /<option value="full-week">\{t\('settings\.autofillFullWeek'\)\}<\/option>/);
  assert.match(source, /t\('settings\.autofill'\)/);

  assert.doesNotMatch(workWeekSource, /autofillMode/);
  assert.doesNotMatch(workWeekSource, /settings\.autofill/);
  assert.doesNotMatch(welcomeSource, /autofillMode=/);
});

test('settings view places the first weekday beside autofill and keeps it out of onboarding', () => {
  const source = readSource('components/SettingsView.tsx');
  const workWeekSource = readSource('components/WorkWeekSettings.tsx');
  const welcomeSource = readSource('components/PlanwerkWelcomeScreen.tsx');
  const boardSource = readSource('components/Board.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2/);
  assert.match(source, /value=\{weekStartDay\}/);
  assert.match(source, /onUpdateSettings\(\{ weekStartDay: e\.target\.value as DayColumnId \}\)/);
  assert.match(source, /DAY_COLUMN_IDS\.map\(day =>/);
  assert.match(source, /getFullDayColumnLabelKey\(day\)/);
  assert.match(workWeekSource, /getOrderedDayColumnIds\(weekStartDay\)/);
  assert.match(boardSource, /getOrderedDayColumnIds\(weekStartDay\)/);
  assert.match(welcomeSource, /weekStartDay=\{weekStartDay\}/);
  assert.doesNotMatch(welcomeSource, /settings\.firstDayOfWeek/);
  assert.match(i18nSource, /'settings\.firstDayOfWeek': 'First day of week'/);
  assert.match(i18nSource, /'settings\.firstDayOfWeek': 'Erster Tag der Woche'/);
});

test('work week row labels are vertically centered with their controls', () => {
  const workWeekSource = readSource('components/WorkWeekSettings.tsx');

  assert.doesNotMatch(workWeekSource, /<div className="pt-2">/);
  assert.match(workWeekSource, /<div className="flex h-full items-center">/);
});

test('work week settings show calm animated long-day guidance', () => {
  const workWeekSource = readSource('components/WorkWeekSettings.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(workWeekSource, /const LONG_DAY_WARNING_THRESHOLD_HOURS = 6/);
  assert.match(workWeekSource, /maxVisibleHours >= LONG_DAY_WARNING_THRESHOLD_HOURS/);
  assert.match(workWeekSource, /Math\.ceil\(maxVisibleHours\)/);
  assert.match(workWeekSource, /const LONG_DAY_WARNING_REVEAL_MS = 300/);
  assert.match(workWeekSource, /const LONG_DAY_WARNING_LETTER_MS = 50/);
  assert.match(workWeekSource, /const LONG_DAY_WARNING_MAX_LETTERS = 24/);
  assert.match(workWeekSource, /const getLongDayWarningHours = \(visibleDays: DayColumnId\[\], maxHoursDrafts: Record<DayColumnId, string>, maxHoursPerDayByDay: MaxHoursByDay\)/);
  assert.match(workWeekSource, /const parsedDraft = parseMaxHoursDraft\(maxHoursDrafts\[day\]\)/);
  assert.match(workWeekSource, /parsedDraft \?\? maxHoursPerDayByDay\[day\]/);
  assert.match(workWeekSource, /current < letterCount \? current \+ 1 : current - 1/);
  assert.doesNotMatch(workWeekSource, /setVisibleLetterCount\(prefersReducedMotion \? letterCount : 1\);/);
  assert.match(workWeekSource, /overflow-hidden/);
  assert.match(workWeekSource, /max-height: 0/);
  assert.match(workWeekSource, /max-height: 12rem/);
  assert.match(workWeekSource, /transform-origin: top/);
  assert.match(workWeekSource, /long-day-warning-exit/);
  assert.match(workWeekSource, /setRenderedLongDayWarningHours\(longDayWarningHours\)/);
  assert.match(workWeekSource, /window\.setTimeout\(\(\) => setRenderedLongDayWarningHours\(0\), LONG_DAY_WARNING_REVEAL_MS\)/);
  assert.match(workWeekSource, /isExiting=\{!showLongDayWarning\}/);
  assert.match(workWeekSource, /settings\.longDayWarningTitleLead/);
  assert.match(workWeekSource, /settings\.longDayWarning/);
  assert.match(workWeekSource, /bg-black px-1\.5 py-0\.5 text-white dark:bg-white dark:text-black/);
  assert.doesNotMatch(workWeekSource, /border-red-600|bg-red-50|text-red-600|uppercase tracking-wider text-red/);

  assert.match(i18nSource, /'settings\.longDayWarningTitleLead': 'Your day is too'/);
  assert.match(i18nSource, /'settings\.longDayWarning': 'Half your time is enough\. Working 8 hours\? Plan 4\. That leaves enough room for breaks, conversations, and everything in between\.'/);
  assert.match(i18nSource, /'settings\.longDayWarningTitleLead': 'Dein Tag ist zu'/);
  assert.match(i18nSource, /'settings\.longDayWarning': 'Die Hälfte deiner Zeit reicht\. Arbeitest du 8 Stunden\? Plane 4\. So bleibt genug Raum für Pausen, Gespräche und alles, was dazwischenkommt\.'/);
  assert.doesNotMatch(i18nSource, /6\+ hours can overload|6\+ Stunden können einen Tag überladen/);
});

test('app data settings close the current planwerk file instead of exporting and deleting everything', () => {
  const source = readSource('components/SettingsView.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /onClosePlanwerkFile\?: \(\) => Promise<void>/);
  assert.match(source, /t\('settings\.closePlanwerk'\)/);
  assert.match(source, /t\('settings\.closePlanwerkAria'\)/);
  assert.doesNotMatch(source, /showDeleteConfirm/);
  assert.doesNotMatch(source, /handleExportAndDelete/);
  assert.doesNotMatch(source, /settings\.exportDeleteAll/);

  assert.match(i18nSource, /'settings\.closePlanwerk': 'Close Planwerk File'/);
  assert.match(i18nSource, /'settings\.closePlanwerk': 'Planwerk-Datei schließen'/);
  assert.match(i18nSource, /'settings\.closePlanwerkAria': 'Close the current Planwerk file'/);
  assert.match(i18nSource, /'settings\.closePlanwerkAria': 'Aktuelle Planwerk-Datei schließen'/);
});

test('json export is shown as a secondary data management action', () => {
  const source = readSource('components/SettingsView.tsx');
  const exportButton = source.match(/\{onExportData && \(\s*(<SecondaryButton[\s\S]*?\{t\('settings\.exportJson'\)\}[\s\S]*?<\/SecondaryButton>)/)?.[1];

  assert.ok(exportButton);
  assert.match(exportButton, /gap-2 px-6 text-sm/);
  assert.doesNotMatch(exportButton, /bg-black/);
});

test('settings legacy JSON import checks file size before reading browser data', () => {
  const source = readSource('components/SettingsView.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /LEGACY_IMPORT_FILE_MAX_BYTES/);
  assert.match(source, /file\.size > LEGACY_IMPORT_FILE_MAX_BYTES/);
  assert.match(source, /import\.tooLarge/);
  assert.match(i18nSource, /'import\.tooLarge':/);
});

test('app and data settings use light separators and shared command buttons', () => {
  const source = readSource('components/SettingsView.tsx');

  assert.doesNotMatch(source, /border-t-4 border-black/);
  assert.doesNotMatch(source, /border-b border-black/);
  assert.match(source, /<section className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-6">/);
  assert.match(source, /border-b border-neutral-200 pb-2 dark:border-neutral-700/);
  assert.match(source, /<PrimaryButton[\s\S]*settings\.newPlanwerk[\s\S]*<\/PrimaryButton>/);
  assert.match(source, /<SecondaryButton[\s\S]*settings\.openPlanwerk[\s\S]*<\/SecondaryButton>/);
  assert.match(source, /<SecondaryButton[\s\S]*settings\.importJson[\s\S]*<\/SecondaryButton>/);
});

test('task defaults always keep a selectable project', () => {
  const source = readSource('components/SettingsView.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.doesNotMatch(source, /<option value="">\{t\('settings\.none'\)\}<\/option>/);
  assert.match(source, /disabled=\{projects\.length <= 1\}/);
  assert.match(source, /t\('settings\.keepOneProject'\)/);
  assert.match(i18nSource, /'settings\.keepOneProject': 'Keep at least one project.'/);
  assert.match(i18nSource, /'settings\.keepOneProject': 'Mindestens ein Projekt muss bleiben.'/);
});

test('project deletion defaults to moving linked tasks and routines into another project', () => {
  const source = readSource('components/SettingsView.tsx');
  const storeSource = readSource('hooks/useStore.ts');
  const typesSource = readSource('types.ts');

  assert.match(typesSource, /export type ProjectDeletionResolution =\s*\| \{ mode: 'move'; targetProjectId: string \}\s*\| \{ mode: 'delete' \}/);
  assert.match(source, /const ProjectDeletionDialog: React\.FC<ProjectDeletionDialogProps>/);
  assert.match(source, /useState<'move' \| 'delete'>\('move'\)/);
  assert.match(source, /remainingProjects = projects\.filter\(candidate => candidate\.id !== project\.id\)/);
  assert.match(source, /remainingProjects\.some\(candidate => candidate\.id === defaultProjectId\)/);
  assert.match(source, /templates\.filter\(template => template\.projectId === project\.id\)\.length/);
  assert.match(source, /finishDeletion\(\{ mode: 'move', targetProjectId \}\)/);
  assert.match(source, /!hasLinkedItems/);
  assert.match(source, /settings\.projectDelete\.emptyBody/);
  assert.match(storeSource, /tasks: state\.tasks\.map\(task => task\.projectId === id/);
  assert.match(storeSource, /templates: state\.templates\.map\(template => template\.projectId === id/);
  assert.match(storeSource, /defaultProjectId: state\.defaultProjectId === id \? targetProjectId/);
});

test('permanent project deletion uses a second name-gated confirmation', () => {
  const source = readSource('components/SettingsView.tsx');
  const storeSource = readSource('hooks/useStore.ts');

  assert.match(source, /useState<'choice' \| 'confirm'>\('choice'\)/);
  assert.match(source, /setStep\('confirm'\)/);
  assert.match(source, /confirmationName\.trim\(\) === project\.name/);
  assert.match(source, /autoFocus/);
  assert.match(source, /disabled=\{!confirmationMatches\}/);
  assert.match(source, /className="mb-2 block text-sm font-medium text-neutral-600 dark:text-neutral-300">\s*\{t\('settings\.projectDelete\.typeName'/);
  assert.match(source, /finishDeletion\(\{ mode: 'delete' \}\)/);
  assert.match(source, /if \(event\.key === 'Escape'\)/);
  assert.match(source, /if \(event\.key !== 'Tab'/);
  assert.match(source, /querySelectorAll<HTMLElement>/);
  assert.match(source, /lastElement\.focus\(\)/);
  assert.match(source, /firstElement\.focus\(\)/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(storeSource, /tasks: state\.tasks\.filter\(task => task\.projectId !== id\)/);
  assert.match(storeSource, /templates: state\.templates\.filter\(template => template\.projectId !== id\)/);
});

test('project deletion dialog is fully localized in English and German', () => {
  const i18nSource = readSource('i18n.tsx');

  assert.match(i18nSource, /'settings\.projectDelete\.title': 'Delete “\{projectName\}”\?'/);
  assert.match(i18nSource, /'settings\.projectDelete\.title': '„\{projectName\}“ löschen\?'/);
  assert.match(i18nSource, /'settings\.projectDelete\.moveTasks': 'Move tasks'/);
  assert.match(i18nSource, /'settings\.projectDelete\.moveTasks': 'Aufgaben verschieben'/);
  assert.match(i18nSource, /'settings\.projectDelete\.moveTo': 'Move to'/);
  assert.match(i18nSource, /'settings\.projectDelete\.moveTo': 'Verschieben nach'/);
  assert.match(i18nSource, /'settings\.projectDelete\.moveAndDelete': 'Move tasks & delete project'/);
  assert.match(i18nSource, /'settings\.projectDelete\.moveAndDelete': 'Verschieben & Projekt löschen'/);
  assert.match(i18nSource, /'settings\.projectDelete\.permanentTitle': 'Delete permanently\?'/);
  assert.match(i18nSource, /'settings\.projectDelete\.permanentTitle': 'Wirklich löschen\?'/);
  assert.match(i18nSource, /'settings\.projectDelete\.typeName': 'Type “\{projectName\}” to confirm\.'/);
  assert.match(i18nSource, /'settings\.projectDelete\.typeName': 'Gib „\{projectName\}“ zur Bestätigung ein\.'/);
  assert.match(i18nSource, /'settings\.projectDelete\.deletePermanently': 'Delete permanently'/);
  assert.match(i18nSource, /'settings\.projectDelete\.deletePermanently': 'Endgültig löschen'/);
  assert.match(i18nSource, /'settings\.projectDelete\.taskSingular': '\{count\} task'/);
  assert.match(i18nSource, /'settings\.projectDelete\.taskPlural': '\{count\} tasks'/);
  assert.match(i18nSource, /'settings\.projectDelete\.routineSingular': '\{count\} Routine'/);
  assert.match(i18nSource, /'settings\.projectDelete\.routinePlural': '\{count\} Routinen'/);
});

test('task defaults include a configurable due date offset', () => {
  const source = readSource('components/SettingsView.tsx');
  const typesSource = readSource('types.ts');
  const i18nSource = readSource('i18n.tsx');

  assert.match(typesSource, /defaultDueDateOffsetDays\?: number/);
  assert.match(source, /defaultDueDateOffsetDays/);
  assert.match(source, /settings\.dueDateLabel/);
  assert.match(source, /settings\.dueDate\.sameDay/);
  assert.match(source, /settings\.dueDate\.nextDay/);
  assert.match(source, /settings\.dueDate\.after2Days/);
  assert.match(source, /settings\.dueDate\.afterAWeek/);
  assert.match(source, /settings\.dueDate\.custom/);
  assert.match(source, /onUpdateSettings\(\{ defaultDueDateOffsetDays:/);

  assert.match(i18nSource, /'settings\.dueDateLabel': 'Due Date'/);
  assert.match(i18nSource, /'settings\.dueDateLabel': 'Fälligkeitsdatum'/);
});

test('app data includes local MCP access above data management with localized connection guidance', () => {
  const source = readSource('components/SettingsView.tsx');
  const appSource = readSource('App.tsx');
  const preload = readSource('preload.cjs');
  const types = readSource('types.ts');
  const i18nSource = readSource('i18n.tsx');

  assert.ok(source.indexOf("t('settings.mcpAccess')") < source.indexOf("t('settings.dataManagement')"));
  assert.match(source, /mcpStatus/);
  assert.match(source, /onSetMcpEnabled/);
  assert.match(source, /onRegenerateMcpToken/);
  assert.match(source, /settings\.mcpEndpoint/);
  assert.match(source, /settings\.mcpAuthorization/);
  assert.match(source, /settings\.mcpRegenerateToken/);
  assert.match(appSource, /window\.planwerkMcp/);
  assert.match(preload, /planwerkMcp/);
  assert.match(types, /PlanwerkMcpStatus/);
  assert.match(types, /planwerkMcp/);
  assert.match(i18nSource, /'settings\.mcpAccess': 'Local MCP Access'/);
  assert.match(i18nSource, /'settings\.mcpAccess': 'Lokaler MCP-Zugriff'/);
});

test('enabled local MCP access copies a Planwerk AI skill and reports clipboard results', () => {
  const source = readSource('components/SettingsView.tsx');
  const appSource = readSource('App.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(source, /PLANWERK_MCP_SKILL_MARKDOWN/);
  assert.match(source, /handleMcpCopy\(PLANWERK_MCP_SKILL_MARKDOWN, 'settings\.mcpSkillCopied'\)/);
  assert.match(source, /handleMcpCopy\(mcpStatus\.token as string, 'settings\.mcpTokenCopied'\)/);
  assert.match(source, /settings\.mcpCopySkill/);
  assert.match(source, /settings\.mcpCopyFailed/);
  assert.ok(source.indexOf("t('settings.mcpCopySkill')") > source.indexOf('mcpStatus?.enabled &&'));
  assert.match(appSource, /if \(!result\?\.ok\)/);

  assert.match(i18nSource, /'settings\.mcpCopySkill': 'Copy AI skill as Markdown'/);
  assert.match(i18nSource, /'settings\.mcpCopySkill': 'AI-Skill als Markdown kopieren'/);
  assert.match(i18nSource, /'settings\.mcpSkillCopied': 'AI skill Markdown copied\.'/);
  assert.match(i18nSource, /'settings\.mcpTokenCopied': 'Access token copied\.'/);
  assert.match(i18nSource, /'settings\.mcpCopyFailed': 'Could not copy to the clipboard\.'/);
});

test('local MCP AI skill is client-neutral Markdown guidance for the current toolset', () => {
  const skillPath = path.join(repoRoot, 'components/mcp/planwerkSkill.ts');
  assert.equal(fs.existsSync(skillPath), true, 'the Planwerk MCP skill module should exist');

  const source = fs.readFileSync(skillPath, 'utf8');
  assert.match(source, /---[\s\S]*name: planwerk[\s\S]*description:[\s\S]*---/);
  assert.match(source, /five minutes of conscious planning a day/);
  assert.match(source, /Plan only part of the available capacity/);
  assert.match(source, /Avoid KPI language/);
  assert.match(source, /dueDate.*deadline/);
  assert.match(source, /column.*board column/);
  assert.match(source, /1 low/);
  assert.match(source, /2 helpful/);
  assert.match(source, /3 normal\/important/);
  assert.match(source, /4 necessary/);
  assert.match(source, /5 critical/);
  assert.match(source, /5 and 180 minutes/);
  assert.match(source, /get_tasks.*ID/);
  assert.match(source, /Do not automatically set deadlines to today/);
  assert.match(source, /When you set a day column, also set a matching dueDate/);
  assert.match(source, /Planwerk will otherwise use today's default dueDate/);
  assert.match(source, /affectedColumnCapacities/);
  assert.match(source, /get_current_date.*relative dates/);

  for (const tool of [
    'get_current_date',
    'get_tasks',
    'get_goals',
    'get_lookback',
    'get_all_data',
    'get_projects',
    'post_project',
    'post_task',
    'update_task',
    'post_goal',
    'set_goal_focus',
  ]) {
    assert.match(source, new RegExp(tool), `skill should document ${tool}`);
  }

  assert.doesNotMatch(source, /127\.0\.0\.1|Authorization|Bearer|access token/i);
});
