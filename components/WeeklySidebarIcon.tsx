import React from 'react';
import type { WeeklySidebarIconBar } from '../utils/weeklySidebarIcon';

export { buildWeeklySidebarIconBars } from '../utils/weeklySidebarIcon';
export type { WeeklySidebarIconBar } from '../utils/weeklySidebarIcon';

interface WeeklySidebarIconProps {
  bars: WeeklySidebarIconBar[];
}

export const WeeklySidebarIcon: React.FC<WeeklySidebarIconProps> = ({ bars }) => (
  <div
    className="flex h-7 w-9 items-start justify-center gap-0.5"
    aria-hidden="true"
  >
    {bars.map(bar => (
      <div
        key={bar.day}
        className="flex h-full min-w-0 flex-1 items-start overflow-hidden bg-transparent"
      >
        <div
          className="relative w-full overflow-hidden transition-[height] duration-500 ease-out motion-reduce:transition-none"
          style={{ height: `${bar.heightPercent}%` }}
        >
          <div className="absolute inset-0 bg-black dark:bg-white" />
          <div
            className="absolute left-0 top-0 w-full bg-neutral-400 transition-[height] duration-500 ease-out motion-reduce:transition-none dark:bg-neutral-500"
            style={{ height: `${bar.donePercent}%` }}
          />
        </div>
      </div>
    ))}
  </div>
);
