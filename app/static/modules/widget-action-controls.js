export const bindWidgetActionControls = ({
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
  setSuppressToolOpenUntil,
}) => {
  pinButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pinned = widget.classList.toggle("db-panel-pinned");
    pinButton.setAttribute("aria-pressed", pinned.toString());
    groupPeers(widget, "widget").forEach((peer) => {
      peer.classList.toggle("db-panel-pinned", pinned);
      peer.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", pinned.toString());
    });
    saveWidgetLayouts(layout);
    setSuppressToolOpenUntil(performance.now() + 320);
    if (tools?.contains(document.activeElement)) document.activeElement.blur();
    closeTools();
  });

  titleButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const label = widget.querySelector(".stat-lbl");
    if (!label) return;
    const original = label.textContent.trim();
    label.contentEditable = "true";
    label.focus();
    window.getSelection?.()?.selectAllChildren(label);
    const finish = (commit) => {
      label.contentEditable = "false";
      label.removeEventListener("blur", onBlur);
      label.removeEventListener("keydown", onKeydown);
      const clean = commit ? label.textContent.trim().replace(/\s+/g, " ").slice(0, 36) : original;
      label.textContent = clean || original;
      widget.dataset.panelTitle = label.textContent;
      saveWidgetLayouts(layout);
    };
    const onBlur = () => finish(true);
    const onKeydown = (keyEvent) => {
      keyEvent.stopPropagation();
      if (keyEvent.key === "Enter") {
        keyEvent.preventDefault();
        finish(true);
      } else if (keyEvent.key === "Escape") {
        keyEvent.preventDefault();
        finish(false);
      }
    };
    label.addEventListener("blur", onBlur);
    label.addEventListener("keydown", onKeydown);
  });

  deleteButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const targets = [widget, ...groupPeers(widget, "widget").filter((peer) => groupItemLayout(peer) === layout)];
    const title = widget.querySelector(".widget-title")?.textContent?.trim() || widget.dataset.panelTitle || "Widget";
    requestWidgetDelete({ widget, widgets: targets, layout, layoutKey, title });
  });
};
