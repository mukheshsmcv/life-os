// Pure JS test runner for parser logic verification (Life OS AI/Core)

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function nowInIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function toYMD(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayString() {
  const d = nowInIST();
  return toYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function getDateString(offsetDays) {
  const utcMs = Date.now() + IST_OFFSET_MS;
  const shifted = new Date(utcMs + offsetDays * 86400_000);
  return toYMD(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr), month = Number(monthStr), day = Number(dayStr);
  if (month < 1 || month > 12 || day < 1) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() + 1 === month &&
    check.getUTCDate() === day
  );
}

function parseNaturalDateString(inputStr) {
  if (!inputStr || typeof inputStr !== 'string') return { date: null };
  const lower = inputStr.toLowerCase().trim();

  // 1. Explicit YYYY-MM-DD
  const ymdMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (ymdMatch && isValidDateString(ymdMatch[1])) {
    return { date: ymdMatch[1], matchedPhrase: ymdMatch[1] };
  }

  // 2. Relative day: "day after tomorrow"
  if (/\b(?:the\s+)?day\s+after\s+tomorrow\b/i.test(lower)) {
    const matched = lower.match(/\b(?:the\s+)?day\s+after\s+tomorrow\b/i)[0];
    return { date: getDateString(2), matchedPhrase: matched };
  }

  // 3. Relative day: "tomorrow"
  if (/\btomorrow\b/i.test(lower)) {
    const matched = lower.match(/\btomorrow\b/i)[0];
    return { date: getDateString(1), matchedPhrase: matched };
  }

  // 4. Relative day: "today" / "tonight"
  if (/\b(?:today|tonight)\b/i.test(lower)) {
    const matched = lower.match(/\b(?:today|tonight)\b/i)[0];
    return { date: getTodayString(), matchedPhrase: matched };
  }

  // 5. Month name + Day number
  const monthsRegexStr = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const dayRegexStr = '(\\d{1,2})(?:st|nd|rd|th)?';

  const monthMap = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
    jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };

  const matchA = lower.match(new RegExp(`\\b${dayRegexStr}\\s+${monthsRegexStr}\\b`, 'i'));
  if (matchA) {
    const day = parseInt(matchA[1], 10);
    const month = monthMap[matchA[2].toLowerCase()];
    if (month && day >= 1 && day <= 31) {
      const [currY, currM, currD] = getTodayString().split('-').map(Number);
      let year = currY;
      if (month < currM || (month === currM && day < currD)) year = currY + 1;
      const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isValidDateString(candidate)) return { date: candidate, matchedPhrase: matchA[0] };
    }
  }

  const matchB = lower.match(new RegExp(`\\b${monthsRegexStr}\\s+${dayRegexStr}\\b`, 'i'));
  if (matchB) {
    const month = monthMap[matchB[1].toLowerCase()];
    const day = parseInt(matchB[2], 10);
    if (month && day >= 1 && day <= 31) {
      const [currY, currM, currD] = getTodayString().split('-').map(Number);
      let year = currY;
      if (month < currM || (month === currM && day < currD)) year = currY + 1;
      const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isValidDateString(candidate)) return { date: candidate, matchedPhrase: matchB[0] };
    }
  }

  // 6. Numeric slash/dash date
  const numericMatch = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}|\d{2}))?\b/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10);
    let year = numericMatch[3] ? parseInt(numericMatch[3], 10) : undefined;
    if (year !== undefined && year < 100) year += 2000;
    const [currY, currM, currD] = getTodayString().split('-').map(Number);
    if (!year) {
      year = currY;
      if (month < currM || (month === currM && day < currD)) year = currY + 1;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isValidDateString(candidate)) return { date: candidate, matchedPhrase: numericMatch[0] };
    }
  }

  // 7. Weekday terms: "weekday", "weekdays", "next weekday"
  const weekdayTermMatch = lower.match(/\b(?:on\s+|for\s+)?(this\s+|next\s+)?(weekdays?|weekday)\b/i);
  if (weekdayTermMatch) {
    const prefix = weekdayTermMatch[1] ? weekdayTermMatch[1].trim().toLowerCase() : '';
    const [y, m, d] = getTodayString().split('-').map(Number);
    const utcDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
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
    return { date: getDateString(daysAhead), matchedPhrase: weekdayTermMatch[0] };
  }

  // 8. Specific Weekdays
  const weekdayMatch = lower.match(
    /\b(?:on\s+|for\s+)?(this\s+|next\s+)?(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i
  );
  if (weekdayMatch) {
    const weekDowMap = { mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7 };
    const prefix = weekdayMatch[1] ? weekdayMatch[1].trim().toLowerCase() : '';
    const dayName = weekdayMatch[2].toLowerCase();
    const targetWeekIndex = weekDowMap[dayName];
    if (targetWeekIndex !== undefined) {
      const [y, m, d] = getTodayString().split('-').map(Number);
      const utcDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
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
      return { date: getDateString(daysAhead), matchedPhrase: weekdayMatch[0] };
    }
  }

  return { date: null };
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDateAndCleanText(text) {
  const parseResult = parseNaturalDateString(text);
  let cleaned = text;
  if (parseResult.matchedPhrase) {
    const escaped = parseResult.matchedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`(?:\\s+on|\\s+for)?\\s+${escaped}`, 'gi'), '');
  }
  cleaned = cleaned.replace(/\b(?:in\s+the\s+)?(?:morning|afternoon|evening|night)\b/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return { date: parseResult.date, cleanedText: cleaned };
}

