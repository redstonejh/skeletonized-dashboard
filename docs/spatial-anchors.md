# Spatial Anchors

## Purpose

Spatial Anchors are a future navigation layer for the dashboard workspace.

The dashboard should remain tabless. Navigation should happen inside one continuous spatial dashboard/grid rather than through conventional tabs, pages, or route-like switches.

Spatial Anchors are floating viewport-fixed controls that act as contextual bookmarks into the larger dashboard world. Clicking an anchor smoothly moves the user back to a linked widget, panel, group, region, semantic context, or saved viewport while preserving the feeling of one continuous workspace.

This is an architecture plan only. Do not implement placeholder UI, fake controls, or tab-like navigation without a follow-up implementation task.

## Concept Name

Recommended name: **Spatial Anchors**.

Rationale:

- "Spatial" reinforces the dashboard's continuous workspace philosophy.
- "Anchor" communicates a stable return point without implying tabs or pages.
- The name remains generic and product-neutral.

Acceptable secondary terms:

- Context Anchors, when emphasizing inherited context.
- Workspace Anchors, when describing persistence or profile-level behavior.
- Docked Context Pins, only as an implementation detail for pinned viewport placement.

Avoid terms that imply pages, tabs, routes, workspaces-as-documents, or app sections.

## UX Model

### Creation

Anchors should be created from explicit user intent, such as:

- Create anchor from selected widget.
- Create anchor from selected panel.
- Create anchor from selected group.
- Create anchor from current viewport.
- Create anchor from a named context or future spatial region.

The creation flow should be low-friction and non-modal where possible. It should not require users to think in routes, pages, or tab destinations.

### Targets

Anchors may link to:

- A widget.
- A panel.
- A selected group.
- A future named dashboard region.
- A semantic context scope.
- A saved viewport/camera position.
- A grid coordinate snapshot as fallback.

The target is world-relative. The anchor's floating position is viewport-relative.

### Appearance

Anchors should feel like quiet floating glass controls, not tabs or mini widgets.

Visual qualities:

- Compact icon-first control.
- Soft neutral/slate glass surface.
- Subtle border and shadow.
- Optional label reveal on hover or focus.
- Optional accent tied to target or inherited context.
- Clear but restrained missing-target state.
- Calm current/near-target state.

Anchors should remain visually secondary to dashboard content.

### Movement And Pinning

Anchors stay fixed to the viewport until the user moves them.

Users should be able to:

- Drag anchors to a preferred screen position.
- Pin or lock an anchor's viewport position.
- Unpin/reposition anchors without changing the linked target.
- Temporarily hide or show the anchor layer.

Anchor repositioning must not mutate dashboard grid layout.

### Target Communication

An anchor should communicate what it points to without becoming a heavy card.

Useful cues:

- Icon.
- Short label.
- Accent color.
- Tooltip or accessible description.
- Context badge for inherited context.
- Target-visible/current indicator.
- Missing-target indicator when unresolved.

The UI should answer: "Where will this take me?" without creating a new navigation hierarchy.

### Navigation

Clicking or keyboard-activating an anchor should:

1. Resolve the best available target.
2. Determine an appropriate viewport alignment.
3. Smoothly scroll or move the dashboard to that region.
4. Account for navbar/header offsets.
5. Update active/current/near state.

The experience should feel like spatial teleportation/bookmarking inside one continuous dashboard, not like switching pages.

## Interaction Rules

- Anchors are viewport-fixed.
- Anchors can be repositioned by the user.
- Anchors should not block core dashboard interactions.
- Anchors should avoid overlapping critical controls such as navbar controls, panel toolbars, resize handles, and drag handles.
- Anchor navigation must be disabled or deferred during active drag, resize, group move, group resize, text editing, modal dialogs, or menu interactions.
- Smooth scroll should feel cinematic but not slow.
- Repeated clicking should be deterministic.
- The same anchor should resolve to the same target and alignment unless the target moved or was deleted.
- Escape may cancel active anchor repositioning or a pending anchor creation flow.
- Anchor dragging should not be interpreted as dashboard drag.
- Dashboard drag/resize should suppress anchor hover/activation if pointer paths overlap.

## Context Inheritance

Anchors can inherit context from the object or region used to create them.

Resolution should prefer local context before global context:

1. Selected widget context.
2. Selected panel context.
3. Selected group context.
4. Named region or semantic context.
5. Dashboard/global context.

Inherited context must remain visually legible:

- Use quiet badges, accent rings, or tooltip metadata.
- Show enough context to explain why the anchor exists.
- Avoid turning anchors into data widgets.

Anchors reference context; they should not silently mutate context, filters, links, or dashboard layout.

## Layout And Data Architecture

Spatial Anchors should be stored separately from dashboard grid items.

