import { TaskPriority } from '@/contexts/tasks-context';
export type { TaskPriority };

export type CreateTaskPayload = {
  title: string;
  durationMinutes: number;
  priority: TaskPriority;
  /** YYYY-MM-DD resolved by the LLM from relative expressions ("tomorrow", "Monday", etc.). */
  date?: string;
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
};

export type GetFreeTimeAction = {
  type: 'get_free_time';
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

export type ParseIntentResult =
  | { success: true; actions: AIAction[]; mode?: 'real_ai' | 'mock_fallback'; notice?: string }
  | { success: false; error: string; clarificationNeeded?: boolean; mode?: 'real_ai' | 'mock_fallback'; notice?: string };

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
