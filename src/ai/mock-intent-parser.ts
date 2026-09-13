import { TaskPriority } from '@/contexts/tasks-context';
import { AIAction, ParseIntentResult, PendingClarification } from './ai-types';
import { getTodayString, getDateString, parseNaturalDateString } from '@/lib/date-time';

export type TaskItem = { id: string; title: string; date?: string | null; scheduledStartMinute?: number | null };

export type TaskMatchResult =
  | { type: 'exact' | 'single'; task: TaskItem }
  | { type: 'multiple'; matches: TaskItem[] }
  | { type: 'none' };

export function resolveTaskEntity(query: string, tasks?: TaskItem[]): TaskMatchResult {
  if (!query || !query.trim() || !tasks || tasks.length === 0) return { type: 'none' };

  const normalizedQuery = query
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean filler words, prefixes, and date suffixes
  const cleanedQuery = normalizedQuery
    .replace(/^(?:not able to do|unable to do|cant do|cannot do|dont want to do|trouble with|issue with|study|work on|my|the|task|a|an)\s+/i, '')
    .replace(/\s+(?:today|tomorrow|tonight)$/i, '')
    .trim();

  if (!cleanedQuery) return { type: 'none' };

  // 1. Exact match (case-insensitive)
  const exact = tasks.filter((t) => t.title.toLowerCase().trim() === cleanedQuery);
  if (exact.length === 1) return { type: 'exact', task: exact[0] };

  // 2. Substring / Word match (case-insensitive)
  const substringMatches = tasks.filter((t) => {
    const titleLower = t.title.toLowerCase().trim();
    const cleanedTitle = titleLower.replace(/^(?:study|work on|my|the|task|a|an)\s+/i, '').trim();
    return (
      titleLower.includes(cleanedQuery) ||
      cleanedQuery.includes(titleLower) ||
      cleanedTitle.includes(cleanedQuery) ||
      cleanedQuery.includes(cleanedTitle)
    );
  });

  if (substringMatches.length === 1) {
    return { type: 'single', task: substringMatches[0] };
  }
  if (substringMatches.length > 1) {
    return { type: 'multiple', matches: substringMatches };
  }

  return { type: 'none' };
}

export type AIParseContext = {
  tasks?: TaskItem[];
  currentDate?: string;
  currentTime?: string;
  timezone?: string;
  pendingClarification?: PendingClarification | null;
};

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

export function parseExplicitStartMinute(text: string): { startMinute: number | null; cleanedText: string } {
  if (!text || typeof text !== 'string') return { startMinute: null, cleanedText: text };

  // 1. Matches "12pm", "12 pm", "12:00pm", "12:00 pm", "7pm", "7 pm", "7:30pm", "7:30 pm", "12am", "12 am", "4 pm"
  const amPmRegex = /\b(?:at\s+)?(\d{1,2})(?::?(\d{2}))?\s*(am|pm)\b/i;
  const amPmMatch = text.match(amPmRegex);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
    const period = amPmMatch[3].toLowerCase();

    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const cleanedText = text.replace(amPmMatch[0], '').replace(/\s+/g, ' ').trim();
      return { startMinute: hours * 60 + minutes, cleanedText };
    }
  }

  // 2. Matches "19:00", "07:30", "at 19:00"
  const h24Regex = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i;
  const match24 = text.match(h24Regex);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const cleanedText = text.replace(match24[0], '').replace(/\s+/g, ' ').trim();
      return { startMinute: hours * 60 + minutes, cleanedText };
    }
  }

  // 3. Standalone "at 7", "at 12", "at 4"
  const atNumRegex = /\b(?:at\s+)(\d{1,2})\b/i;
  const atMatch = text.match(atNumRegex);
  if (atMatch) {
    let hours = parseInt(atMatch[1], 10);
    if (hours >= 1 && hours <= 7) hours += 12;
    if (hours >= 0 && hours < 24) {
      const cleanedText = text.replace(atMatch[0], '').replace(/\s+/g, ' ').trim();
      return { startMinute: hours * 60, cleanedText };
    }
  }

  return { startMinute: null, cleanedText: text };
}

