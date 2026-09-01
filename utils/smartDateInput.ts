export interface SmartDateResult {
  formatted: string;
  iso: string;
}

export interface SmartDatePreviewParts extends SmartDateResult {
  typedText: string;
  spacer: string;
  suffix: string;
}

const padDayOrMonth = (value: number) => String(value).padStart(2, '0');
const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const toSmartDateResult = (year: number, month: number, day: number): SmartDateResult => {
  const DD = padDayOrMonth(day);
  const MM = padDayOrMonth(month);
  const YYYY = String(year);
  return { formatted: `${DD}.${MM}.${YYYY}`, iso: `${YYYY}-${MM}-${DD}` };
};

const getNextLeadingZeroDayResult = (baseDate: Date): SmartDateResult => {
  for (let offset = 1; offset <= 370; offset += 1) {
    const candidate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offset);
    const day = candidate.getDate();
    if (day >= 1 && day <= 9) {
      return toSmartDateResult(candidate.getFullYear(), candidate.getMonth() + 1, day);
    }
  }

  return toSmartDateResult(baseDate.getFullYear(), baseDate.getMonth() + 1, baseDate.getDate());
};

const getNextLeadingZeroMonthResult = (day: number, baseDate: Date): SmartDateResult | null => {
  if (!Number.isInteger(day) || day < 1) return null;

  const startOfBaseDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  for (let year = baseDate.getFullYear(); year <= baseDate.getFullYear() + 2; year += 1) {
    for (let month = 1; month <= 9; month += 1) {
      if (day > getDaysInMonth(year, month)) continue;

      const candidate = new Date(year, month - 1, day);
      if (candidate >= startOfBaseDay) {
        return toSmartDateResult(year, month, day);
      }
    }
  }

  return null;
};

const shouldCloseSingleDayDigit = (digit: string, baseDate: Date) => {
  const value = Number(digit);
  if (!Number.isInteger(value) || value < 1) return false;

  const maxDay = getDaysInMonth(baseDate.getFullYear(), baseDate.getMonth() + 1);
  const maxTens = Math.floor(maxDay / 10);
  return value > maxTens;
};

const shouldCloseSingleMonthDigit = (digit: string) => {
  const value = Number(digit);
  return Number.isInteger(value) && value > 1;
};

export const parseSmartDateInput = (input: string, baseDate: Date = new Date()): SmartDateResult => {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth() + 1;
  const currentDay = baseDate.getDate();

  if (!input || !input.trim()) {
    const d = padDayOrMonth(currentDay);
    const m = padDayOrMonth(currentMonth);
    return { formatted: `${d}.${m}.${currentYear}`, iso: `${currentYear}-${m}-${d}` };
  }

  const parts = input.split('.');
  const dStr = parts[0];
  const mStr = parts.length > 1 ? parts[1] : '';
  const yStr = parts.length > 2 ? parts[2] : '';

  if (parts.length === 1 && dStr === '0') {
    return getNextLeadingZeroDayResult(baseDate);
  }

  let d = parseInt(dStr, 10);
  let m = parseInt(mStr, 10);
  let y = parseInt(yStr, 10);

  const monthProvided = !isNaN(m);
  const yearProvided = !isNaN(y);

  if (parts.length === 2 && mStr === '0') {
    const leadingZeroMonthResult = getNextLeadingZeroMonthResult(d, baseDate);
    if (leadingZeroMonthResult) return leadingZeroMonthResult;
  }

  if (isNaN(d)) d = currentDay;
  if (!monthProvided) m = currentMonth;
  if (!yearProvided) y = currentYear;

  if (yearProvided && y < 100) {
    y += 2000;
  }

  if (monthProvided && !yearProvided) {
    if (m < currentMonth || (m === currentMonth && d < currentDay)) {
      y = currentYear + 1;
    }
  } else if (!monthProvided) {
    if (d < currentDay) {
      m = currentMonth + 1;
      if (m > 12) {
        m = 1;
        y = currentYear + 1;
      }
    }
  }

  if (m < 1) m = 1;
  if (m > 12) m = 12;
  const maxDays = new Date(y, m, 0).getDate();
  if (d < 1) d = 1;
  if (d > maxDays) d = maxDays;

  return toSmartDateResult(y, m, d);
};

const formatSeparatedDateDraft = (rawValue: string, previousValue: string) => {
  const parts = rawValue.replace(/[^\d.]/g, '').split('.');
  const day = (parts[0] || '').replace(/\D/g, '').slice(0, 2);
  const rawMonth = (parts[1] || '').replace(/\D/g, '');
  let month = rawMonth.slice(0, 2);
  let year = (parts[2] || '').replace(/\D/g, '').slice(0, 4);
  const dotCount = Math.min((rawValue.match(/\./g) || []).length, 2);
  const previousParts = previousValue.split('.');
  const previousMonth = previousParts[1] || '';

  if (dotCount === 0) return day;
  if (
    dotCount === 1
    && previousMonth.length === 1
    && shouldCloseSingleMonthDigit(previousMonth)
    && rawMonth.length > 1
  ) {
    month = previousMonth;
    year = rawMonth.slice(1, 5);
    return `${day}.${month}.${year}`;
  }
  if (
    dotCount === 1
    && rawMonth.length === 1
    && shouldCloseSingleMonthDigit(rawMonth)
    && !rawValue.endsWith('.')
  ) {
    return `${day}.${rawMonth}.`;
  }
  if (dotCount === 1 && rawMonth.length > 2) {
    month = rawMonth.slice(0, 2);
    year = rawMonth.slice(2, 6);
    return `${day}.${month}.${year}`;
  }
  if (dotCount === 1) return `${day}.${month}`;
  return `${day}.${month}.${year}`;
};

