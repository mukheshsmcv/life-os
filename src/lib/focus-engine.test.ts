import { Task } from '@/contexts/tasks-context';
import { DEFAULT_SCHEDULING_SETTINGS, SchedulerEvent } from '@/lib/scheduler';
import { determineTodayFocus } from './focus-engine';

export function runFocusEngineTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`FAIL: ${description}`);
    }
  }

  // Deterministic test date: 2026-09-15
  const testDate = new Date(2026, 8, 15, 0, 0, 0);

  // Scenario 1: Active task correctly identified at 9:30 AM (currentMinute = 570)
  const task1: Task = {
    id: 'task-1',
    title: 'Pathology Study',
    durationMinutes: 60,
    priority: 'high',
    status: 'pending',
    scheduledStartMinute: 540, // 9:00 AM
    date: '2026-09-15',
    scheduling: { mode: "flexible" as const },
  };

  const res1 = determineTodayFocus({
    tasks: [task1],
    currentDate: testDate,
    currentMinute: 570, // 9:30 AM
  });
  assert(
    res1.stateKind === 'active_now' && res1.nowItem?.id === 'task-1',
    '1. Active task correctly identified at 9:30 AM'
  );

  // Scenario 2: Current task transitions after its end minute (10:05 AM, currentMinute = 605)
  const res2 = determineTodayFocus({
    tasks: [task1],
    currentDate: testDate,
    currentMinute: 605, // 10:05 AM (after 9:00 - 10:00 AM)
  });
  assert(
    res2.nowItem?.id !== 'task-1',
    '2. Current task transitions after its end minute (10:05 AM)'
  );

  // Scenario 3: Fixed event takes precedence over floating task
  const event1: SchedulerEvent = {
    id: 'ev-1',
    title: 'Doctor Appointment',
    startMinute: 600, // 10:00 AM
    endMinute: 660,   // 11:00 AM
  };
  const res3 = determineTodayFocus({
    tasks: [task1],
    events: [event1],
    currentDate: testDate,
    currentMinute: 615, // 10:15 AM
  });
  assert(
    res3.stateKind === 'active_now' && res3.nowItem?.kind === 'event' && res3.nowItem?.id === 'ev-1',
    '3. Fixed event takes precedence over floating task at 10:15 AM'
  );

  // Scenario 4: Explicit-time task remains at requested minute (7 PM = 1140)
  const taskExplicit: Task = {
    id: 'task-explicit',
    title: 'Evening Study',
    durationMinutes: 120,
    priority: 'low',
    status: 'pending',
    scheduledStartMinute: 1140, // 7:00 PM
    date: '2026-09-15',
    scheduling: { mode: "flexible" as const },
  };
  const res4 = determineTodayFocus({
    tasks: [taskExplicit],
    currentDate: testDate,
    currentMinute: 480, // 8:00 AM
  });
  assert(
    res4.upNextItems.some((i) => i.id === 'task-explicit' && i.startMinute === 1140),
    '4. Explicit-time task remains at requested minute (7:00 PM = 1140)'
  );

  // Scenario 5: Completed task ignored
  const taskCompleted: Task = {
    id: 'task-done',
    title: 'Done Task',
    durationMinutes: 60,
    priority: 'high',
    status: 'completed',
    scheduledStartMinute: 540,
    date: '2026-09-15',
    scheduling: { mode: "flexible" as const },
  };
  const res5 = determineTodayFocus({
    tasks: [taskCompleted],
    currentDate: testDate,
    currentMinute: 550,
  });
  assert(
    res5.nowItem?.id !== 'task-done' && res5.stateKind === 'day_complete',
    '5. Completed task ignored from NOW and focus'
  );

  // Scenario 6: Skipped task ignored
  const taskSkipped: Task = {
    id: 'task-skipped',
    title: 'Skipped Gym',
    durationMinutes: 60,
    priority: 'medium',
    status: 'skipped',
    scheduledStartMinute: 540,
    date: '2026-09-15',
    scheduling: { mode: "flexible" as const },
  };
  const res6 = determineTodayFocus({
    tasks: [taskSkipped],
    currentDate: testDate,
    currentMinute: 550,
  });
  assert(
    res6.nowItem?.id !== 'task-skipped' && res6.stateKind === 'day_complete',
    '6. Skipped task ignored from NOW and focus'
  );

  // Scenario 7: Floating task selected when a gap is available
  const floatingTask: Task = {
    id: 'task-float',
    title: 'Floating Revision',
    durationMinutes: 45,
    priority: 'high',
    status: 'pending',
    scheduledStartMinute: null,
    date: null,
    scheduling: { mode: "flexible" as const },
  };
  const res7 = determineTodayFocus({
    tasks: [floatingTask],
    currentDate: testDate,
    currentMinute: 500, // 8:20 AM (within planning window 8 AM - 11 PM)
  });
  assert(
    res7.nowItem?.id === 'task-float' || res7.stateKind === 'active_now' || res7.stateKind === 'available_now',
    '7. Floating task selected when gap is available'
  );

  // Scenario 8: Task omitted when duration exceeds available gap
  const longTask: Task = {
    id: 'task-long',
    title: '3 Hour Marathon',
    durationMinutes: 180, // 3 hours = 180 min
    priority: 'high',
    status: 'pending',
    scheduledStartMinute: null,
    date: '2026-09-15',
    scheduling: { mode: "flexible" as const },
  };
  const upcomingEvent: SchedulerEvent = {
    id: 'ev-close',
    title: 'Meeting at 9 AM',
    startMinute: 540, // 9:00 AM
    endMinute: 600,   // 10:00 AM
  };
  const res8 = determineTodayFocus({
    tasks: [longTask],
    events: [upcomingEvent],
    currentDate: testDate,
    currentMinute: 480, // 8:00 AM (only 50 mins available before 9:00 AM event buffer)
  });
  assert(
    res8.nowItem?.id !== 'task-long',
    '8. Task omitted when duration (180m) exceeds available gap (50m)'
  );

  // Scenario 9: UP NEXT correctly identified
  const res9 = determineTodayFocus({
    tasks: [task1, taskExplicit],
    currentDate: testDate,
    currentMinute: 570, // 9:30 AM (during task1 9-10 AM)
  });
  assert(
    res9.upNextItems.some((i) => i.id === 'task-explicit'),
    '9. UP NEXT correctly identified (task-explicit)'
  );

  // Scenario 10: DAY COMPLETE when nothing remains/fit
  const res10 = determineTodayFocus({
    tasks: [],
    currentDate: testDate,
    currentMinute: 500,
  });
  assert(
    res10.stateKind === 'day_complete' && res10.nowItem === null,
    '10. DAY COMPLETE when no tasks exist'
  );

  // Scenario 11: Replanning after completion
  const tasks11: Task[] = [
    { id: 't1', title: 'Task 1', durationMinutes: 30, priority: 'high', status: 'completed', scheduledStartMinute: 500, date: '2026-09-15', scheduling: { mode: "flexible" as const }, },
    { id: 't2', title: 'Task 2', durationMinutes: 30, priority: 'high', status: 'pending', scheduledStartMinute: 540, date: '2026-09-15', scheduling: { mode: "flexible" as const }, },
  ];
  const res11 = determineTodayFocus({
    tasks: tasks11,
    currentDate: testDate,
    currentMinute: 540, // 9:00 AM
  });
  assert(
    res11.nowItem?.id === 't2',
    '11. Replanning after completion correctly recommends Task 2'
  );

  // Scenario 12: Replanning after skip
  const tasks12: Task[] = [
    { id: 't1', title: 'Task 1', durationMinutes: 30, priority: 'high', status: 'skipped', scheduledStartMinute: 500, date: '2026-09-15', scheduling: { mode: "flexible" as const }, },
    { id: 't2', title: 'Task 2', durationMinutes: 30, priority: 'high', status: 'pending', scheduledStartMinute: 540, date: '2026-09-15', scheduling: { mode: "flexible" as const }, },
  ];
  const res12 = determineTodayFocus({
    tasks: tasks12,
    currentDate: testDate,
    currentMinute: 540,
  });
  assert(
    res12.nowItem?.id === 't2',
    '12. Replanning after skip correctly recommends Task 2'
  );

  // Scenario 13: Date-specific tasks do not leak to another date
  const tomorrowTask: Task = {
    id: 't-tomorrow',
    title: 'Tomorrow Task',
    durationMinutes: 60,
    priority: 'high',
    status: 'pending',
    scheduledStartMinute: 500,
    date: '2026-09-16',
    scheduling: { mode: "flexible" as const }, // Tomorrow
  };
  const res13 = determineTodayFocus({
    tasks: [tomorrowTask],
    currentDate: testDate, // Today 2026-09-15
    currentMinute: 500,
  });
  assert(
    res13.nowItem === null && res13.stateKind === 'day_complete',
    '13. Date-specific tasks for tomorrow do not leak into today'
  );

  // Scenario 14: Undated tasks remain eligible for today
  const undatedTask: Task = {
    id: 't-undated',
    title: 'Anytime Task',
    durationMinutes: 30,
    priority: 'medium',
    status: 'pending',
    scheduledStartMinute: null,
    date: null,
    scheduling: { mode: "flexible" as const },
  };
  const res14 = determineTodayFocus({
    tasks: [undatedTask],
    currentDate: testDate,
    currentMinute: 500,
  });
  assert(
    res14.nowItem?.id === 't-undated',
    '14. Undated task remains eligible for today focus'
  );

  // Scenario 15: Boundary test - Current time before planning window (6:00 AM = 360, window starts 8:00 AM)
  const res15 = determineTodayFocus({
    tasks: [task1],
    currentDate: testDate,
    currentMinute: 360, // 6:00 AM
  });
  assert(
    res15.upNextItems.length > 0 || res15.stateKind === 'waiting_upcoming',
    '15. Current time before planning window (6 AM) shows upcoming task'
  );

  // Scenario 16: Boundary test - Current time after planning window (11:30 PM = 1410, window ends 11:00 PM = 1380)
  const res16 = determineTodayFocus({
    tasks: [task1],
    currentDate: testDate,
    currentMinute: 1410, // 11:30 PM
  });
  assert(
    res16.stateKind === 'day_complete',
    '16. Current time after planning window (11:30 PM) marks day complete'
  );

  console.log(`Focus Engine Tests Result: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} tests.`);
  return { passed, failed };
}

runFocusEngineTests();
