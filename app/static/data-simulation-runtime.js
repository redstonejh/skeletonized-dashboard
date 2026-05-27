(() => {
  const dataRuntime = window.dashboardDemoDataRuntime;
  const layoutRuntime = window.dashboardDemoLayoutRuntime;
  if (!dataRuntime) return;
  window.dashboardDemoDataRuntime = {
    ...dataRuntime,
    workspacePresets: () => layoutRuntime?.presets?.() || {},
  };
})();