# Hand-off: planner -> worker  (run 2026-06-06_run-electron-e2e-with-hidden_9929, step 02)

## Task context
The requested change is behavior-neutral outside tests: hidden only when `process.env.MAW_HEADLESS === "1"`.

## What I did
Identified `main.js` as the BrowserWindow creation point and the three Electron spec launch helpers as the env propagation points.

## Output / artifacts
- artifacts/conductor-plan.json  (scope and role gates)

## Open questions / risks
Hidden windows can affect tests that depend on focused/visible rendering; the helper should assert `BrowserWindow.isVisible() === false` so this is covered.

## Recommended next step
Add `show: process.env.MAW_HEADLESS !== "1"` and set `env: { ...process.env, MAW_HEADLESS: "1" }` in every `_electron.launch` call.