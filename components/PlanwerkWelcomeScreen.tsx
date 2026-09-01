import React from 'react';
import type { PlanwerkStorageStatus } from '../hooks/useStore';
import { TranslationKey, useI18n } from '../i18n';
import { AppState, DayColumnId, MaxHoursByDay } from '../types';
import { AnimatedPlanwerkLogo, AnimatedWorkWeekTimeLogo } from './animations';
import { PrimaryButton, SecondaryButton, TertiaryButton } from './Buttons';
import { WorkWeekSettings } from './WorkWeekSettings';

const IconPlus = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 5v14M5 12h14" />
  </svg>
);

const IconFolderOpen = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 6h6l2 2h8v10H4z" />
  </svg>
);

interface OnboardingRevealProps {
  delaySeconds: number;
  children: React.ReactNode;
}

const ONBOARDING_SCREEN_EXIT_MS = 550;

const OnboardingRevealStyles: React.FC = () => (
  <style>{`
    @keyframes onboarding-reveal {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes onboarding-screen-exit {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(10px);
      }
    }

    @keyframes workweek-intro-shift {
      from {
        top: 50%;
      }
      to {
        top: calc(50% - clamp(11rem, 28vh, 16rem));
      }
    }

    .workweek-intro-shift {
      animation: workweek-intro-shift 900ms ease-in-out 2.5s forwards;
    }

    .workweek-settings-center {
      top: calc(50% + clamp(1rem, 3vh, 2rem));
    }

    .workweek-continue-position {
      top: calc(50% + clamp(11rem, 26vh, 14rem));
    }

    .onboarding-screen-exit {
      animation: onboarding-screen-exit 520ms ease-in both;
    }

    @media (prefers-reduced-motion: reduce) {
      .onboarding-reveal {
        animation-duration: 1ms !important;
        animation-delay: 0s !important;
        transform: none !important;
      }

      .workweek-intro-shift {
        animation: none !important;
        top: calc(50% - clamp(11rem, 28vh, 16rem));
      }

      .onboarding-screen-exit {
        animation-duration: 1ms !important;
      }
    }
  `}</style>
);

const OnboardingReveal: React.FC<OnboardingRevealProps> = ({ delaySeconds, children }) => (
  <div
    className="onboarding-reveal flex w-full flex-col items-center opacity-0"
    style={{
      animation: `onboarding-reveal 1s ease-out ${delaySeconds}s forwards`,
    }}
  >
    {children}
  </div>
);

interface PlanwerkWelcomeScreenProps {
  storageStatus: PlanwerkStorageStatus;
  onCreatePlanwerkFile: () => Promise<boolean>;
  onOpenPlanwerkFile: () => Promise<boolean>;
  mode?: 'file' | 'intro' | 'workWeek';
  onCompleteIntro: () => void;
  onSkipOnboarding: () => void;
  visibleDays: DayColumnId[];
  weekStartDay: DayColumnId;
  maxHoursPerDayByDay: MaxHoursByDay;
  onSetVisibleDays: (days: DayColumnId[]) => void;
  onUpdateSettings: (updates: Partial<AppState>) => void;
  onCompleteWorkWeekSetup: () => void;
}