Reasons:

- Anchors are navigation controls, not grid occupants.
- Their position is viewport/screen-relative.
- Their target is dashboard/world-relative.
- They should not participate in grid collision, snapping, resize, pinning, or panel collapse.
- They may exist above or outside the visible grid content.

### Coordinate Model

Use two coordinate spaces:

- Anchor position: viewport-relative.
- Anchor target: world/grid-relative.

The anchor should usually resolve by target id. Coordinate snapshots are fallback data.

If a target moves, the anchor follows the target by id.

If a target is deleted, the anchor enters missing-target state rather than jumping to stale coordinates without explanation.

## Persistence Model

Future anchor records should support:

```json
{
  "id": "anchor_123",
  "label": "Notes",
  "icon": "sticky-note",
  "targetType": "panel",
  "targetId": "builder-notes",
  "viewportPosition": {
    "x": 24,
    "y": 180,
    "edge": "left"
  },
  "targetSnapshot": {
    "gridColumn": 1,
    "gridRow": 7,
    "gridColumnSpan": 3,
    "gridRowSpan": 2
  },
  "alignment": "center-if-small-start-if-large",
  "accent": "slate",
  "context": {
    "sourceType": "panel",
    "sourceId": "builder-notes",
    "label": "Notes"
  },
  "pinned": true,
  "scope": "layout-profile",
  "createdFrom": "selection",
  "createdAt": "2026-05-23T00:00:00Z",
  "updatedAt": "2026-05-23T00:00:00Z"
}
```

Recommended fields:

- `id`: stable anchor id.
- `label`: short human-readable name.
- `icon`: generic icon key.
- `targetType`: widget, panel, group, region, context, viewport, or coordinate.
- `targetId`: stable target id where available.
- `viewportPosition`: fixed screen placement.
- `targetSnapshot`: fallback world/grid position.
- `alignment`: scroll alignment behavior.
- `accent`: optional visual accent.
- `context`: optional inherited context metadata.
- `pinned`: whether the viewport placement is locked.
- `scope`: profile, dashboard, workspace, or future user scope.
- `createdFrom`: selection, current viewport, command, or restored data.

Saved dashboard layout and saved anchors should remain separate payloads, even if saved under the same layout profile.

## Scroll And Navigation Behavior

Navigation should preserve orientation.

Rules:

- Smooth scroll to the resolved target.
- Center small targets when possible.
- Align large targets near the top with navbar/header offset.
- Preserve horizontal position unless horizontal correction is needed.
- Avoid abrupt jumps.
- Respect `prefers-reduced-motion`.
- Do not trigger anchor navigation during drag/resize/group interactions.
- Do not mutate grid placement while navigating.
- If target is already visible, optionally pulse/highlight the target instead of moving dramatically.
- Long-distance navigation may use distance-aware duration, but should stay responsive.

Reduced motion:

- Use instant or very short scroll.
- Preserve focus movement and target announcement.
- Avoid cinematic easing when the user has requested reduced motion.

## Accessibility

Spatial Anchors must be keyboard-reachable and understandable.

Requirements:

- Each anchor has a descriptive accessible name.
- Anchor controls are reachable in predictable order.
- Focus state is visible in light and dark themes.
- Keyboard activation performs the same navigation as click.
- Escape cancels repositioning or creation flow where applicable.
- Reduced motion is respected.
- Tooltips or labels do not create hidden tab traps.
- Missing-target state is announced clearly.
- Anchor management is possible without pointer-only drag.

Potential keyboard model:

- Tab focuses anchors in stable order.
- Enter/Space activates navigation.
- Arrow keys or an explicit move mode can reposition an anchor.
- Escape exits move/create mode.

## Visual Language

Spatial Anchors should use the existing dashboard language:

- Glassy neutral surface.
- Theme-aware color tokens.
- Subtle depth.
- Compact icon rhythm.
- Soft hover/focus feedback.
- No harsh outlines.
- No debug-like borders.
- No conventional tab styling.
- No large persistent labels unless user chooses expanded display.

States:

- Default: quiet floating control.
- Hover/focus: slightly stronger glass/depth.
- Current target visible: calm active glow or dot.
- Target nearby: subtle proximity state.
- Missing target: muted broken-link treatment.
- Repositioning: lifted state with clear but restrained feedback.
- Disabled during dashboard interaction: visually present but noninteractive.

## Edge Cases

### Target Deleted

The anchor enters missing-target state. It should offer relink, delete, or inspect behavior in a future management UI.

### Target Moved

The anchor resolves by id and navigates to the target's current location.

### Target Hidden Or Collapsed

Navigate to the containing object, collapsed header, group bounds, or last valid target snapshot. Do not force expansion unless the user explicitly requests that behavior.

### Target Inside Group

