# Worker

Implemented:
- `panel-appearance-runtime.js`: added `No color`, persisted cleared-color and user-color markers, and widget-only border reset/application.
- `panel-layout-hydration.js` / `widget-layout-hydration.js`: respected `colorCleared` and `colorUser`.
- `persisted-workspace-runtime.js` / `app.js`: persisted `colorCleared` and `colorUser`.
- `themes.css`: scoped widget body tint to user-selected widget colors.
- `dashboard-grid.css`: styled the clear option.
- `app.js`: restored a portalled widget drawer before absorption cloning.
- `dashboard-electron.spec.js`: strengthened recolor/clear and panel-contained drawer move canaries.

Root cause:
- Widget recolor only affected tool buttons because the card body stayed on fixed glass.
- Clear did not persist because missing color meant default theme during hydration.
- Panel-contained move via drawer failed because absorption cloned the widget while its drawer was still portalled outside the widget.
