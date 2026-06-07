# Manual Change Review

Review range: last 10 commits through `4f0028b` plus working tree changes.

Safety net:

- Full e2e before cleanup: `npm.cmd run test:e2e -- --workers=1` passed, 17/17.
- Full e2e after cleanup: `npm.cmd run test:e2e -- --workers=1` passed, 17/17.
- Object glass independence remained covered by `electron GUI keeps object glass material independent from workspace background tokens`.
- No-auto-scroll-on-drag remained covered by `electron GUI keeps ordered drag commit, ghost, collision, and no interaction scrolling deterministic`.

## Findings

### Fixed

- Medium: `app/static/modules/workspace-tabs-runtime.js:49` used `role="tablist"` / `role="tab"` and `aria-selected` without any tabpanels. The current UI is visual page-selection scaffolding, not a complete tab interface. Fixed by using a labeled `toolbar` with pressed buttons.
- Medium: `app/static/modules/workspace-tabs-runtime.js:194` used `role="menuitemradio"` with `aria-pressed`. Fixed to use `aria-checked`, and updated the e2e assertion.
- Medium: `app/static/themes.css:5541` disabled reduced-motion transitions on `.workspace-tab::after`, but the animated tab shadow is `.workspace-tab::before`. Fixed the selector and updated the e2e reduced-motion assertion.
- Low: `app/static/themes.css:1467` duplicated the later white-theme customization icon contrast rule. Removed the duplicate earlier block while preserving the later rule.

### Documented, Not Changed

- Needs-human: `app/static/modules/workspace-tabs-runtime.js` uses a menu-like popover that contains a rename text input. It is currently functional and covered, but a stricter accessibility pattern might model this as a dialog/popover instead of `role="menu"`. This is a design/interaction semantics choice, so it was not guessed in this cleanup.
- Allowlisted: `app/static/liquid-glass-webgl.js` exposes console diagnostics through an explicit debug API. The review found no unconditional runtime `console.log` or `debugger` in normal user flows.

## Safe Fix Summary

- No dependency, Electron, persistence, or interaction timing files were changed.
- Cleanup was limited to tab semantics, reduced-motion selector coverage, duplicate CSS removal, and matching e2e assertions.
- Existing protected invariants stayed green in the full e2e suite.
