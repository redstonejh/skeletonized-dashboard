# Persistence Rules

## Purpose

Persistence must preserve the workspace as a deterministic operating surface. As anchors, dividers, context scopes, zones, and saved viewports arrive, saved state must stay explicit and scoped.

## State Categories

| Category | Persist? | Examples |
| --- | --- | --- |
| Committed layout | Yes | grid row/col/span, saved panel height, collapsed state |
| Object config | Yes | title, type, data binding, capabilities, color/accent |
| Context state | Yes | explicit links, panel context, zone context, active committed filters |
| Anchor state | Yes | target id, viewport position, fallback snapshot |
| Viewport/camera state | Maybe | saved viewport anchors, profile restore point |
| Preview state | No | ghosts, placeholders, live clones |
| Temporary displacement | No | expand pushdown, collision preview movement |
| Interaction state | No | hover, focus, menus open, active drag |

## Persistence Boundaries

Recommended future payload boundaries:

```text
Workspace/Profile
  layoutItems
  objectConfigs
  contextScopes
  contextLinks
  dividers
  anchors
  savedViewports
  environment/background
```

These may be stored together physically at first, but code should keep their ownership clear.

## Current Foundation

The current localStorage-backed layout records persist workspace object metadata alongside existing widget/panel placement records:

- workspace object type;
- dashboard object kind;
- workspace region id;
- context scope id;
- context role;
- navigation target type/id.

This does not make inherited context a new persisted layout source. Region membership is recomputed from committed grid order and divider scopes, then saved as explicit metadata for deterministic reload and early test coverage.

## Layout Rules

Persist:

- Stable object id.
- Object type.
- Grid column/row/span.
- Row span or saved height.
- Pinned/locked/resizable capabilities.
- Collapsed state.
- Order only when needed as deterministic tie-breaker.

Do not persist:

- DOM order as the only layout source after explicit coordinates exist.
- Preview placeholder coordinates.
- Temporary expansion displacement as the new baseline.
- Auto-scroll runway height.

## Context Rules

Persist:

- Context scopes.
- Context values that represent committed user choices.
- Explicit links.
- Divider zone context defaults.
- Panel-attached context.

Do not persist:

- Prospective context during drag.
- Hover-derived context.
- Focus-only context.
- Context implied only by transient CSS classes.

Inherited context may be recomputed from committed records rather than duplicated everywhere. If cached inherited context is stored for performance, it must be invalidated deterministically.

## Anchor Rules

Persist separately from grid layout:

- Anchor id.
- Viewport position.
- Target type/id.
- Target snapshot fallback.
- Alignment.
- Scope.
- Context metadata.
- Pin/lock state.

Anchor records must survive target movement by resolving by id. If the target is deleted, the anchor enters missing-target state.

## Save/Load Determinism

Save/load must:

- Restore exact committed layout.
- Preserve sparse gaps.
- Preserve pinned state.
- Preserve divider rows and zone identity.
- Preserve anchors independently from grid occupancy.
- Recompute inherited context from committed state.
- Avoid implicit compaction.

If saved state is invalid:

- Repair deterministically.
- Prefer explicit user-visible repair states over silent scrambling.
- Never hide errors with timers or retries.

## Session Vs Profile

Some future state may be session-scoped:

- Current viewport scroll/camera.
- Temporary selected object.
- Open inspector.

Some should be profile/workspace-scoped:

- Layout.
- Dividers.
- Anchors if intended as workspace navigation.
- Context scopes and links.
- Environment/background.

This scope decision must be explicit per feature.
