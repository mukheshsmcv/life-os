"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksProvider = TasksProvider;
exports.useTasks = useTasks;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const local_storage_1 = require("@/lib/storage/local-storage");
const TasksContext = (0, react_1.createContext)(null);
/**
 * Seed tasks are intentionally undated (date: null).
 * They will appear on Today because the Today screen includes undated tasks,
 * but they are not pinned to any calendar date.
 */
const initialTasks = [
    {
        id: 'study-pharmacology',
        title: 'Study Pharmacology',
        durationMinutes: 60,
        priority: 'high',
        status: 'pending',
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
const initialEvents = [];
function normalizeTask(task) {
    if (task.scheduling)
        return task;
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
function normalizeEvent(ev) {
    if (ev.scheduling)
        return ev;
    return {
        ...ev,
        scheduling: {
            mode: 'fixed',
            date: ev.date,
            startMinute: ev.startMinute,
            endMinute: ev.endMinute,
        }
    };
}
function TasksProvider({ children }) {
    const [tasks, setTasks] = (0, react_1.useState)(initialTasks);
    const [events, setEvents] = (0, react_1.useState)(initialEvents);
    const isHydrated = (0, react_1.useRef)(false);
    const tasksRef = (0, react_1.useRef)(tasks);
    const eventsRef = (0, react_1.useRef)(events);
    tasksRef.current = tasks;
    eventsRef.current = events;
    (0, react_1.useEffect)(() => {
        let isMounted = true;
        async function hydrate() {
            const restored = await (0, local_storage_1.loadStorageState)();
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
    const persist = (nextTasks, nextEvents) => {
        if (isHydrated.current) {
            (0, local_storage_1.saveStorageState)(nextTasks, nextEvents);
        }
    };
    const updateTaskStatus = (id, status) => {
        setTasks((currentTasks) => {
            const nextTasks = currentTasks.map((task) => (task.id === id ? { ...task, status } : task));
            tasksRef.current = nextTasks;
            persist(nextTasks, eventsRef.current);
            return nextTasks;
        });
    };
    const updateTask = (id, updates) => {
        setTasks((currentTasks) => {
            const nextTasks = currentTasks.map((task) => (task.id === id ? { ...task, ...updates } : task));
            tasksRef.current = nextTasks;
            persist(nextTasks, eventsRef.current);
            return nextTasks;
        });
    };
    const addTask = ({ title, durationMinutes, priority, date, scheduledStartMinute, scheduling, entities, executionRequirement }) => {
        const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setTasks((currentTasks) => {
            const nextTasks = [
                ...currentTasks,
                {
                    id,
                    title,
                    durationMinutes,
                    priority,
                    status: 'pending',
                    scheduling: scheduling ?? {
                        mode: 'flexible',
                        date: date ?? null,
                        startMinute: scheduledStartMinute ?? null,
                        endMinute: scheduledStartMinute !== null && scheduledStartMinute !== undefined ? scheduledStartMinute + durationMinutes : null,
                    },
                    entities,
                    executionRequirement,
                    scheduledStartMinute: scheduledStartMinute ?? null,
                    date: date ?? null,
                },
            ];
            tasksRef.current = nextTasks;
            persist(nextTasks, eventsRef.current);
            return nextTasks;
        });
        return id;
    };
    const addEvent = ({ title, date, startMinute, endMinute, notes, scheduling, entities, executionRequirement }) => {
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
                },
            ];
            eventsRef.current = nextEvents;
            persist(tasksRef.current, nextEvents);
            return nextEvents;
        });
        return id;
    };
    const updateEvent = (id, updates) => {
        setEvents((currentEvents) => {
            const nextEvents = currentEvents.map((evt) => (evt.id === id ? { ...evt, ...updates } : evt));
            eventsRef.current = nextEvents;
            persist(tasksRef.current, nextEvents);
            return nextEvents;
        });
    };
    const deleteTask = (id) => {
        setTasks((currentTasks) => {
            const nextTasks = currentTasks.filter((task) => task.id !== id);
            tasksRef.current = nextTasks;
            persist(nextTasks, eventsRef.current);
            return nextTasks;
        });
    };
    const deleteEvent = (id) => {
        setEvents((currentEvents) => {
            const nextEvents = currentEvents.filter((e) => e.id !== id);
            eventsRef.current = nextEvents;
            persist(tasksRef.current, nextEvents);
            return nextEvents;
        });
    };
    const getTasksForDate = (date) => {
        return tasks.filter((task) => task.scheduling.date === date || task.date === date);
    };
    const getEventsForDate = (date) => {
        return events.filter((event) => event.scheduling.date === date || event.date === date);
    };
    const value = {
        tasks,
        events,
        addTask,
        updateTask,
        addEvent,
        updateEvent,
        completeTask: (id) => updateTaskStatus(id, 'completed'),
        skipTask: (id) => updateTaskStatus(id, 'skipped'),
        deleteTask: (id) => setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id)),
        deleteEvent,
        getTasksForDate,
        getEventsForDate,
    };
    return (0, jsx_runtime_1.jsx)(TasksContext.Provider, { value: value, children: children });
}
function useTasks() {
    const context = (0, react_1.useContext)(TasksContext);
    if (!context) {
        throw new Error('useTasks must be used within a TasksProvider');
    }
    return context;
}
