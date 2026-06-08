import { bindPanelActionControls } from "./panel-action-controls.js";
import { hydratePanelLayout } from "./panel-layout-hydration.js";
import { bindPanelMoveRuntime } from "./panel-move-runtime.js";
import { bindPanelResizeRuntime } from "./panel-resize-runtime.js";
import { createPanelToolSession } from "./interaction-state.js";

export const createPanelLayoutRuntime = ({
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
}) => {
  const initPanelLayouts = () => {
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
        WORKSPACE_OBJECT_TYPES,
        applyPanelSpan: panelRuntime.applyPanelSpan,
        applyPanelGridPosition: panelRuntime.applyPanelGridPosition,
        applyPanelHeight: panelRuntime.applyPanelHeight,
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
        const colorMenu = buildPanelColorMenu(panel, layout, colorToggle);
        pinButton?.setAttribute("aria-pressed", panel.classList.contains("db-panel-pinned").toString());
        const panelToolSession = createPanelToolSession();
        let releasePanelToolLeaveCloseResume = null;
        const releasePanelToolLeaveClose = (event = null) => {
          const closeRestoredTools = (event?.type === "pointerdown" || event?.type === "pointermove") &&
            !panelTools?.contains(event.target) &&
            !panelToolDrawer?.contains(event.target) &&
            !colorMenu?.contains(event.target);
          panelToolSession.setIgnoreToolLeaveCloseUntilPointerActivity(false);
          if (!releasePanelToolLeaveCloseResume) return;
          document.removeEventListener("pointermove", releasePanelToolLeaveCloseResume, true);
          document.removeEventListener("pointerdown", releasePanelToolLeaveCloseResume, true);
          releasePanelToolLeaveCloseResume = null;
          if (closeRestoredTools) closePanelTools();
        };
        const armPanelToolLeaveCloseResume = () => {
          releasePanelToolLeaveClose();
          panelToolSession.setIgnoreToolLeaveCloseUntilPointerActivity(true);
          releasePanelToolLeaveCloseResume = releasePanelToolLeaveClose;
          document.addEventListener("pointermove", releasePanelToolLeaveCloseResume, { capture: true, once: true });
          document.addEventListener("pointerdown", releasePanelToolLeaveCloseResume, { capture: true, once: true });
        };
        const openPanelTools = (pointerCoords = null) => {
          if (performance.now() < panelToolSession.getSuppressToolOpenUntil()) return;
          if (!canOpenDashboardTools(panel)) return;
          panelToolSession.clearToolsCloseTimer();
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
          panelToolSession.setToolsOpenedByApproach(false);
          if (panelTools?.contains(document.activeElement)) document.activeElement?.blur?.();
          panel.classList.remove("db-panel-tools-open");
          settingsButton?.setAttribute("aria-expanded", "false");
          colorMenu?.__closePanelColorMenu?.();
          restoreDashboardToolDrawer(panelToolDrawer);
          syncLayoutToolsActive();
        };

        const scheduleClosePanelTools = () => {
          panelToolSession.clearToolsCloseTimer();
          if (isDashboardInteractionActive() || panelToolSession.isToolPointerCaptured() || panelToolSession.isIgnoringToolLeaveCloseUntilPointerActivity()) return;
          panelToolSession.setToolsCloseTimer(window.setTimeout(() => {
            if (isDashboardInteractionActive()) return;
            if (panelToolSession.isToolPointerCaptured()) return;
            if (panelToolSession.isIgnoringToolLeaveCloseUntilPointerActivity()) return;
            const activeElement = document.activeElement;
            const stillUsingTools =
              settingsButton?.matches(":hover") ||
              panelToolDrawer?.matches(":hover") ||
              colorMenu?.matches(":hover") ||
              panelToolDrawer?.contains(activeElement) ||
              (panelTools?.contains(activeElement) && activeElement !== colorToggle);
            if (!stillUsingTools) closePanelTools();
          }, 300));
        };
        const resumePanelToolHoverClose = () => {
          releasePanelToolLeaveClose();
          if (panel.classList.contains("db-panel-tools-open")) panelToolSession.clearToolsCloseTimer();
        };

        panelTools?.addEventListener("click", (event) => event.stopPropagation());
        panelTools?.addEventListener("keydown", (event) => event.stopPropagation());
        panelTools?.addEventListener("mouseleave", scheduleClosePanelTools);
        panelTools?.addEventListener("focusout", scheduleClosePanelTools);
        settingsButton?.addEventListener("mouseleave", scheduleClosePanelTools);
        panelToolDrawer?.addEventListener("mouseenter", resumePanelToolHoverClose);
        panelToolDrawer?.addEventListener("mouseleave", scheduleClosePanelTools);
        colorMenu?.addEventListener("mouseenter", resumePanelToolHoverClose);
        colorMenu?.addEventListener("mouseleave", () => {
          if (isDashboardInteractionActive()) return;
          if (!panelToolSession.isToolPointerCaptured()) closePanelTools();
        });
        const isInteractivePanelSurfaceTarget = (event) => {
          if (event?.target?.closest?.(".panel-internal-widget-grid > .widget-card")) return true;
          const interactiveTarget = event?.target?.closest?.(`${surfaceResponseControlSelector}, [contenteditable='true']`);
          return interactiveTarget && panel.contains(interactiveTarget);
        };

        settingsButton?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          panelToolSession.setSuppressHeaderToggleUntil(0);
          releasePanelToolLeaveClose();
          panelToolSession.setToolsOpenedByApproach(false);
        });

        colorToggle?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          panelToolSession.setSuppressHeaderToggleUntil(0);
          const nextOpen = !colorMenu?.classList.contains("panel-color-menu-open");
          if (nextOpen) {
            colorMenu?.__openPanelColorMenu?.(colorToggle);
          } else {
            colorMenu?.__closePanelColorMenu?.();
          }
        });

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
          setSuppressToolOpenUntil: panelToolSession.setSuppressToolOpenUntil,
          setSuppressHeaderToggleUntil: panelToolSession.setSuppressHeaderToggleUntil,
          getSuppressHeaderToggleUntil: panelToolSession.getSuppressHeaderToggleUntil,
          getMovedDuringPointer: panelToolSession.getMovedDuringPointer,
          setMovedDuringPointer: panelToolSession.setMovedDuringPointer,
          ensureRenderedGridPosition,
          beginPanelExpansionSession,
          applyPanelHeight: panelRuntime.applyPanelHeight,
          panelMinimumRows,
          applyPanelGridPosition: panelRuntime.applyPanelGridPosition,
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
          clearToolsCloseTimer: panelToolSession.clearToolsCloseTimer,
          setToolPointerCapture: panelToolSession.setToolPointerCapture,
          setMovedDuringPointer: panelToolSession.setMovedDuringPointer,
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
          getPanelMinimumHeight: panelRuntime.getPanelMinimumHeight,
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
          applyPanelSpan: panelRuntime.applyPanelSpan,
          applyPanelGridPosition: panelRuntime.applyPanelGridPosition,
          applyPanelHeight: panelRuntime.applyPanelHeight,
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
          clearToolsCloseTimer: panelToolSession.clearToolsCloseTimer,
          setToolPointerCapture: panelToolSession.setToolPointerCapture,
        });
      };

      panels.forEach(initPanel);
      layout.__initPanel = initPanel;
    });
  };

  return Object.freeze({
    initPanelLayouts,
  });
};
