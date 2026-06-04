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
import { hydratePanelLayout } from "./modules/panel-layout-hydration.js";
import { hydrateWidgetLayout } from "./modules/widget-layout-hydration.js";
import { initializePersistedWorkspaceRuntime } from "./modules/persisted-workspace-runtime.js";
import { initializeWorkspacePostInit } from "./modules/workspace-post-init.js";
import { initializeGroupSelectionControls } from "./modules/group-selection-controls.js";
import { createDashboardFormBindings } from "./modules/dashboard-form-bindings.js";
import { seedInitialLayoutHistory } from "./modules/layout-history-seeding.js";
import { createWorkspaceMinimapRuntime } from "./modules/workspace-minimap-runtime.js";
import { createWorkspaceObjectModel } from "./modules/workspace-object-model.js";
import { createDashboardToolDrawerRuntime } from "./modules/dashboard-tool-drawer-runtime.js";
import { createReflowAnimationRuntime } from "./modules/reflow-animation-runtime.js";
import { createDashboardDomFactories } from "./modules/dashboard-dom-factories.js";
import { createWorkspaceLogicGraphRuntime } from "./modules/workspace-logic-graph-runtime.js";
import { createWidgetRuntimeMeaning } from "./modules/widget-runtime-meaning.js";
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
import { bindPanelActionControls } from "./modules/panel-action-controls.js";
import { bindPanelChildHoverRuntime } from "./modules/panel-child-hover-runtime.js";
import { bindWidgetMoveRuntime } from "./modules/widget-move-runtime.js";
import { bindPanelMoveRuntime } from "./modules/panel-move-runtime.js";
import { bindWidgetResizeRuntime } from "./modules/widget-resize-runtime.js";
import { bindPanelResizeRuntime } from "./modules/panel-resize-runtime.js";
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
  const positionPortaledMenu = (menu, trigger, options = {}) => dashboardMenuOverlayRuntime?.position?.(menu, trigger, options);
  const portalFloatingMenu = (menu, trigger, options = {}) => dashboardMenuOverlayRuntime?.portal?.(menu, trigger, options);
  const restoreFloatingMenu = (menu) => dashboardMenuOverlayRuntime?.restore?.(menu);
  const originalMenuParent = (menu) => dashboardMenuOverlayRuntime?.originalParent?.(menu);
  const menuOverlayLayer = () => dashboardMenuOverlayRuntime?.ensureLayer?.() || document.body;
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
  let refreshEngineerOverlays = () => {};
  const engineerModeState = Object.freeze({ enabled: false, source: "removed", updatedAt: 0 });
  const isEngineerMode = () => false;
  const refreshEngineerContextVisibility = () => {
    refreshWorkspaceMiniMaps();
  };
  const setEngineerMode = () => false;
  const toggleEngineerMode = () => false;
  const onEngineerModeChange = () => () => {};
  document.body.classList.remove("engineer-mode-active");
  document.documentElement.dataset.engineerMode = "false";

  initializeNavStatusMenus();

  const { scheduleOverflowTitles } = initializeOverflowTitles();
  const { applyDashboardKeywordSearch } = initializeDashboardKeywordSearch({ scheduleOverflowTitles });
  initializeDashboardSwitcher({ portalFloatingMenu, restoreFloatingMenu });
  const layoutPersistence = window.dashboardLayoutPersistence;
  // One-time migration: move working data from numbered save slots to WORKING_PROFILE.
  // Old code set active profile = save slot on save; this migrates any such state so
  // the numbered slots become immutable save snapshots.
  (() => {
    const WORKING = layoutPersistence.WORKING_PROFILE;
    document.querySelectorAll("[data-layout-key]").forEach((el) => {
      const lk = el.dataset.layoutKey;
      if (!lk) return;
      const current = layoutPersistence.getActiveProfile(lk);
      if (current !== WORKING && /^[1-9][0-9]*$/.test(current)) {
        layoutPersistence.copyProfile(lk, current, WORKING);
        layoutPersistence.setActiveProfile(lk, WORKING);
      }
    });
  })();
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
  const workspaceLogicGraphKey = layoutPersistence.key.workspaceLogicGraph;
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
  let groupMode = false;
  const groupSelection = new Set();
  const groupSelectedIds = new Set();
  const groupItemKind = (item) => item?.classList?.contains("widget-card") ? "widget" : "panel";
  const groupItemLayout = (item) => item?.closest?.(".widget-layout, .panel-layout");
  const groupItemLayoutKey = (item) => {
    const layout = groupItemLayout(item);
    return layout?.dataset.widgetLayoutKey || layout?.dataset.layoutKey || "default";
  };
  const groupItemId = (item) => {
    if (!item) return "";
    const key = groupItemKind(item) === "widget" ? item.dataset.widgetKey : item.dataset.panelKey;
    return key ? `${groupItemKind(item)}:${groupItemLayoutKey(item)}:${key}` : "";
  };
  const selectedGroupItems = (kind, layoutKey) => [...groupSelection].filter((item) => {
    if (!item?.isConnected || item.hidden) return false;
    if (kind && groupItemKind(item) !== kind) return false;
    if (layoutKey && groupItemLayoutKey(item) !== layoutKey) return false;
    return true;
  });
  const setGroupItemSelected = (item, selected) => {
    const id = groupItemId(item);
    if (!id) return;
    item.classList.toggle("group-selected", selected);
    item.setAttribute("aria-selected", selected.toString());
    if (selected) {
      groupSelection.add(item);
      groupSelectedIds.add(id);
    } else {
      groupSelection.delete(item);
      groupSelectedIds.delete(id);
    }
  };
  const restoreGroupSelection = () => {
    groupSelection.clear();
    document.querySelectorAll(".widget-layout > .widget-card, .panel-layout > .db-panel").forEach((item) => {
      const selected = groupSelectedIds.has(groupItemId(item));
      item.classList.toggle("group-selected", selected);
      if (selected) {
        item.setAttribute("aria-selected", "true");
        groupSelection.add(item);
      } else if (!item.classList.contains("active")) {
        item.removeAttribute("aria-selected");
      }
    });
  };
  const clearGroupSelection = () => {
    groupSelection.forEach((item) => {
      item.classList.remove("group-selected");
      if (!item.classList.contains("active")) item.removeAttribute("aria-selected");
    });
    groupSelection.clear();
    groupSelectedIds.clear();
  };
  const syncGroupButtons = () => {
    document.body.classList.toggle("group-select-active", groupMode);
    document.querySelectorAll(".layout-group-button").forEach((button) => {
      button.setAttribute("aria-pressed", groupMode.toString());
    });
  };
  const setGroupMode = (enabled) => {
    groupMode = Boolean(enabled);
    if (!groupMode) clearGroupSelection();
    syncGroupButtons();
  };
  const toggleGroupItem = (item) => {
    if (!item) return;
    setGroupItemSelected(item, !groupSelectedIds.has(groupItemId(item)));
  };
  const groupPeers = (source, kind = groupItemKind(source)) => {
    if (!source?.classList?.contains("group-selected")) return [];
    const layoutKey = groupItemLayoutKey(source);
    return selectedGroupItems(kind, layoutKey).filter((item) => item !== source);
  };
  const groupTransformItems = (source, options = {}) => {
    if (!source?.classList?.contains("group-selected")) return [source].filter(Boolean);
    const layoutKey = groupItemLayoutKey(source);
    const includePinned = Boolean(options.includePinned);
    const includeLocked = Boolean(options.includeLocked);
    return selectedGroupItems(null, layoutKey)
      .filter((item) => item?.isConnected && !item.hidden)
      .filter((item) => includePinned || !item.classList.contains("db-panel-pinned"))
      .filter((item) => includeLocked || item.dataset.locked !== "true");
  };
  const undoTransientItemClasses = [...layoutPersistence.transientClasses];
  const sanitizeLayoutElementForUndo = layoutPersistence.sanitizeHtml;
  const serializeLayoutElement = layoutPersistence.serializeElement;
  const {
    beginResizeAutoZoomCamera,
    updateResizeAutoZoomCamera,
    endResizeAutoZoomCamera,
    resizeAutoZoomPointerToScenePoint,
  } = createResizeAutoZoomRuntime({
    isEngineerMode,
    refreshEngineerOverlays,
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
    refreshEngineerOverlays,
    syncLayoutToolsActive,
  });
  const panelDeleteDialog = document.getElementById("panel-delete-dialog");
  const panelDeleteMessage = document.getElementById("panel-delete-message");
  const panelDeleteConfirm = panelDeleteDialog?.querySelector(".confirm-dialog-danger");
  const panelDeleteCancel = panelDeleteDialog?.querySelector(".confirm-dialog-cancel");
  const panelDeleteClose = panelDeleteDialog?.querySelector(".confirm-dialog-close");
  const workspaceDeleteKind = (item) => {
    if (item?.dataset?.workspaceObjectType === "divider" || item?.classList?.contains("workspace-divider")) return "divider";
    if (item?.classList?.contains("widget-card")) return "widget";
    if (item?.classList?.contains("db-panel")) return "panel";
    return "";
  };
  let requestWorkspaceObjectDelete = () => false;
  let requestPanelDelete = () => false;
  let requestWidgetDelete = () => false;
  const getPanelMinimumWidth = (panel) => panelRuntime.getPanelMinimumWidth(panel);

  const syncPanelMinimumWidth = (panel) => panelRuntime.syncPanelMinimumWidth(panel);

  const DASHBOARD_GRID_COLUMNS = 6;
  const DASHBOARD_GRID_ROW_HEIGHT = 81;
  const dashboardGeometry = window.dashboardGeometry;
  let panelRuntime = null;
  let panelContainmentRuntime = null;

  const isPanelInternalWidgetLayout = (layout) => dashboardPanelContainment.isPanelInternalWidgetLayout(layout);
  const panelForInternalWidgetLayout = (layout) => dashboardPanelContainment.panelForInternalWidgetLayout(layout);
  const gridHostForLayout = (layout) => dashboardPanelContainment.gridHostForLayout(layout);
  const isPanelInternalGridItem = (item) => dashboardPanelContainment.isPanelInternalGridItem(item);

  const gridContentRectForHost = (host, rect) => dashboardPanelContainment.gridContentRectForHost(host, rect);

  const gridRectForLayout = (layout) => {
    const host = gridHostForLayout(layout);
    const rect = (host || layout).getBoundingClientRect();
    return gridContentRectForHost(host || layout, rect);
  };

  const gridGapForLayout = (layout) => {
    if (!layout) return 16;
    const host = gridHostForLayout(layout);
    const computed = window.getComputedStyle(host || layout);
    const rawGap = computed.rowGap || computed.gap || (layout.classList.contains("widget-layout") ? "12px" : "16px");
    const gap = parseFloat(rawGap);
    return Number.isFinite(gap) ? gap : (layout.classList.contains("widget-layout") ? 12 : 16);
  };

  const gridRowHeightForLayout = (layout) => {
    if (!layout) return DASHBOARD_GRID_ROW_HEIGHT;
    const host = gridHostForLayout(layout);
    const computed = window.getComputedStyle(host || layout);
    const rowHeight = parseFloat(computed.getPropertyValue("--dashboard-grid-row-height"));
    return Number.isFinite(rowHeight) && rowHeight > 0 ? rowHeight : DASHBOARD_GRID_ROW_HEIGHT;
  };

  const createGridMetrics = (layout) => {
    const rect = gridRectForLayout(layout);
    const gap = gridGapForLayout(layout);
    const rowHeight = gridRowHeightForLayout(layout);
    const width = Math.max(1, rect.width);
    const columnWidth = (width - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS;
    return {
      layout,
      rect,
      gap,
      width,
      columnWidth,
      columnStep: Math.max(1, columnWidth + gap),
      rowHeight,
      rowStep: rowHeight + gap,
      panelMinimumRows: new WeakMap(),
    };
  };

  const refreshGridMetricsRect = (metrics) => {
    if (!metrics?.layout) return metrics;
    metrics.rect = gridRectForLayout(metrics.layout);
    return metrics;
  };

  const gridHeightForRows = (rows, gap, rowHeight = DASHBOARD_GRID_ROW_HEIGHT) => {
    return dashboardGeometry.gridHeightForRows(rows, gap, rowHeight);
  };

  const gridRowsFromHeight = (height, gap, minRows = 1, rowHeight = DASHBOARD_GRID_ROW_HEIGHT) => {
    return dashboardGeometry.gridRowsFromHeight(height, gap, minRows, rowHeight);
  };

  const isWidgetGridItem = (item) => (
    item?.classList?.contains("widget-card") ||
    item?.classList?.contains("widget-placeholder")
  );

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
    dataOriginDefinitions,
    registerDataOriginDefinition,
    normalizeFieldType,
    inferDataSchema,
    semanticFieldScore,
    suggestSemanticMappingFromSchema,
    sourceRows,
    dataSubstrateRowsForSource,
    comparableFilterValue,
    applyContextFilters,
    applyContextTimeRange,
    applyContextSort,
    projectContextFields,
    createRecordAdapter,
    registerDataSourceAdapter,
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
  const ensureContextBadge = (item) => {
    let badge = item.querySelector(":scope > .workspace-context-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "workspace-context-badge";
      item.appendChild(badge);
    }
    return badge;
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
    !(workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.widget && widgetLayerForElement(item) === "backend" && !isEngineerMode()) &&
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

  const {
    emptyWorkspaceLogicGraph,
    normalizeWorkspaceLogicGraph,
    persistedWorkspaceEndpointIds,
    pruneWorkspaceLogicGraphForEndpointIds,
    workspaceLogicGraphFromPersistedSnapshot,
    loadWorkspaceLogicGraph,
    saveWorkspaceLogicGraph,
    deriveWorkspaceRelationships,
    inspectDataSubstrate,
    datasetOriginExposedDatasets,
  } = createWorkspaceLogicGraphRuntime({
    getActivePanelProfile,
    removeStore,
    workspaceLogicGraphKey,
    pushLiveLayoutUndo,
  });
  const workspaceMinimapRuntime = createWorkspaceMinimapRuntime({
    isEngineerMode,
    gridHostForLayout,
    createGridMetrics,
    allCommittedWorkspaceGridItems,
    gridBoundsForItem: (...args) => gridBoundsForItem(...args),
    gridHeightForRows,
    deriveWorkspaceContextRegions,
    workspaceRootRegionId,
    workspaceObjectType,
    WORKSPACE_OBJECT_TYPES,
  });
  refreshWorkspaceMiniMaps = workspaceMinimapRuntime.refreshWorkspaceMiniMaps;
  const { initWorkspaceMinimapLayer } = workspaceMinimapRuntime;

  const gridItemMinimumSpan = (item) => {
    const explicit = Number(item?.dataset?.minW || item?.dataset?.minSpan);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(6, Math.ceil(explicit)));
    if (item?.dataset?.widgetType === "controls") return 2;
    return 1;
  };

  const gridItemMinimumRows = (item) => {
    const explicit = Number(item?.dataset?.minH || item?.dataset?.minRows);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.ceil(explicit));
    return 1;
  };

  const gridItemLayoutKey = (layout) => {
    if (isPanelInternalWidgetLayout(layout)) {
      return panelForInternalWidgetLayout(layout)?.closest?.(".panel-layout")?.dataset.layoutKey || "default";
    }
    return layout?.dataset.widgetLayoutKey || layout?.dataset.layoutKey || "default";
  };

  const saveSharedGridLayouts = (layout) => {
    const host = gridHostForLayout(layout);
    const key = gridItemLayoutKey(layout);
    if (layout?.classList?.contains("widget-layout")) {
      saveWidgetLayouts(layout);
      const panelLayout = host?.querySelector?.(`.panel-layout[data-layout-key="${CSS.escape(key)}"]`);
      if (panelLayout) savePanelLayouts(panelLayout);
    } else {
      savePanelLayouts(layout);
      const widgetLayout = host?.querySelector?.(`.widget-layout[data-widget-layout-key="${CSS.escape(key)}"]`);
      if (widgetLayout) saveWidgetLayouts(widgetLayout);
    }
  };

  const panelMinimumRows = (panel, metrics = null) => panelRuntime.panelMinimumRows(panel, metrics);

  const panelExpandedMinimumRows = (panel, layout = panel.closest(".panel-layout"), metrics = null) => (
    panelRuntime.panelExpandedMinimumRows(panel, layout, metrics)
  );

  const gridItemRowSpan = (item, metrics = null) => {
    if (item.classList.contains("widget-card") || item.classList.contains("widget-placeholder")) {
      const minRows = gridItemMinimumRows(item);
      const explicitRows = Number(item.dataset.gridRowSpan);
      if (Number.isFinite(explicitRows) && explicitRows > 0) return Math.max(minRows, Math.round(explicitRows));
      return minRows;
    }
    if (!workspaceObjectCapabilities(item).hasPanelContentArea && !item.classList.contains("db-panel-placeholder")) return 1;
    if (item.classList.contains("db-panel-collapsed")) return 1;
    if (item.classList.contains("db-panel-placeholder") && Number(item.dataset.gridRowSpan) === 1) return 1;
    const layout = item.closest(".panel-layout");
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const minRows = item.classList.contains("db-panel-placeholder") ? 1 : panelMinimumRows(item, metrics);
    const explicitRows = Number(item.dataset.gridRowSpan);
    if (Number.isFinite(explicitRows) && explicitRows > 0) return Math.max(minRows, Math.round(explicitRows));
    const measuredHeight = Number(item.dataset.savedHeight) || item.getBoundingClientRect().height || DASHBOARD_GRID_ROW_HEIGHT;
    const rows = gridRowsFromHeight(measuredHeight, gap, minRows);
    return Math.max(minRows, Math.round(rows));
  };

  const syncPanelRenderedHeightToFootprint = (panel, rowSpan = null) => (
    panelRuntime.syncPanelRenderedHeightToFootprint(panel, rowSpan)
  );

  const applyPanelSpan = (panel, span) => panelRuntime.applyPanelSpan(panel, span);

  const applyPanelGridPosition = (panel, col, row) => panelRuntime.applyPanelGridPosition(panel, col, row);

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

  const getPanelMinimumHeight = (panel) => panelRuntime.getPanelMinimumHeight(panel);

  const applyPanelHeight = (panel, height) => panelRuntime.applyPanelHeight(panel, height);

  const styleRulePathValue = (source, path) => {
    if (!path) return undefined;
    const parts = String(path).split(".").filter(Boolean);
    return parts.reduce((value, part) => {
      if (value == null) return undefined;
      if (part === "length" && Array.isArray(value)) return value.length;
      return value?.[part];
    }, source);
  };

  const numericMetricValueForWidget = ({ config = {}, data = {}, resolvedContext = {} } = {}) => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
    const metric = ["count", "sum", "avg", "min", "max"].includes(config.metric) ? config.metric : "count";
    if (metric === "count") return total;
    const mapping = resolvedContext?.semanticMapping || data?.semanticMapping || {};
    const valueField = config.valueField || mapping.valueField;
    if (!valueField) return undefined;
    const values = rows.map((row) => {
      const raw = row?.[valueField];
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = Number(raw.replace(/[$,%\s,]/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }).filter((value) => value != null);
    if (!values.length) return undefined;
    if (metric === "sum") return values.reduce((sum, value) => sum + value, 0);
    if (metric === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (metric === "min") return Math.min(...values);
    if (metric === "max") return Math.max(...values);
    return total;
  };

  const styleRuleEnvironmentForWidget = (widget, options = {}) => {
    const definition = options.definition || widgetDefinitionForElement(widget);
    const instance = options.instance || widgetInstanceFromElement(widget, definition);
    const resolvedContext = options.resolvedContext || resolveWorkspaceContextForItem(widget);
    const data = options.data || managedQueryStateForWidget(widget)?.data || null;
    const status = options.status || widget.dataset.widgetRuntimeStatus || managedQueryStateForWidget(widget)?.status || "empty";
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
    return {
      widget,
      definition,
      instance,
      config: instance?.config || {},
      context: resolvedContext || {},
      resolvedContext: resolvedContext || {},
      data: {
        ...(data || {}),
        rows,
        total,
      },
      rows,
      status,
      metric: {
        value: numericMetricValueForWidget({ config: instance?.config || {}, data: data || {}, resolvedContext: resolvedContext || {} }),
      },
      constants: {},
    };
  };

  const logicOperandValue = (operand, environment) => {
    if (operand && typeof operand === "object" && !Array.isArray(operand)) {
      if (operand.type === "path") return styleRulePathValue(environment, operand.path);
      if (operand.type === "constant") return operand.value;
      if (operand.type === "context") return styleRulePathValue(environment.context, operand.path);
      if (operand.type === "config") return styleRulePathValue(environment.config, operand.path);
      if (operand.type === "data") return styleRulePathValue(environment.data, operand.path);
    }
    if (typeof operand !== "string") return operand;
    const trimmed = operand.trim();
    const pathLike = /^(metric|data|rows|status|config|context|resolvedContext|widget|instance|definition)\b/.test(trimmed);
    return pathLike ? styleRulePathValue(environment, trimmed) : operand;
  };

  const compareLogicValues = (left, operator, right) => {
    const leftNumber = typeof left === "number" ? left : Number(left);
    const rightNumber = typeof right === "number" ? right : Number(right);
    const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    if (operator === "<") return numeric ? leftNumber < rightNumber : String(left) < String(right);
    if (operator === ">") return numeric ? leftNumber > rightNumber : String(left) > String(right);
    if (operator === "<=") return numeric ? leftNumber <= rightNumber : String(left) <= String(right);
    if (operator === ">=") return numeric ? leftNumber >= rightNumber : String(left) >= String(right);
    if (operator === "!=") return left !== right && String(left) !== String(right);
    return left === right || String(left) === String(right);
  };

  const evaluateLogicExpression = (expression, environment) => {
    const normalized = normalizeLogicExpression(expression);
    if (normalized.type === "and") return normalized.inputs.length > 0 && normalized.inputs.every((entry) => evaluateLogicExpression(entry, environment));
    if (normalized.type === "or") return normalized.inputs.some((entry) => evaluateLogicExpression(entry, environment));
    if (normalized.type === "not") return !evaluateLogicExpression(normalized.input, environment);
    const left = logicOperandValue(normalized.left, environment);
    const right = logicOperandValue(normalized.right, environment);
    if (left == null || right == null) return false;
    return compareLogicValues(left, normalized.operator, right);
  };

  const clearConditionalStyleForWidget = (widget) => {
    if (!widget) return;
    widget.classList.remove("widget-conditional-style");
    [
      "--conditional-accent",
      "--conditional-accent-rgb",
      "--conditional-text",
      "--conditional-background-tint",
    ].forEach((property) => widget.style.removeProperty(property));
    delete widget.dataset.conditionalRimState;
    delete widget.dataset.conditionalIconState;
    delete widget.dataset.conditionalVisibility;
    delete widget.dataset.activeStyleRuleIds;
    delete widget.dataset.conditionalPanelAccentApplied;
    if (widget.dataset.panelColor && hexToRgb(widget.dataset.panelColor)) {
      applyPanelColor(widget, widget.dataset.panelColor);
    } else {
      widget.style.removeProperty("--panel-accent");
      widget.style.removeProperty("--panel-accent-rgb");
      widget.style.removeProperty("--panel-accent-text");
    }
  };

  const applyConditionalStyleEffects = (widget, effects = []) => {
    effects.forEach((effect) => {
      const property = effect.property;
      const value = effect.value;
      if (property === STYLE_RULE_EFFECT_PROPERTIES.accentColor) {
        const rgb = hexToRgb(value);
        if (!rgb) return;
        widget.style.setProperty("--conditional-accent", `#${String(value).replace("#", "")}`);
        widget.style.setProperty("--conditional-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        widget.style.setProperty("--conditional-text", readableTextFor(rgb));
        widget.style.setProperty("--panel-accent", `#${String(value).replace("#", "")}`);
        widget.style.setProperty("--panel-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        widget.style.setProperty("--panel-accent-text", readableTextFor(rgb));
        widget.dataset.conditionalPanelAccentApplied = "true";
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.textColor) {
        widget.style.setProperty("--conditional-text", String(value || ""));
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.backgroundTint) {
        const rgb = hexToRgb(value);
        if (rgb) {
          widget.style.setProperty("--conditional-background-tint", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .16)`);
        } else if (value) {
          widget.style.setProperty("--conditional-background-tint", String(value));
        }
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.rimState) {
        widget.dataset.conditionalRimState = String(value || "");
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.iconState) {
        widget.dataset.conditionalIconState = String(value || "");
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.visibility) {
        widget.dataset.conditionalVisibility = String(value || "");
      }
    });
  };

  const applyStyleRulesForWidget = (widget, options = {}) => {
    if (!widget?.classList?.contains("widget-card")) return [];
    clearConditionalStyleForWidget(widget);
    return [];
  };

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

  const widgetRuntimeController = window.dashboardWidgetRuntimeController.createRuntime({
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
    dataflowSignalStateForWidget: (widget) => dataflowSignalStateForWidget(widget),
    applySignalConsumerState: (widget, signalState, config) => applySignalConsumerState(widget, signalState, config),
    clearSignalConsumerState: (widget) => clearSignalConsumerState(widget),
    applyStyleRulesForWidget,
    syncWidgetContextOutputs: (widget) => syncWidgetContextOutputs(widget),
  });
  const widgetRuntime = widgetRuntimeController.registry;
  const widgetDefinitionFor = (type) => widgetRuntimeController.definitionFor(type);
  const widgetRuntimeTypeFromElement = (widget) => widgetRuntimeController.runtimeTypeFromElement(widget);
  const widgetDefinitionForElement = (widget) => widgetRuntimeController.definitionForElement(widget);
  const normalizeWorkspaceWidgetLayer = (value, fallback = "presentation") => widgetRuntimeController.normalizeWorkspaceWidgetLayer(value, fallback);
  const widgetLayerForElement = (widget, definition = widgetDefinitionForElement(widget)) => widgetRuntimeController.layerForElement(widget, definition);
  const applyWidgetLayerMetadata = (widget, definition = widgetDefinitionForElement(widget), explicitLayer = "") => widgetRuntimeController.applyLayerMetadata(widget, definition, explicitLayer);
  const parseWidgetConfig = (value) => widgetRuntimeController.parseConfig(value);
  const uniqueValues = (values = []) => [...new Set(values.filter((value) => value != null && String(value).trim()))];
  const setWidgetConfig = (widget, config) => widgetRuntimeController.setConfig(widget, config);
  const setWidgetLinkNavigationSuspended = (widget, suspended) => widgetRuntimeController.setLinkNavigationSuspended(widget, suspended);
  const setWidgetConfigValue = (widget, key, value) => widgetRuntimeController.setConfigValue(widget, key, value);
  const widgetConfigFromElement = (widget, definition = widgetDefinitionForElement(widget)) => widgetRuntimeController.configFromElement(widget, definition);
  const widgetAvailableSizeForDensity = (widget) => widgetRuntimeController.availableSizeForDensity(widget);
  const applyWidgetDensityMetadata = (widget, density) => widgetRuntimeController.applyDensityMetadata(widget, density);
  const resolveWidgetDensityForElement = (widget, definition = widgetDefinitionForElement(widget), availableSize = widgetAvailableSizeForDensity(widget)) => (
    widgetRuntimeController.resolveDensityForElement(widget, definition, availableSize)
  );
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
  const dataflowSignalStateForWidget = (widget, layoutKey = activeLayoutKeyForItem(widget), profile = getActivePanelProfile(layoutKey)) => {
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
      ? `${active ? "Active" : "Inactive"} from ${signalState.sourceLabels?.[0] || signalState.sourceIds?.[0] || "dataflow"}`
      : "No dataflow input";
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
  const {
    deriveWidgetRuntimeMeaning,
    applyWidgetRuntimeMeaning,
  } = createWidgetRuntimeMeaning({
    widgetConfigFromElement,
    widgetDefinitionForElement,
    uniqueValues,
  });
  const widgetInstanceFromElement = (widget, definition = widgetDefinitionForElement(widget)) => widgetRuntimeController.instanceFromElement(widget, definition);
  const setWidgetRuntimeContent = (widget, html) => widgetRuntimeController.setRuntimeContent(widget, html);
  const renderWidgetRuntimeContent = (widget, options = {}) => widgetRuntimeController.renderRuntimeContent(widget, options);
  const {
    renderWidgetSettingsSchemaPanel,
    renderWidgetWorkbenchPanel,
    ensureWidgetWorkbenchPanel,
    settingRawValue,
  } = createWidgetWorkbenchRuntime({
    escapeHtml,
    isEngineerMode,
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

  const panelChildWidgets = (panel) => dashboardPanelContainment.panelChildWidgets(panel);

  const panelInternalGridBlockInsets = (grid) => dashboardPanelContainment.panelInternalGridBlockInsets(grid);

  const requiredPanelHeightForInternalGrid = (panel, options = {}) => (
    panelContainmentRuntime.requiredPanelHeightForInternalGrid(panel, options)
  );

  const syncOpenPanelHeightToInternalGrid = (panel, options = {}) => (
    panelContainmentRuntime.syncOpenPanelHeightToInternalGrid(panel, options)
  );

  const panelRequiredSpanForInternalItem = (panel, item = null) => (
    panelContainmentRuntime.panelRequiredSpanForInternalItem(panel, item)
  );

  const openPanelForInternalDrop = (panel) => panelRuntime.openPanelForInternalDrop(panel);

  const syncPanelFootprintToInternalItem = (panel, item = null, options = {}) => (
    panelContainmentRuntime.syncPanelFootprintToInternalItem(panel, item, options)
  );

  const sanitizePanelChildWidgetClone = (widget) => panelContainmentRuntime.sanitizePanelChildWidgetClone(widget);

  const serializePanelChildWidgets = (panel) => panelContainmentRuntime.serializePanelChildWidgets(panel);

  const updatePanelChildEmptyState = (panel) => panelContainmentRuntime.updatePanelChildEmptyState(panel);

  const ensurePanelInternalWidgetGrid = (panel) => panelContainmentRuntime.ensurePanelInternalWidgetGrid(panel);

  const restorePanelChildWidgets = (panel, definitions = []) => panelContainmentRuntime.restorePanelChildWidgets(panel, definitions);

  const ensureWidgetTools = (widget, theme = "#2563eb") => widgetRuntimeController.ensureTools(widget, theme);

  const syncWidgetRenderedHeightToFootprint = (widget, rowSpan = null, metrics = null) => widgetRuntimeController.syncRenderedHeightToFootprint(widget, rowSpan, metrics);

  const applyWidgetSpan = (widget, span) => widgetRuntimeController.applySpan(widget, span);

  const applyWidgetGridPosition = (widget, col, row, rowSpan = null) => widgetRuntimeController.applyGridPosition(widget, col, row, rowSpan);

  const widgetGridCellFromPoint = (layout, widget, clientX, clientY) => gridCellFromPoint(layout, widget, clientX, clientY);

  const gridItemSpan = (item) => {
    const rawSpan = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    return Math.max(gridItemMinimumSpan(item), Math.min(6, Math.round(rawSpan > 6 ? rawSpan / 2 : rawSpan)));
  };

  const applyGridItemPosition = (item, col, row) => {
    if (isWidgetGridItem(item)) {
      applyWidgetGridPosition(item, col, row);
    } else {
      applyPanelGridPosition(item, col, row);
    }
  };

  const gridItemPixelWidthForSpan = (layout, span, metrics = null) => {
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const layoutWidth = metrics?.width ?? Math.max(1, gridRectForLayout(layout).width);
    const columnWidth = metrics?.columnWidth ?? ((layoutWidth - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS);
    return dashboardGeometry.gridItemPixelWidthForSpan({
      span,
      gap,
      columnWidth,
      columns: DASHBOARD_GRID_COLUMNS,
    });
  };

  const resizeEdgeFromPointer = (event, item, threshold = 10) => {
    if (!event || !item) return null;
    const rect = item.getBoundingClientRect();
    return dashboardGeometry.resizeEdgeFromRect({ clientX: event.clientX, rect, threshold });
  };

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

  const createResizePreview = (layout, item, placeholderClass, rect, metrics = null) => {
    const placeholder = document.createElement("div");
    placeholder.className = `${placeholderClass} dashboard-resize-preview`;
    placeholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
    placeholder.dataset.defaultSpan = item.dataset.defaultSpan || placeholder.dataset.currentSpan;
    placeholder.dataset.gridRowSpan = String(gridItemRowSpan(item, metrics));
    if (item.dataset.minW) placeholder.dataset.minW = item.dataset.minW;
    if (item.dataset.minSpan) placeholder.dataset.minSpan = item.dataset.minSpan;
    if (item.dataset.minH) placeholder.dataset.minH = item.dataset.minH;
    if (item.dataset.minRows) placeholder.dataset.minRows = item.dataset.minRows;
    if (item.dataset.widgetType) placeholder.dataset.widgetType = item.dataset.widgetType;
    if (item.dataset.gridCol) placeholder.dataset.gridCol = item.dataset.gridCol;
    if (item.dataset.gridRow) placeholder.dataset.gridRow = item.dataset.gridRow;
    placeholder.style.gridColumn = item.style.gridColumn || `span ${placeholder.dataset.currentSpan}`;
    placeholder.style.gridRow = item.style.gridRow || "";
    const footprintHeight = placeholderClass === "db-panel-placeholder"
      ? gridHeightForRows(gridItemRowSpan(item, metrics), metrics?.gap ?? gridGapForLayout(layout))
      : Math.max(DASHBOARD_GRID_ROW_HEIGHT, rect.height);
    placeholder.style.height = `${footprintHeight}px`;
    layout.insertBefore(placeholder, item);
    return placeholder;
  };

  const expandedPanelFootprintRows = (panel, layout, proposedRows = null, metrics = null) => (
    panelRuntime.expandedPanelFootprintRows(panel, layout, proposedRows, metrics)
  );

  const expandedPanelFootprintHeight = (panel, layout, proposedRows = null, metrics = null) => (
    panelRuntime.expandedPanelFootprintHeight(panel, layout, proposedRows, metrics)
  );

  const createExpandedFootprintGhost = (panel, layout, rect, proposedRows = null, metrics = null) => {
    if (!workspaceObjectCapabilities(panel).hasExpandedFootprint) return null;
    if (!panel?.classList?.contains("db-panel-collapsed")) return null;
    const ghost = document.createElement("div");
    ghost.className = "dashboard-expanded-footprint-ghost";
    ghost.setAttribute("aria-hidden", "true");
    document.body.appendChild(ghost);
    updateExpandedFootprintGhost(ghost, panel, layout, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      rows: proposedRows,
    }, metrics);
    return ghost;
  };

  const updateExpandedFootprintGhost = (ghost, panel, layout, rect, metrics = null) => {
    if (!ghost) return;
    const height = expandedPanelFootprintHeight(panel, layout, rect.rows, metrics);
    ghost.style.left = `${Math.round(rect.left)}px`;
    ghost.style.top = `${Math.round(rect.top)}px`;
    ghost.style.width = `${Math.round(rect.width)}px`;
    ghost.style.height = `${Math.round(height)}px`;
  };

  const beginLiveResizeSurface = (item, rect) => {
    const preview = item.cloneNode(true);
    preview.classList.add("dashboard-live-resize");
    preview.classList.remove("dashboard-active-resize", "db-panel-dragging", "widget-dragging");
    preview.setAttribute("aria-hidden", "true");
    preview.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    item.classList.add("dashboard-resize-source");
    document.body.appendChild(preview);
    updateLiveResizeSurface(preview, rect.width, rect.height, rect.left, rect.top);
    return preview;
  };

  const updateLiveResizeSurface = (preview, width, height, left = null, top = null) => {
    if (!preview) return;
    if (Number.isFinite(left)) preview.style.left = `${Math.round(left)}px`;
    if (Number.isFinite(top)) preview.style.top = `${Math.round(top)}px`;
    preview.style.width = `${Math.round(width)}px`;
    preview.style.height = `${Math.round(height)}px`;
  };

  const GROUP_BOUNDARY_OUTSET = 5;

  const createGroupBoundarySurface = (className = "") => {
    const boundary = document.createElement("div");
    boundary.className = `dashboard-group-boundary ${className}`.trim();
    boundary.setAttribute("aria-hidden", "true");
    document.body.appendChild(boundary);
    return boundary;
  };

  const updateGroupBoundarySurface = (boundary, rect) => {
    if (!boundary || !rect) return;
    updateLiveResizeSurface(
      boundary,
      Math.max(1, rect.width + (GROUP_BOUNDARY_OUTSET * 2)),
      Math.max(1, rect.height + (GROUP_BOUNDARY_OUTSET * 2)),
      rect.left - GROUP_BOUNDARY_OUTSET,
      rect.top - GROUP_BOUNDARY_OUTSET
    );
  };

  const clearLiveResizeSurface = (item, preview = null) => {
    preview?.remove();
    item.classList.remove("dashboard-resize-source");
  };

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
    applyPanelGridPosition,
    gridItemRowSpan,
    gridItemSpan,
  });

  const gridBoundsForItem = (item, metrics = null) => {
    const col = Math.max(1, Math.round(Number(item.dataset.gridCol) || 1));
    const row = Math.max(1, Math.round(Number(item.dataset.gridRow) || 1));
    const span = gridItemSpan(item);
    const rowSpan = gridItemRowSpan(item, metrics);
    return {
      col,
      row,
      span,
      rowSpan,
      right: col + span - 1,
      bottom: row + rowSpan - 1,
    };
  };

  const gridBoundsOverlap = (a, b) => dashboardGeometry.gridBoundsOverlap(a, b);
  let collisionReflowRuntime = null;

  const indexedCollisionEntries = (bounds, occupied) => (
    collisionReflowRuntime?.indexedCollisionEntries?.(bounds, occupied) ||
    dashboardCollisionReflowRuntime.indexedCollisionEntries(bounds, occupied)
  );

  const nextGridSlot = (bounds) => {
    if (bounds.col < 7 - bounds.span) {
      return { col: bounds.col + 1, row: bounds.row };
    }
    return { col: 1, row: bounds.row + 1 };
  };

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

    placeForcedItems(widgets, applyWidgetGridPosition, 1);
    const widgetBottom = widgets.reduce((bottom, item) => {
      const bounds = gridBoundsForItem(item);
      return Math.max(bottom, bounds.bottom);
    }, 0);
    placeForcedItems(panels, applyPanelGridPosition, Math.max(3, widgetBottom + 1));
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

  const orderedGridSelectorForLayout = (layout, includePlaceholders = false) => {
    if (layout.classList.contains("widget-layout")) {
      return includePlaceholders
        ? ":scope > .widget-card:not([hidden]), :scope > .widget-placeholder"
        : ":scope > .widget-card:not([hidden])";
    }
    return includePlaceholders
      ? ":scope > .db-panel:not([hidden]), :scope > .db-panel-placeholder"
      : ":scope > .db-panel:not([hidden])";
  };

  const orderedGridItems = (layout, { includePlaceholders = false, exclude = [] } = {}) => {
    const excluded = new Set([].concat(exclude || []).filter(Boolean));
    return [...layout.querySelectorAll(orderedGridSelectorForLayout(layout, includePlaceholders))]
      .filter((item) => !excluded.has(item));
  };

  const globalGridItems = (layout, { includePlaceholders = false, exclude = [] } = {}) => {
    const host = gridHostForLayout(layout);
    const excluded = new Set([].concat(exclude || []).filter(Boolean));
    const selector = includePlaceholders
      ? ".widget-layout > .widget-card:not([hidden]), .widget-layout > .widget-placeholder, .panel-layout > .db-panel:not([hidden]), .panel-layout > .db-panel-placeholder"
      : ".widget-layout > .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])";
    return [...host.querySelectorAll(selector)]
      .filter((item) => !excluded.has(item) && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging") && !item.classList.contains("dashboard-live-resize") && !item.classList.contains("dashboard-resize-source") && !item.classList.contains("dashboard-group-source") && !item.classList.contains("dashboard-group-member-preview"));
  };

  const layoutItemsForLogicalResolution = (layout, options = {}) => {
    const excluded = new Set([].concat(options.exclude || []).filter(Boolean));
    const provided = Array.isArray(options.items) ? options.items : null;
    const items = provided || globalGridItems(layout, {
      includePlaceholders: options.includePlaceholders !== false,
      exclude: [...excluded],
    });
    // Defensive: when resolving against a workspace-level layout (not a
    // panel-internal grid), panel-contained widgets must never enter the
    // global occupancy set — the panel container is the single global
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

  const WORKSPACE_VISUAL_LOD_TIERS = Object.freeze({
    active: "active",
    visible: "visible",
    near: "near",
    far: "far",
  });

  const WORKSPACE_VISUAL_LOD_OVERSCAN = Object.freeze({
    visibleMin: 180,
    visibleViewportRatio: .35,
    nearMin: 900,
    nearViewportRatio: 1.5,
  });

  const workspaceVisualViewport = () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const height = window.innerHeight || document.documentElement.clientHeight || 800;
    return {
      top: scrollY,
      bottom: scrollY + height,
      height,
      visibleOverscan: Math.max(WORKSPACE_VISUAL_LOD_OVERSCAN.visibleMin, height * WORKSPACE_VISUAL_LOD_OVERSCAN.visibleViewportRatio),
      nearOverscan: Math.max(WORKSPACE_VISUAL_LOD_OVERSCAN.nearMin, height * WORKSPACE_VISUAL_LOD_OVERSCAN.nearViewportRatio),
    };
  };

  const gridItemDocumentBounds = (item, metrics = null) => {
    const resolvedMetrics = metrics || createGridMetrics(item.closest(".widget-layout, .panel-layout, .panel-internal-widget-grid"));
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const bounds = gridBoundsForItem(item, resolvedMetrics);
    const top = resolvedMetrics.rect.top + scrollY + ((bounds.row - 1) * resolvedMetrics.rowStep);
    const height = gridHeightForRows(bounds.rowSpan, resolvedMetrics.gap, resolvedMetrics.rowHeight);
    return { top, bottom: top + height, bounds };
  };

  const workspaceVisualLodForItem = (item, metrics = null, viewport = workspaceVisualViewport()) => {
    if (
      item.matches?.(":focus-within") ||
      item.classList.contains("active") ||
      item.classList.contains("group-selected") ||
      item.classList.contains("widget-dragging") ||
      item.classList.contains("db-panel-dragging") ||
      item.classList.contains("dashboard-active-resize") ||
      item.classList.contains("dashboard-live-resize") ||
      item.classList.contains("dashboard-resize-source") ||
      item.classList.contains("dashboard-group-member-preview") ||
      item.classList.contains("dashboard-group-source") ||
      item.classList.contains("widget-tools-open") ||
      item.classList.contains("db-panel-tools-open")
    ) {
      return WORKSPACE_VISUAL_LOD_TIERS.active;
    }
    const { top, bottom } = gridItemDocumentBounds(item, metrics);
    if (bottom >= viewport.top - viewport.visibleOverscan && top <= viewport.bottom + viewport.visibleOverscan) return WORKSPACE_VISUAL_LOD_TIERS.visible;
    if (bottom >= viewport.top - viewport.nearOverscan && top <= viewport.bottom + viewport.nearOverscan) return WORKSPACE_VISUAL_LOD_TIERS.near;
    return WORKSPACE_VISUAL_LOD_TIERS.far;
  };

  const syncWorkspaceVisualLod = (scope = document) => {
    const viewport = workspaceVisualViewport();
    const layouts = [...scope.querySelectorAll?.(".widget-layout, .panel-layout, .panel-internal-widget-grid") || []]
      .filter((layout) => layout.isConnected);
    const processedItems = new Set();
    layouts.forEach((layout) => {
      const metrics = createGridMetrics(layout);
      const items = isPanelInternalWidgetLayout(layout)
        ? [...layout.querySelectorAll(":scope > .widget-card:not([hidden])")]
        : globalGridItems(layout, { includePlaceholders: false });
      items.forEach((item) => {
        if (processedItems.has(item)) return;
        processedItems.add(item);
        const lod = workspaceVisualLodForItem(item, metrics, viewport);
        item.dataset.visualLod = lod;
        item.dataset.lod = lod;
      });
    });
  };

  let visualLodRefreshFrame = null;
  const scheduleWorkspaceVisualLodRefresh = (scope = document) => {
    if (visualLodRefreshFrame) return;
    visualLodRefreshFrame = window.requestAnimationFrame(() => {
      visualLodRefreshFrame = null;
      syncWorkspaceVisualLod(scope);
    });
  };

  const committedWorkspaceNaturalHeight = (layout) => {
    const items = globalGridItems(layout, { includePlaceholders: false });
    const maxBottom = items.reduce((bottom, item) => Math.max(bottom, gridBoundsForItem(item).bottom), 1);
    return gridHeightForRows(maxBottom, gridGapForLayout(layout));
  };

  const clearCommittedWorkspaceScrollFloor = (layout) => {
    const host = gridHostForLayout(layout);
    if (!host?.dataset?.committedScrollFloor) return;
    host.style.removeProperty("min-height");
    delete host.dataset.committedScrollFloor;
  };

  const syncCommittedWorkspaceScrollFloor = (layout, { preserveViewport = false, scrollY = null } = {}) => {
    const host = gridHostForLayout(layout);
    if (!host?.classList?.contains("dashboard-layout-grid")) return;
    const naturalHeight = committedWorkspaceNaturalHeight(layout);
    if (!preserveViewport) {
      clearCommittedWorkspaceScrollFloor(layout);
      return;
    }
    const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const targetScrollY = Number.isFinite(scrollY) ? Math.max(0, scrollY) : currentScrollY;
    const desiredViewportBottom = targetScrollY + window.innerHeight + 16;
    const hostTop = host.getBoundingClientRect().top + currentScrollY;
    const requiredHeight = Math.max(0, desiredViewportBottom - hostTop);
    if (requiredHeight > naturalHeight + 1) {
      host.dataset.committedScrollFloor = "true";
      host.style.minHeight = `${Math.ceil(requiredHeight)}px`;
    } else {
      clearCommittedWorkspaceScrollFloor(layout);
    }
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(targetScrollY, maxScrollY));
  };

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
    const anchor = gridBoundsForItem(panels[panels.length - 1]);
    if (anchor.right < DASHBOARD_GRID_COLUMNS) {
      return { col: anchor.right + 1, row: anchor.row };
    }
    return { col: 1, row: anchor.bottom + 1 };
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

  const runOrderedDrag = ({
    layout,
    item,
    event,
    draggingClass,
    placeholderClass,
    threshold = 6,
    onCommit,
    onCancel,
    onStart,
    onEnd,
    deferStartEventHandling = false,
  }) => {
    let interactionStarted = false;
    const markInteractionStarted = (sourceEvent = null) => {
      if (interactionStarted) return;
      interactionStarted = true;
      sourceEvent?.preventDefault?.();
      sourceEvent?.stopPropagation?.();
      document.body.classList.add("panel-interaction-active");
      window.getSelection?.()?.removeAllRanges();
    };
    if (!deferStartEventHandling) {
      markInteractionStarted(event);
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const dragController = dashboardDragRuntime.createPointerDragController({ event, item, mode: "drag" });
    const pointerId = dragController.pointerId;
    const pointerTarget = dragController.pointerTarget;
    const capturePointer = () => dragController.capturePointer();
    let ended = false;
    let rect = null;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    let placeholder = null;
    let startSnapshot = null;
    let targetCell = null;
    let groupDrag = null;
    let groupLive = null;
    let expandedFootprintGhost = null;
    let dragMetrics = null;
    let reflowItems = null;
    const panelEntryIntent = {
      lastX: startX,
      lastY: startY,
      lastTime: event.timeStamp || performance.now(),
      headerPanel: null,
      headerSince: 0,
    };
    const canAbsorbIntoPanel = (
      item.classList.contains("widget-card") &&
      layout.classList.contains("widget-layout") &&
      !isPanelInternalWidgetLayout(layout)
    );
    let panelDrag = null;
    const sourcePanelForPanelLocalDrag = isPanelInternalWidgetLayout(layout)
      ? panelForInternalWidgetLayout(layout)
      : null;
    const workspaceExitLayout = sourcePanelForPanelLocalDrag
      ? workspaceWidgetLayoutForPanel(sourcePanelForPanelLocalDrag)
      : null;
    const canExitPanelToWorkspace = (
      item.classList.contains("widget-card") &&
      !groupDrag &&
      Boolean(sourcePanelForPanelLocalDrag) &&
      Boolean(workspaceExitLayout)
    );
    let panelExitDrag = null;
    const originalCell = {
      col: Number(item.dataset.gridCol) || 1,
      row: Number(item.dataset.gridRow) || 1,
    };
    let lastMoveEvent = event;
    const autoScroll = beginInteractionAutoScroll({
      layout,
      onScrollFrame: (scrollEvent) => {
        if (!dragging || !lastMoveEvent) return;
        try {
          onMove(scrollEvent || lastMoveEvent);
        } catch (error) {
          onUp({ type: "pointercancel" });
          window.setTimeout(() => {
            throw error;
          }, 0);
        }
      },
    });

    const startDrag = (sourceEvent = null) => {
      if (dragging) return;
      markInteractionStarted(sourceEvent);
      clearSurfaceResponse();
      dragController.beginInteraction({
        layout,
        item,
        clientX: sourceEvent?.clientX ?? startX,
        clientY: sourceEvent?.clientY ?? startY,
      });
      if (deferStartEventHandling) capturePointer();
      dragging = true;
      item.dataset.visualLod = "active";
      item.dataset.lod = "active";
      rect = item.getBoundingClientRect();
      startSnapshot = snapshotGridLayout(layout);
      const groupItems = groupTransformItems(item)
        .filter((groupItem) => groupItem === item || !groupItem.classList.contains("db-panel-pinned"));
      if (item.classList.contains("group-selected") && groupItems.length > 1) {
        const startBounds = new Map(groupItems.map((groupItem) => [groupItem, gridBoundsForItem(groupItem)]));
        const groupBox = groupGridBox([...startBounds.values()]);
        const footprint = createGroupFootprint(layout, groupBox, "dashboard-group-drag-footprint");
        placeholder = footprint.footprint;
        groupLive = beginGroupLiveSurfaces(groupItems);
        groupDrag = { items: groupItems, startBounds, groupBox, footprintLayout: footprint.footprintLayout };
        offsetX = startX - groupLive.groupRect.left;
        offsetY = startY - groupLive.groupRect.top;
        targetCell = { col: groupBox.col, row: groupBox.row };
        document.body.classList.add("group-transform-active");
        groupItems.forEach((groupItem) => groupItem.classList.add("group-transform-member"));
      } else {
        placeholder = document.createElement("div");
        placeholder.className = placeholderClass;
        placeholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
        placeholder.dataset.defaultSpan = item.dataset.defaultSpan || placeholder.dataset.currentSpan;
        placeholder.dataset.gridRowSpan = String(gridItemRowSpan(item));
        placeholder.style.gridColumn = item.style.gridColumn || `span ${placeholder.dataset.currentSpan}`;
        placeholder.style.gridRow = item.style.gridRow || "";
        const placeholderMinHeight = isPanelInternalWidgetLayout(layout)
          ? Math.max(1, rect.height)
          : DASHBOARD_GRID_ROW_HEIGHT;
        placeholder.style.height = `${Math.max(placeholderMinHeight, rect.height)}px`;
        layout.insertBefore(placeholder, item);
        item.classList.add(draggingClass);
        item.style.width = `${rect.width}px`;
        if (item.classList.contains("db-panel")) item.style.height = `${rect.height}px`;
        item.style.left = `${Math.round(rect.left)}px`;
        item.style.top = `${Math.round(rect.top)}px`;
        expandedFootprintGhost = createExpandedFootprintGhost(item, layout, rect);
        offsetX = startX - rect.left;
        offsetY = startY - rect.top;
        targetCell = originalCell;
      }
      dragMetrics = createGridMetrics(layout);
      reflowItems = reflowItemsForLayout(layout, item);
      closeInactiveDashboardTools(item);
      onStart?.();
    };

    const createPanelDropPlaceholder = () => {
      const panelPlaceholder = document.createElement("div");
      panelPlaceholder.className = "widget-placeholder panel-local-drop-placeholder";
      panelPlaceholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
      panelPlaceholder.dataset.defaultSpan = item.dataset.defaultSpan || panelPlaceholder.dataset.currentSpan;
      panelPlaceholder.dataset.gridRowSpan = String(gridItemRowSpan(item));
      panelPlaceholder.style.gridColumn = item.style.gridColumn || `span ${panelPlaceholder.dataset.currentSpan}`;
      panelPlaceholder.style.gridRow = item.style.gridRow || "";
      panelPlaceholder.style.height = `${Math.max(DASHBOARD_GRID_ROW_HEIGHT, rect?.height || DASHBOARD_GRID_ROW_HEIGHT)}px`;
      return panelPlaceholder;
    };

    const createWorkspaceExitPlaceholder = () => {
      const workspacePlaceholder = document.createElement("div");
      workspacePlaceholder.className = "widget-placeholder panel-workspace-exit-placeholder";
      workspacePlaceholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
      workspacePlaceholder.dataset.defaultSpan = item.dataset.defaultSpan || workspacePlaceholder.dataset.currentSpan;
      workspacePlaceholder.dataset.gridRowSpan = String(gridItemRowSpan(item));
      workspacePlaceholder.style.gridColumn = item.style.gridColumn || `span ${workspacePlaceholder.dataset.currentSpan}`;
      workspacePlaceholder.style.gridRow = item.style.gridRow || "";
      workspacePlaceholder.style.height = `${Math.max(DASHBOARD_GRID_ROW_HEIGHT, rect?.height || DASHBOARD_GRID_ROW_HEIGHT)}px`;
      return workspacePlaceholder;
    };

    const panelEntryMotionFor = (moveEvent) => {
      const now = moveEvent.timeStamp || performance.now();
      const elapsed = Math.max(1, now - panelEntryIntent.lastTime);
      const stepDx = moveEvent.clientX - panelEntryIntent.lastX;
      const stepDy = moveEvent.clientY - panelEntryIntent.lastY;
      panelEntryIntent.lastX = moveEvent.clientX;
      panelEntryIntent.lastY = moveEvent.clientY;
      panelEntryIntent.lastTime = now;
      return {
        now,
        stepDx,
        stepDy,
        totalDx: moveEvent.clientX - startX,
        totalDy: moveEvent.clientY - startY,
        speed: Math.hypot(stepDx, stepDy) / elapsed,
      };
    };

    const triggerPanelHeaderEntryFeedback = (panel) => {
      if (!panel) return;
      panel.classList.remove("panel-header-entry-accept");
      void panel.offsetWidth;
      panel.classList.add("panel-header-entry-accept");
      const feedbackToken = String(performance.now());
      const minVisibleUntil = performance.now() + 260;
      panel.dataset.panelHeaderEntryFeedbackToken = feedbackToken;
      const clearFeedback = () => {
        if (panel.dataset.panelHeaderEntryFeedbackToken !== feedbackToken) return;
        const remaining = minVisibleUntil - performance.now();
        if (remaining > 0) {
          window.setTimeout(clearFeedback, remaining);
          return;
        }
        panel.classList.remove("panel-header-entry-accept");
        delete panel.dataset.panelHeaderEntryFeedbackToken;
      };
      panel.addEventListener("animationend", clearFeedback, { once: true });
      window.setTimeout(clearFeedback, 320);
    };

    const triggerPanelBoundaryExitFeedback = (panel) => {
      if (!panel) return;
      panel.dataset.panelBoundaryExitFeedback = "true";
      panel.classList.remove("panel-boundary-exit-release");
      void panel.offsetWidth;
      panel.classList.add("panel-boundary-exit-release");
      panel.addEventListener("animationend", () => {
        panel.classList.remove("panel-boundary-exit-release");
      }, { once: true });
    };

    const clampPanelEntryDelta = (value, limit = 28) => Math.max(-limit, Math.min(limit, value));

    const restartPanelEntryAnimation = (element, className) => {
      if (!element) return;
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
    };

    const animatePanelEntryTransition = (state) => {
      if (!state?.placeholder || !state.placeholder.isConnected) return;
      const placeholderRect = state.placeholder.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const previewDx = Math.round(itemRect.left - placeholderRect.left);
      const previewDy = Math.round(itemRect.top - placeholderRect.top);
      state.placeholder.style.setProperty("--panel-entry-preview-x", `${previewDx}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-y", `${previewDy}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-overshoot-x", `${clampPanelEntryDelta(previewDx * -.08, 8)}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-overshoot-y", `${clampPanelEntryDelta(previewDy * -.08, 8)}px`);
      restartPanelEntryAnimation(state.placeholder, "panel-entry-preview-transition");

      const ghostDx = clampPanelEntryDelta((placeholderRect.left - itemRect.left) * .12);
      const ghostDy = clampPanelEntryDelta((placeholderRect.top - itemRect.top) * .12);
      item.style.setProperty("--panel-entry-ghost-x", `${Math.round(ghostDx)}px`);
      item.style.setProperty("--panel-entry-ghost-y", `${Math.round(ghostDy)}px`);
      item.style.setProperty("--panel-entry-ghost-return-x", `${Math.round(ghostDx * -.28)}px`);
      item.style.setProperty("--panel-entry-ghost-return-y", `${Math.round(ghostDy * -.28)}px`);
      restartPanelEntryAnimation(item, "panel-entry-ghost-transition");
    };

    const animatePanelExitTransition = (state) => {
      if (!state?.placeholder || !state.placeholder.isConnected) return;
      const placeholderRect = state.placeholder.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const previewDx = Math.round(itemRect.left - placeholderRect.left);
      const previewDy = Math.round(itemRect.top - placeholderRect.top);
      state.placeholder.style.setProperty("--panel-entry-preview-x", `${previewDx}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-y", `${previewDy}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-overshoot-x", `${clampPanelEntryDelta(previewDx * -.08, 8)}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-overshoot-y", `${clampPanelEntryDelta(previewDy * -.08, 8)}px`);
      restartPanelEntryAnimation(state.placeholder, "panel-exit-preview-transition");

      const ghostDx = clampPanelEntryDelta((placeholderRect.left - itemRect.left) * .12);
      const ghostDy = clampPanelEntryDelta((placeholderRect.top - itemRect.top) * .12);
      item.style.setProperty("--panel-entry-ghost-x", `${Math.round(ghostDx)}px`);
      item.style.setProperty("--panel-entry-ghost-y", `${Math.round(ghostDy)}px`);
      item.style.setProperty("--panel-entry-ghost-return-x", `${Math.round(ghostDx * -.28)}px`);
      item.style.setProperty("--panel-entry-ghost-return-y", `${Math.round(ghostDy * -.28)}px`);
      restartPanelEntryAnimation(item, "panel-exit-ghost-transition");
      triggerPanelBoundaryExitFeedback(state.panel);
    };

    const acceptsHeaderPanelEntry = (panel, motion, options = {}) => {
      if (!motion) return false;
      if (panelEntryIntent.headerPanel !== panel) {
        panelEntryIntent.headerPanel = panel;
        panelEntryIntent.headerSince = motion.now;
      }
      const dwell = motion.now - panelEntryIntent.headerSince;
      const clearlyDownward = motion.totalDy > 20 &&
        motion.stepDy >= -1 &&
        motion.totalDy >= Math.abs(motion.totalDx) * .7;
      const slowIntentionalHeaderEntry = dwell >= 120 && motion.speed <= .42;
      const slowEnough = motion.speed <= .36;
      const directionalHeaderEntry = !options.requiresSlowIntent &&
        dwell >= 40 &&
        clearlyDownward &&
        (slowEnough || dwell >= 120);
      return slowIntentionalHeaderEntry || directionalHeaderEntry;
    };

    const clearPanelDragPreview = ({ restore = true } = {}) => {
      if (!panelDrag) return;
      const state = panelDrag;
      panelDrag = null;
      state.panel.classList.remove("panel-container-drag-active", "panel-header-entry-accept");
      item.classList.remove("panel-entry-ghost-transition", "panel-exit-ghost-transition");
      if (restore) restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
      if (restore && state.panelLayout && state.panelLayoutSnapshot) {
        restoreGridLayoutSnapshot(state.panelLayoutSnapshot);
        if (state.wasCollapsed) {
          state.panel.classList.add("db-panel-collapsed");
          state.panel.querySelector(":scope > .db-panel-hd")?.setAttribute("aria-expanded", "false");
          state.panel.dataset.gridRowSpan = "1";
          state.panel.style.height = "";
          if (state.panel.dataset.gridCol && state.panel.dataset.gridRow) {
            applyPanelGridPosition(state.panel, state.panel.dataset.gridCol, state.panel.dataset.gridRow);
          }
        }
      }
      state.placeholder.remove();
      updatePanelChildEmptyState(state.panel);
      if (placeholder) placeholder.style.visibility = "";
      targetCell = null;
    };

    const clearPanelExitPreview = ({ restore = true } = {}) => {
      if (!panelExitDrag) return;
      const state = panelExitDrag;
      panelExitDrag = null;
      state.panel.classList.remove("panel-container-drag-active", "panel-boundary-exit-release");
      delete state.panel.dataset.panelBoundaryExitFeedback;
      item.classList.remove("panel-exit-ghost-transition");
      if (restore) restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
      state.placeholder.remove();
      updatePanelChildEmptyState(state.panel);
      if (placeholder) placeholder.style.visibility = "";
      targetCell = null;
    };

    const enterPanelDragPreview = (panel, options = {}) => {
      if (panelDrag?.panel === panel) return panelDrag;
      clearPanelDragPreview();
      if (!panel || groupDrag) return null;
      const internalGrid = ensurePanelInternalWidgetGrid(panel);
      if (!internalGrid) return null;
      restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
      if (placeholder) {
        applyWidgetGridPosition(placeholder, originalCell.col, originalCell.row);
        placeholder.style.visibility = "hidden";
      }
      const snapshot = snapshotGridLayout(internalGrid);
      const panelLayout = panel.closest(".panel-layout");
      const panelLayoutSnapshot = panelLayout ? snapshotGridLayout(panelLayout) : null;
      const panelPlaceholder = createPanelDropPlaceholder();
      internalGrid.appendChild(panelPlaceholder);
      panel.classList.add("panel-container-drag-active");
      const wasCollapsed = panel.classList.contains("db-panel-collapsed");
      syncPanelFootprintToInternalItem(panel, panelPlaceholder, {
        includePlaceholders: true,
        openCollapsed: true,
        metrics: panelLayout ? createGridMetrics(panelLayout) : null,
      });
      if (options.zone === "header" || options.zone === "header-tolerance") triggerPanelHeaderEntryFeedback(panel);
      panelDrag = {
        panel,
        panelLayout,
        panelLayoutSnapshot,
        layout: internalGrid,
        placeholder: panelPlaceholder,
        snapshot,
        metrics: createGridMetrics(internalGrid),
        reflowItems: reflowItemsForLayout(internalGrid, panelPlaceholder),
        targetCell: null,
        entryZone: options.zone || "body",
        entryTransitionPlayed: false,
        wasCollapsed,
      };
      updatePanelChildEmptyState(panel);
      return panelDrag;
    };

    const updatePanelDragPreview = (moveEvent, motion = null) => {
      if (!canAbsorbIntoPanel || groupDrag || !dragging || !placeholder) {
        clearPanelDragPreview();
        return false;
      }
      const candidate = panelEntryCandidateAt(moveEvent.clientX, moveEvent.clientY, item, { snapshot: startSnapshot });
      if (!candidate) {
        panelEntryIntent.headerPanel = null;
        panelEntryIntent.headerSince = 0;
        clearPanelDragPreview();
        return false;
      }
      if (!panelDrag) {
        if (candidate.zone === "header" || candidate.zone === "header-tolerance") {
          if (!acceptsHeaderPanelEntry(candidate.panel, motion, { requiresSlowIntent: candidate.zone === "header-tolerance" })) return false;
        }
      }
      const state = enterPanelDragPreview(candidate.panel, { zone: candidate.zone });
      if (!state) return false;
      const candidateIsHeaderEntry = candidate.zone === "header" || candidate.zone === "header-tolerance";
      if (candidateIsHeaderEntry && state.entryZone !== candidate.zone && state.entryZone !== "header") {
        state.entryZone = candidate.zone;
        state.entryTransitionPlayed = false;
        triggerPanelHeaderEntryFeedback(candidate.panel);
      }
      const metrics = refreshGridMetricsRect(state.metrics);
      const previewPoint = candidate.zone === "body-tolerance" || candidate.zone === "header" || candidate.zone === "header-tolerance"
        ? clampPointToPanelBodyRect(candidate.panel, moveEvent.clientX, moveEvent.clientY, startSnapshot)
        : { clientX: moveEvent.clientX, clientY: moveEvent.clientY };
      const nextCell = gridCellFromDragPointer(state.layout, state.placeholder, previewPoint.clientX, previewPoint.clientY, offsetX, offsetY, metrics, rect);
      const shouldPlayEntryTransition = (state.entryZone === "header" || state.entryZone === "header-tolerance") && !state.entryTransitionPlayed;
      if (state.targetCell && state.targetCell.col === nextCell.col && state.targetCell.row === nextCell.row && !shouldPlayEntryTransition) return true;
      state.targetCell = nextCell;
      animateOrderedGridReflow(state.layout, () => {
        restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
        resolveSparseGridLayout(state.layout, state.placeholder, nextCell, { afterOnly: true, metrics, items: state.reflowItems });
      }, state.placeholder, { items: state.reflowItems, metrics });
      syncPanelFootprintToInternalItem(state.panel, state.placeholder, {
        includePlaceholders: true,
        metrics: state.panelLayout ? createGridMetrics(state.panelLayout) : null,
      });
      state.metrics = createGridMetrics(state.layout);
      if (shouldPlayEntryTransition) {
        state.entryTransitionPlayed = true;
        animatePanelEntryTransition(state);
      }
      updatePanelChildEmptyState(state.panel);
      return true;
    };

    const pointerInsidePanelShell = (panel, clientX, clientY) => {
      if (!panel || panel.classList.contains("db-panel-collapsed")) return false;
      return pointInRect(clientX, clientY, panel.getBoundingClientRect());
    };

    const enterWorkspaceExitPreview = () => {
      if (panelExitDrag) return panelExitDrag;
      if (!sourcePanelForPanelLocalDrag || !workspaceExitLayout || groupDrag) return null;
      restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
      if (placeholder) {
        applyWidgetGridPosition(placeholder, originalCell.col, originalCell.row);
        placeholder.style.visibility = "hidden";
      }
      const snapshot = snapshotGridLayout(workspaceExitLayout);
      const workspacePlaceholder = createWorkspaceExitPlaceholder();
      workspaceExitLayout.appendChild(workspacePlaceholder);
      sourcePanelForPanelLocalDrag.classList.add("panel-container-drag-active");
      panelExitDrag = {
        panel: sourcePanelForPanelLocalDrag,
        layout: workspaceExitLayout,
        placeholder: workspacePlaceholder,
        snapshot,
        metrics: createGridMetrics(workspaceExitLayout),
        reflowItems: reflowItemsForLayout(workspaceExitLayout, workspacePlaceholder),
        targetCell: null,
        exitTransitionPlayed: false,
      };
      updatePanelChildEmptyState(sourcePanelForPanelLocalDrag);
      return panelExitDrag;
    };

    const updatePanelExitPreview = (moveEvent) => {
      if (!canExitPanelToWorkspace || !dragging || !placeholder) {
        clearPanelExitPreview();
        return false;
      }
      if (pointerInsidePanelShell(sourcePanelForPanelLocalDrag, moveEvent.clientX, moveEvent.clientY)) {
        clearPanelExitPreview();
        return false;
      }
      const state = enterWorkspaceExitPreview();
      if (!state) return false;
      const metrics = refreshGridMetricsRect(state.metrics);
      const nextCell = gridCellFromDragPointer(state.layout, state.placeholder, moveEvent.clientX, moveEvent.clientY, offsetX, offsetY, metrics, rect);
      const shouldPlayExitTransition = !state.exitTransitionPlayed;
      if (state.targetCell && state.targetCell.col === nextCell.col && state.targetCell.row === nextCell.row) return true;
      state.targetCell = nextCell;
      animateOrderedGridReflow(state.layout, () => {
        restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
        resolveSparseGridLayout(state.layout, state.placeholder, nextCell, { afterOnly: true, metrics, items: state.reflowItems });
      }, state.placeholder, { items: state.reflowItems, metrics });
      if (shouldPlayExitTransition) {
        state.exitTransitionPlayed = true;
        animatePanelExitTransition(state);
      }
      updatePanelChildEmptyState(state.panel);
      return true;
    };

    const movePreview = (clientX, clientY, metrics = null, options = {}) => {
      if (!placeholder) return;
      const previewItem = groupDrag ? placeholder : item;
      const nextCell = options.preservePointerOffset
        ? gridCellFromDragPointer(layout, previewItem, clientX, clientY, offsetX, offsetY, metrics, rect)
        : gridCellFromPoint(layout, previewItem, clientX, clientY, metrics);
      if (targetCell && targetCell.col === nextCell.col && targetCell.row === nextCell.row) return;
      targetCell = nextCell;
      const expandedPanelDrag = !groupDrag && workspaceObjectCapabilities(item).hasExpandedFootprint && !item.classList.contains("db-panel-collapsed");
      const localVacancy = groupDrag
        ? groupBoxBounds(groupDrag.groupBox)
        : expandedPanelDrag
          ? null
          : boundsAtGridSlot(placeholder, originalCell.col, originalCell.row, metrics);
      animateOrderedGridReflow(layout, () => {
        restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
        if (groupDrag) {
          applyGroupFootprintBounds(placeholder, groupDrag.footprintLayout, {
            ...groupBoxBounds(groupDrag.groupBox),
            col: nextCell.col,
            row: nextCell.row,
          });
          resolveSparseGridLayout(layout, placeholder, nextCell, { afterOnly: true, metrics, localVacancy, items: reflowItems });
        } else {
          resolveSparseGridLayout(layout, placeholder, nextCell, {
            afterOnly: true,
            metrics,
            localVacancy,
            verticalDisplacement: expandedPanelDrag,
            items: reflowItems,
          });
        }
      }, item, { items: reflowItems, metrics });
    };

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < threshold) return;
      startDrag(moveEvent);
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      lastMoveEvent = moveEvent;
      autoScroll.update(moveEvent);
      const isAutoScrollFrame = moveEvent.type === "autoscroll";
      const panelEntryMotion = isAutoScrollFrame ? null : panelEntryMotionFor(moveEvent);
      const currentMetrics = refreshGridMetricsRect(dragMetrics);
      const gridRect = currentMetrics?.rect || gridRectForLayout(layout);
      const dragRect = groupLive?.groupRect || rect;
      const minLeft = gridRect.left;
      const maxLeft = Math.max(minLeft, gridRect.right - dragRect.width);
      const rawLeft = moveEvent.clientX - offsetX;
      const rawTop = moveEvent.clientY - offsetY;
      const scrollingTowardTop = moveEvent.clientY < 104 && (window.scrollY || document.documentElement.scrollTop || 0) > 0;
      const minTop = scrollingTowardTop ? Math.min(rawTop, 0, gridRect.top) : Math.max(0, gridRect.top);
      const visibleBottom = Math.max(gridRect.bottom, window.innerHeight - 16);
      const maxTop = Math.max(minTop, visibleBottom - Math.min(dragRect.height, window.innerHeight - 32));
      const isPanelLocalDirectDrag = isPanelInternalWidgetLayout(layout) && !groupDrag;
      const nextLeft = isPanelLocalDirectDrag ? rawLeft : Math.max(minLeft, Math.min(maxLeft, rawLeft));
      const nextTop = isPanelLocalDirectDrag ? rawTop : Math.max(minTop, Math.min(maxTop, rawTop));
      if (groupDrag && groupLive) {
        groupLive.update(nextLeft, nextTop);
      } else {
        item.style.left = `${Math.round(nextLeft)}px`;
        item.style.top = `${Math.round(nextTop)}px`;
      }
      if (!groupDrag && expandedFootprintGhost) {
        updateExpandedFootprintGhost(expandedFootprintGhost, item, layout, {
          left: nextLeft,
          top: nextTop,
          width: rect.width,
        });
      }
      if (!isAutoScrollFrame && updatePanelDragPreview(moveEvent, panelEntryMotion)) {
        return;
      }
      if (isAutoScrollFrame && panelDrag) {
        clearPanelDragPreview();
      }
      if (!isAutoScrollFrame && updatePanelExitPreview(moveEvent)) {
        return;
      }
      const previewRect = groupDrag && groupLive
        ? { left: nextLeft, top: nextTop, width: dragRect.width, height: dragRect.height }
        : item.getBoundingClientRect();
      if (isPanelLocalDirectDrag) {
        movePreview(moveEvent.clientX, moveEvent.clientY, currentMetrics, { preservePointerOffset: true });
      } else {
        movePreview(previewRect.left + (previewRect.width / 2), previewRect.top + (previewRect.height / 2), currentMetrics);
      }
    };

    const removeListeners = () => {
      dragController.removeListeners();
    };

    const releasePointer = () => {
      dragController.releasePointer();
    };

    const onUp = (upEvent) => {
      if (ended) return;
      ended = true;
      const canceled = upEvent?.type === "pointercancel";
      const releaseScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const releaseUsedExtendedWorkspace = dragging && placeholder && !canceled && document.body.classList.contains("dashboard-interaction-scroll-extended");
      let committedExtendedWorkspaceScrollY = null;
      autoScroll.stop({ preserveExtension: dragging && placeholder && !canceled });
      removeListeners();
      releasePointer();
      document.body.classList.remove("panel-interaction-active");
      document.body.classList.remove("panel-resize-active");
      try {
        if (dragging && placeholder) {
          const releaseItemRect = item.getBoundingClientRect();
          if (!groupDrag) {
            item.classList.remove(draggingClass);
            item.style.left = "";
            item.style.top = "";
            item.style.width = "";
            if (item.classList.contains("db-panel")) item.style.height = "";
          }
          expandedFootprintGhost?.remove();
          expandedFootprintGhost = null;
          if (canceled) {
            clearPanelDragPreview();
            clearPanelExitPreview();
            restoreGridLayoutSnapshot(startSnapshot);
            placeholder.remove();
            groupLive?.clear();
            onCancel?.();
          } else {
            const releasePanel = panelDrag
              ? panelEntryCandidateAt(upEvent?.clientX ?? lastMoveEvent?.clientX ?? startX, upEvent?.clientY ?? lastMoveEvent?.clientY ?? startY, item, { snapshot: startSnapshot })?.panel
              : null;
            const activePanelDrag = panelDrag && releasePanel === panelDrag.panel ? panelDrag : null;
            if (panelDrag && !activePanelDrag) clearPanelDragPreview();
            const activePanelExitDrag = panelExitDrag;
            const finalCell = activePanelDrag
              ? {
                col: Number(activePanelDrag.placeholder.dataset.gridCol) || Number(activePanelDrag.targetCell?.col) || 1,
                row: Number(activePanelDrag.placeholder.dataset.gridRow) || Number(activePanelDrag.targetCell?.row) || 1,
              }
              : activePanelExitDrag
                ? {
                  col: Number(activePanelExitDrag.placeholder.dataset.gridCol) || Number(activePanelExitDrag.targetCell?.col) || 1,
                  row: Number(activePanelExitDrag.placeholder.dataset.gridRow) || Number(activePanelExitDrag.targetCell?.row) || 1,
                }
              : {
                col: Number(placeholder.dataset.gridCol) || originalCell.col,
                row: Number(placeholder.dataset.gridRow) || originalCell.row,
              };
            let result;
            if (activePanelDrag) {
              clearPanelExitPreview();
              clearPanelDragPreview({ restore: false });
              restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
              placeholder.remove();
              const absorbed = absorbWidgetIntoPanel({
                widget: item,
                sourceLayout: layout,
                panel: activePanelDrag.panel,
                clientX: upEvent?.clientX ?? lastMoveEvent?.clientX ?? startX,
                clientY: upEvent?.clientY ?? lastMoveEvent?.clientY ?? startY,
                fromRect: releaseItemRect,
                targetCell: finalCell,
              });
              result = absorbed
                ? { bounds: gridBoundsForItem(absorbed), movedItems: 1, absorbed: true }
                : { bounds: boundsAtGridSlot(item, originalCell.col, originalCell.row), movedItems: 0, absorbed: false };
              if (!absorbed) onCancel?.();
            } else if (activePanelExitDrag) {
              clearPanelExitPreview({ restore: false });
              restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
              placeholder.remove();
              restoreGridLayoutSnapshot(activePanelExitDrag.snapshot, { exclude: [activePanelExitDrag.placeholder] });
              const extracted = extractPanelChildWidgetToWorkspace({
                widget: item,
                sourceLayout: layout,
                targetLayout: activePanelExitDrag.layout,
                panel: activePanelExitDrag.panel,
                fromRect: releaseItemRect,
                targetCell: finalCell,
              });
              result = extracted
                ? { bounds: extracted.bounds, movedItems: extracted.movedItems + 1, extracted: true }
                : { bounds: boundsAtGridSlot(item, originalCell.col, originalCell.row), movedItems: 0, extracted: false };
              if (!extracted) onCancel?.();
            } else if (groupDrag) {
              clearPanelExitPreview();
              restoreGridLayoutSnapshot(startSnapshot);
              const localVacancy = groupBoxBounds(groupDrag.groupBox);
              applyGroupFootprintBounds(placeholder, groupDrag.footprintLayout, {
                ...groupBoxBounds(groupDrag.groupBox),
                col: finalCell.col,
                row: finalCell.row,
              });
              resolveSparseGridLayout(layout, placeholder, finalCell, { afterOnly: true, metrics: dragMetrics, localVacancy, items: reflowItems });
              const resolvedCell = {
                col: Number(placeholder.dataset.gridCol) || finalCell.col,
                row: Number(placeholder.dataset.gridRow) || finalCell.row,
              };
              const delta = {
                deltaCol: resolvedCell.col - groupDrag.groupBox.col,
                deltaRow: resolvedCell.row - groupDrag.groupBox.row,
              };
              applyGroupDelta(
                groupDrag.items.map((groupItem) => ({
                  item: groupItem,
                  sourceItem: groupItem,
                  startBounds: groupDrag.startBounds.get(groupItem),
                })).filter((entry) => entry.startBounds),
                delta
              );
              placeholder.remove();
              groupLive?.clear();
              result = {
                bounds: boundsAtGridSlot(item, (groupDrag.startBounds.get(item)?.col || originalCell.col) + delta.deltaCol, (groupDrag.startBounds.get(item)?.row || originalCell.row) + delta.deltaRow),
                movedItems: groupDrag.items.length - 1,
              };
            } else {
              clearPanelExitPreview();
              restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
              placeholder.remove();
              const expandedPanelDrag = workspaceObjectCapabilities(item).hasExpandedFootprint && !item.classList.contains("db-panel-collapsed");
              const localVacancy = expandedPanelDrag ? null : boundsAtGridSlot(item, originalCell.col, originalCell.row, dragMetrics);
              result = expandedPanelDrag
                ? commitExpandedPanelDropSlot(layout, item, finalCell, { localVacancy })
                : commitActiveDropSlot(layout, item, finalCell, { localVacancy });
            }
            const finalBounds = result.bounds;
            committedExtendedWorkspaceScrollY = releaseUsedExtendedWorkspace ? releaseScrollY : null;
            syncCommittedWorkspaceScrollFloor(layout, {
              preserveViewport: committedExtendedWorkspaceScrollY !== null,
              scrollY: committedExtendedWorkspaceScrollY,
            });
            if (result.absorbed === false) {
              // The attempted panel commit failed and onCancel has already restored callers.
            } else if (result.extracted === false) {
              // The attempted panel exit commit failed and onCancel has already restored callers.
            } else {
              onCommit?.({ moved: result.absorbed || result.extracted || finalBounds.col !== originalCell.col || finalBounds.row !== originalCell.row || result.movedItems > 0 });
            }
          }
        }
      } finally {
        autoScroll.clearExtension();
        if (committedExtendedWorkspaceScrollY !== null) {
          syncCommittedWorkspaceScrollFloor(layout, {
            preserveViewport: true,
            scrollY: committedExtendedWorkspaceScrollY,
          });
        }
      }
      if (groupDrag) {
        groupDrag.items.forEach((groupItem) => groupItem.classList.remove("group-transform-member"));
        document.body.classList.remove("group-transform-active");
      }
      scheduleWorkspaceVisualLodRefresh(gridHostForLayout(layout));
      dragController.endInteraction();
      onEnd?.(dragging);
    };

    const onKeydown = (keyEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      onUp({ type: "pointercancel" });
    };

    const onWindowBlur = () => {
      onUp({ type: "pointercancel" });
    };

    const onLostPointerCapture = (captureEvent) => {
      if (captureEvent.pointerId !== pointerId) return;
      onUp({ type: "pointercancel" });
    };

    if (!deferStartEventHandling) capturePointer();
    dragController.install({
      onMove,
      onPointerEnd: onUp,
      onKeydown,
      onBlur: onWindowBlur,
      onLostPointerCapture,
    });
  };

  const widgetSpacerSiblingsBefore = (widget) => {
    const spacers = [];
    let cursor = widget.previousElementSibling;
    while (cursor?.classList?.contains("widget-spacer")) {
      spacers.unshift(cursor);
      cursor = cursor.previousElementSibling;
    }
    return spacers;
  };

  const widgetHasRowBreakBefore = (widget) => {
    let cursor = widget.previousElementSibling;
    while (cursor?.classList?.contains("widget-spacer")) cursor = cursor.previousElementSibling;
    return Boolean(cursor?.classList?.contains("widget-row-break"));
  };

  const alignedResizeHeight = ({ layout, item, currentHeight, metrics = null }) => {
    const rect = item.getBoundingClientRect();
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const tolerance = 18;
    const candidates = [{ edge: layoutRect.bottom, priority: 1 }];
    resizeAlignmentTargetsForLayout(layout).forEach((target) => {
      if (target === item) return;
      const targetRect = target.getBoundingClientRect();
      candidates.push({ edge: targetRect.bottom, priority: 2 });
      candidates.push({ edge: targetRect.top, priority: 3 });
    });
    const match = candidates
      .map((candidate) => ({
        ...candidate,
        distance: Math.abs(rect.bottom - candidate.edge),
      }))
      .filter((candidate) => candidate.distance <= tolerance && candidate.edge > rect.top + 40)
      .sort((a, b) => a.distance - b.distance || a.priority - b.priority)[0];
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const nextHeight = match ? Math.max(getPanelMinimumHeight(item), Math.round(match.edge - rect.top)) : currentHeight;
    return gridHeightForRows(gridRowsFromHeight(nextHeight, gap, panelMinimumRows(item, metrics)), gap);
  };

  const groupGridBox = (boundsList) => dashboardGeometry.groupGridBox(boundsList);

  const groupFootprintLayout = (layout) => {
    const host = gridHostForLayout(layout);
    const key = gridItemLayoutKey(layout);
    return host?.querySelector?.(`.panel-layout[data-layout-key="${CSS.escape(key)}"]`) || layout;
  };

  const groupBoxBounds = (groupBox, col = groupBox.col, row = groupBox.row) => dashboardGeometry.groupBoxBounds(groupBox, col, row);

  const applyGroupFootprintBounds = (footprint, layout, bounds, metrics = null) => {
    const span = Math.max(1, Math.min(DASHBOARD_GRID_COLUMNS, Math.round(Number(bounds.span) || 1)));
    const rowSpan = Math.max(1, Math.round(Number(bounds.rowSpan) || 1));
    const col = Math.max(1, Math.min(DASHBOARD_GRID_COLUMNS - span + 1, Math.round(Number(bounds.col) || 1)));
    const row = Math.max(1, Math.round(Number(bounds.row) || 1));
    footprint.dataset.currentSpan = String(span);
    footprint.dataset.defaultSpan = String(span);
    footprint.dataset.gridRowSpan = String(rowSpan);
    footprint.dataset.gridCol = String(col);
    footprint.dataset.gridRow = String(row);
    footprint.style.gridColumn = `${col} / span ${span}`;
    footprint.style.gridRow = `${row} / span ${rowSpan}`;
    footprint.style.height = `${gridHeightForRows(rowSpan, metrics?.gap ?? gridGapForLayout(layout))}px`;
  };

  const groupResizePanelRowSpan = (start, groupBox, scaleY, minRows = 1) => {
    const relRow = Math.max(0, start.row - groupBox.row);
    const relBottomExclusive = relRow + Math.max(1, start.rowSpan);
    const scaledSizeRows = Math.round(start.rowSpan * scaleY);
    const scaledBottomRows = Math.floor(relBottomExclusive * scaleY) - relRow;
    return Math.max(minRows, scaledSizeRows, scaledBottomRows, 1);
  };

  const groupResizeCollapsedPanelExpandedRows = (panel, start, groupBox, scaleY, layout, metrics = null) => {
    const minRows = panelExpandedMinimumRows(panel, layout, metrics);
    const expandedRows = expandedPanelFootprintRows(panel, layout, null, metrics);
    return groupResizePanelRowSpan(
      {
        ...start,
        rowSpan: expandedRows,
        bottom: start.row + expandedRows - 1,
      },
      groupBox,
      scaleY,
      minRows
    );
  };

  const groupResizeWidgetRowSpan = (start, groupBox, scaleY, minRows = 1) => {
    const relRow = Math.max(0, start.row - groupBox.row);
    const relBottomExclusive = relRow + Math.max(1, start.rowSpan);
    const scaledSizeRows = Math.round(start.rowSpan * scaleY);
    const scaledBottomRows = Math.floor(relBottomExclusive * scaleY) - relRow;
    return Math.max(minRows, scaledSizeRows, scaledBottomRows, 1);
  };

  const commitGroupResizeFromPreviews = (entries, layout) => {
    entries.forEach((entry) => {
      const { member, preview } = entry;
      const col = Number(preview.dataset.gridCol) || Number(member.dataset.gridCol) || 1;
      const row = Number(preview.dataset.gridRow) || Number(member.dataset.gridRow) || 1;
      const span = Number(preview.dataset.currentSpan) || Number(preview.dataset.defaultSpan) || Number(member.dataset.currentSpan) || 1;
      const rowSpan = Math.max(gridItemMinimumRows(member), Number(preview.dataset.gridRowSpan) || 1);
      if (isWidgetGridItem(member)) {
        applyWidgetSpan(member, span);
        applyWidgetGridPosition(member, col, row, rowSpan);
        return;
      }
      applyPanelSpan(member, span);
      if (member.classList.contains("db-panel-collapsed")) {
        const memberLayout = groupItemLayout(member) || layout;
        const expandedRows = Math.max(
          panelExpandedMinimumRows(member, memberLayout),
          Number(preview.dataset.expandedGridRowSpan) || expandedPanelFootprintRows(member, memberLayout)
        );
        const expandedHeight = gridHeightForRows(expandedRows, gridGapForLayout(memberLayout));
        member.dataset.savedHeight = String(expandedHeight);
        member.dataset.gridRowSpan = "1";
        member.style.height = "";
      } else {
        const memberLayout = groupItemLayout(member) || layout;
        applyPanelHeight(member, gridHeightForRows(rowSpan, gridGapForLayout(memberLayout)));
      }
      applyPanelGridPosition(member, col, row);
    });
  };

  const createGroupFootprint = (layout, groupBox, className = "") => {
    const footprintLayout = groupFootprintLayout(layout);
    const footprint = document.createElement("div");
    footprint.className = `db-panel-placeholder dashboard-group-footprint ${className}`.trim();
    footprint.setAttribute("aria-hidden", "true");
    applyGroupFootprintBounds(footprint, footprintLayout, groupBoxBounds(groupBox));
    footprintLayout.appendChild(footprint);
    return { footprint, footprintLayout };
  };

  const beginGroupLiveSurfaces = (members) => {
    const rects = new Map(members.map((member) => [member, member.getBoundingClientRect()]));
    const groupRect = [...rects.values()].reduce((box, rect) => ({
      left: Math.min(box.left, rect.left),
      top: Math.min(box.top, rect.top),
      right: Math.max(box.right, rect.right),
      bottom: Math.max(box.bottom, rect.bottom),
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    groupRect.width = Math.max(1, groupRect.right - groupRect.left);
    groupRect.height = Math.max(1, groupRect.bottom - groupRect.top);
    const shell = createGroupBoundarySurface("dashboard-group-live-shell");
    updateGroupBoundarySurface(shell, groupRect);
    const entries = members.map((member) => {
      const rect = rects.get(member);
      const live = member.cloneNode(true);
      live.classList.add("dashboard-group-live-member");
      live.classList.remove("dashboard-active-resize", "db-panel-dragging", "widget-dragging");
      live.setAttribute("aria-hidden", "true");
      live.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      member.classList.add("dashboard-group-source");
      document.body.appendChild(live);
      updateLiveResizeSurface(live, rect.width, rect.height, rect.left, rect.top);
      return { member, live, rect };
    });
    const update = (left, top) => {
      updateGroupBoundarySurface(shell, {
        left,
        top,
        width: groupRect.width,
        height: groupRect.height,
      });
      entries.forEach((entry) => {
        updateLiveResizeSurface(
          entry.live,
          entry.rect.width,
          entry.rect.height,
          left + (entry.rect.left - groupRect.left),
          top + (entry.rect.top - groupRect.top)
        );
      });
    };
    const clear = () => {
      shell.remove();
      entries.forEach((entry) => {
        entry.live.remove();
        entry.member.classList.remove("dashboard-group-source");
      });
    };
    return { groupRect, entries, update, clear };
  };

  const applyGroupResizeLayout = (layout, members, startBounds, groupBox, scaleX, scaleY, options = {}) => {
    const sourceForMember = options.sourceForMember || new Map();
    const sourceItemFor = (member) => sourceForMember.get(member) || member;
    const gap = gridGapForLayout(layout);
    const width = Math.max(1, groupBox.right - groupBox.col + 1);
    const height = Math.max(1, groupBox.bottom - groupBox.row + 1);
    const minScaleX = Math.max(...members.map((member) => gridItemMinimumSpan(sourceItemFor(member)) / Math.max(1, startBounds.get(member).span)));
    const minScaleY = Math.max(...members.map((member) => {
      const bounds = startBounds.get(member);
      const sourceItem = sourceItemFor(member);
      if (isWidgetGridItem(sourceItem)) return gridItemMinimumRows(sourceItem) / Math.max(1, bounds.rowSpan);
      return panelMinimumRows(sourceItem) / Math.max(1, bounds.rowSpan);
    }));
    const maxScaleX = (DASHBOARD_GRID_COLUMNS - groupBox.col + 1) / width;
    const safeScaleX = Math.max(minScaleX, Math.min(maxScaleX, scaleX));
    const safeScaleY = Math.max(minScaleY, scaleY);
    const occupied = options.collision === false
      ? []
      : externalOccupiedForGroup(layout, members.concat(options.excludeFromCollision || []));
    const nearestSizedSlot = (desired) => {
      const maxCol = DASHBOARD_GRID_COLUMNS - desired.span + 1;
      const limit = Math.max(desired.row + 48, ...occupied.map((entry) => entry.bounds.bottom + 24), desired.bottom + 24);
      let best = null;
      for (let row = 1; row <= limit; row += 1) {
        for (let col = 1; col <= maxCol; col += 1) {
          const candidate = {
            ...desired,
            col,
            row,
            right: col + desired.span - 1,
            bottom: row + desired.rowSpan - 1,
          };
          if (!canPlaceBounds(candidate, occupied)) continue;
          const score = (Math.abs(row - desired.row) * DASHBOARD_GRID_COLUMNS) + Math.abs(col - desired.col) + (row < desired.row ? .7 : 0);
          if (!best || score < best.score || (score === best.score && row < best.bounds.row) || (score === best.score && row === best.bounds.row && col < best.bounds.col)) {
            best = { bounds: candidate, score };
          }
        }
      }
      return best?.bounds || desired;
    };

    visualGridOrder(members).forEach((member) => {
      const sourceItem = sourceItemFor(member);
      const start = startBounds.get(member);
      const relCol = start.col - groupBox.col;
      const relRow = start.row - groupBox.row;
      const nextSpan = Math.max(gridItemMinimumSpan(sourceItem), Math.min(6, Math.round(start.span * safeScaleX)));
      const maxCol = DASHBOARD_GRID_COLUMNS - nextSpan + 1;
      let nextCol = groupBox.col + Math.round(relCol * safeScaleX);
      nextCol = Math.max(1, Math.min(maxCol, nextCol));
      let nextRow = Math.max(1, groupBox.row + relRow);
      let nextRowSpan = isWidgetGridItem(sourceItem)
        ? groupResizeWidgetRowSpan(start, groupBox, safeScaleY, gridItemMinimumRows(sourceItem))
        : groupResizePanelRowSpan(start, groupBox, safeScaleY, panelMinimumRows(sourceItem));
      let desired = {
        col: nextCol,
        row: nextRow,
        span: nextSpan,
        rowSpan: nextRowSpan,
        right: nextCol + nextSpan - 1,
        bottom: nextRow + nextRowSpan - 1,
      };
      if (!canPlaceBounds(desired, occupied)) {
        desired = nearestSizedSlot(desired);
        nextCol = desired.col;
        nextRow = desired.row;
        nextRowSpan = desired.rowSpan;
      }

      if (isWidgetGridItem(sourceItem)) {
        applyWidgetSpan(member, nextSpan);
        applyWidgetGridPosition(member, nextCol, nextRow, nextRowSpan);
        if (member.classList.contains("widget-placeholder")) {
          member.style.height = `${gridHeightForRows(nextRowSpan, gridGapForLayout(groupItemLayout(member) || layout) || gap)}px`;
        }
      } else {
        applyPanelSpan(member, nextSpan);
        if (sourceItem.classList.contains("db-panel-collapsed")) {
          const memberLayout = groupItemLayout(member) || layout;
          const memberMetrics = options.metricsForMember?.get?.(member) || null;
          const expandedRows = groupResizeCollapsedPanelExpandedRows(
            sourceItem,
            start,
            groupBox,
            safeScaleY,
            groupItemLayout(sourceItem) || layout,
            memberMetrics
          );
          const memberGap = gridGapForLayout(memberLayout) || gap;
          member.dataset.gridRowSpan = "1";
          member.dataset.expandedGridRowSpan = String(expandedRows);
          member.dataset.savedHeight = String(gridHeightForRows(expandedRows, memberGap));
          member.style.height = "";
        } else {
          const memberGap = gridGapForLayout(groupItemLayout(member) || layout) || gap;
          const nextHeight = gridHeightForRows(nextRowSpan, memberGap);
          if (member.classList.contains("db-panel-placeholder")) {
            member.dataset.gridRowSpan = String(nextRowSpan);
            member.dataset.savedHeight = String(nextHeight);
            member.style.height = `${nextHeight}px`;
          } else {
            applyPanelHeight(member, nextHeight);
          }
        }
        applyPanelGridPosition(member, nextCol, nextRow);
      }
      occupied.push({ item: member, bounds: gridBoundsForItem(member) });
    });
  };

  const runGroupResize = ({ layout, source, event, onCommit, onEnd }) => {
    const members = groupTransformItems(source)
      .filter((member) => member === source || !member.classList.contains("db-panel-pinned"))
      .filter((member) => member.dataset.locked !== "true" && member.dataset.resizable !== "false");
    if (members.length < 2) return false;

    event.preventDefault();
    event.stopPropagation();
    document.body.classList.add("panel-interaction-active");
    document.body.classList.add("panel-resize-active");
    document.body.classList.add("group-transform-active");
    members.forEach((member) => member.classList.add("group-transform-member"));
    source.classList.add("dashboard-active-resize");
    closeInactiveDashboardTools(source);
    window.getSelection?.()?.removeAllRanges();

    const gridMetricsByLayout = new Map();
    const metricsForLayout = (targetLayout) => {
      if (!gridMetricsByLayout.has(targetLayout)) {
        gridMetricsByLayout.set(targetLayout, createGridMetrics(targetLayout));
      }
      return gridMetricsByLayout.get(targetLayout);
    };
    const startX = event.clientX;
    const startY = event.clientY;
    const layoutMetrics = metricsForLayout(layout);
    const resizeParentPanel = isPanelInternalWidgetLayout(layout) ? panelForInternalWidgetLayout(layout) : null;
    const resizeParentPanelLayout = resizeParentPanel?.closest?.(".panel-layout") || null;
    const gap = layoutMetrics.gap;
    const startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const layoutRect = layoutMetrics.rect;
    const columnWidth = (Math.max(1, layoutRect.width) - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS;
    const columnStep = Math.max(1, columnWidth + gap);
    const rowStep = DASHBOARD_GRID_ROW_HEIGHT + gap;
    const resizeStartSnapshot = snapshotGridLayout(layout);
    const resizeParentPanelLayoutSnapshot = resizeParentPanelLayout ? snapshotGridLayout(resizeParentPanelLayout) : null;
    const startRects = new Map(members.map((member) => [member, member.getBoundingClientRect()]));
    const startBounds = new Map(members.map((member) => [member, gridBoundsForItem(member)]));
    const groupBox = groupGridBox([...startBounds.values()]);
    const startWidth = Math.max(1, groupBox.right - groupBox.col + 1);
    const startHeight = Math.max(1, groupBox.bottom - groupBox.row + 1);
    const groupStartRect = [...startRects.values()].reduce((box, rect) => ({
      left: Math.min(box.left, rect.left),
      top: Math.min(box.top, rect.top),
      right: Math.max(box.right, rect.right),
      bottom: Math.max(box.bottom, rect.bottom),
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    groupStartRect.width = Math.max(1, groupStartRect.right - groupStartRect.left);
    groupStartRect.height = Math.max(1, groupStartRect.bottom - groupStartRect.top);
    const resizeBoundary = createGroupBoundarySurface("dashboard-group-resize-boundary");
    updateGroupBoundarySurface(resizeBoundary, groupStartRect);
    const liveMinScaleX = Math.max(...members.map((member) => gridItemMinimumSpan(member) / Math.max(1, startBounds.get(member).span)));
    const liveMinScaleY = Math.max(...members.map((member) => (
      isWidgetGridItem(member)
        ? gridItemMinimumRows(member) / Math.max(1, startBounds.get(member).rowSpan)
        : panelMinimumRows(member) / Math.max(1, startBounds.get(member).rowSpan)
    )));
    const liveMaxScaleX = (DASHBOARD_GRID_COLUMNS - groupBox.col + 1) / startWidth;
    const previewEntries = members.map((member) => {
      const memberLayout = groupItemLayout(member) || layout;
      const memberMetrics = metricsForLayout(memberLayout);
      const rect = startRects.get(member);
      const preview = createResizePreview(
        memberLayout,
        member,
        isWidgetGridItem(member) ? "widget-placeholder" : "db-panel-placeholder",
        rect,
        memberMetrics
      );
      preview.classList.add("dashboard-group-member-preview");
      if (member.classList.contains("db-panel-collapsed")) {
        preview.classList.add("db-panel-collapsed");
        preview.dataset.gridRowSpan = "1";
        preview.style.height = `${gridHeightForRows(1, memberMetrics.gap)}px`;
      }
      const live = beginLiveResizeSurface(member, rect);
      const expandedGhost = createExpandedFootprintGhost(member, memberLayout, rect, null, memberMetrics);
      return { member, memberLayout, memberMetrics, preview, live, expandedGhost, rect };
    });
    const previewMembers = previewEntries.map((entry) => entry.preview);
    const previewStartBounds = new Map(previewEntries.map((entry) => [entry.preview, startBounds.get(entry.member)]));
    const sourceForPreview = new Map(previewEntries.map((entry) => [entry.preview, entry.member]));
    const metricsForPreview = new Map(previewEntries.map((entry) => [entry.preview, entry.memberMetrics]));
    const groupFootprint = createGroupFootprint(layout, groupBox, "dashboard-resize-preview dashboard-group-resize-footprint");
    const memberSet = new Set(members);
    const reflowItems = reflowItemsForLayout(layout, source).filter((item) => !memberSet.has(item));
    let previewCols = startWidth;
    let previewRows = startHeight;

    const updateLiveGroupResize = (clientX, clientY) => {
      const scrollDeltaY = (window.scrollY || document.documentElement.scrollTop || 0) - startScrollY;
      const effectiveClientY = clientY + scrollDeltaY;
      const rawCols = Math.max(1, startWidth + ((clientX - startX) / columnStep));
      const rawRows = Math.max(1, startHeight + ((effectiveClientY - startY) / rowStep));
      const scaleX = Math.max(liveMinScaleX, Math.min(liveMaxScaleX, rawCols / startWidth));
      const scaleY = Math.max(liveMinScaleY, rawRows / startHeight);
      const liveBounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      previewEntries.forEach((entry) => {
        const startRect = entry.rect;
        const left = groupStartRect.left + ((startRect.left - groupStartRect.left) * scaleX);
        const top = groupStartRect.top - scrollDeltaY + (startRect.top - groupStartRect.top);
        const width = Math.max(gridItemPixelWidthForSpan(entry.memberLayout, gridItemMinimumSpan(entry.member), entry.memberMetrics), startRect.width * scaleX);
        const liveRows = isWidgetGridItem(entry.member)
          ? groupResizeWidgetRowSpan(
            startBounds.get(entry.member),
            groupBox,
            scaleY,
            gridItemMinimumRows(entry.member)
          )
          : entry.member.classList.contains("db-panel-collapsed")
            ? 1
            : groupResizePanelRowSpan(
            startBounds.get(entry.member),
            groupBox,
            scaleY,
            panelMinimumRows(entry.member, entry.memberMetrics)
          );
        const height = isWidgetGridItem(entry.member)
          ? gridHeightForRows(liveRows, entry.memberMetrics.gap)
          : entry.member.classList.contains("db-panel-collapsed")
            ? startRect.height
            : Math.max(getPanelMinimumHeight(entry.member), gridHeightForRows(liveRows, entry.memberMetrics.gap));
        updateLiveResizeSurface(entry.live, width, height, left, top);
        liveBounds.left = Math.min(liveBounds.left, left);
        liveBounds.top = Math.min(liveBounds.top, top);
        liveBounds.right = Math.max(liveBounds.right, left + width);
        liveBounds.bottom = Math.max(liveBounds.bottom, top + height);
        if (entry.expandedGhost) {
          const ghostRows = entry.member.classList.contains("db-panel-collapsed")
            ? groupResizeCollapsedPanelExpandedRows(
              entry.member,
              startBounds.get(entry.member),
              groupBox,
              scaleY,
              entry.memberLayout,
              entry.memberMetrics
            )
            : Math.max(
              expandedPanelFootprintRows(entry.member, entry.memberLayout, null, entry.memberMetrics),
              Math.round(startBounds.get(entry.member).rowSpan * scaleY)
            );
          updateExpandedFootprintGhost(entry.expandedGhost, entry.member, entry.memberLayout, {
            left,
            top,
            width,
            rows: ghostRows,
          }, entry.memberMetrics);
        }
      });
      updateGroupBoundarySurface(resizeBoundary, {
        left: liveBounds.left,
        top: liveBounds.top,
        width: Math.max(1, liveBounds.right - liveBounds.left),
        height: Math.max(1, liveBounds.bottom - liveBounds.top),
      });
    };

    const applyFromPointer = (clientX, clientY) => {
      updateLiveGroupResize(clientX, clientY);
      const scrollDeltaY = (window.scrollY || document.documentElement.scrollTop || 0) - startScrollY;
      const effectiveClientY = clientY + scrollDeltaY;
      const nextCols = Math.max(1, startWidth + Math.round((clientX - startX) / columnStep));
      const nextRows = Math.max(1, startHeight + Math.round((effectiveClientY - startY) / rowStep));
      if (nextCols === previewCols && nextRows === previewRows) return;
      previewCols = nextCols;
      previewRows = nextRows;
      animateOrderedGridReflow(layout, () => {
        applyGroupFootprintBounds(groupFootprint.footprint, groupFootprint.footprintLayout, {
          col: groupBox.col,
          row: groupBox.row,
          span: nextCols,
          rowSpan: nextRows,
        }, metricsForLayout(groupFootprint.footprintLayout));
        applyGroupResizeLayout(layout, previewMembers, previewStartBounds, groupBox, nextCols / startWidth, nextRows / startHeight, {
          sourceForMember: sourceForPreview,
          metricsForMember: metricsForPreview,
          collision: false,
        });
        resolveSparseGridLayoutForActiveItems(layout, previewMembers, {
          afterOnly: true,
          metrics: layoutMetrics,
          exclude: [groupFootprint.footprint],
          items: reflowItems,
        });
        if (resizeParentPanel) syncOpenPanelHeightToInternalGrid(resizeParentPanel, { includePlaceholders: true });
      }, source, { items: reflowItems, metrics: layoutMetrics });
    };

    const finishResize = (upEvent, canceled) => {
      if (canceled) {
        restoreGridLayoutSnapshot(resizeStartSnapshot);
        if (resizeParentPanelLayoutSnapshot) restoreGridLayoutSnapshot(resizeParentPanelLayoutSnapshot);
      } else {
        animateOrderedGridReflow(layout, () => {
          previewEntries.forEach((entry) => entry.expandedGhost?.remove());
          restoreGridLayoutSnapshot(resizeStartSnapshot);
          applyGroupFootprintBounds(groupFootprint.footprint, groupFootprint.footprintLayout, {
            col: groupBox.col,
            row: groupBox.row,
            span: previewCols,
            rowSpan: previewRows,
          }, metricsForLayout(groupFootprint.footprintLayout));
          applyGroupResizeLayout(layout, previewMembers, previewStartBounds, groupBox, previewCols / startWidth, previewRows / startHeight, {
            sourceForMember: sourceForPreview,
            metricsForMember: metricsForPreview,
            collision: false,
          });
          resolveSparseGridLayoutForActiveItems(layout, previewMembers, {
            afterOnly: true,
            metrics: layoutMetrics,
            exclude: [groupFootprint.footprint],
            items: reflowItems,
          });
          commitGroupResizeFromPreviews(previewEntries, layout);
          previewEntries.forEach((entry) => entry.preview.remove());
          groupFootprint.footprint.remove();
          previewEntries.forEach((entry) => clearLiveResizeSurface(entry.member, entry.live));
          if (resizeParentPanel) syncOpenPanelHeightToInternalGrid(resizeParentPanel);
        }, source, { items: reflowItems, metrics: layoutMetrics });
        syncCommittedWorkspaceScrollFloor(layout, {
          preserveViewport: document.body.classList.contains("dashboard-interaction-scroll-extended"),
        });
        onCommit?.();
      }
    };
    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      applyFromPointer(moveEvent.clientX, moveEvent.clientY);
    };

    beginResizeLifecycle({
      event,
      source,
      layout,
      onMove,
      onEnd: finishResize,
      onCleanup: () => {
        previewEntries.forEach((entry) => entry.preview.remove());
        previewEntries.forEach((entry) => clearLiveResizeSurface(entry.member, entry.live));
        previewEntries.forEach((entry) => entry.expandedGhost?.remove());
        resizeBoundary.remove();
        groupFootprint.footprint.remove();
        document.body.classList.remove("group-transform-active");
        members.forEach((member) => member.classList.remove("group-transform-member"));
        onEnd?.();
      },
    });
    return true;
  };

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

  const initWidgetLayout = (layout) => {
    const { internalLayout, layoutKey, widgets } = hydrateWidgetLayout(layout, {
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
      ensureWidgetTools,
      markLoadedExpansionBaseline,
      ensureWorkspaceObjectMetadata,
      workspaceObjectType,
      applyWorkspaceContextToElement,
      applyWidgetSpan,
      applyWidgetGridPosition,
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
    });

    const initWidget = (widget) => {
      if (widget.dataset.widgetInitialized === "true") return;
      widget.dataset.widgetInitialized = "true";
      ensureWidgetTools(widget);
      widget.__saveWidgetLayout = () => saveWidgetLayouts(layout);
      delete widget.dataset.widgetRuntimeControlsBound;
      bindWidgetRuntimeControls(widget);
      const tools = widget.querySelector(".widget-tools");
      const drawer = widget.querySelector(".widget-tool-drawer");
      widget.__dashboardToolDrawer = drawer;
      const settings = widget.querySelector(".widget-settings-toggle");
      const moveHandle = widget.querySelector(".panel-move-handle");
      const resizeHandle = widget.querySelector(".panel-resize-handle");
      const pinButton = widget.querySelector(".panel-pin-toggle");
      const titleButton = widget.querySelector(".panel-title-handle");
      const colorToggle = widget.querySelector(".panel-color-toggle");
      const deleteButton = widget.querySelector(".panel-delete-handle");
      const colorMenu = buildPanelColorMenu(widget, layout, colorToggle);
      const workbenchPanel = ensureWidgetWorkbenchPanel(widget);
      const syncOpenWidgetToolPosition = () => {
        if (!widget.classList.contains("widget-tools-open") && !widget.classList.contains("widget-workbench-open")) return;
        if (isDashboardInteractionActive()) return;
        positionDashboardToolDrawer(widget, settings, drawer);
        const drawerTop = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-top");
        const drawerRight = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-right");
        if (drawerTop) tools?.style?.setProperty("--dashboard-tool-drawer-top", drawerTop);
        if (drawerRight) tools?.style?.setProperty("--dashboard-tool-drawer-right", drawerRight);
      };
      if (!widget.__widgetToolPositionObserver) {
        widget.__widgetToolPositionObserver = new MutationObserver(syncOpenWidgetToolPosition);
        widget.__widgetToolPositionObserver.observe(widget, {
          attributes: true,
          attributeFilter: ["style", "data-grid-col", "data-grid-row", "data-current-span", "data-grid-row-span"],
        });
      }
      let closeTimer;
      let suppressToolOpenUntil = 0;
      let suppressWidgetClickUntil = 0;
      let dragging = false;
      let suppressSettingsClickUntil = 0;
      let ignoreToolLeaveCloseUntilPointerActivity = false;
      let releaseToolLeaveCloseResume = null;
      let toolsOpenedByApproach = false;
      const releaseToolLeaveClose = (event = null) => {
        const closeRestoredTools = (event?.type === "pointerdown" || event?.type === "pointermove") &&
          !tools?.contains(event.target) &&
          !drawer?.contains(event.target) &&
          !colorMenu?.contains(event.target);
        ignoreToolLeaveCloseUntilPointerActivity = false;
        if (!releaseToolLeaveCloseResume) return;
        document.removeEventListener("pointermove", releaseToolLeaveCloseResume, true);
        document.removeEventListener("pointerdown", releaseToolLeaveCloseResume, true);
        releaseToolLeaveCloseResume = null;
        if (closeRestoredTools) closeTools();
      };
      const armToolLeaveCloseResume = () => {
        releaseToolLeaveClose();
        ignoreToolLeaveCloseUntilPointerActivity = true;
        releaseToolLeaveCloseResume = releaseToolLeaveClose;
        document.addEventListener("pointermove", releaseToolLeaveCloseResume, { capture: true, once: true });
        document.addEventListener("pointerdown", releaseToolLeaveCloseResume, { capture: true, once: true });
      };
      const openTools = (pointerCoords = null) => {
        if (performance.now() < suppressToolOpenUntil) return;
        if (!canOpenDashboardTools(widget)) return;
        window.clearTimeout(closeTimer);
        portalDashboardToolDrawer(drawer, settings || widget);
        if (pointerCoords) {
          positionDashboardToolDrawerAtPointer(widget, drawer, pointerCoords.clientX, pointerCoords.clientY);
        } else {
          positionDashboardToolDrawer(widget, settings, drawer);
        }
        const _openToolsTop = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-top");
        const _openToolsRight = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-right");
        if (_openToolsTop) tools?.style?.setProperty("--dashboard-tool-drawer-top", _openToolsTop);
        if (_openToolsRight) tools?.style?.setProperty("--dashboard-tool-drawer-right", _openToolsRight);
        setWidgetLinkNavigationSuspended(widget, true);
        widget.classList.add("widget-tools-open");
        settings?.setAttribute("aria-expanded", "true");
        syncLayoutToolsActive();
      };
      const closeTools = () => {
        releaseToolLeaveClose();
        toolsOpenedByApproach = false;
        if (tools?.contains(document.activeElement)) document.activeElement?.blur?.();
        widget.classList.remove("widget-tools-open");
        widget.classList.remove("widget-workbench-open");
        settings?.setAttribute("aria-expanded", "false");
        if (workbenchPanel) restoreFloatingMenu(workbenchPanel);
        workbenchPanel?.setAttribute("hidden", "");
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        restoreDashboardToolDrawer(drawer);
        setWidgetLinkNavigationSuspended(widget, false);
        syncLayoutToolsActive();
      };
      const closeWorkbench = () => {
        if (workbenchPanel) restoreFloatingMenu(workbenchPanel);
        widget.classList.remove("widget-workbench-open");
        workbenchPanel?.setAttribute("hidden", "");
        if (!widget.classList.contains("widget-tools-open")) setWidgetLinkNavigationSuspended(widget, false);
        syncLayoutToolsActive();
      };
      const openWorkbench = (pointerCoords = null) => {
        if (isDashboardInteractionActive()) return;
        closeInactiveDashboardTools(widget);
        window.clearTimeout(closeTimer);
        widget.classList.remove("widget-tools-open");
        settings?.setAttribute("aria-expanded", "false");
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        setWidgetLinkNavigationSuspended(widget, true);
        widget.classList.add("widget-workbench-open");
        const panel = ensureWidgetWorkbenchPanel(widget);
        if (panel) {
          portalFloatingMenu(panel, settings || widget, { skipPosition: true });
          panel.style.left = "0px";
          panel.style.top = "0px";
          panel.hidden = false;
          const panelWidth = panel.offsetWidth || 318;
          const panelHeight = panel.offsetHeight || 200;
          const vg = 8;
          const coords = pointerCoords || (() => {
            const r = (settings || widget).getBoundingClientRect();
            return { clientX: r.right, clientY: r.top };
          })();
          const left = Math.max(vg, Math.min(coords.clientX - panelWidth, window.innerWidth - vg - panelWidth));
          const top = Math.max(vg, Math.min(coords.clientY, window.innerHeight - vg - panelHeight));
          panel.style.left = `${Math.round(left)}px`;
          panel.style.top = `${Math.round(top)}px`;
        }
        syncLayoutToolsActive();
      };
      const toggleAppearanceSettings = (pointerCoords = null) => {
        releaseToolLeaveClose();
        closeWorkbench();
        if (!canOpenDashboardTools(widget)) return;
        const shouldClose = widget.classList.contains("widget-tools-open") &&
          !toolsOpenedByApproach;
        toolsOpenedByApproach = false;
        if (shouldClose) {
          closeTools();
          return;
        }
        suppressToolOpenUntil = 0;
        closeInactiveDashboardTools(widget);
        openTools(pointerCoords);
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
      };
      const pointerIntersectsSettingsToggle = (event) => {
        if (!settings || event?.clientX == null || event?.clientY == null) return false;
        const rect = settings.getBoundingClientRect();
        return pointInRect(event.clientX, event.clientY, rect);
      };
      const scheduleClose = () => {
        window.clearTimeout(closeTimer);
        if (isDashboardInteractionActive() || ignoreToolLeaveCloseUntilPointerActivity) return;
        closeTimer = window.setTimeout(() => {
          if (isDashboardInteractionActive()) return;
          if (ignoreToolLeaveCloseUntilPointerActivity) return;
          const activeElement = document.activeElement;
          if (
            !tools?.matches(":hover") &&
            !drawer?.matches(":hover") &&
            !drawer?.contains(activeElement) &&
            !colorMenu?.matches(":hover")
          ) closeTools();
        }, 260);
      };
      const resumeToolHoverClose = () => {
        const wasOpen = widget.classList.contains("widget-tools-open");
        releaseToolLeaveClose();
        if (wasOpen) {
          window.clearTimeout(closeTimer);
          return;
        }
        openTools();
        if (!wasOpen && widget.classList.contains("widget-tools-open")) toolsOpenedByApproach = true;
      };
      tools?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      settings?.addEventListener("mouseenter", resumeToolHoverClose);
      settings?.addEventListener("pointermove", resumeToolHoverClose, { passive: true });
      const isInteractiveWidgetSurfaceTarget = (event) => {
        const interactiveTarget = event.target?.closest?.(
          `${surfaceResponseControlSelector}, .media-widget-stage, [contenteditable='true']`,
        );
        return interactiveTarget && interactiveTarget !== widget && widget.contains(interactiveTarget);
      };
      widget.addEventListener("click", (event) => {
        if (!event.target?.closest?.(".widget-tools") && pointerIntersectsSettingsToggle(event)) {
          event.preventDefault();
          event.stopPropagation();
          suppressSettingsClickUntil = performance.now() + 320;
          toggleAppearanceSettings();
          return;
        }
        if (event.target?.closest?.(".widget-tools")) return;
        if (isInteractiveWidgetSurfaceTarget(event)) return;
        event.preventDefault();
        event.stopPropagation();
        if (performance.now() < suppressWidgetClickUntil) return;
        suppressToolOpenUntil = 0;
        openWorkbench({ clientX: event.clientX, clientY: event.clientY });
        try {
          widget.focus?.({ preventScroll: true });
        } catch {
          widget.focus?.();
        }
      }, true);
      widget.__openCustomization = (event) => {
        if (event.target?.closest?.(".widget-tools") || isInteractiveWidgetSurfaceTarget(event)) return;
        event.preventDefault();
        event.stopPropagation();
        toggleAppearanceSettings({ clientX: event.clientX, clientY: event.clientY });
      };
      widget.addEventListener("pointermove", (event) => {
        if (event.target?.closest?.(".widget-tools")) return;
        if (!pointerIntersectsSettingsToggle(event)) return;
        resumeToolHoverClose();
      }, { passive: true });
      tools?.addEventListener("mouseenter", resumeToolHoverClose);
      tools?.addEventListener("mouseleave", scheduleClose);
      workbenchPanel?.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      workbenchPanel?.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      workbenchPanel?.addEventListener("input", (event) => {
        event.stopPropagation();
      });
      workbenchPanel?.addEventListener("change", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const input = event.target?.closest?.(".widget-setting-input");
        if (!input || !widget.contains(input)) return;
        applyWidgetSettingsSchemaChange(widget, input, { history: true });
        ensureWidgetWorkbenchPanel(widget);
      });
      workbenchPanel?.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          closeWorkbench();
          widget.focus?.({ preventScroll: true });
        }
      });
      settings?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (performance.now() < suppressSettingsClickUntil) return;
        toggleAppearanceSettings();
      });
      settings?.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        suppressSettingsClickUntil = performance.now() + 320;
        toggleAppearanceSettings();
      });
      colorToggle?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextOpen = !colorMenu?.classList.contains("panel-color-menu-open");
        if (nextOpen) {
          syncPanelThemeVars(widget, colorMenu);
          colorToggle.__refreshPanelColorMenu?.();
          positionPanelColorMenu(colorToggle, colorMenu);
        }
        colorMenu?.classList.toggle("panel-color-menu-open", nextOpen);
        colorToggle.setAttribute("aria-expanded", nextOpen.toString());
      });
      colorMenu?.addEventListener("mouseenter", resumeToolHoverClose);
      colorMenu?.addEventListener("mouseleave", () => {
        if (isDashboardInteractionActive()) return;
        closeTools();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!colorMenu?.classList.contains("panel-color-menu-open")) return;
        if (widget.contains(event.target) || colorMenu.contains(event.target)) return;
        closeTools();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!widget.classList.contains("widget-workbench-open")) return;
        if (widget.contains(event.target) || colorMenu?.contains(event.target)) return;
        closeWorkbench();
      });
      bindWidgetActionControls({
        widget,
        layout,
        layoutKey,
        tools,
        pinButton,
        titleButton,
        deleteButton,
        groupPeers,
        groupItemLayout,
        saveWidgetLayouts,
        requestWidgetDelete,
        closeTools,
        setSuppressToolOpenUntil: (value) => {
          suppressToolOpenUntil = value;
        },
      });
      bindWidgetMoveRuntime({
        widget,
        layout,
        layoutKey,
        moveHandle,
        settings,
        drawer,
        isPanelInternalGridItem,
        isWorkspaceSurfaceDragStart,
        isDashboardToolInteractionTarget,
        setWidgetLinkNavigationSuspended,
        runOrderedDrag,
        cleanupWidgetRowBreaks,
        saveSharedGridLayouts,
        emitWorkspaceEvent,
        regionIdForWorkspaceItem,
        openTools,
        closeTools,
        armToolLeaveCloseResume,
        isInteractiveWidgetSurfaceTarget,
        clearToolCloseTimer: () => window.clearTimeout(closeTimer),
        setDragging: (value) => {
          dragging = value;
          if (value) window.clearTimeout(closeTimer);
        },
        setSuppressWidgetClickUntil: (value) => {
          suppressWidgetClickUntil = value;
        },
      });
      bindWidgetResizeRuntime({
        widget,
        layout,
        layoutKey,
        resizeHandle,
        settings,
        drawer,
        DASHBOARD_GRID_COLUMNS,
        isDashboardToolInteractionTarget,
        groupTransformItems,
        runGroupResize,
        saveSharedGridLayouts,
        openTools,
        closeTools,
        armToolLeaveCloseResume,
        closeInactiveDashboardTools,
        createGridMetrics,
        isPanelInternalWidgetLayout,
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
        groupPeers,
        groupItemLayout,
        snapshotGridLayout,
        restoreGridLayoutSnapshot,
        applyWidgetSpan,
        applyWidgetGridPosition,
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
        emitWorkspaceEvent,
        regionIdForWorkspaceItem,
        syncCommittedWorkspaceScrollFloor,
        beginResizeLifecycle,
        resizeEdgeFromPointer,
        clearCloseTimer: () => window.clearTimeout(closeTimer),
        setSuppressWidgetClickUntil: (value) => {
          suppressWidgetClickUntil = value;
        },
      });
    };
    widgets.forEach(initWidget);
    layout.__initWidget = initWidget;
    if (internalLayout && layout.dataset.dragRuntimeDelegateBound !== "true") {
      layout.dataset.dragRuntimeDelegateBound = "true";
      layout.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !layout.contains(event.target)) return;
        if (event.target?.closest?.(".widget-card")) return;
        const handle = [...layout.querySelectorAll(":scope > .widget-card .panel-move-handle")]
          .filter((candidate) => candidate.offsetParent !== null)
          .find((candidate) => pointInRect(event.clientX, event.clientY, candidate.getBoundingClientRect()));
        const widget = handle?.closest?.(".widget-card");
        if (widget?.parentElement !== layout) return;
        widget?.__beginWidgetMoveFromDragRuntime?.(event);
      }, { capture: true });
    }
  };

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
    getPanelMinimumHeight,
    panelMinimumRows,
    applyPanelHeight,
    applyPanelSpan,
    openPanelForInternalDrop,
    applyVerticalPanelExpansion,
    resolveSparseGridLayout,
    reflowItemsForLayout,
    undoTransientItemClasses,
    groupItemLayoutKey,
    applyWidgetSpan,
    applyWidgetGridPosition,
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

  document.querySelectorAll(".panel-layout").forEach((layout) => {
    const { layoutKey, panels } = hydratePanelLayout(layout, {
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
      applyPanelSpan,
      applyPanelGridPosition,
      applyPanelHeight,
      applyPanelColor,
      applyPanelTitleColor,
      restorePanelChildWidgets,
      createPanelRowBreak,
      cleanupPanelRowBreaks,
      syncDefaultDashboardGrid,
      normalizeGridLayout,
      syncWorkspaceRegions,
    });

    const initPanel = (panel) => {
      if (panel.dataset.panelInitialized === "true") return;
      panel.dataset.panelInitialized = "true";
      syncPanelMinimumWidth(panel);
      const header = panel.querySelector(":scope > .db-panel-hd");
      const body = panel.querySelector(":scope > .db-panel-body");
      const settingsButton = header?.querySelector(".panel-settings-toggle");
      const panelTools = header?.querySelector(".panel-tools");
      const panelToolDrawer = panelTools?.querySelector(":scope > .panel-tool-drawer");
      panel.__dashboardToolDrawer = panelToolDrawer;
      const capabilities = workspaceObjectCapabilities(panel);
      if (panelToolDrawer && !panelToolDrawer.querySelector(".panel-delete-handle")) {
        panelToolDrawer.insertAdjacentHTML("beforeend", '<button class="panel-tool-button panel-delete-handle" type="button" aria-label="Delete panel" title="Delete panel"><span class="trash-icon" aria-hidden="true"></span></button>');
      }
      const moveHandle = panelToolDrawer?.querySelector(".panel-move-handle");
      const resizeHandle = panelToolDrawer?.querySelector(".panel-resize-handle");
      const pinButton = panelToolDrawer?.querySelector(".panel-pin-toggle");
      const titleButton = panelToolDrawer?.querySelector(".panel-title-handle");
      const colorToggle = panelToolDrawer?.querySelector(".panel-color-toggle");
      const deleteButton = panelToolDrawer?.querySelector(".panel-delete-handle");
      if (!header || !body) return;
      const internalWidgetGrid = capabilities.hasPanelContentArea ? ensurePanelInternalWidgetGrid(panel) : null;
      if (internalWidgetGrid) initWidgetLayout(internalWidgetGrid);
      if (internalWidgetGrid) syncOpenPanelHeightToInternalGrid(panel, { reflow: false });
      bindPanelChildHoverRuntime({
        panel,
        internalWidgetGrid,
        isDashboardInteractionActive,
        surfaceResponseState,
        updateSurfaceResponse,
      });
      const colorMenu = buildPanelColorMenu(panel, layout, colorToggle);
      pinButton?.setAttribute("aria-pressed", panel.classList.contains("db-panel-pinned").toString());
      let movedDuringPointer = false;
      let toolsCloseTimer;
      let toolPointerCapture = false;
      let suppressHeaderToggleUntil = 0;
      let suppressToolOpenUntil = 0;
      let ignorePanelToolLeaveCloseUntilPointerActivity = false;
      let releasePanelToolLeaveCloseResume = null;
      let panelToolsOpenedByApproach = false;
      const releasePanelToolLeaveClose = (event = null) => {
        const closeRestoredTools = (event?.type === "pointerdown" || event?.type === "pointermove") &&
          !panelTools?.contains(event.target) &&
          !panelToolDrawer?.contains(event.target) &&
          !colorMenu?.contains(event.target);
        ignorePanelToolLeaveCloseUntilPointerActivity = false;
        if (!releasePanelToolLeaveCloseResume) return;
        document.removeEventListener("pointermove", releasePanelToolLeaveCloseResume, true);
        document.removeEventListener("pointerdown", releasePanelToolLeaveCloseResume, true);
        releasePanelToolLeaveCloseResume = null;
        if (closeRestoredTools) closePanelTools();
      };
      const armPanelToolLeaveCloseResume = () => {
        releasePanelToolLeaveClose();
        ignorePanelToolLeaveCloseUntilPointerActivity = true;
        releasePanelToolLeaveCloseResume = releasePanelToolLeaveClose;
        document.addEventListener("pointermove", releasePanelToolLeaveCloseResume, { capture: true, once: true });
        document.addEventListener("pointerdown", releasePanelToolLeaveCloseResume, { capture: true, once: true });
      };
      const openPanelTools = (pointerCoords = null) => {
        if (performance.now() < suppressToolOpenUntil) return;
        if (!canOpenDashboardTools(panel)) return;
        window.clearTimeout(toolsCloseTimer);
        portalDashboardToolDrawer(panelToolDrawer, settingsButton || panel);
        if (pointerCoords) {
          positionDashboardToolDrawerAtPointer(panel, panelToolDrawer, pointerCoords.clientX, pointerCoords.clientY);
        } else {
          positionDashboardToolDrawer(panel, settingsButton, panelToolDrawer);
        }
        panel.classList.add("db-panel-tools-open");
        settingsButton?.setAttribute("aria-expanded", "true");
        syncLayoutToolsActive();
      };

      const closePanelTools = () => {
        releasePanelToolLeaveClose();
        panelToolsOpenedByApproach = false;
        if (panelTools?.contains(document.activeElement)) document.activeElement?.blur?.();
        panel.classList.remove("db-panel-tools-open");
        settingsButton?.setAttribute("aria-expanded", "false");
        colorToggle?.setAttribute("aria-expanded", "false");
        colorMenu?.classList.remove("panel-color-menu-open");
        restoreDashboardToolDrawer(panelToolDrawer);
        syncLayoutToolsActive();
      };

      const scheduleClosePanelTools = () => {
        window.clearTimeout(toolsCloseTimer);
        if (isDashboardInteractionActive() || toolPointerCapture || ignorePanelToolLeaveCloseUntilPointerActivity) return;
        toolsCloseTimer = window.setTimeout(() => {
          if (isDashboardInteractionActive()) return;
          if (toolPointerCapture) return;
          if (ignorePanelToolLeaveCloseUntilPointerActivity) return;
          const activeElement = document.activeElement;
          const stillUsingTools =
            settingsButton?.matches(":hover") ||
            panelToolDrawer?.matches(":hover") ||
            colorMenu?.matches(":hover") ||
            panelToolDrawer?.contains(activeElement) ||
            (panelTools?.contains(activeElement) && activeElement !== colorToggle);
          if (!stillUsingTools) closePanelTools();
        }, 300);
      };
      const resumePanelToolHoverClose = () => {
        const wasOpen = panel.classList.contains("db-panel-tools-open");
        releasePanelToolLeaveClose();
        if (wasOpen) {
          window.clearTimeout(toolsCloseTimer);
          return;
        }
        openPanelTools();
        if (!wasOpen && panel.classList.contains("db-panel-tools-open")) panelToolsOpenedByApproach = true;
      };

      panelTools?.addEventListener("click", (event) => event.stopPropagation());
      panelTools?.addEventListener("keydown", (event) => event.stopPropagation());
      panelTools?.addEventListener("mouseleave", scheduleClosePanelTools);
      panelTools?.addEventListener("focusin", resumePanelToolHoverClose);
      panelTools?.addEventListener("focusout", scheduleClosePanelTools);
      settingsButton?.addEventListener("mouseenter", () => {
        if (performance.now() < suppressToolOpenUntil) return;
        suppressHeaderToggleUntil = performance.now() + 250;
        resumePanelToolHoverClose();
      });
      settingsButton?.addEventListener("mouseleave", scheduleClosePanelTools);
      panelToolDrawer?.addEventListener("mouseenter", resumePanelToolHoverClose);
      panelToolDrawer?.addEventListener("mouseleave", scheduleClosePanelTools);
      colorMenu?.addEventListener("mouseenter", resumePanelToolHoverClose);
      colorMenu?.addEventListener("mouseleave", () => {
        if (isDashboardInteractionActive()) return;
        if (!toolPointerCapture) closePanelTools();
      });
      const isInteractivePanelSurfaceTarget = (event) => {
        if (event?.target?.closest?.(".panel-internal-widget-grid > .widget-card")) return true;
        const interactiveTarget = event?.target?.closest?.(`${surfaceResponseControlSelector}, [contenteditable='true']`);
        return interactiveTarget && panel.contains(interactiveTarget);
      };

      settingsButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressHeaderToggleUntil = 0;
        releasePanelToolLeaveClose();
        if (!canOpenDashboardTools(panel)) return;
        const shouldClose = panel.classList.contains("db-panel-tools-open") && !panelToolsOpenedByApproach;
        panelToolsOpenedByApproach = false;
        if (shouldClose) {
          closePanelTools();
        } else {
          suppressToolOpenUntil = 0;
          closeInactiveDashboardTools(panel);
          openPanelTools();
        }
      });

      colorToggle?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressHeaderToggleUntil = 0;
        const nextOpen = !colorMenu?.classList.contains("panel-color-menu-open");
        if (nextOpen) {
          syncPanelThemeVars(panel, colorMenu);
          colorToggle.__refreshPanelColorMenu?.();
          positionPanelColorMenu(colorToggle, colorMenu);
        }
        colorMenu?.classList.toggle("panel-color-menu-open", nextOpen);
        colorToggle.setAttribute("aria-expanded", nextOpen.toString());
      });

      window.addEventListener("resize", () => {
        if (colorMenu?.classList.contains("panel-color-menu-open")) positionPanelColorMenu(colorToggle, colorMenu);
      });
      window.addEventListener("scroll", () => {
        if (colorMenu?.classList.contains("panel-color-menu-open")) positionPanelColorMenu(colorToggle, colorMenu);
      }, true);

      bindPanelActionControls({
        panel,
        layout,
        layoutKey,
        header,
        panelTools,
        pinButton,
        titleButton,
        deleteButton,
        capabilities,
        groupPeers,
        groupItemLayout,
        savePanelLayouts,
        requestPanelDelete,
        closePanelTools,
        setSuppressToolOpenUntil: (value) => {
          suppressToolOpenUntil = value;
        },
        setSuppressHeaderToggleUntil: (value) => {
          suppressHeaderToggleUntil = value;
        },
        getSuppressHeaderToggleUntil: () => suppressHeaderToggleUntil,
        getMovedDuringPointer: () => movedDuringPointer,
        setMovedDuringPointer: (value) => {
          movedDuringPointer = value;
        },
        ensureRenderedGridPosition,
        beginPanelExpansionSession,
        applyPanelHeight,
        panelMinimumRows,
        applyPanelGridPosition,
        animatePanelReflow,
        relaxCollapsedExpansionDisplacement,
        endPanelExpansionSession,
        applyVerticalPanelExpansion,
        emitWorkspaceEvent,
        workspaceObjectType,
        WORKSPACE_OBJECT_TYPES,
        regionIdForWorkspaceItem,
        isInteractivePanelSurfaceTarget,
        releasePanelToolLeaveClose,
        canOpenDashboardTools,
        closeInactiveDashboardTools,
        openPanelTools,
      });

      bindPanelMoveRuntime({
        panel,
        layout,
        layoutKey,
        moveHandle,
        settingsButton,
        panelToolDrawer,
        isWorkspaceSurfaceDragStart,
        isDashboardToolInteractionTarget,
        runOrderedDrag,
        cleanupPanelRowBreaks,
        saveSharedGridLayouts,
        emitWorkspaceEvent,
        workspaceObjectType,
        WORKSPACE_OBJECT_TYPES,
        regionIdForWorkspaceItem,
        isInteractivePanelSurfaceTarget,
        openPanelTools,
        closePanelTools,
        armPanelToolLeaveCloseResume,
        clearToolsCloseTimer: () => window.clearTimeout(toolsCloseTimer),
        setToolPointerCapture: (value) => {
          toolPointerCapture = value;
        },
        setMovedDuringPointer: (value) => {
          movedDuringPointer = value;
        },
      });

      bindPanelResizeRuntime({
        panel,
        layout,
        layoutKey,
        resizeHandle,
        settingsButton,
        panelToolDrawer,
        DASHBOARD_GRID_COLUMNS,
        DASHBOARD_GRID_ROW_HEIGHT,
        isDashboardToolInteractionTarget,
        groupTransformItems,
        runGroupResize,
        saveSharedGridLayouts,
        openPanelTools,
        closePanelTools,
        armPanelToolLeaveCloseResume,
        closeInactiveDashboardTools,
        createGridMetrics,
        gridItemRowSpan,
        gridHeightForRows,
        gridItemPixelWidthForSpan,
        gridItemMinimumSpan,
        getPanelMinimumHeight,
        createResizePreview,
        reflowItemsForLayout,
        beginLiveResizeSurface,
        beginResizeAutoZoomCamera,
        updateResizeAutoZoomCamera,
        createExpandedFootprintGhost,
        groupPeers,
        groupItemLayout,
        snapshotGridLayout,
        restoreGridLayoutSnapshot,
        applyPanelSpan,
        applyPanelGridPosition,
        applyPanelHeight,
        resolveSparseGridLayout,
        resizeAutoZoomPointerToScenePoint,
        updateLiveResizeSurface,
        panelMinimumRows,
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
        emitWorkspaceEvent,
        workspaceObjectType,
        WORKSPACE_OBJECT_TYPES,
        regionIdForWorkspaceItem,
        syncCommittedWorkspaceScrollFloor,
        beginResizeLifecycle,
        resizeEdgeFromPointer,
        clearToolsCloseTimer: () => window.clearTimeout(toolsCloseTimer),
        setToolPointerCapture: (value) => {
          toolPointerCapture = value;
        },
      });
    };

    panels.forEach(initPanel);
    layout.__initPanel = initPanel;
  });

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
    loadWorkspaceLogicGraph,
    getActivePanelProfile,
    visualGridOrder,
    workspaceDeleteKind,
    gridBoundsForItem,
    sanitizeLayoutElementForUndo,
    showToast,
    undoTransientItemClasses,
    WORKSPACE_OBJECT_TYPES,
    saveWorkspaceLogicGraph,
    pushLiveLayoutUndo,
    visibleRegionInsertionTarget,
    orderedLayoutStartRow,
    commitInsertedGridItemWithVerticalPushdown,
    clearGroupSelection,
    applyWidgetGridPosition,
    bindDashboardKeywordForms,
    applyPanelGridPosition,
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
    getGroupMode: () => groupMode,
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
    isEngineerMode,
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
    applyPanelSpan,
    applyWidgetSpan,
    applyPanelColor,
    applyPanelTitleColor,
    applyPanelGridPosition,
    applyWidgetGridPosition,
    animatePanelReflow,
    animateWidgetReflow,
    commitInsertedGridItemWithVerticalPushdown,
    syncWorkspaceRegions,
    ensureWorkspaceObjectMetadata,
    ensureWidgetTools,
    parseJsonRecord,
    bindDashboardKeywordForms,
    refreshResolvedContextDebug,
    refreshEngineerOverlays,
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
    applyWidgetSpan,
    applyPanelColor,
    applyPanelTitleColor,
    applyPanelSpan,
    updatePanelChildEmptyState,
    syncDefaultDashboardGrid,
    normalizeGridLayout,
    pushLiveLayoutUndo,
  });

});

void import("./liquid-glass-webgl.js");
