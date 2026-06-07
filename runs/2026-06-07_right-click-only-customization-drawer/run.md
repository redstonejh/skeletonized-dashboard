# MAW Run: Right-Click-Only Customization Drawer

Task type: refactor-task / frontend behavior change

Target repo: `C:\Users\redst\OneDrive\Documents\skeletonized-dashboard`

Selected roles: conductor, planner, worker, critic, acceptance_gate

Delegation primitive: `multi_agent_v1.spawn_agent`

## Summary

Changed the panel and widget customization tool drawer so external opening happens only through the existing `contextmenu -> __openCustomization` path.

Implementation:

- Removed widget left-click body workbench opening.
- Removed widget settings left-click/pointerdown drawer toggle.
- Removed widget hover/approach open behavior.
- Removed panel settings left-click drawer toggle.
- Removed panel hover/focus approach open behavior.
- Removed CSS-only `:focus-within` drawer visibility selectors.
- Kept right-click customization, drawer controls, panel header collapse, drag, resize, pin, save/reload, object-glass independence, and no-auto-scroll behavior.
- Allowed widget contextmenu customization through interactive widget content so right-click opens the drawer reliably.

## Verification

- `node --check app/static/modules/widget-layout-runtime.js`: passed.
- `node --check app/static/modules/panel-layout-runtime.js`: passed.
- `node --check electron-tests/dashboard-electron.spec.js`: passed.
- Focused e2e canary `opens customization drawers only from right click`: passed.
- Full e2e: `npm.cmd run test:e2e -- --workers=1`: 18 passed.

## Final result summary

Acceptance verdict: SHIP
