# Refactor Plan

Per-tone collapse only. Collapse duplicated `.background-tone-option[data-background-tone="..."]` swatch custom-property declarations by moving repeated property/value pairs into grouped selectors with equivalent specificity, leaving unique per-tone values in their original blocks. No `!important` reduction, no file splitting, no performance changes.
