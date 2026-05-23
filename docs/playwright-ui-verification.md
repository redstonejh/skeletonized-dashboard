# Playwright UI Verification

## Purpose

The dashboard relies heavily on visual interaction quality, animation, drag/resize previews, theme consistency, and spatial behavior that unit tests alone cannot verify.

Passing pytest is not sufficient proof that dashboard interactions visually work as intended.

DOM existence alone is not considered a successful interaction implementation.

This workflow defines what must be verified manually, what must be covered by Playwright, when screenshots are required, and how to avoid regressions where an element exists in the DOM but the user experience is still broken.

## Verification Principles

- Verify behavior as a user sees it, not only internal state.
- Prefer Playwright assertions that measure geometry, visibility, style, and motion outcomes.
- Pair automated interaction tests with manual inspection for high-risk visual changes.
- Confirm changed JS and CSS are actually loaded by the browser when debugging visual behavior.
- Remove temporary console logs, version markers, or debug overlays before final validation.
- Keep committed grid state, preview state, and final persistence separate in tests and implementation.

## Frontend Cache Verification

When testing JavaScript or CSS interaction changes:

- Always hard refresh with `Ctrl+Shift+R`.
- Or open DevTools and enable `Disable cache` while testing.
- Verify updated assets are loaded before evaluating behavior.
- Interaction regressions must be verified visually, not only through DOM existence or automated assertions.
- Add temporary visible debug markers when validating drag/resize preview systems.
- Remove temporary debug markers before final validation.

## Resize Interaction Parity

Resize must feel like drag: direct, continuous, and visually separated from the snapped grid result.

Verify:

- A `.dashboard-live-resize` clone is visible during resize.
- The live clone follows raw pointer delta continuously.
- A `.dashboard-resize-preview` footprint remains in the grid.
- The snapped footprint represents the grid size and placement that will commit.
- Sub-grid pointer movement changes the live clone but does not change the snapped footprint.
- Crossing a grid threshold changes the snapped footprint smoothly.
- Left-edge resize keeps the original right boundary anchored while the live clone and snapped footprint grow or shrink toward the left.
- Mouseup commits the snapped size, not the freeform clone size.
- The source item is not visually teleporting or covering the live clone.
- Collision and reflow preview are driven by the snapped footprint, not the freeform clone.
- The resize ghost has nonzero width and height, correct top/left, visible opacity, and correct z-index.

Playwright coverage should assert:

- Start resize.
- Capture live clone and snapped footprint dimensions.
- Move pointer by 5-10 px.
- Assert live clone width or height changed by roughly that pointer delta.
- Assert snapped footprint width or height did not change yet.
- Move past a grid threshold.
- Assert snapped footprint changes.
- Release pointer.
- Assert the source item commits to a valid grid-aligned span and row span.
- For left-edge resize, assert the committed column changes, the span changes, and `column + span` preserves the original right boundary.

## Drag Interaction Parity

Drag behavior is the baseline for dashboard direct manipulation.

Verify:

- The active item moves freely with the pointer.
- A blue dashed/grid placement footprint appears underneath.
- The snapped placement footprint transitions smoothly between valid grid slots.
- Collision preview is reversible until drop.
- Neighbor movement during preview does not become committed state unless the drop commits it.
- Pinned items remain hard reservations.
- Collapsed panels show a secondary expanded-footprint ghost while dragging.
- The collapsed expanded-footprint ghost is informational only and does not affect occupancy, snapping, collision, or persistence.

Playwright coverage should assert:

- Drag creates the expected placeholder footprint.
- Pointer movement updates the dragged item independently from the snapped footprint.
- Collision preview does not persist after cancel or alternate drop.
- Collapsed panel drag creates a body-level expanded-footprint ghost with no grid/placeholder classes.

## Expand And Collapse Behavior

Expand/collapse changes vertical footprint and must preserve spatial intent.

Verify:

- Expanding a panel pushes affected lower items downward when needed.
- Expanding does not relocate unrelated items sideways.
- Collapse restores the compact footprint.
- Saved height and row span stay synchronized.
- Collapse and expand do not corrupt sparse placement.
- Menus and resize handles remain aligned after state changes.

Playwright coverage should assert:

- Capture item positions before expand.
- Expand a collapsed panel.
- Assert lower affected items move down when required.
- Assert same-row unrelated items do not shift sideways unexpectedly.
- Collapse again.
- Assert compact row span is restored.
- Assert no overlaps are visible.

