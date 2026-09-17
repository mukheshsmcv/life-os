import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getCurrentStateSnapshot } from './current-state';
import { Task } from '@/contexts/tasks-context';
import { DEFAULT_SCHEDULING_SETTINGS } from './scheduler';
import { toYMD } from './date-time';

describe('Current State Engine (M7)', () => {
  const baseDate = new Date(2026, 8, 17, 9, 0, 0); // 9:00 AM local time
  const currentDateStr = toYMD(baseDate.getFullYear(), baseDate.getMonth() + 1, baseDate.getDate());

  it('handles no activities (Case 1)', () => {
    const snapshot = getCurrentStateSnapshot([], [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    assert.strictEqual(snapshot.now.type, 'none');
    assert.strictEqual(snapshot.next, null);
    assert.strictEqual(snapshot.dayComplete, true);
    assert.strictEqual(snapshot.freeTime.length > 0, true);
    assert.strictEqual(snapshot.remainingWorkMinutes, 0);
  });

  it('handles one current scheduled activity (Case 2)', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Task 1', durationMinutes: 60, priority: 'medium', status: 'pending', scheduledStartMinute: 540, date: currentDateStr, scheduling: { mode: 'fixed' } }
    ]; // 540 = 9:00 AM
    
    const snapshot = getCurrentStateSnapshot(tasks, [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    assert.strictEqual(snapshot.now.type, 'task');
    assert.strictEqual(snapshot.now.id, 't1');
    assert.strictEqual(snapshot.now.remainingMinutes, 60);
    assert.strictEqual(snapshot.next, null);
    assert.strictEqual(snapshot.remainingWorkMinutes, 60);
  });

  it('handles one upcoming activity (Case 3)', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Task 1', durationMinutes: 60, priority: 'medium', status: 'pending', scheduledStartMinute: 600, date: currentDateStr, scheduling: { mode: 'fixed' } }
    ]; // 600 = 10:00 AM
    
    const snapshot = getCurrentStateSnapshot(tasks, [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    assert.strictEqual(snapshot.now.type, 'none');
    assert.strictEqual(snapshot.next?.id, 't1');
    assert.strictEqual(snapshot.next?.minutesUntilStart, 60);
    assert.strictEqual(snapshot.remainingWorkMinutes, 60);
  });

  it('handles running task (Case 5)', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Task 1', durationMinutes: 60, priority: 'medium', status: 'pending', scheduledStartMinute: null, date: currentDateStr, scheduling: { mode: 'flexible' }, execution: { activeState: 'running', actualStartMinute: 530, totalPausedMinutes: 0 } }
    ]; // Started at 8:50 AM, now 9:00 AM -> 50 mins remaining
    
    const snapshot = getCurrentStateSnapshot(tasks, [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    assert.strictEqual(snapshot.now.type, 'task');
    assert.strictEqual(snapshot.now.id, 't1');
    assert.strictEqual(snapshot.now.activeState, 'running');
    assert.strictEqual(snapshot.now.remainingMinutes, 50);
    assert.strictEqual(snapshot.running?.id, 't1');
    assert.strictEqual(snapshot.remainingWorkMinutes, 50);
  });

  it('handles paused task (Case 6)', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Task 1', durationMinutes: 60, priority: 'medium', status: 'pending', scheduledStartMinute: null, date: currentDateStr, scheduling: { mode: 'flexible' }, execution: { activeState: 'paused', actualStartMinute: 500, lastPausedAtMinute: 520, totalPausedMinutes: 0 } }
    ]; // Started 8:20, paused 8:40. Work done = 20m. Remaining = 40m.
    
    const snapshot = getCurrentStateSnapshot(tasks, [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    assert.strictEqual(snapshot.now.type, 'task');
    assert.strictEqual(snapshot.now.id, 't1');
    assert.strictEqual(snapshot.now.activeState, 'paused');
    assert.strictEqual(snapshot.now.remainingMinutes, 40);
    assert.strictEqual(snapshot.paused?.id, 't1');
    assert.strictEqual(snapshot.remainingWorkMinutes, 40);
  });

  it('handles completed task (Case 7)', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Task 1', durationMinutes: 60, priority: 'medium', status: 'completed', scheduledStartMinute: 480, date: currentDateStr, scheduling: { mode: 'fixed' } }
    ]; 
    
    const snapshot = getCurrentStateSnapshot(tasks, [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    assert.strictEqual(snapshot.now.type, 'none');
    assert.deepStrictEqual(snapshot.completed, ['t1']);
    assert.strictEqual(snapshot.remainingWorkMinutes, 0);
  });

  it('handles skipped task (Case 8)', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Task 1', durationMinutes: 60, priority: 'medium', status: 'skipped', scheduledStartMinute: 480, date: currentDateStr, scheduling: { mode: 'fixed' } }
    ]; 
    
    const snapshot = getCurrentStateSnapshot(tasks, [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    assert.deepStrictEqual(snapshot.skipped, ['t1']);
    assert.strictEqual(snapshot.remainingWorkMinutes, 0);
  });

  it('handles missed fixed activity (Case 9)', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Task 1', durationMinutes: 60, priority: 'medium', status: 'pending', scheduledStartMinute: 400, date: currentDateStr, scheduling: { mode: 'fixed' } }
    ]; // 400 to 460. Current time 540.
    
    const snapshot = getCurrentStateSnapshot(tasks, [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    assert.strictEqual(snapshot.now.type, 'none'); // Missed task is not NOW
    assert.deepStrictEqual(snapshot.overdue, ['t1']); // Should be marked overdue
  });

  it('calculates free time (Case 11)', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Task 1', durationMinutes: 60, priority: 'medium', status: 'pending', scheduledStartMinute: 600, date: currentDateStr, scheduling: { mode: 'fixed' } }
    ]; // 10:00 to 11:00 AM. Current is 9:00 AM. Buffer 10 mins.
    
    const snapshot = getCurrentStateSnapshot(tasks, [], baseDate, DEFAULT_SCHEDULING_SETTINGS);
    
    // Gap 1: 9:00 to 9:50 (50 mins)
    // Gap 2: 11:10 to end of day (23:00 = 1380) = 1380 - 670 = 710 mins
    
    assert.strictEqual(snapshot.freeTime[0].durationMinutes, 50);
    assert.strictEqual(snapshot.freeTime[1].startMinute, 670);
  });
});
