import { clampViewportCoord, clampViewportTop, objectMenuAnchorRect } from "./object-menu-positioning.js";

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

  const drawerDimensions = (drawer) => ({
    width: drawer.offsetWidth || drawer.getBoundingClientRect().width,
    height: drawer.offsetHeight || drawer.getBoundingClientRect().height,
  });

  const positionDashboardToolDrawer = (item, settingsButton, drawer) => {
    if (!item || !drawer) return false;
    const itemRect = objectMenuAnchorRect(item);
    if (!itemRect) return false;
    const { width: drawerWidth, height: drawerHeight } = drawerDimensions(drawer);
    if (!drawerWidth || !drawerHeight) return false;
    const drawerStyles = window.getComputedStyle(drawer);
    const gap = parseFloat(drawerStyles.columnGap || drawerStyles.gap || "0") || 0;
    const padding = parseFloat(drawerStyles.paddingTop || "0") || 0;
    const clearance = Math.max(4, padding || gap || 4);
    const drawerGap = Math.max(4, gap || padding || 4);
    if (drawer.classList.contains("dashboard-tool-drawer-portaled")) {
      const viewportGutter = Math.max(8, clearance);
      let left = itemRect.right - drawerGap - drawerWidth;
      let top = itemRect.top + clearance;
      const header = item.querySelector(":scope > .db-panel-hd");
      if (header?.contains(settingsButton)) {
        const headerRect = header.getBoundingClientRect();
        top = Math.min(top, headerRect.bottom - drawerHeight - clearance);
      }
      left = clampViewportCoord(left, drawerWidth, viewportGutter);
      top = clampViewportTop(top, drawerHeight, viewportGutter);
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-left", `${Math.round(left)}px`);
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-top", `${Math.round(top)}px`);
      return true;
    }
    const positioningRoot = drawer.offsetParent || item;
    const rootRect = positioningRoot.getBoundingClientRect();
    const right = Math.max(0, rootRect.right - itemRect.right + drawerWidth + drawerGap);
    let top = itemRect.top - rootRect.top + clearance;

    const header = item.querySelector(":scope > .db-panel-hd");
    if (header?.contains(settingsButton)) {
      const headerRect = header.getBoundingClientRect();
      top = Math.min(top, headerRect.bottom - rootRect.top - drawerHeight - clearance);
    }

    const viewportGutter = Math.max(8, clearance);
    const minTop = viewportGutter - rootRect.top;
    const maxTop = window.innerHeight - viewportGutter - rootRect.top - drawerHeight;
    const clampedTop = Math.max(minTop, Math.min(top, maxTop));
    drawer.style.setProperty("--dashboard-tool-drawer-top", `${Math.round(clampedTop)}px`);
    drawer.style.setProperty("--dashboard-tool-drawer-right", `${Math.round(right)}px`);
    return true;
  };

  const positionDashboardToolDrawerAtPointer = (item, drawer, clientX, clientY) => {
    if (!item || !drawer || clientX == null || clientY == null) return false;
    const itemRect = objectMenuAnchorRect(item);
    if (!itemRect) return false;
    const { width: drawerWidth, height: drawerHeight } = drawerDimensions(drawer);
    if (!drawerWidth || !drawerHeight) return false;
    const viewportGutter = 8;
    if (drawer.classList.contains("dashboard-tool-drawer-portaled")) {
      const left = clampViewportCoord(itemRect.right - drawerWidth - viewportGutter, drawerWidth, viewportGutter);
      const top = clampViewportTop(Math.max(itemRect.top + viewportGutter, clientY), drawerHeight, viewportGutter);
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-left", `${Math.round(left)}px`);
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-top", `${Math.round(top)}px`);
      return true;
    }
    const positioningRoot = drawer.offsetParent || item;
    const rootRect = positioningRoot.getBoundingClientRect();
    let right = Math.max(0, rootRect.right - itemRect.right + drawerWidth + viewportGutter);
    const maxRight = Math.max(0, rootRect.right - viewportGutter - drawerWidth);
    right = Math.min(right, maxRight);
    let top = Math.max(itemRect.top + viewportGutter, clientY) - rootRect.top;
    const minTop = viewportGutter - rootRect.top;
    const maxTop = window.innerHeight - viewportGutter - rootRect.top - drawerHeight;
    top = Math.max(minTop, Math.min(top, maxTop));
    drawer.style.setProperty("--dashboard-tool-drawer-top", `${Math.round(top)}px`);
    drawer.style.setProperty("--dashboard-tool-drawer-right", `${Math.round(right)}px`);
    return true;
  };

  return {
    portalDashboardToolDrawer,
    restoreDashboardToolDrawer,
    positionDashboardToolDrawer,
    positionDashboardToolDrawerAtPointer,
  };
};
