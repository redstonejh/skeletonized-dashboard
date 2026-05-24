# Pre-Overhaul Stabilization Roadmap

## Executive Summary

The configurable dashboard builder has evolved beyond a simple dashboard layout tool. It is becoming a spatial workspace system with direct manipulation, grouped object behavior, context inheritance, tabless navigation, floating spatial anchors, richer widgets, and future workspace intelligence.

That evolution increases interaction complexity nonlinearly. Drag, resize, grouping, collision, expand/collapse, persistence, hover states, theme polish, and toolbar behavior now interact with each other as one system. A small change in one path can affect visual continuity, layout determinism, or saved state elsewhere.

Before accelerating into the next major feature phase, the project needs a stabilization pass. The goal is not to freeze development or rewrite the app. The goal is to formalize the interaction laws, identify fragile state boundaries, reduce architectural drift, and make future systems depend on deterministic foundations.

Future work depends on a clear separation between:

- Live visual preview.
- Snapped spatial footprint.
- Temporary displacement.
- Committed layout.
- Persisted layout.
- Context state.
- Viewport/navigation state.

This roadmap defines the systems that must stabilize first, the risks to watch, the architectural rules to follow, and the readiness criteria for major overhaul work.

## Current Strengths

### Custom Interaction Engine

The project has a strong vanilla JavaScript interaction foundation. Drag, resize, pinning, grouping, collision previews, expand/collapse, persistence, and theme behavior are implemented without a heavy frontend framework. This keeps the app lightweight and gives the project fine control over motion and geometry.

### High UX Ambition

The dashboard is not only functional. It has a clear interaction personality: tactile, glassy, spatial, premium, and direct. The visual system treats jitter, flicker, clipping, misalignment, harsh outlines, and dark-mode drift as product bugs rather than cosmetic preferences.

### Drag Ghost Architecture

The drag system already distinguishes the lifted visual object from the snapped footprint and neighboring reflow. This is the correct direction for a spatial workspace: the user's hand follows a continuous object while the grid shows where the object will settle.

### Resize Preview Separation

The resize system has moved toward the same model as drag: live clone, snapped footprint, collision/reflow preview, and grid-aligned commit. This separation is essential for future direct manipulation and complex objects.

### Playwright Interaction Testing

The project has meaningful browser-level coverage for user-facing interaction behavior. Tests verify geometry, cleanup, persistence, hover/focus parity, drag/resize artifacts, group behavior, expand/collapse restoration, and theme states. This is a major asset.

### Group And Composite Interaction Progress

Grouped drag and resize have improved toward a composite-object model. The system now has concepts for group boundaries, group live surfaces, composite footprints, and member relationship preservation. This provides a foundation for future contextual grouping.

### Glass/Material Consistency

The UI has an established material language: translucent surfaces, restrained borders, soft shadows, compact controls, and theme-aware polish. This gives future systems a visual grammar to reuse instead of inventing one-off controls.

### Local Spatial Behavior Model

The dashboard generally favors local movement and sparse placement over global compaction. This respects user intent and helps the workspace feel spatial rather than mechanically auto-arranged.

### Expand/Collapse Accordion Philosophy

Panels expand by pushing affected lower content downward and collapse by relaxing temporary displacement. This accordion model is appropriate for a continuous dashboard because it preserves spatial continuity without switching views.

## Current Architectural Risks

### Interaction-State Coupling

Drag, resize, group mode, hover, focus, tools, body classes, preview artifacts, and persisted layout state can influence each other. Without stronger lifecycle boundaries, future features may accidentally leave stale state behind.

Risk signals:

- Body classes remaining after interrupted interactions.
- Source classes persisting after pointer cancellation.
- Hover menus activating underneath active interactions.
- Group state affecting normal single-item behavior.

### Stale Layout State

The app has several layout concepts that can temporarily diverge: DOM styles, dataset values, computed grid positions, snapshots, previews, saved layouts, and expansion baselines. Bugs appear when one path updates one representation but not the others.

Risk signals:

