import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Event, Task } from '@/contexts/tasks-context';
import { getTodayString } from '@/lib/date-time';
import { DEFAULT_SCHEDULING_SETTINGS, ScheduledBlock, scheduleTasks } from '@/lib/scheduler';

// ─── Types & Constants ────────────────────────────────────────────────────────

export type NotificationKind =
  | 'activity_start'
  | 'activity_upcoming'
  | 'reminder'
  | 'deadline';

export const NOTIFICATION_CHANNEL_ID = 'life-os-default';
export const DEFAULT_LEAD_TIME_MINUTES = 5;

export type ScheduledTarget = {
  id: string; // deterministic ID: lifeos_${activityId}_${kind}
  activityId: string;
  activityTitle: string;
  activityKind: 'task' | 'event';
  notificationKind: NotificationKind;
  triggerDate: Date;
  title: string;
  body: string;
};

export type NotificationSyncResult = {
  scheduled: string[];
  cancelled: string[];
  kept: string[];
};

export type LifeOSNotificationData = {
  lifeos: true;
  activityId: string;
  activityKind: 'task' | 'event';
  notificationKind: NotificationKind;
  triggerTimestamp: number;
};

// ─── Pending Activity Navigation Store ──────────────────────────────────────

let pendingActivityId: string | null = null;
let lastHandledResponseIdentifier: string | null = null;
let lastHandledTimestamp = 0;
const pendingActivityListeners = new Set<(activityId: string | null) => void>();

export function getPendingActivityId(): string | null {
  return pendingActivityId;
}

export function setPendingActivityId(activityId: string | null): void {
  pendingActivityId = activityId;
  pendingActivityListeners.forEach((listener) => {
    try {
      listener(pendingActivityId);
    } catch (err) {
      if (__DEV__) {
        console.warn('[Notifications] Error in pendingActivityListener:', err);
      }
    }
  });
}

export function consumePendingActivityId(): string | null {
  const id = pendingActivityId;
  pendingActivityId = null;
  return id;
}

export function subscribePendingActivity(listener: (activityId: string | null) => void): () => void {
  pendingActivityListeners.add(listener);
  return () => {
    pendingActivityListeners.delete(listener);
  };
}

export function isLifeOSNotificationData(data: any): data is LifeOSNotificationData {
  return Boolean(
    data &&
    typeof data === 'object' &&
    data.lifeos === true &&
    typeof data.activityId === 'string' &&
    data.activityId.trim().length > 0
  );
}

export function handleNotificationResponse(response: Notifications.NotificationResponse | null | undefined): {
  handled: boolean;
  activityId?: string;
  reason?: string;
} {
  if (!response || !response.notification || !response.notification.request) {
    return { handled: false, reason: 'no_response' };
  }

  const identifier = response.notification.request.identifier;
  const now = Date.now();

  // Deduplicate repeated responses with identical identifier within 2.5 seconds
  if (identifier && lastHandledResponseIdentifier === identifier && (now - lastHandledTimestamp) < 2500) {
    return { handled: false, reason: 'duplicate_response' };
  }

  const data = response.notification.request.content?.data;
  if (!isLifeOSNotificationData(data)) {
    return { handled: false, reason: 'not_life_os' };
  }

  lastHandledResponseIdentifier = identifier;
  lastHandledTimestamp = now;
  setPendingActivityId(data.activityId);

  return {
    handled: true,
    activityId: data.activityId,
  };
}

export function resetNotificationInteractionStateForTesting(): void {
  pendingActivityId = null;
  lastHandledResponseIdentifier = null;
  lastHandledTimestamp = 0;
  pendingActivityListeners.clear();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildNotificationId(activityId: string, kind: NotificationKind): string {
  return `lifeos_${activityId}_${kind}`;
}

export function isLifeOSNotificationId(id: string): boolean {
  return id.startsWith('lifeos_');
}

export function formatTimeDisplay(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  const displayMinutes = String(m).padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
}

export function wallClockToDate(dateStr: string, minute: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return new Date(y, m - 1, d, hours, mins, 0, 0);
}

// ─── Channel & Handler Initialization ────────────────────────────────────────

export async function initNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Space Time Schedule',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#A7A0FF',
      });
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[Notifications] Failed to init notifications:', error);
    }
  }
}

