export function createPanelLayoutSaveRuntime(deps) {
  const {
    getActivePanelProfile,
    syncWorkspaceRegions,
    pushLiveLayoutUndo,
    captureLayoutUndo,
    expansionBaselineSnapshotForLayoutKey,
    serializableExpansionBaselineState,
    gridItemRowSpan,
    writeJsonStore,
    panelStorageKey,
    serializePanelChildWidgets,
    workspaceObjectPersistence,
    customPanelsKey,
    writeRawStore,
    hiddenPanelsKey,
  } = deps;

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

  return { savePanelLayouts };
}
