# Panel Zero Border Completion

## Task
Remove the remaining panel border and edge-strip sources so panels match the borderless widget treatment in collapsed, open, hover, focus, and tools-open states.

## Delegation
Real delegation used existing distinct sub-agent sessions because the runtime exposed live delegated sessions for the selected MAW roles.

## Outcome
SHIP. The panel shell, header, body, and expanded body overlay now share the borderless override path. The patch removes the remaining panel body top border, inset rim shadow, and pseudo-element edge overlay while keeping the panel body glass fill and blur intact.

## Verification
Per user instruction, no tests, canaries, or validation commands were run. Manual verification is reserved for the user.
