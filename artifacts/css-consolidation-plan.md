# CSS Consolidation Plan

This plan orders future CSS work by safety. No CSS changes are made in phase 1.

1. DONE - Tokenize hard-coded values into `tokens.css`. Risk: low-medium. Gate: computed-style parity for panels, widgets, controls, and menus.
2. DONE - Replaced hand-tuned solid color tones with the explicit derived `--base-tone` custom-color model requested by the user. Color-tone computed-style parity no longer applies to this redesigned surface; photo backgrounds remain separate and covered by functional e2e.
3. Reduce removable `!important` declarations using `themes-important-classification.json`. Risk: medium-high. Gate: classified removable entries plus computed-style parity.
4. Unify glass material rules shared by panels, widgets, menus, and WebGL fallback. Risk: high. Gate: photo/background/custom-color/webgl matrix parity.
5. Split `themes.css` into cohesive modules only after parity and import-order proof. Risk: high. Gate: zero computed-style drift and unchanged CSS rule inventory.
