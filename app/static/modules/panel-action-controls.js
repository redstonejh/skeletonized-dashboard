export const bindPanelActionControls = ({
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
  setSuppressToolOpenUntil,
  setSuppressHeaderToggleUntil,
  getSuppressHeaderToggleUntil,
  getMovedDuringPointer,
  setMovedDuringPointer,
  ensureRenderedGridPosition,
  beginPanelExpansionSession,
  applyPanelHeight,
  panelMinimumRows,
  applyPanelGridPosition,
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
}) => {
  pinButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setSuppressHeaderToggleUntil(0);
    const pinned = panel.classList.toggle("db-panel-pinned");
    pinButton.setAttribute("aria-pressed", pinned.toString());
    groupPeers(panel, "panel").forEach((peer) => {
      peer.classList.toggle("db-panel-pinned", pinned);
      peer.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", pinned.toString());
    });
    savePanelLayouts(layout);
    setSuppressToolOpenUntil(performance.now() + 320);
    if (panelTools?.contains(document.activeElement)) document.activeElement.blur();
    closePanelTools();
  });

  titleButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setSuppressHeaderToggleUntil(0);
    const titleEl = panel.querySelector(".db-panel-title");
    if (!titleEl) return;
    const originalTitle = panel.dataset.panelTitle || titleEl.textContent.trim();
    panel.classList.add("db-panel-title-editing");
    titleEl.contentEditable = "true";
    titleEl.spellcheck = false;
    titleEl.focus();
    window.getSelection?.()?.selectAllChildren(titleEl);

    const finishEdit = (commit) => {
      titleEl.removeEventListener("blur", onBlur);
      titleEl.removeEventListener("keydown", onKeydown);
      titleEl.contentEditable = "false";
      panel.classList.remove("db-panel-title-editing");
      if (!commit) {
        titleEl.textContent = originalTitle;
        return;
      }
      const cleanTitle = titleEl.textContent.trim().replace(/\s+/g, " ").slice(0, 36);
      if (cleanTitle) {
        panel.dataset.panelTitle = cleanTitle;
        titleEl.textContent = cleanTitle;
      } else {
        delete panel.dataset.panelTitle;
        titleEl.textContent = panel.dataset.defaultTitle || originalTitle;
      }
      savePanelLayouts(layout);
    };

    const onBlur = () => finishEdit(true);
    const onKeydown = (keyEvent) => {
      keyEvent.stopPropagation();
      if (keyEvent.key === "Enter") {
        keyEvent.preventDefault();
        finishEdit(true);
      } else if (keyEvent.key === "Escape") {
        keyEvent.preventDefault();
        finishEdit(false);
      }
    };

    titleEl.addEventListener("blur", onBlur);
    titleEl.addEventListener("keydown", onKeydown);
  });

  deleteButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const title = panel.dataset.panelTitle || panel.querySelector(".db-panel-title")?.textContent?.trim() || "this";
    const targets = [panel, ...groupPeers(panel, "panel").filter((peer) => groupItemLayout(peer) === layout)];
    requestPanelDelete({ panel, panels: targets, layout, layoutKey, title });
  });

  if (capabilities.canExpand) {
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", (!panel.classList.contains("db-panel-collapsed")).toString());
  } else {
    header.removeAttribute("role");
    header.removeAttribute("tabindex");
    header.removeAttribute("aria-expanded");
    header.removeAttribute("aria-disabled");
  }

  const togglePanel = () => {
    if (!capabilities.canExpand) return;
    if (panel.classList.contains("db-panel-title-editing")) return;
    if (getMovedDuringPointer()) {
      setMovedDuringPointer(false);
      return;
    }
    const wasCollapsed = panel.classList.contains("db-panel-collapsed");
    if (wasCollapsed) {
      ensureRenderedGridPosition(layout, panel);
      beginPanelExpansionSession(layout, panel);
    }
    const collapsed = panel.classList.toggle("db-panel-collapsed");
    if (collapsed) {
      if (panel.style.height) panel.dataset.savedHeight = String(parseFloat(panel.style.height));
      panel.dataset.gridRowSpan = "1";
      panel.style.height = "";
    } else if (panel.dataset.savedHeight) {
      applyPanelHeight(panel, panel.dataset.savedHeight);
    } else {
      panel.dataset.gridRowSpan = String(panelMinimumRows(panel));
    }
    if (panel.dataset.gridCol && panel.dataset.gridRow) applyPanelGridPosition(panel, panel.dataset.gridCol, panel.dataset.gridRow);
    animatePanelReflow(layout, () => {
      if (collapsed) {
        panel.classList.add("db-panel-collapsed");
        panel.dataset.gridRowSpan = "1";
        panel.style.height = "";
        if (panel.dataset.gridCol && panel.dataset.gridRow) applyPanelGridPosition(panel, panel.dataset.gridCol, panel.dataset.gridRow);
        relaxCollapsedExpansionDisplacement(layout, panel);
        endPanelExpansionSession(layout, panel);
      } else {
        applyVerticalPanelExpansion(layout, panel);
      }
    }, panel);
    if (capabilities.canExpand) header.setAttribute("aria-expanded", (!collapsed).toString());
    savePanelLayouts(layout);
    emitWorkspaceEvent({
      type: collapsed ? "panel-collapsed" : "panel-opened",
      source: "panel-toggle",
      layoutKey,
      objectId: panel.dataset.panelKey || "",
      objectType: workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider ? "divider" : "panel",
      regionId: regionIdForWorkspaceItem(panel),
      label: `${panel.dataset.panelTitle || panel.dataset.defaultTitle || "Panel"} ${collapsed ? "collapsed" : "opened"}`,
      payload: {
        collapsed,
        rows: Number(panel.dataset.gridRowSpan) || 0,
      },
    });
  };

  header.addEventListener("click", (event) => {
    if (event.target?.closest?.(".panel-tools")) return;
    if (performance.now() < getSuppressHeaderToggleUntil()) return;
    togglePanel();
  });

  panel.__openCustomization = (event) => {
    if (event.target?.closest?.(".panel-tools") || isInteractivePanelSurfaceTarget(event)) return;
    event.preventDefault();
    event.stopPropagation();
    releasePanelToolLeaveClose();
    if (!canOpenDashboardTools(panel)) return;
    closeInactiveDashboardTools(panel);
    openPanelTools({ clientX: event.clientX, clientY: event.clientY });
  };

  header.addEventListener("keydown", (event) => {
    if (event.target?.closest?.(".panel-tools")) return;
    if (event.target?.isContentEditable) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePanel();
  });
};
