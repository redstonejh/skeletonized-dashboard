# Hand-off: planner -> worker  (run 2026-06-06_optimize-background-photos-webp-predecode_c4e8, step 02)

## Task context
The change is a performance pass, not byte-parity CSS work. WebP is required, AVIF is out, and no runtime dependency may be added.

## What I did
Mapped the 26 JPEG assets, the runtime references in background-controller.js, and the picker thumbnail references in themes.css. Planned a safe downscale target of 2560x1440 cover-preserving output with WebP quality 82.

## Output / artifacts
- artifacts/bg-optimization-baseline.json  (pre-edit image dimensions, megapixels, bytes)
- artifacts/perf-theme-before.json  (pre-edit perf-theme-switch capture)

## Open questions / risks
Predecode must be cancellation-safe and fail open if a decode stalls. The app must keep solid tones, custom color, and solar-system photo mode working.

## Recommended next step
Convert assets, update references, add predecode, remove old JPEGs, and add e2e coverage proving every photo option renders a decodable WebP.
