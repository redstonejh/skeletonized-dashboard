(() => {
  const demoDataRuntime = () => window.dashboardDemoDataRuntime;
  const workspacePresets = () => ({
    "executive-overview": {
      label: "Executive Overview",
      seed: "executive-overview",
      widgets: [
        { type: "stat", title: "Revenue", config: { metric: "sum", valueField: "revenue", format: "currency" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "stat", title: "Margin", config: { metric: "avg", valueField: "progress", format: "percent" }, col: 3, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Revenue Trend", config: { chartType: "line", xField: "timestamp", yField: "revenue", aggregation: "sum", limit: 36 }, col: 1, row: 7, cols: 3, rows: 2 },
        { type: "chart", title: "Status Mix", config: { chartType: "donut", xField: "status", yField: "value", aggregation: "count" }, col: 4, row: 7, cols: 2, rows: 2 },
        { type: "map", title: "Site Coverage", col: 1, row: 9, cols: 3, rows: 2 },
        { type: "table", title: "Top Accounts", config: { columns: ["label", "segment", "revenue", "status"], sortBy: "revenue", sortDirection: "desc", limit: 20 }, col: 4, row: 9, cols: 3, rows: 2 },
      ],
    },
    "operations-command-center": {
      label: "Operations Command Center",
      seed: "operations-command-center",
      widgets: [
        { type: "filter", title: "Status Filter", col: 1, row: 6, cols: 2, rows: 2 },
        { type: "table", title: "Open Work", config: { columns: ["label", "status", "owner", "ageHours"], sortBy: "ageHours", sortDirection: "desc", limit: 30 }, col: 3, row: 6, cols: 3, rows: 3 },
        { type: "chart", title: "Sensor Trend", config: { chartType: "area", xField: "timestamp", yField: "value", aggregation: "avg", limit: 80 }, col: 1, row: 8, cols: 3, rows: 2 },
        { type: "map", title: "Field Map", col: 4, row: 9, cols: 3, rows: 2 },
      ],
    },
    "maintenance-planning": {
      label: "Maintenance Planning",
      seed: "maintenance-planning",
      widgets: [
        { type: "stat", title: "Asset Health", config: { metric: "avg", valueField: "value" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "calendar", title: "Upcoming Inspections", col: 3, row: 6, cols: 2, rows: 2 },
        { type: "table", title: "Inventory Shortage", config: { columns: ["label", "partType", "quantity", "status"], sortBy: "quantity", sortDirection: "asc", limit: 24 }, col: 1, row: 8, cols: 3, rows: 2 },
        { type: "chart", title: "Completion", config: { chartType: "gauge", xField: "label", yField: "progress", aggregation: "avg" }, col: 4, row: 8, cols: 2, rows: 2 },
      ],
    },
    "customer-success": {
      label: "Customer Success",
      seed: "customer-success",
      widgets: [
        { type: "stat", title: "Open Requests", config: { metric: "count", valueField: "ageHours" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Request Aging", config: { chartType: "histogram", xField: "ageHours", yField: "value", aggregation: "count" }, col: 3, row: 6, cols: 3, rows: 2 },
        { type: "table", title: "Accounts", config: { columns: ["label", "segment", "status", "revenue"], limit: 24 }, col: 1, row: 8, cols: 3, rows: 2 },
        { type: "text", title: "Notes", config: { body: "Use this space for account context, call notes, and follow-up planning." }, col: 4, row: 8, cols: 2, rows: 2 },
      ],
    },
    "engineer-dataflow-demo": {
      label: "Engineer Mode Dataflow Demo",
      seed: "engineer-dataflow-demo",
      engineerMode: true,
      widgets: [
        { type: "data-filter", title: "Equation Filter", config: { operator: "AND", expression: "value > threshold" }, col: 1, row: 6, cols: 2, rows: 2, layer: "backend" },
        { type: "data-filter", title: "Type Conversion", config: { filterMode: "type-conversion", sourceType: "string", targetType: "number" }, col: 3, row: 6, cols: 2, rows: 2, layer: "backend" },
        { type: "shift", title: "Threshold Shift", col: 5, row: 6, cols: 2, rows: 2 },
        { type: "context-inspector", title: "Context Inspector", col: 1, row: 8, cols: 3, rows: 2, layer: "backend" },
      ],
    },
    "panel-containment-stress": {
      label: "Panel Containment Stress",
      seed: "panel-containment-stress",
      widgets: [
        { type: "stat", title: "Panel Metric", config: { metric: "avg", valueField: "value" }, col: 1, row: 1, cols: 2, rows: 1, panel: "demo-panel-a" },
        { type: "chart", title: "Panel Trend", config: { chartType: "sparkline", xField: "timestamp", yField: "value" }, col: 1, row: 2, cols: 3, rows: 1, panel: "demo-panel-a" },
        { type: "table", title: "Panel Rows", config: { columns: ["label", "category", "status", "value"], limit: 18 }, col: 1, row: 1, cols: 3, rows: 2, panel: "demo-panel-b" },
      ],
      panels: [
        { key: "demo-panel-a", title: "Local Signals", col: 1, row: 6, cols: 3, rows: 3 },
        { key: "demo-panel-b", title: "Local Records", col: 4, row: 6, cols: 3, rows: 3 },
      ],
    },
    "ai-scenario-analysis": {
      label: "AI Scenario Analysis",
      seed: "ai-scenario-analysis",
      widgets: [
        { type: "ai-assistant", title: "Workspace Operator", config: { scope: "workspace", promptTemplate: "What changed this month?" }, col: 1, row: 6, cols: 3, rows: 4 },
        { type: "stat", title: "Projected Value", config: { metric: "sum", valueField: "revenue", format: "currency" }, col: 4, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Scenario Trend", config: { chartType: "area", xField: "timestamp", yField: "revenue", aggregation: "sum", limit: 48 }, col: 4, row: 7, cols: 3, rows: 2 },
        { type: "table", title: "Scenario Inputs", config: { columns: ["label", "category", "revenue", "cost", "status"], sortBy: "revenue", sortDirection: "desc", limit: 24 }, col: 1, row: 10, cols: 4, rows: 2 },
      ],
    },
    "geospatial-operations": {
      label: "Geospatial Operations",
      seed: "geospatial-operations",
      widgets: [
        { type: "map", title: "Coverage Map", config: { latitudeField: "latitude", longitudeField: "longitude", locationField: "location", limit: 140 }, col: 1, row: 6, cols: 4, rows: 3 },
        { type: "table", title: "Location Records", config: { columns: ["label", "location", "status", "value"], limit: 28 }, col: 5, row: 6, cols: 2, rows: 3 },
        { type: "chart", title: "Regional Mix", config: { chartType: "bar", xField: "region", yField: "value", aggregation: "avg", limit: 12 }, col: 1, row: 9, cols: 3, rows: 2 },
        { type: "stat", title: "Active Sites", config: { metric: "count" }, col: 4, row: 9, cols: 2, rows: 1 },
      ],
    },
    "asset-health": {
      label: "Asset Health View",
      seed: "asset-health",
      widgets: [
        { type: "stat", title: "Average Health", config: { metric: "avg", valueField: "value" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Condition Distribution", config: { chartType: "histogram", xField: "value", yField: "value", aggregation: "count", limit: 60 }, col: 3, row: 6, cols: 3, rows: 2 },
        { type: "calendar", title: "Inspection Plan", col: 1, row: 8, cols: 2, rows: 2 },
        { type: "table", title: "Asset Register", config: { columns: ["label", "assetType", "status", "lastUpdated", "value"], sortBy: "value", sortDirection: "asc", limit: 30 }, col: 3, row: 8, cols: 4, rows: 2 },
      ],
    },
    "financial-forecasting": {
      label: "Financial Forecasting",
      seed: "financial-forecasting",
      widgets: [
        { type: "stat", title: "Revenue", config: { metric: "sum", valueField: "revenue", format: "currency" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "stat", title: "Cost", config: { metric: "sum", valueField: "cost", format: "currency" }, col: 3, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Revenue Projection", config: { chartType: "line", xField: "timestamp", yField: "revenue", aggregation: "sum", limit: 60 }, col: 1, row: 7, cols: 4, rows: 2 },
        { type: "chart", title: "Cost Mix", config: { chartType: "donut", xField: "category", yField: "cost", aggregation: "sum", limit: 12 }, col: 5, row: 7, cols: 2, rows: 2 },
        { type: "table", title: "Forecast Inputs", config: { columns: ["label", "category", "revenue", "cost", "progress"], limit: 24 }, col: 1, row: 9, cols: 4, rows: 2 },
      ],
    },
    "alarm-analytics": {
      label: "Alarm Analytics",
      seed: "alarm-analytics",
      widgets: [
        { type: "stat", title: "Open Signals", config: { metric: "count" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Frequency Trend", config: { chartType: "area", xField: "timestamp", yField: "value", aggregation: "count", limit: 96 }, col: 3, row: 6, cols: 4, rows: 2 },
        { type: "chart", title: "Status Breakdown", config: { chartType: "bar", xField: "status", yField: "value", aggregation: "count" }, col: 1, row: 8, cols: 2, rows: 2 },
        { type: "table", title: "Signal Log", config: { columns: ["label", "status", "severity", "timestamp", "value"], sortBy: "timestamp", sortDirection: "desc", limit: 30 }, col: 3, row: 8, cols: 4, rows: 2 },
      ],
    },
    "live-dispatch-board": {
      label: "Live Dispatch Board",
      seed: "live-dispatch-board",
      widgets: [
        { type: "filter", title: "Dispatch Filter", col: 1, row: 6, cols: 2, rows: 2 },
        { type: "table", title: "Active Work", config: { columns: ["label", "owner", "status", "priority", "ageHours"], sortBy: "ageHours", sortDirection: "desc", limit: 30 }, col: 3, row: 6, cols: 4, rows: 3 },
        { type: "map", title: "Field Positions", col: 1, row: 8, cols: 2, rows: 2 },
        { type: "chart", title: "Workload", config: { chartType: "bar", xField: "owner", yField: "value", aggregation: "count", limit: 12 }, col: 1, row: 10, cols: 3, rows: 2 },
      ],
    },
  });

  const presetOrder = () => [
    "executive-overview",
    "operations-command-center",
    "maintenance-planning",
    "customer-success",
    "ai-scenario-analysis",
    "engineer-dataflow-demo",
    "panel-containment-stress",
    "geospatial-operations",
    "asset-health",
    "financial-forecasting",
    "alarm-analytics",
    "live-dispatch-board",
  ];

  const generatedWorkspaceProfile = (kind = "demo", id = "") => `${kind}:${id || "workspace"}`;

  const generatedProfileSource = (profile = "") => {
    const [kind, ...rest] = String(profile || "").split(":");
    const id = rest.join(":");
    return id && ["demo", "ai-example", "ai-generated", "stress"].includes(kind) ? { kind, id } : null;
  };

  const aiExampleDefinitions = () => [
    { id: "cost-reduction-scenario", label: "Cost Reduction Scenario", scenario: "financial-forecasting", prompt: "What if labor cost dropped by 12%?" },
    { id: "regional-performance-analysis", label: "Regional Performance Analysis", scenario: "regional-performance-analysis", prompt: "Compare regional performance and show the worst performing areas." },
    { id: "technician-efficiency-breakdown", label: "Technician Efficiency Breakdown", scenario: "technician-efficiency-breakdown", prompt: "Compare technician performance by region." },
    { id: "sla-risk-dashboard", label: "SLA Risk Dashboard", scenario: "sla-risk-dashboard", prompt: "Which customers are most at risk?" },
    { id: "revenue-projection-workspace", label: "Revenue Projection Workspace", scenario: "revenue-projection-workspace", prompt: "Compare current margin to projected margin if material cost rises 8%." },
  ];

  window.dashboardDemoLayoutRuntime = {
    presets: workspacePresets,
    presetOrder,
    aiExampleDefinitions,
    generatedWorkspaceProfile,
    generatedProfileSource,
    scenarioSource: (scenario, options = {}) => demoDataRuntime()?.scenarioSource?.(scenario, options) || null,
    useCaseMatrix: () => demoDataRuntime()?.useCaseMatrix?.() || {},
    generateData: (options = {}) => demoDataRuntime()?.generateOperationalData?.(options) || null,
  };
})();