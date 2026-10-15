import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, cycle, defaults, noCuts, validateProfile, emptyLedger, spendingTo, validateLedger, purchaseImpact, monthRecap, billEvents, validDay } from './finance.ts';
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

test('actual expenses replace only their recorded day and are not deducted twice', () => {
  const ledger = { days: { '2026-10-02': 65, '2026-10-03': 65 }, expenses: [{ id: 'a', date: '2026-10-02', amount: 20, category: 'meals', note: '' }, { id: 'b', date: '2026-10-03', amount: 10, category: 'coffee', note: '' }] };
  const now = new Date(2026, 9, 3, 12), p = { ...defaults, payday: 1 };
  const result = calculate(p, noCuts, now, ledger);
  assert.equal(result.spent, 65 + 20 + 10);
  assert.equal(result.balance, 2600 - 95);
  assert.equal(spendingTo(p, ledger, result.period.start, now, now), result.spent);
  const nextDay = calculate(p, noCuts, new Date(2026, 9, 4), ledger);
  assert.equal(nextDay.spent, 95);
});

test('zero-spend day replaces estimate and older cycle records do not affect current balance', () => {
  const ledger = { days: { '2026-09-30': 65, '2026-10-02': 65 }, expenses: [{ id: 'old', date: '2026-09-30', amount: 2000, category: 'misc', note: '' }] };
  assert.equal(calculate({ ...defaults, payday: 1 }, noCuts, new Date(2026, 9, 3), ledger).spent, 65);
});

test('actual spending at payday midnight is included and has a valid depletion date', () => {
  const ledger = { days: { '2026-10-01': 65 }, expenses: [{ id: 'a', date: '2026-10-01', amount: 3000, category: 'shopping', note: '' }] };
  const now = new Date(2026, 9, 1), r = calculate({ ...defaults, payday: 1 }, noCuts, now, ledger);
  assert.equal(r.balance, -400); assert.equal(r.dday?.getTime(), now.getTime()); assert.equal(r.days, 0);
});

test('recorded history is monotonic and reaches dashboard balance', () => {
  const ledger = { days: { '2026-10-02': 65 }, expenses: [{ id: 'a', date: '2026-10-02', amount: 500, category: 'shopping', note: '' }] };
  const now = new Date(2026, 9, 3), start = new Date(2026, 9, 1);
  let previous = 0;
  for (let hour = 0; hour <= 48; hour++) { const spent = spendingTo(defaults, ledger, start, new Date(2026, 9, 1, hour), now); assert.ok(spent >= previous); previous = spent; }
  assert.equal(previous, 565);
});

test('purchase and emergency scenarios preserve source data and expose shortfalls', () => {
  const r = calculate(defaults, noCuts, new Date(2026, 9, 15));
  const before = structuredClone(r);
  assert.equal(purchaseImpact(r, 150).projected, r.projected - 150);
  assert.equal(purchaseImpact(r, 10000).safe, false);
  assert.equal(purchaseImpact(r, 500, 2).atEvent, r.balance - r.adjusted * 2 - 500);
  assert.deepEqual(r, before);
  const zero = calculate({ ...defaults, meals: 0, coffee: 0, leisure: 0, misc: 0 }, noCuts, new Date(2026, 9, 15));
  assert.equal(purchaseImpact(zero, 150).lostDays, 0);
  assert.equal(purchaseImpact(zero, 3000).days, 0);
});

test('recap compares only tracked days using their captured daily budgets', () => {
  const ledger = { days: { '2026-10-02': 65, '2026-10-03': 80, '2026-09-30': 65 }, expenses: [{ id: 'a', date: '2026-10-02', amount: 100, category: 'meals', note: '' }, { id: 'b', date: '2026-09-30', amount: 50, category: 'misc', note: '' }] };
  const recap = monthRecap(ledger, '2026-10');
  assert.equal(recap.total, 100); assert.equal(recap.days, 2); assert.equal(recap.budget, 145); assert.equal(recap.breakdown[0].key, 'meals');
  assert.equal(monthRecap(ledger, '2025-01').days, 0);
});

test('ledger validation rejects malformed dates, duplicate IDs, fractional cents and unsafe categories', () => {
  const entry = { id: 'a', date: '2026-10-02', amount: 12.5, category: 'meals', note: '' }, ledger = { days: { '2026-10-02': 65 }, expenses: [entry] };
  assert.ok(validateLedger(ledger)); assert.ok(validateLedger(emptyLedger()));
  assert.ok(!validDay('2026-02-30')); assert.ok(validDay('2024-02-29'));
  assert.ok(!validateLedger({ ...ledger, expenses: [entry, entry] }));
  assert.ok(!validateLedger({ ...ledger, expenses: [{ ...entry, amount: 12.001 }] }));
  assert.ok(!validateLedger({ ...ledger, expenses: [{ ...entry, category: '__proto__' }] }));
  assert.ok(!validateLedger({ ...ledger, days: {} }));
});

test('bill calendar clamps short months and keeps payday defaults for unconfigured dates', () => {
  const events = billEvents({ ...defaults, payday: 25 }, { rent: 31, utilities: 15 }, 2026, 1);
  assert.equal(events.find(e => e.key === 'rent')?.date.getDate(), 28);
  assert.equal(events.find(e => e.key === 'vehicle')?.date.getDate(), 25);
  assert.equal(events[0].key, 'utilities');
});
