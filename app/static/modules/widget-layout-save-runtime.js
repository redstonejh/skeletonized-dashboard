export function createWidgetLayoutSaveRuntime(deps) {
  const {
    getActivePanelProfile,
    isPanelInternalWidgetLayout,
    panelForInternalWidgetLayout,
    syncOpenPanelHeightToInternalGrid,
    updatePanelChildEmptyState,
    savePanelLayouts,
    syncWorkspaceRegions,
    pushLiveLayoutUndo,
    captureLayoutUndo,
    expansionBaselineSnapshotForLayoutKey,
    serializableExpansionBaselineState,
    writeJsonStore,
    widgetStorageKey,
    widgetLayerForElement,
    widgetHasRowBreakBefore,
    widgetSpacerSiblingsBefore,
    workspaceObjectPersistence,
    customWidgetsKey,
    writeRawStore,
    hiddenWidgetsKey,
  } = deps;

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

  return { saveWidgetLayouts };
}
