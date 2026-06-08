## 20:00 - conductor
Selected the core MAW roles and confirmed the target is a narrow drag/collision floor fix with full e2e acceptance.

## 20:10 - planner
Mapped the bug to viewportRowFloorForLayout and the shared enforcement path used by ordered drag and collision reflow.

## 20:35 - worker
Changed the floor measurement to the fixed viewport path, added panel-internal visible-area handling, and updated canaries for the new invariant.

## 21:05 - critic
Rejected content-derived fallbacks and confirmed the fix must not use scrollHeight, grid host clientHeight, or occupied content extent.

## 21:20 - acceptance_gate
Ran focused checks and the full Electron suite under MAW_HEADLESS=1; recorded SHIP evidence.