## Theme Verification

Theme regressions are visual bugs.

Verify in light and dark mode:

- Dashboard surfaces remain visible and readable.
- Borders are subtle but visible.
- Dark mode does not reintroduce neon or electric blue outlines.
- Hover, focus, active, and open states are consistent between panels and widgets.
- Resize/drag placeholders, live clones, ghosts, menus, and toolbar controls remain visible.
- Text and icons maintain contrast.

Visual regression screenshots are required when changes affect:

- Global tokens
- Theme overrides
- Dashboard surface borders or shadows
- Toolbar/nav controls
- Drag, resize, placeholder, or ghost styling
- Menus, popovers, dialogs, or settings surfaces

## Toolbar And Nav Verification

The top nav must feel connected to the dashboard, not like detached browser chrome.

Verify:

- The toolbar is readable in light mode.
- The toolbar is readable in dark mode.
- Controls share the dashboard glass language.
- Hover and focus feedback are visible but restrained.
- Menus open above the dashboard and are not clipped.
- Theme toggle, background controls, layout slot controls, add menu, reset/undo/group controls, status, and settings remain usable.

Playwright coverage should assert both behavior and visual state:

- Menu open/close behavior.
- Theme toggle state.
- Layout slot dropdown visibility.
- Add menu visibility and options.
- Computed backgrounds, borders, and shadows for key chrome elements.

## Motion Quality Standards

Dashboard movement should feel fluid, tactile, and spatially coherent.

Standards:

- Pointer-following motion should be continuous.
- Snapping should occur in the logical/grid preview layer, not as visual teleportation.
- Drag and resize should feel like members of the same interaction system.
- Ghost previews must match final drop or commit results.
- Preview movement must not flicker, jitter, clip, or leave stale artifacts.
- Transitions should use existing grid timing and easing.
- Hover-only controls should not activate underneath active drag or resize.
- The user should be able to distinguish the freeform visual preview from the snapped grid result.

## Required Playwright Tests

Required examples for interaction-sensitive changes:

```python
def test_resize_sub_grid_motion(page):
    # Start resize.
    # Move pointer less than one grid cell.
    # Assert live clone changed by raw pixels.
    # Assert snapped footprint did not change.
    # Move past threshold.
    # Assert snapped footprint changed.
    # Release and assert grid-aligned commit.
```

```python
def test_drag_footprint_transitions(page):
    # Start drag.
    # Assert freeform dragged item moves with pointer.
    # Assert grid placeholder exists and stays grid-aligned.
    # Move across slots and assert footprint transitions.
```

```python
def test_collapse_expand_pushdown(page):
    # Capture positions.
    # Expand collapsed panel.
    # Assert vertical pushdown and no sideways relocation.
    # Collapse and assert restored compact footprint.
```

```python
def test_theme_interaction_screenshots(page):
    # Capture light and dark screenshots for dashboard,
    # toolbar, drag/resize preview states, and menus.
```

```python
def test_interaction_state_screenshots(page):
    # Capture active drag, active resize, collision preview,
    # collapsed expanded-footprint ghost, and snapped footprint states.
```

## Manual QA Checklist

Before closing a dashboard interaction or visual bug, manually check:

- Resize feel: live preview changes smoothly with small pointer movement.
- Resize footprint: snapped blue footprint changes only at grid thresholds.
- Resize commit: final size lands on valid grid units.
- Drag feel: active object follows pointer freely.
- Drag footprint: snapped placement preview is visible and grid-aligned.
- Collision behavior: neighbors preview predictably and do not persist incorrectly.
- Ghost preview visibility: drag ghosts, resize clones, and collapsed expanded-footprint ghosts are visible and layered correctly.
- Expand/collapse: panels push down vertically when needed and do not relocate sideways unexpectedly.
- Light mode inspection: surfaces, borders, toolbar, ghosts, and text remain readable.
- Dark mode inspection: no neon borders, harsh blue halos, or white rings return.
- Toolbar readability: top nav controls are visible, cohesive, and interactive.
- Browser cache: hard refresh and confirm changed JS/CSS are loaded when debugging.

## Closing Criteria

A dashboard UI change can be considered verified only when:

- Playwright covers the user-visible behavior, not just DOM existence.
- Manual inspection confirms the interaction feels correct.
- Screenshots are captured for visual-risk changes when appropriate.
- Full tests pass with `.venv\Scripts\python.exe -m pytest -q`.
- Any temporary debug logs, markers, or visual overlays are removed.