// ─── Permission Management ───────────────────────────────────────────────────

export async function getNotificationPermissionStatusAsync(): Promise<Notifications.PermissionStatus> {
  if (Platform.OS === 'web') return Notifications.PermissionStatus.DENIED;
  try {
    const permissions = await Notifications.getPermissionsAsync();
    return permissions.status;
  } catch {
    return Notifications.PermissionStatus.UNDETERMINED;
  }
}

export async function isNotificationEnabledAsync(): Promise<boolean> {
  const status = await getNotificationPermissionStatusAsync();
  return status === Notifications.PermissionStatus.GRANTED;
}

export async function requestNotificationPermissionAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === Notifications.PermissionStatus.GRANTED) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === Notifications.PermissionStatus.GRANTED;
  } catch {
    return false;
  }
}

// ─── Target Computation (Pure Function) ──────────────────────────────────────

export function computeScheduleNotificationTargets(params: {
  tasks: Task[];
  events: Event[];
  todayScheduleBlocks?: ScheduledBlock[];
  now?: Date;
  todayDateStr?: string;
  leadTimeMinutes?: number;
}): ScheduledTarget[] {
  const now = params.now ?? new Date();
  const todayDateStr = params.todayDateStr ?? getTodayString();
  const leadTimeMinutes = params.leadTimeMinutes ?? DEFAULT_LEAD_TIME_MINUTES;
  const targets: ScheduledTarget[] = [];

  // Map today's scheduled blocks by task id
  const scheduledBlockMap = new Map<string, ScheduledBlock>();
  if (params.todayScheduleBlocks) {
    for (const b of params.todayScheduleBlocks) {
      if (!b.taskId.startsWith('event-')) {
        scheduledBlockMap.set(b.taskId, b);
      }
    }
  }

  // 1. Process Events
  for (const ev of params.events) {
    const evDate = ev.scheduling?.date || ev.date;
    const startM = ev.scheduling?.startMinute ?? ev.startMinute;
    if (!evDate || startM == null || startM < 0) continue;

    const startDate = wallClockToDate(evDate, startM);
    const durM = ev.scheduling?.durationMinutes ?? (ev.endMinute - startM);
    const timeStr = formatTimeDisplay(startM);

    // Start notification
    if (startDate.getTime() > now.getTime()) {
      if (__DEV__) {
        console.log(`[NOTIFICATION_TARGET]\nactivityId=${ev.id}\nkind=activity_start\nactivityStart=${startDate.toISOString()}\ntrigger=${startDate.toISOString()}\nminutesBeforeStart=0`);
      }
      targets.push({
        id: buildNotificationId(ev.id, 'activity_start'),
        activityId: ev.id,
        activityTitle: ev.title,
        activityKind: 'event',
        notificationKind: 'activity_start',
        triggerDate: startDate,
        title: `Now: ${ev.title}`,
        body: `Event scheduled for ${timeStr} (${durM > 0 ? durM : 60}m)`,
      });
    }

    // Upcoming notification
    if (leadTimeMinutes > 0) {
      const upcomingDate = new Date(startDate.getTime() - leadTimeMinutes * 60000);
      if (upcomingDate.getTime() > now.getTime()) {
        if (__DEV__) {
          console.log(`[NOTIFICATION_TARGET]\nactivityId=${ev.id}\nkind=activity_upcoming\nactivityStart=${startDate.toISOString()}\ntrigger=${upcomingDate.toISOString()}\nminutesBeforeStart=${leadTimeMinutes}`);
        }
        targets.push({
          id: buildNotificationId(ev.id, 'activity_upcoming'),
          activityId: ev.id,
          activityTitle: ev.title,
          activityKind: 'event',
          notificationKind: 'activity_upcoming',
          triggerDate: upcomingDate,
          title: `Starting in ${leadTimeMinutes} minutes: ${ev.title}`,
          body: `Starts at ${timeStr}`,
        });
      }
    }
  }

  // 2. Process Tasks
  for (const task of params.tasks) {
    // Only pending tasks receive future notifications. Completed/skipped are strictly ignored.
    if (task.status !== 'pending') continue;

    const taskDate = task.scheduling?.date || task.date;
    const isTodayOrUndated = !taskDate || taskDate === todayDateStr;

    let startMinute: number | null = null;
    let resolvedDateStr = taskDate;

    if (isTodayOrUndated) {
      resolvedDateStr = todayDateStr;
      const scheduledBlock = scheduledBlockMap.get(task.id);
      if (scheduledBlock) {
        startMinute = scheduledBlock.startMinute;
      } else {
        startMinute = task.scheduling?.startMinute ?? task.scheduledStartMinute ?? null;
      }
    } else {
      // Future day
      startMinute = task.scheduling?.startMinute ?? task.scheduledStartMinute ?? null;
    }

    if (startMinute == null || startMinute < 0 || !resolvedDateStr) {
      // Flexible task without concrete scheduled time -> do not schedule notification
      continue;
    }

    const startDate = wallClockToDate(resolvedDateStr, startMinute);
    const timeStr = formatTimeDisplay(startMinute);
    const durM = task.durationMinutes || 30;

    // Start notification
    if (startDate.getTime() > now.getTime()) {
      if (__DEV__) {
        console.log(`[NOTIFICATION_TARGET]\nactivityId=${task.id}\nkind=activity_start\nactivityStart=${startDate.toISOString()}\ntrigger=${startDate.toISOString()}\nminutesBeforeStart=0`);
      }
      targets.push({
        id: buildNotificationId(task.id, 'activity_start'),
        activityId: task.id,
        activityTitle: task.title,
        activityKind: 'task',
        notificationKind: 'activity_start',
        triggerDate: startDate,
        title: `Now: ${task.title}`,
        body: `Scheduled for ${timeStr} (${durM}m)`,
      });
    }

    // Upcoming notification
    if (leadTimeMinutes > 0) {
      const upcomingDate = new Date(startDate.getTime() - leadTimeMinutes * 60000);
      if (upcomingDate.getTime() > now.getTime()) {
        if (__DEV__) {
          console.log(`[NOTIFICATION_TARGET]\nactivityId=${task.id}\nkind=activity_upcoming\nactivityStart=${startDate.toISOString()}\ntrigger=${upcomingDate.toISOString()}\nminutesBeforeStart=${leadTimeMinutes}`);
        }
        targets.push({
          id: buildNotificationId(task.id, 'activity_upcoming'),
          activityId: task.id,
          activityTitle: task.title,
          activityKind: 'task',
          notificationKind: 'activity_upcoming',
          triggerDate: upcomingDate,
          title: `Starting in ${leadTimeMinutes} minutes: ${task.title}`,
          body: `Starts at ${timeStr}`,
        });
      }
    }
  }

  return targets;
}

