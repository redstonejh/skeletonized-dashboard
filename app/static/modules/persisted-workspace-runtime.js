export const initializePersistedWorkspaceRuntime = ({
  PERSISTED_WORKSPACE_VERSION,
  getActivePanelProfile,
  syncWorkspaceRegions,
  workspaceObjectType,
  WORKSPACE_OBJECT_TYPES,
  canonicalPanelInstanceForPersistence,
  canonicalWidgetInstanceForPersistence,
  panelChildWidgets,
  loadWorkspaceContexts,
  loadDataSources,
  loadAssets,
  assetReferencesFromWidget,
  widgetRuntime,
  currentTransientPersistenceWarnings,
  writeJsonStore,
  readJsonStore,
  persistedWorkspaceKey,
}) => {
  const currentPersistedWorkspaceSnapshot = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
    if (panelLayout) syncWorkspaceRegions(panelLayout);
    if (widgetLayout) syncWorkspaceRegions(widgetLayout);

    const panels = panelLayout
      ? [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")]
          .filter((panel) => workspaceObjectType(panel) !== WORKSPACE_OBJECT_TYPES.divider)
          .map(canonicalPanelInstanceForPersistence)
      : [];
    const dividers = panelLayout
      ? [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")]
          .filter((panel) => workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider)
          .map(canonicalPanelInstanceForPersistence)
      : [];
    const rootWidgets = widgetLayout
      ? [...widgetLayout.querySelectorAll(":scope > .widget-card:not([hidden])")]
          .map((widget) => canonicalWidgetInstanceForPersistence(widget, null))
      : [];
    const childWidgets = panelLayout
      ? [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")]
          .flatMap((panel) => panelChildWidgets(panel).map((widget) => canonicalWidgetInstanceForPersistence(widget, panel)))
      : [];
    const widgets = [...rootWidgets, ...childWidgets];
    const contexts = loadWorkspaceContexts(layoutKey, profile);
    const dataSources = loadDataSources(layoutKey, profile);
    const assets = loadAssets(layoutKey, profile);
    const objects = [
      ...widgets.map((widget) => ({ id: widget.id, type: WORKSPACE_OBJECT_TYPES.widget, layoutDomain: widget.layoutDomain, parentId: widget.parentPanelId || null })),
      ...panels.map((panel) => ({ id: panel.id, type: WORKSPACE_OBJECT_TYPES.panel, layoutDomain: panel.layoutDomain, parentId: null })),
      ...dividers.map((divider) => ({ id: divider.id, type: WORKSPACE_OBJECT_TYPES.divider, layoutDomain: divider.layoutDomain, parentId: null })),
    ];
    return {
      version: PERSISTED_WORKSPACE_VERSION,
      layoutKey,
      profile,
      savedAt: new Date().toISOString(),
      objects,
      widgets,
      panels,
      dividers,
      contexts,
      dataSources,
      assets,
      assetReferences: widgets.flatMap(assetReferencesFromWidget),
    };
  };

  const knownWidgetRuntimeTypes = () => new Set(
    (widgetRuntime?.listWidgetDefinitions?.() || []).map((definition) => definition.type)
  );

  const validatePersistedWorkspaceSnapshot = (snapshot = currentPersistedWorkspaceSnapshot()) => {
    const diagnostics = [];
    const addDiagnostic = (severity, code, message, objectId = "", objectType = "") => {
      diagnostics.push({ severity, code, message, objectId, objectType });
    };
    const ids = new Map();
    const addId = (type, id) => {
      if (!id) {
        addDiagnostic("error", "missing-object-id", `${type} is missing a stable id.`, "", type);
        return;
      }
      if (ids.has(id)) {
        addDiagnostic("error", "duplicate-object-id", `Duplicate object id "${id}" found for ${type}.`, id, type);
        return;
      }
      ids.set(id, type);
    };
    const panelIds = new Set((snapshot.panels || []).map((panel) => panel.id).filter(Boolean));
    const assetIds = new Set((snapshot.assets || []).map((asset) => asset.id).filter(Boolean));
    const contextIds = new Set();
    const widgetTypes = knownWidgetRuntimeTypes();
    (snapshot.widgets || []).forEach((widget) => {
      addId(WORKSPACE_OBJECT_TYPES.widget, widget.id);
      if (!widget.type) addDiagnostic("error", "missing-widget-type", "Widget is missing a runtime type.", widget.id, WORKSPACE_OBJECT_TYPES.widget);
      if (widget.type && !widgetTypes.has(widget.type)) {
        addDiagnostic("warning", "unknown-widget-type", `Widget type "${widget.type}" will render through the unsupported-widget fallback.`, widget.id, WORKSPACE_OBJECT_TYPES.widget);
      }
      if (widget.parentPanelId && !panelIds.has(widget.parentPanelId)) {
        addDiagnostic("error", "missing-parent-panel", `Panel child widget references missing panel "${widget.parentPanelId}".`, widget.id, WORKSPACE_OBJECT_TYPES.widget);
      }
      if (["image", "video", "document"].includes(widget.type) && widget.config?.assetId && !assetIds.has(widget.config.assetId)) {
        addDiagnostic("warning", "missing-asset", `Media widget references missing asset "${widget.config.assetId}".`, widget.id, WORKSPACE_OBJECT_TYPES.widget);
      }
      if (["image", "video", "document"].includes(widget.type) && widget.config?.src) {
        addDiagnostic("warning", "legacy-media-src", "Media widget config still contains a legacy src field; it should migrate to assetId.", widget.id, WORKSPACE_OBJECT_TYPES.widget);
      }
    });
    (snapshot.panels || []).forEach((panel) => addId(WORKSPACE_OBJECT_TYPES.panel, panel.id));
    (snapshot.dividers || []).forEach((divider) => {
      addId(WORKSPACE_OBJECT_TYPES.divider, divider.id);
      if (divider.contextScopeId && !String(divider.contextScopeId).includes(":region:")) {
        addDiagnostic("warning", "divider-context-id-format", "Divider context id does not look like a workspace region id.", divider.id, WORKSPACE_OBJECT_TYPES.divider);
      }
    });
    (snapshot.contexts || []).forEach((context) => {
      if (!context?.id) {
        addDiagnostic("error", "missing-context-id", "Workspace context is missing an id.", "", "context");
        return;
      }
      if (contextIds.has(context.id)) addDiagnostic("error", "duplicate-context-id", `Duplicate context id "${context.id}".`, context.id, "context");
      contextIds.add(context.id);
    });
    (snapshot.assets || []).forEach((asset) => {
      addId("asset", asset.id);
      if (asset.source?.kind === "blob-url" || String(asset.source?.ref || "").startsWith("blob:")) {
        addDiagnostic("warning", "temporary-asset-reference", "Temporary blob URLs are not durable saved asset references.", asset.id, "asset");
      }
    });
    currentTransientPersistenceWarnings(snapshot.layoutKey).forEach((warning) => diagnostics.push(warning));
    const errors = diagnostics.filter((entry) => entry.severity === "error");
    const warnings = diagnostics.filter((entry) => entry.severity !== "error");
    return {
      ok: errors.length === 0,
      version: snapshot.version || 0,
      layoutKey: snapshot.layoutKey || "builder",
      profile: snapshot.profile || getActivePanelProfile(snapshot.layoutKey || "builder"),
      errors,
      warnings,
      diagnostics,
    };
  };

  const savePersistedWorkspaceSnapshot = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const snapshot = currentPersistedWorkspaceSnapshot(layoutKey, profile);
    writeJsonStore(persistedWorkspaceKey(layoutKey, profile), snapshot);
    return snapshot;
  };

  const loadPersistedWorkspaceSnapshot = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const saved = readJsonStore(persistedWorkspaceKey(layoutKey, profile), null);
    if (!saved || Number(saved.version) !== PERSISTED_WORKSPACE_VERSION) return currentPersistedWorkspaceSnapshot(layoutKey, profile);
    return saved;
  };

  const migratePersistedWorkspaceSnapshot = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const saved = readJsonStore(persistedWorkspaceKey(layoutKey, profile), null);
    if (saved && Number(saved.version) === PERSISTED_WORKSPACE_VERSION) return saved;
    return savePersistedWorkspaceSnapshot(layoutKey, profile);
  };

  window.dashboardPersistenceRuntime = {
    version: PERSISTED_WORKSPACE_VERSION,
    keyForLayout: persistedWorkspaceKey,
    snapshot: currentPersistedWorkspaceSnapshot,
    saveSnapshot: savePersistedWorkspaceSnapshot,
    loadSnapshot: loadPersistedWorkspaceSnapshot,
    migrateLegacyLayout: migratePersistedWorkspaceSnapshot,
    validate: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
      validatePersistedWorkspaceSnapshot(currentPersistedWorkspaceSnapshot(layoutKey, profile)),
    validateSnapshot: validatePersistedWorkspaceSnapshot,
  };

  return {
    currentPersistedWorkspaceSnapshot,
    validatePersistedWorkspaceSnapshot,
    savePersistedWorkspaceSnapshot,
    loadPersistedWorkspaceSnapshot,
    migratePersistedWorkspaceSnapshot,
  };
};
