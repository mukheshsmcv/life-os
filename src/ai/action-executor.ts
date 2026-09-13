import { Task, TaskPriority } from '@/contexts/tasks-context';
import {
  DEFAULT_SCHEDULING_SETTINGS,
  scheduleTasks,
  SchedulingSettings,
} from '@/lib/scheduler';
import { formatDisplayDate, getTodayString, parseDateString } from '@/lib/date-time';
import { AIAction, ExecutionResult } from './ai-types';

export type TaskOperations = {
  addTask: (task: { title: string; durationMinutes: number; priority: TaskPriority; date?: string | null; scheduledStartMinute?: number | null }) => void;
  updateTask?: (id: string, updates: Partial<Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'date' | 'scheduledStartMinute'>>) => void;
  completeTask: (id: string) => void;
  skipTask: (id: string) => void;
  deleteTask: (id: string) => void;
};

export type ActionExecutionContext = {
  tasks: Task[];
  operations: TaskOperations;
  currentTime?: Date;
  settings?: SchedulingSettings;
};

function formatTime(date: Date): string {
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins} ${period}`;
}

function findNextScheduledTitle(tasks: Task[], settings: SchedulingSettings, currentTime: Date): string | null {
  const schedule = scheduleTasks(tasks, settings, currentTime);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const nextBlock = schedule.blocks.find((b) => b.start > currentTime || (currentTime >= b.start && currentTime < b.end));

  if (!nextBlock) return null;
  const task = taskMap.get(nextBlock.taskId);
  return task ? task.title : null;
}

export function executeAction(
  action: AIAction,
  context: ActionExecutionContext
): ExecutionResult {
  const currentTime = context.currentTime ?? new Date();
  const settings = context.settings ?? DEFAULT_SCHEDULING_SETTINGS;

  switch (action.type) {
    case 'create_task': {
      const { title, durationMinutes, priority, date: rawDate, scheduledStartMinute } = action.payload;
      // Preserve null/undefined: do NOT silently default to today.
      // null  = undated; YYYY-MM-DD = explicitly pinned to that calendar day.
      const taskDate = rawDate ?? null;
      const startMin = scheduledStartMinute ?? null;
      context.operations.addTask({ title, durationMinutes, priority, date: taskDate, scheduledStartMinute: startMin });

      const todayStr = getTodayString();
      const updatedTasks: Task[] = [
        ...context.tasks,
        {
          id: 'temp-new',
          title,
          durationMinutes,
          priority,
          status: 'pending',
          scheduledStartMinute: startMin,
          date: taskDate,
        },
      ];

      // Show "Scheduled for X" only for explicitly-dated tasks on days other than today.
      const dateLabel =
        taskDate && taskDate !== todayStr
          ? `\nScheduled for ${formatDisplayDate(taskDate)}.`
          : '';

      // "Next up" is computed from today's visible tasks:
      // explicitly today-dated tasks  +  undated tasks (which are always shown on Today).
      const todayTasks = updatedTasks.filter(
        (t) => t.date === todayStr || t.date == null
      );
      const nextTitle =
        !taskDate || taskDate === todayStr
          ? findNextScheduledTitle(todayTasks, settings, currentTime)
          : null;
      const nextMsg = nextTitle ? `\n${nextTitle} is now next.` : '';

      return {
        success: true,
        message: `✓ Added "${title}" (${durationMinutes} min, ${priority} priority).${dateLabel}${nextMsg}`,
      };
    }

    case 'complete_task': {
      const { taskId } = action.payload;
      if (!taskId) {
        return { success: false, message: 'Missing task ID for completion.' };
      }
      const targetTask = context.tasks.find((t) => t.id === taskId);
      context.operations.completeTask(taskId);

      const updatedTasks = context.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'completed' as const } : t
      );
      const nextTitle = findNextScheduledTitle(updatedTasks, settings, currentTime);
      const nextMsg = nextTitle ? `\n${nextTitle} is now next.` : '\nNo remaining activities scheduled today.';

      return {
        success: true,
        message: `✓ ${targetTask?.title ?? 'Task'} completed.${nextMsg}`,
      };
    }

    case 'skip_task': {
      const { taskId } = action.payload;
      if (!taskId) {
        return { success: false, message: 'Missing task ID for skip operation.' };
      }
      const targetTask = context.tasks.find((t) => t.id === taskId);
      context.operations.skipTask(taskId);

      const updatedTasks = context.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'skipped' as const } : t
      );
      const nextTitle = findNextScheduledTitle(updatedTasks, settings, currentTime);
      const nextMsg = nextTitle ? `\n${nextTitle} is now next.` : '\nNo remaining activities scheduled today.';

      return {
        success: true,
        message: `✓ Skipped ${targetTask?.title ?? 'Task'}.${nextMsg}`,
      };
    }

    case 'delete_task': {
      const { taskId } = action.payload;
      if (!taskId) {
        return { success: false, message: 'Missing task ID for deletion.' };
      }
      const targetTask = context.tasks.find((t) => t.id === taskId);
      context.operations.deleteTask(taskId);

      const updatedTasks = context.tasks.filter((t) => t.id !== taskId);
      const nextTitle = findNextScheduledTitle(updatedTasks, settings, currentTime);
      const nextMsg = nextTitle ? `\n${nextTitle} is now next.` : '';

      return {
        success: true,
        message: `✓ Removed ${targetTask?.title ?? 'Task'} from your plan.${nextMsg}`,
      };
    }

    case 'update_task': {
      const { taskId, title, durationMinutes, priority, date, scheduledStartMinute } = action.payload;
      if (!taskId) {
        return { success: false, message: 'Missing task ID for update.' };
      }
      const targetTask = context.tasks.find((t) => t.id === taskId);
      if (!targetTask) {
        return { success: false, message: `Task with ID '${taskId}' does not exist.` };
      }

      const updates: Partial<Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'date' | 'scheduledStartMinute'>> = {};
      if (title !== undefined) updates.title = title;
      if (durationMinutes !== undefined) updates.durationMinutes = durationMinutes;
      if (priority !== undefined) updates.priority = priority;
      if (date !== undefined) updates.date = date;
      if (scheduledStartMinute !== undefined) updates.scheduledStartMinute = scheduledStartMinute;

      if (context.operations.updateTask) {
        context.operations.updateTask(taskId, updates);
      }

      const details: string[] = [];
      if (title !== undefined) details.push(`title: "${title}"`);
      if (durationMinutes !== undefined) details.push(`duration: ${durationMinutes}m`);
      if (priority !== undefined) details.push(`priority: ${priority}`);
      if (date !== undefined) details.push(date === null ? 'date: anytime (undated)' : `date: ${formatDisplayDate(date)}`);

      const changesMsg = details.length > 0 ? ` (${details.join(', ')})` : '';

      return {
        success: true,
        message: `✓ Updated "${targetTask.title}"${changesMsg}.`,
      };
    }

    case 'get_schedule': {
      const todayStr = getTodayString();
      const targetDateStr = action.payload?.date ?? todayStr;
      const dateLabel = formatDisplayDate(targetDateStr);
      const targetTitle = dateLabel === 'Today' ? 'today' : (dateLabel === 'Tomorrow' ? 'tomorrow' : `on ${dateLabel}`);

      const tasksForDate = context.tasks.filter((t) => {
        if (targetDateStr === todayStr) {
          return t.date === todayStr || t.date == null;
        }
        return t.date === targetDateStr;
      });

      let refDate: Date;
      if (targetDateStr === todayStr) {
        refDate = currentTime;
      } else {
        refDate = parseDateString(targetDateStr);
      }

      const schedule = scheduleTasks(tasksForDate, settings, refDate);
      const taskMap = new Map(context.tasks.map((t) => [t.id, t]));

      if (schedule.blocks.length === 0) {
        if (schedule.unscheduledTaskIds.length > 0) {
          return {
            success: true,
            message: `You have no scheduled activities ${targetTitle}, but ${schedule.unscheduledTaskIds.length} task(s) could not fit in the window.`,
          };
        }
        return {
          success: true,
          message: `Your schedule for ${targetTitle} is completely clear!`,
        };
      }

      const scheduleLines = schedule.blocks.map((block) => {
        const task = taskMap.get(block.taskId);
        return `• ${formatTime(block.start)} — ${formatTime(block.end)}: ${task?.title ?? 'Task'} (${task?.durationMinutes ?? 0}m)`;
      });

      let response = `Here is your schedule for ${targetTitle}:\n\n${scheduleLines.join('\n')}`;

      if (schedule.unscheduledTaskIds.length > 0) {
        const unscheduledTitles = schedule.unscheduledTaskIds
          .map((id) => taskMap.get(id)?.title)
          .filter(Boolean)
          .join(', ');
        response += `\n\nUnscheduled (could not fit in window): ${unscheduledTitles}`;
      }

      return {
        success: true,
        message: response,
      };
    }

    case 'replan_day': {
      const schedule = scheduleTasks(context.tasks, settings, currentTime);
      const count = schedule.blocks.length;
      const nextTitle = findNextScheduledTitle(context.tasks, settings, currentTime);
      const nextMsg = nextTitle ? ` ${nextTitle} is now next.` : '';
      return {
        success: true,
        message: `✓ Replanned your day (${count} active block(s)).${nextMsg}`,
      };
    }

    case 'get_free_time': {
      const todayStr = getTodayString();
      const targetDateStr = action.payload?.date ?? todayStr;
      const dateLabel = formatDisplayDate(targetDateStr);
      const targetTitle = dateLabel === 'Today' ? 'today' : (dateLabel === 'Tomorrow' ? 'tomorrow' : `on ${dateLabel}`);

      const tasksForDate = context.tasks.filter((t) => {
        if (targetDateStr === todayStr) {
          return t.date === todayStr || t.date == null;
        }
        return t.date === targetDateStr;
      });

      let refDate: Date;
      let startMin: number;
      if (targetDateStr === todayStr) {
        refDate = currentTime;
        const currentMinute = currentTime.getHours() * 60 + currentTime.getMinutes();
        startMin = Math.max(settings.planningStartMinute, currentMinute);
      } else {
        refDate = parseDateString(targetDateStr);
        startMin = settings.planningStartMinute;
      }

      const endMin = settings.planningEndMinute;
      const totalAvailable = Math.max(0, endMin - startMin);

      const schedule = scheduleTasks(tasksForDate, settings, refDate);
      const scheduledMinutes = schedule.blocks.reduce(
        (acc, b) => acc + (b.endMinute - b.startMinute),
        0
      );
      const freeMinutes = Math.max(0, totalAvailable - scheduledMinutes);

      const formatMins = (m: number) => {
        const h = Math.floor(m / 60);
        const rem = m % 60;
        if (h > 0 && rem > 0) return `${h}h ${rem}m`;
        if (h > 0) return `${h}h`;
        return `${rem}m`;
      };

      const sortedBlocks = [...schedule.blocks].sort((a, b) => a.startMinute - b.startMinute);
      type Slot = { startMin: number; endMin: number; duration: number };
      const freeSlots: Slot[] = [];
      let currentPointer = startMin;

      for (const block of sortedBlocks) {
        if (block.startMinute > currentPointer + settings.bufferMinutes) {
          const gap = block.startMinute - settings.bufferMinutes - currentPointer;
          if (gap > 0) {
            freeSlots.push({ startMin: currentPointer, endMin: block.startMinute - settings.bufferMinutes, duration: gap });
          }
        }
        currentPointer = Math.max(currentPointer, block.endMinute + settings.bufferMinutes);
      }
      if (currentPointer < endMin) {
        const gap = endMin - currentPointer;
        if (gap > 0) {
          freeSlots.push({ startMin: currentPointer, endMin, duration: gap });
        }
      }

      const formatMinToTimeStr = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        const displayM = String(m).padStart(2, '0');
        return `${displayH}:${displayM} ${period}`;
      };

      const targetTaskQuery = action.payload?.targetTaskTitleQuery;
      if (targetTaskQuery) {
        const matchedTask = tasksForDate.find((t) => t.title.toLowerCase().includes(targetTaskQuery.toLowerCase())) ||
          context.tasks.find((t) => t.title.toLowerCase().includes(targetTaskQuery.toLowerCase()));
        const reqDuration = matchedTask ? matchedTask.durationMinutes : (action.payload?.targetDurationMinutes ?? 60);
        const titleName = matchedTask ? matchedTask.title : targetTaskQuery;

        const fittingSlot = freeSlots.find((s) => s.duration >= reqDuration);
        if (fittingSlot) {
          const slotStart = formatMinToTimeStr(fittingSlot.startMin);
          const slotEnd = formatMinToTimeStr(fittingSlot.startMin + reqDuration);
          return {
            success: true,
            message: `You can schedule ${titleName} ${targetTitle} between ${slotStart} and ${slotEnd} (${reqDuration}m slot available).`,
          };
        } else {
          return {
            success: true,
            message: `There are no continuous ${reqDuration}m free slots available ${targetTitle} in your planning window. Total free time is ${formatMins(freeMinutes)}.`,
          };
        }
      }

      const reqDuration = action.payload?.targetDurationMinutes;
      if (reqDuration && reqDuration > 0) {
        const fittingSlot = freeSlots.find((s) => s.duration >= reqDuration);
        if (fittingSlot) {
          const slotStart = formatMinToTimeStr(fittingSlot.startMin);
          const slotEnd = formatMinToTimeStr(fittingSlot.endMin);
          return {
            success: true,
            message: `Yes! You have ${formatMins(freeMinutes)} of free time ${targetTitle}, including a slot from ${slotStart} to ${slotEnd}.`,
          };
        } else if (freeMinutes >= reqDuration) {
          return {
            success: true,
            message: `You have ${formatMins(freeMinutes)} of total free time ${targetTitle} across shorter gaps, but no single continuous ${formatMins(reqDuration)} block.`,
          };
        } else {
          return {
            success: true,
            message: `No, you only have ${formatMins(freeMinutes)} of free time ${targetTitle}.`,
          };
        }
      }

      let slotDetail = '';
      if (freeSlots.length > 0) {
        const firstSlot = freeSlots[0];
        slotDetail = ` (first slot: ${formatMinToTimeStr(firstSlot.startMin)} — ${formatMinToTimeStr(firstSlot.endMin)})`;
      }

      return {
        success: true,
        message: `You have approximately ${formatMins(freeMinutes)} of free time ${targetTitle}${slotDetail}.`,
      };
    }

    case 'clarification': {
      return {
        success: false,
        message: action.payload.question,
      };
    }

    default: {
      return {
        success: false,
        message: 'Action execution failed: unknown action type.',
      };
    }
  }
}
