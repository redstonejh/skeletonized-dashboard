# Run: liquid-glass-window-controls

Verdict: SHIP

## Task
Replace the native window header/menu with frameless Electron chrome, add liquid-glass refresh and close controls next to the gear, and make the gear a grey liquid-glass button with a white icon.

## Standing Rules
- Real MAW delegation used through existing sub-agent sessions.
- No tests or validation run by user instruction.
- Commit and push after implementation.

## Outcome
The Electron window is frameless/menu-less, a draggable top strip was added, refresh/close controls are exposed through preload-safe IPC, and the top-left controls share the existing glass visual language.
