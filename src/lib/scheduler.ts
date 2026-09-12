export type SchedulerPriority = 'low' | 'medium' | 'high';
export type SchedulerTask = {
  id: string;
  durationMinutes: number;
  priority: SchedulerPriority;
  status: 'pending' | 'completed' | 'skipped';
  scheduledStartMinute: number | null;
};

export type SchedulingSettings = {
  planningStartMinute: number;
  planningEndMinute: number;
  unavailableStartMinute: number;
  unavailableEndMinute: number;
  bufferMinutes: number;
};

export type ScheduledBlock = {
  taskId: string;
  start: Date;
  end: Date;
  startMinute: number;
  endMinute: number;
};

export type ScheduleResult = {
  blocks: ScheduledBlock[];
  unscheduledTaskIds: string[];
};

export const DEFAULT_SCHEDULING_SETTINGS: SchedulingSettings = {
  planningStartMinute: 8 * 60,
  planningEndMinute: 23 * 60,
  unavailableStartMinute: 23 * 60,
  unavailableEndMinute: 8 * 60,
  bufferMinutes: 10,
};

type IndexedTask = SchedulerTask & { creationIndex: number };
type MinuteBlock = { taskId: string; startMinute: number; endMinute: number };

const priorityRank: Record<SchedulerPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function toDate(referenceDate: Date, minute: number) {
  const date = new Date(referenceDate);
  date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return date;
}

function sortBlocks(blocks: MinuteBlock[]) {
  return [...blocks].sort(
    (left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute
  );
}

function findFirstAvailableStart(
  blocks: MinuteBlock[],
  durationMinutes: number,
  earliestStartMinute: number,
  settings: SchedulingSettings
) {
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

function chooseNextTask(
  tasks: IndexedTask[],
  blocks: MinuteBlock[],
  earliestStartMinute: number,
  settings: SchedulingSettings
) {
  const firstTask = tasks[0];
  const firstStart = findFirstAvailableStart(
    blocks,
    firstTask.durationMinutes,
    earliestStartMinute,
    settings
  );

  if (firstStart === null) {
    return { task: firstTask, startMinute: null };
  }

  for (const candidate of tasks.slice(1)) {
    if (candidate.durationMinutes <= firstTask.durationMinutes) continue;

    const candidateStart = findFirstAvailableStart(
      blocks,
      candidate.durationMinutes,
      earliestStartMinute,
      settings
    );
    if (candidateStart === null) continue;

    const blocksAfterFirst = [
      ...blocks,
      {
        taskId: firstTask.id,
        startMinute: firstStart,
        endMinute: firstStart + firstTask.durationMinutes,
      },
    ];
    const candidateAfterFirst = findFirstAvailableStart(
      blocksAfterFirst,
      candidate.durationMinutes,
      earliestStartMinute,
      settings
    );

    if (candidateAfterFirst === null) {
      return { task: candidate, startMinute: candidateStart };
    }
  }

  return { task: firstTask, startMinute: firstStart };
}

export type SchedulerEvent = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
};

export function scheduleTasks(
  tasks: SchedulerTask[],
  settings: SchedulingSettings,
  currentDate: Date,
  events?: SchedulerEvent[]
): ScheduleResult {
  const pendingTasks = tasks
    .map((task, creationIndex) => ({ ...task, creationIndex }))
    .filter((task) => task.status === 'pending');
  const blocks: MinuteBlock[] = [];
  const unscheduledTaskIds: string[] = [];

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
    .sort(
      (left, right) =>
        left.scheduledStartMinute! - right.scheduledStartMinute! ||
        left.creationIndex - right.creationIndex
    );

  for (const task of fixedTasks) {
    const startMinute = task.scheduledStartMinute!;
    const endMinute = startMinute + task.durationMinutes;
    const previousBlock = sortBlocks(blocks).at(-1);
    const fitsWindow =
      startMinute >= settings.planningStartMinute && endMinute <= settings.planningEndMinute;
    const hasBufferBefore =
      !previousBlock || startMinute >= previousBlock.endMinute + settings.bufferMinutes;

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
    .sort(
      (left, right) =>
        priorityRank[left.priority] - priorityRank[right.priority] ||
        left.creationIndex - right.creationIndex
    );

  for (const priority of ['high', 'medium', 'low'] as const) {
    const remainingTasks = automaticTasks.filter((task) => task.priority === priority);

    while (remainingTasks.length > 0) {
      const { task, startMinute } = chooseNextTask(
        remainingTasks,
        blocks,
        earliestStartMinute,
        settings
      );
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
    unscheduledTaskIds,
  };
}
