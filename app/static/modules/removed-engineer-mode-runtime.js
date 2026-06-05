export const createRemovedEngineerModeRuntime = ({ refreshWorkspaceMiniMaps }) => {
  const engineerModeState = Object.freeze({ enabled: false, source: "removed", updatedAt: 0 });
  const isEngineerMode = () => false;
  const refreshEngineerContextVisibility = () => {
    refreshWorkspaceMiniMaps?.();
  };
  const setEngineerMode = () => false;
  const toggleEngineerMode = () => false;
  const onEngineerModeChange = () => () => {};
  const refreshEngineerOverlays = () => {};

  document.body.classList.remove("engineer-mode-active");
  document.documentElement.dataset.engineerMode = "false";

  return {
    engineerModeState,
    isEngineerMode,
    onEngineerModeChange,
    refreshEngineerContextVisibility,
    refreshEngineerOverlays,
    setEngineerMode,
    toggleEngineerMode,
  };
};
