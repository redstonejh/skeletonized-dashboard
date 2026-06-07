# MAW Run: remove layout system; collapse to single Save/Load

Task: remove the named layout profile system and collapse persistence to one workspace state with Save and Load.

Runtime: Windows PowerShell, `npm.cmd` only, Electron unchanged.

## Plan

- Remove the user-facing named layout picker/menu and dashboard switcher.
- Force active persistence to the single working profile `0`.
- Migrate a legacy active/default saved layout source into the single working profile without data loss.
- Keep Save, Load, Reset, Add, Select, tabs, and interaction canaries working.
- Use real sub-agent delegation and record proof.

## Work Completed

- Removed the live layout slot picker/menu markup from `index.html`.
- Deleted `app/static/modules/dashboard-switcher.js` and removed its `app.js` import/init.
- Replaced named-slot `layout-source-runtime.js` behavior with single-workspace Save/Load.
- Forced `layout-persistence.js` active profile reads/writes to profile `0`.
- Added `migrateActiveProfileToSingleState()` to copy a legacy active profile or saved `dashboard-layout-source:*` slot into profile `0`.
- Fixed a critic-found overwrite bug by removing the consumed legacy `dashboard-layout-source:*` key during migration and Save/Load.
- Updated interaction exclusion/menu helpers to stop treating the deleted layout slot menu as live UI.
- Hardened the tab context-menu close path so tab rename Save/Load coverage does not emit a page error.
- Added/updated e2e coverage for removed slot UI, single Save/Load restore, tabs persistence, and legacy active saved-slot migration.

## Delegation Notes

Real `multi_agent_v1.spawn_agent` delegation was available and used. Selected roles:

- conductor: `019ea3ca-9317-75c3-adf8-ea524cb3b11d`
- worker: `019ea3ca-93a2-7cc0-8cc2-cb351fe34fc6`
- critic: `019ea3ca-d4ab-7e22-bee7-b6594577d000`
- acceptance_gate: `019ea3ca-d525-7fb0-957e-5c833a788c81`

The worker and critic both identified the stale legacy `dashboard-layout-source:*` overwrite risk. That was fixed before final acceptance. The conductor's NO-SHIP note was based on a pre-fix/full-suite snapshot; the final local acceptance run after the fix passed 19/19.

## Verification

- `node --check app/static/app.js`: pass.
- `node --check app/static/layout-persistence.js`: pass.
- `node --check app/static/modules/layout-profile-migration.js`: pass.
- `node --check app/static/modules/layout-source-runtime.js`: pass.
- `node --check app/static/modules/workspace-tabs-runtime.js`: pass.
- `node --check electron-tests/dashboard-electron.spec.js`: pass.
- Focused e2e `slim navbar controls wired|migrates an active legacy layout profile`: pass, 2/2.
- Focused e2e `glass text tabs`: pass, 1/1 after cleaning stale Electron test processes.
- Final full e2e `npm.cmd run test:e2e -- --workers=1`: pass, 19/19, 2.6m.

Intermittent validation history:

- One full-suite run crashed a renderer while stale Electron processes from older dashboard launches were still running.
- One full-suite run saw the first pin canary fail, but the same test passed in isolation and the final clean full-suite pass succeeded.
- No product changes were made to relax those canaries.

## Deferred Cleanup

Dead `.layout-slot-picker`, `.layout-slot-trigger`, `.layout-slot-menu`, `.dash-switch*`, and `.layout-source-*` CSS/test-oracle references remain in mixed navbar/menu style groups. The live markup and JS routes are gone. This is inert CSS cleanup debt and was not removed in this persistence change to avoid a broad visual refactor.

## Final result summary

Final verdict: SHIP

The named layout selector/runtime is removed from live UI and behavior, Save/Load now operate on one workspace state, legacy active saved layouts migrate into the single state, and final e2e acceptance passed.
