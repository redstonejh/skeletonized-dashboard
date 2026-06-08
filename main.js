const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("node:path");

Menu.setApplicationMenu(null);

function removeNativeChrome(win) {
  win.setMenu(null);
  win.removeMenu?.();
  win.setAutoHideMenuBar(true);
  win.setMenuBarVisibility(false);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 1000,
    frame: false,
    autoHideMenuBar: true,
    show: process.env.MAW_HEADLESS !== "1",
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#f7f8fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  removeNativeChrome(win);
  win.loadFile(path.join(__dirname, "index.html"));
}

app.on("browser-window-created", (_event, win) => {
  removeNativeChrome(win);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ipcMain.handle("dashboard-window:reload", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.webContents?.reload();
  });
  ipcMain.handle("dashboard-window:minimize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });
  ipcMain.handle("dashboard-window:close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
