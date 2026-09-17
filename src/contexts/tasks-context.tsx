import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { loadStorageState, saveStorageState } from '@/lib/storage/local-storage';
import { syncScheduleNotifications, requestNotificationPermissionAsync, isNotificationEnabledAsync } from '@/lib/notifications';

import type { CanonicalScheduling, SemanticEntities, ExternalExecutionRequirement } from '@/ai/ai-types';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed' | 'skipped';

export type TaskExecutionState = 'planned' | 'running' | 'paused';
export type TaskExecution = {
  activeState: TaskExecutionState;
  actualStartMinute?: number;
  totalPausedMinutes: number;
  lastPausedAtMinute?: number;
};

export type Task = {
  id: string;
  title: string;
  durationMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  
  scheduling: CanonicalScheduling;
  entities?: SemanticEntities;
  executionRequirement?: ExternalExecutionRequirement;

  // Legacy fields
  scheduledStartMinute: number | null;
  date: string | null;

  execution?: TaskExecution;
};

type NewTask = Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'entities' | 'executionRequirement' | 'execution'> & {
  date?: string | null;
  scheduledStartMinute?: number | null;
  scheduling?: CanonicalScheduling;
};

export type Event = {
  id: string;
  title: string;
  
  scheduling: CanonicalScheduling;
  entities?: SemanticEntities;
  executionRequirement?: ExternalExecutionRequirement;
  notes?: string;

  // Legacy fields
  date: string; // YYYY-MM-DD
  startMinute: number;
  endMinute: number;
  status?: TaskStatus;
  
  execution?: TaskExecution;
};

export type NewEvent = Omit<Event, 'id' | 'scheduling' | 'status'> & {
  scheduling?: CanonicalScheduling;
  status?: TaskStatus;
  execution?: TaskExecution;
};

type TasksContextValue = {
  tasks: Task[];
  events: Event[];
  addTask: (task: NewTask) => string;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'date' | 'scheduledStartMinute' | 'scheduling' | 'entities' | 'executionRequirement'>>) => void;
  addEvent: (event: NewEvent) => string;
  updateEvent: (id: string, updates: Partial<Pick<Event, 'title' | 'date' | 'startMinute' | 'endMinute' | 'notes' | 'scheduling' | 'entities' | 'executionRequirement' | 'status' | 'execution'>>) => void;
  startTask: (id: string) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  completeTask: (id: string) => void;
  skipTask: (id: string) => void;
  completeEvent: (id: string) => void;
  skipEvent: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteEvent: (id: string) => void;
  getTasksForDate: (date: string) => Task[];
  getEventsForDate: (date: string) => Event[];
  requestNotificationPermission: () => Promise<boolean>;
  isNotificationsEnabled: () => Promise<boolean>;
  syncNotifications: () => Promise<{ scheduled: string[]; cancelled: string[]; kept: string[] }>;
};

const TasksContext = createContext<TasksContextValue | null>(null);

/**
 * Seed tasks are intentionally undated (date: null).
 * They will appear on Today because the Today screen includes undated tasks,
 * but they are not pinned to any calendar date.
 */
const initialTasks: Task[] = [
  {
    id: 'study-pharmacology',
    title: 'Study Pharmacology',
    durationMinutes: 60,
    priority: 'high',
    status: 'pending',
    execution: { activeState: 'planned', totalPausedMinutes: 0 },
    scheduling: { mode: 'flexible', date: null, startMinute: 18 * 60, endMinute: 19 * 60 },
    scheduledStartMinute: 18 * 60,
    date: null,
  },
  {
    id: 'break',
    title: 'Break',
    durationMinutes: 15,
    priority: 'low',
    status: 'pending',
    execution: { activeState: 'planned', totalPausedMinutes: 0 },
    scheduling: { mode: 'flexible', date: null, startMinute: 19 * 60 + 10, endMinute: 19 * 60 + 25 },
    scheduledStartMinute: 19 * 60 + 10,
    date: null,
  },
  {
    id: 'gym',
    title: 'Gym',
    durationMinutes: 60,
    priority: 'medium',
    status: 'pending',
    execution: { activeState: 'planned', totalPausedMinutes: 0 },
    scheduling: { mode: 'flexible', date: null, startMinute: 19 * 60 + 35, endMinute: 20 * 60 + 35 },
    scheduledStartMinute: 19 * 60 + 35,
    date: null,
  },
  {
    id: 'dinner',
    title: 'Dinner',
    durationMinutes: 45,
    priority: 'low',
    status: 'pending',
    execution: { activeState: 'planned', totalPausedMinutes: 0 },
    scheduling: { mode: 'flexible', date: null, startMinute: 20 * 60 + 45, endMinute: 21 * 60 + 30 },
    scheduledStartMinute: 20 * 60 + 45,
    date: null,
  },
  {
    id: 'revision',
    title: 'Revision',
    durationMinutes: 45,
    priority: 'high',
    status: 'pending',
    scheduling: { mode: 'flexible', date: null, startMinute: 21 * 60 + 40, endMinute: 22 * 60 + 25 },
    scheduledStartMinute: 21 * 60 + 40,
    date: null,
  },
];

