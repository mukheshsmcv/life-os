import { TaskPriority } from '@/contexts/tasks-context';
export type { TaskPriority };

export type CreateTaskPayload = {
  title: string;
  durationMinutes: number;
  priority: TaskPriority;
  /** YYYY-MM-DD resolved by the LLM from relative expressions ("tomorrow", "Monday", etc.). */
  date?: string;
  /** Wall-clock minute of day (0-1439), e.g. 540 for 9:00 AM, or null for flexible scheduling */
  scheduledStartMinute?: number | null;
};

export type TaskRefPayload = {
  taskId?: string;
  taskTitleQuery?: string;
};

export type CreateTaskAction = {
  type: 'create_task';
  payload: CreateTaskPayload;
};

export type UpdateTaskAction = {
  type: 'update_task';
  payload: {
    taskId?: string;
    taskTitleQuery?: string;
    title?: string;
    durationMinutes?: number;
    priority?: TaskPriority;
    date?: string | null;
    scheduledStartMinute?: number | null;
  };
};

export type DeleteTaskAction = {
  type: 'delete_task';
  payload: TaskRefPayload;
};

export type CompleteTaskAction = {
  type: 'complete_task';
  payload: TaskRefPayload;
};

export type SkipTaskAction = {
  type: 'skip_task';
  payload: TaskRefPayload;
};

export type ReplanDayAction = {
  type: 'replan_day';
};

export type GetScheduleAction = {
  type: 'get_schedule';
  payload?: {
    date?: string | null;
  };
};

export type GetFreeTimeAction = {
  type: 'get_free_time';
  payload?: {
    date?: string | null;
    targetDurationMinutes?: number | null;
    targetTaskTitleQuery?: string | null;
  };
};

export type ClarificationAction = {
  type: 'clarification';
  payload: {
    question: string;
  };
};

export type AIAction =
  | CreateTaskAction
  | UpdateTaskAction
  | DeleteTaskAction
  | CompleteTaskAction
  | SkipTaskAction
  | ReplanDayAction
  | GetScheduleAction
  | GetFreeTimeAction
  | ClarificationAction;

export type PendingClarification = {
  pendingIntent: 'update_task' | 'create_task' | 'complete_task' | 'skip_task' | 'delete_task';
  taskId?: string;
  taskTitle?: string;
  taskTitleQuery?: string;
  date?: string | null;
  scheduledStartMinute?: number | null;
  durationMinutes?: number;
  priority?: TaskPriority;
  question?: string;
  missingFields?: Array<'date' | 'time' | 'task' | 'duration'>;
};

export type ParseIntentResult =
  | { success: true; actions: AIAction[]; pendingClarification?: PendingClarification | null; mode?: 'real_ai' | 'mock_fallback'; notice?: string }
  | { success: false; error: string; clarificationNeeded?: boolean; actions?: AIAction[]; pendingClarification?: PendingClarification | null; mode?: 'real_ai' | 'mock_fallback'; notice?: string };

export type ValidationResult =
  | { valid: true; resolvedTaskId?: string; action: AIAction }
  | { valid: false; error: string; clarificationNeeded?: boolean };

export type ExecutionResult = {
  success: boolean;
  message: string;
};

export type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  notice?: string;
};

