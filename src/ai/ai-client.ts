import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Task } from '@/contexts/tasks-context';
import { AIAction, ParseIntentResult } from './ai-types';
import { parseIntent as mockParseIntent } from './mock-intent-parser';
import { getTodayString, getCurrentTimeStringIST } from '@/lib/date-time';

export type AIParseContext = {
  tasks: Task[];
  currentDate?: string;
  currentTime?: string;
  timezone?: string;
  pendingClarification?: import('./ai-types').PendingClarification | null;
  activeActivityId?: string | null;
  currentStateSnapshot?: import('@/lib/current-state').CurrentStateSnapshot;
};

/**
 * Dynamically resolves the development server base URL:
 * 1. process.env.EXPO_PUBLIC_AI_SERVER_URL (explicit complete URL, e.g., "http://192.168.1.10:3001")
 * 2. process.env.EXPO_PUBLIC_DEV_SERVER_IP (explicit IP, e.g., "192.168.1.10")
 * 3. Constants.expoConfig?.hostUri (automatically extracts PC LAN IP when testing on physical phone via Expo Go)
 * 4. 10.0.2.2:3001 for Android Emulator / localhost:3001 for Web/iOS Simulator.
 */
export function getDevServerBaseUrl(): string {
  // 1. Dynamic resolution from Expo Metro bundler connection (most reliable on physical phone via Expo Go / Dev Client)
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost || (Constants as any).experienceUrl;
  if (hostUri && typeof hostUri === 'string' && hostUri.includes(':')) {
    const pcIp = hostUri.split(':')[0];
    if (pcIp && pcIp !== 'localhost' && pcIp !== '127.0.0.1') {
      return `http://${pcIp}:3001`;
    }
  }

  // 2. Explicit complete URL configured in .env (e.g., "http://192.168.1.3:3001")
  if (process.env.EXPO_PUBLIC_AI_SERVER_URL) {
    return process.env.EXPO_PUBLIC_AI_SERVER_URL.replace(/\/$/, '');
  }

  // 3. Explicit dev server IP configured in .env
  const explicitIp = process.env.EXPO_PUBLIC_DEV_SERVER_IP;
  if (explicitIp) {
    return `http://${explicitIp.trim()}:3001`;
  }

  const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${defaultHost}:3001`;
}

export async function parseIntentWithAI(
  userMessage: string,
  context: AIParseContext
): Promise<ParseIntentResult> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return { success: false, error: 'Please enter a message.' };
  }

  const currentDateStr = context.currentDate ?? getTodayString();
  const currentTimeStr = context.currentTime ?? getCurrentTimeStringIST();
  const timezone = context.timezone ?? 'Asia/Kolkata';
  const serverBaseUrl = getDevServerBaseUrl();
  const endpoint = `${serverBaseUrl}/api/parse-intent`;

  // --- CONFIRMATION BYPASS LOGIC ---
  if (context.pendingClarification?.candidateAction) {
    const isPureConfirmation = /^(yes|yeah|correct|yep|sure|that's right|exactly|do it|ok|okay)\b/i.test(trimmed) &&
      !/(but|instead|change|make it|move|no\b)/i.test(trimmed);

    if (isPureConfirmation) {
      return {
        success: true,
        actions: [context.pendingClarification.candidateAction],
        pendingClarification: null,
        mode: 'real_ai',
        notice: '✓ Confirmation received. Applying previous intent.',
      };
    }
    
    const isPureRejection = /^(no|nope|cancel|stop|nevermind|don't)\b/i.test(trimmed) &&
      !/(mean|meant|instead|make it|change)/i.test(trimmed);
      
    if (isPureRejection) {
       return {
         success: false,
         error: 'Action cancelled.',
         pendingClarification: null,
         mode: 'real_ai'
       };
    }
  }
  // ---------------------------------

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        userMessage: trimmed,
        context: {
          tasks: context.tasks,
          currentDate: currentDateStr,
          currentTime: currentTimeStr,
          timezone,
          pendingClarification: context.pendingClarification ?? null,
          activeActivityId: context.activeActivityId ?? null,
          currentStateSnapshot: context.currentStateSnapshot ?? null,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const isGeminiErr = errorData.errorType === 'GEMINI_API_ERROR';
      const category = isGeminiErr ? '[GEMINI_API_ERROR]' : '[HTTP_ERROR]';
      const serverErr = errorData.error || `HTTP ${response.status}`;

      console.warn(`${category} Server error at ${endpoint}: ${serverErr}`);

      const mockResult = mockParseIntent(trimmed, context);
      return {
        ...mockResult,
        mode: 'mock_fallback',
        notice: `⚡ AI backend error (${serverErr}) — using basic command mode.`,
      };
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr: any) {
      console.warn(`[MALFORMED_RESPONSE] Could not parse JSON from ${endpoint}: ${parseErr.message}`);
      const mockResult = mockParseIntent(trimmed, context);
      return {
        ...mockResult,
        mode: 'mock_fallback',
        notice: `⚡ AI backend returned malformed response — using basic command mode.`,
      };
    }

    if (data && data.success && Array.isArray(data.actions)) {
      return {
        success: true,
        actions: data.actions as AIAction[],
        pendingClarification: data.pendingClarification ?? null,
        mode: 'real_ai',
      };
    }

    console.warn(`[MALFORMED_RESPONSE] Server returned missing/invalid "actions" array:`, data);
    const mockResult = mockParseIntent(trimmed, context);
    return {
      ...mockResult,
      mode: 'mock_fallback',
      notice: `⚡ AI response schema mismatch — using basic command mode.`,
    };
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError';
    const reason = isTimeout ? 'Request timed out' : 'Server unreachable / network offline';

    console.warn(`[SERVER_UNREACHABLE] Could not connect to AI backend at ${endpoint}: ${reason}`);

    const mockResult = mockParseIntent(trimmed, context);
    return {
      ...mockResult,
      mode: 'mock_fallback',
      notice: `⚡ AI server offline at ${serverBaseUrl} — using basic command mode.`,
    };
  }
}
