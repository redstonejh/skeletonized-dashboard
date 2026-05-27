# AI Workspace Operator

## Purpose

The AI Workspace Operator is the first architectural layer for an assistant that builds visual analytical workspaces instead of answering only in text.

It is local and deterministic in this version. It does not call an external AI service. The important foundation is the contract:

1. inspect available data and widget capabilities
2. produce a structured, reviewable plan
3. execute only validated workspace actions
4. create registry-backed widgets, panels, calculations, and explanations
5. expose calculation/logic objects in Engineer Mode when needed

## Runtime Files

- `app/static/ai-workspace-operator.js`
  - intent classification
  - schema-aware plan generation
  - what-if scenario planning
  - action execution orchestration
  - persistent AI Assistant rail prompt binding
- `app/static/app.js`
  - exposes `window.dashboardWorkspaceActionRuntime`
  - validates and executes safe workspace actions through existing widget/panel/dataflow systems
- `app/static/widget-registry.js`
  - renders the AI Assistant as an operator surface with Plan and Build actions

## Public Runtimes

`window.dashboardWorkspaceActionRuntime`

- `actionTypes()`
- `validateAction(action)`
- `inspectDatasets(layoutKey, profile)`
- `inspectWidgetRegistry()`
- `nextSafeRow(layoutKey, options)`
- `executeAction(action, options)`
- `executePlan(plan, options)`
- `updateWidgetConfig(widget, patch, options)`
- `validateWorkspaceAnswer(plan, execution, options)`

`window.dashboardAiOperatorRuntime`

- `inspectData(layoutKey)`
- `plan(question, options)`
- `executePlan(plan, options)`
- `runPrompt(question, options)`
- `classifyIntent(question)`
- `supportedActions()`

`window.dashboardLayoutSourceRuntime`

- `groups(layoutKey)`
- `activate(layoutKey, source)`
- `registerGenerated(layoutKey, entry)`

AI generated examples in the Layout selector use this same source contract. They seed demo data, execute a local operator prompt, persist the result in an isolated generated profile, and register the generated workspace for reopening without polluting saved user layout slots.

## Safe Action Model

The operator does not mutate random layout internals directly. It emits actions such as:

- `inspectDatasets`
- `inspectSchema`
- `inspectWidgetRegistry`
- `createWidget`
- `createPanel`
- `createFilter`
- `createLogicGate`
- `createBoolean`
- `createTypeConverter`
- `createCalculatedField`
- `createEquationFilter`
- `createChart`
- `createTable`
- `createStat`
- `createMap`
- `createNote`
- `moveObject`
- `resizeObject`
- `createDataflowLink`
- `applyConditionalStyle`
- `createConditionalStyle`
- `createScenario`
- `validateWorkspaceAnswer`
- `summarizeWorkspace`
- `explainWidget`
- `explainCalculation`

Execution is routed through `dashboardWorkspaceActionRuntime`, which reuses existing registry, panel, persistence, context, and Engineer Mode systems.

## Planning Contract

Plans are JSON-like records:

```json
{
  "id": "ai-plan-example",
  "version": 1,
  "goal": "What if cost dropped by 12%?",
  "intent": "what-if",
  "status": "ready",
  "requiredData": ["cost", "revenue", "category"],
  "availableData": {
    "datasetId": "demo-source",
    "datasetName": "Demo Source",
    "rowCount": 120
  },
  "assumptions": [],
  "limitations": [],
  "capabilityGaps": [],
  "scenario": {
    "destructive": false
  },
  "steps": []
}
```

Statuses:

- `ready`: enough data exists to build the requested workspace
- `partial`: useful visual output is possible, but missing fields or assumptions are visible
- `blocked`: no safe useful workspace can be built

Approval is not implemented yet, but the plan contract is reviewable before execution.

## Data Understanding

Dataset inspection exposes:

- source id/name/kind
- row count
- fields and types
- sample values
- numeric fields
- categorical fields
- time fields
- geospatial fields
- missing-value warnings
- empty-dataset warnings
- sample rows

The planner uses these fields to choose visualizations and to refuse or partially answer unsupported questions. It must not invent unavailable fields.

## Strict Workspace-Computer Rule

The operator may only answer by composing real workspace primitives. It must not use hidden LLM computation, decorative placeholder widgets, invented fields, direct DOM mutation, or unsupported widget types.

If a request cannot be physically encoded with the current runtime, the planner records a capability gap instead of faking the result. Gap types include:

- `missing-data`
- `missing-field`
- `missing-transform`
- `missing-widget-renderer`
- `missing-aggregation`
- `missing-equation-capability`
- `missing-scenario-capability`
- `missing-dataflow-node`
- `missing-visual-encoding`
- `missing-panel-layout-capability`
- `missing-persistence-support`
- `missing-engineer-transparency`

Data gaps can produce an honest partial workspace when useful. Program capability gaps must be resolved by extending the relevant generalized primitive before the operator may present the answer as solved.

## Intent Mapping

Current deterministic mappings:

- Executive/overview request: stat cards, trend chart, status mix chart, table, optional map, explanation note
- Trend/change request: line/area trend, summary stat, recent rows table, explanation note
- Ranking/risk/attention request: ranked table, comparison chart, optional map, explanation note
- What-if request: scenario object, calculated fields, projected stat, comparison chart, scenario table, Engineer Mode equation filter, explanation note
- Fallback summary: record count, table, explanation note

## What-If Semantics

Scenarios are derived views. They do not mutate source rows.

The first version supports simple percent adjustments such as:

- cost decreases by 12%
- revenue increases by 5%
- material cost rises by 8%

The operator creates calculated fields in widget config, for example:

- adjusted value
- projected savings
- projected margin

It also creates an Engineer Mode data-filter/equation surface so the logic can be inspected without cluttering normal mode.

For derived/scenario answers, the operator now creates output-to-input dataflow links from the Engineer Mode formula block into each visual output that depends on the calculation. Normal mode remains presentation-focused; Engineer Mode shows the formula surface, ports, and stored dependency graph.

## Answer Validation

After execution, `validateWorkspaceAnswer` checks that:

- every AI action is supported by the safe action contract
- every created widget is registry-backed
- visual widgets are visible and show runtime data or an honest explanation
- charts have marks, tables have rows, maps have points, and stats have runtime values
- calculated fields have an Engineer Mode formula block
- calculated visual outputs are wired from formula output to visual input
- dataflow links preserve output -> input direction
- scenarios do not mutate source rows
- persisted workspace validation still passes

If validation fails, `executePlan` returns `ok: false`. The assistant rail reports partial/invalid status instead of success.

## Explanation Widget

The operator uses the existing Text / Notes widget as the explanation surface. The note records:

- the user question
- the answer approach
- assumptions
- limitations
- suggested next inspection steps

This keeps AI-created dashboards explainable and persistence-safe.

## Guardrails

The operator must:

- avoid unsupported widget types
- avoid unavailable fields
- mark assumptions clearly
- mark missing-data limitations clearly
- avoid destructive what-if edits
- keep calculations in widget config or explicit Engineer Mode objects
- avoid hidden persistent state
- keep normal mode calm and uncluttered
- reveal backend/equation objects only through Engineer Mode
- avoid claiming causation from correlation
- reject untraceable values
- reject unsupported widgets
- validate lineage before reporting success

## Current Limits

This version is a local deterministic operator, not an external model integration. It can classify common analytical prompt patterns and build real workspaces from inspected schema, but it does not perform open-ended natural-language reasoning beyond the implemented planning rules.
