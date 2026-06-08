# Implementation Note

Changed only the solid color background presets:

- Removed `tone-frosted`, `tone-mist`, and `tone-warm` from the active preset menu/model because they were white or light-grey choices.
- Added `tone-black` (`#000000`) and `tone-dark-grey` (`#1f2937`) as normal preset entries.
- Updated removed legacy tone migrations and the default fallback to `tone-dark-grey` or another remaining dark preset.
- Left photo backgrounds and the custom color picker behavior untouched.

No tests were run by explicit user instruction.

