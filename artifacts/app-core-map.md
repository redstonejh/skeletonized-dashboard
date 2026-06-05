# app/static/app.js Entanglement Map

Source: `app/static/app.js`

Captured: 2026-06-05

Line count: 5323

SHA256 before analysis: `C3458D3B2F97E1D076983CEE875A69420D67CC07F00F0ADB3D1DCE41A0030E4C`

Scope: documentation only. This file does not propose extractions or behavior changes. Existing attempted-and-reverted clusters are referenced from `artifacts/deferred-extractions.md`; current line ranges below are authoritative for the current tree.

## Part A - Region Map

The following regions are contiguous and cover line 1 through line 5323 with no gaps and no overlaps.

| Lines | Region | Status | Safety |
|---:|---|---|---|
| 1-89 | ESM import spine | already-extracted-wiring | EDIT-WITH-CARE |
| 90-180 | DOM boot, global runtime capture, menu/background/layout persistence setup | newly-assessed | DO-NOT-TOUCH-WITHOUT init-order replay |
| 181-355 | surface tools, group selection, undo/delete placeholders, primitive facades, data adapter contract wiring | newly-assessed | DO-NOT-TOUCH-WITHOUT full e2e + parity |
| 356-1179 | mixed context/query/data-source compatibility island | deferred-knot: `mixed-context-query-compatibility` | DO-NOT-TOUCH-WITHOUT compatibility split |
| 1180-1374 | panel primitives, grid point math, resize alignment, visual drop placement | newly-assessed | DO-NOT-TOUCH-WITHOUT resize/drag parity |
| 1375-1533 | conditional style and logic rule evaluation | deferred-knot: `conditional-style-runtime` | DO-NOT-TOUCH-WITHOUT resize-snap parity |
| 1534-1618 | panel layout serialization and DOM factory/reflow runtime setup | newly-assessed | DO-NOT-TOUCH-WITHOUT save/load parity |
| 1619-1786 | widget runtime controller, media/signal state, runtime meaning globals | deferred-knot: `widget-content-runtime`, `widget-runtime-meaning-hydration` | DO-NOT-TOUCH-WITHOUT widget/runtime init canary |
| 1787-1997 | widget settings/assets/facades/grid geometry/resize surface/collision snapshot setup | newly-assessed | DO-NOT-TOUCH-WITHOUT resize and panel-pin canaries |
| 1998-2870 | collision/reflow facade, ordered item helpers, insertion, panel containment, reflow animation | deferred-knot: `ordered-grid-items-runtime` plus newly-assessed collision glue | DO-NOT-TOUCH-WITHOUT drag/collision parity |
| 2871-3643 | ordered drag engine | deferred-knot: `ordered-drag-runtime` | DO-NOT-TOUCH-WITHOUT shared interaction-state split |
| 3644-4175 | group resize engine | deferred-knot: `group-resize-runtime` | DO-NOT-TOUCH-WITHOUT shared resize-session split |
| 4176-4305 | widget layout persistence, color menu factory, delete runtime wiring | newly-assessed | DO-NOT-TOUCH-WITHOUT save/delete/color parity |
| 4306-4752 | widget layout lifecycle and event binding | deferred-knot: `widget-layout-lifecycle`, `widget-primitive-runtime` | DO-NOT-TOUCH-WITHOUT widget-tool-session split |
| 4753-4790 | panel runtime setup and initial widget layout invocation | already-extracted-wiring | EDIT-WITH-CARE |
| 4791-5138 | panel layout lifecycle and event binding | deferred-knot: `panel-layout-lifecycle`, `panel-core-primitives` | DO-NOT-TOUCH-WITHOUT panel-tool-session split |
| 5139-5323 | post-init tail: persisted workspace, forms, clipboard, source switcher, group controls, add runtime, history/reset | newly-assessed | DO-NOT-TOUCH-WITHOUT persistence + reset parity |

### 1-89 - ESM Import Spine

Owns: import ordering for side-effect globals (`window.dashboardWidgetRuntime`, `window.dashboardLayoutPersistence`, `window.dashboardDragRuntime`, `window.dashboardResizeRuntime`, `window.dashboardPanelRuntime`, `window.dashboardPanelContainment`, `window.dashboardCollisionReflowRuntime`, `window.dashboardGeometry`, `window.dashboardMenuOverlayRuntime`) plus imported module factories.

Shared mutable state: none declared directly, but this region determines whether later `window.*` captures are populated. Side-effect imports must run before `DOMContentLoaded` captures at lines 92-100.

Coupled to: every later region that reads `window.dashboard*`; especially 90-180 and 1787-1997. The dynamic import at line 5323 depends on the DOM and CSS classes established by the app after boot.

