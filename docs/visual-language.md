# Visual Language

## Source Of Truth

The current dashboard UI is the visual source of truth. Future work must preserve the existing Apple-glass inspired design language: translucent surfaces, soft gradients, rounded pill controls, compact spacing, subtle shadows, tactile hover states, and token-driven color.

Do not create a new aesthetic for the next major version.

## Core Traits

- Apple-glass inspired
- Tactile
- Polished
- Spatial
- Direct-manipulation first
- Calm, compact, and precise
- Consistent across preset colors and background tones

## Material Rules

- Use existing CSS tokens and shared material variables.
- Do not hard-code blue.
- New glass surfaces must inherit the shared material system.
- Background tones must not create alternate component material systems.
- Deep backgrounds should feel like the same glass objects over a darker environment, not cyberpunk, gaming UI, neon HUD, or electric terminal styling.
- Depth should come from layered translucency, blur, shadow hierarchy, subtle gradients, and soft inner highlights, not bright glowing outlines.
- Borders should act as material rims. Avoid high-alpha electric blue strokes, saturated outer halos, and RGB-like edge lighting.
- White or near-white foreground treatment is appropriate on theme-tinted glass controls when contrast requires it.
- Avoid browser-default input styling in dashboard controls.
- Keep accent color and background tone separate.
- Settings pages, forms, dropdowns, popovers, dialogs, and utility panels must use the same glass surface, shadow, border, radius, and hover language as the dashboard.

## CSS Architecture

Preserve:

- `tokens.css`
- `base.css`
- `layout.css`
- `components.css`
- `dashboard-grid.css`
- `themes.css`
- `utilities.css`

Rules:

- Add tokens only for repeated system values.
- Keep selectors shallow.
- Avoid `!important`.
- Avoid duplicated rules.
- Place component styles in the correct architecture file.
- Shared visual polish belongs in `themes.css`.
- Grid movement and object state styles belong in `dashboard-grid.css`.

## Control Styling

Controls should match existing toolbar, panel, and widget controls:

- Rounded pill geometry
- Token-driven translucent glass surface
- Soft inner highlight
- Subtle border
- Soft drop shadow
- Compact spacing
- Centered icon/text alignment
- Existing hover/active behavior
- Existing radius rhythm
- Existing typography scale and weight

Use icons and labels consistently. Icon-only buttons should preserve the existing centered control geometry.

## Forms And Settings

Settings and utility views should feel like native workspace surfaces.

- Form sections use glass containers.
- Inputs use field tokens with soft borders and inner highlight.
- Save/cancel actions use the same pill command rhythm as the toolbar.
- Section spacing follows the dashboard panel rhythm.
- Sticky save bars should feel like floating command surfaces.
- Focus states must be visible without harsh browser-default styling.

## Menus And Popovers

All secondary UI should share the same treatment:

- Glass surface
- Soft border
- Soft shadow
- Compact spacing
- Rounded 16px-18px containers
- Pill or 12px menu items
- Smooth open/close transition
- Token-driven hover/focus state
- Correct z-index layering

## Workspace Chrome Direction

The top surface should feel like workspace chrome: a calm, floating operating layer over the dashboard. It should not feel like a row of admin buttons, a set of bordered command islands, or a generic utility bar.

Preserve:

- One clear workspace anchor
- A quiet creation affordance
- Secondary layout/history controls with lower visual weight
- Subtle interaction mode controls
- Context/environment utilities that feel ambient

Avoid:

- Excessive outlined capsules
- Equal visual weight for every command
- Giant CTA-style add buttons
- Repeated bordered containers
- Browser-default form controls

Use spacing, opacity, hover states, and one shared glass surface to imply grouping. Menus may be richer floating glass surfaces, but the persistent chrome should breathe.

Primary emphasis belongs to Dashboard, Add Widget, and Engineer Mode. Save, Load, Undo, Restore, Group, background, and settings controls are secondary or utility actions. Do not let every button compete at the same weight.

Details live in `docs/workspace-toolbar.md`.

## Timeframe / Command Surface Direction

The current timeframe widget should evolve into a dashboard command surface.

It should include:

- Range preset pill cluster
- Active timeframe capsule
- Compact utility icon cluster
- Optional context/status indicators
- Optional live/refresh state

It must remain draggable and resizable if treated as a universal object. If locked, the locked state must be explicit.

## Engineer Mode Visuals

Wiring visuals should be elegant and quiet:

- Smooth lines
- Soft glow
- Token-driven color
- Subtle animated affordance
- Native-feeling connection handles
- No harsh developer-node styling
- No hard-coded colors

## Spatial Workspace Visual Direction

Future pan-and-zoom canvas work must preserve the current Apple-glass personality.

- The canvas should feel spatial, tactile, calm, and precise.
- Panning and zooming should use smooth, orientation-preserving motion.
- Overview zoom should show regions, groups, panels, context flow, and wiring without visual clutter.
- Detail zoom should restore full widget controls, table density, graph detail, menus, and resize affordances.
- Context inheritance should remain visible through subtle badges, glow, breadcrumbs, mini-map indicators, or focus highlights.
- Avoid map-app styling, enterprise BI canvas styling, loud selection rectangles, and decorative wallpaper effects.
- No tab chrome should become the primary organizing visual model if spatial navigation can express the same structure.

## Polish Checklist

Treat these as bugs:

- Pixel misalignment
- Inconsistent spacing
- Inconsistent easing
- Hover jitter
- Drag flicker
- Resize jumps
- Ghost preview mismatch
- Icon misalignment
- Text clipping
- Z-index leaks
- Overflow clipping
- Shadow inconsistency
- Radius mismatch
- Deep-background material drift
- Background preset mismatch
- Disorienting pan or zoom jumps
- Zoom-level text clipping or unreadable controls
- Context links that detach visually from their source or target under pan/zoom

## Implementation Plan

### Phase 1

- Document current visual rules.
- Require screenshots before large visual changes.

### Phase 5

- Update toolbar and timeframe command surface using existing glass/pill patterns.
- Reuse tokens and existing component classes where possible.
- Add screenshots for default background, a deep background, and at least two background presets.

### Phase 6

- Add visual regression coverage for toolbar, command surface, panels, widgets, hover/focus parity, and Engineer Mode wiring.
