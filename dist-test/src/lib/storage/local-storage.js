"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStorageState = loadStorageState;
exports.saveStorageState = saveStorageState;
if (typeof window === 'undefined' && typeof globalThis !== 'undefined') {
    const mockMemoryStore = new Map();
    globalThis.window = globalThis.window || {
        localStorage: {
            getItem: (key) => mockMemoryStore.get(key) ?? null,
            setItem: (key, value) => mockMemoryStore.set(key, value),
            removeItem: (key) => mockMemoryStore.delete(key),
            clear: () => mockMemoryStore.clear(),
        },
    };
}
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const types_1 = require("./types");
function isValidTask(task) {
    if (!task || typeof task !== 'object')
        return false;
    const t = task;
    if (typeof t.id !== 'string' || !t.id)
        return false;
    if (typeof t.title !== 'string' || !t.title)
        return false;
    if (typeof t.durationMinutes !== 'number' || t.durationMinutes <= 0)
        return false;
    if (!['low', 'medium', 'high'].includes(t.priority))
        return false;
    if (!['pending', 'completed', 'skipped'].includes(t.status))
        return false;
    if (t.scheduledStartMinute !== null && t.scheduledStartMinute !== undefined) {
        if (typeof t.scheduledStartMinute !== 'number' || t.scheduledStartMinute < 0 || t.scheduledStartMinute > 1439) {
            return false;
        }
    }
    if (t.date !== undefined && t.date !== null) {
        if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
            return false;
        }
    }
    return true;
}
function isValidEvent(event) {
    if (!event || typeof event !== 'object')
        return false;
    const e = event;
    if (typeof e.id !== 'string' || !e.id)
        return false;
    if (typeof e.title !== 'string' || !e.title)
        return false;
    if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date))
        return false;
    if (typeof e.startMinute !== 'number' || e.startMinute < 0 || e.startMinute > 1439)
        return false;
    if (typeof e.endMinute !== 'number' || e.endMinute < 0 || e.endMinute > 1439)
        return false;
    if (e.notes !== undefined && e.notes !== null && typeof e.notes !== 'string')
        return false;
    return true;
}
async function loadStorageState() {
    try {
        const jsonStr = await async_storage_1.default.getItem(types_1.STORAGE_KEY);
        if (!jsonStr)
            return null;
        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== 'object')
            return null;
        const { version, tasks, events } = parsed;
        if (typeof version !== 'number' || version < 1)
            return null;
        if (!Array.isArray(tasks) || !Array.isArray(events))
            return null;
        const validTasks = [];
        for (const t of tasks) {
            if (isValidTask(t)) {
                validTasks.push({
                    id: t.id,
                    title: t.title,
                    durationMinutes: t.durationMinutes,
                    priority: t.priority,
                    status: t.status,
                    scheduledStartMinute: t.scheduledStartMinute ?? null,
                    date: t.date ?? null,
                    scheduling: t.scheduling || { mode: 'flexible', date: t.date ?? null, startMinute: t.scheduledStartMinute ?? null },
                    entities: t.entities,
                    executionRequirement: t.executionRequirement,
                });
            }
        }
        const validEvents = [];
        for (const e of events) {
            if (isValidEvent(e)) {
                validEvents.push({
                    id: e.id,
                    title: e.title,
                    date: e.date,
                    startMinute: e.startMinute,
                    endMinute: e.endMinute,
                    notes: e.notes ?? undefined,
                    scheduling: e.scheduling || { mode: 'fixed', date: e.date, startMinute: e.startMinute, endMinute: e.endMinute },
                    entities: e.entities,
                    executionRequirement: e.executionRequirement,
                });
            }
        }
        return { tasks: validTasks, events: validEvents };
    }
    catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[LocalStorage] Failed to load storage state:', error);
        }
        return null;
    }
}
async function saveStorageState(tasks, events) {
    try {
        const payload = {
            version: types_1.CURRENT_STORAGE_VERSION,
            tasks,
            events,
        };
        await async_storage_1.default.setItem(types_1.STORAGE_KEY, JSON.stringify(payload));
        return true;
    }
    catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[LocalStorage] Failed to save storage state:', error);
        }
        return false;
    }
}
