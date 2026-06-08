# Include Panel Widgets In WebGL Glass

Verdict: SHIP

Task: widgets inside panels should keep the same WebGL liquid-glass effect as dashboard widgets.

Outcome:
- Removed the explicit `liquid-glass-webgl.js` collector filter that skipped `.widget-card` elements inside `.db-panel`.
- Kept the existing WebGL glass system and object selector; no parallel path was added.
- Tests were not run by user instruction.

