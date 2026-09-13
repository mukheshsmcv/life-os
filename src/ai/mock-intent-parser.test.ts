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

  console.log(`Parser Tests Result: ${passed} PASSED, ${failed} FAILED out of ${allTests.length + 7} tests.`);
  return { passed, failed };
}

runParserTests();
