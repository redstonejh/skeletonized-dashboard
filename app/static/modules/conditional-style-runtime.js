export const createConditionalStyleRuntime = ({
  widgetDefinitionForElement,
  widgetInstanceFromElement,
  resolveWorkspaceContextForItem,
  managedQueryStateForWidget,
  applyPanelColor,
  hexToRgb,
  readableTextFor,
  normalizeLogicExpression,
  STYLE_RULE_EFFECT_PROPERTIES,
}) => {
  const styleRulePathValue = (source, path) => {
    if (!path) return undefined;
    const parts = String(path).split(".").filter(Boolean);
    return parts.reduce((value, part) => {
      if (value == null) return undefined;
      if (part === "length" && Array.isArray(value)) return value.length;
      return value?.[part];
    }, source);
  };

  const numericMetricValueForWidget = ({ config = {}, data = {}, resolvedContext = {} } = {}) => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
    const metric = ["count", "sum", "avg", "min", "max"].includes(config.metric) ? config.metric : "count";
    if (metric === "count") return total;
    const mapping = resolvedContext?.semanticMapping || data?.semanticMapping || {};
    const valueField = config.valueField || mapping.valueField;
    if (!valueField) return undefined;
    const values = rows.map((row) => {
      const raw = row?.[valueField];
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = Number(raw.replace(/[$,%\s,]/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }).filter((value) => value != null);
    if (!values.length) return undefined;
    if (metric === "sum") return values.reduce((sum, value) => sum + value, 0);
    if (metric === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (metric === "min") return Math.min(...values);
    if (metric === "max") return Math.max(...values);
    return total;
  };

  const styleRuleEnvironmentForWidget = (widget, options = {}) => {
    const definition = options.definition || widgetDefinitionForElement(widget);
    const instance = options.instance || widgetInstanceFromElement(widget, definition);
    const resolvedContext = options.resolvedContext || resolveWorkspaceContextForItem(widget);
    const data = options.data || managedQueryStateForWidget(widget)?.data || null;
    const status = options.status || widget.dataset.widgetRuntimeStatus || managedQueryStateForWidget(widget)?.status || "empty";
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
    return {
      widget,
      definition,
      instance,
      config: instance?.config || {},
      context: resolvedContext || {},
      resolvedContext: resolvedContext || {},
      data: {
        ...(data || {}),
        rows,
        total,
      },
      rows,
      status,
      metric: {
        value: numericMetricValueForWidget({ config: instance?.config || {}, data: data || {}, resolvedContext: resolvedContext || {} }),
      },
      constants: {},
    };
  };

  const logicOperandValue = (operand, environment) => {
    if (operand && typeof operand === "object" && !Array.isArray(operand)) {
      if (operand.type === "path") return styleRulePathValue(environment, operand.path);
      if (operand.type === "constant") return operand.value;
      if (operand.type === "context") return styleRulePathValue(environment.context, operand.path);
      if (operand.type === "config") return styleRulePathValue(environment.config, operand.path);
      if (operand.type === "data") return styleRulePathValue(environment.data, operand.path);
    }
    if (typeof operand !== "string") return operand;
    const trimmed = operand.trim();
    const pathLike = /^(metric|data|rows|status|config|context|resolvedContext|widget|instance|definition)\b/.test(trimmed);
    return pathLike ? styleRulePathValue(environment, trimmed) : operand;
  };

  const compareLogicValues = (left, operator, right) => {
    const leftNumber = typeof left === "number" ? left : Number(left);
    const rightNumber = typeof right === "number" ? right : Number(right);
    const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    if (operator === "<") return numeric ? leftNumber < rightNumber : String(left) < String(right);
    if (operator === ">") return numeric ? leftNumber > rightNumber : String(left) > String(right);
    if (operator === "<=") return numeric ? leftNumber <= rightNumber : String(left) <= String(right);
    if (operator === ">=") return numeric ? leftNumber >= rightNumber : String(left) >= String(right);
    if (operator === "!=") return left !== right && String(left) !== String(right);
    return left === right || String(left) === String(right);
  };

  const evaluateLogicExpression = (expression, environment) => {
    const normalized = normalizeLogicExpression(expression);
    if (normalized.type === "and") return normalized.inputs.length > 0 && normalized.inputs.every((entry) => evaluateLogicExpression(entry, environment));
    if (normalized.type === "or") return normalized.inputs.some((entry) => evaluateLogicExpression(entry, environment));
    if (normalized.type === "not") return !evaluateLogicExpression(normalized.input, environment);
    const left = logicOperandValue(normalized.left, environment);
    const right = logicOperandValue(normalized.right, environment);
    if (left == null || right == null) return false;
    return compareLogicValues(left, normalized.operator, right);
  };

  const clearConditionalStyleForWidget = (widget) => {
    if (!widget) return;
    widget.classList.remove("widget-conditional-style");
    [
      "--conditional-accent",
      "--conditional-accent-rgb",
      "--conditional-text",
      "--conditional-background-tint",
    ].forEach((property) => widget.style.removeProperty(property));
    delete widget.dataset.conditionalRimState;
    delete widget.dataset.conditionalIconState;
    delete widget.dataset.conditionalVisibility;
    delete widget.dataset.activeStyleRuleIds;
    delete widget.dataset.conditionalPanelAccentApplied;
    if (widget.dataset.panelColor && hexToRgb(widget.dataset.panelColor)) {
      applyPanelColor(widget, widget.dataset.panelColor);
    } else {
      widget.style.removeProperty("--panel-accent");
      widget.style.removeProperty("--panel-accent-rgb");
      widget.style.removeProperty("--panel-accent-text");
    }
  };

  const applyConditionalStyleEffects = (widget, effects = []) => {
    effects.forEach((effect) => {
      const property = effect.property;
      const value = effect.value;
      if (property === STYLE_RULE_EFFECT_PROPERTIES.accentColor) {
        const rgb = hexToRgb(value);
        if (!rgb) return;
        widget.style.setProperty("--conditional-accent", `#${String(value).replace("#", "")}`);
        widget.style.setProperty("--conditional-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        widget.style.setProperty("--conditional-text", readableTextFor(rgb));
        widget.style.setProperty("--panel-accent", `#${String(value).replace("#", "")}`);
        widget.style.setProperty("--panel-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        widget.style.setProperty("--panel-accent-text", readableTextFor(rgb));
        widget.dataset.conditionalPanelAccentApplied = "true";
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.textColor) {
        widget.style.setProperty("--conditional-text", String(value || ""));
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.backgroundTint) {
        const rgb = hexToRgb(value);
        if (rgb) {
          widget.style.setProperty("--conditional-background-tint", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .16)`);
        } else if (value) {
          widget.style.setProperty("--conditional-background-tint", String(value));
        }
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.rimState) {
        widget.dataset.conditionalRimState = String(value || "");
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.iconState) {
        widget.dataset.conditionalIconState = String(value || "");
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.visibility) {
        widget.dataset.conditionalVisibility = String(value || "");
      }
    });
  };

  const applyStyleRulesForWidget = (widget, options = {}) => {
    if (!widget?.classList?.contains("widget-card")) return [];
    clearConditionalStyleForWidget(widget);
    return [];
  };

  return {
    applyConditionalStyleEffects,
    applyStyleRulesForWidget,
    clearConditionalStyleForWidget,
    compareLogicValues,
    evaluateLogicExpression,
    logicOperandValue,
    numericMetricValueForWidget,
    styleRuleEnvironmentForWidget,
    styleRulePathValue,
  };
};
