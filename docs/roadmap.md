# Roadmap

## Current Milestone: Stable Generic Dashboard Builder

Status: Active baseline.

The app currently provides a generic configurable dashboard shell with theme-aware glass styling, configurable panels/widgets, drag, resize, pinning, sparse placement, group mode, layout save/load/reset, settings, and automated browser coverage.

Maintain this as the stable foundation while planning the next major version.

## Next Major Version: Context-Aware Visual Analytics Workspace

Goal: turn the dashboard builder into a context-aware composition system while preserving the existing visual identity and stack.

Core outcomes:

- Users create widgets from the GUI.
- Widgets and panels are universal dashboard objects.
- Panels provide inherited context to child widgets.
- Stats can filter tables and graphs.
- Widgets can bind to generic datasets, field mappings, transformations, aggregations, and computed values.
- Timeframe widgets emit reusable timeframe context.
- Search widgets emit scoped keyword context.
- Users can attach context to panel headers through direct manipulation.
- Engineer Mode enables explicit visual wiring.
- Top toolbar and timeframe command surface support the expanded workspace.
- Long-term navigation evolves toward a continuous spatial workspace instead of tab-based segmentation.
- Long-term collaboration evolves through secure authentication, RBAC, workspace sharing, and object-level permissions.

## Phase 1: Documentation And Planning

Status: In progress.

Deliverables:

- `docs/product-vision.md`
- `docs/widget-system.md`
- `docs/context-system.md`
- `docs/engineer-mode.md`
- `docs/grid-system.md`
- `docs/visual-language.md`
- `docs/engineering-guidelines.md`
- `docs/testing.md`
- `docs/bug-report.md`
- `docs/roadmap.md`

Exit criteria:

- Implementation phases are documented.
- Non-negotiables are documented.
- No application code has changed for feature work yet.

## Phase 2: Neutral Data Model And Widget Registry

Deliverables:

- Neutral models for dashboard, panel, widget, widget type, widget config, layout profile, grid item, and theme preset.
- Widget registry with defaults, capabilities, renderers, config schemas, and default sizes.
- Current placeholder widgets migrated to registry-backed rendering.
- Timeframe Widget registry entry with configurable presets, labels, ranges, refresh behavior, compact/dropdown/segmented layouts, min size, and context capabilities.
- Search Widget registry entry with contextual placeholder text, clear/reset action, compact glass capsule rendering, searchable field bindings, and context capabilities.
- Existing dashboard UI preserved.

Exit criteria:

- Current tests pass.
- Existing visual output remains stable.
- No domain-specific labels or APIs are introduced.

## Phase 3: Context Engine

Deliverables:

- Generic context engine.
- Panel context scopes.
- Stat emitted context.
- Timeframe emitted context.
- Search emitted context.
- Table and graph filter bindings.
- Local demo-data query path for shared filtering and aggregation.
- Context badges, inherited indicators, active filter indicators, and clear controls.
- Header/chevron context attachment for stat widgets.

Exit criteria:

- Stat click filters table and graph.
- Panel context affects child widgets.
- Clearing context restores content.
- Context behavior is deterministic and tested.
- Widget filtering and aggregation use shared query logic instead of widget-specific hard-coding.

## Phase 4: Engineer Mode

Deliverables:

- Engineer Mode toolbar toggle.
- Source and target connection handles.
- Link creation gesture.
- Link rendering overlay.
- Link selection and deletion.
- Context link persistence.

Exit criteria:

- Links can be created, deleted, saved, loaded, and used for context propagation.
- Normal mode hides wiring visuals while keeping links active.
- Link routes update after layout changes.

## Phase 5: Toolbar And Command Surface

Deliverables:

- Expanded top toolbar with dashboard selector, profile selector, save/load/default/undo, add widget, add panel, Engineer Mode, theme controls, and settings. Context visualizations live behind Engineer Mode rather than a separate Context View toggle.
- Timeframe widget evolved into a command surface with grouped glass control clusters, preset pills, active timeframe capsule, utility controls, and context/status indicators.
- Search widget rendered as a compact contextual glass capsule, not a default input.

