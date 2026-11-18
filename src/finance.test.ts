import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, cycle, defaults, noCuts, validateProfile, emptyLedger, spendingTo, salvageLedger, purchaseImpact, monthRecap, billEvents, validDay, restoreData, releaseEmptyDay, DATA_VERSION } from './finance.ts';
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
  assert.equal(result.spent, 65 + 20 + 32.5, 'an open today counts at least its estimate so far (RM65 x half a day)');
  assert.equal(spendingTo(p, ledger, result.period.start, now, now), result.spent);
  const done = calculate(p, noCuts, now, { ...ledger, closed: '2026-10-03' });
  assert.equal(done.spent, 65 + 20 + 10); assert.equal(done.balance, 2600 - 95);
  const nextDay = calculate(p, noCuts, new Date(2026, 9, 4), ledger);
  assert.equal(nextDay.spent, 95, 'once the day has passed, its logged total is final');
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

test('ledger salvage keeps readable records and drops malformed dates, duplicate IDs, fractional cents and unsafe categories', () => {
  const entry = { id: 'a', date: '2026-10-02', amount: 12.5, category: 'meals', note: '' };
  const clean = salvageLedger({ days: { '2026-10-02': 65 }, expenses: [entry] }, 65);
  assert.equal(clean.dropped, 0); assert.deepEqual(clean.ledger, { days: { '2026-10-02': 65 }, expenses: [entry] });
  assert.equal(salvageLedger(emptyLedger(), 65).dropped, 0);
  assert.ok(!validDay('2026-02-30')); assert.ok(validDay('2024-02-29'));
  const messy = salvageLedger({ days: { '2026-10-02': 65, '2026-02-30': 65 }, expenses: [entry, entry, { ...entry, id: 'b', amount: 12.001 }, { ...entry, id: 'c', category: '__proto__' }, { ...entry, id: 'd', date: '2026-10-05', note: 'kept' }] }, 70);
  assert.equal(messy.dropped, 4);
  assert.deepEqual(messy.ledger.expenses.map(e => e.id), ['a', 'd']);
  assert.equal(messy.ledger.days['2026-10-05'], 70, 'an entry missing its day record gets the current daily budget');
  assert.equal(salvageLedger('garbage', 65).dropped, 2);
  assert.equal(salvageLedger({ days: { '2026-10-02': 65 }, expenses: [], closed: '2026-10-02' }, 65).ledger.closed, '2026-10-02');
  assert.ok(!('closed' in salvageLedger({ days: {}, expenses: [], closed: '2026-10-09' }, 65).ledger), 'a done mark without its day is ignored');
});

test('saved data loads part by part: an unreadable budget never discards records', () => {
  const ledger = { days: { '2026-10-02': 65 }, expenses: [{ id: 'a', date: '2026-10-02', amount: 20, category: 'meals', note: '' }] };
  const r = restoreData({ profile: { ...defaults, salary: -1 }, custom: true, cuts: { coffee: true }, ledger, billDue: { rent: 5 } });
  assert.ok(r.profileLost); assert.ok(!r.complete); assert.equal(r.data.custom, false); assert.deepEqual(r.data.profile, defaults);
  assert.deepEqual(r.data.ledger, ledger); assert.deepEqual(r.data.billDue, { rent: 5 }); assert.equal(r.data.cuts.coffee, true);
});

test('older saves missing a newer budget field keep everything, with that field at RM0', () => {
  const { misc, ...older } = defaults;
  const r = restoreData({ profile: older, custom: true, cuts: {} });
  assert.ok(r.complete); assert.equal(r.data.profile.misc, 0); assert.equal(r.data.profile.salary, defaults.salary); assert.equal(r.data.custom, true);
  assert.deepEqual(r.data.ledger, emptyLedger()); assert.deepEqual(r.data.billDue, {});
  assert.ok(restoreData({ profile: { ...defaults, salary: undefined } }).profileLost, 'salary must be present');
});

