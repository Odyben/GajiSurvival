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
    if (ledger.expenses.some(e => e.date === date)) { toast('Hari ini dah ada belanja. Edit entry kalau tersalah.'); return; }
    ledger.days[date] ??= result.daily; $('expense-date').value = date; persist(); render(); toast('Tarikh ini direkod tanpa belanja.');
  });
  $('day-estimate').addEventListener('click', () => {
    const date = $('expense-date').value;
    if (ledger.expenses.some(e => e.date === date)) return;
    delete ledger.days[date]; persist(); render(); toast('This date now uses your budget estimate again.');
  });
  $('expense-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-expense]'); if (!button) return;
    const entry = ledger.expenses.find(e => e.id === button.dataset.expense); if (!entry) return;
    if (button.dataset.action === 'edit') {
      editingExpense = entry.id;
      for (const key of ['amount', 'date', 'category', 'note']) $(`expense-${key}`).value = entry[key];
      $('expense-save').textContent = 'Save changes'; $('expense-cancel').hidden = false; $('expense-amount').focus();
    } else if (confirm(`Delete the entry for ${rm(entry.amount)} on ${entry.date}? This date stays logged. You can switch back to an estimate if needed.`)) {
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
    if (!validateDue(next)) { $('bills-error').textContent = 'Enter a day from 1 to 31.'; return; }
    billDue = next; persist(); renderCalendar(); $('bills-dialog').close(); toast('Bill dates saved.');
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
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; $('install-app').textContent = 'Install app'; });
  window.addEventListener('appinstalled', () => { deferredInstall = null; $('install-status').textContent = 'The app is installed on this device.'; $('install-app').hidden = true; });
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) { $('install-status').textContent = 'You are using the installed app.'; $('install-app').hidden = true; }
  if (location.protocol === 'file:') { $('offline-status').textContent = 'This file works offline. To install the app, open a version served over HTTPS or localhost.'; }
  else if ('serviceWorker' in navigator && window.isSecureContext) {
    const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = './manifest.webmanifest'; document.head.append(manifest);
    navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => { $('offline-status').textContent = 'Your offline copy is ready.'; }).catch(() => { $('offline-status').textContent = 'Your offline copy is not ready. Try opening the app again with an internet connection.'; });
  } else $('offline-status').textContent = 'Installation and offline caching need HTTPS or localhost.';
}
function cancelExpense() { editingExpense = null; $('expense-amount').value = ''; $('expense-note').value = ''; $('expense-save').textContent = 'Save expense'; $('expense-cancel').hidden = true; $('expense-error').textContent = ''; }
function saveExpense(event) {
  event.preventDefault();
  const amount = Number($('expense-amount').value), date = $('expense-date').value, category = $('expense-category').value, note = $('expense-note').value.trim();
  if (!validMoney(amount) || amount <= 0 || !validDay(date) || date > dateKey(new Date()) || !Object.hasOwn(categories, category)) { $('expense-error').textContent = 'Check the amount and date. Expenses cannot have a future date.'; return; }
  if (!custom) { $('expense-error').textContent = 'Save your own budget using Edit budget before adding expenses to the sample data.'; return; }
  if (!editingExpense && ledger.expenses.length >= 10000) { $('expense-error').textContent = 'The limit of 10,000 entries has been reached. Download a backup first.'; return; }
  ledger.days[date] ??= result.daily;
  const entry = { id: editingExpense || `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, date, amount, category, note };
  if (editingExpense) ledger.expenses = ledger.expenses.map(e => e.id === editingExpense ? entry : e); else ledger.expenses.push(entry);
  cancelExpense(); persist(); render(); toast(storageAvailable ? 'Belanja saved. Sekarang nampak duit pergi mana.' : 'Expense saved for this session only.');
}
function renderExpenses() {
  const date = $('expense-date').value;
  const entries = ledger.expenses.filter(e => e.date === date).slice().reverse(), tracked = Object.hasOwn(ledger.days, date);
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  $('expense-count').textContent = `${ledger.expenses.length} ${ledger.expenses.length === 1 ? 'ENTRY' : 'ENTRIES'}`;
  $('day-total').textContent = `${rm(total)} logged`;
  $('day-status').textContent = tracked ? `${date} · Actual total` : `${date || 'Choose a date'} · Using an estimate`;
  $('expense-list').innerHTML = entries.length ? entries.map(e => `<div class="expense-row"><div><strong>${escapeHtml(e.note || categories[e.category])}</strong><small>${categories[e.category]}</small></div><span>${rm(e.amount)}</span><div class="row-actions"><button class="text-button" data-action="edit" data-expense="${e.id}" aria-label="Edit ${escapeHtml(e.note || categories[e.category])}">Edit</button><button class="text-button" data-action="delete" data-expense="${e.id}" aria-label="Delete ${escapeHtml(e.note || categories[e.category])}">Delete</button></div></div>`).join('') : `<p class="empty-copy">${tracked ? 'Tarikh ini direkod tanpa belanja.' : 'Belum ada rekod tarikh ini. Kalau dah spend, log dulu.'}</p>`;
  $('day-estimate').hidden = !tracked || entries.length > 0;
  $('zero-day').disabled = !custom;
}
function renderScenarios() {
  for (const mode of ['purchase', 'emergency']) {
    const input = $(`${mode}-amount`), target = $(`${mode}-result`), amount = Number(input.value);
    const date = $('emergency-date').value;
    if (!input.value || amount === 0) { target.innerHTML = '<p>Isi amount dulu, kita kira kesannya.</p>'; target.removeAttribute('data-safe'); continue; }
    if (!input.validity.valid || !validMoney(amount)) { target.innerHTML = '<p>Enter an amount from RM0.01 to RM10,000,000, with up to 2 decimal places.</p>'; continue; }
    if (mode === 'emergency' && (!validDay(date) || date < dateKey(now) || date >= dateKey(result.period.end))) { target.innerHTML = '<p>Choose a date from today to the day before payday.</p>'; continue; }
    const delay = mode === 'emergency' ? Math.max(0, (parseDay(date) - now) / DAY) : 0;
    const impact = purchaseImpact(result, amount, delay);
    target.dataset.safe = String(impact.safe);
    const lost = Number.isFinite(impact.lostDays) ? `${money(impact.lostDays, 1)} days` : 'Balance runs out';
    target.innerHTML = `<h4>${impact.safe ? 'Lepas sampai payday. Masih boleh bernafas.' : 'Bajet ketat. Kena adjust sikit.'}</h4><dl><dt>${mode === 'emergency' ? 'Balance after the event' : 'Balance after buying'}</dt><dd>${rm(mode === 'emergency' ? impact.atEvent : impact.balance)}</dd><dt>Balance before payday</dt><dd>${rm(impact.projected)}</dd><dt>Days of spending lost</dt><dd>${lost}</dd></dl><p>${impact.safe ? `Masih ada baki ${rm(impact.projected)} sebelum payday, ikut bajet semasa.` : `Perlu cover jurang ${rm(Math.max(0, -impact.projected, -impact.atEvent))}. Cuba kos lebih rendah atau adjust savings.`}${result.adjusted === 0 ? ' Daily spending is RM0, so the main change is your cash balance.' : ''}</p>`;
  }
}
function renderCalendar() {
  const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth(), pay = paydayAt(y, m, profile.payday);
  const events = [...billEvents(profile, billDue, y, m), { key: 'salary', label: 'Payday', amount: profile.salary, date: pay }].sort((a, b) => a.date - b.date);
  $('calendar-month').textContent = calendarMonth.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
  const cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="calendar-weekday">${d}</span>`);
  const offset = (calendarMonth.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) cells.push('<span aria-hidden="true"></span>');
  for (let day = 1; day <= new Date(y, m + 1, 0).getDate(); day++) {
    const date = new Date(y, m, day), items = events.filter(e => e.date.getDate() === day), salary = items.some(e => e.key === 'salary');
    cells.push(`<div class="calendar-day ${items.length ? 'bill' : ''} ${salary ? 'payday' : ''} ${dateKey(date) === dateKey(now) ? 'today' : ''}" aria-label="${fullDate(date)}${items.length ? ': ' + items.map(e => e.label + ' ' + rm(e.amount)).join(', ') : ''}">${day}${items.length ? `<small>${salary ? 'PAY' : 'BILL'}</small>` : ''}</div>`);
  }
  $('bill-calendar').innerHTML = cells.join('');
  $('bill-list').innerHTML = events.map(e => `<div class="bill-row"><time datetime="${dateKey(e.date)}">${shortDate(e.date)}</time><span>${e.label}</span><strong>${e.key === 'salary' ? '+' : '−'}${rm(e.amount, 0)}</strong></div>`).join('');
}
function renderRecap() {
  const month = $('recap-month').value;
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) { $('recap-content').textContent = 'Choose a month to see your recap.'; return; }
  const recap = monthRecap(ledger, month);
  if (!recap.days) { $('recap-content').innerHTML = '<p class="empty-copy">Belum ada rekod bulan ini. Log belanja di Daily spending dulu, baru nampak ceritanya.</p>'; return; }
  const difference = recap.budget - recap.total;
  $('recap-content').innerHTML = `<div class="recap-stats"><div><span>TOTAL LOGGED</span><strong>${rm(recap.total)}</strong></div><div><span>DAYS LOGGED</span><strong>${recap.days} <small>${recap.days === 1 ? 'day' : 'days'}</small></strong></div></div><p class="tool-help">${recap.count} ${recap.count === 1 ? 'transaction' : 'transactions'} · ${rm(Math.abs(difference))} ${difference >= 0 ? 'below' : 'over'} the budget of ${rm(recap.budget)} for logged days.</p>${recap.breakdown.filter(c => c.total > 0).map(c => `<div class="recap-category"><span>${c.label}</span><span>${rm(c.total)} · ${money(c.total / recap.total * 100, 0)}%</span></div>`).join('')}<p class="tool-help">${recap.total > 0 ? `Paling banyak spend: ${recap.breakdown[0].label}.` : 'No spending logged.'} ${month === dateKey(now).slice(0, 7) ? `Estimated balance before your next payday: ${rm(result.projected)} (estimate).` : 'Past closing balances are unavailable because no snapshot was saved at the time.'}</p>`;
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
    if (file.size > 5000000) throw new Error('The file is too large. The limit is 5MB.');
    const value = JSON.parse(await file.text());
    if (!validateBackup(value)) throw new Error('Invalid backup or unsupported version. Your current data has not changed.');
    pendingRestore = value;
    $('restore-summary').textContent = `Expenses: ${value.ledger.expenses.length}. Logged days: ${Object.keys(value.ledger.days).length}. Take-home pay: ${rm(value.profile.salary)}. Theme: ${value.theme === 'light' ? 'light' : 'dark'}.`;
    $('restore-dialog').showModal();
  } catch (error) { $('backup-error').textContent = error instanceof SyntaxError ? 'This is not a valid JSON file. Your current data has not changed.' : error.message; }
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
  cancelExpense(); syncThemeControl(); persist(); render(); $('restore-dialog').close(); toast(storageAvailable ? 'Backup dah restore. Boleh sambung.' : 'Backup restored for this session only.');
}