- Expand/collapse restoring to an intermediate state.
- Save/load preserving visual state but not underlying coordinates.
- Resize previews committing a different footprint than the one shown.

### Grouped Interaction Complexity

Grouped interactions are inherently harder than single-object interactions. They need to preserve member geometry, behave as one composite footprint, avoid per-member collision resolution, and commit back to individual grid items without drift.

Risk signals:

- Member fan-out during resize.
- Group drag using active item geometry instead of composite geometry.
- Neighboring items responding to members individually instead of the group footprint.

### Temporary Vs Committed Layout Ambiguity

Some interactions intentionally move neighbors temporarily. Others commit final layout. The boundary between temporary displacement and committed user intent must be explicit.

Risk signals:

- Collapse pushdown becoming permanent.
- Collision preview rewriting saved coordinates.
- Layout snapshots being captured after temporary displacement.

### Expand/Collapse Restoration Fragility

Expand/collapse is now linked to collision, row spans, group resize, saved height, local relaxation, and sparse placement. It is a high-risk system because it mutates vertical space without being a drag or resize.

Risk signals:

- Lower items stranded after collapse.
- Unrelated items repacked upward.
- Expanded heights becoming stale after resize.

### Order-Sensitive Tests

Browser tests that depend on default DOM order, exact initial positions, or persisted local storage may become fragile as the dashboard grows.

Risk signals:

- Tests passing alone but failing in suite order.
- Tests relying on broad selectors instead of stable item ids.
- Setup code manually mutating DOM state differently than app code.

### CSS Interaction-State Sprawl

The CSS now contains many state classes for active, selected, grouped, dragging, resizing, tools-open, collapsed, pinned, dark mode, custom color, and preview surfaces. Without consolidation, visual fixes may accumulate as late overrides.

Risk signals:

- Same visual state styled in multiple places.
- Dark mode needing separate emergency overrides.
- Generic resize styling overriding group-selected styling.

### Growing Collision/Reflow Complexity

Collision and reflow now support panels, widgets, pinned items, grouped footprints, sparse placement, accordion pushdown, and local restoration. The current model may become difficult to extend without clearer abstractions.

Risk signals:

- New features needing one-off collision paths.
- Group and single-item behavior diverging.
- Full-dashboard repacking used where local relaxation is intended.

### Global Vs Local Layout Recalculation

The workspace should preserve intentional empty space. Full-dashboard recomputation can erase spatial intent, while overly local computation can miss collisions. The system needs rules for when each scope is allowed.

Risk signals:

- Local changes causing hidden overlaps elsewhere.
- Global packing closing intentional gaps.
- Reflow behavior changing based on unrelated items.

### Event Listener Lifecycle Risks

Pointer interactions must clean up reliably on pointerup, pointercancel, Escape, blur, exceptions, and interrupted interactions. As features grow, duplicate listeners or incomplete teardown become more likely.

Risk signals:

- Interaction works once, then freezes.
- Refresh needed to restore pointer behavior.
- Duplicate handlers after save/load or DOM rebuild.

### Layout Determinism Concerns

The future workspace needs deterministic behavior. The same interaction should produce the same result from the same starting state.

Risk signals:

- Drop result depends on animation timing.
- Reflow result depends on DOM order accidentally.
- Saved layout differs from visual layout after reload.

## Systems That Must Stabilize Before Major Overhaul

### Drag System

Current status:

- Drag has a working ghost/placeholder model.
- Collision previews are reversible.
- Pinned items and sparse placement are protected by tests.
- Group drag now has a composite-footprint direction.

Remaining risks:

- Drag state may still depend on several body/item classes.
- Group and single drag paths need continued parity.
- Future spatial navigation must not interfere with drag.

Stabilization goals:

- One clear drag lifecycle from start to cleanup.
- Explicit separation between live ghost, snapped footprint, local reflow, and final commit.
- Deterministic target-cell resolution.
- Documented cancellation behavior.
- Reliable suppression of hover/tool interactions underneath drag.

