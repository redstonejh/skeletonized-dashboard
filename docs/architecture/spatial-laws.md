# Spatial Laws

## Purpose

Spatial laws are the rules future systems must obey so the workspace stays understandable as complexity grows.

These laws apply to widgets, panels, dividers, anchors, groups, zones, context systems, and future navigation.

## Law 1: The Workspace Is Continuous

The user remains inside one operating surface. Navigation should move, focus, or reveal parts of the workspace. It should not replace the workspace with tabbed pages unless a future product decision explicitly changes the model.

## Law 2: Committed Layout Is The Source Of Spatial Truth

Committed grid coordinates, spans, object ids, and context records define durable workspace state.

Preview surfaces, live clones, hover states, focus states, and temporary displacement are not committed layout.

## Law 3: Preview Is Reversible

Drag, resize, group transforms, divider movement, and context preview must be reversible until commit.

Canceling the interaction restores the previous committed state.

## Law 4: Temporary Displacement Is Not User Intent

Expansion pushdown, collision preview movement, auto-scroll runway extension, and snapped footprints are temporary unless the user completes a committed layout action.

Save/load must preserve committed baselines, not temporary pressure.

## Law 5: Local Predictability Beats Global Packing

Sparse placement is valid. The system should not globally compact the workspace because one object moved, resized, expanded, or collapsed.

Use the smallest reasonable local response.

## Law 6: Collision Ownership Must Be Explicit

Each interaction must declare its collision source:

- Single drag: snapped placeholder/footprint.
- Single resize: snapped resize preview.
- Group drag/resize: composite footprint.
- Divider drag: divider footprint.
- Expansion: expanded panel footprint.

Visual clones and decorative surfaces must not independently own collision.

## Law 7: Groups Behave As Composite Spatial Objects

During active group movement or resize, the selected set behaves as one spatial object for collision and reflow. Members keep their identity and relative geometry.

## Law 8: Navigation Must Not Mutate Layout

Scroll, anchor activation, focus, pan, zoom, and overview navigation do not change committed object placement.

## Law 9: Context Commits After Spatial Commit

Moving an object across a divider or into a panel may preview prospective context, but inherited context changes commit only after the final spatial action commits.

## Law 10: Pinned Means Direct Manipulation Lock

Pinned objects reject direct drag/resize. Pinning does not imply every future layout pressure rule unless the specific system defines it. Current direct collision rules still protect pinned reservations.

## Law 11: Geometry Must Be Shared

Rendered size, snapped footprint, collision footprint, and committed layout should derive from one authoritative geometry model per interaction.

Avoid parallel widget/panel/group math unless the object type truly differs.

## Law 12: Motion Preserves Mental Maps

Live ghosts can move freely. Snapped footprints can show final grid intent. Neighbor movement should be smooth and spatially explainable.

Avoid flicker, teleporting, jitter, clipped previews, stale artifacts, and layout popping.

## Law 13: Background Is Environment, Not Component Theme

There is one shared glass/component material system. User-selected background tones change the environment behind objects, not the material identity of widgets, panels, menus, buttons, anchors, or dividers.

## Law 14: Accessibility Is A Spatial Contract

Keyboard focus, reduced motion, accessible names, and state announcements must describe spatial effects clearly. Spatial systems should not become pointer-only.

