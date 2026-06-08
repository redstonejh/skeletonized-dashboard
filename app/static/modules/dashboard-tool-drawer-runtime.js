import { positionObjectMenuSurface } from "./object-menu-positioning.js";

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
  const portalDashboardToolDrawer = (item, drawer) => {
    if (!item || !drawer) return false;
    const drawerStyles = window.getComputedStyle(drawer);
    dashboardToolDrawerVars.forEach((name) => {
      const value = drawerStyles.getPropertyValue(name);
      if (value) drawer.style.setProperty(name, value);
    });
    if (!portalFloatingMenu(drawer, item, { skipPosition: true })) return false;
    drawer.classList.add("dashboard-tool-drawer-portaled");
    const positioned = positionObjectMenuSurface(item, drawer, {
      gutter: 8,
      gap: 8,
      cssVars: {
        left: "--dashboard-tool-drawer-fixed-left",
        top: "--dashboard-tool-drawer-fixed-top",
      },
    });
    if (!positioned) {
      restoreDashboardToolDrawer(drawer);
      return false;
    }
    drawer.classList.add("dashboard-tool-drawer-open");
    return true;
  };

  const restoreDashboardToolDrawer = (drawer) => {
    if (!drawer) return;
    drawer.classList.remove("dashboard-tool-drawer-portaled", "dashboard-tool-drawer-open");
    drawer.style.removeProperty("--dashboard-tool-drawer-fixed-left");
    drawer.style.removeProperty("--dashboard-tool-drawer-fixed-top");
    dashboardToolDrawerVars.forEach((name) => drawer.style.removeProperty(name));
    restoreFloatingMenu(drawer);
  };

  return {
    portalDashboardToolDrawer,
    restoreDashboardToolDrawer,
  };
};
