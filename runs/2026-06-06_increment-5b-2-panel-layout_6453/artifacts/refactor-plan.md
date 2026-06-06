# Increment 5B-2 Refactor Plan

Move the panel hydration loop and nested initPanel body into app/static/modules/panel-layout-runtime.js after proving initPanel no-op resistance. Preserve initWidgetLayout-before-panel-binders ordering and layout.__initPanel compatibility.
