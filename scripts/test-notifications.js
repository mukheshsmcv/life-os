/**
 * Life OS — Proactive Notification Engine Test Suite
 * Tests requirements A through L:
 * A. Notification permission handling
 * B. Scheduling an activity-start notification
 * C. Scheduling an upcoming notification
 * D. Completed activity does not receive future notification
 * E. Skipped activity does not receive future notification
 * F. Deleted activity notification is cancelled
 * G. Rescheduled activity removes old notification and creates new notification
 * H. Duplicate synchronization does not create duplicate notifications
 * I. Events can generate notifications
 * J. Activities without concrete future times do not generate scheduled notifications
 * K. Historical activities do not generate notifications
 * L. Today's/future activities generate correct notification times
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// In-memory store for mocked Notifications
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
  getAllScheduledNotificationsAsync: async () => {
    return Array.from(mockScheduledNotifications.values());
  },
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
  buildNotificationId,
  isLifeOSNotificationId,
  wallClockToDate,
  computeScheduleNotificationTargets,
  syncScheduleNotifications,
  getNotificationPermissionStatusAsync,
  requestNotificationPermissionAsync,
  DEFAULT_LEAD_TIME_MINUTES,
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
  console.log('--- STARTING NOTIFICATION ENGINE TEST SUITE ---\n');

  // A. Permission handling
  await itAsync('A1. Permission status returns granted when permission is granted', async () => {
    mockPermissionStatus = 'granted';
    const status = await getNotificationPermissionStatusAsync();
    assert.strictEqual(status, 'granted');
  });

  await itAsync('A2. Permission request returns false when permission is denied', async () => {
    mockPermissionStatus = 'denied';
    const ok = await requestNotificationPermissionAsync();
    assert.strictEqual(ok, false);
  });

  await itAsync('A3. Sync skips scheduling if permission is denied', async () => {
    mockPermissionStatus = 'denied';
    mockScheduledNotifications.clear();
    const result = await syncScheduleNotifications({
      tasks: [{ id: 't1', title: 'Task 1', status: 'pending', durationMinutes: 60, scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 600 } }],
      events: [],
      now: new Date('2026-09-17T08:00:00'),
    });
    assert.strictEqual(result.scheduled.length, 0);
    assert.strictEqual(mockScheduledNotifications.size, 0);
  });

  // B & C. Scheduling start notification and upcoming notification
  it('B. Scheduling an activity-start notification at planned time', () => {
    const now = new Date('2026-09-17T08:00:00'); // 8:00 AM
    const task = {
      id: 'task-pharmacology',
      title: 'Study Pharmacology',
      durationMinutes: 60,
      status: 'pending',
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 16 * 60 }, // 4:00 PM (960)
    };
    const targets = computeScheduleNotificationTargets({
      tasks: [task],
      events: [],
      now,
      todayDateStr: '2026-09-17',
    });

    const startNotif = targets.find(t => t.notificationKind === 'activity_start');
    assert.ok(startNotif, 'Should generate activity_start notification');
    assert.strictEqual(startNotif.id, 'lifeos_task-pharmacology_activity_start');
    assert.strictEqual(startNotif.title, 'Now: Study Pharmacology');
    assert.strictEqual(startNotif.triggerDate.getHours(), 16);
    assert.strictEqual(startNotif.triggerDate.getMinutes(), 0);
  });

  it('C. Scheduling an upcoming notification 5 minutes before planned time', () => {
    const now = new Date('2026-09-17T08:00:00'); // 8:00 AM
    const task = {
      id: 'task-pharmacology',
      title: 'Study Pharmacology',
      durationMinutes: 60,
      status: 'pending',
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 16 * 60 }, // 4:00 PM
    };
    const targets = computeScheduleNotificationTargets({
      tasks: [task],
      events: [],
      now,
      todayDateStr: '2026-09-17',
      leadTimeMinutes: 5,
    });

    const upcomingNotif = targets.find(t => t.notificationKind === 'activity_upcoming');
    assert.ok(upcomingNotif, 'Should generate activity_upcoming notification');
    assert.strictEqual(upcomingNotif.id, 'lifeos_task-pharmacology_activity_upcoming');
    assert.strictEqual(upcomingNotif.title, 'Starting in 5 minutes: Study Pharmacology');
    assert.strictEqual(upcomingNotif.triggerDate.getHours(), 15);
    assert.strictEqual(upcomingNotif.triggerDate.getMinutes(), 55);
  });

  // D. Completed activity does not receive future notification
  it('D. Completed activity does not receive future notification', () => {
    const now = new Date('2026-09-17T15:20:00'); // 3:20 PM
    const completedTask = {
      id: 'task-completed',
      title: 'Study Pharmacology',
      durationMinutes: 60,
      status: 'completed', // completed before 4:00 PM
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 16 * 60 },
    };
    const targets = computeScheduleNotificationTargets({
      tasks: [completedTask],
      events: [],
      now,
      todayDateStr: '2026-09-17',
    });
    assert.strictEqual(targets.length, 0, 'Completed tasks must never generate notification targets');
  });

  // E. Skipped activity does not receive future notification
  it('E. Skipped activity does not receive future notification', () => {
    const now = new Date('2026-09-17T15:20:00');
    const skippedTask = {
      id: 'task-skipped',
      title: 'Gym',
      durationMinutes: 60,
      status: 'skipped',
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 18 * 60 },
    };
    const targets = computeScheduleNotificationTargets({
      tasks: [skippedTask],
      events: [],
      now,
      todayDateStr: '2026-09-17',
    });
    assert.strictEqual(targets.length, 0, 'Skipped tasks must never generate notification targets');
  });

  // F. Deleted activity notification is cancelled
  await itAsync('F. Deleted activity notification is cancelled upon sync', async () => {
    mockPermissionStatus = 'granted';
    mockScheduledNotifications.clear();

    const now = new Date('2026-09-17T08:00:00');
    const task = {
      id: 'task-to-delete',
      title: 'Temporary Task',
      durationMinutes: 60,
      status: 'pending',
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 12 * 60 },
    };

    // First sync schedules it
    await syncScheduleNotifications({
      tasks: [task],
      events: [],
      now,
      todayScheduleBlocks: [{ taskId: 'task-to-delete', startMinute: 720, endMinute: 780, start: new Date(), end: new Date() }],
    });
    assert.strictEqual(mockScheduledNotifications.size, 2, 'Should have start and upcoming');

    // Second sync: task is deleted (empty tasks list)
    const syncRes = await syncScheduleNotifications({
      tasks: [],
      events: [],
      now,
    });
    assert.strictEqual(syncRes.cancelled.length, 2, 'Should cancel both notifications');
    assert.strictEqual(mockScheduledNotifications.size, 0, 'Notifications store should be empty');
  });

  // G. Rescheduled activity removes old notification and creates new notification
  await itAsync('G. Rescheduled activity removes old notifications and creates new ones', async () => {
    mockPermissionStatus = 'granted';
    mockScheduledNotifications.clear();

    const now = new Date('2026-09-17T08:00:00');
    const originalTask = {
      id: 'task-reschedule',
      title: 'Study Pathology',
      durationMinutes: 60,
      status: 'pending',
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 16 * 60 }, // 4:00 PM
    };

    // Step 1: Schedule at 4 PM
    await syncScheduleNotifications({
      tasks: [originalTask],
      events: [],
      now,
      todayScheduleBlocks: [{ taskId: 'task-reschedule', startMinute: 960, endMinute: 1020, start: new Date(), end: new Date() }],
    });

    const oldStart = mockScheduledNotifications.get('lifeos_task-reschedule_activity_start');
    assert.strictEqual(oldStart.trigger.date.getHours(), 16);

    // Step 2: Reschedule to 6:00 PM (18 * 60 = 1080)
    const updatedTask = {
      ...originalTask,
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 18 * 60 },
    };

    const syncRes = await syncScheduleNotifications({
      tasks: [updatedTask],
      events: [],
      now,
      todayScheduleBlocks: [{ taskId: 'task-reschedule', startMinute: 1080, endMinute: 1140, start: new Date(), end: new Date() }],
    });

    // Should have cancelled old notifications and scheduled new ones
    assert.ok(syncRes.cancelled.includes('lifeos_task-reschedule_activity_start'));
    assert.ok(syncRes.scheduled.includes('lifeos_task-reschedule_activity_start'));

    const newStart = mockScheduledNotifications.get('lifeos_task-reschedule_activity_start');
    assert.strictEqual(newStart.trigger.date.getHours(), 18);
    const newUpcoming = mockScheduledNotifications.get('lifeos_task-reschedule_activity_upcoming');
    assert.strictEqual(newUpcoming.trigger.date.getHours(), 17);
    assert.strictEqual(newUpcoming.trigger.date.getMinutes(), 55);
  });

  // H. Duplicate synchronization does not create duplicate notifications
  await itAsync('H. Duplicate synchronization keeps existing notifications without duplicate triggers', async () => {
    mockPermissionStatus = 'granted';
    mockScheduledNotifications.clear();

    const now = new Date('2026-09-17T08:00:00');
    const task = {
      id: 'task-stable',
      title: 'Stable Task',
      durationMinutes: 60,
      status: 'pending',
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 14 * 60 }, // 2:00 PM
    };
    const blocks = [{ taskId: 'task-stable', startMinute: 840, endMinute: 900, start: new Date(), end: new Date() }];

    const firstSync = await syncScheduleNotifications({
      tasks: [task],
      events: [],
      now,
      todayScheduleBlocks: blocks,
    });
    assert.strictEqual(firstSync.scheduled.length, 2);
    assert.strictEqual(mockScheduledNotifications.size, 2);

    // Call sync again with identical state
    const secondSync = await syncScheduleNotifications({
      tasks: [task],
      events: [],
      now,
      todayScheduleBlocks: blocks,
    });
    assert.strictEqual(secondSync.scheduled.length, 0, 'No new notifications should be scheduled');
    assert.strictEqual(secondSync.cancelled.length, 0, 'No notifications should be cancelled');
    assert.strictEqual(secondSync.kept.length, 2, 'Both notifications should be preserved');
    assert.strictEqual(mockScheduledNotifications.size, 2, 'Size must remain 2');
  });

  // I. Events can generate notifications
  it('I. Calendar Events generate upcoming and start notifications', () => {
    const now = new Date('2026-09-17T08:00:00');
    const event = {
      id: 'meeting-narendra',
      title: 'Meeting with Narendra',
      date: '2026-09-17',
      startMinute: 16 * 60, // 4:00 PM
      endMinute: 17 * 60,
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 16 * 60, endMinute: 17 * 60 },
    };

    const targets = computeScheduleNotificationTargets({
      tasks: [],
      events: [event],
      now,
      todayDateStr: '2026-09-17',
    });

    assert.strictEqual(targets.length, 2);
    const start = targets.find(t => t.notificationKind === 'activity_start');
    const upcoming = targets.find(t => t.notificationKind === 'activity_upcoming');
    assert.strictEqual(start.title, 'Now: Meeting with Narendra');
    assert.strictEqual(start.activityKind, 'event');
    assert.strictEqual(upcoming.title, 'Starting in 5 minutes: Meeting with Narendra');
    assert.strictEqual(upcoming.activityKind, 'event');
  });

  // J. Activities without concrete future times do not generate scheduled notifications
  it('J. Activities without concrete future times do not generate notifications', () => {
    const now = new Date('2026-09-17T08:00:00');
    const flexibleUndated = {
      id: 'task-undated',
      title: 'Someday Task',
      durationMinutes: 60,
      status: 'pending',
      date: null,
      scheduledStartMinute: null,
      scheduling: { mode: 'flexible', date: null, startMinute: null },
    };

    const targets = computeScheduleNotificationTargets({
      tasks: [flexibleUndated],
      events: [],
      todayScheduleBlocks: [], // unplaced
      now,
      todayDateStr: '2026-09-17',
    });
    assert.strictEqual(targets.length, 0, 'Flexible unplaced tasks should not generate notifications');
  });

  // K. Historical activities do not generate notifications
  it('K. Historical activities in the past do not generate notifications', () => {
    const now = new Date('2026-09-17T17:00:00'); // 5:00 PM
    const morningTask = {
      id: 'task-morning',
      title: 'Morning Rounds',
      durationMinutes: 60,
      status: 'pending',
      scheduling: { mode: 'fixed', date: '2026-09-17', startMinute: 9 * 60 }, // 9:00 AM
    };
    const yesterdayTask = {
      id: 'task-yesterday',
      title: 'Yesterday Revision',
      durationMinutes: 60,
      status: 'pending',
      scheduling: { mode: 'fixed', date: '2026-09-16', startMinute: 10 * 60 },
    };

    const targets = computeScheduleNotificationTargets({
      tasks: [morningTask, yesterdayTask],
      events: [],
      now,
      todayDateStr: '2026-09-17',
    });
    assert.strictEqual(targets.length, 0, 'Past activities must never generate future notifications');
  });

  // L. Future activities generate correct notification times
  it('L. Tomorrow and future activities generate correct notification times', () => {
    const now = new Date('2026-09-17T20:00:00');
    const tomorrowTask = {
      id: 'task-tomorrow',
      title: 'Surgery Lecture',
      durationMinutes: 90,
      status: 'pending',
      scheduling: { mode: 'fixed', date: '2026-09-18', startMinute: 10 * 60 }, // 10:00 AM on Sep 18
    };

    const targets = computeScheduleNotificationTargets({
      tasks: [tomorrowTask],
      events: [],
      now,
      todayDateStr: '2026-09-17',
    });

    assert.strictEqual(targets.length, 2);
    const start = targets.find(t => t.notificationKind === 'activity_start');
    assert.strictEqual(start.triggerDate.getFullYear(), 2026);
    assert.strictEqual(start.triggerDate.getMonth(), 8); // 8 is September
    assert.strictEqual(start.triggerDate.getDate(), 18);
    assert.strictEqual(start.triggerDate.getHours(), 10);
    assert.strictEqual(start.triggerDate.getMinutes(), 0);

    const upcoming = targets.find(t => t.notificationKind === 'activity_upcoming');
    assert.strictEqual(upcoming.triggerDate.getDate(), 18);
    assert.strictEqual(upcoming.triggerDate.getHours(), 9);
    assert.strictEqual(upcoming.triggerDate.getMinutes(), 55);
  });

  console.log(`\n=========================================`);
  console.log(`NOTIFICATION ENGINE TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`=========================================\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
