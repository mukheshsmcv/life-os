// Regression test suite for BUG 1 ("What's next?") and BUG 2 (duplicate create_task)

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function nowInIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function toYMD(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayString() {
  const d = nowInIST();
  return toYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function formatDisplayDate(dateStr) {
  const today = getTodayString();
  if (dateStr === today) return 'Today';
  return dateStr;
}

function formatTime(date) {
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins} ${period}`;
}

// ─── Deduplication logic (mirrors src/ai/action-executor.ts) ───────────────────

function areCreateTasksEquivalent(a, b) {
  const normTitleA = a.title.trim().toLowerCase();
  const normTitleB = b.title.trim().toLowerCase();
  const dateA = a.date ?? null;
  const dateB = b.date ?? null;
  const startA = a.scheduledStartMinute ?? null;
  const startB = b.scheduledStartMinute ?? null;

  return (
    normTitleA === normTitleB &&
    a.durationMinutes === b.durationMinutes &&
    a.priority === b.priority &&
    dateA === dateB &&
    startA === startB
  );
}

function deduplicateActions(actions) {
  const seenCreateTasks = [];
  const result = [];

  for (const action of actions) {
    if (action.type === 'create_task') {
      const isDuplicate = seenCreateTasks.some((seen) =>
        areCreateTasksEquivalent(seen, action.payload)
      );
      if (isDuplicate) {
        continue;
      }
      seenCreateTasks.push(action.payload);
    }
    result.push(action);
  }

  return result;
}

// ─── Scheduler logic (mirrors src/lib/scheduler.ts) ────────────────────────────

const DEFAULT_SCHEDULING_SETTINGS = {
  planningStartMinute: 8 * 60,
  planningEndMinute: 23 * 60,
  unavailableStartMinute: 23 * 60,
  unavailableEndMinute: 8 * 60,
  bufferMinutes: 10,
};

function toDate(referenceDate, minute) {
  const date = new Date(referenceDate);
  date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return date;
}

function sortBlocks(blocks) {
  return [...blocks].sort(
    (left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute
  );
}

function scheduleTasks(tasks, settings, currentDate) {
  const pendingTasks = tasks
    .map((task, creationIndex) => ({ ...task, creationIndex }))
    .filter((task) => task.status === 'pending');
  const blocks = [];
  const unscheduledTaskIds = [];

  const fixedTasks = pendingTasks
    .filter((task) => task.scheduledStartMinute !== null)
    .sort(
      (left, right) =>
        left.scheduledStartMinute - right.scheduledStartMinute ||
        left.creationIndex - right.creationIndex
    );

  for (const task of fixedTasks) {
    const startMinute = task.scheduledStartMinute;
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

  return {
    blocks: sortBlocks(blocks).map((block) => ({
      ...block,
      start: toDate(currentDate, block.startMinute),
      end: toDate(currentDate, block.endMinute),
    })),
    unscheduledTaskIds: Array.from(new Set(unscheduledTaskIds)),
  };
}

// ─── Action execution logic (mirrors src/ai/action-executor.ts) ───────────────

function executeAction(action, context) {
  const currentTime = context.currentTime ?? new Date();
  const settings = context.settings ?? DEFAULT_SCHEDULING_SETTINGS;

  switch (action.type) {
    case 'create_task': {
      const { title, durationMinutes, priority, date: rawDate, scheduledStartMinute } = action.payload;

      if (context.createdTasksHistory) {
        const isDuplicate = context.createdTasksHistory.some((seen) =>
          areCreateTasksEquivalent(seen, action.payload)
        );
        if (isDuplicate) {
          return {
            success: true,
            message: `(Duplicate creation of "${title}" skipped)`,
          };
        }
        context.createdTasksHistory.push(action.payload);
      }

      const taskDate = rawDate ?? null;
      const startMin = scheduledStartMinute ?? null;
      context.operations.addTask({ title, durationMinutes, priority, date: taskDate, scheduledStartMinute: startMin });

      return {
        success: true,
        message: `✓ Added "${title}".`,
      };
    }

    case 'get_schedule': {
      const todayStr = getTodayString();
      const targetDateStr = action.payload?.date ?? todayStr;
      const dateLabel = formatDisplayDate(targetDateStr);
      const targetTitle = dateLabel === 'Today' ? 'today' : `on ${dateLabel}`;

      const tasksForDate = context.tasks.filter((t) => {
        if (targetDateStr === todayStr) {
          return t.date === todayStr || t.date == null;
        }
        return t.date === targetDateStr;
      });

      const schedule = scheduleTasks(tasksForDate, settings, currentTime);
      const taskMap = new Map(context.tasks.map((t) => [t.id, t]));

      if (action.payload?.scope === 'next') {
        let nextBlock = null;
        const inProgressIndex = schedule.blocks.findIndex(
          (b) => currentTime >= b.start && currentTime < b.end
        );

        if (inProgressIndex !== -1) {
          nextBlock = schedule.blocks[inProgressIndex + 1] ?? null;
        } else {
          nextBlock = schedule.blocks.find((b) => b.start > currentTime) ?? null;
        }

        if (!nextBlock) {
          const noActivityMsg =
            targetDateStr === todayStr
              ? 'You have nothing else scheduled today.'
              : `You have nothing else scheduled ${targetTitle}.`;
          return {
            success: true,
            message: noActivityMsg,
          };
        }

        const task = taskMap.get(nextBlock.taskId);
        const title = task?.title ?? 'Activity';
        return {
          success: true,
          message: `Next: ${title}, ${formatTime(nextBlock.start)}–${formatTime(nextBlock.end)}.`,
        };
      }

      if (schedule.blocks.length === 0) {
        return {
          success: true,
          message: `Your schedule for ${targetTitle} is completely clear!`,
        };
      }

      const scheduleLines = schedule.blocks.map((block) => {
        const task = taskMap.get(block.taskId);
        return `• ${formatTime(block.start)} — ${formatTime(block.end)}: ${task?.title ?? 'Task'} (${task?.durationMinutes ?? 0}m)`;
      });

      return {
        success: true,
        message: `Here is your schedule for ${targetTitle}:\n\n${scheduleLines.join('\n')}`,
      };
    }
    default:
      return { success: false, message: 'Unknown action' };
  }
}

// ─── Test Suite Execution ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, description) {
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${description}`);
  } else {
    failed++;
    console.error(`✗ FAIL: ${description}`);
  }
}

