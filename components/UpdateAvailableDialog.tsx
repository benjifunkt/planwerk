import React, { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { PrimaryButton, SecondaryButton } from './Buttons';

interface UpdateAvailableDialogProps {
  version: string;
  onLater: () => void;
  onOpenRelease: () => void;
}

export const UpdateAvailableDialog: React.FC<UpdateAvailableDialogProps> = ({
  version,
  onLater,
  onOpenRelease,
}) => {
  const { t } = useI18n();
  const titleId = 'planwerk-update-dialog-title';
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onLater();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    buttons?.[buttons.length - 1]?.focus();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [onLater]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md border border-neutral-200 bg-white p-7 text-black shadow-sm outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        <h2 id={titleId} className="text-2xl font-black uppercase tracking-tight">
          {t('settings.updateDialogTitle', { version })}
        </h2>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={onLater} className="px-5 py-2 text-xs">
            {t('settings.updateDialogLater')}
          </SecondaryButton>
          <PrimaryButton onClick={onOpenRelease} className="px-5 py-2 text-xs">
            {t('settings.updateDialogOpenRelease')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};
