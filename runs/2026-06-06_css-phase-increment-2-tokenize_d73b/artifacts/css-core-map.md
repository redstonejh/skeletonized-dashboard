# CSS Core Map

Generated for CSS phase increment 1. This is a read-only map; no CSS rules were changed.

## Import Order

- `@import "./tokens.css";`
- `@import "./base.css";`
- `@import "./layout.css";`
- `@import "./components.css";`
- `@import "./dashboard-grid.css";`
- `@import "./themes.css";`
- `@import "./utilities.css";`

## File Coverage

### app/static/themes.css

- Lines: 5417
- Rule blocks: 740
- Declarations: 2916
- Raw !important declarations: 376
- Hard-coded values: 1009
- SHA256: `a93f5d6a786b47f78b8e9772d5e33bf6c92b5877c2b7b2780a887546dc5841c8`

| Lines | Rule Blocks | Declarations | Dominant Buckets |
|---:|---:|---:|---|
| 1-200 | 30 | 154 | menu-navigation, base-control, panel, interaction |
| 201-400 | 20 | 148 | panel, base-control, menu-navigation |
| 401-600 | 39 | 139 | base-control, panel, menu-navigation, widget |
| 601-800 | 42 | 118 | base-control, menu-navigation, widget, panel |
| 801-1000 | 34 | 125 | base-control, panel, menu-navigation, widget |
| 1001-1200 | 31 | 106 | panel, menu-navigation |
| 1201-1400 | 26 | 175 | menu-navigation, panel |
| 1401-1600 | 26 | 95 | panel, menu-navigation |
| 1601-1800 | 19 | 41 | panel, menu-navigation, background-tone, interaction |
| 1801-2000 | 27 | 95 | base-control, panel, menu-navigation, background-tone |
| 2001-2200 | 38 | 154 | background-tone, base-control, glass-material, interaction |
| 2201-2400 | 43 | 144 | background-tone, menu-navigation, panel, base-control |
| 2401-2600 | 26 | 100 | menu-navigation, background-tone, panel, glass-material |
| 2601-2800 | 36 | 121 | menu-navigation, base-control, panel, interaction |
| 2801-3000 | 29 | 110 | menu-navigation, background-tone, panel |
| 3001-3200 | 23 | 129 | menu-navigation, background-tone, panel |
| 3201-3400 | 27 | 136 | menu-navigation, panel, base-control, background-tone |
| 3401-3600 | 25 | 110 | widget, base-control, interaction, panel |
| 3601-3800 | 21 | 54 | panel, menu-navigation, background-tone |
| 3801-4000 | 25 | 133 | menu-navigation, glass-material, background-tone, panel |
| 4001-4200 | 24 | 135 | panel, glass-material, base-control, background-tone |
| 4201-4400 | 47 | 139 | background-tone, panel |
| 4401-4600 | 10 | 38 | background-tone |
| 4601-4800 | 15 | 37 | background-tone |
| 4801-5000 | 18 | 35 | background-tone |
| 5001-5200 | 16 | 36 | background-tone |
| 5201-5400 | 20 | 100 | background-tone, base-control, panel |
| 5401-5417 | 3 | 9 | widget, base-control |

### app/static/dashboard-grid.css

- Lines: 3706
- Rule blocks: 591
- Declarations: 2541
- Raw !important declarations: 63
- Hard-coded values: 529
- SHA256: `016c5f527aa60946d9d492254687c1c4df2caefe6632e6ad87580c19543dce6a`

