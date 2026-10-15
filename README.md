# Gaji Survival

Offline-first salary survival simulator in Bahasa Melayu. Dark survival HUD, live budget editing, future-only what-if cuts, interactive burn-down chart, local storage, and a downloadable PNG receipt.

Use the theme toggle in the top bar to switch between the original dark palette and a warm ivory/amber light palette. Dark is the default; the selected theme persists separately from budget data and is applied before first paint. Charts, financial status colors, inputs and dialogs follow the selected theme.

## Run

Requires Node.js 22.13+ (tested on Node 24). No package installation is needed.

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run dev
```

Open http://127.0.0.1:5173, or open `dist/index.html` directly. The built HTML contains all CSS and JavaScript and works without an internet connection. Rebuild after source edits; refresh the browser to view changes.

## Files

- `index.html`: app markup and build injection points.
- `src/style.css`: responsive dark interface.
- `src/theme.css`: theme toggle and warm light palette overrides.
- `src/main.js`: interface, chart, storage and receipt export.
- `src/finance.ts`: typed calculation model.
- `src/finance.test.ts`: calculation and input-validation tests.
- `scripts/build.mjs`: combines sources into a self-contained HTML file.

## Assumptions

Fixed bills are deducted at the start of the salary cycle. Daily spending is distributed uniformly over elapsed time. What-if savings begin now and never restore past spending. Payday is midnight in the device's timezone; days 29–31 clamp to the last day of shorter months. Depletion projections exclude future salary credits. Zero daily spending with positive funds produces no depletion date. Negative funds remain a deficit rather than being silently discarded; the available-to-spend display bottoms out at RM0.

Example numbers are labeled until a budget is saved. Data stays in the current browser's local storage; when storage is unavailable the app remains usable for the session. Closing the editor without saving cancels its live preview. Exported receipts contain financial figures, explicitly noted in the export dialog.

The original specification remains unchanged. The implementation uses native browser APIs instead of the proposed React/Chart.js dependencies because npm network access was unavailable in the build environment.
