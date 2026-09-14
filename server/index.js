const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Simple .env parser to avoid third-party dependencies
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    });
  }
}

loadEnv();

const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;

// AI provider selection: gemini | groq | qwen
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';

const QWEN_API_KEY = process.env.QWEN_API_KEY || '';
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen3.5-flash';
const QWEN_BASE_URL = process.env.QWEN_BASE_URL || 'https://dashscope-us.aliyuncs.com/compatible-mode/v1';

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function getTomorrowFromYMD(ymdStr) {
  if (!ymdStr || !/^\d{4}-\d{2}-\d{2}$/.test(ymdStr)) return 'unknown';
  const [y, m, d] = ymdStr.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d) + 86400_000;
  const next = new Date(utcMs);
  const nextY = next.getUTCFullYear();
  const nextM = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(next.getUTCDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

function buildSystemPrompt(userMessage, context) {
  const currentDate = context?.currentDate || 'unknown';
  const tomorrowDate = getTomorrowFromYMD(currentDate);
  const currentTime = context?.currentTime || 'unknown';
  const timezone = context?.timezone || 'Asia/Kolkata';

  const tasksSummary = context?.tasks && context.tasks.length > 0
    ? context.tasks.map((t) => `- "${t.title}" (id: ${t.id}, duration: ${t.durationMinutes}m, priority: ${t.priority}, status: ${t.status}, date: ${t.date ?? 'undated'})`).join('\n')
    : 'No tasks existing currently.';

  const activeActivityId = context?.activeActivityId;
  const activeActivitySummary = activeActivityId 
    ? `\n=== ACTIVE CONVERSATIONAL ACTIVITY ===\nThe user is currently discussing or recently created the activity with ID: "${activeActivityId}".\nIf they use pronouns (it, that, the meeting, etc.) or imply an update to the current context, you MUST use "${activeActivityId}" as the targetId.\n` 
    : '';

  const pendingClarification = context?.pendingClarification;
  const pendingSummary = pendingClarification
    ? `\n=== ACTIVE CONVERSATION CLARIFICATION IN PROGRESS ===
The assistant previously asked a clarification/confirmation regarding:
- Intent: ${pendingClarification.pendingIntent || 'update_task'}
- Target Task ID: "${pendingClarification.taskId || ''}"
- Target Task Title: "${pendingClarification.taskTitle || pendingClarification.taskTitleQuery || ''}"
- Preserved Date: ${pendingClarification.date ?? 'none'}
- Preserved scheduledStartMinute: ${pendingClarification.scheduledStartMinute ?? 'none'}

CRITICAL FOLLOW-UP INSTRUCTIONS:
1. The user's input "${userMessage}" is a direct follow-up response regarding task "${pendingClarification.taskTitle || pendingClarification.taskId || 'the target task'}".
2. If the user explicitly changes details (like "make it 5 PM" or "change to Rahul"), you MUST output an update_task or process_intent (update_activity) action with those changes, targeting "taskId": "${pendingClarification.taskId || ''}" and/or "targetQuery": "${pendingClarification.taskTitle || pendingClarification.taskTitleQuery || ''}".
3. Merge the newly specified date, time, or entities with the preserved values to form the updated action.
`
    : '';

  return `You are the LANGUAGE UNDERSTANDING LAYER of Life OS — a personal operating system.

YOUR SOLE JOB: Convert what the user says into structured intent JSON.
You do NOT schedule the user's day. You do NOT decide what time things happen.
You ONLY extract: operation, category, entities, scheduling semantics, and target identity.

The application validates and executes your output deterministically.
${activeActivitySummary}
${pendingSummary}

=== CRITICAL PRINCIPLES ===

1. UNDERSTAND MEANING, NOT JUST WORDS.
   - "tmrw", "tmr", "tomorow" → tomorrow
   - "mtg" → meeting, "appt" → appointment, "hr" → hour
   - "gotta", "needa", "wanna" → need to / want to
   - "gym tmr morning" → preferred_window activity tomorrow morning
   - Support natural, informal, abbreviated, mixed-language input.
   - If input is in a language other than English but semantically clear, extract intent normally.

2. SCHEDULING MODES — CRITICAL:
   - "fixed" → user stated an EXACT start time. E.g. "at 4 PM", "at 4:30".
   - "preferred_window" → user stated a TIME WINDOW but NOT an exact time. E.g. "morning", "afternoon", "evening", "after lunch".
   - "deadline" → user stated when something must be DONE/REACHED BY. E.g. "by 6", "be there by 10".
   - "flexible" → no time constraint given. E.g. "Study pathology".
   NEVER set mode="fixed" if the user only said "morning" or "evening" with no clock time.

3. DURATION RULES:
   - If user says "for 2 hours" → set durationMinutes: 120.
   - NEVER invent duration if user did not state one. Simply omit durationMinutes.
   - Do NOT assume meetings are 60 minutes unless stated.

4. ENTITY RULES:
   - Extract people from "with [PersonName]" patterns → entities.people: ["PersonName"].
   - Extract destination from "to [City/Place]" → entities.destination.
   - Extract location from "at [Place]" → entities.location.
   - NEVER use the current user's own name as an entity.
   - NEVER invent a person. Only extract explicitly stated names.

5. ACTIVITY IDENTITY RULES:
   - For update_activity, delete_activity, complete_activity, skip_activity:
     - If the active conversation ID is set, use it as "targetId".
     - Pronouns "it", "that", "this", "my meeting", "the meeting", "the appointment" refer to the active conversational activity.
     - Otherwise, use "targetQuery" to describe what the user is referring to.
   - NEVER create a new activity when the user is modifying an existing one.
   - NEVER duplicate an activity that was just created.

6. EXTERNAL ACTIONS:
   - "Book dinner with Rahul" → create_activity with executionRequirement: "booking". DO NOT claim it was booked.
   - "Get me a cab" → create_activity with executionRequirement: "transport". DO NOT claim transport was arranged.
   - "Email Dr Rao" → executionRequirement: "communication". DO NOT claim email was sent.
   - Always tell the user you will ATTEMPT or REQUEST this action, not that it was done.

7. NEGATION:
   - "Do NOT schedule gym" → do NOT create gym activity. Return context_statement or clarification.
   - "Never mind", "forget that", "cancel that" → cancel pending candidate if any, or clarify.

8. QUERIES NEVER MUTATE STATE:
   - "What's next?", "What am I doing tomorrow?", "Any free time?" → return get_schedule or get_free_time.
   - NEVER create an activity from a query.

9. AVAILABILITY STATEMENTS:
   - "I'm free tomorrow evening" → operation: "context_statement", title: "availability". Do NOT create a task.

10. GENERAL CONVERSATION:
    - For greetings, thanks, or small talk ("Hey", "Thanks", "Okay"), output "general_conversation" operation with a natural "conversationalResponse". DO NOT create activities.

11. INTERNAL vs EXTERNAL BOOKING:
    - "I have an appointment" / "I have dinner" → create_activity (INTERNAL EVENT).
    - "Book me an appointment" / "Book dinner" → create_activity with executionRequirement: "booking" (EXTERNAL).
    - Never treat "have" and "book" as the same.

12. Output ONLY a valid JSON object with the key "actions". No markdown, no code blocks, no prose.

=== DATE-AWARENESS RULES ===

User's current date and time (timezone: ${timezone}):
  - TODAY: ${currentDate}
  - TOMORROW: ${tomorrowDate}
  - Current time: ${currentTime}

RULES for the "date" field in scheduling:
1. "tomorrow" → "${tomorrowDate}"
2. "today" or "tonight" → "${currentDate}"
3. Day of week (e.g. "Monday") → calculate YYYY-MM-DD
4. No date stated → omit "date" or set null
5. ALWAYS use absolute YYYY-MM-DD. NEVER use relative strings like "tomorrow".

=== ALLOWED AI ACTIONS & SCHEMA ===

process_intent: (STRONGLY PREFERRED for all operations)
{
  "type": "process_intent",
  "payload": {
    "operation": "create_activity" | "update_activity" | "delete_activity" | "complete_activity" | "skip_activity" | "log_constraint" | "query_schedule" | "query_free_time" | "clarification" | "context_statement" | "general_conversation",
    "targetId"?: string,        // REQUIRED for update/delete/complete/skip when ID is known
    "targetQuery"?: string,     // Fallback description if targetId is not known
    "category"?: "task" | "event" | "meeting" | "social" | "travel" | "reminder",
    "title"?: string,
    "clarificationQuestion"?: string,  // For operation: "clarification"
    "conversationalResponse"?: string, // For operation: "general_conversation"
    "scheduling"?: {
      "mode": "flexible" | "fixed" | "deadline" | "preferred_window",
      "date"?: "YYYY-MM-DD",
      "startMinute"?: number,          // wall-clock minutes 0-1439 (e.g. 4 PM = 960)
      "endMinute"?: number,
      "deadlineMinute"?: number,       // for mode="deadline"
      "durationMinutes"?: number       // ONLY if user stated duration
    },
    "entities"?: {
      "people"?: string[],
      "location"?: string,
      "destination"?: string,
      "organization"?: string,
      "service"?: string,
      "provider"?: string
    },
    "priority"?: "low" | "medium" | "high",
    "executionRequirement"?: "booking" | "transport" | "communication"
  }
}

Legacy fallback actions (use process_intent instead when possible):
- create_task:  { "type": "create_task", "payload": { "title": string, "durationMinutes": number, "priority": "low"|"medium"|"high", "date"?: "YYYY-MM-DD", "scheduledStartMinute"?: number|null } }
- complete_task: { "type": "complete_task", "payload": { "taskTitleQuery": string } }
- skip_task:     { "type": "skip_task",     "payload": { "taskTitleQuery": string } }
- delete_task:   { "type": "delete_task",   "payload": { "taskTitleQuery": string } }
- update_task:   { "type": "update_task",   "payload": { "taskTitleQuery": string, "title"?: string, "durationMinutes"?: number, "priority"?: "low"|"medium"|"high", "date"?: string|null, "scheduledStartMinute"?: number|null } }
- replan_day:    { "type": "replan_day" }
- get_schedule:  { "type": "get_schedule",  "payload": { "date"?: string|null, "scope"?: "full"|"next" } }
- get_free_time: { "type": "get_free_time", "payload": { "date"?: string|null, "targetDurationMinutes"?: number|null, "targetTaskTitleQuery"?: string|null } }
- clarification: { "type": "clarification", "payload": { "question": string, "candidateAction"?: object } }

=== CLARIFICATION RULE ===

If the request is ambiguous, DO NOT GUESS. Return a "clarification" action with a polite question.
CRITICAL: If confirming a proposed activity ("Did you mean meeting with Narendra at 4 PM?"), include the complete proposed action as "candidateAction" inside the clarification payload.
Example: { "type": "clarification", "payload": { "question": "Did you mean...?", "candidateAction": { "type": "process_intent", "payload": { ... full payload ... } } } }

=== CURRENT APP CONTEXT ===

Today: ${currentDate} | Time: ${currentTime} | Timezone: ${timezone}

Existing activities:
${tasksSummary}

=== USER REQUEST ===

"${userMessage}"

=== EXAMPLE OUTPUT ===

{
  "actions": [
    { 
      "type": "process_intent", 
      "payload": { 
        "operation": "create_activity",
        "category": "social",
        "title": "Lunch with Rahul",
        "entities": { "people": ["Rahul"] },
        "scheduling": { "mode": "fixed", "date": "${tomorrowDate}", "startMinute": 780 }
      }
    }
  ]
}`;
}

async function callGemini(userMessage, context) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment or .env file.');
  }

  const promptText = buildSystemPrompt(userMessage, context);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: promptText }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response payload from Gemini API.');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Failed to parse Gemini JSON output: ${err.message}`);
  }

  if (!parsed || !Array.isArray(parsed.actions)) {
    throw new Error('Invalid JSON structure returned by Gemini: missing "actions" array.');
  }

  return parsed.actions;
}

