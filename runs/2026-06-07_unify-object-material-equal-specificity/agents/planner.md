# Planner Notes

Plan:

1. Treat current photo material as canonical.
2. Replace `body.has-photo-background` object-material selectors with equal-specificity `body:is(.has-photo-background, :not(.has-photo-background))` selectors.
3. Apply the same treatment to material token scope and baseline object material blocks.
4. Delete the late `body:not(.has-photo-background)` computed-value replay block.
5. Run focused material parity and full hidden Electron e2e.

