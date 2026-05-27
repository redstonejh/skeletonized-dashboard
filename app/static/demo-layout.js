(() => {
  const demoDataRuntime = () => window.dashboardDemoDataRuntime;
  const workspacePresets = () => ({});
  const presetOrder = () => [];
  const aiExampleDefinitions = () => [];

  const generatedWorkspaceProfile = (kind = "demo", id = "") => `${kind}:${id || "workspace"}`;

  const generatedProfileSource = (profile = "") => {
    const [kind, ...rest] = String(profile || "").split(":");
    const id = rest.join(":");
    return id && ["demo", "ai-example", "ai-generated", "stress"].includes(kind) ? { kind, id } : null;
  };

  window.dashboardDemoLayoutRuntime = {
    presets: workspacePresets,
    presetOrder,
    aiExampleDefinitions,
    generatedWorkspaceProfile,
    generatedProfileSource,
    scenarioSource: (scenario, options = {}) => demoDataRuntime()?.scenarioSource?.(scenario, options) || null,
    useCaseMatrix: () => demoDataRuntime()?.useCaseMatrix?.() || {},
    generateData: (options = {}) => demoDataRuntime()?.generateOperationalData?.(options) || null,
  };
})();
