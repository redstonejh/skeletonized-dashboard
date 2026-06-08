# Worker Notes

Changed only `app/static/themes.css`.

Implementation summary:

- Material token scope now uses `body:is(.has-photo-background, :not(.has-photo-background))`.
- Canonical object material selectors now use the same equal-specificity shared selector.
- The stale static-only replay block was removed.
- A late shared no-filter/divider normalization preserves the canonical computed WebGL/object material.