Init order: side-effect imports must precede factory imports and the `DOMContentLoaded` body. Moving `layout-persistence.js`, `drag-runtime.js`, `resize-runtime.js`, `panel-runtime.js`, or `collision-reflow.js` after consumers can leave null globals.

Canary: renderer boot failure, missing persistence bridge fallback, missing drag/resize handlers, `window.dashboardWidgetRuntimeController` undefined.

Safety: EDIT-WITH-CARE. Safe only for adding a cohesive imported module that has no side effects or whose side effects are sequenced before its consumers.

### 90-180 - DOM Boot, Runtime Capture, Menu/Background/Persistence Setup

Owns: `DOMContentLoaded` root, `showToast`, captured `window.dashboard*` runtimes, menu overlay facade, dashboard tool drawer runtime, background controller, removed-engineer-mode shim, nav/status menus, overflow title scheduler, keyword search API, dashboard switcher, layout persistence API aliases, and asset runtime.

Shared mutable state: `refreshWorkspaceMiniMaps` placeholder; `layoutPersistence` storage-key aliases; `engineerModeState`; the menu overlay DOM portal; local background state through `initializeBackgroundController`; localStorage key `dashboard-background` indirectly.

Coupled to: 181-355 uses `refreshWorkspaceMiniMaps`, `isEngineerMode`, `layoutPersistence`, storage keys, and menu/tool drawer APIs. 5139-5323 uses layout persistence aliases and asset loaders. `initializeBackgroundController` must run before interactions that portal menus.

Init order: must run after import side effects and before object add, lifecycle init, persisted workspace init, and form binding. `refreshWorkspaceMiniMaps` is assigned later by 1144-1157 but passed by closure to the engineer shim here.

Canary: background photo switching fails, color/background popovers misposition, app boots without persistence keys, minimap refresh callbacks throw, search forms stop rebinding after add/paste.

Safety: DO-NOT-TOUCH-WITHOUT init-order replay. Even "small" alias movement can change closure binding time.

### 181-355 - Surface Tools, Group Selection, Undo/Delete Placeholders, Primitive Facades, Data Adapter Contract Wiring

Owns: surface-response runtime delegates, group selection runtime, undo serialization hooks, resize auto-zoom setup, layout history setup, delete-dialog element handles and delete request placeholders, panel primitive facade, grid metrics runtime, workspace object model, and data adapter runtime creation.

Shared mutable state: `requestWorkspaceObjectDelete`, `requestPanelDelete`, `requestWidgetDelete`; `panelRuntime` and `panelContainmentRuntime` null placeholders; group selection state from `createGroupSelectionRuntime`; `undoTransientItemClasses`; `dashboardGeometry`.

Coupled to: 356-1179 receives data adapter helpers and workspace object model helpers. 1180-1374 and 1787-2870 use grid metrics and panel primitive delegates. 4176-4305 and 5139-5323 depend on delete request closures being reassigned later. 4753-4790 assigns `panelRuntime`/`panelContainmentRuntime`.

Init order: must precede context helpers, grid math, widget/panel lifecycle, delete runtime initialization, and history/reset wiring. The `resizeEdgeFromPointer` and `setWidgetLinkNavigationSuspended` delegates are forward references and must remain closures.

Canary: group select mode stops toggling, undo misses transient cleanup, panel pin stops toggling because panel primitive delegates bind too early, resize auto-zoom leaks, delete dialogs no-op.

Safety: DO-NOT-TOUCH-WITHOUT full e2e + parity. This region is mostly wiring, but it wires mutable placeholders used much later.

### 356-1179 - Mixed Context/Query/Data-Source Compatibility Island

Owns: data source load/save, workspace context load/save/merge/apply, region context resolution, filter/timeframe helpers, query execution/cache/inflight maps, resolved-context debug badges, workspace region derivation, minimap runtime creation, grid item sizing runtime.

Shared mutable state: `widgetQueryCache`, `widgetQueryInflight`, `widgetQueryKeys`, persisted stores keyed by `dataSourcesKey` and `workspaceContextsKey`, context-related `dataset.*` fields (`workspaceContext`, `dataSourceId`, `semanticMapping`, `contextFilters`, `contextTimeRange`, `contextTags`, `contextName`, `resolvedContextId`, `resolvedWorkspaceRegionId`, `resolvedDataSourceId`, `resolvedSemanticMapping`, `contextInheritedFrom`, `workspaceRegionId`), layout expansion baseline fields (`__expansionBaselineSnapshot`, `__activeExpansionPanels`, `__activeExpansionSource`).

