export function createWidgetContentRuntime(deps) {
  const { widgetDefinitionForElement, widgetRuntimeController } = deps;
  const widgetInstanceFromElement = (widget, definition = widgetDefinitionForElement(widget)) => widgetRuntimeController.instanceFromElement(widget, definition);
  const setWidgetRuntimeContent = (widget, html) => widgetRuntimeController.setRuntimeContent(widget, html);
  const renderWidgetRuntimeContent = (widget, options = {}) => widgetRuntimeController.renderRuntimeContent(widget, options);

  return { widgetInstanceFromElement, setWidgetRuntimeContent, renderWidgetRuntimeContent };
}
