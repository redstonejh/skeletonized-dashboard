export const bindPanelChildHoverRuntime = ({
  panel,
  internalWidgetGrid,
  isDashboardInteractionActive,
  surfaceResponseState,
  updateSurfaceResponse,
}) => {
  if (!internalWidgetGrid || panel.__panelChildHoverOwnershipBound) return;
  panel.__panelChildHoverOwnershipBound = true;
  const childWidgetFromEvent = (event) => {
    const child = event.target?.closest?.(".panel-internal-widget-grid > .widget-card");
    return child && internalWidgetGrid.contains(child) ? child : null;
  };
  internalWidgetGrid.addEventListener("pointerover", (event) => {
    if (childWidgetFromEvent(event)) panel.classList.add("panel-child-hover-active");
  });
  internalWidgetGrid.addEventListener("pointerout", (event) => {
    const relatedChild = event.relatedTarget?.closest?.(".panel-internal-widget-grid > .widget-card");
    if (relatedChild && internalWidgetGrid.contains(relatedChild)) return;
    panel.classList.remove("panel-child-hover-active");
    if (event.relatedTarget && panel.contains(event.relatedTarget) && !isDashboardInteractionActive()) {
      surfaceResponseState.target = panel;
      surfaceResponseState.rect = panel.getBoundingClientRect();
      surfaceResponseState.clientX = event.clientX;
      surfaceResponseState.clientY = event.clientY;
      surfaceResponseState.scrollX = window.scrollX || 0;
      surfaceResponseState.scrollY = window.scrollY || 0;
      if (!surfaceResponseState.frame) {
        surfaceResponseState.frame = requestAnimationFrame(updateSurfaceResponse);
      }
    }
  });
  panel.addEventListener("pointerleave", () => {
    panel.classList.remove("panel-child-hover-active");
  });
};
