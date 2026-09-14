import { Task, TaskPriority } from '@/contexts/tasks-context';
import { DEFAULT_SCHEDULING_SETTINGS, scheduleTasks } from '@/lib/scheduler';
import { executeAction, areCreateTasksEquivalent, deduplicateActions, ActionExecutionContext } from './action-executor';
import { parseIntent } from './mock-intent-parser';
import { AIAction, CreateTaskAction, GetScheduleAction } from './ai-types';

export function runRegressionFixesTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      passed++;
      console.log(`PASS: ${description}`);
    } else {
      failed++;
      console.error(`FAIL: ${description}`);
    }
  }

  console.log('\n--- BUG 1: "What\'s next?" Schedule Scope & Next Activity Regression Tests ---');

  // Test 1: Parser recognizes next-query aliases with scope: 'next'
  const nextAliases = [
    "what's next?",
    "what is next?",
    "what's next on my schedule?",
    "what am I doing next?",
    "what do I do next?",
  ];

  for (const alias of nextAliases) {
    const res = parseIntent(alias);
    assert(
      res.success &&
      res.actions[0]?.type === 'get_schedule' &&
      res.actions[0].payload?.scope === 'next',
      `Parser recognizes alias "${alias}" -> get_schedule with scope='next'`
    );
  }

  // Test 2: Full-schedule queries remain full (do not classify as next)
  const fullQueries = [
    "what's my schedule?",
    "show my schedule",
    "what am I doing today?",
  ];

  for (const query of fullQueries) {
    const res = parseIntent(query);
    assert(
      res.success &&
      res.actions[0]?.type === 'get_schedule' &&
      res.actions[0].payload?.scope !== 'next',
      `Parser keeps full schedule query "${query}" -> scope != 'next'`
    );
  }

  // Define a deterministic test date and scheduled tasks
  // 2026-09-15 (Tuesday)
  const testDate = '2026-09-15';
  const tasksForSchedule: Task[] = [
    {
      id: 'task-break',
      title: 'Break',
      durationMinutes: 15,
      priority: 'low',
      status: 'pending',
      scheduledStartMinute: 19 * 60 + 10, // 7:10 PM (1150) -> ends 7:25 PM (1165)
      date: testDate,
      scheduling: { mode: "flexible" as const },
    },
    {
      id: 'task-gym',
      title: 'Gym',
      durationMinutes: 60,
      priority: 'medium',
      status: 'pending',
      scheduledStartMinute: 19 * 60 + 35, // 7:35 PM (1175) -> ends 8:35 PM (1235)
      date: testDate,
      scheduling: { mode: "flexible" as const },
    },
    {
      id: 'task-dinner',
      title: 'Dinner',
      durationMinutes: 45,
      priority: 'high',
      status: 'pending',
      scheduledStartMinute: 20 * 60 + 45, // 8:45 PM (1245) -> ends 9:30 PM (1290)
      date: testDate,
      scheduling: { mode: "flexible" as const },
    },
    {
      id: 'task-revision',
      title: 'Revision',
      durationMinutes: 45,
      priority: 'high',
      status: 'pending',
      scheduledStartMinute: 21 * 60 + 40, // 9:40 PM (1300) -> ends 10:25 PM (1345)
      date: testDate,
      scheduling: { mode: "flexible" as const },
    },
  ];

  const dummyOps = {
    addTask: () => {},
    updateTask: () => {},
    completeTask: () => {},
    skipTask: () => {},
    deleteTask: () => {},
  };

  // Test 3: Before first block (e.g. 6:30 PM) -> returns first block (Break, 7:10 PM–7:25 PM)
  const timeBeforeFirst = new Date(2026, 8, 15, 18, 30, 0); // 6:30 PM
  const resBefore = executeAction(
    { type: 'get_schedule', payload: { date: testDate, scope: 'next' } },
    { tasks: tasksForSchedule, operations: dummyOps, currentTime: timeBeforeFirst, settings: DEFAULT_SCHEDULING_SETTINGS }
  );
  assert(
    resBefore.success && (resBefore.message?.includes('Next: Break, 7:10 PM–7:25 PM.') ?? false),
    'Before first block -> returns first block ("Next: Break, 7:10 PM–7:25 PM.")'
  );

  // Test 4: During a block (e.g. 7:20 PM, during Break 7:10–7:25 PM) -> returns next block (Gym, 7:35 PM–8:35 PM)
  const timeDuringBreak = new Date(2026, 8, 15, 19, 20, 0); // 7:20 PM
  const resDuring = executeAction(
    { type: 'get_schedule', payload: { date: testDate, scope: 'next' } },
    { tasks: tasksForSchedule, operations: dummyOps, currentTime: timeDuringBreak, settings: DEFAULT_SCHEDULING_SETTINGS }
  );
  assert(
    resDuring.success && (resDuring.message?.includes('Next: Gym, 7:35 PM–8:35 PM.') ?? false),
    'During Break (7:20 PM) -> returns next block after it ("Next: Gym, 7:35 PM–8:35 PM.")'
  );

  // Test 5: During Dinner (8:50 PM, during Dinner 8:45-9:30 PM) -> returns Revision (9:40 PM-10:25 PM)
  const timeDuringDinner = new Date(2026, 8, 15, 20, 50, 0); // 8:50 PM
  const resDinner = executeAction(
    { type: 'get_schedule', payload: { date: testDate, scope: 'next' } },
    { tasks: tasksForSchedule, operations: dummyOps, currentTime: timeDuringDinner, settings: DEFAULT_SCHEDULING_SETTINGS }
  );
  assert(
    resDinner.success && (resDinner.message?.includes('Next: Revision, 9:40 PM–10:25 PM.') ?? false),
    'During Dinner (8:50 PM) -> returns next block after it ("Next: Revision, 9:40 PM–10:25 PM.")'
  );

  // Test 6: Between blocks (e.g. 7:30 PM, between Break ends 7:25 and Gym starts 7:35) -> returns Gym
  const timeBetweenBlocks = new Date(2026, 8, 15, 19, 30, 0); // 7:30 PM
  const resBetween = executeAction(
    { type: 'get_schedule', payload: { date: testDate, scope: 'next' } },
    { tasks: tasksForSchedule, operations: dummyOps, currentTime: timeBetweenBlocks, settings: DEFAULT_SCHEDULING_SETTINGS }
  );
  assert(
    resBetween.success && (resBetween.message?.includes('Next: Gym, 7:35 PM–8:35 PM.') ?? false),
    'Between blocks (7:30 PM) -> returns next future block ("Next: Gym, 7:35 PM–8:35 PM.")'
  );

  // Test 7: After final block (e.g. 10:45 PM, after Revision ends at 10:25 PM) -> returns no-next-activity message
  const timeAfterFinal = new Date(2026, 8, 15, 22, 45, 0); // 10:45 PM
  const resAfter = executeAction(
    { type: 'get_schedule', payload: { date: testDate, scope: 'next' } },
    { tasks: tasksForSchedule, operations: dummyOps, currentTime: timeAfterFinal, settings: DEFAULT_SCHEDULING_SETTINGS }
  );
  assert(
    resAfter.success && (resAfter.message?.includes('You have nothing else scheduled') ?? false),
    'After final block (10:45 PM) -> returns no-next-activity ("You have nothing else scheduled...")'
  );

  // Test 8: Full schedule query remains unchanged (returns all scheduled blocks)
  const resFull = executeAction(
    { type: 'get_schedule', payload: { date: testDate, scope: 'full' } },
    { tasks: tasksForSchedule, operations: dummyOps, currentTime: timeBeforeFirst, settings: DEFAULT_SCHEDULING_SETTINGS }
  );
  assert(
    resFull.success &&
    (resFull.message?.includes('Break') ?? false) &&
    (resFull.message?.includes('Gym') ?? false) &&
    (resFull.message?.includes('Dinner') ?? false) &&
    (resFull.message?.includes('Revision') ?? false) &&
    (resFull.message?.includes('Here is your schedule') ?? false),
    'Full schedule query -> returns complete schedule unchanged'
  );


  console.log('\n--- BUG 2: Duplicate create_task & Scheduler Deduplication Regression Tests ---');

  // Test 9: areCreateTasksEquivalent
  const baseSurgery: CreateTaskAction['payload'] = {
    title: 'Surgery',
    durationMinutes: 60,
    priority: 'high',
    date: '2026-09-15',
    scheduling: { mode: "flexible" as const },
    scheduledStartMinute: null,
  };

  const lowerSurgery: CreateTaskAction['payload'] = {
    title: 'surgery',
    durationMinutes: 60,
    priority: 'high',
    date: '2026-09-15',
    scheduling: { mode: "flexible" as const },
    scheduledStartMinute: null,
  };

  assert(
    areCreateTasksEquivalent(baseSurgery, lowerSurgery) === true,
    'areCreateTasksEquivalent: "Surgery" and "surgery" with same duration, priority, date, startMinute match'
  );

  // Test 10: duplicate identical create_task actions => one task created
  const createdTasks: any[] = [];
  const trackingOps = {
    ...dummyOps,
    addTask: (t: any) => { createdTasks.push(t); },
  };

  const duplicateActions: AIAction[] = [
    { type: 'create_task', payload: baseSurgery },
    { type: 'create_task', payload: lowerSurgery },
  ];

  const deduped1 = deduplicateActions(duplicateActions);
  assert(deduped1.length === 1, 'deduplicateActions: 2 identical create_task actions reduced to 1');

  createdTasks.length = 0;
  const execContext: ActionExecutionContext = {
    tasks: [],
    operations: trackingOps,
    createdTasksHistory: [],
  };

  for (const act of deduped1) {
    executeAction(act, execContext);
  }
  assert(createdTasks.length === 1, 'Duplicate identical create_task actions => exactly one task created');

  // Test 11: same title but different duration => both created
  const diffDurationActions: AIAction[] = [
    { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', date: '2026-09-15', scheduling: { mode: "flexible" as const }, } },
    { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 120, priority: 'high', date: '2026-09-15', scheduling: { mode: "flexible" as const }, } },
  ];
  const dedupedDuration = deduplicateActions(diffDurationActions);
  assert(dedupedDuration.length === 2, 'deduplicateActions: same title but different duration (60m vs 120m) kept as 2');

  createdTasks.length = 0;
  for (const act of dedupedDuration) {
    executeAction(act, { tasks: [], operations: trackingOps });
  }
  assert(createdTasks.length === 2, 'Same title but different duration => both created');

  // Test 12: same title but different priority => both created
  const diffPriorityActions: AIAction[] = [
    { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', date: '2026-09-15', scheduling: { mode: "flexible" as const }, } },
    { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'medium', date: '2026-09-15', scheduling: { mode: "flexible" as const }, } },
  ];
  const dedupedPriority = deduplicateActions(diffPriorityActions);
  assert(dedupedPriority.length === 2, 'deduplicateActions: same title but different priority kept as 2');

  createdTasks.length = 0;
  for (const act of dedupedPriority) {
    executeAction(act, { tasks: [], operations: trackingOps });
  }
  assert(createdTasks.length === 2, 'Same title but different priority => both created');

  // Test 13: same title but different date => both created
  const diffDateActions: AIAction[] = [
    { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', date: '2026-09-15', scheduling: { mode: "flexible" as const }, } },
    { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', date: '2026-09-16', scheduling: { mode: "flexible" as const }, } },
  ];
  const dedupedDate = deduplicateActions(diffDateActions);
  assert(dedupedDate.length === 2, 'deduplicateActions: same title but different date kept as 2');

  createdTasks.length = 0;
  for (const act of dedupedDate) {
    executeAction(act, { tasks: [], operations: trackingOps });
  }
  assert(createdTasks.length === 2, 'Same title but different date => both created');

  // Test 14: same title but different scheduledStartMinute => both created
  const diffStartMinActions: AIAction[] = [
    { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', scheduledStartMinute: 540 } },
    { type: 'create_task', payload: { title: 'Surgery', durationMinutes: 60, priority: 'high', scheduledStartMinute: 600 } },
  ];
  const dedupedStartMin = deduplicateActions(diffStartMinActions);
  assert(dedupedStartMin.length === 2, 'deduplicateActions: same title but different scheduledStartMinute kept as 2');

  createdTasks.length = 0;
  for (const act of dedupedStartMin) {
    executeAction(act, { tasks: [], operations: trackingOps });
  }
  assert(createdTasks.length === 2, 'Same title but different scheduledStartMinute => both created');

  // Test 15: Scheduler unscheduledTaskIds contains unique IDs
  // When multiple tasks cannot fit in window
  const overflowTasks: Task[] = [
    { id: 'overflow-1', title: 'Overflow 1', durationMinutes: 600, priority: 'high', status: 'pending', scheduledStartMinute: null, date: testDate, scheduling: { mode: "flexible" as const }, },
    { id: 'overflow-2', title: 'Overflow 2', durationMinutes: 600, priority: 'high', status: 'pending', scheduledStartMinute: null, date: testDate, scheduling: { mode: "flexible" as const }, },
  ];
  const schedRes = scheduleTasks(overflowTasks, DEFAULT_SCHEDULING_SETTINGS, new Date(2026, 8, 15, 8, 0, 0));
  const uniqueUnscheduled = Array.from(new Set(schedRes.unscheduledTaskIds));
  assert(
    schedRes.unscheduledTaskIds.length === uniqueUnscheduled.length,
    'Scheduler unscheduledTaskIds contains each task ID at most once (unique IDs)'
  );

  // Test 16: Legitimate duplicate-title tasks remain separate
  const legitDuplicateTasks: Task[] = [
    { id: 'surg-1', title: 'Surgery', durationMinutes: 60, priority: 'high', status: 'pending', scheduledStartMinute: 540, date: testDate, scheduling: { mode: "flexible" as const }, },
    { id: 'surg-2', title: 'Surgery', durationMinutes: 60, priority: 'high', status: 'pending', scheduledStartMinute: 660, date: testDate, scheduling: { mode: "flexible" as const }, },
  ];
  const schedLegit = scheduleTasks(legitDuplicateTasks, DEFAULT_SCHEDULING_SETTINGS, new Date(2026, 8, 15, 8, 0, 0));
  assert(
    schedLegit.blocks.length === 2 &&
    schedLegit.blocks[0].taskId === 'surg-1' &&
    schedLegit.blocks[1].taskId === 'surg-2',
    'Legitimate duplicate-title tasks with different IDs remain separate in schedule'
  );

  // Test 17: Shared execution boundary protection with createdTasksHistory
  const ctxWithHistory: ActionExecutionContext = {
    tasks: [],
    operations: trackingOps,
    createdTasksHistory: [],
  };
  createdTasks.length = 0;
  const exec1 = executeAction({ type: 'create_task', payload: baseSurgery }, ctxWithHistory);
  const exec2 = executeAction({ type: 'create_task', payload: lowerSurgery }, ctxWithHistory);
  assert(
    createdTasks.length === 1 && (exec2.message?.includes('skipped') ?? false),
    'createdTasksHistory in executeAction protects against duplicate mutations on shared context'
  );

  console.log(`\nRegression Tests Result: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} tests.`);
  return { passed, failed };
}

runRegressionFixesTests();
