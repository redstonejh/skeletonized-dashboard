export const createWidgetRuntimeMeaning = ({
  widgetConfigFromElement,
  widgetDefinitionForElement,
  uniqueValues,
}) => {
  const runtimeMeaningStatusValue = (value) => String(value ?? "").trim().toLowerCase();

  const runtimeMeaningStatusKind = (value) => {
    const status = runtimeMeaningStatusValue(value);
    if (!status) return "";
    if (/(critical|error|failed|failure|down|offline|blocked|breach)/.test(status)) return "error";
    if (/(warn|risk|watch|urgent|late|degraded|attention|elevated)/.test(status)) return "warning";
    if (/(stale|expired|old|paused|inactive|dormant)/.test(status)) return "stale";
    if (/(live|stream|refresh|running|processing)/.test(status)) return "active";
    if (/(ok|ready|healthy|normal|complete|completed|green|clear)/.test(status)) return "healthy";
    return "";
  };

  const runtimeMeaningFreshnessFromTimestamp = (timestamp) => {
    const value = Number(timestamp) || Date.parse(timestamp || "");
    if (!Number.isFinite(value)) return "";
    const age = Date.now() - value;
    if (age < 0) return "fresh";
    if (age <= 2 * 60 * 1000) return "live";
    if (age <= 24 * 60 * 60 * 1000) return "fresh";
    return "stale";
  };

  const runtimeMeaningDataTimestamp = (data, widget) => (
    data?.metadata?.freshness ||
    data?.metadata?.lastUpdated ||
    data?.freshness ||
    data?.lastUpdated ||
    data?.updatedAt ||
    widget?.dataset?.widgetQueryLastUpdated ||
    ""
  );

  const runtimeMeaningConfidence = (data, config = {}) => {
    const raw = data?.confidence ?? data?.metadata?.confidence ?? config.confidence ?? config.runtimeConfidence;
    const value = Number(raw);
    if (!Number.isFinite(value)) return "unknown";
    if (value < .5) return "low";
    if (value < .75) return "medium";
    return "high";
  };

  const deriveWidgetRuntimeMeaning = ({ widget = null, definition = null, instance = null, resolvedContext = null, data = null, status = "empty" } = {}) => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const config = instance?.config || widgetConfigFromElement(widget, definition || widgetDefinitionForElement(widget));
    const mapping = resolvedContext?.semanticMapping || data?.semanticMapping || {};
    const statusFields = uniqueValues([
      mapping.statusField,
      "status",
      "state",
      "health",
      "condition",
      "priority",
      "urgency",
      "freshness",
    ]).filter(Boolean);
    const counts = { error: 0, warning: 0, stale: 0, active: 0, healthy: 0 };
    rows.forEach((row) => {
      statusFields.forEach((field) => {
        const kind = runtimeMeaningStatusKind(row?.[field]);
        if (kind && counts[kind] !== undefined) counts[kind] += 1;
      });
    });
    const rowCount = Math.max(1, rows.length);
    const freshness = runtimeMeaningFreshnessFromTimestamp(runtimeMeaningDataTimestamp(data, widget)) ||
      (counts.stale / rowCount >= .25 ? "stale" : data?.live || data?.sourceKind === "stream" ? "live" : data ? "fresh" : "unknown");
    const refreshing = widget?.dataset?.widgetQueryRefreshing === "true" || data?.refreshing === true;
    let condition = "idle";
    if (status === "error" || counts.error > 0) condition = "error";
    else if (status === "loading") condition = "loading";
    else if (widget?.dataset?.shiftSignalActive === "true") condition = "active";
    else if (widget?.dataset?.shiftSignalConnected === "true") condition = "healthy";
    else if (refreshing || data?.live === true || data?.sourceKind === "stream") condition = "active";
    else if (status === "stale" || freshness === "stale" || counts.stale / rowCount >= .25) condition = "stale";
    else if (counts.warning / rowCount >= .20) condition = "warning";
    else if (status === "ready" || rows.length || counts.healthy > 0) condition = "healthy";
    const urgency = condition === "error"
      ? "urgent"
      : condition === "warning"
        ? "watch"
        : condition === "stale"
          ? "low"
          : "normal";
    const motion = condition === "loading" || refreshing || condition === "active"
      ? "active"
      : condition === "stale" || status === "empty"
        ? "inactive"
        : "steady";
    return {
      condition,
      urgency,
      freshness,
      motion,
      confidence: runtimeMeaningConfidence(data, config),
      counts,
    };
  };

  const applyWidgetRuntimeMeaning = (widget, context = {}) => {
    if (!widget?.classList?.contains("widget-card")) return null;
    const meaning = deriveWidgetRuntimeMeaning({ widget, ...context });
    widget.classList.add("widget-runtime-meaning");
    widget.dataset.runtimeCondition = meaning.condition;
    widget.dataset.runtimeUrgency = meaning.urgency;
    widget.dataset.runtimeFreshness = meaning.freshness;
    widget.dataset.runtimeMotion = meaning.motion;
    widget.dataset.runtimeConfidence = meaning.confidence;
    widget.dataset.runtimeMeaningSummary = [
      meaning.condition,
      meaning.freshness,
      meaning.confidence !== "unknown" ? `${meaning.confidence}-confidence` : "",
    ].filter(Boolean).join(" ");
    return meaning;
  };

  return {
    deriveWidgetRuntimeMeaning,
    applyWidgetRuntimeMeaning,
  };
};
