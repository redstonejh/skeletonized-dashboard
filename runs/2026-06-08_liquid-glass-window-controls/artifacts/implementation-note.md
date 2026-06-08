# Implementation Note

Changed files:

- `main.js`
- `preload.js`
- `index.html`
- `app/static/modules/floating-control-bar-runtime.js`
- `app/static/themes.css`

Implementation:

- Set the Electron `BrowserWindow` to `frame: false` and `autoHideMenuBar: true`.
- Removed the native application menu with `Menu.setApplicationMenu(null)`.
- Exposed `dashboardWindowControls.reload()` and `.close()` through preload IPC.
- Added refresh, close, and gear controls in one top-left cluster.
- Added a fixed top drag strip with `-webkit-app-region: drag`, while controls opt out with `no-drag`.
- Restyled the controls as grey liquid-glass circles with white masked icons.

Tests were intentionally not run per user instruction.
