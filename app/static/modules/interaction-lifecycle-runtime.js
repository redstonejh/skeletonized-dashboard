export function createInteractionLifecycleRuntime(deps) {
  const { clearSurfaceResponse, dashboardDragRuntime, dashboardResizeRuntime, gridHostForLayout } = deps;
  const beginInteractionAutoScroll = ({ layout = null, onScrollFrame } = {}) => dashboardDragRuntime.beginInteractionAutoScroll({
    layout,
    onScrollFrame,
    gridHostForLayout,
  });
  const beginResizeLifecycle = (options = {}) => dashboardResizeRuntime.beginResizeLifecycle({
    ...options,
    beginInteractionAutoScroll,
    clearSurfaceResponse,
  });


  return { beginInteractionAutoScroll, beginResizeLifecycle };
}