Anti-patterns to avoid:

- Adding fallback drag handlers.
- Mutating committed layout during preview.
- Global compaction after ordinary drag.
- Letting navigation or floating controls react during drag.

### Resize System

Current status:

- Resize uses live clone and snapped footprint concepts.
- Left-edge anchored behavior exists internally.
- Widget, panel, and group resize have moved closer to shared lifecycle cleanup.

Remaining risks:

- Resize math can diverge between item types.
- Group resize has more geometry constraints than single resize.
- Collapsed panel expanded-footprint previews require careful alignment.

Stabilization goals:

- Resize lifecycle owned by one guard.
- Direct manipulation remains the main UX.
- Final commit always matches snapped preview.
- Live clone never becomes the committed state.
- Group resize uses the same preview language as individual resize.

Anti-patterns to avoid:

- Separate toolbar modes for every resize direction.
- Directly resizing committed elements during live movement.
- One-off conditionals for each widget type.
- Duplicate document-level listeners.

### Grouped Interactions

Current status:

- Group selection, group drag, and group resize have meaningful coverage.
- Composite footprints now drive surrounding layout more correctly.
- Visual state has been unified across selection, move, and resize.

Remaining risks:

- Group geometry preservation is sensitive to snap rounding.
- Composite collision can regress if member previews become collision sources again.
- Future contextual groups may add semantic state on top of spatial grouping.

Stabilization goals:

- Group behaves as one coherent spatial object during interaction.
- Member relative positions remain stable unless the operation intentionally resizes them.
- One composite footprint drives collision/reflow.
- Original members do not visually jump while live previews are active.
- Group state does not leak into normal item state.

Anti-patterns to avoid:

- Per-member collision resolution during group interaction.
- Scaling member offsets when spacing should be preserved.
- Debug-style group overlays.
- Parallel group engines.

### Expand/Collapse System

Current status:

- Expand pushes lower affected items downward.
- Collapse restoration now uses a layout-level baseline and local upward relaxation.
- Group-resize-related restoration bugs have been addressed.

Remaining risks:

- Nested expansions can create complex temporary displacement.
- Saved height, row span, and collapsed state must stay synchronized.
- Future context panels may add inherited state to expand/collapse.

Stabilization goals:

- Clear distinction between committed layout and temporary accordion displacement.
- Collapse only relaxes affected items upward when safe.
- No global auto-pack during collapse.
- Expanded footprint previews align with actual open footprint.
- Save/load persists stable collapsed layout, not temporary pushdown.

Anti-patterns to avoid:

- Capturing new baselines while already in temporary displacement.
- Treating expansion movement as user-committed drag.
- Repacking unrelated items on collapse.
- Hiding layout errors with timers.

### Collision/Reflow Engine

Current status:

- Ordered packing and local sparse placement exist.
- Pinned items reserve cells globally.
- Group composite footprints have been introduced.

Remaining risks:

- Collision logic spans multiple interaction paths.
- Local and global recomputation boundaries need formal rules.
- Performance may degrade on large dashboards.

Stabilization goals:

- One collision model for widgets and panels.
- Explicit APIs for local reflow, composite footprint reflow, and accordion relaxation.
- Pinned reservation handled consistently.
- Reflow previews are reversible.
- Final commit is deterministic.

Anti-patterns to avoid:

- Ad hoc collision checks inside pointer handlers.
- Full-dashboard compaction as a convenience.
- Treating previews and final commits as the same operation.
- Letting DOM order override explicit coordinates.

### Layout Persistence

Current status:

- Save/load/reset preserve a broad set of item state.
- Tests cover sparse placement, pinned items, collapsed state, and resized state.

Remaining risks:

- Future anchors, context links, profiles, widgets, and workspace state will expand persistence scope.
- Layout data can become overloaded if navigation/context state is stored as grid item state.

Stabilization goals:

- Stable schema boundaries between grid layout, widget config, context links, anchors, theme, and viewport state.
- Save only committed state.
- Load without implicit compaction.
- Reset/default paths clearly separated from normal restore paths.
- Missing/deleted object handling is deterministic.

