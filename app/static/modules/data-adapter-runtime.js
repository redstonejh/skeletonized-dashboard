export function createDataAdapterRuntime({ getActivePanelProfile, dataSourceById }) {
  const dataSourceAdapters = new Map();
  const normalizeFieldType = (value) => {
    if (value instanceof Date) return "date";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value) || (value && typeof value === "object")) return "json";
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(value) || !Number.isNaN(Date.parse(value)) && /date|time|at$/i.test(value)) return "date";
      return "string";
    }
    return "unknown";
  };
  const inferDataSchema = (rows = [], explicitFields = []) => {
    const fieldsByName = new Map();
    explicitFields.forEach((field) => {
      if (!field?.name) return;
      fieldsByName.set(field.name, {
        name: field.name,
        type: field.type || "unknown",
        nullable: Boolean(field.nullable),
        sampleValues: Array.isArray(field.sampleValues) ? field.sampleValues.slice(0, 4) : [],
      });
    });
    rows.slice(0, 50).forEach((row) => {
      if (!row || typeof row !== "object") return;
      Object.entries(row).forEach(([name, value]) => {
        const existing = fieldsByName.get(name);
        const type = existing?.type && existing.type !== "unknown" ? existing.type : normalizeFieldType(value);
        const sampleValues = existing?.sampleValues || [];
        if (value != null && sampleValues.length < 4 && !sampleValues.some((sample) => JSON.stringify(sample) === JSON.stringify(value))) {
          sampleValues.push(value);
        }
        fieldsByName.set(name, {
          name,
          type,
          nullable: Boolean(existing?.nullable || value == null),
          sampleValues,
        });
      });
    });
    return { fields: [...fieldsByName.values()] };
  };
  const semanticFieldScore = (fieldName, candidates) => {
    const name = String(fieldName || "").toLowerCase();
    return candidates.reduce((score, candidate, index) => {
      if (name === candidate) return Math.max(score, 100 - index);
      if (name.includes(candidate)) return Math.max(score, 60 - index);
      return score;
    }, 0);
  };
  const suggestSemanticMappingFromSchema = (schema) => {
    const fields = schema?.fields || [];
    const best = (candidates, typePreference = null) => fields
      .map((field) => ({
        field,
        score: semanticFieldScore(field.name, candidates) + (typePreference && field.type === typePreference ? 18 : 0),
      }))
      .sort((a, b) => b.score - a.score)[0]?.score > 0
      ? fields
        .map((field) => ({
          field,
          score: semanticFieldScore(field.name, candidates) + (typePreference && field.type === typePreference ? 18 : 0),
        }))
        .sort((a, b) => b.score - a.score)[0].field.name
      : undefined;
    return {
      dateField: best(["created_at", "createdat", "updated_at", "updatedat", "timestamp", "order_date", "date", "time"], "date"),
      valueField: best(["value", "amount", "total", "count", "score", "metric"], "number"),
      labelField: best(["label", "name", "title", "description"], "string"),
      categoryField: best(["category", "type", "group", "segment"], "string"),
      statusField: best(["status", "state"], "string"),
      ownerField: best(["owner", "assignee", "user"], "string"),
      locationField: best(["location", "geo", "region", "country", "city"], "geo"),
      custom: {},
    };
  };
  const sourceRows = (source) => {
    const config = source?.config || {};
    if (Array.isArray(config.rows)) return config.rows;
    if (Array.isArray(config.data)) return config.data;
    if (Array.isArray(config.values)) return config.values;
    return [];
  };
  const dataSubstrateRowsForSource = (source, layoutKey = "builder", profile = getActivePanelProfile(layoutKey), stack = new Set()) => {
    if (!source?.id) return [];
    if (source.kind !== "derived") return sourceRows(source);
    if (stack.has(source.id)) return [];
    const sourceId = source.config?.sourceId || source.config?.baseSourceId || "";
    const base = dataSourceById(layoutKey, profile, sourceId);
    if (!base) return sourceRows(source);
    const baseRows = dataSubstrateRowsForSource(base, layoutKey, profile, new Set([...stack, source.id]));
    const transformRuntime = window.dashboardDataTransformRuntime;
    if (!transformRuntime?.queryRows) return baseRows;
    try {
      const transformed = transformRuntime.queryRows(baseRows, source.config?.transform || {}, {
        semanticMapping: source.config?.semanticMapping || {},
        now: transformRuntime.demoNow,
      });
      return transformed.rows || [];
    } catch {
      return [];
    }
  };
  const comparableFilterValue = (value) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const date = Date.parse(value);
    if (Number.isFinite(date)) return date;
    return value;
  };
  const applyContextFilters = (rows, filters = []) => rows.filter((row) => filters.every((filter) => {
    if (!filter?.field && !filter?.key) return true;
    const field = filter.field || filter.key;
    const operator = filter.operator || "eq";
    const actual = row?.[field];
    const expected = filter.value;
    if (operator === "neq") return actual !== expected;
    if (operator === "contains") return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    if (operator === "in") return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
    if (operator === "gte") return comparableFilterValue(actual) >= comparableFilterValue(expected);
    if (operator === "lte") return comparableFilterValue(actual) <= comparableFilterValue(expected);
    return actual === expected;
  }));
  const applyContextTimeRange = (rows, timeRange, mapping) => {
    if (!timeRange?.start && !timeRange?.end) return rows;
    const field = timeRange.field || mapping?.dateField;
    if (!field) return rows;
    const start = timeRange.start ? Date.parse(timeRange.start) : Number.NEGATIVE_INFINITY;
    const end = timeRange.end ? Date.parse(timeRange.end) : Number.POSITIVE_INFINITY;
    return rows.filter((row) => {
      const value = Date.parse(row?.[field]);
      if (!Number.isFinite(value)) return false;
      return value >= start && value <= end;
    });
  };
  const applyContextSort = (rows, sort = []) => {
    if (!sort.length) return rows;
    return [...rows].sort((a, b) => {
      for (const rule of sort) {
        const direction = rule.direction === "desc" ? -1 : 1;
        const av = a?.[rule.field];
        const bv = b?.[rule.field];
        if (av === bv) continue;
        return av > bv ? direction : -direction;
      }
      return 0;
    });
  };
  const projectContextFields = (rows, fields = null) => {
    if (!Array.isArray(fields) || !fields.length) return rows;
    return rows.map((row) => fields.reduce((projected, field) => {
      projected[field] = row?.[field];
      return projected;
    }, {}));
  };
  const createRecordAdapter = (kind) => ({
    kind,
    introspect: async (source) => inferDataSchema(
      dataSubstrateRowsForSource(
        source,
        source?.config?.layoutKey || "builder",
        source?.config?.profile || getActivePanelProfile(source?.config?.layoutKey || "builder")
      ),
      source?.config?.schema || source?.config?.fields || []
    ),
    query: async (source, request = {}) => {
      const mapping = request.semanticMapping || {};
      const baseRows = dataSubstrateRowsForSource(
        source,
        request.layoutKey || "builder",
        request.profile || getActivePanelProfile(request.layoutKey || "builder")
      );
      const filters = [...(request.filters || [])];
      const transformRuntime = window.dashboardDataTransformRuntime;
      if (transformRuntime?.queryRows) {
        try {
          const transformed = transformRuntime.queryRows(baseRows, {
            ...request,
            filters,
            semanticMapping: mapping,
          }, {
            semanticMapping: mapping,
            now: transformRuntime.demoNow,
          });
          return {
            schema: transformed.schema || inferDataSchema(transformed.rows, source?.config?.schema || source?.config?.fields || []),
            rows: transformed.rows || [],
            total: Number.isFinite(Number(transformed.total)) ? Number(transformed.total) : (transformed.rows || []).length,
            sourceId: source.id,
            sourceKind: source.kind,
          };
        } catch (error) {
          return {
            schema: { fields: [] },
            rows: [],
            total: 0,
            error: error?.message || "Data transform failed.",
            sourceId: source.id,
            sourceKind: source.kind,
          };
        }
      }
      const filtered = applyContextTimeRange(applyContextFilters(baseRows, filters), request.timeRange, mapping);
      const sorted = applyContextSort(filtered, request.sort || []);
      const limited = Number.isFinite(Number(request.limit)) ? sorted.slice(0, Math.max(0, Number(request.limit))) : sorted;
      return {
        schema: inferDataSchema(limited, source?.config?.schema || source?.config?.fields || []),
        rows: projectContextFields(limited, request.fields),
        total: filtered.length,
        sourceId: source.id,
        sourceKind: source.kind,
      };
    },
    validateConfig: async (source) => ({ ok: Array.isArray(sourceRows(source)), errors: Array.isArray(sourceRows(source)) ? [] : ["Rows must be an array."] }),
    suggestSemanticMapping: async (schema) => suggestSemanticMappingFromSchema(schema),
  });
  const registerDataSourceAdapter = (adapter) => {
    if (!adapter?.kind || typeof adapter.query !== "function" || typeof adapter.introspect !== "function") return false;
    dataSourceAdapters.set(adapter.kind, adapter);
    return true;
  };
  registerDataSourceAdapter(createRecordAdapter("manual"));
  registerDataSourceAdapter(createRecordAdapter("json"));
  registerDataSourceAdapter(createRecordAdapter("csv"));
  registerDataSourceAdapter(createRecordAdapter("sql"));
  registerDataSourceAdapter(createRecordAdapter("api"));
  registerDataSourceAdapter(createRecordAdapter("uploaded-file"));
  registerDataSourceAdapter(createRecordAdapter("scenario"));
  registerDataSourceAdapter(createRecordAdapter("derived"));
  registerDataSourceAdapter(createRecordAdapter("ai-generated"));
  registerDataSourceAdapter(createRecordAdapter("realtime-stream"));
  registerDataSourceAdapter(createRecordAdapter("cached-query"));
  
  return {
    dataSourceAdapters,
    normalizeFieldType,
    inferDataSchema,
    semanticFieldScore,
    suggestSemanticMappingFromSchema,
    sourceRows,
    dataSubstrateRowsForSource,
    comparableFilterValue,
    applyContextFilters,
    applyContextTimeRange,
    applyContextSort,
    projectContextFields,
    createRecordAdapter,
    registerDataSourceAdapter,
  };
}
