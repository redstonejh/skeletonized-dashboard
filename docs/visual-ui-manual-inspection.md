# Visual UI Manual Inspection

## Purpose

This document defines the required verification workflow for any visual, styling, layout, animation, hover/focus, theme, glass-material, navbar, widget, panel, menu, or interaction-feel change.

Automated tests, computed style assertions, screenshots, traces, and videos are useful evidence. They are not enough by themselves for visual/UI work.

## Core Rule

For any UI or visual task, Codex must perform a manual browser inspection before calling the work complete.

The goal is to confirm that the result feels correct in the product, not only that the DOM, CSS values, or screenshots match expectations.

## Required Workflow

1. Run the app locally.
2. Open the affected page or workspace in a real browser.
3. Interact with the changed UI directly.
4. Inspect all affected states that matter for the change: normal, hover, focus, active, open, closed, disabled, dragging, resizing, menu, popover, or dialog states.
5. Compare the result against the intended design, material, layout, motion, and interaction behavior.
6. Check both light/custom backgrounds and dark custom backgrounds when visual styling is involved.
7. Confirm the result visually feels correct, not merely that automated assertions pass.

## What To Look For

Visual/UI work is not complete if the result is:

- Ugly, incoherent, or inconsistent with the project material language
- Too bright, too glowy, too saturated, or too flat
- Jumpy, flickery, jittery, or misaligned
- Clipped, overlapped, or layered incorrectly
- Detached from the glass material system
- A different visual language from nearby widgets, panels, controls, menus, or navbar surfaces
- Technically passing tests but visibly wrong in the browser

## Evidence

Playwright screenshots, visual artifacts, computed style checks, traces, and videos may support the inspection, but they do not replace manual judgment in the browser.

Style assertions can prove that specific CSS values are present. They cannot prove that the UI feels right.

Passing tests does not complete a visual/UI task if the browser result is visually wrong.

## Final Response Requirement

For every visual/UI task, the final report must include a section titled:

```md
Manual browser inspection
```

That section must state:

- What page or workspace was opened
- What UI elements were inspected
- What states were manually tested
- What backgrounds or themes were checked
- Whether the result visually matches the requested behavior
- Any remaining visual concerns

## If Inspection Cannot Be Performed

If manual browser inspection cannot be performed:

- Do not claim the visual work is fully verified.
- Explicitly say why inspection was not performed.
- List exactly what was verified instead.
- Mark visual judgment as a remaining risk.

## Relationship To Automated Tests

This requirement adds to the existing automated test contract. It does not weaken or replace Playwright, unit, screenshot, trace, or regression test requirements.

Visual/UI changes still need the appropriate automated coverage and the required project test commands.
