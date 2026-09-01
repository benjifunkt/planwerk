import React from 'react';
import { AnimatedBoardReadyLogo } from './animations';
import { PrimaryButton } from './Buttons';

export interface ViewIntroTutorialScreenProps {
  title: string;
  body: string;
  buttonLabel: string;
  visual?: React.ReactNode;
  onContinue: () => void;
}

export const ViewIntroTutorialScreen: React.FC<ViewIntroTutorialScreenProps> = ({
  title,
  body,
  buttonLabel,
  visual,
  onContinue,
}) => (
  <section className="flex h-full w-full items-center justify-center bg-white px-6 text-center text-black dark:bg-neutral-900 dark:text-neutral-100">
    <style>{`
      @keyframes view-intro-tutorial-reveal {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .view-intro-tutorial-reveal {
        animation: view-intro-tutorial-reveal 1s ease-out both;
      }

      @media (prefers-reduced-motion: reduce) {
        .view-intro-tutorial-reveal {
          animation-duration: 0.01s;
          transform: none;
        }
      }
    `}</style>
    <div className="view-intro-tutorial-reveal flex w-full max-w-2xl flex-col items-center">
      <div className="mb-6 scale-75" aria-hidden="true">
        {visual || <AnimatedBoardReadyLogo />}
      </div>
      <h1 className="max-w-2xl text-3xl font-black leading-tight tracking-tight md:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300 md:text-base">
        {body}
      </p>
      <PrimaryButton className="mt-7 px-7 py-2.5 text-xs" onClick={onContinue}>
        {buttonLabel}
      </PrimaryButton>
    </div>
  </section>
);