Anti-patterns to avoid:

- Storing viewport anchors as grid items.
- Inferring layout from DOM order after explicit coordinates exist.
- Saving temporary interaction state.
- Frontend-only permission or sharing semantics.

### Selection State Model

Current status:

- Single selection, group selection, hover, focus, and tool-open states coexist.
- Group selected visuals are more consistent than before.

Remaining risks:

- Selection may become overloaded once context inheritance and anchors arrive.
- Active interaction state can conflict with selected state.
- Focus and hover styles can imply selection incorrectly.

Stabilization goals:

- Distinguish selected, focused, hovered, active, grouped, context-source, and context-target states.
- Selection state has one owner.
- Group selection is reversible and does not mutate layout.
- Keyboard and pointer selection remain consistent.

Anti-patterns to avoid:

- Encoding semantic context only through CSS classes.
- Treating hover as selection.
- Letting tools-open imply active selection.
- Duplicating selection state across DOM and data without sync rules.

### Visual Interaction States

Current status:

- Visual language is strong and improving.
- Drag, resize, group, hover, and focus surfaces have more parity.

Remaining risks:

- CSS override accumulation.
- Dark mode drift.
- State-specific borders/shadows diverging.
- Toolbar and floating controls may compete visually.

Stabilization goals:

- Shared visual tokens for selected, active, preview, ghost, disabled, pinned, and missing states.
- One visual language for panels, widgets, groups, anchors, and future context badges.
- Light and dark parity.
- No layout shift from hover/focus/active states.

Anti-patterns to avoid:

- Late high-specificity overrides for every bug.
- Black/debug outlines.
- Hover effects that resize controls.
- Theme-specific fixes that bypass tokens.

### Theme System

Current status:

- Light and dark modes have strong custom polish.
- Background palettes and glass surfaces are configurable.
- Recent work improved scrollbar/root background continuity.

Remaining risks:

- Theme variables may be applied too deep instead of at true root/scroll containers.
- New widgets may hard-code colors.
- Floating anchors and context states will need theme-aware tokens.

Stabilization goals:

- Root/page/container backgrounds are clearly owned.
- Theme tokens support future navigation, context, and anchor states.
- Light mode remains slate-neutral and premium.
- Dark mode remains cinematic without neon drift.
- Theme transitions do not cause layout shift.

Anti-patterns to avoid:

- Hardcoded white/black surfaces.
- Per-component color patches.
- Gradients or effects that do not inherit theme.
- Theme fixes that create scrollbars or gutters.

### Navbar/Control Surface Architecture

Current status:

- The top surface is moving toward quiet workspace chrome rather than a bulky toolbar.
- Future docs reject conventional tab navigation.
- Spatial Anchors provide a future tabless navigation direction.

Remaining risks:

- Navbar may become overcrowded.
- Layout/profile controls may be mistaken for tabs.
- Future feature controls could compete with dashboard content.

Stabilization goals:

- Navbar remains global command chrome.
- No tab-shaped primary navigation.
- Creation, layout, theme, group, context, and future anchor controls have clear hierarchy.
- Floating controls do not block dashboard interaction.
- Control surfaces share material language.

Anti-patterns to avoid:

- Page/tab metaphors.
- Dense command islands.
- Equal-weight controls for every feature.
- Placeholder UI that implies unfinished navigation models.

## Interaction Doctrine

### Movement Should Feel Spatial

Users should feel that objects occupy real places in a continuous workspace. Dragging, resizing, grouping, expanding, and navigating should preserve mental maps.

### Snapping Should Assist, Not Dominate

The grid provides structure and final alignment. It should not make live movement feel rigid, delayed, or disconnected from the pointer.

### Prefer Local Movement Over Chaotic Reflow

Interactions should affect the smallest reasonable area. Local collision and accordion behavior preserve intent better than global repacking.

### Separate Preview From Committed State