Exit criteria:

- Visual language matches the existing dashboard.
- No hard-coded blue.
- Default/deep backgrounds and at least two background presets are verified by screenshots.

## Phase 6: Stabilization And Test Expansion

Deliverables:

- Full Playwright coverage for layout, panels, context, Engineer Mode, visual regression screenshots, settings, mobile behavior, console errors, and network errors.
- Updated bug report.
- Updated roadmap.

Exit criteria:

- All tests pass.
- Known bugs are documented with status.
- Visual regressions are addressed or explicitly deferred.

## Future Phase: Spatial Workspace / Infinite Canvas

Goal: evolve the dashboard into a continuous, zoomable, Apple-glass workspace while preserving grid predictability.

Deliverables:

- Canvas camera model for pan, zoom, focus, and overview state.
- Region-aware grid coordinates that preserve snap, occupancy, sparse placement, and pinned reservations.
- Smooth pan/zoom/focus transitions.
- Overview and detail zoom levels with intelligent density changes.
- Spatial panel/context containers with visible inherited context.
- Engineer Mode link routing that remains correct under pan, zoom, and region collapse.
- Optional mini-map, breadcrumbs, or focus indicators.

Exit criteria:

- Pan and zoom do not break grid alignment.
- Drag/resize/ghost previews remain precise at multiple zoom levels.
- Context badges and inherited indicators remain understandable at overview and detail levels.
- Engineer Mode links remain spatially coherent.
- Primary navigation does not require tabs.

See `docs/spatial-workspace.md`.

## Future Phase: Authentication, Permissions, And Sharing

Goal: evolve the dashboard into a secure multi-user workspace platform with role-aware interaction and collaborative workspace management.

Deliverables:

- Local username/password authentication.
- OAuth2 and SSO provider adapter architecture.
- Secure session or token pipeline.
- Workspace ownership and membership model.
- RBAC with Admin, Editor, Viewer, and future custom roles.
- Object-level permissions for widgets, panels, context scopes, spatial regions, and Engineer Mode links.
- Workspace sharing and invite flows.
- Server-side permission enforcement for every mutation and sensitive read.
- Audit/history foundation for layout, workspace, context, and permission changes.

Exit criteria:

- Viewer cannot mutate layout, widgets, links, data sources, or permissions.
- Editor can edit allowed workspace objects without managing users by default.
- Admin can manage workspace permissions and sharing.
- Unauthorized API calls are rejected server-side.
- Auth and permissions UI matches the Apple-glass visual language.
- Workspace restore preserves layout, context, permissions, collaborators, theme, and background state.

See:

- `docs/authentication-system.md`
- `docs/permissions-model.md`
- `docs/workspace-sharing.md`
- `docs/security-guidelines.md`

## Future Ideas

- More graph renderers if they can be added without visual drift.
- Universal data source adapter system.
- Visual query builder and field mapping.
- Safe computed fields and formulas.
- Configurable timeframe preset libraries.
- Saved search presets and scoped search tokens.
- Query cache and refresh policies.
- Streaming/live data sources after static queries are stable.
- Import/export dashboard profiles.
- Keyboard movement and resize shortcuts.
- Multi-select context actions.
- Read-only presentation mode.
- More advanced link routing.
- Spatial canvas overview and region navigation.
- Context-based camera focus.
- Collapsible workspace regions.
- Role-aware workspace controls.
- Share workspace and invite collaborator flows.
- Object-level permission indicators.
- Workspace audit/history timeline.
- Optional data adapters, kept neutral and outside the core visual system.

## Deferred

- Full node editor.
- Production external data connector framework.
- Collaborative editing.
- Complex formula language.
- Domain-specific templates.

Deferred items should not leak into current architecture as half-built concepts.
