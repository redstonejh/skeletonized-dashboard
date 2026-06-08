# Run: tabs-overhaul

## Task
Remove the tab-bar add node, create tabs through the existing control-menu add flow, make tab changes undoable with Ctrl+Z, and constrain right-click tab customization to move, color, text, and delete.

## Workflow
MAW frontend/refactor task with real delegated roles. The runtime exposed `multi_agent_v1.spawn_agent`, but the thread limit was already reached, so the run used the existing distinct role sessions recorded in `artifacts/delegation-proof.json`. Tests and validation were intentionally skipped per the user standing rule for this run.

## Outcome
SHIP - tab creation now lives in the existing object add browser, the tab bar renders only tabs, tab state has undo, and the tab context menu exposes only the requested controls.
