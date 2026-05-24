# Contextual Inheritance

## Purpose

Contextual inheritance lets objects receive meaning from where they live in the workspace. It should make the workspace feel ambient, local, and obvious instead of forcing users through hidden configuration menus.

Context is generic state: filters, selected values, categories, timeframe, search terms, object focus, or future semantic metadata. It must remain product-neutral.

## Core Principle

Context inheritance follows committed spatial relationships, not transient UI states.

Do:

- Recompute inherited context after committed movement, resize, creation, deletion, save/load, or explicit context edits.
- Show inherited context with subtle material indicators.
- Let local context override inherited context through a documented precedence order.

Do not:

- Change committed context on hover.
- Persist prospective drag-preview context.
- Infer durable context from temporary displacement.
- Hide inherited context only inside a settings modal.

## Context Sources

Possible sources:

- Workspace/global context.
- Spatial Context Zone context from dividers.
- Panel context.
- Future persistent group context.
- Explicit context links.
- Direct widget selection or local widget state.
- Timeframe/search widgets.

## Precedence

Recommended first precedence:

1. Direct widget/object local context.
2. Explicit wired context.
3. Panel context.
4. Future persistent group context.
5. Spatial Context Zone context.
6. Workspace/global context.

Local always beats ambient. Explicit always beats inherited.

## Spatial Propagation

```text
Workspace context
  |
  +-- Zone A context from Divider A
        |
        +-- Panel context
              |
              +-- Widget inherited context
        |
        +-- Widget inherited zone context
```

Objects inherit from the nearest applicable committed scope. If an object moves to a new zone, inherited context updates only after drop/commit.

## Local Vs Inherited Properties

| Property kind | Example | Owner | Persisted where |
| --- | --- | --- | --- |
| Local context | Widget selected category | Widget/context engine | Object or context record |
| Explicit wired context | Widget A filters Widget B | Context link | Context links |
| Panel context | Panel timeframe pill | Panel scope | Panel/context scope |
| Zone context | Divider-defined region default | Divider scope | Divider/context scope |
| Global context | Workspace-wide timeframe | Workspace scope | Workspace/profile |
| Prospective context | Drag preview over another zone | Preview only | Not persisted |

## Region-Scoped Behavior

Spatial Context Zones should behave like ambient context scopes:

- Objects in the zone inherit zone values.
- Panels in the zone inherit and can pass values to future children.
- Local overrides remain visible.
- Moving across a divider recomputes inherited context after commit.
- A group spanning zones enters a mixed-zone state unless future rules explicitly define a shared override.

## Conflict Handling

Conflicts should be deterministic and inspectable.

Example:

- Zone provides `{ timeframe: this_week }`.
- Panel provides `{ timeframe: last_30_days }`.
- Widget local selection provides `{ timeframe: today }`.

The widget uses `today`, shows local override state, and can expose inherited values in an inspector or tooltip.

## Visual Expectations

Context should feel:

- Ambient.
- Spatial.
- Local.
- Subtle.
- Explainable.

Recommended indicators:

- Small glass badges.
- Inherited context dots or pills.
- Quiet accent threads.
- Context path tooltip.
- Overview-level region summaries.

Avoid:

- Modal-only context configuration.
- Loud neon badges.
- Hidden inherited state.
- Page/tab metaphors.

## Recompute Triggers

Recompute inherited context after:

- Item drop commit.
- Resize commit, if membership rules depend on footprint.
- Divider creation, movement, deletion, or save/load.
- Panel context change.
- Explicit link creation/deletion.
- Workspace/profile load.
- Object deletion.

Do not recompute committed context from:

- Hover.
- Focus alone.
- Live drag position.
- Live resize clone geometry.
- Temporary expansion displacement.

## Testing Direction

Future tests should verify:

- Moving a widget into another zone updates inherited context after drop.
- Drag preview can show prospective context without committing it.
- Save/load restores inherited context from committed layout and context records.
- Local context overrides zone context.
- Panel context overrides zone context for children.
- Deleting a divider merges or recomputes affected zone context deterministically.

