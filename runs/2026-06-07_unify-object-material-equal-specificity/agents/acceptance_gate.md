# Acceptance Gate Notes

Acceptance evidence:

- Focused material test passed: `npm.cmd run test:e2e -- --workers=1 --reporter=line -g "uses the same object material"`.
- Full hidden Electron e2e passed: `npm.cmd run test:e2e -- --workers=1 --reporter=line`, 24/24.
- Static replay block count is 0.
- `themes.css` line count is 5717 after the change.
- Delegation proof and verdict check pass.

