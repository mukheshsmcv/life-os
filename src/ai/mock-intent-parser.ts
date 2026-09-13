import { TaskPriority } from '@/contexts/tasks-context';
import { AIAction, ParseIntentResult } from './ai-types';
import { getTodayString, getDateString, parseNaturalDateString } from '@/lib/date-time';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDurationMinutes(text: string): number | null {
  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h\b)/i);
  if (hoursMatch) {
    return Math.round(parseFloat(hoursMatch[1]) * 60);
  }

  const minutesMatch = text.match(/(\d+)\s*(?:minutes|minute|mins|min|m\b)/i);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10);
  }

  return null;
}

function parsePriority(text: string): TaskPriority {
  const lower = text.toLowerCase();
  if (lower.includes('high priority') || lower.includes('priority high')) return 'high';
  if (lower.includes('low priority') || lower.includes('priority low')) return 'low';
  return 'medium';
}

type ExtractedDateResult = {
  date: string | null;
  cleanedText: string;
  unresolvedTemporalPhrase?: string;
};

function extractDateAndCleanText(text: string): ExtractedDateResult {
  const unresolvedPatterns = [
    /\bnext\s+week\b/i,
    /\bthis\s+week\b/i,
    /\bnext\s+month\b/i,
    /\bin\s+\d+\s+(?:days|weeks|months)\b/i,
    /\bnext\s+next\b/i,
  ];

  for (const pattern of unresolvedPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        date: null,
        cleanedText: text,
        unresolvedTemporalPhrase: match[0],
      };
    }
  }

  const parseResult = parseNaturalDateString(text);
  let cleaned = text;

  if (parseResult.matchedPhrase) {
    const escaped = parseResult.matchedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phraseRegex = new RegExp(`(?:\\s+on|\\s+for)?\\s+${escaped}`, 'gi');
    cleaned = cleaned.replace(phraseRegex, '');
  }

  cleaned = cleaned.replace(/\b(?:in\s+the\s+)?(?:morning|afternoon|evening|night)\b/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return { date: parseResult.date, cleanedText: cleaned };
}

function parseExplicitStartMinute(text: string): { startMinute: number | null; cleanedText: string } {
  // Matches "at 9 AM", "at 9:30 AM", "at 930 AM", "at 1 PM", "at 13:00", "9 AM", "9:30 AM", "930 AM", "1 PM"
  const timeRegex = /\b(?:at\s+)?(\d{1,2})(?::?(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)(\d{1,2}):(\d{2})\b/i;
  const match = text.match(timeRegex);
  if (!match) return { startMinute: null, cleanedText: text };

  let hours = 0;
  let minutes = 0;

  if (match[3]) {
    hours = parseInt(match[1], 10);
    minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3].toLowerCase();
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
  } else if (match[4]) {
    hours = parseInt(match[4], 10);
    minutes = parseInt(match[5], 10);
  }

  const cleanedText = text.replace(match[0], '').replace(/\s+/g, ' ').trim();

  if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
    return { startMinute: hours * 60 + minutes, cleanedText };
  }

  return { startMinute: null, cleanedText: text };
}

