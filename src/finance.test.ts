import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, cycle, defaults, noCuts, validateProfile } from './finance.ts';
test('payday 31 clamps across February and rolls to March 31', () => {
  const c = cycle(new Date(2026, 1, 28, 12), 31);
  assert.equal(c.start.getDate(), 28); assert.equal(c.end.getDate(), 31); assert.equal(c.end.getMonth(), 2);
});
test('leap year payday and exact payday rollover', () => {
  assert.equal(cycle(new Date(2024, 1, 29), 31).start.getDate(), 29);
  assert.equal(cycle(new Date(2026, 9, 25), 25).elapsed, 0);
});
test('zero daily burn never divides by zero', () => {
  const r = calculate({ ...defaults, meals: 0, coffee: 0, leisure: 0, misc: 0 }, noCuts, new Date(2026, 9, 14));
  assert.equal(r.days, Infinity); assert.equal(r.dday, null); assert.equal(r.projected, r.disposable);
});
test('commitments exceeding salary produce zero HP and immediate depletion', () => {
  const r = calculate({ ...defaults, salary: 500 }, noCuts, new Date(2026, 9, 14));
  assert.equal(r.hp, 0); assert.equal(r.days, 0); assert.equal(r.dday?.getTime(), r.period.start.getTime());
});
test('what-if only affects future spending, never restores past expenses', () => {
  const now = new Date(2026, 9, 14, 12);
  const a = calculate(defaults, noCuts, now);
  const b = calculate(defaults, { coffee: true, meals: true, leisure: true }, now);
  assert.equal(a.balance, b.balance); assert.equal(b.saved, 40);
  assert.ok(Math.abs(b.projected - a.projected - 40 * a.period.remaining) < 1e-8);
});
test('huge daily expenses stay finite and cannot be rescued retrospectively', () => {
  const r = calculate({ ...defaults, coffee: 5000 }, { ...noCuts, coffee: true }, new Date(2026, 9, 14));
  assert.equal(r.days, 0); assert.ok(Number.isFinite(r.projected));
});
test('persisted profile rejects incomplete, negative and invalid payday data', () => {
  assert.ok(validateProfile(defaults)); assert.ok(!validateProfile({ salary: 4000 }));
  assert.ok(!validateProfile({ ...defaults, payday: 0 })); assert.ok(!validateProfile({ ...defaults, meals: -1 }));
});
test('extreme savings never create an invalid Date', () => {
  const r = calculate({ ...defaults, salary: 10000000, meals: .01, coffee: 0, leisure: 0, misc: 0 }, noCuts, new Date(2026, 9, 14));
  assert.equal(r.dday, null); assert.ok(Number.isFinite(r.days));
});
