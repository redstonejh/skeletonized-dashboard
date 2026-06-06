# CSS Computed-Style Oracle Summary

Verdict: deterministic and resistance-proven.

- Target CSS files: `app/static/themes.css`, `app/static/dashboard-grid.css`, with `app/static/tokens.css` included in source hashing.
- Tangle map: `artifacts/css-core-map.md` and `artifacts/css-tangle-map.json`.
- Computed-style baseline: `artifacts/computed-style-baseline.json`.
- Determinism: `artifacts/computed-style-determinism.json`, 10/10 matching captures.
- Resistance: `artifacts/css-oracle-resistance.json`, color and spacing mutations caught in temporary app copies.
- CSS byte identity: `artifacts/css-byte-identity.json` and `artifacts/css-zero-diff.json`.

The oracle disables CSS transitions and animations inside the test page to avoid sampling transitional intermediate values. Transition and animation declarations remain classified in the CSS tangle map.
