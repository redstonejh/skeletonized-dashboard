export const createWorkspaceMinimapRuntime = ({
  isEngineerMode,
  gridHostForLayout,
  createGridMetrics,
  allCommittedWorkspaceGridItems,
  gridBoundsForItem,
  gridHeightForRows,
  deriveWorkspaceContextRegions,
  workspaceRootRegionId,
  workspaceObjectType,
  WORKSPACE_OBJECT_TYPES,
}) => {
  const clampMinimapValue = (value, min, max) => Math.max(min, Math.min(max, value));

  const createMinimapSvgElement = (name, attrs = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  const minimapLayoutGeometry = (layoutKey = "builder") => {
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]:not(.panel-internal-widget-grid)`);
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    const layout = widgetLayout || panelLayout;
    const host = document.querySelector(`.dashboard-layout-grid[data-dashboard-layout-key="${CSS.escape(layoutKey)}"]`) || gridHostForLayout(layout);
    if (!layout || !host) return null;
    const metrics = createGridMetrics(layout);
    const items = allCommittedWorkspaceGridItems(layoutKey);
    const maxBottom = Math.max(1, ...items.map((item) => gridBoundsForItem(item, metrics).bottom));
    const worldWidth = Math.max(1, metrics.width);
    const worldHeight = Math.max(
      gridHeightForRows(maxBottom, metrics.gap, metrics.rowHeight),
      window.innerHeight,
      host.getBoundingClientRect().height || 1
    );
    return { layout, host, metrics, items, worldWidth, worldHeight };
  };

  const renderWorkspaceMinimap = (layer) => {
    if (!layer) return;
    const layoutKey = layer.dataset.minimapLayoutKey || "builder";
    const svg = layer.querySelector(".workspace-minimap-svg");
    if (!svg) return;
    layer.classList.toggle("workspace-minimap-engineer-visible", isEngineerMode());
    if (!isEngineerMode()) return;
    const geometry = minimapLayoutGeometry(layoutKey);
    svg.replaceChildren();
    if (!geometry) return;
    const mapWidth = 160;
    const mapHeight = 240;
    const { metrics, items, worldWidth, worldHeight, host } = geometry;
    const scaleX = mapWidth / worldWidth;
    const scaleY = mapHeight / worldHeight;
    const addRect = (attrs) => svg.appendChild(createMinimapSvgElement("rect", attrs));

    deriveWorkspaceContextRegions(layoutKey).forEach((region, index) => {
      if (region.endRow === null && index > 0) return;
      const start = Math.max(0, ((Number(region.startRow) || 1) - 1) * metrics.rowStep);
      const end = region.endRow === null
        ? worldHeight
        : Math.max(start + metrics.rowHeight, (Number(region.endRow) || Number(region.startRow) || 1) * metrics.rowStep);
      addRect({
        class: `workspace-minimap-region ${region.id === workspaceRootRegionId(layoutKey) ? "workspace-minimap-region-root" : ""}`,
        x: 0,
        y: clampMinimapValue(start * scaleY, 0, mapHeight),
        width: mapWidth,
        height: clampMinimapValue((end - start) * scaleY, 1, mapHeight),
      });
    });

    items.forEach((item) => {
      const bounds = gridBoundsForItem(item, metrics);
      const type = workspaceObjectType(item);
      const left = (bounds.col - 1) * metrics.columnStep;
      const top = (bounds.row - 1) * metrics.rowStep;
      const width = (bounds.span * metrics.columnWidth) + (Math.max(0, bounds.span - 1) * metrics.gap);
      const height = (bounds.rowSpan * metrics.rowHeight) + (Math.max(0, bounds.rowSpan - 1) * metrics.gap);
      addRect({
        class: `workspace-minimap-object workspace-minimap-object-${type}`,
        x: clampMinimapValue(left * scaleX, 1, mapWidth - 2),
        y: clampMinimapValue(top * scaleY, 1, mapHeight - 2),
        width: clampMinimapValue(width * scaleX, type === WORKSPACE_OBJECT_TYPES.divider ? 2 : 3, mapWidth),
        height: clampMinimapValue(height * scaleY, type === WORKSPACE_OBJECT_TYPES.divider ? 2 : 3, mapHeight),
        rx: type === WORKSPACE_OBJECT_TYPES.divider ? 1 : 2,
      });
    });

    const hostTop = host.getBoundingClientRect().top + window.scrollY;
    const navBottom = document.querySelector(".app-nav")?.getBoundingClientRect().bottom || 0;
    const visibleTop = Math.max(0, window.scrollY + navBottom + 8 - hostTop);
    const visibleBottom = Math.max(visibleTop + 1, window.scrollY + window.innerHeight - hostTop);
    addRect({
      class: "workspace-minimap-viewport",
      x: 1,
      y: clampMinimapValue(visibleTop * scaleY, 1, mapHeight - 4),
      width: mapWidth - 2,
      height: clampMinimapValue((visibleBottom - visibleTop) * scaleY, 8, mapHeight),
      rx: 3,
    });
    layer.dataset.minimapWorldHeight = String(worldHeight);
  };

  const refreshWorkspaceMiniMaps = (layoutKey = null) => {
    const selector = layoutKey
      ? `.workspace-minimap-layer[data-minimap-layout-key="${CSS.escape(layoutKey)}"]`
      : ".workspace-minimap-layer";
    document.querySelectorAll(selector).forEach((layer) => {
      window.cancelAnimationFrame(layer.__minimapFrame || 0);
      layer.__minimapFrame = window.requestAnimationFrame(() => renderWorkspaceMinimap(layer));
    });
  };

  const setWorkspaceMinimapCollapsed = (layer, collapsed) => {
    if (!layer) return;
    layer.classList.toggle("workspace-minimap-collapsed", Boolean(collapsed));
    layer.querySelector(".workspace-minimap-toggle")?.setAttribute("aria-pressed", (!collapsed).toString());
    try {
      localStorage.setItem(`dashboard-minimap-collapsed:${layer.dataset.minimapLayoutKey || "builder"}`, collapsed ? "1" : "0");
    } catch {}
    refreshWorkspaceMiniMaps(layer.dataset.minimapLayoutKey || "builder");
  };

  const initWorkspaceMinimapLayer = (layer) => {
    if (!layer || layer.dataset.minimapInitialized === "true") return;
    layer.dataset.minimapInitialized = "true";
    const layoutKey = layer.dataset.minimapLayoutKey || "builder";
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(`dashboard-minimap-collapsed:${layoutKey}`) === "1";
    } catch {}
    setWorkspaceMinimapCollapsed(layer, collapsed);
    layer.querySelector(".workspace-minimap-collapse")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setWorkspaceMinimapCollapsed(layer, true);
    });
    layer.querySelector(".workspace-minimap-toggle")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setWorkspaceMinimapCollapsed(layer, false);
    });
    layer.querySelector(".workspace-minimap-svg")?.addEventListener("click", (event) => {
      if (!isEngineerMode()) return;
      event.preventDefault();
      event.stopPropagation();
      const geometry = minimapLayoutGeometry(layoutKey);
      if (!geometry) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const y = clampMinimapValue(event.clientY - rect.top, 0, rect.height);
      const worldY = (y / Math.max(rect.height, 1)) * geometry.worldHeight;
      const hostTop = geometry.host.getBoundingClientRect().top + window.scrollY;
      const navBottom = document.querySelector(".app-nav")?.getBoundingClientRect().bottom || 0;
      const targetTop = Math.max(0, hostTop + worldY - navBottom - 16);
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      window.scrollTo({ top: targetTop, behavior: reducedMotion ? "auto" : "smooth" });
    });
    const observer = new MutationObserver(() => refreshWorkspaceMiniMaps(layoutKey));
    const dashboard = document.querySelector(`.dashboard-layout-grid[data-dashboard-layout-key="${CSS.escape(layoutKey)}"]`);
    if (dashboard) observer.observe(dashboard, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "data-grid-col", "data-grid-row", "data-current-span", "data-grid-row-span", "hidden"] });
    layer.__minimapObserver = observer;
    refreshWorkspaceMiniMaps(layoutKey);
  };

  return {
    refreshWorkspaceMiniMaps,
    initWorkspaceMinimapLayer,
  };
};