If the group exists, navigation may align to group bounds. If the group no longer exists, resolve to the member item.

### Anchor Overlaps Controls

The system may nudge the anchor, reduce opacity, pass pointer events through during protected dashboard interactions, or offer a safe reposition state. Do not let anchors block core drag/resize/pin/settings controls.

### Many Anchors

Avoid clutter through:

- Optional anchor layer visibility.
- Compact stacking.
- Collision-aware viewport placement.
- Anchor management surface.
- Search/command access to anchors.

### Layout Reset Or Profile Load

Anchors should resolve by target id after layout restore. If the target is absent in the loaded profile, enter missing-target state or use snapshot fallback with clear communication.

## Influence On Navbar Architecture

The navbar should not evolve into conventional tab navigation.

Current and future navbar work should:

- Keep the navbar minimal.
- Avoid tab-shaped layout/page switchers.
- Avoid route-first organization assumptions.
- Treat layout/profile controls as persistence utilities, not page tabs.
- Leave room for a future anchor creation/manage control.
- Keep dashboard navigation spatial, contextual, and in-canvas.
- Avoid placeholder controls that imply tabbed navigation.

The navbar's job is global command access. Spatial Anchors are the future local navigation layer.

## Testing Strategy

Future Playwright coverage should verify:

- Creating an anchor from a widget.
- Creating an anchor from a panel.
- Creating an anchor from a group.
- Creating an anchor from current viewport.
- Anchor position persists independently from grid layout.
- Clicking an anchor scrolls to the correct target.
- Navbar/header offset is respected.
- Target movement updates anchor resolution.
- Target deletion enters missing-target state.
- Reduced motion behavior works.
- Keyboard focus and activation work.
- Anchor repositioning does not move grid items.
- Anchor navigation is suppressed during drag, resize, group move, and group resize.
- Anchors do not block critical dashboard controls.
- Save/load profile behavior preserves or clearly scopes anchors.
- Light and dark visual states remain coherent.
- Mobile viewport behavior remains usable.

Manual verification should cover:

- Long-distance navigation feel.
- Visual clutter with multiple anchors.
- Light and dark mode polish.
- Keyboard-only usage.
- Reduced motion.
- Mobile placement.
- Interaction with open menus, popovers, drag previews, resize previews, and group selection.

## Staged Implementation Plan

### Stage 1: Architecture And Vocabulary

- Keep this document current.
- Reference Spatial Anchors from spatial workspace and navbar planning docs as needed.
- Do not add UI yet.

### Stage 2: Persistence Foundation

- Add anchor records separate from dashboard grid items.
- Define local storage/API payload shape.
- Add migration/version handling if anchors become part of layout profiles.

### Stage 3: Read-Only Rendering Prototype

- Render anchors from seeded data.
- No creation UI yet.
- Verify visual language, viewport placement, and keyboard focus.

### Stage 4: Navigation Resolver

- Resolve targets by id first.
- Use snapshot fallback.
- Implement scroll alignment and reduced motion.
- Suppress navigation during protected interactions.

### Stage 5: Creation Flow

- Create anchors from selected widget, panel, group, or current viewport.
- Store inherited context metadata.
- Keep creation non-modal and lightweight.

### Stage 6: Repositioning And Pinning

- Drag anchors in viewport space.
- Support pin/lock state.
- Add keyboard repositioning.
- Avoid critical control overlap.

### Stage 7: Context And State Polish

- Add active/current/near/missing states.
- Add subtle context badges or accents.
- Add relink/delete behavior for missing targets.

### Stage 8: Profile And Workspace Integration

- Decide whether anchors are dashboard-scoped, profile-scoped, user-scoped, or workspace-scoped.
- Preserve anchors across save/load where appropriate.
- Keep anchor persistence separate from grid occupancy.

### Stage 9: Accessibility And Mobile Hardening

- Finalize keyboard model.
- Verify screen reader labels.
- Refine reduced motion.
- Tune mobile anchor placement and stacking.

## Non-Goals

- Do not create conventional tabs.
- Do not create route/page navigation as the primary dashboard model.
- Do not make anchors grid items.
- Do not let anchors participate in collision, snapping, or resize.
- Do not add placeholder anchor UI without real behavior.
- Do not make anchors visually heavier than dashboard content.
- Do not allow anchors to interrupt protected drag, resize, collapse, pinning, save/load, or group behavior.

## Success Criteria

Spatial Anchors succeed when users can move through a large dashboard as if returning to meaningful places in one continuous workspace.

The system should feel:

- Spatial.
- Continuous.
- Context-aware.
- Low-friction.
- Premium.
- Non-modal.
- Tabless.

The final experience should feel like spatial teleportation/bookmarking inside one continuous dashboard, not like switching pages or opening tabs.
