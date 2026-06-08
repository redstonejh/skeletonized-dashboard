# Implementation Note

Changed files:

- `app/static/themes.css`

Root sources addressed:

- The late widget material block now covers all widget states and removes visible perimeters with `border-width: 0`, transparent border color, `outline: 0`, `outline-offset: 0`, and `box-shadow: none`.
- The widget material pseudo-element is disabled for non-pinned widgets so it cannot draw a shine/drop-shadow edge around the card.
- Panels were not included in the new perimeter-removal selectors.

Tests were intentionally not run per user instruction.
