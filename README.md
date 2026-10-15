# Gaji Survival

Offline-first salary survival simulator in Bahasa Melayu. Dark survival HUD, live budget editing, future-only what-if cuts, interactive burn-down chart, local storage, and a downloadable PNG receipt.

The control area below the dashboard has three tabs:

- **Belanja harian:** expense entry with category, date, optional note, edit/delete, explicit zero-spend days, and a “Boleh beli ke?” purchase simulator. The shortcut buttons above the dashboard jump here.
- **Rancang bulan:** monthly bill/payday calendar with configurable due dates and a dated emergency-cost simulator. Bill amounts follow the budget editor. Calendar dates are schedules, not payment confirmations.
- **Recap & data:** monthly totals and categories, actual-versus-budget comparison for recorded days, JSON backup/restore with validation and confirmation, and app installation.

Save your own budget before recording expenses. Recorded dates replace the estimated spending for that date; enter all variable expenses for each recorded day. Unrecorded dates retain the budget estimate. Fixed bills are already reserved and should not be entered again as daily spending. The remaining part of today and future dates still use the projected daily rate. Editing or deleting the last entry leaves that date recorded (possibly RM0); use “Guna anggaran semula” to restore the estimate for an empty date.

Recap captures the daily budget when a date is first recorded, so later budget edits do not rewrite that comparison. It includes only recorded days and does not treat missing dates as zero spending. The current month shows the current cycle's projected closing balance; historical closing balances are unavailable without a historical snapshot. Purchase and emergency scenarios are independent previews and never create transactions.

Use the theme toggle in the top bar to switch between the original dark palette and a warm ivory/amber light palette. Dark is the default; the selected theme persists separately from budget data and is applied before first paint. Charts, financial status colors, inputs and dialogs follow the selected theme.

## Run

Requires Node.js 22.13+ (tested on Node 24). No package installation is needed.

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run dev
```

Open http://127.0.0.1:5173, or open `dist/index.html` directly. The built HTML contains all CSS and JavaScript and works without an internet connection. Rebuild after source edits; refresh the browser to view changes.

For an installable PWA, serve the entire `dist` folder using HTTPS (or localhost for development). The build also produces the manifest, service worker and 192/512px PNG icons. Visit once online to cache the app, then it can reopen offline. Installation availability depends on the browser; the app includes fallback instructions. The standalone HTML remains usable via `file://`, but that mode cannot install a PWA. Browser storage is specific to its origin and device: use backup/restore when moving between the file version, localhost or a hosted site. No cloud sync is included.

## Files

- `index.html`: app markup and build injection points.
- `src/style.css`: responsive dark interface.
- `src/theme.css`: theme toggle and warm light palette overrides.
- `src/main.js`: interface, chart, storage and receipt export.
- `src/finance.ts`: typed calculation model.
- `src/tools.html`, `src/tools.css`, `src/tools.js`: expense, planning, recap, backup and install UI.
- `src/manifest.webmanifest`, `src/sw.js`: app identity and offline shell.
- `src/finance.test.ts`: calculation and input-validation tests.
- `scripts/build.mjs`: combines sources into a self-contained HTML file.
- `scripts/icons.mjs`: generates PNG app icons without dependencies.

## Assumptions

Fixed bills are deducted at the start of the salary cycle. On unrecorded days, daily spending is distributed uniformly over elapsed time. On recorded days, actual totals replace the elapsed estimate; chart history spreads those totals across the elapsed portion of each recorded day. What-if savings begin now and never restore past spending. Payday is midnight in the device's timezone; days 29–31 clamp to the last day of shorter months. Depletion projections exclude future salary credits. Zero daily spending with positive funds produces no depletion date. Negative funds remain a deficit rather than being silently discarded; the available-to-spend display bottoms out at RM0.

Example numbers are labeled until a budget is saved. Data stays in the current browser's local storage; when storage is unavailable the app remains usable for the session. Closing the editor without saving cancels its live preview. Exported receipts contain financial figures, explicitly noted in the export dialog.

The original specification remains unchanged. The implementation uses native browser APIs instead of the proposed React/Chart.js dependencies because npm network access was unavailable in the build environment.
