import { createWidgetToolSession } from "./interaction-state.js";
import { hydrateWidgetLayout } from "./widget-layout-hydration.js";
import { bindWidgetActionControls } from "./widget-action-controls.js";
import { bindWidgetMoveRuntime } from "./widget-move-runtime.js";
import { bindWidgetResizeRuntime } from "./widget-resize-runtime.js";

export const createWidgetLayoutRuntime = (deps) => {
  const {
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
  } = deps;

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
      ensureWidgetTools: widgetRuntimeController.ensureTools,
      markLoadedExpansionBaseline,
      ensureWorkspaceObjectMetadata,
      workspaceObjectType,
      applyWorkspaceContextToElement,
      applyWidgetSpan: widgetRuntimeController.applySpan,
      applyWidgetGridPosition: widgetRuntimeController.applyGridPosition,
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
      widgetRuntimeController.ensureTools(widget);
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
      const widgetToolSession = createWidgetToolSession();
      let dragging = false;
      let releaseToolLeaveCloseResume = null;
      const releaseToolLeaveClose = (event = null) => {
        const closeRestoredTools = (event?.type === "pointerdown" || event?.type === "pointermove") &&
          !tools?.contains(event.target) &&
          !drawer?.contains(event.target) &&
          !colorMenu?.contains(event.target);
        widgetToolSession.setIgnoreToolLeaveCloseUntilPointerActivity(false);
        if (!releaseToolLeaveCloseResume) return;
        document.removeEventListener("pointermove", releaseToolLeaveCloseResume, true);
        document.removeEventListener("pointerdown", releaseToolLeaveCloseResume, true);
        releaseToolLeaveCloseResume = null;
        if (closeRestoredTools) closeTools();
      };
      const armToolLeaveCloseResume = () => {
        releaseToolLeaveClose();
        widgetToolSession.setIgnoreToolLeaveCloseUntilPointerActivity(true);
        releaseToolLeaveCloseResume = releaseToolLeaveClose;
        document.addEventListener("pointermove", releaseToolLeaveCloseResume, { capture: true, once: true });
        document.addEventListener("pointerdown", releaseToolLeaveCloseResume, { capture: true, once: true });
      };
      const openTools = (pointerCoords = null) => {
        if (performance.now() < widgetToolSession.getSuppressToolOpenUntil()) return;
        if (!canOpenDashboardTools(widget)) return;
        widgetToolSession.clearCloseTimer();
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
        widgetToolSession.setToolsOpenedByApproach(false);
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
        widgetToolSession.clearCloseTimer();
        widget.classList.remove("widget-tools-open");
        settings?.setAttribute("aria-expanded", "false");
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        setWidgetLinkNavigationSuspended(widget, true);
        widget.classList.add("widget-workbench-open");
        const panel = ensureWidgetWorkbenchPanel(widget);
        if (panel) {
          const widgetStyle = getComputedStyle(widget);
          [
            "--panel-accent",
            "--panel-accent-rgb",
            "--panel-accent-text",
            "--panel-lock-fg",
            "--panel-drawer-bg",
            "--widget-drawer-bg",
            "--panel-drawer-border",
            "--panel-drawer-shadow",
          ].forEach((name) => {
            const value = widgetStyle.getPropertyValue(name);
            if (value) panel.style.setProperty(name, value);
          });
          panel.dataset.panelColor = widget.dataset.panelColor || "";
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
        widgetToolSession.setToolsOpenedByApproach(false);
        widgetToolSession.setSuppressToolOpenUntil(0);
        closeInactiveDashboardTools(widget);
        openTools(pointerCoords);
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
      };
      const scheduleClose = () => {
        widgetToolSession.clearCloseTimer();
        if (isDashboardInteractionActive() || widgetToolSession.isIgnoringToolLeaveCloseUntilPointerActivity()) return;
        widgetToolSession.setCloseTimer(window.setTimeout(() => {
          if (isDashboardInteractionActive()) return;
          if (widgetToolSession.isIgnoringToolLeaveCloseUntilPointerActivity()) return;
          const activeElement = document.activeElement;
          if (
            !tools?.matches(":hover") &&
            !drawer?.matches(":hover") &&
            !drawer?.contains(activeElement) &&
            !colorMenu?.matches(":hover")
          ) closeTools();
        }, 260));
      };
      const resumeToolHoverClose = () => {
        releaseToolLeaveClose();
        if (widget.classList.contains("widget-tools-open")) widgetToolSession.clearCloseTimer();
      };
      tools?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      const isInteractiveWidgetSurfaceTarget = (event) => {
        const interactiveTarget = event.target?.closest?.(
          `${surfaceResponseControlSelector}, .media-widget-stage, [contenteditable='true']`,
        );
        return interactiveTarget && interactiveTarget !== widget && widget.contains(interactiveTarget);
      };
      widget.addEventListener("click", (event) => {
        if (event.target?.closest?.(".widget-tools")) return;
        if (isInteractiveWidgetSurfaceTarget(event)) return;
        try {
          widget.focus?.({ preventScroll: true });
        } catch {
          widget.focus?.();
        }
      }, true);
      widget.__openCustomization = (event) => {
        if (event.target?.closest?.(".widget-tools")) return;
        if (event.type !== "contextmenu" && isInteractiveWidgetSurfaceTarget(event)) return;
        event.preventDefault();
        event.stopPropagation();
        toggleAppearanceSettings({ clientX: event.clientX, clientY: event.clientY });
      };
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
      });
      settings?.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
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
        setSuppressToolOpenUntil: widgetToolSession.setSuppressToolOpenUntil,
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
        clearToolCloseTimer: widgetToolSession.clearCloseTimer,
        setDragging: (value) => {
          dragging = value;
          if (value) widgetToolSession.clearCloseTimer();
        },
        setSuppressWidgetClickUntil: widgetToolSession.setSuppressWidgetClickUntil,
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
        applyWidgetSpan: widgetRuntimeController.applySpan,
        applyWidgetGridPosition: widgetRuntimeController.applyGridPosition,
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
        clearCloseTimer: widgetToolSession.clearCloseTimer,
        setSuppressWidgetClickUntil: widgetToolSession.setSuppressWidgetClickUntil,
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

  return { initWidgetLayout };
};
