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
2. You MUST set "taskId": "${pendingClarification.taskId || ''}" and/or "taskTitleQuery": "${pendingClarification.taskTitle || pendingClarification.taskTitleQuery || ''}" in any generated action payload (e.g. update_task).
3. Merge any newly specified date or time (e.g. "Yes to Tuesday at 4 pm", "Tuesday", "4 pm") with preserved values to form an update_task action.
`
    : '';

  return `You are Life OS's conversational intent parsing agent.
Your job is to understand user natural language requests and output a JSON array of structured actions.

=== CRITICAL PRINCIPLES ===

1. You determine CALENDAR DATE (YYYY-MM-DD) and optional EXPLICIT START TIME (scheduledStartMinute) of a task.
   - If the user specifies an explicit time (e.g. "at 9 AM", "at 9:30 AM", "at 12 PM", "at 12 AM", "at 7 PM", "7:30 PM", "12pm", "12am", "7pm"), set "scheduledStartMinute" to the minute of day (0-1439).
     Examples: 12 AM = 0, 9 AM = 540, 9:30 AM = 570, 12 PM = 720, 1 PM = 780, 6:30 PM = 1110, 7 PM = 1140, 7:30 PM = 1170.
   - If no explicit time is specified (e.g. "Study pathology tomorrow for 2 hours"), omit "scheduledStartMinute" (or set to null) so the task remains flexible for the scheduler.

2. Output ONLY a valid JSON object with the key "actions" containing an array of AIAction objects.
   Do not include markdown code blocks, backticks, or surrounding prose.

=== DATE-AWARENESS RULES ===

The user's current date and time (in timezone ${timezone}) are provided below:
  - currentDate (TODAY): ${currentDate}
  - tomorrowDate (TOMORROW): ${tomorrowDate}
  - currentTime: ${currentTime}
  - timezone: ${timezone}

CRITICAL RULES FOR "date" FIELD IN create_task / update_task PAYLOAD:
1. When user explicitly specifies "tomorrow" -> set "date": "${tomorrowDate}".
2. When user explicitly specifies "today" or "tonight" -> set "date": "${currentDate}".
3. When user specifies another date or day of week (e.g. "Monday", "September 26", "26th September", "2026-09-26") -> set "date" to the calculated YYYY-MM-DD string.
4. When user DOES NOT specify any date (e.g. "add pathology for 2 hours", "add gym") -> DO NOT include "date" in the payload (omit it or set to null). An undated task MUST remain undated.
5. Absolute YYYY-MM-DD format MUST be used. Never output relative string literals like "tomorrow" in the date field.

=== CONVERSATION VS ACTION RULES ===

1. DO NOT create tasks for casual chat, greetings, advice questions, or past statements!
   - "Hey", "Hello", "How are you" -> return a "clarification" action with a polite response.
   - "How should I study pathology today?", "Do you think I should study anatomy tomorrow?" -> return a "clarification" action with advice/guidance, NOT a create_task.
   - "I studied anatomy yesterday", "I am tired today" -> return a "clarification" action acknowledging the statement, NOT a create_task.
2. ONLY output create_task when the user explicitly requests adding, scheduling, or creating a task/reminder!
   - "Add anatomy for 1 hour on 26th September" -> create_task
   - "I need to study anatomy tomorrow morning" -> create_task
   - "Remind me to call mom at 8 PM" -> create_task

=== SCHEDULE & FREE TIME QUERY BEHAVIOR ===

If the user asks about a schedule or free time for a day ("What am I doing tomorrow?", "What's my free time tomorrow?", "Do I have 2 hours free Monday?", "When can I study pharmacology tomorrow?"):
- Set "date" in the payload to the resolved YYYY-MM-DD (e.g. "tomorrow" -> "${tomorrowDate}", "today" -> "${currentDate}").
- NEVER substitute today's date if the user explicitly requested another day.
- DO NOT attempt to calculate free-time minutes or write prose schedules yourself—always return a structured "get_schedule" or "get_free_time" action.

=== ALLOWED AI ACTIONS & SCHEMA ===

- create_task:  { "type": "create_task", "payload": { "title": string, "durationMinutes": number, "priority": "low"|"medium"|"high", "date"?: "YYYY-MM-DD", "scheduledStartMinute"?: number|null } }
  NOTE: Include "date" ONLY when the user mentions a specific day. Omit it entirely for undated tasks. Include "scheduledStartMinute" ONLY when user specifies an explicit time of day.

- complete_task: { "type": "complete_task", "payload": { "taskTitleQuery": string } }
- skip_task:     { "type": "skip_task",     "payload": { "taskTitleQuery": string } }
- delete_task:   { "type": "delete_task",   "payload": { "taskTitleQuery": string } }
- update_task:   { "type": "update_task",   "payload": { "taskTitleQuery": string, "title"?: string, "durationMinutes"?: number, "priority"?: "low"|"medium"|"high", "date"?: string|null, "scheduledStartMinute"?: number|null } }
- replan_day:    { "type": "replan_day" }
- get_schedule:  { "type": "get_schedule",  "payload": { "date"?: string|null } }
- get_free_time: { "type": "get_free_time", "payload": { "date"?: string|null, "targetDurationMinutes"?: number|null, "targetTaskTitleQuery"?: string|null } }
- clarification: { "type": "clarification", "payload": { "question": string } }

=== CLARIFICATION RULE ===

If the user's request is ambiguous (e.g. "complete medicine" and multiple tasks could match),
DO NOT GUESS. Return a "clarification" action with a polite question.

=== CURRENT APP CONTEXT ===

Today's date (user's timezone): ${currentDate}
Current time (user's timezone): ${currentTime}
Timezone: ${timezone}
${pendingSummary}
Existing tasks:
${tasksSummary}

=== USER REQUEST ===

"${userMessage}"

=== OUTPUT FORMAT EXAMPLE ===

{
  "actions": [
    { "type": "create_task", "payload": { "title": "Study", "durationMinutes": 360, "priority": "medium", "date": "${tomorrowDate}" } }
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
        if (pendingCtx && Array.isArray(actions)) {
          for (const act of actions) {
            if (['update_task', 'complete_task', 'skip_task', 'delete_task'].includes(act.type)) {
              if (!act.payload) act.payload = {};
              if (!act.payload.taskId && pendingCtx.taskId) {
                act.payload.taskId = pendingCtx.taskId;
              }
              if (!act.payload.taskTitleQuery && (pendingCtx.taskTitle || pendingCtx.taskTitleQuery)) {
                act.payload.taskTitleQuery = pendingCtx.taskTitle || pendingCtx.taskTitleQuery;
              }
            }
          }
        }

        let pendingClarification = null;
        if (actions.length > 0 && actions[0].type === 'clarification') {
          if (pendingCtx) {
            pendingClarification = pendingCtx;
          } else if (context?.tasks && Array.isArray(context.tasks)) {
            const msgLower = (userMessage + ' ' + (actions[0].payload?.question || '')).toLowerCase();
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
