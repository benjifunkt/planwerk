import { OnboardingState } from '../types';

export const shouldOfferBulkTaskShortcutHint = (onboarding: OnboardingState) => (
  onboarding.tutorial.board
  && onboarding.hints.bulkTaskShortcut.firstTaskCreated
  && !onboarding.hints.bulkTaskShortcut.shown
);

export const recordTaskCreatedForBulkShortcutHint = (onboarding: OnboardingState): OnboardingState => {
  const shortcutHint = onboarding.hints.bulkTaskShortcut;
  if (!onboarding.tutorial.board || shortcutHint.firstTaskCreated || shortcutHint.shown) {
    return onboarding;
  }

  return {
    ...onboarding,
    hints: {
      ...onboarding.hints,
      bulkTaskShortcut: {
        ...shortcutHint,
        firstTaskCreated: true,
      },
    },
  };
};

export const markBulkTaskShortcutHintShown = (onboarding: OnboardingState): OnboardingState => {
  if (onboarding.hints.bulkTaskShortcut.shown) return onboarding;

  return {
    ...onboarding,
    hints: {
      ...onboarding.hints,
      bulkTaskShortcut: {
        ...onboarding.hints.bulkTaskShortcut,
        shown: true,
      },
    },
  };
};

export const markWeeklyReflectionReminderShown = (onboarding: OnboardingState): OnboardingState => {
  if (onboarding.hints.weeklyReflectionReminder.shown) return onboarding;

  return {
    ...onboarding,
    hints: {
      ...onboarding.hints,
      weeklyReflectionReminder: {
        shown: true,
      },
    },
  };
};

export const recordCleanupTutorialCompleted = (
  onboarding: OnboardingState,
  completedAt: number
): OnboardingState => {
  if (onboarding.hints.weeklyReflectionReminder.cleanupTutorialCompletedAt != null) {
    return onboarding;
  }

  return {
    ...onboarding,
    hints: {
      ...onboarding.hints,
      weeklyReflectionReminder: {
        ...onboarding.hints.weeklyReflectionReminder,
        cleanupTutorialCompletedAt: completedAt,
      },
    },
  };
};
