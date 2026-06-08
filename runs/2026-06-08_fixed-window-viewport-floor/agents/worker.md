# Worker

Implemented:
- app/static/app.js: viewportRowFloorForLayout now derives workspace rows from window.innerHeight minus the grid host top offset and the fixed page bottom inset.
- app/static/app.js: panel-internal widgets use the panel body's visible bounding rect for the floor.
- electron-tests/dashboard-electron.spec.js: canaries now assert a fixed floor across panel expansion, free placement within floor, no drag-created scroll, collision clamp behavior, and panel-internal clamp.
- electron-tests/dashboard-electron.spec.js: updated the drag handler smoke test to move horizontally within the legal floor.

No dependency changes.
