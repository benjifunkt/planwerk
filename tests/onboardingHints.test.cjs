const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');

const loadModule = (relativePath) => {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', output);
  fn(require, mod, mod.exports);
  return mod.exports;
};

const {
  markBulkTaskShortcutHintShown,
  markWeeklyReflectionReminderShown,
  recordCleanupTutorialCompleted,
  recordTaskCreatedForBulkShortcutHint,
  shouldOfferBulkTaskShortcutHint,
} = loadModule('utils/onboardingHints.ts');

const createOnboarding = ({ board = true, firstTaskCreated = false, shown = false } = {}) => ({
  version: 1,
  tutorial: {
    workWeek: true,
    createTask: true,
    board,
    autofill: false,
    cleanup: false,
    reflection: false,
    lookback: false,
    goals: false,
  },
  hints: {
    bulkTaskShortcut: { firstTaskCreated, shown },
    weeklyReflectionReminder: { shown: false, cleanupTutorialCompletedAt: null },
  },
});

test('first regular task after board onboarding unlocks the bulk shortcut hint', () => {
  const onboarding = createOnboarding();
  const updated = recordTaskCreatedForBulkShortcutHint(onboarding);

  assert.notEqual(updated, onboarding);
  assert.equal(updated.hints.bulkTaskShortcut.firstTaskCreated, true);
  assert.equal(shouldOfferBulkTaskShortcutHint(updated), true);
});

test('task creation before board completion or after the hint was shown does not unlock it', () => {
  const beforeBoard = createOnboarding({ board: false });
  const alreadyShown = createOnboarding({ shown: true });

  assert.equal(recordTaskCreatedForBulkShortcutHint(beforeBoard), beforeBoard);
  assert.equal(recordTaskCreatedForBulkShortcutHint(alreadyShown), alreadyShown);
  assert.equal(shouldOfferBulkTaskShortcutHint(beforeBoard), false);
  assert.equal(shouldOfferBulkTaskShortcutHint(alreadyShown), false);
});

test('showing the hint consumes it permanently without clearing the first task marker', () => {
  const onboarding = createOnboarding({ firstTaskCreated: true });
  const updated = markBulkTaskShortcutHintShown(onboarding);

  assert.equal(updated.hints.bulkTaskShortcut.firstTaskCreated, true);
  assert.equal(updated.hints.bulkTaskShortcut.shown, true);
  assert.equal(shouldOfferBulkTaskShortcutHint(updated), false);
  assert.equal(markBulkTaskShortcutHintShown(updated), updated);
});

test('showing the weekly reflection reminder consumes it without changing other hints', () => {
  const onboarding = createOnboarding({ firstTaskCreated: true });
  const updated = markWeeklyReflectionReminderShown(onboarding);

  assert.equal(updated.hints.weeklyReflectionReminder.shown, true);
  assert.deepEqual(updated.hints.bulkTaskShortcut, onboarding.hints.bulkTaskShortcut);
  assert.equal(markWeeklyReflectionReminderShown(updated), updated);
});

test('cleanup tutorial completion records its first timestamp only', () => {
  const onboarding = createOnboarding();
  const completed = recordCleanupTutorialCompleted(onboarding, 1000);

  assert.equal(completed.hints.weeklyReflectionReminder.cleanupTutorialCompletedAt, 1000);
  assert.equal(recordCleanupTutorialCompleted(completed, 2000), completed);
});