console.log('--- STARTING DEVICE-TEST FIX REGRESSION SUITE ---\n');

// BUG 1 TESTS
console.log('BUG 1: Next Activity Query vs Full Schedule');

const testDate = getTodayString();
const tasksForSchedule = [
  { id: 't-break', title: 'Break', durationMinutes: 15, priority: 'low', status: 'pending', scheduledStartMinute: 19 * 60 + 10, date: testDate }, // 7:10 PM - 7:25 PM
  { id: 't-gym', title: 'Gym', durationMinutes: 60, priority: 'medium', status: 'pending', scheduledStartMinute: 19 * 60 + 35, date: testDate },    // 7:35 PM - 8:35 PM
  { id: 't-dinner', title: 'Dinner', durationMinutes: 45, priority: 'high', status: 'pending', scheduledStartMinute: 20 * 60 + 45, date: testDate }, // 8:45 PM - 9:30 PM
  { id: 't-revision', title: 'Revision', durationMinutes: 45, priority: 'high', status: 'pending', scheduledStartMinute: 21 * 60 + 40, date: testDate }, // 9:40 PM - 10:25 PM
];

const dummyOps = { addTask: () => {} };

// 1. Before first block (6:30 PM) -> returns first block (Break, 7:10 PM–7:25 PM)
const tBefore = toDate(new Date(), 18 * 60 + 30);
const resBefore = executeAction(
  { type: 'get_schedule', payload: { scope: 'next' } },
  { tasks: tasksForSchedule, operations: dummyOps, currentTime: tBefore }
);
assert(resBefore.success && resBefore.message === 'Next: Break, 7:10 PM–7:25 PM.', '1. Before first block -> returns first block');

// 2. During a block (7:20 PM during Break 7:10-7:25) -> returns next block after it (Gym, 7:35 PM–8:35 PM)
const tDuring = toDate(new Date(), 19 * 60 + 20);
const resDuring = executeAction(
  { type: 'get_schedule', payload: { scope: 'next' } },
  { tasks: tasksForSchedule, operations: dummyOps, currentTime: tDuring }
);
assert(resDuring.success && resDuring.message === 'Next: Gym, 7:35 PM–8:35 PM.', '2. During a block (7:20 PM) -> returns next block after it');

// 3. Between blocks (7:30 PM, between 7:25 Break end and 7:35 Gym start) -> returns next future block (Gym, 7:35 PM–8:35 PM)
const tBetween = toDate(new Date(), 19 * 60 + 30);
const resBetween = executeAction(
  { type: 'get_schedule', payload: { scope: 'next' } },
  { tasks: tasksForSchedule, operations: dummyOps, currentTime: tBetween }
);
assert(resBetween.success && resBetween.message === 'Next: Gym, 7:35 PM–8:35 PM.', '3. Between blocks (7:30 PM) -> returns next future block');

// 4. After final block (10:45 PM, after Revision ends at 10:25 PM) -> returns no-next-activity
const tAfter = toDate(new Date(), 22 * 60 + 45);
const resAfter = executeAction(
  { type: 'get_schedule', payload: { scope: 'next' } },
  { tasks: tasksForSchedule, operations: dummyOps, currentTime: tAfter }
);
assert(resAfter.success && resAfter.message === 'You have nothing else scheduled today.', '4. After final block -> returns "You have nothing else scheduled today."');

// 5. Full schedule remains unchanged
const resFull = executeAction(
  { type: 'get_schedule', payload: { scope: 'full' } },
  { tasks: tasksForSchedule, operations: dummyOps, currentTime: tBefore }
);
assert(resFull.success && resFull.message.includes('• 7:10 PM — 7:25 PM: Break') && resFull.message.includes('• 7:35 PM — 8:35 PM: Gym'), '5. Full schedule query returns complete schedule list');

