"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineTodayFocus = determineTodayFocus;
const scheduler_1 = require("./scheduler");
function toYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function minuteToDate(referenceDate, minute) {
    const d = new Date(referenceDate);
    d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return d;
}
function determineTodayFocus(options) {
    const settings = options.settings ?? scheduler_1.DEFAULT_SCHEDULING_SETTINGS;
    const currentDate = options.currentDate;
    const currentMinute = options.currentMinute ?? currentDate.getHours() * 60 + currentDate.getMinutes();
    const currentDateStr = toYMD(currentDate);
    // 1. Date filtering: task.date === currentDateStr OR task.date == null
    const todayTasks = options.tasks.filter((t) => t.date === currentDateStr || t.date == null);
    const todayEvents = options.events ?? [];
    const eventMap = new Map(todayEvents.map((e) => [e.id, e]));
    const taskMap = new Map(todayTasks.map((t) => [t.id, t]));
    // 2. Delegate ALL task placement, priority sorting, and gap packing to scheduler.ts
    const scheduleResult = (0, scheduler_1.scheduleTasks)(todayTasks, settings, currentDate, todayEvents);
    // 3. Map scheduler.ts output directly to FocusItems
    const scheduledItems = scheduleResult.blocks.map((block) => {
        if (block.taskId.startsWith('event-')) {
            const evId = block.taskId.slice(6);
            const ev = eventMap.get(evId);
            return {
                kind: 'event',
                id: evId,
                title: ev?.title ?? 'Event',
                durationMinutes: block.endMinute - block.startMinute,
                startMinute: block.startMinute,
                endMinute: block.endMinute,
                start: block.start,
                end: block.end,
                reason: 'active_scheduled_block',
                reasonLabel: 'Fixed commitment',
                event: ev,
            };
        }
        else {
            const t = taskMap.get(block.taskId);
            return {
                kind: 'task',
                id: block.taskId,
                title: t?.title ?? 'Task',
                durationMinutes: t?.durationMinutes ?? block.endMinute - block.startMinute,
                startMinute: block.startMinute,
                endMinute: block.endMinute,
                start: block.start,
                end: block.end,
                reason: 'active_scheduled_block',
                reasonLabel: 'Scheduled for now',
                task: t,
            };
        }
    });
    // 4. Read state purely from scheduler output
    const activeItem = scheduledItems.find((item) => currentMinute >= item.startMinute && currentMinute < item.endMinute);
    const upcomingItems = scheduledItems.filter((item) => item.startMinute > currentMinute);
    const nextBlock = upcomingItems[0];
    // Check if active item is a floating task placed at currentMinute by scheduler
    const isAvailableGapTask = activeItem &&
        activeItem.kind === 'task' &&
        activeItem.task?.scheduledStartMinute == null;
    // Handle Paused Activity
    let isPaused = false;
    let pausedTask;
    if (options.pausedActivityId) {
        pausedTask = todayTasks.find((t) => t.id === options.pausedActivityId && t.status === 'pending');
        if (pausedTask) {
            isPaused = true;
        }
    }
    let stateKind;
    let nowItem = null;
    let upNextItems = [];
    let reasonLabel = '';
    if (isPaused && pausedTask) {
        const pausedBlock = scheduledItems.find((i) => i.id === pausedTask.id);
        nowItem = {
            kind: 'task',
            id: pausedTask.id,
            title: pausedTask.title,
            durationMinutes: pausedTask.durationMinutes,
            startMinute: pausedBlock?.startMinute ?? currentMinute,
            endMinute: pausedBlock?.endMinute ?? currentMinute + pausedTask.durationMinutes,
            start: pausedBlock?.start ?? minuteToDate(currentDate, currentMinute),
            end: pausedBlock?.end ?? minuteToDate(currentDate, currentMinute + pausedTask.durationMinutes),
            reason: 'paused_activity',
            reasonLabel: 'Activity paused',
            task: pausedTask,
        };
        stateKind = activeItem ? 'active_now' : nextBlock ? 'waiting_upcoming' : 'day_complete';
        upNextItems = upcomingItems;
        reasonLabel = 'Activity paused';
    }
    else if (activeItem) {
        stateKind = isAvailableGapTask ? 'available_now' : 'active_now';
        nowItem = activeItem;
        reasonLabel =
            activeItem.kind === 'event'
                ? 'Fixed commitment'
                : isAvailableGapTask
                    ? 'Fits the available gap'
                    : 'Scheduled for now';
        upNextItems = upcomingItems;
    }
    else if (nextBlock) {
        stateKind = 'waiting_upcoming';
        nowItem = null;
        reasonLabel = nextBlock.kind === 'event' ? 'Next fixed commitment' : 'Next scheduled block';
        upNextItems = upcomingItems;
    }
    else {
        stateKind = 'day_complete';
        nowItem = null;
        upNextItems = [];
        reasonLabel = 'No more activities today';
    }
    const scheduledTaskIds = new Set(scheduledItems.filter((i) => i.kind === 'task').map((i) => i.id));
    const unscheduledTasks = todayTasks.filter((t) => t.status === 'pending' &&
        !scheduledTaskIds.has(t.id) &&
        nowItem?.task?.id !== t.id);
    return {
        stateKind,
        nowItem,
        upNextItems,
        unscheduledTasks,
        scheduleResult,
        reasonLabel,
        isPaused,
    };
}
