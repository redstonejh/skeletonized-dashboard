# Run 2026-06-06_css-phase-1-map-oracle_17eb

- Task: CSS phase increment 1 map CSS tangle and computed-style oracle
- Workflow template: frontend-ui-task
- Created: 2026-06-06 14:54
- Status: complete

## Conductor plan
Started from workflow template `frontend-ui-task`.

Agents:
- conductor
- planner
- ui_builder
- change_verifier
- a11y_auditor
- responsive_checker
- perf_budgeter
- markup_validator
- style_drift_auditor
- visual_verifier
- ux_critic
- critic
- acceptance_gate

Deterministic checks:
- contrast: `uv run python maw-tools/web_checks.py contrast --foreground <hex> --background <hex>`
- a11y: `uv run python maw-tools/web_checks.py a11y <html>`
- budget: `uv run python maw-tools/web_checks.py budget <html> --max-bytes <n> --max-elements <n> --max-assets <n>`
- links: `uv run python maw-tools/web_checks.py links <html>`
- markup: `uv run python maw-tools/web_checks.py markup <html>`
- style: `uv run python maw-tools/web_checks.py style <css> --selector <selector> --property <property>`
- changed: `uv run python maw-tools/web_checks.py changed --before <before.css> --after <after.css> --selector <selector> --property <property> --expected <value>`
- tokens: `uv run python maw-tools/web_checks.py tokens --token-file <design-tokens.json> <css...>`
- apply-design: `maw apply-design liquid-glass <target> --output artifacts/apply-design.json`
- design-parity: `maw design-parity <target> --output artifacts/design-parity.json`
- handoffs: `uv run python maw-tools/validate_handoffs.py <run_dir>`

Acceptance gates:
- requested-change-present
- no-design-token-drift
- a11y-static-pass
- contrast-pass
- budget-pass
- links-pass
- markup-pass
- advisory-ux-recorded

## Required Artifact Checklist
See `artifacts/artifact-checklist.md`.

## Final result summary
Acceptance verdict: SHIP

CSS phase increment 1 shipped a read-only CSS map and deterministic computed-style oracle. `themes.css`, `dashboard-grid.css`, and `tokens.css` are unchanged. The computed-style baseline is 10/10 deterministic and caught temporary color and spacing mutations in copied app roots.