| Lines | Rule Blocks | Declarations | Dominant Buckets |
|---:|---:|---:|---|
| 1-200 | 24 | 122 | panel, glass-material, background-tone, widget |
| 201-400 | 34 | 137 | widget, base-control, panel |
| 401-600 | 26 | 163 | base-control, widget, panel |
| 601-800 | 30 | 140 | widget, panel |
| 801-1000 | 33 | 125 | widget, interaction, panel, base-control |
| 1001-1200 | 33 | 143 | widget, base-control, panel |
| 1201-1400 | 31 | 127 | panel, base-control, widget |
| 1401-1600 | 26 | 163 | panel, base-control |
| 1601-1800 | 28 | 75 | panel |
| 1801-2000 | 36 | 139 | base-control, panel |
| 2001-2200 | 30 | 134 | panel, base-control, interaction |
| 2201-2400 | 24 | 127 | panel |
| 2401-2600 | 44 | 145 | widget, base-control, panel |
| 2601-2800 | 34 | 148 | widget, base-control, panel |
| 2801-3000 | 35 | 142 | base-control, widget, panel |
| 3001-3200 | 28 | 156 | widget, base-control, panel |
| 3201-3400 | 37 | 142 | widget, base-control, panel |
| 3401-3600 | 36 | 142 | base-control, widget |
| 3601-3706 | 22 | 71 | widget, panel, base-control |

## Important Declarations

- Raw total across mapped CSS: 439
- Raw important by bucket:
  - panel: 221
  - background-tone: 136
  - base-control: 50
  - interaction: 17
  - widget: 10
  - glass-material: 4
  - menu-navigation: 1

## Duplicated Per-Background-Tone Blocks

1. `align-items:center` appears 73 times.
2. `display:grid` appears 72 times.
3. `overflow:hidden` appears 61 times.
4. `pointer-events:none` appears 55 times.
5. `transform:none` appears 42 times.
6. `position:relative` appears 40 times.
7. `display:inline-flex` appears 39 times.
8. `display:none` appears 38 times.
9. `border-radius:999px` appears 37 times.
10. `position:absolute` appears 36 times.
11. `width:100%` appears 36 times.
12. `justify-content:center` appears 34 times.

## Specificity Hotspots

