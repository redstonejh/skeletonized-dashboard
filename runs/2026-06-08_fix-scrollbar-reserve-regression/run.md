# Fix Scrollbar Reserve Regression

Verdict: SHIP

Task: remove the left black strip and restore WebGL glass alignment after the scrollbar-reserve change.

Outcome:
- Removed the `stable both-edges` root gutter that created the left strip.
- Removed forced root vertical scrolling so the page is not shifted by the reserve mechanism.
- Restored transparent root scrollbar track/corner styling so the right lane does not paint as a black strip.
- Tests were not run by user instruction.

