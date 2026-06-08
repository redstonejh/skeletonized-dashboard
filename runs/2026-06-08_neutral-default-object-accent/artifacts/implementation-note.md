# Implementation Note

## Root Cause
Cleared/default objects still inherited blue because multiple default paths seeded `#2563eb` or `var(--blue)`:

- Tool markup defaulted the color toggle's `data-default-theme` to `#2563eb`.
- Panel/widget save serialization fell back to `#2563eb` when no custom color existed.
- Base panel header and tool CSS used blue values before custom-color overrides applied.
- The shared object-shell and control variables used blue as their fallback accent.

## Changes
- Default tool markup and saved object color fallback now use an empty color, not blue.
- New/default panel headers, titles, counts, tool icons, controls, drawers, object shell, and object control variables now use neutral light glass fallbacks.
- The explicit blue swatch remains in `panelThemePresets`, so choosing blue still applies blue.

## Validation
Not run. The user explicitly instructed: "NO TESTS -- do not run the e2e/canary suite or any validation; I verify manually."