Coupled to: 181-355 for adapters/object model/grid sizing; 1534-1618 and 4176-4305 for save/load persistence; 1619-1786 for widget runtime data and semantic mapping; 1787-1997 for widget settings/runtime services; 5139-5323 for persisted workspace, layout sources, reset, object add, and clipboard.

Init order: must be built after data adapter runtime and workspace object model, before widget runtime setup, persisted workspace init, layout source runtime, object add, and reset.

Canary: panel color menu and resize span persistence regressions were observed when this compatibility island was aggressively gutted; widget runtime hydration loses semantic/default state; save/load/reset drops context-shaped dataset fields.

Safety: DO-NOT-TOUCH-WITHOUT compatibility split. Reference deferred entry `mixed-context-query-compatibility`.

### 1180-1374 - Panel Primitives, Grid Point Math, Resize Alignment, Visual Drop Placement

Owns: panel runtime delegate closures (`applyPanelSpan`, `applyPanelGridPosition`, `getPanelMinimumHeight`, `applyPanelHeight`), grid pointer math (`gridCellFromPoint`, `gridCellFromDragPointer`, `panelGridCellFromPoint`), aligned resize span math, grouped release span policy, visual drop placement, widget drop column, and style-rule path/numeric metric helpers.

Shared mutable state: reads and writes grid dataset conventions indirectly: `data-current-span`, `data-default-span`, `data-grid-row-span`, `data-grid-col`, `data-grid-row`, `data-saved-height`. Uses `panelRuntime` placeholder from 181-355, which is assigned in 4753-4790.

Coupled to: 2871-3643 ordered drag, 3644-4175 group resize, 4306-4752 widget resize binding, 4791-5138 panel resize binding, 1998-2870 collision/reflow slot resolution. `styleRulePathValue` and `numericMetricValueForWidget` feed 1375-1533.

Init order: must remain after `panelRuntime` placeholder declaration but before all move/resize runtimes are bound. The delegates are safe as closures before `panelRuntime` is assigned only because they are not called until after 4753-4790 initializes runtimes.

Canary: resize-snap span no longer changes, resize-snap height drifts, drag drop slots shift one column, panel pin/action controls fail if panel primitive delegates are split from their consumers.

Safety: DO-NOT-TOUCH-WITHOUT resize/drag parity.

### 1375-1533 - Conditional Style and Logic Rule Evaluation

Owns: conditional-style environment assembly, logic operand evaluation, comparison/evaluation, clearing conditional style variables, applying conditional effects, and `applyStyleRulesForWidget`.

Shared mutable state: widget inline CSS custom properties (`--conditional-*`), widget dataset/config state, resolved context data from 356-1179, dataflow/signal flags from 1619-1786.

Coupled to: 1180-1374 metric helpers, 1619-1786 widget runtime/signal state, 4306-4752 widget hydration and runtime content, 4176-4305 widget save state.

Init order: must be defined before widget runtime controller creation at 1619 so widget rendering can call style rule hooks.

Canary: prior extraction produced structured parity drift in `resize-snap` geometry on `builder-notes`; visual style updates can also silently change computed CSS evidence.

Safety: DO-NOT-TOUCH-WITHOUT resize-snap parity. Reference deferred entry `conditional-style-runtime`; the current line range has shifted from the older deferred log.

### 1534-1618 - Panel Layout Serialization and DOM Factory/Reflow Runtime Setup

Owns: dashboard DOM factories, `savePanelLayouts`, custom panel persistence, hidden panel drafts, panel layout order/geometry persistence, and reflow animation runtime setup.

Shared mutable state: panel storage keys (`panelStorageKey`, `customPanelsKey`, `hiddenPanelsKey`), `dataset.currentSpan`, `dataset.gridCol`, `dataset.gridRow`, `dataset.gridRowSpan`, `dataset.savedHeight`, `dataset.panelColor`, `dataset.panelTitle`, `dataset.locked`, `dataset.resizable`, expansion baseline snapshots, undo history through `captureLayoutUndo`/`pushLiveLayoutUndo`.

Coupled to: 356-1179 for context and expansion baseline; 1998-2870 for `normalizeGridLayout` and reflow; 4176-4305 `saveSharedGridLayouts`; 4791-5138 panel actions/move/resize; 5139-5323 persisted workspace, layout source, object add, and reset.

Init order: must be available before panel lifecycle binding and object add/delete/history runtimes. It calls `captureLayoutUndo` before writing stores.

Canary: save -> reload mismatch, hidden/custom panels resurrect or disappear, panel row breaks persist incorrectly, undo history captures transient DOM.

Safety: DO-NOT-TOUCH-WITHOUT save/load parity.

