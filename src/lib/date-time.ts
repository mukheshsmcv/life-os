/**
 * date-time.ts
 *
 * Pure date/time utility for Life OS.
 * Timezone: Asia/Kolkata (UTC+05:30).
 *
 * Design rules:
 *  - Never rely on toLocaleDateString / toLocaleTimeString with implicit locale,
 *    because behaviour varies across JS engines.
 *  - All "today" calculations use an explicit +05:30 offset so that a device
 *    near UTC midnight never returns the wrong calendar day.
 *  - No third-party dependencies.
 *  - No React imports — this module is framework-independent.
 */

/** IST offset from UTC in milliseconds: +05:30 = 5.5 * 3600 * 1000 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Returns the current IST wall-clock moment as a Date whose local
 * getFullYear() / getMonth() / getDate() values represent IST components.
 *
 * Implementation: shift the UTC epoch value by +05:30 so that ordinary
 * getDate/getMonth/getFullYear calls return IST values, regardless of the
 * device's system timezone.
 */
function nowInIST(): Date {
  const utcMs = Date.now();
  return new Date(utcMs + IST_OFFSET_MS);
}

/**
 * Returns today's date in YYYY-MM-DD format (IST).
 */
export function getTodayString(): string {
  const d = nowInIST();
  return toYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Returns today ± offsetDays as YYYY-MM-DD (IST).
 * e.g. getDateString(1) = tomorrow, getDateString(-1) = yesterday.
 */
export function getDateString(offsetDays: number, baseDateStr?: string): string {
  if (baseDateStr && isValidDateString(baseDateStr)) {
    const [y, m, d] = baseDateStr.split('-').map(Number);
    const utcMs = Date.UTC(y, m - 1, d) + offsetDays * 86400_000;
    const shifted = new Date(utcMs);
    return toYMD(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  }
  const utcMs = Date.now() + IST_OFFSET_MS;
  const shifted = new Date(utcMs + offsetDays * 86400_000);
  return toYMD(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/**
 * Parses a YYYY-MM-DD string and returns a Date representing local midnight
 * in IST (i.e. 00:00 IST = 18:30 previous UTC day).
 *
 * This is useful when you need to compare a task date to a real Date object.
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Midnight IST = UTC - 5h30m  (UTC midnight on that date + 00:00 IST)
  const utcMs = Date.UTC(year, month - 1, day) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Strict YYYY-MM-DD format + calendar validity check.
 * Rejects impossible dates like 2026-02-31 or 2026-13-01.
 */
export function isValidDateString(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  // Use Date to check day-in-month validity (catches Feb 31, Apr 31, etc.)
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() + 1 === month &&
    check.getUTCDate() === day
  );
}

/**
 * Returns a human-readable label for a YYYY-MM-DD date string:
 *   - "Today"
 *   - "Tomorrow"
 *   - "Mon Sep 15"  (for other dates)
 *
 * Always uses IST for "today" comparison.
 */
export function formatDisplayDate(dateStr: string): string {
  const today = getTodayString();
  const tomorrow = getDateString(1);

  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';

  const [year, month, day] = dateStr.split('-').map(Number);
  // Build a UTC-based date just for day-of-week / month name lookup
  const d = new Date(Date.UTC(year, month - 1, day));

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return `${dayNames[d.getUTCDay()]} ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * Returns the current IST time as a "HH:MM AM/PM" string.
 * Used when building context for the AI server.
 */
/**
 * Returns the current IST time as a "HH:MM AM/PM" string.
 * Used when building context for the AI server.
 */
export function getCurrentTimeStringIST(): string {
  const d = nowInIST();
  const hours = d.getUTCHours();
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 || 12;
  return `${display}:${mins} ${period}`;
}

/**
 * Parses natural language date expressions and returns a YYYY-MM-DD string (IST) if recognized.
 * Supports:
 *  - Explicit YYYY-MM-DD
 *  - "26th September", "26 September", "September 26", "Sep 26", "Sep 26th"
 *  - "26/09", "26-09", "26/09/2026"
 *  - "today", "tonight"
 *  - "tomorrow"
 *  - "day after tomorrow"
 *  - "Monday" .. "Sunday", "next Monday", "this Monday"
 *
 * Uses pure IST date arithmetic without reliance on JS Date local parsing.
 */
export function parseNaturalDateString(inputStr: string, baseDateStr?: string): { date: string | null; matchedPhrase?: string } {
  if (!inputStr || typeof inputStr !== 'string') return { date: null };
  const lower = inputStr.toLowerCase().trim();
  const todayStr = baseDateStr && isValidDateString(baseDateStr) ? baseDateStr : getTodayString();

  // 1. Explicit YYYY-MM-DD
  const ymdMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (ymdMatch && isValidDateString(ymdMatch[1])) {
    return { date: ymdMatch[1], matchedPhrase: ymdMatch[1] };
  }

  // 2. Relative day: "day after tomorrow"
  if (/\b(?:the\s+)?day\s+after\s+tomorrow\b/i.test(lower)) {
    const matched = lower.match(/\b(?:the\s+)?day\s+after\s+tomorrow\b/i)![0];
    return { date: getDateString(2, todayStr), matchedPhrase: matched };
  }

  // 3. Relative day: "tomorrow"
  if (/\btomorrow\b/i.test(lower)) {
    const matched = lower.match(/\btomorrow\b/i)![0];
    return { date: getDateString(1, todayStr), matchedPhrase: matched };
  }

  // 4. Relative day: "today" / "tonight"
  if (/\b(?:today|tonight)\b/i.test(lower)) {
    const matched = lower.match(/\b(?:today|tonight)\b/i)![0];
    return { date: todayStr, matchedPhrase: matched };
  }

  // 5. Month name + Day number (e.g., "26th September", "26 September", "September 26", "Sep 26", "Sep 26th")
  const monthsRegexStr = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const dayRegexStr = '(\\d{1,2})(?:st|nd|rd|th)?';

  const monthMap: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  // Pattern A: "26th September" / "26 Sep"
  const patternA = new RegExp(`\\b${dayRegexStr}\\s+${monthsRegexStr}\\b`, 'i');
  const matchA = lower.match(patternA);
  if (matchA) {
    const day = parseInt(matchA[1], 10);
    const monthKey = matchA[2].toLowerCase();
    const month = monthMap[monthKey];
    if (month && day >= 1 && day <= 31) {
      const todayStr = getTodayString();
      const [currY, currM, currD] = todayStr.split('-').map(Number);
      let year = currY;
      if (month < currM || (month === currM && day < currD)) {
        year = currY + 1;
      }
      const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isValidDateString(candidate)) {
        return { date: candidate, matchedPhrase: matchA[0] };
      }
    }
  }

  // Pattern B: "September 26" / "Sep 26th"
  const patternB = new RegExp(`\\b${monthsRegexStr}\\s+${dayRegexStr}\\b`, 'i');
  const matchB = lower.match(patternB);
  if (matchB) {
    const monthKey = matchB[1].toLowerCase();
    const day = parseInt(matchB[2], 10);
    const month = monthMap[monthKey];
    if (month && day >= 1 && day <= 31) {
      const todayStr = getTodayString();
      const [currY, currM, currD] = todayStr.split('-').map(Number);
      let year = currY;
      if (month < currM || (month === currM && day < currD)) {
        year = currY + 1;
      }
      const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isValidDateString(candidate)) {
        return { date: candidate, matchedPhrase: matchB[0] };
      }
    }
  }

  // 6. Numeric slash/dash date: "26/09", "26-09", "26/09/2026"
  const numericMatch = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}|\d{2}))?\b/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10);
    let year = numericMatch[3] ? parseInt(numericMatch[3], 10) : undefined;
    if (year !== undefined && year < 100) year += 2000;

    const todayStr = getTodayString();
    const [currY, currM, currD] = todayStr.split('-').map(Number);
    if (!year) {
      year = currY;
      if (month < currM || (month === currM && day < currD)) {
        year = currY + 1;
      }
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isValidDateString(candidate)) {
        return { date: candidate, matchedPhrase: numericMatch[0] };
      }
    }
  }

  // 7. Weekday terms: "weekday", "weekdays", "next weekday"
  const weekdayTermMatch = lower.match(/\b(?:on\s+|for\s+)?(this\s+|next\s+)?(weekdays?|weekday)\b/i);
  if (weekdayTermMatch) {
    const prefix = weekdayTermMatch[1] ? weekdayTermMatch[1].trim().toLowerCase() : '';
    const [y, m, d] = todayStr.split('-').map(Number);
    const todayDate = new Date(Date.UTC(y, m - 1, d));
    const utcDow = todayDate.getUTCDay();
    const currWeekIndex = utcDow === 0 ? 7 : utcDow;

    let daysAhead = 0;
    if (prefix === 'next') {
      if (currWeekIndex >= 1 && currWeekIndex <= 4) daysAhead = 1;
      else if (currWeekIndex === 5) daysAhead = 3;
      else if (currWeekIndex === 6) daysAhead = 2;
      else if (currWeekIndex === 7) daysAhead = 1;
    } else {
      if (currWeekIndex >= 1 && currWeekIndex <= 5) daysAhead = 0;
      else if (currWeekIndex === 6) daysAhead = 2;
      else if (currWeekIndex === 7) daysAhead = 1;
    }
    return { date: getDateString(daysAhead, todayStr), matchedPhrase: weekdayTermMatch[0] };
  }

  // 8. Specific Weekdays ("Monday" .. "Sunday", "this Monday", "next Monday")
  const weekdayMatch = lower.match(
    /\b(?:on\s+|for\s+)?(this\s+|next\s+)?(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i
  );
  if (weekdayMatch) {
    const weekDowMap: Record<string, number> = {
      mon: 1, monday: 1,
      tue: 2, tues: 2, tuesday: 2,
      wed: 3, wednesday: 3,
      thu: 4, thur: 4, thurs: 4, thursday: 4,
      fri: 5, friday: 5,
      sat: 6, saturday: 6,
      sun: 7, sunday: 7,
    };
    const prefix = weekdayMatch[1] ? weekdayMatch[1].trim().toLowerCase() : '';
    const dayName = weekdayMatch[2].toLowerCase();
    const targetWeekIndex = weekDowMap[dayName];

    if (targetWeekIndex !== undefined) {
      const [y, m, d] = todayStr.split('-').map(Number);
      const todayDate = new Date(Date.UTC(y, m - 1, d));
      const utcDow = todayDate.getUTCDay();
      const currWeekIndex = utcDow === 0 ? 7 : utcDow;

      let daysAhead = 0;
      if (prefix === 'next') {
        daysAhead = (targetWeekIndex - currWeekIndex) + 7;
      } else if (prefix === 'this') {
        daysAhead = targetWeekIndex - currWeekIndex;
      } else {
        if (targetWeekIndex >= currWeekIndex) {
          daysAhead = targetWeekIndex - currWeekIndex;
        } else {
          daysAhead = (targetWeekIndex - currWeekIndex) + 7;
        }
      }
      return { date: getDateString(daysAhead, todayStr), matchedPhrase: weekdayMatch[0] };
    }
  }

  return { date: null };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns the number of days in the given month.
 * @param year e.g. 2026
 * @param month 1-indexed (1 = Jan, 12 = Dec)
 */
export function getDaysInMonth(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  return d.getUTCDate();
}

/**
 * Returns the day of the week for the 1st of the given month.
 * Monday = 1, Tuesday = 2, ..., Sunday = 7
 * @param year e.g. 2026
 * @param month 1-indexed (1 = Jan, 12 = Dec)
 */
export function getStartOfWeek(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Adds (or subtracts) a given number of months to a YYYY-MM-DD date string.
 */
export function addMonths(dateStr: string, offset: number): string {
  let [y, m] = dateStr.split('-').map(Number);
  m += offset;
  
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/**
 * Generates an array of YYYY-MM-DD strings for a 42-cell calendar grid.
 */
export function getCalendarDays(year: number, month: number): string[] {
  const startDay = getStartOfWeek(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  
  let prevY = year;
  let prevM = month - 1;
  if (prevM < 1) {
    prevM = 12;
    prevY -= 1;
  }
  const prevDaysInMonth = getDaysInMonth(prevY, prevM);
  
  let nextY = year;
  let nextM = month + 1;
  if (nextM > 12) {
    nextM = 1;
    nextY += 1;
  }

  const days: string[] = [];
  
  const paddingStart = startDay - 1;
  for (let i = paddingStart; i > 0; i--) {
    const d = prevDaysInMonth - i + 1;
    days.push(`${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push(`${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  
  return days;
}

/**
 * Adds (or subtracts) a given number of days to a YYYY-MM-DD date string.
 * Uses Date.UTC to avoid timezone drift.
 */
export function addDays(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + offset, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
