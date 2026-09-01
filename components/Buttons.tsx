import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const joinClasses = (...classes: Array<string | undefined>) => (
  classes.filter(Boolean).join(' ')
);

const renderButtonContent = (
  children: React.ReactNode,
  icon?: React.ReactNode,
  iconPosition: 'left' | 'right' = 'left'
) => {
  if (!icon) return children;

  return (
    <>
      {iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </>
  );
};

export const SecondaryButton: React.FC<ButtonProps> = ({
  className,
  children,
  icon,
  iconPosition = 'left',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={joinClasses(
      'inline-flex items-center justify-center gap-2 border border-neutral-200 px-8 py-3 font-bold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400 disabled:hover:bg-transparent disabled:hover:text-neutral-400 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-white dark:hover:text-black dark:disabled:border-neutral-800 dark:disabled:text-neutral-600',
      className
    )}
    {...props}
  >
    {renderButtonContent(children, icon, iconPosition)}
  </button>
);

export const PrimaryButton: React.FC<ButtonProps> = ({
  className,
  children,
  icon,
  iconPosition = 'left',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={joinClasses(
      'inline-flex items-center justify-center gap-2 bg-black px-8 py-3 font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-400',
      className
    )}
    {...props}
  >
    {renderButtonContent(children, icon, iconPosition)}
  </button>
);

export const TertiaryButton: React.FC<ButtonProps> = ({
  className,
  children,
  icon,
  iconPosition = 'left',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={joinClasses(
      'inline-flex min-h-[40px] h-auto items-center justify-center gap-2 rounded-none px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500 transition-all hover:bg-black/10 hover:text-black active:bg-black/15 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent disabled:hover:text-neutral-300 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15 dark:disabled:text-neutral-700',
      className
    )}
    {...props}
  >
    {renderButtonContent(children, icon, iconPosition)}
  </button>
);

export interface SubSideMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
}

export const SubSideMenuButton: React.FC<SubSideMenuButtonProps> = ({
  className,
  isActive = false,
  type = 'button',
  children,
  ...props
}) => (
  <button
    type={type}
    className={joinClasses(
      'flex h-24 w-full items-center justify-center px-1 py-1.5 text-center font-bold uppercase tracking-[0.18em] text-[10px] rounded-none transition-all',
      isActive
        ? 'text-black dark:text-white'
        : 'text-neutral-400 hover:bg-black/10 hover:text-black active:bg-black/15 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15',
      className
    )}
    aria-pressed={isActive}
    {...props}
  >
    <span
      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      className="leading-none"
    >
      {children}
    </span>
  </button>
);
