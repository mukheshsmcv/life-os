import { Task, Event } from '@/contexts/tasks-context';

export const CURRENT_STORAGE_VERSION = 1;
export const STORAGE_KEY = 'LIFE_OS_STORAGE_V1';

export type StorageState = {
  version: number;
  tasks: Task[];
  events: Event[];
};
