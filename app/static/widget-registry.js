(() => {
  const definitions = new Map();
  const aliases = new Map();

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

  const parseConfig = (value) => {
    if (!value) return {};
    if (typeof value === "object") return { ...value };
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const normalizedSize = (size, fallbackCols = 1, fallbackRows = 1) => ({
    cols: Math.max(1, Math.min(6, Number(size?.cols) || fallbackCols)),
    rows: Math.max(1, Number(size?.rows) || fallbackRows),
  });

  const normalizedSettingsSchema = (schema = {}, fallbackSettings = []) => {
    const sections = Array.isArray(schema.sections) ? schema.sections : [];
    const normalizedSections = sections.map((section, sectionIndex) => ({
      id: String(section.id || `section-${sectionIndex}`),
      label: String(section.label || "Settings"),
      fields: (Array.isArray(section.fields) ? section.fields : []).map((field) => ({
        key: String(field.key || "").trim(),
        label: String(field.label || field.key || ""),
        type: String(field.type || "text"),
        defaultValue: field.defaultValue,
        options: Array.isArray(field.options) ? field.options : [],
        placeholder: field.placeholder || "",
        min: field.min,
        max: field.max,
        step: field.step,
        required: Boolean(field.required),
        multiple: Boolean(field.multiple),
        valueType: field.valueType || null,
        affectsQuery: Boolean(field.affectsQuery),
        affectsContext: Boolean(field.affectsContext),
        surface: field.surface || "",
        validation: field.validation || {},
      })).filter((field) => field.key),
    })).filter((section) => section.fields.length);
    return {
      version: Number(schema.version) || 1,
      sections: normalizedSections.length ? normalizedSections : [{
        id: "general",
        label: "General",
        fields: fallbackSettings
          .filter((setting) => ["title", "label"].includes(setting))
          .map((setting) => ({ key: setting, label: "Title", type: "text", affectsQuery: false, affectsContext: false, validation: {} })),
      }].filter((section) => section.fields.length),
    };
  };

  const defaultQueryFields = (resolvedContext) => {
    const mapping = resolvedContext?.semanticMapping || {};
    return [
      mapping.labelField,
      mapping.valueField,
      mapping.dateField,
      mapping.categoryField,
      mapping.statusField,
      mapping.ownerField,
      mapping.locationField,
    ].filter(Boolean);
  };

  const unique = (values) => [...new Set(values.filter(Boolean))];
  const DENSITY_TIERS = ["tiny", "compact", "standard", "expanded", "rich"];
  const WIDGET_LAYERS = ["presentation", "backend", "both"];
  const normalizeDensity = (value, fallback = "standard") => DENSITY_TIERS.includes(value) ? value : fallback;
  const normalizeWidgetLayer = (value, fallback = "presentation") => (
    WIDGET_LAYERS.includes(value) ? value : fallback
  );
  const resolveWidgetDensity = (instance = {}, availableSize = {}, definition = null) => {
    if (definition?.densityBehavior?.resolve && typeof definition.densityBehavior.resolve === "function") {
      return normalizeDensity(definition.densityBehavior.resolve(instance, availableSize), "standard");
    }
    const cols = Number(instance.cols) || Number(definition?.defaultSize?.cols) || 1;
    const rows = Number(instance.rows) || Number(definition?.defaultSize?.rows) || 1;
    const width = Number(availableSize.width) || 0;
    const height = Number(availableSize.height) || 0;
    const panelContained = Boolean(availableSize.panelContained || instance.parentPanelId);
    let score = cols + (rows * 1.35);
    if (width && width < 132) score -= 1.25;
    else if (width && width >= 520) score += 1;
    if (height && height < 82) score -= 1.15;
    else if (height && height >= 280) score += 1;
    if (panelContained) score -= 0.35;
    if ((width && width < 118) || (height && height < 58)) return "tiny";
    if (score <= 4) return "compact";
    if (score >= 10) return "rich";
    if (score >= 7) return "expanded";
    return "standard";
  };
  const compactDensity = (density) => ["tiny", "compact"].includes(normalizeDensity(density));
  const richDensity = (density) => ["expanded", "rich"].includes(normalizeDensity(density));
  const chartVisualDensity = (density) => {
    const tier = normalizeDensity(density);
    if (tier === "tiny") return "tiny";
    if (tier === "compact") return "small";
    if (tier === "rich") return "large";
    return "medium";
  };

  const numberValue = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[$,%\s,]/g, ""));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const formatMetricValue = (value, format = "number") => {
    const numeric = numberValue(value);
    if (numeric == null) return String(value ?? "");
    if (format === "currency") {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: Math.abs(numeric) >= 100 ? 0 : 2,
      }).format(numeric);
    }
    if (format === "percent") {
      return new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(numeric);
    }
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    }).format(numeric);
  };

  const statLabelFor = (config) => config?.label || config?.title || "Stat";

  const tableSemanticFields = (resolvedContext) => unique(defaultQueryFields(resolvedContext));
  const tableConfiguredColumns = (config) => Array.isArray(config?.columns)
    ? config.columns.map((field) => String(field || "").trim()).filter(Boolean)
    : [];
  const queryTransformsFromConfig = (config = {}) => ({
    calculatedFields: Array.isArray(config.calculatedFields) ? config.calculatedFields : [],
    equationFilters: Array.isArray(config.equationFilters) ? config.equationFilters : [],
    thresholds: Array.isArray(config.thresholds) ? config.thresholds : [],
    unitConversions: Array.isArray(config.unitConversions) ? config.unitConversions : [],
    staleRules: Array.isArray(config.staleRules) ? config.staleRules : [],
    aggregations: Array.isArray(config.aggregations) ? config.aggregations : [],
    timeBucket: config.timeBucket && typeof config.timeBucket === "object" ? config.timeBucket : null,
  });
  const tableVisibleColumnCount = (cols) => {
    const safeCols = Number(cols) || 2;
    if (safeCols <= 2) return 3;
    if (safeCols <= 3) return 4;
    return 6;
  };
  const tableVisibleRowCount = (rows, limit) => {
    const safeRows = Math.max(1, Number(rows) || 1);
    const rowCapacity = Math.max(2, (safeRows * 3) - 1);
    const configuredLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 50;
    return Math.min(configuredLimit, rowCapacity);
  };
  const filterFieldForType = (filter, resolvedContext) => {
    const mapping = resolvedContext?.semanticMapping || {};
    const explicit = String(filter?.field || "").trim();
    if (explicit) return explicit;
    if (filter?.type === "number-range") return mapping.valueField || "";
    if (filter?.type === "date-range") return mapping.dateField || "";
    if (filter?.type === "boolean") return mapping.statusField || mapping.categoryField || "";
    if (filter?.type === "dropdown" || filter?.type === "multi-select") return mapping.categoryField || mapping.statusField || mapping.ownerField || mapping.labelField || "";
    return mapping.labelField || mapping.categoryField || mapping.statusField || "";
  };
  const filterControlsFromConfig = (config, resolvedContext, data) => {
    const configured = Array.isArray(config?.filters) && config.filters.length
      ? config.filters
      : [{ id: "search", type: "text", label: "Search", operator: "contains", value: "" }];
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return configured.map((filter, index) => {
      const type = filter.type || "text";
      const field = filterFieldForType(filter, resolvedContext);
      const options = Array.isArray(filter.options) && filter.options.length
        ? filter.options
        : field
          ? unique(rows.map((row) => row?.[field]).filter((value) => value != null).map((value) => String(value))).slice(0, 8)
          : [];
      return {
        id: filter.id || `filter-${index + 1}`,
        type,
        label: filter.label || (field ? field.replace(/[_-]+/g, " ") : "Filter"),
        field,
        operator: filter.operator || (type === "text" ? "contains" : "eq"),
        value: filter.value ?? "",
        values: Array.isArray(filter.values) ? filter.values.map(String) : [],
        min: filter.min ?? "",
        max: filter.max ?? "",
        start: filter.start ?? "",
        end: filter.end ?? "",
        enabled: Boolean(filter.enabled),
        options,
      };
    });
  };
  const renderFilterControl = (filter) => {
    const base = `data-filter-id="${escapeHtml(filter.id)}" data-filter-type="${escapeHtml(filter.type)}"`;
    const label = `<span class="filter-widget-label">${escapeHtml(filter.label)}</span>`;
    if (filter.type === "dropdown" || filter.type === "category") {
      return `<label class="filter-widget-control filter-widget-control-select" ${base}>${label}<select class="filter-widget-input filter-widget-select" data-filter-part="value" aria-label="${escapeHtml(filter.label)}">
        <option value="">All</option>
        ${filter.options.map((option) => `<option value="${escapeHtml(option)}"${String(filter.value) === String(option) ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select></label>`;
    }
    if (filter.type === "multi-select") {
      const options = filter.options.length ? filter.options : filter.values;
      return `<fieldset class="filter-widget-control filter-widget-control-options" ${base}><legend>${escapeHtml(filter.label)}</legend>
        <div class="filter-widget-option-grid">${options.slice(0, 6).map((option) => `<label class="filter-widget-option">
          <input class="filter-widget-input" type="checkbox" data-filter-part="option" value="${escapeHtml(option)}"${filter.values.includes(String(option)) ? " checked" : ""}>
          <span>${escapeHtml(option)}</span>
        </label>`).join("")}</div>
      </fieldset>`;
    }
    if (filter.type === "number-range") {
      return `<div class="filter-widget-control filter-widget-control-range" ${base}>${label}
        <div class="filter-widget-range-pair">
          <input class="filter-widget-input filter-widget-field" type="number" data-filter-part="min" value="${escapeHtml(filter.min)}" aria-label="${escapeHtml(`${filter.label} minimum`)}" placeholder="Min">
          <input class="filter-widget-input filter-widget-field" type="number" data-filter-part="max" value="${escapeHtml(filter.max)}" aria-label="${escapeHtml(`${filter.label} maximum`)}" placeholder="Max">
        </div>
      </div>`;
    }
    if (filter.type === "date-range") {
      return `<div class="filter-widget-control filter-widget-control-range" ${base}>${label}
        <div class="filter-widget-range-pair">
          <input class="filter-widget-input filter-widget-field" type="date" data-filter-part="start" value="${escapeHtml(filter.start)}" aria-label="${escapeHtml(`${filter.label} start`)}">
          <input class="filter-widget-input filter-widget-field" type="date" data-filter-part="end" value="${escapeHtml(filter.end)}" aria-label="${escapeHtml(`${filter.label} end`)}">
        </div>
      </div>`;
    }
    if (filter.type === "boolean") {
      return `<label class="filter-widget-control filter-widget-control-toggle" ${base}>
        <input class="filter-widget-input" type="checkbox" data-filter-part="enabled"${filter.enabled ? " checked" : ""}>
        <span>${escapeHtml(filter.label)}</span>
      </label>`;
    }
    return `<label class="filter-widget-control filter-widget-control-text" ${base}>${label}
      <input class="filter-widget-input filter-widget-field" type="search" data-filter-part="value" value="${escapeHtml(filter.value)}" aria-label="${escapeHtml(filter.label)}" placeholder="Search">
    </label>`;
  };
  const dataFilterModes = [
    { value: "logic", label: "Logic Operator" },
    { value: "type-conversion", label: "Type Conversion" },
  ];
  const dataFilterTypes = [
    { value: "auto", label: "Auto" },
    { value: "string", label: "String" },
    { value: "integer", label: "Integer" },
    { value: "float", label: "Float" },
    { value: "number", label: "Number" },
    { value: "boolean", label: "Boolean" },
  ];
  const dataFilterConversionBehaviors = [
    { value: "round", label: "Round" },
    { value: "floor", label: "Floor" },
    { value: "ceil", label: "Ceil" },
    { value: "truncate", label: "Truncate" },
  ];
  const dataFilterFallbackBehaviors = [
    { value: "null", label: "Output null" },
    { value: "default", label: "Use default value" },
    { value: "block", label: "Block output" },
  ];

  const TIMEFRAME_FILTER_TYPES = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "this_week", label: "This week" },
    { id: "last_week", label: "Last week" },
    { id: "this_month", label: "This month" },
    { id: "last_month", label: "Last month" },
    { id: "custom_fixed", label: "Custom fixed range" },
    { id: "custom_repeating", label: "Custom repeating interval" },
  ];
  const LEGACY_TIMEFRAME_PRESETS = [
    { id: "last_7_days", label: "Last 7 days" },
    { id: "last_14_days", label: "Last 14 days" },
    { id: "last_30_days", label: "Last 30 days" },
    { id: "last_60_days", label: "Last 60 days" },
    { id: "last_180_days", label: "Last 180 days" },
    { id: "last_365_days", label: "Last 365 days" },
    { id: "month_to_date", label: "Month to date" },
    { id: "year_to_date", label: "Year to date" },
    { id: "custom", label: "Custom range" },
  ];
  const TIMEFRAME_PRESETS = [...TIMEFRAME_FILTER_TYPES, ...LEGACY_TIMEFRAME_PRESETS];
  const DEFAULT_TIMEFRAME_FILTERS = [
    { id: "time-today", label: "Today", type: "today" },
    { id: "time-yesterday", label: "Yesterday", type: "yesterday" },
    { id: "time-last-7-days", label: "1w", type: "last_7_days" },
    { id: "time-last-14-days", label: "2w", type: "last_14_days" },
    { id: "time-last-30-days", label: "1m", type: "last_30_days" },
    { id: "time-last-60-days", label: "2m", type: "last_60_days" },
    { id: "time-last-180-days", label: "6m", type: "last_180_days" },
    { id: "time-last-365-days", label: "1yr", type: "last_365_days" },
  ];
  const WEEKDAY_OPTIONS = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];
  const datePad = (value) => String(value).padStart(2, "0");
  const dateOnly = (date) => `${date.getFullYear()}-${datePad(date.getMonth() + 1)}-${datePad(date.getDate())}`;
  const parseDateOnly = (value) => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const localToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };
  const localDateFrom = (value) => {
    const source = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date(value || Date.now());
    return new Date(source.getFullYear(), source.getMonth(), source.getDate());
  };
  const shiftedDate = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };
  const addMonths = (date, months) => {
    const next = new Date(date);
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
    return next;
  };
  const daysBetween = (start, end) => Math.round((localDateFrom(end) - localDateFrom(start)) / 86400000);
  const timeframePresetById = (id) => TIMEFRAME_PRESETS.find((preset) => preset.id === id) || null;
  const timeframeFilterTypeById = (id) => TIMEFRAME_FILTER_TYPES.find((type) => type.id === id) || timeframePresetById(id) || null;
  const normalizeWeekStartDay = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(6, Math.round(numeric)));
  };
  const timeframeLabel = (timeRange, fallback = "Any time") => {
    if (!timeRange?.start && !timeRange?.end) return fallback;
    if (timeRange.label) return timeRange.label;
    if (timeRange.start && timeRange.end) return `${timeRange.start} - ${timeRange.end}`;
    if (timeRange.start) return `Since ${timeRange.start}`;
    return `Until ${timeRange.end}`;
  };
  const TIMEFRAME_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const timeframeDateDisplay = (value) => {
    const date = parseDateOnly(value);
    if (!date) return String(value || "");
    return `${TIMEFRAME_MONTH_LABELS[date.getMonth()]} ${date.getDate()}`;
  };
  const timeframeRangeDisplay = (timeRange) => {
    if (!timeRange?.start && !timeRange?.end) return "No active range";
    if (timeRange.start && timeRange.end) return `${timeframeDateDisplay(timeRange.start)} - ${timeframeDateDisplay(timeRange.end)}`;
    if (timeRange.start) return `Since ${timeframeDateDisplay(timeRange.start)}`;
    return `Until ${timeframeDateDisplay(timeRange.end)}`;
  };
  const normalizeTimeframeFilter = (filter, index = 0) => {
    const type = String(filter?.type || filter?.preset || filter?.id || "today").trim();
    const typeRecord = timeframeFilterTypeById(type) || { id: type, label: type };
    const id = String(filter?.id || `time-filter-${index + 1}`).trim();
    return {
      id,
      label: String(filter?.label || typeRecord.label || id).trim() || typeRecord.label || "Time filter",
      type: typeRecord.id || type,
      weekStartDay: filter?.weekStartDay,
      start: filter?.start || filter?.fixedStart || filter?.customStart || "",
      end: filter?.end || filter?.fixedEnd || filter?.customEnd || "",
      seedStart: filter?.seedStart || filter?.start || "",
      seedEnd: filter?.seedEnd || filter?.end || "",
      repeatUnit: String(filter?.repeatUnit || "weeks"),
      repeatEvery: Math.max(1, Math.round(Number(filter?.repeatEvery) || 1)),
      occurrence: ["previous", "current", "next"].includes(filter?.occurrence) ? filter.occurrence : "current",
    };
  };
  const legacyPresetToFilter = (preset, index = 0) => {
    const record = typeof preset === "string"
      ? timeframePresetById(preset) || { id: preset, label: preset }
      : { id: preset?.id, label: preset?.label || preset?.id };
    return normalizeTimeframeFilter({ id: `time-${record.id || index}`, label: record.label, type: record.id }, index);
  };
  const normalizeTimeframeFilters = (config = {}) => {
    if (Array.isArray(config.filters)) {
      return config.filters.map(normalizeTimeframeFilter).filter((filter) => filter.id && filter.type);
    }
    const configured = Array.isArray(config.presets) && config.presets.length
      ? config.presets.map(legacyPresetToFilter)
      : DEFAULT_TIMEFRAME_FILTERS.map((filter, index) => normalizeTimeframeFilter(filter, index));
    return configured.filter((filter) => filter.id && filter.type);
  };
  const selectedTimeframeFilterId = (config = {}, filters = normalizeTimeframeFilters(config)) => {
    const explicitId = String(config.selectedFilterId || "").trim();
    if (explicitId && filters.some((filter) => filter.id === explicitId)) return explicitId;
    const preset = String(config.selectedPreset || config.preset || "").trim();
    const presetMatch = preset ? filters.find((filter) => filter.type === preset || filter.id === preset || filter.id === `time-${preset}`) : null;
    return presetMatch?.id || "";
  };
  const monthRange = (today, offset = 0) => {
    const monthStart = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
    return { start: dateOnly(monthStart), end: dateOnly(monthEnd) };
  };
  const weekRange = (today, weekStartDay = 0, offsetWeeks = 0) => {
    const startDay = normalizeWeekStartDay(weekStartDay);
    const delta = (today.getDay() - startDay + 7) % 7;
    const start = shiftedDate(today, -delta + (offsetWeeks * 7));
    return { start: dateOnly(start), end: dateOnly(shiftedDate(start, 6)) };
  };
  const repeatingIntervalRange = (filter, today) => {
    const seedStart = parseDateOnly(filter.seedStart);
    const seedEnd = parseDateOnly(filter.seedEnd);
    if (!seedStart || !seedEnd) return null;
    const seedLengthDays = Math.max(1, daysBetween(seedStart, seedEnd) + 1);
    const repeatEvery = Math.max(1, Math.round(Number(filter.repeatEvery) || 1));
    const repeatUnit = String(filter.repeatUnit || "weeks");
    const occurrenceOffset = filter.occurrence === "previous" ? -1 : filter.occurrence === "next" ? 1 : 0;
    let start;
    if (repeatUnit === "monthly") {
      const monthDiff = ((today.getFullYear() - seedStart.getFullYear()) * 12) + (today.getMonth() - seedStart.getMonth());
      let cycles = Math.floor(monthDiff / repeatEvery);
      let candidate = addMonths(seedStart, cycles * repeatEvery);
      if (candidate > today) {
        cycles -= 1;
        candidate = addMonths(seedStart, cycles * repeatEvery);
      }
      start = addMonths(seedStart, (cycles + occurrenceOffset) * repeatEvery);
    } else {
      const stepDays = repeatUnit === "days" ? repeatEvery : repeatEvery * 7;
      let cycles = Math.floor(daysBetween(seedStart, today) / stepDays);
      let candidate = shiftedDate(seedStart, cycles * stepDays);
      if (candidate > today) {
        cycles -= 1;
        candidate = shiftedDate(seedStart, cycles * stepDays);
      }
      start = shiftedDate(seedStart, (cycles + occurrenceOffset) * stepDays);
    }
    const end = shiftedDate(start, seedLengthDays - 1);
    return { start: dateOnly(start), end: dateOnly(end) };
  };
  const resolveTimeframeFilter = (filter, config = {}, resolvedContext = {}, now = null) => {
    const normalized = normalizeTimeframeFilter(filter);
    const today = now ? localDateFrom(now) : localToday();
    const weekStartDay = normalized.weekStartDay ?? config.weekStartDay ?? 0;
    let range = null;
    if (normalized.type === "today") range = { start: dateOnly(today), end: dateOnly(today) };
    if (normalized.type === "yesterday") {
      const day = shiftedDate(today, -1);
      range = { start: dateOnly(day), end: dateOnly(day) };
    }
    if (normalized.type === "this_week") range = weekRange(today, weekStartDay, 0);
    if (normalized.type === "last_week") range = weekRange(today, weekStartDay, -1);
    if (normalized.type === "this_month") range = monthRange(today, 0);
    if (normalized.type === "last_month") range = monthRange(today, -1);
    if (normalized.type === "custom_fixed" || normalized.type === "custom") {
      range = { start: normalized.start || config.customStart || "", end: normalized.end || config.customEnd || "" };
    }
    if (normalized.type === "custom_repeating") range = repeatingIntervalRange(normalized, today);
    if (normalized.type === "last_7_days") range = { start: dateOnly(shiftedDate(today, -6)), end: dateOnly(today) };
    if (normalized.type === "last_14_days") range = { start: dateOnly(shiftedDate(today, -13)), end: dateOnly(today) };
    if (normalized.type === "last_30_days") range = { start: dateOnly(shiftedDate(today, -29)), end: dateOnly(today) };
    if (normalized.type === "last_60_days") range = { start: dateOnly(shiftedDate(today, -59)), end: dateOnly(today) };
    if (normalized.type === "last_180_days") range = { start: dateOnly(shiftedDate(today, -179)), end: dateOnly(today) };
    if (normalized.type === "last_365_days") range = { start: dateOnly(shiftedDate(today, -364)), end: dateOnly(today) };
    if (normalized.type === "month_to_date") range = { start: dateOnly(new Date(today.getFullYear(), today.getMonth(), 1)), end: dateOnly(today) };
    if (normalized.type === "year_to_date") range = { start: dateOnly(new Date(today.getFullYear(), 0, 1)), end: dateOnly(today) };
    if (!range?.start && !range?.end) return null;
    const field = String(config.field || resolvedContext?.semanticMapping?.dateField || "").trim();
    return {
      field: field || undefined,
      start: range.start || undefined,
      end: range.end || undefined,
      preset: normalized.type,
      filterId: normalized.id,
      label: ["custom", "custom_fixed"].includes(normalized.type)
        ? timeframeLabel(range, normalized.label || "Custom range")
        : normalized.label || timeframeLabel(range, "Time range"),
    };
  };
  const resolveTimeRangeConfig = (config = {}, resolvedContext = {}, now = null) => {
    const filters = normalizeTimeframeFilters(config);
    const selectedFilter = filters.find((filter) => filter.id === selectedTimeframeFilterId(config, filters));
    if (selectedFilter) return resolveTimeframeFilter(selectedFilter, config, resolvedContext, now);
    const preset = String(config.selectedPreset || config.preset || "").trim();
    const explicit = config.timeRange && typeof config.timeRange === "object" ? config.timeRange : null;
    const field = String(config.field || explicit?.field || resolvedContext?.semanticMapping?.dateField || "").trim();
    const today = now ? localDateFrom(now) : localToday();
    let start = "";
    let end = "";
    let label = "";
    if (preset === "custom" || explicit?.preset === "custom") {
      start = config.customStart || explicit?.start || "";
      end = config.customEnd || explicit?.end || "";
      label = start || end ? timeframeLabel({ start, end }, "Custom range") : "Custom range";
    } else if (preset === "today") {
      start = dateOnly(today);
      end = dateOnly(today);
      label = "Today";
    } else if (preset === "yesterday") {
      const day = shiftedDate(today, -1);
      start = dateOnly(day);
      end = dateOnly(day);
      label = "Yesterday";
    } else if (preset === "last_7_days") {
      start = dateOnly(shiftedDate(today, -6));
      end = dateOnly(today);
      label = "1w";
    } else if (preset === "last_14_days") {
      start = dateOnly(shiftedDate(today, -13));
      end = dateOnly(today);
      label = "2w";
    } else if (preset === "last_30_days") {
      start = dateOnly(shiftedDate(today, -29));
      end = dateOnly(today);
      label = "1m";
    } else if (preset === "last_60_days") {
      start = dateOnly(shiftedDate(today, -59));
      end = dateOnly(today);
      label = "2m";
    } else if (preset === "last_180_days") {
      start = dateOnly(shiftedDate(today, -179));
      end = dateOnly(today);
      label = "6m";
    } else if (preset === "last_365_days") {
      start = dateOnly(shiftedDate(today, -364));
      end = dateOnly(today);
      label = "1yr";
    } else if (preset === "month_to_date") {
      start = dateOnly(new Date(today.getFullYear(), today.getMonth(), 1));
      end = dateOnly(today);
      label = "Month to date";
    } else if (preset === "year_to_date") {
      start = dateOnly(new Date(today.getFullYear(), 0, 1));
      end = dateOnly(today);
      label = "Year to date";
    } else if (explicit?.start || explicit?.end) {
      start = explicit.start || "";
      end = explicit.end || "";
      label = timeframeLabel(explicit, config.activeLabel || "Custom range");
    }
    if (!start && !end) return null;
    return {
      field: field || undefined,
      start: start || undefined,
      end: end || undefined,
      preset: preset || explicit?.preset || "custom",
      label,
    };
  };

  const chartDefinitions = new Map();
  const CHART_AGGREGATIONS = ["count", "sum", "avg", "min", "max"];
  const chartTypeAliases = {
    horizontalBar: "horizontal-bar",
    groupedBar: "grouped-bar",
    stackedBar: "stacked-bar",
    stackedArea: "stacked-area",
    multiLine: "multi-line",
    radialProgress: "radial-progress",
    kpiTrend: "kpi-trend",
  };

  const chartDensityFor = (instance) => {
    const cols = Number(instance?.cols) || 1;
    const rows = Number(instance?.rows) || 1;
    if (cols <= 2 && rows <= 1) return "tiny";
    const tier = normalizeDensity(instance?.density, resolveWidgetDensity(instance));
    return chartVisualDensity(tier);
  };

  const chartSemantic = (resolvedContext) => resolvedContext?.semanticMapping || {};
  const chartField = (config, resolvedContext, key, fallbacks = []) => {
    const explicit = String(config?.[key] || "").trim();
    if (explicit) return explicit;
    const mapping = chartSemantic(resolvedContext);
    return fallbacks.map((field) => mapping[field]).find(Boolean) || "";
  };
  const chartValueField = (config, resolvedContext) => chartField(config, resolvedContext, "yField", ["valueField"]);
  const chartXField = (config, resolvedContext) => chartField(config, resolvedContext, "xField", ["dateField", "categoryField", "labelField"]);
  const chartSeriesField = (config, resolvedContext) => chartField(config, resolvedContext, "seriesField", ["categoryField", "statusField", "ownerField"]);
  const chartConfiguredAggregation = (config) => CHART_AGGREGATIONS.includes(config?.aggregation) ? config.aggregation : "count";
  const chartDisplayConfig = (config) => ({
    showLegend: config?.display?.showLegend !== false,
    showAxes: config?.display?.showAxes !== false,
    showGrid: Boolean(config?.display?.showGrid),
    showLabels: config?.display?.showLabels !== false,
  });
  const chartLimit = (config, fallback = 60) => {
    const value = Number(config?.limit);
    return Number.isFinite(value) ? Math.max(1, value) : fallback;
  };
  const chartEscapeLabel = (value) => String(value ?? "").trim() || "Unlabeled";
  const chartSort = (points, config, defaultSort = "x") => {
    const direction = config?.sortDirection === "desc" ? -1 : 1;
    const sortBy = config?.sortBy || defaultSort;
    return [...points].sort((a, b) => {
      const av = sortBy === "value" || sortBy === "y" ? a.value ?? a.y : a.x;
      const bv = sortBy === "value" || sortBy === "y" ? b.value ?? b.y : b.x;
      if (av === bv) return 0;
      return av > bv ? direction : -direction;
    });
  };
  const chartRequiredFieldMessage = (definition, config, resolvedContext) => {
    const supportedAggregations = Array.isArray(definition.supportedAggregations) && definition.supportedAggregations.length
      ? definition.supportedAggregations
      : CHART_AGGREGATIONS;
    if (config?.aggregation && !supportedAggregations.includes(config.aggregation)) return "Missing aggregation";
    const aggregation = chartConfiguredAggregation(config);
    const needsX = definition.requiredFields.includes("xField");
    const needsY = definition.requiredFields.includes("yField") || (definition.valueRequiredForAggregation !== false && aggregation !== "count");
    const needsSeries = definition.requiredFields.includes("seriesField");
    if (needsX && !chartXField(config, resolvedContext)) return "Missing x field";
    if (needsY && !chartValueField(config, resolvedContext)) return "Missing y field";
    if (needsSeries && !chartSeriesField(config, resolvedContext)) return "Missing series field";
    return "";
  };
  const chartQueryFieldsFor = (definition, config, resolvedContext) => {
    const fields = unique([
      chartXField(config, resolvedContext),
      chartValueField(config, resolvedContext),
      chartSeriesField(config, resolvedContext),
      chartField(config, resolvedContext, "sizeField", ["valueField"]),
      chartField(config, resolvedContext, "colorField", ["categoryField"]),
      ...defaultQueryFields(resolvedContext),
    ]);
    return definition.queryUsesAllFields ? fields : fields.filter(Boolean);
  };
  const aggregateValues = (values, aggregation) => {
    const numeric = values.map(numberValue).filter((value) => value != null);
    if (aggregation === "count") return values.length;
    if (!numeric.length) return null;
    if (aggregation === "sum") return numeric.reduce((sum, value) => sum + value, 0);
    if (aggregation === "avg") return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
    if (aggregation === "min") return Math.min(...numeric);
    if (aggregation === "max") return Math.max(...numeric);
    return values.length;
  };
  const groupedChartData = (rows, config, resolvedContext, options = {}) => {
    const xField = chartXField(config, resolvedContext);
    const yField = chartValueField(config, resolvedContext);
    const seriesField = options.series ? chartSeriesField(config, resolvedContext) : "";
    const aggregation = chartConfiguredAggregation(config);
    const groups = new Map();
    rows.forEach((row, index) => {
      const x = chartEscapeLabel(xField ? row?.[xField] : index + 1);
      const series = seriesField ? chartEscapeLabel(row?.[seriesField]) : "Value";
      const key = `${x}\u0000${series}`;
      if (!groups.has(key)) groups.set(key, { x, series, raw: [] });
      groups.get(key).raw.push(aggregation === "count" ? 1 : row?.[yField]);
    });
    return chartSort([...groups.values()].map((entry) => ({
      ...entry,
      value: aggregateValues(entry.raw, aggregation),
    })).filter((entry) => entry.value != null), config, "x").slice(0, chartLimit(config, 24));
  };
  const numericRowsFor = (rows, field) => rows.map((row) => ({
    row,
    value: numberValue(row?.[field]),
  })).filter((entry) => entry.value != null);
  const chartFrame = ({ instance, definition, density, body, legend = "", data = null, resolvedContext = null }) => {
    const densityTier = normalizeDensity(instance?.density, resolveWidgetDensity(instance));
    const contextLabel = chartContextLabel(resolvedContext || {}, data);
    const traceable = Boolean(resolvedContext?.dataSourceId || data?.sourceId || data?.metadata?.lineage);
    return `
      <div class="runtime-chart-widget runtime-chart-density-${density} widget-density-${densityTier}" data-density="${escapeHtml(densityTier)}" data-runtime-state="ready" data-runtime-source="${escapeHtml(runtimeSource(data))}" data-runtime-traceable="${traceable ? "true" : "false"}" data-runtime-context="${escapeHtml(contextLabel)}" data-chart-type="${escapeHtml(definition.chartType)}" data-chart-category="${escapeHtml(definition.category || "general")}">
        <div class="runtime-chart-stage">${body}</div>
        ${legend}
      </div>`;
  };
  const renderEchartsChartFrame = ({ instance, definition, rows, resolvedContext, data }) => {
    const config = instance.config || {};
    const density = chartDensityFor(instance);
    const title = config.title || definition.displayName || "Chart";
    const points = groupedChartData(rows, config, resolvedContext, { series: ["grouped-bar", "stacked-bar"].includes(definition.chartType) });
    return chartFrame({
      instance,
      definition,
      density,
      body: `<div class="widget-content-well widget-library-surface runtime-chart-library-surface"><div class="runtime-chart-echarts" data-chart-renderer="echarts" data-chart-type="${escapeHtml(definition.chartType)}" role="img" aria-label="${escapeHtml(title)}"></div></div>`,
      legend: "",
      data,
      resolvedContext,
    });
  };
  const chartCssValue = (element, name, fallback) => {
    const value = element ? getComputedStyle(element).getPropertyValue(name).trim() : "";
    return value || fallback;
  };
  const chartLegacyColor = (value) => {
    const match = String(value || "").match(/^color\(\s*srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\s*\)$/i);
    if (!match) return value;
    const channels = match.slice(1, 4).map((channel) => Math.round(Math.max(0, Math.min(1, Number(channel))) * 255));
    const alpha = match[4] == null ? 1 : Math.max(0, Math.min(1, Number(match[4])));
    return alpha >= 1 ? `rgb(${channels.join(", ")})` : `rgba(${channels.join(", ")}, ${alpha})`;
  };
  const chartResolvedColor = (element, name, fallback) => {
    const raw = chartCssValue(element, name, fallback);
    if (!element || !raw) return fallback;
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.opacity = "0";
    probe.style.pointerEvents = "none";
    probe.style.color = raw;
    element.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return chartLegacyColor(resolved || raw || fallback);
  };
  const chartPaletteForElement = (element) => [
    "--widget-data-primary",
    "--widget-data-secondary",
    "--widget-data-tertiary",
    "--widget-data-quaternary",
    "--widget-data-positive",
    "--widget-data-quiet",
  ].map((name, index) => chartResolvedColor(element, name, ["#2563eb", "#60a5fa", "#93c5fd", "#fca5a5", "#86efac", "#c4b5fd"][index]));
  const chartAxisStyle = (element) => ({
    text: chartResolvedColor(element, "--widget-library-muted", "#4b5563"),
    line: chartResolvedColor(element, "--widget-library-grid", "rgba(100, 116, 139, .24)"),
    strong: chartResolvedColor(element, "--widget-library-fg", "#1f2937"),
  });
  let echartsLoadPromise = null;
  const loadEcharts = () => {
    if (window.echarts?.init) return Promise.resolve(window.echarts);
    if (!echartsLoadPromise) {
      echartsLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector("script[data-dashboard-echarts]");
        if (existing) {
          existing.addEventListener("load", () => window.echarts?.init ? resolve(window.echarts) : reject(new Error("ECharts failed to initialize")), { once: true });
          existing.addEventListener("error", () => reject(new Error("ECharts failed to load")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js";
        script.async = true;
        script.dataset.dashboardEcharts = "true";
        script.onload = () => window.echarts?.init ? resolve(window.echarts) : reject(new Error("ECharts failed to initialize"));
        script.onerror = () => reject(new Error("ECharts failed to load"));
        document.head.appendChild(script);
      });
    }
    return echartsLoadPromise;
  };
  const chartSeriesData = (rows, config, resolvedContext, options = {}) => {
    const xField = chartXField(config, resolvedContext);
    const yField = chartValueField(config, resolvedContext);
    const seriesField = options.series ? chartSeriesField(config, resolvedContext) : "";
    const groups = groupedChartData(rows, config, resolvedContext, { series: Boolean(seriesField) });
    const categories = unique(groups.map((point) => point.x));
    const seriesNames = unique(groups.map((point) => point.series));
    return {
      categories,
      seriesNames,
      groups,
      xField,
      yField,
      series: seriesNames.map((name) => ({
        name,
        data: categories.map((category) => groups.find((point) => point.x === category && point.series === name)?.value ?? 0),
      })),
    };
  };
  const chartEchartsOption = ({ instance, definition, rows, resolvedContext, data, element }) => {
    const config = instance.config || {};
    const chartType = definition.chartType;
    const colors = chartPaletteForElement(element);
    const axis = chartAxisStyle(element);
    const display = chartDisplayConfig(config);
    const base = {
      backgroundColor: "transparent",
      color: colors,
      animation: true,
      animationDuration: 220,
      textStyle: { color: axis.text, fontFamily: "inherit" },
      tooltip: { trigger: "item", confine: true },
      grid: { left: 28, right: 12, top: 14, bottom: 24, containLabel: true },
    };
    if (["bar", "horizontal-bar", "grouped-bar", "stacked-bar", "lollipop"].includes(chartType)) {
      const usesSeries = ["grouped-bar", "stacked-bar"].includes(chartType);
      const model = chartSeriesData(rows, config, resolvedContext, { series: usesSeries });
      const horizontal = chartType === "horizontal-bar";
      return {
        ...base,
        tooltip: { trigger: "axis", confine: true },
        legend: display.showLegend && usesSeries ? { bottom: 0, textStyle: { color: axis.text, fontSize: 10 } } : undefined,
        xAxis: horizontal ? { type: "value", axisLabel: { color: axis.text }, splitLine: { lineStyle: { color: axis.line } } } : { type: "category", data: model.categories, axisLabel: { color: axis.text }, axisLine: { lineStyle: { color: axis.line } } },
        yAxis: horizontal ? { type: "category", data: model.categories, axisLabel: { color: axis.text }, axisLine: { lineStyle: { color: axis.line } } } : { type: "value", axisLabel: { color: axis.text }, splitLine: { show: display.showGrid, lineStyle: { color: axis.line } } },
        series: model.series.map((series) => ({
          name: series.name,
          type: "bar",
          stack: chartType === "stacked-bar" ? "total" : undefined,
          barMaxWidth: chartType === "lollipop" ? 8 : 18,
          data: series.data,
          itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
        })),
      };
    }
    if (["line", "multi-line", "area", "stacked-area", "sparkline"].includes(chartType)) {
      const usesSeries = ["multi-line", "stacked-area"].includes(chartType);
      const model = chartSeriesData(rows, config, resolvedContext, { series: usesSeries });
      return {
        ...base,
        tooltip: { trigger: "axis", confine: true },
        grid: chartType === "sparkline" ? { left: 4, right: 4, top: 4, bottom: 4 } : base.grid,
        legend: display.showLegend && usesSeries && chartType !== "sparkline" ? { bottom: 0, textStyle: { color: axis.text, fontSize: 10 } } : undefined,
        xAxis: { type: "category", show: chartType !== "sparkline" && display.showAxes, data: model.categories, axisLabel: { color: axis.text }, axisLine: { lineStyle: { color: axis.line } } },
        yAxis: { type: "value", show: chartType !== "sparkline" && display.showAxes, axisLabel: { color: axis.text }, splitLine: { show: display.showGrid, lineStyle: { color: axis.line } } },
        series: model.series.map((series) => ({
          name: series.name,
          type: "line",
          smooth: true,
          showSymbol: chartType !== "sparkline",
          areaStyle: ["area", "stacked-area"].includes(chartType) ? { opacity: .22 } : undefined,
          stack: chartType === "stacked-area" ? "total" : undefined,
          data: series.data,
        })),
      };
    }
    if (["pie", "donut"].includes(chartType)) {
      const points = groupedChartData(rows, config, resolvedContext).filter((point) => point.value > 0).slice(0, chartLimit(config, 8));
      return {
        ...base,
        legend: display.showLegend ? { bottom: 0, textStyle: { color: axis.text, fontSize: 10 } } : undefined,
        series: [{
          type: "pie",
          radius: chartType === "donut" ? ["44%", "72%"] : "72%",
          center: ["50%", display.showLegend ? "44%" : "50%"],
          label: { show: display.showLabels, color: axis.text, fontSize: 10 },
          data: points.map((point) => ({ name: point.x, value: point.value })),
        }],
      };
    }
    if (["scatter", "bubble"].includes(chartType)) {
      const xField = chartXField(config, resolvedContext);
      const yField = chartValueField(config, resolvedContext);
      const sizeField = chartField(config, resolvedContext, "sizeField", ["valueField"]);
      const points = rows.map((row) => ({
        x: numberValue(row?.[xField]),
        y: numberValue(row?.[yField]),
        size: numberValue(row?.[sizeField]),
      })).filter((point) => point.x != null && point.y != null).slice(0, chartLimit(config, 80));
      return {
        ...base,
        xAxis: { type: "value", axisLabel: { color: axis.text }, splitLine: { lineStyle: { color: axis.line } } },
        yAxis: { type: "value", axisLabel: { color: axis.text }, splitLine: { lineStyle: { color: axis.line } } },
        series: [{
          type: "scatter",
          symbolSize: (value) => chartType === "bubble" ? Math.max(7, Math.min(24, Number(value?.[2]) || 8)) : 8,
          data: points.map((point) => [point.x, point.y, point.size || 8]),
        }],
      };
    }
    if (["histogram", "box-plot"].includes(chartType)) {
      const values = numericRowsFor(rows, chartValueField(config, resolvedContext)).map((entry) => entry.value);
      const min = Math.min(...values);
      const max = Math.max(...values, min + 1);
      const binCount = chartDensityFor(instance) === "large" ? 8 : 6;
      const bins = Array.from({ length: binCount }, (_, index) => ({ name: `${index + 1}`, value: 0 }));
      values.forEach((value) => {
        const index = Math.min(binCount - 1, Math.floor(((value - min) / Math.max(1, max - min)) * binCount));
        bins[index].value += 1;
      });
      return {
        ...base,
        tooltip: { trigger: "axis", confine: true },
        xAxis: { type: "category", data: bins.map((bin) => bin.name), axisLabel: { color: axis.text }, axisLine: { lineStyle: { color: axis.line } } },
        yAxis: { type: "value", axisLabel: { color: axis.text }, splitLine: { show: display.showGrid, lineStyle: { color: axis.line } } },
        series: [{ type: "bar", data: bins.map((bin) => bin.value), barMaxWidth: 18, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
      };
    }
    if (chartType === "heatmap") {
      const xField = chartXField(config, resolvedContext);
      const yField = chartSeriesField(config, resolvedContext);
      const valueField = chartValueField(config, resolvedContext);
      const xValues = unique(rows.map((row) => chartEscapeLabel(row?.[xField]))).slice(0, 8);
      const yValues = unique(rows.map((row) => chartEscapeLabel(row?.[yField]))).slice(0, 6);
      const cells = [];
      xValues.forEach((x, xIndex) => yValues.forEach((y, yIndex) => {
        const matching = rows.filter((row) => chartEscapeLabel(row?.[xField]) === x && chartEscapeLabel(row?.[yField]) === y);
        cells.push([xIndex, yIndex, aggregateValues(matching.map((row) => chartConfiguredAggregation(config) === "count" ? 1 : row?.[valueField]), chartConfiguredAggregation(config)) || 0]);
      }));
      return {
        ...base,
        tooltip: { position: "top", confine: true },
        grid: { left: 34, right: 12, top: 12, bottom: 28 },
        xAxis: { type: "category", data: xValues, axisLabel: { color: axis.text }, splitArea: { show: true } },
        yAxis: { type: "category", data: yValues, axisLabel: { color: axis.text }, splitArea: { show: true } },
        visualMap: { show: false, min: 0, max: Math.max(...cells.map((cell) => cell[2]), 1), inRange: { color: [colors[2], colors[0]] } },
        series: [{ type: "heatmap", data: cells, label: { show: false } }],
      };
    }
    if (["gauge", "radial-progress", "progress-bar"].includes(chartType)) {
      const values = numericRowsFor(rows, chartValueField(config, resolvedContext)).map((entry) => entry.value);
      const value = aggregateValues(values, chartConfiguredAggregation(config)) || 0;
      const max = Number(config.max) || Math.max(value, ...values, 100);
      if (chartType === "progress-bar") {
        return {
          ...base,
          grid: { left: 8, right: 8, top: 26, bottom: 20 },
          xAxis: { type: "value", show: false, max },
          yAxis: { type: "category", show: false, data: [config.title || definition.displayName] },
          series: [{ type: "bar", data: [value], barWidth: 18, itemStyle: { borderRadius: 9 }, label: { show: true, position: "inside", color: axis.strong, formatter: () => formatMetricValue(value, config.format) } }],
        };
      }
      return {
        ...base,
        series: [{
          type: "gauge",
          min: 0,
          max,
          progress: { show: true, roundCap: true },
          axisLine: { roundCap: true, lineStyle: { width: 9 } },
          pointer: { show: chartType === "gauge" },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: { color: axis.strong, fontSize: 16, formatter: () => chartType === "radial-progress" ? `${Math.round((value / Math.max(1, max)) * 100)}%` : formatMetricValue(value, config.format) },
          data: [{ value }],
        }],
      };
    }
    if (chartType === "kpi-trend") {
      const values = numericRowsFor(rows, chartValueField(config, resolvedContext)).map((entry) => entry.value).slice(0, chartLimit(config, 60));
      return {
        ...base,
        grid: { left: 8, right: 8, top: 18, bottom: 8 },
        title: { text: values.length ? formatMetricValue(values.at(-1), config.format) : "", textStyle: { color: axis.strong, fontSize: 18, fontWeight: 800 }, left: 4, top: 0 },
        xAxis: { type: "category", show: false, data: values.map((_, index) => index + 1) },
        yAxis: { type: "value", show: false },
        series: [{ type: "line", smooth: true, showSymbol: false, data: values, areaStyle: { opacity: .18 } }],
      };
    }
    return { ...base, series: [] };
  };
  let tanstackTableLoadPromise = null;
  const loadTanstackTable = () => {
    if (window.TableCore?.createTable) return Promise.resolve(window.TableCore);
    if (!tanstackTableLoadPromise) {
      tanstackTableLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector("script[data-dashboard-tanstack-table]");
        if (existing) {
          existing.addEventListener("load", () => window.TableCore?.createTable ? resolve(window.TableCore) : reject(new Error("TanStack Table failed to initialize")), { once: true });
          existing.addEventListener("error", () => reject(new Error("TanStack Table failed to load")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@tanstack/table-core@8/build/umd/index.development.js";
        script.async = true;
        script.dataset.dashboardTanstackTable = "true";
        script.onload = () => window.TableCore?.createTable ? resolve(window.TableCore) : reject(new Error("TanStack Table failed to initialize"));
        script.onerror = () => reject(new Error("TanStack Table failed to load"));
        document.head.appendChild(script);
      });
    }
    return tanstackTableLoadPromise;
  };

  const mountTableBodyRenderer = ({ contentRoot, instance, resolvedContext, data, status }) => {
    const target = contentRoot?.querySelector?.(".runtime-table-tanstack");
    if (!target || status !== "ready") return null;
    const config = instance?.config || {};
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const configuredColumns = tableConfiguredColumns(config);
    const semanticFields = tableSemanticFields(resolvedContext);
    const schemaFields = data?.schema?.fields?.map((f) => f.name) || Object.keys(rows[0] || {});
    const allFields = unique(configuredColumns.length ? configuredColumns : semanticFields.length ? semanticFields : schemaFields);
    const visibleFields = allFields.slice(0, tableVisibleColumnCount(instance.cols));
    const visibleRows = rows.slice(0, tableVisibleRowCount(instance.rows, config.limit));
    let disposed = false;
    loadTanstackTable()
      .then((TableCore) => {
        if (disposed || !target.isConnected) return;
        const { createTable, getCoreRowModel } = TableCore;
        const columnDefs = visibleFields.map((key) => ({
          id: key,
          accessorKey: key,
          header: key,
        }));
        const tableInitialState = {
          columnOrder: [],
          columnVisibility: {},
          columnPinning: { left: [], right: [] },
          columnSizing: {},
          columnSizingInfo: { columnSizingStart: [], deltaOffset: null, deltaPercentage: null, isResizingColumn: false, startOffset: null, startSize: null },
          expanded: {},
          globalFilter: "",
          grouping: [],
          pagination: { pageIndex: 0, pageSize: 50 },
          rowPinning: { top: [], bottom: [] },
          rowSelection: {},
          sorting: [],
          columnFilters: [],
        };
        const table = createTable({
          data: visibleRows,
          columns: columnDefs,
          getCoreRowModel: getCoreRowModel(),
          state: tableInitialState,
          onStateChange: () => {},
          renderFallbackValue: "",
        });
        const tableEl = document.createElement("table");
        tableEl.className = "runtime-table";
        tableEl.setAttribute("role", "grid");
        tableEl.setAttribute("aria-label", config.title || "Table");
        const thead = document.createElement("thead");
        const headerTr = document.createElement("tr");
        table.getHeaderGroups().forEach((hg) => {
          hg.headers.forEach((header) => {
            const th = document.createElement("th");
            const label = String(header.column.columnDef.header || header.id);
            th.textContent = label;
            th.title = label;
            headerTr.appendChild(th);
          });
        });
        thead.appendChild(headerTr);
        tableEl.appendChild(thead);
        const tbody = document.createElement("tbody");
        table.getRowModel().rows.forEach((row) => {
          const tr = document.createElement("tr");
          row.getVisibleCells().forEach((cell) => {
            const td = document.createElement("td");
            const value = String(cell.getValue() ?? "");
            td.textContent = value;
            td.title = value;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        tableEl.appendChild(tbody);
        target.appendChild(tableEl);
      })
      .catch((error) => {
        if (disposed || !target.isConnected) return;
        target.innerHTML = `<div class="widget-runtime-state" data-runtime-state="error"><span class="stat-lbl">${escapeHtml(error?.message || "Unable to load table renderer")}</span></div>`;
      });
    return () => {
      disposed = true;
      if (target.isConnected) target.innerHTML = "";
    };
  };

  let monacoLoadPromise = null;
  const loadMonaco = () => {
    if (window.monaco?.editor?.create) return Promise.resolve(window.monaco);
    if (!monacoLoadPromise) {
      monacoLoadPromise = new Promise((resolve, reject) => {
        if (!window.MonacoEnvironment) {
          window.MonacoEnvironment = {
            getWorkerUrl: () => URL.createObjectURL(new Blob([""], { type: "text/javascript" })),
          };
        }
        const existing = document.querySelector("script[data-dashboard-monaco]");
        const afterLoad = () => {
          window.require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs" } });
          window.require(["vs/editor/editor.main"], () =>
            window.monaco?.editor ? resolve(window.monaco) : reject(new Error("Monaco failed to initialize"))
          );
        };
        if (existing) {
          existing.addEventListener("load", afterLoad, { once: true });
          existing.addEventListener("error", () => reject(new Error("Monaco failed to load")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs/loader.js";
        script.async = true;
        script.dataset.dashboardMonaco = "true";
        script.onload = afterLoad;
        script.onerror = () => reject(new Error("Monaco failed to load"));
        document.head.appendChild(script);
      });
    }
    return monacoLoadPromise;
  };

  const mountMonacoBodyRenderer = ({ contentRoot, content, language }) => {
    const target = contentRoot?.querySelector?.(".runtime-monaco-editor");
    if (!target) return null;
    let disposed = false;
    let editor = null;
    let resizeObserver = null;
    loadMonaco()
      .then((monaco) => {
        if (disposed || !target.isConnected) return;
        editor = monaco.editor.create(target, {
          value: content,
          language,
          readOnly: true,
          theme: "vs",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: false,
          wordWrap: "on",
          fontSize: 12,
          lineNumbers: "off",
          folding: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
          contextmenu: false,
          links: false,
        });
        resizeObserver = new ResizeObserver(() => editor?.layout());
        resizeObserver.observe(target);
        requestAnimationFrame(() => editor?.layout());
      })
      .catch((error) => {
        if (disposed || !target.isConnected) return;
        target.innerHTML = `<div class="widget-runtime-state" data-runtime-state="error"><span class="stat-lbl">${escapeHtml(error?.message || "Unable to load editor")}</span></div>`;
      });
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      editor?.dispose();
      editor = null;
    };
  };

  const mountChartBodyRenderer = ({ contentRoot, instance, definition, resolvedContext, data, status }) => {
    const target = contentRoot?.querySelector?.(".runtime-chart-echarts");
    if (!target || status !== "ready") return null;
    const config = instance?.config || {};
    const chartDefinition = getChartDefinition(config.chartType || "bar") || definition;
    let disposed = false;
    let chart = null;
    let resizeObserver = null;
    loadEcharts()
      .then((echarts) => {
        if (disposed || !target.isConnected) return;
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        chart = echarts.init(target, null, { renderer: "svg" });
        chart.setOption(chartEchartsOption({ instance, definition: chartDefinition, rows, resolvedContext, data, element: target }), true);
        resizeObserver = new ResizeObserver(() => chart?.resize());
        resizeObserver.observe(target);
        requestAnimationFrame(() => chart?.resize());
      })
      .catch((error) => {
        if (disposed || !target.isConnected) return;
        target.innerHTML = `<div class="widget-runtime-state" data-runtime-state="error"><span class="stat-lbl">${escapeHtml(error?.message || "Unable to load chart renderer")}</span></div>`;
      });
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (chart && !chart.isDisposed?.()) chart.dispose();
      chart = null;
    };
  };
  const registerChartDefinition = (definition) => {
    const chartType = String(definition?.chartType || "").trim();
    if (!chartType) return false;
    chartDefinitions.set(chartType, {
      category: "general",
      requiredFields: [],
      supportedAggregations: CHART_AGGREGATIONS,
      defaultConfig: {},
      valueRequiredForAggregation: true,
      render: renderEchartsChartFrame,
      ...definition,
      chartType,
      displayName: definition.displayName || chartType,
    });
    return true;
  };
  const getChartDefinition = (chartType) => chartDefinitions.get(chartTypeAliases[chartType] || chartType) || null;
  const listChartDefinitions = () => [...chartDefinitions.values()].map((definition) => ({
    chartType: definition.chartType,
    displayName: definition.displayName,
    category: definition.category,
    requiredFields: definition.requiredFields,
    supportedAggregations: definition.supportedAggregations,
    defaultConfig: definition.defaultConfig,
  }));
  [
    ["bar", "Bar", "basic-comparison", ["xField"]],
    ["horizontal-bar", "Horizontal Bar", "basic-comparison", ["xField"]],
    ["grouped-bar", "Grouped Bar", "basic-comparison", ["xField", "seriesField"]],
    ["stacked-bar", "Stacked Bar", "basic-comparison", ["xField", "seriesField"]],
    ["lollipop", "Lollipop", "basic-comparison", ["xField"]],
    ["line", "Line", "time-series", ["xField", "yField"]],
    ["multi-line", "Multi-line", "time-series", ["xField", "yField"]],
    ["area", "Area", "time-series", ["xField", "yField"]],
    ["stacked-area", "Stacked Area", "time-series", ["xField", "yField"]],
    ["sparkline", "Sparkline", "time-series", ["xField", "yField"]],
    ["histogram", "Histogram", "distribution", ["yField"]],
    ["box-plot", "Box Plot", "distribution", ["yField"]],
    ["scatter", "Scatter", "relationship", ["xField", "yField"]],
    ["bubble", "Bubble", "relationship", ["xField", "yField"]],
    ["heatmap", "Heatmap", "relationship", ["xField", "seriesField"]],
    ["pie", "Pie", "composition", ["xField"]],
    ["donut", "Donut", "composition", ["xField"]],
    ["gauge", "Gauge", "ranking-progress", ["yField"]],
    ["radial-progress", "Radial Progress", "ranking-progress", ["yField"]],
    ["progress-bar", "Progress Bar", "ranking-progress", ["yField"]],
    ["kpi-trend", "KPI Trend Card", "ranking-progress", ["xField", "yField"]],
  ].forEach(([chartType, displayName, category, requiredFields, render]) => registerChartDefinition({
    chartType,
    displayName,
    category,
    requiredFields,
    render: render || renderEchartsChartFrame,
    defaultConfig: { chartType },
    valueRequiredForAggregation: !["bar", "horizontal-bar", "grouped-bar", "stacked-bar", "lollipop", "pie", "donut", "heatmap"].includes(chartType),
  }));

  const inferRuntimeState = (label = "", helper = "") => {
    const text = `${label} ${helper}`.toLowerCase();
    if (text.includes("loading")) return "loading";
    if (text.includes("error") || text.includes("unable") || text.includes("failed")) return "error";
    if (text.includes("unsupported")) return "unsupported";
    if (text.includes("configure") || text.includes("needs") || text.includes("map a ") || text.includes("no data source")) return "configure";
    if (text.includes("empty") || text.includes("no data") || text.includes("no rows") || text.includes("no map rows") || text.includes("no date rows") || text.includes("no numeric") || text.includes("no valid") || text.includes("no coordinates")) return "empty";
    return "idle";
  };

  const runtimeStateLabel = (state) => ({
    configure: "Configure",
    empty: "Empty",
    error: "Error",
    loading: "Loading",
    unsupported: "Unsupported",
    idle: "State",
  }[state] || "State");

  const runtimeStateDetails = (label = "", helper = "", state = "idle", options = {}) => {
    const text = `${label} ${helper}`.toLowerCase();
    const isConfigure = state === "configure";
    const isEmpty = state === "empty";
    const expected = options.expected || (() => {
      if (text.includes("location") || text.includes("coordinate") || text.includes("geospatial") || text.includes("map")) return "Geospatial rows with location or coordinate fields.";
      if (text.includes("date") || text.includes("time")) return "Dated records from the active context.";
      if (text.includes("numeric") || text.includes("value") || text.includes("metric") || text.includes("gauge") || text.includes("trend")) return "Numeric values mapped to the widget metric.";
      if (text.includes("column") || text.includes("table") || text.includes("row")) return "Rows with configured display columns.";
      if (text.includes("chart") || text.includes("field") || text.includes("group") || text.includes("series") || text.includes("category")) return "Rows with the configured chart fields.";
      if (text.includes("image") || text.includes("video") || text.includes("document") || text.includes("asset") || text.includes("url")) return "A safe configured media asset reference.";
      if (text.includes("data source") || text.includes("source")) return "A dataset from the workspace data substrate.";
      return "Runtime data that matches this widget configuration.";
    })();
    const reason = options.reason || (() => {
      if (state === "loading") return "The query is still hydrating.";
      if (state === "error") return "The runtime adapter reported a load or configuration error.";
      if (state === "unsupported") return "This saved object uses a widget type that is not registered.";
      if (text.includes("no data source") || text.includes("needs data source") || text.includes("configure a data source")) return "No inherited or selected data source is available.";
      if (isConfigure || text.includes("map a ") || text.includes("configure")) return "Required fields or asset settings have not been mapped yet.";
      if (isEmpty && (text.includes("match") || text.includes("current context"))) return "The current context, filters, or time range returned zero rows.";
      if (isEmpty && (text.includes("numeric") || text.includes("coordinate") || text.includes("valid"))) return "Rows exist, but the required field values are missing or incompatible.";
      if (isEmpty) return "The query returned no usable records for this widget.";
      return "The widget is waiting for runtime input.";
    })();
    const action = options.action || (() => {
      if (state === "loading") return "Keep the widget in place while data loads.";
      if (state === "error") return "Open settings or inspect the data source in Engineer Mode.";
      if (state === "unsupported") return "Install or restore the missing registry definition.";
      if (text.includes("data source") || text.includes("needs data source") || text.includes("configure a data source")) return "Select a dataset, origin, or inherited context source.";
      if (text.includes("image") || text.includes("video") || text.includes("document") || text.includes("asset") || text.includes("url")) return "Open settings and provide a safe asset URL or reference.";
      if (isConfigure || text.includes("field") || text.includes("column")) return "Open settings and map the required fields.";
      if (isEmpty && text.includes("current context")) return "Adjust filters, time range, or panel context.";
      if (isEmpty) return "Check source records or broaden the widget scope.";
      return "Configure the widget or connect an input stream.";
    })();
    return { expected, reason, action };
  };

  const runtimeStateDetailMarkup = (details) => {
    const items = [
      ["Expected", details.expected],
      ["Why", details.reason],
      ["Next", details.action],
    ].filter(([, value]) => String(value || "").trim());
    if (!items.length) return "";
    return `<div class="runtime-state-details">${items.map(([label, value]) => `
          <span class="runtime-state-detail"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></span>`).join("")}
        </div>`;
  };

  const runtimeMeta = (primary, data = null, options = {}) => {
    const parts = [primary].filter(Boolean);
    if (options.filtered) parts.push("filtered");
    if (data?.demo) parts.push("demo");
    if (options.stale) parts.push("stale");
    return parts.join(" / ");
  };

  const runtimeSource = (data = null) => data?.demo ? "demo" : "runtime";

  const runtimeState = (label, helper = "", options = {}) => {
    const state = options.state || inferRuntimeState(label, helper);
    const details = runtimeStateDetails(label, helper, state, options);
    const className = ["widget-runtime-state", options.className].filter(Boolean).join(" ");
    return `
      <div class="${escapeHtml(className)}" role="status" data-runtime-state="${escapeHtml(state)}">
        <span class="runtime-state-kicker">${escapeHtml(options.kicker || runtimeStateLabel(state))}</span>
        <span class="stat-val">${escapeHtml(label)}</span>
        ${helper ? `<span class="stat-lbl">${escapeHtml(helper)}</span>` : ""}
        ${runtimeStateDetailMarkup(details)}
      </div>`;
  };

  const safeMediaUrl = (value, kind = "generic") => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    const dataPrefixes = {
      image: ["data:image/"],
      video: ["data:video/"],
      document: ["data:application/pdf", "data:text/"],
    };
    if (lower.startsWith("data:")) {
      return (dataPrefixes[kind] || []).some((prefix) => lower.startsWith(prefix)) ? raw : null;
    }
    if (raw.includes("\\")) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw.startsWith("//") ? null : raw;
    try {
      const parsed = new URL(raw, window.location.origin);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : null;
    } catch {
      return null;
    }
  };

  const safeMediaFit = (value) => ["contain", "cover", "fill", "center"].includes(value) ? value : "contain";
  const mediaState = (label, helper, state = "empty", options = {}) => `
      <div class="media-widget-state media-widget-state-${escapeHtml(state)}" role="status" data-runtime-state="${escapeHtml(state)}">
        <span class="runtime-state-kicker">${escapeHtml(runtimeStateLabel(state))}</span>
        <span class="stat-val">${escapeHtml(label)}</span>
        ${helper ? `<span class="stat-lbl">${escapeHtml(helper)}</span>` : ""}
        ${runtimeStateDetailMarkup(runtimeStateDetails(label, helper, state, options))}
      </div>`;

  const mediaTitle = (config, fallback) => String(config?.title || fallback || "").trim();
  const mediaCaptionMarkup = (caption) => caption
    ? `<div class="media-widget-caption">${escapeHtml(caption)}</div>`
    : "";

  const widgetShellText = (value = "") => String(value ?? "").trim();
  const widgetShellTitle = (definition, instance, props = {}) => {
    if (typeof definition.getTitle === "function") {
      return widgetShellText(definition.getTitle({ ...props, definition, instance }));
    }
    return widgetShellText(instance?.config?.title || instance?.config?.label || definition.displayName || definition.label || definition.type || "Widget");
  };
  const widgetShellMetadata = (definition, instance, props = {}) => {
    if (typeof definition.getMetadata === "function") {
      const metadata = definition.getMetadata({ ...props, definition, instance });
      if (Array.isArray(metadata)) return metadata.map(widgetShellText).filter(Boolean);
      return widgetShellText(metadata) ? [widgetShellText(metadata)] : [];
    }
    return [];
  };
  const widgetShellFooter = (definition, instance, props = {}) => {
    if (typeof definition.getFooter === "function") {
      return widgetShellText(definition.getFooter({ ...props, definition, instance }));
    }
    return "";
  };
  const widgetShellStateFromMarkup = (html = "", status = "empty") => {
    const text = String(html || "");
    const match = text.match(/data-runtime-state=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
    if (status === "ready") return "ready";
    return status || "empty";
  };
  const renderWidgetShell = (definition, props = {}, content = "") => {
    const instance = props.instance || {};
    const shellConfig = definition.shell && typeof definition.shell === "object" ? definition.shell : {};
    const density = normalizeDensity(props.density || instance.density || "standard");
    const title = widgetShellTitle(definition, instance, props);
    const metadata = widgetShellMetadata(definition, instance, props);
    const footer = widgetShellFooter(definition, instance, props);
    const hideHeaderDensities = new Set(Array.isArray(shellConfig.hideHeaderDensities) ? shellConfig.hideHeaderDensities : []);
    const contentState = widgetShellStateFromMarkup(content, props.status || "empty");
    const showHeader = false;
    const titleClass = ["widget-shell-title", shellConfig.titleClass].filter(Boolean).join(" ");
    const metadataClass = ["widget-shell-meta", shellConfig.metadataClass].filter(Boolean).join(" ");
    const state = contentState;
    const className = [
      "widget-shell",
      `widget-shell-${escapeHtml(definition.type || "widget")}`,
      `widget-shell-density-${escapeHtml(density)}`,
      showHeader ? "widget-shell-has-header" : "",
      footer ? "widget-shell-has-footer" : "",
      shellConfig.mode === "content" ? "widget-shell-content-owned" : "widget-shell-compat",
    ].filter(Boolean).join(" ");
    return `
      <section class="${className}" data-widget-shell="true" data-shell-version="1" data-shell-density="${escapeHtml(density)}" data-shell-runtime-state="${escapeHtml(state)}">
        ${showHeader ? `<header class="widget-shell-header">
          <div class="widget-shell-title-zone">
            <span class="${escapeHtml(titleClass)}">${escapeHtml(title)}</span>
            ${metadata.length ? `<span class="${escapeHtml(metadataClass)}">${metadata.map(escapeHtml).join(" / ")}</span>` : ""}
          </div>
        </header>` : ""}
        <div class="widget-shell-content" data-widget-shell-content="true">
          ${content || runtimeState(title || definition.displayName || "Widget", "No content")}
        </div>
        ${footer ? `<footer class="widget-shell-footer">${footer}</footer>` : ""}
      </section>`;
  };

  const youtubeEmbedUrl = (src) => {
    const safe = safeMediaUrl(src, "video");
    if (!safe) return safe;
    try {
      const url = new URL(safe, window.location.origin);
      const host = url.hostname.replace(/^www\./, "");
      let id = "";
      if (host === "youtu.be") {
        id = url.pathname.split("/").filter(Boolean)[0] || "";
      } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/").filter(Boolean)[1] || "";
        else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/").filter(Boolean)[1] || "";
        else id = url.searchParams.get("v") || "";
      }
      if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
      return `https://www.youtube-nocookie.com/embed/${id}`;
    } catch {
      return null;
    }
  };

  const vimeoEmbedUrl = (src) => {
    const safe = safeMediaUrl(src, "video");
    if (!safe) return safe;
    try {
      const url = new URL(safe, window.location.origin);
      const host = url.hostname.replace(/^www\./, "");
      if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
      const id = url.pathname.split("/").filter(Boolean).pop() || "";
      if (!/^\d+$/.test(id)) return null;
      return `https://player.vimeo.com/video/${id}`;
    } catch {
      return null;
    }
  };

  const documentPreviewKind = (config = {}) => {
    const explicit = String(config.documentType || "unknown").toLowerCase();
    if (["pdf", "markdown", "text", "html"].includes(explicit)) return explicit;
    const src = String(config.src || "").toLowerCase();
    if (src.includes(".pdf") || src.startsWith("data:application/pdf")) return "pdf";
    if (src.startsWith("data:text/")) return "text";
    return "unknown";
  };

  const metaDensity = (instance) => {
    const cols = Number(instance?.cols) || 2;
    const rows = Number(instance?.rows) || 2;
    if (rows <= 1 || cols <= 2) return "compact";
    if (rows >= 3 || cols >= 3) return "expanded";
    return "standard";
  };
  const activityTypeLabel = (type) => String(type || "workspace-update")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const runtimeEventSeverity = (event = {}) => {
    const severity = String(event.severity || event.payload?.severity || "").toLowerCase();
    if (["critical", "error", "warning", "active", "info"].includes(severity)) return severity;
    const type = String(event.type || "").toLowerCase();
    if (/(error|failed|deleted|removed|breach)/.test(type)) return "critical";
    if (/(warn|risk|blocked|collision|stale)/.test(type)) return "warning";
    if (/(created|saved|loaded|signal|dataflow|scenario|ai)/.test(type)) return "active";
    return "info";
  };
  const runtimeEventFreshness = (event = {}) => {
    if (event.freshness) return String(event.freshness);
    const timestamp = Number(event.timestamp) || Date.parse(event.time || "");
    if (!Number.isFinite(timestamp)) return "recent";
    const age = Date.now() - timestamp;
    if (age <= 2 * 60 * 1000) return "recent";
    if (age <= 24 * 60 * 60 * 1000) return "fresh";
    return "stale";
  };
  const shortEventTime = (iso) => {
    const timestamp = Date.parse(iso);
    if (!Number.isFinite(timestamp)) return "Now";
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 45) return "Now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
  };
  const contextScopeLabel = (context = {}) => context.dataSourceName || context.dataSourceId || context.name || "Workspace context";
  const chartContextLabel = (resolvedContext = {}, data = null) => {
    const parts = [];
    const filters = Array.isArray(resolvedContext?.filters) ? resolvedContext.filters.length : 0;
    const time = timeRangeDisplay(resolvedContext?.timeRange);
    if (filters) parts.push(`${filters} filter${filters === 1 ? "" : "s"}`);
    if (time) parts.push(time);
    if (data?.metadata?.scenarioId || resolvedContext?.scenarioId) parts.push("scenario");
    return parts.join(" / ");
  };
  const timeRangeDisplay = (timeRange) => {
    if (!timeRange) return "";
    if (timeRange.label) return timeRange.label;
    if (timeRange.start && timeRange.end) return `${timeRange.start} - ${timeRange.end}`;
    if (timeRange.start) return `Since ${timeRange.start}`;
    if (timeRange.end) return `Until ${timeRange.end}`;
    return "";
  };
  const cloneJson = (value) => JSON.parse(JSON.stringify(value));
  const DEMO_SEMANTIC_MAPPING = {
    dateField: "date",
    valueField: "value",
    labelField: "label",
    categoryField: "category",
    statusField: "state",
    ownerField: "owner",
    locationField: "location",
    latitudeField: "latitude",
    longitudeField: "longitude",
  };
  const DEMO_SCHEMA_FIELDS = [
    { name: "date", type: "date" },
    { name: "label", type: "string" },
    { name: "category", type: "string" },
    { name: "state", type: "string" },
    { name: "owner", type: "string" },
    { name: "location", type: "string" },
    { name: "latitude", type: "number" },
    { name: "longitude", type: "number" },
    { name: "value", type: "number" },
    { name: "comparison", type: "number" },
    { name: "progress", type: "number" },
    { name: "flag", type: "boolean" },
  ];
  const DEMO_ROWS = [
    { date: "2026-05-01", label: "Alpha", category: "North", state: "normal", owner: "Avery", location: "Point A", latitude: 37.71, longitude: -122.39, value: 42, comparison: 36, progress: 0.61, flag: true },
    { date: "2026-05-02", label: "Beta", category: "North", state: "positive", owner: "Blair", location: "Point B", latitude: 37.77, longitude: -122.43, value: 55, comparison: 41, progress: 0.74, flag: true },
    { date: "2026-05-03", label: "Gamma", category: "East", state: "warning", owner: "Casey", location: "Point C", latitude: 37.8, longitude: -122.36, value: 28, comparison: 46, progress: 0.38, flag: false },
    { date: "2026-05-04", label: "Delta", category: "West", state: "negative", owner: "Devon", location: "Point D", latitude: 37.69, longitude: -122.48, value: 19, comparison: 31, progress: 0.22, flag: false },
    { date: "2026-05-05", label: "Epsilon", category: "South", state: "stale", owner: "Emery", location: "Point E", latitude: 37.63, longitude: -122.42, value: 34, comparison: 33, progress: 0.47, flag: true },
    { date: "2026-05-06", label: "Zeta", category: "East", state: "normal", owner: "Finley", location: "Point F", latitude: 37.74, longitude: -122.31, value: 63, comparison: 52, progress: 0.81, flag: true },
    { date: "2026-05-07", label: "Eta", category: "West", state: "positive", owner: "Gray", location: "Point G", latitude: 37.83, longitude: -122.45, value: 71, comparison: 59, progress: 0.88, flag: true },
    { date: "2026-05-08", label: "Theta", category: "South", state: "warning", owner: "Harper", location: "Point H", latitude: 37.67, longitude: -122.34, value: 25, comparison: 29, progress: 0.33, flag: false },
    { date: "2026-05-09", label: "Iota", category: "North", state: "normal", owner: "Indigo", location: "Point I", latitude: 37.9, longitude: -122.4, value: 48, comparison: 43, progress: 0.66, flag: true },
    { date: "2026-05-10", label: "Kappa", category: "East", state: "negative", owner: "Jules", location: "Point J", latitude: 37.58, longitude: -122.29, value: 16, comparison: 24, progress: 0.19, flag: false },
    { date: "2026-05-11", label: "Lambda", category: "South", state: "positive", owner: "Kai", location: "Point K", latitude: 37.72, longitude: -122.51, value: 84, comparison: 67, progress: 0.94, flag: true },
    { date: "2026-05-12", label: "Mu", category: "West", state: "stale", owner: "Lane", location: "Point L", latitude: 37.87, longitude: -122.33, value: 39, comparison: 44, progress: 0.52, flag: false },
    { date: "2026-05-13", label: "Nu", category: "North", state: "warning", owner: "Morgan", location: "Point M", latitude: 37.6, longitude: -122.45, value: 31, comparison: 35, progress: 0.41, flag: false },
    { date: "2026-05-14", label: "Xi", category: "East", state: "normal", owner: "Nico", location: "Point N", latitude: 37.78, longitude: -122.27, value: 58, comparison: 53, progress: 0.73, flag: true },
    { date: "2026-05-15", label: "Omicron", category: "West", state: "positive", owner: "Oak", location: "Point O", latitude: 37.65, longitude: -122.37, value: 76, comparison: 62, progress: 0.9, flag: true },
    { date: "2026-05-16", label: "Pi", category: "South", state: "negative", owner: "Parker", location: "Point P", latitude: 37.84, longitude: -122.5, value: 22, comparison: 27, progress: 0.29, flag: false },
    { date: "2026-05-17", label: "Rho", category: "North", state: "normal", owner: "Quinn", location: "Point Q", latitude: 37.7, longitude: -122.25, value: 47, comparison: 45, progress: 0.59, flag: true },
    { date: "2026-05-18", label: "Sigma", category: "East", state: "warning", owner: "Reese", location: "Point R", latitude: 37.92, longitude: -122.47, value: 36, comparison: 39, progress: 0.44, flag: false },
    { date: "2026-05-19", label: "Tau", category: "West", state: "positive", owner: "Sage", location: "Point S", latitude: 37.61, longitude: -122.32, value: 69, comparison: 54, progress: 0.82, flag: true },
    { date: "2026-05-20", label: "Upsilon", category: "South", state: "stale", owner: "Tatum", location: "Point T", latitude: 37.75, longitude: -122.55, value: 33, comparison: 37, progress: 0.49, flag: false },
    { date: "2026-05-21", label: "Phi", category: "North", state: "normal", owner: "Uma", location: "Point U", latitude: 37.88, longitude: -122.38, value: 52, comparison: 47, progress: 0.67, flag: true },
    { date: "2026-05-22", label: "Chi", category: "East", state: "negative", owner: "Vale", location: "Point V", latitude: 37.66, longitude: -122.28, value: 18, comparison: 26, progress: 0.24, flag: false },
    { date: "2026-05-23", label: "Psi", category: "West", state: "warning", owner: "Winter", location: "Point W", latitude: 37.81, longitude: -122.53, value: 29, comparison: 34, progress: 0.36, flag: false },
    { date: "2026-05-24", label: "Omega", category: "South", state: "positive", owner: "Yael", location: "Point X", latitude: 37.57, longitude: -122.4, value: 88, comparison: 72, progress: 0.97, flag: true },
  ];
  const demoDataResult = (overrides = {}) => {
    const runtime = window.dashboardDemoDataRuntime;
    if (runtime?.widgetDemoData) {
      return runtime.widgetDemoData(overrides.widgetType || "stat", overrides.config || {}, overrides);
    }
    return {
      name: "Demo data",
      sourceId: "__demo-widget-source",
      sourceName: "Demo data",
      semanticMapping: { ...DEMO_SEMANTIC_MAPPING, ...(overrides.semanticMapping || {}) },
      schema: { fields: cloneJson(overrides.schemaFields || DEMO_SCHEMA_FIELDS) },
      rows: cloneJson(overrides.rows || DEMO_ROWS),
    };
  };

  const unsupportedDefinition = (type = "unknown") => ({
    type: "unsupported",
    displayName: "Unsupported Widget",
    aliases: [],
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    widgetType: String(type || "unknown"),
    dashboardObjectKind: "unsupported-widget",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom unsupported-widget-card",
    capabilities: {
      readsContext: false,
      writesContext: false,
      requiresDataSource: false,
      supportsFilters: false,
      supportsTimeRange: false,
      supportsResize: true,
    },
    supportedSettings: ["title", "color", "pin", "delete"],
    queryRequirements: { fields: [] },
    getDefaultConfig: () => ({ title: `Unsupported: ${type || "unknown"}` }),
    resolveQuery: () => null,
    render: ({ instance }) => runtimeState("Unsupported widget", instance.type || type || "unknown", {
      className: "unsupported-widget-state",
      state: "unsupported",
      expected: "A widget type registered in the runtime registry.",
      reason: "The saved layout references a type this build cannot render.",
      action: "Restore the registry definition or replace this object.",
    }),
  });

  const statMetricContext = ({ instance, resolvedContext, data } = {}) => {
    const config = instance?.config || {};
    const metric = ["count", "sum", "avg", "min", "max"].includes(config.metric) ? config.metric : "count";
    const mapping = resolvedContext?.semanticMapping || data?.semanticMapping || {};
    const valueField = config.valueField || mapping.valueField;
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
    return {
      metric,
      valueField,
      rows,
      total,
      metricContext: metric === "count" ? `${total} records` : `${metric} ${valueField || "value"}`,
    };
  };

  const normalizeDefinition = (definition) => {
    const type = String(definition?.type || "").trim();
    if (!type) return null;
    const defaultSize = normalizedSize(definition.defaultSize, definition.defaultSpan || 1, definition.defaultRows || 1);
    const minSize = normalizedSize(definition.minSize, definition.minSpan || defaultSize.cols, definition.minRows || defaultSize.rows);
    const getDefaultConfig = typeof definition.getDefaultConfig === "function"
      ? definition.getDefaultConfig
      : () => ({});
    return {
      ...definition,
      type,
      displayName: definition.displayName || type,
      label: definition.label || definition.displayName || type,
      category: definition.category || "data",
      subcategory: definition.subcategory || "",
      layer: normalizeWidgetLayer(definition.layer),
      engineerOnly: Boolean(definition.engineerOnly),
      icon: definition.icon || "",
      aliases: Array.isArray(definition.aliases) ? definition.aliases : [],
      defaultSize,
      minSize,
      capabilities: {
        readsContext: false,
        writesContext: false,
        requiresDataSource: false,
        supportsFilters: false,
        supportsTimeRange: false,
        supportsResize: true,
        ...(definition.capabilities || {}),
      },
      supportedSettings: Array.isArray(definition.supportedSettings)
        ? definition.supportedSettings
        : ["title", "color", "pin", "delete"],
      settingsSchema: normalizedSettingsSchema(definition.settingsSchema, definition.supportedSettings || ["title"]),
      densityBehavior: definition.densityBehavior || {},
      queryRequirements: definition.queryRequirements || { fields: [] },
      getDefaultConfig,
      shell: definition.shell === false ? false : {
        mode: definition.renderContent ? "content" : "compat",
        showHeader: false,
        ...(definition.shell && typeof definition.shell === "object" ? definition.shell : {}),
      },
      getTitle: typeof definition.getTitle === "function" ? definition.getTitle : null,
      getMetadata: typeof definition.getMetadata === "function" ? definition.getMetadata : null,
      getFooter: typeof definition.getFooter === "function" ? definition.getFooter : null,
      getRuntimeState: typeof definition.getRuntimeState === "function" ? definition.getRuntimeState : null,
      getEmptyState: typeof definition.getEmptyState === "function" ? definition.getEmptyState : null,
      densityRules: definition.densityRules || definition.densityBehavior || {},
      getDemoData: typeof definition.getDemoData === "function" ? definition.getDemoData : null,
      resolveQuery: typeof definition.resolveQuery === "function" ? definition.resolveQuery : () => null,
      mountBodyRenderer: typeof definition.mountBodyRenderer === "function" ? definition.mountBodyRenderer : null,
      unmountBodyRenderer: typeof definition.unmountBodyRenderer === "function" ? definition.unmountBodyRenderer : null,
      renderContent: typeof definition.renderContent === "function" ? definition.renderContent : null,
      render: typeof definition.render === "function"
        ? definition.render
        : ({ instance }) => runtimeState(instance.config?.title || definition.displayName, ""),
    };
  };

  const registerWidgetDefinition = (definition) => {
    const normalized = normalizeDefinition(definition);
    if (!normalized) return false;
    definitions.set(normalized.type, normalized);
    normalized.aliases.forEach((alias) => aliases.set(alias, normalized.type));
    return true;
  };

  const getWidgetDefinition = (type) => {
    const key = String(type || "").trim();
    const canonical = aliases.get(key) || key;
    return definitions.get(canonical) || unsupportedDefinition(key);
  };

  const createWidgetInstance = (definition, overrides = {}) => {
    const resolvedDefinition = typeof definition === "string" ? getWidgetDefinition(definition) : definition;
    const config = {
      ...resolvedDefinition.getDefaultConfig(),
      ...parseConfig(overrides.config),
    };
    const cols = Number(overrides.cols) || Number(overrides.span) || resolvedDefinition.defaultSize.cols;
    const rows = Number(overrides.rows) || Number(overrides.rowSpan) || resolvedDefinition.defaultSize.rows;
    const density = normalizeDensity(overrides.density, resolveWidgetDensity({
      cols,
      rows,
      parentPanelId: overrides.parentPanelId || null,
    }, overrides.availableSize || {}, resolvedDefinition));
    return {
      id: overrides.id || overrides.key || "",
      type: resolvedDefinition.type,
      x: Number(overrides.x) || Number(overrides.gridCol) || 1,
      y: Number(overrides.y) || Number(overrides.gridRow) || 1,
      cols,
      rows,
      config,
      layer: normalizeWidgetLayer(overrides.layer, resolvedDefinition.layer || "presentation"),
      density,
      availableSize: overrides.availableSize || null,
      parentPanelId: overrides.parentPanelId || null,
      contextOverrideId: overrides.contextOverrideId || null,
    };
  };

  const renderWidget = (definition, props = {}) => {
    const resolvedDefinition = typeof definition === "string" ? getWidgetDefinition(definition) : definition;
    const instance = props.instance || createWidgetInstance(resolvedDefinition, {});
    const density = normalizeDensity(props.density || instance.density, resolveWidgetDensity(instance, instance.availableSize || {}, resolvedDefinition));
    const status = props.status || "empty";
    try {
      const renderProps = {
        ...props,
        density,
        instance: { ...instance, density },
        definition: resolvedDefinition,
        status,
      };
      const content = typeof resolvedDefinition.renderContent === "function"
        ? resolvedDefinition.renderContent(renderProps)
        : resolvedDefinition.render(renderProps);
      return resolvedDefinition.shell === false
        ? content
        : renderWidgetShell(resolvedDefinition, renderProps, content);
    } catch (error) {
      const fallback = runtimeState("Widget error", error?.message || "Render failed", { state: "error" });
      return resolvedDefinition.shell === false
        ? fallback
        : renderWidgetShell(resolvedDefinition, { ...props, density, instance: { ...instance, density }, definition: resolvedDefinition, status: "error" }, fallback);
    }
  };

  registerWidgetDefinition({
    type: "stat",
    displayName: "Stat",
    category: "data",
    aliases: ["tracker", "widget"],
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    widgetType: "tracker",
    dashboardObjectKind: "stat",
    contextRole: "content",
    htmlTag: "a",
    className: "stat-card widget-card widget-card-custom",
    capabilities: {
      readsContext: true,
      requiresDataSource: false,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["title", "value", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "metric",
        label: "Metric",
        fields: [
          { key: "label", label: "Label", type: "text", defaultValue: "Widget" },
          { key: "metric", label: "Metric", type: "metricPicker", defaultValue: "count", options: ["count", "sum", "avg", "min", "max"], affectsQuery: true },
          { key: "valueField", label: "Value field", type: "fieldPicker", affectsQuery: true },
          { key: "calculatedFields", label: "Calculated fields", type: "json", defaultValue: [], affectsQuery: true },
          { key: "equationFilters", label: "Equation filters", type: "json", defaultValue: [], affectsQuery: true },
          { key: "format", label: "Format", type: "select", defaultValue: "number", options: ["number", "currency", "percent"] },
        ],
      }],
    },
    queryRequirements: { fields: ["semantic"], metric: ["count", "sum", "avg", "min", "max"] },
    getDefaultConfig: () => ({ label: "Widget", title: "Widget", metric: "count", format: "number" }),
    shell: {
      mode: "content",
      showHeader: true,
      titleClass: "stat-lbl",
      metadataClass: "stat-runtime-meta",
      hideHeaderDensities: ["tiny"],
      hideHeaderForRuntimeStates: true,
    },
    getTitle: ({ instance }) => statLabelFor(instance?.config || {}),
    getMetadata: (props) => {
      if (props.status !== "ready" || !props.resolvedContext?.dataSourceId) return [];
      const { metricContext } = statMetricContext(props);
      return runtimeMeta(metricContext, props.data);
    },
    getDemoData: (config = {}) => demoDataResult({ widgetType: "stat", config }),
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.dataSourceId || !resolvedContext?.canQuery) return null;
      const mapping = resolvedContext.semanticMapping || {};
      const metric = ["count", "sum", "avg", "min", "max"].includes(config.metric) ? config.metric : "count";
      const valueField = config.valueField || mapping.valueField;
      if (metric !== "count" && !valueField) return null;
      const configuredFields = Array.isArray(config.fields) ? config.fields : [];
      const fields = metric === "count"
        ? unique([...configuredFields, ...defaultQueryFields(resolvedContext)])
        : unique([valueField, ...configuredFields, ...defaultQueryFields(resolvedContext)]);
      return {
        fields,
        filters: Array.isArray(config.filters) ? config.filters : [],
        timeRange: config.timeRange || null,
        sort: Array.isArray(config.sort) ? config.sort : [],
        ...queryTransformsFromConfig(config),
      };
    },
    renderContent: ({ instance, resolvedContext, data, status }) => {
      const config = instance.config || {};
      const label = statLabelFor(config);
      const { metric, valueField, rows, total } = statMetricContext({ instance, resolvedContext, data });
      if (!resolvedContext?.dataSourceId) return runtimeState(label, "Needs data source");
      if (metric !== "count" && !valueField) return runtimeState(label, "Map a value field");
      if (status === "loading") return runtimeState(label, "Loading");
      if (status === "error") return runtimeState(label, data?.error || "Unable to load metric");
      if (!rows.length && total <= 0) return runtimeState(label, "No data");
      const numericValues = valueField
        ? rows.map((row) => numberValue(row?.[valueField])).filter((value) => value != null)
        : [];
      let value = total;
      if (metric !== "count") {
        if (!numericValues.length) return runtimeState(label, "No numeric data");
        if (metric === "sum") value = numericValues.reduce((sum, current) => sum + current, 0);
        if (metric === "avg") value = numericValues.reduce((sum, current) => sum + current, 0) / numericValues.length;
        if (metric === "min") value = Math.min(...numericValues);
        if (metric === "max") value = Math.max(...numericValues);
      }
      return `<span class="stat-val">${escapeHtml(formatMetricValue(value, config.format))}</span>`;
    },
  });

  registerWidgetDefinition({
    type: "timeframe",
    displayName: "Timeframe",
    category: "controls",
    aliases: ["controls", "time-range"],
    defaultSize: { cols: 4, rows: 1 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "timeframe",
    dashboardObjectKind: "timeframe",
    contextRole: "timeframe-control",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom timeframe-widget-card",
    ariaLabel: "Time filter controls",
    capabilities: {
      readsContext: true,
      writesContext: true,
      requiresDataSource: false,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["color", "pin", "delete"],
    settingsSchema: { sections: [] },
    queryRequirements: { timeRange: true },
    getDefaultConfig: () => ({
      title: "Timeframe",
      activeLabel: "Any time",
      selectedFilterId: "",
      weekStartDay: 0,
      selectedPreset: "",
      customStart: "",
      customEnd: "",
      filters: [],
    }),
    resolveQuery: () => null,
    render: ({ instance }) => {
      const config = instance.config || {};
      const filters = normalizeTimeframeFilters(config);
      const selectedFilterId = selectedTimeframeFilterId(config, filters);

      if (!filters.length) {
        return `<div class="timeframe-body timeframe-body-empty"><span class="timeframe-empty-hint">Add time controls in settings</span></div>`;
      }

      const buttons = filters.map((filter) => {
        const isActive = filter.id === selectedFilterId;
        return `<button class="timeframe-filter-btn${isActive ? " is-active" : ""}" type="button" data-filter-id="${escapeHtml(filter.id)}" aria-pressed="${isActive ? "true" : "false"}">${escapeHtml(filter.label)}</button>`;
      }).join("");

      return `<div class="timeframe-body" role="group" aria-label="${escapeHtml(config.title || "Time filters")}">${buttons}</div>`;
    },
  });

  registerWidgetDefinition({
    type: "search",
    displayName: "Search Bar",
    category: "controls",
    defaultSize: { cols: 2, rows: 1 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "search",
    dashboardObjectKind: "search",
    contextRole: "search-control",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom search-widget-card",
    capabilities: {
      readsContext: true,
      writesContext: true,
      requiresDataSource: false,
      supportsFilters: true,
      supportsResize: true,
    },
    supportedSettings: ["placeholder", "scope", "color", "pin", "delete"],
    settingsSchema: {
      sections: [{
        id: "search",
        label: "Search",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Search" },
          { key: "placeholder", label: "Placeholder", type: "text", defaultValue: " " },
          { key: "field", label: "Search field", type: "fieldPicker", affectsContext: true },
          { key: "query", label: "Query", type: "text", defaultValue: "", affectsContext: true },
        ],
      }],
    },
    queryRequirements: { filters: true },
    getDefaultConfig: () => ({ title: "Search", query: "", placeholder: " " }),
    resolveQuery: (config) => config.query
      ? { filters: [{ field: config.field || "query", operator: "contains", value: config.query }] }
      : null,
    render: ({ instance, density = instance.density || "standard" }) => {
      const title = instance.config.title || "Search";
      const densityTier = normalizeDensity(density);
      return `
        <div class="search-widget-content search-widget-density-${densityTier}" data-density="${escapeHtml(densityTier)}">
          <div class="range-search search-widget-control" role="search" aria-label="${escapeHtml(title)}">
            <input class="range-search-input search-widget-input" type="search" placeholder="${escapeHtml(instance.config.placeholder || " ")}" autocomplete="off" aria-label="${escapeHtml(title)}" value="${escapeHtml(instance.config.query || "")}">
          </div>
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "text",
    displayName: "Text / Notes",
    category: "content",
    aliases: ["note", "notes"],
    defaultSize: { cols: 2, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "text",
    dashboardObjectKind: "text",
    contextRole: "annotation",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom text-widget-card",
    capabilities: {
      readsContext: false,
      writesContext: false,
      requiresDataSource: false,
      supportsResize: true,
    },
    supportedSettings: ["text", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "note",
        label: "Note",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Note" },
          { key: "body", label: "Body", type: "textarea", defaultValue: "" },
          { key: "placeholder", label: "Placeholder", type: "text", defaultValue: "Write a note" },
        ],
      }],
    },
    queryRequirements: { fields: [] },
    getDefaultConfig: () => ({ title: "Note", body: "", placeholder: "Write a note" }),
    resolveQuery: () => null,
    render: ({ instance }) => {
      const config = instance.config || {};
      const body = String(config.body || "");
      const cols = Number(instance.cols) || 2;
      const rows = Number(instance.rows) || 2;
      const density = rows <= 1
        ? "small"
        : rows >= 3 || cols >= 3
          ? "large"
          : "medium";
      return `
        <div class="text-widget-content text-widget-density-${density}">
          ${density === "small"
            ? `<div class="text-widget-preview" aria-label="${escapeHtml(config.title || "Note")}">${escapeHtml(body || config.placeholder || "Write a note")}</div>`
            : `<textarea class="text-widget-editor" aria-label="${escapeHtml(config.title || "Note")}" spellcheck="true" placeholder="${escapeHtml(config.placeholder || "Write a note")}">${escapeHtml(body)}</textarea>`}
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "region-summary",
    displayName: "Region Summary",
    category: "content",
    aliases: ["region", "spatial-summary", "summary"],
    defaultSize: { cols: 2, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "region-summary",
    dashboardObjectKind: "region-summary",
    contextRole: "region-inspector",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom region-summary-widget-card",
    capabilities: {
      readsContext: true,
      writesContext: false,
      requiresDataSource: false,
      supportsFilters: false,
      supportsTimeRange: false,
      supportsResize: true,
    },
    supportedSettings: ["title", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "region",
        label: "Region",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Region Summary" },
        ],
      }],
    },
    queryRequirements: { region: true },
    getDefaultConfig: () => ({ title: "Region Summary" }),
    resolveQuery: () => null,
    render: ({ instance, resolvedContext }) => {
      const summary = window.dashboardSpatialRuntime?.regionSummaryForWidget?.(instance.id) || {};
      const cols = Number(instance.cols) || 2;
      const rows = Number(instance.rows) || 2;
      const density = rows <= 1 ? "compact" : rows >= 3 || cols >= 3 ? "rich" : "standard";
      const regionLabel = summary.label || resolvedContext?.name || "Current region";
      const source = summary.dataSourceName || resolvedContext?.dataSourceName || resolvedContext?.dataSourceId || "";
      const rowRange = summary.endRow
        ? `Rows ${summary.startRow || 1}-${summary.endRow}`
        : `Rows ${summary.startRow || 1}+`;
      return `
        <div class="region-summary-widget region-summary-density-${density}" data-region-id="${escapeHtml(summary.id || resolvedContext?.regionId || "")}">
          <strong class="region-summary-title">${escapeHtml(regionLabel)}</strong>
          <div class="region-summary-metrics" aria-label="Region object counts">
            <span><b>${Number(summary.widgets) || 0}</b> Widgets</span>
            <span><b>${Number(summary.panels) || 0}</b> Panels</span>
            <span><b>${Number(summary.anchors) || 0}</b> Anchors</span>
          </div>
          ${density === "compact" || !source ? "" : `<div class="region-summary-context">${escapeHtml(source)}</div>`}
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "image",
    displayName: "Image",
    category: "media",
    aliases: ["picture", "media-image"],
    defaultSize: { cols: 3, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "image",
    dashboardObjectKind: "image",
    contextRole: "reference",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom media-widget-card image-widget-card",
    capabilities: {
      readsContext: false,
      writesContext: false,
      requiresDataSource: false,
      supportsResize: true,
    },
    supportedSettings: ["source", "fit", "caption", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "image",
        label: "Image",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Image" },
          { key: "src", label: "Source URL", type: "text", defaultValue: "" },
          { key: "alt", label: "Alt text", type: "text", defaultValue: "" },
          { key: "fit", label: "Fit", type: "select", defaultValue: "contain", options: ["contain", "cover", "fill", "center"] },
          { key: "caption", label: "Caption", type: "text", defaultValue: "" },
        ],
      }],
    },
    queryRequirements: { fields: [] },
    getDefaultConfig: () => ({ title: "Image", assetId: "", alt: "", fit: "contain", caption: "" }),
    resolveQuery: () => null,
    render: ({ instance }) => {
      const config = instance.config || {};
      const title = mediaTitle(config, "Image");
      const src = safeMediaUrl(config.src, "image");
      const caption = String(config.caption || "").trim();
      if (config.assetMissing) return mediaState(title, "Missing image asset", "error");
      if (!String(config.src || "").trim()) return mediaState(title, "Configure image asset", "empty");
      if (src == null) return mediaState(title, "Unsupported image URL", "error");
      const fit = safeMediaFit(config.fit);
      const alt = String(config.alt || caption || title || "Image").trim();
      return `
        <div class="media-widget media-widget-image-wrap media-fit-${escapeHtml(fit)}" data-media-kind="image" data-media-status="ready">
          <figure class="media-widget-stage image-widget-stage">
            <img class="media-widget-image" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" draggable="false">
          </figure>
          ${mediaCaptionMarkup(caption)}
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "video",
    displayName: "Video",
    category: "media",
    aliases: ["media-video"],
    defaultSize: { cols: 3, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "video",
    dashboardObjectKind: "video",
    contextRole: "reference",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom media-widget-card video-widget-card",
    capabilities: {
      readsContext: false,
      writesContext: false,
      requiresDataSource: false,
      supportsResize: true,
    },
    supportedSettings: ["source", "caption", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "video",
        label: "Video",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Video" },
          { key: "src", label: "Source URL", type: "text", defaultValue: "" },
          { key: "embedType", label: "Embed", type: "select", defaultValue: "url", options: ["url", "youtube", "vimeo"] },
          { key: "autoplay", label: "Autoplay", type: "toggle", defaultValue: false },
          { key: "muted", label: "Muted", type: "toggle", defaultValue: true },
          { key: "caption", label: "Caption", type: "text", defaultValue: "" },
        ],
      }],
    },
    queryRequirements: { fields: [] },
    getDefaultConfig: () => ({ title: "Video", assetId: "", embedType: "url", autoplay: false, muted: true, caption: "" }),
    resolveQuery: () => null,
    render: ({ instance }) => {
      const config = instance.config || {};
      const title = mediaTitle(config, "Video");
      const caption = String(config.caption || "").trim();
      const embedType = String(config.embedType || "url").toLowerCase();
      if (config.assetMissing) return mediaState(title, "Missing video asset", "error");
      if (!String(config.src || "").trim()) return mediaState(title, "Configure video asset", "empty");
      let stage = "";
      if (embedType === "youtube") {
        const embed = youtubeEmbedUrl(config.src);
        if (!embed) return mediaState(title, "Unsupported embed URL", "error");
        stage = `<iframe class="media-widget-frame media-widget-video-frame" src="${escapeHtml(embed)}" title="${escapeHtml(title)}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      } else if (embedType === "vimeo") {
        const embed = vimeoEmbedUrl(config.src);
        if (!embed) return mediaState(title, "Unsupported embed URL", "error");
        stage = `<iframe class="media-widget-frame media-widget-video-frame" src="${escapeHtml(embed)}" title="${escapeHtml(title)}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      } else {
        const src = safeMediaUrl(config.src, "video");
        if (src == null) return mediaState(title, "Unsupported video URL", "error");
        stage = `<video class="media-widget-video" src="${escapeHtml(src)}" controls preload="metadata"${config.autoplay ? " autoplay" : ""}${config.muted !== false ? " muted" : ""} playsinline></video>`;
      }
      return `
        <div class="media-widget media-widget-video-wrap" data-media-kind="video" data-media-status="ready">
          <div class="media-widget-stage video-widget-stage">${stage}</div>
          ${mediaCaptionMarkup(caption)}
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "document",
    displayName: "PDF / Document",
    category: "media",
    aliases: ["pdf", "doc", "document-preview"],
    defaultSize: { cols: 3, rows: 3 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "document",
    dashboardObjectKind: "document",
    contextRole: "reference",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom media-widget-card document-widget-card",
    capabilities: {
      readsContext: false,
      writesContext: false,
      requiresDataSource: false,
      supportsResize: true,
    },
    supportedSettings: ["source", "page", "caption", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "document",
        label: "Document",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Document" },
          { key: "src", label: "Source URL", type: "text", defaultValue: "" },
          { key: "documentType", label: "Type", type: "select", defaultValue: "unknown", options: ["unknown", "pdf", "text", "markdown", "html"] },
          { key: "currentPage", label: "Page", type: "number", defaultValue: 1, min: 1, max: 999, step: 1 },
          { key: "content", label: "Text content", type: "textarea", defaultValue: "" },
          { key: "caption", label: "Caption", type: "text", defaultValue: "" },
        ],
      }],
    },
    queryRequirements: { fields: [] },
    getDefaultConfig: () => ({ title: "Document", assetId: "", documentType: "unknown", currentPage: 1, caption: "", content: "" }),
    resolveQuery: () => null,
    render: ({ instance }) => {
      const config = instance.config || {};
      const title = mediaTitle(config, "Document");
      const caption = String(config.caption || "").trim();
      const content = String(config.content || "").trim();
      const kind = documentPreviewKind(config);
      if (content && (kind === "text" || kind === "markdown" || kind === "unknown")) {
        return `
          <div class="media-widget document-widget document-widget-text-mode" data-media-kind="document" data-document-type="${escapeHtml(kind)}" data-media-status="ready">
            <div class="widget-content-well widget-library-surface runtime-monaco-library-surface">
              <div class="runtime-monaco-editor" data-editor-language="${escapeHtml(kind)}" role="region" aria-label="${escapeHtml(title)}"></div>
            </div>
            ${mediaCaptionMarkup(caption)}
          </div>`;
      }
      if (config.assetMissing) return mediaState(title, "Missing document asset", "error");
      if (!String(config.src || "").trim()) return mediaState(title, "Configure document asset", "empty");
      const src = safeMediaUrl(config.src, "document");
      if (src == null) return mediaState(title, "Unsupported document URL", "error");
      const page = Math.max(1, Number(config.currentPage) || 1);
      const frameSrc = kind === "pdf" && !String(src).startsWith("data:")
        ? `${src}#page=${page}`
        : src;
      const previewLabel = kind === "pdf" ? `Page ${page}` : kind === "html" ? "Sandboxed preview" : "Document preview";
      return `
        <div class="media-widget document-widget" data-media-kind="document" data-document-type="${escapeHtml(kind)}" data-media-status="ready">
          <div class="media-widget-stage document-widget-stage">
            <iframe class="media-widget-frame document-widget-frame" src="${escapeHtml(frameSrc)}" title="${escapeHtml(title)}" loading="lazy" sandbox=""></iframe>
          </div>
          ${mediaCaptionMarkup(caption)}
        </div>`;
    },
    mountBodyRenderer: ({ contentRoot, instance }) => {
      const config = instance?.config || {};
      const content = String(config.content || "").trim();
      const kind = documentPreviewKind(config);
      if (!content || !["text", "markdown", "unknown"].includes(kind)) return null;
      const language = kind === "markdown" ? "markdown" : "plaintext";
      return mountMonacoBodyRenderer({ contentRoot, content, language });
    },
  });

  registerWidgetDefinition({
    type: "table",
    displayName: "Table",
    category: "data",
    defaultSize: { cols: 3, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "table",
    dashboardObjectKind: "table",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom table-widget-card",
    capabilities: {
      readsContext: true,
      requiresDataSource: true,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["columns", "limit", "color", "pin", "delete"],
    settingsSchema: {
      sections: [{
        id: "table",
        label: "Rows",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Table" },
          { key: "columns", label: "Columns", type: "textarea", valueType: "array", placeholder: "name, amount, category", affectsQuery: true },
          { key: "calculatedFields", label: "Calculated fields", type: "json", defaultValue: [], affectsQuery: true },
          { key: "equationFilters", label: "Equation filters", type: "json", defaultValue: [], affectsQuery: true },
          { key: "limit", label: "Limit", type: "number", defaultValue: 50, min: 1, max: 200, step: 1, affectsQuery: true },
          { key: "sortBy", label: "Sort field", type: "fieldPicker", affectsQuery: true },
          { key: "sortDirection", label: "Sort direction", type: "select", defaultValue: "asc", options: ["asc", "desc"], affectsQuery: true },
        ],
      }],
    },
    queryRequirements: { fields: "semantic-or-configured", limit: 50, sort: true },
    getDefaultConfig: () => ({ title: "Table", columns: [], limit: 50, sortBy: "", sortDirection: "asc" }),
    getDemoData: (config = {}) => demoDataResult({ widgetType: "table", config }),
    mountBodyRenderer: mountTableBodyRenderer,
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      const columns = tableConfiguredColumns(config);
      const semanticFields = tableSemanticFields(resolvedContext);
      const fields = columns.length ? columns : semanticFields;
      const sortBy = String(config.sortBy || "").trim();
      return {
        fields,
        filters: Array.isArray(config.filters) ? config.filters : [],
        timeRange: config.timeRange || null,
        sort: sortBy ? [{ field: sortBy, direction: config.sortDirection === "desc" ? "desc" : "asc" }] : [],
        limit: Number(config.limit) || 50,
        ...queryTransformsFromConfig(config),
      };
    },
    render: ({ instance, resolvedContext, data, status, density = instance.density || "standard" }) => {
      const config = instance.config || {};
      const densityTier = normalizeDensity(density);
      const title = config.title || "Table";
      if (!resolvedContext?.dataSourceId) return runtimeState(title, "No data source");
      if (status === "loading") return runtimeState(title, "Loading");
      if (status === "error") return runtimeState(title, data?.error || "Unable to load rows");
      const rows = data?.rows || [];
      const configuredColumns = tableConfiguredColumns(config);
      const semanticFields = tableSemanticFields(resolvedContext);
      if (!configuredColumns.length && !semanticFields.length) return runtimeState(title, "Configure columns");
      const schemaFields = data?.schema?.fields?.map((field) => field.name) || Object.keys(rows[0] || {});
      const allFields = unique(configuredColumns.length ? configuredColumns : semanticFields.length ? semanticFields : schemaFields);
      if (!allFields.length) return runtimeState(title, "Configure columns");
      if (!rows.length) return runtimeState(title, "No rows match the current context");
      const visibleFields = allFields.slice(0, tableVisibleColumnCount(instance.cols));
      const visibleRows = rows.slice(0, tableVisibleRowCount(instance.rows, config.limit));
      const tableDensity = Number(instance.rows) <= 2 || Number(instance.cols) <= 2
        ? "compact"
        : Number(instance.rows) >= 4 || Number(instance.cols) >= 4 || densityTier === "rich"
          ? "rich"
          : "comfortable";
      const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
      return `
        <div class="runtime-table-widget runtime-table-density-${tableDensity} widget-density-${densityTier}" data-density="${escapeHtml(densityTier)}" data-runtime-state="ready" data-runtime-source="${escapeHtml(runtimeSource(data))}" data-visible-rows="${visibleRows.length}" data-visible-columns="${visibleFields.length}">
          <div class="widget-content-well widget-library-surface runtime-table-library-surface">
            <div class="runtime-table-tanstack" data-table-renderer="tanstack" role="region" aria-label="${escapeHtml(title)}"></div>
          </div>
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "chart",
    displayName: "Chart",
    category: "visualization",
    subcategory: "Charts",
    aliases: ["graph"],
    defaultSize: { cols: 3, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "graph",
    dashboardObjectKind: "chart",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom chart-widget-card",
    capabilities: {
      readsContext: true,
      requiresDataSource: true,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["chartType", "xField", "yField", "series", "aggregation", "color", "pin", "delete"],
    settingsSchema: {
      sections: [{
        id: "chart",
        label: "Chart",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Chart" },
          { key: "chartType", label: "Type", type: "select", defaultValue: "bar", options: ["bar", "line", "area", "pie", "donut", "scatter", "histogram", "heatmap", "gauge", "sparkline"], affectsQuery: true },
          { key: "xField", label: "X field", type: "fieldPicker", affectsQuery: true },
          { key: "yField", label: "Y field", type: "fieldPicker", affectsQuery: true },
          { key: "seriesField", label: "Series field", type: "fieldPicker", affectsQuery: true },
          { key: "aggregation", label: "Aggregation", type: "select", defaultValue: "count", options: CHART_AGGREGATIONS, affectsQuery: true },
          { key: "calculatedFields", label: "Calculated fields", type: "json", defaultValue: [], affectsQuery: true },
          { key: "equationFilters", label: "Equation filters", type: "json", defaultValue: [], affectsQuery: true },
          { key: "timeBucket", label: "Time bucket", type: "json", defaultValue: null, affectsQuery: true },
          { key: "limit", label: "Limit", type: "number", defaultValue: 60, min: 1, max: 200, step: 1, affectsQuery: true },
        ],
      }],
    },
    queryRequirements: {
      chartTypes: listChartDefinitions().map((definition) => definition.chartType),
      fields: "chart-definition",
      aggregations: CHART_AGGREGATIONS,
      limit: 60,
    },
    getDefaultConfig: () => ({
      title: "Chart",
      chartType: "bar",
      aggregation: "count",
      groupBy: [],
      sortBy: "",
      sortDirection: "asc",
      limit: 60,
      display: {
        showLegend: true,
        showAxes: true,
        showGrid: false,
        showLabels: true,
      },
    }),
    getDemoData: (config = {}) => demoDataResult({
      widgetType: "chart",
      config,
      semanticMapping: ["scatter", "bubble"].includes(config.chartType)
        ? { dateField: "comparison", valueField: "value" }
        : {},
    }),
    mountBodyRenderer: mountChartBodyRenderer,
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      const definition = getChartDefinition(config.chartType || "bar");
      if (!definition) return null;
      const message = chartRequiredFieldMessage(definition, config, resolvedContext);
      if (message) return null;
      const sortBy = String(config.sortBy || "").trim();
      return {
        fields: chartQueryFieldsFor(definition, config, resolvedContext),
        filters: Array.isArray(config.filters) ? config.filters : [],
        timeRange: config.timeRange || null,
        groupBy: Array.isArray(config.groupBy) ? config.groupBy : [],
        sort: sortBy ? [{ field: sortBy, direction: config.sortDirection === "desc" ? "desc" : "asc" }] : [],
        limit: chartLimit(config, 60),
        ...queryTransformsFromConfig(config),
      };
    },
    render: ({ instance, resolvedContext, data, status }) => {
      const config = instance.config || {};
      const chartType = config.chartType || "bar";
      const definition = getChartDefinition(chartType);
      const title = config.title || "Chart";
      if (!definition) return runtimeState(title, "Unsupported chart config");
      if (!resolvedContext?.dataSourceId) return runtimeState(title, "No data source");
      const requiredMessage = chartRequiredFieldMessage(definition, config, resolvedContext);
      if (requiredMessage) return runtimeState(title, requiredMessage);
      if (status === "loading") return runtimeState(title, "Loading");
      if (status === "error") return runtimeState(title, data?.error || "Unable to load chart");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      if (!rows.length) return runtimeState(title, "No rows match the current context");
      return definition.render({
        instance,
        definition,
        resolvedContext,
        data,
        rows,
        display: chartDisplayConfig(config),
        status,
      });
    },
  });

  let leafletLoadPromise = null;
  const loadLeaflet = () => {
    if (window.L?.map) return Promise.resolve(window.L);
    if (!leafletLoadPromise) {
      leafletLoadPromise = new Promise((resolve, reject) => {
        if (!document.querySelector("link[data-dashboard-leaflet]")) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css";
          link.dataset.dashboardLeaflet = "true";
          document.head.appendChild(link);
        }
        const existing = document.querySelector("script[data-dashboard-leaflet]");
        const afterLoad = () => window.L?.map ? resolve(window.L) : reject(new Error("Leaflet failed to initialize"));
        if (existing) {
          existing.addEventListener("load", afterLoad, { once: true });
          existing.addEventListener("error", () => reject(new Error("Leaflet failed to load")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js";
        script.async = true;
        script.dataset.dashboardLeaflet = "true";
        script.onload = afterLoad;
        script.onerror = () => reject(new Error("Leaflet failed to load"));
        document.head.appendChild(script);
      });
    }
    return leafletLoadPromise;
  };

  const mapExtractPoints = (data, config, mapping) => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const latitudeField = String(config.latitudeField || mapping.latitudeField || "").trim();
    const longitudeField = String(config.longitudeField || mapping.longitudeField || "").trim();
    const locationField = String(config.locationField || mapping.locationField || "").trim();
    return rows.map((row) => ({
      label: String(row?.[locationField] || row?.[mapping.labelField] || row?.label || "Point"),
      category: String(row?.[mapping.categoryField] || row?.category || ""),
      latitude: numberValue(row?.[latitudeField]),
      longitude: numberValue(row?.[longitudeField]),
      value: numberValue(row?.[mapping.valueField] ?? row?.value),
    })).filter((point) => point.latitude != null && point.longitude != null)
      .slice(0, Math.max(1, Number(config.limit) || 250));
  };

  registerWidgetDefinition({
    type: "map",
    displayName: "Map",
    category: "visualization",
    subcategory: "Geospatial",
    aliases: ["geospatial-map", "geo-map"],
    defaultSize: { cols: 3, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "map",
    dashboardObjectKind: "map",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom map-widget-card",
    capabilities: {
      readsContext: true,
      requiresDataSource: true,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["location", "layerType", "limit", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "map",
        label: "Geospatial",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Map" },
          { key: "latitudeField", label: "Latitude field", type: "fieldPicker", affectsQuery: true },
          { key: "longitudeField", label: "Longitude field", type: "fieldPicker", affectsQuery: true },
          { key: "locationField", label: "Location field", type: "fieldPicker", affectsQuery: true },
          { key: "layerType", label: "Layer", type: "select", defaultValue: "points", options: ["points", "regions", "routes", "heatmap"], affectsQuery: true },
          { key: "limit", label: "Limit", type: "number", defaultValue: 250, min: 1, max: 1000, step: 1, affectsQuery: true },
        ],
      }],
    },
    queryRequirements: {
      fields: "geospatial",
      geometry: ["latitude-longitude", "location", "region", "route"],
      limit: 250,
    },
    getDefaultConfig: () => ({
      title: "Map",
      latitudeField: "",
      longitudeField: "",
      locationField: "",
      layerType: "points",
      limit: 250,
    }),
    getDemoData: (config = {}) => demoDataResult({ widgetType: "map", config }),
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      const mapping = resolvedContext.semanticMapping || {};
      const latitudeField = String(config.latitudeField || mapping.latitudeField || "").trim();
      const longitudeField = String(config.longitudeField || mapping.longitudeField || "").trim();
      const locationField = String(config.locationField || mapping.locationField || "").trim();
      const fields = unique([
        latitudeField,
        longitudeField,
        locationField,
        mapping.labelField,
        mapping.categoryField,
        mapping.statusField,
      ]);
      if ((!latitudeField || !longitudeField) && !locationField) return null;
      return {
        fields,
        filters: Array.isArray(config.filters) ? config.filters : [],
        timeRange: config.timeRange || null,
        limit: Number(config.limit) || 250,
        geospatial: {
          layerType: config.layerType || "points",
          latitudeField,
          longitudeField,
          locationField,
        },
      };
    },
    render: ({ instance, resolvedContext, data, status }) => {
      const config = instance.config || {};
      const title = config.title || "Map";
      const mapping = resolvedContext?.semanticMapping || {};
      const latitudeField = String(config.latitudeField || mapping.latitudeField || "").trim();
      const longitudeField = String(config.longitudeField || mapping.longitudeField || "").trim();
      const locationField = String(config.locationField || mapping.locationField || "").trim();
      if (!resolvedContext?.dataSourceId) return runtimeState(title, "Needs geospatial data");
      if ((!latitudeField || !longitudeField) && !locationField) return runtimeState(title, "Configure location fields");
      if (status === "loading") return runtimeState(title, "Loading");
      if (status === "error") return runtimeState(title, data?.error || "Unable to load map data");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      if (!rows.length) return runtimeState(title, "No map rows match the current context");
      const points = mapExtractPoints(data, config, mapping);
      if (!points.length) return runtimeState(title, "No coordinates");
      const density = chartVisualDensity(instance.density || "standard");
      const labels = points.slice(0, density === "large" ? 4 : 2).map((point) => `<span>${escapeHtml(point.label)}</span>`).join("");
      return `
        <div class="runtime-map-widget runtime-map-density-${escapeHtml(density)}" data-runtime-state="ready" data-runtime-source="${escapeHtml(runtimeSource(data))}" data-map-layer="${escapeHtml(config.layerType || "points")}" data-map-demo="${data?.demo ? "true" : "false"}">
          <div class="widget-content-well widget-library-surface runtime-map-leaflet-surface">
            <div class="runtime-map-leaflet" role="region" aria-label="${escapeHtml(title)}"></div>
          </div>
          <div class="runtime-map-legend">${labels}</div>
        </div>`;
    },
    mountBodyRenderer: ({ contentRoot, instance, resolvedContext, data, status }) => {
      const target = contentRoot?.querySelector?.(".runtime-map-leaflet");
      if (!target || status !== "ready") return null;
      const config = instance?.config || {};
      const mapping = resolvedContext?.semanticMapping || {};
      const points = mapExtractPoints(data, config, mapping);
      if (!points.length) return null;
      let disposed = false;
      let map = null;
      let resizeObserver = null;
      loadLeaflet()
        .then((L) => {
          if (disposed || !target.isConnected) return;
          map = L.map(target, {
            zoomControl: false,
            attributionControl: false,
            scrollWheelZoom: false,
          });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            opacity: 0.85,
          }).addTo(map);
          const markerStyle = { radius: 6, fillColor: "#3b82f6", color: "#1d4ed8", weight: 1.2, opacity: 1, fillOpacity: 0.82 };
          points.forEach((point) => {
            L.circleMarker([point.latitude, point.longitude], markerStyle)
              .bindTooltip(point.label, { sticky: false, offset: [0, -4] })
              .addTo(map);
          });
          if (points.length === 1) {
            map.setView([points[0].latitude, points[0].longitude], 12);
          } else {
            map.fitBounds(
              L.latLngBounds(points.map((p) => [p.latitude, p.longitude])),
              { padding: [16, 16], maxZoom: 14 }
            );
          }
          resizeObserver = new ResizeObserver(() => map?.invalidateSize());
          resizeObserver.observe(target);
          requestAnimationFrame(() => map?.invalidateSize());
        })
        .catch((error) => {
          if (disposed || !target.isConnected) return;
          target.innerHTML = `<div class="widget-runtime-state" data-runtime-state="error"><span class="stat-lbl">${escapeHtml(error?.message || "Unable to load map renderer")}</span></div>`;
        });
      return () => {
        disposed = true;
        resizeObserver?.disconnect();
        map?.remove();
        map = null;
      };
    },
  });

  let fullCalendarLoadPromise = null;
  const loadFullCalendar = () => {
    if (window.FullCalendar?.Calendar) return Promise.resolve(window.FullCalendar);
    if (!fullCalendarLoadPromise) {
      fullCalendarLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector("script[data-dashboard-fullcalendar]");
        const afterLoad = () => window.FullCalendar?.Calendar ? resolve(window.FullCalendar) : reject(new Error("FullCalendar failed to initialize"));
        if (existing) {
          existing.addEventListener("load", afterLoad, { once: true });
          existing.addEventListener("error", () => reject(new Error("FullCalendar failed to load")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js";
        script.async = true;
        script.dataset.dashboardFullcalendar = "true";
        script.onload = afterLoad;
        script.onerror = () => reject(new Error("FullCalendar failed to load"));
        document.head.appendChild(script);
      });
    }
    return fullCalendarLoadPromise;
  };

  const calendarExtractEvents = (data, config, mapping) => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const dateField = String(config.dateField || mapping.dateField || "").trim();
    const labelField = String(config.labelField || mapping.labelField || "").trim();
    return rows.map((row) => {
      const timestamp = Date.parse(row?.[dateField]);
      return Number.isFinite(timestamp)
        ? { date: new Date(timestamp), label: String(row?.[labelField] || row?.label || "Item"), state: String(row?.[mapping.statusField] || row?.state || "") }
        : null;
    }).filter(Boolean).sort((a, b) => a.date - b.date).slice(0, Number(config.limit) || 12);
  };

  registerWidgetDefinition({
    type: "calendar",
    displayName: "Calendar",
    category: "controls",
    defaultSize: { cols: 2, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "calendar",
    dashboardObjectKind: "calendar",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom calendar-widget-card",
    capabilities: {
      readsContext: true,
      requiresDataSource: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["dateField", "labelField", "color", "pin", "delete"],
    settingsSchema: {
      sections: [{
        id: "calendar",
        label: "Calendar",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Calendar" },
          { key: "dateField", label: "Date field", type: "fieldPicker", affectsQuery: true },
          { key: "labelField", label: "Label field", type: "fieldPicker", affectsQuery: true },
          { key: "limit", label: "Limit", type: "number", defaultValue: 12, min: 1, max: 100, step: 1, affectsQuery: true },
        ],
      }],
    },
    getDefaultConfig: () => ({ title: "Calendar", dateField: "", labelField: "", limit: 12 }),
    getDemoData: (config = {}) => demoDataResult({ widgetType: "calendar", config }),
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      const mapping = resolvedContext.semanticMapping || {};
      return {
        fields: unique([
          config.dateField || mapping.dateField,
          config.labelField || mapping.labelField,
          ...defaultQueryFields(resolvedContext),
        ]).slice(0, 4),
        limit: Number(config.limit) || 12,
      };
    },
    render: ({ instance, resolvedContext, data, status }) => {
      const title = instance.config.title || "Calendar";
      const config = instance.config || {};
      const mapping = resolvedContext?.semanticMapping || {};
      const dateField = String(config.dateField || mapping.dateField || "").trim();
      if (!resolvedContext?.dataSourceId) return runtimeState(title, "Configure a data source");
      if (!dateField) return runtimeState(title, "Configure date field");
      if (status === "loading") return runtimeState(title, "Loading");
      if (status === "error") return runtimeState(title, data?.error || "Unable to load dates");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      if (!rows.length) return runtimeState(title, "No date rows match the current context");
      const events = calendarExtractEvents(data, config, mapping);
      if (!events.length) return runtimeState(title, "No valid dates");
      const first = events[0].date;
      const monthName = first.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const initialDate = first.toISOString().split("T")[0];
      return `
        <div class="runtime-calendar-widget" data-runtime-state="ready" data-runtime-source="${escapeHtml(runtimeSource(data))}" data-calendar-demo="${data?.demo ? "true" : "false"}">
          <div class="widget-content-well widget-library-surface runtime-calendar-fullcalendar-surface">
            <div class="runtime-calendar-fullcalendar" data-calendar-initial="${escapeHtml(initialDate)}" role="region" aria-label="${escapeHtml(monthName)}"></div>
          </div>
          <div class="runtime-calendar-list">
            ${events.slice(0, 3).map((event) => `<span><b>${escapeHtml(String(event.date.getDate()))}</b>${escapeHtml(event.label)}</span>`).join("")}
          </div>
        </div>`;
    },
    mountBodyRenderer: ({ contentRoot, instance, resolvedContext, data, status }) => {
      const target = contentRoot?.querySelector?.(".runtime-calendar-fullcalendar");
      if (!target || status !== "ready") return null;
      const config = instance?.config || {};
      const mapping = resolvedContext?.semanticMapping || {};
      const events = calendarExtractEvents(data, config, mapping);
      if (!events.length) return null;
      const initialDate = target.dataset.calendarInitial || events[0].date.toISOString().split("T")[0];
      const fcEvents = events.map((event) => ({
        title: event.label,
        start: event.date,
        allDay: true,
        extendedProps: { state: event.state },
      }));
      let disposed = false;
      let calendar = null;
      let resizeObserver = null;
      loadFullCalendar()
        .then((FC) => {
          if (disposed || !target.isConnected) return;
          calendar = new FC.Calendar(target, {
            initialView: "dayGridMonth",
            initialDate,
            events: fcEvents,
            headerToolbar: false,
            height: "100%",
            editable: false,
            selectable: false,
            eventDisplay: "block",
            dayMaxEvents: 2,
            fixedWeekCount: false,
          });
          calendar.render();
          resizeObserver = new ResizeObserver(() => calendar?.updateSize());
          resizeObserver.observe(target);
          requestAnimationFrame(() => calendar?.updateSize());
        })
        .catch((error) => {
          if (disposed || !target.isConnected) return;
          target.innerHTML = `<div class="widget-runtime-state" data-runtime-state="error"><span class="stat-lbl">${escapeHtml(error?.message || "Unable to load calendar renderer")}</span></div>`;
        });
      return () => {
        disposed = true;
        resizeObserver?.disconnect();
        calendar?.destroy();
        calendar = null;
      };
    },
  });

  let flatpickrLoadPromise = null;
  const loadFlatpickr = () => {
    if (window.flatpickr) return Promise.resolve(window.flatpickr);
    if (!flatpickrLoadPromise) {
      flatpickrLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector("script[data-dashboard-flatpickr]");
        if (existing) {
          existing.addEventListener("load", () => window.flatpickr ? resolve(window.flatpickr) : reject(new Error("Flatpickr failed to initialize")), { once: true });
          existing.addEventListener("error", () => reject(new Error("Flatpickr failed to load")), { once: true });
          return;
        }
        if (!document.querySelector("link[data-dashboard-flatpickr-css]")) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css";
          link.dataset.dashboardFlatpickrCss = "true";
          document.head.appendChild(link);
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/flatpickr";
        script.async = true;
        script.dataset.dashboardFlatpickr = "true";
        script.onload = () => window.flatpickr ? resolve(window.flatpickr) : reject(new Error("Flatpickr failed to initialize"));
        script.onerror = () => { flatpickrLoadPromise = null; reject(new Error("Flatpickr failed to load")); };
        document.head.appendChild(script);
      });
    }
    return flatpickrLoadPromise;
  };
  const timeframeFlatpickrInstances = new WeakMap();
  const mountTimeframeFlatpickr = (container) => {
    const dateInputs = container.querySelectorAll("input[type='date'][data-timeframe-filter-part]");
    if (!dateInputs.length) return;
    loadFlatpickr().then((fp) => {
      dateInputs.forEach((input) => {
        if (timeframeFlatpickrInstances.has(input) || !input.isConnected) return;
        const instance = fp(input, { dateFormat: "Y-m-d", allowInput: true, disableMobile: true });
        timeframeFlatpickrInstances.set(input, instance);
      });
    }).catch(() => { /* fallback: native date inputs remain */ });
  };
  const destroyTimeframeFlatpickr = (container) => {
    container.querySelectorAll("input[type='date'][data-timeframe-filter-part]").forEach((input) => {
      const instance = timeframeFlatpickrInstances.get(input);
      if (instance) { try { instance.destroy(); } catch (_) {} timeframeFlatpickrInstances.delete(input); }
    });
  };

  window.dashboardWidgetRuntime = {
    registerWidgetDefinition,
    getWidgetDefinition,
    createWidgetInstance,
    renderWidget,
    resolveWidgetDensity,
    resolveTimeRangeConfig,
    resolveTimeframeFilter,
    normalizeTimeframeFilters,
    mountTimeframeFlatpickr,
    destroyTimeframeFlatpickr,
    timeframeFilterTypes: () => TIMEFRAME_FILTER_TYPES.map((type) => ({ ...type })),
    weekStartOptions: () => WEEKDAY_OPTIONS.map((option) => ({ ...option })),
    densityTiers: () => [...DENSITY_TIERS],
    listWidgetDefinitions: () => [...definitions.values()].map((definition) => ({
      type: definition.type,
      label: definition.label || definition.displayName || definition.type,
      displayName: definition.displayName,
      defaultSize: definition.defaultSize,
      minSize: definition.minSize,
      capabilities: definition.capabilities,
      supportedSettings: definition.supportedSettings,
      settingsSchema: definition.settingsSchema,
      densityBehavior: definition.densityBehavior,
      queryRequirements: definition.queryRequirements,
      category: definition.category,
      subcategory: definition.subcategory,
      layer: definition.layer,
      engineerOnly: definition.engineerOnly,
      icon: definition.icon,
      aliases: definition.aliases,
      shell: definition.shell === false ? { enabled: false } : {
        enabled: true,
        mode: definition.shell?.mode || "compat",
        showHeader: Boolean(definition.shell?.showHeader),
      },
      hasDemoData: typeof definition.getDemoData === "function",
    })),
    parseConfig,
  };
  window.dashboardChartRuntime = {
    registerChartDefinition,
    getChartDefinition,
    listChartDefinitions,
  };
})();
