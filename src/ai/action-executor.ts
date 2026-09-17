import { Task, TaskPriority, Event } from '@/contexts/tasks-context';
import {
  DEFAULT_SCHEDULING_SETTINGS,
  ScheduledBlock,
  scheduleTasks,
  SchedulingSettings,
} from '@/lib/scheduler';
import { formatDisplayDate, getTodayString, isValidDateString, parseDateString } from '@/lib/date-time';
import { getCurrentStateSnapshot } from '@/lib/current-state';
import { AIAction, CanonicalScheduling, CreateTaskPayload, ExecutionResult, ExternalExecutionRequirement, SemanticEntities } from './ai-types';

export type TaskOperations = {
  addTask: (task: { title: string; durationMinutes: number; priority: TaskPriority; date?: string | null; scheduledStartMinute?: number | null; scheduling?: CanonicalScheduling; entities?: SemanticEntities; executionRequirement?: ExternalExecutionRequirement }) => string | void;
  addEvent?: (event: { title: string; scheduling: CanonicalScheduling; entities?: SemanticEntities; executionRequirement?: ExternalExecutionRequirement; date?: string; startMinute?: number; endMinute?: number; notes?: string }) => string | void;
  updateTask?: (id: string, updates: Partial<Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'date' | 'scheduledStartMinute' | 'scheduling' | 'entities' | 'executionRequirement'>>) => void;
  updateEvent?: (id: string, updates: Partial<Pick<Event, 'title' | 'date' | 'startMinute' | 'endMinute' | 'notes' | 'scheduling' | 'entities' | 'executionRequirement'>>) => void;
  completeTask: (id: string) => void;
  skipTask: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteEvent?: (id: string) => void;
};

export type ActionExecutionContext = {
  tasks: Task[];
  events?: Event[];
  operations: TaskOperations;
  currentTime?: Date;
  settings?: SchedulingSettings;
  createdTasksHistory?: CreateTaskPayload[];
};

export function areCreateTasksEquivalent(
  a: CreateTaskPayload,
  b: CreateTaskPayload
): boolean {
  const normTitleA = a.title.trim().toLowerCase();
  const normTitleB = b.title.trim().toLowerCase();
  const dateA = a.date ?? null;
  const dateB = b.date ?? null;
  const startA = a.scheduledStartMinute ?? null;
  const startB = b.scheduledStartMinute ?? null;

  return (
    normTitleA === normTitleB &&
    a.durationMinutes === b.durationMinutes &&
    a.priority === b.priority &&
    dateA === dateB &&
    startA === startB
  );
}