export function parseIntent(userMessage: string, context?: AIParseContext): ParseIntentResult {
  const rawTrimmed = userMessage.trim();
  if (!rawTrimmed) {
    return { success: false, error: 'Please enter a message.' };
  }

  const normalized = normalizeText(userMessage);

  // ── Contextual Resolution for Pending Clarification ─────────────────────────
  const pending = context?.pendingClarification;
  if (pending) {
    const isNewCommand =
      /^(?:add|create|delete|complete|skip|done|mark)\b/i.test(normalized) ||
      /^(?:what|whats|how|show|view|when|do i)\b/i.test(normalized) ||
      normalized === 'schedule' ||
      normalized.includes('free time') ||
      normalized.includes('free slot') ||
      normalized.includes('free hours') ||
      normalized === 'replan' ||
      normalized === 'replan day' ||
      normalized === 'replan my day' ||
      (normalized.startsWith('move ') &&
        !normalized.toLowerCase().includes((pending.taskTitle || pending.taskTitleQuery || '___').toLowerCase()) &&
        !normalized.includes('it') &&
        !normalized.includes('this') &&
        !normalized.includes('that'));

    if (!isNewCommand) {
      const dateRes = parseNaturalDateString(normalized);
      const timeRes = parseExplicitStartMinute(normalized);
      const dur = parseDurationMinutes(normalized);

      const targetTitle = pending.taskTitle || pending.taskTitleQuery || 'Task';
      const targetId = pending.taskId;

      let newDate = dateRes.date !== null ? dateRes.date : (pending.date ?? null);
      let newTime = timeRes.startMinute !== null ? timeRes.startMinute : (pending.scheduledStartMinute ?? null);

      const isAffirmativeOnly =
        normalized === 'yes' ||
        normalized === 'yeah' ||
        normalized === 'yep' ||
        normalized === 'sure' ||
        normalized === 'okay' ||
        normalized === 'ok' ||
        normalized === 'do that';

      if (isAffirmativeOnly && newDate === null && newTime === null) {
        const question = `Which day would you like to reschedule ${targetTitle} to?`;
        return {
          success: false,
          error: question,
          clarificationNeeded: true,
          actions: [{ type: 'clarification', payload: { question } }],
          pendingClarification: {
            pendingIntent: 'update_task',
            taskId: targetId,
            taskTitle: targetTitle,
            taskTitleQuery: targetTitle,
            date: null,
            scheduledStartMinute: null,
            missingFields: ['date', 'time'],
          },
        };
      }

      if (newDate !== null && newTime === null && timeRes.startMinute === null && !normalized.includes('anytime')) {
        const question = `What time on ${newDate} would you like to schedule ${targetTitle}?`;
        return {
          success: false,
          error: question,
          clarificationNeeded: true,
          actions: [{ type: 'clarification', payload: { question } }],
          pendingClarification: {
            pendingIntent: 'update_task',
            taskId: targetId,
            taskTitle: targetTitle,
            taskTitleQuery: targetTitle,
            date: newDate,
            scheduledStartMinute: null,
            missingFields: ['time'],
          },
        };
      }

      if (newDate === null && newTime !== null && dateRes.date === null) {
        const question = `Which day would you like to schedule ${targetTitle}?`;
        return {
          success: false,
          error: question,
          clarificationNeeded: true,
          actions: [{ type: 'clarification', payload: { question } }],
          pendingClarification: {
            pendingIntent: 'update_task',
            taskId: targetId,
            taskTitle: targetTitle,
            taskTitleQuery: targetTitle,
            date: null,
            scheduledStartMinute: newTime,
            missingFields: ['date'],
          },
        };
      }

      if (targetId || targetTitle) {
        const updatePayload: {
          taskId?: string;
          taskTitleQuery?: string;
          date?: string | null;
          scheduledStartMinute?: number | null;
          durationMinutes?: number;
        } = {};
        if (targetId) updatePayload.taskId = targetId;
        if (targetTitle) updatePayload.taskTitleQuery = targetTitle;
        if (newDate !== undefined) updatePayload.date = newDate;
        if (newTime !== undefined) updatePayload.scheduledStartMinute = newTime;
        if (dur !== null) updatePayload.durationMinutes = dur;

        return {
          success: true,
          actions: [
            {
              type: 'update_task',
              payload: updatePayload,
            },
          ],
          pendingClarification: null,
        };
      }
    }
  }

  // Handle multi-action commands separated by ", then " or " then "
  if (userMessage.includes(' then ') || userMessage.includes(', then ')) {
    const parts = userMessage.split(/\s*(?:,\s*)?then\s+/i);
    const actions: AIAction[] = [];
    for (const part of parts) {
      const subResult = parseIntent(part, context);
      if (subResult.success) {
        actions.push(...subResult.actions);
      }
    }
    if (actions.length > 0) {
      return { success: true, actions, pendingClarification: null };
    }
  }

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
          pendingClarification: null,
        };
      }
      if (/^(?:i\s+studied|i\s+was\s+studying|i\s+did|i\s+went)/i.test(normalized)) {
        return {
          success: false,
          error: 'Great job completing your study session!',
          pendingClarification: null,
        };
      }
      return {
        success: false,
        error: 'I am here to help you manage your Life OS plan. Would you like me to schedule a task for you?',
        pendingClarification: null,
      };
    }
  }

  // Check for inability / conflict / trouble with task patterns
  // e.g. "not able to do pharmacology today", "cant do pharmacology", "having trouble with pharmacology"
  const inabilityMatch =
    normalized.match(/^(?:not\s+able\s+to\s+do|unable\s+to\s+do|cant\s+do|cannot\s+do|dont\s+want\s+to\s+do|trouble\s+with|issue\s+with)\s+(.+)$/i) ||
    normalized.match(/^(?:i\s+)?(?:cant|cannot|dont|am\s+not\s+able\s+to)\s+(?:do\s+)?(.+?)(?:\s+today|\s+tonight)?$/i);

  if (inabilityMatch) {
    const rawQuery = inabilityMatch[1].replace(/\b(today|tonight|tomorrow)\b/gi, '').trim();
    const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);

    if (taskMatch.type === 'exact' || taskMatch.type === 'single') {
      const matchedTask = taskMatch.task;
      const question = `I see you're having trouble with ${matchedTask.title} today. Would you like to reschedule it or add a reminder?`;
      return {
        success: false,
        error: question,
        clarificationNeeded: true,
        actions: [{ type: 'clarification', payload: { question } }],
        pendingClarification: {
          pendingIntent: 'update_task',
          taskId: matchedTask.id,
          taskTitle: matchedTask.title,
          taskTitleQuery: matchedTask.title,
          date: null,
          scheduledStartMinute: null,
          missingFields: ['date', 'time'],
        },
      };
    } else if (taskMatch.type === 'multiple') {
      const matchNames = taskMatch.matches.map((t) => `"${t.title}"`).join(', ');
      const question = `I found multiple tasks matching "${rawQuery}": ${matchNames}. Which one do you mean?`;
      return {
        success: false,
        error: question,
        clarificationNeeded: true,
        actions: [{ type: 'clarification', payload: { question } }],
        pendingClarification: null,
      };
    }
  }

  // 1. Get schedule queries
  const isScheduleQuery =
    normalized === 'schedule' ||
    normalized.includes('whats my schedule') ||
    normalized.includes('what is my schedule') ||
    normalized.includes('show my schedule') ||
    normalized.includes('get schedule') ||
    normalized.includes('view my schedule') ||
    normalized.includes('what am i doing') ||
    normalized.includes('whats scheduled') ||
    normalized.includes('what is scheduled');

  if (isScheduleQuery) {
    const dateRes = parseNaturalDateString(normalized, context?.currentDate);
    const targetDate = dateRes.date ?? context?.currentDate ?? getTodayString();
    return {
      success: true,
      actions: [{ type: 'get_schedule', payload: { date: targetDate } }],
      pendingClarification: null,
    };
  }

  // 2. Free time & slot queries
  const isFreeTimeQuery =
    normalized.includes('free time') ||
    normalized.includes('free slot') ||
    normalized.includes('free hours') ||
    normalized.includes('free minute') ||
    normalized.includes('when can i') ||
    (normalized.includes('do i have') && (normalized.includes('free') || normalized.includes('slot')));

  if (isFreeTimeQuery) {
    const dateRes = parseNaturalDateString(normalized, context?.currentDate);
    const targetDate = dateRes.date ?? context?.currentDate ?? getTodayString();
    const dur = parseDurationMinutes(normalized);

    let taskQuery: string | null = null;
    const whenCanIMatch = normalized.match(/when\s+can\s+i\s+(?:study|work\s+on|do|practice|read|write)?\s*(.+?)(?:\s+today|\s+tomorrow|\s+on\s+|\s+for\s+|$)/i);
    if (whenCanIMatch && whenCanIMatch[1]) {
      const candidate = whenCanIMatch[1].trim();
      if (candidate && !['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(candidate)) {
        taskQuery = candidate;
      }
    }

    return {
      success: true,
      actions: [
        {
          type: 'get_free_time',
          payload: {
            date: targetDate,
            targetDurationMinutes: dur,
            targetTaskTitleQuery: taskQuery,
          },
        },
      ],
      pendingClarification: null,
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
      pendingClarification: null,
    };
  }

  // 4. Update task patterns
  // A. Anytime / Remove date / Remove explicit time constraint
  const anytimeMatch =
    normalized.match(/^(?:make|set|change)\s+(.+?)\s+(?:an\s+)?anytime\s*(?:task)?(?:\s+(.+))?$/i) ||
    normalized.match(/^(?:remove|clear)\s+(?:the\s+)?(?:date|time)\s+(?:from|for)\s+(.+)$/i) ||
    normalized.match(/^undate\s+(.+)$/i);

  if (anytimeMatch) {
    const rawQuery = anytimeMatch[1].trim();
    const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
    const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
    const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;
    const datePhrase = anytimeMatch[2]?.trim();
    const dateResult = datePhrase ? parseNaturalDateString(datePhrase) : { date: null };
    return {
      success: true,
      actions: [
        {
          type: 'update_task',
          payload: {
            taskId: resolvedId,
            taskTitleQuery: resolvedTitle,
            date: dateResult.date ?? null,
            scheduledStartMinute: null,
          },
        },
      ],
      pendingClarification: null,
    };
  }

  // B. Priority update
  const priorityMatch =
    normalized.match(/^(?:make|set|change|update)\s+(.+?)\s+(high|medium|low)\s+priority$/i) ||
    normalized.match(/^(?:change|set|update)\s+(.+?)\s+priority\s+to\s+(high|medium|low)$/i);

  if (priorityMatch) {
    const rawQuery = priorityMatch[1].trim();
    const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
    const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
    const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;
    const priority = priorityMatch[2].toLowerCase() as TaskPriority;
    return {
      success: true,
      actions: [
        {
          type: 'update_task',
          payload: { taskId: resolvedId, taskTitleQuery: resolvedTitle, priority },
        },
      ],
      pendingClarification: null,
    };
  }

  // C. Duration update
  const durationMatch =
    normalized.match(/^(?:change|set|update)\s+(.+?)\s+(?:duration\s+)?to\s+(\d+(?:\.\d+)?\s*(?:hours|hour|hrs|hr|h|minutes|minute|mins|min|m))$/i);

  if (durationMatch) {
    const rawQuery = durationMatch[1].trim();
    const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
    const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
    const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;
    const durationMinutes = parseDurationMinutes(durationMatch[2]);
    if (durationMinutes !== null) {
      return {
        success: true,
        actions: [
          {
            type: 'update_task',
            payload: { taskId: resolvedId, taskTitleQuery: resolvedTitle, durationMinutes },
          },
        ],
        pendingClarification: null,
      };
    }
  }

  // D. Date update / Move / Reschedule (supports explicit time, e.g. "Move pathology to tomorrow at 3 PM")
  const moveMatch =
    normalized.match(/^(?:move|reschedule|shift|postpone)\s+(.+?)\s+to\s+(.+)$/i) ||
    normalized.match(/^(?:change|update|set)\s+(.+?)\s+(?:date\s+)?to\s+(.+)$/i) ||
    normalized.match(/^(?:reschedule|move)\s+(.+)$/i);

  if (moveMatch) {
    const rawQuery = moveMatch[1].trim();
    const targetPhrase = moveMatch[2] ? moveMatch[2].trim() : '';

    const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
    if (taskMatch.type === 'multiple') {
      const matchNames = taskMatch.matches.map((t) => `"${t.title}"`).join(', ');
      const question = `I found multiple tasks matching "${rawQuery}": ${matchNames}. Which one do you mean?`;
      return {
        success: false,
        error: question,
        clarificationNeeded: true,
        actions: [{ type: 'clarification', payload: { question } }],
        pendingClarification: null,
      };
    }

    const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
    const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;

    if (!targetPhrase || targetPhrase.includes('another day') || targetPhrase.includes('other day')) {
      const question = `Would you like to reschedule '${resolvedTitle}' to another day?`;
      return {
        success: false,
        error: question,
        clarificationNeeded: true,
        actions: [{ type: 'clarification', payload: { question } }],
        pendingClarification: {
          pendingIntent: 'update_task',
          taskId: resolvedId,
          taskTitle: resolvedTitle,
          taskTitleQuery: resolvedTitle,
          missingFields: ['date', 'time'],
        },
      };
    }

    const timeRes = parseExplicitStartMinute(targetPhrase);
    const dateResult = parseNaturalDateString(timeRes.cleanedText);
    const updatePayload: { taskId?: string; taskTitleQuery: string; date?: string | null; scheduledStartMinute?: number | null } = {
      taskTitleQuery: resolvedTitle,
    };
    if (resolvedId) updatePayload.taskId = resolvedId;
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
      pendingClarification: null,
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
      const rawQuery = match[1].trim();
      const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
      const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
      const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;

      return {
        success: true,
        actions: [
          {
            type: 'complete_task',
            payload: { taskId: resolvedId, taskTitleQuery: resolvedTitle },
          },
        ],
        pendingClarification: null,
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
      const rawQuery = match[1].trim();
      const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
      const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
      const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;

      return {
        success: true,
        actions: [
          {
            type: 'skip_task',
            payload: { taskId: resolvedId, taskTitleQuery: resolvedTitle },
          },
        ],
        pendingClarification: null,
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
      const rawQuery = match[1].trim();
      const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
      const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
      const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;

      return {
        success: true,
        actions: [
          {
            type: 'delete_task',
            payload: { taskId: resolvedId, taskTitleQuery: resolvedTitle },
          },
        ],
        pendingClarification: null,
      };
    }
  }

  // 7. Create task patterns
  const createPrefixes = [
    /^(?:add|create|schedule|put)\s+(?:task\s+)?(.+)$/i,
    /^(?:i\s+need\s+to|need\s+to|remind\s+me\s+to|i\s+have\s+to|have\s+to|must|i\s+want\s+to|want\s+to)\s+(.+)$/i,
    /^(?:study|work\s+on|do|practice|read|write|prepare|review)\s+(.+)$/i,
  ];

  let createMatch: RegExpMatchArray | null = null;
  for (const prefix of createPrefixes) {
    createMatch = normalized.match(prefix);
    if (createMatch) break;
  }

  if (!createMatch && (parseDurationMinutes(normalized) !== null || parseExplicitStartMinute(normalized).startMinute !== null)) {
    createMatch = [normalized, normalized];
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
        pendingClarification: null,
      };
    }

    let titleStr = dateResult.cleanedText
      .replace(/^(add|create|schedule|put)\s+(?:task\s+)?/i, '')
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
      pendingClarification: null,
    };
  }

  // Unrecognized command fallback
  return {
    success: false,
    error: `I didn't recognize that command. Try asking "what's my schedule?", "add gym for 1 hour", "completed study", "skip gym", or "replan my day".`,
    pendingClarification: null,
  };
}

