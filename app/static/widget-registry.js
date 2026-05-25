(() => {
  const definitions = new Map();
  const aliases = new Map();

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

  const parseConfig = (value) => {
    if (!value) return {};
    if (typeof value === "object") return { ...value };
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const normalizedSize = (size, fallbackCols = 1, fallbackRows = 1) => ({
    cols: Math.max(1, Math.min(6, Number(size?.cols) || fallbackCols)),
    rows: Math.max(1, Number(size?.rows) || fallbackRows),
  });

  const defaultQueryFields = (resolvedContext) => {
    const mapping = resolvedContext?.semanticMapping || {};
    return [
      mapping.labelField,
      mapping.valueField,
      mapping.dateField,
      mapping.categoryField,
      mapping.statusField,
      mapping.ownerField,
      mapping.locationField,
    ].filter(Boolean);
  };

  const runtimeState = (label, helper = "") => `
      <div class="widget-runtime-state">
        <span class="stat-val">${escapeHtml(label)}</span>
        ${helper ? `<span class="stat-lbl">${escapeHtml(helper)}</span>` : ""}
      </div>`;

  const unsupportedDefinition = (type = "unknown") => ({
    type: "unsupported",
    displayName: "Unsupported Widget",
    aliases: [],
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    widgetType: String(type || "unknown"),
    dashboardObjectKind: "unsupported-widget",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom unsupported-widget-card",
    capabilities: {
      readsContext: false,
      writesContext: false,
      requiresDataSource: false,
      supportsFilters: false,
      supportsTimeRange: false,
      supportsResize: true,
    },
    supportedSettings: ["title", "color", "pin", "delete"],
    queryRequirements: { fields: [] },
    getDefaultConfig: () => ({ title: `Unsupported: ${type || "unknown"}` }),
    resolveQuery: () => null,
    render: ({ instance }) => `
      <div class="unsupported-widget-state widget-runtime-state" role="status">
        <span class="stat-val">Unsupported widget</span>
        <span class="stat-lbl">${escapeHtml(instance.type || type || "unknown")}</span>
      </div>`,
  });

  const normalizeDefinition = (definition) => {
    const type = String(definition?.type || "").trim();
    if (!type) return null;
    const defaultSize = normalizedSize(definition.defaultSize, definition.defaultSpan || 1, definition.defaultRows || 1);
    const minSize = normalizedSize(definition.minSize, definition.minSpan || defaultSize.cols, definition.minRows || defaultSize.rows);
    const getDefaultConfig = typeof definition.getDefaultConfig === "function"
      ? definition.getDefaultConfig
      : () => ({});
    return {
      ...definition,
      type,
      displayName: definition.displayName || type,
      aliases: Array.isArray(definition.aliases) ? definition.aliases : [],
      defaultSize,
      minSize,
      capabilities: {
        readsContext: false,
        writesContext: false,
        requiresDataSource: false,
        supportsFilters: false,
        supportsTimeRange: false,
        supportsResize: true,
        ...(definition.capabilities || {}),
      },
      supportedSettings: Array.isArray(definition.supportedSettings)
        ? definition.supportedSettings
        : ["title", "color", "pin", "delete"],
      queryRequirements: definition.queryRequirements || { fields: [] },
      getDefaultConfig,
      resolveQuery: typeof definition.resolveQuery === "function" ? definition.resolveQuery : () => null,
      render: typeof definition.render === "function"
        ? definition.render
        : ({ instance }) => runtimeState(instance.config?.title || definition.displayName, ""),
    };
  };

  const registerWidgetDefinition = (definition) => {
    const normalized = normalizeDefinition(definition);
    if (!normalized) return false;
    definitions.set(normalized.type, normalized);
    normalized.aliases.forEach((alias) => aliases.set(alias, normalized.type));
    return true;
  };

  const getWidgetDefinition = (type) => {
    const key = String(type || "").trim();
    const canonical = aliases.get(key) || key;
    return definitions.get(canonical) || unsupportedDefinition(key);
  };

  const createWidgetInstance = (definition, overrides = {}) => {
    const resolvedDefinition = typeof definition === "string" ? getWidgetDefinition(definition) : definition;
    const config = {
      ...resolvedDefinition.getDefaultConfig(),
      ...parseConfig(overrides.config),
    };
    return {
      id: overrides.id || overrides.key || "",
      type: resolvedDefinition.type,
      x: Number(overrides.x) || Number(overrides.gridCol) || 1,
      y: Number(overrides.y) || Number(overrides.gridRow) || 1,
      cols: Number(overrides.cols) || Number(overrides.span) || resolvedDefinition.defaultSize.cols,
      rows: Number(overrides.rows) || Number(overrides.rowSpan) || resolvedDefinition.defaultSize.rows,
      config,
      contextOverrideId: overrides.contextOverrideId || null,
    };
  };

  const renderWidget = (definition, props = {}) => {
    const resolvedDefinition = typeof definition === "string" ? getWidgetDefinition(definition) : definition;
    const instance = props.instance || createWidgetInstance(resolvedDefinition, {});
    const status = props.status || "empty";
    try {
      return resolvedDefinition.render({
        ...props,
        instance,
        definition: resolvedDefinition,
        status,
      });
    } catch (error) {
      return runtimeState("Widget error", error?.message || "Render failed");
    }
  };

  registerWidgetDefinition({
    type: "stat",
    displayName: "Stat",
    aliases: ["tracker", "widget"],
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    widgetType: "tracker",
    dashboardObjectKind: "stat",
    contextRole: "content",
    htmlTag: "a",
    className: "stat-card widget-card widget-card-custom",
    capabilities: {
      readsContext: true,
      requiresDataSource: false,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["title", "value", "color", "pin", "duplicate", "delete"],
    queryRequirements: { fields: ["valueField", "labelField"], limit: 1 },
    getDefaultConfig: () => ({ title: "Widget", value: "0", aggregation: "count" }),
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      const fields = defaultQueryFields(resolvedContext).slice(0, 3);
      return { fields, limit: Number(config.limit) || 1 };
    },
    render: ({ instance, data, status }) => {
      const first = data?.rows?.[0] || null;
      const mapping = data?.semanticMapping || {};
      const value = first && mapping.valueField ? first[mapping.valueField] : instance.config.value;
      return `
        <span class="stat-val">${escapeHtml(value ?? "0")}</span>
        <span class="stat-lbl">${escapeHtml(instance.config.title || "Widget")}</span>`;
    },
  });

  registerWidgetDefinition({
    type: "timeframe",
    displayName: "Timeframe",
    aliases: ["controls", "time-range"],
    defaultSize: { cols: 4, rows: 1 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "controls",
    dashboardObjectKind: "timeframe",
    contextRole: "timeframe-control",
    htmlTag: "nav",
    className: "range-bar widget-card timeframe-widget widget-card-custom",
    ariaLabel: "Timeframe controls",
    capabilities: {
      readsContext: true,
      writesContext: true,
      requiresDataSource: false,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["timeRange", "color", "pin", "delete"],
    queryRequirements: { timeRange: true },
    getDefaultConfig: () => ({
      title: "Timeframe",
      activeLabel: "This week",
      presets: ["Today", "7 days", "30 days"],
    }),
    resolveQuery: () => null,
    render: ({ instance }) => {
      const presets = Array.isArray(instance.config.presets) && instance.config.presets.length
        ? instance.config.presets
        : ["Today", "7 days", "30 days"];
      return `
        <div class="timeframe-command-surface">
          <div class="range-controls timeframe-controls">
            <div class="range-presets timeframe-presets" role="group" aria-label="Timeframe presets">
              ${presets.map((preset, index) => `<a class="preset-btn${index === 0 ? " active" : ""}" href="/dashboard">${escapeHtml(preset)}</a>`).join("")}
            </div>
          </div>
          <div class="timeframe-active-cluster">
            <button class="range-custom-trigger timeframe-selector" type="button" aria-label="Selected timeframe" title="Selected timeframe">${escapeHtml(instance.config.activeLabel || "This week")}</button>
          </div>
          <div class="range-search timeframe-range timeframe-utility-cluster" role="group" aria-label="Timeframe utilities">
            <button class="range-icon-button timeframe-refresh" type="button" aria-label="Refresh timeframe" title="Refresh timeframe"><span class="timeframe-refresh-icon" aria-hidden="true"></span></button>
            <button class="range-icon-button timeframe-calendar" type="button" aria-label="Open date range" title="Open date range"><span class="timeframe-calendar-icon" aria-hidden="true"></span></button>
          </div>
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "search",
    displayName: "Search Bar",
    defaultSize: { cols: 2, rows: 1 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "search",
    dashboardObjectKind: "search",
    contextRole: "search-control",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom search-widget-card",
    capabilities: {
      readsContext: true,
      writesContext: true,
      requiresDataSource: false,
      supportsFilters: true,
      supportsResize: true,
    },
    supportedSettings: ["placeholder", "scope", "color", "pin", "delete"],
    queryRequirements: { filters: true },
    getDefaultConfig: () => ({ title: "Search", query: "", placeholder: " " }),
    resolveQuery: (config) => config.query
      ? { filters: [{ field: config.field || "query", operator: "contains", value: config.query }] }
      : null,
    render: ({ instance }) => {
      const title = instance.config.title || "Search";
      return `
        <div class="search-widget-content">
          <div class="range-search search-widget-control" role="search" aria-label="${escapeHtml(title)}">
            <input class="range-search-input search-widget-input" type="search" placeholder="${escapeHtml(instance.config.placeholder || " ")}" autocomplete="off" aria-label="${escapeHtml(title)}" value="${escapeHtml(instance.config.query || "")}">
            <span class="range-search-label stat-lbl">${escapeHtml(title)}</span>
          </div>
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "table",
    displayName: "Table",
    defaultSize: { cols: 3, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "table",
    dashboardObjectKind: "table",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom table-widget-card",
    capabilities: {
      readsContext: true,
      requiresDataSource: true,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["columns", "limit", "color", "pin", "delete"],
    queryRequirements: { fields: "semantic", limit: 5 },
    getDefaultConfig: () => ({ title: "Table", limit: 5 }),
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      const fields = Array.isArray(config.fields) && config.fields.length
        ? config.fields
        : defaultQueryFields(resolvedContext).slice(0, 4);
      return { fields, limit: Number(config.limit) || 5 };
    },
    render: ({ instance, resolvedContext, data, status }) => {
      if (!resolvedContext?.dataSourceId) return runtimeState(instance.config.title || "Table", "Configure a data source");
      if (status === "loading") return runtimeState(instance.config.title || "Table", "Loading");
      if (status === "error") return runtimeState(instance.config.title || "Table", data?.error || "Unable to load rows");
      const rows = data?.rows || [];
      const fields = data?.schema?.fields?.map((field) => field.name).slice(0, 4) || Object.keys(rows[0] || {}).slice(0, 4);
      if (!rows.length || !fields.length) return runtimeState(instance.config.title || "Table", "No rows");
      return `
        <div class="runtime-table-widget">
          <span class="stat-lbl">${escapeHtml(instance.config.title || "Table")}</span>
          <table class="runtime-table">
            <thead><tr>${fields.map((field) => `<th>${escapeHtml(field)}</th>`).join("")}</tr></thead>
            <tbody>${rows.slice(0, Number(instance.config.limit) || 5).map((row) => `<tr>${fields.map((field) => `<td>${escapeHtml(row?.[field] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "chart",
    displayName: "Chart",
    aliases: ["graph"],
    defaultSize: { cols: 2, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "graph",
    dashboardObjectKind: "chart",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom chart-widget-card",
    capabilities: {
      readsContext: true,
      requiresDataSource: true,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["xField", "yField", "series", "color", "pin", "delete"],
    queryRequirements: { fields: ["dateField", "valueField", "categoryField"] },
    getDefaultConfig: () => ({ title: "Chart" }),
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      return { fields: defaultQueryFields(resolvedContext).slice(0, 3), limit: Number(config.limit) || 12 };
    },
    render: ({ instance, resolvedContext }) => runtimeState(
      instance.config.title || "Chart",
      resolvedContext?.dataSourceId ? "Ready for chart mapping" : "Configure a data source"
    ),
  });

  registerWidgetDefinition({
    type: "stat-filter",
    displayName: "Stat + Filter",
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    widgetType: "stat-filter",
    dashboardObjectKind: "stat-filter",
    contextRole: "content",
    htmlTag: "a",
    className: "stat-card widget-card widget-card-custom",
    capabilities: {
      readsContext: true,
      writesContext: true,
      supportsFilters: true,
      supportsResize: true,
    },
    supportedSettings: ["title", "filter", "color", "pin", "delete"],
    getDefaultConfig: () => ({ title: "Stat + Filter", value: "0" }),
    render: ({ instance }) => `
      <span class="stat-val">${escapeHtml(instance.config.value || "0")}</span>
      <span class="stat-lbl">${escapeHtml(instance.config.title || "Stat + Filter")}</span>`,
  });

  registerWidgetDefinition({
    type: "calendar",
    displayName: "Calendar",
    defaultSize: { cols: 2, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "calendar",
    dashboardObjectKind: "calendar",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom calendar-widget-card",
    capabilities: {
      readsContext: true,
      requiresDataSource: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["dateField", "labelField", "color", "pin", "delete"],
    getDefaultConfig: () => ({ title: "Calendar" }),
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      return { fields: defaultQueryFields(resolvedContext).slice(0, 3), limit: Number(config.limit) || 12 };
    },
    render: ({ instance, resolvedContext }) => runtimeState(
      instance.config.title || "Calendar",
      resolvedContext?.dataSourceId ? "Ready for date mapping" : "Configure a data source"
    ),
  });

  window.dashboardWidgetRuntime = {
    registerWidgetDefinition,
    getWidgetDefinition,
    createWidgetInstance,
    renderWidget,
    listWidgetDefinitions: () => [...definitions.values()].map((definition) => ({
      type: definition.type,
      displayName: definition.displayName,
      defaultSize: definition.defaultSize,
      minSize: definition.minSize,
      capabilities: definition.capabilities,
      supportedSettings: definition.supportedSettings,
      queryRequirements: definition.queryRequirements,
      aliases: definition.aliases,
    })),
    parseConfig,
  };
})();
