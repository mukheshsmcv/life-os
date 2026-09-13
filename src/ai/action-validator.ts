import { Task } from '@/contexts/tasks-context';
import { isValidDateString } from '@/lib/date-time';
import { AIAction, ValidationResult } from './ai-types';
import { resolveTaskEntity } from './mock-intent-parser';

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

      if (action.payload.scheduledStartMinute !== undefined && action.payload.scheduledStartMinute !== null) {
        const sm = action.payload.scheduledStartMinute;
        if (!Number.isInteger(sm) || sm < 0 || sm >= 1440) {
          return {
            valid: false,
            error: `Invalid start minute ${sm}. Must be an integer between 0 and 1439.`,
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
        const { date, durationMinutes, priority, scheduledStartMinute } = action.payload;
        if (date !== undefined && date !== null && !isValidDateString(date)) {
          return {
            valid: false,
            error: `Invalid date "${date}". Date must be in YYYY-MM-DD format (or null for anytime).`,
          };
        }
        if (scheduledStartMinute !== undefined && scheduledStartMinute !== null) {
          if (!Number.isInteger(scheduledStartMinute) || scheduledStartMinute < 0 || scheduledStartMinute >= 1440) {
            return {
              valid: false,
              error: `Invalid start minute ${scheduledStartMinute}. Must be an integer between 0 and 1439.`,
            };
          }
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

      const matchResult = resolveTaskEntity(taskTitleQuery, tasks);

      if (matchResult.type === 'none') {
        return {
          valid: false,
          error: `I couldn't find any task matching "${taskTitleQuery}".`,
        };
      }

      if (matchResult.type === 'multiple') {
        const matchNames = matchResult.matches.map((t) => `"${t.title}"`).join(', ');
        return {
          valid: false,
          clarificationNeeded: true,
          error: `I found multiple tasks matching "${taskTitleQuery}": ${matchNames}. Which one do you mean?`,
        };
      }

      const matchedTask = matchResult.task;
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
      if (action.type === 'get_schedule' || action.type === 'get_free_time') {
        const d = action.payload?.date;
        if (d !== undefined && d !== null && !isValidDateString(d)) {
          return {
            valid: false,
            error: `Invalid date "${d}" in schedule query. Date must be in YYYY-MM-DD format.`,
          };
        }
      }
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
