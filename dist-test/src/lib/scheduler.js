"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SCHEDULING_SETTINGS = void 0;
exports.scheduleTasks = scheduleTasks;
exports.DEFAULT_SCHEDULING_SETTINGS = {
    planningStartMinute: 8 * 60,
    planningEndMinute: 23 * 60,
    unavailableStartMinute: 23 * 60,
    unavailableEndMinute: 8 * 60,
    bufferMinutes: 10,
};
const priorityRank = {
    high: 0,
    medium: 1,
    low: 2,
};
function toDate(referenceDate, minute) {
    const date = new Date(referenceDate);
    date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return date;
}
function sortBlocks(blocks) {
    return [...blocks].sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute);
}
function findFirstAvailableStart(blocks, durationMinutes, earliestStartMinute, settings) {
    let candidateStart = earliestStartMinute;
    for (const block of sortBlocks(blocks)) {
        if (candidateStart + durationMinutes <= block.startMinute - settings.bufferMinutes) {
            return candidateStart;
        }
        candidateStart = Math.max(candidateStart, block.endMinute + settings.bufferMinutes);
    }
    return candidateStart + durationMinutes <= settings.planningEndMinute
        ? candidateStart
        : null;
}
function chooseNextTask(tasks, blocks, earliestStartMinute, settings) {
    const firstTask = tasks[0];
    const firstStart = findFirstAvailableStart(blocks, firstTask.durationMinutes, earliestStartMinute, settings);
    if (firstStart === null) {
        return { task: firstTask, startMinute: null };
    }
    for (const candidate of tasks.slice(1)) {
        if (candidate.durationMinutes <= firstTask.durationMinutes)
            continue;
        const candidateStart = findFirstAvailableStart(blocks, candidate.durationMinutes, earliestStartMinute, settings);
        if (candidateStart === null)
            continue;
        const blocksAfterFirst = [
            ...blocks,
            {
                taskId: firstTask.id,
                startMinute: firstStart,
                endMinute: firstStart + firstTask.durationMinutes,
            },
        ];
        const candidateAfterFirst = findFirstAvailableStart(blocksAfterFirst, candidate.durationMinutes, earliestStartMinute, settings);
        if (candidateAfterFirst === null) {
            return { task: candidate, startMinute: candidateStart };
        }
    }
    return { task: firstTask, startMinute: firstStart };
}
function scheduleTasks(tasks, settings, currentDate, events) {
    const pendingTasks = tasks
        .map((task, creationIndex) => ({ ...task, creationIndex }))
        .filter((task) => task.status === 'pending');
    const blocks = [];
    const unscheduledTaskIds = [];
    // Pre-occupy schedule with fixed events (fixed time commitments)
    if (events && events.length > 0) {
        for (const ev of events) {
            blocks.push({
                taskId: `event-${ev.id}`,
                startMinute: ev.startMinute,
                endMinute: ev.endMinute,
            });
        }
    }
    const fixedTasks = pendingTasks
        .filter((task) => task.scheduledStartMinute !== null)
        .sort((left, right) => left.scheduledStartMinute - right.scheduledStartMinute ||
        left.creationIndex - right.creationIndex);
    for (const task of fixedTasks) {
        const startMinute = task.scheduledStartMinute;
        const endMinute = startMinute + task.durationMinutes;
        const previousBlock = sortBlocks(blocks).at(-1);
        const fitsWindow = startMinute >= settings.planningStartMinute && endMinute <= settings.planningEndMinute;
        const hasBufferBefore = !previousBlock || startMinute >= previousBlock.endMinute + settings.bufferMinutes;
        if (!fitsWindow || !hasBufferBefore) {
            unscheduledTaskIds.push(task.id);
            continue;
        }
        blocks.push({ taskId: task.id, startMinute, endMinute });
    }
    const currentMinute = currentDate.getHours() * 60 + currentDate.getMinutes();
    const earliestStartMinute = Math.max(settings.planningStartMinute, currentMinute);
    const automaticTasks = pendingTasks
        .filter((task) => task.scheduledStartMinute === null)
        .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] ||
        left.creationIndex - right.creationIndex);
    for (const priority of ['high', 'medium', 'low']) {
        const remainingTasks = automaticTasks.filter((task) => task.priority === priority);
        while (remainingTasks.length > 0) {
            const { task, startMinute } = chooseNextTask(remainingTasks, blocks, earliestStartMinute, settings);
            remainingTasks.splice(remainingTasks.indexOf(task), 1);
            if (startMinute === null) {
                unscheduledTaskIds.push(task.id);
                continue;
            }
            blocks.push({
                taskId: task.id,
                startMinute,
                endMinute: startMinute + task.durationMinutes,
            });
        }
    }
    return {
        blocks: sortBlocks(blocks).map((block) => ({
            ...block,
            start: toDate(currentDate, block.startMinute),
            end: toDate(currentDate, block.endMinute),
        })),
        unscheduledTaskIds: Array.from(new Set(unscheduledTaskIds)),
    };
}
