import "./widget-registry.js";
import "./widget-runtime.js";
import "./interaction-state.js";
import "./menu-overlay.js";
import "./layout-persistence.js";
import "./drag-runtime.js";
import "./resize-runtime.js";
import "./dashboard-geometry.js";
import "./panel-runtime.js";
import "./panel-containment.js";
import "./collision-reflow.js";
import { showGlobalToast } from "./modules/toast.js";
import { bindInitialRangeControls } from "./modules/range-controls.js";
import { initializeBackgroundController } from "./modules/background-controller.js";
import { initializeNavStatusMenus } from "./modules/nav-status-menu.js";
import { initializeOverflowTitles } from "./modules/overflow-titles.js";
import { initializeDashboardKeywordSearch } from "./modules/dashboard-keyword-search.js";
import { initializeDashboardSwitcher } from "./modules/dashboard-switcher.js";
import { createAssetRuntime } from "./modules/asset-runtime.js";
import { initializeSurfaceToolsRuntime } from "./modules/surface-tools-runtime.js";
import { createDataAdapterRuntime } from "./modules/data-adapter-runtime.js";
import { initializeObjectAddRuntime } from "./modules/object-add-runtime.js";
import { initializeLayoutSourceRuntime } from "./modules/layout-source-runtime.js";
import { createClipboardRuntime } from "./modules/clipboard-runtime.js";
import { initializeHistoryResetRuntime } from "./modules/history-reset-runtime.js";
import { initializeDeleteRuntime } from "./modules/delete-runtime.js";
import { createResizeAutoZoomRuntime } from "./modules/resize-auto-zoom.js";
import { createLayoutHistoryRuntime } from "./modules/layout-history-runtime.js";
import { initializePanelRuntimes } from "./modules/panel-runtime-setup.js";
import { hydrateWidgetLayout } from "./modules/widget-layout-hydration.js";
import { initializePersistedWorkspaceRuntime } from "./modules/persisted-workspace-runtime.js";
import { initializeWorkspacePostInit } from "./modules/workspace-post-init.js";
import { createGroupSelectionRuntime, initializeGroupSelectionControls } from "./modules/group-selection-controls.js";
import { createDashboardFormBindings } from "./modules/dashboard-form-bindings.js";
import { seedInitialLayoutHistory } from "./modules/layout-history-seeding.js";
import { createWorkspaceObjectModel } from "./modules/workspace-object-model.js";
import { createDashboardToolDrawerRuntime } from "./modules/dashboard-tool-drawer-runtime.js";
import { createReflowAnimationRuntime } from "./modules/reflow-animation-runtime.js";
import { createDashboardDomFactories } from "./modules/dashboard-dom-factories.js";
import {
  queryRelevantWidgetConfig,
  widgetSettingSurface,
  widgetSettingsFields,
  widgetSettingsSchemaForSurface,
} from "./modules/widget-settings-schema.js";
import { createDashboardAssetApi } from "./modules/dashboard-asset-api.js";
import { createWidgetWorkbenchRuntime } from "./modules/widget-workbench-runtime.js";
import { createWidgetRuntimeControls } from "./modules/widget-runtime-controls.js";
import { createWidgetRuntimeData } from "./modules/widget-runtime-data.js";
import { createWidgetSettingsService } from "./modules/widget-settings-service.js";
import { createLayoutSnapshotRuntime } from "./modules/layout-snapshot-runtime.js";
import { bindWidgetActionControls } from "./modules/widget-action-controls.js";
import { bindWidgetMoveRuntime } from "./modules/widget-move-runtime.js";
import { bindWidgetResizeRuntime } from "./modules/widget-resize-runtime.js";
import { createGridMetricsRuntime } from "./modules/grid-metrics-runtime.js";
import { createResizeSurfaceRuntime } from "./modules/resize-surface-runtime.js";
import { widgetHasRowBreakBefore, widgetSpacerSiblingsBefore } from "./modules/widget-layout-persistence-helpers.js";
import { migrateWorkingLayoutProfiles } from "./modules/layout-profile-migration.js";
import { getWorkspaceDeleteDialogElements, workspaceDeleteKind } from "./modules/workspace-delete-dom.js";
import { createPanelContainmentFacade } from "./modules/panel-containment-facade.js";
import { createWidgetRuntimeFacade } from "./modules/widget-runtime-facade.js";
import { createGridItemGeometry } from "./modules/grid-item-geometry.js";
import { createWorkspaceVisualLodRuntime } from "./modules/workspace-visual-lod-runtime.js";
import { createWorkspaceScrollFloorRuntime } from "./modules/workspace-scroll-floor-runtime.js";
import { createPanelFootprintFacade } from "./modules/panel-footprint-facade.js";
import { createMenuOverlayFacade } from "./modules/menu-overlay-facade.js";
import { createPanelPrimitiveFacade } from "./modules/panel-primitive-facade.js";
import { createGridItemSizingRuntime } from "./modules/grid-item-sizing-runtime.js";
import { createResizeSessionGeometry, createWidgetToolSession } from "./modules/interaction-state.js";
import { createOrderedDragRuntime } from "./modules/ordered-drag-runtime.js";
import { createGroupResizeRuntime } from "./modules/group-resize-runtime.js";
import { createWidgetLayoutRuntime } from "./modules/widget-layout-runtime.js";
import { createPanelLayoutRuntime } from "./modules/panel-layout-runtime.js";
import { createOrderedGridItemsRuntime } from "./modules/ordered-grid-items-runtime.js";
import { createConditionalStyleRuntime } from "./modules/conditional-style-runtime.js";
import { createWidgetContentRuntime } from "./modules/widget-content-runtime.js";
import {
  applyPanelColor,
  applyPanelTitleColor,
  createPanelColorMenuFactory,
  hexToRgb,
  panelThemePresets,
  panelToolButtonsMarkup,
  positionPanelColorMenu,
  readableTextFor,
  syncPanelThemeVars,
} from "./modules/panel-appearance-runtime.js";

bindInitialRangeControls();