export const PlanwerkWelcomeScreen: React.FC<PlanwerkWelcomeScreenProps> = ({
  storageStatus,
  onCreatePlanwerkFile,
  onOpenPlanwerkFile,
  mode = 'file',
  onCompleteIntro,
  onSkipOnboarding,
  visibleDays,
  weekStartDay,
  maxHoursPerDayByDay,
  onSetVisibleDays,
  onUpdateSettings,
  onCompleteWorkWeekSetup,
}) => {
  const { t } = useI18n();
  const [isScreenExiting, setIsScreenExiting] = React.useState(false);
  const isDisabled = !storageStatus.isElectron || storageStatus.isLoading;
  const screenKey = mode;

  React.useEffect(() => {
    setIsScreenExiting(false);
  }, [mode]);

  const runWithScreenExit = (callback: () => void) => {
    setIsScreenExiting(true);
    window.setTimeout(callback, ONBOARDING_SCREEN_EXIT_MS);
  };

  const handleCompleteIntro = () => runWithScreenExit(onCompleteIntro);
  const handleSkipOnboarding = () => runWithScreenExit(onSkipOnboarding);

  return (
    <main
      className="flex h-screen w-full items-start justify-center overflow-y-auto bg-transparent px-6 py-10 text-black selection:bg-black selection:text-white dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black"
      role="main"
    >
      <OnboardingRevealStyles />
      {mode === 'workWeek' ? (
        <div
          className="workweek-onboarding-stage relative w-full max-w-5xl"
          style={{ minHeight: 'min(760px, calc(100vh - 5rem))' }}
        >
          <div className="workweek-intro-shift absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
            <AnimatedWorkWeekTimeLogo />

            <OnboardingReveal key={`title-${screenKey}`} delaySeconds={0.5}>
              <h1 className="mt-8 max-w-xl text-4xl font-black leading-none tracking-tight sm:text-5xl">
                {t('welcome.workWeekTitle')}
              </h1>
            </OnboardingReveal>

            <OnboardingReveal key={`body-${screenKey}`} delaySeconds={0.7}>
              <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
                {t('welcome.workWeekBody')}
              </p>
            </OnboardingReveal>
          </div>

          <div className="workweek-settings-center absolute left-1/2 w-full -translate-x-1/2 -translate-y-1/2">
            <OnboardingReveal key={`actions-${screenKey}`} delaySeconds={3.7}>
              <div className="mt-20 w-full">
                <WorkWeekSettings
                  visibleDays={visibleDays}
                  weekStartDay={weekStartDay}
                  maxHoursPerDayByDay={maxHoursPerDayByDay}
                  onSetVisibleDays={onSetVisibleDays}
                  onUpdateSettings={onUpdateSettings}
                  variant="welcome"
                />
              </div>
            </OnboardingReveal>
          </div>

          <div className="workweek-continue-position absolute left-1/2 -translate-x-1/2">
            <OnboardingReveal key={`continue-${screenKey}`} delaySeconds={3.9}>
              <PrimaryButton
                onClick={onCompleteWorkWeekSetup}
                className="w-auto !px-6 !py-2 text-xs"
              >
                {t('welcome.continueToBoard')}
              </PrimaryButton>
            </OnboardingReveal>
          </div>
        </div>
      ) : mode === 'intro' ? (
        <div className={`my-auto flex w-full max-w-2xl flex-col items-center text-center ${isScreenExiting ? 'onboarding-screen-exit' : ''}`}>
          <OnboardingReveal key={`title-${screenKey}`} delaySeconds={0.5}>
            <h1 className="max-w-xl text-4xl font-black leading-none tracking-tight sm:text-5xl">
              {t('welcome.introTitle')}
            </h1>
          </OnboardingReveal>

          <OnboardingReveal key={`body-${screenKey}`} delaySeconds={0.7}>
            <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
              {t('welcome.introBody')}
            </p>
          </OnboardingReveal>

          <OnboardingReveal key={`actions-${screenKey}`} delaySeconds={2.5}>
            <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3">
              <PrimaryButton
                onClick={handleCompleteIntro}
                className="w-full"
              >
                {t('welcome.introStart')}
              </PrimaryButton>
              <TertiaryButton
                onClick={handleSkipOnboarding}
                className="w-full"
              >
                {t('welcome.introSkip')}
              </TertiaryButton>
            </div>
          </OnboardingReveal>
        </div>
      ) : (
        <div className="my-auto flex w-full max-w-2xl flex-col items-center text-center">
          <AnimatedPlanwerkLogo />

          <OnboardingReveal key={`title-${screenKey}`} delaySeconds={0.5}>
            <h1 className="mt-10 max-w-xl text-4xl font-black leading-none tracking-tight sm:text-5xl">
              {t('file.welcomeTitle')}
            </h1>
          </OnboardingReveal>

          <OnboardingReveal key={`body-${screenKey}`} delaySeconds={0.7}>
            <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
              {t('file.welcomeBody')}
            </p>
          </OnboardingReveal>

          <OnboardingReveal key={`actions-${screenKey}`} delaySeconds={2.5}>
            <>
              {!storageStatus.isElectron && (
                <p className="mt-4 max-w-lg text-sm font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {t('file.browserUnsupported')}
                </p>
              )}

              {storageStatus.error && storageStatus.isElectron && (
                <div className="mt-6 w-full max-w-lg border border-red-600 bg-red-50 p-3 text-left text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {storageStatus.error.startsWith('file.') ? t(storageStatus.error as TranslationKey) : storageStatus.error}
                </div>
              )}

              <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
                <PrimaryButton
                  onClick={onCreatePlanwerkFile}
                  disabled={isDisabled}
                  icon={<IconPlus />}
                  className="flex-1"
                >
                  {storageStatus.isLoading ? t('file.loading') : t('settings.newPlanwerk')}
                </PrimaryButton>
                <SecondaryButton
                  onClick={onOpenPlanwerkFile}
                  disabled={isDisabled}
                  icon={<IconFolderOpen />}
                  className="flex-1"
                >
                  {t('settings.openPlanwerk')}
                </SecondaryButton>
              </div>
            </>
          </OnboardingReveal>
        </div>
      )}
    </main>
  );
};
