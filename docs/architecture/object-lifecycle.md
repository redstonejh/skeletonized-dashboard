# Object Lifecycle

## Purpose

This document defines the common lifecycle stages for workspace objects. The goal is to make future systems predictable without forcing all object types into the same implementation class.

## Lifecycle Overview

```text
Define -> Create -> Place -> Interact -> Commit -> Persist
                         |        |
                         |        +-> Cancel restores baseline
                         |
                         +-> Preview states are temporary
```

## 1. Definition

Each object type declares:

- Type id.
- Purpose.
- Capabilities.
- Default footprint.
- Minimum footprint.
- Context capabilities.
- Persistence shape.
- Visual role.
- Navigation role.

Undefined capabilities must be treated as disabled, not guessed from DOM shape.

## 2. Creation

Creation should:

- Require explicit user intent.
- Assign stable id.
- Assign object type.
- Choose initial grid/viewport placement.
- Resolve collisions locally.
- Initialize context scope only if the object type owns one.
- Persist only after committed creation.

Do not create fake placeholders for future object types without real semantics unless the task explicitly asks for a menu placeholder.

## 3. Placement

Grid occupants:

- Widgets, panels, dividers, and future grid objects use committed grid coordinates.

Viewport objects:

- Anchors use viewport position plus target references.

Placement must preserve sparse intent and avoid global repack.

## 4. Movement

Movement lifecycle:

1. Capture committed baseline.
2. Create live visual surface if needed.
3. Create snapped footprint.
4. Preview local displacement.
5. Commit final grid position on release.
6. Cleanup previews and live surfaces.
7. Recompute context if committed position changed.

Cancellation restores baseline.

## 5. Resize

Resize lifecycle:

1. Capture baseline geometry.
2. Create live resize clone.
3. Create snapped resize footprint.
4. Reflow neighbors from snapped footprint.
5. Commit final size on release.
6. Cleanup clone/preview.
7. Recompute context only if membership rules require it.

Resize must not make visual clone geometry the committed source of truth.

## 6. Grouping

Current grouping:

- Temporary multi-selection.
- Composite transform during interaction.
- Member layout persists individually after commit.

Future persistent grouping:

- Explicit group record.
- Membership persists separately from item layout.
- Semantic context only if explicitly enabled.

## 7. Contextual Reassignment

An object changes inherited context when committed spatial membership changes or when explicit context links/scopes change.

Examples:

- Widget dropped into another zone.
- Panel moved across divider.
- Divider moved and zone membership recomputed.
- Context link added or removed.

Live preview may show prospective context but does not commit it.

## 8. Persistence And Save/Load

Persistence writes durable state:

- Object id/type.
- Committed placement.
- Size.
- Config.
- Pin/lock state.
- Context records.
- Anchor target/viewport records.

Load must reconstruct the same committed state without inferring from incidental DOM order when explicit coordinates exist.

## 9. Destruction

Deletion should:

- Require explicit intent.
- Remove object record.
- Remove or repair context links.
- Handle anchors targeting the deleted object.
- Avoid moving unrelated objects unless an explicit cleanup action requests it.

Divider deletion merges or recomputes zones. Anchor deletion does not affect grid layout.

## Temporary Interaction States

Temporary states include:

- Hover.
- Focus.
- Selected.
- Tools open.
- Live drag clone.
- Live resize clone.
- Snapped placeholder.
- Expanded-footprint ghost.
- Auto-scroll runway.
- Temporary expansion displacement.
- Prospective context preview.

These states must not be saved as committed layout.