Live previews, snapped footprints, local reflow, and final layout commits must remain distinct. This principle protects cancellation, visual continuity, and persistence.

### Groups Behave As Composite Entities

Grouped objects should preserve relative geometry and participate in collision/reflow through one composite footprint. Members resolve back to individual items only on commit.

### Continuity Matters

Interaction continuity is more important than raw implementation simplicity. Avoid visible jumps, edge teleporting, stale ghosts, flicker, and abrupt state changes.

### No Invisible State Changes

If layout, context, selection, or navigation state changes, the user should have a visible reason. Silent repacking and hidden persistence mutations erode trust.

### Deterministic Layout Behavior

The same starting state and interaction should produce the same final state. Timing, animation frames, pointer event order, and DOM order should not change outcomes unexpectedly.

### Local Predictability Over Global Auto-Pack

Sparse space is valid. Empty grid cells may be intentional. The system should not compact the dashboard unless the user explicitly requests that behavior.

## Architectural Rules For Future Development

- Avoid duplicate interaction systems.
- Avoid layered fallback logic that hides root causes.
- Avoid accumulating CSS overrides to compensate for unclear state ownership.
- Prefer centralized lifecycle ownership for pointer interactions.
- Prefer explicit state models over inferred DOM state.
- Prefer transform-based live movement and grid styles for settled layout.
- Preserve separation between visual preview and committed layout.
- Avoid full-dashboard recomputation when a local operation is intended.
- Never save temporary preview or displacement state.
- Do not let hover or focus become the source of layout truth.
- Do not let navigation controls activate during protected drag/resize/group interactions.
- Keep widgets and panels in one shared occupancy model unless a future architecture explicitly changes the world model.
- Preserve pinned item guarantees.
- Keep layout behavior deterministic before adding intelligent/adaptive behavior.
- Add Playwright coverage before changing protected interaction mechanics.
- Document new interaction laws when behavior changes.

## Planned Major Future Systems

### Context Inheritance

Purpose:

- Allow panels, groups, widgets, and regions to pass context to children or linked targets.
- Make filtering and semantic relationships understandable in the spatial workspace.

Architecture concerns:

- Context state must be separate from layout state.
- Context inheritance must be deterministic and inspectable.
- Visual indicators must explain inherited vs explicit context.
- Context propagation must not depend on hover or transient selection.

Prerequisites:

- Stable selection model.
- Stable panel/widget identity.
- Clear context source and target visual states.
- Persistence boundaries for context links and layout profiles.

### Floating Spatial Anchors

Purpose:

- Provide tabless navigation through viewport-fixed spatial bookmarks.
- Let users return to panels, groups, regions, contexts, or saved viewport positions inside one continuous dashboard.

Architecture concerns:

- Anchor position is viewport-relative.
- Anchor target is world/grid-relative.
- Anchors must not be grid items.
- Anchor navigation must not interfere with drag/resize.
- Missing-target behavior must be explicit.

Prerequisites:

- Stable target identity.
- Stable scroll container and navbar offset model.
- Suppression rules during interactions.
- Separate persistence payload.

### Tabless Navigation

Purpose:

- Keep the dashboard as one continuous operating surface.
- Avoid page/tab switching as the primary mental model.

Architecture concerns:

- Navbar must stay minimal.
- Layout/profile controls must not become tabs.
- Navigation should be spatial, contextual, and continuous.

Prerequisites:

- Spatial workspace doctrine.
- Spatial Anchors plan.
- Stable viewport navigation and scroll behavior.

### Semantic Panel Relationships

Purpose:

- Let panels express parent/child, context scope, dependency, or logical relationship without changing core grid behavior.

Architecture concerns:

- Semantic relationships should not be inferred only from placement.
- Relationships must survive move/resize.
- Visual lines/badges should not block interactions.

Prerequisites:

- Context model.
- Engineer Mode or relationship editing mode.
- Stable object ids and persistence.

### Contextual Grouping

Purpose:

- Let groups represent both spatial selection and semantic context where appropriate.

Architecture concerns:

