# Run 2026-06-06_increment-7-mixed-context-salvage_2566

- Task: increment 7 gut mixed-context-query-compatibility dormant island
- Workflow template: salvage-task
- Created: 2026-06-06 13:32
- Status: in-progress

## Conductor plan
Started from workflow template `salvage-task`.

Agents:
- conductor
- planner
- dependency_mapper
- dependency_untangler
- dead_code_auditor
- worker
- critic
- salvage_verifier
- acceptance_gate

Deterministic checks:
- topology: `python maw-tools/salvage_check.py topology <path> --output artifacts/topology.json`
- code-graph: `maw code-graph <path> --lang auto --output artifacts/code-graph.json`
- test-triage: `python maw-tools/salvage_check.py test-triage --root <path> --graph artifacts/code-graph.json --plan artifacts/salvage-plan.md --test-cmd "<active test command with {tests}>" --provenance artifacts/test-provenance.md --output artifacts/test-triage.json`
- characterize: `python maw-tools/salvage_check.py characterize <path> --root <path> --test-cmd "<playwright baseline command>" --interaction-artifact artifacts/interaction-baseline.json --output artifacts/characterization-baseline.json`
- preserved-surface-freeze: `python -c "import hashlib, pathlib; p=pathlib.Path('artifacts/preserved-surface.json'); pathlib.Path('artifacts/preserved-surface.sha256').write_text(hashlib.sha256(p.read_bytes()).hexdigest() + '\n', encoding='utf-8')"`
- preserve-parity: `python maw-tools/salvage_check.py preserve-parity --characterization-baseline artifacts/characterization-baseline.json --target <path> --test-cmd "<electron e2e command>" --interaction-artifact artifacts/interaction-current.json --preserved-surface artifacts/preserved-surface.json --run <run_dir> --output artifacts/preserve-parity.json`
- hidden-deps: `python maw-tools/salvage_check.py hidden-deps --graph artifacts/code-graph.json --root <path> --coverage artifacts/hidden-deps-tests.json --output artifacts/hidden-deps.json`
- cross-lang: `python maw-tools/salvage_check.py cross-lang --graph artifacts/code-graph.json --root <path> --coverage artifacts/hidden-deps-tests.json --output artifacts/cross-lang-couplings.json`
- dead-code: `python maw-tools/salvage_check.py dead-code --graph artifacts/code-graph.json --preserved-surface artifacts/preserved-surface.json --removed artifacts/removed-symbols.json --output artifacts/dead-code.json`
- duplication: `python maw-tools/salvage_check.py duplication --graph artifacts/code-graph.json --plan artifacts/duplication-plan.json --output artifacts/duplication.json`
- complexity-candidates: `python maw-tools/salvage_check.py complexity-candidates --root <path> --output artifacts/complexity-candidates.json`
- complexity-reduced: `python maw-tools/salvage_check.py complexity-reduced --root <path> --baseline-candidates artifacts/complexity-candidates.json --plan artifacts/complexity-plan.json --output artifacts/complexity-reduced.json`
- stale: `python maw-tools/salvage_check.py stale --graph artifacts/code-graph.json --root <path> --removed artifacts/removed-symbols.json --justifications artifacts/stale-justifications.json --output artifacts/stale-code.json`
- interdependency-dossier: `python maw-tools/salvage_check.py dossier --graph artifacts/code-graph.json --root <path> --coverage artifacts/hidden-deps-tests.json --dossier artifacts/interdependency-dossier.md --output artifacts/interdependency-dossier.json`
- salvage-resistance: `python maw-tools/salvage_check.py resistance --graph artifacts/code-graph.json --preserved-surface artifacts/preserved-surface.json --removed artifacts/removed-symbols.json --duplication-plan artifacts/duplication-plan.json --coverage artifacts/hidden-deps-tests.json --baseline artifacts/characterization-baseline.json --complexity-baseline artifacts/complexity-candidates.json --complexity-plan artifacts/complexity-plan.json --stale-justifications artifacts/stale-justifications.json --dossier artifacts/interdependency-dossier.md --root <path> --output artifacts/salvage-resistance.json`
- salvage-result: `python maw-tools/salvage_check.py verdict <run_dir> --output artifacts/salvage-result.json`
- handoffs: `python maw-tools/validate_handoffs.py <run_dir>`

Acceptance gates:
- topology-detected
- static-first-test-triage-complete
- preserved-test-contract-active-only
- legacy-tests-not-resurrected
- preserved-surface-frozen
- pre-gut-characterization-captured
- preserved-surface-parity
- hidden-dependencies-documented-and-tested
- cross-language-couplings-documented-tested-or-justified
- removed-code-proven-dead
- duplicate-logic-collapsed-and-rerouted
- complexity-candidates-detected-and-touched-candidates-reduced
- stale-legacy-code-removed-or-justified
- interdependency-dossier-documented-and-tested
- salvage-regression-resistance
- handoffs-valid

## Required Artifact Checklist
See `artifacts/artifact-checklist.md`.

## Final result summary
Pending acceptance gate.

## Final result summary
Acceptance verdict: SHIP

Deleted only graph/text-proven dormant mixed-context-query residue: unused app-level data adapter destructures, orphan ensureContextBadge, and the unused data origin definition registry. Active context/query resolution and widget query behavior remain resident. Final hidden Electron e2e/canaries passed 10/10.
