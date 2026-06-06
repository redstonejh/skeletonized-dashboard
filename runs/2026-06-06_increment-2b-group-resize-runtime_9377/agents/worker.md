# worker notes

Implemented `app/static/modules/group-resize-runtime.js` with `createGroupResizeRuntime(deps)`.

The returned helper surface is `runGroupResize`, `alignedResizeHeight`, `groupGridBox`, `groupBoxBounds`, `applyGroupFootprintBounds`, `createGroupFootprint`, and `beginGroupLiveSurfaces`.

`app/static/app.js` imports and initializes the runtime before ordered drag so ordered drag still receives the group footprint helpers in the same init window.