- Spatial group interaction and semantic group meaning must be separable.
- Temporary group selection should not automatically create persistent semantic groups.
- Group context inheritance must be explicit.

Prerequisites:

- Stable group interaction behavior.
- Selection state model.
- Group persistence model if persistent groups are introduced.

### Workspace Intelligence

Purpose:

- Assist with navigation, layout suggestions, context hints, and relationship discovery.

Architecture concerns:

- Intelligence must not silently rearrange the workspace.
- Suggestions should be reversible and user-approved.
- Determinism matters more than cleverness.

Prerequisites:

- Stable interaction laws.
- Explicit committed state model.
- Undo/history model.
- Clear separation between suggestions and applied changes.

### Adaptive Dashboard Density

Purpose:

- Let panels and widgets adjust internal density based on size, content, and future zoom level.

Architecture concerns:

- Minimum footprints should be based on the smallest usable adaptive layout, not the most spacious visual state.
- Dense widgets should exhaust compact spacing, adaptive padding, intelligent wrapping, and condensed control modes before escalating their required grid span.
- Density changes must not shift controls unexpectedly.
- Header/control geometry should remain stable unless intentionally designed.
- Density state should not corrupt saved layout.

Prerequisites:

- Stable size tokens.
- Regression coverage for header/control metrics.
- Theme-aware density rules.

### Future Widget Ecosystem

Purpose:

- Support richer generic widgets without duplicating layout, interaction, or theme behavior.
- Keep panels as containers and model tables, menus, notes, charts, calendars, and similar content as widgets or content components.

Architecture concerns:

- Widget registry should define capabilities, default size, min size, context behavior, and renderer requirements.
- Widgets should not implement their own grid interaction systems.
- Complex widgets may need internal scrolling or virtualization.
- No future widget type should become an inherent panel type.

Prerequisites:

- Widget capability schema.
- Shared layout integration.
- Context binding model.
- Performance guidelines.

### Saved Workspace States

Purpose:

- Save and restore not just layout, but future context, anchors, profile settings, theme, and viewport state.

Architecture concerns:

- Each state type needs a clear owner.
- Temporary state must not be persisted.
- Missing objects and version migrations must be deterministic.

Prerequisites:

- Persistence schema boundaries.
- Versioned payloads.
- Round-trip tests.

### Multi-Workspace/Profile Architecture

Purpose:

- Support multiple saved configurations, future workspace sharing, and profile-level state.

Architecture concerns:

- Profiles must not become tabs.
- Shared workspaces will require server-side permission enforcement.
- Layout, anchors, context, and user preferences may have different scopes.

Prerequisites:

- Profile schema clarity.
- Server-side access-control plan before collaboration features.
- Deterministic load/reset behavior.

## Performance Roadmap

### Likely Future Bottlenecks

- Pointermove hot paths during drag and resize.
- Collision checks across many widgets/panels.
- Group interaction geometry calculations.
- DOM reads and writes inside the same frame.
- Paint cost from shadows, backdrop filters, masks, and translucent surfaces.
- Large table/widget rendering.
- Playwright runtime as the suite grows.

### Drag/Resize Hot Paths

Rules:

- Batch DOM reads before writes.
- Avoid broad DOM queries per pointermove.
- Cache stable geometry at interaction start.
- Use transforms for live movement.
- Update grid styles only for snapped previews or final commits.
- Keep pointermove handlers small and predictable.

### Collision Scaling

Future collision work should prepare for larger dashboards:

- Use explicit item geometry arrays instead of repeated DOM reads.
- Separate pinned reservation maps from movable item maps.
- Keep local collision scopes where possible.
- Use composite footprints for grouped objects.
- Avoid O(n^2) scans where a spatial index or occupancy map is enough.

### Paint And Render Concerns

The visual language uses glass, shadows, and blur. These effects must be managed carefully.

Rules:

- Avoid changing expensive shadows on every frame.
- Prefer opacity/transform for live motion.
- Keep live clones lightweight.
- Avoid animating layout properties during pointer movement.
- Limit backdrop-filter usage on high-frequency moving surfaces.

