# CSS Consolidation Plan

This plan orders future CSS work by safety. No CSS changes are made in phase 1.

1. DONE - Tokenize hard-coded values into `tokens.css`. Risk: low-medium. Gate: computed-style parity for panels, widgets, controls, and menus.
2. DONE - Measured per-background-tone duplication after the prior safe collapse; only 2 of 165 tone-specific declarations remain collapsible, with 1 estimated removable line, so the tone CSS is largely distinct. Proof: `artifacts/per-tone-duplication-report.json`.
3. Reduce removable `!important` declarations using `themes-important-classification.json`. Risk: medium-high. Gate: classified removable entries plus computed-style parity.
4. Unify glass material rules shared by panels, widgets, menus, and WebGL fallback. Risk: high. Gate: photo/background/custom-color/webgl matrix parity.
5. Split `themes.css` into cohesive modules only after parity and import-order proof. Risk: high. Gate: zero computed-style drift and unchanged CSS rule inventory.
