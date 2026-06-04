export const createWidgetRuntimeData = ({
  widgetDefinitionForElement,
  widgetInstanceFromElement,
  demoQueryStateForWidget,
  widgetQueryKeys,
  beginManagedWidgetQuery,
  renderWidgetRuntimeContent,
}) => {
  const refreshWidgetRuntimeData = async (widget, resolvedContext, options = {}) => {
    if (!widget?.isConnected) return;
    if (widget.contains(document.activeElement) && !options.allowFocused) return;
    const definition = widgetDefinitionForElement(widget);
    const instance = widgetInstanceFromElement(widget, definition);
    const query = typeof definition.resolveQuery === "function"
      ? definition.resolveQuery(instance.config, resolvedContext)
      : null;
    widget.dataset.widgetQueryRequirements = JSON.stringify(definition.queryRequirements || {});
    const sequence = (Number(widget.dataset.widgetQuerySeq) || 0) + 1;
    widget.dataset.widgetQuerySeq = String(sequence);
    if (!resolvedContext?.canQuery && typeof definition.getDemoData === "function") {
      try {
        const demo = await demoQueryStateForWidget(definition, instance, resolvedContext, options);
        if (!widget.isConnected || (widget.contains(document.activeElement) && !options.allowFocused)) return;
        if (Number(widget.dataset.widgetQuerySeq) !== sequence) return;
        if (demo?.state) {
          delete widget.dataset.widgetQueryKey;
          widgetQueryKeys.delete(widget);
          widget.dataset.widgetRuntimeStatus = demo.state.status;
          widget.dataset.widgetRuntimeMode = "demo";
          widget.dataset.widgetQueryRefreshing = "false";
          delete widget.dataset.widgetQueryError;
          if (demo.state.lastUpdated) widget.dataset.widgetQueryLastUpdated = String(demo.state.lastUpdated);
          renderWidgetRuntimeContent(widget, {
            resolvedContext: demo.context,
            data: demo.state.data,
            status: demo.state.status,
          });
          return;
        }
      } catch (error) {
        if (!widget.isConnected || (widget.contains(document.activeElement) && !options.allowFocused)) return;
        if (Number(widget.dataset.widgetQuerySeq) !== sequence) return;
        widget.dataset.widgetRuntimeMode = "demo";
        widget.dataset.widgetRuntimeStatus = "error";
        widget.dataset.widgetQueryError = error?.message || "Demo data failed";
        renderWidgetRuntimeContent(widget, {
          resolvedContext,
          data: { error: error?.message || "Demo data failed" },
          status: "error",
        });
        return;
      }
    }
    delete widget.dataset.widgetRuntimeMode;
    const managed = beginManagedWidgetQuery({
      definition,
      instance,
      resolvedContext,
      query,
      force: Boolean(options.force),
    });
    if (managed.key) {
      widget.dataset.widgetQueryKey = managed.key;
      widgetQueryKeys.set(widget, managed.key);
    } else {
      delete widget.dataset.widgetQueryKey;
      widgetQueryKeys.delete(widget);
    }
    widget.dataset.widgetRuntimeStatus = managed.state.status;
    widget.dataset.widgetQueryRefreshing = managed.state.isRefreshing ? "true" : "false";
    if (managed.state.error) widget.dataset.widgetQueryError = managed.state.error;
    else delete widget.dataset.widgetQueryError;
    if (managed.state.lastUpdated) widget.dataset.widgetQueryLastUpdated = String(managed.state.lastUpdated);
    renderWidgetRuntimeContent(widget, {
      resolvedContext,
      data: managed.state.data,
      status: managed.state.status,
    });
    if (!managed.promise) return;
    const finalState = await managed.promise;
    if (!widget.isConnected || (widget.contains(document.activeElement) && !options.allowFocused)) return;
    if (Number(widget.dataset.widgetQuerySeq) !== sequence) return;
    widget.dataset.widgetRuntimeStatus = finalState.status;
    widget.dataset.widgetQueryRefreshing = finalState.isRefreshing ? "true" : "false";
    if (finalState.error) widget.dataset.widgetQueryError = finalState.error;
    else delete widget.dataset.widgetQueryError;
    if (finalState.lastUpdated) widget.dataset.widgetQueryLastUpdated = String(finalState.lastUpdated);
    renderWidgetRuntimeContent(widget, {
      resolvedContext,
      data: finalState.data,
      status: finalState.status,
    });
  };

  return { refreshWidgetRuntimeData };
};
