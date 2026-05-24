# Material And Background System

## Purpose

The dashboard has one shared glass/component material system and one user-selected workspace background tone.

There is no separate dark mode, night mode, or alternate component theme. A darker-looking workspace is created by choosing a darker background color; panels, widgets, buttons, menus, timeframe controls, and utility controls keep the same material model.

## Shared Material

The shared material controls:

- Text and icon tokens
- Glass surface translucency
- Internal gradients and highlights
- Borders and edge diffusion
- Shadows and control depth
- Field backgrounds
- Popover and modal layering
- Hover, focus, active, and pressed states

Component styling should flow through tokens such as `--surface`, `--surface-raised`, `--surface-soft`, `--glass-surface`, `--glass-surface-strong`, `--glass-border`, `--glass-highlight`, `--field-bg`, `--field-border`, `--shadow-glass`, and `--shadow-control`.

Do not add component rules that branch on a background tone to create alternate material behavior.

## Accent Color

Accent color controls:

- Widget and panel emphasis
- Active pills and selected states
- Context indicators
- Primary command buttons

Accent color must flow through tokens such as `--blue`, `--panel-accent`, `--panel-accent-rgb`, and `--panel-accent-text`. Do not hard-code the current blue in new components.

## Background Tone

Background tone controls the ambient workspace background only. It should not overpower widgets, panels, forms, or popovers.

Rules:

- Background tone may update only `--bg` and `--bg-end`.
- Background tone must not override accent color.
- Background tone must not change glass surfaces, borders, shadows, gradients, icon styling, hover styling, focus styling, or component geometry.
- Background tone must not introduce decorative wallpaper or loud saturation.
- Hover and keyboard focus may preview a tone by temporarily applying `html[data-background]`; do not write storage until the user selects the option.

## Component Rules

- Top bars, settings sections, menus, popovers, dialogs, and save bars should use shared glass surface tokens.
- Inputs should use field tokens, not raw white or raw dark backgrounds.
- Hover and focus states should use the shared interaction model.
- Shadows should follow `--shadow-glass` for containers and `--shadow-control` for controls.
- Radius should follow the existing rhythm: large surfaces use `--radius-lg`, compact controls use pill or 14px-18px rounded geometry.

## Workspace Toolbar

The toolbar uses the same shared material system as the dashboard:

- Accent color: primary commands, active modes, and accent markers.
- Background tone: ambient page atmosphere only.
- Shared glass material: all toolbar control surfaces, menus, and picker surfaces.

Workspace chrome should use one shared glass layer with ghosted controls rather than repeated bordered command islands. Active modes and the compact create affordance may use `--blue`, but only through token-based gradients or color mixes.

Background tone controls belong with appearance/environment actions, not layout or composition actions.

## Implementation Notes

- Initial background attributes are applied in `base.html` before CSS loads.
- Runtime background changes are handled in `app.js`.
- CSS should read from `html[data-background]` only for ambient background colors.
- Background preset names are documented in `docs/background-presets.md`.
