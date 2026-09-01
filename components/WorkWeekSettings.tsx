import React, { useEffect, useState } from 'react';
import { DAY_COLUMN_IDS, getOrderedDayColumnIds } from '../constants';
import { AppState, DayColumnId, MaxHoursByDay } from '../types';
import { getDayLabelKey, useI18n } from '../i18n';

interface WorkWeekSettingsProps {
  visibleDays: DayColumnId[];
  maxHoursPerDayByDay: MaxHoursByDay;
  weekStartDay: DayColumnId;
  onSetVisibleDays: (days: DayColumnId[]) => void;
  onUpdateSettings: (updates: Partial<AppState>) => void;
  variant?: 'settings' | 'welcome';
}

const LONG_DAY_WARNING_THRESHOLD_HOURS = 6;
const LONG_DAY_WARNING_REVEAL_MS = 300;
const LONG_DAY_WARNING_LETTER_MS = 50;
const LONG_DAY_WARNING_MAX_LETTERS = 24;

const formatMaxHoursDisplay = (value: number) => {
  const rounded = Math.trunc(value * 10) / 10;
  return rounded.toFixed(1).replace('.', ',');
};

const createMaxHoursDrafts = (values: MaxHoursByDay): Record<DayColumnId, string> => (
  DAY_COLUMN_IDS.reduce((acc, day) => {
    acc[day] = formatMaxHoursDisplay(values[day]);
    return acc;
  }, {} as Record<DayColumnId, string>)
);

const normalizeMaxHoursDraft = (value: string) => {
  const cleaned = value.replace(/\s+/g, '').replace(/[^\d.,]/g, '');
  if (!cleaned) return '';

  const integerPart = cleaned.match(/^\d+/)?.[0] ?? '';
  const separatorIndex = cleaned.search(/[.,]/);
  if (separatorIndex === -1) return integerPart;

  const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[^\d]/g, '').slice(0, 1);
  return `${integerPart || '0'},${decimalPart}`;
};

const parseMaxHoursDraft = (value: string) => {
  const normalized = normalizeMaxHoursDraft(value);
  if (!normalized) return null;

  const numeric = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(numeric)) return null;

  return Math.max(0, Math.trunc(numeric * 10) / 10);
};

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    mediaQuery.addEventListener?.('change', updatePreference);
    return () => mediaQuery.removeEventListener?.('change', updatePreference);
  }, []);

  return prefersReducedMotion;
};

const getLongDayWarningHours = (visibleDays: DayColumnId[], maxHoursDrafts: Record<DayColumnId, string>, maxHoursPerDayByDay: MaxHoursByDay) => {
  const maxVisibleHours = DAY_COLUMN_IDS.reduce((maxHours, day) => {
    const parsedDraft = parseMaxHoursDraft(maxHoursDrafts[day]);
    const savedOrDraftHours = parsedDraft ?? maxHoursPerDayByDay[day];
    const dayHours = maxHoursDrafts[day] === ''
      ? 0
      : savedOrDraftHours || 0;

    if (!visibleDays.includes(day) && dayHours <= 0) return maxHours;

    return Math.max(maxHours, dayHours);
  }, 0);

  if (maxVisibleHours >= LONG_DAY_WARNING_THRESHOLD_HOURS) {
    return Math.min(LONG_DAY_WARNING_MAX_LETTERS, Math.max(1, Math.ceil(maxVisibleHours)));
  }

  return 0;
};

const LongDayWarningStyles: React.FC = () => (
  <style>{`
    @keyframes long-day-warning-reveal {
      from {
        max-height: 0;
        opacity: 0;
        transform: scaleY(0.96);
      }
      to {
        max-height: 12rem;
        opacity: 1;
        transform: scaleY(1);
      }
    }

    @keyframes long-day-warning-exit {
      from {
        max-height: 12rem;
        opacity: 1;
        transform: scaleY(1);
      }
      to {
        max-height: 0;
        opacity: 0;
        transform: scaleY(0.96);
      }
    }

    .long-day-warning-reveal {
      animation: long-day-warning-reveal ${LONG_DAY_WARNING_REVEAL_MS}ms ease-out both;
      transform-origin: top;
    }

    .long-day-warning-exit {
      animation: long-day-warning-exit ${LONG_DAY_WARNING_REVEAL_MS}ms ease-in both;
    }

    @media (prefers-reduced-motion: reduce) {
      .long-day-warning-reveal {
        animation-duration: 1ms !important;
        transform: none !important;
      }

      .long-day-warning-exit {
        animation-duration: 1ms !important;
        transform: none !important;
      }
    }
  `}</style>
);

const LongDayWarning: React.FC<{ isExiting: boolean; letterCount: number }> = ({ isExiting, letterCount }) => {
  const { language, t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [visibleLetterCount, setVisibleLetterCount] = useState(() => (
    prefersReducedMotion ? letterCount : 1
  ));

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleLetterCount(letterCount);
    }
  }, [letterCount, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || visibleLetterCount === letterCount) return;

    const delay = visibleLetterCount === 1
      ? LONG_DAY_WARNING_REVEAL_MS + LONG_DAY_WARNING_LETTER_MS
      : LONG_DAY_WARNING_LETTER_MS;
    const timeout = window.setTimeout(() => {
      setVisibleLetterCount(current => (
        current < letterCount ? current + 1 : current - 1
      ));
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [letterCount, prefersReducedMotion, visibleLetterCount]);

  const middleLetter = language === 'de' ? 'a' : 'o';
  const longWord = `l${middleLetter.repeat(visibleLetterCount)}ng`;

  return (
    <div
      className={`long-day-warning-reveal overflow-hidden ${isExiting ? 'long-day-warning-exit' : ''}`}
    >
      <LongDayWarningStyles />
      <div className="border border-neutral-200 bg-neutral-50 px-3 py-3 text-left dark:border-neutral-700 dark:bg-neutral-900/60">
        <h4 className="text-base font-black leading-tight text-black dark:text-white">
          {t('settings.longDayWarningTitleLead')}{' '}
          <span className="bg-black px-1.5 py-0.5 text-white dark:bg-white dark:text-black">
            {longWord}
          </span>
        </h4>
        <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
          {t('settings.longDayWarning')}
        </p>
      </div>
    </div>
  );
};

