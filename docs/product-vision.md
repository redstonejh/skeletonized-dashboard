# Product Vision

## Purpose

The next major version turns the configurable dashboard builder into a context-aware visual analytics workspace. The product should still feel like the current dashboard: Apple-glass inspired, tactile, polished, spatial, and built around direct manipulation.

This is not a redesign and not a stack replacement. Preserve FastAPI, Jinja templates, vanilla JavaScript, SQLite where useful, and the existing CSS architecture.

## Product Concept

Users compose dashboards visually:

- Create widgets from the GUI.
- Place widgets anywhere on the grid.
- Group widgets inside collapsible panels.
- Treat panels as layout containers, not as table, notes, menu, chart, or calendar identities.
- Model tables, notes, menus, charts, calendars, and similar content as widgets or panel content.
- Link widgets and panels through generic context.
- Let stats filter tables, graphs, calendars, and panels.
- Let panels provide inherited context to child widgets.
- Bind widgets to generic datasets, field mappings, transformations, aggregations, and computed values.
- Use Engineer Mode to wire context visually when automatic inheritance is not enough.
- Eventually share secure multi-user workspaces with role-aware collaboration.

The experience should feel like a polished creative workspace, not a generic enterprise analytics tool.

## Design Principles

- Preserve the current glass surfaces, rounded pill controls, soft shadows, translucent gradients, compact rhythm, and theme-aware colors.
- Keep direct manipulation first. Dragging, resizing, linking, and dropping should do the obvious thing without forcing modal forms.
- Treat every visible dashboard object as spatial. Objects occupy grid cells, preserve placement intent, and can participate in context.
- Let the workspace become spatial over time. Future navigation should favor a continuous zoomable canvas over tab-based segmentation.
- Let collaboration and permissions feel contextual, elegant, and spatially integrated rather than enterprise-heavy.
- Make advanced behavior discoverable but quiet. Context badges, connection handles, and link lines should be subtle.
- Let data configuration become progressively powerful without turning the product into a SQL editor or form-heavy BI tool.
- Prefer polish over feature count. Jitter, flicker, clipping, hard-coded colors, and misaligned controls are product bugs.

## Normal Mode

Normal Mode is the default composition and usage surface.

- Widgets and panels display their content.
- Context links remain active but wiring visuals are hidden.
- Users can add, move, resize, pin, rename, recolor, collapse, delete, save, load, and reset.
- Context indicators show enough information to explain filtered content.
- Common context actions, such as clearing an active filter, remain available.

## Engineer Mode

Engineer Mode is an advanced visual wiring mode.

- Widgets and panels expose connection handles.
- Users create explicit context links between sources and targets.
- Links are drawn with subtle theme-aware lines.
- Selected links can be deleted.
- Context propagation stays active after Engineer Mode is turned off.

Engineer Mode should feel native to the dashboard, not like a separate node editor bolted on top.

## Non-Goals

- Do not introduce React, Vue, Tailwind, or a new frontend framework.
- Do not introduce domain-specific IT, security, alert, incident, client, vendor, mailbox, or scanner concepts.
- Do not hard-code the current blue theme.
- Do not replace the current visual language with a generic analytics or BI aesthetic.
- Do not rebuild the whole app before isolating and testing the systems being changed.

## Implementation Plan

### Phase 1: Documentation And Planning

- Create and maintain this vision doc.
- Create system docs for widgets, context, Engineer Mode, grid behavior, visual language, testing, and roadmap.
- Document non-negotiables before coding begins.

### Phase 2: Neutral Object And Widget Foundation

- Refactor toward neutral models: `Dashboard`, `Panel`, `Widget`, `WidgetType`, `WidgetConfig`, `LayoutProfile`, `GridItem`, `ThemePreset`.
- Create a widget registry that maps widget types to renderers, config schemas, default sizes, and capabilities.
- Normalize all visible dashboard objects into the universal object model.
- Preserve existing layout, theme, top bar, menus, panel controls, and grid behavior.

### Phase 3: Context Engine

- Add generic context models: `ContextScope`, `ContextValue`, `ContextLink`, and `FilterBinding`.
- Implement emitted context from stat widgets.
- Implement inherited panel context for child widgets.
- Implement table and graph filtering from active context.
- Add context badges, inherited indicators, linked indicators, active filter indicators, and clear actions.
- Establish a local query path for demo data so filters, mappings, and aggregations do not become widget-specific logic.

### Phase 4: Engineer Mode

- Add an Engineer Mode toggle to the toolbar.
- Expose source and target handles on context-capable objects.
- Draw persistent context links between objects.
- Support selecting and deleting links.
- Persist links with layout/profile data.

### Phase 5: Toolbar And Command Surface

- Redesign the top toolbar within the existing glass/pill/button language.
- Add dashboard selector, layout/profile selector, save/load/default/undo, add widget, add panel, Engineer Mode, theme controls, and settings. Context visualizations should appear through Engineer Mode rather than a separate Context View toggle.
- Evolve the timeframe widget into a dashboard command surface with grouped glass control clusters, range presets, active timeframe capsule, utility controls, and status/context indicators.

### Phase 6: Validation And Stabilization

- Expand Playwright coverage for widgets, panels, context propagation, Engineer Mode, visual screenshots, layout persistence, and mobile behavior.
- Update `docs/bug-report.md` after every discovered issue.
- Keep `docs/roadmap.md` current with completed, active, deferred, and future work.

### Future Phase: Universal Data Source And Query Layer

- Add configurable data sources through neutral adapters.
- Add widget data bindings for datasets, fields, filters, transformations, aggregations, and display formatting.
- Add a safe computed-field/formula system.
- Keep normal users in visual configuration flows and advanced users in progressive formula/query tools.
- See `docs/data-source-query-layer.md`.

### Future Phase: Spatial Workspace / Infinite Canvas

- Evolve the dashboard from a traditional page/grid into a continuous pan-and-zoom workspace.
- Keep grid-based placement and occupancy rules for predictability.
- Let users zoom out for workspace overview and zoom in for detailed widget interaction.
- Make panels, groups, context scopes, and Engineer Mode links spatially coherent.
- Avoid tab-based organization as the primary navigation model.
- See `docs/spatial-workspace.md`.

### Future Phase: Authentication, Permissions, And Sharing

- Add secure local accounts, OAuth2/SSO provider adapters, and optional future MFA.
- Add workspace ownership, memberships, invitations, and role-aware collaboration.
- Add RBAC with Admin, Editor, Viewer, and future custom roles.
- Add object-level permissions for widgets, panels, context scopes, spatial regions, and Engineer Mode links.
- Enforce permissions server-side on every mutation and sensitive read.
- Keep auth, sharing, and permissions UI visually integrated with the Apple-glass workspace.
- See `docs/authentication-system.md`, `docs/permissions-model.md`, `docs/workspace-sharing.md`, and `docs/security-guidelines.md`.

## Success Criteria

- The dashboard still looks and feels like the current app.
- Users can build a dashboard from the GUI without domain-specific concepts.
- Context filtering works through stat widgets, panels, and explicit links.
- Widgets can eventually derive display values from neutral data bindings instead of hard-coded content.
- Engineer Mode makes context flow visible and editable.
- Future spatial navigation preserves grid precision, context visibility, and visual polish without requiring tabs.
- Future multi-user access preserves workspace integrity through secure sessions, server-side permissions, and deterministic restore.
- Every major interaction is tested.
- Future contributors can add widgets without duplicating grid, context, rendering, or styling logic.