### Large Dashboard Scaling Risks

As dashboard size grows:

- Offscreen widgets may still cost layout/paint.
- Smooth scroll may involve large surfaces.
- Collision maps may grow.
- Context links and anchors may add overlay complexity.

Potential future strategies:

- Viewport-aware rendering for heavy widget internals.
- Lightweight offscreen placeholders for expensive widgets.
- Region-level geometry caches.
- Optional minimap/overview rendering that does not duplicate full DOM.
- Deferred visual effects for offscreen or inactive regions.

### Interaction Performance Rules

- No pointermove path should depend on network or storage.
- No interaction preview should wait on persistence.
- Avoid layout reads after style writes in the same frame.
- Prefer requestAnimationFrame for batched visual updates when needed.
- Do not solve performance issues with arbitrary delays.

### Playwright Runtime Strategy

- Keep full suite mandatory before completing user-facing changes.
- Use targeted slices during development.
- Group expensive visual screenshot tests thoughtfully.
- Avoid fragile waits where deterministic events or state assertions are possible.
- Keep manual smoke scripts for high-risk visual systems.

## Testing Strategy

### Development Slices

During active work, run targeted tests for the touched system:

- Drag tests for drag/collision changes.
- Resize tests for resize/preview changes.
- Group tests for group behavior.
- Expand/collapse tests for accordion behavior.
- Theme/visual tests for CSS and material changes.
- Persistence tests for save/load changes.

### Full Suite

Run the full suite before considering the task complete:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

### Playwright Philosophy

Playwright tests should verify what users see and experience:

- Geometry.
- Visibility.
- Cleanup of live artifacts.
- Absence of stale classes.
- Final committed layout.
- Persistence after reload.
- Theme parity.
- Reduced flicker and no overlap.

DOM existence alone is not enough for interaction systems.

### Visual Regression Importance

Visual regressions are product regressions. Screenshot or computed-style assertions should cover:

- Drag and resize previews.
- Group boundaries.
- Hover/focus states.
- Light and dark material parity.
- Scrollbar/root background seams.
- Header/icon/control alignment.
- Future anchors and context badges.

### Deterministic Setup

Tests should:

- Start from known app state.
- Clear relevant storage.
- Use stable selectors and item ids.
- Avoid depending on incidental DOM order when explicit coordinates exist.
- Avoid manual DOM mutation unless testing a precise isolated CSS/layout condition.

### Flaky-Test Prevention

- Prefer state assertions over fixed sleeps.
- Use short waits only for known animation settling.
- Keep pointer movement deterministic.
- Assert cleanup after interrupted interactions.
- Avoid depending on animation timing for final state.

### Manual Verification

Manual checks remain required for high-risk visual changes:

- Light and dark mode.
- Hover/focus/active.
- Drag and resize feel.
- Group interaction feel.
- Expand/collapse motion.
- Toolbar/menu layering.
- Mobile viewport behavior.
- No console/network errors.

### Future Stress Testing

Add stress scenarios over time:

- Large dashboard with many widgets/panels.
- Many pinned items.
- Many grouped objects.
- Repeated drag/resize cycles.
- Nested expand/collapse cycles.
- Save/load after complex interactions.
- Anchor navigation during large scroll distances.
- Context propagation across many linked objects.

## UI/Visual System Goals

### Light Mode

Light mode should feel like a premium workspace, not a white web form.

Direction:

- Slate-neutral backgrounds.
- Restrained glass.
- Subtle depth.
- Readable contrast.
- Quiet hover/focus states.
- No washed-out one-note palette.

### Dark Mode

Dark mode should feel cinematic and calm.

Direction:

- Deep contrast.
- Soft glass surfaces.
- Non-neon accents.
- No harsh white rings.
- No muddy low-contrast panels.
- No black/debug overlays.

### Global Visual Goals