1. app/static/themes.css:1786 score 1173 `.settings-brand-switch:active, .cmd-btn:active, .icon-btn:active, .cmd-btn-icon-only:active, .dash-switch-hero:active, .background-tone-trigger:active, .panel-reset-button:active, .panel-undo-button:active, .panel-add-button:active, .panel-add-action:active, .widget-add-action:active, .layout-slot-button:active, .layout-slot-trigger:active, .layout-slot-menu button:active, .layout-slot-menu button.is-active, .background-tone-option:active, .confirm-dialog-close:active, .confirm-dialog-btn:active, .app-nav:not(.settings-nav) .nav-status-item:active, .app-nav:not(.settings-nav) .cmd-btn:active, .settings-nav .nav-status-item:active, .app-nav.workspace-chrome button.dash-switch-hero:active, .app-nav.workspace-chrome .background-tone-trigger:active, .app-nav.workspace-chrome .panel-reset-button:active, .app-nav.workspace-chrome .panel-undo-button:active, .app-nav.workspace-chrome .layout-slot-button:active, .app-nav.workspace-chrome .layout-slot-trigger:active, .app-nav.workspace-chrome .workspace-mode-button:active, .app-nav.workspace-chrome .workspace-mode-button[aria-pressed="true"], .app-nav.workspace-chrome .nav-status-icon-only:active, .app-nav.workspace-chrome .cmd-btn-icon-only:active, .app-nav.workspace-chrome .composition-add-button:active, .range-icon-button:active, .preset-btn:active, .preset-btn.active, .range-custom-trigger:active, .range-custom-trigger.active, .panel-lock-toggle:active, .panel-pin-toggle:active, .panel-pin-toggle[aria-pressed="true"], .db-panel-tools-open .panel-settings-toggle, .widget-tools-open .panel-settings-toggle, .panel-settings-toggle:active, .panel-tool-button:active`
2. app/static/dashboard-grid.css:1741 score 968 `body.panel-interaction-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-interaction-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-interaction-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-interaction-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-resize-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-resize-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-resize-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-resize-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible`
3. app/static/dashboard-grid.css:1741 score 968 `body.panel-interaction-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-interaction-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-interaction-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-interaction-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-resize-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-resize-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-resize-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-resize-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible`
4. app/static/dashboard-grid.css:1741 score 968 `body.panel-interaction-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-interaction-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-interaction-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-interaction-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-resize-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-resize-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-resize-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-resize-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible`
5. app/static/dashboard-grid.css:1741 score 968 `body.panel-interaction-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-interaction-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-interaction-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-interaction-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-resize-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-resize-active .widget-layout > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible, body.panel-resize-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):hover, body.panel-resize-active .panel-internal-widget-grid > .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member):focus-visible`
6. app/static/dashboard-grid.css:1761 score 968 `body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible`
7. app/static/dashboard-grid.css:1761 score 968 `body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible`
8. app/static/dashboard-grid.css:1761 score 968 `body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible`
9. app/static/dashboard-grid.css:1761 score 968 `body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible`
10. app/static/dashboard-grid.css:1761 score 968 `body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-interaction-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .widget-card:not(.widget-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:hover, body.panel-resize-active .db-panel:not(.db-panel-dragging):not(.dashboard-active-resize):not(.dashboard-resize-source):not(.group-transform-member) .panel-settings-toggle:focus-visible`
11. app/static/themes.css:1705 score 962 `.settings-brand-switch:hover, .cmd-btn:hover, .icon-btn:hover, .cmd-btn-icon-only:hover, .dash-switch-hero:hover, .background-tone-trigger:hover, .panel-reset-button:hover, .panel-undo-button:hover, .panel-add-button:hover, .panel-add-action:hover, .widget-add-action:hover, .layout-slot-button:hover, .layout-slot-trigger:hover, .layout-slot-menu button:hover, .background-tone-option:hover, .confirm-dialog-close:hover, .confirm-dialog-btn:hover, .app-nav:not(.settings-nav) .nav-status-item:hover, .settings-nav .nav-status-item:hover, .app-nav.workspace-chrome button.dash-switch-hero:hover, .app-nav.workspace-chrome .background-tone-trigger:hover, .app-nav.workspace-chrome .panel-reset-button:hover, .app-nav.workspace-chrome .panel-undo-button:hover, .app-nav.workspace-chrome .layout-slot-button:hover, .app-nav.workspace-chrome .layout-slot-trigger:hover, .app-nav.workspace-chrome .workspace-mode-button:hover, .app-nav.workspace-chrome .nav-status-icon-only:hover, .app-nav.workspace-chrome .cmd-btn-icon-only:hover, .app-nav.workspace-chrome .composition-add-button:hover, .range-icon-button:hover, .preset-btn:hover, .range-custom-trigger:hover, .panel-lock-toggle:hover, .panel-pin-toggle:hover, .panel-settings-toggle:hover, .panel-tool-button:hover`
12. app/static/themes.css:1741 score 942 `.settings-brand-switch:focus-visible, .cmd-btn:focus-visible, .icon-btn:focus-visible, .cmd-btn-icon-only:focus-visible, .dash-switch-hero:focus-visible, .background-tone-trigger:focus-visible, .panel-reset-button:focus-visible, .panel-undo-button:focus-visible, .panel-add-button:focus-visible, .panel-add-action:focus-visible, .widget-add-action:focus-visible, .layout-slot-button:focus-visible, .layout-slot-trigger:focus-visible, .layout-slot-menu button:focus-visible, .background-tone-option:focus-visible, .confirm-dialog-close:focus-visible, .confirm-dialog-btn:focus-visible, .app-nav:not(.settings-nav) .nav-status-item:focus-within, .settings-nav .nav-status-item:focus-within, .app-nav.workspace-chrome button.dash-switch-hero:focus-visible, .app-nav.workspace-chrome .background-tone-trigger:focus-visible, .app-nav.workspace-chrome .panel-reset-button:focus-visible, .app-nav.workspace-chrome .panel-undo-button:focus-visible, .app-nav.workspace-chrome .layout-slot-button:focus-visible, .app-nav.workspace-chrome .layout-slot-trigger:focus-visible, .app-nav.workspace-chrome .workspace-mode-button:focus-visible, .app-nav.workspace-chrome .nav-status-icon-only:focus-visible, .app-nav.workspace-chrome .cmd-btn-icon-only:focus-visible, .app-nav.workspace-chrome .composition-add-button:focus-visible, .range-icon-button:focus-visible, .range-custom-trigger:focus-visible, .panel-lock-toggle:focus-visible, .panel-pin-toggle:focus-visible, .panel-settings-toggle:focus-visible, .panel-tool-button:focus-visible`
13. app/static/themes.css:5137 score 910 `body.has-photo-background .panel-layout > .db-panel:has(.panel-internal-widget-grid > .widget-card:is(:hover, .surface-response-active)):not(.db-panel-dragging):not(.dashboard-active-resize):not(.db-panel-tools-open):not(.db-panel-collapsed), body.has-photo-background .panel-layout > .db-panel:has(:is(.panel-tools, .panel-tool-drawer, button, input, select, textarea, [contenteditable="true"]):hover):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel:has(:is(.panel-tools, .panel-tool-drawer, input, select, textarea, [contenteditable="true"]):focus-within):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(.panel-internal-widget-grid > .widget-card:is(:hover, .surface-response-active)):not(.db-panel-dragging):not(.dashboard-active-resize):not(.db-panel-tools-open):not(.db-panel-collapsed), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(:is(.panel-tools, .panel-tool-drawer, button, input, select, textarea, [contenteditable="true"]):hover):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(:is(.panel-tools, .panel-tool-drawer, input, select, textarea, [contenteditable="true"]):focus-within):not(.db-panel-dragging):not(.dashboard-active-resize)`
14. app/static/themes.css:5258 score 910 `body.has-photo-background .panel-layout > .db-panel:has(.panel-internal-widget-grid > .widget-card:is(:hover, .surface-response-active)):not(.db-panel-dragging):not(.dashboard-active-resize):not(.db-panel-tools-open):not(.db-panel-collapsed), body.has-photo-background .panel-layout > .db-panel:has(:is(.panel-tools, .panel-tool-drawer, button, input, select, textarea, [contenteditable="true"]):hover):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel:has(:is(.panel-tools, .panel-tool-drawer, input, select, textarea, [contenteditable="true"]):focus-within):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(.panel-internal-widget-grid > .widget-card:is(:hover, .surface-response-active)):not(.db-panel-dragging):not(.dashboard-active-resize):not(.db-panel-tools-open):not(.db-panel-collapsed), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(:is(.panel-tools, .panel-tool-drawer, button, input, select, textarea, [contenteditable="true"]):hover):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(:is(.panel-tools, .panel-tool-drawer, input, select, textarea, [contenteditable="true"]):focus-within):not(.db-panel-dragging):not(.dashboard-active-resize)`
15. app/static/themes.css:5258 score 910 `body.has-photo-background .panel-layout > .db-panel:has(.panel-internal-widget-grid > .widget-card:is(:hover, .surface-response-active)):not(.db-panel-dragging):not(.dashboard-active-resize):not(.db-panel-tools-open):not(.db-panel-collapsed), body.has-photo-background .panel-layout > .db-panel:has(:is(.panel-tools, .panel-tool-drawer, button, input, select, textarea, [contenteditable="true"]):hover):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel:has(:is(.panel-tools, .panel-tool-drawer, input, select, textarea, [contenteditable="true"]):focus-within):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(.panel-internal-widget-grid > .widget-card:is(:hover, .surface-response-active)):not(.db-panel-dragging):not(.dashboard-active-resize):not(.db-panel-tools-open):not(.db-panel-collapsed), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(:is(.panel-tools, .panel-tool-drawer, button, input, select, textarea, [contenteditable="true"]):hover):not(.db-panel-dragging):not(.dashboard-active-resize), body.has-photo-background .panel-layout > .db-panel.db-panel-custom-color:has(:is(.panel-tools, .panel-tool-drawer, input, select, textarea, [contenteditable="true"]):focus-within):not(.db-panel-dragging):not(.dashboard-active-resize)`

