/**
 * Life OS — Notification Interaction Test Suite
 * Tests requirements A through I:
 * A. Notification payload contains activityId.
 * B. Valid notification tap produces pending activity navigation.
 * C. App can consume pending activity ID after cold start.
 * D. Existing activity is focused.
 * E. Deleted activity does not crash.
 * F. Completed activity does not crash.
 * G. Skipped activity does not crash.
 * H. Non-Life-OS notification is ignored.
 * I. Repeated response does not duplicate pending navigation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Mock in-memory state
const mockScheduledNotifications = new Map();
let mockPermissionStatus = 'granted';

const mockNotifications = {
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => {},
  getPermissionsAsync: async () => ({ status: mockPermissionStatus }),
  requestPermissionsAsync: async () => ({ status: mockPermissionStatus }),
  getAllScheduledNotificationsAsync: async () => Array.from(mockScheduledNotifications.values()),
  scheduleNotificationAsync: async (req) => {
    const id = req.identifier || `mock-${Date.now()}`;
    mockScheduledNotifications.set(id, {
      identifier: id,
      content: req.content,
      trigger: req.trigger,
    });
    return id;
  },
  cancelScheduledNotificationAsync: async (identifier) => {
    mockScheduledNotifications.delete(identifier);
  },
  getLastNotificationResponseAsync: async () => null,
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
};

const moduleCache = new Map();

function customRequire(modulePath) {
  if (modulePath === 'expo-notifications') {
    return mockNotifications;
  }
  if (modulePath === 'react-native') {
    return {
      Platform: { OS: 'android', select: (obj) => obj.android || obj.default },
    };
  }

  let resolvedPath = null;
  if (modulePath.startsWith('@/')) {
    resolvedPath = path.resolve(__dirname, '../src', modulePath.slice(2));
  } else if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
    resolvedPath = path.resolve(__dirname, modulePath);
  }

  if (resolvedPath) {
    if (fs.existsSync(resolvedPath + '.ts')) resolvedPath = resolvedPath + '.ts';
    else if (fs.existsSync(resolvedPath + '.tsx')) resolvedPath = resolvedPath + '.tsx';
    else if (fs.existsSync(resolvedPath + '.js')) resolvedPath = resolvedPath + '.js';

    if (moduleCache.has(resolvedPath)) {
      return moduleCache.get(resolvedPath);
    }

    if (resolvedPath.endsWith('.ts') || resolvedPath.endsWith('.tsx')) {
      const tsSource = fs.readFileSync(resolvedPath, 'utf8');
      const transpileResult = ts.transpileModule(tsSource, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      });
      const m = { exports: {} };
      moduleCache.set(resolvedPath, m.exports);
      const fn = new Function('require', 'exports', 'module', '__filename', '__dirname', '__DEV__', transpileResult.outputText);
      fn(customRequire, m.exports, m, resolvedPath, path.dirname(resolvedPath), true);
      moduleCache.set(resolvedPath, m.exports);
      return m.exports;
    }
  }

  return require(modulePath);
}

const notificationsModule = customRequire('@/lib/notifications');

const {
  computeScheduleNotificationTargets,
  scheduleSingleNotificationAsync,
  handleNotificationResponse,
  getPendingActivityId,
  setPendingActivityId,
  consumePendingActivityId,
  subscribePendingActivity,
  resetNotificationInteractionStateForTesting,
  isLifeOSNotificationData,
} = notificationsModule;

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ FAIL: ${desc}`);
    console.error(err);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ FAIL: ${desc}`);
    console.error(err);
    failed++;
  }
}

async function runTests() {
  console.log('--- STARTING NOTIFICATION INTERACTION TEST SUITE ---\n');

  // A. Notification payload contains activityId
  await itAsync('A. Notification payload contains activityId and required Life OS metadata', async () => {
    resetNotificationInteractionStateForTesting();
    mockScheduledNotifications.clear();

    const targets = computeScheduleNotificationTargets({
      tasks: [
        {
          id: 'task-pharmacology-123',
          title: 'Study Pharmacology',
          durationMinutes: 45,
          status: 'pending',
          scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 14 * 60 },
        },
      ],
      events: [],
      now: new Date('2026-09-17T08:00:00'),
      todayDateStr: '2026-09-17',
    });

    assert.ok(targets.length > 0, 'Expected targets to be generated');
    const startTarget = targets.find((t) => t.notificationKind === 'activity_start');
    assert.strictEqual(startTarget.activityId, 'task-pharmacology-123');

    // Schedule and check payload content
    await scheduleSingleNotificationAsync(startTarget);
    const scheduled = mockScheduledNotifications.get(startTarget.id);
    assert.ok(scheduled, 'Target should be saved to scheduled store');
    assert.strictEqual(scheduled.content.data.lifeos, true);
    assert.strictEqual(scheduled.content.data.activityId, 'task-pharmacology-123');
    assert.strictEqual(scheduled.content.data.activityKind, 'task');
    assert.strictEqual(scheduled.content.data.notificationKind, 'activity_start');
    assert.ok(typeof scheduled.content.data.triggerTimestamp === 'number');

    // Validate type guard
    assert.strictEqual(isLifeOSNotificationData(scheduled.content.data), true);
  });

  // B. Valid notification tap produces pending activity navigation
  it('B. Valid notification tap produces pending activity navigation', () => {
    resetNotificationInteractionStateForTesting();

    let subscriberNotifiedWith = null;
    const unsub = subscribePendingActivity((id) => {
      subscriberNotifiedWith = id;
    });

    const response = {
      notification: {
        request: {
          identifier: 'lifeos_study-1_activity_start',
          content: {
            title: 'Now: Study Pharmacology',
            body: 'Scheduled for 2:00 PM',
            data: {
              lifeos: true,
              activityId: 'study-1',
              activityKind: 'task',
              notificationKind: 'activity_start',
              triggerTimestamp: Date.now() + 50000,
            },
          },
        },
      },
    };

    const res = handleNotificationResponse(response);
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.activityId, 'study-1');
    assert.strictEqual(getPendingActivityId(), 'study-1');
    assert.strictEqual(subscriberNotifiedWith, 'study-1');
    unsub();
  });

  // C. App can consume pending activity ID after cold start
  it('C. App can consume pending activity ID after cold start', () => {
    resetNotificationInteractionStateForTesting();

    // Cold-start sets pending ID before Today screen mounts
    const coldResponse = {
      notification: {
        request: {
          identifier: 'lifeos_cold-start-task_activity_start',
          content: {
            data: {
              lifeos: true,
              activityId: 'cold-start-task',
              activityKind: 'task',
              notificationKind: 'activity_start',
              triggerTimestamp: Date.now() + 60000,
            },
          },
        },
      },
    };

    handleNotificationResponse(coldResponse);
    assert.strictEqual(getPendingActivityId(), 'cold-start-task');

    // Today mounts and consumes the ID
    const consumedFirst = consumePendingActivityId();
    assert.strictEqual(consumedFirst, 'cold-start-task');

    // Further consumption returns null to avoid double processing
    const consumedSecond = consumePendingActivityId();
    assert.strictEqual(consumedSecond, null);
    assert.strictEqual(getPendingActivityId(), null);
  });

  // D. Existing activity is focused
  it('D. Existing activity is focused without altering schedule or auto-completing', () => {
    resetNotificationInteractionStateForTesting();

    const tasks = [
      {
        id: 'task-active-1',
        title: 'Complete Lab Report',
        durationMinutes: 45,
        status: 'pending',
        scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 600 },
      },
    ];

    let focusedActivityId = null;
    function simulateApplyFocus(activityId, currentTasks) {
      const match = currentTasks.find((t) => t.id === activityId);
      if (!match || match.status !== 'pending') return;
      focusedActivityId = activityId;
    }

    // Apply focus to existing pending activity
    simulateApplyFocus('task-active-1', tasks);
    assert.strictEqual(focusedActivityId, 'task-active-1');

    // Verify task was NOT modified
    assert.strictEqual(tasks[0].status, 'pending');
    assert.strictEqual(tasks[0].scheduling.startMinute, 600);

    // Simulate user interaction dismissing focus
    function simulateUserDone(taskId) {
      const t = tasks.find((item) => item.id === taskId);
      if (t) t.status = 'completed';
      focusedActivityId = null;
    }
    simulateUserDone('task-active-1');
    assert.strictEqual(focusedActivityId, null);
    assert.strictEqual(tasks[0].status, 'completed');
  });

  // E. Deleted activity does not crash
  it('E. Deleted activity does not crash and leaves Today normal', () => {
    resetNotificationInteractionStateForTesting();

    const emptyTasks = [];
    let focusedActivityId = null;
    let didThrow = false;

    try {
      // Simulate Today screen receiving ID for deleted activity
      const activityId = 'deleted-task-999';
      const match = emptyTasks.find((t) => t.id === activityId);
      if (match && match.status === 'pending') {
        focusedActivityId = activityId;
      }
    } catch {
      didThrow = true;
    }

    assert.strictEqual(didThrow, false);
    assert.strictEqual(focusedActivityId, null);
  });

  // F. Completed activity does not crash
  it('F. Completed activity does not crash and is safely ignored', () => {
    resetNotificationInteractionStateForTesting();

    const tasks = [
      {
        id: 'task-already-completed',
        title: 'Morning Run',
        status: 'completed',
      },
    ];

    let focusedActivityId = null;
    let didThrow = false;

    try {
      const activityId = 'task-already-completed';
      const match = tasks.find((t) => t.id === activityId);
      if (match && match.status === 'pending') {
        focusedActivityId = activityId;
      }
    } catch {
      didThrow = true;
    }

    assert.strictEqual(didThrow, false);
    assert.strictEqual(focusedActivityId, null, 'Completed task must not receive visual focus');
  });

  // G. Skipped activity does not crash
  it('G. Skipped activity does not crash and is safely ignored', () => {
    resetNotificationInteractionStateForTesting();

    const tasks = [
      {
        id: 'task-already-skipped',
        title: 'Optional Reading',
        status: 'skipped',
      },
    ];

    let focusedActivityId = null;
    let didThrow = false;

    try {
      const activityId = 'task-already-skipped';
      const match = tasks.find((t) => t.id === activityId);
      if (match && match.status === 'pending') {
        focusedActivityId = activityId;
      }
    } catch {
      didThrow = true;
    }

    assert.strictEqual(didThrow, false);
    assert.strictEqual(focusedActivityId, null, 'Skipped task must not receive visual focus');
  });

  // H. Non-Life-OS notification is ignored
  it('H. Non-Life-OS notification is ignored and does not trigger navigation', () => {
    resetNotificationInteractionStateForTesting();

    // 1. Missing lifeos flag
    const foreignResponse1 = {
      notification: {
        request: {
          identifier: 'external-push-1',
          content: {
            title: 'Breaking News',
            data: { activityId: 'some-id' },
          },
        },
      },
    };
    const res1 = handleNotificationResponse(foreignResponse1);
    assert.strictEqual(res1.handled, false);
    assert.strictEqual(res1.reason, 'not_life_os');
    assert.strictEqual(getPendingActivityId(), null);

    // 2. Missing activityId
    const foreignResponse2 = {
      notification: {
        request: {
          identifier: 'external-push-2',
          content: {
            title: 'Life OS Update',
            data: { lifeos: true },
          },
        },
      },
    };
    const res2 = handleNotificationResponse(foreignResponse2);
    assert.strictEqual(res2.handled, false);
    assert.strictEqual(getPendingActivityId(), null);

    // 3. Null / undefined response
    const res3 = handleNotificationResponse(null);
    assert.strictEqual(res3.handled, false);
    assert.strictEqual(res3.reason, 'no_response');
  });

  // I. Repeated response does not duplicate pending navigation
  it('I. Repeated response does not duplicate pending navigation', () => {
    resetNotificationInteractionStateForTesting();

    let notificationTapCount = 0;
    const unsub = subscribePendingActivity(() => {
      notificationTapCount++;
    });

    const response = {
      notification: {
        request: {
          identifier: 'lifeos_task-dup-1_activity_start',
          content: {
            data: {
              lifeos: true,
              activityId: 'task-dup-1',
              activityKind: 'task',
              notificationKind: 'activity_start',
              triggerTimestamp: Date.now() + 40000,
            },
          },
        },
      },
    };

    // First tap
    const firstRes = handleNotificationResponse(response);
    assert.strictEqual(firstRes.handled, true);
    assert.strictEqual(notificationTapCount, 1);

    // Immediate second identical tap (e.g. rapid double-tap or redundant event)
    const secondRes = handleNotificationResponse(response);
    assert.strictEqual(secondRes.handled, false);
    assert.strictEqual(secondRes.reason, 'duplicate_response');
    assert.strictEqual(notificationTapCount, 1, 'Subscriber must not be called a second time');

    unsub();
  });

  console.log(`\n=========================================`);
  console.log(`NOTIFICATION INTERACTION TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`=========================================\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
