# Extend Grid Floor One Row

## Task
Extend the usable grid floor by exactly one row unit so bottom viewport space becomes placeable without adding a hardcoded pixel offset.

## Delegation
Real MAW delegation reused existing distinct sub-agent sessions.

## Outcome
SHIP. The shared viewport floor calculation now derives a row unit from measured row height plus grid gap and adds exactly that one unit before converting to rows. Drag and collision continue to consume the same shared floor.

## Verification
Per user instruction, no tests, canaries, or validation commands were run.
