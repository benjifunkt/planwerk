import React from 'react';

interface SubSideMenuProps {
  children?: React.ReactNode;
}

export const SubSideMenu: React.FC<SubSideMenuProps> = ({ children }) => {
  return (
    <aside className="w-16 shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <div
        className="h-20 border-black dark:border-neutral-700 flex items-center justify-center px-2 select-none"
        aria-hidden="true"
      />
      <nav className="flex-1 flex flex-col items-center gap-1 p-2">
        {children}
      </nav>
    </aside>
  );
};