## Shared Glass Material Rules

- app/static/themes.css:2012 `.confirm-dialog::backdrop` -> `background: rgba(15, 23, 42, .28)`
- app/static/themes.css:2012 `.confirm-dialog::backdrop` -> `backdrop-filter: blur(8px)`
- app/static/themes.css:2495 `.app-nav.workspace-chrome .workspace-mode-button[aria-pressed="true"], .app-nav.workspace-chrome .layout-group-button[aria-pressed="true"], .app-nav.workspace-chrome .liquid-glass-toggle[aria-pressed="true"]` -> `background: color-mix(in srgb, var(--blue) 13%, transparent)`
- app/static/themes.css:2495 `.app-nav.workspace-chrome .workspace-mode-button[aria-pressed="true"], .app-nav.workspace-chrome .layout-group-button[aria-pressed="true"], .app-nav.workspace-chrome .liquid-glass-toggle[aria-pressed="true"]` -> `color: color-mix(in srgb, var(--blue) 86%, var(--ink-strong))`
- app/static/themes.css:2495 `.app-nav.workspace-chrome .workspace-mode-button[aria-pressed="true"], .app-nav.workspace-chrome .layout-group-button[aria-pressed="true"], .app-nav.workspace-chrome .liquid-glass-toggle[aria-pressed="true"]` -> `box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--blue) 54%, transparent)`
- app/static/themes.css:2641 `.confirm-dialog::backdrop` -> `background: radial-gradient(circle at 50% 22%, rgba(255, 255, 255, .16), transparent 42%), rgba(15, 23, 42, .30)`
- app/static/themes.css:2641 `.confirm-dialog::backdrop` -> `backdrop-filter: blur(10px) saturate(1.08)`
- app/static/themes.css:2641 `.confirm-dialog::backdrop` -> `-webkit-backdrop-filter: blur(10px) saturate(1.08)`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `border: 1px solid var(--glass-border)`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `border-radius: 14px`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `background: var(--glass-surface-strong)`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `box-shadow: var(--shadow-glass)`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `backdrop-filter: blur(18px) saturate(1.12)`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `-webkit-backdrop-filter: blur(18px) saturate(1.12)`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `color: var(--ink)`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `scrollbar-width: thin`
- app/static/themes.css:3805 `.nav-menu-shell, .floating-glass-menu` -> `scrollbar-color: color-mix(in srgb, var(--ink) 24%, transparent) transparent`
- app/static/themes.css:3817 `.nav-menu-shell::-webkit-scrollbar, .floating-glass-menu::-webkit-scrollbar, .glass-menu-scroll-region::-webkit-scrollbar` -> `width: 8px`
- app/static/themes.css:3817 `.nav-menu-shell::-webkit-scrollbar, .floating-glass-menu::-webkit-scrollbar, .glass-menu-scroll-region::-webkit-scrollbar` -> `height: 8px`
- app/static/themes.css:3822 `.nav-menu-shell::-webkit-scrollbar-track, .floating-glass-menu::-webkit-scrollbar-track, .glass-menu-scroll-region::-webkit-scrollbar-track` -> `background: transparent`

## Hard-Coded Values That Should Become Tokens

- base-control: 355
- panel: 340
- background-tone: 305
- menu-navigation: 292
- widget: 197
- glass-material: 28
- interaction: 21

## Ranked Consolidation Candidates

1. Tokenize hard-coded px/color/shadow values (low-medium); gate: computed-style parity for controls, panels, widgets, menus.
2. Collapse duplicated per-background-tone declarations into custom properties (medium); gate: all background tones in computed-style oracle.
3. Reduce removable !important declarations from classified subset (medium-high); gate: important-classification plus computed-style parity.
4. Unify shared glass material rules (high); gate: webgl-glass/photo/custom-color matrix parity.
5. Split themes.css into cohesive modules after parity is frozen (high); gate: zero computed-style drift and import-order proof.
