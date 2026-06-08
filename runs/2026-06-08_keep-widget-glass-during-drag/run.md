# Keep Widget Glass During Drag

## Task
Fix intermittent pure-white widgets during drag/collision so neighboring widgets keep their translucent glass material.

## Plan
- Use real delegated MAW role sessions and record proof.
- Inspect drag/reflow interaction classes and CSS material resets.
- Remove the forced white widget background reset while preserving interaction transform/shadow suppression.
- Commit and push without running tests, per explicit user instruction.

## Outcome
SHIP

Tests and validation were not run because the user explicitly instructed not to run tests or validation.
