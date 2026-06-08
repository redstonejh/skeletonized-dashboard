# Fix Frameless Controls And Minimize

Verdict: SHIP

Task: make the Electron window truly frameless, fix the refresh icon, and add a minimize control.

Outcome:
- Removed the `titleBarStyle` / `titleBarOverlay` path and kept the BrowserWindow on the plain `frame: false` frameless path.
- Centralized native menu removal and applied it to every created BrowserWindow.
- Added a custom minimize button wired through preload IPC.
- Replaced the malformed refresh mask with a balanced refresh icon.
- Tests were not run by user instruction.