export function deduplicateActions(actions: AIAction[]): AIAction[] {
  const seenCreateTasks: CreateTaskPayload[] = [];
  const result: AIAction[] = [];

  for (const action of actions) {
    if (action.type === 'create_task') {
      const isDuplicate = seenCreateTasks.some((seen) =>
        areCreateTasksEquivalent(seen, action.payload)
      );
      if (isDuplicate) {
        continue;
      }
      seenCreateTasks.push(action.payload);
    }
    result.push(action);
  }

  return result;
}

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
    case 'process_intent': {
      const { operation, title, scheduling, entities, executionRequirement, priority } = action.payload;

      if (operation === 'context_statement') {
        return { success: true, message: `Got it. (Context noted: ${title || 'availability'})` };
      }

      if (operation === 'create_activity') {
        if (!title) return { success: false, message: 'Missing title for activity creation.' };
        
        const mode = scheduling?.mode ?? 'flexible';
        const taskPriority = priority ?? 'medium';
        const duration = scheduling?.durationMinutes; // removed ?? 60 to follow milestone 5
        const taskDate = scheduling?.date ?? null;
        const startMin = scheduling?.startMinute ?? null;
        
        let createdId: string | void = undefined;

        if (mode === 'fixed') {
          if (context.operations.addEvent) {
            createdId = context.operations.addEvent({
              title,
              scheduling: scheduling!,
              entities,
              executionRequirement,
              date: scheduling?.date ?? getTodayString(),
              startMinute: scheduling?.startMinute ?? 0,
              endMinute: scheduling?.endMinute ?? (scheduling?.startMinute ?? 0) + (duration ?? 60),
            });
            const dateLabel = scheduling?.date && scheduling.date !== getTodayString() ? ` on ${formatDisplayDate(scheduling.date)}` : '';
            return {
              success: true,
              message: `✓ Added event "${title}"${dateLabel}.`,
              createdId: typeof createdId === 'string' ? createdId : undefined,
            };
          }
        }

        createdId = context.operations.addTask({ 
          title, 
          durationMinutes: duration ?? 60, // Fallback to 60 only for tasks if absolutely needed by UI
          priority: taskPriority, 
          date: taskDate, 
          scheduledStartMinute: startMin,
          scheduling: scheduling!,
          entities,
          executionRequirement
        });
        
        const dateLabel = taskDate && taskDate !== getTodayString() ? `\nScheduled for ${formatDisplayDate(taskDate)}.` : '';
        return {
          success: true,
          message: `✓ Added "${title}" (${duration ?? 'unknown'} min, ${taskPriority} priority).${dateLabel}`,
          createdId: typeof createdId === 'string' ? createdId : undefined,
        };
      }
      
      if (operation === 'query_schedule') {
        return executeAction({ type: 'get_schedule', payload: { date: scheduling?.date } }, context);
      }
      if (operation === 'query_free_time') {
        return executeAction({ type: 'get_free_time', payload: { date: scheduling?.date, targetDurationMinutes: scheduling?.durationMinutes } }, context);
      }

      if (operation === 'query_current_state') {
        const snapshot = getCurrentStateSnapshot(context.tasks, context.events ?? [], currentTime, settings);
        let msg = '';
        const formatTime = (min: number) => {
          const h = Math.floor(min / 60);
          const m = min % 60;
          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
        };

        if (snapshot.running) {
           msg = `You're currently running ${snapshot.running.title}. You have about ${snapshot.running.remainingMinutes} minutes remaining.`;
        } else if (snapshot.now.type !== 'none') {
           msg = `You're currently scheduled for ${snapshot.now.title}.`;
           if (snapshot.now.remainingMinutes !== undefined) {
              msg += ` You have about ${snapshot.now.remainingMinutes} minutes remaining.`;
           }
        } else if (snapshot.next) {
           msg = `You're free right now. Your next activity is ${snapshot.next.title} at ${formatTime(snapshot.next.startMinute!)}.`;
        } else {
           msg = `You're free right now, and you have no upcoming activities scheduled today.`;
        }
        return { success: true, message: msg };
      }

      if (operation === 'query_day_status') {
        const snapshot = getCurrentStateSnapshot(context.tasks, context.events ?? [], currentTime, settings);
        if (snapshot.dayComplete) {
           return { success: true, message: `Yes, you are completely done for the day!` };
        } else {
           let msg = `You still have ${snapshot.remainingWorkMinutes} minutes of planned work remaining today.`;
           if (snapshot.next) msg += ` Your next activity is ${snapshot.next.title}.`;
           return { success: true, message: msg };
        }
      }

      if (operation === 'query_feasibility') {
        const snapshot = getCurrentStateSnapshot(context.tasks, context.events ?? [], currentTime, settings);
        const reqDuration = scheduling?.durationMinutes ?? 30;
        const fittingGap = snapshot.freeTime.find(gap => gap.durationMinutes >= reqDuration);
        
        const formatTime = (min: number) => {
          const h = Math.floor(min / 60);
          const m = min % 60;
          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
        };

        if (fittingGap) {
           return { success: true, message: `Yes, you can fit a ${reqDuration} minute activity. There is a free slot from ${formatTime(fittingGap.startMinute)} to ${formatTime(fittingGap.endMinute)}.` };
        } else if (snapshot.availableMinutes >= reqDuration) {
           return { success: true, message: `You have ${snapshot.availableMinutes} minutes of total free time today, but no single continuous ${reqDuration} minute slot.` };
        } else {
           return { success: true, message: `No, you only have ${snapshot.availableMinutes} minutes of free time available today.` };
        }
      }

      if (operation === 'log_constraint') {
        if (!title) return { success: false, message: 'Missing title for constraint.' };
        context.operations.addTask({
          title,
          durationMinutes: 0,
          priority: 'high',
          date: scheduling?.date ?? null,
          scheduledStartMinute: scheduling?.deadlineMinute ?? scheduling?.startMinute ?? null,
          scheduling: scheduling ?? { mode: 'deadline' },
          entities,
          executionRequirement,
        });
        return { success: true, message: `✓ Logged constraint "${title}".` };
      }
      
      if (operation === 'update_activity') {
        const resolvedTaskId = (action.payload as any).targetId || (action.payload as any).taskId;
        if (!resolvedTaskId) {
          return { success: false, message: 'Missing targetId for update.' };
        }
        // Determine if it's an event or task
        const isEvent = context.events?.some(e => e.id === resolvedTaskId);
        if (isEvent) {
          return executeUpdateEvent({ ...action.payload, eventId: resolvedTaskId }, context);
        }
        return executeAction({ type: 'update_task', payload: { ...action.payload, taskId: resolvedTaskId } as any }, context);
      }

      if (operation === 'delete_activity') {
        const targetId = action.payload.targetId;
        if (!targetId) {
          return { success: false, message: 'I need to know which activity to delete. Can you be more specific?' };
        }
        // Try event first, then task
        const targetEvent = context.events?.find(e => e.id === targetId);
        if (targetEvent) {
          if (context.operations.deleteEvent) {
            context.operations.deleteEvent(targetId);
            return { success: true, message: `✓ Removed "${targetEvent.title}" from your schedule.` };
          }
          return { success: false, message: 'Delete event operation is not available.' };
        }
        const targetTask = context.tasks.find(t => t.id === targetId);
        if (targetTask) {
          context.operations.deleteTask(targetId);
          const updatedTasks = context.tasks.filter(t => t.id !== targetId);
          const nextTitle = findNextScheduledTitle(updatedTasks, settings, currentTime);
          const nextMsg = nextTitle ? `\n${nextTitle} is now next.` : '';
          return { success: true, message: `✓ Removed "${targetTask.title}" from your plan.${nextMsg}` };
        }
        return { success: false, message: `I couldn't find that activity to delete.` };
      }

      if (operation === 'complete_activity') {
        const targetId = action.payload.targetId;
        if (!targetId) {
          return { success: false, message: 'I need to know which activity to mark complete. Can you be more specific?' };
        }
        const targetTask = context.tasks.find(t => t.id === targetId);
        if (!targetTask) {
          return { success: false, message: `I couldn't find that activity to complete.` };
        }
        context.operations.completeTask(targetId);
        const updatedTasks = context.tasks.map(t => t.id === targetId ? { ...t, status: 'completed' as const } : t);
        const nextTitle = findNextScheduledTitle(updatedTasks, settings, currentTime);
        const nextMsg = nextTitle ? `\n${nextTitle} is now next.` : '\nNo remaining activities scheduled today.';
        return { success: true, message: `✓ "${targetTask.title}" marked complete.${nextMsg}` };
      }

      if (operation === 'skip_activity') {
        const targetId = action.payload.targetId;
        if (!targetId) {
          return { success: false, message: 'I need to know which activity to skip. Can you be more specific?' };
        }
        const targetTask = context.tasks.find(t => t.id === targetId);
        if (!targetTask) {
          return { success: false, message: `I couldn't find that activity to skip.` };
        }
        context.operations.skipTask(targetId);
        const updatedTasks = context.tasks.map(t => t.id === targetId ? { ...t, status: 'skipped' as const } : t);
        const nextTitle = findNextScheduledTitle(updatedTasks, settings, currentTime);
        const nextMsg = nextTitle ? `\n${nextTitle} is now next.` : '\nNo remaining activities scheduled today.';
        return { success: true, message: `✓ Skipped "${targetTask.title}".${nextMsg}` };
      }

      if (operation === 'clarification') {
        const q = action.payload.clarificationQuestion ?? 'Could you clarify that?';
        return { success: false, message: q };
      }

      if (operation === 'general_conversation') {
        return { success: true, message: action.payload.conversationalResponse || 'Hello! How can I help you today?' };
      }

      // Should never reach here for known operations
      console.warn(`[Executor] Unhandled process_intent operation: ${operation}`);
      return { success: false, message: `I'm not sure how to handle that request. Could you rephrase it?` };
    }

    case 'create_task': {
      const { title, durationMinutes, priority, date: rawDate, scheduledStartMinute } = action.payload;

      if (context.createdTasksHistory) {
        const isDuplicate = context.createdTasksHistory.some((seen) =>
          areCreateTasksEquivalent(seen, action.payload)
        );
        if (isDuplicate) {
          return {
            success: true,
            message: `(Duplicate creation of "${title}" skipped)`,
          };
        }
        context.createdTasksHistory.push(action.payload);
      }

      const taskDate = rawDate ?? null;
      const startMin = scheduledStartMinute ?? null;
      const createdId = context.operations.addTask({ title, durationMinutes, priority, date: taskDate, scheduledStartMinute: startMin, scheduling: action.payload.scheduling, entities: action.payload.entities, executionRequirement: action.payload.executionRequirement });

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
          scheduling: action.payload.scheduling || { mode: 'flexible', date: taskDate, startMinute: startMin },
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
        createdId: typeof createdId === 'string' ? createdId : undefined,
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
      const { taskId, title, durationMinutes, priority, date, scheduledStartMinute, scheduling, entities, executionRequirement } = action.payload;
      if (!taskId) {
        return { success: false, message: 'Missing task ID for update.' };
      }
      const targetTask = context.tasks.find((t) => t.id === taskId);
      if (!targetTask) {
        return { success: false, message: `Task with ID '${taskId}' does not exist.` };
      }

      const updates: Partial<Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'date' | 'scheduledStartMinute' | 'scheduling' | 'entities' | 'executionRequirement'>> = {};
      if (title !== undefined) updates.title = title;
      if (durationMinutes !== undefined) updates.durationMinutes = durationMinutes;
      if (priority !== undefined) updates.priority = priority;
      if (date !== undefined) updates.date = date;
      if (scheduledStartMinute !== undefined) updates.scheduledStartMinute = scheduledStartMinute;
      
      if (scheduling !== undefined) {
         updates.scheduling = { ...targetTask.scheduling, ...scheduling };
         if (scheduling.date !== undefined) updates.date = scheduling.date;
         if (scheduling.startMinute !== undefined) updates.scheduledStartMinute = scheduling.startMinute;
         if (scheduling.durationMinutes !== undefined) updates.durationMinutes = scheduling.durationMinutes ?? undefined;
      }
      if (entities !== undefined) {
         updates.entities = { ...targetTask.entities, ...entities };
      }
      if (executionRequirement !== undefined) {
         updates.executionRequirement = executionRequirement;
      }

      if (context.operations.updateTask) {
        context.operations.updateTask(taskId, updates);
      }

      const details: string[] = [];
      if (updates.title !== undefined) details.push(`title: "${updates.title}"`);
      if (updates.durationMinutes !== undefined) details.push(`duration: ${updates.durationMinutes}m`);
      if (updates.priority !== undefined) details.push(`priority: ${updates.priority}`);
      if (updates.date !== undefined) details.push(updates.date === null ? 'date: anytime (undated)' : `date: ${formatDisplayDate(updates.date)}`);
      if (updates.entities?.people) details.push(`people: ${updates.entities.people.join(', ')}`);

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

      if (action.payload?.scope === 'next') {
        let nextBlock: ScheduledBlock | null = null;
        const inProgressIndex = schedule.blocks.findIndex(
          (b) => currentTime >= b.start && currentTime < b.end
        );

        if (inProgressIndex !== -1) {
          nextBlock = schedule.blocks[inProgressIndex + 1] ?? null;
        } else {
          nextBlock = schedule.blocks.find((b) => b.start > currentTime) ?? null;
        }

        if (!nextBlock) {
          const noActivityMsg =
            targetDateStr === todayStr
              ? 'You have nothing else scheduled today.'
              : `You have nothing else scheduled ${targetTitle}.`;
          return {
            success: true,
            message: noActivityMsg,
          };
        }

        const task = taskMap.get(nextBlock.taskId);
        const title = task?.title ?? 'Activity';
        return {
          success: true,
          message: `Next: ${title}, ${formatTime(nextBlock.start)}–${formatTime(nextBlock.end)}.`,
        };
      }

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

function executeUpdateEvent(payload: any, context: ActionExecutionContext): ExecutionResult {
  const { eventId, title, date, startMinute, endMinute, notes, scheduling, entities, executionRequirement } = payload;
  if (!eventId) {
    return { success: false, message: 'Missing event ID for update.' };
  }
  const targetEvent = context.events?.find((e) => e.id === eventId);
  if (!targetEvent) {
    return { success: false, message: `Event with ID '${eventId}' does not exist.` };
  }

  const updates: Partial<Pick<Event, 'title' | 'date' | 'startMinute' | 'endMinute' | 'notes' | 'scheduling' | 'entities' | 'executionRequirement'>> = {};
  if (title !== undefined) updates.title = title;
  if (date !== undefined) updates.date = date;
  if (startMinute !== undefined) updates.startMinute = startMinute;
  if (endMinute !== undefined) updates.endMinute = endMinute;
  if (notes !== undefined) updates.notes = notes;

  if (scheduling !== undefined) {
     updates.scheduling = { ...targetEvent.scheduling, ...scheduling };
     if (scheduling.date !== undefined) updates.date = scheduling.date ?? undefined;
     if (scheduling.startMinute !== undefined) updates.startMinute = scheduling.startMinute ?? undefined;
     if (scheduling.endMinute !== undefined) updates.endMinute = scheduling.endMinute ?? undefined;
  }
  if (entities !== undefined) {
     updates.entities = { ...targetEvent.entities, ...entities };
  }
  if (executionRequirement !== undefined) {
     updates.executionRequirement = executionRequirement;
  }

  if (context.operations.updateEvent) {
    context.operations.updateEvent(eventId, updates);
  }

  const details: string[] = [];
  if (updates.title !== undefined) details.push(`title: "${updates.title}"`);
  if (updates.date !== undefined) details.push(updates.date === undefined ? 'date: anytime' : `date: ${updates.date}`);
  if (updates.entities?.people) details.push(`people: ${updates.entities.people.join(', ')}`);

  const changesMsg = details.length > 0 ? ` (${details.join(', ')})` : '';

  return {
    success: true,
    message: `✓ Updated event "${targetEvent.title}"${changesMsg}.`,
  };
}