const formatPreviewExtensionDraft = (rawValue: string, previousValue: string) => {
  const previousDayPreview = previousValue.match(/^([1-9])\.(\d{2})\.(\d{4})$/);
  const nextDayPreview = rawValue.match(/^([1-9]\d)\.(\d{2})\.(\d{4})$/);

  if (
    previousDayPreview
    && nextDayPreview
    && nextDayPreview[1].startsWith(previousDayPreview[1])
    && nextDayPreview[2] === previousDayPreview[2]
    && nextDayPreview[3] === previousDayPreview[3]
    && Number(nextDayPreview[1]) <= 31
  ) {
    return nextDayPreview[1];
  }

  const previousMonthPreview = previousValue.match(/^(\d{1,2})\.(1)\.(\d{4})$/);
  const nextMonthPreview = rawValue.match(/^(\d{1,2})\.(1[0-2])\.(\d{4})$/);

  if (
    previousMonthPreview
    && nextMonthPreview
    && nextMonthPreview[1] === previousMonthPreview[1]
    && nextMonthPreview[2].startsWith(previousMonthPreview[2])
    && nextMonthPreview[3] === previousMonthPreview[3]
  ) {
    return `${nextMonthPreview[1]}.${nextMonthPreview[2]}`;
  }

  return null;
};

export const formatSmartDateDraft = (
  rawValue: string,
  previousValue: string,
  baseDate: Date = new Date()
) => {
  if (rawValue.length < previousValue.length) {
    return rawValue;
  }

  const previewExtensionDraft = formatPreviewExtensionDraft(rawValue, previousValue);
  if (previewExtensionDraft) return previewExtensionDraft;

  if (rawValue.includes('.')) {
    return formatSeparatedDateDraft(rawValue, previousValue);
  }

  let cleaned = rawValue.replace(/\D/g, '');
  if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);

  if (cleaned.length === 1 && shouldCloseSingleDayDigit(cleaned, baseDate)) {
    return `${cleaned}.`;
  }

  if (
    previousValue.length === 1
    && shouldCloseSingleDayDigit(previousValue, baseDate)
    && cleaned.startsWith(previousValue)
    && cleaned.length > 1
  ) {
    return `${previousValue}.${cleaned.slice(1, 7)}`;
  }

  if (cleaned.length >= 5) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}.${cleaned.slice(4)}`;
  }

  if (cleaned.length >= 3) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  }

  return cleaned;
};

const isValidPreviewDraft = (input: string, result: SmartDateResult) => {
  if (!input || !input.trim()) return false;
  if (!/^\d{1,2}(\.\d{0,2}(\.\d{0,4})?)?$/.test(input)) return false;

  const [dayInput = '', monthInput = ''] = input.split('.');
  const [formattedDay, formattedMonth] = result.formatted.split('.');

  if (!dayInput) return false;
  if (dayInput === '0') {
    if (!formattedDay.startsWith('0')) return false;
  } else {
    const dayValue = Number(dayInput);
    if (!Number.isInteger(dayValue) || dayValue < 1) return false;
    if (padDayOrMonth(dayValue) !== formattedDay) return false;
  }

  if (input.includes('.') && monthInput) {
    if (monthInput === '0') {
      if (!formattedMonth.startsWith('0')) return false;
    } else {
      const monthValue = Number(monthInput);
      if (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12) return false;
      if (padDayOrMonth(monthValue) !== formattedMonth) return false;
    }
  }

  return true;
};

export const getSmartDatePreviewParts = (
  input: string,
  baseDate: Date = new Date()
): SmartDatePreviewParts | null => {
  const typedText = input.trim();
  const result = parseSmartDateInput(typedText, baseDate);

  if (!isValidPreviewDraft(typedText, result)) return null;

  const [, formattedMonth, formattedYear] = result.formatted.split('.');
  const parts = typedText.split('.');
  const dotCount = (typedText.match(/\./g) || []).length;
  const endsWithDot = typedText.endsWith('.');
  const [typedDay = '', typedMonth = ''] = parts;
  let spacer = '';
  let suffix = '';

  if (typedDay.length === 1 && typedDay !== '0') spacer += '0';
  if (typedMonth.length === 1 && typedMonth !== '0') spacer += '0';

  if (dotCount === 0) {
    if (typedDay === '0') {
      const [formattedDay] = result.formatted.split('.');
      suffix = `${formattedDay.slice(1)}.${formattedMonth}.${formattedYear}`;
    } else {
      suffix = `.${formattedMonth}.${formattedYear}`;
    }
  } else if (dotCount === 1) {
    if (typedMonth === '0') {
      suffix = `${formattedMonth.slice(1)}.${formattedYear}`;
    } else if (endsWithDot) {
      suffix = `${formattedMonth}.${formattedYear}`;
    } else {
      suffix = `.${formattedYear}`;
    }
  } else {
    const typedYear = parts[2] || '';
    if (endsWithDot && !typedYear) {
      suffix = formattedYear;
    } else if (formattedYear.startsWith(typedYear)) {
      suffix = formattedYear.slice(typedYear.length);
    }
  }

  return {
    typedText,
    spacer,
    suffix,
    ...result,
  };
};
