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

  console.log(`Parser Tests Result: ${passed} PASSED, ${failed} FAILED out of ${allTests.length} tests.`);
  return { passed, failed };
}
