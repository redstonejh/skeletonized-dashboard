# Critic

Review:
- Widget body tint is scoped to `data-panel-color-user="true"` so default seeded widget colors do not violate static/photo material parity.
- Clear color removes `db-panel-custom-color`, `--panel-accent`, user marker, and widget border override.
- Hydration distinguishes `colorCleared` from absent color.
- Absorption restores the portalled drawer before cloning, preserving the panel-contained widget's customization controls.

Checks:
- Focused recolor/clear canary passed.
- Focused panel-contained widget move canary passed.
- Full e2e passed.
