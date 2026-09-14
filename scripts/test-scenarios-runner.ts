import { parseIntent } from '../src/ai/mock-intent-parser';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${msg}`);
  } else {
    failed++;
    console.error(`✗ FAIL: ${msg}`);
  }
}

console.log('\n--- SCENARIO TESTS ---\n');

// GENERAL CONVERSATION
const gc1 = parseIntent("Hey hi, what's up?");
assert(gc1.success && (gc1.actions as any)[0]?.payload.operation === 'general_conversation', "GC1: Hey hi, what's up? -> general_conversation");

const gc2 = parseIntent("Hi");
assert(gc2.success && (gc2.actions as any)[0]?.payload.operation === 'general_conversation', "GC2: Hi -> general_conversation");

const gc3 = parseIntent("Thanks");
assert(gc3.success && (gc3.actions as any)[0]?.payload.operation === 'general_conversation', "GC3: Thanks -> general_conversation");

const gc4 = parseIntent("Okay");
assert(gc4.success && (gc4.actions as any)[0]?.payload.operation === 'general_conversation', "GC4: Okay -> general_conversation");

// AMBIGUOUS & PARTIAL
const pt1 = parseIntent("Can you pick me an appointment tomorrow at 5?");
assert(!pt1.success && pt1.clarificationNeeded === true && (pt1.actions as any)[0]?.type === 'clarification', "PT1: Missing title -> requests clarification");
const cand1 = (pt1.actions as any)[0]?.payload.candidateAction;
assert(cand1 && cand1.payload.scheduling.startMinute === 1020, "PT1: Preserves 5 PM (1020)");

const amb1 = parseIntent("book me an apartment remote at 4");
assert(!amb1.success && amb1.clarificationNeeded === true && (amb1.actions as any)[0]?.type === 'clarification', "AMB1: Ambiguous -> requests clarification");
const cand2 = (amb1.actions as any)[0]?.payload.candidateAction;
assert(cand2 && cand2.payload.scheduling.startMinute === 960, "AMB1: Preserves 4 PM (960)");

console.log(`\nSCENARIO TEST RESULTS: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
