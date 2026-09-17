import { Task } from '@/contexts/tasks-context';
import { SchedulerEvent, SchedulingSettings, DEFAULT_SCHEDULING_SETTINGS, scheduleTasks } from './scheduler';
import { determineTodayFocus } from './focus-engine';
import { toYMD } from './date-time';

export type CurrentStateSnapshot = {
  date: string;
  currentMinute: number;

  now: {
    type: 'task' | 'event' | 'none';
    id?: string;
    title?: string;
    status?: string;
    activeState?: 'planned' | 'running' | 'paused';
    remainingMinutes?: number;
  };

  next: {
    id?: string;
    title?: string;
    startMinute?: number;
    endMinute?: number;
    minutesUntilStart?: number;
  } | null;

  running?: {
    id: string;
    title: string;
    actualStartMinute?: number;
    remainingMinutes: number;
  };

  paused?: {
    id: string;
    title: string;
    remainingMinutes: number;
  };

  overdue: string[];
  upcomingFixed: string[];
  pending: string[];
  completed: string[];
  skipped: string[];

  freeTime: Array<{
    startMinute: number;
    endMinute: number;
    durationMinutes: number;
  }>;

  unscheduled: string[];

  remainingWorkMinutes: number;
  availableMinutes: number;

  dayComplete: boolean;
};

export function getCurrentStateSnapshot(
  tasks: Task[],
  events: SchedulerEvent[],
  currentDate: Date,
  settings: SchedulingSettings = DEFAULT_SCHEDULING_SETTINGS
): CurrentStateSnapshot {
  const currentMinute = currentDate.getHours() * 60 + currentDate.getMinutes();
  const currentDateStr = toYMD(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());

  const todayTasks = tasks.filter((t) => t.date === currentDateStr || t.date == null);
  
  // Use existing focus engine for the "now" / "next" deterministic state
  const focusResult = determineTodayFocus({
    tasks: todayTasks,
    events,
    currentDate,
    currentMinute,
    settings,
  });

  const now: CurrentStateSnapshot['now'] = { type: 'none' };
  
  // If there's an active running/paused item, or something currently scheduled
  if (focusResult.nowItem) {
    now.type = focusResult.nowItem.kind;
    now.id = focusResult.nowItem.id;
    now.title = focusResult.nowItem.title;
    
    if (focusResult.nowItem.kind === 'task' && focusResult.nowItem.task) {
      now.status = focusResult.nowItem.task.status;
      now.activeState = focusResult.nowItem.task.execution?.activeState ?? 'planned';
      
      const t = focusResult.nowItem.task;
      let completed = 0;
      if (t.execution?.activeState === 'running') {
         const actualStart = t.execution.actualStartMinute ?? currentMinute;
         completed = (currentMinute - actualStart) - (t.execution.totalPausedMinutes || 0);
      } else if (t.execution?.activeState === 'paused') {
         const actualStart = t.execution.actualStartMinute ?? currentMinute;
         const lastPaused = t.execution.lastPausedAtMinute ?? currentMinute;
         completed = (lastPaused - actualStart) - (t.execution.totalPausedMinutes || 0);
      }
      now.remainingMinutes = Math.max(0, t.durationMinutes - Math.max(0, Math.floor(completed)));
    } else {
      now.remainingMinutes = Math.max(0, focusResult.nowItem.endMinute - currentMinute);
    }
  }

  const nextBlock = focusResult.upNextItems[0];
  const next = nextBlock ? {
    id: nextBlock.id,
    title: nextBlock.title,
    startMinute: nextBlock.startMinute,
    endMinute: nextBlock.endMinute,
    minutesUntilStart: Math.max(0, nextBlock.startMinute - currentMinute)
  } : null;

  const runningTask = todayTasks.find((t) => t.execution?.activeState === 'running');
  const running = runningTask ? {
    id: runningTask.id,
    title: runningTask.title,
    actualStartMinute: runningTask.execution?.actualStartMinute,
    remainingMinutes: now.id === runningTask.id ? (now.remainingMinutes ?? runningTask.durationMinutes) : runningTask.durationMinutes
  } : undefined;

  const pausedTask = todayTasks.find((t) => t.execution?.activeState === 'paused');
  const paused = pausedTask ? {
    id: pausedTask.id,
    title: pausedTask.title,
    remainingMinutes: now.id === pausedTask.id ? (now.remainingMinutes ?? pausedTask.durationMinutes) : pausedTask.durationMinutes
  } : undefined;

  const overdue = todayTasks
    .filter(t => t.status === 'pending' && t.scheduledStartMinute !== null && (t.scheduledStartMinute + t.durationMinutes) <= currentMinute && t.execution?.activeState !== 'running' && t.execution?.activeState !== 'paused')
    .map(t => t.id);

  const upcomingFixed = todayTasks
    .filter(t => t.status === 'pending' && t.scheduledStartMinute !== null && t.scheduledStartMinute > currentMinute)
    .map(t => t.id);

  const pending = todayTasks.filter(t => t.status === 'pending').map(t => t.id);
  const completed = todayTasks.filter(t => t.status === 'completed').map(t => t.id);
  const skipped = todayTasks.filter(t => t.status === 'skipped').map(t => t.id);
  const unscheduled = focusResult.unscheduledTasks.map(t => t.id);

  // Calculate Free Time
  const freeTime: Array<{startMinute: number; endMinute: number; durationMinutes: number}> = [];
  const scheduleBlocks = focusResult.scheduleResult.blocks;
  
  let scanMinute = Math.max(currentMinute, settings.planningStartMinute);
  
  for (const block of scheduleBlocks) {
    if (block.endMinute <= scanMinute) continue;
    
    if (block.startMinute - settings.bufferMinutes > scanMinute) {
       freeTime.push({
         startMinute: scanMinute,
         endMinute: block.startMinute - settings.bufferMinutes,
         durationMinutes: (block.startMinute - settings.bufferMinutes) - scanMinute
       });
    }
    scanMinute = Math.max(scanMinute, block.endMinute + settings.bufferMinutes);
  }
  
  if (scanMinute < settings.planningEndMinute) {
    freeTime.push({
      startMinute: scanMinute,
      endMinute: settings.planningEndMinute,
      durationMinutes: settings.planningEndMinute - scanMinute
    });
  }

  const availableMinutes = freeTime.reduce((sum, gap) => sum + gap.durationMinutes, 0);

  // Calculate Remaining Work Minutes
  let remainingWorkMinutes = 0;
  for (const t of todayTasks) {
    if (t.status !== 'pending') continue;
    if (t.id === running?.id) {
       remainingWorkMinutes += running.remainingMinutes;
    } else if (t.id === paused?.id) {
       remainingWorkMinutes += paused.remainingMinutes;
    } else {
       remainingWorkMinutes += t.durationMinutes;
    }
  }

  return {
    date: currentDateStr,
    currentMinute,
    now,
    next,
    running,
    paused,
    overdue,
    upcomingFixed,
    pending,
    completed,
    skipped,
    freeTime,
    unscheduled,
    remainingWorkMinutes,
    availableMinutes,
    dayComplete: focusResult.stateKind === 'day_complete' && pending.length === 0,
  };
}
