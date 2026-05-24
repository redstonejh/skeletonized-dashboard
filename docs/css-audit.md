# CSS Audit

Phase 2 cleanup focused on removing confirmed duplicate, dead, and domain-specific CSS while preserving the existing dashboard builder visual system.

## Inventory Summary

- CSS files scanned: `style.css`, `tokens.css`, `base.css`, `layout.css`, `components.css`, `dashboard-grid.css`, `themes.css`, `utilities.css`
- Template/JS files scanned: `base.html`, `dashboard.html`, `settings.html`, `app.js`
- Defined CSS classes after cleanup: 208
- Template/JS class-like references found: 410
- Unused CSS classes found by the heuristic scanner: 72
- Exact duplicate rules after cleanup: 0
- Duplicate selector entries remaining: 218

The missing-class count from the scanner is intentionally treated as noisy because JavaScript property reads such as `.dataset`, `.classList`, and `.bounds` look like class selectors to a simple static regex. Those were not treated as missing CSS bugs unless the same class was actually emitted into the DOM.

## Removed Selectors

- `.panel-layout:has(.db-panel-tools-open)` duplicate: removed the exact duplicate declaration and kept the combined tools-open/focus-within rule.
- Old setup/detail page selectors in `base.css`: removed `app-header`, `portal-grid`, connected banner, source form, summary, message feed, priority, rating, logic card, old detail page, and obsolete responsive blocks because the current app templates no longer render those screens.
- Old connected-dashboard layout selectors in `layout.css`: removed the unused topbar/command-bar scaffolding and kept only the live `.cmd-btn` base.
- Empty/dead table row selectors in `components.css`: removed old row state hover colors, item table widths, and unused `al-date`/`al-host`/`al-item`/`al-status` component rules where they were not used by the current placeholder table.
- Domain-specific theme selectors in `themes.css`: removed legacy vendor, monitoring, communication, ranking, incident, dashboard switcher, logo, and panel color rules.
- Visualization/analytics remnants: removed `viz-*`, `analytics-panel`, `db-grid`, `db-topbar`, and related responsive overrides because those panels are not rendered by the generic builder.
- Escalation-card remnants: removed unused `esc-card`, `esc-row`, `esc-time`, `esc-reason`, `esc-hd`, and `esc-fields` styling, while keeping the currently rendered placeholder shell classes.
- `utilities.css`: emptied after confirming its rules were exact duplicates of rules already restored in `themes.css`.

## Normalized Tokens

- Motion tokens added in `tokens.css`: `--motion-fast`, `--motion-grid`, `--motion-popover`.
- Z-index tokens added in `tokens.css`: `--z-header`, `--z-dropdown`, `--z-popover`, `--z-modal`, `--z-drag-ghost`, `--z-resize-handle`.
- Grid movement, widget hover, drag/ghost, resize handle, dropdown, popover, and header z-index rules now use those existing tokens where they had repeated literal values.

## Remaining Duplicates

The remaining duplicate selector entries are intentional cascade/material layering, not exact duplicate rules. Most are hover/focus refinements or later dashboard-builder overrides that share selector names with base component rules.

## Validation Notes

- Brace balance is clean in all split CSS files.
- Exact duplicate CSS rule count is zero after cleanup.
- Forbidden domain terms were searched across templates, JS, CSS, and README. Remaining matches are false positives from generic words such as `reset`, `preset`, and template `macro`.