async function callOpenAICompatible(providerName, apiKey, baseUrl, model, userMessage, context) {
  if (!apiKey) {
    throw new Error(`${providerName.toUpperCase()}_API_KEY is not set in environment or .env file.`);
  }

  const promptText = buildSystemPrompt(userMessage, context);
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${providerName} API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error(`Empty response payload from ${providerName} API.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Failed to parse ${providerName} JSON output: ${err.message}`);
  }

  if (!parsed || !Array.isArray(parsed.actions)) {
    throw new Error(`Invalid JSON structure returned by ${providerName}: missing "actions" array.`);
  }

  return parsed.actions;
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;

      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        settled = true;
        reject(new Error(`Audio upload exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`));
        req.resume();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });

    req.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

async function transcribeWithGroq(audioBuffer, contentType, filename) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set; voice transcription is unavailable.');
  }

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: contentType }), filename);
  form.append('model', GROQ_STT_MODEL);
  form.append('response_format', 'json');
  form.append('language', 'en');

  const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq transcription API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data || typeof data.text !== 'string' || !data.text.trim()) {
    throw new Error('Groq transcription API returned no text.');
  }

  return data.text.trim();
}

async function callProvider(userMessage, context) {
  switch (AI_PROVIDER) {
    case 'groq':
      return await callOpenAICompatible('groq', GROQ_API_KEY, GROQ_BASE_URL, GROQ_MODEL, userMessage, context);
    case 'qwen':
      return await callOpenAICompatible('qwen', QWEN_API_KEY, QWEN_BASE_URL, QWEN_MODEL, userMessage, context);
    case 'gemini':
    default:
      return await callGemini(userMessage, context);
  }
}

