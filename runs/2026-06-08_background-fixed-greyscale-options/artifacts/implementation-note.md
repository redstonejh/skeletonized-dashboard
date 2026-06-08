# Implementation Note

Changed the background color selector to a fixed greyscale preset model.

- Presets are now exactly `tone-light-grey`, `tone-grey`, `tone-dark-grey`, and `tone-black`.
- `tone-black` uses `#000000`.
- The custom background color input, custom background state, and custom background localStorage fallback were removed.
- Photo background buttons and photo handling were left untouched.
- Solid color backgrounds now assign `--base-tone`, `--bg`, and `--bg-end` to the preset color directly.
- Legacy saved tone names migrate to the closest fixed greyscale preset.

No tests or validation were run by explicit user instruction.
