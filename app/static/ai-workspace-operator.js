(() => {
  const PLAN_VERSION = 1;
  const DEFAULT_LAYOUT_KEY = "builder";

  const cloneJson = (value) => JSON.parse(JSON.stringify(value));
  const slug = (value = "ai") => String(value || "ai")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "ai";

  const normalizeText = (value = "") => String(value || "").trim().toLowerCase();
  const titleCase = (value = "") => String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const fieldNames = (dataset = {}) => (dataset.fields || []).map((field) => field.name).filter(Boolean);
  const findField = (dataset = {}, candidates = [], typePreference = "") => {
    const fields = dataset.fields || [];
    const scored = fields.map((field) => {
      const name = String(field.name || "").toLowerCase();
      const score = candidates.reduce((best, candidate, index) => {
        const target = String(candidate || "").toLowerCase();
        if (!target) return best;
        if (name === target) return Math.max(best, 100 - index);
        if (name.includes(target)) return Math.max(best, 70 - index);
        return best;
      }, 0) + (typePreference && field.type === typePreference ? 16 : 0);
      return { field: field.name, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].field : "";
  };

  const primaryDataset = (datasets = []) => {
    if (!datasets.length) return null;
    return [...datasets].sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0))[0];
  };

  const datasetProfile = (dataset = {}) => {
    const fields = fieldNames(dataset);
    const semantic = dataset.semanticMapping || {};
    const dateField = semantic.dateField || findField(dataset, ["timestamp", "created_at", "date", "time", "updated"], "date") || dataset.timeFields?.[0] || "";
    const valueField = semantic.valueField || findField(dataset, ["value", "revenue", "cost", "amount", "reading", "quantity", "progress"], "number") || dataset.numericFields?.[0] || "";
    const revenueField = findField(dataset, ["revenue", "income", "sales"], "number");
    const costField = findField(dataset, ["laborCost", "materialCost", "cost", "expense"], "number");
    const labelField = semantic.labelField || findField(dataset, ["label", "name", "title", "site", "customer"], "string") || fields[0] || "";
    const categoryField = semantic.categoryField || findField(dataset, ["category", "segment", "region", "site", "queue", "type"], "string") || dataset.categoricalFields?.[0] || "";
    const statusField = semantic.statusField || findField(dataset, ["status", "state"], "string");
    const latitudeField = semantic.latitudeField || findField(dataset, ["latitude", "lat"], "number");
    const longitudeField = semantic.longitudeField || findField(dataset, ["longitude", "lon", "lng"], "number");
    const locationField = semantic.locationField || findField(dataset, ["location", "site", "region"], "string");
    return {
      fields,
      dateField,
      valueField,
      revenueField,
      costField,
      labelField,
      categoryField,
      statusField,
      latitudeField,
      longitudeField,
      locationField,
      numericFields: dataset.numericFields || [],
      categoricalFields: dataset.categoricalFields || [],
      timeFields: dataset.timeFields || [],
      geospatialFields: dataset.geospatialFields || [],
    };
  };

  const hasFields = (profile, names = []) => names.every((name) => Boolean(profile[name]));

  const safeAssumption = (text) => ({ text, confidence: "medium" });
  const limitation = (text, missingFields = [], gapType = "missing-data") => ({ text, missingFields, gapType });
  const capabilityGap = (gapType, text, missingFields = [], capability = "") => ({
    type: gapType,
    text,
    missingFields,
    capability,
    action: gapType === "missing-data"
      ? "Provide the missing field or dataset, then rerun the operator."
      : "Extend the generalized runtime primitive before presenting this as solved.",
  });

  const planBase = (question, intent, dataset, profile) => ({
    id: `ai-plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    version: PLAN_VERSION,
    goal: question || "Analyze workspace data",
    intent,
    status: "draft",
    requiredData: [],
    availableData: dataset ? {
      datasetId: dataset.id,
      datasetName: dataset.name,
      rowCount: dataset.rowCount,
      fields: profile.fields,
    } : null,
    assumptions: [],
    limitations: [],
    capabilityGaps: [],
    steps: [],
    scenario: null,
    explanation: {
      summary: "",
      uncertainty: [],
      nextSteps: [],
    },
  });

  const noteBodyForPlan = (plan) => [
    `Question: ${plan.goal}`,
    "",
    plan.explanation.summary ? `Answer approach: ${plan.explanation.summary}` : "",
    plan.assumptions.length ? `Assumptions: ${plan.assumptions.map((entry) => entry.text || entry).join("; ")}` : "",
    plan.limitations.length ? `Limitations: ${plan.limitations.map((entry) => entry.text || entry).join("; ")}` : "",
    plan.capabilityGaps?.length ? `Capability gaps: ${plan.capabilityGaps.map((entry) => entry.text || entry).join("; ")}` : "",
    plan.explanation.nextSteps?.length ? `Inspect next: ${plan.explanation.nextSteps.join("; ")}` : "",
  ].filter((line) => line !== "").join("\n");

  const createExplanationStep = (plan, col = 1, row = 6, cols = 6, rows = 2) => ({
    type: "createNote",
    id: `${plan.id}-explanation`,
    title: "AI Explanation",
    col,
    row,
    cols,
    rows,
    config: {
      title: "AI Explanation",
      body: noteBodyForPlan(plan),
      placeholder: "AI explanation",
      aiPlan: {
        id: plan.id,
        goal: plan.goal,
        intent: plan.intent,
        assumptions: plan.assumptions,
        limitations: plan.limitations,
        capabilityGaps: plan.capabilityGaps || [],
      },
    },
  });

  const intentForQuestion = (question = "") => {
    const text = normalizeText(question);
    if (/what\s*if|reduced?|dropped?|increased?|increase|decrease|scenario|projected|would happen/.test(text)) return "what-if";
    if (/executive|overview|dashboard/.test(text)) return "executive-summary";
    if (/worst|underperform|risk|pay attention|attention|top problem|unusual/.test(text)) return "risk-ranking";
    if (/trend|changed|over time|frequency|month/.test(text)) return "trend";
    if (/where|geograph|map|concentrated/.test(text)) return "geospatial";
    if (/compare|by region|by site|by category|performance/.test(text)) return "comparison";
    return "summary";
  };

  const parseScenarioDelta = (question = "") => {
    const text = normalizeText(question);
    const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    const percent = percentMatch ? Number(percentMatch[1]) / 100 : 0.1;
    const direction = /increase|increased|rises?|rose|up/.test(text) ? "increase" : "decrease";
    const target = /revenue/.test(text) ? "revenue" : /material/.test(text) ? "materialCost" : /labor/.test(text) ? "laborCost" : /cost/.test(text) ? "cost" : "value";
    const factor = direction === "increase" ? 1 + percent : 1 - percent;
    return {
      target,
      percent,
      direction,
      factor,
      label: `${titleCase(target)} ${direction === "increase" ? "increases" : "decreases"} ${(percent * 100).toFixed(0)}%`,
    };
  };

  const requireDatasetPlan = (question, intent, datasets) => {
    const plan = planBase(question, intent, null, {});
    plan.status = "blocked";
    plan.limitations.push(limitation("No workspace dataset is available. Add or simulate a data source before asking the operator to build an analysis.", [], "missing-data"));
    plan.capabilityGaps.push(capabilityGap("missing-data", "No inspectable workspace dataset is available."));
    plan.explanation.summary = "I could not inspect any rows or schema, so I did not create a visual answer.";
    return plan;
  };

  const buildWhatIfPlan = (question, dataset, profile) => {
    const plan = planBase(question, "what-if", dataset, profile);
    const scenario = parseScenarioDelta(question);
    const baselineField = scenario.target.includes("revenue") ? (profile.revenueField || profile.valueField) : (profile.costField || profile.valueField);
    const revenueField = profile.revenueField;
    const costField = profile.costField;
    if (!baselineField) {
      plan.limitations.push(limitation("No numeric field is available for the scenario baseline.", ["numeric metric"], "missing-field"));
      plan.capabilityGaps.push(capabilityGap("missing-field", "The scenario needs a numeric baseline field.", ["numeric metric"]));
    }
    if (scenario.target === "laborCost" && !fieldNames(dataset).includes("laborCost")) {
      plan.assumptions.push(safeAssumption(`laborCost is not present; using ${baselineField || "the primary numeric field"} as the available cost baseline.`));
      plan.limitations.push(limitation("The requested laborCost field is not available; this is a transparent substitute scenario.", ["laborCost"], "missing-field"));
      plan.capabilityGaps.push(capabilityGap("missing-field", "laborCost is not available in the current dataset.", ["laborCost"]));
    }
    if (!revenueField && !profile.valueField) {
      plan.limitations.push(limitation("No revenue or value field is available to compare projected impact.", ["revenue or value"], "missing-field"));
      plan.capabilityGaps.push(capabilityGap("missing-field", "Projected impact needs a revenue or value metric.", ["revenue", "value"]));
    }
    plan.requiredData = [baselineField, revenueField || profile.valueField, profile.categoryField || profile.labelField].filter(Boolean);
    plan.scenario = {
      id: `${plan.id}-scenario`,
      label: scenario.label,
      targetField: baselineField,
      factor: scenario.factor,
      destructive: false,
    };
    const adjustedField = `aiAdjusted${titleCase(baselineField).replace(/\s+/g, "")}`;
    const savingsField = "aiProjectedSavings";
    const marginField = "aiProjectedMargin";
    const calculatedFields = [
      { name: adjustedField, expression: `${baselineField} * ${scenario.factor}` },
      { name: savingsField, expression: `${baselineField} - ${adjustedField}` },
    ];
    if (revenueField && costField) calculatedFields.push({ name: marginField, expression: `${revenueField} - ${adjustedField}` });
    if (plan.limitations.length) {
      plan.status = "partial";
    } else {
      plan.status = "ready";
    }
    plan.explanation.summary = `Created a reversible derived scenario using ${baselineField}; original rows are left unchanged.`;
    plan.explanation.uncertainty.push("This is arithmetic scenario modeling, not a forecast.");
    plan.explanation.nextSteps.push("Inspect the projected table and scenario assumptions.");
    plan.steps = [
      { type: "createPanel", id: `${plan.id}-panel`, title: "AI What-If Scenario", col: 1, row: 8, cols: 6, rows: 5 },
      {
        type: "createStat",
        id: `${plan.id}-savings`,
        title: "Projected Savings",
        panelId: `${plan.id}-panel`,
        col: 1,
        row: 1,
        cols: 2,
        rows: 1,
        scenarioId: plan.scenario.id,
        config: { title: "Projected Savings", label: "Projected Savings", metric: "sum", valueField: savingsField, format: "currency", calculatedFields },
      },
      {
        type: "createChart",
        id: `${plan.id}-scenario-chart`,
        title: "Projected Impact",
        panelId: `${plan.id}-panel`,
        col: 3,
        row: 1,
        cols: 4,
        rows: 2,
        scenarioId: plan.scenario.id,
        config: {
          title: "Projected Impact",
          chartType: "bar",
          xField: profile.categoryField || profile.labelField,
          yField: marginField || savingsField,
          aggregation: "sum",
          calculatedFields,
          limit: 12,
        },
      },
      {
        type: "createTable",
        id: `${plan.id}-scenario-table`,
        title: "Scenario Rows",
        panelId: `${plan.id}-panel`,
        col: 1,
        row: 3,
        cols: 4,
        rows: 2,
        scenarioId: plan.scenario.id,
        config: {
          title: "Scenario Rows",
          columns: [profile.labelField, baselineField, adjustedField, savingsField].filter(Boolean),
          calculatedFields,
          sortBy: savingsField,
          sortDirection: "desc",
          limit: 24,
        },
      },
      {
        type: "createEquationFilter",
        id: `${plan.id}-equation-filter`,
        title: "Scenario Formula",
        col: 1,
        row: 14,
        cols: 2,
        rows: 2,
        layer: "backend",
        scenarioId: plan.scenario.id,
        config: { title: "Scenario Formula", operator: "AND", expression: `${baselineField} > ${adjustedField}`, calculatedFields },
      },
      {
        type: "createDataflowLink",
        id: `${plan.id}-formula-to-savings`,
        sourceId: `${plan.id}-equation-filter`,
        targetId: `${plan.id}-savings`,
        label: "Formula -> savings",
        signalType: "data",
      },
      {
        type: "createDataflowLink",
        id: `${plan.id}-formula-to-chart`,
        sourceId: `${plan.id}-equation-filter`,
        targetId: `${plan.id}-scenario-chart`,
        label: "Formula -> chart",
        signalType: "data",
      },
      {
        type: "createDataflowLink",
        id: `${plan.id}-formula-to-table`,
        sourceId: `${plan.id}-equation-filter`,
        targetId: `${plan.id}-scenario-table`,
        label: "Formula -> table",
        signalType: "data",
      },
      createExplanationStep(plan, 1, 16, 4, 2),
    ];
    return plan;
  };

  const buildExecutivePlan = (question, dataset, profile) => {
    const plan = planBase(question, "executive-summary", dataset, profile);
    if (!profile.valueField && !profile.revenueField) {
      plan.limitations.push(limitation("No numeric metric is available for summary cards.", ["numeric metric"], "missing-field"));
      plan.capabilityGaps.push(capabilityGap("missing-field", "Executive summaries need a numeric metric.", ["numeric metric"]));
    }
    if (!profile.dateField) {
      plan.limitations.push(limitation("No time field is available for trend analysis.", ["date/time"], "missing-field"));
      plan.capabilityGaps.push(capabilityGap("missing-field", "Trend components need a date/time field.", ["date/time"]));
    }
    plan.status = plan.limitations.length ? "partial" : "ready";
    plan.requiredData = [profile.valueField || profile.revenueField, profile.dateField, profile.categoryField, profile.statusField].filter(Boolean);
    plan.assumptions.push(safeAssumption("Summary widgets use the currently resolved workspace dataset and context filters."));
    plan.explanation.summary = "Built a calm overview with summary metrics, trend, status breakdown, location view when available, and an explanatory note.";
    plan.explanation.nextSteps.push("Use filters or timeframe controls to narrow the overview.");
    plan.steps = [
      { type: "createPanel", id: `${plan.id}-panel`, title: "AI Executive Overview", col: 1, row: 8, cols: 6, rows: 6 },
      { type: "createStat", id: `${plan.id}-total`, title: "Total Value", panelId: `${plan.id}-panel`, col: 1, row: 1, cols: 2, rows: 1, config: { title: "Total Value", label: "Total Value", metric: "sum", valueField: profile.revenueField || profile.valueField, format: profile.revenueField ? "currency" : "number" } },
      { type: "createStat", id: `${plan.id}-average`, title: "Average", panelId: `${plan.id}-panel`, col: 3, row: 1, cols: 2, rows: 1, config: { title: "Average", label: "Average", metric: "avg", valueField: profile.valueField || profile.revenueField } },
      { type: "createChart", id: `${plan.id}-trend`, title: "Trend", panelId: `${plan.id}-panel`, col: 1, row: 2, cols: 3, rows: 2, config: { title: "Trend", chartType: profile.dateField ? "line" : "bar", xField: profile.dateField || profile.categoryField || profile.labelField, yField: profile.valueField || profile.revenueField, aggregation: "sum", limit: 60 } },
      { type: "createChart", id: `${plan.id}-mix`, title: "Status Mix", panelId: `${plan.id}-panel`, col: 4, row: 2, cols: 2, rows: 2, config: { title: "Status Mix", chartType: "donut", xField: profile.statusField || profile.categoryField, yField: profile.valueField || profile.revenueField, aggregation: "count", limit: 12 } },
      { type: "createTable", id: `${plan.id}-table`, title: "Records to Inspect", panelId: `${plan.id}-panel`, col: 1, row: 4, cols: 3, rows: 2, config: { title: "Records to Inspect", columns: [profile.labelField, profile.categoryField, profile.statusField, profile.valueField || profile.revenueField].filter(Boolean), sortBy: profile.valueField || profile.revenueField, sortDirection: "desc", limit: 24 } },
      ...(profile.latitudeField && profile.longitudeField ? [{ type: "createMap", id: `${plan.id}-map`, title: "Location View", panelId: `${plan.id}-panel`, col: 4, row: 4, cols: 2, rows: 2, config: { title: "Location View", latitudeField: profile.latitudeField, longitudeField: profile.longitudeField, locationField: profile.locationField, limit: 120 } }] : []),
      createExplanationStep(plan, 1, 16, 5, 2),
    ];
    return plan;
  };

  const buildTrendPlan = (question, dataset, profile) => {
    const plan = planBase(question, "trend", dataset, profile);
    if (!profile.dateField) {
      plan.limitations.push(limitation("Trend analysis needs a date or timestamp field.", ["date/time"], "missing-field"));
      plan.capabilityGaps.push(capabilityGap("missing-field", "Trend analysis cannot be encoded without a date/time field.", ["date/time"]));
    }
    if (!profile.valueField && !profile.revenueField) {
      plan.limitations.push(limitation("Trend analysis needs a numeric metric.", ["numeric metric"], "missing-field"));
      plan.capabilityGaps.push(capabilityGap("missing-field", "Trend analysis cannot be encoded without a numeric metric.", ["numeric metric"]));
    }
    plan.status = plan.limitations.length ? "partial" : "ready";
    plan.requiredData = [profile.dateField, profile.valueField || profile.revenueField].filter(Boolean);
    plan.explanation.summary = "Created a time-oriented view with a primary trend and supporting table of recent records.";
    plan.steps = [
      { type: "createPanel", id: `${plan.id}-panel`, title: "AI Trend Analysis", col: 1, row: 8, cols: 6, rows: 5 },
      { type: "createChart", id: `${plan.id}-trend`, title: "Trend Over Time", panelId: `${plan.id}-panel`, col: 1, row: 1, cols: 4, rows: 2, config: { title: "Trend Over Time", chartType: profile.dateField ? "area" : "bar", xField: profile.dateField || profile.categoryField || profile.labelField, yField: profile.valueField || profile.revenueField, aggregation: "avg", timeBucket: profile.dateField ? { field: profile.dateField, unit: "day", targetField: "day" } : null, limit: 80 } },
      { type: "createStat", id: `${plan.id}-avg`, title: "Average", panelId: `${plan.id}-panel`, col: 5, row: 1, cols: 2, rows: 1, config: { title: "Average", label: "Average", metric: "avg", valueField: profile.valueField || profile.revenueField } },
      { type: "createTable", id: `${plan.id}-table`, title: "Recent Records", panelId: `${plan.id}-panel`, col: 1, row: 3, cols: 4, rows: 2, config: { title: "Recent Records", columns: [profile.labelField, profile.dateField, profile.categoryField, profile.valueField || profile.revenueField].filter(Boolean), sortBy: profile.dateField, sortDirection: "desc", limit: 24 } },
      createExplanationStep(plan, 1, 15, 5, 2),
    ];
    return plan;
  };

  const buildRiskPlan = (question, dataset, profile) => {
    const plan = planBase(question, "risk-ranking", dataset, profile);
    if (!profile.valueField && !profile.revenueField) {
      plan.limitations.push(limitation("Ranking needs a numeric metric.", ["numeric metric"], "missing-field"));
      plan.capabilityGaps.push(capabilityGap("missing-field", "Ranking needs a numeric metric.", ["numeric metric"]));
    }
    plan.status = plan.limitations.length ? "partial" : "ready";
    plan.requiredData = [profile.labelField, profile.valueField || profile.revenueField, profile.statusField].filter(Boolean);
    plan.explanation.summary = "Created a ranked table and comparison chart so the user can inspect the records needing attention.";
    plan.explanation.uncertainty.push("Ranking direction is inferred from the question; inspect the table before acting.");
    plan.steps = [
      { type: "createPanel", id: `${plan.id}-panel`, title: "AI Attention View", col: 1, row: 8, cols: 6, rows: 5 },
      { type: "createTable", id: `${plan.id}-table`, title: "Ranked Records", panelId: `${plan.id}-panel`, col: 1, row: 1, cols: 3, rows: 3, config: { title: "Ranked Records", columns: [profile.labelField, profile.categoryField, profile.statusField, profile.valueField || profile.revenueField].filter(Boolean), sortBy: profile.valueField || profile.revenueField, sortDirection: /worst|underperform|risk/i.test(question) ? "asc" : "desc", limit: 20 } },
      { type: "createChart", id: `${plan.id}-chart`, title: "Comparison", panelId: `${plan.id}-panel`, col: 4, row: 1, cols: 2, rows: 2, config: { title: "Comparison", chartType: "bar", xField: profile.categoryField || profile.labelField, yField: profile.valueField || profile.revenueField, aggregation: "avg", limit: 12 } },
      ...(profile.latitudeField && profile.longitudeField ? [{ type: "createMap", id: `${plan.id}-map`, title: "Where to Look", panelId: `${plan.id}-panel`, col: 4, row: 3, cols: 2, rows: 2, config: { title: "Where to Look", latitudeField: profile.latitudeField, longitudeField: profile.longitudeField, locationField: profile.locationField, limit: 120 } }] : []),
      createExplanationStep(plan, 1, 15, 5, 2),
    ];
    return plan;
  };

  const buildFallbackPlan = (question, dataset, profile) => {
    const plan = planBase(question, "summary", dataset, profile);
    plan.status = dataset ? "ready" : "blocked";
    plan.requiredData = [profile.labelField, profile.valueField, profile.categoryField].filter(Boolean);
    plan.explanation.summary = "Built a general inspectable workspace because the question did not map to a more specific analytical pattern.";
    plan.steps = [
      { type: "createPanel", id: `${plan.id}-panel`, title: "AI Workspace Answer", col: 1, row: 8, cols: 6, rows: 4 },
      { type: "createStat", id: `${plan.id}-count`, title: "Records", panelId: `${plan.id}-panel`, col: 1, row: 1, cols: 2, rows: 1, config: { title: "Records", label: "Records", metric: "count" } },
      { type: "createTable", id: `${plan.id}-table`, title: "Workspace Rows", panelId: `${plan.id}-panel`, col: 1, row: 2, cols: 4, rows: 2, config: { title: "Workspace Rows", columns: [profile.labelField, profile.categoryField, profile.statusField, profile.valueField].filter(Boolean), limit: 24 } },
      createExplanationStep(plan, 1, 14, 5, 2),
    ];
    return plan;
  };

  const createPlan = async (question = "", options = {}) => {
    const actions = window.dashboardWorkspaceActionRuntime;
    const datasets = options.datasets || await actions?.inspectDatasets?.(options.layoutKey || DEFAULT_LAYOUT_KEY) || [];
    const intent = intentForQuestion(question);
    if (!datasets.length) return requireDatasetPlan(question, intent, datasets);
    const dataset = options.datasetId ? datasets.find((entry) => entry.id === options.datasetId) || primaryDataset(datasets) : primaryDataset(datasets);
    const profile = datasetProfile(dataset);
    let plan;
    if (intent === "what-if") plan = buildWhatIfPlan(question, dataset, profile);
    else if (intent === "executive-summary") plan = buildExecutivePlan(question, dataset, profile);
    else if (intent === "trend") plan = buildTrendPlan(question, dataset, profile);
    else if (intent === "risk-ranking" || intent === "comparison" || intent === "geospatial") plan = buildRiskPlan(question, dataset, profile);
    else plan = buildFallbackPlan(question, dataset, profile);
    if (!hasFields(profile, plan.requiredData.map((field) => field && field.endsWith("Field") ? field : "").filter(Boolean))) {
      // Required data is stored as real field names; this hook is intentionally conservative.
    }
    plan.steps.unshift({ type: "inspectDatasets" }, { type: "inspectWidgetRegistry" });
    return plan;
  };

  const executePlan = async (plan = {}, options = {}) => {
    const actions = window.dashboardWorkspaceActionRuntime;
    if (!actions?.executeAction) return { ok: false, error: "Workspace action runtime is unavailable.", plan };
    const metadataActions = ["inspectDatasets", "inspectWidgetRegistry", "inspectSchema", "createScenario", "createCalculatedField", "explainCalculation", "summarizeWorkspace", "explainWorkspace", "arrangeObjects", "validateWorkspaceAnswer"];
    const actionable = (plan.steps || []).filter((step) => !metadataActions.includes(step.type));
    const topLevelRows = actionable
      .filter((step) => !step.panelId && Number.isFinite(Number(step.row)))
      .map((step) => Number(step.row));
    const plannedStartRow = topLevelRows.length ? Math.min(...topLevelRows) : null;
    const safeStartRow = plannedStartRow
      ? Number(actions.nextSafeRow?.(options.layoutKey || DEFAULT_LAYOUT_KEY, { excludePlanId: plan.id || "" }) || plannedStartRow)
      : plannedStartRow;
    const rowOffset = plannedStartRow && safeStartRow > plannedStartRow ? safeStartRow - plannedStartRow : 0;
    const positionedActions = actionable.map((step) => (
      rowOffset && !step.panelId && Number.isFinite(Number(step.row))
        ? { ...step, row: Number(step.row) + rowOffset }
        : step
    ));
    const results = [];
    for (const step of positionedActions) {
      const result = await actions.executeAction(step, { ...options, planId: plan.id || "" });
      results.push(result);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const actionOk = results.every((result) => result.ok);
    const validation = actions.validateWorkspaceAnswer?.(plan, { results }, { ...options, layoutKey: options.layoutKey || DEFAULT_LAYOUT_KEY }) || { ok: actionOk, errors: [], warnings: [], proof: {} };
    const ok = actionOk && validation.ok;
    window.dashboardWorkspaceEvents?.emit?.({
      type: ok ? "ai-plan-executed" : "ai-plan-partial",
      source: "ai-operator",
      layoutKey: options.layoutKey || DEFAULT_LAYOUT_KEY,
      label: ok ? "AI plan executed" : "AI plan partially executed",
      payload: { planId: plan.id, goal: plan.goal, resultCount: results.length, rowOffset, validation },
    });
    return { ok, planId: plan.id || "", results, validation, placement: { plannedStartRow, safeStartRow, rowOffset } };
  };

  const runPrompt = async (question = "", options = {}) => {
    const plan = await createPlan(question, options);
    if (options.execute === false || plan.status === "blocked") return { ok: plan.status !== "blocked", plan, execution: null };
    const execution = await executePlan(plan, options);
    return { ok: execution.ok, plan, execution };
  };

  const inspectData = async (layoutKey = DEFAULT_LAYOUT_KEY) => window.dashboardWorkspaceActionRuntime?.inspectDatasets?.(layoutKey) || [];

  window.dashboardAiOperatorRuntime = {
    version: PLAN_VERSION,
    inspectData,
    plan: createPlan,
    executePlan,
    runPrompt,
    classifyIntent: intentForQuestion,
    supportedActions: () => window.dashboardWorkspaceActionRuntime?.actionTypes?.() || [],
  };

  const updateAssistantWidget = (widget, patch = {}) => {
    const node = typeof widget === "string" ? document.querySelector(widget) : widget;
    if (!node) return false;
    return window.dashboardWorkspaceActionRuntime?.updateWidgetConfig?.(node, patch, { history: true }) || false;
  };

  document.addEventListener("submit", async (event) => {
    const form = event.target?.closest?.(".ai-operator-form");
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    const widget = form.closest(".widget-card[data-widget-definition='ai-assistant']");
    const rail = form.closest(".workspace-assistant-rail");
    const prompt = form.querySelector(".ai-operator-prompt")?.value?.trim() || "";
    const submitter = event.submitter?.dataset?.aiOperatorMode || "plan";
    if ((!widget && !rail) || !prompt) return;
    const layoutKey = rail?.dataset?.assistantLayoutKey || widget?.closest?.("[data-widget-layout-key], [data-layout-key]")?.dataset?.widgetLayoutKey || DEFAULT_LAYOUT_KEY;
    form.dataset.aiOperatorBusy = "true";
    window.dashboardAssistantRailRuntime?.setBusy?.(Boolean(rail));
    try {
      const result = submitter === "execute"
        ? await runPrompt(prompt, { execute: true, layoutKey })
        : { ok: true, plan: await createPlan(prompt, { layoutKey }), execution: null };
      const plan = result.plan || {};
      const status = result.execution ? (result.ok ? "built" : "partial") : (plan.status || "planned");
      const summary = plan.explanation?.summary || (plan.limitations || []).map((entry) => entry.text || entry).join("; ") || "Plan ready for review.";
      const planSnapshot = {
        id: plan.id,
        intent: plan.intent,
        goal: plan.goal,
        status: plan.status,
        assumptions: plan.assumptions,
        limitations: plan.limitations,
        stepCount: Array.isArray(plan.steps) ? plan.steps.length : 0,
      };
      if (widget) {
        updateAssistantWidget(widget, {
          lastQuestion: prompt,
          lastPlanId: plan.id || "",
          lastPlanStatus: status,
          lastPlanSummary: summary,
          lastPlan: planSnapshot,
        });
      }
      if (rail) {
        window.dashboardAssistantRailRuntime?.setResult?.({
          status,
          summary,
          prompt,
          planId: plan.id || "",
          ok: result.ok,
          plan: planSnapshot,
        });
      }
    } finally {
      delete form.dataset.aiOperatorBusy;
      window.dashboardAssistantRailRuntime?.setBusy?.(false);
    }
  }, true);
})();
