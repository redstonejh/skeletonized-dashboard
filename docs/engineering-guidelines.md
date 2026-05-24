# Engineering Guidelines

This dashboard builder is visually sensitive and interaction-driven. Maintainability, behavioral consistency, and polish are product requirements, not cleanup preferences.

## Core Principles

- Preserve the existing visual language and dominant interaction patterns.
- Prefer surgical fixes over broad rewrites.
- Treat flicker, jitter, clipping, layout jumps, and inconsistent motion as bugs.
- Document risky systems before modifying them.
- Add or update browser tests for user-facing interaction changes.
- Keep state, rendering, and movement calculations understandable enough to debug.

When modifying complex systems:

1. Reproduce the behavior.
2. Isolate the source.
3. Write or update a test.
4. Apply the smallest correct fix.
5. Run regression tests.

## Next Major Version Guardrails

The next major version is a context-aware visual analytics workspace, not a new app. Preserve FastAPI, Jinja, vanilla JavaScript, SQLite where useful, and the existing CSS architecture.

- Do not introduce React, Vue, Tailwind, or a new visual framework.
- Do not add IT, security, alert, incident, client, mailbox, vendor, scanner, webhook, escalation, threat, severity, or scoring language.
- Do not hard-code the current blue theme.
- Keep the current Apple-glass dashboard personality.
- Treat widgets, panels, context panels, and command surfaces as universal dashboard objects unless explicitly locked.
- Keep grid behavior deterministic, sparse, reversible during preview, and committed only at interaction end.
- Keep context propagation deterministic and testable.
- Add new systems behind small modules rather than scattered event listeners.

Recommended next-version frontend modules:

- `dashboard-state.js`
- `widget-registry.js`
- `widget-renderer.js`
- `panel-controller.js`
- `grid-engine.js`
- `drag-controller.js`
- `resize-controller.js`
- `context-engine.js`
- `filter-engine.js`
- `data-source-registry.js`
- `query-engine.js`
- `computed-field-engine.js`
- `transform-pipeline.js`
- `engineer-mode.js`
- `link-renderer.js`
- `persistence.js`
- `toolbar-controller.js`

Recommended future platform modules:

- `auth-service.py`
- `session-service.py`
- `permission-service.py`
- `workspace-membership-service.py`
- `audit-log-service.py`
- `sharing-service.py`

## CSS Architecture

- Keep selector specificity shallow and predictable. Avoid long descendant chains unless matching existing dashboard control patterns.
- Do not solve cascade conflicts by adding stronger selectors. Remove dead/duplicated rules or move the rule to the correct layer.
- Use existing tokens for colors, spacing, radius, shadows, motion, and z-index. Add a token only when the same value is reused and has a clear system meaning.
- Keep transition timing and easing consistent with `--motion-fast`, `--motion-grid`, and `--motion-popover`.
- Manage stacking through z-index tokens only: header, dropdown, popover, modal, drag ghost, and resize handle.
- Preserve spacing rhythm between top bar, widget rows, panel grid gaps, tool drawers, popovers, and placeholders.
- Responsive overrides should change layout constraints, not invent alternate visual systems.
- Avoid duplicated rules. If the same selector appears in multiple files, confirm the later rule is a real material or interaction override.
- Avoid `!important`. Keep existing `!important` only where it protects an established interaction state.
- Animations must not cause text jumps, hover resizing, accidental reflow, or transform-origin shifts.

## Dashboard And Grid Systems

- Dashboard movement is order-based. Drag and resize must use the ordered-slot packer instead of per-item physics or ad hoc collision negotiation.
- Panels are generic layout containers. Tables, menus, notes, charts, calendars, and similar experiences are widgets or panel content, not inherent panel identities.
- Treat committed grid coordinates as the source of visual placement. DOM order may support persistence and rendering, but it must not override explicit user placement.
- Widgets and panels share one dashboard occupancy map. Do not resolve widget movement separately from panel movement when they render into the same dashboard grid.
- Sparse placement is valid. Do not compact, collapse, or repack intentional empty grid space during ordinary drag and resize interactions.
- During drag, the active item may use fixed positioning as the lifted object, but surrounding items should reflow through placeholder order and transform animation.
- During resize, preview size and neighboring item positions should be calculated from the same ordered packer that commits the final layout.
- Pointer tracking, ordered layout calculation, visual preview, and final persistence must stay separate.
- Drag state, resize state, ghost state, and group-selection state must be explicit and reversible.
- Keep collision logic and snap calculations isolated from DOM rendering where possible.
- Do not update persisted layout until the interaction completes successfully.
- Ghost previews must use the same grid math as final placement.
- Resize previews and release snapping must agree on columns, rows, and minimum sizes.
- Widget and panel minimum sizes must be calibrated to the smallest usable adaptive layout, not the most spacious layout. Dense controls should first reduce gaps, padding, text footprint, and wrapping before requiring a larger grid span.
- Use transforms for temporary movement. Commit final position through grid styles/state.
- Minimize reflow during pointer movement. Avoid reading layout after writing styles in the same loop.
- Keep animation synchronization consistent between the dragged item, placeholders, peers, and collision-reflowed items.
- Avoid arbitrary timers for movement correctness. If a frame delay is needed to suppress a browser click after pointer movement, keep it local to that event handoff and document why.
- Pinned items must block direct move/resize behavior consistently across widgets, panels, and group mode.
- Pinned items reserve their grid cells globally during direct drag, resize, group, and drop interactions. Other direct interactions must route around pinned cells and must never push, swap, overwrite, or reflow them.
- Panel expand/collapse is layout pressure, not direct manipulation. Expansion may temporarily displace pinned items in the panel footprint, but collapse must restore them to the captured expansion baseline and save/load must preserve that baseline.
- Collapsed panels must keep layout state, height, row span, and aria state synchronized.
- Save/load/reset must restore custom items, hidden items, colors, titles, spans, pin state, collapsed state, and grid position without desynced UI.

