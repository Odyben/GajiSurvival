export type Profile = { salary: number; payday: number; rent: number; vehicle: number; utilities: number; debt: number; meals: number; coffee: number; leisure: number; misc: number };
export type Cuts = { coffee: boolean; meals: boolean; leisure: boolean };
export const defaults: Profile = { salary: 4200, payday: 25, rent: 800, vehicle: 450, utilities: 150, debt: 200, meals: 30, coffee: 15, leisure: 10, misc: 10 };
export const noCuts: Cuts = { coffee: false, meals: false, leisure: false };
export const DAY = 86400000;
export type Expense = { id: string; date: string; amount: number; category: string; note: string };
export type Ledger = { expenses: Expense[]; days: Record<string, number> };
export const categories: Record<string, string> = { meals: 'Makan', coffee: 'Kopi & minuman', petrol: 'Petrol & pengangkutan', shopping: 'Shopping', leisure: 'Hiburan', misc: 'Lain-lain' };
export const billNames: Record<string, string> = { rent: 'Sewa / rumah', vehicle: 'Kereta / motor', utilities: 'Utiliti & Wi-Fi', debt: 'Hutang / lain-lain' };
export function emptyLedger(): Ledger { return { expenses: [], days: {} }; }
export function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function parseDay(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function validDay(s: unknown): s is string { return typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(s) && dateKey(parseDay(s)) === s; }
export function validMoney(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10000000 && Math.abs(n * 100 - Math.round(n * 100)) < .00001; }
export function validateLedger(value: unknown): value is Ledger {
  if (!value || typeof value !== 'object') return false;
  const l = value as Ledger;
  if (!Array.isArray(l.expenses) || l.expenses.length > 10000 || !l.days || typeof l.days !== 'object' || Array.isArray(l.days) || Object.keys(l.days).length > 36600) return false;
  if (!Object.entries(l.days).every(([d, n]) => validDay(d) && typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 40000000)) return false;
  return l.expenses.every(e => e && typeof e.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(e.id) && validDay(e.date) && Object.hasOwn(l.days, e.date) && validMoney(e.amount) && e.amount > 0 && Object.hasOwn(categories, e.category) && typeof e.note === 'string' && e.note.length <= 120) && new Set(l.expenses.map(e => e.id)).size === l.expenses.length;
}
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
  const days = balance <= 0 ? 0 : r.adjusted === 0 ? Infinity : balance / r.adjusted;
  const lostDays = r.days === Infinity && days === Infinity ? 0 : r.days - days;
  const atEvent = r.balance - r.adjusted * delay - amount;
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
  const days = balance <= 0 ? 0 : adjusted === 0 ? Infinity : balance / adjusted;
  const baseDays = balance <= 0 ? 0 : daily === 0 ? Infinity : balance / daily;
  let depleted: Date | null = disposable <= 0 ? period.start : null;
  if (balance <= 0 && !depleted) {
    let low = period.start.getTime(), high = now.getTime();
    for (let i = 0; i < 48; i++) { const mid = (low + high) / 2; if (spendingTo(p, ledger, period.start, new Date(mid), now) >= disposable) high = mid; else low = mid; }
    depleted = new Date(high);
  }
  const dday = balance <= 0 ? depleted : Number.isFinite(days) ? finiteDate(now.getTime() + days * DAY) : null;
  const hp = disposable > 0 ? Math.min(100, Math.max(0, balance / disposable * 100)) : 0;
  return { period, fixed, disposable, daily, saved, adjusted, spent, balance, days, baseDays, dday, hp, projected: balance - adjusted * period.remaining, baseProjected: balance - daily * period.remaining };
}
export function validateProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Profile;
  return Object.keys(defaults).every(k => typeof p[k as keyof Profile] === 'number' && Number.isFinite(p[k as keyof Profile]) && p[k as keyof Profile] >= 0 && p[k as keyof Profile] <= 10000000) && Number.isInteger(p.payday) && p.payday >= 1 && p.payday <= 31;
}
export function health(hp: number) {
  if (hp >= 75) return { text: 'Sultan awal bulan', color: '#c7f36b', label: 'SELAMAT' };
  if (hp >= 40) return { text: 'Masih boleh bernafas.', color: '#e7c46a', label: 'BERHATI-HATI' };
  if (hp >= 15) return { text: 'Zon catuan makanan.', color: '#f0a46b', label: 'BERJAGA-JAGA' };
  if (hp > 0) return { text: 'Mod Maggi aktif.', color: '#f48b85', label: 'KRITIKAL' };
  return { text: 'Tinggal doa & harapan.', color: '#f48b85', label: 'DUIT HABIS' };
}