// BUG 2 TESTS
console.log('\nBUG 2: Duplicate create_task & Scheduler Deduplication');

const createdTasks = [];
const trackingOps = {
  addTask: (t) => { createdTasks.push(t); },
};

// 6. duplicate identical create_task actions => one task created
const actA = { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', date: '2026-09-15', scheduledStartMinute: null } };
const actB = { type: 'create_task', payload: { title: 'surgery', durationMinutes: 60, priority: 'high', date: '2026-09-15', scheduledStartMinute: null } };

const dedupedActions = deduplicateActions([actA, actB]);
assert(dedupedActions.length === 1, '6a. deduplicateActions reduces 2 identical create_task actions to 1');

createdTasks.length = 0;
for (const act of dedupedActions) {
  executeAction(act, { tasks: [], operations: trackingOps });
}
assert(createdTasks.length === 1, '6b. Duplicate identical create_task actions => one task created');

// 7. same title but different duration => both created
createdTasks.length = 0;
const actDiffDur = [
  { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high' } },
  { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 120, priority: 'high' } },
];
for (const act of deduplicateActions(actDiffDur)) {
  executeAction(act, { tasks: [], operations: trackingOps });
}
assert(createdTasks.length === 2 && createdTasks[0].durationMinutes === 60 && createdTasks[1].durationMinutes === 120, '7. Same title but different duration => both created');

// 8. same title but different priority => both created
createdTasks.length = 0;
const actDiffPri = [
  { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high' } },
  { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'low' } },
];
for (const act of deduplicateActions(actDiffPri)) {
  executeAction(act, { tasks: [], operations: trackingOps });
}
assert(createdTasks.length === 2 && createdTasks[0].priority === 'high' && createdTasks[1].priority === 'low', '8. Same title but different priority => both created');

// 9. same title but different date => both created
createdTasks.length = 0;
const actDiffDate = [
  { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', date: '2026-09-15' } },
  { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', date: '2026-09-16' } },
];
for (const act of deduplicateActions(actDiffDate)) {
  executeAction(act, { tasks: [], operations: trackingOps });
}
assert(createdTasks.length === 2 && createdTasks[0].date === '2026-09-15' && createdTasks[1].date === '2026-09-16', '9. Same title but different date => both created');

// 10. same title but different scheduledStartMinute => both created
createdTasks.length = 0;
const actDiffStart = [
  { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', scheduledStartMinute: 540 } },
  { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', scheduledStartMinute: 600 } },
];
for (const act of deduplicateActions(actDiffStart)) {
  executeAction(act, { tasks: [], operations: trackingOps });
}
assert(createdTasks.length === 2 && createdTasks[0].scheduledStartMinute === 540 && createdTasks[1].scheduledStartMinute === 600, '10. Same title but different scheduledStartMinute => both created');

// 11. scheduler unscheduledTaskIds contains unique IDs
const conflictTasks = [
  { id: 'conf-1', title: 'Task A', durationMinutes: 120, priority: 'high', status: 'pending', scheduledStartMinute: 100, date: testDate },
  { id: 'conf-2', title: 'Task B', durationMinutes: 120, priority: 'high', status: 'pending', scheduledStartMinute: 100, date: testDate },
];
const schedResult = scheduleTasks(conflictTasks, DEFAULT_SCHEDULING_SETTINGS, new Date());
const uniqueIds = Array.from(new Set(schedResult.unscheduledTaskIds));
assert(schedResult.unscheduledTaskIds.length === uniqueIds.length, '11. scheduler unscheduledTaskIds contains unique IDs');

// 12. legitimate duplicate-title tasks remain separate
const legitimateDuplicates = [
  { id: 'legit-1', title: 'Surgery', durationMinutes: 60, priority: 'high', status: 'pending', scheduledStartMinute: 540, date: testDate },
  { id: 'legit-2', title: 'Surgery', durationMinutes: 60, priority: 'high', status: 'pending', scheduledStartMinute: 660, date: testDate },
];
const legitSched = scheduleTasks(legitimateDuplicates, DEFAULT_SCHEDULING_SETTINGS, new Date());
assert(legitSched.blocks.length === 2 && legitSched.blocks[0].taskId === 'legit-1' && legitSched.blocks[1].taskId === 'legit-2', '12. Legitimate duplicate-title tasks remain separate');

// 13. Shared execution boundary protection with createdTasksHistory
createdTasks.length = 0;
const sharedCtx = {
  tasks: [],
  operations: trackingOps,
  createdTasksHistory: [],
};
executeAction(actA, sharedCtx);
executeAction(actB, sharedCtx);
assert(createdTasks.length === 1, '13. Shared context createdTasksHistory prevents duplicate mutation when called sequentially');

console.log(`\n=========================================`);
console.log(`REGRESSION FIXES TEST RESULTS: ${passed}/${passed + failed} PASSED, ${failed} FAILED`);
console.log(`=========================================`);
if (failed > 0) process.exit(1);
