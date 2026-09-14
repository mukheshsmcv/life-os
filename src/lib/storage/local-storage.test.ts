import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, Event } from '@/contexts/tasks-context';
import { loadStorageState, saveStorageState } from './local-storage';
import { scheduleTasks, DEFAULT_SCHEDULING_SETTINGS } from '@/lib/scheduler';

// In-memory AsyncStorage mock for unit test environment
const memoryStore = new Map<string, string>();

if (!AsyncStorage.setItem || typeof AsyncStorage.setItem !== 'function' || process.env.NODE_ENV === 'test') {
  (AsyncStorage as any).setItem = async (key: string, value: string) => {
    memoryStore.set(key, value);
  };
  (AsyncStorage as any).getItem = async (key: string) => {
    return memoryStore.get(key) ?? null;
  };
  (AsyncStorage as any).clear = async () => {
    memoryStore.clear();
  };
}

export async function runPersistenceTests(): Promise<{ passed: number; failed: number }> {
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

  memoryStore.clear();

  // Test 8: Missing storage falls back to null (initial state)
  const emptyResult = await loadStorageState();
  assert(emptyResult === null, '1. Missing storage returns null fallback');

  // Test 9: Malformed stored data does not crash
  memoryStore.set('LIFE_OS_STORAGE_V1', '{ invalid json ...');
  const malformedResult = await loadStorageState();
  assert(malformedResult === null, '2. Malformed JSON stored data safely returns null fallback');

  memoryStore.set('LIFE_OS_STORAGE_V1', JSON.stringify({ version: 1, tasks: 'not an array', events: [] }));
  const invalidTypeResult = await loadStorageState();
  assert(invalidTypeResult === null, '3. Invalid schema shape safely returns null fallback');

  // Clear store for clean persistence test
  memoryStore.clear();

  const testTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Pathology Study',
      durationMinutes: 120,
      priority: 'high',
      status: 'pending', // Pending task with explicit start time for scheduler test
      scheduledStartMinute: 790, // Test 5: scheduledStartMinute (1:10 PM = 790, after 12-1 PM event)
      date: '2026-09-15',
      scheduling: { mode: "flexible" as const }, // Test 4: explicit task date
    },
    {
      id: 'task-2',
      title: 'Flexible Anatomy',
      durationMinutes: 60,
      priority: 'medium',
      status: 'pending',
      scheduledStartMinute: null, // Test 6: flexible task with null scheduledStartMinute
      date: null,
      scheduling: { mode: "flexible" as const },
    },
    {
      id: 'task-3',
      title: 'Completed Revision',
      durationMinutes: 30,
      priority: 'low',
      status: 'completed', // Test 3: completed status survives persistence
      scheduledStartMinute: null,
      date: '2026-09-15',
      scheduling: { mode: "flexible" as const },
    },
  ];

  const testEvents: Event[] = [
    {
      id: 'event-1',
      title: 'Doctor Appointment',
      date: '2026-09-15',
      scheduling: { mode: "flexible" as const },
      startMinute: 720, // Test 7: Event start time 12 PM (no overlap with 9 AM task)
      endMinute: 780,   // Test 7: Event end time 1 PM
      notes: 'Checkup',
    },
  ];

  // Save tasks and events
  const saveOk = await saveStorageState(testTasks, testEvents);
  assert(saveOk === true, '4. saveStorageState returns true');

  // Reload tasks and events (Test 1 & 2)
  const loaded = await loadStorageState();
  assert(loaded !== null, '5. loadStorageState returns valid non-null state');

  if (loaded) {
    // Test 1: Save tasks and reload them
    assert(loaded.tasks.length === 3, '6. Tasks count matches saved count (3 tasks)');

    // Test 2: Save events and reload them
    assert(loaded.events.length === 1, '7. Events count matches saved count (1 event)');

    // Test 3: Task status survives persistence
    assert(loaded.tasks[0].status === 'pending', '8. Task 1 status "pending" survived');
    assert(loaded.tasks[2].status === 'completed', '9. Task 3 status "completed" survived');

    // Test 4: Explicit task date survives persistence
    assert(loaded.tasks[0].date === '2026-09-15', '10. Explicit task date "2026-09-15" survived');
    assert(loaded.tasks[1].date === null, '11. Flexible task date null survived');

    // Test 5: scheduledStartMinute survives persistence
    assert(loaded.tasks[0].scheduledStartMinute === 790, '12. scheduledStartMinute 790 (1:10 PM) survived');

    // Test 6: Flexible task with null scheduledStartMinute survives persistence
    assert(loaded.tasks[1].scheduledStartMinute === null, '13. Flexible task scheduledStartMinute null survived');

    // Test 7: Event start/end times survive persistence
    assert(loaded.events[0].startMinute === 720 && loaded.events[0].endMinute === 780, '14. Event start/end minutes (720-780) survived');

    // Test 10: Scheduler can operate correctly using restored state
    const today = new Date(2026, 8, 15, 7, 0, 0);
    const scheduleResult = scheduleTasks(
      loaded.tasks,
      DEFAULT_SCHEDULING_SETTINGS,
      today,
      loaded.events
    );
    assert(scheduleResult !== undefined && Array.isArray(scheduleResult.blocks), '15. Scheduler successfully operates on restored state');
    assert(scheduleResult.blocks.some((b) => b.taskId === 'task-1' && b.startMinute === 790), '16. Scheduler correctly placed restored explicit task at 1:10 PM (790)');
  }

  console.log(`Persistence Tests Result: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} tests.`);
  return { passed, failed };
}

runPersistenceTests();
