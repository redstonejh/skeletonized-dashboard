# Divider System

## Purpose

Context Dividers are semantic workspace boundaries. They create Spatial Context Zones inside one continuous workspace.

They are not panels, tabs, folders, pages, tables, or content containers.

This document summarizes the divider role in the broader architecture. Detailed implementation planning lives in `docs/context-divider-architecture.md`.

## Definition

A Context Divider is:

- A grid occupant with a narrow reserved footprint.
- A visible spatial boundary.
- A region identity marker.
- A context-scope owner.
- A navigation target.

A Spatial Context Zone is the region produced by a divider and the next divider after it.

## Why Dividers Exist

Large workspaces need meaning beyond raw placement. Dividers let users create local semantic regions without leaving the continuous surface or switching to tabs.

They answer:

- What part of the workspace am I in?
- What context applies here?
- Where can I return later?
- Which objects belong together ambiently, not just through temporary selection?

## Difference From Panels

Panels:

- Contain or will contain content.
- Expand/collapse as content containers.
- Own panel controls and future child membership.

Dividers:

- Do not contain content.
- Do not become panel bodies.
- Define the context of nearby space.
- Act as landmarks and boundaries.

## Difference From Tabs

Tabs switch visible pages or sections. Dividers do not switch away from the workspace. They mark places inside the same workspace.

Navigation to a divider should scroll or focus the existing surface, not replace the view with a new page.

## Bounds Model

First implementation should use full-width row zones:

```text
Divider A at row 8
Zone A rows 8 through 19
Divider B at row 20
Zone B rows 20 through next divider
```

Object membership:

- Use committed top grid row as the initial membership anchor.
- Do not use live drag geometry for committed membership.
- Tall cross-zone objects can show future mixed-zone state, but first implementation should stay simple.

## Current Foundation

The first implementation creates dividers as distinct workspace objects with `data-workspace-object-type="divider"` while reusing the protected grid interaction system.

Current dividers:

- reserve one committed grid row;
- default to a full-width span;
- own a `contextScopeId` and matching `workspaceRegionId`;
- start a row-based workspace region for later objects in committed visual order;
- use existing drag, resize, menu, pin, grouping, and save/load paths;
- do not expose a panel body or content insertion surface.

This keeps dividers semantically separate from panels without creating a second layout engine.

## Interaction Expectations

Future divider interactions:

1. Create divider from explicit command.
2. Place at current viewport row, above selection, or a chosen target row.
3. Reserve a grid footprint.
4. Use local pushdown if the row is occupied.
5. Move vertically with live surface plus snapped footprint.
6. Recompute zone membership only on commit.
7. Delete by merging the zone into surrounding context.

Pinned item rule:

- Pinned objects remain hard reservations for direct layout movement.
- Divider insertion/movement must resolve around pinned objects or reject clearly.

## Visual Expectations

Dividers should be quiet glass boundaries:

- Full-width rail.
- Compact label pill.
- Optional icon/accent.
- Subtle inherited-context summary.
- Shared hover/focus/selected material language.

Avoid:

- Heavy section slabs.
- Folder/tab styling.
- Panel body placeholders.
- Debug outlines.

## Persistence

Persist:

- Divider id.
- Label, icon, accent.
- Committed grid row/span.
- Context scope id and context defaults.
- Navigation target metadata.

Do not persist:

- Hover state.
- Selected state.
- Drag preview row.
- Prospective zone membership.
- Temporary expansion pushdown.

## Relationship To Anchors

Spatial Anchors can target:

- Divider itself.
- Zone created by divider.
- Saved viewport within a zone.

If a divider moves, anchors should resolve by divider id. If deleted, anchors enter missing-target or relink state.

## Intentional Non-Goals

- No fake divider UI before real object semantics.
- No dividers as panels.
- No divider content body.
- No tab/page switching.
- No column-scoped zones until full-width zones are stable.
