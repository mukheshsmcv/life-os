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

export function parseIntent(userMessage: string): ParseIntentResult {
  const rawTrimmed = userMessage.trim();
  if (!rawTrimmed) {
    return { success: false, error: 'Please enter a message.' };
  }

  const normalized = normalizeText(userMessage);

  // Check for non-action / conversational / question intents
  const conversationQuestions = [
    /^(?:hey|hello|hi|greetings|good\s+morning|good\s+evening)\b/i,
    /^(?:how\s+should\s+i|how\s+can\s+i|what\s+should\s+i|do\s+you\s+think|should\s+i|can\s+you\s+advise)\b/i,
    /^(?:i\s+studied|i\s+finished|i\s+was\s+studying|i\s+did|i\s+went|i\s+was|i\s+am\s+tired|i\s+feel)\b/i,
  ];

  for (const pattern of conversationQuestions) {
    if (pattern.test(normalized)) {
      if (/^(?:hey|hello|hi|greetings)\b/i.test(normalized)) {
        return {
          success: false,
          error: 'Hello Mukhesh! How can I help you plan your day?',
        };
      }
      if (/^(?:i\s+studied|i\s+finished|i\s+was\s+studying|i\s+did|i\s+went)/i.test(normalized)) {
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

  // 4. Complete task patterns
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
    /^(?:add|create)\s+(?:task\s+)?(.+)$/i,
    /^(?:i\s+need\s+to|need\s+to|remind\s+me\s+to|i\s+have\s+to|have\s+to|must|i\s+want\s+to|want\s+to)\s+(.+)$/i,
    /^(?:study|work\s+on|do|practice|read|write|prepare|review)\s+(.+)$/i,
  ];

  let createMatch: RegExpMatchArray | null = null;
  for (const prefix of createPrefixes) {
    createMatch = normalized.match(prefix);
    if (createMatch) break;
  }

  if (createMatch) {
    const priority = parsePriority(normalized);
    const durationMinutes = parseDurationMinutes(normalized);
    const dateResult = extractDateAndCleanText(normalized);

    if (dateResult.unresolvedTemporalPhrase) {
      return {
        success: false,
        error: `Date-aware AI parsing is temporarily unavailable. Unable to resolve date phrase "${dateResult.unresolvedTemporalPhrase}" in basic command mode. Please specify "today", "tomorrow", "26th September", or a weekday.`,
      };
    }

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

    const payload: {
      title: string;
      durationMinutes: number;
      priority: TaskPriority;
      date?: string;
    } = {
      title,
      durationMinutes: durationMinutes ?? 0,
      priority,
    };

    if (dateResult.date) {
      payload.date = dateResult.date;
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
