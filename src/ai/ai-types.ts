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
  scheduling?: CanonicalScheduling;
  entities?: SemanticEntities;
  executionRequirement?: ExternalExecutionRequirement;
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
    scheduling?: CanonicalScheduling;
    entities?: SemanticEntities;
    executionRequirement?: ExternalExecutionRequirement;
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
    scope?: 'full' | 'next';
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
    candidateAction?: ActionableAIAction;
  };
};

export type SemanticEntities = {
  people?: string[];
  location?: string;
  destination?: string;
  organization?: string;
  service?: string;
  provider?: string;
};

export type SchedulingMode = 'flexible' | 'fixed' | 'deadline' | 'preferred_window';

export type CanonicalScheduling = {
  mode: SchedulingMode;
  date?: string | null;
  startMinute?: number | null;
  endMinute?: number | null;
  deadlineMinute?: number | null;
  durationMinutes?: number | null;
};

export type ActivityCategory = 
  | 'task'
  | 'event'
  | 'meeting'
  | 'social'
  | 'travel'
  | 'reminder';

export type IntentOperation = 
  | 'create_activity'
  | 'update_activity'
  | 'delete_activity'
  | 'complete_activity'
  | 'skip_activity'
  | 'log_constraint'
  | 'query_schedule'
  | 'query_free_time'
  | 'query_current_state'
  | 'query_day_status'
  | 'query_feasibility'
  | 'clarification'
  | 'context_statement'
  | 'general_conversation';

export type ExternalExecutionRequirement = 'booking' | 'transport' | 'communication';

export type ProcessIntentPayload = {
  operation: IntentOperation;
  targetId?: string;
  category?: ActivityCategory;
  title?: string;
  targetQuery?: string;
  scheduling?: CanonicalScheduling;
  entities?: SemanticEntities;
  priority?: TaskPriority;
  clarificationQuestion?: string;
  conversationalResponse?: string;
  executionRequirement?: ExternalExecutionRequirement;
};

export type ProcessIntentAction = {
  type: 'process_intent';
  payload: ProcessIntentPayload;
};

export type ActionableAIAction =
  | ProcessIntentAction
  | CreateTaskAction
  | UpdateTaskAction
  | DeleteTaskAction
  | CompleteTaskAction
  | SkipTaskAction
  | ReplanDayAction
  | GetScheduleAction
  | GetFreeTimeAction;

export type AIAction =
  | ActionableAIAction
  | ClarificationAction;

export type PendingClarification = {
  pendingIntent: 'update_task' | 'create_task' | 'complete_task' | 'skip_task' | 'delete_task' | 'process_intent';
  taskId?: string;
  taskTitle?: string;
  taskTitleQuery?: string;
  date?: string | null;
  scheduledStartMinute?: number | null;
  durationMinutes?: number;
  priority?: TaskPriority;
  question?: string;
  missingFields?: Array<'date' | 'time' | 'task' | 'duration'>;
  candidateAction?: ActionableAIAction;
};

export type ParseIntentResult =
  | { success: true; actions: AIAction[]; pendingClarification?: PendingClarification | null; mode?: 'real_ai' | 'mock_fallback'; notice?: string }
  | { success: false; error: string; clarificationNeeded?: boolean; actions?: AIAction[]; pendingClarification?: PendingClarification | null; mode?: 'real_ai' | 'mock_fallback'; notice?: string };

export type ValidationResult =
  | { valid: true; resolvedTaskId?: string; action: AIAction }
  | { valid: false; error: string; clarificationNeeded?: boolean };

export type ExecutionResult = {
  success: boolean;
  message?: string;
  createdId?: string;
};

export type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  notice?: string;
};

