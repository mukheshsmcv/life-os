const assert = require('assert');

function calculateIndices(value) {
  let h = Math.floor(value / 60);
  const m = value % 60;
  let p = 0; // AM
  if (h >= 12) {
    p = 1; // PM
    if (h > 12) h -= 12;
  } else if (h === 0) {
    h = 12;
  }
  return { hIndex: h - 1, mIndex: m, pIndex: p };
}

function calculateValue(hIndex, mIndex, pIndex) {
  let h = hIndex + 1;
  const m = mIndex;
  const isPM = pIndex === 1;

  if (isPM && h < 12) h += 12;
  if (!isPM && h === 12) h = 0;

  return h * 60 + m;
}

const tests = [
  { name: '12:00 AM = 0', value: 0, expected: { hIndex: 11, mIndex: 0, pIndex: 0 } },
  { name: '12:01 AM = 1', value: 1, expected: { hIndex: 11, mIndex: 1, pIndex: 0 } },
  { name: '1:00 AM = 60', value: 60, expected: { hIndex: 0, mIndex: 0, pIndex: 0 } },
  { name: '11:59 AM = 719', value: 719, expected: { hIndex: 10, mIndex: 59, pIndex: 0 } },
  { name: '12:00 PM = 720', value: 720, expected: { hIndex: 11, mIndex: 0, pIndex: 1 } },
  { name: '1:00 PM = 780', value: 780, expected: { hIndex: 0, mIndex: 0, pIndex: 1 } },
  { name: '1:30 PM = 810', value: 810, expected: { hIndex: 0, mIndex: 30, pIndex: 1 } },
  { name: '11:59 PM = 1439', value: 1439, expected: { hIndex: 10, mIndex: 59, pIndex: 1 } },
];

let passed = 0;
let failed = 0;

console.log('--- STARTING TIME PICKER CONVERSION TESTS ---');

tests.forEach(({ name, value, expected }) => {
  try {
    const indices = calculateIndices(value);
    assert.deepStrictEqual(indices, expected);
    const back = calculateValue(indices.hIndex, indices.mIndex, indices.pIndex);
    assert.strictEqual(back, value);
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
});

console.log(`\nRESULTS: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