## JavaScript Architecture

- Avoid hidden global state. Shared state should have clear ownership and reset paths.
- Do not duplicate interaction logic between panels and widgets unless the behavior is intentionally different.
- Isolate movement calculations, collision resolution, and snap math into small helpers.
- Separate rendering from state mutation. Build DOM, apply state, then initialize behavior in clear phases.
- Avoid DOM-query spaghetti. Prefer scoped queries from the relevant layout, panel, widget, or control root.
- Avoid timing hacks for race conditions. If a timeout is needed for animation cleanup, document the state it protects.
- Event listeners should have narrow scope, predictable teardown, and no accidental cross-feature coupling.
- Do not let tool drawers, popovers, or menus implicitly control unrelated dashboard state.
- Keep localStorage keys centralized and versionable enough to change safely later.

For the context-aware version:

- Keep widget registry definitions separate from widget rendering.
- Keep context propagation separate from filter application.
- Keep data adapters separate from widget rendering.
- Keep query execution separate from visual field-mapping controls.
- Keep formulas sandboxed; never evaluate arbitrary JavaScript from user input.
- Keep source credentials and secrets out of browser-visible payloads.
- Keep Engineer Mode link drawing separate from context state.
- Keep toolbar command handling separate from persistence.
- Never let DOM hover state become the source of truth for context, layout, or links.

For the multi-user version:

- Never rely on frontend hiding for permissions.
- Enforce workspace, role, object, data source, and Engineer Mode permissions server-side.
- Keep session/auth logic separate from dashboard rendering.
- Keep permission evaluation centralized and testable.
- Treat Viewer mode as read-only at the API layer, not just the UI layer.
- Do not expose credentials, provider secrets, refresh tokens, or data source secrets to the browser.
- Auth, sharing, and permissions UI must reuse the existing glass controls and avoid generic admin styling.
- Read `docs/authentication-system.md`, `docs/permissions-model.md`, `docs/workspace-sharing.md`, and `docs/security-guidelines.md` before implementing auth or collaboration.

## Performance

- Minimize layout thrashing during drag and resize.
- Batch reads before writes when pointer movement needs geometry.
- Use transforms for live movement and grid styles for settled layout.
- Throttle or debounce expensive work such as overflow title recalculation, resize handling, and broad DOM scans.
- Avoid unnecessary box-shadow, filter, and backdrop changes during high-frequency movement.
- Keep hover effects stable so they do not trigger layout recalculation.
- Prefer class toggles over repeated inline style churn when the value is state-like.

## Polish Standards

- Maintain pixel alignment for grid columns, placeholders, icons, tool buttons, and resize handles.
- Preserve consistent motion feel across hover, drag, resize, popover, modal, and background transitions.
- Preserve visual rhythm in panel padding, widget spacing, header controls, and empty states.
- Treat flicker, jitter, clipping, subpixel drift, and accidental scrollbars as defects.
- Tool drawers and menus must layer above panels without clipping or blocking unrelated controls.
- Icons must remain centered in fixed-size controls at desktop and mobile widths.
- Text should not overflow, collide, wrap awkwardly, or shift controls during interaction.

## Refactoring Rules

- Prefer deleting dead or duplicated code over adding compensating overrides.
- Avoid rewrites unless the existing system cannot be made reliable with a contained change.
- Preserve the existing API, class names, and visual behavior unless a confirmed bug requires change.
- Refactor one risk area at a time: CSS cascade, grid math, storage, interaction state, or rendering.
- Keep fallback behavior and reset behavior intact before changing advanced interactions.
- Before touching drag, resize, collision, group mode, or layout persistence, read the current implementation and update tests around the behavior being changed.

## Required Validation

For user-facing interaction changes, run:

```powershell
.venv\Scripts\python.exe -m pytest
```

Also manually inspect any changed interaction for:

- Shared material behavior across default and deep background tones
- Desktop and mobile viewport behavior
- Hover stability
- Drag and resize smoothness
- Ghost-preview alignment
- Popover/menu layering
- Console and network errors
