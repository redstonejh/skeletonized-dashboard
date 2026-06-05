export function createWorkspaceCompatibilityRuntime(deps) {
  const {
    CONTEXT_LINK_MODES,
    WORKSPACE_CONTEXT_MODEL_VERSION,
    WORKSPACE_OBJECT_TYPES,
    DASHBOARD_GRID_ROW_HEIGHT,
    createDataAdapterRuntime,
    createWorkspaceLogicGraphRuntime,
    createWorkspaceMinimapRuntime,
    createGridItemSizingRuntime,
    getActivePanelProfile,
    readJsonStore,
    writeJsonStore,
    parseJsonRecord,
    dataSourcesKey,
    workspaceContextsKey,
    workspaceLogicGraphKey,
    removeStore,
    pushLiveLayoutUndo,
    workspaceObjectKey,
    workspaceObjectType,
    workspaceObjectCapabilities,
    workspaceRootRegionId,
    workspaceRegionIdForDivider,
    loadWorkspaceContextLinks,
    groupItemLayout,
    isPanelInternalGridItem,
    isPanelInternalWidgetLayout,
    panelForInternalWidgetLayout,
    widgetLayerForElement,
    isEngineerMode,
    refreshWidgetRuntimeData,
    ensureWorkspaceObjectMetadata,
    gridHostForLayout,
    visualGridOrder,
    globalGridItems,
    gridBoundsForItem,
    createGridMetrics,
    gridHeightForRows,
    gridGapForLayout,
    gridRowsFromHeight,
    queryRelevantWidgetConfig,
    getPanelRuntime,
    savePanelLayouts,
    saveWidgetLayouts,
    refreshWorkspaceMiniMaps: initialRefreshWorkspaceMiniMaps = () => {},
  } = deps;
  let refreshWorkspaceMiniMaps = initialRefreshWorkspaceMiniMaps;

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
    getPanelRuntime,
    gridGapForLayout,
    gridHostForLayout,
    gridRowsFromHeight,
    isPanelInternalWidgetLayout,
    panelForInternalWidgetLayout,
    savePanelLayouts: (...args) => savePanelLayouts(...args),
    saveWidgetLayouts: (...args) => saveWidgetLayouts(...args),
    workspaceObjectCapabilities,
  });

  return {
    activeLayoutKeyForItem,
    applyWorkspaceContextToElement,
    beginManagedWidgetQuery,
    cancelManagedWidgetQueryForWidget,
    demoQueryStateForWidget,
    invalidateManagedWidgetQueryForWidget,
    loadDataSources,
    loadWorkspaceContexts,
    managedQueryStateForWidget,
    normalizedFilterWidgetFilters,
    normalizedTimeframeWidgetRange,
    refreshResolvedContextDebug,
    refreshWorkspaceMiniMaps,
    regionIdForWorkspaceItem,
    resolveWorkspaceContextForItem,
    saveWorkspaceContextState,
    syncWorkspaceRegions,
    widgetQueryKeys,
    workspaceContextFromElement,
    workspaceRegionSummaryForItem,
    loadWorkspaceLogicGraph,
    saveWorkspaceLogicGraph,
    initWorkspaceMinimapLayer,
    gridItemLayoutKey,
    gridItemMinimumRows,
    gridItemMinimumSpan,
    gridItemRowSpan,
    panelExpandedMinimumRows,
    panelMinimumRows,
    saveSharedGridLayouts,
  };
}