### 1619-1786 - Widget Runtime Controller, Media/Signal State, Runtime Meaning Globals

Owns: `widgetRuntimeController`, widget runtime facade, media widget asset state, signal consumer/dataflow compatibility state, runtime meaning helpers, widget instance/content wrappers, widget workbench runtime, widget runtime data refresh, and `window.dashboardWidgetRuntimeMeaning`.

Shared mutable state: `window.dashboardWidgetRuntimeMeaning`; widget dataset fields (`widgetType`, `widgetRuntimeType`, `widgetDefinition`, `widgetConfig`, `widgetRuntimeStatus`, `widgetRuntimeState`, `widgetRuntimeMeaning`, `dataflowSignalState`, asset refs); media asset stores from 90-180; query state from 356-1179.

Coupled to: 1375-1533 conditional styles; 1787-1997 widget settings service and asset API; 4176-4305 saveWidgetLayouts; 4306-4752 widget lifecycle; 5139-5323 persisted workspace and clipboard.

Init order: must occur after context/query helpers and before widget hydration at 4306. `window.dashboardWidgetRuntimeMeaning` must exist before external module callbacks ask for runtime meaning.

Canary: prior extraction passed once then later e2e showed resize-snap no longer changed span, indicating init-order coupling with widget/panel resize readiness. Widget workbench can show "No data logic fields" incorrectly.

Safety: DO-NOT-TOUCH-WITHOUT widget/runtime init canary. Reference deferred entries `widget-content-runtime` and `widget-runtime-meaning-hydration`.

### 1787-1997 - Widget Settings/Assets/Facades/Grid Geometry/Resize Surface/Collision Snapshot Setup

Owns: widget settings service, dashboard asset API global, runtime controls binding, panel containment facade, widget primitive delegates (`ensureWidgetTools`, `syncWidgetRenderedHeightToFootprint`, `applyWidgetSpan`, `applyWidgetGridPosition`, `widgetGridCellFromPoint`), collision runtime placeholder, grid item geometry facade, interaction auto-scroll delegate, resize lifecycle delegate, panel footprint facade, resize surface runtime, layout snapshot runtime, local collision collection, and local collision layout application.

Shared mutable state: `window.dashboardAssetRuntime`, `collisionReflowRuntime` placeholder, widget primitive delegates, resize lifecycle state via `dashboardResizeRuntime`, drag auto-scroll state via `dashboardDragRuntime`, layout snapshot state, grid dataset fields.

Coupled to: 1998-2870 assigns/uses `collisionReflowRuntime`; 2871-3643 and 3644-4175 use resize/drag geometry and snapshot delegates; 4306-4752 and 4791-5138 bind widget/panel move/resize against these delegates; 5139-5323 uses asset/settings/clipboard APIs.

Init order: must precede collision/reflow helpers and lifecycle binding. `collisionReflowRuntime` is intentionally null until the collision glue region finishes; facades call it lazily.

Canary: panel pin stops toggling if primitive delegates initialize against the wrong runtime; resize-snap span no longer changes; asset-backed widgets fail to persist; move/resize surfaces leave ghosts.

Safety: DO-NOT-TOUCH-WITHOUT resize and panel-pin canaries.

### 1998-2870 - Collision/Reflow Facade, Ordered Item Helpers, Insertion, Panel Containment, Reflow Animation

Owns: local/global collision item discovery, local collision layout application, default dashboard sync, grid normalization, ordered grid selectors/items, logical resolution item sets, visual LOD setup, workspace scroll floor setup, sparse slot/displacement helpers, expansion session helpers, sparse layout commit helpers, divider/region insertion targeting, panel add target, clipboard placeholders, group drag helper wrappers, ordered layout start/packing/application, reflow item selection, FLIP-style reflow animation, ordered-index insertion, panel containment entry/absorption/extraction helpers.

Shared mutable state: `collisionReflowRuntime`, `copySelectedWorkspaceObjects`, `pasteWorkspaceClipboardObjects`, `layout.__activeExpansionPanels`, `layout.__expansionBaselineSnapshot`, `layout.__orderedLayoutStartRow`, `dataset.grid*`, `dataset.currentSpan`, `dataset.workspaceRegionId`, `dataset.contextScopeId`, `dataset.visualLod`, `dataset.lod`.

Coupled to: 1787-1997 geometry/snapshot/resize surface; 2871-3643 ordered drag; 3644-4175 group resize; 4176-4305 save shared layouts; 4306-4752 and 4791-5138 move/resize bindings; 5139-5323 clipboard/object add/reset.

Init order: must happen after grid geometry and before any lifecycle binds. `copySelectedWorkspaceObjects` and `pasteWorkspaceClipboardObjects` are placeholders until 5186-5223 assigns them.

