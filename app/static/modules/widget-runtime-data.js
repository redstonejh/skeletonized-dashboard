export const createWidgetRuntimeData = ({
  widgetDefinitionForElement,
  widgetInstanceFromElement,
  renderWidgetRuntimeContent,
}) => {
  const refreshWidgetRuntimeData = async (widget, resolvedContext = {}, options = {}) => {
    if (!widget?.isConnected) return;
    if (widget.contains(document.activeElement) && !options.allowFocused) return;
    const definition = widgetDefinitionForElement(widget);
    const instance = widgetInstanceFromElement(widget, definition);
    const sequence = (Number(widget.dataset.widgetRenderSeq) || 0) + 1;
    widget.dataset.widgetRenderSeq = String(sequence);
    const data = typeof definition.getDemoData === "function"
      ? await definition.getDemoData(instance.config || {}, resolvedContext || {})
      : { rows: [], schema: { fields: [] } };
    if (!widget.isConnected || (widget.contains(document.activeElement) && !options.allowFocused)) return;
    if (Number(widget.dataset.widgetRenderSeq) !== sequence) return;
    widget.dataset.widgetRuntimeStatus = "ready";
    renderWidgetRuntimeContent(widget, {
      resolvedContext,
      data,
      status: "ready",
    });
  };

  return { refreshWidgetRuntimeData };
};
