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
    if (safeCols <= 2) return 2;
    if (safeCols <= 3) return 4;
    return 6;
  };
  const tableVisibleRowCount = (rows, limit) => {
    const safeRows = Math.max(1, Number(rows) || 1);
    const rowCapacity = Math.max(1, (safeRows * 2) - 1);
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
    { id: "last_30_days", label: "Last 30 days" },
    { id: "month_to_date", label: "Month to date" },
    { id: "year_to_date", label: "Year to date" },
    { id: "custom", label: "Custom range" },
  ];
  const TIMEFRAME_PRESETS = [...TIMEFRAME_FILTER_TYPES, ...LEGACY_TIMEFRAME_PRESETS];
  const DEFAULT_TIMEFRAME_FILTERS = [
    { id: "time-today", label: "Today", type: "today" },
    { id: "time-this-week", label: "This week", type: "this_week" },
    { id: "time-last-7-days", label: "Last 7 days", type: "last_7_days" },
    { id: "time-last-30-days", label: "Last 30 days", type: "last_30_days" },
    { id: "time-yesterday", label: "Yesterday", type: "yesterday" },
    { id: "time-last-week", label: "Last week", type: "last_week" },
    { id: "time-this-month", label: "This month", type: "this_month" },
    { id: "time-last-month", label: "Last month", type: "last_month" },
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
    const configured = Array.isArray(config.filters) && config.filters.length
      ? config.filters.map(normalizeTimeframeFilter)
      : Array.isArray(config.presets) && config.presets.length
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
    if (normalized.type === "last_30_days") range = { start: dateOnly(shiftedDate(today, -29)), end: dateOnly(today) };
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
      label = "Last 7 days";
    } else if (preset === "last_30_days") {
      start = dateOnly(shiftedDate(today, -29));
      end = dateOnly(today);
      label = "Last 30 days";
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
  const CHART_PALETTE = ["one", "two", "three", "four", "five", "six"];
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
  const chartFrame = ({ instance, definition, density, body, meta = "", legend = "" }) => {
    const title = instance.config?.title || definition.displayName || "Chart";
    const densityTier = normalizeDensity(instance?.density, resolveWidgetDensity(instance));
    return `
      <div class="runtime-chart-widget runtime-chart-density-${density} widget-density-${densityTier}" data-density="${escapeHtml(densityTier)}" data-chart-type="${escapeHtml(definition.chartType)}" data-chart-category="${escapeHtml(definition.category || "general")}">
        <div class="runtime-chart-header">
          <span class="stat-lbl">${escapeHtml(title)}</span>
          ${meta ? `<span class="runtime-chart-meta">${escapeHtml(meta)}</span>` : ""}
        </div>
        <div class="runtime-chart-stage">${body}</div>
        ${legend}
      </div>`;
  };
  const chartSvg = (content, options = {}) => `
    <svg class="runtime-chart-svg" viewBox="0 0 ${options.width || 100} ${options.height || 64}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(options.label || "Chart")}">
      ${content}
    </svg>`;
  const axisLayer = () => `
    <line class="runtime-chart-axis" x1="8" y1="56" x2="96" y2="56"></line>
    <line class="runtime-chart-axis" x1="8" y1="8" x2="8" y2="56"></line>`;
  const chartLegend = (items, density) => {
    if (!items.length || density === "tiny") return "";
    return `<div class="runtime-chart-legend">${items.slice(0, density === "small" ? 3 : 6).map((item, index) => `
      <span class="runtime-chart-legend-item"><i class="runtime-chart-swatch runtime-chart-fill-${CHART_PALETTE[index % CHART_PALETTE.length]}"></i>${escapeHtml(item)}</span>
    `).join("")}</div>`;
  };
  const renderBarLikeChart = ({ instance, definition, rows, resolvedContext }) => {
    const config = instance.config || {};
    const density = chartDensityFor(instance);
    const points = groupedChartData(rows, config, resolvedContext, { series: ["grouped-bar", "stacked-bar"].includes(definition.chartType) });
    if (!points.length) return runtimeState(config.title || definition.displayName, "Empty data");
    const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
    const horizontal = definition.chartType === "horizontal-bar";
    const lollipop = definition.chartType === "lollipop";
    const count = Math.max(1, points.length);
    const content = points.map((point, index) => {
      const slot = 84 / count;
      const x = 10 + (index * slot);
      const barWidth = Math.max(2.4, slot * 0.54);
      const h = Math.max(2, (Math.abs(point.value) / max) * 43);
      const y = 56 - h;
      const cls = `runtime-chart-fill-${CHART_PALETTE[index % CHART_PALETTE.length]}`;
      if (horizontal) {
        const yPos = 10 + (index * (46 / count));
        const w = Math.max(3, (Math.abs(point.value) / max) * 78);
        return `<rect class="runtime-chart-bar ${cls}" x="12" y="${yPos.toFixed(2)}" width="${w.toFixed(2)}" height="${Math.max(2.5, 32 / count).toFixed(2)}" rx="1.4"></rect>`;
      }
      if (lollipop) {
        const cx = x + (barWidth / 2);
        return `<line class="runtime-chart-stem ${cls}" x1="${cx.toFixed(2)}" y1="56" x2="${cx.toFixed(2)}" y2="${y.toFixed(2)}"></line><circle class="runtime-chart-point ${cls}" cx="${cx.toFixed(2)}" cy="${y.toFixed(2)}" r="2.6"></circle>`;
      }
      return `<rect class="runtime-chart-bar ${cls}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" rx="1.6"></rect>`;
    }).join("");
    return chartFrame({
      instance,
      definition,
      density,
      meta: `${points.length} groups`,
      body: chartSvg(`${config.display?.showAxes === false || density === "tiny" ? "" : axisLayer()}${content}`, { label: definition.displayName }),
      legend: chartLegend([...new Set(points.map((point) => point.series))], density),
    });
  };
  const linePathFor = (points) => points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const renderLineLikeChart = ({ instance, definition, rows, resolvedContext }) => {
    const config = instance.config || {};
    const density = chartDensityFor(instance);
    const xField = chartXField(config, resolvedContext);
    const yField = chartValueField(config, resolvedContext);
    const numeric = rows.map((row, index) => ({ row, index, yValue: numberValue(row?.[yField]), xValue: row?.[xField] }))
      .filter((entry) => entry.yValue != null)
      .slice(0, chartLimit(config, 80));
    if (!numeric.length) return runtimeState(config.title || definition.displayName, "Empty data");
    const min = Math.min(...numeric.map((entry) => entry.yValue));
    const max = Math.max(...numeric.map((entry) => entry.yValue), min + 1);
    const points = numeric.map((entry, index) => ({
      x: 9 + (index * (86 / Math.max(1, numeric.length - 1))),
      y: 55 - (((entry.yValue - min) / Math.max(1, max - min)) * 44),
    }));
    const path = linePathFor(points);
    const area = ["area", "stacked-area"].includes(definition.chartType);
    const marks = density === "large" ? points.map((point) => `<circle class="runtime-chart-point runtime-chart-fill-one" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="1.8"></circle>`).join("") : "";
    const body = chartSvg(`
      ${config.display?.showAxes === false || definition.chartType === "sparkline" || density === "tiny" ? "" : axisLayer()}
      ${area ? `<path class="runtime-chart-area runtime-chart-fill-one" d="${path} L ${points.at(-1).x.toFixed(2)} 56 L ${points[0].x.toFixed(2)} 56 Z"></path>` : ""}
      <path class="runtime-chart-line runtime-chart-stroke-one" d="${path}"></path>
      ${marks}
    `, { label: definition.displayName });
    return chartFrame({ instance, definition, density, meta: `${numeric.length} points`, body });
  };
  const renderScatterChart = ({ instance, definition, rows, resolvedContext }) => {
    const config = instance.config || {};
    const density = chartDensityFor(instance);
    const xField = chartXField(config, resolvedContext);
    const yField = chartValueField(config, resolvedContext);
    const sizeField = chartField(config, resolvedContext, "sizeField", ["valueField"]);
    const points = rows.map((row) => ({
      x: numberValue(row?.[xField]),
      y: numberValue(row?.[yField]),
      size: numberValue(row?.[sizeField]),
    })).filter((point) => point.x != null && point.y != null).slice(0, chartLimit(config, 80));
    if (!points.length) return runtimeState(config.title || definition.displayName, "Empty data");
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x), minX + 1);
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y), minY + 1);
    const maxSize = Math.max(...points.map((point) => point.size || 1), 1);
    const marks = points.map((point, index) => {
      const x = 10 + (((point.x - minX) / Math.max(1, maxX - minX)) * 84);
      const y = 55 - (((point.y - minY) / Math.max(1, maxY - minY)) * 44);
      const r = definition.chartType === "bubble" ? 1.8 + (((point.size || 1) / maxSize) * 3) : 2.2;
      return `<circle class="runtime-chart-point runtime-chart-fill-${CHART_PALETTE[index % CHART_PALETTE.length]}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}"></circle>`;
    }).join("");
    return chartFrame({ instance, definition, density, meta: `${points.length} points`, body: chartSvg(`${axisLayer()}${marks}`, { label: definition.displayName }) });
  };
  const renderHistogramChart = ({ instance, definition, rows, resolvedContext }) => {
    const config = instance.config || {};
    const density = chartDensityFor(instance);
    const yField = chartValueField(config, resolvedContext);
    const values = numericRowsFor(rows, yField).map((entry) => entry.value);
    if (!values.length) return runtimeState(config.title || definition.displayName, "Empty data");
    const min = Math.min(...values);
    const max = Math.max(...values, min + 1);
    const binCount = density === "large" ? 8 : density === "tiny" ? 4 : 6;
    const bins = Array.from({ length: binCount }, (_, index) => ({ index, count: 0 }));
    values.forEach((value) => {
      const index = Math.min(binCount - 1, Math.floor(((value - min) / Math.max(1, max - min)) * binCount));
      bins[index].count += 1;
    });
    const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
    const content = bins.map((bin) => {
      const slot = 84 / binCount;
      const h = Math.max(1, (bin.count / maxCount) * 42);
      return `<rect class="runtime-chart-bar runtime-chart-fill-one" x="${(10 + bin.index * slot).toFixed(2)}" y="${(56 - h).toFixed(2)}" width="${Math.max(3, slot * 0.72).toFixed(2)}" height="${h.toFixed(2)}" rx="1.4"></rect>`;
    }).join("");
    return chartFrame({ instance, definition, density, meta: `${values.length} values`, body: chartSvg(`${axisLayer()}${content}`, { label: definition.displayName }) });
  };
  const pieArcPath = (cx, cy, r, start, end, inner = 0) => {
    const large = end - start > Math.PI ? 1 : 0;
    const p = (angle, radius) => [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    const [x1, y1] = p(start, r);
    const [x2, y2] = p(end, r);
    if (!inner) return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    const [x3, y3] = p(end, inner);
    const [x4, y4] = p(start, inner);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${inner} ${inner} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
  };
  const renderPieChart = ({ instance, definition, rows, resolvedContext }) => {
    const config = instance.config || {};
    const density = chartDensityFor(instance);
    const points = groupedChartData(rows, config, resolvedContext).filter((point) => point.value > 0).slice(0, chartLimit(config, 8));
    if (!points.length) return runtimeState(config.title || definition.displayName, "Empty data");
    const total = points.reduce((sum, point) => sum + point.value, 0) || 1;
    let cursor = -Math.PI / 2;
    const inner = definition.chartType === "donut" ? 14 : 0;
    const content = points.map((point, index) => {
      const next = cursor + ((point.value / total) * Math.PI * 2);
      const path = pieArcPath(50, 32, 24, cursor, next, inner);
      cursor = next;
      return `<path class="runtime-chart-slice runtime-chart-fill-${CHART_PALETTE[index % CHART_PALETTE.length]}" d="${path}"></path>`;
    }).join("");
    return chartFrame({ instance, definition, density, meta: `${points.length} slices`, body: chartSvg(content, { label: definition.displayName }), legend: chartLegend(points.map((point) => point.x), density) });
  };
  const renderGaugeChart = ({ instance, definition, rows, resolvedContext }) => {
    const config = instance.config || {};
    const density = chartDensityFor(instance);
    const yField = chartValueField(config, resolvedContext);
    const values = numericRowsFor(rows, yField).map((entry) => entry.value);
    if (!values.length) return runtimeState(config.title || definition.displayName, "Empty data");
    const value = aggregateValues(values, chartConfiguredAggregation(config)) || 0;
    const max = Number(config.max) || Math.max(value, ...values, 100);
    const ratio = Math.max(0, Math.min(1, value / Math.max(1, max)));
    const end = -180 + (180 * ratio);
    const arc = (radius, start, stop) => {
      const toPoint = (degree) => {
        const angle = (degree * Math.PI) / 180;
        return [50 + Math.cos(angle) * radius, 52 + Math.sin(angle) * radius];
      };
      const [x1, y1] = toPoint(start);
      const [x2, y2] = toPoint(stop);
      return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    };
    const label = definition.chartType === "radial-progress" ? `${Math.round(ratio * 100)}%` : formatMetricValue(value, config.format);
    const body = chartSvg(`
      <path class="runtime-chart-gauge-track" d="${arc(30, -180, 0)}"></path>
      <path class="runtime-chart-gauge-value runtime-chart-stroke-one" d="${arc(30, -180, end)}"></path>
      <text class="runtime-chart-value-label" x="50" y="48">${escapeHtml(label)}</text>
    `, { label: definition.displayName });
    return chartFrame({ instance, definition, density, meta: "current", body });
  };
  const renderHeatmapChart = ({ instance, definition, rows, resolvedContext }) => {
    const config = instance.config || {};
    const density = chartDensityFor(instance);
    const xField = chartXField(config, resolvedContext);
    const yField = chartField(config, resolvedContext, "seriesField", ["ownerField", "statusField", "categoryField"]);
    const valueField = chartValueField(config, resolvedContext);
    const xValues = unique(rows.map((row) => chartEscapeLabel(row?.[xField]))).slice(0, density === "large" ? 8 : 5);
    const yValues = unique(rows.map((row) => chartEscapeLabel(row?.[yField]))).slice(0, density === "large" ? 6 : 4);
    const cells = [];
    xValues.forEach((x) => yValues.forEach((y) => {
      const matching = rows.filter((row) => chartEscapeLabel(row?.[xField]) === x && chartEscapeLabel(row?.[yField]) === y);
      const value = aggregateValues(matching.map((row) => chartConfiguredAggregation(config) === "count" ? 1 : row?.[valueField]), chartConfiguredAggregation(config)) || 0;
      cells.push({ x, y, value });
    }));
    const max = Math.max(...cells.map((cell) => cell.value), 1);
    const cellW = 82 / Math.max(1, xValues.length);
    const cellH = 44 / Math.max(1, yValues.length);
    const content = cells.map((cell) => {
      const x = 10 + (xValues.indexOf(cell.x) * cellW);
      const y = 10 + (yValues.indexOf(cell.y) * cellH);
      const opacity = 0.22 + ((cell.value / max) * 0.68);
      return `<rect class="runtime-chart-heat-cell runtime-chart-fill-one" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(2, cellW - 1).toFixed(2)}" height="${Math.max(2, cellH - 1).toFixed(2)}" rx="1.2" style="opacity:${opacity.toFixed(2)}"></rect>`;
    }).join("");
    return chartFrame({ instance, definition, density, meta: `${xValues.length} x ${yValues.length}`, body: chartSvg(content, { label: definition.displayName }) });
  };
  const renderKpiTrendChart = ({ instance, definition, rows, resolvedContext }) => {
    const config = instance.config || {};
    const yField = chartValueField(config, resolvedContext);
    const values = numericRowsFor(rows, yField).map((entry) => entry.value);
    if (!values.length) return runtimeState(config.title || definition.displayName, "Empty data");
    const current = values.at(-1);
    const previous = values.length > 1 ? values.at(-2) : current;
    const delta = current - previous;
    return `
      <div class="runtime-chart-kpi" data-chart-type="${escapeHtml(definition.chartType)}">
        <span class="stat-val">${escapeHtml(formatMetricValue(current, config.format))}</span>
        <span class="stat-lbl">${escapeHtml(config.title || definition.displayName)}</span>
        <span class="runtime-chart-meta">${escapeHtml(delta >= 0 ? `+${formatMetricValue(delta)}` : formatMetricValue(delta))}</span>
      </div>`;
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
      render: renderBarLikeChart,
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
    ["bar", "Bar", "basic-comparison", ["xField"], renderBarLikeChart],
    ["horizontal-bar", "Horizontal Bar", "basic-comparison", ["xField"], renderBarLikeChart],
    ["grouped-bar", "Grouped Bar", "basic-comparison", ["xField", "seriesField"], renderBarLikeChart],
    ["stacked-bar", "Stacked Bar", "basic-comparison", ["xField", "seriesField"], renderBarLikeChart],
    ["lollipop", "Lollipop", "basic-comparison", ["xField"], renderBarLikeChart],
    ["line", "Line", "time-series", ["xField", "yField"], renderLineLikeChart],
    ["multi-line", "Multi-line", "time-series", ["xField", "yField"], renderLineLikeChart],
    ["area", "Area", "time-series", ["xField", "yField"], renderLineLikeChart],
    ["stacked-area", "Stacked Area", "time-series", ["xField", "yField"], renderLineLikeChart],
    ["sparkline", "Sparkline", "time-series", ["xField", "yField"], renderLineLikeChart],
    ["histogram", "Histogram", "distribution", ["yField"], renderHistogramChart],
    ["box-plot", "Box Plot", "distribution", ["yField"], renderHistogramChart],
    ["scatter", "Scatter", "relationship", ["xField", "yField"], renderScatterChart],
    ["bubble", "Bubble", "relationship", ["xField", "yField"], renderScatterChart],
    ["heatmap", "Heatmap", "relationship", ["xField", "seriesField"], renderHeatmapChart],
    ["pie", "Pie", "composition", ["xField"], renderPieChart],
    ["donut", "Donut", "composition", ["xField"], renderPieChart],
    ["gauge", "Gauge", "ranking-progress", ["yField"], renderGaugeChart],
    ["radial-progress", "Radial Progress", "ranking-progress", ["yField"], renderGaugeChart],
    ["progress-bar", "Progress Bar", "ranking-progress", ["yField"], renderGaugeChart],
    ["kpi-trend", "KPI Trend Card", "ranking-progress", ["xField", "yField"], renderKpiTrendChart],
  ].forEach(([chartType, displayName, category, requiredFields, render]) => registerChartDefinition({
    chartType,
    displayName,
    category,
    requiredFields,
    render,
    defaultConfig: { chartType },
    valueRequiredForAggregation: !["bar", "horizontal-bar", "grouped-bar", "stacked-bar", "lollipop", "pie", "donut", "heatmap"].includes(chartType),
  }));

  const runtimeState = (label, helper = "") => `
      <div class="widget-runtime-state">
        <span class="stat-val">${escapeHtml(label)}</span>
        ${helper ? `<span class="stat-lbl">${escapeHtml(helper)}</span>` : ""}
      </div>`;

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
  const mediaState = (label, helper, state = "empty") => `
      <div class="media-widget-state media-widget-state-${escapeHtml(state)}" role="status">
        <span class="stat-val">${escapeHtml(label)}</span>
        ${helper ? `<span class="stat-lbl">${escapeHtml(helper)}</span>` : ""}
      </div>`;

  const mediaTitle = (config, fallback) => String(config?.title || fallback || "").trim();
  const mediaCaptionMarkup = (caption) => caption
    ? `<div class="media-widget-caption">${escapeHtml(caption)}</div>`
    : "";

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
    render: ({ instance }) => `
      <div class="unsupported-widget-state widget-runtime-state" role="status">
        <span class="stat-val">Unsupported widget</span>
        <span class="stat-lbl">${escapeHtml(instance.type || type || "unknown")}</span>
      </div>`,
  });

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
      getDemoData: typeof definition.getDemoData === "function" ? definition.getDemoData : null,
      resolveQuery: typeof definition.resolveQuery === "function" ? definition.resolveQuery : () => null,
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
      return resolvedDefinition.render({
        ...props,
        density,
        instance: { ...instance, density },
        definition: resolvedDefinition,
        status,
      });
    } catch (error) {
      return runtimeState("Widget error", error?.message || "Render failed");
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
    render: ({ instance, resolvedContext, data, status, density = instance.density || "standard" }) => {
      const config = instance.config || {};
      const densityTier = normalizeDensity(density);
      const label = statLabelFor(config);
      const metric = ["count", "sum", "avg", "min", "max"].includes(config.metric) ? config.metric : "count";
      const mapping = resolvedContext?.semanticMapping || data?.semanticMapping || {};
      const valueField = config.valueField || mapping.valueField;
      if (!resolvedContext?.dataSourceId) return runtimeState(label, "Needs data source");
      if (metric !== "count" && !valueField) return runtimeState(label, "Map a value field");
      if (status === "loading") return runtimeState(label, "Loading");
      if (status === "error") return runtimeState(label, data?.error || "Unable to load metric");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
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
      return `
        <span class="stat-val">${escapeHtml(formatMetricValue(value, config.format))}</span>
        ${densityTier === "tiny" ? "" : `<span class="stat-lbl">${escapeHtml(label)}</span>`}`;
    },
  });

  registerWidgetDefinition({
    type: "timeframe",
    displayName: "Timeframe",
    category: "controls",
    aliases: ["controls", "time-range"],
    defaultSize: { cols: 4, rows: 1 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "controls",
    dashboardObjectKind: "timeframe",
    contextRole: "timeframe-control",
    htmlTag: "nav",
    className: "range-bar widget-card timeframe-widget widget-card-custom",
    ariaLabel: "Timeframe controls",
    capabilities: {
      readsContext: true,
      writesContext: true,
      requiresDataSource: false,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["timeRange", "color", "pin", "delete"],
    settingsSchema: {
      sections: [{
        id: "timeframe",
        label: "Timeframe",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Timeframe" },
          { key: "weekStartDay", label: "Week starts on", type: "select", defaultValue: 0, options: WEEKDAY_OPTIONS, affectsContext: true },
          { key: "selectedPreset", label: "Preset", type: "select", defaultValue: "", options: TIMEFRAME_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })), affectsContext: true },
          { key: "customStart", label: "Custom start", type: "date", affectsContext: true },
          { key: "customEnd", label: "Custom end", type: "date", affectsContext: true },
        ],
      }],
    },
    queryRequirements: { timeRange: true },
    getDefaultConfig: () => ({
      title: "Timeframe",
      activeLabel: "Any time",
      selectedFilterId: "",
      weekStartDay: 0,
      selectedPreset: "",
      customStart: "",
      customEnd: "",
      filters: DEFAULT_TIMEFRAME_FILTERS.map((filter) => ({ ...filter })),
      presets: ["today", "last_7_days", "last_30_days", "yesterday", "custom"],
    }),
    resolveQuery: () => null,
    render: ({ instance, resolvedContext, density: densityProp = instance.density || "standard" }) => {
      const config = instance.config || {};
      const filters = normalizeTimeframeFilters(config);
      const selectedFilterId = selectedTimeframeFilterId(config, filters);
      const selectedFilter = filters.find((filter) => filter.id === selectedFilterId) || null;
      const selectedPreset = selectedFilter?.type || String(config.selectedPreset || config.preset || "").trim();
      const timeRange = resolveTimeRangeConfig(config, resolvedContext);
      const label = timeframeLabel(timeRange, config.activeLabel || "Any time");
      const densityTier = normalizeDensity(densityProp);
      const cols = Number(instance.cols) || 4;
      const rows = Number(instance.rows) || 1;
      const density = cols <= 2
        ? "small"
        : rows >= 2 || cols >= 5 || richDensity(densityTier)
          ? "large"
          : compactDensity(densityTier)
            ? "small"
            : "medium";
      const selectedIsCustom = ["custom", "custom_fixed"].includes(selectedFilter?.type || selectedPreset);
      const customStart = selectedFilter?.start || config.customStart || timeRange?.start || "";
      const customEnd = selectedFilter?.end || config.customEnd || timeRange?.end || "";
      return `
        <div class="timeframe-command-surface timeframe-density-${density} widget-density-${densityTier}" data-density="${escapeHtml(densityTier)}" data-timeframe-current-label="${escapeHtml(label)}" data-widget-control-surface="true">
          <div class="range-controls timeframe-controls">
            <div class="range-presets timeframe-presets" role="group" aria-label="Time filters">
              ${filters.map((filter) => `<button class="preset-btn timeframe-filter-button${filter.id === selectedFilterId ? " active" : ""}" type="button" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-preset="${escapeHtml(filter.type)}" aria-pressed="${filter.id === selectedFilterId ? "true" : "false"}">${escapeHtml(filter.label)}</button>`).join("")}
            </div>
          </div>
          <div class="timeframe-active-cluster">
            <span class="timeframe-selected-summary timeframe-selector${selectedFilterId || timeRange ? " active" : ""}" role="status" aria-live="polite" aria-label="Selected time range" title="Selected time range">${escapeHtml(label)}</span>
          </div>
          ${density === "large" && selectedIsCustom ? `<div class="timeframe-custom-range" role="group" aria-label="Custom time range">
            <input class="timeframe-custom-date" type="date" data-timeframe-filter-id="${escapeHtml(selectedFilterId)}" data-timeframe-part="start" value="${escapeHtml(customStart)}" aria-label="Custom start date">
            <input class="timeframe-custom-date" type="date" data-timeframe-filter-id="${escapeHtml(selectedFilterId)}" data-timeframe-part="end" value="${escapeHtml(customEnd)}" aria-label="Custom end date">
          </div>` : ""}
          <div class="range-search timeframe-range timeframe-utility-cluster" role="group" aria-label="Timeframe utilities">
            <button class="range-icon-button timeframe-refresh" type="button" aria-label="Refresh timeframe" title="Refresh timeframe"><span class="timeframe-refresh-icon" aria-hidden="true"></span></button>
            <button class="range-icon-button timeframe-calendar" type="button" aria-label="Open date range" title="Open date range"><span class="timeframe-calendar-icon" aria-hidden="true"></span></button>
          </div>
        </div>`;
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
    type: "filter",
    displayName: "Filter Control",
    category: "controls",
    aliases: ["filter-control"],
    defaultSize: { cols: 3, rows: 4 },
    minSize: { cols: 2, rows: 3 },
    widgetType: "filter",
    dashboardObjectKind: "filter",
    contextRole: "filter-control",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom filter-widget-card",
    capabilities: {
      readsContext: true,
      writesContext: true,
      requiresDataSource: false,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["filters", "scope", "color", "pin", "delete"],
    settingsSchema: {
      sections: [{
        id: "filters",
        label: "Filters",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Filters" },
          { key: "filters", label: "Filter config", type: "json", defaultValue: [{ id: "search", type: "text", label: "Search", operator: "contains", value: "" }], affectsContext: true },
          { key: "limit", label: "Option sample", type: "number", defaultValue: 200, min: 1, max: 1000, step: 1, affectsQuery: true },
        ],
      }],
    },
    queryRequirements: { fields: "filter-controls", limit: 200 },
    getDemoData: (config = {}) => demoDataResult({ widgetType: "filter", config }),
    getDefaultConfig: () => ({
      title: "Filters",
      filters: [{ id: "search", type: "text", label: "Search", operator: "contains", value: "" }],
    }),
    resolveQuery: (config, resolvedContext) => {
      if (!resolvedContext?.canQuery) return null;
      const fields = unique(filterControlsFromConfig(config, resolvedContext, null).map((filter) => filter.field));
      return fields.length ? { fields, limit: Number(config.limit) || 200 } : null;
    },
    render: ({ instance, resolvedContext, data }) => {
      const config = instance.config || {};
      const controls = filterControlsFromConfig(config, resolvedContext, data);
      const density = Number(instance.rows) <= 1 || Number(instance.cols) <= 2
        ? "small"
        : Number(instance.rows) >= 4 || Number(instance.cols) >= 4
          ? "large"
          : "medium";
      const visibleControls = controls.slice(0, density === "small" ? 1 : density === "medium" ? 3 : controls.length);
      return `
        <div class="filter-widget-content filter-widget-density-${density}" data-filter-control-count="${controls.length}">
          <div class="filter-widget-header">
            <span class="stat-lbl">${escapeHtml(config.title || "Filters")}</span>
            ${resolvedContext?.dataSourceId ? `<span class="filter-widget-meta">${escapeHtml(`${visibleControls.length} active controls`)}</span>` : ""}
          </div>
          <div class="filter-widget-controls">
            ${visibleControls.map(renderFilterControl).join("")}
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
            : `<div class="text-widget-header"><span class="stat-lbl">${escapeHtml(config.title || "Note")}</span></div>
              <textarea class="text-widget-editor" aria-label="${escapeHtml(config.title || "Note")}" spellcheck="true" placeholder="${escapeHtml(config.placeholder || "Write a note")}">${escapeHtml(body)}</textarea>`}
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
          <div class="region-summary-header">
            <span class="stat-lbl">${escapeHtml(instance.config.title || "Region Summary")}</span>
            <span class="region-summary-range">${escapeHtml(rowRange)}</span>
          </div>
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
    type: "data-filter",
    displayName: "Data Filter",
    category: "data",
    subcategory: "Data Filter",
    layer: "backend",
    engineerOnly: true,
    aliases: ["stat-filter", "logic-gate", "logic", "gate", "logical-gate"],
    defaultSize: { cols: 2, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    widgetType: "data-filter",
    dashboardObjectKind: "data-filter",
    contextRole: "dataflow-filter",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom data-filter-widget-card",
    capabilities: {
      readsContext: false,
      writesContext: false,
      requiresDataSource: false,
      supportsFilters: false,
      supportsTimeRange: false,
      supportsResize: true,
      exposesPorts: true,
    },
    supportedSettings: [
      "filterMode",
      "operator",
      "sourceType",
      "targetType",
      "conversionBehavior",
      "fallbackBehavior",
      "fallbackValue",
      "invertOutput",
      "allowMultipleInputs",
      "color",
      "pin",
      "duplicate",
      "delete",
    ],
    settingsSchema: {
      sections: [{
        id: "mode",
        label: "Mode",
        fields: [
          {
            key: "filterMode",
            label: "Filter mode",
            type: "select",
            defaultValue: "logic",
            options: dataFilterModes,
            surface: "logic",
          },
          {
            key: "operator",
            label: "Operator",
            type: "select",
            defaultValue: "AND",
            options: ["AND", "OR", "NOT"],
            surface: "logic",
          },
          {
            key: "sourceType",
            label: "Input type",
            type: "select",
            defaultValue: "auto",
            options: dataFilterTypes,
            surface: "logic",
          },
          {
            key: "targetType",
            label: "Output type",
            type: "select",
            defaultValue: "boolean",
            options: dataFilterTypes.filter((type) => type.value !== "auto"),
            surface: "logic",
          },
          {
            key: "conversionBehavior",
            label: "Conversion",
            type: "select",
            defaultValue: "round",
            options: dataFilterConversionBehaviors,
            surface: "logic",
          },
          {
            key: "fallbackBehavior",
            label: "Invalid conversion",
            type: "select",
            defaultValue: "null",
            options: dataFilterFallbackBehaviors,
            surface: "logic",
          },
          {
            key: "fallbackValue",
            label: "Default value",
            type: "text",
            defaultValue: "",
            surface: "logic",
          },
          {
            key: "invertOutput",
            label: "Invert output",
            type: "toggle",
            defaultValue: false,
            surface: "logic",
          },
          {
            key: "allowMultipleInputs",
            label: "Multiple inputs",
            type: "toggle",
            defaultValue: true,
            surface: "logic",
          },
        ],
      }],
    },
    queryRequirements: { dataflow: true },
    getDefaultConfig: () => ({
      title: "Data Filter",
      filterMode: "logic",
      operator: "AND",
      sourceType: "auto",
      targetType: "boolean",
      conversionBehavior: "round",
      fallbackBehavior: "null",
      fallbackValue: "",
      invertOutput: false,
      allowMultipleInputs: true,
    }),
    resolveQuery: () => null,
    render: ({ instance }) => {
      const config = instance.config || {};
      const mode = config.filterMode === "type-conversion" ? "type-conversion" : "logic";
      const allowed = new Set(["AND", "OR", "NOT"]);
      const operator = allowed.has(String(config.operator || "").toUpperCase())
        ? String(config.operator || "").toUpperCase()
        : "AND";
      const sourceType = String(config.sourceType || "auto");
      const targetType = String(config.targetType || "boolean");
      const conversionLabel = `${sourceType === "auto" ? "Auto" : sourceType} -> ${targetType}`;
      const primaryLabel = mode === "type-conversion" ? conversionLabel : operator;
      const title = mode === "type-conversion" ? "Type Conversion" : (config.title || "Data Filter");
      const kicker = mode === "type-conversion" ? "Convert" : "Filter";
      const ariaLabel = mode === "type-conversion"
        ? `${conversionLabel} data filter`
        : `${operator} data filter`;
      const density = normalizeDensity(instance.density || resolveWidgetDensity(instance), "standard");
      return `
        <div class="data-filter-widget data-filter-density-${escapeHtml(density)}" data-filter-mode="${escapeHtml(mode)}" data-filter-operator="${escapeHtml(operator)}" data-filter-target-type="${escapeHtml(targetType)}" data-invert-output="${config.invertOutput ? "true" : "false"}">
          <div class="data-filter-header">
            <span class="stat-lbl">${escapeHtml(title)}</span>
            <span class="data-filter-kicker">${escapeHtml(kicker)}</span>
          </div>
          <div class="data-filter-core" aria-label="${escapeHtml(ariaLabel)}">
            <strong>${escapeHtml(primaryLabel)}</strong>
            ${config.invertOutput && mode === "logic" ? `<span class="data-filter-modifier">NOT</span>` : ""}
          </div>
          ${density === "tiny" ? "" : `<div class="data-filter-footer">
            <span>Input</span>
            <span>Output</span>
          </div>`}
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "shift",
    displayName: "Shift Widget",
    category: "system",
    subcategory: "Reactive",
    aliases: ["shift-widget", "reactive-shift", "state-shift"],
    defaultSize: { cols: 2, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    widgetType: "shift",
    dashboardObjectKind: "shift",
    contextRole: "reactive-signal-consumer",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom shift-widget-card",
    capabilities: {
      readsContext: false,
      writesContext: false,
      requiresDataSource: false,
      supportsFilters: false,
      supportsTimeRange: false,
      supportsResize: true,
      exposesPorts: true,
      consumesSignals: true,
    },
    supportedSettings: [
      "title",
      "stateALabel",
      "stateAColor",
      "stateAOpacity",
      "stateBLabel",
      "stateBColor",
      "stateBOpacity",
      "color",
      "pin",
      "duplicate",
      "delete",
    ],
    settingsSchema: {
      sections: [{
        id: "appearance",
        label: "Appearance",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Shift", surface: "appearance" },
        ],
      }, {
        id: "state-a",
        label: "State A",
        fields: [
          { key: "stateALabel", label: "Label", type: "text", defaultValue: "Inactive", surface: "logic" },
          { key: "stateAColor", label: "Tint", type: "text", defaultValue: "#64748b", surface: "logic" },
          { key: "stateAOpacity", label: "Opacity", type: "number", defaultValue: 0.72, min: 0.35, max: 1, step: 0.05, surface: "logic" },
        ],
      }, {
        id: "state-b",
        label: "State B",
        fields: [
          { key: "stateBLabel", label: "Label", type: "text", defaultValue: "Active", surface: "logic" },
          { key: "stateBColor", label: "Tint", type: "text", defaultValue: "#f59e0b", surface: "logic" },
          { key: "stateBOpacity", label: "Opacity", type: "number", defaultValue: 0.92, min: 0.35, max: 1, step: 0.05, surface: "logic" },
        ],
      }],
    },
    queryRequirements: { dataflow: true },
    getDefaultConfig: () => ({
      title: "Shift",
      stateALabel: "Inactive",
      stateAColor: "#64748b",
      stateAOpacity: 0.72,
      stateBLabel: "Active",
      stateBColor: "#f59e0b",
      stateBOpacity: 0.92,
    }),
    resolveQuery: () => null,
    render: ({ instance }) => {
      const config = instance.config || {};
      const density = normalizeDensity(instance.density || resolveWidgetDensity(instance), "standard");
      const active = Boolean(config._signalActive);
      const connected = Boolean(config._signalConnected);
      const label = active ? (config.stateBLabel || "Active") : (config.stateALabel || "Inactive");
      const title = config.title || "Shift";
      return `
        <div class="shift-widget shift-widget-density-${escapeHtml(density)}" data-shift-state="${active ? "on" : "off"}" data-shift-connected="${connected ? "true" : "false"}">
          <div class="shift-widget-header">
            <span class="stat-lbl">${escapeHtml(title)}</span>
            <span class="shift-widget-kicker">Signal</span>
          </div>
          <div class="shift-widget-core" aria-label="${escapeHtml(`${title}: ${label}`)}">
            <strong>${escapeHtml(label)}</strong>
            <span class="shift-widget-state-dot" aria-hidden="true"></span>
          </div>
          ${density === "tiny" ? "" : `<div class="shift-widget-footer">
            <span>${connected ? "Dataflow input" : "Default state"}</span>
          </div>`}
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "activity-feed",
    displayName: "Activity Feed",
    category: "system",
    aliases: ["activity", "feed", "events"],
    defaultSize: { cols: 3, rows: 2 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "activity-feed",
    dashboardObjectKind: "activity-feed",
    contextRole: "workspace-meta",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom meta-widget-card activity-feed-widget-card",
    capabilities: {
      readsContext: true,
      writesContext: false,
      requiresDataSource: false,
      supportsFilters: false,
      supportsTimeRange: false,
      supportsResize: true,
    },
    supportedSettings: ["eventTypes", "scope", "limit", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "activity",
        label: "Activity",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Activity Feed" },
          { key: "scope", label: "Scope", type: "select", defaultValue: "workspace", options: ["workspace", "region", "selection"] },
          { key: "maxItems", label: "Items", type: "number", defaultValue: 6, min: 1, max: 20, step: 1 },
          { key: "eventTypes", label: "Event types", type: "textarea", valueType: "array", placeholder: "object-created, layout-save-completed" },
        ],
      }],
    },
    queryRequirements: { activity: true },
    getDefaultConfig: () => ({ title: "Activity Feed", eventTypes: [], maxItems: 6, scope: "workspace" }),
    resolveQuery: () => null,
    render: ({ instance, resolvedContext }) => {
      const config = instance.config || {};
      const density = metaDensity(instance);
      const maxItems = density === "compact" ? Math.min(3, Number(config.maxItems) || 3) : Number(config.maxItems) || 6;
      const events = window.dashboardMetaRuntime?.recentActivity?.({
        maxItems,
        eventTypes: Array.isArray(config.eventTypes) ? config.eventTypes : [],
        scope: config.scope || "workspace",
        resolvedContext,
      }) || [];
      return `
        <div class="meta-widget activity-feed-widget meta-density-${density}" data-meta-widget="activity-feed" data-event-count="${events.length}">
          <div class="meta-widget-header">
            <span class="stat-lbl">${escapeHtml(config.title || "Activity Feed")}</span>
            <span class="meta-widget-kicker">${escapeHtml(config.scope || "workspace")}</span>
          </div>
          <div class="activity-feed-list" role="log" aria-label="${escapeHtml(config.title || "Activity Feed")}">
            ${events.map((event) => `<article class="activity-feed-item" data-event-type="${escapeHtml(event.type || "")}">
              <span class="activity-feed-dot" aria-hidden="true"></span>
              <span class="activity-feed-copy">
                <strong>${escapeHtml(event.label || activityTypeLabel(event.type))}</strong>
                <small>${escapeHtml(activityTypeLabel(event.type))}${event.detail ? ` · ${escapeHtml(event.detail)}` : ""}</small>
              </span>
              <time>${escapeHtml(shortEventTime(event.time))}</time>
            </article>`).join("")}
          </div>
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "ai-assistant",
    displayName: "AI Assistant",
    category: "system",
    aliases: ["assistant", "ai"],
    defaultSize: { cols: 3, rows: 3 },
    minSize: { cols: 2, rows: 2 },
    widgetType: "ai-assistant",
    dashboardObjectKind: "ai-assistant",
    contextRole: "assistant",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom meta-widget-card ai-assistant-widget-card",
    capabilities: {
      readsContext: true,
      writesContext: false,
      requiresDataSource: false,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["scope", "promptTemplate", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "assistant",
        label: "Assistant",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "AI Assistant" },
          { key: "scope", label: "Scope", type: "select", defaultValue: "region", options: ["workspace", "region", "panel", "selection"], affectsContext: true },
          { key: "promptTemplate", label: "Prompt template", type: "textarea", defaultValue: "" },
        ],
      }],
    },
    queryRequirements: { assistantScope: true },
    getDefaultConfig: () => ({ title: "AI Assistant", scope: "region", promptTemplate: "", lastQuestion: "", lastPlanSummary: "", lastPlanStatus: "", lastPlanId: "" }),
    resolveQuery: () => null,
    render: ({ instance, resolvedContext }) => {
      const config = instance.config || {};
      const density = metaDensity(instance);
      const scope = window.dashboardMetaRuntime?.assistantScope?.({
        scope: config.scope || "region",
        instanceId: instance.id,
        resolvedContext,
      }) || {};
      const range = timeRangeDisplay(scope.timeRange);
      const filterCount = Array.isArray(scope.filters) ? scope.filters.length : 0;
      const lastQuestion = String(config.lastQuestion || "").trim();
      const lastStatus = String(config.lastPlanStatus || "").trim();
      const lastSummary = String(config.lastPlanSummary || "").trim();
      const planId = String(config.lastPlanId || "").trim();
      return `
        <div class="meta-widget ai-assistant-widget meta-density-${density}" data-meta-widget="ai-assistant" data-assistant-scope="${escapeHtml(scope.scope || config.scope || "region")}">
          <div class="meta-widget-header">
            <span class="stat-lbl">${escapeHtml(config.title || "AI Assistant")}</span>
            <span class="meta-widget-kicker">Operator</span>
          </div>
          <div class="ai-assistant-panel">
            <strong>${escapeHtml(scope.regionLabel || contextScopeLabel(resolvedContext))}</strong>
            ${lastQuestion ? "" : "<p>Ask for an analytical workspace. The operator inspects data, creates a plan, and builds registry-backed widgets through safe actions.</p>"}
            <form class="ai-operator-form" data-ai-operator-form="true">
              <textarea class="ai-operator-prompt" name="prompt" rows="2" placeholder="Build me an executive overview of this data">${escapeHtml(lastQuestion || config.promptTemplate || "")}</textarea>
              <div class="ai-operator-actions">
                <button class="ai-operator-button" type="submit" data-ai-operator-mode="plan">Plan</button>
                <button class="ai-operator-button ai-operator-primary" type="submit" data-ai-operator-mode="execute">Build</button>
              </div>
            </form>
            ${lastQuestion ? `<div class="ai-operator-result" data-ai-plan-id="${escapeHtml(planId)}" data-ai-plan-status="${escapeHtml(lastStatus)}">
              <span>${escapeHtml(lastStatus || "planned")}</span>
              <p>${escapeHtml(lastSummary || "Plan ready for review.")}</p>
            </div>` : ""}
            ${lastQuestion ? "" : `<div class="meta-widget-facts">
              <span>Scope <b>${escapeHtml(scope.scope || config.scope || "region")}</b></span>
              <span>Source <b>${escapeHtml(scope.dataSourceName || scope.dataSourceId || "None")}</b></span>
              <span>Filters <b>${filterCount}</b></span>
              ${range ? `<span>Time <b>${escapeHtml(range)}</b></span>` : ""}
            </div>`}
          </div>
        </div>`;
    },
  });

  registerWidgetDefinition({
    type: "context-inspector",
    displayName: "Context Inspector",
    category: "system",
    layer: "backend",
    engineerOnly: true,
    aliases: ["context-debug", "inspector"],
    defaultSize: { cols: 3, rows: 3 },
    minSize: { cols: 2, rows: 1 },
    widgetType: "context-inspector",
    dashboardObjectKind: "context-inspector",
    contextRole: "engineer-debug",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom meta-widget-card context-inspector-widget-card",
    capabilities: {
      readsContext: true,
      writesContext: false,
      requiresDataSource: false,
      supportsFilters: true,
      supportsTimeRange: true,
      supportsResize: true,
    },
    supportedSettings: ["target", "inheritance", "filters", "dataSource", "color", "pin", "duplicate", "delete"],
    settingsSchema: {
      sections: [{
        id: "inspector",
        label: "Inspector",
        fields: [
          { key: "title", label: "Title", type: "text", defaultValue: "Context Inspector" },
          { key: "target", label: "Target", type: "select", defaultValue: "currentRegion", options: ["currentRegion", "selection", "workspace"], affectsContext: true },
          { key: "showInheritanceTree", label: "Inheritance", type: "toggle", defaultValue: true },
          { key: "showFilters", label: "Filters", type: "toggle", defaultValue: true },
          { key: "showDataSource", label: "Data source", type: "toggle", defaultValue: true },
        ],
      }],
    },
    queryRequirements: { engineerMode: true, context: true },
    getDefaultConfig: () => ({
      title: "Context Inspector",
      target: "currentRegion",
      showInheritanceTree: true,
      showFilters: true,
      showDataSource: true,
    }),
    resolveQuery: () => null,
    render: ({ instance, resolvedContext }) => {
      const config = instance.config || {};
      const engineerMode = Boolean(window.dashboardMetaRuntime?.isEngineerMode?.());
      if (!engineerMode) {
        return `<div class="context-inspector-widget context-inspector-locked" aria-hidden="true"></div>`;
      }
      const snapshot = window.dashboardMetaRuntime?.contextSnapshot?.({
        instanceId: instance.id,
        target: config.target || "currentRegion",
        resolvedContext,
      }) || {};
      const context = snapshot.context || resolvedContext || {};
      const mapping = context.semanticMapping || {};
      const filters = Array.isArray(context.filters) ? context.filters : [];
      const regions = Array.isArray(snapshot.regions) ? snapshot.regions : [];
      const persistence = snapshot.persistence || {};
      const persistenceWarnings = [
        ...(Array.isArray(persistence.errors) ? persistence.errors : []),
        ...(Array.isArray(persistence.warnings) ? persistence.warnings : []),
      ];
      const density = metaDensity(instance);
      return `
        <div class="meta-widget context-inspector-widget meta-density-${density}" data-meta-widget="context-inspector" data-inspector-target="${escapeHtml(config.target || "currentRegion")}">
          <div class="meta-widget-header">
            <span class="stat-lbl">${escapeHtml(config.title || "Context Inspector")}</span>
            <span class="meta-widget-kicker">Engineer</span>
          </div>
          <div class="context-inspector-grid">
            ${config.showDataSource !== false ? `<section>
              <span>Data source</span>
              <strong>${escapeHtml(context.dataSourceName || context.dataSourceId || "None")}</strong>
            </section>` : ""}
            <section>
              <span>Region</span>
              <strong>${escapeHtml(snapshot.region?.label || context.name || context.regionId || "Workspace")}</strong>
            </section>
            ${config.showFilters !== false ? `<section>
              <span>Filters</span>
              <strong>${filters.length}</strong>
            </section>` : ""}
            <section>
              <span>Time range</span>
              <strong>${escapeHtml(timeRangeDisplay(context.timeRange) || "None")}</strong>
            </section>
            <section>
              <span>Persistence</span>
              <strong>${persistenceWarnings.length ? `${persistenceWarnings.length} warning${persistenceWarnings.length === 1 ? "" : "s"}` : "OK"}</strong>
            </section>
          </div>
          <pre class="context-inspector-code">${escapeHtml(JSON.stringify({
            contextId: context.id || "",
            regionId: context.regionId || snapshot.region?.id || "",
            semanticMapping: mapping,
            filters,
            timeRange: context.timeRange || null,
            selectedObject: snapshot.selectedObject || null,
            regions: config.showInheritanceTree === false ? undefined : regions.slice(0, 6),
            persistence: {
              version: persistence.version || 0,
              ok: persistence.ok !== false,
              diagnostics: persistenceWarnings.map((entry) => ({
                code: entry.code,
                objectId: entry.objectId,
                message: entry.message,
              })),
            },
          }, null, 2))}</pre>
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
          <div class="media-widget-header">
            <span class="stat-lbl">${escapeHtml(title)}</span>
          </div>
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
          <div class="media-widget-header">
            <span class="stat-lbl">${escapeHtml(title)}</span>
          </div>
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
            <div class="media-widget-header"><span class="stat-lbl">${escapeHtml(title)}</span></div>
            <pre class="document-widget-text">${escapeHtml(content)}</pre>
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
          <div class="media-widget-header">
            <span class="stat-lbl">${escapeHtml(title)}</span>
            <span class="media-widget-meta">${escapeHtml(previewLabel)}</span>
          </div>
          <div class="media-widget-stage document-widget-stage">
            <iframe class="media-widget-frame document-widget-frame" src="${escapeHtml(frameSrc)}" title="${escapeHtml(title)}" loading="lazy" sandbox=""></iframe>
          </div>
          ${mediaCaptionMarkup(caption)}
        </div>`;
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
      if (!rows.length) return runtimeState(title, "Empty result");
      const visibleFields = allFields.slice(0, tableVisibleColumnCount(instance.cols));
      const visibleRows = rows.slice(0, tableVisibleRowCount(instance.rows, config.limit));
      const tableDensity = Number(instance.rows) <= 2 || Number(instance.cols) <= 2
        ? "compact"
        : Number(instance.rows) >= 4 || Number(instance.cols) >= 4 || densityTier === "rich"
          ? "rich"
          : "comfortable";
      const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
      return `
        <div class="runtime-table-widget runtime-table-density-${tableDensity} widget-density-${densityTier}" data-density="${escapeHtml(densityTier)}" data-visible-rows="${visibleRows.length}" data-visible-columns="${visibleFields.length}">
          <div class="runtime-table-header">
            <span class="stat-lbl">${escapeHtml(title)}</span>
            <span class="runtime-table-meta">${escapeHtml(`${visibleRows.length} of ${total}`)}</span>
          </div>
          <div class="runtime-table-scroll">
            <table class="runtime-table">
              <thead><tr>${visibleFields.map((field) => `<th title="${escapeHtml(field)}">${escapeHtml(field)}</th>`).join("")}</tr></thead>
              <tbody>${visibleRows.map((row) => `<tr>${visibleFields.map((field) => `<td title="${escapeHtml(row?.[field] ?? "")}">${escapeHtml(row?.[field] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>
            </table>
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
      if (!rows.length) return runtimeState(title, "Empty data");
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
      if (!rows.length) return runtimeState(title, "No map data");
      const points = rows.map((row) => ({
        label: String(row?.[locationField] || row?.[mapping.labelField] || row?.label || "Point"),
        category: String(row?.[mapping.categoryField] || row?.category || ""),
        latitude: numberValue(row?.[latitudeField]),
        longitude: numberValue(row?.[longitudeField]),
        value: numberValue(row?.[mapping.valueField] ?? row?.value),
      })).filter((point) => point.latitude != null && point.longitude != null).slice(0, Math.max(1, Number(config.limit) || 250));
      if (!points.length) return runtimeState(title, "No coordinates");
      const minLat = Math.min(...points.map((point) => point.latitude));
      const maxLat = Math.max(...points.map((point) => point.latitude), minLat + 0.01);
      const minLon = Math.min(...points.map((point) => point.longitude));
      const maxLon = Math.max(...points.map((point) => point.longitude), minLon + 0.01);
      const maxValue = Math.max(...points.map((point) => point.value || 1), 1);
      const density = chartVisualDensity(instance.density || "standard");
      const marks = points.map((point, index) => {
        const x = 8 + (((point.longitude - minLon) / Math.max(0.01, maxLon - minLon)) * 84);
        const y = 56 - (((point.latitude - minLat) / Math.max(0.01, maxLat - minLat)) * 48);
        const r = 1.8 + (((point.value || 1) / maxValue) * 2.8);
        return `<circle class="runtime-map-point runtime-chart-fill-${CHART_PALETTE[index % CHART_PALETTE.length]}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}"><title>${escapeHtml(point.label)}</title></circle>`;
      }).join("");
      const labels = points.slice(0, density === "large" ? 4 : 2).map((point) => `<span>${escapeHtml(point.label)}</span>`).join("");
      return `
        <div class="runtime-map-widget runtime-map-density-${escapeHtml(density)}" data-map-layer="${escapeHtml(config.layerType || "points")}" data-map-demo="${data?.demo ? "true" : "false"}">
          <div class="runtime-map-header">
            <span class="stat-lbl">${escapeHtml(title)}</span>
            <span class="runtime-map-meta">${escapeHtml(`${points.length} point${points.length === 1 ? "" : "s"}${data?.demo ? " demo" : ""}`)}</span>
          </div>
          <div class="runtime-map-stage">
            <svg class="runtime-map-svg" viewBox="0 0 100 64" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(title)}">
              <path class="runtime-map-gridline" d="M 8 16 H 92 M 8 32 H 92 M 8 48 H 92 M 24 8 V 58 M 50 8 V 58 M 76 8 V 58"></path>
              <rect class="runtime-map-boundary" x="7" y="7" width="86" height="52" rx="4"></rect>
              ${marks}
            </svg>
          </div>
          <div class="runtime-map-legend">${labels}</div>
        </div>`;
    },
  });

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
      const labelField = String(config.labelField || mapping.labelField || "").trim();
      if (!resolvedContext?.dataSourceId) return runtimeState(title, "Configure a data source");
      if (!dateField) return runtimeState(title, "Configure date field");
      if (status === "loading") return runtimeState(title, "Loading");
      if (status === "error") return runtimeState(title, data?.error || "Unable to load dates");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      if (!rows.length) return runtimeState(title, "No date rows");
      const events = rows.map((row) => {
        const timestamp = Date.parse(row?.[dateField]);
        return Number.isFinite(timestamp)
          ? { date: new Date(timestamp), label: String(row?.[labelField] || row?.label || "Item"), state: String(row?.[mapping.statusField] || row?.state || "") }
          : null;
      }).filter(Boolean).sort((a, b) => a.date - b.date).slice(0, Number(config.limit) || 12);
      if (!events.length) return runtimeState(title, "No valid dates");
      const first = events[0].date;
      const monthStart = new Date(first.getFullYear(), first.getMonth(), 1);
      const monthName = first.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const cells = Array.from({ length: 14 }, (_, index) => {
        const date = new Date(monthStart);
        date.setDate(index + 1);
        const dayEvents = events.filter((event) => event.date.toDateString() === date.toDateString());
        return { date, dayEvents };
      });
      return `
        <div class="runtime-calendar-widget" data-calendar-demo="${data?.demo ? "true" : "false"}">
          <div class="runtime-calendar-header">
            <span class="stat-lbl">${escapeHtml(title)}</span>
            <span class="runtime-calendar-meta">${escapeHtml(`${monthName}${data?.demo ? " demo" : ""}`)}</span>
          </div>
          <div class="runtime-calendar-grid" aria-label="${escapeHtml(monthName)}">
            ${cells.map(({ date, dayEvents }) => `<div class="runtime-calendar-cell${dayEvents.length ? " has-events" : ""}">
              <span>${date.getDate()}</span>
              ${dayEvents.slice(0, 2).map((event) => `<i title="${escapeHtml(event.label)}"></i>`).join("")}
            </div>`).join("")}
          </div>
          <div class="runtime-calendar-list">
            ${events.slice(0, 3).map((event) => `<span><b>${escapeHtml(String(event.date.getDate()))}</b>${escapeHtml(event.label)}</span>`).join("")}
          </div>
        </div>`;
    },
  });

  window.dashboardWidgetRuntime = {
    registerWidgetDefinition,
    getWidgetDefinition,
    createWidgetInstance,
    renderWidget,
    resolveWidgetDensity,
    resolveTimeRangeConfig,
    resolveTimeframeFilter,
    normalizeTimeframeFilters,
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