Canary: drag ghost/collision preview shifts, pinned cells are displaced, sparse placement auto-packs unexpectedly, panel absorption/extraction breaks, edge auto-scroll floor drifts, group paste no-ops.

Safety: DO-NOT-TOUCH-WITHOUT drag/collision parity. Reference deferred entry `ordered-grid-items-runtime` for the ordered item helper subcluster; current source range is broader than the older deferred line range.

### 2871-3643 - Ordered Drag Engine

Owns: `runOrderedDrag` body, live drag setup, placeholder/live ghost creation, drag offset math, group drag support, panel entry/exit absorption, internal widget grid moves, edge auto-scroll integration, collision/reflow preview, drop commit/cancel cleanup, and post-drop persistence callbacks.

Shared mutable state: document/body interaction classes, drag runtime lifecycle state, live placeholder nodes, live ghost nodes, group selection, panel containment state, `dataset.grid*`, `dataset.currentSpan`, `dataset.parentPanelKey`, scroll floor state, local snapshots.

Coupled to: 1180-1374 pointer/drop math; 1787-1997 resize/geometry/snapshot delegates; 1998-2870 collision/reflow/containment helpers; 4176-4305 save shared layouts; 4306-4752 widget move binding; 4791-5138 panel move binding.

Init order: defined before widget/panel lifecycle binding passes it into move runtimes. Must see all helper closures already defined.

Canary: live ghost missing, grid snap wrong, collision reflow fails, select-mode multi-move drifts, edge auto-scroll viewport shifts, panel containment absorbs/extracts incorrectly.

Safety: DO-NOT-TOUCH-WITHOUT shared interaction-state split. Reference deferred entry `ordered-drag-runtime`.

### 3644-4175 - Group Resize Engine

Owns: aligned resize height, group box math, group footprint layout, group live surfaces, group resize layout application, and `runGroupResize`.

Shared mutable state: document/body resize classes, group selection state, live resize preview nodes, expanded footprint ghosts, resize auto-zoom state, grid snapshot maps, `dataset.grid*`, `dataset.currentSpan`, `dataset.savedHeight`, `dataset.expandedGridRowSpan`.

Coupled to: 1180-1374 resize span/release math; 1787-1997 resize lifecycle/snapshot/surface; 1998-2870 reflow and sparse layout; 4306-4752 widget resize binding; 4791-5138 panel resize binding.

Init order: must be defined before widget/panel resize runtimes are bound.

Canary: resize-snap span no longer changes, group resize members overlap, expanded collapsed panel footprint is wrong, undo/save after resize captures preview state, auto-zoom leaves page transformed.

Safety: DO-NOT-TOUCH-WITHOUT shared resize-session split. Reference deferred entry `group-resize-runtime`.

### 4176-4305 - Widget Layout Persistence, Color Menu Factory, Delete Runtime Wiring

Owns: `saveWidgetLayouts`, internal widget layout delegation to `savePanelLayouts`, widget storage/custom widget serialization, hidden widget draft persistence, shared grid save helper wiring, panel color menu factory, and delete runtime initialization that reassigns request-delete closures.

Shared mutable state: `requestWorkspaceObjectDelete`, `requestPanelDelete`, `requestWidgetDelete` reassignment; widget storage keys; custom widget draft arrays; hidden widget raw drafts; widget dataset persistence (`widgetKey`, `panelTitle`, `panelColor`, `currentSpan`, `gridCol`, `gridRow`, `gridRowSpan`, `widgetType`, `widgetRuntimeType`, `minW`, `minH`, `locked`, `resizable`, `widgetConfig`).

Coupled to: 1534-1618 `savePanelLayouts`; 356-1179 context/expansion baseline; 4306-4752 widget delete/color controls; 4791-5138 panel delete/color controls; 5139-5323 reset/clipboard/layout source.

Init order: must occur after save panel and runtime helpers exist, before widget and panel lifecycle controls bind delete/color handlers.

Canary: custom widgets do not survive reload, hidden widgets resurrect, delete buttons no-op, color menus render stale themes, undo history loses widget geometry.

Safety: DO-NOT-TOUCH-WITHOUT save/delete/color parity.

### 4306-4752 - Widget Layout Lifecycle and Event Binding

Owns: `initWidgetLayout`, widget layout hydration, nested `initWidget`, widget tool drawer lifecycle, tool close timers, widget workbench/color menu portals, widget click/settings suppression, delegated internal-layout drag handler, widget action/move/resize/runtime controls binding, widget runtime hydration.

