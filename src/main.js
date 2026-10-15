const $ = id => document.getElementById(id);
const money = (n, digits = 2) => new Intl.NumberFormat('en-MY', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const rm = (n, digits = 2) => `RM${money(n, digits)}`;
const shortDate = d => d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });
const fullDate = d => d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
const clockTime = d => d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
const STORE = 'gaji-survival-v1';
const THEME_STORE = 'gaji-survival-theme';
const themeToggle = document.createElement('button');
themeToggle.id = 'theme-toggle';
themeToggle.type = 'button';
themeToggle.className = 'button theme-toggle';
themeToggle.innerHTML = '<span class="theme-glyph" aria-hidden="true"></span><span class="theme-label"></span>';
themeToggle.setAttribute('aria-label', 'Tema cerah');
$('guide-open').before(themeToggle);
function syncThemeControl() {
  const light = document.documentElement.dataset.theme === 'light';
  themeToggle.setAttribute('aria-pressed', String(light));
  themeToggle.title = light ? 'Tukar ke dark mode' : 'Tukar ke light mode';
  themeToggle.querySelector('.theme-label').textContent = light ? 'Light' : 'Dark';
  document.querySelector('meta[name="theme-color"]').content = light ? '#f6f3ec' : '#121412';
}
syncThemeControl();
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_STORE, theme); }
  catch { toast('Tema ditukar untuk sesi ini. Browser tidak benarkan simpanan.'); }
  syncThemeControl();
  render();
});
let profile = { ...defaults }, cuts = { ...noCuts }, custom = false, storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && validateProfile(saved.profile)) {
    profile = saved.profile; custom = saved.custom === true;
    for (const key of Object.keys(noCuts)) cuts[key] = saved.cuts?.[key] === true;
  }
} catch { storageAvailable = false; }
let now = new Date(), result = calculate(profile, cuts, now), lastTick = Date.now(), sessionBurn = 0, toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify({ profile, cuts, custom })); storageAvailable = true; }
  catch { storageAvailable = false; toast('Browser tidak benarkan simpanan. Bajet kekal untuk sesi ini sahaja.'); }
  updateStorageLabel();
}
function updateStorageLabel() { document.querySelector('.local-label').innerHTML = `<span class="status-dot"></span>${storageAvailable ? 'Disimpan di peranti ini' : 'Sesi ini sahaja'}`; }
function render() {
  const tick = Date.now(); sessionBurn += result.adjusted / DAY * (tick - lastTick); lastTick = tick;
  now = new Date(); result = calculate(profile, cuts, now);
  const r = result, state = health(r.hp), active = Object.values(cuts).some(Boolean);
  document.body.classList.toggle('saving-active', active);
  const healthColor = document.documentElement.dataset.theme === 'light'
    ? (r.hp >= 75 ? '#536b39' : r.hp >= 40 ? '#896019' : r.hp >= 15 ? '#a14d22' : '#b34438')
    : state.color;
  document.documentElement.style.setProperty('--health-color', healthColor);
  $('demo-label').hidden = custom;
  $('cycle-label').textContent = `Kitaran ${shortDate(r.period.start)} — ${shortDate(r.period.end)} ${r.period.end.getFullYear()}`;
  $('today-label').textContent = `Hari ini, ${shortDate(now)}`;
  $('health-tag').textContent = state.label; $('health-tag').style.color = healthColor;
  const parts = money(Math.max(0, r.balance)).split('.');
  $('balance').textContent = parts[0]; $('balance-cents').textContent = `.${parts[1]}`;
  $('health-title').textContent = state.text;
  $('hp-value').textContent = `${Math.floor(r.hp)}%`;
  $('hp-fill').style.width = `${r.hp}%`;
  $('hp-bar').setAttribute('aria-valuenow', r.hp.toFixed(1));
  $('initial-balance').textContent = `${rm(Math.max(0, r.disposable), 0)} · BAKI AWAL`;
  $('health-note').textContent = r.balance < 0 ? `Anggaran defisit terkumpul: ${rm(-r.balance)}.` : `Selepas komitmen ${rm(r.fixed, 0)} dan belanja sejak hari gaji.`;
  $('daily-rate').innerHTML = `${rm(r.adjusted, Number.isInteger(r.adjusted) ? 0 : 2)} <small>/ hari</small>`;
  $('hourly-rate').textContent = rm(r.adjusted / 24);
  if ($('minute-rate')) $('minute-rate').textContent = `${rm(r.adjusted / 1440, 3)} / minit`;
  $('survival-days').innerHTML = `${Number.isFinite(r.days) ? money(r.days, 1) : '∞'} <small>hari</small>`;
  $('survival-note').textContent = r.adjusted === 0 && r.balance > 0 ? 'Tiada belanja harian' : 'Pada kadar belanja ini';
  $('payday-count').innerHTML = `${Math.ceil(r.period.remaining)} <small>hari lagi</small>`;
  $('next-payday').textContent = fullDate(r.period.end);
  $('chart-period').textContent = `${Math.round(r.period.length)} hari / kitaran`;
  const safe = r.projected >= 0;
  document.querySelector('.deadline-panel').classList.toggle('safe', safe);
  $('dday').textContent = r.dday ? shortDate(r.dday) : r.adjusted === 0 ? 'Tak habis.' : 'Jauh lagi.';
  $('dday-time').textContent = r.dday ? `${r.dday.getFullYear()} · ${clockTime(r.dday)} · anggaran waktu peranti` : r.adjusted === 0 ? 'Dengan belanja harian RM0' : 'Melebihi julat tarikh yang boleh dipaparkan';
  if (r.balance <= 0) $('deadline-message').innerHTML = `Baki dah habis. Anggaran defisit sekarang <strong>${rm(Math.max(0, -r.balance))}</strong>. Semak komitmen atau tambah pendapatan.`;
  else if (safe) $('deadline-message').innerHTML = `Lepas sampai hari gaji. Anggaran baki <strong>${rm(r.projected)}</strong> sebelum gaji masuk.`;
  else $('deadline-message').innerHTML = `Ada jurang <strong>${money(Math.max(0, r.period.remaining - r.days), 1)} hari</strong> sebelum gaji masuk. Masa untuk ubah strategi.`;
  $('coffee-saving').textContent = `Jimat ${rm(profile.coffee, 0)} / hari`;
  $('meals-saving').textContent = `Jimat ${rm(profile.meals * .5, 0)} / hari · 50%`;
  $('leisure-saving').textContent = `Jimat ${rm(profile.leisure, 0)} / hari`;
  document.querySelectorAll('[data-cut]').forEach(input => { input.checked = cuts[input.dataset.cut]; });
  const extra = r.days === Infinity && r.baseDays === Infinity ? 0 : r.days - r.baseDays;
  $('extra-days').innerHTML = `${Number.isFinite(extra) ? `+${money(extra, 1)}` : '∞'} <small>hari</small>`;
  $('saving-result-note').textContent = r.balance <= 0 ? `Potongan jimat ${rm(r.saved)} sehari, tetapi tidak memulihkan defisit lepas.` : r.saved > 0 ? `Kurang ${rm(r.saved)} sehari. Jimat ${rm(r.saved * r.period.remaining)} hingga gaji seterusnya.` : 'Aktifkan pilihan di atas untuk tengok bezanya.';
  $('chart-summary').innerHTML = safe ? `↗ Sampai hari gaji dengan baki <strong>${rm(r.projected)}</strong>${active ? ` · ${rm(r.saved * r.period.remaining)} lebih baik daripada sekarang.` : '. Cuba simulasi untuk tambah ruang bernafas.'}` : `↘ Unjuran defisit <strong>${rm(-r.projected)}</strong> sebelum gaji. ${active ? 'Penjimatan ini masih belum cukup untuk tutup jurang.' : 'Cuba potong belanja di panel penjimatan.'}`;
  const variable = r.daily * r.period.elapsed + r.adjusted * r.period.remaining;
  const total = Math.max(profile.salary, r.fixed + variable, 1);
  $('fixed-segment').style.width = `${r.fixed / total * 100}%`;
  $('variable-segment').style.width = `${variable / total * 100}%`;
  $('left-segment').style.width = `${Math.max(0, r.projected) / total * 100}%`;
  $('fixed-total').textContent = rm(r.fixed, 0); $('variable-total').textContent = rm(variable, 0); $('left-total').textContent = rm(r.projected, 0);
  $('burn-chart').setAttribute('aria-label', `Unjuran ${Math.round(r.period.length)} hari. Baki awal ${rm(r.disposable)}. Baki pada hari gaji ${rm(r.projected)}. Belanja sekarang ${rm(r.baseProjected)}.`);
  drawChart(); updateStorageLabel();
}
const fields = [
  ['PENDAPATAN', [['salary', 'Gaji bersih bulanan'], ['payday', 'Tarikh gaji (1–31)']]],
  ['KOMITMEN TETAP / BULAN', [['rent', 'Sewa / ansuran rumah'], ['vehicle', 'Kereta / motor'], ['utilities', 'Utiliti & Wi-Fi'], ['debt', 'Hutang / komitmen lain']]],
  ['BELANJA HARIAN', [['meals', 'Makan'], ['coffee', 'Kopi / minuman mahal'], ['leisure', 'Rokok / vape / hiburan'], ['misc', 'Runcit / lain-lain']]]
];
$('form-fields').innerHTML = fields.map(([title, rows]) => `<fieldset class="form-group"><legend>${title}</legend><div class="field-grid">${rows.map(([key, label]) => `<label class="field">${label}<span class="field-control">${key === 'payday' ? '' : '<span>RM</span>'}<input name="${key}" type="number" inputmode="${key === 'payday' ? 'numeric' : 'decimal'}" min="${key === 'payday' ? 1 : 0}" max="${key === 'payday' ? 31 : 10000000}" step="${key === 'payday' ? 1 : .01}" required></span></label>`).join('')}</div></fieldset>`).join('');
let draftOriginal;
function discardDraft() { if (draftOriginal) { profile = draftOriginal; draftOriginal = null; render(); } }
function openProfile() {
  draftOriginal = { ...profile };
  for (const key of Object.keys(defaults)) $('profile-form').elements.namedItem(key).value = profile[key];
  $('form-error').textContent = ''; $('profile-dialog').showModal();
}
function formProfile() { return Object.fromEntries(Object.keys(defaults).map(key => [key, Number($('profile-form').elements.namedItem(key).value)])); }
$('profile-form').addEventListener('input', () => {
  const candidate = formProfile();
  if ($('profile-form').checkValidity() && validateProfile(candidate)) { profile = candidate; render(); }
});
$('profile-form').addEventListener('submit', event => {
  event.preventDefault(); const candidate = formProfile();
  if (!validateProfile(candidate)) { $('form-error').textContent = 'Semak input. Nilai mesti positif dan hari gaji antara 1 hingga 31.'; return; }
  profile = candidate; custom = true; draftOriginal = null; persist(); render(); $('profile-dialog').close(); toast(storageAvailable ? 'Bajet disimpan. Survival kau dah dikira semula.' : 'Bajet dikemas kini untuk sesi ini.');
});
$('profile-dialog').addEventListener('close', discardDraft);
$('profile-dialog').addEventListener('cancel', discardDraft);
$('profile-open').addEventListener('click', openProfile);
for (const id of ['guide-open', 'method-open']) $(id).addEventListener('click', () => $('guide-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { if (button.closest('dialog').id === 'profile-dialog') discardDraft(); button.closest('dialog').close(); }));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => { if (e.target === dialog) { const box = dialog.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close(); } }));
document.querySelectorAll('[data-cut]').forEach(input => input.addEventListener('change', () => { cuts[input.dataset.cut] = input.checked; persist(); render(); }));
$('cuts-reset').addEventListener('click', () => { cuts = { ...noCuts }; persist(); render(); toast('Simulasi direset. Bajet asal dikekalkan.'); });
let chartGeometry;
function drawChart() {
  const light = document.documentElement.dataset.theme === 'light';
  const canvas = $('burn-chart'), ctx = canvas.getContext('2d'), box = canvas.getBoundingClientRect();
  if (!ctx || !box.width) return;
  const dpr = window.devicePixelRatio || 1, w = box.width, h = box.height;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.scale(dpr, dpr);
  const r = result, pad = { l: w < 400 ? 43 : 49, r: 12, t: 30, b: 32 }, pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const max = Math.max(r.disposable, 0, 100) * 1.08, min = Math.min(r.baseProjected, r.projected, r.disposable, 0) - Math.max(Math.abs(r.baseProjected), max) * .07;
  const x = d => pad.l + d / r.period.length * pw, y = n => pad.t + (max - n) / (max - min) * ph;
  chartGeometry = { x, y, pad, pw, w, h };
  ctx.font = '9px Consolas, monospace'; ctx.lineWidth = 1;
  const compact = n => Math.abs(n) >= 10000 ? `${(n / 1000).toFixed(0)}k` : money(n, 0);
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4, yy = y(v);
    ctx.strokeStyle = (light ? '#dfd6c8' : '#30352c'); ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    ctx.fillStyle = (light ? '#786a57' : '#939d89'); ctx.textAlign = 'right'; ctx.fillText(compact(v), pad.l - 9, yy + 3);
  }
  ctx.setLineDash([4, 4]); ctx.strokeStyle = (light ? '#b36655' : '#ad6e64'); ctx.beginPath(); ctx.moveTo(pad.l, y(0)); ctx.lineTo(w - pad.r, y(0)); ctx.stroke();
  ctx.fillStyle = (light ? '#a44835' : '#dc9589'); ctx.textAlign = 'left'; ctx.fillText('RM0', pad.l + 5, y(0) - 6);
  ctx.strokeStyle = (light ? '#8e8a64' : '#60734a'); ctx.beginPath(); ctx.moveTo(x(r.period.length), pad.t); ctx.lineTo(x(r.period.length), h - pad.b); ctx.stroke();
  ctx.fillStyle = (light ? '#686442' : '#bdcfaa'); ctx.textAlign = 'right'; ctx.fillText('GAJI MASUK', w - pad.r, 13);
  const points = [0, r.period.elapsed, r.period.length];
  const baseline = d => r.disposable - r.daily * d;
  const planned = d => d <= r.period.elapsed ? baseline(d) : r.balance - r.adjusted * (d - r.period.elapsed);
  ctx.setLineDash([]); ctx.beginPath(); points.forEach((d, i) => i === 0 ? ctx.moveTo(x(d), y(baseline(d))) : ctx.lineTo(x(d), y(baseline(d))));
  ctx.lineTo(x(r.period.length), y(0)); ctx.lineTo(x(0), y(0)); ctx.closePath();
  const gradient = ctx.createLinearGradient(0, pad.t, 0, h - pad.b); gradient.addColorStop(0, (light ? '#b77a2526' : '#f0a46b1f')); gradient.addColorStop(1, (light ? '#b77a2500' : '#f0a46b00')); ctx.fillStyle = gradient; ctx.fill();
  function line(fn, color, dashed) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dashed ? [5, 5] : []); ctx.beginPath(); points.forEach((d, i) => i === 0 ? ctx.moveTo(x(d), y(fn(d))) : ctx.lineTo(x(d), y(fn(d)))); ctx.stroke(); }
  line(baseline, (light ? '#a76824' : '#f0a46b'), false);
  if (r.saved > 0) line(planned, (light ? '#98512f' : '#c7f36b'), true);
  const todayX = x(r.period.elapsed);
  ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.strokeStyle = (light ? '#9b8e78' : '#879477'); ctx.beginPath(); ctx.moveTo(todayX, pad.t); ctx.lineTo(todayX, h - pad.b); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = (light ? '#98512f' : '#cfdaa1'); ctx.beginPath(); ctx.arc(todayX, y(r.balance), 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = (light ? '#fffcf6' : '#182012'); ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = (light ? '#73634e' : '#c4cdb8'); ctx.textAlign = r.period.elapsed > r.period.length * .8 ? 'right' : 'center'; ctx.fillText('HARI INI', todayX, pad.t - 6);
  const zeroDay = r.disposable > 0 && r.daily > 0 ? r.disposable / r.daily : 0;
  if (zeroDay <= r.period.length) { ctx.fillStyle = (light ? '#b34438' : '#f48b85'); ctx.beginPath(); ctx.arc(x(zeroDay), y(0), 3, 0, Math.PI * 2); ctx.fill(); }
  const ticks = w < 400 ? 4 : 5;
  for (let i = 0; i <= ticks; i++) { const d = r.period.length * i / ticks; ctx.textAlign = i === 0 ? 'left' : i === ticks ? 'right' : 'center'; ctx.fillStyle = (light ? '#786a57' : '#939d89'); ctx.fillText(shortDate(new Date(r.period.start.getTime() + d * DAY)), x(d), h - 8); }
}
$('burn-chart').addEventListener('pointermove', e => {
  if (!chartGeometry) return;
  const box = e.currentTarget.getBoundingClientRect(), g = chartGeometry, local = Math.max(g.pad.l, Math.min(g.w - g.pad.r, e.clientX - box.left));
  const day = (local - g.pad.l) / g.pw * result.period.length;
  const base = result.disposable - result.daily * day;
  const planned = day <= result.period.elapsed ? base : result.balance - result.adjusted * (day - result.period.elapsed);
  const tip = $('chart-tooltip'); tip.textContent = `${shortDate(new Date(result.period.start.getTime() + day * DAY))}\nSekarang: ${rm(base)}\nSimulasi: ${rm(planned)}`;
  tip.hidden = false; tip.style.left = `${Math.max(0, Math.min(local + 8, g.w - 195))}px`; tip.style.top = '30px';
});
$('burn-chart').addEventListener('pointerleave', () => $('chart-tooltip').hidden = true);
new ResizeObserver(drawChart).observe($('burn-chart').parentElement);
function drawReceipt() {
  const c = $('receipt-canvas'), ctx = c.getContext('2d'), r = result;
  ctx.fillStyle = '#ecefdf'; ctx.fillRect(0, 0, 720, 1000); ctx.fillStyle = '#202619';
  ctx.textAlign = 'center'; ctx.font = 'bold 45px Consolas, monospace'; ctx.fillText('GAJI SURVIVAL', 360, 93);
  ctx.font = '17px Consolas, monospace'; ctx.fillText('RESIT REALITI KEWANGAN', 360, 132);
  const rule = yy => { ctx.strokeStyle = '#67715c'; ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(55, yy); ctx.lineTo(665, yy); ctx.stroke(); };
  rule(173); ctx.font = '17px Consolas, monospace'; ctx.fillText(`SNAPSHOT ${shortDate(now).toUpperCase()} ${now.getFullYear()} · ${clockTime(now)}`, 360, 212);
  ctx.font = '19px Consolas, monospace'; ctx.fillText('BAKI BOLEH BELANJA', 360, 282);
  const amount = rm(Math.max(0, r.balance)); ctx.font = `bold ${amount.length > 13 ? 39 : 58}px Consolas, monospace`; ctx.fillText(amount, 360, 351, 610);
  ctx.font = '20px Consolas, monospace'; ctx.fillText(health(r.hp).text.toUpperCase(), 360, 397, 610);
  rule(440);
  const row = (label, value, yy) => { ctx.font = '20px Consolas, monospace'; ctx.textAlign = 'left'; ctx.fillText(label, 60, yy); ctx.textAlign = 'right'; ctx.fillText(value, 660, yy, 340); };
  row('Burn / hari', rm(r.adjusted), 490); row('Duit tahan', Number.isFinite(r.days) ? `${money(r.days, 1)} hari` : 'Tiada had', 539); row('Duit habis', r.dday ? `${shortDate(r.dday)} ${r.dday.getFullYear()}` : r.adjusted === 0 ? 'Belanja harian RM0' : 'Di luar julat tarikh', 588); row('Gaji masuk', `${shortDate(r.period.end)} ${r.period.end.getFullYear()}`, 637); row('Baki / defisit nanti', rm(r.projected), 686);
  rule(727); ctx.textAlign = 'center'; ctx.font = '17px Consolas, monospace'; ctx.fillText(`WHAT-IF: ${r.saved > 0 ? `JIMAT ${rm(r.saved)} / HARI` : 'BELUM DIAKTIFKAN'}`, 360, 770, 610);
  ctx.font = '15px Consolas, monospace'; ctx.fillText('Anggaran bajet. Bukan baki bank sebenar.', 360, 817); ctx.fillText('Tiada pendapatan tambahan dalam unjuran.', 360, 845);
  ctx.fillStyle = '#252d1c'; for (let i = 0; i < 78; i++) if ((i * 7 + 3) % 5 !== 0) ctx.fillRect(135 + i * 6, 882, i % 3 === 0 ? 4 : 2, 40);
  ctx.font = '14px Consolas, monospace'; ctx.fillText('DUIT KAU. CERITA KAU.', 360, 959);
}
$('receipt-open').addEventListener('click', () => { render(); drawReceipt(); $('receipt-dialog').showModal(); });
$('receipt-download').addEventListener('click', () => {
  $('receipt-canvas').toBlob(blob => { if (!blob) { toast('Tak berjaya hasilkan resit. Cuba sekali lagi.'); return; } const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `gaji-survival-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Resit PNG dah siap untuk disimpan.'); }, 'image/png');
});
render();
const minute = document.createElement('span'); minute.id = 'minute-rate'; minute.className = 'metric-detail'; minute.textContent = `${rm(result.adjusted / 1440, 3)} / minit`; $('daily-rate').parentElement.append(minute);
// The ticker is simulated spending elapsed in this session, not a bank transaction feed.
const live = document.createElement('span'); live.className = 'metric-detail'; live.innerHTML = 'Live <span class="live-value" id="live-burn">RM0.00 / sesi</span>'; $('daily-rate').parentElement.append(live);
setInterval(() => {
  const tick = Date.now(); sessionBurn += result.adjusted / DAY * (tick - lastTick); lastTick = tick;
  $('live-burn').textContent = `${rm(sessionBurn)} / sesi`;
}, 1000);
setInterval(() => { if (!$('profile-dialog').open && !$('receipt-dialog').open) render(); }, 60000);
