(() => {
  const PERSISTED_WORKSPACE_VERSION = 1;
  const prefixes = Object.freeze({
    panelStorage: "dashboard-panel-six-grid-layout:",
    panelProfile: "dashboard-panel-profile:",
    customPanels: "dashboard-custom-panels:",
    hiddenPanels: "dashboard-hidden-panels:",
    widgetStorage: "dashboard-widget-six-grid-layout:",
    customWidgets: "dashboard-custom-six-grid-widgets:",
    hiddenWidgets: "dashboard-hidden-six-grid-widgets:",
    floatingAnchors: "dashboard-floating-anchors:",
    dataSources: "dashboard-data-sources:",
    workspaceContexts: "dashboard-workspace-contexts:",
    workspaceAssets: "dashboard-assets:",
    workspaceLogicGraph: "dashboard-workspace-logic-graph:",
    persistedWorkspace: "dashboard-persisted-workspace:",
    layoutUndo: "dashboard-layout-undo:",
    layoutSource: "dashboard-layout-source:",
    generatedLayoutRegistry: "dashboard-generated-layout-sources:",
  });
  const transientClasses = Object.freeze([
    "active",
    "db-panel-dragging",
    "widget-dragging",
    "dashboard-active-resize",
    "dashboard-resize-source",
    "group-selected",
    "group-transform-member",
    "db-panel-tools-open",
    "widget-tools-open",
    "anchor-rail-source",
    "anchor-dragging",
    "anchor-rail-previewing",
    "panel-header-entry-accept",
    "panel-boundary-exit-release",
    "panel-entry-ghost-transition",
    "panel-exit-ghost-transition",
    "widget-runtime-meaning",
  ]);
  const runtimeMeaningDatasetKeys = Object.freeze([
    "runtimeActivity",
    "runtimeCondition",
    "runtimeConfidence",
    "runtimeFreshness",
    "runtimeMeaningSummary",
    "runtimeUrgency",
  ]);
  let workspaceClipboard = null;

  const WORKING_PROFILE = "0";
  const profileKey = (layoutKey = "builder") => `${prefixes.panelProfile}${layoutKey}`;
  const getActiveProfile = (layoutKey = "builder") => {
    try {
      return localStorage.getItem(profileKey(layoutKey)) || WORKING_PROFILE;
    } catch {
      return WORKING_PROFILE;
    }
  };
  const setActiveProfile = (layoutKey = "builder", profile = "1") => {
    try {
      localStorage.setItem(profileKey(layoutKey), String(profile || "1"));
    } catch {}
  };
  const key = {
    panelStorage: (layoutKey, itemKey, profile = getActiveProfile(layoutKey)) => `${prefixes.panelStorage}${profile}:${layoutKey}:${itemKey}`,
    customPanels: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.customPanels}${profile}:${layoutKey}`,
    hiddenPanels: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.hiddenPanels}${profile}:${layoutKey}`,
    widgetStorage: (layoutKey, itemKey, profile = getActiveProfile(layoutKey)) => `${prefixes.widgetStorage}${profile}:${layoutKey}:${itemKey}`,
    customWidgets: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.customWidgets}${profile}:${layoutKey}`,
    hiddenWidgets: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.hiddenWidgets}${profile}:${layoutKey}`,
    floatingAnchors: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.floatingAnchors}${profile}:${layoutKey}`,
    dataSources: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.dataSources}${profile}:${layoutKey}`,
    workspaceContexts: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.workspaceContexts}${profile}:${layoutKey}`,
    workspaceAssets: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.workspaceAssets}${profile}:${layoutKey}`,
    workspaceLogicGraph: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.workspaceLogicGraph}${profile}:${layoutKey}`,
    persistedWorkspace: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.persistedWorkspace}${profile}:${layoutKey}`,
    layoutUndo: (layoutKey, profile = getActiveProfile(layoutKey)) => `${prefixes.layoutUndo}${profile}:${layoutKey}`,
    layoutSource: (layoutKey = "builder") => `${prefixes.layoutSource}${layoutKey}`,
    generatedLayoutRegistry: (layoutKey = "builder") => `${prefixes.generatedLayoutRegistry}${layoutKey}`,
  };
  const scopedPrefixes = (layoutKey, profile = getActiveProfile(layoutKey)) => [
    `${prefixes.panelStorage}${profile}:${layoutKey}:`,
    `${prefixes.customPanels}${profile}:${layoutKey}`,
    `${prefixes.hiddenPanels}${profile}:${layoutKey}`,
    `${prefixes.widgetStorage}${profile}:${layoutKey}:`,
    `${prefixes.customWidgets}${profile}:${layoutKey}`,
    `${prefixes.hiddenWidgets}${profile}:${layoutKey}`,
    `${prefixes.floatingAnchors}${profile}:${layoutKey}`,
    `${prefixes.dataSources}${profile}:${layoutKey}`,
    `${prefixes.workspaceContexts}${profile}:${layoutKey}`,
    `${prefixes.workspaceAssets}${profile}:${layoutKey}`,
    `${prefixes.workspaceLogicGraph}${profile}:${layoutKey}`,
    `${prefixes.persistedWorkspace}${profile}:${layoutKey}`,
  ];
  const storageKeys = (layoutKey, profile = getActiveProfile(layoutKey)) => {
    const matchers = scopedPrefixes(layoutKey, profile);
    try {
      return Object.keys(localStorage).filter((candidate) => matchers.some((prefix) => candidate.startsWith(prefix)));
    } catch {
      return [];
    }
  };
  const clearScopedStorage = (layoutKey, profile = getActiveProfile(layoutKey)) => {
    storageKeys(layoutKey, profile).forEach((storageKey) => {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    });
  };
  const parseJsonRecord = (value, fallback = null) => {
    if (value == null || value === "") return fallback;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const readJson = (storageKey, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };
  const writeJson = (storageKey, value) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  };
  const readRaw = (storageKey, fallback = "") => {
    try {
      return localStorage.getItem(storageKey) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const writeRaw = (storageKey, value = "") => {
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {}
  };
  const remove = (storageKey) => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };
  const readDraftList = (element, draftKey) => {
    try {
      return JSON.parse(element?.dataset?.[draftKey] || "[]");
    } catch {
      return [];
    }
  };
  const writeDraftList = (element, draftKey, values) => {
    if (!element) return;
    element.dataset[draftKey] = JSON.stringify([...new Set([].concat(values || []).filter(Boolean))]);
  };
  const sanitizeElementForPersistence = (element) => {
    const clone = element.cloneNode(true);
    clone.classList.remove(...transientClasses);
    runtimeMeaningDatasetKeys.forEach((datasetKey) => delete clone.dataset[datasetKey]);
    clone.removeAttribute("aria-selected");
    clone.style.removeProperty("left");
    clone.style.removeProperty("top");
    clone.style.removeProperty("width");
    clone.querySelectorAll(".panel-settings-toggle, .panel-color-toggle, .anchor-link-toggle").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
    clone.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
    clone.querySelectorAll(".anchor-link-menu-open").forEach((menu) => menu.classList.remove("anchor-link-menu-open"));
    return clone;
  };
  const sanitizeHtml = (element) => sanitizeElementForPersistence(element).outerHTML;
  const serializeElement = (element, keyName) => ({
    key: element.dataset[keyName],
    html: sanitizeHtml(element),
    hidden: element.hidden,
  });
  const nextObjectId = (prefix = "object") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const SCOPABLE_PREFIXES = [
    "panelStorage", "customPanels", "hiddenPanels", "widgetStorage", "customWidgets",
    "hiddenWidgets", "floatingAnchors", "dataSources", "workspaceContexts",
    "workspaceAssets", "workspaceLogicGraph", "persistedWorkspace",
  ];
  const copyProfile = (layoutKey, fromProfile, toProfile) => {
    if (!fromProfile || !toProfile || fromProfile === toProfile) return;
    clearScopedStorage(layoutKey, toProfile);
    storageKeys(layoutKey, fromProfile).forEach((fromKey) => {
      for (const name of SCOPABLE_PREFIXES) {
        const globalPrefix = prefixes[name];
        const scopedFrom = `${globalPrefix}${fromProfile}:`;
        if (fromKey.startsWith(scopedFrom)) {
          const toKey = `${globalPrefix}${toProfile}:${fromKey.slice(scopedFrom.length)}`;
          try {
            const value = localStorage.getItem(fromKey);
            if (value !== null) localStorage.setItem(toKey, value);
          } catch {}
          break;
        }
      }
    });
  };

  window.dashboardLayoutPersistence = Object.freeze({
    version: PERSISTED_WORKSPACE_VERSION,
    WORKING_PROFILE,
    prefixes,
    transientClasses,
    runtimeMeaningDatasetKeys,
    getActiveProfile,
    setActiveProfile,
    copyProfile,
    key,
    scopedPrefixes,
    storageKeys,
    clearScopedStorage,
    parseJsonRecord,
    readJson,
    writeJson,
    readRaw,
    writeRaw,
    remove,
    readDraftList,
    writeDraftList,
    sanitizeElementForPersistence,
    sanitizeHtml,
    serializeElement,
    nextObjectId,
    clipboard: {
      get: () => workspaceClipboard,
      set: (value) => {
        workspaceClipboard = value || null;
        return workspaceClipboard;
      },
      clear: () => {
        workspaceClipboard = null;
      },
    },
  });
})();
