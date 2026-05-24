# Anchor System

## Purpose

Spatial Anchors provide tabless navigation through a continuous workspace. They are viewport-fixed controls that point into world/grid-relative targets.

Detailed planning lives in `docs/spatial-anchors.md`. This document defines their role in the broader architecture.

## Definition

A Spatial Anchor is:

- A floating viewport control.
- A persistent navigation point.
- A semantic bookmark.
- A resolver from viewport space to workspace space.
- A context reference, not a context mutator.

It is not:

- A grid item.
- A tab.
- A route.
- A mini widget.
- A panel.

## Current Foundation

The current implementation renders anchors in a dedicated floating navigation layer, not in the dashboard grid. Anchors use `data-workspace-object-type="anchor"` but live under `.workspace-anchor-layer`, persist through the `dashboard-floating-anchors:*` storage namespace, and stay out of widget/panel/divider collision and reflow.

Current anchors:

- are viewport-fixed left/right side-rail controls;
- can be dragged between the left and right rail;
- resolve collisions only against other anchors in the same rail;
- store `navigationTargetType` and `navigationTargetId` metadata;
- navigate to their stored target id when activated;
- render as lightweight glass anchor objects, not browser bookmarks, tabs, or mini widgets.

This is still a foundation, not the full anchor system. Target management, keyboard repositioning, missing-target states, current/near indicators, and full anchor management are intentionally deferred.

## Coordinate Spaces

Anchors bridge two spaces:

```text
Viewport space
  anchor button at x/y or edge slot

Workspace space
  target widget/panel/group/divider/zone/viewport
```

Anchor viewport position and target world position must persist separately.

## Targets

Anchors may target:

- Widget.
- Panel.
- Group.
- Divider.
- Spatial Context Zone.
- Context scope.
- Saved viewport/camera position.
- Coordinate snapshot fallback.

Resolve by stable target id first. Use coordinate snapshots only as fallback.

## Navigation Model

Anchor activation should:

1. Resolve the target.
2. Compute scroll/future camera alignment.
3. Respect navbar/header offset.
4. Move smoothly unless reduced motion is active.
5. Focus or highlight the target without mutating layout.

Navigation should feel like returning to a place, not switching to a page.

## Interaction Suppression

Anchors must defer or disable activation during:

- Drag.
- Resize.
- Group move/resize.
- Text editing.
- Modal dialogs.
- Active menu interactions where activation would conflict.

Anchors should never block critical dashboard controls, drag handles, resize handles, or settings controls.

## Context Relationship

Anchors can carry context metadata from their creation source:

- Created from widget: references widget context.
- Created from panel: references panel context.
- Created from zone: references zone context.
- Created from viewport: may reference global or nearest region context.

The anchor can display that context as a subtle badge or tooltip, but activation should not silently change filters or layout. Context changes require explicit context system rules.

## Persistence

Persist:

- Anchor id.
- Label/icon.
- Viewport position.
- Target type/id.
- Target snapshot fallback.
- Alignment preference.
- Context metadata.
- Pin/lock state.
- Scope.

Store separately from grid item layout.

Current persistence stores side, offset, label/glyph, accent, context metadata, and target metadata separately from widget and panel layout. Save/load should never turn anchors into grid occupants.

## Visual Role

Anchors should be visually secondary:

- Compact glass nodules.
- Optional label reveal.
- Quiet current/missing states.
- No tab strip.
- No heavy cards.

## Relationship To Navbar

The navbar remains global command chrome. Anchors are the local navigation layer.

The navbar may expose anchor creation or management, but should not become a tab bar of anchor destinations.

## Open Questions

- Anchor scope: layout profile, dashboard, workspace, user, or some combination.
- Collision/stacking model for many viewport anchors.
- Whether anchor groups or folders are needed, and how to avoid rebuilding tabs under another name.
- Whether saved viewport anchors persist zoom state before pan/zoom exists.