function parseDurationMinutes(text) {
  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h\b)/i);
  if (hoursMatch) return Math.round(parseFloat(hoursMatch[1]) * 60);
  const minutesMatch = text.match(/(\d+)\s*(?:minutes|minute|mins|min|m\b)/i);
  if (minutesMatch) return parseInt(minutesMatch[1], 10);
  return null;
}

function parsePriority(text) {
  const lower = text.toLowerCase();
  if (lower.includes('high priority') || lower.includes('priority high')) return 'high';
  if (lower.includes('low priority') || lower.includes('priority low')) return 'low';
  return 'medium';
}

function parseIntent(userMessage) {
  const rawTrimmed = userMessage.trim();
  if (!rawTrimmed) return { success: false, error: 'Please enter a message.' };
  const normalized = normalizeText(userMessage);

  const conversationQuestions = [
    /^(?:hey|hello|hi|greetings|good\s+morning|good\s+evening)\b/i,
    /^(?:how\s+should\s+i|how\s+can\s+i|what\s+should\s+i|do\s+you\s+think|should\s+i|can\s+you\s+advise)\b/i,
    /^(?:i\s+studied|i\s+finished|i\s+was\s+studying|i\s+did|i\s+went|i\s+was|i\s+am\s+tired|i\s+feel)\b/i,
  ];

  for (const pattern of conversationQuestions) {
    if (pattern.test(normalized)) {
      return { success: false, error: 'Conversational response (no task created).' };
    }
  }

  if (
    normalized === 'schedule' ||
    normalized.includes('whats my schedule') ||
    normalized.includes('what is my schedule') ||
    normalized.includes('show my schedule') ||
    normalized.includes('get schedule') ||
    normalized.includes('view my schedule')
  ) {
    return { success: true, actions: [{ type: 'get_schedule' }] };
  }

  if (
    normalized.includes('whats my free time') ||
    normalized.includes('what is my free time') ||
    normalized.includes('free time')
  ) {
    return { success: true, actions: [{ type: 'get_free_time' }] };
  }

  if (
    normalized === 'replan' ||
    normalized.includes('replan my day') ||
    normalized.includes('replan day') ||
    normalized.includes('replan the day')
  ) {
    return { success: true, actions: [{ type: 'replan_day' }] };
  }

  const completeRegexes = [
    /^(?:i\s+have\s+|i\s+)?(?:complete|completed|finish|finished)\s+(.+)$/,
    /^mark\s+(.+?)\s+(?:as\s+)?(?:complete|completed|done|finished)$/,
    /^(.+?)\s+is\s+(?:complete|completed|done|finished)$/,
    /^done\s+(?:with\s+)?(.+)$/,
  ];

  for (const regex of completeRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]?.trim()) {
      return { success: true, actions: [{ type: 'complete_task', payload: { taskTitleQuery: match[1].trim() } }] };
    }
  }

  const skipRegexes = [
    /^(?:i\s+)?(?:skip|skipped)\s+(.+)$/,
    /^(?:i\s+)?(?:cant\s+do|cannot\s+do|dont\s+do)\s+(.+)$/,
  ];

  for (const regex of skipRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]?.trim()) {
      return { success: true, actions: [{ type: 'skip_task', payload: { taskTitleQuery: match[1].trim() } }] };
    }
  }

  const deleteRegexes = [/^(?:i\s+)?(?:delete|deleted|remove|removed)\s+(.+)$/];

  for (const regex of deleteRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]?.trim()) {
      return { success: true, actions: [{ type: 'delete_task', payload: { taskTitleQuery: match[1].trim() } }] };
    }
  }

  const createPrefixes = [
    /^(?:add|create)\s+(?:task\s+)?(.+)$/i,
    /^(?:i\s+need\s+to|need\s+to|remind\s+me\s+to|i\s+have\s+to|have\s+to|must|i\s+want\s+to|want\s+to)\s+(.+)$/i,
    /^(?:study|work\s+on|do|practice|read|write|prepare|review)\s+(.+)$/i,
  ];

  let createMatch = null;
  for (const prefix of createPrefixes) {
    createMatch = normalized.match(prefix);
    if (createMatch) break;
  }

  if (createMatch) {
    const priority = parsePriority(normalized);
    const durationMinutes = parseDurationMinutes(normalized);
    const dateResult = extractDateAndCleanText(normalized);

    let titleStr = dateResult.cleanedText
      .replace(/^(add|create)\s+(?:task\s+)?/i, '')
      .replace(/^(i\s+need\s+to|need\s+to|remind\s+me\s+to|i\s+have\s+to|have\s+to|must|i\s+want\s+to|want\s+to)\s+/i, '')
      .replace(/(high|medium|low)\s+priority\s*/i, '')
      .replace(/priority\s+(high|medium|low)\s*/i, '');

    if (durationMinutes !== null) {
      titleStr = titleStr.replace(/\s+for\s+\d+(?:\.\d+)?\s*(?:hours|hour|hrs|hr|h|minutes|minute|mins|min|m)\b.*/i, '');
    }

    titleStr = titleStr.trim();
    const title = titleStr ? titleStr.charAt(0).toUpperCase() + titleStr.slice(1) : titleStr;

    const payload = { title, durationMinutes: durationMinutes ?? 0, priority };
    if (dateResult.date) payload.date = dateResult.date;

    return { success: true, actions: [{ type: 'create_task', payload }] };
  }

  return { success: false, error: 'Unrecognized' };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

