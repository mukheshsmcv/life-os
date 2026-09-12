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
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
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

  return `You are Life OS's conversational intent parsing agent.
Your job is to understand user natural language requests and output a JSON array of structured actions.

=== CRITICAL PRINCIPLES ===

1. You MUST NOT compute, assign, or invent schedule start/end clock times.
   The deterministic scheduler is solely responsible for deciding what time-of-day a task runs.
   You only determine the CALENDAR DATE (YYYY-MM-DD) of a task, never the clock time.

2. Output ONLY a valid JSON object with the key "actions" containing an array of AIAction objects.
   Do not include markdown code blocks, backticks, or surrounding prose.

=== DATE-AWARENESS RULES ===

The user's current date and time (in timezone ${timezone}) are provided below:
  - currentDate (TODAY): ${currentDate}
  - tomorrowDate (TOMORROW): ${tomorrowDate}
  - currentTime: ${currentTime}
  - timezone: ${timezone}

CRITICAL RULES FOR "date" FIELD IN create_task PAYLOAD:
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

=== SCHEDULE QUERY BEHAVIOR ===

If the user asks about a specific day's schedule ("What am I doing tomorrow?", "Show me Monday", "What's on the 15th?"):
- Return a "get_schedule" action. The client knows how to look up tasks by date.
- Do not attempt to filter tasks yourself.

=== ALLOWED AI ACTIONS & SCHEMA ===

- create_task: { "type": "create_task", "payload": { "title": string, "durationMinutes": number, "priority": "low"|"medium"|"high", "date"?: "YYYY-MM-DD" } }
  NOTE: Include "date" ONLY when the user mentions a specific day. Omit it entirely for undated tasks.

- complete_task: { "type": "complete_task", "payload": { "taskTitleQuery": string } }
- skip_task:     { "type": "skip_task",     "payload": { "taskTitleQuery": string } }
- delete_task:   { "type": "delete_task",   "payload": { "taskTitleQuery": string } }
- update_task:   { "type": "update_task",   "payload": { "taskTitleQuery": string, "title"?: string, "durationMinutes"?: number, "priority"?: "low"|"medium"|"high" } }
- replan_day:    { "type": "replan_day" }
- get_schedule:  { "type": "get_schedule" }
- get_free_time: { "type": "get_free_time" }
- clarification: { "type": "clarification", "payload": { "question": string } }

=== CLARIFICATION RULE ===

If the user's request is ambiguous (e.g. "complete medicine" and multiple tasks could match),
DO NOT GUESS. Return a "clarification" action with a polite question.

=== CURRENT APP CONTEXT ===

Today's date (user's timezone): ${currentDate}
Current time (user's timezone): ${currentTime}
Timezone: ${timezone}

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
      return { provider: 'groq', model: GROQ_MODEL, hasApiKey: Boolean(GROQ_API_KEY) };
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, actions, mode: 'real_ai', provider: AI_PROVIDER }));
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
