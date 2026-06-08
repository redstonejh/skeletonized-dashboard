# Run: tabs-use-object-customization-menu

## Task
Remove the bespoke tab right-click menu and make tabs use the same object customization drawer component, filtered to move, color, text, and delete.

## Workflow
MAW frontend/refactor task with real delegated roles. The runtime exposed `multi_agent_v1.spawn_agent`, but the thread limit was already reached, so the run used the existing distinct role sessions recorded in `artifacts/delegation-proof.json`. Tests and validation were intentionally skipped per the user standing rule for this run.

## Outcome
SHIP - tab right-click now renders the shared `panel-tool-drawer` component via `panelToolButtonsMarkup`; only resize and pin are filtered out.
