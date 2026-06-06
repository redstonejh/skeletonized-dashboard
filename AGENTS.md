# Agent Instructions

This repository is a native Electron dashboard customization GUI. It is pure HTML/CSS/JS and has no backend process.

## Non-Negotiable Rules

- Do not redesign the UI unless the user explicitly asks for a redesign.
- Preserve existing class names, visual language, spacing, shadows, radius, colors, glass effects, transitions, themes, and photo background behavior.
- Do not change drag, resize, collision, snapping, ghost preview, edge auto-scroll, pinning, panel containment, layout save/load/reset, or undo behavior without updating Playwright coverage.
- Treat flicker, jitter, off-grid placement, sticky collision previews, overlap, clipping, text/icon misalignment, and theme visual drift as bugs.
- Keep persistence routed through the Electron preload bridge or the existing renderer fallback; do not add a backend.
- Prefer focused fixes over broad rewrites. Read the current code before changing it.

## Protected Files

- `main.js`: Electron window setup and renderer security flags.
- `preload.js`: isolated persistence bridge.
- `index.html`: renderer entry markup.
- `app/static/app.js`: renderer composition root for dashboard interactions.
- `app/static/modules/`: ES-module interaction and runtime pieces.
- `app/static/dashboard-grid.css`: grid layout, widget/panel states, drag ghosts, resize handles, placeholders, and interaction transitions.
- `app/static/themes.css`: theme, photo background, and glass-material polish.
- `electron-tests/dashboard-electron.spec.js`: Electron end-to-end regression coverage.

## Drag And Resize Rules

- Widgets and panels share one dashboard occupancy map.
- Pinned items reserve their cells globally and must not be displaced by other interactions.
- Drag preview state must be reversible. Neighboring items may visually shift during preview, but only the actively dragged item commits on drop.
- Sparse placement is valid. Do not auto-pack intentional empty grid space during ordinary drag or resize.
- Use transforms or FLIP-style animation for movement previews and committed grid styles for settled layout.
- Keep committed layout, preview layout, and final drop result separate.

## Required Validation

Before committing user-facing behavior changes, run:

```powershell
npm run test:e2e
```

If a test cannot be run, document why in the final response.

**User override:** When the user's prompt contains any of the following - "no tests", "skip tests", "do not run tests", "don't validate", "no validation", "CSS-only", "visual-only", "I'll test manually", or an equivalent instruction to skip automated validation - do not run the test suite. Note the skip in the final response. Targeted single-test runs explicitly instructed by the user are still permitted.

## Documentation To Check

- `README.md`
- `artifacts/interdependency-dossier.md`
- `artifacts/maw-dependencies.md`

Update documentation when changing behavior, interaction mechanics, persistence, or architectural rules.

## Codex Multi-Agent Workflow

This repository may run the Codex-native Multi-Agent Workflow (MAW) for refactor and verification tasks. The main Codex entry point is `.codex/skills/maw/SKILL.md`. Role definitions live in `.codex/agents/`. Deterministic tools live in `maw-tools/` and must use only the Python standard library.

Core roles:

- `conductor`: selects the smallest useful team, records the run plan, and enforces caps.
- `planner`: decomposes the task into concrete steps and acceptance criteria.
- `worker`: implements the plan and records outputs.
- `critic`: evaluates the worker output against criteria and deterministic check results.
- `acceptance_gate`: performs the final independent check and records `SHIP`, `NO-SHIP`, or `NEEDS-HUMAN`.

Default caps:

| Cap | Default |
|---|---:|
| `max_agents` | 5 |
| `max_parallel` | 3 |
| `max_iters` | 3 |

Every MAW run folder must contain:

```text
run.md
memory.md
agents/<role>.md
handoffs/NN_<from>__to__<to>.md
artifacts/
```

Append one short entry per role turn to `memory.md`:

```markdown
## HH:MM - <agent>
What changed, where output landed, and the next step.
```

Create handoffs with `maw-tools/scaffold_run.py handoff` and fill every generated section:

```markdown
# Hand-off: <from> -> <to>  (run <id>, step NN)

## Task context
What we are trying to achieve.

## What I did
Concrete work completed.

## Output / artifacts
- artifacts/<file>  (what it is)

## Open questions / risks
Risks the next role should watch.

## Recommended next step
Specific next action.
```

Use deterministic checks whenever possible before relying on model judgment:

```powershell
python maw-tools/scaffold_run.py init "<task>" --agents conductor,planner,worker,critic,acceptance_gate --json
python maw-tools/scaffold_run.py handoff --run <run_dir> --from planner --to worker
python maw-tools/validate_handoffs.py <run_dir>
python maw-tools/checks.py test --cmd "<test command>"
python maw-tools/acceptance_check.py --run <run_dir> --test-cmd "<test command>"
python maw-tools/verdict_check.py <run_dir>
```
