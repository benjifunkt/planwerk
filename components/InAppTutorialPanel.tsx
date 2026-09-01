import React from 'react';
import { AnimatedWorkWeekTimeLogo } from './animations';
import { PrimaryButton, SecondaryButton } from './Buttons';

export interface InAppTutorialPanelProps {
  title: string;
  body: string;
  buttonLabel: string;
  secondaryButtonLabel?: string;
  isExiting?: boolean;
  visual?: React.ReactNode;
  onContinue: () => void;
  onSecondary?: () => void;
}

export const InAppTutorialPanel: React.FC<InAppTutorialPanelProps> = ({
  title,
  body,
  buttonLabel,
  secondaryButtonLabel,
  isExiting = false,
  visual,
  onContinue,
  onSecondary,
}) => (
  <aside
    className={`fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white px-6 py-7 text-black shadow-[0_-8px_24px_rgba(0,0,0,0.08)] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 ${isExiting ? 'in-app-tutorial-panel-exit' : 'in-app-tutorial-panel-enter'}`}
    aria-live="polite"
  >
    <style>{`
      @keyframes in-app-tutorial-slide-in {
        from { opacity: 0; transform: translateY(100%); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes in-app-tutorial-slide-out {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(100%); }
      }

      .in-app-tutorial-panel-enter {
        animation: in-app-tutorial-slide-in 0.75s cubic-bezier(0.2, 0.85, 0.2, 1) both;
      }

      .in-app-tutorial-panel-exit {
        animation: in-app-tutorial-slide-out 0.55s cubic-bezier(0.4, 0, 0.2, 1) both;
      }

      @media (prefers-reduced-motion: reduce) {
        .in-app-tutorial-panel-enter,
        .in-app-tutorial-panel-exit {
          animation-duration: 0.01s;
        }
      }
    `}</style>
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
      <div className="mb-2 scale-75" aria-hidden="true">
        {visual || <AnimatedWorkWeekTimeLogo />}
      </div>
      <h2 className="text-2xl font-black tracking-tight md:text-3xl">
        {title}
      </h2>
      {body && (
        <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300 md:text-base">
          {body}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
        {secondaryButtonLabel && onSecondary && (
          <SecondaryButton className="px-10 py-3 text-xs" onClick={onSecondary}>
            {secondaryButtonLabel}
          </SecondaryButton>
        )}
        <PrimaryButton className="px-10 py-3 text-xs" onClick={onContinue}>
          {buttonLabel}
        </PrimaryButton>
      </div>
    </div>
  </aside>
);
