import { parseIntent } from './mock-intent-parser';

type TestCase = {
  input: string;
  expectedType: string;
  expectedQueryOrTitle?: string;
};

const completionTests: TestCase[] = [
  { input: 'complete pharmacology', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'completed pharmacology', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'finish pharmacology', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'finished pharmacology', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'I completed pharmacology', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'I finished pharmacology', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'mark pharmacology complete', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'pharmacology is completed', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'I have completed pharmacology', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'done with pharmacology', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: 'completed pharmacology.', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
  { input: '  I   completed   pharmacology!  ', expectedType: 'complete_task', expectedQueryOrTitle: 'pharmacology' },
];

const skipTests: TestCase[] = [
  { input: 'skip gym', expectedType: 'skip_task', expectedQueryOrTitle: 'gym' },
  { input: 'skipped gym', expectedType: 'skip_task', expectedQueryOrTitle: 'gym' },
  { input: 'I skipped gym', expectedType: 'skip_task', expectedQueryOrTitle: 'gym' },
  { input: "can't do gym", expectedType: 'skip_task', expectedQueryOrTitle: 'gym' },
  { input: 'cannot do gym', expectedType: 'skip_task', expectedQueryOrTitle: 'gym' },
  { input: "don't do gym", expectedType: 'skip_task', expectedQueryOrTitle: 'gym' },
  { input: 'i cant do gym', expectedType: 'skip_task', expectedQueryOrTitle: 'gym' },
];

const createTests: TestCase[] = [
  { input: 'add pharmacology for 2 hours', expectedType: 'create_task', expectedQueryOrTitle: 'Pharmacology' },
  { input: 'add gym for 1 hour', expectedType: 'create_task', expectedQueryOrTitle: 'Gym' },
  { input: 'add high priority study for 90 minutes', expectedType: 'create_task', expectedQueryOrTitle: 'Study' },
];

const queryTests: TestCase[] = [
  { input: "what's my schedule?", expectedType: 'get_schedule' },
  { input: 'replan my day', expectedType: 'replan_day' },
  { input: "what's my free time?", expectedType: 'get_free_time' },
];

export function runParserTests(): { passed: number; failed: number } {
  const allTests = [...completionTests, ...skipTests, ...createTests, ...queryTests];
  let passed = 0;
  let failed = 0;

  for (const test of allTests) {
    const res = parseIntent(test.input);
    if (!res.success) {
      console.error(`FAIL: "${test.input}" returned failure: ${res.error}`);
      failed++;
      continue;
    }

    const action = res.actions[0];
    if (action.type !== test.expectedType) {
      console.error(
        `FAIL: "${test.input}" expected type "${test.expectedType}", got "${action.type}"`
      );
      failed++;
      continue;
    }

    if (test.expectedQueryOrTitle !== undefined) {
      let extracted: string | undefined;
      if (action.type === 'create_task') {
        extracted = action.payload.title;
      } else if (
        action.type === 'complete_task' ||
        action.type === 'skip_task' ||
        action.type === 'delete_task'
      ) {
        extracted = action.payload.taskTitleQuery;
      }

      if (extracted !== test.expectedQueryOrTitle) {
        console.error(
          `FAIL: "${test.input}" expected query/title "${test.expectedQueryOrTitle}", got "${extracted}"`
        );
        failed++;
        continue;
      }
    }

    passed++;
  }

  // --- Explicit Time Bug Tests (Cases A through G) ---

  // Case A: Flexible task (no explicit time)
  const caseA = parseIntent("Study pathology tomorrow for 2 hours.");
  if (caseA.success && caseA.actions[0]?.type === 'create_task' && (caseA.actions[0].payload.scheduledStartMinute ?? null) === null) {
    passed++;
  } else {
    console.error(`FAIL Case A: expected flexible task with no scheduledStartMinute`);
    failed++;
  }

  // Case B: Explicit 9 AM constraint
  const caseB = parseIntent("Study pathology tomorrow at 9 AM for 2 hours.");
  if (caseB.success && caseB.actions[0]?.type === 'create_task' && caseB.actions[0].payload.scheduledStartMinute === 540) {
    passed++;
  } else {
    console.error(`FAIL Case B: expected scheduledStartMinute = 540 (9 AM)`);
    failed++;
  }

  // Case C: Multi-action sequence (9 AM & 1 PM)
  const caseC = parseIntent("Study pathology tomorrow at 9 AM for 2 hours, then anatomy at 1 PM for 1 hour.");
  if (
    caseC.success &&
    caseC.actions.length === 2 &&
    caseC.actions[0]?.type === 'create_task' &&
    caseC.actions[0].payload.scheduledStartMinute === 540 &&
    caseC.actions[1]?.type === 'create_task' &&
    caseC.actions[1].payload.scheduledStartMinute === 780
  ) {
    passed++;
  } else {
    console.error(`FAIL Case C: expected 2 actions with 9 AM (540) and 1 PM (780)`);
    failed++;
  }

  // Case D: Explicit 9:30 AM
  const caseD = parseIntent("Schedule pathology at 9:30 AM today.");
  if (caseD.success && caseD.actions[0]?.type === 'create_task' && caseD.actions[0].payload.scheduledStartMinute === 570) {
    passed++;
  } else {
    console.error(`FAIL Case D: expected scheduledStartMinute = 570 (9:30 AM)`);
    failed++;
  }

  // Case E: Update existing task with 3 PM constraint
  const caseE = parseIntent("Move pathology to tomorrow at 3 PM.");
  if (caseE.success && caseE.actions[0]?.type === 'update_task' && caseE.actions[0].payload.scheduledStartMinute === 900) {
    passed++;
  } else {
    console.error(`FAIL Case E: expected update_task with scheduledStartMinute = 900 (3 PM)`);
    failed++;
  }

  // Case F: Return task to anytime / flexible
  const caseF = parseIntent("Make pathology anytime tomorrow.");
  if (caseF.success && caseF.actions[0]?.type === 'update_task' && caseF.actions[0].payload.scheduledStartMinute === null) {
    passed++;
  } else {
    console.error(`FAIL Case F: expected update_task with scheduledStartMinute = null`);
    failed++;
  }

  // Case G: Doctor appointment handled safely
  const caseG = parseIntent("Doctor appointment tomorrow at 10 AM.");
  if (caseG !== undefined) {
    passed++;
  } else {
    console.error(`FAIL Case G: Doctor appointment failed execution`);
    failed++;
  }

  // --- Contextual Clarification & Time Parsing Tests ---

  // 1. Reschedule Study Pharmacology to another day -> creates clarification & pending context
  const step1 = parseIntent("Reschedule Study Pharmacology to another day");
  if (!step1.success && step1.clarificationNeeded && step1.pendingClarification?.taskTitleQuery?.toLowerCase() === 'study pharmacology') {
    passed++;
  } else {
    console.error(`FAIL Context Test 1: expected clarification with pending context for Study Pharmacology`);
    failed++;
  }

  // 2. "Yes tomorrow" resolves date using previous context
  const step2 = parseIntent("Yes tomorrow", { pendingClarification: step1.pendingClarification });
  if (!step2.success && step2.clarificationNeeded && step2.pendingClarification?.date !== null && step2.pendingClarification?.missingFields?.includes('time')) {
    passed++;
  } else {
    console.error(`FAIL Context Test 2: expected date resolution to tomorrow and prompt for time`);
    failed++;
  }

  // 3. "12pm" resolves missing time using previous context
  const step3 = parseIntent("12pm", { pendingClarification: step2.pendingClarification });
  if (
    step3.success &&
    step3.actions[0]?.type === 'update_task' &&
    step3.actions[0].payload.scheduledStartMinute === 720 &&
    step3.actions[0].payload.date === step2.pendingClarification?.date
  ) {
    passed++;
  } else {
    console.error(`FAIL Context Test 3: expected update_task with scheduledStartMinute = 720 (12 PM)`);
    failed++;
  }

  // 4. "Move pathology to tomorrow at 12pm" works in one message
  const oneTurn = parseIntent("Move pathology to tomorrow at 12pm");
  if (oneTurn.success && oneTurn.actions[0]?.type === 'update_task' && oneTurn.actions[0].payload.scheduledStartMinute === 720) {
    passed++;
  } else {
    console.error(`FAIL Context Test 4: expected single turn move with scheduledStartMinute = 720`);
    failed++;
  }

  // 5. "Schedule surgery at 7pm" produces 1140
  const t7pm = parseIntent("Schedule surgery at 7pm");
  if (t7pm.success && t7pm.actions[0]?.type === 'create_task' && t7pm.actions[0].payload.scheduledStartMinute === 1140) {
    passed++;
  } else {
    console.error(`FAIL Context Test 5: expected scheduledStartMinute = 1140 (7 PM)`);
    failed++;
  }

  // 6. "Schedule surgery at 12pm" produces 720
  const t12pm = parseIntent("Schedule surgery at 12pm");
  if (t12pm.success && t12pm.actions[0]?.type === 'create_task' && t12pm.actions[0].payload.scheduledStartMinute === 720) {
    passed++;
  } else {
    console.error(`FAIL Context Test 6: expected scheduledStartMinute = 720 (12 PM)`);
    failed++;
  }

  // 7. "12am" produces 0
  const t12am = parseIntent("Schedule surgery at 12am");
  if (t12am.success && t12am.actions[0]?.type === 'create_task' && t12am.actions[0].payload.scheduledStartMinute === 0) {
    passed++;
  } else {
    console.error(`FAIL Context Test 7: expected scheduledStartMinute = 0 (12 AM)`);
    failed++;
  }

  // 8. "7:30pm" produces 1170
  const t730pm = parseIntent("Schedule surgery at 7:30pm");
  if (t730pm.success && t730pm.actions[0]?.type === 'create_task' && t730pm.actions[0].payload.scheduledStartMinute === 1170) {
    passed++;
  } else {
    console.error(`FAIL Context Test 8: expected scheduledStartMinute = 1170 (7:30 PM)`);
    failed++;
  }

  // 9. Context is cleared after successful resolution (step3 returned pendingClarification: null)
  if (step3.pendingClarification === null) {
    passed++;
  } else {
    console.error(`FAIL Context Test 9: pendingClarification was not cleared after resolution`);
    failed++;
  }

  // --- Inability & Partial Match Tests ---
  const sampleContextTasks = [{ id: 'study-pharmacology', title: 'Study Pharmacology' }];

  // TEST 1: "Not able to do pharmacology today" -> resolves to Study Pharmacology, pending clarification exists, taskId preserved
  const inability1 = parseIntent("Not able to do pharmacology today", { tasks: sampleContextTasks });
  if (!inability1.success && inability1.clarificationNeeded && inability1.pendingClarification?.taskId === 'study-pharmacology') {
    passed++;
  } else {
    console.error(`FAIL Target Test 1: "Not able to do pharmacology today" failed to preserve study-pharmacology taskId`);
    failed++;
  }

  // TEST 2: Continue with "Yes" -> taskId remains Study Pharmacology, no "which task?", asks missing fields
  const inability2 = parseIntent("Yes", { tasks: sampleContextTasks, pendingClarification: inability1.pendingClarification });
  if (!inability2.success && inability2.clarificationNeeded && inability2.pendingClarification?.taskId === 'study-pharmacology') {
    passed++;
  } else {
    console.error(`FAIL Target Test 2: "Yes" failed to preserve taskId or asked which task`);
    failed++;
  }

  // TEST 3: Continue: "Reschedule it to Tuesday" -> same taskId, date resolves to Tuesday, time missing
  const inability3 = parseIntent("Reschedule it to Tuesday", { tasks: sampleContextTasks, pendingClarification: inability2.pendingClarification });
  if (!inability3.success && inability3.clarificationNeeded && inability3.pendingClarification?.taskId === 'study-pharmacology' && inability3.pendingClarification?.date !== null) {
    passed++;
  } else {
    console.error(`FAIL Target Test 3: "Reschedule it to Tuesday" failed to set date or preserve taskId`);
    failed++;
  }

  // TEST 4: Continue: "4 pm" -> same taskId, scheduledStartMinute = 960, update_task executable
  const inability4 = parseIntent("4 pm", { tasks: sampleContextTasks, pendingClarification: inability3.pendingClarification });
  if (inability4.success && inability4.actions[0]?.type === 'update_task' && inability4.actions[0].payload.taskId === 'study-pharmacology' && inability4.actions[0].payload.scheduledStartMinute === 960) {
    passed++;
  } else {
    console.error(`FAIL Target Test 4: "4 pm" failed to execute update_task with 960`);
    failed++;
  }

  // TEST 5: Single follow-up: "Yes to Tuesday at 4 pm"
  const singleFollowUp = parseIntent("Yes to Tuesday at 4 pm", { tasks: sampleContextTasks, pendingClarification: inability1.pendingClarification });
  if (singleFollowUp.success && singleFollowUp.actions[0]?.type === 'update_task' && singleFollowUp.actions[0].payload.taskId === 'study-pharmacology' && singleFollowUp.actions[0].payload.scheduledStartMinute === 960) {
    passed++;
  } else {
    console.error(`FAIL Target Test 5: "Yes to Tuesday at 4 pm" failed to generate update_task with 960`);
    failed++;
  }

  // TEST 6: Case-insensitive partial entity: "not able to do PHARMACOLOGY today"
  const partialCase = parseIntent("not able to do PHARMACOLOGY today", { tasks: sampleContextTasks });
  if (!partialCase.success && partialCase.pendingClarification?.taskId === 'study-pharmacology') {
    passed++;
  } else {
    console.error(`FAIL Target Test 6: case-insensitive partial match failed`);
    failed++;
  }

  // TEST 7: Single-turn command: "Move Study Pharmacology to Tuesday at 4 pm"
  const singleTurnMove = parseIntent("Move Study Pharmacology to Tuesday at 4 pm", { tasks: sampleContextTasks });
  if (singleTurnMove.success && singleTurnMove.actions[0]?.type === 'update_task' && singleTurnMove.actions[0].payload.scheduledStartMinute === 960) {
    passed++;
  } else {
    console.error(`FAIL Target Test 7: single-turn move failed with scheduledStartMinute = 960`);
    failed++;
  }

  // TEST 8: Context not lost after one clarification turn
  if (inability2.pendingClarification?.taskId === 'study-pharmacology') {
    passed++;
  } else {
    console.error(`FAIL Target Test 8: context lost after clarification turn`);
    failed++;
  }

  // TEST 9: Context clears after successful update
  if (inability4.pendingClarification === null) {
    passed++;
  } else {
    console.error(`FAIL Target Test 9: context not cleared after successful update`);
    failed++;
  }

  // TEST 10: New unrelated command does not inherit previous task
  const newCmd = parseIntent("add gym for 1 hour", { tasks: sampleContextTasks, pendingClarification: inability1.pendingClarification });
  if (newCmd.success && newCmd.actions[0]?.type === 'create_task' && newCmd.actions[0].payload.title === 'Gym') {
    passed++;
  } else {
    console.error(`FAIL Target Test 10: new unrelated command inherited stale context`);
    failed++;
  }

  // TEST 11: Multiple tasks matching "pharmacology" -> ask clarification instead of guessing
  const multiTasks = [{ id: 'p1', title: 'Study Pharmacology' }, { id: 'p2', title: 'Review Pharmacology' }];
  const multiMatch = parseIntent("Not able to do pharmacology today", { tasks: multiTasks });
  if (!multiMatch.success && multiMatch.clarificationNeeded && multiMatch.error.includes('multiple tasks')) {
    passed++;
  } else {
    console.error(`FAIL Target Test 11: multiple matching tasks did not request clarification`);
    failed++;
  }

  // --- Date-Aware Schedule & Free Time Query Tests ---
  const mockContext = { currentDate: '2026-09-13' }; // Sunday

  // Test 12: "What's my free time tomorrow?" -> requested date = 2026-09-14
  const ftTomorrow = parseIntent("What's my free time tomorrow?", mockContext);
  if (ftTomorrow.success && ftTomorrow.actions[0]?.type === 'get_free_time' && ftTomorrow.actions[0].payload?.date === '2026-09-14') {
    passed++;
  } else {
    console.error(`FAIL Date Test 12: "What's my free time tomorrow?" failed date resolution`);
    failed++;
  }

  // Test 13: "What's my schedule tomorrow?" -> requested date = 2026-09-14
  const schTomorrow = parseIntent("What's my schedule tomorrow?", mockContext);
  if (schTomorrow.success && schTomorrow.actions[0]?.type === 'get_schedule' && schTomorrow.actions[0].payload?.date === '2026-09-14') {
    passed++;
  } else {
    console.error(`FAIL Date Test 13: "What's my schedule tomorrow?" failed date resolution`);
    failed++;
  }

  // Test 14: "What am I doing tomorrow?" -> requested date = 2026-09-14
  const doingTomorrow = parseIntent("What am I doing tomorrow?", mockContext);
  if (doingTomorrow.success && doingTomorrow.actions[0]?.type === 'get_schedule' && doingTomorrow.actions[0].payload?.date === '2026-09-14') {
    passed++;
  } else {
    console.error(`FAIL Date Test 14: "What am I doing tomorrow?" failed date resolution`);
    failed++;
  }

  // Test 15: "What's my free time today?" -> requested date = 2026-09-13
  const ftToday = parseIntent("What's my free time today?", mockContext);
  if (ftToday.success && ftToday.actions[0]?.type === 'get_free_time' && ftToday.actions[0].payload?.date === '2026-09-13') {
    passed++;
  } else {
    console.error(`FAIL Date Test 15: "What's my free time today?" failed date resolution`);
    failed++;
  }

  // Test 16: "How much free time do I have Monday?" -> 2026-09-14 (Monday relative to 2026-09-13 Sunday)
  const ftMonday = parseIntent("How much free time do I have Monday?", mockContext);
  if (ftMonday.success && ftMonday.actions[0]?.type === 'get_free_time' && ftMonday.actions[0].payload?.date === '2026-09-14') {
    passed++;
  } else {
    console.error(`FAIL Date Test 16: "How much free time do I have Monday?" failed Monday resolution`);
    failed++;
  }

  // Test 17: "When can I study pharmacology tomorrow?" -> date = 2026-09-14, targetTaskTitleQuery = 'pharmacology'
  const whenPharm = parseIntent("When can I study pharmacology tomorrow?", mockContext);
  if (whenPharm.success && whenPharm.actions[0]?.type === 'get_free_time' && whenPharm.actions[0].payload?.date === '2026-09-14' && whenPharm.actions[0].payload?.targetTaskTitleQuery === 'pharmacology') {
    passed++;
  } else {
    console.error(`FAIL Date Test 17: "When can I study pharmacology tomorrow?" failed resolution`);
    failed++;
  }

  // Test 18: Default no-date schedule query -> preserves today (2026-09-13)
  const defaultSch = parseIntent("what's my schedule?", mockContext);
  if (defaultSch.success && defaultSch.actions[0]?.type === 'get_schedule' && defaultSch.actions[0].payload?.date === '2026-09-13') {
    passed++;
  } else {
    console.error(`FAIL Date Test 18: default no-date schedule failed to preserve today`);
    failed++;
  }

  console.log(`Parser Tests Result: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} tests.`);
  return { passed, failed };
}

runParserTests();

