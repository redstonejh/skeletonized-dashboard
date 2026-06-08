export function initializeSurfaceToolsRuntime({
  dashboardInteractionState,
  restoreDashboardToolDrawer,
  restoreFloatingMenu,
  resizeEdgeFromPointer,
  setWidgetLinkNavigationSuspended,
}) {
  const syncLayoutToolsActive = () => {
    const hasOpenTools = Boolean(document.querySelector(".db-panel-tools-open, .widget-tools-open, .widget-workbench-open"));
    document.body.classList.toggle("layout-tools-active", hasOpenTools);
  };
  const isDashboardInteractionActive = () => dashboardInteractionState.isInteractionActive(document.body);
  const isInteractionSource = (item) => Boolean(item?.classList?.contains("widget-dragging") ||
    item?.classList?.contains("db-panel-dragging") ||
    item?.classList?.contains("dashboard-active-resize"));
  const surfaceResponseSelector = [
    ".widget-layout > .widget-card",
    ".panel-internal-widget-grid > .widget-card",
    ".panel-layout > .db-panel:not(.workspace-divider)",
  ].join(", ");
  const surfaceResponseControlSelector = [
    ".app-nav",
    ".panel-tools",
    ".widget-tools",
    ".panel-settings-toggle",
    ".panel-tool-button",
    ".panel-tool-drawer",
    ".panel-color-menu",
    ".widget-workbench-panel",
    ".panel-add-menu",
    ".background-tone-popover",
    ".workspace-minimap-layer",
    "[data-widget-control-surface='true']",
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
  ].join(", ");
  const isWorkspaceSurfaceDragStart = (event, item) => {
    if (!event || !item || event.button !== 0) return false;
    if (isDashboardInteractionActive() || isInteractionSource(item)) return false;
    const controlTarget = event.target?.closest?.(surfaceResponseControlSelector);
    if (controlTarget && controlTarget !== item) return false;
    if (item.classList?.contains("db-panel")) {
      if (event.target?.closest?.(".panel-internal-widget-grid > .widget-card")) return false;
      if (typeof resizeEdgeFromPointer === "function" && resizeEdgeFromPointer(event, item)) return false;
    }
    return true;
  };
  const isWorkspaceObjectInteractiveSurfaceTarget = (event) => {
    return Boolean(
      event?.target?.closest?.(
        `${surfaceResponseControlSelector}, .media-widget-stage`,
      ),
    );
  };
  const surfaceResponseState = dashboardInteractionState.createSurfaceResponseState(window);
  const clearSurfaceResponse = (target = surfaceResponseState.target) => {
    if (!target) return;
    target.classList.remove("surface-response-active");
    target.removeAttribute("data-surface-pressed");
    dashboardInteractionState.clearHoverSuppression("surface-response");
    if (surfaceResponseState.target === target) {
      surfaceResponseState.target = null;
      surfaceResponseState.rect = null;
    }
  };
  const surfaceResponseTargetFromEvent = (event) => {
    if (isDashboardInteractionActive()) return null;
    const target = event.target?.closest?.(surfaceResponseSelector);
    if (!target || !target.isConnected) return null;
    const controlTarget = event.target?.closest?.(surfaceResponseControlSelector);
    if (controlTarget && controlTarget !== target) return null;
    if (
      target.classList.contains("widget-placeholder") ||
      target.classList.contains("db-panel-placeholder") ||
      target.classList.contains("dashboard-live-resize") ||
      target.classList.contains("dashboard-resize-preview") ||
      target.classList.contains("dashboard-active-resize") ||
      target.classList.contains("dashboard-resize-source") ||
      target.classList.contains("widget-dragging") ||
      target.classList.contains("db-panel-dragging") ||
      target.classList.contains("dashboard-group-boundary") ||
      target.classList.contains("dashboard-group-member-preview")
    ) return null;
    return target;
  };
  const updateSurfaceResponse = () => {
    surfaceResponseState.frame = 0;
    const target = surfaceResponseState.target;
    if (!target || !target.isConnected || isDashboardInteractionActive()) {
      clearSurfaceResponse(target);
      return;
    }
    const currentScrollX = window.scrollX || 0;
    const currentScrollY = window.scrollY || 0;
    if (
      !surfaceResponseState.rect ||
      surfaceResponseState.scrollX !== currentScrollX ||
      surfaceResponseState.scrollY !== currentScrollY
    ) {
      surfaceResponseState.rect = target.getBoundingClientRect();
      surfaceResponseState.scrollX = currentScrollX;
      surfaceResponseState.scrollY = currentScrollY;
    }
    const rect = surfaceResponseState.rect;
    if (!rect?.width || !rect?.height) {
      clearSurfaceResponse(target);
      return;
    }
    target.classList.add("surface-response-active");
    dashboardInteractionState.setHoverSuppression("surface-response", target);
  };
  const scheduleSurfaceResponse = (event) => {
    const target = surfaceResponseTargetFromEvent(event);
    if ((event.buttons || 0) === 0) {
      document.querySelectorAll("[data-surface-pressed='true']").forEach((pressedTarget) => pressedTarget.removeAttribute("data-surface-pressed"));
    }
    if (target !== surfaceResponseState.target) {
      clearSurfaceResponse();
      surfaceResponseState.target = target;
      surfaceResponseState.rect = target?.getBoundingClientRect?.() || null;
      surfaceResponseState.scrollX = window.scrollX || 0;
      surfaceResponseState.scrollY = window.scrollY || 0;
    }
    if (!target) return;
    surfaceResponseState.clientX = event.clientX;
    surfaceResponseState.clientY = event.clientY;
    if (!surfaceResponseState.frame) {
      surfaceResponseState.frame = requestAnimationFrame(updateSurfaceResponse);
    }
  };
  document.addEventListener("pointermove", scheduleSurfaceResponse, { passive: true });
  document.addEventListener("pointerleave", () => clearSurfaceResponse(), { passive: true });
  document.addEventListener("pointerdown", (event) => {
    const target = surfaceResponseTargetFromEvent(event);
    if (!target || isDashboardInteractionActive()) {
      clearSurfaceResponse();
      return;
    }
    if (target !== surfaceResponseState.target) {
      clearSurfaceResponse();
      surfaceResponseState.target = target;
      surfaceResponseState.rect = target.getBoundingClientRect();
      surfaceResponseState.scrollX = window.scrollX || 0;
      surfaceResponseState.scrollY = window.scrollY || 0;
    }
    surfaceResponseState.clientX = event.clientX;
    surfaceResponseState.clientY = event.clientY;
    target.dataset.surfacePressed = "true";
    target.classList.add("surface-response-active");
  }, true);
  const clearSurfacePress = () => {
    document.querySelectorAll("[data-surface-pressed='true']").forEach((target) => target.removeAttribute("data-surface-pressed"));
  };
  document.addEventListener("pointerup", clearSurfacePress, true);
  document.addEventListener("pointercancel", clearSurfacePress, true);
  window.addEventListener("scroll", () => {
    if (!surfaceResponseState.target) return;
    surfaceResponseState.rect = null;
    if (!surfaceResponseState.frame) {
      surfaceResponseState.frame = requestAnimationFrame(updateSurfaceResponse);
    }
  }, { passive: true });
  const canOpenDashboardTools = (item) => !isDashboardInteractionActive() || isInteractionSource(item);
  const dashboardSettingsToggleForItem = (item) => {
    if (item?.classList?.contains("db-panel")) return item.querySelector(":scope > .db-panel-hd .panel-settings-toggle");
    if (item?.classList?.contains("widget-card")) return item.querySelector(":scope > .widget-tools .panel-settings-toggle");
    return item?.querySelector?.(".panel-settings-toggle") || null;
  };
  const dashboardColorToggleForItem = (item) => {
    if (item?.classList?.contains("db-panel")) return item.querySelector(":scope > .db-panel-hd .panel-color-toggle");
    if (item?.classList?.contains("widget-card")) return item.querySelector(":scope > .widget-tools .panel-color-toggle");
    return item?.querySelector?.(".panel-color-toggle") || null;
  };
  const closeInactiveDashboardTools = (activeItem = null) => {
    document.querySelectorAll(".widget-tools-open, .widget-workbench-open, .db-panel-tools-open").forEach((item) => {
      if (item === activeItem) return;
      item.classList.remove("widget-tools-open", "widget-workbench-open", "db-panel-tools-open");
      restoreDashboardToolDrawer(item.__dashboardToolDrawer);
      dashboardSettingsToggleForItem(item)?.setAttribute("aria-expanded", "false");
      dashboardColorToggleForItem(item)?.setAttribute("aria-expanded", "false");
      if (item.__widgetWorkbenchPanel) {
        restoreFloatingMenu(item.__widgetWorkbenchPanel);
        item.__widgetWorkbenchPanel.setAttribute("hidden", "");
      }
      setWidgetLinkNavigationSuspended(item, false);
    });
    document.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
    syncLayoutToolsActive();
  };
  const isDashboardToolInteractionTarget = (event) =>
    Boolean(event?.target?.closest?.(".panel-tool-drawer, .panel-settings-toggle, .widget-workbench-panel"));
  document.addEventListener("pointerdown", (event) => {
    if (isDashboardInteractionActive()) return;
    if (event.target?.closest?.(".panel-tool-drawer, .panel-settings-toggle, .panel-color-menu, .widget-workbench-panel")) return;
    closeInactiveDashboardTools();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!document.querySelector(".widget-tools-open, .widget-workbench-open, .db-panel-tools-open")) return;
    if (event.target?.closest?.(".panel-tool-drawer, .widget-workbench-panel, .panel-color-menu")) return;
    closeInactiveDashboardTools();
  }, true);
  return {
    syncLayoutToolsActive,
    isDashboardInteractionActive,
    isInteractionSource,
    surfaceResponseSelector,
    surfaceResponseControlSelector,
    isWorkspaceSurfaceDragStart,
    isWorkspaceObjectInteractiveSurfaceTarget,
    clearSurfaceResponse,
    canOpenDashboardTools,
    dashboardSettingsToggleForItem,
    dashboardColorToggleForItem,
    closeInactiveDashboardTools,
    isDashboardToolInteractionTarget,
  };
}