export function parseIntent(userMessage: string): ParseIntentResult {
  const rawTrimmed = userMessage.trim();
  if (!rawTrimmed) {
    return { success: false, error: 'Please enter a message.' };
  }

  // Handle multi-action commands separated by ", then " or " then "
  if (userMessage.includes(' then ') || userMessage.includes(', then ')) {
    const parts = userMessage.split(/\s*(?:,\s*)?then\s+/i);
    const actions: AIAction[] = [];
    for (const part of parts) {
      const subResult = parseIntent(part);
      if (subResult.success) {
        actions.push(...subResult.actions);
      }
    }
    if (actions.length > 0) {
      return { success: true, actions };
    }
  }

  const normalized = normalizeText(userMessage);

  // Check for non-action / conversational / question intents
  const conversationQuestions = [
    /^(?:hey|hello|hi|greetings|good\s+morning|good\s+evening)\b/i,
    /^(?:how\s+should\s+i|how\s+can\s+i|what\s+should\s+i|do\s+you\s+think|should\s+i|can\s+you\s+advise)\b/i,
    /^(?:i\s+studied|i\s+was\s+studying|i\s+did|i\s+went|i\s+was|i\s+am\s+tired|i\s+feel)\b/i,
  ];

  for (const pattern of conversationQuestions) {
    if (pattern.test(normalized)) {
      if (/^(?:hey|hello|hi|greetings)\b/i.test(normalized)) {
        return {
          success: false,
          error: 'Hello! How can I help you plan your day?',
        };
      }
      if (/^(?:i\s+studied|i\s+was\s+studying|i\s+did|i\s+went)/i.test(normalized)) {
        return {
          success: false,
          error: 'Great job completing your study session!',
        };
      }
      return {
        success: false,
        error: 'I am here to help you manage your Life OS plan. Would you like me to schedule a task for you?',
      };
    }
  }

  // 1. Get schedule queries
  if (
    normalized === 'schedule' ||
    normalized.includes('whats my schedule') ||
    normalized.includes('what is my schedule') ||
    normalized.includes('show my schedule') ||
    normalized.includes('get schedule') ||
    normalized.includes('view my schedule')
  ) {
    return {
      success: true,
      actions: [{ type: 'get_schedule' }],
    };
  }

  // 2. Free time queries
  if (
    normalized.includes('whats my free time') ||
    normalized.includes('what is my free time') ||
    normalized.includes('free time')
  ) {
    return {
      success: true,
      actions: [{ type: 'get_free_time' }],
    };
  }

  // 3. Replan day
  if (
    normalized === 'replan' ||
    normalized.includes('replan my day') ||
    normalized.includes('replan day') ||
    normalized.includes('replan the day')
  ) {
    return {
      success: true,
      actions: [{ type: 'replan_day' }],
    };
  }

  // 4. Update task patterns
  // A. Anytime / Remove date / Remove explicit time constraint
  const anytimeMatch =
    normalized.match(/^(?:make|set|change)\s+(.+?)\s+(?:an\s+)?anytime\s*(?:task)?(?:\s+(.+))?$/i) ||
    normalized.match(/^(?:remove|clear)\s+(?:the\s+)?(?:date|time)\s+(?:from|for)\s+(.+)$/i) ||
    normalized.match(/^undate\s+(.+)$/i);

  if (anytimeMatch) {
    const taskTitleQuery = anytimeMatch[1].trim();
    const datePhrase = anytimeMatch[2]?.trim();
    const dateResult = datePhrase ? parseNaturalDateString(datePhrase) : { date: null };
    return {
      success: true,
      actions: [
        {
          type: 'update_task',
          payload: {
            taskTitleQuery,
            date: dateResult.date ?? null,
            scheduledStartMinute: null,
          },
        },
      ],
    };
  }

  // B. Priority update
  const priorityMatch =
    normalized.match(/^(?:make|set|change|update)\s+(.+?)\s+(high|medium|low)\s+priority$/i) ||
    normalized.match(/^(?:change|set|update)\s+(.+?)\s+priority\s+to\s+(high|medium|low)$/i);

  if (priorityMatch) {
    const taskTitleQuery = priorityMatch[1].trim();
    const priority = priorityMatch[2].toLowerCase() as TaskPriority;
    return {
      success: true,
      actions: [
        {
          type: 'update_task',
          payload: { taskTitleQuery, priority },
        },
      ],
    };
  }

  // C. Duration update
  const durationMatch =
    normalized.match(/^(?:change|set|update)\s+(.+?)\s+(?:duration\s+)?to\s+(\d+(?:\.\d+)?\s*(?:hours|hour|hrs|hr|h|minutes|minute|mins|min|m))$/i);

  if (durationMatch) {
    const taskTitleQuery = durationMatch[1].trim();
    const durationMinutes = parseDurationMinutes(durationMatch[2]);
    if (durationMinutes !== null) {
      return {
        success: true,
        actions: [
          {
            type: 'update_task',
            payload: { taskTitleQuery, durationMinutes },
          },
        ],
      };
    }
  }

  // D. Date update / Move / Reschedule (supports explicit time, e.g. "Move pathology to tomorrow at 3 PM")
  const moveMatch =
    normalized.match(/^(?:move|reschedule|shift|postpone)\s+(.+?)\s+to\s+(.+)$/i) ||
    normalized.match(/^(?:change|update|set)\s+(.+?)\s+(?:date\s+)?to\s+(.+)$/i);

  if (moveMatch) {
    const taskTitleQuery = moveMatch[1].trim();
    const targetPhrase = moveMatch[2].trim();
    const timeRes = parseExplicitStartMinute(targetPhrase);
    const dateResult = parseNaturalDateString(timeRes.cleanedText);
    const updatePayload: { taskTitleQuery: string; date?: string | null; scheduledStartMinute?: number | null } = {
      taskTitleQuery,
    };
    if (dateResult.date !== null) {
      updatePayload.date = dateResult.date;
    }
    if (timeRes.startMinute !== null) {
      updatePayload.scheduledStartMinute = timeRes.startMinute;
    }
    if (targetPhrase.includes('anytime')) {
      updatePayload.scheduledStartMinute = null;
    }
    return {
      success: true,
      actions: [
        {
          type: 'update_task',
          payload: updatePayload,
        },
      ],
    };
  }

  // 5. Complete task patterns
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
        actions: [
          {
            type: 'complete_task',
            payload: { taskTitleQuery: match[1].trim() },
          },
        ],
      };
    }
  }

  // 5. Skip task patterns
  const skipRegexes = [
    /^(?:i\s+)?(?:skip|skipped)\s+(.+)$/,
    /^(?:i\s+)?(?:cant\s+do|cannot\s+do|dont\s+do)\s+(.+)$/,
  ];

  for (const regex of skipRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]?.trim()) {
      return {
        success: true,
        actions: [
          {
            type: 'skip_task',
            payload: { taskTitleQuery: match[1].trim() },
          },
        ],
      };
    }
  }

  // 6. Delete task patterns
  const deleteRegexes = [
    /^(?:i\s+)?(?:delete|deleted|remove|removed)\s+(.+)$/,
  ];

  for (const regex of deleteRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]?.trim()) {
      return {
        success: true,
        actions: [
          {
            type: 'delete_task',
            payload: { taskTitleQuery: match[1].trim() },
          },
        ],
      };
    }
  }

  // 7. Create task patterns
  const createPrefixes = [
    /^(?:add|create|schedule)\s+(?:task\s+)?(.+)$/i,
    /^(?:i\s+need\s+to|need\s+to|remind\s+me\s+to|i\s+have\s+to|have\s+to|must|i\s+want\s+to|want\s+to)\s+(.+)$/i,
    /^(?:study|work\s+on|do|practice|read|write|prepare|review)\s+(.+)$/i,
  ];

  let createMatch: RegExpMatchArray | null = null;
  for (const prefix of createPrefixes) {
    createMatch = normalized.match(prefix);
    if (createMatch) break;
  }

  if (createMatch) {
    const timeRes = parseExplicitStartMinute(normalized);
    const priority = parsePriority(normalized);
    const durationMinutes = parseDurationMinutes(normalized);
    const dateResult = extractDateAndCleanText(timeRes.cleanedText);

    if (dateResult.unresolvedTemporalPhrase) {
      return {
        success: false,
        error: `Date-aware AI parsing is temporarily unavailable. Unable to resolve date phrase "${dateResult.unresolvedTemporalPhrase}" in basic command mode. Please specify "today", "tomorrow", "26th September", or a weekday.`,
      };
    }

    let titleStr = dateResult.cleanedText
      .replace(/^(add|create|schedule)\s+(?:task\s+)?/i, '')
      .replace(/^(i\s+need\s+to|need\s+to|remind\s+me\s+to|i\s+have\s+to|have\s+to|must|i\s+want\s+to|want\s+to)\s+/i, '')
      .replace(/(high|medium|low)\s+priority\s*/i, '')
      .replace(/priority\s+(high|medium|low)\s*/i, '');

    if (durationMinutes !== null) {
      titleStr = titleStr.replace(/\s+for\s+\d+(?:\.\d+)?\s*(?:hours|hour|hrs|hr|h|minutes|minute|mins|min|m)\b.*/i, '');
    }

    titleStr = titleStr.trim();
    const title = titleStr ? titleStr.charAt(0).toUpperCase() + titleStr.slice(1) : titleStr;

    const payload: {
      title: string;
      durationMinutes: number;
      priority: TaskPriority;
      date?: string;
      scheduledStartMinute?: number | null;
    } = {
      title,
      durationMinutes: durationMinutes ?? 0,
      priority,
    };

    if (dateResult.date) {
      payload.date = dateResult.date;
    }

    if (timeRes.startMinute !== null) {
      payload.scheduledStartMinute = timeRes.startMinute;
    }

    return {
      success: true,
      actions: [
        {
          type: 'create_task',
          payload,
        },
      ],
    };
  }

  // Unrecognized command fallback
  return {
    success: false,
    error: `I didn't recognize that command. Try asking "what's my schedule?", "add gym for 1 hour", "completed study", "skip gym", or "replan my day".`,
  };
}
