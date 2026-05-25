# Workspace Chrome

## Purpose

The top surface is workspace chrome, not an admin toolbar. It should feel like atmospheric controls floating over the dashboard: spatial, restrained, premium, and powerful without visual noise.

It answers:

- Where am I?
- What can I create?
- Which layout/history controls are available?
- Which interaction mode is active?
- What environment/theme is active?

## Current Direction

Do not return to the previous command-island model. The rejected direction was too crowded, too segmented, and too equal-weight. Future toolbar work should remove visual competition instead of adding more bordered capsules.

The desired structure is:

- One workspace anchor: the dashboard selector and subtle accent presence.
- One quiet creation affordance: compact floating creation lens with a menu surface.
- Secondary ambient controls: layout, save/load, undo, group, engineer, context view.
- Utility controls: status, background tone, restore, settings.

Grouping is implied through placement, depth, rhythm, and opacity. Avoid rows of outlined containers.

## Spatial Hierarchy

The dashboard canvas is the main surface. The chrome should not be a giant slab sitting above it.

- The header container itself stays visually quiet and transparent.
- The workspace anchor carries the strongest persistent surface.
- The creation lens floats slightly forward and lower than secondary controls.
- Persistence controls recede until hovered, focused, or actively used.
- Appearance/status controls remain ambient edge controls.

## Visual Rules

- Prefer floating atmospheric controls over a single large toolbar card.
- Use fewer visible borders.
- Keep controls ghosted until hover, focus, or active state.
- Keep creation subtle; it should not look like a giant CTA.
- Use existing theme tokens; do not hard-code the current blue theme.
- Menus and popovers float above the chrome and never resize it.
- Settings, dialogs, and secondary surfaces must share the same premium glass language.

## Interaction Rules

- Existing JS hooks and class names should remain stable unless there is a strong reason to change them.
- Add menu, layout slots, mode toggles, background picker, restore, and settings must keep working.
- Mode controls expose `aria-pressed` and body state classes.
- Creation menus stay domain-neutral.

## Testing

Toolbar tests should verify:

- The `.workspace-chrome` container does not render as a giant visible slab.
- Floating anchor and creation controls carry the glass/depth treatment.
- Old `.workspace-command-island` elements no longer render as bordered/shadowed islands.
- Add menu opens and exposes generic object types.
- Engineer Mode toggles correctly and is the single visibility gate for context visualizations.
- Default and deep-background screenshots are captured.
- Console and network errors stay clean.
