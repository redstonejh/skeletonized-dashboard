# MAW Run: fixed-window-viewport-floor

## Task
Fix the drag/collision floor so it is derived from the fixed visible window viewport, not the auto-growing grid host height.

## Workflow
- Type: refactor-task
- Repository: skeletonized-dashboard
- Environment: Windows PowerShell, npm.cmd, MAW_HEADLESS=1
- Delegation: real sub-agent contexts reused after spawn cap was reached; proof in artifacts/delegation-proof.json

## Acceptance
Verdict: SHIP

Evidence:
- Discovery guard passed for app/static/app.js, ordered-drag-runtime.js, collision-reflow.js, dashboard-geometry.js, and the e2e spec.
- The shared floor calculation now uses window.innerHeight minus the dashboard grid top offset and fixed page bottom inset for workspace drags.
- Panel-internal widgets use the panel body's visible rect, not content height.
- Existing drag and collision enforcement still consumes the shared floor API.
- npm.cmd run test:e2e -- --workers=1 passed: 27/27.
- delegation_check.py, validate_handoffs.py, and verdict_check.py passed.
