export type Profile = { salary: number; payday: number; rent: number; vehicle: number; utilities: number; debt: number; meals: number; coffee: number; leisure: number; misc: number };
export type Cuts = { coffee: boolean; meals: boolean; leisure: boolean };
export const defaults: Profile = { salary: 4200, payday: 25, rent: 800, vehicle: 450, utilities: 150, debt: 200, meals: 30, coffee: 15, leisure: 10, misc: 10 };
export const noCuts: Cuts = { coffee: false, meals: false, leisure: false };
export const DAY = 86400000;
export type Expense = { id: string; date: string; amount: number; category: string; note: string };
export type Ledger = { expenses: Expense[]; days: Record<string, number> };
export const categories: Record<string, string> = { meals: 'Food', coffee: 'Coffee & drinks', petrol: 'Fuel & transport', shopping: 'Shopping', leisure: 'Leisure', misc: 'Other' };
export const billNames: Record<string, string> = { rent: 'Rent / home', vehicle: 'Car / motorbike', utilities: 'Utilities & Wi-Fi', debt: 'Debt / other' };
export function emptyLedger(): Ledger { return { expenses: [], days: {} }; }
export function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function parseDay(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function validDay(s: unknown): s is string { return typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(s) && dateKey(parseDay(s)) === s; }
export function validMoney(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10000000 && Math.abs(n * 100 - Math.round(n * 100)) < .00001; }
const validBudget = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 40000000;
function validExpense(value: unknown): value is Expense {
  const e = value as Expense;
  return !!e && typeof e === 'object' && typeof e.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(e.id) && validDay(e.date) && validMoney(e.amount) && e.amount > 0 && Object.hasOwn(categories, e.category) && typeof e.note === 'string' && e.note.length <= 120;
}
// Keeps every readable record instead of rejecting the whole ledger; `dropped` counts what could not be kept.
export function salvageLedger(value: unknown, fallbackBudget: number) {
  const source = (value && typeof value === 'object' ? value : {}) as { expenses?: unknown; days?: unknown };
  const rawDays = source.days && typeof source.days === 'object' && !Array.isArray(source.days) ? source.days as Record<string, unknown> : {};
  const rawExpenses: unknown[] = Array.isArray(source.expenses) ? source.expenses : [];
  let dropped = (rawDays === source.days ? 0 : 1) + (rawExpenses === source.expenses ? 0 : 1);
  const days: Record<string, number> = {}, expenses: Expense[] = [], ids = new Set<string>();
  for (const [date, budget] of Object.entries(rawDays)) { if (validDay(date) && validBudget(budget)) days[date] = budget; else dropped++; }
  for (const e of rawExpenses) {
    if (!validExpense(e) || ids.has(e.id) || expenses.length >= 10000) { dropped++; continue; }
    ids.add(e.id); days[e.date] ??= fallbackBudget;
    expenses.push({ id: e.id, date: e.date, amount: e.amount, category: e.category, note: e.note });
  }
  return { ledger: { expenses, days } as Ledger, dropped };
}
// A date whose last entry moved or was deleted goes back to the estimate instead of counting as RM0 spending.
export function releaseEmptyDay(ledger: Ledger, date: string) { if (!ledger.expenses.some(e => e.date === date)) delete ledger.days[date]; }
// Recorded days replace the estimate. Today is spread over its elapsed portion for chart history.
export function spendingTo(p: Profile, ledger: Ledger, start: Date, until: Date, now: Date) {
  const daily = p.meals + p.coffee + p.leisure + p.misc;
  let total = daily * Math.max(0, (until.getTime() - start.getTime()) / DAY);
  const totals = new Map<string, number>();
  for (const e of ledger.expenses) totals.set(e.date, (totals.get(e.date) || 0) + e.amount);
  for (const key of Object.keys(ledger.days)) {
    const day = parseDay(key), end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    const left = Math.max(start.getTime(), day.getTime()), right = Math.min(until.getTime(), end.getTime(), now.getTime());
    if (right < left || day > now || end <= start) continue;
    const elapsed = Math.max(0, right - left);
    const whole = Math.max(0, Math.min(end.getTime(), now.getTime()) - left);
    total += (totals.get(key) || 0) * (whole === 0 ? 1 : elapsed / whole) - daily * elapsed / DAY;
  }
  return total;
}
export function purchaseImpact(r: ReturnType<typeof calculate>, amount: number, delay = 0) {
  const balance = r.balance - amount, projected = r.projected - amount;
  const days = balance <= 0 ? 0 : r.adjusted === 0 ? Infinity : r.estimateDelay + balance / r.adjusted;
  const lostDays = r.days === Infinity && days === Infinity ? 0 : r.days - days;
  const atEvent = r.balance - r.adjusted * Math.max(0, delay - r.estimateDelay) - amount;
  return { balance, projected, days, lostDays, atEvent, safe: atEvent >= 0 && projected >= 0 };
}
export function monthRecap(ledger: Ledger, month: string) {
  const expenses = ledger.expenses.filter(e => e.date.startsWith(month + '-'));
  const days = Object.entries(ledger.days).filter(([d]) => d.startsWith(month + '-'));
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const budget = days.reduce((sum, [, amount]) => sum + amount, 0);
  const breakdown = Object.entries(categories).map(([key, label]) => ({ key, label, total: expenses.filter(e => e.category === key).reduce((sum, e) => sum + e.amount, 0) })).sort((a, b) => b.total - a.total);
  return { total, budget, days: days.length, count: expenses.length, breakdown };
}
export function billEvents(p: Profile, due: Record<string, number>, year: number, month: number) {
  return Object.entries(billNames).map(([key, label]) => ({ key, label, amount: p[key as keyof Profile], date: paydayAt(year, month, due[key] || p.payday) })).filter(e => e.amount > 0).sort((a, b) => a.date.getTime() - b.date.getTime());
}
function finiteDate(timestamp: number) { return Number.isFinite(timestamp) && Math.abs(timestamp) <= 8640000000000000 ? new Date(timestamp) : null; }
export function paydayAt(year: number, month: number, day: number) { return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate())); }
export function cycle(now: Date, day: number) {
  const thisPay = paydayAt(now.getFullYear(), now.getMonth(), day);
  const start = now >= thisPay ? thisPay : paydayAt(now.getFullYear(), now.getMonth() - 1, day);
  const end = paydayAt(start.getFullYear(), start.getMonth() + 1, day);
  return { start, end, elapsed: (now.getTime() - start.getTime()) / DAY, remaining: (end.getTime() - now.getTime()) / DAY, length: (end.getTime() - start.getTime()) / DAY };
}
export function calculate(p: Profile, cuts: Cuts, now: Date, ledger: Ledger = emptyLedger()) {
  const period = cycle(now, p.payday);
  const fixed = p.rent + p.vehicle + p.utilities + p.debt;
  const disposable = p.salary - fixed;
  const daily = p.meals + p.coffee + p.leisure + p.misc;
  const saved = (cuts.coffee ? p.coffee : 0) + (cuts.meals ? p.meals * 0.5 : 0) + (cuts.leisure ? p.leisure : 0);
  const adjusted = Math.max(0, daily - saved);
  const spent = spendingTo(p, ledger, period.start, now, now);
  const balance = disposable - spent;
  // A logged day's total is final, today included: estimated spending resumes at the next midnight.
  const estimateDelay = Object.hasOwn(ledger.days, dateKey(now)) ? (new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()) / DAY : 0;
  const estimatedDays = Math.max(0, period.remaining - estimateDelay);
  const days = balance <= 0 ? 0 : adjusted === 0 ? Infinity : estimateDelay + balance / adjusted;
  const baseDays = balance <= 0 ? 0 : daily === 0 ? Infinity : estimateDelay + balance / daily;
  let depleted: Date | null = disposable <= 0 ? period.start : null;
  if (balance <= 0 && !depleted) {
    let low = period.start.getTime(), high = now.getTime();
    for (let i = 0; i < 48; i++) { const mid = (low + high) / 2; if (spendingTo(p, ledger, period.start, new Date(mid), now) >= disposable) high = mid; else low = mid; }
    depleted = new Date(high);
  }
  const dday = balance <= 0 ? depleted : Number.isFinite(days) ? finiteDate(now.getTime() + days * DAY) : null;
  const hp = disposable > 0 ? Math.min(100, Math.max(0, balance / disposable * 100)) : 0;
  return { period, fixed, disposable, daily, saved, adjusted, spent, balance, days, baseDays, dday, hp, estimateDelay, estimatedDays, projected: balance - adjusted * estimatedDays, baseProjected: balance - daily * estimatedDays };
}
export function validateProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Profile;
  return Object.keys(defaults).every(k => typeof p[k as keyof Profile] === 'number' && Number.isFinite(p[k as keyof Profile]) && p[k as keyof Profile] >= 0 && p[k as keyof Profile] <= 10000000) && Number.isInteger(p.payday) && p.payday >= 1 && p.payday <= 31;
}
export const DATA_VERSION = 2;
const validDueDay = (key: string, day: unknown) => Object.hasOwn(billNames, key) && Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 31;
export function validateDue(value: unknown): value is Record<string, number> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([key, day]) => validDueDay(key, day)); }
// Saves made before a budget field existed lack it, so that bill or spending line starts at RM0. Salary and payday must be present.
function migrateProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const profile = Object.fromEntries(Object.keys(defaults).map(key => [key, source[key] === undefined && key !== 'salary' && key !== 'payday' ? 0 : source[key]]));
  return validateProfile(profile) ? profile : null;
}
// Reads saved or backed-up data part by part, so one unreadable part never discards the others.
// Unversioned saves predate DATA_VERSION and share its shape; add upgrades for older versions here when the format changes.
export function restoreData(value: unknown) {
  const v = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, any>;
  const migrated = migrateProfile(v.profile), profile = migrated ?? { ...defaults };
  const cuts = Object.fromEntries(Object.keys(noCuts).map(key => [key, v.cuts?.[key] === true])) as Cuts;
  const salvaged = v.ledger === undefined ? { ledger: emptyLedger(), dropped: 0 } : salvageLedger(v.ledger, profile.meals + profile.coffee + profile.leisure + profile.misc);
  const dueReadable = v.billDue === undefined || (!!v.billDue && typeof v.billDue === 'object' && !Array.isArray(v.billDue));
  const dueEntries = dueReadable && v.billDue ? Object.entries(v.billDue) : [];
  const billDue: Record<string, number> = Object.fromEntries(dueEntries.filter(([key, day]) => validDueDay(key, day)));
  const skipped = salvaged.dropped + (dueReadable ? dueEntries.length - Object.keys(billDue).length : 1);
  const newer = typeof v.version === 'number' && v.version > DATA_VERSION, profileLost = !migrated;
  return { data: { profile, custom: !profileLost && v.custom === true, cuts, ledger: salvaged.ledger, billDue }, newer, profileLost, skipped, complete: !newer && !profileLost && skipped === 0 };
}
export function health(hp: number) {
  if (hp >= 75) return { text: 'Masih selesa. Jangan terus shopping.', color: '#c7f36b', label: 'SAFE' };
  if (hp >= 40) return { text: 'Masih boleh bernafas.', color: '#e7c46a', label: 'TAKE CARE' };
  if (hp >= 15) return { text: 'Masa untuk slow sikit.', color: '#f0a46b', label: 'RUNNING LOW' };
  if (hp > 0) return { text: 'Bajet ketat. Kita adjust dulu.', color: '#f48b85', label: 'CRITICAL' };
  return { text: 'Baki dah habis. Jom semak plan.', color: '#f48b85', label: 'OUT OF MONEY' };
}
