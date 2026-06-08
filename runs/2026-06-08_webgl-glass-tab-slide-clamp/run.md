# Run: webgl-glass-tab-slide-clamp

## Task
Clamp the shared WebGL liquid-glass canvas to the workspace tab-slide transform so stale object rects do not appear displaced during tab switching.

## Outcome
NO-SHIP / committed by user direction.

The focused canary passed once, but the full e2e gate was interrupted and the user directed: "its fine, you can commit it, its not fixed, make a note of it. but dont run tests. this part is done". The change is committed without claiming the bug is fixed.
