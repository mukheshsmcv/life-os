import { createContext, PropsWithChildren, useContext, useState } from 'react';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed' | 'skipped';

export type Task = {
  id: string;
  title: string;
  durationMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  scheduledStartMinute: number | null;
  /**
   * YYYY-MM-DD when the task is explicitly assigned to a calendar date.
   * null / undefined means the task is undated — it belongs to no specific day.
   *
   * Rules:
   *  - "Add pharmacology" (no date) → null
   *  - "Add pharmacology today"     → today's YYYY-MM-DD
   *  - "Add pharmacology tomorrow"  → tomorrow's YYYY-MM-DD
   *
   * The deterministic scheduler may place an undated task into today's schedule,
   * but that scheduling decision DOES NOT change the task's date field.
   */
  date?: string | null;
};

type NewTask = Pick<Task, 'title' | 'durationMinutes' | 'priority'> & {
  /**
   * YYYY-MM-DD to pin the task to a specific calendar day.
   * Omit (or pass null) to create an undated task.
   */
  date?: string | null;
};

export type Event = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startMinute: number;
  endMinute: number;
  notes?: string;
};

export type NewEvent = Omit<Event, 'id'>;

type TasksContextValue = {
  tasks: Task[];
  events: Event[];
  addTask: (task: NewTask) => void;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'date'>>) => void;
  addEvent: (event: NewEvent) => void;
  completeTask: (id: string) => void;
  skipTask: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteEvent: (id: string) => void;
  getTasksForDate: (date: string) => Task[];
  getEventsForDate: (date: string) => Event[];
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
    scheduledStartMinute: 18 * 60,
    date: null,
  },
  {
    id: 'break',
    title: 'Break',
    durationMinutes: 15,
    priority: 'low',
    status: 'pending',
    scheduledStartMinute: 19 * 60 + 10,
    date: null,
  },
  {
    id: 'gym',
    title: 'Gym',
    durationMinutes: 60,
    priority: 'medium',
    status: 'pending',
    scheduledStartMinute: 19 * 60 + 35,
    date: null,
  },
  {
    id: 'dinner',
    title: 'Dinner',
    durationMinutes: 45,
    priority: 'low',
    status: 'pending',
    scheduledStartMinute: 20 * 60 + 45,
    date: null,
  },
  {
    id: 'revision',
    title: 'Revision',
    durationMinutes: 45,
    priority: 'high',
    status: 'pending',
    scheduledStartMinute: 21 * 60 + 40,
    date: null,
  },
];

const initialEvents: Event[] = [];

export function TasksProvider({ children }: PropsWithChildren) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [events, setEvents] = useState<Event[]>(initialEvents);

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === id ? { ...task, status } : task))
    );
  };

  const updateTask = (
    id: string,
    updates: Partial<Pick<Task, 'title' | 'durationMinutes' | 'priority' | 'date'>>
  ) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );
  };

  const addTask = ({ title, durationMinutes, priority, date }: NewTask) => {
    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        durationMinutes,
        priority,
        status: 'pending',
        scheduledStartMinute: null,
        date: date ?? null,
      },
    ]);
  };

  const addEvent = ({ title, date, startMinute, endMinute, notes }: NewEvent) => {
    setEvents((currentEvents) => [
      ...currentEvents,
      {
        id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        date,
        startMinute,
        endMinute,
        notes,
      },
    ]);
  };

  const deleteEvent = (id: string) => {
    setEvents((currentEvents) => currentEvents.filter((e) => e.id !== id));
  };

  const getTasksForDate = (date: string): Task[] => {
    return tasks.filter((task) => task.date === date);
  };

  const getEventsForDate = (date: string): Event[] => {
    return events.filter((event) => event.date === date);
  };

  const value: TasksContextValue = {
    tasks,
    events,
    addTask,
    updateTask,
    addEvent,
    completeTask: (id: string) => updateTaskStatus(id, 'completed'),
    skipTask: (id: string) => updateTaskStatus(id, 'skipped'),
    deleteTask: (id: string) =>
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id)),
    deleteEvent,
    getTasksForDate,
    getEventsForDate,
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
