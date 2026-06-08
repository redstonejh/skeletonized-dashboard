# Fix Frameless Window Controls

Verdict: SHIP

Task: remove remaining native Electron chrome and make the top-left refresh, close, and gear controls render visible icons.

Outcome:
- Hardened the BrowserWindow frameless configuration and removed the per-window menu.
- Fixed the masked control icons by making the pseudo-elements render as real boxes.
- Tests were not run by user instruction.

