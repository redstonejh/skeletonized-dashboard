export const initializeGroupSelectionControls = ({
  getGroupMode,
  setGroupMode,
  toggleGroupItem,
  showToast,
}) => {
  document.querySelectorAll(".layout-group-button").forEach((button) => {
    button.addEventListener("click", () => {
      setGroupMode(!getGroupMode());
      showToast(getGroupMode() ? "Select mode enabled." : "Selection cleared.");
    });
  });

  document.addEventListener("click", (event) => {
    if (!getGroupMode() || event.button !== 0) return;
    if (event.target?.closest?.(".app-nav, .workspace-menu-overlay-layer, .panel-tools, .widget-tools, .panel-color-menu, .panel-add-menu, .layout-slot-menu, .nav-status-popover")) return;
    const item = event.target?.closest?.(".widget-layout > .widget-card, .panel-layout > .db-panel");
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    toggleGroupItem(item);
  }, true);
};
