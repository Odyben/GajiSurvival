export type Profile = { salary: number; payday: number; rent: number; vehicle: number; utilities: number; debt: number; meals: number; coffee: number; leisure: number; misc: number };
export type Cuts = { coffee: boolean; meals: boolean; leisure: boolean };
export const defaults: Profile = { salary: 4200, payday: 25, rent: 800, vehicle: 450, utilities: 150, debt: 200, meals: 30, coffee: 15, leisure: 10, misc: 10 };
export const noCuts: Cuts = { coffee: false, meals: false, leisure: false };
export const DAY = 86400000;
function finiteDate(timestamp: number) { return Number.isFinite(timestamp) && Math.abs(timestamp) <= 8640000000000000 ? new Date(timestamp) : null; }
export function paydayAt(year: number, month: number, day: number) { return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate())); }
export function cycle(now: Date, day: number) {
  const thisPay = paydayAt(now.getFullYear(), now.getMonth(), day);
  const start = now >= thisPay ? thisPay : paydayAt(now.getFullYear(), now.getMonth() - 1, day);
  const end = paydayAt(start.getFullYear(), start.getMonth() + 1, day);
  return { start, end, elapsed: (now.getTime() - start.getTime()) / DAY, remaining: (end.getTime() - now.getTime()) / DAY, length: (end.getTime() - start.getTime()) / DAY };
}
export function calculate(p: Profile, cuts: Cuts, now: Date) {
  const period = cycle(now, p.payday);
  const fixed = p.rent + p.vehicle + p.utilities + p.debt;
  const disposable = p.salary - fixed;
  const daily = p.meals + p.coffee + p.leisure + p.misc;
  const saved = (cuts.coffee ? p.coffee : 0) + (cuts.meals ? p.meals * 0.5 : 0) + (cuts.leisure ? p.leisure : 0);
  const adjusted = Math.max(0, daily - saved);
  const balance = disposable - daily * period.elapsed;
  const days = balance <= 0 ? 0 : adjusted === 0 ? Infinity : balance / adjusted;
  const baseDays = balance <= 0 ? 0 : daily === 0 ? Infinity : balance / daily;
  const depleted = disposable <= 0 ? period.start : daily > 0 ? finiteDate(period.start.getTime() + disposable / daily * DAY) : null;
  const dday = balance <= 0 ? depleted : Number.isFinite(days) ? finiteDate(now.getTime() + days * DAY) : null;
  const hp = disposable > 0 ? Math.min(100, Math.max(0, balance / disposable * 100)) : 0;
  return { period, fixed, disposable, daily, saved, adjusted, balance, days, baseDays, dday, hp, projected: balance - adjusted * period.remaining, baseProjected: balance - daily * period.remaining };
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
