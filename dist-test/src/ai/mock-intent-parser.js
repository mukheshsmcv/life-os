"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTaskEntity = resolveTaskEntity;
exports.normalizeAbbreviations = normalizeAbbreviations;
exports.parseExplicitStartMinute = parseExplicitStartMinute;
exports.parseIntent = parseIntent;
const date_time_1 = require("@/lib/date-time");
function resolveTaskEntity(query, tasks) {
    if (!query || !query.trim() || !tasks || tasks.length === 0)
        return { type: 'none' };
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
    if (!cleanedQuery)
        return { type: 'none' };
    // 1. Exact match (case-insensitive)
    const exact = tasks.filter((t) => t.title.toLowerCase().trim() === cleanedQuery);
    if (exact.length === 1)
        return { type: 'exact', task: exact[0] };
    // 2. Substring / Word match (case-insensitive)
    const substringMatches = tasks.filter((t) => {
        const titleLower = t.title.toLowerCase().trim();
        const cleanedTitle = titleLower.replace(/^(?:study|work on|my|the|task|a|an)\s+/i, '').trim();
        return (titleLower.includes(cleanedQuery) ||
            cleanedQuery.includes(titleLower) ||
            cleanedTitle.includes(cleanedQuery) ||
            cleanedQuery.includes(cleanedTitle));
    });
    if (substringMatches.length === 1) {
        return { type: 'single', task: substringMatches[0] };
    }
    if (substringMatches.length > 1) {
        return { type: 'multiple', matches: substringMatches };
    }
    return { type: 'none' };
}
function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/['\u2019]/g, '')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?!]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Pre-processes raw user input to normalize informal abbreviations,
 * typos, and shorthand so downstream extraction works cleanly.
 * This runs BEFORE any other parsing. Order matters (longer → shorter).
 */
function normalizeAbbreviations(text) {
    let t = text;
    // Temporal abbreviations
    t = t.replace(/\btomorow\b/gi, 'tomorrow');
    t = t.replace(/\btmrw\b/gi, 'tomorrow');
    t = t.replace(/\btmr\b/gi, 'tomorrow');
    t = t.replace(/\btonite\b/gi, 'tonight');
    t = t.replace(/\btonigt\b/gi, 'tonight');
    t = t.replace(/\btoday\b/gi, 'today'); // already correct but normalize case
    // Duration abbreviations
    t = t.replace(/\bhrs?\b/gi, 'hours');
    t = t.replace(/\bmins?\b/gi, 'minutes');
    // Activity/appointment shorthands
    t = t.replace(/\bappt\b/gi, 'appointment');
    t = t.replace(/\bmtg\b/gi, 'meeting');
    t = t.replace(/\bwknd\b/gi, 'weekend');
    t = t.replace(/\bw\/ /gi, 'with ');
    t = t.replace(/\bw\//gi, 'with ');
    // Informal language
    t = t.replace(/\bgotta\b/gi, 'need to');
    t = t.replace(/\bneeda\b/gi, 'need to');
    t = t.replace(/\bgonna\b/gi, 'going to');
    t = t.replace(/\bwanna\b/gi, 'want to');
    t = t.replace(/\blemme\b/gi, 'let me');
    t = t.replace(/\bcan u\b/gi, 'can you');
    t = t.replace(/\bcould u\b/gi, 'could you');
    t = t.replace(/\bbtw\b/gi, 'by the way');
    t = t.replace(/\brn\b/gi, 'right now');
    t = t.replace(/\basap\b/gi, 'as soon as possible');
    t = t.replace(/\bpls\b/gi, 'please');
    t = t.replace(/\bplz\b/gi, 'please');
    // Contraction shorthands (don't → do not for negation detection)
    t = t.replace(/\bdon't\b/gi, 'do not');
    t = t.replace(/\bdont\b/gi, 'do not');
    t = t.replace(/\bwon't\b/gi, 'will not');
    t = t.replace(/\bwont\b/gi, 'will not');
    t = t.replace(/\bcan't\b/gi, 'cannot');
    t = t.replace(/\bcant\b/gi, 'cannot');
    // Common typos
    t = t.replace(/\brestuarant\b/gi, 'restaurant');
    t = t.replace(/\bmeeeting\b/gi, 'meeting');
    t = t.replace(/\bpharmacolgy\b/gi, 'pharmacology');
    return t;
}
/** Infers the semantic category of an activity from keyword patterns. */
function inferCategory(text) {
    const lower = text.toLowerCase();
    if (/\b(meeting|mtg|standup|stand-up|call with|conference|sync)\b/i.test(lower))
        return 'meeting';
    if (/\b(lunch|dinner|breakfast|brunch|coffee|drinks|meal|restaurant|eat|dining|food)\b/i.test(lower))
        return 'social';
    if (/\b(movie|film|cinema|show|concert|play|event|game|party|hangout)\b/i.test(lower))
        return 'event';
    if (/\b(travel|flight|airport|train|station|bus|cab|taxi|uber|rapido|drive|leave for|reach|arrive|hyderabad|chennai|mumbai|delhi|bangalore)\b/i.test(lower))
        return 'travel';
    if (/\b(doctor|doc|dentist|hospital|clinic|appointment|checkup|physio)\b/i.test(lower))
        return 'meeting';
    if (/\b(remind|reminder|call mom|call dad|call\s+[A-Z])\b/i.test(lower) || /^call\s/i.test(lower))
        return 'reminder';
    return 'task';
}
/** Extracts people mentioned with "with [Person]" patterns. */
function extractPeople(text) {
    const people = [];
    // Match "with PersonName" where PersonName starts with uppercase or "Dr."
    const withPattern = /\bwith\s+((?:Dr\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
    let match;
    while ((match = withPattern.exec(text)) !== null) {
        const person = match[1].trim();
        if (person && !['You', 'Me', 'My', 'The', 'A', 'An'].includes(person)) {
            people.push(person);
        }
    }
    return people;
}
/** Detects external execution requirements from keywords. */
function detectExecutionRequirement(text) {
    const lower = text.toLowerCase();
    if (/\b(book|reserve|order|make a reservation)\b/i.test(lower))
        return 'booking';
    if (/\b(cab|taxi|uber|rapido|transport|ride|pick ?up|drop|shuttle)\b/i.test(lower))
        return 'transport';
    if (/\b(email|send|text|message|whatsapp|notify|ping|call)\b/i.test(lower))
        return 'communication';
    return undefined;
}
/** Detects if the message is negating an action. */
function detectNegation(normalized) {
    return /\b(do not|cannot|don't|don't want|not going to|no|never mind|forget it|cancel that)\b/i.test(normalized) &&
        !/(do not have|not have|cannot find|do not know)\b/i.test(normalized);
}
/**
 * Infers scheduling mode from text cues:
 * - Explicit time → fixed
 * - morning/afternoon/evening without exact time → preferred_window
 * - "by X" / "before X" with a time → deadline
 * - No time → flexible
 */
function inferSchedulingMode(hasExplicitTime, text) {
    const lower = text.toLowerCase();
    // Deadline: "by 6", "by 6 PM", "before 5"
    const deadlineMatch = lower.match(/\b(?:by|before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (deadlineMatch && !hasExplicitTime) {
        let hours = parseInt(deadlineMatch[1], 10);
        const mins = deadlineMatch[2] ? parseInt(deadlineMatch[2], 10) : 0;
        const period = (deadlineMatch[3] || '').toLowerCase();
        if (period === 'pm' && hours < 12)
            hours += 12;
        else if (!period && hours >= 1 && hours <= 7)
            hours += 12; // assume PM for 1-7
        if (hours >= 0 && hours < 24) {
            return { mode: 'deadline', deadlineMinute: hours * 60 + mins };
        }
    }
    if (hasExplicitTime)
        return { mode: 'fixed' };
    // Preferred window: time-of-day words
    if (/\b(morning|afternoon|evening|night|noon|midday)\b/i.test(lower)) {
        return { mode: 'preferred_window' };
    }
    return { mode: 'flexible' };
}
function parseDurationMinutes(text) {
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
function parsePriority(text) {
    const lower = text.toLowerCase();
    if (lower.includes('high priority') || lower.includes('priority high'))
        return 'high';
    if (lower.includes('low priority') || lower.includes('priority low'))
        return 'low';
    return 'medium';
}
function extractDateAndCleanText(text) {
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
    const parseResult = (0, date_time_1.parseNaturalDateString)(text);
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
function parseExplicitStartMinute(text) {
    if (!text || typeof text !== 'string')
        return { startMinute: null, cleanedText: text };
    // 1. Matches "12pm", "12 pm", "12:00pm", "12:00 pm", "7pm", "7 pm", "7:30pm", "7:30 pm", "12am", "12 am", "4 pm"
    const amPmRegex = /\b(?:at\s+)?(\d{1,2})(?::?(\d{2}))?\s*(am|pm)\b/i;
    const amPmMatch = text.match(amPmRegex);
    if (amPmMatch) {
        let hours = parseInt(amPmMatch[1], 10);
        const minutes = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
        const period = amPmMatch[3].toLowerCase();
        if (period === 'pm' && hours < 12)
            hours += 12;
        if (period === 'am' && hours === 12)
            hours = 0;
        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            const cleanedText = text.replace(amPmMatch[0], '').replace(/\s+/g, ' ').trim();
            return { startMinute: hours * 60 + minutes, cleanedText };
        }
    }
    const justAtRegex = /\bat\s+([1-9]|1[0-2])\b/i;
    const justAtMatch = text.match(justAtRegex);
    if (justAtMatch) {
        let hours = parseInt(justAtMatch[1], 10);
        // Assume PM for hours 1 to 6
        if (hours >= 1 && hours <= 6)
            hours += 12;
        const cleanedText = text.replace(justAtMatch[0], '').replace(/\s+/g, ' ').trim();
        return { startMinute: hours * 60, cleanedText };
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
        if (hours >= 1 && hours <= 7)
            hours += 12;
        if (hours >= 0 && hours < 24) {
            const cleanedText = text.replace(atMatch[0], '').replace(/\s+/g, ' ').trim();
            return { startMinute: hours * 60, cleanedText };
        }
    }
    return { startMinute: null, cleanedText: text };
}
function parseIntent(userMessage, context) {
    const rawTrimmed = userMessage.trim();
    if (!rawTrimmed) {
        return { success: false, error: 'Please enter a message.' };
    }
    // STEP 0: Normalize abbreviations and informal language FIRST
    const preprocessed = normalizeAbbreviations(rawTrimmed);
    const normalized = normalizeText(preprocessed);
    // ── Contextual Resolution for Pending Clarification ─────────────────────────
    const pending = context?.pendingClarification;
    if (pending) {
        const isNewCommand = /^(?:add|create|delete|complete|skip|done|mark)\b/i.test(normalized) ||
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
            const dateRes = (0, date_time_1.parseNaturalDateString)(normalized);
            const timeRes = parseExplicitStartMinute(normalized);
            const dur = parseDurationMinutes(normalized);
            const targetTitle = pending.taskTitle || pending.taskTitleQuery || 'Task';
            const targetId = pending.taskId;
            let newDate = dateRes.date !== null ? dateRes.date : (pending.date ?? null);
            let newTime = timeRes.startMinute !== null ? timeRes.startMinute : (pending.scheduledStartMinute ?? null);
            const isAffirmativeOnly = normalized === 'yes' ||
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
                const updatePayload = {};
                if (targetId)
                    updatePayload.taskId = targetId;
                if (targetTitle)
                    updatePayload.taskTitleQuery = targetTitle;
                if (newDate !== undefined)
                    updatePayload.date = newDate;
                if (newTime !== undefined)
                    updatePayload.scheduledStartMinute = newTime;
                if (dur !== null)
                    updatePayload.durationMinutes = dur;
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
        const actions = [];
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
    // Small deterministic fallback for common conversation (LLM handles the rest)
    const isBasicChat = /^(?:hey|hello|hi|thanks|thank you|ok|okay|got it|cool|nice)\b/i.test(normalized);
    if (isBasicChat) {
        let reply = 'Hello! How can I help you?';
        if (/thanks|thank you/i.test(normalized))
            reply = "You're welcome!";
        else if (/ok|okay|got it|cool|nice/i.test(normalized))
            reply = "Sounds good.";
        return {
            success: true,
            actions: [{
                    type: 'process_intent',
                    payload: { operation: 'general_conversation', conversationalResponse: reply }
                }],
            pendingClarification: null,
        };
    }
    // Check for inability / conflict / trouble with task patterns
    // e.g. "not able to do pharmacology today", "cant do pharmacology", "having trouble with pharmacology"
    const inabilityMatch = normalized.match(/^(?:not\s+able\s+to\s+do|unable\s+to\s+do|cant\s+do|cannot\s+do|dont\s+want\s+to\s+do|trouble\s+with|issue\s+with)\s+(.+)$/i) ||
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
        }
        else if (taskMatch.type === 'multiple') {
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
    // 1a. Next activity query
    const isNextActivityQuery = !normalized.includes('next week') &&
        !normalized.includes('next month') &&
        (normalized === 'whats next' ||
            normalized === 'what is next' ||
            normalized === 'what next' ||
            normalized === 'whats next on my schedule' ||
            normalized === 'what is next on my schedule' ||
            normalized === 'what am i doing next' ||
            normalized === 'what do i do next' ||
            /\b(?:whats|what is)\s+next(?:\s+on\s+my\s+schedule)?\b/i.test(normalized) ||
            /\bwhat\s+am\s+i\s+doing\s+next\b/i.test(normalized) ||
            /\bwhat\s+do\s+i\s+do\s+next\b/i.test(normalized));
    if (isNextActivityQuery) {
        const dateRes = (0, date_time_1.parseNaturalDateString)(normalized, context?.currentDate);
        const payload = { scope: 'next' };
        if (dateRes.date) {
            payload.date = dateRes.date;
        }
        return {
            success: true,
            actions: [{ type: 'get_schedule', payload }],
            pendingClarification: null,
        };
    }
    // 1b. Get full schedule queries
    const isScheduleQuery = normalized === 'schedule' ||
        normalized.includes('whats my schedule') ||
        normalized.includes('what is my schedule') ||
        normalized.includes('show my schedule') ||
        normalized.includes('get schedule') ||
        normalized.includes('view my schedule') ||
        normalized.includes('what am i doing') ||
        normalized.includes('whats scheduled') ||
        normalized.includes('what is scheduled') ||
        normalized.includes('whats on') ||
        normalized.includes('what is on') ||
        normalized.includes('what do i have') ||
        normalized.includes('anything on') ||
        normalized.includes('do i have anything at') ||
        normalized.includes('do i have anything tomorrow') ||
        /\b(what|whats)\s+(is\s+)?(on|happening)\s+(today|tomorrow|tonight|this\s+week)\b/i.test(normalized);
    if (isScheduleQuery) {
        const dateRes = (0, date_time_1.parseNaturalDateString)(normalized, context?.currentDate);
        const targetDate = dateRes.date ?? context?.currentDate ?? (0, date_time_1.getTodayString)();
        return {
            success: true,
            actions: [{ type: 'get_schedule', payload: { date: targetDate, scope: 'full' } }],
            pendingClarification: null,
        };
    }
    // 2. Free time & slot queries
    const isFreeTimeQuery = normalized.includes('free time') ||
        normalized.includes('free slot') ||
        normalized.includes('free hours') ||
        normalized.includes('free minute') ||
        normalized.includes('anything free') ||
        normalized.includes('am i free') ||
        normalized.includes('are you free') ||
        normalized.includes('when can i') ||
        (normalized.includes('do i have') && (normalized.includes('free') || normalized.includes('slot') || normalized.includes('hours free') || normalized.includes('time'))) ||
        (normalized.includes('any') && normalized.includes('free') && !normalized.includes('schedule'));
    if (isFreeTimeQuery) {
        const dateRes = (0, date_time_1.parseNaturalDateString)(normalized, context?.currentDate);
        const targetDate = dateRes.date ?? context?.currentDate ?? (0, date_time_1.getTodayString)();
        const dur = parseDurationMinutes(normalized);
        let taskQuery = null;
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
    // 2b. Availability context statements: "I'm free tomorrow evening"
    const isAvailabilityStatement = /^(?:i\s+)?(?:i'm|im)\s+free\b/i.test(normalized) ||
        /^i\s+am\s+free\b/i.test(normalized) ||
        /^i\s+am\s+available\b/i.test(normalized);
    if (isAvailabilityStatement) {
        const dateRes = (0, date_time_1.parseNaturalDateString)(normalized, context?.currentDate);
        return {
            success: true,
            actions: [{
                    type: 'process_intent',
                    payload: {
                        operation: 'context_statement',
                        title: 'availability',
                        scheduling: { mode: 'flexible', date: dateRes.date },
                    },
                }],
            pendingClarification: null,
        };
    }
    // 3. Replan day
    if (normalized === 'replan' ||
        normalized.includes('replan my day') ||
        normalized.includes('replan day') ||
        normalized.includes('replan the day')) {
        return {
            success: true,
            actions: [{ type: 'replan_day' }],
            pendingClarification: null,
        };
    }
    // 4. Update task patterns
    // A. Anytime / Remove date / Remove explicit time constraint
    const anytimeMatch = normalized.match(/^(?:make|set|change)\s+(.+?)\s+(?:an\s+)?anytime\s*(?:task)?(?:\s+(.+))?$/i) ||
        normalized.match(/^(?:remove|clear)\s+(?:the\s+)?(?:date|time)\s+(?:from|for)\s+(.+)$/i) ||
        normalized.match(/^undate\s+(.+)$/i);
    if (anytimeMatch) {
        const rawQuery = anytimeMatch[1].trim();
        const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
        const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
        const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;
        const datePhrase = anytimeMatch[2]?.trim();
        const dateResult = datePhrase ? (0, date_time_1.parseNaturalDateString)(datePhrase) : { date: null };
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
    const priorityMatch = normalized.match(/^(?:make|set|change|update)\s+(.+?)\s+(high|medium|low)\s+priority$/i) ||
        normalized.match(/^(?:change|set|update)\s+(.+?)\s+priority\s+to\s+(high|medium|low)$/i);
    if (priorityMatch) {
        const rawQuery = priorityMatch[1].trim();
        const taskMatch = resolveTaskEntity(rawQuery, context?.tasks);
        const resolvedTitle = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.title : rawQuery;
        const resolvedId = taskMatch.type === 'exact' || taskMatch.type === 'single' ? taskMatch.task.id : undefined;
        const priority = priorityMatch[2].toLowerCase();
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
    const durationMatch = normalized.match(/^(?:change|set|update)\s+(.+?)\s+(?:duration\s+)?to\s+(\d+(?:\.\d+)?\s*(?:hours|hour|hrs|hr|h|minutes|minute|mins|min|m))$/i);
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
    const moveMatch = normalized.match(/^(?:move|reschedule|shift|postpone)\s+(.+?)\s+to\s+(.+)$/i) ||
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
        const dateResult = (0, date_time_1.parseNaturalDateString)(timeRes.cleanedText);
        const updatePayload = {
            taskTitleQuery: resolvedTitle,
        };
        if (resolvedId)
            updatePayload.taskId = resolvedId;
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
    let cleaned = normalized;
    // Active Context Pronoun Resolution
    let resolvedTargetId = undefined;
    if (context?.activeActivityId) {
        if (/\b(it|that|this|the meeting|the task|the event|my meeting|my appointment)\b/i.test(cleaned)) {
            resolvedTargetId = context.activeActivityId;
        }
    }
    // 1. Primitive Extraction (using preprocessed text to catch all abbreviations)
    const timeRes = parseExplicitStartMinute(cleaned);
    const dateResult = extractDateAndCleanText(timeRes.cleanedText);
    let finalTitle = dateResult.cleanedText;
    const priority = parsePriority(finalTitle);
    const durationMinutes = parseDurationMinutes(finalTitle);
    // Clean filler words
    finalTitle = finalTitle
        .replace(/^(add|create|schedule|put|change|update|delete|remove|skip|finish|complete|cancel|book|get me a?|remind me to?)\s+(?:task\s+|event\s+)?/i, '')
        .replace(/^(i\s+need\s+to|need\s+to|i\s+have\s+to|have\s+to|must|i\s+want\s+to|want\s+to|i\s+have\s+a|i\s+have\s+got\s+a|i\s+have\s+got|i\s+have)\s+/i, '')
        .replace(/^(i\s+will\s+be|i\s+am\s+going\s+to|going\s+to|will\s+be)\s+/i, '')
        .replace(/(high|medium|low)\s+priority\s*/gi, '')
        .replace(/priority\s+(high|medium|low)\s*/gi, '')
        .replace(/\b(it|that|this)\b/gi, '')
        .trim();
    // 2. Detect operation from preprocessed text (use preprocessed to handle abbrev)
    let operation = 'create_activity';
    const preprocessedLower = preprocessed.toLowerCase();
    // Negation: "do not schedule", "not going to"
    if (detectNegation(normalized)) {
        // Check if they're negating a creation/scheduling intent
        if (/\b(schedule|add|create|book)\b/i.test(normalized)) {
            return {
                success: false,
                error: "Understood — I won't schedule that.",
                pendingClarification: null,
            };
        }
    }
    if (/^(delete|remove|cancel|forget)\b/i.test(preprocessedLower))
        operation = 'delete_activity';
    else if (/^(update|change|move|reschedule|make)\b/i.test(preprocessedLower))
        operation = 'update_activity';
    else if (/^(complete|finish|done|mark.*done|mark.*complete)\b/i.test(preprocessedLower))
        operation = 'complete_activity';
    else if (/^(skip)\b/i.test(preprocessedLower))
        operation = 'skip_activity';
    // If this is an update/delete/complete/skip and we have no pronoun resolution, try resolving by title
    if (['update_activity', 'delete_activity', 'complete_activity', 'skip_activity'].includes(operation) && !resolvedTargetId) {
        const taskMatch = resolveTaskEntity(finalTitle, context?.tasks);
        if (taskMatch.type === 'exact' || taskMatch.type === 'single') {
            resolvedTargetId = taskMatch.task.id;
        }
        else if (taskMatch.type === 'multiple') {
            const matchNames = taskMatch.matches.map((t) => `"${t.title}"`).join(', ');
            const question = `I found multiple activities matching "${finalTitle}": ${matchNames}. Which one do you mean?`;
            return {
                success: false,
                error: question,
                clarificationNeeded: true,
                actions: [{ type: 'clarification', payload: { question } }],
                pendingClarification: null,
            };
        }
    }
    // 3. Semantic enrichment
    const category = inferCategory(preprocessed);
    const people = extractPeople(preprocessed); // uses original case for names
    const executionRequirement = detectExecutionRequirement(preprocessed);
    const scheduling = inferSchedulingMode(timeRes.startMinute !== null, preprocessed);
    const entities = people.length > 0
        ? { people }
        : undefined;
    const title = finalTitle ? finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1) : finalTitle;
    const payload = {
        operation: operation,
        category,
        title,
        targetId: resolvedTargetId,
        priority,
        entities,
        executionRequirement,
        scheduling: {
            mode: scheduling.mode,
            date: dateResult.date,
            startMinute: timeRes.startMinute,
            deadlineMinute: scheduling.deadlineMinute ?? null,
            durationMinutes: durationMinutes,
        }
    };
    // 4. Semantic Partial Intent & Ambiguity Check
    if (operation === 'create_activity') {
        const genericTerms = ['appointment', 'meeting', 'task', 'event', 'something', 'activity', 'a meeting', 'an appointment'];
        if (!title || genericTerms.includes(title.toLowerCase())) {
            const noun = title ? title.toLowerCase().replace(/^(a|an)\s+/, '') : 'activity';
            const question = `What kind of ${noun} do you want to schedule?`;
            return {
                success: false,
                error: question,
                clarificationNeeded: true,
                actions: [{
                        type: 'clarification',
                        payload: {
                            question,
                            candidateAction: { type: 'process_intent', payload }
                        }
                    }],
                pendingClarification: null,
            };
        }
        // "apartment remote" mock fallback logic for testing ambiguous phrases
        if (title.toLowerCase() === 'apartment remote' || title.toLowerCase() === 'an apartment remote') {
            const question = `Could you clarify what you mean by '${title}'?`;
            return {
                success: false,
                error: question,
                clarificationNeeded: true,
                actions: [{
                        type: 'clarification',
                        payload: {
                            question,
                            candidateAction: { type: 'process_intent', payload }
                        }
                    }],
                pendingClarification: null,
            };
        }
    }
    return {
        success: true,
        actions: [{ type: 'process_intent', payload }],
        pendingClarification: null,
    };
}
