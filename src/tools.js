// Feature state is persisted with the existing profile in one atomic storage write.
let ledger = emptyLedger(), billDue = {}, editingExpense = null, pendingRestore = null, deferredInstall = null;
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function validateDue(value) { return value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([key, day]) => Object.hasOwn(billNames, key) && Number.isInteger(day) && day >= 1 && day <= 31); }
function switchTool(name, focus = false) {
  for (const tab of document.querySelectorAll('.tool-tabs [role="tab"]')) {
    const selected = tab.id === `tab-${name}`;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    if (selected && focus) tab.focus();
  }
}
function setupTools() {
  const today = dateKey(new Date());
  $('expense-category').innerHTML = Object.entries(categories).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
  $('expense-date').value = today; $('expense-date').max = today;
  $('emergency-date').value = today; $('recap-month').value = today.slice(0, 7);
  document.querySelectorAll('.tool-tabs [role="tab"]').forEach((tab, index, tabs) => {
    tab.addEventListener('click', () => switchTool(tab.id.slice(4)));
    tab.addEventListener('keydown', e => {
      let next;
      if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { e.preventDefault(); switchTool(tabs[next].id.slice(4), true); }
    });
  });
  for (const [button, input] of [['quick-expense', 'expense-amount'], ['quick-purchase', 'purchase-amount']]) $(button).addEventListener('click', () => { switchTool('spending'); $('money-tools').scrollIntoView(); $(input).focus({ preventScroll: true }); });
  $('expense-form').addEventListener('submit', saveExpense);
  $('expense-cancel').addEventListener('click', cancelExpense);
  $('expense-date').addEventListener('change', renderExpenses);
  $('zero-day').addEventListener('click', () => {
    const date = dateKey(new Date());
    if (ledger.expenses.some(e => e.date === date)) { toast('Hari ini sudah ada belanja. Edit rekod jika ada kesilapan.'); return; }
    ledger.days[date] ??= result.daily; $('expense-date').value = date; persist(); render(); toast('Hari ini direkod tanpa belanja.');
  });
  $('day-estimate').addEventListener('click', () => {
    const date = $('expense-date').value;
    if (ledger.expenses.some(e => e.date === date)) return;
    delete ledger.days[date]; persist(); render(); toast('Anggaran bajet digunakan semula untuk tarikh ini.');
  });
  $('expense-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-expense]'); if (!button) return;
    const entry = ledger.expenses.find(e => e.id === button.dataset.expense); if (!entry) return;
    if (button.dataset.action === 'edit') {
      editingExpense = entry.id;
      for (const key of ['amount', 'date', 'category', 'note']) $(`expense-${key}`).value = entry[key];
      $('expense-save').textContent = 'Simpan perubahan'; $('expense-cancel').hidden = false; $('expense-amount').focus();
    } else if (confirm(`Padam rekod ${rm(entry.amount)} pada ${entry.date}? Tarikh ini kekal direkod; gunakan anggaran semula jika perlu.`)) {
      ledger.expenses = ledger.expenses.filter(e => e.id !== entry.id); if (editingExpense === entry.id) cancelExpense(); persist(); render();
    }
  });
  for (const id of ['purchase-amount', 'emergency-amount', 'emergency-date']) $(id).addEventListener('input', renderScenarios);
  document.querySelectorAll('[data-price]').forEach(button => button.addEventListener('click', () => { $('purchase-amount').value = button.dataset.price; renderScenarios(); }));
  for (const [id, delta] of [['calendar-prev', -1], ['calendar-next', 1]]) $(id).addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1); renderCalendar(); });
  $('bills-open').addEventListener('click', () => {
    $('bill-fields').innerHTML = Object.entries(billNames).map(([key, label]) => `<label class="field">${label} (${rm(profile[key], 0)})<input name="${key}" type="number" min="1" max="31" step="1" required value="${billDue[key] || profile.payday}"></label>`).join('');
    $('bills-dialog').showModal();
  });
  $('bills-form').addEventListener('submit', e => {
    e.preventDefault(); const next = Object.fromEntries(Object.keys(billNames).map(key => [key, Number($('bills-form').elements.namedItem(key).value)]));
    if (!validateDue(next)) { $('bills-error').textContent = 'Masukkan tarikh antara 1 hingga 31.'; return; }
    billDue = next; persist(); renderCalendar(); $('bills-dialog').close(); toast('Jadual bil disimpan.');
  });
  $('recap-month').addEventListener('change', renderRecap);
  $('backup-export').addEventListener('click', exportBackup); $('restore-backup').addEventListener('click', exportBackup);
  $('backup-import').addEventListener('change', importBackup);
  $('restore-dialog').addEventListener('close', () => { pendingRestore = null; });
  $('restore-confirm').addEventListener('click', restoreBackup);
  $('install-app').addEventListener('click', async () => {
    if (deferredInstall) { const prompt = deferredInstall; deferredInstall = null; await prompt.prompt(); await prompt.userChoice; }
    else $('install-dialog').showModal();
  });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; $('install-app').textContent = 'Pasang app'; });
  window.addEventListener('appinstalled', () => { deferredInstall = null; $('install-status').textContent = 'App dah dipasang pada peranti ini.'; $('install-app').hidden = true; });
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) { $('install-status').textContent = 'Kau sedang guna app yang dipasang.'; $('install-app').hidden = true; }
  if (location.protocol === 'file:') { $('offline-status').textContent = 'Fail ini boleh digunakan offline. Untuk pemasangan app, buka versi yang dihos pada HTTPS atau localhost.'; }
  else if ('serviceWorker' in navigator && window.isSecureContext) {
    const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = './manifest.webmanifest'; document.head.append(manifest);
    navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => { $('offline-status').textContent = 'Salinan app offline sudah tersedia.'; }).catch(() => { $('offline-status').textContent = 'Salinan offline belum tersedia. Cuba buka semula dengan sambungan internet.'; });
  } else $('offline-status').textContent = 'Pemasangan dan cache offline memerlukan HTTPS atau localhost.';
}
function cancelExpense() { editingExpense = null; $('expense-amount').value = ''; $('expense-note').value = ''; $('expense-save').textContent = 'Simpan belanja'; $('expense-cancel').hidden = true; $('expense-error').textContent = ''; }
function saveExpense(event) {
  event.preventDefault();
  const amount = Number($('expense-amount').value), date = $('expense-date').value, category = $('expense-category').value, note = $('expense-note').value.trim();
  if (!validMoney(amount) || amount <= 0 || !validDay(date) || date > dateKey(new Date()) || !Object.hasOwn(categories, category)) { $('expense-error').textContent = 'Semak jumlah dan tarikh. Rekod tidak boleh bertarikh masa depan.'; return; }
  if (!custom) { $('expense-error').textContent = 'Simpan bajet sendiri melalui Edit bajet dahulu supaya rekod tidak bercampur dengan data contoh.'; return; }
  if (!editingExpense && ledger.expenses.length >= 10000) { $('expense-error').textContent = 'Had 10,000 rekod dicapai. Download backup dahulu.'; return; }
  ledger.days[date] ??= result.daily;
  const entry = { id: editingExpense || `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, date, amount, category, note };
  if (editingExpense) ledger.expenses = ledger.expenses.map(e => e.id === editingExpense ? entry : e); else ledger.expenses.push(entry);
  cancelExpense(); persist(); render(); toast(storageAvailable ? 'Belanja disimpan. Projection dah dikemas kini.' : 'Belanja disimpan untuk sesi ini sahaja.');
}
function renderExpenses() {
  const date = $('expense-date').value;
  const entries = ledger.expenses.filter(e => e.date === date).slice().reverse(), tracked = Object.hasOwn(ledger.days, date);
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  $('expense-count').textContent = `${ledger.expenses.length} REKOD`;
  $('day-total').textContent = `${rm(total)} direkod`;
  $('day-status').textContent = tracked ? `${date} · Jumlah sebenar` : `${date || 'Pilih tarikh'} · Masih guna anggaran`;
  $('expense-list').innerHTML = entries.length ? entries.map(e => `<div class="expense-row"><div><strong>${escapeHtml(e.note || categories[e.category])}</strong><small>${categories[e.category]}</small></div><span>${rm(e.amount)}</span><div class="row-actions"><button class="text-button" data-action="edit" data-expense="${e.id}" aria-label="Edit ${escapeHtml(e.note || categories[e.category])}">Edit</button><button class="text-button" data-action="delete" data-expense="${e.id}" aria-label="Padam ${escapeHtml(e.note || categories[e.category])}">Padam</button></div></div>`).join('') : `<p class="empty-copy">${tracked ? 'Hari ini direkod tanpa belanja.' : 'Belum ada rekod untuk tarikh ini.'}</p>`;
  $('day-estimate').hidden = !tracked || entries.length > 0;
  $('zero-day').disabled = !custom;
}
function renderScenarios() {
  for (const mode of ['purchase', 'emergency']) {
    const input = $(`${mode}-amount`), target = $(`${mode}-result`), amount = Number(input.value);
    const date = $('emergency-date').value;
    if (!input.value || amount === 0) { target.innerHTML = '<p>Isi jumlah untuk cuba senario.</p>'; target.removeAttribute('data-safe'); continue; }
    if (!input.validity.valid || !validMoney(amount)) { target.innerHTML = '<p>Masukkan jumlah antara RM0.01 hingga RM10,000,000 dengan maksimum 2 perpuluhan.</p>'; continue; }
    if (mode === 'emergency' && (!validDay(date) || date < dateKey(now) || date >= dateKey(result.period.end))) { target.innerHTML = '<p>Pilih tarikh dari hari ini hingga sehari sebelum payday.</p>'; continue; }
    const delay = mode === 'emergency' ? Math.max(0, (parseDay(date) - now) / DAY) : 0;
    const impact = purchaseImpact(result, amount, delay);
    target.dataset.safe = String(impact.safe);
    const lost = Number.isFinite(impact.lostDays) ? `${money(impact.lostDays, 1)} hari` : 'Baki terus habis';
    target.innerHTML = `<h4>${impact.safe ? 'Masih lepas sampai gaji.' : 'Bajet belum cukup ruang.'}</h4><dl><dt>${mode === 'emergency' ? 'Baki selepas kejadian' : 'Baki selepas beli'}</dt><dd>${rm(mode === 'emergency' ? impact.atEvent : impact.balance)}</dd><dt>Baki sebelum payday</dt><dd>${rm(impact.projected)}</dd><dt>Survival berkurang</dt><dd>${lost}</dd></dl><p>${impact.safe ? `Masih ada ruang ${rm(impact.projected)} sebelum gaji, berdasarkan bajet semasa.` : `Perlu tutup jurang ${rm(Math.max(0, -impact.projected, -impact.atEvent))}. Cuba kurangkan kos atau semak penjimatan.`}${result.adjusted === 0 ? ' Belanja harian RM0; impak utama ialah baki tunai.' : ''}</p>`;
  }
}
function renderCalendar() {
  const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth(), pay = paydayAt(y, m, profile.payday);
  const events = [...billEvents(profile, billDue, y, m), { key: 'salary', label: 'Gaji masuk', amount: profile.salary, date: pay }].sort((a, b) => a.date - b.date);
  $('calendar-month').textContent = calendarMonth.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
  const cells = ['Is', 'Se', 'Ra', 'Kh', 'Ju', 'Sa', 'Ah'].map(d => `<span class="calendar-weekday">${d}</span>`);
  const offset = (calendarMonth.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) cells.push('<span aria-hidden="true"></span>');
  for (let day = 1; day <= new Date(y, m + 1, 0).getDate(); day++) {
    const date = new Date(y, m, day), items = events.filter(e => e.date.getDate() === day), salary = items.some(e => e.key === 'salary');
    cells.push(`<div class="calendar-day ${items.length ? 'bill' : ''} ${salary ? 'payday' : ''} ${dateKey(date) === dateKey(now) ? 'today' : ''}" aria-label="${fullDate(date)}${items.length ? ': ' + items.map(e => e.label + ' ' + rm(e.amount)).join(', ') : ''}">${day}${items.length ? `<small>${salary ? 'GAJI' : 'BIL'}</small>` : ''}</div>`);
  }
  $('bill-calendar').innerHTML = cells.join('');
  $('bill-list').innerHTML = events.map(e => `<div class="bill-row"><time datetime="${dateKey(e.date)}">${shortDate(e.date)}</time><span>${e.label}</span><strong>${e.key === 'salary' ? '+' : '−'}${rm(e.amount, 0)}</strong></div>`).join('');
}
function renderRecap() {
  const month = $('recap-month').value;
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) { $('recap-content').textContent = 'Pilih bulan untuk lihat recap.'; return; }
  const recap = monthRecap(ledger, month);
  if (!recap.days) { $('recap-content').innerHTML = '<p class="empty-copy">Belum ada rekod bulan ini. Tambah belanja di tab Belanja harian untuk mula membina recap.</p>'; return; }
  const difference = recap.budget - recap.total;
  $('recap-content').innerHTML = `<div class="recap-stats"><div><span>JUMLAH DIREKOD</span><strong>${rm(recap.total)}</strong></div><div><span>HARI DIREKOD</span><strong>${recap.days} <small>hari</small></strong></div></div><p class="tool-help">${recap.count} transaksi · ${rm(Math.abs(difference))} ${difference >= 0 ? 'di bawah' : 'melebihi'} bajet ${rm(recap.budget)} untuk hari direkod.</p>${recap.breakdown.filter(c => c.total > 0).map(c => `<div class="recap-category"><span>${c.label}</span><span>${rm(c.total)} · ${money(c.total / recap.total * 100, 0)}%</span></div>`).join('')}<p class="tool-help">${recap.total > 0 ? `Paling banyak: ${recap.breakdown[0].label}.` : 'Tiada belanja direkod.'} ${month === dateKey(now).slice(0, 7) ? `Unjuran baki sebelum payday semasa: ${rm(result.projected)} (anggaran).` : 'Baki sebelum payday bulan lepas tidak tersedia; tiada snapshot baki diambil ketika itu.'}</p>`;
}
function renderTools() {
  $('expense-date').max = dateKey(now); $('emergency-date').min = dateKey(now);
  $('emergency-date').max = dateKey(new Date(result.period.end.getFullYear(), result.period.end.getMonth(), result.period.end.getDate() - 1));
  renderExpenses(); renderScenarios(); renderCalendar(); renderRecap();
}
function backupPayload() { return { app: 'gaji-survival', version: 2, exportedAt: new Date().toISOString(), profile, cuts, custom, ledger, billDue, theme: document.documentElement.dataset.theme }; }
function exportBackup() {
  const blob = new Blob([JSON.stringify(backupPayload(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `gaji-survival-backup-${dateKey(new Date())}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importBackup(event) {
  $('backup-error').textContent = ''; pendingRestore = null;
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 5000000) throw new Error('Fail terlalu besar. Had 5MB.');
    const value = JSON.parse(await file.text());
    if (!validateBackup(value)) throw new Error('Format backup tidak sah atau versi tidak disokong. Data semasa belum diubah.');
    pendingRestore = value;
    $('restore-summary').textContent = `${value.ledger.expenses.length} transaksi, ${Object.keys(value.ledger.days).length} hari direkod dan gaji bersih ${rm(value.profile.salary)}. Tema: ${value.theme === 'light' ? 'cerah' : 'gelap'}.`;
    $('restore-dialog').showModal();
  } catch (error) { $('backup-error').textContent = error instanceof SyntaxError ? 'Fail ini bukan JSON yang sah. Data semasa belum diubah.' : error.message; }
}
function validateBackup(value) {
  return value && value.app === 'gaji-survival' && value.version === 2 && validateProfile(value.profile) && validateLedger(value.ledger) && validateDue(value.billDue) && typeof value.custom === 'boolean' && value.cuts && Object.keys(noCuts).every(k => typeof value.cuts[k] === 'boolean') && ['dark', 'light'].includes(value.theme) && Object.keys(value.ledger.days).every(d => d <= dateKey(new Date()));
}
function restoreBackup() {
  if (!pendingRestore) return;
  const saved = pendingRestore;
  profile = Object.fromEntries(Object.keys(defaults).map(k => [k, saved.profile[k]]));
  cuts = Object.fromEntries(Object.keys(noCuts).map(k => [k, saved.cuts[k]])); custom = saved.custom;
  ledger = saved.ledger; billDue = saved.billDue; document.documentElement.dataset.theme = saved.theme;
  try { localStorage.setItem(THEME_STORE, saved.theme); } catch { /* The main save reports unavailable storage. */ }
  cancelExpense(); syncThemeControl(); persist(); render(); $('restore-dialog').close(); toast(storageAvailable ? 'Backup berjaya dipulihkan.' : 'Backup dipulihkan untuk sesi ini sahaja.');
}