Shared mutable state: `layout.__initWidget`, `layout.dataset.dragRuntimeDelegateBound`, `widget.dataset.widgetInitialized`, `widget.__saveWidgetLayout`, `widget.__dashboardToolDrawer`, `widget.__widgetToolPositionObserver`, `widget.__openCustomization`, per-widget `closeTimer`, `suppressToolOpenUntil`, `suppressWidgetClickUntil`, `dragging`, `suppressSettingsClickUntil`, `ignoreToolLeaveCloseUntilPointerActivity`, `releaseToolLeaveCloseResume`, `toolsOpenedByApproach`.

Coupled to: 1619-1786 widget runtime setup; 1787-1997 widget primitive delegates; 2871-3643 ordered drag; 3644-4175 group resize; 4176-4305 save/delete/color factory; 4791-5138 panel lifecycle initializes internal widget grids by calling `initWidgetLayout`.

Init order: must run before panel lifecycle initializes panels with internal widget grids, and before object add/clipboard can call `layout.__initWidget`.

Canary: widget recolor/rename/pin/delete fails, widget settings/workbench does not open, widget drag/resize handlers disappear, panel-internal widget move/resize breaks, save/load misses new custom widgets.

Safety: DO-NOT-TOUCH-WITHOUT widget-tool-session split. Reference deferred entries `widget-layout-lifecycle` and `widget-primitive-runtime`.

### 4753-4790 - Panel Runtime Setup and Initial Widget Layout Invocation

Owns: `initializePanelRuntimes` call, assignment of `panelRuntime` and `panelContainmentRuntime`, animation helpers, initial call to `document.querySelectorAll(".widget-layout").forEach(initWidgetLayout)`.

Shared mutable state: assigns previously null `panelRuntime` and `panelContainmentRuntime`; initializes all existing widget layouts; exposes animation helpers consumed by object add, delete, reset, move/resize, and clipboard.

Coupled to: 181-355 placeholders and primitive facades; 1180-1374 panel delegate closures; 4306-4752 widget lifecycle; 4791-5138 panel lifecycle; 5139-5323 object add/reset/clipboard.

Init order: critical. This region must run after widget lifecycle is defined and before panel layout hydration. Panel primitive delegates created earlier rely on these assignments before they are invoked.

Canary: panel pin stops toggling, panel resize-snap fails, panel containment APIs are null, initial widgets do not get tools.

Safety: EDIT-WITH-CARE. It is mostly wiring but load-bearing.

### 4791-5138 - Panel Layout Lifecycle and Event Binding

Owns: panel layout hydration, nested `initPanel`, internal widget layout initialization, panel tool drawer lifecycle, color menu positioning, panel action/move/resize binding, panel child hover binding, panel expansion/collapse interaction bridges.

Shared mutable state: `layout.__initPanel`, `panel.dataset.panelInitialized`, `panel.__dashboardToolDrawer`, per-panel `movedDuringPointer`, `toolsCloseTimer`, `toolPointerCapture`, `suppressHeaderToggleUntil`, `suppressToolOpenUntil`, `ignorePanelToolLeaveCloseUntilPointerActivity`, `releasePanelToolLeaveCloseResume`, `panelToolsOpenedByApproach`, panel color menu open state, `aria-expanded`.

Coupled to: 4306-4752 for internal widget layout init; 4176-4305 delete/color menu factory; 2871-3643 ordered drag; 3644-4175 group resize; 1534-1618 savePanelLayouts; 1998-2870 expansion/reflow helpers; 5139-5323 object add/reset/clipboard.

Init order: must run after `initializePanelRuntimes` assigns panel runtime and after widget lifecycle exists. It must finish before object add or persisted workspace restore assumes `layout.__initPanel`.

Canary: panel recolor/rename/pin/collapse/delete fails, panel drag/resize handlers disappear, panel child hover gets stuck, color menus detach, header clicks toggle while dragging, resize-snap span no longer changes.

Safety: DO-NOT-TOUCH-WITHOUT panel-tool-session split. Reference deferred entries `panel-layout-lifecycle` and `panel-core-primitives`.

### 5139-5323 - Post-Init Tail: Persisted Workspace, Forms, Clipboard, Sources, Controls, Add Runtime, History/Reset

Owns: workspace post-init, persisted workspace snapshot saving, dashboard keyword form rebinding, clipboard runtime assignment, initial layout history seeding, layout source runtime, group selection controls, object add runtime, history/reset runtime, final `DOMContentLoaded` close, and dynamic liquid-glass WebGL import.

Shared mutable state: `savePersistedWorkspaceSnapshot`; reassignment of `copySelectedWorkspaceObjects` and `pasteWorkspaceClipboardObjects`; persisted workspace store; group mode/selection; layout source store; undo/redo stores; all save/load/reset stores; `layout.__initWidget`/`layout.__initPanel` consumers; dynamic import side effect for glass WebGL.