- Coherent hover logic.
- Unified material language.
- Consistent control surfaces.
- Spatial hierarchy between dashboard content, chrome, overlays, and previews.
- Stable icon/control sizing across states.
- No layout shift caused by visual states.
- Theme-aware future anchors, context badges, and relationship indicators.

## Refactor Candidates

### Collision Engine

Likely future need:

- Consolidate local reflow, composite footprint resolution, pinned reservations, and accordion relaxation behind clearer APIs.

Desired outcome:

- Less pointer-handler logic.
- More deterministic geometry helpers.
- Easier testing of collision behavior without full UI setup.

### Group Interaction Abstraction

Likely future need:

- Make group drag/resize consume the same preview/footprint lifecycle as single items through a common abstraction.

Desired outcome:

- No parallel group engine.
- Composite behavior remains first-class.
- Member geometry preservation is explicit.

### Layout State Ownership

Likely future need:

- Define a clearer state owner for committed grid coordinates, temporary displacement, previews, snapshots, and persisted payloads.

Desired outcome:

- Fewer stale layout bugs.
- Easier future profile/context/anchor persistence.

### Dropdown Layering System

Likely future need:

- Rationalize menus, popovers, tool drawers, theme pickers, anchor controls, and future context menus.

Desired outcome:

- Consistent z-index.
- No clipping.
- No blocked dashboard interactions.
- Theme parity.

### Interaction Lifecycle Cleanup

Likely future need:

- Central lifecycle manager for pointer interactions.

Desired outcome:

- One cleanup path for pointerup, pointercancel, Escape, blur, exceptions, and interruption.
- No duplicate listeners.
- Clear suppression rules for hover/menu/nav.

### CSS State Architecture

Likely future need:

- Consolidate state classes and visual tokens.

Desired outcome:

- Less selector sprawl.
- Fewer dark-mode emergency overrides.
- Shared selected/active/preview/ghost/missing state styling.

### Selection/Active State Coordination

Likely future need:

- Formal state model for hover, focus, selected, active interaction, group-selected, context source, context target, and anchor target.

Desired outcome:

- Future context inheritance and anchor navigation do not overload existing selection behavior.

## Overhaul Readiness Checklist

Major overhaul work should wait until these are true:

- Grouped interactions are deterministic.
- Group drag and resize preserve member relationships.
- Group composite footprints drive collision/reflow.
- Expand/collapse restoration is stable after normal and grouped interactions.
- Collision system has clear local/global rules.
- No stale drag/resize/group classes remain after interrupted interactions.
- Drag/resize cleanup is reliable on pointerup, pointercancel, Escape, blur, and exceptions.
- Layout persistence round-trips exact committed state.
- Temporary displacement is never saved as committed layout.
- Pinned item guarantees remain covered.
- Selection state is clearly separated from hover/focus/context state.
- Visual state tokens are coherent across light and dark themes.
- Navbar architecture is stabilized as global workspace chrome.
- No conventional tab architecture has been introduced.
- Spatial Anchors architecture is documented before implementation.
- Performance pass has reviewed pointer hot paths.
- Playwright suite is stable and not order-sensitive.
- Interaction lifecycle is documented.
- Layout persistence schema boundaries are documented.
- Manual verification checklist is current.
- New feature work has clear prerequisites and test strategy.

## Long-Term Vision

The dashboard is evolving into a spatial workspace system.

It should become:

- A persistent operating surface.
- A context-aware environment.
- A tabless navigation model.
- A low-friction interaction ecosystem.
- A composable workflow canvas.
- A premium direct-manipulation workspace.

The long-term experience should emphasize:

- Spatial intuition.
- Continuity.
- Contextual intelligence.
- Environmental UX.
- Deterministic interaction behavior.
- User-owned layout intent.
- Smooth movement through one continuous workspace.

The product should not become a pile of pages, tabs, modal forms, and disconnected widgets. It should feel like one coherent workspace where panels, widgets, groups, context, navigation anchors, and future intelligence all share the same spatial laws.

The next overhaul phase should therefore begin only after the current interaction foundation is stable enough to carry that weight.