test('partly damaged or newer data is flagged so the original can be kept', () => {
  const r = restoreData({ profile: defaults, ledger: { days: { '2026-10-02': 65 }, expenses: [{ id: 'bad id!', date: '2026-10-02', amount: 5, category: 'meals', note: '' }] }, billDue: { rent: 40, vehicle: 3 } });
  assert.equal(r.skipped, 2); assert.ok(!r.complete); assert.deepEqual(r.data.billDue, { vehicle: 3 }); assert.deepEqual(r.data.ledger.days, { '2026-10-02': 65 });
  const newer = restoreData({ version: DATA_VERSION + 1, profile: defaults });
  assert.ok(newer.newer); assert.ok(!newer.complete);
  assert.ok(restoreData(undefined).profileLost);
});

test('moving or deleting a date\'s last entry returns that date to the estimate', () => {
  const p = { ...defaults, payday: 1 }, now = new Date(2026, 10, 18, 12);
  const days: Record<string, number> = { '2026-11-10': 65 }, ledger = { days, expenses: [{ id: 'a', date: '2026-11-10', amount: 65, category: 'meals', note: '' }] };
  const before = calculate(p, noCuts, now, ledger).balance;
  ledger.expenses[0] = { ...ledger.expenses[0], date: '2026-11-11' }; days['2026-11-11'] = 65; releaseEmptyDay(ledger, '2026-11-10');
  assert.ok(!Object.hasOwn(days, '2026-11-10')); assert.equal(calculate(p, noCuts, now, ledger).balance, before);
  releaseEmptyDay(ledger, '2026-11-11'); assert.ok(Object.hasOwn(days, '2026-11-11'), 'a date that still has entries stays recorded');
  const closedDay = { days: { '2026-11-18': 65 } as Record<string, number>, expenses: [], closed: '2026-11-18' as string | undefined };
  releaseEmptyDay(closedDay, '2026-11-18'); assert.equal(closedDay.closed, undefined, 'releasing a done day also clears its done mark');
});

test('logging a small morning coffee never raises the balance or the forecast', () => {
  const p = { ...defaults, payday: 1 }, morning = new Date(2026, 10, 18, 9);
  const before = calculate(p, noCuts, morning);
  const after = calculate(p, noCuts, morning, { days: { '2026-11-18': 65 }, expenses: [{ id: 'k', date: '2026-11-18', amount: 5, category: 'coffee', note: '' }] });
  assert.equal(after.balance, before.balance); assert.equal(after.projected, before.projected); assert.equal(after.estimateDelay, 0);
});

test('an open today keeps estimating the rest of the day; marking it done makes its total final', () => {
  const p = { ...defaults, payday: 1 }, noon = new Date(2026, 10, 18, 12), unlogged = calculate(p, noCuts, noon);
  const big = calculate(p, noCuts, noon, { days: { '2026-11-18': 65 }, expenses: [{ id: 'm', date: '2026-11-18', amount: 100, category: 'shopping', note: '' }] });
  assert.equal(big.balance, unlogged.balance - (100 - 32.5));
  assert.equal(big.projected, big.balance - 65 * big.period.remaining, 'the rest of today stays estimated');
  const done = calculate(p, noCuts, noon, { days: { '2026-11-18': 65 }, expenses: [{ id: 'a', date: '2026-11-18', amount: 65, category: 'meals', note: '' }], closed: '2026-11-18' });
  assert.equal(done.estimateDelay, .5);
  assert.equal(done.projected, unlogged.projected); assert.equal(done.days, unlogged.days); assert.equal(done.dday?.getTime(), unlogged.dday?.getTime());
  assert.equal(purchaseImpact(done, 100, .5).atEvent, done.balance - 100, 'no estimated spending before tomorrow');
  assert.equal(purchaseImpact(done, 100, 1.5).atEvent, done.balance - 65 - 100);
  const stale = calculate(p, noCuts, noon, { days: { '2026-11-18': 65 }, expenses: [], closed: '2026-11-17' });
  assert.equal(stale.estimateDelay, 0, 'a done mark from another day does not close today');
});

test('bill calendar clamps short months and keeps payday defaults for unconfigured dates', () => {
  const events = billEvents({ ...defaults, payday: 25 }, { rent: 31, utilities: 15 }, 2026, 1);
  assert.equal(events.find(e => e.key === 'rent')?.date.getDate(), 28);
  assert.equal(events.find(e => e.key === 'vehicle')?.date.getDate(), 25);
  assert.equal(events[0].key, 'utilities');
});