Coupled to: every earlier region through dependency injection. It reads panel/widget save functions, context/data-source loaders, asset loaders, workspace object persistence, grid placement, reflow animation, delete request closures, history functions, and widget/panel primitive delegates.

Init order: must run after widget and panel layouts are initialized so persisted snapshots and reset/history capture the settled DOM. Object add must receive `layout.__initWidget`/`layout.__initPanel` indirectly through the save/add helpers. Clipboard assignment must happen before history/reset uses copy/paste.

Canary: save->reload not identical, reset leaves stale custom objects, copy/paste no-ops, add panel/widget does not bind tools, layout source load misses context/assets, background/search forms stop rebinding, liquid glass layer fails to attach.

Safety: DO-NOT-TOUCH-WITHOUT persistence + reset parity.

## Part B - Shared-State Cross-Reference

| State / convention | Writers | Readers | Canary |
|---|---|---|---|
| `window.dashboard*` side-effect globals | side-effect imports in 1-89 | 90-180, 1787-1997, 4753-4790 | renderer boot, drag/resize/runtime globals undefined |
| `layoutPersistence` aliases and storage keys | 90-180 | 181-355, 356-1179, 1534-1618, 4176-4305, 5139-5323 | save/load/reset mismatch, wrong profile store |
| `refreshWorkspaceMiniMaps` | placeholder in 90-180, assigned via minimap runtime in 356-1179 | removed-engineer-mode shim, workspace post-init in 5139-5323 | minimap stale after add/delete/layout changes |
| `panelRuntime` | declared 181-355, assigned 4753-4790 | 1180-1374, 181-355 facades, 4791-5138 | panel pin stops toggling, panel resize-snap fails |
| `panelContainmentRuntime` | declared 181-355, assigned 4753-4790 | 181-355, 1998-2870, 2871-3643 | panel child containment and absorption fail |
| `requestWorkspaceObjectDelete`, `requestPanelDelete`, `requestWidgetDelete` | placeholders 181-355, assigned 4176-4305 | 4306-4752, 4791-5138, 5139-5323 | delete buttons or reset delete dialog no-op |
| group selection state (`groupSelection`, `groupSelectedIds`, `groupMode`) | 181-355, 5139-5323 controls, lifecycle bindings | 2871-3643, 3644-4175, 4176-4305, 4306-4752, 4791-5138, 5139-5323 | select-mode multi-move/resize fails |
| `copySelectedWorkspaceObjects`, `pasteWorkspaceClipboardObjects` | placeholders 1998-2870, assigned 5139-5323 | 5139-5323 history/reset controls | copy/paste no-op or reset calls stale closures |
| `collisionReflowRuntime` | declared 1787-1997, assigned/used in 1998-2870 | 1787-1997 geometry facade, 1998-2870, 2871-3643, 3644-4175 | collision/reflow preview or sparse placement fails |
| `widgetRuntimeController` | 1619-1786 | 1619-1786, 1787-1997, 4306-4752, 5139-5323 | widget tools/hydration/content fail |
| `window.dashboardWidgetRuntimeMeaning` | 1619-1786 | widget runtime modules and external runtime controls | runtime meaning badges/content stale |
| `window.dashboardAssetRuntime` | 1787-1997 | widget settings/runtime controls, persisted workspace | media widgets lose assets |
| `widgetQueryCache` / `widgetQueryInflight` / `widgetQueryKeys` | 356-1179 | 1619-1786, 1787-1997, widget settings/data services | widget data state stuck loading/stale |
| context datasets (`workspaceContext`, `dataSourceId`, `semanticMapping`, `contextFilters`, `contextTimeRange`, `contextTags`, `contextName`) | 356-1179, 5139-5323 object add/source restore | 356-1179, 1619-1786, 5139-5323 persistence | context-shaped persistence/hydration drift |
| resolved context datasets (`resolvedContextId`, `resolvedWorkspaceRegionId`, `resolvedDataSourceId`, `resolvedSemanticMapping`) | 356-1179 | 1619-1786, 5139-5323 persisted workspace | widget runtime data and badges stale |
| grid datasets (`gridCol`, `gridRow`, `gridRowSpan`, `currentSpan`, `savedHeight`, `defaultSpan`) | 1180-1374, 1534-1618, 1998-2870, 2871-3643, 3644-4175, 4176-4305, 4306-4752, 4791-5138, 5139-5323 | all geometry, save/load, move/resize, parity evidence | resize-snap span/height drift, save->reload mismatch |
| expansion baseline fields (`__expansionBaselineSnapshot`, `__activeExpansionPanels`, `__activeExpansionSource`) | 356-1179, 1998-2870 | 1534-1618, 1998-2870, 4791-5138, 5139-5323 | collapsed/expanded panel footprint wrong |
| widget lifecycle fields (`widget.dataset.widgetInitialized`, `widget.__saveWidgetLayout`, `widget.__dashboardToolDrawer`, `widget.__widgetToolPositionObserver`, `widget.__openCustomization`) | 4306-4752 | widget action/move/resize/runtime controls, object add, clipboard | duplicate handlers, missing tools, tool drawer detaches |
| widget lifecycle timers/flags (`closeTimer`, `suppressToolOpenUntil`, `suppressWidgetClickUntil`, `dragging`, `suppressSettingsClickUntil`, `ignoreToolLeaveCloseUntilPointerActivity`, `releaseToolLeaveCloseResume`, `toolsOpenedByApproach`) | 4306-4752 and bound widget modules | 4306-4752 widget controls, widget move/resize/action runtimes | widget tool flicker, click opens while dragging, settings double-toggle |
| panel lifecycle fields (`panel.dataset.panelInitialized`, `panel.__dashboardToolDrawer`, `layout.__initPanel`) | 4791-5138 | object add, clipboard, persisted workspace, reset | new panels lack controls or duplicate handlers |
| panel lifecycle timers/flags (`movedDuringPointer`, `toolsCloseTimer`, `toolPointerCapture`, `suppressHeaderToggleUntil`, `suppressToolOpenUntil`, `ignorePanelToolLeaveCloseUntilPointerActivity`, `releasePanelToolLeaveCloseResume`, `panelToolsOpenedByApproach`) | 4791-5138 and bound panel modules | panel action/move/resize runtimes | panel pin stops toggling, header toggles during drag, tools flicker |
| body/document interaction classes (`panel-interaction-active`, `panel-resize-active`, `group-transform-active`, drag/resize source classes) | 2871-3643, 3644-4175, resize/drag runtimes | surface tools, CSS, history cleanup, visual LOD | hover/click disabled too long, computed CSS parity drift |
| layout hooks (`layout.__initWidget`, `layout.__initPanel`, `layout.dataset.dragRuntimeDelegateBound`) | 4306-4752, 4791-5138 | object add, clipboard, persisted workspace, internal widget delegation | newly added/pasted items unbound |
| persistent workspace snapshot state (`savePersistedWorkspaceSnapshot`, `persistedWorkspaceKey`) | 5139-5323 | layout source, reset, save/load flows | save->reload not identical |
| liquid glass dynamic import | 5323 | WebGL glass runtime after DOM/CSS app setup | photo background glass enhancement missing |

