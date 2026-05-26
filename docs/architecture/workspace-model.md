# Workspace Model

## Purpose

The workspace model defines what the application is becoming: a persistent spatial operating surface rather than a traditional dashboard page.

The current dashboard grid remains the foundation. Future systems should extend it with regions, dividers, anchors, context inheritance, and saved viewpoints without replacing deterministic placement with freeform ambiguity.

## Definitions

- `Workspace`: The full persistent operating surface. It owns global layout, background environment, profile state, object records, context records, anchor records, and future viewport/camera state.
- `Dashboard surface`: The current visible grid-backed workspace surface. Today this is the main implementation of the workspace.
- `Region`: A meaningful spatial interval inside the workspace. A region may be visual, semantic, or both.
- `Spatial Context Zone`: A region created by Context Dividers that can own inherited context defaults.
- `Viewport`: The currently visible window into the workspace.
- `Camera state`: Future pan, zoom, and focused-region state. Camera movement must not mutate committed layout.
- `Object`: A workspace entity with identity, behavior, and persistence semantics.
- `Context scope`: A boundary that owns inherited context values.
- `Engineer Underlay`: The recessed Engineer Mode plane for backend/dataflow widgets and explicit output-to-input signal routes. It is aligned with the presentation workspace but hidden in Normal Mode.

## Region Types

Regions can be introduced gradually. Do not implement every type at once.

| Region type | Visual? | Semantic? | Owner | Notes |
| --- | --- | --- | --- | --- |
| Global workspace | Yes | Yes | Workspace | Default fallback scope for all objects. |
| Divider zone | Yes | Yes | Context Divider | Main future region model. |
| Panel body | Yes | Yes | Panel | Future child widgets inherit panel context. |
| Group bounds | Yes | Optional | Group selection or future group record | Current groups are temporary selection transforms. |
| Saved viewport | No or subtle | Optional | Anchor or profile | Navigation state, not grid occupancy. |
| Focus region | Subtle | Optional | Viewport/camera state | Should not persist as layout unless explicitly saved. |
| Engineer Underlay | Yes in Engineer Mode only | Yes for explicit dataflow | Widget registry/dataflow graph | Backend widgets and dataflow wires live here; it must not replace ambient region context. |

## Spatial Relationship Model

Initial workspace regions should be row-based because the current grid is row/column based.

```text
Workspace
  row 1
  row 2    Widgets and panels
  row 8    Context Divider: "Planning"
  row 9    Zone: Planning
  row 20   Context Divider: "Review"
  row 21   Zone: Review
```

Recommended first rule:

- A full-width Context Divider starts a zone at its committed grid row.
- A zone extends until the next divider row.
- If there is no next divider, the zone extends to the end of workspace content.
- An object belongs to the zone containing its primary membership row, initially its top grid row.

Future column-scoped regions may exist, but only after full-width row zones are stable.

## Visual, Semantic, Or Both

Regions can carry two kinds of meaning:

- Visual structure: helps the user orient in space.
- Semantic structure: owns inherited context, navigation targets, labels, or metadata.

The first Context Divider implementation should be both visual and semantic. A divider should be visible enough to orient the user and semantic enough to define inherited zone context.

Avoid invisible semantic regions unless there is an explicit inspector or indicator. Hidden context boundaries will make the workspace feel arbitrary.

## Ownership Rules

- The workspace owns global state and profile-level persistence.
- The grid owns committed object placement and occupancy.
- Dividers own zone boundaries and zone context defaults.
- Panels own their own container state and future child scopes.
- Anchors own viewport-fixed control position and target resolution metadata.
- Context engine owns inherited and explicit context values.
- Camera/navigation state owns viewport position and future zoom.

No object should secretly own another system's state. For example:

- Anchor navigation must not mutate grid layout.
- Divider hover must not mutate context.
- Panel expansion must not persist temporary displacement as committed placement.
- Context inheritance must not be inferred from transient DOM geometry alone.

## Local And Global Context

Context should resolve from local to global:

1. Direct object context.
2. Panel context.
3. Group context, if persistent semantic groups are introduced.
4. Spatial Context Zone context.
5. Workspace/global context.

The workspace/global scope is the fallback, not the default place to put every control.

## Future Interaction Expectations

Regions should support:

- Navigation by Spatial Anchor.
- Subtle visual highlighting when focused.
- Deterministic context recomputation after committed movement.
- Local pushdown for inserted dividers.
- Stable save/load by id and committed coordinates.
- Reduced-motion navigation.

Regions should not:

- Behave like pages or tabs.
- Trigger global repacking.
- Change context permanently during hover or live preview.
- Hide object movement rules behind modal-only configuration.

## Open Questions

- Whether saved viewport regions are profile-scoped, workspace-scoped, or user-scoped.
- Whether column-scoped zones are needed before pan/zoom.
- Whether future persistent groups should create semantic context scopes by default or only when explicitly promoted.
- How much region summary information should be visible at overview zoom.

## Deferred Compact Workspace Mode

Compact Workspace Mode is a future responsive system, not a direct shrink of the current desktop workspace. It should define a separate constrained-viewport interaction contract with single-column layout behavior, collapsed chrome, simplified movement and resizing, compressed anchor rail or drawer behavior, responsive density scaling, and progressive disclosure.

This mode is intentionally deferred until desktop interaction laws, panel containment, context inheritance, widget runtime architecture, and large-workspace performance systems are stable.
