import { Task } from '@/contexts/tasks-context';
import { isValidDateString } from '@/lib/date-time';
import { AIAction, ValidationResult } from './ai-types';

export function validateAction(action: AIAction, tasks: Task[]): ValidationResult {
  switch (action.type) {
    case 'create_task': {
      const { title, durationMinutes, priority } = action.payload;

      if (!title || title.trim().length === 0) {
        return {
          valid: false,
          error: 'Task title cannot be empty.',
        };
      }

      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return {
          valid: false,
          error: 'Task duration must be a valid number of minutes greater than 0.',
        };
      }

      if (!['low', 'medium', 'high'].includes(priority)) {
        return {
          valid: false,
          error: `Invalid priority '${priority}'. Priority must be low, medium, or high.`,
        };
      }

      // Optional date validation — must be absolute YYYY-MM-DD if present
      if (action.payload.date !== undefined) {
        if (!isValidDateString(action.payload.date)) {
          return {
            valid: false,
            error: `Invalid date "${action.payload.date}". Date must be in YYYY-MM-DD format and represent a real calendar date (e.g. 2026-09-15). Relative expressions like "tomorrow" or "Monday" are not accepted here.`,
          };
        }
      }

      return { valid: true, action };
    }

    case 'complete_task':
    case 'skip_task':
    case 'delete_task':
    case 'update_task': {
      if (action.type === 'update_task') {
        const { date, durationMinutes, priority } = action.payload;
        if (date !== undefined && date !== null && !isValidDateString(date)) {
          return {
            valid: false,
            error: `Invalid date "${date}". Date must be in YYYY-MM-DD format (or null for anytime).`,
          };
        }
        if (durationMinutes !== undefined && (!Number.isFinite(durationMinutes) || durationMinutes <= 0)) {
          return {
            valid: false,
            error: 'Task duration must be a valid number of minutes greater than 0.',
          };
        }
        if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
          return {
            valid: false,
            error: `Invalid priority '${priority}'. Priority must be low, medium, or high.`,
          };
        }
      }

      const { taskId, taskTitleQuery } = action.payload;

      // If taskId is directly provided
      if (taskId) {
        const existing = tasks.find((t) => t.id === taskId);
        if (!existing) {
          return {
            valid: false,
            error: `Task with ID '${taskId}' does not exist.`,
          };
        }
        return { valid: true, resolvedTaskId: taskId, action };
      }

      // If taskTitleQuery is provided
      if (!taskTitleQuery || !taskTitleQuery.trim()) {
        return {
          valid: false,
          error: 'Please specify which task you want to target.',
        };
      }

      const query = taskTitleQuery.trim().toLowerCase();
      const matches = tasks.filter((t) => t.title.toLowerCase().includes(query));

      if (matches.length === 0) {
        return {
          valid: false,
          error: `I couldn't find any task matching "${taskTitleQuery}".`,
        };
      }

      if (matches.length > 1) {
        const matchNames = matches.map((t) => `"${t.title}"`).join(', ');
        return {
          valid: false,
          clarificationNeeded: true,
          error: `I found multiple tasks matching "${taskTitleQuery}": ${matchNames}. Which one do you mean?`,
        };
      }

      const matchedTask = matches[0];
      const updatedAction: AIAction = {
        ...action,
        payload: {
          ...action.payload,
          taskId: matchedTask.id,
        },
      } as AIAction;

      return {
        valid: true,
        resolvedTaskId: matchedTask.id,
        action: updatedAction,
      };
    }

    case 'replan_day':
    case 'get_schedule':
    case 'get_free_time': {
      return { valid: true, action };
    }

    case 'clarification': {
      return {
        valid: false,
        clarificationNeeded: true,
        error: action.payload.question,
      };
    }

    default: {
      return {
        valid: false,
        error: 'Unsupported or invalid AI action type.',
      };
    }
  }
}
