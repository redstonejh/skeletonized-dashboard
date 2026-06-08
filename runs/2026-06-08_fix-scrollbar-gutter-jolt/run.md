# Fix Scrollbar Gutter Jolt

Verdict: SHIP

Task: make the right-side scrollbar reservation visually blend with the app and stop page shift when the scrollbar appears.

Outcome:
- Reserved root scrollbar space with `scrollbar-gutter: stable both-edges`.
- Kept the root scrollbar lane present with `overflow-y: scroll` so it does not pop in and recenter the page.
- Restyled the root scrollbar lane/track/corner as translucent glass instead of a blank strip.
- Tests were not run by user instruction.