const todayStr = getTodayString();
const [currY, currM, currD] = todayStr.split('-').map(Number);
const utcDow = new Date(Date.UTC(currY, currM - 1, currD)).getUTCDay();
const currWeekIndex = utcDow === 0 ? 7 : utcDow;

function getExpectedWeekdayDate(targetWeekIndex, mode) {
  let daysAhead = 0;
  if (mode === 'next') {
    daysAhead = (targetWeekIndex - currWeekIndex) + 7;
  } else if (mode === 'this') {
    daysAhead = targetWeekIndex - currWeekIndex;
  } else {
    if (targetWeekIndex >= currWeekIndex) daysAhead = targetWeekIndex - currWeekIndex;
    else daysAhead = (targetWeekIndex - currWeekIndex) + 7;
  }
  return getDateString(daysAhead);
}

const tests = [
  // 1. Natural Language Date Format Parsing
  { label: 'Date: today', input: 'today', expectedDate: getTodayString() },
  { label: 'Date: tomorrow', input: 'tomorrow', expectedDate: getDateString(1) },
  { label: 'Date: day after tomorrow', input: 'day after tomorrow', expectedDate: getDateString(2) },
  { label: 'Date: 26th September', input: '26th September', checkFn: (d) => d.endsWith('-09-26') },
  { label: 'Date: 26 September', input: '26 September', checkFn: (d) => d.endsWith('-09-26') },
  { label: 'Date: September 26', input: 'September 26', checkFn: (d) => d.endsWith('-09-26') },
  { label: 'Date: Sep 26', input: 'Sep 26', checkFn: (d) => d.endsWith('-09-26') },
  { label: 'Date: Sep 26th', input: 'Sep 26th', checkFn: (d) => d.endsWith('-09-26') },
  { label: 'Date: 26/09', input: '26/09', checkFn: (d) => d.endsWith('-09-26') },
  { label: 'Date: 26-09', input: '26-09', checkFn: (d) => d.endsWith('-09-26') },
  { label: 'Date: Monday', input: 'Monday', expectedDate: getExpectedWeekdayDate(1, 'plain') },
  { label: 'Date: this Monday', input: 'this Monday', expectedDate: getExpectedWeekdayDate(1, 'this') },
  { label: 'Date: next Monday', input: 'next Monday', expectedDate: getExpectedWeekdayDate(1, 'next') },
  { label: 'Date: Friday', input: 'Friday', expectedDate: getExpectedWeekdayDate(5, 'plain') },
  { label: 'Date: this Friday', input: 'this Friday', expectedDate: getExpectedWeekdayDate(5, 'this') },
  { label: 'Date: next Friday', input: 'next Friday', expectedDate: getExpectedWeekdayDate(5, 'next') },
  { label: 'Date: weekday', input: 'weekday', checkFn: (d) => isValidDateString(d) },
  { label: 'Date: weekdays', input: 'weekdays', checkFn: (d) => isValidDateString(d) },
  { label: 'Date: next weekday', input: 'next weekday', checkFn: (d) => isValidDateString(d) },

  // 2. Title cleaning tests
  {
    label: 'Title cleaning: Study anatomy next Monday',
    input: 'study anatomy next Monday',
    checkIntent: (res) => res.success && res.actions[0].payload.title === 'Study anatomy' && res.actions[0].payload.date === getExpectedWeekdayDate(1, 'next'),
  },
  {
    label: 'Title cleaning: Study anatomy this Friday',
    input: 'study anatomy this Friday',
    checkIntent: (res) => res.success && res.actions[0].payload.title === 'Study anatomy' && res.actions[0].payload.date === getExpectedWeekdayDate(5, 'this'),
  },
  {
    label: 'Title cleaning: Study anatomy on 26th September',
    input: 'study anatomy on 26th September',
    checkIntent: (res) => res.success && res.actions[0].payload.title === 'Study anatomy' && res.actions[0].payload.date.endsWith('-09-26'),
  },

  // 3. Conversational Safety Tests (Must NOT create tasks)
  {
    label: 'Safety: I studied anatomy yesterday',
    input: 'I studied anatomy yesterday',
    checkIntent: (res) => !res.success,
  },
  {
    label: 'Safety: I finished anatomy yesterday',
    input: 'I finished anatomy yesterday',
    checkIntent: (res) => !res.success,
  },
  {
    label: 'Safety: I was studying anatomy yesterday',
    input: 'I was studying anatomy yesterday',
    checkIntent: (res) => !res.success,
  },
  {
    label: 'Safety: Do you think I should study anatomy tomorrow?',
    input: 'Do you think I should study anatomy tomorrow?',
    checkIntent: (res) => !res.success,
  },
  {
    label: 'Safety: Should I study anatomy tomorrow?',
    input: 'Should I study anatomy tomorrow?',
    checkIntent: (res) => !res.success,
  },

  // 4. Positive Task Creation Tests (MUST create tasks)
  {
    label: 'Positive: I need to study anatomy tomorrow',
    input: 'I need to study anatomy tomorrow',
    checkIntent: (res) => res.success && res.actions[0].payload.title === 'Study anatomy' && res.actions[0].payload.date === getDateString(1),
  },
  {
    label: 'Positive: Study anatomy next Monday',
    input: 'Study anatomy next Monday',
    checkIntent: (res) => res.success && res.actions[0].payload.title === 'Study anatomy' && res.actions[0].payload.date === getExpectedWeekdayDate(1, 'next'),
  },
  {
    label: 'Positive: I want to study anatomy next Monday',
    input: 'I want to study anatomy next Monday',
    checkIntent: (res) => res.success && res.actions[0].payload.title === 'Study anatomy' && res.actions[0].payload.date === getExpectedWeekdayDate(1, 'next'),
  },
  {
    label: 'Positive: Add anatomy for 1 hour on 26th September',
    input: 'Add anatomy for 1 hour on 26th September',
    checkIntent: (res) => res.success && res.actions[0].payload.title === 'Anatomy' && res.actions[0].payload.date.endsWith('-09-26'),
  },

  // 5. Existing Core Intent Tests
  { label: 'Intent: complete pharmacology', input: 'complete pharmacology', checkIntent: (res) => res.success && res.actions[0].type === 'complete_task' },
  { label: 'Intent: skip gym', input: 'skip gym', checkIntent: (res) => res.success && res.actions[0].type === 'skip_task' },
  { label: 'Intent: delete study', input: 'delete study', checkIntent: (res) => res.success && res.actions[0].type === 'delete_task' },
  { label: 'Intent: whats my schedule?', input: "what's my schedule?", checkIntent: (res) => res.success && res.actions[0].type === 'get_schedule' },
  { label: 'Intent: replan my day', input: 'replan my day', checkIntent: (res) => res.success && res.actions[0].type === 'replan_day' },
  { label: 'Intent: free time', input: "what's my free time?", checkIntent: (res) => res.success && res.actions[0].type === 'get_free_time' },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  if (t.expectedDate !== undefined || t.checkFn) {
    const res = parseNaturalDateString(t.input);
    const dateVal = res.date;
    const isOk = t.checkFn ? t.checkFn(dateVal) : dateVal === t.expectedDate;
    if (isOk) {
      passed++;
      console.log(`✓ PASS: ${t.label} -> ${dateVal}`);
    } else {
      failed++;
      console.error(`✗ FAIL: ${t.label} (expected ${t.expectedDate}, got ${dateVal})`);
    }
  } else if (t.checkIntent) {
    const res = parseIntent(t.input);
    const isOk = t.checkIntent(res);
    if (isOk) {
      passed++;
      console.log(`✓ PASS: ${t.label}`);
    } else {
      failed++;
      console.error(`✗ FAIL: ${t.label} (got ${JSON.stringify(res)})`);
    }
  }
}

console.log(`\nPARSER TEST RESULTS: ${passed}/${tests.length} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