document.addEventListener("DOMContentLoaded", () => {
  const emitWorkspaceEvent = () => null;
  const showToast = (message, tone = "info") => showGlobalToast(message, tone);  const dashboardInteractionState = window.dashboardInteractionState;
  const dashboardDragRuntime = window.dashboardDragRuntime;
  const dashboardResizeRuntime = window.dashboardResizeRuntime;
  const dashboardPanelRuntime = window.dashboardPanelRuntime;
  const dashboardPanelContainment = window.dashboardPanelContainment;
  const dashboardCollisionReflowRuntime = window.dashboardCollisionReflowRuntime;
  const dashboardMenuOverlayRuntime = window.dashboardMenuOverlayRuntime;
  const {
    menuOverlayLayer,
    originalMenuParent,
    portalFloatingMenu,
    positionPortaledMenu,
    restoreFloatingMenu,
  } = createMenuOverlayFacade({ dashboardMenuOverlayRuntime });
  const {
    portalDashboardToolDrawer,
    restoreDashboardToolDrawer,
    positionDashboardToolDrawer,
    positionDashboardToolDrawerAtPointer,
  } = createDashboardToolDrawerRuntime({
    portalFloatingMenu,
    restoreFloatingMenu,
  });
  initializeBackgroundController({ portalFloatingMenu, restoreFloatingMenu, originalMenuParent });
  let refreshWorkspaceMiniMaps = () => {};

  initializeNavStatusMenus();

  const { scheduleOverflowTitles } = initializeOverflowTitles();
  const { applyDashboardKeywordSearch } = initializeDashboardKeywordSearch({ scheduleOverflowTitles });
  initializeDashboardSwitcher({ portalFloatingMenu, restoreFloatingMenu });
  const layoutPersistence = window.dashboardLayoutPersistence;
  migrateWorkingLayoutProfiles({ layoutPersistence });
  const PERSISTED_WORKSPACE_VERSION = layoutPersistence.version;
  const getActivePanelProfile = layoutPersistence.getActiveProfile;
  const panelStorageKey = layoutPersistence.key.panelStorage;
  const customPanelsKey = layoutPersistence.key.customPanels;
  const hiddenPanelsKey = layoutPersistence.key.hiddenPanels;
  const widgetStorageKey = layoutPersistence.key.widgetStorage;
  const customWidgetsKey = layoutPersistence.key.customWidgets;
  const hiddenWidgetsKey = layoutPersistence.key.hiddenWidgets;
  const dataSourcesKey = layoutPersistence.key.dataSources;
  const workspaceContextsKey = layoutPersistence.key.workspaceContexts;
  const workspaceAssetsKey = layoutPersistence.key.workspaceAssets;
  const persistedWorkspaceKey = layoutPersistence.key.persistedWorkspace;
  const layoutUndoKey = layoutPersistence.key.layoutUndo;
  const layoutSourceKey = layoutPersistence.key.layoutSource;
  const generatedLayoutRegistryKey = layoutPersistence.key.generatedLayoutRegistry;
  const layoutStorageKeys = layoutPersistence.storageKeys;
  const clearLayoutStorage = layoutPersistence.clearScopedStorage;
  const readDraftList = layoutPersistence.readDraftList;
  const writeDraftList = layoutPersistence.writeDraftList;
  const parseJsonRecord = layoutPersistence.parseJsonRecord;
  const readJsonStore = layoutPersistence.readJson;
  const writeJsonStore = layoutPersistence.writeJson;
  const readRawStore = layoutPersistence.readRaw;
  const writeRawStore = layoutPersistence.writeRaw;
  const removeStore = layoutPersistence.remove;
  const {
    assetId,
    mediaWidgetAssetTypes,
    mimeTypeFromSource,
    assetTypeFromMime,
    assetSourceKind,
    normalizeAssetRecord,
    loadAssets,
    saveAssets,
    assetById,
    findAssetBySource,
    registerAsset,
    createAssetFromSource,
    assetSourceRef,
    fileToDataUrl,
  } = createAssetRuntime({ getActivePanelProfile, readJsonStore, writeJsonStore, workspaceAssetsKey });
  const {
    syncLayoutToolsActive,
    isDashboardInteractionActive,
    isInteractionSource,
    surfaceResponseSelector,
    surfaceResponseControlSelector,
    isWorkspaceSurfaceDragStart,
    isWorkspaceObjectInteractiveSurfaceTarget,
    surfaceResponseState,
    clearSurfaceResponse,
    surfaceZoneForPoint,
    surfaceResponseTargetFromEvent,
    updateSurfaceResponse,
    scheduleSurfaceResponse,
    canOpenDashboardTools,
    dashboardSettingsToggleForItem,
    dashboardColorToggleForItem,
    closeInactiveDashboardTools,
    isDashboardToolInteractionTarget,
  } = initializeSurfaceToolsRuntime({
    dashboardInteractionState,
    restoreDashboardToolDrawer,
    restoreFloatingMenu,
    resizeEdgeFromPointer: (...args) => resizeEdgeFromPointer(...args),
    setWidgetLinkNavigationSuspended: (...args) => setWidgetLinkNavigationSuspended(...args),
  });
  const {
    clearGroupSelection,
    getGroupMode,
    groupItemId,
    groupItemKind,
    groupItemLayout,
    groupItemLayoutKey,
    groupPeers,
    groupSelectedIds,
    groupSelection,
    groupTransformItems,
    restoreGroupSelection,
    selectedGroupItems,
    setGroupItemSelected,
    setGroupMode,
    syncGroupButtons,
    toggleGroupItem,
  } = createGroupSelectionRuntime();
  const undoTransientItemClasses = [...layoutPersistence.transientClasses];
  const sanitizeLayoutElementForUndo = layoutPersistence.sanitizeHtml;
  const serializeLayoutElement = layoutPersistence.serializeElement;
  const {
    beginResizeAutoZoomCamera,
    updateResizeAutoZoomCamera,
    endResizeAutoZoomCamera,
    resizeAutoZoomPointerToScenePoint,
  } = createResizeAutoZoomRuntime({
  });
  const {
    pushLiveLayoutUndo,
    captureLayoutUndo,
    restoreLayoutUndo,
    restoreLayoutRedo,
  } = createLayoutHistoryRuntime({
    getActivePanelProfile,
    serializeLayoutElement,
    readRawStore,
    writeRawStore,
    writeJsonStore,
    layoutStorageKeys,
    layoutUndoKey,
    dataSourcesKey,
    workspaceContextsKey,
    undoTransientItemClasses,
    endResizeAutoZoomCamera,
    cleanupWidgetRowBreaks: (...args) => cleanupWidgetRowBreaks(...args),
    cleanupPanelRowBreaks: (...args) => cleanupPanelRowBreaks(...args),
    restoreGroupSelection,
    refreshResolvedContextDebug: (...args) => refreshResolvedContextDebug(...args),
    syncLayoutToolsActive,
  });
  const {
    panelDeleteCancel,
    panelDeleteClose,
    panelDeleteConfirm,
    panelDeleteDialog,
    panelDeleteMessage,
  } = getWorkspaceDeleteDialogElements();
  let requestWorkspaceObjectDelete = () => false;
  let requestPanelDelete = () => false;
  let requestWidgetDelete = () => false;
  const dashboardGeometry = window.dashboardGeometry;
  let panelRuntime = null;
  let panelContainmentRuntime = null;

  const {
    getPanelMinimumWidth,
    gridContentRectForHost,
    gridHostForLayout,
    isPanelInternalGridItem,
    isPanelInternalWidgetLayout,
    panelForInternalWidgetLayout,
    syncPanelMinimumWidth,
  } = createPanelPrimitiveFacade({
    dashboardPanelContainment,
    getPanelRuntime: () => panelRuntime,
  });

  const {
    DASHBOARD_GRID_COLUMNS,
    DASHBOARD_GRID_ROW_HEIGHT,
    createGridMetrics,
    refreshGridMetricsRect,
    gridGapForLayout,
    gridHeightForRows,
    gridRectForLayout,
    gridRowHeightForLayout,
    gridRowsFromHeight,
    isWidgetGridItem,
  } = createGridMetricsRuntime({
    dashboardGeometry,
    gridContentRectForHost,
    gridHostForLayout,
  });

  const {
    WORKSPACE_OBJECT_TYPES,
    WORKSPACE_OBJECT_CAPABILITIES,
    WORKSPACE_CONTEXT_MODEL_VERSION,
    escapeHtml,
    workspaceObjectTypeFromDefinition,
    workspaceObjectType,
    workspaceObjectCapabilities,
    workspaceObjectKey,
    workspaceRootRegionId,
    workspaceRegionIdForDivider,
    CONTEXT_LINK_MODES,
    loadWorkspaceContextLinks,
    contextElementById,
    ensureWorkspaceObjectMetadata,
    workspaceObjectPersistence,
  } = createWorkspaceObjectModel({
    groupItemLayoutKey,
    workspaceContextFromElement: (...args) => workspaceContextFromElement(...args),
  });

  /**
   * Source-agnostic data contracts used by the workspace context layer.
   *
   * DataSource: { id, name, kind, config }
   * DataSourceAdapter: { kind, introspect(source), query(source, request), validateConfig?, suggestSemanticMapping? }
   * DataSchema: { fields: [{ name, type, nullable?, sampleValues? }] }
   * ContextQuery: { fields?, filters?, timeRange?, groupBy?, sort?, limit? }
   * SemanticMapping: { dateField?, valueField?, labelField?, categoryField?, statusField?, ownerField?, locationField?, custom? }
   * WorkspaceContext: { id, name, dataSourceId?, semanticMapping?, filters?, timeRange?, tags?, visualSettings? }
   */
  const {
    dataSourceAdapters,
  } = createDataAdapterRuntime({
    getActivePanelProfile,
    dataSourceById: (...args) => dataSourceById(...args),
  });
  const normalizeDataSource = (source) => ({
    id: String(source?.id || "").trim(),
    name: String(source?.name || source?.id || "Data source").trim(),
    kind: String(source?.kind || "manual").trim(),
    config: source?.config && typeof source.config === "object" ? source.config : {},
  });
  const loadDataSources = (layoutKey = "default", profile = getActivePanelProfile(layoutKey)) =>
    readJsonStore(dataSourcesKey(layoutKey, profile), []).map(normalizeDataSource).filter((source) => source.id);
  const saveDataSources = (layoutKey, profile, sources) => writeJsonStore(dataSourcesKey(layoutKey, profile), sources.map(normalizeDataSource).filter((source) => source.id));
  const loadWorkspaceContexts = (layoutKey = "default", profile = getActivePanelProfile(layoutKey)) =>
    readJsonStore(workspaceContextsKey(layoutKey, profile), []).filter((context) => context?.id);
  const saveWorkspaceContexts = (layoutKey, profile, contexts) => writeJsonStore(workspaceContextsKey(layoutKey, profile), contexts.filter((context) => context?.id));
  const workspaceContextFromElement = (item) => {
    const raw = parseJsonRecord(item?.dataset?.workspaceContext, null) || {};
    const mapping = parseJsonRecord(item?.dataset?.semanticMapping, null) || raw.semanticMapping || null;
    const filters = parseJsonRecord(item?.dataset?.contextFilters, null) || raw.filters || null;
    const timeRange = parseJsonRecord(item?.dataset?.contextTimeRange, null) || raw.timeRange || null;
    const tags = parseJsonRecord(item?.dataset?.contextTags, null) || raw.tags || null;
    const dataSourceId = item?.dataset?.dataSourceId || raw.dataSourceId || null;
    if (!dataSourceId && !mapping && !filters && !timeRange && !tags && !raw.name && !raw.visualSettings) return null;
    return {
      id: item?.dataset?.contextScopeId || item?.dataset?.workspaceRegionId || workspaceObjectKey(item),
      name: item?.dataset?.contextName || raw.name || item?.dataset?.panelTitle || item?.dataset?.defaultTitle || "Workspace context",
      dataSourceId: dataSourceId || undefined,
      semanticMapping: mapping || undefined,
      filters: filters || undefined,
      timeRange: timeRange || undefined,
      tags: tags || undefined,
      visualSettings: raw.visualSettings || undefined,
    };
  };
  const applyWorkspaceContextToElement = (item, context) => {
    if (!item || !context) return;
    item.dataset.workspaceContext = JSON.stringify(context);
    if (context.dataSourceId) item.dataset.dataSourceId = context.dataSourceId;
    if (context.semanticMapping) item.dataset.semanticMapping = JSON.stringify(context.semanticMapping);
    if (context.filters) item.dataset.contextFilters = JSON.stringify(context.filters);
    if (context.timeRange) item.dataset.contextTimeRange = JSON.stringify(context.timeRange);
    if (context.tags) item.dataset.contextTags = JSON.stringify(context.tags);
    if (context.name) item.dataset.contextName = context.name;
  };
  const mergeWorkspaceContexts = (...contexts) => contexts.filter(Boolean).reduce((merged, context) => {
    const scalarContext = Object.fromEntries(Object.entries(context)
      .filter(([key, value]) =>
        !["semanticMapping", "filters", "tags", "visualSettings"].includes(key) &&
        value !== undefined &&
        value !== null
      ));
    return {
      ...merged,
      ...scalarContext,
      semanticMapping: {
        ...(merged.semanticMapping || {}),
        ...(context.semanticMapping || {}),
        custom: {
          ...(merged.semanticMapping?.custom || {}),
          ...(context.semanticMapping?.custom || {}),
        },
      },
      filters: [...(merged.filters || []), ...(context.filters || [])],
      tags: [...new Set([...(merged.tags || []), ...(context.tags || [])])],
      visualSettings: {
        ...(merged.visualSettings || {}),
        ...(context.visualSettings || {}),
      },
    };
  }, {});
  const filterControlFieldForType = (filter, semanticMapping = {}) => {
    const explicit = String(filter?.field || "").trim();
    if (explicit) return explicit;
    if (filter?.type === "number-range") return semanticMapping.valueField || "";
    if (filter?.type === "date-range") return semanticMapping.dateField || "";
    if (filter?.type === "boolean") return semanticMapping.statusField || semanticMapping.categoryField || "";
    if (filter?.type === "dropdown" || filter?.type === "category" || filter?.type === "multi-select") {
      return semanticMapping.categoryField || semanticMapping.statusField || semanticMapping.ownerField || semanticMapping.labelField || "";
    }
    return semanticMapping.labelField || semanticMapping.categoryField || semanticMapping.statusField || "";
  };
  const normalizedFilterWidgetFilters = (widget, inheritedContext = {}) => {
    if (!widget || widget.hidden || widget.dataset.widgetDefinition !== "filter") return [];
    const config = parseJsonRecord(widget.dataset.widgetConfig, {}) || {};
    const semanticMapping = inheritedContext.semanticMapping || {};
    const filters = Array.isArray(config.filters) ? config.filters : [];
    return filters.flatMap((filter) => {
      const type = filter.type || "text";
      const field = filterControlFieldForType(filter, semanticMapping);
      if (!field) return [];
      if (type === "number-range") {
        return [
          filter.min !== "" && filter.min != null ? { field, operator: "gte", value: filter.min } : null,
          filter.max !== "" && filter.max != null ? { field, operator: "lte", value: filter.max } : null,
        ].filter(Boolean);
      }
      if (type === "date-range") {
        return [
          filter.start ? { field, operator: "gte", value: filter.start } : null,
          filter.end ? { field, operator: "lte", value: filter.end } : null,
        ].filter(Boolean);
      }
      if (type === "multi-select") {
        const values = Array.isArray(filter.values) ? filter.values.filter((value) => value !== "" && value != null) : [];
        return values.length ? [{ field, operator: "in", value: values }] : [];
      }
      if (type === "boolean") {
        return filter.enabled ? [{ field, operator: "eq", value: Boolean(filter.value ?? true) }] : [];
      }
      const value = filter.value;
      if (value == null || value === "") return [];
      return [{ field, operator: filter.operator || (type === "text" ? "contains" : "eq"), value }];
    });
  };
  const normalizedTimeframeWidgetRange = (widget, inheritedContext = {}) => {
    if (!widget || widget.hidden || widget.dataset.widgetDefinition !== "timeframe") return null;
    const config = parseJsonRecord(widget.dataset.widgetConfig, {}) || {};
    const resolved = window.dashboardWidgetRuntime?.resolveTimeRangeConfig?.(config, inheritedContext);
    if (!resolved?.start && !resolved?.end) return null;
    return resolved;
  };
  const filterWidgetsForRegion = (layoutKey, regionId) => [
    ...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card[data-widget-definition="filter"]:not([hidden])`),
    ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card[data-widget-definition="filter"]:not([hidden])`),
  ].filter((widget) => regionIdForWorkspaceItem(widget) === regionId);
  const timeframeWidgetsForRegion = (layoutKey, regionId) => [
    ...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card[data-widget-definition="timeframe"]:not([hidden])`),
    ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card[data-widget-definition="timeframe"]:not([hidden])`),
  ].filter((widget) => regionIdForWorkspaceItem(widget) === regionId);
  const timeRangeContextForRegion = (layoutKey, regionId, inheritedContext = {}) => {
    const ranges = timeframeWidgetsForRegion(layoutKey, regionId)
      .map((widget) => normalizedTimeframeWidgetRange(widget, inheritedContext))
      .filter(Boolean);
    const timeRange = ranges[ranges.length - 1] || null;
    return timeRange ? { timeRange } : null;
  };
  const filterContextForRegion = (layoutKey, regionId, inheritedContext = {}) => {
    const filters = filterWidgetsForRegion(layoutKey, regionId)
      .flatMap((widget) => normalizedFilterWidgetFilters(widget, inheritedContext));
    return filters.length ? { filters } : null;
  };
  const dataSourceById = (layoutKey, profile, id) => loadDataSources(layoutKey, profile).find((source) => source.id === id) || null;
  const contextById = (layoutKey, profile, id) => loadWorkspaceContexts(layoutKey, profile).find((context) => context.id === id) || null;
  const activeLayoutKeyForItem = (item) => {
    const layout = groupItemLayout(item) || item?.closest?.(".widget-layout, .panel-layout");
    return gridItemLayoutKey(layout || document.querySelector(".panel-layout") || document.querySelector(".widget-layout"));
  };
  const activeExpansionBaselineLayoutForItem = (item) => {
    if (!item || isPanelInternalGridItem(item)) return null;
    if (item.closest?.(".panel-layout")) return item.closest(".panel-layout");
    const layoutKey = activeLayoutKeyForItem(item) || "default";
    return document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
  };
  const layoutHasActiveExpansionSource = (layout) => [...(layout?.__activeExpansionPanels || [])]
    .some((panel) => panel?.isConnected && panel.__activeExpansionSource && !panel.classList.contains("db-panel-collapsed"));
  const expansionBaselineStateForItem = (item) => {
    const layout = activeExpansionBaselineLayoutForItem(item);
    const snapshot = layout?.__expansionBaselineSnapshot;
    if (!snapshot || !layoutHasActiveExpansionSource(layout)) return null;
    if (item?.__activeExpansionSource && layout.__activeExpansionPanels?.has(item)) return null;
    return snapshot.get(item) || null;
  };
  const gridStateFromElement = (item) => ({
    gridCol: item.dataset.gridCol,
    gridRow: item.dataset.gridRow,
    gridRowSpan: item.dataset.gridRowSpan,
    currentSpan: item.dataset.currentSpan,
    savedHeight: item.dataset.savedHeight,
    gridColumnStyle: item.style.gridColumn,
    gridRowStyle: item.style.gridRow,
    heightStyle: item.style.height,
  });
  const applyGridStateToElement = (item, state = {}) => {
    if (!item || !state) return;
    ["gridCol", "gridRow", "gridRowSpan", "currentSpan", "savedHeight"].forEach((key) => {
      if (state[key] === undefined || state[key] === null || state[key] === "") {
        delete item.dataset[key];
      } else {
        item.dataset[key] = state[key];
      }
    });
    item.style.gridColumn = state.gridColumnStyle || "";
    item.style.gridRow = state.gridRowStyle || "";
    item.style.height = state.heightStyle || "";
  };
  const persistentGridStateForItem = (item) => expansionBaselineStateForItem(item) || gridStateFromElement(item);
  const commitExpansionBaselineForItem = (item) => {
    const layout = activeExpansionBaselineLayoutForItem(item);
    const snapshot = layout?.__expansionBaselineSnapshot;
    if (!snapshot || !layoutHasActiveExpansionSource(layout) || !snapshot.has(item)) return;
    snapshot.set(item, gridStateFromElement(item));
  };
  const dividerForRegionId = (regionId, layoutKey = "builder") => {
    if (!regionId || regionId === workspaceRootRegionId(layoutKey)) return null;
    return [...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .db-panel:not([hidden])`)]
      .find((panel) => workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider &&
        (workspaceRegionIdForDivider(panel, layoutKey) === regionId || panel.dataset.contextScopeId === regionId || panel.dataset.workspaceRegionId === regionId)) || null;
  };
  const contextLinksForTarget = (layoutKey, profile, targetId) =>
    loadWorkspaceContextLinks(layoutKey, profile).filter((link) => link.enabled !== false && link.targetObjectId === targetId);
  const mergeLinkedContext = (baseContext = {}, linkedContext = {}, mode = CONTEXT_LINK_MODES.inherit) => {
    if (!linkedContext || !Object.keys(linkedContext).length || mode === CONTEXT_LINK_MODES.reference) return baseContext || {};
    if (mode === CONTEXT_LINK_MODES.override) return mergeWorkspaceContexts(baseContext, linkedContext);
    return mergeWorkspaceContexts(linkedContext, baseContext);
  };
  const baseContextForSourceObject = (sourceId, layoutKey, profile, stack = new Set()) => {
    const id = String(sourceId || "");
    if (!id || stack.has(id)) return null;
    const directContext = contextById(layoutKey, profile, id);
    if (directContext) return directContext;
    const source = contextElementById(id, layoutKey);
    if (!source) return null;
    const nextStack = new Set(stack);
    nextStack.add(id);
    if (workspaceObjectType(source) === WORKSPACE_OBJECT_TYPES.divider) {
      const regionId = workspaceRegionIdForDivider(source, layoutKey);
      return resolveWorkspaceRegionContext(layoutKey, profile, regionId, nextStack);
    }
    return resolveWorkspaceContextForItem(source, { layoutKey, profile, contextLinkStack: nextStack });
  };
  const linkedContextForTarget = (targetId, layoutKey, profile, baseContext = {}, stack = new Set()) => {
    const links = contextLinksForTarget(layoutKey, profile, targetId);
    if (!links.length || stack.has(targetId)) return baseContext || {};
    const nextStack = new Set(stack);
    nextStack.add(targetId);
    return links.reduce((context, link) => {
      const sourceContext = baseContextForSourceObject(link.sourceObjectId, layoutKey, profile, nextStack);
      return mergeLinkedContext(context, sourceContext, link.mode);
    }, baseContext || {});
  };
  const resolveWorkspaceRegionContext = (layoutKey, profile, regionId, stack = new Set()) => {
    const rootContext = contextById(layoutKey, profile, workspaceRootRegionId(layoutKey));
    const regionContext = contextById(layoutKey, profile, regionId);
    const divider = dividerForRegionId(regionId, layoutKey);
    const targetId = divider ? workspaceObjectKey(divider) : regionId;
    if (!targetId) return mergeWorkspaceContexts(rootContext, regionContext);
    const linkedRegionContext = linkedContextForTarget(targetId, layoutKey, profile, regionContext || {}, stack);
    return mergeWorkspaceContexts(rootContext, linkedRegionContext);
  };
  const regionIdForWorkspaceItem = (item) => {
    const internalPanel = panelForInternalWidgetLayout(item?.closest?.(".panel-internal-widget-grid"));
    if (internalPanel) return internalPanel.dataset.workspaceRegionId || internalPanel.dataset.contextInheritedFrom;
    return item?.dataset?.workspaceRegionId || item?.dataset?.contextInheritedFrom || workspaceRootRegionId(activeLayoutKeyForItem(item));
  };
  const panelContextForInternalWidget = (item) => {
    const internalPanel = panelForInternalWidgetLayout(item?.closest?.(".panel-internal-widget-grid"));
    return internalPanel ? workspaceContextFromElement(internalPanel) : null;
  };
  const resolveWorkspaceContextForItem = (item, options = {}) => {
    const layoutKey = options.layoutKey || activeLayoutKeyForItem(item);
    const profile = options.profile || getActivePanelProfile(layoutKey);
    const regionId = regionIdForWorkspaceItem(item);
    const objectId = workspaceObjectKey(item);
    const localContext = workspaceContextFromElement(item);
    const panelContext = panelContextForInternalWidget(item);
    const inheritedContext = resolveWorkspaceRegionContext(layoutKey, profile, regionId, options.contextLinkStack || new Set());
    const objectLinkedContext = objectId
      ? linkedContextForTarget(objectId, layoutKey, profile, {}, options.contextLinkStack || new Set())
      : {};
    const scopedContext = mergeWorkspaceContexts(inheritedContext, panelContext);
    const timeRangeContext = timeRangeContextForRegion(layoutKey, regionId, scopedContext);
    const filterContext = filterContextForRegion(layoutKey, regionId, mergeWorkspaceContexts(scopedContext, objectLinkedContext, timeRangeContext));
    const resolved = mergeWorkspaceContexts(scopedContext, objectLinkedContext, timeRangeContext, filterContext, localContext);
    const dataSource = resolved.dataSourceId ? dataSourceById(layoutKey, profile, resolved.dataSourceId) : null;
    const adapter = dataSource ? dataSourceAdapters.get(dataSource.kind) : null;
    return {
      id: resolved.id || regionId,
      name: resolved.name || regionId,
      layoutKey,
      profile,
      regionId,
      dataSourceId: resolved.dataSourceId || null,
      dataSourceKind: dataSource?.kind || null,
      dataSourceName: dataSource?.name || null,
      semanticMapping: resolved.semanticMapping || {},
      filters: resolved.filters || [],
      timeRange: resolved.timeRange || null,
      tags: resolved.tags || [],
      visualSettings: resolved.visualSettings || {},
      adapterKind: adapter?.kind || null,
      canQuery: Boolean(dataSource && adapter),
    };
  };
  const queryResolvedWorkspaceContext = async (resolvedContext, request = {}) => {
    if (!resolvedContext?.dataSourceId) {
      return { schema: { fields: [] }, rows: [], total: 0, error: "No data source resolved." };
    }
    const source = dataSourceById(resolvedContext.layoutKey, resolvedContext.profile, resolvedContext.dataSourceId);
    const adapter = source ? dataSourceAdapters.get(source.kind) : null;
    if (!source || !adapter) {
      return { schema: { fields: [] }, rows: [], total: 0, error: "Missing data source adapter." };
    }
    return adapter.query(source, {
      ...request,
      layoutKey: resolvedContext.layoutKey,
      profile: resolvedContext.profile,
      filters: [...(resolvedContext.filters || []), ...(request.filters || [])],
      timeRange: request.timeRange || resolvedContext.timeRange,
      semanticMapping: resolvedContext.semanticMapping || {},
    });
  };
  const QUERY_CACHE_TTL = 30_000;
  const widgetQueryCache = new Map();
  const widgetQueryInflight = new Map();
  const widgetQueryKeys = new WeakMap();
  const stableQueryValue = (value) => {
    if (Array.isArray(value)) return value.map(stableQueryValue);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((record, key) => {
        const next = value[key];
        if (next !== undefined) record[key] = stableQueryValue(next);
        return record;
      }, {});
    }
    return value;
  };
  const stableQueryStringify = (value) => JSON.stringify(stableQueryValue(value));
  const resolvedContextQueryFingerprint = (context = {}) => ({
    layoutKey: context.layoutKey || "",
    profile: context.profile || "",
    regionId: context.regionId || "",
    dataSourceId: context.dataSourceId || "",
    dataSourceKind: context.dataSourceKind || "",
    adapterKind: context.adapterKind || "",
    semanticMapping: context.semanticMapping || {},
    filters: context.filters || [],
    timeRange: context.timeRange || null,
    tags: context.tags || [],
  });
  const queryRowsAreEmpty = (result) => {
    if (!result || result.error) return false;
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const total = Number.isFinite(Number(result.total)) ? Number(result.total) : rows.length;
    return rows.length === 0 && total <= 0;
  };
  const widgetQueryKeyFor = ({ definition, instance, resolvedContext, query }) => stableQueryStringify({
    widgetType: definition?.type || instance?.type || "widget",
    queryConfig: queryRelevantWidgetConfig(definition, instance?.config || {}),
    context: resolvedContextQueryFingerprint(resolvedContext),
    query: query || null,
  });
  const stateFromQueryResult = (result, resolvedContext) => ({
    status: result?.error ? "error" : queryRowsAreEmpty(result) ? "empty" : "ready",
    data: {
      ...(result || {}),
      semanticMapping: resolvedContext?.semanticMapping || {},
    },
    error: result?.error || null,
    lastUpdated: Date.now(),
    isRefreshing: false,
  });
  const demoQueryStateForWidget = async (definition, instance, resolvedContext, options = {}) => {
    if (typeof definition?.getDemoData !== "function") return null;
    const demo = definition.getDemoData(instance.config || {}, resolvedContext || {}) || null;
    const rows = Array.isArray(demo?.rows) ? demo.rows : [];
    if (!rows.length) return null;
    const semanticMapping = {
      ...(demo.semanticMapping || {}),
      ...(resolvedContext?.semanticMapping || {}),
    };
    const demoContext = {
      ...(resolvedContext || {}),
      id: resolvedContext?.id || `${definition.type || "widget"}:demo`,
      name: resolvedContext?.name || demo.name || "Demo data",
      dataSourceId: demo.sourceId || "__demo-widget-source",
      dataSourceName: demo.sourceName || "Demo data",
      dataSourceKind: "manual",
      adapterKind: "manual",
      semanticMapping,
      canQuery: true,
    };
    const query = typeof definition.resolveQuery === "function"
      ? definition.resolveQuery(instance.config || {}, demoContext)
      : null;
    if (!query) return null;
    const adapter = dataSourceAdapters.get("manual");
    if (!adapter) return null;
    const result = await adapter.query({
      id: demoContext.dataSourceId,
      name: demoContext.dataSourceName,
      kind: "manual",
      config: {
        rows,
        schema: demo.schema?.fields || demo.fields || [],
      },
    }, {
      ...query,
      filters: [...(demoContext.filters || []), ...(query.filters || [])],
      timeRange: query.timeRange || demoContext.timeRange,
      semanticMapping,
    });
    return {
      context: demoContext,
      query,
      state: stateFromQueryResult({
        ...result,
        demo: true,
        sourceId: demoContext.dataSourceId,
        sourceKind: "manual",
      }, demoContext),
    };
  };
  const errorQueryState = (error) => ({
    status: "error",
    data: { error: error?.message || "Query failed" },
    error: error?.message || "Query failed",
    lastUpdated: Date.now(),
    isRefreshing: false,
  });
  const beginManagedWidgetQuery = ({ definition, instance, resolvedContext, query, force = false }) => {
    if (!query || !resolvedContext?.canQuery) {
      return {
        key: "",
        state: {
          status: "empty",
          data: null,
          error: null,
          lastUpdated: null,
          isRefreshing: false,
        },
        promise: null,
      };
    }
    const key = widgetQueryKeyFor({ definition, instance, resolvedContext, query });
    const cached = widgetQueryCache.get(key);
    const cachedAge = cached?.lastUpdated ? Date.now() - cached.lastUpdated : Number.POSITIVE_INFINITY;
    const inflight = widgetQueryInflight.get(key);
    if (cached && !force && cachedAge < QUERY_CACHE_TTL && !inflight) {
      return { key, state: { ...cached, isRefreshing: false }, promise: null };
    }
    if (inflight) {
      return {
        key,
        state: cached
          ? { ...cached, status: "stale", isRefreshing: true }
          : { status: "loading", data: null, error: null, lastUpdated: null, isRefreshing: true },
        promise: inflight.promise,
      };
    }
    const controller = new AbortController();
    emitWorkspaceEvent({
      type: "data-query-started",
      source: "query-runtime",
      layoutKey: resolvedContext.layoutKey || "builder",
      regionId: resolvedContext.regionId || "",
      objectId: instance?.id || "",
      objectType: definition?.type || instance?.type || "widget",
      label: `${definition?.displayName || "Widget"} query started`,
      payload: {
        queryKey: key,
        dataSourceId: resolvedContext.dataSourceId || "",
        status: "loading",
      },
    });
    const promise = queryResolvedWorkspaceContext(resolvedContext, {
      ...query,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return cached || { status: "idle", data: null, error: null, lastUpdated: null, isRefreshing: false };
        const state = stateFromQueryResult(result, resolvedContext);
        widgetQueryCache.set(key, state);
        emitWorkspaceEvent({
          type: result?.error ? "data-query-failed" : "data-query-succeeded",
          source: "query-runtime",
          layoutKey: resolvedContext.layoutKey || "builder",
          regionId: resolvedContext.regionId || "",
          objectId: instance?.id || "",
          objectType: definition?.type || instance?.type || "widget",
          label: result?.error
            ? `${definition?.displayName || "Widget"} query failed`
            : `${definition?.displayName || "Widget"} query succeeded`,
          detail: result?.error || "",
          payload: {
            queryKey: key,
            dataSourceId: resolvedContext.dataSourceId || "",
            rowCount: Array.isArray(result?.rows) ? result.rows.length : 0,
            total: Number.isFinite(Number(result?.total)) ? Number(result.total) : null,
            status: state.status,
          },
        });
        return state;
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === "AbortError") {
          return cached || { status: "idle", data: null, error: null, lastUpdated: null, isRefreshing: false };
        }
        const state = errorQueryState(error);
        widgetQueryCache.set(key, state);
        emitWorkspaceEvent({
          type: "data-query-failed",
          source: "query-runtime",
          layoutKey: resolvedContext.layoutKey || "builder",
          regionId: resolvedContext.regionId || "",
          objectId: instance?.id || "",
          objectType: definition?.type || instance?.type || "widget",
          label: `${definition?.displayName || "Widget"} query failed`,
          detail: error?.message || "Query failed",
          payload: {
            queryKey: key,
            dataSourceId: resolvedContext.dataSourceId || "",
            status: "error",
          },
        });
        return state;
      })
      .finally(() => {
        const current = widgetQueryInflight.get(key);
        if (current?.controller === controller) widgetQueryInflight.delete(key);
      });
    widgetQueryInflight.set(key, { promise, controller, startedAt: Date.now() });
    return {
      key,
      state: cached
        ? { ...cached, status: "stale", isRefreshing: true }
        : { status: "loading", data: null, error: null, lastUpdated: null, isRefreshing: true },
      promise,
    };
  };
  const invalidateManagedWidgetQueries = (predicate = null) => {
    if (!predicate) {
      widgetQueryCache.clear();
      return;
    }
    [...widgetQueryCache.keys()].forEach((key) => {
      let parsed = null;
      try {
        parsed = JSON.parse(key);
      } catch {}
      if (predicate(parsed, key)) widgetQueryCache.delete(key);
    });
  };
  const invalidateManagedWidgetQueriesForLayout = (layoutKey = "builder") => {
    invalidateManagedWidgetQueries((entry) => !entry || entry.context?.layoutKey === layoutKey);
  };
  const invalidateManagedWidgetQueryForWidget = (widget) => {
    const key = widget ? widgetQueryKeys.get(widget) || widget.dataset.widgetQueryKey || "" : "";
    if (key) widgetQueryCache.delete(key);
  };
  const cancelManagedWidgetQueryKey = (key) => {
    const inflight = key ? widgetQueryInflight.get(key) : null;
    if (!inflight) return false;
    inflight.controller.abort();
    widgetQueryInflight.delete(key);
    return true;
  };
  const cancelManagedWidgetQueryForWidget = (widget) => {
    if (!widget) return false;
    widget.dataset.widgetQuerySeq = String((Number(widget.dataset.widgetQuerySeq) || 0) + 1);
    return cancelManagedWidgetQueryKey(widgetQueryKeys.get(widget) || widget.dataset.widgetQueryKey || "");
  };
  const managedQueryStateForWidget = (widget) => {
    const key = widget ? widgetQueryKeys.get(widget) || widget.dataset.widgetQueryKey || "" : "";
    return key ? widgetQueryCache.get(key) || null : null;
  };
  const describeResolvedContext = (context) => {
    const mapping = context.semanticMapping || {};
    const mappedFields = [mapping.dateField, mapping.valueField, mapping.labelField, mapping.categoryField].filter(Boolean);
    return [context.dataSourceName || context.dataSourceId || "No source", ...mappedFields.slice(0, 2)].join(" / ");
  };
  const refreshResolvedContextDebug = (layoutKey = "default", profile = getActivePanelProfile(layoutKey)) => {
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
    if (panelLayout) syncWorkspaceRegions(panelLayout);
    if (widgetLayout) syncWorkspaceRegions(widgetLayout);
    const items = [
      ...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card`),
      ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .db-panel`),
      ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card`),
    ];
    items.forEach((item) => {
      const resolved = resolveWorkspaceContextForItem(item, { layoutKey, profile });
      const hasResolvedContext = Boolean(resolved.dataSourceId || Object.keys(resolved.semanticMapping || {}).length);
      item.dataset.resolvedContextId = resolved.id || "";
      item.dataset.resolvedWorkspaceRegionId = resolved.regionId || "";
      item.dataset.resolvedDataSourceId = resolved.dataSourceId || "";
      item.dataset.resolvedSemanticMapping = JSON.stringify(resolved.semanticMapping || {});
      let badge = item.querySelector(":scope > .workspace-context-badge");
      if (!hasResolvedContext || badge) badge?.remove();
      if (item.classList.contains("widget-card")) void refreshWidgetRuntimeData(item, resolved);
    });
    refreshWorkspaceMiniMaps(layoutKey);
  };
  const saveWorkspaceContextState = (layoutKey, profile = getActivePanelProfile(layoutKey), options = {}) => {
    const persist = Boolean(options.persist);
    const contexts = loadWorkspaceContexts(layoutKey, profile);
    const byId = new Map(contexts.map((context) => [context.id, context]));
    document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .db-panel`).forEach((item) => {
      const context = workspaceContextFromElement(item);
      if (!context?.id) return;
      byId.set(context.id, { ...byId.get(context.id), ...context });
    });
    saveWorkspaceContexts(layoutKey, profile, [...byId.values()]);
    invalidateManagedWidgetQueriesForLayout(layoutKey);
    refreshResolvedContextDebug(layoutKey, profile);
    if (!persist && options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
  };
  const syncWorkspaceRegions = (layout) => {
    if (!layout) return;
    const host = gridHostForLayout(layout);
    const layoutKey = gridItemLayoutKey(layout);
    const profile = getActivePanelProfile(layoutKey);
    const contextDefinitions = loadWorkspaceContexts(layoutKey, profile);
    const contextByRegion = new Map(contextDefinitions.map((context) => [context.id, context]));
    let activeRegion = workspaceRootRegionId(layoutKey);
    visualGridOrder(globalGridItems(layout, { includePlaceholders: false })).forEach((item) => {
      ensureWorkspaceObjectMetadata(item);
      if (workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.divider) {
        activeRegion = workspaceRegionIdForDivider(item, layoutKey);
        item.dataset.contextScopeId = activeRegion;
        item.dataset.workspaceRegionId = activeRegion;
        item.dataset.contextRole = "semantic-boundary";
        item.dataset.navigationTargetId = activeRegion;
        const explicitContext = workspaceContextFromElement(item);
        if (explicitContext?.id) contextByRegion.set(activeRegion, { ...contextByRegion.get(activeRegion), ...explicitContext, id: activeRegion });
        return;
      }
      item.dataset.workspaceRegionId = activeRegion;
      item.dataset.contextInheritedFrom = activeRegion;
    });
    if (contextByRegion.size !== contextDefinitions.length || [...contextByRegion.values()].some((context, index) => context !== contextDefinitions[index])) {
      saveWorkspaceContexts(layoutKey, profile, [...contextByRegion.values()]);
    }
    host?.setAttribute("data-workspace-context-model", WORKSPACE_CONTEXT_MODEL_VERSION);
  };
  const committedContextRegionLayout = (layoutKey = "builder") => (
    document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`) ||
    document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`)
  );
  const isCommittedContextRegionItem = (item) => (
    item &&
    !item.hidden &&
    !(workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.widget && widgetLayerForElement(item) === "backend") &&
    !item.classList.contains("db-panel-placeholder") &&
    !item.classList.contains("widget-placeholder") &&
    !item.classList.contains("dashboard-live-resize") &&
    !item.classList.contains("dashboard-resize-source") &&
    !item.classList.contains("db-panel-dragging") &&
    !item.classList.contains("widget-dragging")
  );
  const committedDividerRegionEntries = (layoutKey = "builder") => {
    const layout = committedContextRegionLayout(layoutKey);
    if (!layout) return [];
    syncWorkspaceRegions(layout);
    return visualGridOrder(globalGridItems(layout, { includePlaceholders: false }))
      .filter((item) => workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.divider)
      .filter(isCommittedContextRegionItem)
      .map((divider) => ({
        divider,
        key: workspaceObjectKey(divider),
        regionId: workspaceRegionIdForDivider(divider, layoutKey),
        bounds: gridBoundsForItem(divider),
      }));
  };
  const deriveWorkspaceContextRegions = (layoutKey = "builder") => {
    const dividers = committedDividerRegionEntries(layoutKey);
    const rootRegionId = workspaceRootRegionId(layoutKey);
    if (!dividers.length) {
      return [{
        id: rootRegionId,
        type: "context-region",
        layoutKey,
        dividerKey: null,
        startsAfterDividerKey: null,
        startRow: 1,
        endRow: null,
      }];
    }
    const rootEnd = Math.max(0, (Number(dividers[0].bounds.row) || 1) - 1);
    return [
      {
        id: rootRegionId,
        type: "context-region",
        layoutKey,
        dividerKey: null,
        startsAfterDividerKey: null,
        startRow: 1,
        endRow: rootEnd,
      },
      ...dividers.map((entry, index) => {
        const startRow = Math.max(1, Number(entry.bounds.row) || 1);
        const nextRow = Number(dividers[index + 1]?.bounds?.row) || null;
        return {
          id: entry.regionId,
          type: "context-region",
          layoutKey,
          dividerKey: entry.key,
          startsAfterDividerKey: entry.key,
          startRow,
          endRow: nextRow ? Math.max(startRow, nextRow - 1) : null,
        };
      }),
    ];
  };
  const gridRowFromContextRegionInput = (value, layoutKey = "builder") => {
    if (Number.isFinite(Number(value))) return Math.max(1, Math.round(Number(value)));
    const node = typeof value === "string" ? document.querySelector(value) : value;
    if (node?.nodeType === 1) return Math.max(1, Number(gridBoundsForItem(node).row) || 1);
    const layout = committedContextRegionLayout(layoutKey);
    return Math.max(1, Number(layout?.dataset?.visibleStartRow) || 1);
  };
  const nearestDividerAboveCommittedRow = (value, layoutKey = "builder") => {
    const row = gridRowFromContextRegionInput(value, layoutKey);
    return committedDividerRegionEntries(layoutKey)
      .filter((entry) => (Number(entry.bounds.row) || 1) <= row)
      .pop() || null;
  };
  const resolveWorkspaceRegionForY = (value, layoutKey = "builder") => {
    const row = gridRowFromContextRegionInput(value, layoutKey);
    return deriveWorkspaceContextRegions(layoutKey)
      .find((region) => row >= region.startRow && (region.endRow === null || row <= region.endRow)) ||
      { id: workspaceRootRegionId(layoutKey), type: "context-region", layoutKey, startRow: 1, endRow: null };
  };

  const allCommittedWorkspaceGridItems = (layoutKey = "builder") => {
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]:not(.panel-internal-widget-grid)`);
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    return [
      ...(widgetLayout ? globalGridItems(widgetLayout, { includePlaceholders: false }) : []),
      ...(panelLayout ? globalGridItems(panelLayout, { includePlaceholders: false }) : []),
    ].filter(isCommittedContextRegionItem);
  };

  const regionLabelForSummary = (regionId, layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    if (regionId === workspaceRootRegionId(layoutKey)) return "Top region";
    const divider = committedDividerRegionEntries(layoutKey)
      .find((entry) => entry.regionId === regionId)?.divider;
    const dividerLabel = divider?.querySelector?.(".db-panel-title, .divider-title, .stat-lbl")?.textContent?.trim();
    const contextLabel = contextById(layoutKey, profile, regionId)?.name;
    return dividerLabel || contextLabel || "Divider region";
  };

  const workspaceRegionSummaryForItem = (itemOrKey, options = {}) => {
    const item = typeof itemOrKey === "string"
      ? document.querySelector(`[data-widget-key="${CSS.escape(itemOrKey)}"], [data-panel-key="${CSS.escape(itemOrKey)}"]`)
      : itemOrKey;
    const layoutKey = options.layoutKey || activeLayoutKeyForItem(item) || "builder";
    const profile = options.profile || getActivePanelProfile(layoutKey);
    const regionId = item ? regionIdForWorkspaceItem(item) : workspaceRootRegionId(layoutKey);
    const regions = deriveWorkspaceContextRegions(layoutKey);
    const region = regions.find((entry) => entry.id === regionId) || resolveWorkspaceRegionForY(item, layoutKey);
    const items = allCommittedWorkspaceGridItems(layoutKey)
      .filter((candidate) => candidate !== item && regionIdForWorkspaceItem(candidate) === regionId);
    const counts = items.reduce((acc, candidate) => {
      const type = workspaceObjectType(candidate);
      if (type === WORKSPACE_OBJECT_TYPES.divider) acc.dividers += 1;
      else if (type === WORKSPACE_OBJECT_TYPES.panel) acc.panels += 1;
      else acc.widgets += 1;
      return acc;
    }, { widgets: 0, panels: 0, dividers: 0 });
    const context = resolveWorkspaceContextForItem(item || committedContextRegionLayout(layoutKey), { layoutKey, profile });
    return {
      id: regionId,
      label: regionLabelForSummary(regionId, layoutKey, profile),
      startRow: region?.startRow || 1,
      endRow: region?.endRow || null,
      widgets: counts.widgets,
      panels: counts.panels,
      dividers: counts.dividers,
      totalObjects: counts.widgets + counts.panels + counts.dividers,
      dataSourceName: context?.dataSourceName || context?.dataSourceId || "",
      tags: Array.isArray(context?.tags) ? context.tags : [],
    };
  };

  const initWorkspaceMinimapLayer = () => {};

  const {
    gridItemLayoutKey,
    gridItemMinimumRows,
    gridItemMinimumSpan,
    gridItemRowSpan,
    panelExpandedMinimumRows,
    panelMinimumRows,
    saveSharedGridLayouts,
    syncPanelRenderedHeightToFootprint,
  } = createGridItemSizingRuntime({
    DASHBOARD_GRID_ROW_HEIGHT,
    getPanelRuntime: () => panelRuntime,
    gridGapForLayout,
    gridHostForLayout,
    gridRowsFromHeight,
    isPanelInternalWidgetLayout,
    panelForInternalWidgetLayout,
    savePanelLayouts: (...args) => savePanelLayouts(...args),
    saveWidgetLayouts: (...args) => saveWidgetLayouts(...args),
    workspaceObjectCapabilities,
  });

  const gridCellFromPoint = (layout, item, clientX, clientY, metrics = null) => {
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const columnWidth = metrics?.columnWidth ?? ((Math.max(1, layoutRect.width) - (gap * 5)) / 6);
    const span = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    const rowSpan = gridItemRowSpan(item, metrics);
    const rowHeight = metrics?.rowHeight || DASHBOARD_GRID_ROW_HEIGHT;
    return dashboardGeometry.gridCellFromPoint({
      layoutRect,
      clientX,
      clientY,
      itemSpan: span,
      itemRowSpan: rowSpan,
      columnWidth,
      gap,
      rowHeight,
      columns: DASHBOARD_GRID_COLUMNS,
    });
  };

  const gridCellFromDragPointer = (layout, item, clientX, clientY, offsetX, offsetY, metrics = null, dragRect = null) => {
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
      return gridCellFromPoint(layout, item, clientX, clientY, metrics);
    }
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const columnWidth = metrics?.columnWidth ?? ((Math.max(1, layoutRect.width) - (gap * 5)) / 6);
    const span = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    const rowSpan = gridItemRowSpan(item, metrics);
    const rowHeight = metrics?.rowHeight || DASHBOARD_GRID_ROW_HEIGHT;
    return dashboardGeometry.gridCellFromDragPointer({
      layoutRect,
      clientX,
      clientY,
      offsetX,
      offsetY,
      sourceWidth: dragRect?.width,
      sourceHeight: dragRect?.height,
      itemSpan: span,
      itemRowSpan: rowSpan,
      columnWidth,
      gap,
      rowHeight,
      columns: DASHBOARD_GRID_COLUMNS,
    });
  };

  const panelGridCellFromPoint = (layout, panel, clientX, clientY) => gridCellFromPoint(layout, panel, clientX, clientY);

  const spanFromAlignedWidth = (layout, width, gap, minSpan, metrics = null) => {
    const layoutWidth = metrics?.width ?? Math.max(1, gridRectForLayout(layout).width);
    const columnCount = (layout.classList.contains("widget-layout") || layout.classList.contains("panel-layout")) ? 6 : 12;
    const columnWidth = (layoutWidth - (gap * (columnCount - 1))) / columnCount;
    return Math.max(minSpan, Math.min(columnCount, (Math.max(1, width) + gap) / (columnWidth + gap)));
  };

  const resizeAlignmentTargetsForLayout = (layout) => {
    if (isPanelInternalWidgetLayout(layout)) {
      return [...layout.querySelectorAll(":scope > .widget-card:not([hidden]), :scope > .widget-placeholder")];
    }
    return globalGridItems(layout, { includePlaceholders: true });
  };

  const alignedResizeSpan = ({ layout, item, currentSpan, gap, minSpan, metrics = null }) => {
    const rect = item.getBoundingClientRect();
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const tolerance = 18;
    const candidates = [{ edge: layoutRect.right, priority: 1 }];
    resizeAlignmentTargetsForLayout(layout).forEach((target) => {
      if (target === item || target.hidden) return;
      const targetRect = target.getBoundingClientRect();
      if (Math.abs(targetRect.top - rect.top) < 8 && Math.abs(targetRect.left - rect.left) < 8) return;
      candidates.push({ edge: targetRect.right, priority: 2 });
      candidates.push({ edge: targetRect.left, priority: 3 });
    });
    const match = candidates
      .map((candidate) => ({
        ...candidate,
        distance: Math.abs(rect.right - candidate.edge),
      }))
      .filter((candidate) => candidate.distance <= tolerance && candidate.edge > rect.left + 24)
      .sort((a, b) => a.distance - b.distance || a.priority - b.priority)[0];
    if (!match) return Math.round(currentSpan);
    return spanFromAlignedWidth(layout, match.edge - rect.left, gap, minSpan, metrics);
  };

  const groupedWidgetReleaseSpan = (currentSpan, groupCount) => {
    if (groupCount <= 1) return null;
    const fillSpan = 6 / groupCount;
    const nearestInteger = Math.round(currentSpan);
    const fillDistance = Math.abs(currentSpan - fillSpan);
    const integerDistance = Math.abs(currentSpan - nearestInteger);
    if ((currentSpan * groupCount > 6) || fillDistance <= Math.max(.18, integerDistance + .08)) {
      return fillSpan;
    }
    return null;
  };

  const groupedPanelReleaseSpan = (currentSpan, groupCount) => {
    if (groupCount <= 1) return null;
    const fillSpan = 6 / groupCount;
    const nearestInteger = Math.round(currentSpan);
    const fillDistance = Math.abs(currentSpan - fillSpan);
    const integerDistance = Math.abs(currentSpan - nearestInteger);
    if ((currentSpan * groupCount > 6) || fillDistance <= Math.max(.18, integerDistance + .08)) {
      return fillSpan;
    }
    return null;
  };

  const visualDropPlacement = (targets, clientX, clientY) => {
    if (targets.length < 2) return null;
    const rows = [];
    targets
      .map((item) => ({ item, rect: item.getBoundingClientRect() }))
      .sort((a, b) => Math.abs(a.rect.top - b.rect.top) > 12 ? a.rect.top - b.rect.top : a.rect.left - b.rect.left)
      .forEach((entry) => {
        const row = rows.find((candidate) => Math.abs(candidate.top - entry.rect.top) < 18);
        if (row) {
          row.items.push(entry);
          row.top = Math.min(row.top, entry.rect.top);
          row.bottom = Math.max(row.bottom, entry.rect.bottom);
        } else {
          rows.push({ top: entry.rect.top, bottom: entry.rect.bottom, items: [entry] });
        }
      });
    rows.forEach((row) => row.items.sort((a, b) => a.rect.left - b.rect.left));
    rows.sort((a, b) => a.top - b.top);
    const nearestRowIndex = rows.reduce((bestIndex, row, index) => {
      const center = (row.top + row.bottom) / 2;
      const bestCenter = (rows[bestIndex].top + rows[bestIndex].bottom) / 2;
      return Math.abs(clientY - center) < Math.abs(clientY - bestCenter) ? index : bestIndex;
    }, 0);
    const nearestRow = rows[nearestRowIndex];
    const rowHeight = nearestRow.bottom - nearestRow.top;
    const verticalInsideRow = clientY >= nearestRow.top - 8 && clientY <= nearestRow.bottom + 8;
    const verticalBetweenRows = rows.some((row, index) => {
      const nextRow = rows[index + 1];
      if (!nextRow) return false;
      return clientY > row.bottom + 10 && clientY < nextRow.top - 10;
    });
    const clearlyBelowLastRow = nearestRowIndex === rows.length - 1 && clientY > nearestRow.bottom + Math.max(14, rowHeight * .18);
    const clearlyAboveFirstRow = nearestRowIndex === 0 && clientY < nearestRow.top - Math.max(14, rowHeight * .18);
    const useExistingRow = verticalInsideRow && !verticalBetweenRows && !clearlyBelowLastRow && !clearlyAboveFirstRow;
    const targetRowIndex = useExistingRow
      ? nearestRowIndex
      : (clientY > nearestRow.bottom ? nearestRowIndex + 1 : nearestRowIndex);
    const referenceRow = rows[Math.min(targetRowIndex, rows.length - 1)] || nearestRow;
    const referenceItems = referenceRow.items;
    let columnIndex = referenceItems.length;
    for (let index = 0; index < referenceItems.length; index += 1) {
      const current = referenceItems[index].rect;
      const next = referenceItems[index + 1]?.rect;
      const boundary = next ? (current.right + next.left) / 2 : current.left + current.width / 2;
      if (clientX < boundary) {
        columnIndex = index;
        break;
      }
    }
    const beforeCount = rows.slice(0, targetRowIndex).reduce((total, row) => total + row.items.length, 0);
    return {
      index: Math.max(0, Math.min(targets.length, beforeCount + columnIndex)),
      breakBefore: !useExistingRow,
      columnIndex,
    };
  };

  const widgetDropColumn = (layout, widget, clientX) => {
    const layoutRect = gridRectForLayout(layout);
    const widgetRect = widget.getBoundingClientRect();
    const span = Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 3;
    const gap = 12;
    const columnWidth = (Math.max(1, layoutRect.width) - (gap * 5)) / 6;
    const itemWidth = (columnWidth * span) + (Math.max(0, span - 1) * gap);
    const step = itemWidth + gap;
    const maxColumn = Math.max(0, Math.floor(6 / Math.max(1, span)) - 1);
    const visualCenterX = widgetRect.left + (widgetRect.width / 2);
    const rawColumn = Math.round(((Number.isFinite(visualCenterX) ? visualCenterX : clientX) - layoutRect.left - (itemWidth / 2)) / Math.max(1, step));
    return Math.max(0, Math.min(maxColumn, rawColumn));
  };

  let widgetRuntimeController;
  const {
    applyStyleRulesForWidget,
  } = createConditionalStyleRuntime({
    widgetDefinitionForElement: (widget) => widgetRuntimeController.definitionForElement(widget),
    widgetInstanceFromElement: (widget, definition) => widgetRuntimeController.instanceFromElement(widget, definition),
    resolveWorkspaceContextForItem,
    managedQueryStateForWidget,
    applyPanelColor,
    hexToRgb,
    readableTextFor,
  });

  const {
    createCustomPanel,
    createPanelRowBreak,
    createWidgetRowBreak,
    createWidgetSpacer,
    cleanupPanelRowBreaks,
    cleanupWidgetRowBreaks,
  } = createDashboardDomFactories({
    workspaceObjectTypeFromDefinition,
    WORKSPACE_OBJECT_TYPES,
    escapeHtml,
    ensureWorkspaceObjectMetadata,
    panelToolButtonsMarkup,
  });

  const savePanelLayouts = (layout, profile = getActivePanelProfile(layout.dataset.layoutKey || "default"), options = {}) => {
    const layoutKey = layout.dataset.layoutKey || "default";
    const persist = Boolean(options.persist);
    syncWorkspaceRegions(layout);
    if (!persist) {
      if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
      return;
    }
    captureLayoutUndo(layoutKey, profile);
    const expansionBaselineSnapshot = expansionBaselineSnapshotForLayoutKey(layoutKey);
    [...layout.querySelectorAll(":scope > .db-panel:not([hidden])")].forEach((panel, index) => {
      const key = panel.dataset.panelKey;
      const expansionBaseline = serializableExpansionBaselineState(expansionBaselineSnapshot, panel);
      const expansionActive = Boolean(
        expansionBaseline &&
        layout.__activeExpansionPanels?.has(panel) &&
        (Number(expansionBaseline.gridRowSpan) || 1) < gridItemRowSpan(panel)
      );
      if (!key) return;
      try {
        writeJsonStore(panelStorageKey(layoutKey, key, profile), {
          order: index,
          span: Number(panel.dataset.currentSpan) || Number(panel.dataset.defaultSpan) || 12,
          gridCol: Number(panel.dataset.gridCol) || null,
          gridRow: Number(panel.dataset.gridRow) || null,
          height: panel.dataset.savedHeight ? parseFloat(panel.dataset.savedHeight) : null,
          color: panel.dataset.panelColor || null,
          title: panel.dataset.panelTitle || null,
          pinned: panel.classList.contains("db-panel-pinned"),
          collapsed: panel.classList.contains("db-panel-collapsed"),
          minW: Number(panel.dataset.minW) || null,
          locked: panel.dataset.locked === "true",
          resizable: panel.dataset.resizable === "false" ? false : true,
          breakBefore: panel.previousElementSibling?.classList.contains("db-panel-row-break") || false,
          expansionBaseline,
          expansionActive,
          childWidgets: serializePanelChildWidgets(panel),
          ...workspaceObjectPersistence(panel),
        });
      } catch {}
    });
    const customPanels = [...layout.querySelectorAll(':scope > .db-panel[data-custom-panel="true"]:not([hidden])')]
      .map((panel) => ({
        key: panel.dataset.panelKey,
        title: panel.dataset.panelTitle || panel.querySelector(".db-panel-title")?.textContent?.trim() || "Panel",
        color: panel.dataset.panelColor || panel.querySelector(".panel-color-toggle")?.dataset.defaultTheme || "#2563eb",
        span: Number(panel.dataset.defaultSpan) || 4,
        gridCol: Number(panel.dataset.gridCol) || null,
        gridRow: Number(panel.dataset.gridRow) || null,
        pinned: panel.classList.contains("db-panel-pinned"),
        collapsed: panel.classList.contains("db-panel-collapsed"),
        minW: Number(panel.dataset.minW) || null,
        locked: panel.dataset.locked === "true",
        resizable: panel.dataset.resizable === "false" ? false : true,
        childWidgets: serializePanelChildWidgets(panel),
        ...workspaceObjectPersistence(panel),
      }));
    try {
      writeJsonStore(customPanelsKey(layoutKey, profile), customPanels);
      writeRawStore(hiddenPanelsKey(layoutKey, profile), layout.dataset.hiddenPanelsDraft || "[]");
    } catch {}
  };

  const {
    animatePanelReflow,
    animateWidgetReflow,
  } = createReflowAnimationRuntime({
    gridHostForLayout,
    isPanelInternalGridItem,
  });

  widgetRuntimeController = window.dashboardWidgetRuntimeController.createRuntime({
    escapeHtml,
    parseJsonRecord,
    isPanelInternalGridItem,
    isWidgetGridItem,
    gridGapForLayout,
    gridRowHeightForLayout,
    gridHeightForRows,
    gridItemMinimumRows,
    gridItemMinimumSpan,
    gridItemRowSpan,
    panelToolButtonsMarkup,
    ensureWorkspaceObjectMetadata,
    WORKSPACE_OBJECT_TYPES,
    isMediaWidgetDefinition: (definition) => isMediaWidgetDefinition(definition),
    mediaWidgetAssetState: (widget, config, definition) => mediaWidgetAssetState(widget, config, definition),
    isSignalConsumerWidget: (widget, definition) => isSignalConsumerWidget(widget, definition),
    signalStateForWidget: (widget) => signalStateForWidget(widget),
    applySignalConsumerState: (widget, signalState, config) => applySignalConsumerState(widget, signalState, config),
    clearSignalConsumerState: (widget) => clearSignalConsumerState(widget),
    applyStyleRulesForWidget,
    syncWidgetContextOutputs: (widget) => syncWidgetContextOutputs(widget),
  });
  const {
    applyWidgetDensityMetadata,
    applyWidgetLayerMetadata,
    normalizeWorkspaceWidgetLayer,
    parseWidgetConfig,
    resolveWidgetDensityForElement,
    setWidgetConfig,
    setWidgetConfigValue,
    setWidgetLinkNavigationSuspended,
    widgetAvailableSizeForDensity,
    widgetConfigFromElement,
    widgetDefinitionFor,
    widgetDefinitionForElement,
    widgetLayerForElement,
    widgetRuntime,
    widgetRuntimeTypeFromElement,
  } = createWidgetRuntimeFacade({ widgetRuntimeController });
  const uniqueValues = (values = []) => [...new Set(values.filter((value) => value != null && String(value).trim()))];
  const isMediaWidgetDefinition = (definition) => mediaWidgetAssetTypes.has(definition?.type || "");
  const mediaWidgetAssetState = (widget, config = widgetConfigFromElement(widget), definition = widgetDefinitionForElement(widget)) => {
    if (!isMediaWidgetDefinition(definition)) return { persistedConfig: config, renderConfig: config, asset: null, changed: false };
    const layoutKey = activeLayoutKeyForItem(widget);
    const profile = getActivePanelProfile(layoutKey);
    const persistedConfig = { ...config };
    let asset = persistedConfig.assetId ? assetById(layoutKey, profile, persistedConfig.assetId) : null;
    if (!asset && String(persistedConfig.src || "").trim()) {
      asset = createAssetFromSource(layoutKey, persistedConfig.src, {
        name: persistedConfig.title || persistedConfig.alt || definition.displayName || "Asset",
        type: definition.type,
      }, profile);
      if (asset) persistedConfig.assetId = asset.id;
    }
    if (asset) delete persistedConfig.src;
    const changed = JSON.stringify(persistedConfig) !== JSON.stringify(config);
    const renderConfig = {
      ...persistedConfig,
      src: asset ? assetSourceRef(asset) : "",
      assetId: persistedConfig.assetId || "",
      assetName: asset?.name || "",
      assetMimeType: asset?.mimeType || "",
      assetMissing: Boolean(persistedConfig.assetId && !asset),
    };
    return { persistedConfig, renderConfig, asset, changed };
  };
  const isSignalConsumerWidget = (widget, definition = widgetDefinitionForElement(widget)) =>
    Boolean(definition?.capabilities?.consumesSignals) || widgetRuntimeTypeFromElement(widget) === "shift";
  const signalStateForWidget = (widget, layoutKey = activeLayoutKeyForItem(widget), profile = getActivePanelProfile(layoutKey)) => {
    const targetId = widget?.dataset?.widgetKey || "";
    if (!targetId) return { connected: false, active: false, incomingCount: 0, sourceIds: [] };
    return { connected: false, active: false, incomingCount: 0, sourceIds: [], sourceLabels: [], linkIds: [], activeLinkId: "" };
  };
  const applySignalConsumerState = (widget, signalState = {}, config = {}) => {
    if (!widget) return;
    const active = Boolean(signalState.active);
    const color = String(active ? (config.stateBColor || "#f59e0b") : (config.stateAColor || "#64748b"));
    const opacity = Math.max(.35, Math.min(1, Number(active ? config.stateBOpacity : config.stateAOpacity) || (active ? .92 : .72)));
    const rgb = hexToRgb(color);
    widget.classList.toggle("shift-widget-signal-active", active);
    widget.classList.toggle("shift-widget-signal-inactive", !active);
    widget.classList.toggle("shift-widget-signal-connected", Boolean(signalState.connected));
    widget.dataset.shiftSignalActive = active ? "true" : "false";
    widget.dataset.shiftSignalConnected = signalState.connected ? "true" : "false";
    widget.dataset.shiftSignalIncomingCount = String(signalState.incomingCount || 0);
    widget.dataset.shiftSignalSourceIds = (signalState.sourceIds || []).join(",");
    widget.dataset.shiftSignalLinkIds = (signalState.linkIds || []).join(",");
    widget.dataset.shiftSignalReason = signalState.connected
      ? `${active ? "Active" : "Inactive"} from ${signalState.sourceLabels?.[0] || signalState.sourceIds?.[0] || "signal"}`
      : "No signal input";
    widget.style.setProperty("--shift-state-opacity", String(opacity));
    if (rgb) {
      widget.style.setProperty("--shift-state-color", `#${color.replace("#", "")}`);
      widget.style.setProperty("--shift-state-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      widget.style.setProperty("--panel-accent", `#${color.replace("#", "")}`);
      widget.style.setProperty("--panel-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      widget.style.setProperty("--panel-accent-text", readableTextFor(rgb));
    }
  };
  const clearSignalConsumerState = (widget) => {
    if (!widget?.classList?.contains("shift-widget-card")) return;
    widget.classList.remove("shift-widget-signal-active", "shift-widget-signal-inactive", "shift-widget-signal-connected");
    ["--shift-state-color", "--shift-state-rgb", "--shift-state-opacity"].forEach((property) => widget.style.removeProperty(property));
    delete widget.dataset.shiftSignalActive;
    delete widget.dataset.shiftSignalConnected;
    delete widget.dataset.shiftSignalIncomingCount;
    delete widget.dataset.shiftSignalSourceIds;
    delete widget.dataset.shiftSignalLinkIds;
    delete widget.dataset.shiftSignalReason;
  };
  const refreshSignalConsumerWidgetsForLinks = (layoutKey = "builder", links = []) => {
    const targetIds = new Set((links || []).map((link) => link?.target?.objectId).filter(Boolean));
    const selector = targetIds.size
      ? [...targetIds].map((id) => `.widget-card[data-widget-key="${CSS.escape(id)}"]`).join(",")
      : ".widget-card[data-widget-definition='shift']";
    document.querySelectorAll(selector).forEach((widget) => {
      if (!isSignalConsumerWidget(widget)) return;
      renderWidgetRuntimeContent(widget, {
        resolvedContext: resolveWorkspaceContextForItem(widget),
        status: widget.dataset.widgetRuntimeStatus || "ready",
      });
    });
  };
  const { renderWidgetRuntimeContent, setWidgetRuntimeContent, widgetInstanceFromElement } = createWidgetContentRuntime({ widgetRuntimeController });
  const {
    renderWidgetSettingsSchemaPanel,
    renderWidgetWorkbenchPanel,
    ensureWidgetWorkbenchPanel,
    settingRawValue,
  } = createWidgetWorkbenchRuntime({
    escapeHtml,
    widgetConfigFromElement,
    widgetDefinitionForElement,
    widgetSettingsSchemaForSurface,
    uniqueValues,
    resolveWorkspaceContextForItem,
    managedQueryStateForWidget,
  });
  const { refreshWidgetRuntimeData } = createWidgetRuntimeData({
    widgetDefinitionForElement,
    widgetInstanceFromElement,
    demoQueryStateForWidget,
    widgetQueryKeys,
    beginManagedWidgetQuery,
    renderWidgetRuntimeContent,
  });

  window.dashboardWidgetRuntimeMeaning = {
    derive: (options = {}) => widgetRuntimeController.deriveRuntimeMeaning(options),
    apply: (widget, options = {}) => widgetRuntimeController.applyRuntimeMeaning(
      typeof widget === "string" ? document.querySelector(widget) : widget,
      options
    ),
  };
  const hydrateWidgetRuntime = (widget, saved = null) => widgetRuntimeController.hydrateRuntime(widget, saved);
  const {
    syncWidgetContextOutputs,
    persistRuntimeControlChangeForWidget,
    captureRuntimeControlBaselineForWidget,
    applyWidgetSettingsSchemaChange,
  } = createWidgetSettingsService({
    widgetSettingsFields,
    widgetDefinitionForElement,
    widgetConfigFromElement,
    parseJsonRecord,
    settingRawValue,
    normalizedTimeframeWidgetRange,
    normalizedFilterWidgetFilters,
    resolveWorkspaceContextForItem,
    activeLayoutKeyForItem,
    getActivePanelProfile,
    invalidateManagedWidgetQueryForWidget,
    saveWidgetLayouts: (...args) => saveWidgetLayouts(...args),
    refreshResolvedContextDebug,
    pushLiveLayoutUndo,
    setWidgetConfig,
    managedQueryStateForWidget,
    renderWidgetRuntimeContent,
    refreshWidgetRuntimeData,
    renderWidgetSettingsSchemaPanel,
    renderWidgetWorkbenchPanel,
  });
  window.dashboardAssetRuntime = createDashboardAssetApi({
    workspaceAssetsKey,
    getActivePanelProfile,
    loadAssets,
    assetById,
    registerAsset,
    createAssetFromSource,
    fileToDataUrl,
    mimeTypeFromSource,
    assetTypeFromMime,
    isMediaWidgetDefinition,
    widgetDefinitionForElement,
    captureRuntimeControlBaselineForWidget,
    widgetConfigFromElement,
    setWidgetConfig,
    renderWidgetRuntimeContent,
    resolveWorkspaceContextForItem,
    persistRuntimeControlChangeForWidget,
    assetSourceRef,
  });
  const { bindWidgetRuntimeControls } = createWidgetRuntimeControls({
    widgetConfigFromElement,
    setWidgetConfig,
    setWidgetConfigValue,
    normalizedFilterWidgetFilters,
    resolveWorkspaceContextForItem,
    captureRuntimeControlBaselineForWidget,
    renderWidgetRuntimeContent,
    syncWidgetContextOutputs,
    ensureWidgetWorkbenchPanel,
    persistRuntimeControlChangeForWidget,
  });
  const createCustomWidget = (definition) => widgetRuntimeController.createCustomWidget(definition);

  const {
    ensurePanelInternalWidgetGrid,
    openPanelForInternalDrop,
    panelChildWidgets,
    panelInternalGridBlockInsets,
    panelRequiredSpanForInternalItem,
    requiredPanelHeightForInternalGrid,
    restorePanelChildWidgets,
    sanitizePanelChildWidgetClone,
    serializePanelChildWidgets,
    syncOpenPanelHeightToInternalGrid,
    syncPanelFootprintToInternalItem,
    updatePanelChildEmptyState,
  } = createPanelContainmentFacade({
    dashboardPanelContainment,
    getPanelContainmentRuntime: () => panelContainmentRuntime,
    getPanelRuntime: () => panelRuntime,
  });

  let collisionReflowRuntime = null;
  const {
    applyGridItemPosition,
    gridBoundsForItem,
    gridBoundsOverlap,
    gridItemPixelWidthForSpan,
    gridItemSpan,
    indexedCollisionEntries,
    nextGridSlot,
    resizeEdgeFromPointer,
  } = createGridItemGeometry({
    applyPanelGridPosition: (...args) => panelRuntime.applyPanelGridPosition(...args),
    applyWidgetGridPosition: widgetRuntimeController.applyGridPosition,
    dashboardCollisionReflowRuntime,
    dashboardGeometry,
    DASHBOARD_GRID_COLUMNS,
    getCollisionReflowRuntime: () => collisionReflowRuntime,
    gridGapForLayout,
    gridItemMinimumSpan,
    gridItemRowSpan,
    gridRectForLayout,
    isWidgetGridItem,
  });

  const beginInteractionAutoScroll = ({ layout = null, onScrollFrame } = {}) => dashboardDragRuntime.beginInteractionAutoScroll({
    layout,
    onScrollFrame,
    gridHostForLayout,
  });
  const beginResizeLifecycle = (options = {}) => dashboardResizeRuntime.beginResizeLifecycle({
    ...options,
    beginInteractionAutoScroll,
    clearSurfaceResponse,
  });

  const {
    expandedPanelFootprintHeight,
    expandedPanelFootprintRows,
  } = createPanelFootprintFacade({
    getPanelRuntime: () => panelRuntime,
  });

  const {
    beginLiveResizeSurface,
    clearLiveResizeSurface,
    createExpandedFootprintGhost,
    createGroupBoundarySurface,
    createResizePreview,
    updateExpandedFootprintGhost,
    updateGroupBoundarySurface,
    updateLiveResizeSurface,
  } = createResizeSurfaceRuntime({
    DASHBOARD_GRID_ROW_HEIGHT,
    expandedPanelFootprintHeight,
    gridGapForLayout,
    gridHeightForRows,
    gridItemRowSpan,
    workspaceObjectCapabilities,
  });

  const {
    snapshotGridLayout,
    restoreGridLayoutSnapshot,
    serializableExpansionBaselineState,
    expansionBaselineSnapshotForLayoutKey,
    markLoadedExpansionBaseline,
    restoreLoadedExpansionBaseline,
  } = createLayoutSnapshotRuntime({
    gridHostForLayout,
    isPanelInternalGridItem,
    applyPanelGridPosition: (...args) => panelRuntime.applyPanelGridPosition(...args),
    gridItemRowSpan,
    gridItemSpan,
  });

  const localCollisionItems = (layout) => {
    const host = gridHostForLayout(layout);
    const selector = host !== layout
      ? ".widget-layout > .widget-card:not([hidden]), .widget-layout > .widget-placeholder, .panel-layout > .db-panel:not([hidden]), .panel-layout > .db-panel-placeholder"
      : layout.classList.contains("widget-layout")
        ? ":scope > .widget-card:not([hidden]), :scope > .widget-placeholder"
        : ":scope > .db-panel:not([hidden]), :scope > .db-panel-placeholder";
    return [...host.querySelectorAll(selector)]
      .filter((item) => (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
  };

  const applyLocalCollisionLayout = (layout, activeItems, options = {}) => {
    const orderedItems = orderedGridItems?.(layout, { includePlaceholders: true }) || [];
    if (orderedItems.length) {
      applyOrderedGridLayout(layout, orderedItems);
      return;
    }
    const activeSet = new Set([].concat(activeItems || []).filter(Boolean));
    if (!activeSet.size) return;
    const origin = options.origin || null;
    const target = options.target || null;
    const items = localCollisionItems(layout);
    const occupied = new Set();
    const sortedItems = items
      .filter((item) => !activeSet.has(item))
      .map((item) => ({ item, bounds: gridBoundsForItem(item) }))
      .sort((a, b) => (
        a.bounds.row - b.bounds.row ||
        a.bounds.col - b.bounds.col ||
        [...gridHostForLayout(layout).querySelectorAll(".widget-card, .db-panel, .widget-placeholder, .db-panel-placeholder")].indexOf(a.item) -
          [...gridHostForLayout(layout).querySelectorAll(".widget-card, .db-panel, .widget-placeholder, .db-panel-placeholder")].indexOf(b.item)
      ));
    const occupy = (bounds) => {
      for (let row = bounds.row; row <= bounds.bottom; row += 1) {
        for (let col = bounds.col; col <= bounds.right; col += 1) {
          occupied.add(`${row}:${col}`);
        }
      }
    };
    const canOccupy = (bounds) => {
      if (bounds.col < 1 || bounds.right > DASHBOARD_GRID_COLUMNS) return false;
      for (let row = bounds.row; row <= bounds.bottom; row += 1) {
        for (let col = bounds.col; col <= bounds.right; col += 1) {
          if (occupied.has(`${row}:${col}`)) return false;
        }
      }
      return true;
    };
    const boundsAt = (bounds, col, row) => ({
      ...bounds,
      col,
      row,
      right: col + bounds.span - 1,
      bottom: row + bounds.rowSpan - 1,
    });
    const findAvailableSlotFrom = (bounds, col, row) => {
      let nextBounds = boundsAt(bounds, col, row);
      for (let attempts = 0; attempts < 120; attempts += 1) {
        if (canOccupy(nextBounds)) return nextBounds;
        const next = nextGridSlot(nextBounds);
        nextBounds = boundsAt(bounds, next.col, next.row);
      }
      return null;
    };
    const findNearestAvailableSlot = (bounds, preferred = bounds) => {
      const maxCol = Math.max(1, DASHBOARD_GRID_COLUMNS - bounds.span + 1);
      const preferredCol = Math.max(1, Math.min(maxCol, Math.round(Number(preferred.col) || bounds.col)));
      const preferredRow = Math.max(1, Math.round(Number(preferred.row) || bounds.row));
      const rowLimit = Math.max(
        preferredRow + 24,
        bounds.row + 24,
        ...sortedItems.map((entry) => entry.bounds.bottom + 8),
        ...activeBounds.map((entry) => entry.bottom + 8),
      );
      let best = null;
      for (let row = 1; row <= rowLimit; row += 1) {
        for (let col = 1; col <= maxCol; col += 1) {
          const candidate = boundsAt(bounds, col, row);
          if (!canOccupy(candidate)) continue;
          if (options.forwardOnly && (row < bounds.row || (row === bounds.row && col < bounds.col))) continue;
          const distance = (Math.abs(row - preferredRow) * DASHBOARD_GRID_COLUMNS) + Math.abs(col - preferredCol);
          const beforePreferred = row < preferredRow || (row === preferredRow && col < preferredCol);
          const placementRank = distance + (beforePreferred ? 0.25 : 0);
          if (
            !best ||
            placementRank < best.placementRank ||
            (placementRank === best.placementRank && row < best.bounds.row) ||
            (placementRank === best.placementRank && row === best.bounds.row && col < best.bounds.col)
          ) {
            best = { bounds: candidate, placementRank };
          }
        }
      }
      return best?.bounds || null;
    };

    [...activeSet].map(gridBoundsForItem).forEach(occupy);

    if (options.protectBeforeOrigin && origin) {
      const protectedItems = sortedItems.filter(({ bounds }) => (
        bounds.row < origin.row ||
        (bounds.row === origin.row && bounds.col < origin.col)
      ));
      protectedItems.forEach(({ bounds }) => occupy(bounds));
      protectedItems.forEach((entry) => sortedItems.splice(sortedItems.indexOf(entry), 1));
    }

    const activeBounds = [...activeSet].map(gridBoundsForItem);
    const primaryActive = [...activeSet][0];
    const originBounds = origin && primaryActive ? boundsAt(gridBoundsForItem(primaryActive), origin.col, origin.row) : null;
    const swapCandidate = originBounds
      ? sortedItems.find(({ bounds }) => activeBounds.some((active) => gridBoundsOverlap(bounds, active)))
      : null;

    if (swapCandidate) {
      const swapBounds = findNearestAvailableSlot(swapCandidate.bounds, originBounds) ||
        findAvailableSlotFrom(swapCandidate.bounds, originBounds.col, originBounds.row);
      if (swapBounds) {
        applyGridItemPosition(swapCandidate.item, swapBounds.col, swapBounds.row);
        occupy(swapBounds);
        sortedItems.splice(sortedItems.indexOf(swapCandidate), 1);
      }
    }

    sortedItems.forEach(({ item, bounds }) => {
      if (canOccupy(bounds)) {
        occupy(bounds);
        return;
      }
      const nearestBounds = findNearestAvailableSlot(bounds);
      if (nearestBounds) {
        applyGridItemPosition(item, nearestBounds.col, nearestBounds.row);
        occupy(nearestBounds);
        return;
      }
      const next = nextGridSlot(bounds);
      const shiftedBounds = findAvailableSlotFrom(bounds, next.col, next.row);
      if (shiftedBounds) {
        applyGridItemPosition(item, shiftedBounds.col, shiftedBounds.row);
        occupy(shiftedBounds);
      }
    });
  };

  const syncDefaultDashboardGrid = (layoutKey, options = {}) => {
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    if (!widgetLayout || !panelLayout || !widgetLayout.closest(".dashboard-layout-grid")) return;
    const force = Boolean(options.force);

    const widgets = [...widgetLayout.querySelectorAll(":scope > .widget-card:not([hidden])")];
    const panels = [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")];
    if (!force) {
      const occupied = [];
      const hasCommittedGrid = (item) => Boolean(Number(item.dataset.gridCol) && Number(item.dataset.gridRow));
      const reserve = (item) => occupied.push({ item, bounds: gridBoundsForItem(item) });
      widgets.filter(hasCommittedGrid).forEach(reserve);
      panels.filter(hasCommittedGrid).forEach(reserve);
      const findOpenSlot = (item, startCol, startRow) => {
        const span = gridItemSpan(item);
        for (let candidateRow = Math.max(1, startRow); candidateRow < Math.max(1, startRow) + 160; candidateRow += 1) {
          const firstCol = candidateRow === startRow ? Math.max(1, startCol) : 1;
          for (let candidateCol = firstCol; candidateCol <= DASHBOARD_GRID_COLUMNS - span + 1; candidateCol += 1) {
            const bounds = boundsAtGridSlot(item, candidateCol, candidateRow);
            if (canPlaceBounds(bounds, occupied)) return bounds;
          }
        }
        return nearestSparseSlot(item, { col: Math.max(1, startCol), row: Math.max(1, startRow) }, occupied);
      };
      const placeMissing = (items, startRow = 1) => {
        let cursorCol = 1;
        let cursorRow = startRow;
        items.forEach((item) => {
          if (hasCommittedGrid(item)) return;
          const bounds = findOpenSlot(item, cursorCol, cursorRow);
          applyGridItemPosition(item, bounds.col, bounds.row);
          occupied.push({ item, bounds: gridBoundsForItem(item) });
          cursorRow = bounds.row;
          cursorCol = bounds.col + bounds.span;
          if (cursorCol > DASHBOARD_GRID_COLUMNS) {
            cursorRow += 1;
            cursorCol = 1;
          }
        });
      };
      placeMissing(widgets, 1);
      const widgetBottom = widgets.reduce((bottom, item) => {
        const bounds = gridBoundsForItem(item);
        return Math.max(bottom, bounds.bottom);
      }, 0);
      placeMissing(panels, Math.max(3, widgetBottom + 1));
      return;
    }

    const occupied = [];
    const placeForcedItems = (items, applyPosition, startRow = 1) => {
      let cursorCol = 1;
      let cursorRow = startRow;
      const findSequentialBounds = (item) => {
        const span = gridItemSpan(item);
        for (let candidateRow = Math.max(1, cursorRow); candidateRow < Math.max(1, cursorRow) + 160; candidateRow += 1) {
          const firstCol = candidateRow === cursorRow ? Math.max(1, cursorCol) : 1;
          for (let candidateCol = firstCol; candidateCol <= DASHBOARD_GRID_COLUMNS - span + 1; candidateCol += 1) {
            const bounds = boundsAtGridSlot(item, candidateCol, candidateRow);
            if (canPlaceBounds(bounds, occupied)) return bounds;
          }
        }
        return nearestSparseSlot(item, { col: Math.max(1, cursorCol), row: Math.max(1, cursorRow) }, occupied);
      };

      items.forEach((item) => {
        const defaultCol = Number(item.dataset.defaultGridCol);
        const defaultRow = Number(item.dataset.defaultGridRow);
        let bounds = null;
        if (defaultCol && defaultRow && defaultRow >= startRow) {
          const defaultBounds = boundsAtGridSlot(item, defaultCol, defaultRow);
          if (canPlaceBounds(defaultBounds, occupied)) bounds = defaultBounds;
        }
        bounds = bounds || findSequentialBounds(item);
        applyPosition(item, bounds.col, bounds.row);
        occupied.push({ item, bounds: gridBoundsForItem(item) });
        cursorRow = bounds.row;
        cursorCol = bounds.col + bounds.span;
        if (cursorCol > DASHBOARD_GRID_COLUMNS) {
          cursorRow += 1;
          cursorCol = 1;
        }
      });
    };

    placeForcedItems(widgets, widgetRuntimeController.applyGridPosition, 1);
    const widgetBottom = widgets.reduce((bottom, item) => {
      const bounds = gridBoundsForItem(item);
      return Math.max(bottom, bounds.bottom);
    }, 0);
    placeForcedItems(panels, panelRuntime.applyPanelGridPosition, Math.max(3, widgetBottom + 1));
  };

  const normalizeGridLayout = (layout, priorityItem = null) => {
    const host = gridHostForLayout(layout);
    const selector = host !== layout
      ? ".widget-layout > .widget-card:not([hidden]), .widget-layout > .widget-placeholder, .panel-layout > .db-panel:not([hidden]), .panel-layout > .db-panel-placeholder"
      : layout.classList.contains("widget-layout")
        ? ":scope > .widget-card:not([hidden]), :scope > .widget-placeholder"
        : ":scope > .db-panel:not([hidden]), :scope > .db-panel-placeholder";
    const items = [...host.querySelectorAll(selector)]
      .filter((item) => !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
    const occupied = new Set();
    const orderedItems = items.sort((a, b) => {
      if (a === priorityItem) return -1;
      if (b === priorityItem) return 1;
      const rowDelta = (Number(a.dataset.gridRow) || 1) - (Number(b.dataset.gridRow) || 1);
      if (rowDelta) return rowDelta;
      const colDelta = (Number(a.dataset.gridCol) || 1) - (Number(b.dataset.gridCol) || 1);
      if (colDelta) return colDelta;
      return [...host.querySelectorAll(".widget-card, .db-panel, .widget-placeholder, .db-panel-placeholder")].indexOf(a) -
        [...host.querySelectorAll(".widget-card, .db-panel, .widget-placeholder, .db-panel-placeholder")].indexOf(b);
    });
    const canOccupy = (row, col, span, rowSpan) => {
      if (col < 1 || col + span - 1 > DASHBOARD_GRID_COLUMNS) return false;
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        for (let colOffset = 0; colOffset < span; colOffset += 1) {
          if (occupied.has(`${row + rowOffset}:${col + colOffset}`)) return false;
        }
      }
      return true;
    };
    const occupy = (row, col, span, rowSpan) => {
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        for (let colOffset = 0; colOffset < span; colOffset += 1) {
          occupied.add(`${row + rowOffset}:${col + colOffset}`);
        }
      }
    };
    orderedItems.forEach((item) => {
      const span = gridItemSpan(item);
      const rowSpan = gridItemRowSpan(item);
      const preferredCol = Math.max(1, Math.min(7 - span, Number(item.dataset.gridCol) || 1));
      const preferredRow = Math.max(1, Math.round(Number(item.dataset.gridRow) || 1));
      let nextCol = preferredCol;
      let nextRow = preferredRow;
      let placed = false;
      for (let row = preferredRow; row < preferredRow + 80 && !placed; row += 1) {
        const startCol = row === preferredRow ? preferredCol : 1;
        for (let col = startCol; col <= 7 - span; col += 1) {
          if (!canOccupy(row, col, span, rowSpan)) continue;
          nextCol = col;
          nextRow = row;
          placed = true;
          break;
        }
      }
      applyGridItemPosition(item, nextCol, nextRow);
      occupy(nextRow, nextCol, span, rowSpan);
    });
  };

  const {
    globalGridItems,
    orderedGridItems,
  } = createOrderedGridItemsRuntime({
    gridHostForLayout,
    isPanelInternalGridItem,
  });

  const layoutItemsForLogicalResolution = (layout, options = {}) => {
    const excluded = new Set([].concat(options.exclude || []).filter(Boolean));
    const provided = Array.isArray(options.items) ? options.items : null;
    const items = provided || globalGridItems(layout, {
      includePlaceholders: options.includePlaceholders !== false,
      exclude: [...excluded],
    });
    // Defensive: when resolving against a workspace-level layout (not a
    // panel-internal grid), panel-contained widgets must never enter the
    // global occupancy set â€” the panel container is the single global
    // object/footprint. Upstream callers (reflowItemsForLayout,
    // globalGridItems) filter this, but this final-mile filter catches
    // any path that supplies a provided `items` array that leaks panel-
    // internal widgets, which would otherwise cause unrelated widgets in
    // the row above the panel to be displaced downward during drag
    // preview by the panel-local widgets' panel-local row positions
    // being interpreted as global rows.
    const allowPanelInternal = isPanelInternalWidgetLayout(layout);
    return [...new Set(items)]
      .filter((item) => (
        item?.isConnected &&
        !excluded.has(item) &&
        (allowPanelInternal || !isPanelInternalGridItem(item)) &&
        !item.classList.contains("widget-dragging") &&
        !item.classList.contains("db-panel-dragging") &&
        !item.classList.contains("dashboard-live-resize") &&
        !item.classList.contains("dashboard-resize-source") &&
        !item.classList.contains("dashboard-group-source") &&
        !item.classList.contains("dashboard-group-member-preview")
      ));
  };

  const {
    gridItemDocumentBounds,
    scheduleWorkspaceVisualLodRefresh,
    syncWorkspaceVisualLod,
    workspaceVisualLodForItem,
    workspaceVisualViewport,
  } = createWorkspaceVisualLodRuntime({
    createGridMetrics,
    globalGridItems,
    gridBoundsForItem,
    gridHeightForRows,
    isPanelInternalWidgetLayout,
  });

  const {
    clearCommittedWorkspaceScrollFloor,
    committedWorkspaceNaturalHeight,
    syncCommittedWorkspaceScrollFloor,
  } = createWorkspaceScrollFloorRuntime({
    globalGridItems,
    gridBoundsForItem,
    gridGapForLayout,
    gridHeightForRows,
    gridHostForLayout,
  });

  const boundsAtGridSlot = (item, col, row, metrics = null) => {
    const span = gridItemSpan(item);
    const rowSpan = gridItemRowSpan(item, metrics);
    return dashboardGeometry.boundsAtGridSlot({
      col,
      row,
      span,
      rowSpan,
      columns: DASHBOARD_GRID_COLUMNS,
    });
  };

  const ensureRenderedGridPosition = (layout, item) => {
    if (!item?.isConnected || (Number(item.dataset.gridCol) && Number(item.dataset.gridRow))) return;
    const layoutRect = gridRectForLayout(layout);
    const itemRect = item.getBoundingClientRect();
    const gap = gridGapForLayout(layout);
    const columnWidth = (Math.max(1, layoutRect.width) - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS;
    const colStep = columnWidth + gap;
    const rowStep = DASHBOARD_GRID_ROW_HEIGHT + gap;
    const col = Math.round((itemRect.left - layoutRect.left) / Math.max(1, colStep)) + 1;
    const row = Math.round((itemRect.top - layoutRect.top) / Math.max(1, rowStep)) + 1;
    applyGridItemPosition(item, col, row);
  };

  const canPlaceBounds = (bounds, occupied) => collisionReflowRuntime.canPlaceBounds(bounds, occupied);

  const nearestSparseSlot = (item, preferred, occupied, rowLimit = null, metrics = null) => (
    collisionReflowRuntime.nearestSparseSlot(item, preferred, occupied, rowLimit, metrics)
  );

  const nearestSparseSlotAtOrAfter = (item, preferred, occupied, rowLimit = null, metrics = null) => (
    collisionReflowRuntime.nearestSparseSlotAtOrAfter(item, preferred, occupied, rowLimit, metrics)
  );

  const localVacancyCandidates = (item, vacancy, metrics = null) => collisionReflowRuntime.localVacancyCandidates(item, vacancy, metrics);

  const canPlaceLocalDisplacementBounds = (bounds, occupied, reserved = []) => (
    collisionReflowRuntime.canPlaceLocalDisplacementBounds(bounds, occupied, reserved)
  );

  const localBelowDisplacementSlot = (item, base, occupied, reserved = [], metrics = null) => (
    collisionReflowRuntime.localBelowDisplacementSlot(item, base, occupied, reserved, metrics)
  );

  const localLeftDisplacementSlot = (item, base, occupied, localVacancy = null, reserved = [], metrics = null) => (
    collisionReflowRuntime.localLeftDisplacementSlot(item, base, occupied, localVacancy, reserved, metrics)
  );

  const nearestLocalDisplacementSlot = (item, preferred, occupied, options = {}) => (
    collisionReflowRuntime.nearestLocalDisplacementSlot(item, preferred, occupied, options)
  );

  const visualGridOrder = (items, metrics = null) => [...items].sort((a, b) => {
    const aBounds = gridBoundsForItem(a, metrics);
    const bBounds = gridBoundsForItem(b, metrics);
    const documentOrder = a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    return aBounds.row - bBounds.row ||
      aBounds.col - bBounds.col ||
      documentOrder;
  });

  const boundsAtRow = (bounds, row) => dashboardGeometry.boundsAtRow(bounds, row);

  const gridBoundsShareColumns = (a, b) => dashboardGeometry.gridBoundsShareColumns(a, b);

  collisionReflowRuntime = dashboardCollisionReflowRuntime.createRuntime({
    columns: DASHBOARD_GRID_COLUMNS,
    boundsAtGridSlot,
    gridBoundsForItem,
    applyGridItemPosition,
    gridItemSpan,
    gridItemRowSpan,
    gridHostForLayout,
    globalGridItems,
    layoutItemsForLogicalResolution,
    visualGridOrder,
    ensureRenderedGridPosition,
    orderedLayoutStartRow: (layout) => orderedLayoutStartRow(layout),
    orderedGridItems: (layout, options = {}) => orderedGridItems(layout, options),
  });

  const firstVerticalOpenRow = (bounds, occupied) => collisionReflowRuntime.firstVerticalOpenRow(bounds, occupied);

  const applyVerticalPanelExpansion = (layout, panel) => collisionReflowRuntime.applyVerticalPanelExpansion(layout, panel);

  const beginPanelExpansionSession = (layout, panel) => {
    if (!layout || !panel) return;
    if (!layout.__expansionBaselineSnapshot) {
      layout.__expansionBaselineSnapshot = snapshotGridLayout(layout);
    }
    if (!layout.__activeExpansionPanels) layout.__activeExpansionPanels = new Set();
    layout.__activeExpansionPanels.add(panel);
    panel.__activeExpansionSource = true;
  };

  const relaxCollapsedExpansionDisplacement = (layout, collapsedPanel) => {
    const baseline = layout?.__expansionBaselineSnapshot;
    if (!baseline) return;
    const collapsedBounds = collapsedPanel?.isConnected ? gridBoundsForItem(collapsedPanel) : null;
    const candidates = globalGridItems(layout, { includePlaceholders: false, exclude: [collapsedPanel] })
      .filter((item) => baseline.has(item))
      .sort((a, b) => {
        const aState = baseline.get(a);
        const bState = baseline.get(b);
        const aRow = Number(aState?.gridRow) || gridBoundsForItem(a).row;
        const bRow = Number(bState?.gridRow) || gridBoundsForItem(b).row;
        const aCol = Number(aState?.gridCol) || gridBoundsForItem(a).col;
        const bCol = Number(bState?.gridCol) || gridBoundsForItem(b).col;
        return aRow - bRow || aCol - bCol;
      });

    candidates.forEach((item) => {
      if (!item.isConnected) return;
      const baselineState = baseline.get(item);
      const baselineRow = Number(baselineState?.gridRow);
      const baselineCol = Number(baselineState?.gridCol);
      if (!Number.isFinite(baselineRow) || !Number.isFinite(baselineCol)) return;
      const current = gridBoundsForItem(item);
      if (current.row <= baselineRow) return;
      if (current.col !== baselineCol) return;
      const occupied = globalGridItems(layout, { includePlaceholders: false, exclude: [item] })
        .map((other) => ({ item: other, bounds: gridBoundsForItem(other) }));
      const preserveSourceOrder = collapsedBounds &&
        gridBoundsShareColumns(current, collapsedBounds) &&
        current.row > collapsedBounds.row;
      const localBaselineRow = preserveSourceOrder
        ? Math.max(baselineRow, collapsedBounds.bottom + 1)
        : baselineRow;
      const desired = boundsAtRow(current, localBaselineRow);
      const next = firstVerticalOpenRow(desired, occupied);
      if (next.row < current.row) applyGridItemPosition(item, current.col, next.row);
    });
  };

  const endPanelExpansionSession = (layout, panel) => {
    layout?.__activeExpansionPanels?.delete(panel);
    if (panel) panel.__activeExpansionSource = false;
    layout?.__activeExpansionPanels?.forEach((activePanel) => {
      if (!activePanel.isConnected || activePanel.classList.contains("db-panel-collapsed") || !activePanel.__activeExpansionSource) {
        layout.__activeExpansionPanels.delete(activePanel);
      }
    });
    const hasActiveExpansionSource = [...(layout?.__activeExpansionPanels || [])]
      .some((activePanel) => activePanel.__activeExpansionSource && !activePanel.classList.contains("db-panel-collapsed"));
    if (!hasActiveExpansionSource) {
      delete layout.__activeExpansionPanels;
      delete layout.__expansionBaselineSnapshot;
    }
  };

  const resolveSparseGridLayout = (layout, activeItem = null, preferredTarget = null, options = {}) => (
    collisionReflowRuntime.resolveSparseGridLayout(layout, activeItem, preferredTarget, options)
  );

  const resolveSparseGridLayoutForActiveItems = (layout, activeItems = [], options = {}) => (
    collisionReflowRuntime.resolveSparseGridLayoutForActiveItems(layout, activeItems, options)
  );

  const resolveActiveDropSlot = (layout, item, preferredTarget) => (
    collisionReflowRuntime.resolveActiveDropSlot(layout, item, preferredTarget)
  );

  const commitActiveDropSlot = (layout, item, preferredTarget, options = {}) => (
    collisionReflowRuntime.commitActiveDropSlot(layout, item, preferredTarget, options)
  );

  const commitExpandedPanelDropSlot = (layout, item, preferredTarget, options = {}) => (
    collisionReflowRuntime.commitExpandedPanelDropSlot(layout, item, preferredTarget, options)
  );

  const verticalSlotAtOrAfter = (item, preferred, occupied, rowLimit = null, metrics = null) => (
    collisionReflowRuntime.verticalSlotAtOrAfter(item, preferred, occupied, rowLimit, metrics)
  );

  const dividerInsertionRegionsForLayout = (layout, metrics = createGridMetrics(layout)) => {
    const host = gridHostForLayout(layout);
    const layoutKey = gridItemLayoutKey(layout);
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const viewportTop = scrollY;
    const viewportBottom = scrollY + window.innerHeight;
    const viewportCenter = viewportTop + (window.innerHeight / 2);
    const hostRect = gridRectForLayout(layout);
    const hostTop = hostRect.top + scrollY;
    const hostBottom = hostRect.bottom + scrollY;
    const rowStep = metrics?.rowStep || (DASHBOARD_GRID_ROW_HEIGHT + gridGapForLayout(layout));
    const dividers = [...host.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .workspace-divider[data-workspace-object-type="divider"]:not([hidden])`)]
      .filter((divider) => !divider.classList.contains("db-panel-placeholder") && !divider.classList.contains("db-panel-dragging"))
      .map((divider) => {
        const rect = divider.getBoundingClientRect();
        return {
          item: divider,
          bounds: gridBoundsForItem(divider, metrics),
          top: rect.top + scrollY,
          bottom: rect.bottom + scrollY,
        };
      })
      .sort((a, b) => a.top - b.top || a.bounds.row - b.bounds.row);
    const itemBottom = globalGridItems(layout, { includePlaceholders: false })
      .reduce((bottom, item) => Math.max(bottom, item.getBoundingClientRect().bottom + scrollY), hostBottom);
    const lastDivider = dividers.length ? dividers[dividers.length - 1] : null;
    const workspaceBottom = Math.max(hostBottom, itemBottom, viewportBottom, lastDivider?.bottom + (rowStep * 10) || 0);
    const rowForDocY = (docY, mode = "floor") => {
      const raw = (docY - hostTop) / Math.max(1, rowStep);
      return Math.max(1, (mode === "ceil" ? Math.ceil(raw) : Math.floor(raw)) + 1);
    };
    const buildRegion = ({ id = "", kind = "divider", order = 0, divider = null, nextDivider = null, startRow = 1, endRow = Infinity, top = hostTop, bottom = workspaceBottom }) => {
      const visibleTop = Math.max(top, viewportTop);
      const visibleBottom = Math.min(bottom, viewportBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const visibleStartRow = Math.max(startRow, rowForDocY(visibleTop, "floor"));
      const visibleEndRow = Math.min(Number.isFinite(endRow) ? endRow : Number.POSITIVE_INFINITY, rowForDocY(visibleBottom, "ceil"));
      const visibleRows = visibleHeight > 0 && visibleEndRow >= visibleStartRow
        ? Math.max(0, visibleEndRow - visibleStartRow + 1)
        : 0;
      const center = visibleHeight > 0
        ? visibleTop + (visibleHeight / 2)
        : top + ((Math.max(1, bottom - top)) / 2);
      return {
        id: id || divider?.item?.dataset.panelKey || `${layoutKey}:${kind}:${order}`,
        kind,
        order,
        divider: divider?.item || null,
        nextDivider: nextDivider?.item || null,
        startRow: Math.max(1, Math.round(startRow)),
        endRow,
        top,
        bottom,
        visibleTop,
        visibleBottom,
        visibleHeight,
        visibleStartRow,
        visibleEndRow,
        visibleRows,
        viewportDistance: Math.abs(center - viewportCenter),
      };
    };
    if (!dividers.length) {
      return [buildRegion({ id: `${layoutKey}:top`, kind: "top", order: 0, startRow: 1, endRow: Infinity, top: hostTop, bottom: workspaceBottom })];
    }
    const regions = [
      buildRegion({
        id: `${layoutKey}:top`,
        kind: "top",
        order: 0,
        startRow: 1,
        endRow: Math.max(0, dividers[0].bounds.row - 1),
        top: hostTop,
        bottom: dividers[0].top,
        nextDivider: dividers[0],
      }),
    ];
    dividers.forEach((divider, index) => {
      const nextDivider = dividers[index + 1] || null;
      regions.push(buildRegion({
        id: divider.item?.dataset.panelKey || `${layoutKey}:divider:${index + 1}`,
        kind: nextDivider ? "divider" : "final",
        order: index + 1,
        divider,
        nextDivider,
        startRow: divider.bounds.bottom + 1,
        endRow: nextDivider ? Math.max(divider.bounds.bottom + 1, nextDivider.bounds.row - 1) : Infinity,
        top: divider.bottom,
        bottom: nextDivider ? nextDivider.top : workspaceBottom,
      }));
    });
    return regions;
  };

  const findOrderedInsertionSlot = (layout, item, startRow, occupied, options = {}) => {
    const metrics = options.metrics || createGridMetrics(layout);
    const base = boundsAtGridSlot(item, options.startCol || 1, Math.max(1, startRow), metrics);
    const maxCol = DASHBOARD_GRID_COLUMNS - base.span + 1;
    const maxOccupiedRow = occupied.reduce((max, entry) => Math.max(max, entry.bounds.bottom), base.row);
    const hardLimit = Number.isFinite(options.endRow)
      ? Math.max(base.row, Math.round(options.endRow))
      : Math.max(base.row + 80, maxOccupiedRow + 40);
    for (let row = base.row; row <= hardLimit; row += 1) {
      const firstCol = row === base.row ? base.col : 1;
      for (let col = firstCol; col <= maxCol; col += 1) {
        const candidate = boundsAtGridSlot(item, col, row, metrics);
        if (canPlaceBounds(candidate, occupied)) return candidate;
      }
    }
    return null;
  };

  const visibleRegionInsertionTarget = (layout, item) => {
    const metrics = createGridMetrics(layout);
    const occupied = globalGridItems(layout, { includePlaceholders: false, exclude: [item] })
      .map((other) => {
        const bounds = gridBoundsForItem(other, metrics);
        const rect = other.getBoundingClientRect();
        return {
          item: other,
          bounds,
          top: rect.top + (window.scrollY || document.documentElement.scrollTop || 0),
          bottom: rect.bottom + (window.scrollY || document.documentElement.scrollTop || 0),
        };
      });
    const regions = dividerInsertionRegionsForLayout(layout, metrics);
    const scoredRegions = regions.map((region) => {
      const visibleArea = region.visibleHeight * DASHBOARD_GRID_COLUMNS;
      const occupiedArea = occupied.reduce((sum, entry) => {
        if (!region.visibleHeight) return sum;
        const top = Math.max(entry.top, region.visibleTop);
        const bottom = Math.min(entry.bottom, region.visibleBottom);
        if (bottom <= top) return sum;
        return sum + ((bottom - top) * entry.bounds.span);
      }, 0);
      const availableArea = Math.max(0, visibleArea - occupiedArea);
      return {
        ...region,
        availableArea,
        score: availableArea,
      };
    }).sort((a, b) => (
      a.viewportDistance - b.viewportDistance ||
      b.score - a.score ||
      a.visibleTop - b.visibleTop ||
      a.order - b.order ||
      String(a.id).localeCompare(String(b.id))
    ));
    const region = scoredRegions[0] || regions[0];
    if (!region) return null;
    const visibleStart = region.visibleRows
      ? Math.max(region.startRow, region.visibleStartRow)
      : region.startRow;
    const visibleEnd = region.visibleRows
      ? Math.min(region.endRow, region.visibleEndRow)
      : null;
    const visibleSlot = region.visibleRows
      ? findOrderedInsertionSlot(layout, item, visibleStart, occupied, { metrics, endRow: visibleEnd })
      : null;
    if (visibleSlot) return visibleSlot;
    const regionSlot = findOrderedInsertionSlot(layout, item, region.startRow, occupied, { metrics, endRow: region.endRow });
    if (regionSlot) return regionSlot;
    return nearestSparseSlotAtOrAfter(item, { col: 1, row: region.startRow }, occupied, null, metrics);
  };

  const panelAddTarget = (layout, panel) => {
    const smartTarget = visibleRegionInsertionTarget(layout, panel);
    if (smartTarget) return smartTarget;
    const panels = visualGridOrder(
      [...layout.querySelectorAll(":scope > .db-panel:not([hidden])")]
        .filter((item) => item !== panel && !item.classList.contains("db-panel-placeholder"))
    );
    if (!panels.length) {
      return { col: 1, row: orderedLayoutStartRow(layout) };
    }
    const previousBounds = gridBoundsForItem(panels[panels.length - 1]);
    if (previousBounds.right < DASHBOARD_GRID_COLUMNS) {
      return { col: previousBounds.right + 1, row: previousBounds.row };
    }
    return { col: 1, row: previousBounds.bottom + 1 };
  };

  const commitInsertedGridItemWithVerticalPushdown = (layout, item, preferredTarget = null) => (
    collisionReflowRuntime.commitInsertedGridItemWithVerticalPushdown(layout, item, preferredTarget)
  );

  let copySelectedWorkspaceObjects = () => false;
  let pasteWorkspaceClipboardObjects = () => false;

  const groupEntriesFit = (entries, deltaCol, deltaRow, occupied) => (
    collisionReflowRuntime.groupEntriesFit(entries, deltaCol, deltaRow, occupied)
  );

  const clampGroupDelta = (entries, deltaCol, deltaRow) => collisionReflowRuntime.clampGroupDelta(entries, deltaCol, deltaRow);

  const findGroupDelta = (entries, preferredDelta, occupied) => collisionReflowRuntime.findGroupDelta(entries, preferredDelta, occupied);

  const applyGroupDelta = (entries, delta) => collisionReflowRuntime.applyGroupDelta(entries, delta);

  const groupDragEntries = (activeItem, placeholder, groupItems, startBounds) => (
    collisionReflowRuntime.groupDragEntries(activeItem, placeholder, groupItems, startBounds)
  );

  const externalOccupiedForGroup = (layout, excludedItems) => collisionReflowRuntime.externalOccupiedForGroup(layout, excludedItems);

  const commitGroupDropSlot = (layout, activeItem, groupItems, preferredTarget, startBounds) => (
    collisionReflowRuntime.commitGroupDropSlot(layout, activeItem, groupItems, preferredTarget, startBounds)
  );

  const orderedLayoutStartRow = (layout) => {
    if (!layout?.classList?.contains("panel-layout")) return 1;
    const host = gridHostForLayout(layout);
    if (host === layout) return 1;
    const key = gridItemLayoutKey(layout);
    const widgetLayout = host.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(key)}"]`);
    if (!widgetLayout) return 1;
    const widgetBottom = orderedGridItems(widgetLayout, { includePlaceholders: true })
      .filter((item) => !item.classList.contains("widget-dragging"))
      .reduce((bottom, item) => {
        const row = Number(item.dataset.gridRow) || 1;
        return Math.max(bottom, row + gridItemRowSpan(item) - 1);
      }, 0);
    return Math.max(1, widgetBottom + 1);
  };

  const packOrderedGridItems = (layout, items) => collisionReflowRuntime.packOrderedGridItems(layout, items);

  const applyOrderedGridLayout = (layout, items = orderedGridItems(layout, { includePlaceholders: true })) => {
    return collisionReflowRuntime.applyOrderedGridLayout(layout, items);
  };

  const reflowItemsForLayout = (layout, excludeItem = null) => {
    const host = gridHostForLayout(layout);
    const selector = ".widget-layout > .widget-card, .widget-layout > .widget-placeholder, .panel-layout > .db-panel, .panel-layout > .db-panel-placeholder";
    return [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
  };

  const shouldAnimateGridReflowItem = (item, metrics, viewport, options = {}) => {
    if (options.activeItems?.has?.(item)) return true;
    const lod = workspaceVisualLodForItem(item, metrics, viewport);
    return lod === "active" || lod === "visible" || lod === "near";
  };

  const animateOrderedGridReflow = (layout, update, excludeItem = null, options = {}) => {
    const items = (options.items || reflowItemsForLayout(layout, excludeItem))
      .filter((item) => item.isConnected && item !== excludeItem && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
    const metrics = options.metrics || createGridMetrics(layout);
    const viewport = workspaceVisualViewport();
    const activeItems = new Set([].concat(options.activeItems || []).filter(Boolean));
    const animatableItems = items.filter((item) => shouldAnimateGridReflowItem(item, metrics, viewport, { activeItems }));
    const before = new Map(animatableItems.map((item) => [item, item.getBoundingClientRect()]));
    update();
    scheduleWorkspaceVisualLodRefresh(gridHostForLayout(layout));
    const afterItems = (options.items || reflowItemsForLayout(layout, excludeItem))
      .filter((item) => (
        item.isConnected &&
        item !== excludeItem &&
        !item.classList.contains("widget-dragging") &&
        !item.classList.contains("db-panel-dragging") &&
        before.has(item) &&
        shouldAnimateGridReflowItem(item, metrics, viewport, { activeItems })
      ));
    afterItems.forEach((item) => {
      const first = before.get(item);
      if (!first) return;
      const last = item.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      item.animate(
        [
          { transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 180, easing: "cubic-bezier(.2, .8, .2, 1)" }
      );
    });
  };

  const insertItemAtOrderedIndex = (layout, item, index, excludeItems = []) => {
    const siblings = orderedGridItems(layout, { includePlaceholders: true, exclude: [item, ...excludeItems] });
    const reference = siblings[Math.max(0, Math.min(index, siblings.length))] || null;
    layout.insertBefore(item, reference);
  };

  const panelBodyRectFromSnapshot = (panel, snapshot) => panelContainmentRuntime.panelBodyRectFromSnapshot(panel, snapshot);

  const panelHeaderRectFromSnapshot = (panel, snapshot) => panelContainmentRuntime.panelHeaderRectFromSnapshot(panel, snapshot);

  const pointInRect = (clientX, clientY, rect) => dashboardGeometry.pointInRect(clientX, clientY, rect);
  const PANEL_ENTRY_TOLERANCE_PX = 42;
  const expandPanelEntryBodyRect = (rect, tolerance = PANEL_ENTRY_TOLERANCE_PX) => dashboardGeometry.expandRect(rect, tolerance);
  const PANEL_HEADER_ENTRY_TOLERANCE_PX = 18;
  const expandPanelEntryHeaderRect = (rect, tolerance = PANEL_HEADER_ENTRY_TOLERANCE_PX) => dashboardGeometry.expandRect(rect, tolerance);
  const clampPointToPanelBodyRect = (panel, clientX, clientY, snapshot = null) => (
    panelContainmentRuntime.clampPointToPanelBodyRect(panel, clientX, clientY, snapshot)
  );

  const panelEntryCandidateAt = (clientX, clientY, draggedWidget, options = {}) => (
    panelContainmentRuntime.panelEntryCandidateAt(clientX, clientY, draggedWidget, options)
  );

  const animateAbsorbedWidgetIntoPanel = (widget, fromRect) => (
    panelContainmentRuntime.animateAbsorbedWidgetIntoPanel(widget, fromRect)
  );

  const workspaceWidgetLayoutForPanel = (panel) => panelContainmentRuntime.workspaceWidgetLayoutForPanel(panel);

  const refreshPanelContainedWidgetRuntime = (widget, options = {}) => {
    if (!widget || !widget.classList?.contains("widget-card") || !widget.isConnected) return;
    const layout = widget.closest(".widget-layout");
    const panelLayout = widget.closest(".panel-layout");
    if (panelLayout) syncWorkspaceRegions(panelLayout);
    if (layout) syncWorkspaceRegions(layout);
    const layoutKey = options.layoutKey || activeLayoutKeyForItem(widget);
    const resolved = resolveWorkspaceContextForItem(widget, { layoutKey, profile: options.profile || getActivePanelProfile(layoutKey) });
    cancelManagedWidgetQueryForWidget(widget);
    invalidateManagedWidgetQueryForWidget(widget);
    syncWidgetContextOutputs(widget);
    void refreshWidgetRuntimeData(widget, resolved, { force: true });
  };

  const absorbWidgetIntoPanel = (options) => {
    const result = panelContainmentRuntime.absorbWidgetIntoPanel(options);
    if (!result) return null;
    const panelLayout = options?.panel?.closest?.(".panel-layout");
    if (panelLayout) syncWorkspaceRegions(panelLayout);
    refreshPanelContainedWidgetRuntime(result, {
      layoutKey: options?.widget?.dataset?.widgetLayoutKey || options?.widget?.dataset?.layoutKey,
      profile: options?.layout?.dataset?.layoutProfile || null,
    });
    return result;
  };

  const extractPanelChildWidgetToWorkspace = (options) => {
    const result = panelContainmentRuntime.extractPanelChildWidgetToWorkspace(options);
    if (!result?.widget) return null;
    const targetLayout = options?.targetLayout;
    if (targetLayout) syncWorkspaceRegions(targetLayout);
    refreshPanelContainedWidgetRuntime(result.widget, {
      layoutKey: options?.targetLayout?.dataset?.widgetLayoutKey || options?.targetLayout?.dataset?.layoutKey,
    });
    return result;
  };

  const orderedInsertionIndexFromPoint = (layout, placeholder, activeItem, clientX, clientY) => {
    const target = gridCellFromPoint(layout, activeItem, clientX, clientY);
    const siblings = orderedGridItems(layout, { includePlaceholders: false, exclude: [activeItem] });
    let best = { index: siblings.length, score: Infinity };
    for (let index = 0; index <= siblings.length; index += 1) {
      const candidate = [...siblings];
      candidate.splice(index, 0, placeholder);
      const placement = packOrderedGridItems(layout, candidate).get(placeholder);
      if (!placement) continue;
      const score = (Math.abs(placement.row - target.row) * DASHBOARD_GRID_COLUMNS) + Math.abs(placement.col - target.col);
      if (score < best.score || (score === best.score && index > best.index && target.row >= placement.row)) {
        best = { index, score };
      }
    }
    return best.index;
  };

  let runOrderedDrag;

  const groupResizeRuntime = createGroupResizeRuntime({
    DASHBOARD_GRID_COLUMNS,
    DASHBOARD_GRID_ROW_HEIGHT,
    dashboardGeometry,
    gridHostForLayout,
    gridItemLayoutKey,
    gridGapForLayout,
    gridHeightForRows,
    gridRowsFromHeight,
    gridRectForLayout,
    resizeAlignmentTargetsForLayout,
    getPanelRuntime: () => panelRuntime,
    panelMinimumRows,
    panelExpandedMinimumRows,
    expandedPanelFootprintRows,
    gridItemMinimumRows,
    gridItemMinimumSpan,
    isPanelInternalWidgetLayout,
    isWidgetGridItem,
    widgetRuntimeController,
    groupItemLayout,
    createGroupBoundarySurface,
    updateGroupBoundarySurface,
    updateLiveResizeSurface,
    visualGridOrder,
    gridBoundsForItem,
    boundsAtGridSlot,
    canPlaceBounds,
    externalOccupiedForGroup,
    groupTransformItems,
    closeInactiveDashboardTools,
    beginResizeLifecycle,
    createResizeSessionGeometry,
    snapshotGridLayout,
    createGridMetrics,
    gridItemPixelWidthForSpan,
    createResizePreview,
    createExpandedFootprintGhost,
    updateExpandedFootprintGhost,
    beginLiveResizeSurface,
    reflowItemsForLayout,
    resolveSparseGridLayoutForActiveItems,
    animateOrderedGridReflow,
    syncOpenPanelHeightToInternalGrid,
    syncCommittedWorkspaceScrollFloor,
    restoreGridLayoutSnapshot,
    clearLiveResizeSurface,
  });
  const {
    alignedResizeHeight,
    applyGroupFootprintBounds,
    beginGroupLiveSurfaces,
    createGroupFootprint,
    groupBoxBounds,
    groupGridBox,
    runGroupResize,
  } = groupResizeRuntime;

  ({ runOrderedDrag } = createOrderedDragRuntime({
    DASHBOARD_GRID_COLUMNS,
    DASHBOARD_GRID_ROW_HEIGHT,
    dashboardDragRuntime,
    workspaceObjectCapabilities,
    beginInteractionAutoScroll,
    gridHostForLayout,
    clearSurfaceResponse,
    groupTransformItems,
    gridBoundsForItem,
    gridItemRowSpan,
    groupGridBox,
    createGroupFootprint,
    beginGroupLiveSurfaces,
    createExpandedFootprintGhost,
    closeInactiveDashboardTools,
    createGridMetrics,
    refreshGridMetricsRect,
    reflowItemsForLayout,
    isPanelInternalWidgetLayout,
    panelForInternalWidgetLayout,
    workspaceWidgetLayoutForPanel,
    snapshotGridLayout,
    restoreGridLayoutSnapshot,
    syncPanelFootprintToInternalItem,
    updatePanelChildEmptyState,
    widgetRuntimeController,
    panelRuntime,
    animateOrderedGridReflow,
    panelEntryCandidateAt,
    ensurePanelInternalWidgetGrid,
    clampPointToPanelBodyRect,
    absorbWidgetIntoPanel,
    extractPanelChildWidgetToWorkspace,
    gridCellFromPoint,
    gridCellFromDragPointer,
    updateExpandedFootprintGhost,
    gridRectForLayout,
    groupBoxBounds,
    applyGroupFootprintBounds,
    boundsAtGridSlot,
    resolveSparseGridLayout,
    commitExpandedPanelDropSlot,
    commitActiveDropSlot,
    syncCommittedWorkspaceScrollFloor,
    scheduleWorkspaceVisualLodRefresh,
    applyGroupDelta,
  }));


  const saveWidgetLayouts = (layout, profile = getActivePanelProfile(layout.dataset.widgetLayoutKey || "default"), options = {}) => {
    if (isPanelInternalWidgetLayout(layout)) {
      const panel = panelForInternalWidgetLayout(layout);
      const panelLayout = panel?.closest?.(".panel-layout");
      if (!panel || !panelLayout) return;
      syncOpenPanelHeightToInternalGrid(panel);
      updatePanelChildEmptyState(panel);
      savePanelLayouts(panelLayout, getActivePanelProfile(panelLayout.dataset.layoutKey || "default"), options);
      return;
    }
    const layoutKey = layout.dataset.widgetLayoutKey || "default";
    const persist = Boolean(options.persist);
    syncWorkspaceRegions(layout);
    if (!persist) {
      if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
      return;
    }
    captureLayoutUndo(layoutKey, profile);
    const expansionBaselineSnapshot = expansionBaselineSnapshotForLayoutKey(layoutKey);
    [...layout.querySelectorAll(":scope > .widget-card:not([hidden])")].forEach((widget, index) => {
      const key = widget.dataset.widgetKey;
      const expansionBaseline = serializableExpansionBaselineState(expansionBaselineSnapshot, widget);
      if (!key) return;
      try {
        writeJsonStore(widgetStorageKey(layoutKey, key, profile), {
          order: index,
          span: Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 3,
          gridCol: Number(widget.dataset.gridCol) || null,
          gridRow: Number(widget.dataset.gridRow) || null,
          rowSpan: Number(widget.dataset.gridRowSpan) || 1,
          color: widget.dataset.panelColor || null,
          title: widget.dataset.panelTitle || null,
          pinned: widget.classList.contains("db-panel-pinned"),
          type: widget.dataset.widgetType || null,
          runtimeType: widget.dataset.widgetRuntimeType || widget.dataset.widgetDefinition || null,
          widgetLayer: widgetLayerForElement(widget),
          minW: Number(widget.dataset.minW) || null,
          minH: Number(widget.dataset.minH) || null,
          locked: widget.dataset.locked === "true",
          resizable: widget.dataset.resizable === "false" ? false : true,
          config: widget.dataset.widgetConfig || null,
          breakBefore: widgetHasRowBreakBefore(widget),
          spacerBefore: widgetSpacerSiblingsBefore(widget).length,
          expansionBaseline,
          ...workspaceObjectPersistence(widget),
        });
      } catch {}
    });
    const customWidgets = [...layout.querySelectorAll(':scope > .widget-card[data-custom-widget="true"]:not([hidden])')]
      .map((widget) => ({
        key: widget.dataset.widgetKey,
        title: widget.dataset.panelTitle || widget.querySelector(".stat-lbl")?.textContent?.trim() || "Widget",
        value: widget.querySelector(".stat-val")?.textContent?.trim() || "0",
        color: widget.dataset.panelColor || widget.querySelector(".panel-color-toggle")?.dataset.defaultTheme || "#2563eb",
        span: Number(widget.dataset.currentSpan) || 3,
        gridCol: Number(widget.dataset.gridCol) || null,
        gridRow: Number(widget.dataset.gridRow) || null,
        rowSpan: Number(widget.dataset.gridRowSpan) || 1,
        type: widget.dataset.widgetType || "tracker",
        runtimeType: widget.dataset.widgetRuntimeType || widget.dataset.widgetDefinition || null,
        widgetLayer: widgetLayerForElement(widget),
        href: widget.getAttribute("href") || "",
        pinned: widget.classList.contains("db-panel-pinned"),
        minW: Number(widget.dataset.minW) || null,
        minH: Number(widget.dataset.minH) || null,
        locked: widget.dataset.locked === "true",
        resizable: widget.dataset.resizable === "false" ? false : true,
        config: widget.dataset.widgetConfig || null,
        ...workspaceObjectPersistence(widget),
      }));
    try {
      writeJsonStore(customWidgetsKey(layoutKey, profile), customWidgets);
      writeRawStore(hiddenWidgetsKey(layoutKey, profile), layout.dataset.hiddenWidgetsDraft || "[]");
    } catch {}
  };

  const { buildPanelColorMenu } = createPanelColorMenuFactory({
    selectedGroupItems,
    groupItemLayoutKey,
    groupItemLayout,
    saveWidgetLayouts,
    savePanelLayouts,
    menuOverlayLayer,
  });

  ({
    requestWorkspaceObjectDelete,
    requestPanelDelete,
    requestWidgetDelete,
  } = initializeDeleteRuntime({
    panelDeleteDialog,
    panelDeleteMessage,
    panelDeleteConfirm,
    panelDeleteCancel,
    panelDeleteClose,
    workspaceDeleteKind,
    isPanelInternalWidgetLayout,
    gridItemLayoutKey,
    parseJsonRecord,
    widgetDefinitionForElement,
    cleanupWidgetRowBreaks,
    saveWidgetLayouts,
    cleanupPanelRowBreaks,
    savePanelLayouts,
    getActivePanelProfile,
    pushLiveLayoutUndo,
    restoreDashboardToolDrawer,
    dashboardSettingsToggleForItem,
    dashboardColorToggleForItem,
    groupSelection,
    groupSelectedIds,
    groupItemId,
    closeInactiveDashboardTools,
    syncLayoutToolsActive,
    panelChildWidgets,
    gridBoundsForItem,
    readDraftList,
    undoTransientItemClasses,
    DASHBOARD_GRID_COLUMNS,
    commitInsertedGridItemWithVerticalPushdown,
    writeDraftList,
    updatePanelChildEmptyState,
    panelForInternalWidgetLayout,
    relaxCollapsedExpansionDisplacement,
    endPanelExpansionSession,
    emitWorkspaceEvent,
    regionIdForWorkspaceItem,
    showToast,
  }));

  const { initWidgetLayout } = createWidgetLayoutRuntime({
    isPanelInternalWidgetLayout,
    gridItemLayoutKey,
    getActivePanelProfile,
    readJsonStore,
    customWidgetsKey,
    createCustomWidget,
    parseJsonRecord,
    readRawStore,
    hiddenWidgetsKey,
    writeDraftList,
    widgetStorageKey,
    hydrateWidgetRuntime,
    widgetRuntimeController,
    markLoadedExpansionBaseline,
    ensureWorkspaceObjectMetadata,
    workspaceObjectType,
    applyWorkspaceContextToElement,
    applyPanelColor,
    applyPanelTitleColor,
    setWidgetConfig,
    widgetConfigFromElement,
    createWidgetRowBreak,
    createWidgetSpacer,
    cleanupWidgetRowBreaks,
    syncDefaultDashboardGrid,
    normalizeGridLayout,
    syncWorkspaceRegions,
    saveWidgetLayouts,
    bindWidgetRuntimeControls,
    buildPanelColorMenu,
    ensureWidgetWorkbenchPanel,
    isDashboardInteractionActive,
    positionDashboardToolDrawer,
    pointInRect,
    canOpenDashboardTools,
    portalDashboardToolDrawer,
    positionDashboardToolDrawerAtPointer,
    setWidgetLinkNavigationSuspended,
    syncLayoutToolsActive,
    restoreFloatingMenu,
    restoreDashboardToolDrawer,
    closeInactiveDashboardTools,
    portalFloatingMenu,
    positionPanelColorMenu,
    syncPanelThemeVars,
    applyWidgetSettingsSchemaChange,
    groupPeers,
    groupItemLayout,
    requestWidgetDelete,
    isPanelInternalGridItem,
    isWorkspaceSurfaceDragStart,
    isDashboardToolInteractionTarget,
    runOrderedDrag,
    saveSharedGridLayouts,
    emitWorkspaceEvent,
    regionIdForWorkspaceItem,
    DASHBOARD_GRID_COLUMNS,
    groupTransformItems,
    runGroupResize,
    createGridMetrics,
    panelForInternalWidgetLayout,
    gridItemRowSpan,
    gridItemPixelWidthForSpan,
    gridItemMinimumSpan,
    gridItemMinimumRows,
    gridHeightForRows,
    createResizePreview,
    reflowItemsForLayout,
    beginLiveResizeSurface,
    beginResizeAutoZoomCamera,
    updateResizeAutoZoomCamera,
    snapshotGridLayout,
    restoreGridLayoutSnapshot,
    resolveSparseGridLayout,
    syncOpenPanelHeightToInternalGrid,
    resizeAutoZoomPointerToScenePoint,
    updateLiveResizeSurface,
    animateOrderedGridReflow,
    endResizeAutoZoomCamera,
    groupedWidgetReleaseSpan,
    alignedResizeSpan,
    refreshGridMetricsRect,
    clearLiveResizeSurface,
    syncCommittedWorkspaceScrollFloor,
    beginResizeLifecycle,
    resizeEdgeFromPointer,
    surfaceResponseControlSelector,
  });
  ({
    panelRuntime,
    panelContainmentRuntime,
  } = initializePanelRuntimes({
    dashboardPanelRuntime,
    dashboardPanelContainment,
    DASHBOARD_GRID_COLUMNS,
    DASHBOARD_GRID_ROW_HEIGHT,
    workspaceObjectCapabilities,
    gridRowsFromHeight,
    gridHeightForRows,
    gridGapForLayout,
    gridItemRowSpan,
    gridItemMinimumSpan,
    createGridMetrics,
    gridBoundsForItem,
    panelMinimumRows,
    openPanelForInternalDrop,
    applyVerticalPanelExpansion,
    resolveSparseGridLayout,
    reflowItemsForLayout,
    undoTransientItemClasses,
    groupItemLayoutKey,
    applyWidgetSpan: widgetRuntimeController.applySpan,
    applyWidgetGridPosition: widgetRuntimeController.applyGridPosition,
    gridCellFromPoint,
    initWidgetLayout,
    readDraftList,
    writeDraftList,
    gridItemLayoutKey,
    regionIdForWorkspaceItem,
    emitWorkspaceEvent,
    commitActiveDropSlot,
    cleanupWidgetRowBreaks,
  }));

  document.querySelectorAll(".widget-layout").forEach(initWidgetLayout);

  const { initPanelLayouts } = createPanelLayoutRuntime(
    {
      getActivePanelProfile,
      readJsonStore,
      customPanelsKey,
      createCustomPanel,
      parseJsonRecord,
      readRawStore,
      hiddenPanelsKey,
      writeDraftList,
      panelStorageKey,
      markLoadedExpansionBaseline,
      ensureWorkspaceObjectMetadata,
      workspaceObjectType,
      applyWorkspaceContextToElement,
      WORKSPACE_OBJECT_TYPES,
      panelRuntime,
      applyPanelColor,
      applyPanelTitleColor,
      restorePanelChildWidgets,
      createPanelRowBreak,
      cleanupPanelRowBreaks,
      syncDefaultDashboardGrid,
      normalizeGridLayout,
      syncWorkspaceRegions,
      syncPanelMinimumWidth,
      workspaceObjectCapabilities,
      ensurePanelInternalWidgetGrid,
      initWidgetLayout,
      syncOpenPanelHeightToInternalGrid,
      isDashboardInteractionActive,
      surfaceResponseState,
      updateSurfaceResponse,
      buildPanelColorMenu,
      canOpenDashboardTools,
      portalDashboardToolDrawer,
      positionDashboardToolDrawerAtPointer,
      positionDashboardToolDrawer,
      syncLayoutToolsActive,
      restoreDashboardToolDrawer,
      surfaceResponseControlSelector,
      closeInactiveDashboardTools,
      syncPanelThemeVars,
      positionPanelColorMenu,
      groupPeers,
      groupItemLayout,
      savePanelLayouts,
      requestPanelDelete,
      ensureRenderedGridPosition,
      beginPanelExpansionSession,
      panelMinimumRows,
      animatePanelReflow,
      relaxCollapsedExpansionDisplacement,
      endPanelExpansionSession,
      applyVerticalPanelExpansion,
      emitWorkspaceEvent,
      regionIdForWorkspaceItem,
      isWorkspaceSurfaceDragStart,
      isDashboardToolInteractionTarget,
      runOrderedDrag,
      saveSharedGridLayouts,
      DASHBOARD_GRID_COLUMNS,
      DASHBOARD_GRID_ROW_HEIGHT,
      groupTransformItems,
      runGroupResize,
      createGridMetrics,
      gridItemRowSpan,
      gridHeightForRows,
      gridItemPixelWidthForSpan,
      gridItemMinimumSpan,
      createResizePreview,
      reflowItemsForLayout,
      beginLiveResizeSurface,
      beginResizeAutoZoomCamera,
      updateResizeAutoZoomCamera,
      createExpandedFootprintGhost,
      snapshotGridLayout,
      restoreGridLayoutSnapshot,
      resolveSparseGridLayout,
      resizeAutoZoomPointerToScenePoint,
      updateLiveResizeSurface,
      expandedPanelFootprintHeight,
      updateExpandedFootprintGhost,
      animateOrderedGridReflow,
      endResizeAutoZoomCamera,
      groupedPanelReleaseSpan,
      alignedResizeSpan,
      refreshGridMetricsRect,
      alignedResizeHeight,
      clearLiveResizeSurface,
      applyOrderedGridLayout,
      syncCommittedWorkspaceScrollFloor,
      beginResizeLifecycle,
      resizeEdgeFromPointer,
    },
  );

  document.querySelectorAll(".widget-layout").forEach(initWidgetLayout);
  initPanelLayouts();

  initializeWorkspacePostInit({
    restoreLoadedExpansionBaseline,
    surfaceResponseSelector,
    initWorkspaceMinimapLayer,
    refreshWorkspaceMiniMaps,
    workspaceRegionSummaryForItem,
  });
  const {
    savePersistedWorkspaceSnapshot,
  } = initializePersistedWorkspaceRuntime({
    PERSISTED_WORKSPACE_VERSION,
    getActivePanelProfile,
    syncWorkspaceRegions,
    workspaceObjectType,
    WORKSPACE_OBJECT_TYPES,
    widgetDefinitionForElement,
    widgetInstanceFromElement,
    mediaWidgetAssetState,
    isMediaWidgetDefinition,
    setWidgetConfig,
    widgetLayerForElement,
    workspaceContextFromElement,
    gridBoundsForItem,
    serializableExpansionBaselineState,
    expansionBaselineSnapshotForLayoutKey,
    activeLayoutKeyForItem,
    workspaceObjectPersistence,
    workspaceObjectKey,
    undoTransientItemClasses,
    panelChildWidgets,
    loadWorkspaceContexts,
    loadDataSources,
    loadAssets,
    widgetRuntime,
    writeJsonStore,
    readJsonStore,
    persistedWorkspaceKey,
  });

  const {
    bindDashboardKeywordForms,
  } = createDashboardFormBindings({
    applyDashboardKeywordSearch,
  });
  bindDashboardKeywordForms();

  ({
    copySelectedWorkspaceObjects,
    pasteWorkspaceClipboardObjects,
  } = createClipboardRuntime({
    layoutPersistence,
    selectedGroupItems,
    isPanelInternalGridItem,
    groupItemLayoutKey,
    workspaceObjectKey,
    workspaceObjectType,
    getActivePanelProfile,
    visualGridOrder,
    workspaceDeleteKind,
    gridBoundsForItem,
    sanitizeLayoutElementForUndo,
    showToast,
    undoTransientItemClasses,
    WORKSPACE_OBJECT_TYPES,
    pushLiveLayoutUndo,
    visibleRegionInsertionTarget,
    orderedLayoutStartRow,
    commitInsertedGridItemWithVerticalPushdown,
    clearGroupSelection,
    applyWidgetGridPosition: widgetRuntimeController.applyGridPosition,
    bindDashboardKeywordForms,
    applyPanelGridPosition: panelRuntime.applyPanelGridPosition,
    ensureWorkspaceObjectMetadata,
    setGroupItemSelected,
    syncWorkspaceRegions,
    animatePanelReflow,
    animateWidgetReflow,
    cleanupPanelRowBreaks,
    savePanelLayouts,
    cleanupWidgetRowBreaks,
    saveWidgetLayouts,
  }));

  seedInitialLayoutHistory({
    pushLiveLayoutUndo,
  });


  initializeLayoutSourceRuntime({
    layoutSourceKey,
    readJsonStore,
    writeJsonStore,
    portalFloatingMenu,
    restoreFloatingMenu,
    layoutPersistence,
    showToast,
    getActivePanelProfile,
    loadDataSources,
    loadWorkspaceContexts,
    loadAssets,
    refreshResolvedContextDebug,
    scheduleWorkspaceVisualLodRefresh,
    savePanelLayouts,
    saveWidgetLayouts,
    saveWorkspaceContextState,
    savePersistedWorkspaceSnapshot,
  });
  initializeGroupSelectionControls({
    getGroupMode,
    setGroupMode,
    toggleGroupItem,
    showToast,
  });

  initializeObjectAddRuntime({
    positionPortaledMenu,
    portalFloatingMenu,
    restoreFloatingMenu,
    originalMenuParent,
    widgetDefinitionFor,
    normalizeWorkspaceWidgetLayer,
    getActivePanelProfile,
    savePanelLayouts,
    saveWidgetLayouts,
    syncDefaultDashboardGrid,
    syncPanelMinimumWidth,
    panelThemePresets,
    createCustomPanel,
    createCustomWidget,
    panelAddTarget,
    visibleRegionInsertionTarget,
    applyPanelSpan: panelRuntime.applyPanelSpan,
    applyWidgetSpan: widgetRuntimeController.applySpan,
    applyPanelColor,
    applyPanelTitleColor,
    applyPanelGridPosition: panelRuntime.applyPanelGridPosition,
    applyWidgetGridPosition: widgetRuntimeController.applyGridPosition,
    animatePanelReflow,
    animateWidgetReflow,
    commitInsertedGridItemWithVerticalPushdown,
    syncWorkspaceRegions,
    ensureWorkspaceObjectMetadata,
    ensureWidgetTools: widgetRuntimeController.ensureTools,
    parseJsonRecord,
    bindDashboardKeywordForms,
    refreshResolvedContextDebug,
    showToast,
    regionIdForWorkspaceItem,
    WORKSPACE_OBJECT_TYPES,
  });
  initializeHistoryResetRuntime({
    restoreLayoutUndo,
    restoreLayoutRedo,
    showToast,
    emitWorkspaceEvent,
    getActivePanelProfile,
    copySelectedWorkspaceObjects,
    pasteWorkspaceClipboardObjects,
    panelDeleteDialog,
    selectedGroupItems,
    requestWorkspaceObjectDelete,
    captureLayoutUndo,
    removeStore,
    dataSourcesKey,
    workspaceContextsKey,
    persistedWorkspaceKey,
    writeDraftList,
    applyWidgetSpan: widgetRuntimeController.applySpan,
    applyPanelColor,
    applyPanelTitleColor,
    applyPanelSpan: panelRuntime.applyPanelSpan,
    updatePanelChildEmptyState,
    syncDefaultDashboardGrid,
    normalizeGridLayout,
    pushLiveLayoutUndo,
  });

});

void import("./liquid-glass-webgl.js");
