# Acceptance Gate

Verdict: SHIP

Accepted evidence:
- `npx.cmd playwright test electron-tests/dashboard-electron.spec.js --workers=1 --reporter=list -g "recolors widgets"`: passed.
- `npx.cmd playwright test electron-tests/dashboard-electron.spec.js --workers=1 --reporter=list -g "panel-contained widgets movable"`: passed.
- `npx.cmd playwright test electron-tests/dashboard-electron.spec.js --workers=1 --reporter=list -g "recolors widgets|same object material"`: passed.
- `npm.cmd run test:e2e -- --workers=1`: 27 passed.