export const WorkWeekSettings: React.FC<WorkWeekSettingsProps> = ({
  visibleDays,
  maxHoursPerDayByDay,
  weekStartDay,
  onSetVisibleDays,
  onUpdateSettings,
}) => {
  const { t } = useI18n();
  const [maxHoursDrafts, setMaxHoursDrafts] = useState<Record<DayColumnId, string>>(() => (
    createMaxHoursDrafts(maxHoursPerDayByDay)
  ));
  const orderedDays = getOrderedDayColumnIds(weekStartDay);
  const longDayWarningHours = getLongDayWarningHours(visibleDays, maxHoursDrafts, maxHoursPerDayByDay);
  const showLongDayWarning = longDayWarningHours > 0;
  const [renderedLongDayWarningHours, setRenderedLongDayWarningHours] = useState(longDayWarningHours);
  const wrapperClassName = 'flex flex-col gap-4 border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900 shadow-sm ';

  useEffect(() => {
    setMaxHoursDrafts(createMaxHoursDrafts(maxHoursPerDayByDay));
  }, [maxHoursPerDayByDay]);

  useEffect(() => {
    if (longDayWarningHours > 0) {
      setRenderedLongDayWarningHours(longDayWarningHours);
      return;
    }

    if (renderedLongDayWarningHours <= 0) return;

    const timeout = window.setTimeout(() => setRenderedLongDayWarningHours(0), LONG_DAY_WARNING_REVEAL_MS);
    return () => window.clearTimeout(timeout);
  }, [longDayWarningHours, renderedLongDayWarningHours]);

  const updateMaxHours = (day: DayColumnId, nextValue: number) => {
    const nextVisibleDays = DAY_COLUMN_IDS.filter(candidate => (
      candidate === day ? nextValue > 0 : visibleDays.includes(candidate)
    ));

    onUpdateSettings({
      maxHoursPerDayByDay: {
        ...maxHoursPerDayByDay,
        [day]: nextValue,
      }
    });

    if (nextVisibleDays.length > 0) {
      onSetVisibleDays(nextVisibleDays);
    }
  };

  const handleMaxHoursChange = (day: DayColumnId, value: string) => {
    const normalizedDraft = normalizeMaxHoursDraft(value);
    setMaxHoursDrafts(prev => ({ ...prev, [day]: normalizedDraft }));
  };

  const handleMaxHoursBlur = (day: DayColumnId) => {
    const parsed = parseMaxHoursDraft(maxHoursDrafts[day]);
    const nextValue = parsed ?? maxHoursPerDayByDay[day];

    if (nextValue <= 0 && visibleDays.length === 1 && visibleDays.includes(day)) {
      setMaxHoursDrafts(prev => ({ ...prev, [day]: formatMaxHoursDisplay(maxHoursPerDayByDay[day]) }));
      return;
    }

    setMaxHoursDrafts(prev => ({ ...prev, [day]: formatMaxHoursDisplay(nextValue) }));
    const shouldChangeVisibility = nextValue > 0 !== visibleDays.includes(day);
    if (nextValue !== maxHoursPerDayByDay[day] || shouldChangeVisibility) {
      updateMaxHours(day, nextValue);
    }
  };

  return (
    <div className={wrapperClassName}>
      <div className="w-full">
        <div className="grid w-full grid-cols-[minmax(88px,140px)_repeat(7,minmax(0,1fr))] gap-x-2 gap-y-3 items-start sm:gap-x-3">
          <div aria-hidden="true" />
          {orderedDays.map((day) => (
            <span
              key={`label-${day}`}
              className="text-center text-xs font-bold uppercase tracking-wider text-black dark:text-white"
            >
              {t(getDayLabelKey(day))}
            </span>
          ))}

          <div className="flex h-full items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('settings.maxHoursPerDay')}</span>
          </div>
          {orderedDays.map((day) => (
            <input
              key={`hours-${day}`}
              type="text"
              inputMode="decimal"
              value={maxHoursDrafts[day]}
              onChange={(e) => handleMaxHoursChange(day, e.target.value)}
              onBlur={() => handleMaxHoursBlur(day)}
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.currentTarget.select()}
              aria-label={t('settings.maxHoursAria', { day: t(getDayLabelKey(day)) })}
              className="w-full border border-neutral-300 dark:border-neutral-700 p-2 bg-transparent dark:bg-neutral-800 text-center font-bold text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
            />
          ))}
        </div>
      </div>

      {renderedLongDayWarningHours > 0 && (
        <LongDayWarning isExiting={!showLongDayWarning} letterCount={renderedLongDayWarningHours} />
      )}
    </div>
  );
};