## Coverage Verification

Declared region ranges:

```text
1-89
90-180
181-355
356-1179
1180-1374
1375-1533
1534-1618
1619-1786
1787-1997
1998-2870
2871-3643
3644-4175
4176-4305
4306-4752
4753-4790
4791-5138
5139-5323
```

Coverage assertion: PASS. The union of Part A region ranges is exactly `1..5323`, with no gaps and no overlaps.

Shared-state spot-check method:

```powershell
rg -n "layoutPersistence|refreshWorkspaceMiniMaps|panelRuntime|panelContainmentRuntime|requestWorkspaceObjectDelete|requestPanelDelete|requestWidgetDelete|groupSelection|groupSelectedIds|getGroupMode|copySelectedWorkspaceObjects|pasteWorkspaceClipboardObjects|collisionReflowRuntime|widgetRuntimeController|dashboardWidgetRuntimeMeaning|dashboardAssetRuntime|widgetQueryCache|widgetQueryInflight|widgetQueryKeys|workspaceContext|resolvedContextId|gridCol|currentSpan|__expansionBaselineSnapshot|widgetInitialized|__saveWidgetLayout|movedDuringPointer|toolsCloseTimer|toolPointerCapture|panel-interaction-active|__initWidget|__initPanel|savePersistedWorkspaceSnapshot|liquid-glass-webgl" app/static/app.js
```

Spot-check assertion: PASS. Each Part B symbol or convention has direct source references in `app/static/app.js`; readers/writers above are grouped by the current line regions that contain those references.

## 2026-06-05 Removed Feature Update

The legacy debug-mode shim, workspace minimap runtime, empty relationship graph shim, object rail selector branches, and relationship-copy clipboard path were deleted after the KEEP-only baseline was re-frozen. Older references in this map to those removed clusters are historical and no longer describe live runtime code. Current KEEP-fused leftovers are tracked in `artifacts/feature-removal-deferred.md`.
