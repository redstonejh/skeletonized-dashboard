export const createWorkspaceObjectModel = ({
  groupItemLayoutKey,
  workspaceContextFromElement,
}) => {
  const WORKSPACE_OBJECT_TYPES = Object.freeze({
    widget: "widget",
    panel: "panel",
    divider: "divider",
  });

  const WORKSPACE_OBJECT_CAPABILITIES = Object.freeze({
    [WORKSPACE_OBJECT_TYPES.widget]: Object.freeze({
      canExpand: false,
      isOpenable: false,
      hasExpandedFootprint: false,
      participatesInGridCollision: true,
      hasPanelContentArea: false,
      usesPanelHeader: false,
      usesAnchorLayer: false,
      usesDividerSurface: false,
    }),
    [WORKSPACE_OBJECT_TYPES.panel]: Object.freeze({
      canExpand: true,
      isOpenable: true,
      hasExpandedFootprint: true,
      participatesInGridCollision: true,
      hasPanelContentArea: true,
      usesPanelHeader: true,
      usesAnchorLayer: false,
      usesDividerSurface: false,
    }),
    [WORKSPACE_OBJECT_TYPES.divider]: Object.freeze({
      canExpand: false,
      isOpenable: false,
      hasExpandedFootprint: false,
      participatesInGridCollision: true,
      hasPanelContentArea: false,
      usesPanelHeader: true,
      usesAnchorLayer: false,
      usesDividerSurface: true,
    }),
  });

  const WORKSPACE_CONTEXT_MODEL_VERSION = "workspace-context-v1";

  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

  const workspaceObjectTypeFromDefinition = (definition, fallback) => {
    const rawType = definition?.workspaceObjectType || definition?.objectType || definition?.type || definition?.dashboardObjectKind || fallback;
    if (rawType === "divider" || rawType === "context-divider") return WORKSPACE_OBJECT_TYPES.divider;
    if (rawType === "panel") return WORKSPACE_OBJECT_TYPES.panel;
    return fallback || WORKSPACE_OBJECT_TYPES.widget;
  };

  const workspaceObjectType = (item) => {
    const rawType = item?.dataset?.workspaceObjectType || item?.dataset?.dashboardObjectKind || item?.dataset?.widgetType;
    if (rawType === WORKSPACE_OBJECT_TYPES.divider || rawType === "context-divider") return WORKSPACE_OBJECT_TYPES.divider;
    if (item?.classList?.contains("db-panel")) return WORKSPACE_OBJECT_TYPES.panel;
    return WORKSPACE_OBJECT_TYPES.widget;
  };

  const workspaceObjectCapabilities = (item) => (
    WORKSPACE_OBJECT_CAPABILITIES[workspaceObjectType(item)] ||
    WORKSPACE_OBJECT_CAPABILITIES[WORKSPACE_OBJECT_TYPES.widget]
  );

  const syncWorkspaceCapabilityMetadata = (item) => {
    if (!item) return;
    Object.entries(workspaceObjectCapabilities(item)).forEach(([key, value]) => {
      item.dataset[key] = String(Boolean(value));
    });
  };

  const workspaceObjectKey = (item) => item?.dataset?.widgetKey || item?.dataset?.panelKey || "";

  const workspaceRootRegionId = (layoutKey) => `${layoutKey}:region:root`;

  const workspaceRegionIdForDivider = (divider, layoutKey) => {
    const key = workspaceObjectKey(divider) || "divider";
    const existing = divider.dataset.contextScopeId || "";
    if (existing && (layoutKey === "default" || !existing.startsWith("default:region:"))) return existing;
    return `${layoutKey}:region:${key}`;
  };

  const CONTEXT_LINK_MODES = Object.freeze({
    inherit: "inherit",
    share: "share",
    override: "override",
    reference: "reference",
  });

  const contextLinkId = () => `context-link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const normalizeContextLinkMode = (mode) => (
    Object.values(CONTEXT_LINK_MODES).includes(mode) ? mode : CONTEXT_LINK_MODES.inherit
  );

  const normalizeContextLink = (link = {}) => ({
    id: String(link.id || contextLinkId()),
    sourceObjectId: String(link.sourceObjectId || link.sourceId || ""),
    targetObjectId: String(link.targetObjectId || link.targetId || ""),
    mode: normalizeContextLinkMode(link.mode),
    label: String(link.label || ""),
    enabled: link.enabled !== false,
    metadata: link.metadata && typeof link.metadata === "object" ? { ...link.metadata } : {},
  });

  const loadWorkspaceContextLinks = () => [];

  const contextElementById = (id, layoutKey = "builder") => {
    const key = String(id || "");
    if (!key) return null;
    const escaped = CSS.escape(key);
    return document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] .widget-card[data-widget-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid .widget-card[data-widget-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-panel-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-context-scope-id="${escaped}"], .panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-workspace-region-id="${escaped}"]`) ||
      null;
  };

  const ensureWorkspaceObjectMetadata = (item, metadata = {}) => {
    if (!item) return;
    const inferredType = metadata.workspaceObjectType || metadata.objectType || workspaceObjectType(item);
    item.dataset.workspaceObjectType = inferredType;
    item.dataset.workspaceContextModel = WORKSPACE_CONTEXT_MODEL_VERSION;
    if (metadata.dashboardObjectKind) item.dataset.dashboardObjectKind = metadata.dashboardObjectKind;
    if (metadata.contextScopeId) item.dataset.contextScopeId = metadata.contextScopeId;
    if (metadata.workspaceRegionId) item.dataset.workspaceRegionId = metadata.workspaceRegionId;
    if (metadata.contextRole) item.dataset.contextRole = metadata.contextRole;
    if (metadata.navigationTargetType) item.dataset.navigationTargetType = metadata.navigationTargetType;
    if (metadata.navigationTargetId) item.dataset.navigationTargetId = metadata.navigationTargetId;
    if (inferredType === WORKSPACE_OBJECT_TYPES.divider) {
      item.dataset.dashboardObjectKind = metadata.dashboardObjectKind || "divider";
      item.dataset.contextRole = metadata.contextRole || "semantic-boundary";
      item.dataset.contextScopeId = metadata.contextScopeId || workspaceRegionIdForDivider(item, groupItemLayoutKey(item));
      item.dataset.workspaceRegionId = item.dataset.contextScopeId;
    } else if (inferredType === WORKSPACE_OBJECT_TYPES.panel) {
      item.dataset.dashboardObjectKind = metadata.dashboardObjectKind || item.dataset.dashboardObjectKind || "panel";
      item.dataset.contextRole = metadata.contextRole || item.dataset.contextRole || "container";
    } else {
      item.dataset.dashboardObjectKind = metadata.dashboardObjectKind || item.dataset.dashboardObjectKind || "widget";
      item.dataset.contextRole = metadata.contextRole || item.dataset.contextRole || "content";
    }
    syncWorkspaceCapabilityMetadata(item);
  };

  const workspaceObjectPersistence = (item) => ({
    workspaceObjectType: workspaceObjectType(item),
    dashboardObjectKind: item.dataset.dashboardObjectKind || null,
    workspaceRegionId: item.dataset.workspaceRegionId || null,
    contextScopeId: item.dataset.contextScopeId || null,
    contextRole: item.dataset.contextRole || null,
    workspaceContext: workspaceContextFromElement(item),
    navigationTargetType: item.dataset.navigationTargetType || null,
    navigationTargetId: item.dataset.navigationTargetId || null,
  });

  return {
    WORKSPACE_OBJECT_TYPES,
    WORKSPACE_OBJECT_CAPABILITIES,
    WORKSPACE_CONTEXT_MODEL_VERSION,
    escapeHtml,
    workspaceObjectTypeFromDefinition,
    workspaceObjectType,
    workspaceObjectCapabilities,
    syncWorkspaceCapabilityMetadata,
    workspaceObjectKey,
    workspaceRootRegionId,
    workspaceRegionIdForDivider,
    CONTEXT_LINK_MODES,
    normalizeContextLink,
    loadWorkspaceContextLinks,
    contextElementById,
    ensureWorkspaceObjectMetadata,
    workspaceObjectPersistence,
  };
};
