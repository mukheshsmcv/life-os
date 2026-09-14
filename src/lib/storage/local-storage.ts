import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Task, Event } from '@/contexts/tasks-context';
import { STORAGE_KEY, CURRENT_STORAGE_VERSION, StorageState } from './types';

const isWebServer = Platform.OS === 'web' && typeof document === 'undefined';

function isValidTask(task: unknown): task is Task {
  if (!task || typeof task !== 'object') return false;
  const t = task as Record<string, unknown>;
  if (typeof t.id !== 'string' || !t.id) return false;
  if (typeof t.title !== 'string' || !t.title) return false;
  if (typeof t.durationMinutes !== 'number' || t.durationMinutes <= 0) return false;
  if (!['low', 'medium', 'high'].includes(t.priority as string)) return false;
  if (!['pending', 'completed', 'skipped'].includes(t.status as string)) return false;
  if (t.scheduledStartMinute !== null && t.scheduledStartMinute !== undefined) {
    if (typeof t.scheduledStartMinute !== 'number' || t.scheduledStartMinute < 0 || t.scheduledStartMinute > 1439) {
      return false;
    }
  }
  if (t.date !== undefined && t.date !== null) {
    if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
      return false;
    }
  }
  return true;
}

function isValidEvent(event: unknown): event is Event {
  if (!event || typeof event !== 'object') return false;
  const e = event as Record<string, unknown>;
  if (typeof e.id !== 'string' || !e.id) return false;
  if (typeof e.title !== 'string' || !e.title) return false;
  if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return false;
  if (typeof e.startMinute !== 'number' || e.startMinute < 0 || e.startMinute > 1439) return false;
  if (typeof e.endMinute !== 'number' || e.endMinute < 0 || e.endMinute > 1439) return false;
  if (e.notes !== undefined && e.notes !== null && typeof e.notes !== 'string') return false;
  return true;
}

export async function loadStorageState(): Promise<{ tasks: Task[]; events: Event[] } | null> {
  if (isWebServer) return null;

  try {
    const jsonStr = await AsyncStorage.getItem(STORAGE_KEY);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;

    const { version, tasks, events } = parsed as Partial<StorageState>;
    if (typeof version !== 'number' || version < 1) return null;
    if (!Array.isArray(tasks) || !Array.isArray(events)) return null;

    const validTasks: Task[] = [];
    for (const t of tasks) {
      if (isValidTask(t)) {
        validTasks.push({
          id: t.id,
          title: t.title,
          durationMinutes: t.durationMinutes,
          priority: t.priority,
          status: t.status,
          scheduledStartMinute: t.scheduledStartMinute ?? null,
          date: t.date ?? null,
          scheduling: t.scheduling || { mode: 'flexible', date: t.date ?? null, startMinute: t.scheduledStartMinute ?? null },
          entities: t.entities,
          executionRequirement: t.executionRequirement,
        });
      }
    }

    const validEvents: Event[] = [];
    for (const e of events) {
      if (isValidEvent(e)) {
        validEvents.push({
          id: e.id,
          title: e.title,
          date: e.date,
          startMinute: e.startMinute,
          endMinute: e.endMinute,
          notes: e.notes ?? undefined,
          scheduling: e.scheduling || { mode: 'fixed', date: e.date, startMinute: e.startMinute, endMinute: e.endMinute },
          entities: e.entities,
          executionRequirement: e.executionRequirement,
        });
      }
    }

    return { tasks: validTasks, events: validEvents };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[LocalStorage] Failed to load storage state:', error);
    }
    return null;
  }
}

export async function saveStorageState(tasks: Task[], events: Event[]): Promise<boolean> {
  if (isWebServer) return true;

  try {
    const payload: StorageState = {
      version: CURRENT_STORAGE_VERSION,
      tasks,
      events,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[LocalStorage] Failed to save storage state:', error);
    }
    return false;
  }
}