const initialEvents: Event[] = [];

function normalizeTask(task: any): Task {
  if (task.scheduling) return task as Task;
  return {
    ...task,
    scheduling: {
      mode: 'flexible',
      date: task.date ?? null,
      startMinute: task.scheduledStartMinute ?? null,
      endMinute: task.scheduledStartMinute !== null && task.durationMinutes ? task.scheduledStartMinute + task.durationMinutes : null,
    }
  };
}

function normalizeEvent(ev: any): Event {
  let e = ev as Event;
  if (!ev.scheduling) {
    e = {
      ...ev,
      scheduling: {
        mode: 'fixed',
        date: ev.date,
        startMinute: ev.startMinute,
        endMinute: ev.endMinute,
      }
    };
  }
  if (!e.status) e.status = 'pending';
  return e;
}

export function TasksProvider({ children }: PropsWithChildren) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [events, setEvents] = useState<Event[]>(initialEvents);

  const isHydrated = useRef(false);
  const tasksRef = useRef(tasks);
  const eventsRef = useRef(events);
  tasksRef.current = tasks;
  eventsRef.current = events;

  useEffect(() => {
    let isMounted = true;
    async function hydrate() {
      const restored = await loadStorageState();
      if (isMounted) {
        if (restored) {
          const normalizedTasks = restored.tasks.map(normalizeTask);
          const normalizedEvents = restored.events.map(normalizeEvent);
          setTasks(normalizedTasks);
          setEvents(normalizedEvents);
          tasksRef.current = normalizedTasks;
          eventsRef.current = normalizedEvents;
        }
        isHydrated.current = true;
      }
    }
    hydrate();
    return () => {
      isMounted = false;
    };
  }, []);

  const persist = (nextTasks: Task[], nextEvents: Event[]) => {
    if (isHydrated.current) {
      saveStorageState(nextTasks, nextEvents);
    }
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.map((task) => (task.id === id ? { ...task, status } : task));
      tasksRef.current = nextTasks;
      persist(nextTasks, eventsRef.current);
      return nextTasks;
    });
  };

  const updateTask = (
    id: string,
    updates: Partial<Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'date' | 'scheduledStartMinute' | 'scheduling' | 'entities' | 'executionRequirement'>>
  ) => {
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.map((task) => (task.id === id ? { ...task, ...updates } : task));
      tasksRef.current = nextTasks;
      persist(nextTasks, eventsRef.current);
      return nextTasks;
    });
  };

  const addTask = (taskData: NewTask): string => {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setTasks((currentTasks) => {
      const nextTasks: Task[] = [
        ...currentTasks,
        {
          ...taskData,
          id,
          status: 'pending',
          scheduledStartMinute: taskData.scheduledStartMinute ?? null,
          date: taskData.date ?? null,
          scheduling: taskData.scheduling ?? { mode: 'flexible', date: null },
          execution: taskData.execution ?? { activeState: 'planned', totalPausedMinutes: 0 },
        },
      ];
      tasksRef.current = nextTasks;
      persist(nextTasks, eventsRef.current);
      return nextTasks;
    });
    return id;
  };

  const addEvent = ({ title, date, startMinute, endMinute, notes, scheduling, entities, executionRequirement, status, execution }: NewEvent): string => {
    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setEvents((currentEvents) => {
      const nextEvents = [
        ...currentEvents,
        {
          id,
          title,
          scheduling: scheduling ?? {
            mode: 'fixed',
            date: date ?? '',
            startMinute: startMinute ?? 0,
            endMinute: endMinute ?? 0,
          },
          entities,
          executionRequirement,
          date: date ?? '',
          startMinute: startMinute ?? 0,
          endMinute: endMinute ?? 0,
          notes,
          status: (status ?? 'pending') as TaskStatus,
          execution: execution ?? { activeState: 'planned', totalPausedMinutes: 0 },
        },
      ];
      eventsRef.current = nextEvents;
      persist(tasksRef.current, nextEvents);
      return nextEvents;
    });
    return id;
  };

  const updateEvent = (
    id: string,
    updates: Partial<Pick<Event, 'title' | 'date' | 'startMinute' | 'endMinute' | 'notes' | 'scheduling' | 'entities' | 'executionRequirement' | 'status'>>
  ) => {
    setEvents((currentEvents) => {
      const nextEvents = currentEvents.map((evt) => (evt.id === id ? { ...evt, ...updates } : evt));
      eventsRef.current = nextEvents;
      persist(tasksRef.current, nextEvents);
      return nextEvents;
    });
  };

  const startTask = (id: string) => {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    setTasks((current) => {
      const next = current.map(t => {
        if (t.id !== id) return t;
        return {
          ...t,
          execution: {
            ...t.execution,
            activeState: 'running' as const,
            actualStartMinute: currentMinute,
            totalPausedMinutes: t.execution?.totalPausedMinutes || 0,
          }
        };
      });
      tasksRef.current = next;
      persist(next, eventsRef.current);
      return next;
    });
  };

  const pauseTask = (id: string) => {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    setTasks((current) => {
      const next = current.map(t => {
        if (t.id !== id || t.execution?.activeState !== 'running') return t;
        return {
          ...t,
          execution: {
            ...t.execution,
            activeState: 'paused' as const,
            lastPausedAtMinute: currentMinute,
          }
        };
      });
      tasksRef.current = next;
      persist(next, eventsRef.current);
      return next;
    });
  };

  const resumeTask = (id: string) => {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    setTasks((current) => {
      const next = current.map(t => {
        if (t.id !== id || t.execution?.activeState !== 'paused') return t;
        const pausedDuration = t.execution.lastPausedAtMinute ? currentMinute - t.execution.lastPausedAtMinute : 0;
        return {
          ...t,
          execution: {
            ...t.execution,
            activeState: 'running' as const,
            totalPausedMinutes: (t.execution.totalPausedMinutes || 0) + pausedDuration,
            lastPausedAtMinute: undefined,
          }
        };
      });
      tasksRef.current = next;
      persist(next, eventsRef.current);
      return next;
    });
  };

  const completeEvent = (id: string) => {
    updateEvent(id, { status: 'completed' });
  };

  const skipEvent = (id: string) => {
    updateEvent(id, { status: 'skipped' });
  };

  const deleteTask = (id: string) => {
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.filter((task) => task.id !== id);
      tasksRef.current = nextTasks;
      persist(nextTasks, eventsRef.current);
      return nextTasks;
    });
  };

  const deleteEvent = (id: string) => {
    setEvents((currentEvents) => {
      const nextEvents = currentEvents.filter((e) => e.id !== id);
      eventsRef.current = nextEvents;
      persist(tasksRef.current, nextEvents);
      return nextEvents;
    });
  };

  const getTasksForDate = (date: string): Task[] => {
    return tasks.filter((task) => task.scheduling.date === date || task.date === date);
  };

  const getEventsForDate = (date: string): Event[] => {
    return events.filter((event) => event.scheduling.date === date || event.date === date);
  };

  // Re-synchronize notifications whenever tasks or events update
  useEffect(() => {
    if (isHydrated.current) {
      syncScheduleNotifications({ tasks, events }).catch(() => {});
    }
  }, [tasks, events]);

  const value: TasksContextValue = {
    tasks,
    events,
    addTask,
    updateTask,
    addEvent,
    updateEvent,
    startTask,
    pauseTask,
    resumeTask,
    completeTask: (id: string) => updateTaskStatus(id, 'completed'),
    skipTask: (id: string) => updateTaskStatus(id, 'skipped'),
    completeEvent,
    skipEvent,
    deleteTask,
    deleteEvent,
    getTasksForDate,
    getEventsForDate,
    requestNotificationPermission: requestNotificationPermissionAsync,
    isNotificationsEnabled: isNotificationEnabledAsync,
    syncNotifications: () => syncScheduleNotifications({ tasks: tasksRef.current, events: eventsRef.current }),
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const context = useContext(TasksContext);

  if (!context) {
    throw new Error('useTasks must be used within a TasksProvider');
  }

  return context;
}
