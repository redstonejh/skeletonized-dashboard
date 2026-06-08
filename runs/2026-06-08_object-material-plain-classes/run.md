# Object Material Plain Classes

Task: replace the object-material background tautology selectors with plain class selectors while preserving photo-background material parity.

Acceptance result: SHIP

## Final result summary

Acceptance verdict: SHIP

The object-material selectors no longer use `body:is(.has-photo-background, :not(.has-photo-background))`. The only remaining `has-photo-background` references in `themes.css` are the actual photo backdrop setup. Focused material parity and the full hidden Electron e2e suite passed.
