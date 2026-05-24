# Interaction Philosophy

## Purpose

This document consolidates the interaction principles that must survive the transition to a larger spatial workspace.

## Direct Manipulation

Users should manipulate objects directly when possible:

- Drag to move.
- Resize to change footprint.
- Group to transform multiple objects.
- Drop onto explicit context targets.
- Use anchors to navigate spatially.

Configuration surfaces should support direct manipulation, not replace it with modal-only workflows.

## Drag Philosophy

Drag has two simultaneous truths:

- Live visual object follows the pointer fluidly.
- Snapped footprint shows where the object can commit.

The live surface is for the hand. The footprint is for the grid.

Neighbor movement is preview state until drop.

## Resize Philosophy

Resize should feel continuous while committing to deterministic grid units.

- Live clone shows continuous motion.
- Snapped footprint shows committed size.
- Surrounding reflow responds to the footprint.
- Commit writes final grid span/row span/height.

Do not commit from the live clone alone.

## Preview Vs Commit

Preview state:

- Ghosts.
- Placeholders.
- Live clones.
- Temporary displacement.
- Prospective context indicators.

Commit state:

- Grid coordinates.
- Spans.
- Saved heights.
- Object config.
- Context records.
- Anchor records.

The two must never be confused.

## Hover, Active, And Material Logic

Large spatial objects may have subtle hover presence.

Compact pressable controls should depress or settle on hover/press.

The glass material system is shared across backgrounds. Background color changes the environment, not the material identity.

## Grouped Interaction

Groups behave like composite spatial objects during transformation:

- One composite footprint owns collision.
- Member live surfaces preserve relative geometry.
- Members keep identity and individual constraints.
- Pinned members reserve cells and do not move directly.

Persistent semantic groups, if added later, must not corrupt temporary selection behavior.

## Adaptive Density

Dense widgets should adapt before demanding larger footprints:

1. Reduce gaps.
2. Use compact labels.
3. Wrap or collapse secondary controls.
4. Use local dropdowns.
5. Only then increase minimum footprint if usability would otherwise break.

## Environmental UX

The workspace should feel calm, premium, and spatial:

- Background tones are environmental.
- Glass surfaces are shared material objects.
- Motion should preserve orientation.
- Controls should not compete with content.
- Visual hierarchy should explain object role.

## Menus And Control Surfaces

Menus are contextual glass surfaces:

- They should originate from the control that opened them.
- They should hide or become inert during protected drag/resize when needed.
- They should not create layout measurements or collision changes.
- They should not become separate admin pages.

## Future Pan/Zoom

Pan and zoom, if introduced, must preserve:

- Grid alignment.
- Pointer hit testing.
- Menu positioning.
- Drag/resize preview agreement.
- Text legibility.
- Reduced motion behavior.

Camera movement must not mutate layout.

