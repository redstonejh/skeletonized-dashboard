# Acceptance Gate Notes

Acceptance evidence:

- `node --check app/static/modules/ordered-drag-runtime.js`
- `node --check electron-tests/dashboard-electron.spec.js`
- `npm.cmd run test:e2e -- --workers=1 --reporter=line -g "drag cursor aligned"` passed.
- `npm.cmd run test:e2e -- --workers=1 --reporter=line` passed 24/24.
- delegation proof and verdict checks pass.

