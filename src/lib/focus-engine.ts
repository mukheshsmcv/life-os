import { Task } from '@/contexts/tasks-context';
import {
  DEFAULT_SCHEDULING_SETTINGS,
  ScheduledBlock,
  ScheduleResult,
  SchedulerEvent,
  SchedulingSettings,
  scheduleTasks,
} from './scheduler';

export type FocusStateKind =
  | 'active_now'
  | 'available_now'
  | 'waiting_upcoming'
  | 'day_complete';

export type FocusReason =
  | 'active_scheduled_block'
  | 'fits_available_gap'
  | 'next_fixed_commitment'
  | 'paused_activity';

export type FocusItem = {
  kind: 'task' | 'event';
  id: string;
  title: string;
  durationMinutes: number;
  startMinute: number;
  endMinute: number;
  start: Date;
  end: Date;
  reason: FocusReason;
  reasonLabel: string;
  task?: Task;
  event?: SchedulerEvent;
};

export type DetermineFocusOptions = {
  tasks: Task[];
  events?: SchedulerEvent[];
  currentDate: Date;
  settings?: SchedulingSettings;
  pausedActivityId?: string | null;
  /** Injectable minute of day (0-1439). If omitted, derived from currentDate. */
  currentMinute?: number;
};

export type FocusEngineResult = {
  stateKind: FocusStateKind;
  nowItem: FocusItem | null;
  upNextItems: FocusItem[];
  unscheduledTasks: Task[];
  scheduleResult: ScheduleResult;
  reasonLabel: string;
  isPaused: boolean;
};

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function minuteToDate(referenceDate: Date, minute: number): Date {
  const d = new Date(referenceDate);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

export function determineTodayFocus(options: DetermineFocusOptions): FocusEngineResult {
  const settings = options.settings ?? DEFAULT_SCHEDULING_SETTINGS;
  const currentDate = options.currentDate;
  const currentMinute =
    options.currentMinute ?? currentDate.getHours() * 60 + currentDate.getMinutes();
  const currentDateStr = toYMD(currentDate);

  // 1. Date filtering: task.date === currentDateStr OR task.date == null
  const todayTasks = options.tasks.filter(
    (t) => t.date === currentDateStr || t.date == null
  );

  const todayEvents = options.events ?? [];
  const eventMap = new Map(todayEvents.map((e) => [e.id, e]));
  const taskMap = new Map(todayTasks.map((t) => [t.id, t]));

  // 2. Delegate ALL task placement, priority sorting, and gap packing to scheduler.ts
  const scheduleResult = scheduleTasks(todayTasks, settings, currentDate, todayEvents);

  // 3. Map scheduler.ts output directly to FocusItems
  const scheduledItems: FocusItem[] = scheduleResult.blocks.map((block) => {
    if (block.taskId.startsWith('event-')) {
      const evId = block.taskId.slice(6);
      const ev = eventMap.get(evId);
      return {
        kind: 'event',
        id: evId,
        title: ev?.title ?? 'Event',
        durationMinutes: block.endMinute - block.startMinute,
        startMinute: block.startMinute,
        endMinute: block.endMinute,
        start: block.start,
        end: block.end,
        reason: 'active_scheduled_block',
        reasonLabel: 'Fixed commitment',
        event: ev,
      };
    } else {
      const t = taskMap.get(block.taskId);
      return {
        kind: 'task',
        id: block.taskId,
        title: t?.title ?? 'Task',
        durationMinutes: t?.durationMinutes ?? block.endMinute - block.startMinute,
        startMinute: block.startMinute,
        endMinute: block.endMinute,
        start: block.start,
        end: block.end,
        reason: 'active_scheduled_block',
        reasonLabel: 'Scheduled for now',
        task: t,
      };
    }
  });

  // 4. Read state purely from scheduler output
  const activeItem = scheduledItems.find(
    (item) => currentMinute >= item.startMinute && currentMinute < item.endMinute
  );

  const upcomingItems = scheduledItems.filter((item) => item.startMinute > currentMinute);
  const nextBlock = upcomingItems[0];

  // Check if active item is a floating task placed at currentMinute by scheduler
  const isAvailableGapTask =
    activeItem &&
    activeItem.kind === 'task' &&
    activeItem.task?.scheduledStartMinute == null;

  // Handle Paused Activity
  let isPaused = false;
  let pausedTask: Task | undefined;
  if (options.pausedActivityId) {
    pausedTask = todayTasks.find(
      (t) => t.id === options.pausedActivityId && t.status === 'pending'
    );
    if (pausedTask) {
      isPaused = true;
    }
  }

  let stateKind: FocusStateKind;
  let nowItem: FocusItem | null = null;
  let upNextItems: FocusItem[] = [];
  let reasonLabel = '';

  if (isPaused && pausedTask) {
    const pausedBlock = scheduledItems.find((i) => i.id === pausedTask!.id);
    nowItem = {
      kind: 'task',
      id: pausedTask.id,
      title: pausedTask.title,
      durationMinutes: pausedTask.durationMinutes,
      startMinute: pausedBlock?.startMinute ?? currentMinute,
      endMinute: pausedBlock?.endMinute ?? currentMinute + pausedTask.durationMinutes,
      start: pausedBlock?.start ?? minuteToDate(currentDate, currentMinute),
      end: pausedBlock?.end ?? minuteToDate(currentDate, currentMinute + pausedTask.durationMinutes),
      reason: 'paused_activity',
      reasonLabel: 'Activity paused',
      task: pausedTask,
    };
    stateKind = activeItem ? 'active_now' : nextBlock ? 'waiting_upcoming' : 'day_complete';
    upNextItems = upcomingItems;
    reasonLabel = 'Activity paused';
  } else if (activeItem) {
    stateKind = isAvailableGapTask ? 'available_now' : 'active_now';
    nowItem = activeItem;
    reasonLabel =
      activeItem.kind === 'event'
        ? 'Fixed commitment'
        : isAvailableGapTask
        ? 'Fits the available gap'
        : 'Scheduled for now';
    upNextItems = upcomingItems;
  } else if (nextBlock) {
    stateKind = 'waiting_upcoming';
    nowItem = null;
    reasonLabel = nextBlock.kind === 'event' ? 'Next fixed commitment' : 'Next scheduled block';
    upNextItems = upcomingItems;
  } else {
    stateKind = 'day_complete';
    nowItem = null;
    upNextItems = [];
    reasonLabel = 'No more activities today';
  }

  const scheduledTaskIds = new Set(
    scheduledItems.filter((i) => i.kind === 'task').map((i) => i.id)
  );

  const unscheduledTasks = todayTasks.filter(
    (t) =>
      t.status === 'pending' &&
      !scheduledTaskIds.has(t.id) &&
      nowItem?.task?.id !== t.id
  );

  return {
    stateKind,
    nowItem,
    upNextItems,
    unscheduledTasks,
    scheduleResult,
    reasonLabel,
    isPaused,
  };
}