// ─── Notification Operations ─────────────────────────────────────────────────

export async function cancelNotificationAsync(identifier: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    if (__DEV__) {
      console.warn(`[Notifications] Failed to cancel notification ${identifier}:`, error);
    }
  }
}

export async function cancelActivityNotificationsAsync(activityId: string): Promise<void> {
  await Promise.all([
    cancelNotificationAsync(buildNotificationId(activityId, 'activity_start')),
    cancelNotificationAsync(buildNotificationId(activityId, 'activity_upcoming')),
    cancelNotificationAsync(buildNotificationId(activityId, 'reminder')),
    cancelNotificationAsync(buildNotificationId(activityId, 'deadline')),
  ]);
}

export async function cancelAllLifeOSNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const lifeOSRequests = scheduled.filter(req => isLifeOSNotificationId(req.identifier));
    await Promise.all(lifeOSRequests.map(req => Notifications.cancelScheduledNotificationAsync(req.identifier)));
  } catch (error) {
    if (__DEV__) {
      console.warn('[Notifications] Failed to cancel all Space Time notifications:', error);
    }
  }
}

export async function scheduleSingleNotificationAsync(target: ScheduledTarget): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      identifier: target.id,
      content: {
        title: target.title,
        body: target.body,
        sound: true,
        data: {
          lifeos: true,
          activityId: target.activityId,
          activityKind: target.activityKind,
          notificationKind: target.notificationKind,
          triggerTimestamp: target.triggerDate.getTime(),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target.triggerDate,
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });
    return id;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[Notifications] Failed to schedule notification ${target.id}:`, error);
    }
    return null;
  }
}

// ─── Schedule Synchronization ────────────────────────────────────────────────

export async function syncScheduleNotifications(params: {
  tasks: Task[];
  events: Event[];
  todayScheduleBlocks?: ScheduledBlock[];
  now?: Date;
  leadTimeMinutes?: number;
}): Promise<NotificationSyncResult> {
  const result: NotificationSyncResult = {
    scheduled: [],
    cancelled: [],
    kept: [],
  };

  if (Platform.OS === 'web') return result;

  const isEnabled = await isNotificationEnabledAsync();
  if (!isEnabled) {
    // If not enabled/permission denied, do not attempt to schedule
    return result;
  }

  const now = params.now ?? new Date();
  const todayDateStr = getTodayString();

  // If todayScheduleBlocks wasn't passed, derive it via the deterministic scheduler
  let scheduleBlocks = params.todayScheduleBlocks;
  if (!scheduleBlocks) {
    const todayEvents = params.events.filter(e => (e.scheduling?.date || e.date) === todayDateStr);
    const todayTasks = params.tasks.filter(t => {
      const d = t.scheduling?.date || t.date;
      return t.status === 'pending' && (!d || d === todayDateStr);
    });

    const schedulerEvents = todayEvents.map(e => ({
      id: e.id,
      title: e.title,
      startMinute: e.scheduling?.startMinute ?? e.startMinute,
      endMinute: e.scheduling?.durationMinutes != null
        ? (e.scheduling?.startMinute ?? e.startMinute) + e.scheduling.durationMinutes
        : e.endMinute,
    }));

    const schedulerTasks = todayTasks.map(t => ({
      ...t,
      scheduledStartMinute: t.scheduling?.startMinute ?? t.scheduledStartMinute ?? null,
    }));

    const scheduleRes = scheduleTasks(schedulerTasks, DEFAULT_SCHEDULING_SETTINGS, now, schedulerEvents);
    scheduleBlocks = scheduleRes.blocks;
  }

  // 1. Compute desired targets based on the current schedule
  const desiredTargets = computeScheduleNotificationTargets({
    tasks: params.tasks,
    events: params.events,
    todayScheduleBlocks: scheduleBlocks,
    now,
    todayDateStr,
    leadTimeMinutes: params.leadTimeMinutes ?? DEFAULT_LEAD_TIME_MINUTES,
  });

  const desiredTargetMap = new Map<string, ScheduledTarget>(desiredTargets.map(t => [t.id, t]));

  // 2. Fetch all currently scheduled notifications
  const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const existingLifeOS = existingNotifications.filter(req => isLifeOSNotificationId(req.identifier));
  const existingMap = new Map(existingLifeOS.map(req => [req.identifier, req]));

  // 3. Cancel stale notifications (no longer in desired targets OR trigger timestamp changed)
  for (const existing of existingLifeOS) {
    const target = desiredTargetMap.get(existing.identifier);
    if (!target) {
      // Stale or activity completed/skipped/deleted
      await cancelNotificationAsync(existing.identifier);
      result.cancelled.push(existing.identifier);
    } else {
      const existingTimestamp = existing.content.data?.triggerTimestamp as number | undefined;
      const targetTimestamp = target.triggerDate.getTime();
      if (existingTimestamp !== targetTimestamp) {
        // Rescheduled: time changed! Cancel old to replace
        await cancelNotificationAsync(existing.identifier);
        result.cancelled.push(existing.identifier);
      } else {
        // Unchanged: matches exact time
        result.kept.push(existing.identifier);
      }
    }
  }

  // 4. Schedule missing or updated targets
  for (const target of desiredTargets) {
    if (result.kept.includes(target.id)) {
      // Already scheduled at exact time, avoid duplicate
      continue;
    }
    const id = await scheduleSingleNotificationAsync(target);
    if (id) {
      result.scheduled.push(target.id);
    }
  }

  if (__DEV__) {
    const finalScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[NOTIFICATION_FINAL_SCHEDULE]', finalScheduled.map(n => ({
      id: n.identifier,
      trigger: n.trigger,
    })));
  }

  return result;
}