function getProviderConfig() {
  switch (AI_PROVIDER) {
    case 'groq':
      return {
        provider: 'groq',
        model: GROQ_MODEL,
        sttModel: GROQ_STT_MODEL,
        hasApiKey: Boolean(GROQ_API_KEY),
      };
    case 'qwen':
      return { provider: 'qwen', model: QWEN_MODEL, hasApiKey: Boolean(QWEN_API_KEY) };
    case 'gemini':
    default:
      return { provider: 'gemini', model: GEMINI_MODEL, hasApiKey: Boolean(GEMINI_API_KEY) };
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Audio-Filename');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Development Health Check Endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...getProviderConfig() }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/transcribe') {
    try {
      const contentType = req.headers['content-type'] || 'audio/m4a';
      const filename = req.headers['x-audio-filename'] || 'recording.m4a';
      const audioBuffer = await readRequestBody(req, 25 * 1024 * 1024);
      const text = await transcribeWithGroq(audioBuffer, contentType, filename);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, text }));
    } catch (error) {
      const errorMessage = error.message || String(error);
      const statusCode = errorMessage.includes('exceeds the') ? 413 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        errorType: 'TRANSCRIPTION_ERROR',
        error: errorMessage,
      }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/parse-intent') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const userMessage = payload.userMessage;
        const context = payload.context;

        if (!userMessage || typeof userMessage !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing userMessage parameter.' }));
          return;
        }

        const actions = await callProvider(userMessage, context);

        const pendingCtx = context?.pendingClarification;

        // Context Injection: ensure taskId & taskTitleQuery are populated from pending context if missing
        const activeActivityId = context?.activeActivityId;
        if (Array.isArray(actions)) {
          for (const act of actions) {
            // Legacy action type injection from pending clarification context
            if (pendingCtx && ['update_task', 'complete_task', 'skip_task', 'delete_task'].includes(act.type)) {
              if (!act.payload) act.payload = {};
              if (!act.payload.taskId && pendingCtx.taskId) {
                act.payload.taskId = pendingCtx.taskId;
              }
              if (!act.payload.taskTitleQuery && (pendingCtx.taskTitle || pendingCtx.taskTitleQuery)) {
                act.payload.taskTitleQuery = pendingCtx.taskTitle || pendingCtx.taskTitleQuery;
              }
            }
            // process_intent: inject targetId from active activity if missing
            if (act.type === 'process_intent' && act.payload) {
              const op = act.payload.operation;
              const needsTarget = ['update_activity', 'delete_activity', 'complete_activity', 'skip_activity'].includes(op);
              if (needsTarget && !act.payload.targetId) {
                // Use active conversational activity ID if available
                if (activeActivityId) {
                  act.payload.targetId = activeActivityId;
                } else if (pendingCtx?.taskId) {
                  act.payload.targetId = pendingCtx.taskId;
                }
              }
              // Inject targetQuery from pending context title if still missing
              if (needsTarget && !act.payload.targetId && !act.payload.targetQuery) {
                if (pendingCtx?.taskTitle || pendingCtx?.taskTitleQuery) {
                  act.payload.targetQuery = pendingCtx.taskTitle || pendingCtx.taskTitleQuery;
                }
              }
            }
          }
        }

        let pendingClarification = null;
        if (actions.length > 0 && actions[0].type === 'clarification') {
          const clarificationPayload = actions[0].payload;
          if (clarificationPayload && clarificationPayload.candidateAction) {
             pendingClarification = {
                pendingIntent: clarificationPayload.candidateAction.type,
                candidateAction: clarificationPayload.candidateAction,
                question: clarificationPayload.question,
             };
          } else if (pendingCtx) {
            pendingClarification = pendingCtx;
          } else if (context?.tasks && Array.isArray(context.tasks)) {
            const msgLower = (userMessage + ' ' + (clarificationPayload?.question || '')).toLowerCase();
            const matched = context.tasks.find((t) => {
              const tLower = t.title.toLowerCase();
              const words = tLower.split(/\s+/).filter((w) => w.length > 3);
              return msgLower.includes(tLower) || words.some((w) => msgLower.includes(w));
            });
            if (matched) {
              pendingClarification = {
                pendingIntent: 'update_task',
                taskId: matched.id,
                taskTitle: matched.title,
                taskTitleQuery: matched.title,
                date: null,
                scheduledStartMinute: null,
                missingFields: ['date', 'time'],
              };
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, actions, pendingClarification, mode: 'real_ai', provider: AI_PROVIDER }));
      } catch (error) {
        const errorMessage = error.message || String(error);
        const isProviderErr = /API error/i.test(errorMessage);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          errorType: isProviderErr ? 'PROVIDER_API_ERROR' : 'SERVER_ERROR',
          provider: AI_PROVIDER,
          error: errorMessage,
        }));
      }
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Endpoint not found.' }));
});

// Bind to 0.0.0.0 so server listens on LAN and localhost
server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  const config = getProviderConfig();
  console.log(`\n==================================================`);
  console.log(`[Life OS AI Backend] Server running on port ${PORT}`);
  console.log(`[Life OS AI Backend] Provider: ${config.provider}`);
  console.log(`[Life OS AI Backend] Configured Model: ${config.model}`);
  console.log(`[Life OS AI Backend] API Key Set: ${config.hasApiKey ? 'YES' : `NO (Set ${config.provider.toUpperCase()}_API_KEY in .env)`}`);
  console.log(`[Life OS AI Backend] Health check: http://localhost:${PORT}/health`);
  console.log(`--------------------------------------------------`);
  console.log(`Reachable IP Addresses for Physical Device Testing:`);
  console.log(`- Localhost / Emulator: http://10.0.2.2:${PORT}`);
  localIps.forEach((ip) => {
    console.log(`- LAN (Physical Device): http://${ip}:${PORT}`);
  });
  console.log(`==================================================\n`);
});
