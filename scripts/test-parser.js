// Pure JS test runner for parser logic verification
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
      return {
        success: true,
        actions: [{ type: 'complete_task', payload: { taskTitleQuery: match[1].trim() } }],
      };
    }
  }

  const skipRegexes = [
    /^(?:i\s+)?(?:skip|skipped)\s+(.+)$/,
    /^(?:i\s+)?(?:cant\s+do|cannot\s+do|dont\s+do)\s+(.+)$/,
  ];

  for (const regex of skipRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]?.trim()) {
      return {
        success: true,
        actions: [{ type: 'skip_task', payload: { taskTitleQuery: match[1].trim() } }],
      };
    }
  }

  const deleteRegexes = [/^(?:i\s+)?(?:delete|deleted|remove|removed)\s+(.+)$/];

  for (const regex of deleteRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]?.trim()) {
      return {
        success: true,
        actions: [{ type: 'delete_task', payload: { taskTitleQuery: match[1].trim() } }],
      };
    }
  }

  if (normalized.startsWith('add ') || normalized.startsWith('create ')) {
    const priority = parsePriority(normalized);
    const durationMinutes = parseDurationMinutes(normalized);

    let titleStr = normalized
      .replace(/^(add|create)\s+(?:task\s+)?/i, '')
      .replace(/(high|medium|low)\s+priority\s*/i, '')
      .replace(/priority\s+(high|medium|low)\s*/i, '');

    if (durationMinutes !== null) {
      titleStr = titleStr.replace(/\s+for\s+\d+(?:\.\d+)?\s*(?:hours|hour|hrs|hr|h|minutes|minute|mins|min|m)\b.*/i, '');
    }

    titleStr = titleStr.trim();
    const title = titleStr ? titleStr.charAt(0).toUpperCase() + titleStr.slice(1) : titleStr;

    return {
      success: true,
      actions: [{ type: 'create_task', payload: { title, durationMinutes: durationMinutes ?? 0, priority } }],
    };
  }

  return { success: false, error: 'Unrecognized' };
}

const tests = [
  // Complete task tests
  { input: 'complete pharmacology', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'completed pharmacology', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'finish pharmacology', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'finished pharmacology', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'I completed pharmacology', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'I finished pharmacology', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'mark pharmacology complete', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'pharmacology is completed', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'I have completed pharmacology', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  { input: 'done with pharmacology', expectedType: 'complete_task', expectedQuery: 'pharmacology' },
  // Skip task tests
  { input: 'skip gym', expectedType: 'skip_task', expectedQuery: 'gym' },
  { input: 'skipped gym', expectedType: 'skip_task', expectedQuery: 'gym' },
  { input: 'I skipped gym', expectedType: 'skip_task', expectedQuery: 'gym' },
  { input: "can't do gym", expectedType: 'skip_task', expectedQuery: 'gym' },
  { input: 'cannot do gym', expectedType: 'skip_task', expectedQuery: 'gym' },
  { input: "don't do gym", expectedType: 'skip_task', expectedQuery: 'gym' },
  // Create task tests
  { input: 'add pharmacology for 2 hours', expectedType: 'create_task', expectedQuery: 'Pharmacology' },
  { input: 'add gym for 1 hour', expectedType: 'create_task', expectedQuery: 'Gym' },
  { input: 'add high priority study for 90 minutes', expectedType: 'create_task', expectedQuery: 'Study' },
  // Schedule & Replan
  { input: "what's my schedule?", expectedType: 'get_schedule' },
  { input: 'replan my day', expectedType: 'replan_day' },
  { input: "what's my free time?", expectedType: 'get_free_time' },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const res = parseIntent(t.input);
  if (!res.success) {
    console.error(`FAIL: "${t.input}" failed to parse.`);
    failed++;
    continue;
  }
  const action = res.actions[0];
  if (action.type !== t.expectedType) {
    console.error(`FAIL: "${t.input}" type mismatch: expected ${t.expectedType}, got ${action.type}`);
    failed++;
    continue;
  }
  const query = action.payload?.taskTitleQuery || action.payload?.title;
  if (t.expectedQuery && query !== t.expectedQuery) {
    console.error(`FAIL: "${t.input}" query mismatch: expected "${t.expectedQuery}", got "${query}"`);
    failed++;
    continue;
  }
  passed++;
}

console.log(`PARSER TEST RESULTS: ${passed}/${tests.length} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
