# Spatial Workspace Architecture

This directory defines the conceptual architecture for the transition from configurable dashboard builder to spatial workspace system.

These documents are not implementation tickets. They establish shared language, object boundaries, interaction laws, persistence expectations, and future sequencing before anchors, dividers, contextual inheritance, tabless navigation, and persistent spatial workflows are implemented.

## Documents

- `workspace-model.md`: Defines the workspace, regions, zones, coordinate spaces, and ownership boundaries.
- `object-taxonomy.md`: Defines widgets, panels, dividers, anchors, groups, regions, and future contextual objects.
- `contextual-inheritance.md`: Defines ambient context propagation, precedence, inheritance, overrides, and recomputation rules.
- `divider-system.md`: Defines Context Dividers and Spatial Context Zones as semantic boundaries.
- `anchor-system.md`: Defines Spatial Anchors as viewport-fixed navigation controls into the continuous workspace.
- `spatial-laws.md`: Defines the non-negotiable spatial and interaction laws for future systems.
- `object-lifecycle.md`: Defines creation, placement, movement, resize, grouping, reassignment, persistence, and destruction lifecycles.
- `persistence-rules.md`: Defines committed, temporary, inherited, and navigation state persistence boundaries.
- `navigation-philosophy.md`: Defines tabless, contextual, and spatial navigation direction.
- `interaction-philosophy.md`: Consolidates drag, resize, preview, material, grouping, density, and environmental UX principles.

## Core Thesis

The product is not becoming a set of pages, tabs, dashboards, or admin panels. It is becoming one persistent operating surface where objects occupy meaningful spatial positions, inherit local context, and can be revisited through spatial navigation.

Future systems should therefore add meaning to the workspace without breaking these foundations:

- One shared grid and occupancy model for spatial objects.
- One shared glass/component material system over user-selected backgrounds.
- Preview state, temporary displacement, committed layout, persisted layout, context state, and viewport/navigation state stay separate.
- Sparse placement is valid.
- Groups behave as composite spatial objects during transforms.
- Context inheritance is ambient and visible, not hidden modal configuration.
- Navigation moves through the workspace; it does not replace the workspace with tabbed pages.

## Current Implementation Foundation

The first implementation pass introduces shared workspace object metadata on the existing grid objects instead of adding a second interaction engine.

Current grid object records now carry:

- `data-workspace-object-type`: `widget`, `panel`, `divider`, or `anchor`.
- `data-workspace-context-model`: the context model version.
- `data-workspace-region-id`: the committed region membership derived from the grid.
- `data-context-scope-id`: the scope owned by divider objects.
- `data-context-inherited-from`: the region scope an object inherits from.
- `data-navigation-target-type` and `data-navigation-target-id`: early navigation hooks for anchors and dividers.

This is intentionally foundational. Divider and anchor objects reuse the existing shared grid, menu, drag, resize, pin, grouping, and persistence systems while gaining distinct semantic object identities. Future passes can move anchors to viewport-fixed records after navigation/camera ownership is implemented without changing the object taxonomy.
