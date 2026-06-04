const dashboardToolDrawerVars = [
  "--panel-lock-bg",
  "--panel-lock-fg",
  "--panel-lock-border",
  "--panel-lock-glow",
  "--panel-drawer-bg",
  "--panel-drawer-border",
  "--panel-drawer-shadow",
  "--panel-control-rest-shadow",
  "--panel-control-hover-border",
  "--panel-control-hover-shadow",
  "--panel-control-active-shadow",
  "--widget-control-bg",
  "--widget-control-hover-bg",
  "--widget-control-active-bg",
  "--widget-drawer-bg",
];

export const createDashboardToolDrawerRuntime = ({
  portalFloatingMenu,
  restoreFloatingMenu,
}) => {
  const portalDashboardToolDrawer = (drawer, trigger) => {
    if (!drawer || !trigger) return;
    const drawerStyles = window.getComputedStyle(drawer);
    dashboardToolDrawerVars.forEach((name) => {
      const value = drawerStyles.getPropertyValue(name);
      if (value) drawer.style.setProperty(name, value);
    });
    portalFloatingMenu(drawer, trigger, { skipPosition: true });
    drawer.classList.add("dashboard-tool-drawer-portaled", "dashboard-tool-drawer-open");
  };

  const restoreDashboardToolDrawer = (drawer) => {
    if (!drawer) return;
    drawer.classList.remove("dashboard-tool-drawer-portaled", "dashboard-tool-drawer-open");
    drawer.style.removeProperty("--dashboard-tool-drawer-fixed-left");
    drawer.style.removeProperty("--dashboard-tool-drawer-fixed-top");
    dashboardToolDrawerVars.forEach((name) => drawer.style.removeProperty(name));
    restoreFloatingMenu(drawer);
  };

  const positionDashboardToolDrawer = (item, settingsButton, drawer) => {
    if (!item || !settingsButton || !drawer) return;
    const settingsRect = settingsButton.getBoundingClientRect();
    const drawerWidth = drawer.offsetWidth || drawer.getBoundingClientRect().width;
    const drawerHeight = drawer.offsetHeight || drawer.getBoundingClientRect().height;
    if (!drawerWidth || !drawerHeight) return;
    const drawerStyles = window.getComputedStyle(drawer);
    const gap = parseFloat(drawerStyles.columnGap || drawerStyles.gap || "0") || 0;
    const padding = parseFloat(drawerStyles.paddingTop || "0") || 0;
    const clearance = Math.max(4, padding || gap || 4);
    const anchorGap = Math.max(4, gap || padding || 4);
    if (drawer.classList.contains("dashboard-tool-drawer-portaled")) {
      const viewportGutter = Math.max(8, clearance);
      let left = settingsRect.left - anchorGap - drawerWidth;
      let top = settingsRect.top + (settingsRect.height / 2) - (drawerHeight / 2);
      const header = item.querySelector(":scope > .db-panel-hd");
      if (header?.contains(settingsButton)) {
        const headerRect = header.getBoundingClientRect();
        top = Math.min(top, headerRect.bottom - drawerHeight - clearance);
      }
      left = Math.max(viewportGutter, Math.min(left, window.innerWidth - viewportGutter - drawerWidth));
      top = Math.max(viewportGutter, Math.min(top, window.innerHeight - viewportGutter - drawerHeight));
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-left", `${Math.round(left)}px`);
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-top", `${Math.round(top)}px`);
      return;
    }
    const anchor = drawer.offsetParent || item;
    const anchorRect = anchor.getBoundingClientRect();
    const right = Math.max(0, anchorRect.right - settingsRect.left + anchorGap);
    let top = settingsRect.top + (settingsRect.height / 2) - anchorRect.top - (drawerHeight / 2);

    const header = item.querySelector(":scope > .db-panel-hd");
    if (header?.contains(settingsButton)) {
      const headerRect = header.getBoundingClientRect();
      top = Math.min(top, headerRect.bottom - anchorRect.top - drawerHeight - clearance);
    }

    const viewportGutter = Math.max(8, clearance);
    const minTop = viewportGutter - anchorRect.top;
    const maxTop = window.innerHeight - viewportGutter - anchorRect.top - drawerHeight;
    const clampedTop = Math.max(minTop, Math.min(top, maxTop));
    drawer.style.setProperty("--dashboard-tool-drawer-top", `${Math.round(clampedTop)}px`);
    drawer.style.setProperty("--dashboard-tool-drawer-right", `${Math.round(right)}px`);
  };

  const positionDashboardToolDrawerAtPointer = (item, drawer, clientX, clientY) => {
    if (!item || !drawer || clientX == null || clientY == null) return;
    const drawerWidth = drawer.offsetWidth || drawer.getBoundingClientRect().width;
    const drawerHeight = drawer.offsetHeight || drawer.getBoundingClientRect().height;
    if (!drawerWidth || !drawerHeight) return;
    const viewportGutter = 8;
    if (drawer.classList.contains("dashboard-tool-drawer-portaled")) {
      const left = Math.max(viewportGutter, Math.min(clientX - drawerWidth, window.innerWidth - viewportGutter - drawerWidth));
      const top = Math.max(viewportGutter, Math.min(clientY, window.innerHeight - viewportGutter - drawerHeight));
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-left", `${Math.round(left)}px`);
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-top", `${Math.round(top)}px`);
      return;
    }
    const anchor = drawer.offsetParent || item;
    const anchorRect = anchor.getBoundingClientRect();
    let right = Math.max(0, anchorRect.right - clientX);
    const maxRight = Math.max(0, anchorRect.right - viewportGutter - drawerWidth);
    right = Math.min(right, maxRight);
    let top = clientY - anchorRect.top;
    const minTop = viewportGutter - anchorRect.top;
    const maxTop = window.innerHeight - viewportGutter - anchorRect.top - drawerHeight;
    top = Math.max(minTop, Math.min(top, maxTop));
    drawer.style.setProperty("--dashboard-tool-drawer-top", `${Math.round(top)}px`);
    drawer.style.setProperty("--dashboard-tool-drawer-right", `${Math.round(right)}px`);
  };

  return {
    portalDashboardToolDrawer,
    restoreDashboardToolDrawer,
    positionDashboardToolDrawer,
    positionDashboardToolDrawerAtPointer,
  };
};
