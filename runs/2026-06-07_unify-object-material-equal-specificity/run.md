# MAW Run: Unify Object Material At Equal Specificity

Task: unify static and photo object material without lowering the canonical photo selector specificity.

Workflow: frontend-ui-task

Selected roles: conductor, planner, worker, critic, acceptance_gate

Delegation: real sub-agent delegation was used. See `artifacts/delegation-proof.json`.

## Final result summary

Acceptance verdict: SHIP

The object material selectors now use `body:is(.has-photo-background, :not(.has-photo-background))`, which preserves the body-plus-class specificity profile while applying one declaration block to both static and photo backgrounds. The stale static-only computed replay block was removed. The material equality e2e and full hidden Electron e2e suite passed.

