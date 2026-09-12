import { Task, TaskPriority } from '@/contexts/tasks-context';
import {
  DEFAULT_SCHEDULING_SETTINGS,
  scheduleTasks,
  SchedulingSettings,
} from '@/lib/scheduler';
import { formatDisplayDate, getTodayString } from '@/lib/date-time';
import { AIAction, ExecutionResult } from './ai-types';

export type TaskOperations = {
  addTask: (task: { title: string; durationMinutes: number; priority: TaskPriority; date?: string | null }) => void;
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
      const { title, durationMinutes, priority, date: rawDate } = action.payload;
      // Preserve null/undefined: do NOT silently default to today.
      // null  = undated; YYYY-MM-DD = explicitly pinned to that calendar day.
      const taskDate = rawDate ?? null;
      context.operations.addTask({ title, durationMinutes, priority, date: taskDate });

      const todayStr = getTodayString();
      const updatedTasks: Task[] = [
        ...context.tasks,
        {
          id: 'temp-new',
          title,
          durationMinutes,
          priority,
          status: 'pending',
          scheduledStartMinute: null,
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

    case 'get_schedule': {
      const schedule = scheduleTasks(context.tasks, settings, currentTime);
      const taskMap = new Map(context.tasks.map((t) => [t.id, t]));

      if (schedule.blocks.length === 0) {
        if (schedule.unscheduledTaskIds.length > 0) {
          return {
            success: true,
            message: `You have no scheduled activities remaining today, but ${schedule.unscheduledTaskIds.length} task(s) could not fit in the remaining window.`,
          };
        }
        return {
          success: true,
          message: 'Your schedule for today is completely clear!',
        };
      }

      const scheduleLines = schedule.blocks.map((block) => {
        const task = taskMap.get(block.taskId);
        return `• ${formatTime(block.start)} — ${formatTime(block.end)}: ${task?.title ?? 'Task'} (${task?.durationMinutes ?? 0}m)`;
      });

      let response = `Here is your current schedule for today:\n\n${scheduleLines.join('\n')}`;

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
      const schedule = scheduleTasks(context.tasks, settings, currentTime);
      const currentMinute = currentTime.getHours() * 60 + currentTime.getMinutes();
      const startMin = Math.max(settings.planningStartMinute, currentMinute);
      const endMin = settings.planningEndMinute;
      const totalAvailable = Math.max(0, endMin - startMin);

      const scheduledMinutes = schedule.blocks.reduce(
        (acc, b) => acc + (b.endMinute - b.startMinute),
        0
      );
      const freeMinutes = Math.max(0, totalAvailable - scheduledMinutes);

      const hours = Math.floor(freeMinutes / 60);
      const mins = freeMinutes % 60;
      const formattedFree = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      return {
        success: true,
        message: `You have approximately ${formattedFree} of free time remaining in today's planning window.`,
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
