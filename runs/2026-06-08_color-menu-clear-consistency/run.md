# Run: color-menu-clear-consistency

## Task
Make the color menu clear/no-color option consistent with the shared panel/widget color menu structure.

## Outcome
SHIP by implementation-only user rule. No tests or validation commands were run by request.

## Changes
- Removed the separate `panel-color-clear` button/group code path.
- Added no-color as the first swatch in the shared theme-color group.
- Made clear/no-color selection use the same selection refresh path as all swatches.
- Cleared stale menu accent variables when an object returns to default material.
- Replaced blue no-color/menu fallback accents with neutral glass/white treatment.

