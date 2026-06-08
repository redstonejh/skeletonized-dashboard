const { contextBridge, ipcRenderer } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const storePath = path.join(os.homedir(), ".configurable-dashboard-gui", "layout-store.json");

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch {
    return {};
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

contextBridge.exposeInMainWorld("dashboardPersistence", {
  getItem(key) {
    const store = readStore();
    return Object.prototype.hasOwnProperty.call(store, key) ? String(store[key]) : null;
  },
  setItem(key, value) {
    const store = readStore();
    store[key] = String(value);
    writeStore(store);
  },
  removeItem(key) {
    const store = readStore();
    delete store[key];
    writeStore(store);
  },
  keys() {
    return Object.keys(readStore());
  },
  clear() {
    writeStore({});
  }
});

contextBridge.exposeInMainWorld("dashboardWindowControls", {
  reload() {
    return ipcRenderer.invoke("dashboard-window:reload");
  },
  close() {
    return ipcRenderer.invoke("dashboard-window:close");
  }
});
