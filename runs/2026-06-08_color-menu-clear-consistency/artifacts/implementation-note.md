# Implementation Note

The clear/no-color item is now rendered by the same swatch-building loop as the theme colors. It is the first entry in the `Theme color` group with `data-color-action="clear"` and an empty color key.

The old separate `panel-color-clear-group` / `panel-color-clear` button path was removed, so panel and widget menus use one shared structure in every state.

No tests or validation commands were run per user instruction.

