# Background Fixed Greyscale Options

## Task
Replace the custom background color picker with exactly four fixed greyscale presets: light grey, grey, dark grey, and pure black. Leave photo backgrounds unchanged.

## Plan
- Use real delegated MAW roles and record proof.
- Remove the background custom color picker and custom background persistence.
- Keep only four solid color presets, with black as `#000000`.
- Point default and legacy fallbacks at the fixed presets.
- Commit and push without running tests, per explicit user instruction.

## Outcome
SHIP

Tests and validation were not run because the user explicitly instructed: "NO TESTS -- do not run the e2e/canary suite or any validation; I verify manually."
