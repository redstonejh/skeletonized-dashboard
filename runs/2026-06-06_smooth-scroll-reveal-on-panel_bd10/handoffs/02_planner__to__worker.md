# Hand-off: planner -> worker  (run 2026-06-06_smooth-scroll-reveal-on-panel_bd10, step 02)

## Task context
Implement panel open reveal and close restore as pure viewport scrolling.

## What I did
Identified `panel-action-controls.js` `togglePanel()` as the correct hook and recommended excluding `openPanelForInternalDrop`.

## Output / artifacts
- artifacts/conductor-plan.json  (accepted implementation scope)

## Open questions / risks
Close can shrink document height and clamp scroll position, so scroll-back may need temporary viewport runway.

## Recommended next step
Add the helper locally in `panel-action-controls.js` and cover reveal, restore, reduced motion, manual scroll, and no-reflow.
