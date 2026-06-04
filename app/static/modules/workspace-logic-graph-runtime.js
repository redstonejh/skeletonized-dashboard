export const createWorkspaceLogicGraphRuntime = ({
  getActivePanelProfile,
  removeStore,
  workspaceLogicGraphKey,
  pushLiveLayoutUndo,
}) => {
  const emptyWorkspaceLogicGraph = () => ({ version: 1, links: [], relationships: [], operators: [], styleRules: [], contextLinks: [] });
  const normalizeWorkspaceLogicGraph = () => emptyWorkspaceLogicGraph();
  const persistedWorkspaceEndpointIds = (snapshot = {}) => new Set([
    ...(snapshot.widgets || []).map((widget) => widget.id),
    ...(snapshot.panels || []).map((panel) => panel.id),
    ...(snapshot.dividers || []).map((divider) => divider.id),
    ...(snapshot.contexts || []).map((context) => context.id),
  ].map(String).filter(Boolean));
  const pruneWorkspaceLogicGraphForEndpointIds = () => emptyWorkspaceLogicGraph();
  const workspaceLogicGraphFromPersistedSnapshot = () => emptyWorkspaceLogicGraph();
  const loadWorkspaceLogicGraph = () => emptyWorkspaceLogicGraph();
  const saveWorkspaceLogicGraph = (layoutKey = "builder", _graph = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
    removeStore(workspaceLogicGraphKey(layoutKey, profile));
    if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
    return emptyWorkspaceLogicGraph();
  };
  const deriveWorkspaceRelationships = () => [];
  const inspectDataSubstrate = () => [];
  const datasetOriginExposedDatasets = () => [];

  return {
    emptyWorkspaceLogicGraph,
    normalizeWorkspaceLogicGraph,
    persistedWorkspaceEndpointIds,
    pruneWorkspaceLogicGraphForEndpointIds,
    workspaceLogicGraphFromPersistedSnapshot,
    loadWorkspaceLogicGraph,
    saveWorkspaceLogicGraph,
    deriveWorkspaceRelationships,
    inspectDataSubstrate,
    datasetOriginExposedDatasets,
  };
};
