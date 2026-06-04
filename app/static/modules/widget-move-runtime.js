export const bindWidgetMoveRuntime = ({
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
  clearToolCloseTimer,
  setDragging,
  setSuppressWidgetClickUntil,
}) => {
  const beginWidgetMove = (event, options = {}) => {
    if (event.button !== 0 || (widget.classList.contains("db-panel-pinned") && !isPanelInternalGridItem(widget))) return;
    const surfaceShortcut = Boolean(options.surfaceShortcut);
    if (surfaceShortcut && !isWorkspaceSurfaceDragStart(event, widget)) return;
    const restoreToolsAfterDrag = widget.classList.contains("widget-tools-open") ||
      settings?.getAttribute("aria-expanded") === "true" ||
      drawer?.matches(":hover") ||
      isDashboardToolInteractionTarget(event);
    clearToolCloseTimer();
    if (surfaceShortcut) {
      setWidgetLinkNavigationSuspended(widget, true);
    } else {
      openTools();
    }
    runOrderedDrag({
      layout,
      item: widget,
      event,
      draggingClass: "widget-dragging",
      placeholderClass: "widget-placeholder",
      threshold: 5,
      deferStartEventHandling: surfaceShortcut,
      onCommit: () => {
        cleanupWidgetRowBreaks(layout);
        saveSharedGridLayouts(layout);
        emitWorkspaceEvent({
          type: "object-moved",
          source: "drag",
          layoutKey,
          objectId: widget.dataset.widgetKey || "",
          objectType: "widget",
          regionId: regionIdForWorkspaceItem(widget),
          panelId: widget.dataset.parentPanelKey || "",
          label: `${widget.dataset.widgetDisplayName || "Widget"} moved`,
          payload: {
            col: Number(widget.dataset.gridCol) || 0,
            row: Number(widget.dataset.gridRow) || 0,
          },
        });
      },
      onEnd: (didDrag) => {
        setDragging(false);
        if (didDrag) setSuppressWidgetClickUntil(performance.now() + 360);
        if (restoreToolsAfterDrag) {
          armToolLeaveCloseResume();
          openTools();
        } else {
          closeTools();
        }
      },
      onStart: () => {
        setDragging(true);
      },
    });
  };

  widget.__beginWidgetMoveFromDragRuntime = beginWidgetMove;
  moveHandle?.addEventListener("pointerdown", beginWidgetMove);
  widget.addEventListener("pointerdown", (event) => {
    if (!isInteractiveWidgetSurfaceTarget(event) && !event.target?.closest?.(".panel-settings-toggle, .panel-tool-button")) {
      event.preventDefault();
    }
    beginWidgetMove(event, { surfaceShortcut: true });
  });

  return { beginWidgetMove };
};
