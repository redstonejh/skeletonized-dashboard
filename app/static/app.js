function showGlobalToast(message, tone = "success") {
  const stack = document.querySelector(".toast-stack");
  if (!stack) {
    console.warn(message);
    return;
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  stack.appendChild(toast);
  window.setTimeout(() => toast.classList.add("show"), 20);
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 180);
  }, 3600);
}

async function postAction(url, button) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = "Working...";
  try {
    const response = await fetch(url, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Request failed");
    showGlobalToast(payload.message + (payload.detail ? " " + JSON.stringify(payload.detail) : ""));
  } catch (error) {
    showGlobalToast(error.message, "warn");
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => postAction(button.dataset.action, button));
  });

document.querySelectorAll(".range-custom").forEach((form) => {
  const startInput = form.querySelector('input[name="start"]');
  const endInput = form.querySelector('input[name="end"]');
  const trigger = form.querySelector(".range-custom-trigger");
  const openPicker = (input) => {
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };
  trigger?.addEventListener("click", () => {
    form.dataset.pickingRange = "start";
    openPicker(startInput);
  });
  startInput?.addEventListener("change", () => {
    form.dataset.pickingRange = "end";
    window.setTimeout(() => openPicker(endInput), 120);
  });
  endInput?.addEventListener("change", () => {
    const start = startInput?.value;
    const end = endInput?.value;
    if (start && end) {
      form.classList.add("range-complete");
      form.requestSubmit();
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  let refreshWorkspaceMetaWidgets = () => {};
  const workspaceEvents = [];
  const workspaceEventListeners = new Map();
  let workspaceEventRetention = 120;
  let workspaceEventSequence = 0;
  const pendingMetaRefreshLayoutKeys = new Set();
  let workspaceMetaRefreshScheduled = false;
  const scheduleWorkspaceMetaRefresh = (layoutKey = "builder") => {
    pendingMetaRefreshLayoutKeys.add(layoutKey || "builder");
    if (workspaceMetaRefreshScheduled) return;
    workspaceMetaRefreshScheduled = true;
    requestAnimationFrame(() => {
      workspaceMetaRefreshScheduled = false;
      const keys = [...pendingMetaRefreshLayoutKeys];
      pendingMetaRefreshLayoutKeys.clear();
      keys.forEach((key) => refreshWorkspaceMetaWidgets(key));
    });
  };
  const normalizeWorkspaceEvent = (event = {}) => {
    const timestamp = Number(event.timestamp) || Date.now();
    const layoutKey = event.layoutKey || event.payload?.layoutKey || document.querySelector(".panel-layout")?.dataset.layoutKey || "builder";
    return {
      id: event.id || `workspace-event-${timestamp.toString(36)}-${(++workspaceEventSequence).toString(36)}`,
      type: String(event.type || "workspace-update"),
      timestamp,
      time: event.time || new Date(timestamp).toISOString(),
      source: event.source || "workspace",
      objectId: event.objectId || "",
      objectType: event.objectType || "",
      regionId: event.regionId || "",
      panelId: event.panelId || "",
      layoutKey,
      label: String(event.label || event.payload?.label || "Workspace updated"),
      detail: event.detail || "",
      payload: event.payload && typeof event.payload === "object" ? { ...event.payload } : {},
    };
  };
  const emitWorkspaceEvent = (event = {}) => {
    const normalized = normalizeWorkspaceEvent(event);
    workspaceEvents.unshift(normalized);
    workspaceEvents.splice(Math.max(1, workspaceEventRetention));
    const listeners = [
      ...(workspaceEventListeners.get(normalized.type) || []),
      ...(workspaceEventListeners.get("*") || []),
    ];
    listeners.forEach((listener) => {
      try {
        listener(normalized);
      } catch (error) {
        console.warn("Workspace event listener failed", error);
      }
    });
    scheduleWorkspaceMetaRefresh(normalized.layoutKey);
    return normalized;
  };
  const onWorkspaceEvent = (type, listener) => {
    if (typeof listener !== "function") return () => {};
    const key = String(type || "*");
    const listeners = workspaceEventListeners.get(key) || new Set();
    listeners.add(listener);
    workspaceEventListeners.set(key, listeners);
    return () => {
      const current = workspaceEventListeners.get(key);
      current?.delete(listener);
      if (current && current.size <= 0) workspaceEventListeners.delete(key);
    };
  };
  const recentWorkspaceEvents = (options = {}) => {
    const maxItems = Math.max(1, Math.min(100, Number(options.maxItems) || 20));
    const eventTypes = Array.isArray(options.eventTypes) ? options.eventTypes.filter(Boolean) : [];
    const layoutKey = options.layoutKey || "";
    const scope = options.scope || "workspace";
    const regionId = options.regionId || options.resolvedContext?.regionId || "";
    return workspaceEvents.filter((event) => {
      if (eventTypes.length && !eventTypes.includes(event.type)) return false;
      if (layoutKey && event.layoutKey !== layoutKey) return false;
      if (scope === "currentRegion" && regionId && event.regionId && event.regionId !== regionId) return false;
      if (scope === "currentPanel" && options.panelId && event.panelId && event.panelId !== options.panelId) return false;
      return true;
    }).slice(0, maxItems);
  };
  const activityTypeFromMessage = (message = "", tone = "info") => {
    const text = String(message || "").toLowerCase();
    if (text.includes("deleted")) return "object-deleted";
    if (text.includes("added") || text.includes("pasted")) return "object-created";
    if (text.includes("saved")) return "layout-saved";
    if (text.includes("loading layout") || text.includes("loaded")) return "layout-loaded";
    if (text.includes("undone") || text.includes("redone")) return "history";
    if (text.includes("error") || tone === "error" || tone === "warn") return "error";
    if (text.includes("engineer") || text.includes("select mode")) return "workspace-mode";
    return "workspace-update";
  };
  const recordWorkspaceActivity = (type, label, detail = {}) => {
    return emitWorkspaceEvent({
      type: type || "workspace-update",
      label,
      source: detail.source || "activity",
      objectId: detail.objectId || "",
      objectType: detail.objectType || "",
      regionId: detail.regionId || "",
      panelId: detail.panelId || "",
      layoutKey: detail.layoutKey || document.querySelector(".panel-layout")?.dataset.layoutKey || "builder",
      detail: detail.detail || detail.tone || "",
      payload: detail.payload || {},
    });
  };
  const showToast = (message, tone = "info", detail = {}) => {
    if (detail.activity !== false) {
      recordWorkspaceActivity(detail.type || activityTypeFromMessage(message, tone), message, { ...detail, tone });
    }
    showGlobalToast(message, tone);
  };
  const backgroundDefault = "frosted-light";
  const savedBackgroundTone = () => {
    try {
      return localStorage.getItem("dashboard-background") || backgroundDefault;
    } catch {
      return backgroundDefault;
    }
  };
  let previewBackgroundTone = null;
  const applyBackgroundTone = (tone = savedBackgroundTone(), options = {}) => {
    const selectedTone = options.preview ? savedBackgroundTone() : tone;
    if (tone) {
      document.documentElement.dataset.background = tone;
    } else {
      delete document.documentElement.dataset.background;
    }
    document.querySelectorAll(".background-tone-option").forEach((button) => {
      const selected = button.dataset.backgroundTone === selectedTone;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected.toString());
    });
    document.querySelectorAll(".background-tone-trigger").forEach((trigger) => {
      trigger.setAttribute("aria-label", `Workspace background: ${tone.replace(/-/g, " ")}`);
    });
  };
  const previewBackgroundOption = (button) => {
    const tone = button?.dataset?.backgroundTone || backgroundDefault;
    if (!tone) return;
    previewBackgroundTone = tone;
    applyBackgroundTone(tone, { preview: true });
  };
  const revertBackgroundPreview = () => {
    if (!previewBackgroundTone) return;
    previewBackgroundTone = null;
    applyBackgroundTone(savedBackgroundTone());
  };
  applyBackgroundTone(savedBackgroundTone());
  document.querySelectorAll(".background-tone-option").forEach((button) => {
    button.addEventListener("pointerenter", () => previewBackgroundOption(button));
    button.addEventListener("focus", () => previewBackgroundOption(button));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const tone = button.dataset.backgroundTone || backgroundDefault;
      previewBackgroundTone = null;
      try {
        localStorage.setItem("dashboard-background", tone);
      } catch {}
      applyBackgroundTone(tone);
      button.closest(".background-tone-menu")?.removeAttribute("open");
    });
  });
  document.querySelectorAll(".background-tone-menu, .appearance-control-group.background-tone-group").forEach((container) => {
    container.addEventListener("pointerleave", revertBackgroundPreview);
    container.addEventListener("focusout", (event) => {
      if (event.relatedTarget && container.contains(event.relatedTarget)) return;
      revertBackgroundPreview();
    });
  });
  document.querySelectorAll(".background-tone-menu").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) revertBackgroundPreview();
    });
  });

  let refreshWorkspaceMiniMaps = () => {};
  let refreshEngineerOverlays = () => {};
  const engineerModeListeners = new Set();
  const engineerModeState = {
    enabled: false,
    source: "initial",
    updatedAt: Date.now(),
  };
  const isEngineerMode = () => Boolean(engineerModeState.enabled);
  const syncEngineerModeDom = () => {
    document.body.classList.toggle("engineer-mode-active", engineerModeState.enabled);
    document.documentElement.dataset.engineerMode = engineerModeState.enabled ? "true" : "false";
    document.querySelectorAll(".engineer-mode-button").forEach((button) => {
      button.setAttribute("aria-pressed", String(engineerModeState.enabled));
    });
  };
  const refreshEngineerContextVisibility = () => {
    document.querySelectorAll(".panel-layout").forEach((layout) => {
      const layoutKey = layout.dataset.layoutKey || "default";
      refreshResolvedContextDebug(layoutKey, getActivePanelProfile(layoutKey));
    });
    if (!isEngineerMode()) {
      const layer = document.querySelector(".workspace-engineer-overlay-layer");
      if (layer) {
        layer.replaceChildren();
        layer.hidden = true;
      }
    }
    refreshWorkspaceMiniMaps();
    refreshEngineerOverlays();
    refreshWorkspaceMetaWidgets();
  };
  const setEngineerMode = (enabled, options = {}) => {
    const nextEnabled = Boolean(enabled);
    if (engineerModeState.enabled === nextEnabled && !options.force) return engineerModeState.enabled;
    engineerModeState.enabled = nextEnabled;
    engineerModeState.source = options.source || "api";
    engineerModeState.updatedAt = Date.now();
    syncEngineerModeDom();
    refreshEngineerContextVisibility();
    engineerModeListeners.forEach((listener) => {
      try {
        listener({ ...engineerModeState });
      } catch (error) {
        console.warn("Engineer Mode listener failed", error);
      }
    });
    if (options.toast !== false) {
      showToast(`Engineer ${nextEnabled ? "enabled" : "disabled"}.`, "info", {
        type: "engineer-mode-toggled",
        source: "engineer-mode",
        payload: { enabled: nextEnabled },
      });
    }
    return engineerModeState.enabled;
  };
  const toggleEngineerMode = () => setEngineerMode(!engineerModeState.enabled, { source: "button" });
  const onEngineerModeChange = (listener) => {
    if (typeof listener !== "function") return () => {};
    engineerModeListeners.add(listener);
    return () => engineerModeListeners.delete(listener);
  };
  syncEngineerModeDom();
  document.querySelectorAll(".workspace-mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.workspaceMode || "";
      if (mode !== "engineer") return;
      toggleEngineerMode();
    });
  });

  document.querySelectorAll(".nav-status-menu").forEach((menu) => {
    let closeTimer;
    let closeAfterAnimationTimer;
    const closeMenu = (targetMenu = menu) => {
      window.clearTimeout(closeAfterAnimationTimer);
      targetMenu.classList.remove("is-open");
      closeAfterAnimationTimer = window.setTimeout(() => {
        if (!targetMenu.classList.contains("is-open")) targetMenu.open = false;
      }, 220);
    };
    const openMenu = () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(closeAfterAnimationTimer);
      document.querySelectorAll(".nav-status-menu[open]").forEach((otherMenu) => {
        if (otherMenu !== menu) {
          otherMenu.classList.remove("is-open");
          otherMenu.open = false;
        }
      });
      menu.open = true;
      menu.classList.remove("is-open");
      void menu.offsetWidth;
      window.requestAnimationFrame(() => menu.classList.add("is-open"));
    };
    const scheduleClose = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        if (!menu.matches(":hover") && !menu.contains(document.activeElement)) closeMenu();
      }, 140);
    };
    menu.addEventListener("mouseenter", openMenu);
    menu.addEventListener("mouseleave", scheduleClose);
    menu.addEventListener("focusin", openMenu);
    menu.addEventListener("focusout", scheduleClose);
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      document.querySelectorAll(".nav-status-menu[open]").forEach((otherMenu) => {
        if (otherMenu !== menu) {
          otherMenu.classList.remove("is-open");
          otherMenu.open = false;
        }
      });
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target?.closest?.(".nav-status-menu")) return;
    document.querySelectorAll(".nav-status-menu[open]").forEach((menu) => {
      menu.classList.remove("is-open");
      menu.open = false;
    });
  });

  const refreshOverflowTitles = () => {
    const skipTags = new Set(["SCRIPT", "STYLE", "SVG", "PATH", "INPUT", "TEXTAREA", "SELECT", "OPTION"]);
    document.querySelectorAll("body *").forEach((element) => {
      if (skipTags.has(element.tagName)) return;
      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length < 2) return;
      const style = window.getComputedStyle(element);
      const canClip = style.textOverflow === "ellipsis" || style.overflow === "hidden" || style.whiteSpace === "nowrap";
      if (!canClip || !element.clientWidth) return;
      const clipped = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
      if (clipped) {
        if (!element.getAttribute("title") || element.dataset.autoTitle === "true") {
          element.setAttribute("title", text);
          element.dataset.autoTitle = "true";
        }
      } else if (element.dataset.autoTitle === "true") {
        element.removeAttribute("title");
        delete element.dataset.autoTitle;
      }
    });
  };

  let overflowTitleTimer;
  const scheduleOverflowTitles = () => {
    window.clearTimeout(overflowTitleTimer);
    overflowTitleTimer = window.setTimeout(refreshOverflowTitles, 80);
  };
  refreshOverflowTitles();
  window.addEventListener("load", scheduleOverflowTitles);
  window.addEventListener("resize", scheduleOverflowTitles);
  new MutationObserver(scheduleOverflowTitles).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const dashboardSearchForms = document.querySelectorAll(".range-search");
  const searchableItemsForPanel = (panel) => {
    const emptyStates = [...panel.querySelectorAll(".empty-state")];
    return emptyStates;
  };
  const keywordMatches = (text, terms) => {
    const haystack = String(text || "").replace(/\s+/g, " ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };
  const applyDashboardKeywordSearch = (input) => {
    const terms = String(input?.value || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    const searching = terms.length > 0;
    document.querySelectorAll(".panel-layout > .db-panel").forEach((panel) => {
      if (searching && panel.dataset.searchCollapsedBefore === undefined) {
        panel.dataset.searchCollapsedBefore = panel.classList.contains("db-panel-collapsed") ? "true" : "false";
      }
      const items = searchableItemsForPanel(panel);
      const titleText = panel.querySelector(".db-panel-title")?.textContent || "";
      const titleMatches = searching && keywordMatches(titleText, terms);
      let visibleCount = 0;
      let matchedItems = 0;

      if (!panel.dataset.originalPanelCount) {
        panel.dataset.originalPanelCount = panel.querySelector(".db-panel-count")?.textContent?.trim() || "";
      }

      if (items.length) {
        items.forEach((item) => {
          const matched = !searching || titleMatches || keywordMatches(item.textContent, terms);
          item.classList.toggle("dashboard-search-hidden", !matched);
          if (matched) matchedItems += 1;
          if (matched && !item.classList.contains("empty-state")) visibleCount += 1;
        });
      }

      const panelMatches = !searching || titleMatches || (items.length ? matchedItems > 0 : keywordMatches(panel.textContent, terms));
      panel.classList.toggle("dashboard-search-hidden", !panelMatches);
      if (searching && panelMatches) {
        panel.classList.remove("db-panel-collapsed");
        panel.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "true");
      } else if (!searching && panel.dataset.searchCollapsedBefore !== undefined) {
        const restoreCollapsed = panel.dataset.searchCollapsedBefore === "true";
        panel.classList.toggle("db-panel-collapsed", restoreCollapsed);
        panel.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", (!restoreCollapsed).toString());
        delete panel.dataset.searchCollapsedBefore;
      }

      const count = panel.querySelector(".db-panel-count");
      if (count) {
        count.textContent = searching && items.length ? String(visibleCount) : panel.dataset.originalPanelCount || count.textContent;
      }
    });
    scheduleOverflowTitles();
  };
  dashboardSearchForms.forEach((form) => {
    const input = form.querySelector(".range-search-input");
    if (!input) return;
    form.dataset.keywordSearchBound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      applyDashboardKeywordSearch(input);
    });
    input.addEventListener("input", () => applyDashboardKeywordSearch(input));
    applyDashboardKeywordSearch(input);
  });

  // Dashboard switcher dropdown
  const switcherToggle = document.getElementById("dash-switcher-toggle");
  const switcherMenu = document.getElementById("dash-switch-menu");
  if (switcherToggle && switcherMenu) {
    const switcher = switcherToggle.closest(".dash-switcher");
    let switcherCloseTimer;
    const openSwitcher = () => {
      window.clearTimeout(switcherCloseTimer);
      switcherMenu.classList.add("open");
      switcherToggle.setAttribute("aria-expanded", "true");
    };
    const closeSwitcher = () => {
      switcherMenu.classList.remove("open");
      switcherToggle.setAttribute("aria-expanded", "false");
    };
    const scheduleCloseSwitcher = () => {
      window.clearTimeout(switcherCloseTimer);
      switcherCloseTimer = window.setTimeout(closeSwitcher, 140);
    };
    switcher?.addEventListener("mouseenter", openSwitcher);
    switcher?.addEventListener("mouseleave", scheduleCloseSwitcher);
    switcherToggle.addEventListener("focus", openSwitcher);
    switcherToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      openSwitcher();
    });
    switcherMenu.addEventListener("mouseenter", openSwitcher);
    switcherMenu.addEventListener("mouseleave", scheduleCloseSwitcher);
    document.addEventListener("click", () => {
      closeSwitcher();
    });
    switcherMenu.addEventListener("click", (e) => e.stopPropagation());
  }

  if (new URLSearchParams(window.location.search).has("saved")) showToast("Settings saved.");

  const panelStoragePrefix = "dashboard-panel-six-grid-layout:";
  const panelProfilePrefix = "dashboard-panel-profile:";
  const customPanelsPrefix = "dashboard-custom-panels:";
  const hiddenPanelsPrefix = "dashboard-hidden-panels:";
  const widgetStoragePrefix = "dashboard-widget-six-grid-layout:";
  const customWidgetsPrefix = "dashboard-custom-six-grid-widgets:";
  const hiddenWidgetsPrefix = "dashboard-hidden-six-grid-widgets:";
  const floatingAnchorsPrefix = "dashboard-floating-anchors:";
  const dataSourcesPrefix = "dashboard-data-sources:";
  const workspaceContextsPrefix = "dashboard-workspace-contexts:";
  const workspaceAssetsPrefix = "dashboard-assets:";
  const workspaceLogicGraphPrefix = "dashboard-workspace-logic-graph:";
  const persistedWorkspacePrefix = "dashboard-persisted-workspace:";
  const layoutUndoPrefix = "dashboard-layout-undo:";
  const PERSISTED_WORKSPACE_VERSION = 1;
  const getActivePanelProfile = (layoutKey) => {
    try {
      return localStorage.getItem(`${panelProfilePrefix}${layoutKey}`) || "1";
    } catch {
      return "1";
    }
  };
  const panelStorageKey = (layoutKey, key, profile = getActivePanelProfile(layoutKey)) => {
    return `${panelStoragePrefix}${profile}:${layoutKey}:${key}`;
  };
  const customPanelsKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    return `${customPanelsPrefix}${profile}:${layoutKey}`;
  };
  const hiddenPanelsKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    return `${hiddenPanelsPrefix}${profile}:${layoutKey}`;
  };
  const widgetStorageKey = (layoutKey, key, profile = getActivePanelProfile(layoutKey)) => {
    return `${widgetStoragePrefix}${profile}:${layoutKey}:${key}`;
  };
  const customWidgetsKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    return `${customWidgetsPrefix}${profile}:${layoutKey}`;
  };
  const hiddenWidgetsKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    return `${hiddenWidgetsPrefix}${profile}:${layoutKey}`;
  };
  const floatingAnchorsKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${floatingAnchorsPrefix}${profile}:${layoutKey}`;
  const dataSourcesKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${dataSourcesPrefix}${profile}:${layoutKey}`;
  const workspaceContextsKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${workspaceContextsPrefix}${profile}:${layoutKey}`;
  const workspaceAssetsKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${workspaceAssetsPrefix}${profile}:${layoutKey}`;
  const workspaceLogicGraphKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${workspaceLogicGraphPrefix}${profile}:${layoutKey}`;
  const persistedWorkspaceKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${persistedWorkspacePrefix}${profile}:${layoutKey}`;
  const layoutUndoKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${layoutUndoPrefix}${profile}:${layoutKey}`;
  let layoutUndoCaptureLock = false;
  const layoutScopedPrefixes = (layoutKey, profile = getActivePanelProfile(layoutKey)) => [
    `${panelStoragePrefix}${profile}:${layoutKey}:`,
    `${customPanelsPrefix}${profile}:${layoutKey}`,
    `${hiddenPanelsPrefix}${profile}:${layoutKey}`,
    `${widgetStoragePrefix}${profile}:${layoutKey}:`,
    `${customWidgetsPrefix}${profile}:${layoutKey}`,
    `${hiddenWidgetsPrefix}${profile}:${layoutKey}`,
    `${floatingAnchorsPrefix}${profile}:${layoutKey}`,
    `${dataSourcesPrefix}${profile}:${layoutKey}`,
    `${workspaceContextsPrefix}${profile}:${layoutKey}`,
    `${workspaceAssetsPrefix}${profile}:${layoutKey}`,
    `${workspaceLogicGraphPrefix}${profile}:${layoutKey}`,
    `${persistedWorkspacePrefix}${profile}:${layoutKey}`,
  ];
  const layoutStorageKeys = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    const prefixes = layoutScopedPrefixes(layoutKey, profile);
    try {
      return Object.keys(localStorage).filter((key) => prefixes.some((prefix) => key.startsWith(prefix)));
    } catch {
      return [];
    }
  };
  const readDraftList = (element, key) => {
    try {
      return JSON.parse(element?.dataset?.[key] || "[]");
    } catch {
      return [];
    }
  };
  const writeDraftList = (element, key, values) => {
    if (!element) return;
    element.dataset[key] = JSON.stringify([...new Set(values.filter(Boolean))]);
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
  const readJsonStore = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };
  const writeJsonStore = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  const assetId = () => `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const mediaWidgetAssetTypes = new Set(["image", "video", "document"]);
  const mimeTypeFromSource = (source = "") => {
    const text = String(source || "");
    const dataMatch = text.match(/^data:([^;,]+)/i);
    if (dataMatch) return dataMatch[1].toLowerCase();
    const path = text.split(/[?#]/)[0].toLowerCase();
    if (path.endsWith(".svg")) return "image/svg+xml";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    if (path.endsWith(".gif")) return "image/gif";
    if (path.endsWith(".webp")) return "image/webp";
    if (path.endsWith(".mp4")) return "video/mp4";
    if (path.endsWith(".webm")) return "video/webm";
    if (path.endsWith(".mov")) return "video/quicktime";
    if (path.endsWith(".pdf")) return "application/pdf";
    if (path.endsWith(".md") || path.endsWith(".markdown")) return "text/markdown";
    if (path.endsWith(".txt")) return "text/plain";
    if (path.endsWith(".html") || path.endsWith(".htm")) return "text/html";
    return "";
  };
  const assetTypeFromMime = (mimeType = "", fallback = "document") => {
    const mime = String(mimeType || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    return fallback || "document";
  };
  const assetSourceKind = (source = "") => {
    const text = String(source || "");
    if (text.startsWith("blob:")) return "blob-url";
    if (text.startsWith("data:")) return "data-url";
    if (/^https?:\/\//i.test(text) || text.startsWith("/") || text.startsWith("./") || text.startsWith("../")) return "url";
    return "reference";
  };
  const normalizeAssetRecord = (asset = {}) => {
    const source = typeof asset.source === "object" && asset.source
      ? asset.source
      : { kind: assetSourceKind(asset.src || asset.url || asset.ref || ""), ref: asset.src || asset.url || asset.ref || "" };
    const mimeType = String(asset.mimeType || mimeTypeFromSource(source.ref) || "").toLowerCase();
    const type = String(asset.type || asset.kind || assetTypeFromMime(mimeType, "document")).toLowerCase();
    return {
      id: String(asset.id || assetId()),
      name: String(asset.name || source.name || "Untitled asset"),
      type: mediaWidgetAssetTypes.has(type) ? type : "document",
      mimeType,
      size: Number(asset.size) || (source.ref ? String(source.ref).length : 0),
      createdAt: String(asset.createdAt || new Date().toISOString()),
      source: {
        kind: String(source.kind || assetSourceKind(source.ref)),
        ref: String(source.ref || ""),
      },
      thumbnailRef: asset.thumbnailRef || asset.thumbnail || "",
      previewRef: asset.previewRef || asset.preview || "",
    };
  };
  const loadAssets = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
    readJsonStore(workspaceAssetsKey(layoutKey, profile), []).map(normalizeAssetRecord).filter((asset) => asset.id);
  const saveAssets = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey), assets = []) =>
    writeJsonStore(workspaceAssetsKey(layoutKey, profile), assets.map(normalizeAssetRecord).filter((asset) => asset.id));
  const assetById = (layoutKey, profile, id) => loadAssets(layoutKey, profile).find((asset) => asset.id === id) || null;
  const findAssetBySource = (layoutKey, profile, sourceRef) => {
    const ref = String(sourceRef || "");
    if (!ref) return null;
    return loadAssets(layoutKey, profile).find((asset) => asset.source?.ref === ref) || null;
  };
  const registerAsset = (layoutKey = "builder", asset = {}, profile = getActivePanelProfile(layoutKey)) => {
    const normalized = normalizeAssetRecord(asset);
    const assets = loadAssets(layoutKey, profile);
    const existingIndex = assets.findIndex((entry) => entry.id === normalized.id);
    const nextAssets = existingIndex >= 0
      ? assets.map((entry, index) => index === existingIndex ? { ...entry, ...normalized, id: entry.id } : entry)
      : [...assets, normalized];
    saveAssets(layoutKey, profile, nextAssets);
    return existingIndex >= 0 ? nextAssets[existingIndex] : normalized;
  };
  const createAssetFromSource = (layoutKey = "builder", sourceRef = "", options = {}, profile = getActivePanelProfile(layoutKey)) => {
    const ref = String(sourceRef || "").trim();
    if (!ref) return null;
    const existing = findAssetBySource(layoutKey, profile, ref);
    if (existing) return existing;
    const mimeType = options.mimeType || mimeTypeFromSource(ref);
    return registerAsset(layoutKey, {
      id: options.id || assetId(),
      name: options.name || ref.split(/[\\/]/).pop()?.split(/[?#]/)[0] || "Asset",
      type: options.type || assetTypeFromMime(mimeType, options.type || "document"),
      mimeType,
      size: options.size || ref.length,
      createdAt: options.createdAt,
      source: { kind: options.sourceKind || assetSourceKind(ref), ref },
      thumbnailRef: options.thumbnailRef || "",
      previewRef: options.previewRef || "",
    }, profile);
  };
  const assetSourceRef = (asset) => String(asset?.source?.ref || asset?.previewRef || asset?.thumbnailRef || "");
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
  const syncLayoutToolsActive = () => {
    const hasOpenTools = Boolean(document.querySelector(".db-panel-tools-open, .widget-tools-open, .widget-workbench-open"));
    document.body.classList.toggle("layout-tools-active", hasOpenTools);
  };
  const isDashboardInteractionActive = () => (
    document.body.classList.contains("panel-interaction-active") ||
    document.body.classList.contains("panel-resize-active") ||
    document.body.classList.contains("anchor-rail-drag-active") ||
    document.body.classList.contains("workspace-wire-drag-active")
  );
  const isInteractionSource = (item) => Boolean(item?.classList?.contains("widget-dragging") ||
    item?.classList?.contains("db-panel-dragging") ||
    item?.classList?.contains("dashboard-active-resize"));
  const canOpenDashboardTools = (item) => !isDashboardInteractionActive() || isInteractionSource(item);
  const dashboardSettingsToggleForItem = (item) => {
    if (item?.classList?.contains("db-panel")) return item.querySelector(":scope > .db-panel-hd .panel-settings-toggle");
    if (item?.classList?.contains("widget-card")) return item.querySelector(":scope > .widget-tools .panel-settings-toggle");
    return item?.querySelector?.(".panel-settings-toggle") || null;
  };
  const dashboardColorToggleForItem = (item) => {
    if (item?.classList?.contains("db-panel")) return item.querySelector(":scope > .db-panel-hd .panel-color-toggle");
    if (item?.classList?.contains("widget-card")) return item.querySelector(":scope > .widget-tools .panel-color-toggle");
    return item?.querySelector?.(".panel-color-toggle") || null;
  };
  const closeInactiveDashboardTools = (activeItem = null) => {
    document.querySelectorAll(".widget-tools-open, .widget-workbench-open, .db-panel-tools-open").forEach((item) => {
      if (item === activeItem) return;
      item.classList.remove("widget-tools-open", "widget-settings-schema-open", "widget-workbench-open", "db-panel-tools-open");
      dashboardSettingsToggleForItem(item)?.setAttribute("aria-expanded", "false");
      dashboardColorToggleForItem(item)?.setAttribute("aria-expanded", "false");
      item.querySelector?.(":scope > .widget-tools .widget-settings-schema-panel")?.setAttribute("hidden", "");
      item.querySelector?.(":scope > .widget-tools .widget-workbench-panel")?.setAttribute("hidden", "");
      setWidgetLinkNavigationSuspended(item, false);
    });
    document.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
    syncLayoutToolsActive();
  };
  const isDashboardToolInteractionTarget = (event) =>
    Boolean(event?.target?.closest?.(".panel-tool-drawer, .panel-settings-toggle, .widget-workbench-panel"));
  document.addEventListener("pointerdown", (event) => {
    if (isDashboardInteractionActive()) return;
    if (event.target?.closest?.(".panel-tool-drawer, .panel-settings-toggle, .panel-color-menu, .widget-settings-schema-panel, .widget-workbench-panel")) return;
    closeInactiveDashboardTools();
  }, true);
  let groupMode = false;
  const groupSelection = new Set();
  const groupSelectedIds = new Set();
  const groupItemKind = (item) => item?.classList?.contains("widget-card") ? "widget" : "panel";
  const groupItemLayout = (item) => item?.closest?.(".widget-layout, .panel-layout");
  const groupItemLayoutKey = (item) => {
    const layout = groupItemLayout(item);
    return layout?.dataset.widgetLayoutKey || layout?.dataset.layoutKey || "default";
  };
  const groupItemId = (item) => {
    if (!item) return "";
    const key = groupItemKind(item) === "widget" ? item.dataset.widgetKey : item.dataset.panelKey;
    return key ? `${groupItemKind(item)}:${groupItemLayoutKey(item)}:${key}` : "";
  };
  const selectedGroupItems = (kind, layoutKey) => [...groupSelection].filter((item) => {
    if (!item?.isConnected || item.hidden) return false;
    if (kind && groupItemKind(item) !== kind) return false;
    if (layoutKey && groupItemLayoutKey(item) !== layoutKey) return false;
    return true;
  });
  const setGroupItemSelected = (item, selected) => {
    const id = groupItemId(item);
    if (!id) return;
    item.classList.toggle("group-selected", selected);
    item.setAttribute("aria-selected", selected.toString());
    if (selected) {
      groupSelection.add(item);
      groupSelectedIds.add(id);
    } else {
      groupSelection.delete(item);
      groupSelectedIds.delete(id);
    }
  };
  const restoreGroupSelection = () => {
    groupSelection.clear();
    document.querySelectorAll(".widget-layout > .widget-card, .panel-layout > .db-panel").forEach((item) => {
      const selected = groupSelectedIds.has(groupItemId(item));
      item.classList.toggle("group-selected", selected);
      if (selected) {
        item.setAttribute("aria-selected", "true");
        groupSelection.add(item);
      } else if (!item.classList.contains("active")) {
        item.removeAttribute("aria-selected");
      }
    });
  };
  const clearGroupSelection = () => {
    groupSelection.forEach((item) => {
      item.classList.remove("group-selected");
      if (!item.classList.contains("active")) item.removeAttribute("aria-selected");
    });
    groupSelection.clear();
    groupSelectedIds.clear();
  };
  const syncGroupButtons = () => {
    document.body.classList.toggle("group-select-active", groupMode);
    document.querySelectorAll(".layout-group-button").forEach((button) => {
      button.setAttribute("aria-pressed", groupMode.toString());
    });
  };
  const setGroupMode = (enabled) => {
    groupMode = Boolean(enabled);
    if (!groupMode) clearGroupSelection();
    syncGroupButtons();
  };
  const toggleGroupItem = (item) => {
    if (!item) return;
    setGroupItemSelected(item, !groupSelectedIds.has(groupItemId(item)));
  };
  const groupPeers = (source, kind = groupItemKind(source)) => {
    if (!source?.classList?.contains("group-selected")) return [];
    const layoutKey = groupItemLayoutKey(source);
    return selectedGroupItems(kind, layoutKey).filter((item) => item !== source);
  };
  const groupTransformItems = (source, options = {}) => {
    if (!source?.classList?.contains("group-selected")) return [source].filter(Boolean);
    const layoutKey = groupItemLayoutKey(source);
    const includePinned = Boolean(options.includePinned);
    const includeLocked = Boolean(options.includeLocked);
    return selectedGroupItems(null, layoutKey)
      .filter((item) => item?.isConnected && !item.hidden)
      .filter((item) => includePinned || !item.classList.contains("db-panel-pinned"))
      .filter((item) => includeLocked || item.dataset.locked !== "true");
  };
  let workspaceObjectClipboard = null;
  const liveLayoutUndo = new Map();
  const liveLayoutRedo = new Map();
  const liveLayoutUndoKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${profile}:${layoutKey}`;
  const undoTransientItemClasses = [
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
  ];
  const sanitizeLayoutElementForUndo = (element) => {
    const clone = element.cloneNode(true);
    clone.classList.remove(...undoTransientItemClasses);
    clone.removeAttribute("aria-selected");
    clone.style.removeProperty("left");
    clone.style.removeProperty("top");
    clone.style.removeProperty("width");
    clone.querySelectorAll(".panel-settings-toggle, .panel-color-toggle, .anchor-link-toggle").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
    clone.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
    clone.querySelectorAll(".anchor-link-menu-open").forEach((menu) => menu.classList.remove("anchor-link-menu-open"));
    return clone.outerHTML;
  };
  const serializeLayoutElement = (element, keyName) => ({
    key: element.dataset[keyName],
    html: sanitizeLayoutElementForUndo(element),
    hidden: element.hidden,
  });
  const captureLiveLayoutState = (layoutKey, profile = getActivePanelProfile(layoutKey)) => ({
    panels: [...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`)].map((layout) => ({
      selector: `.panel-layout[data-layout-key="${CSS.escape(layout.dataset.layoutKey || layoutKey)}"]`,
      hiddenDraft: layout.dataset.hiddenPanelsDraft || "[]",
      items: [...layout.querySelectorAll(":scope > .db-panel, :scope > .db-panel-row-break")].map((item) => (
        item.classList.contains("db-panel-row-break")
          ? { rowBreak: true, html: item.outerHTML }
          : serializeLayoutElement(item, "panelKey")
      )),
    })),
    widgets: [...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`)].map((layout) => ({
      selector: `.widget-layout[data-widget-layout-key="${CSS.escape(layout.dataset.widgetLayoutKey || layoutKey)}"]`,
      hiddenDraft: layout.dataset.hiddenWidgetsDraft || "[]",
      items: [...layout.querySelectorAll(":scope > .widget-card, :scope > .widget-row-break, :scope > .widget-spacer")].map((item) => (
        item.classList.contains("widget-row-break")
          ? { rowBreak: true, html: item.outerHTML }
          : item.classList.contains("widget-spacer")
            ? { spacer: true, html: item.outerHTML }
          : serializeLayoutElement(item, "widgetKey")
      )),
    })),
    anchors: [...document.querySelectorAll(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"]`)].map((layer) => ({
      selector: `.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layer.dataset.anchorLayoutKey || layoutKey)}"]`,
      items: [...layer.querySelectorAll(":scope > .workspace-anchor-object:not(.workspace-anchor-drag-ghost)")].map((item) => (
        serializeLayoutElement(item, "anchorKey")
      )),
    })),
    dataSources: localStorage.getItem(dataSourcesKey(layoutKey, profile)) || "[]",
    workspaceContexts: localStorage.getItem(workspaceContextsKey(layoutKey, profile)) || "[]",
    workspaceLogicGraph: localStorage.getItem(workspaceLogicGraphKey(layoutKey, profile)) || "",
    profile,
  });
  const liveLayoutUndoSignature = (snapshot) => JSON.stringify({
    panels: snapshot.panels,
    widgets: snapshot.widgets,
    anchors: snapshot.anchors,
    dataSources: snapshot.dataSources,
    workspaceContexts: snapshot.workspaceContexts,
    workspaceLogicGraph: snapshot.workspaceLogicGraph,
    profile: snapshot.profile,
  });
  const pushLiveLayoutUndo = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    const key = liveLayoutUndoKey(layoutKey, profile);
    const stack = liveLayoutUndo.get(key) || [];
    const snapshot = captureLiveLayoutState(layoutKey, profile);
    const signature = liveLayoutUndoSignature(snapshot);
    if (stack[stack.length - 1]?.signature === signature) return false;
    stack.push({ ...snapshot, signature });
    if (stack.length > 12) stack.shift();
    liveLayoutUndo.set(key, stack);
    liveLayoutRedo.delete(key);
    return true;
  };
  const cleanupDashboardUndoArtifacts = () => {
    document.querySelectorAll(
      ".dashboard-live-resize, .dashboard-resize-preview, .dashboard-expanded-footprint-ghost, .dashboard-group-boundary, .dashboard-group-member-preview, .widget-placeholder, .db-panel-placeholder, .workspace-anchor-drag-ghost, .workspace-anchor-rail-placeholder"
    ).forEach((node) => {
      if (!node.isConnected) return;
      try {
        node.remove();
      } catch {
        try {
          node.parentNode?.removeChild?.(node);
        } catch {
          // Interaction cleanup is best-effort; stale preview nodes may already be gone.
        }
      }
    });
    document.body.classList.remove(
      "panel-interaction-active",
      "panel-resize-active",
      "group-transform-active",
      "dashboard-auto-scroll-active",
      "dashboard-interaction-scroll-extended",
      "anchor-rail-drag-active"
    );
    document.body.style.removeProperty("padding-bottom");
    document.documentElement.style.removeProperty("overflow-anchor");
    document.body.style.removeProperty("overflow-anchor");
    document.documentElement.style.removeProperty("overscroll-behavior-y");
    document.body.style.removeProperty("overscroll-behavior-y");
    document.documentElement.style.removeProperty("scroll-behavior");
    document.querySelectorAll(".dashboard-layout-grid").forEach((host) => host.style.removeProperty("overflow-anchor"));
    document.querySelectorAll(".dashboard-active-resize, .dashboard-resize-source, .group-transform-member").forEach((item) => {
      item.classList.remove("dashboard-active-resize", "dashboard-resize-source", "group-transform-member");
    });
    document.querySelectorAll(".anchor-rail-source, .anchor-dragging, .anchor-rail-previewing").forEach((item) => {
      item.classList.remove("anchor-rail-source", "anchor-dragging", "anchor-rail-previewing");
      item.style.removeProperty("--anchor-drag-x");
    });
  };
  const restoreLayoutItems = (layout, items, initItem) => {
    layout.replaceChildren();
    items.forEach((item) => {
      const template = document.createElement("template");
      template.innerHTML = item.html;
      const element = template.content.firstElementChild;
      if (!element) return;
      if (!item.rowBreak && !item.spacer) element.hidden = Boolean(item.hidden);
      delete element.dataset.panelInitialized;
      delete element.dataset.widgetInitialized;
      element.classList.remove(...undoTransientItemClasses);
      layout.appendChild(element);
      if (!item.rowBreak && !item.spacer) initItem?.(element);
    });
  };
  const restoreAnchorItems = (layer, items) => {
    layer.replaceChildren();
    items.forEach((item) => {
      const template = document.createElement("template");
      template.innerHTML = item.html;
      const anchor = template.content.firstElementChild;
      if (!anchor) return;
      anchor.hidden = Boolean(item.hidden);
      delete anchor.dataset.anchorInitialized;
      anchor.classList.remove(...undoTransientItemClasses);
      layer.appendChild(anchor);
      syncAnchorNavigationTarget(anchor);
      initFloatingAnchor(anchor, layer);
    });
    normalizeAnchorLayer(layer);
  };
  const restoreLiveLayoutSnapshot = (snapshot) => {
    cleanupDashboardUndoArtifacts();
    const layoutKeyForSnapshot = snapshot.panels?.[0]?.selector?.match(/data-layout-key="([^"]+)"/)?.[1] ||
      snapshot.widgets?.[0]?.selector?.match(/data-widget-layout-key="([^"]+)"/)?.[1] ||
      "builder";
    if (snapshot.dataSources != null) localStorage.setItem(dataSourcesKey(layoutKeyForSnapshot, snapshot.profile), snapshot.dataSources);
    if (snapshot.workspaceContexts != null) localStorage.setItem(workspaceContextsKey(layoutKeyForSnapshot, snapshot.profile), snapshot.workspaceContexts);
    if (snapshot.workspaceLogicGraph != null) {
      if (snapshot.workspaceLogicGraph) localStorage.setItem(workspaceLogicGraphKey(layoutKeyForSnapshot, snapshot.profile), snapshot.workspaceLogicGraph);
      else localStorage.removeItem(workspaceLogicGraphKey(layoutKeyForSnapshot, snapshot.profile));
    }
    snapshot.widgets?.forEach((widgetSnapshot) => {
      const layout = document.querySelector(widgetSnapshot.selector);
      if (!layout) return;
      layout.dataset.hiddenWidgetsDraft = widgetSnapshot.hiddenDraft;
      restoreLayoutItems(layout, widgetSnapshot.items, layout.__initWidget);
      cleanupWidgetRowBreaks(layout);
    });
    snapshot.panels?.forEach((panelSnapshot) => {
      const layout = document.querySelector(panelSnapshot.selector);
      if (!layout) return;
      layout.dataset.hiddenPanelsDraft = panelSnapshot.hiddenDraft;
      restoreLayoutItems(layout, panelSnapshot.items, layout.__initPanel);
      cleanupPanelRowBreaks(layout);
    });
    snapshot.anchors?.forEach((anchorSnapshot) => {
      const layer = document.querySelector(anchorSnapshot.selector);
      if (!layer) return;
      restoreAnchorItems(layer, anchorSnapshot.items);
    });
    restoreGroupSelection();
    refreshResolvedContextDebug(layoutKeyForSnapshot, snapshot.profile);
    refreshEngineerOverlays();
    syncLayoutToolsActive();
    cleanupDashboardUndoArtifacts();
  };
  const captureLayoutUndo = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    if (layoutUndoCaptureLock) return;
    layoutUndoCaptureLock = true;
    window.setTimeout(() => {
      layoutUndoCaptureLock = false;
    }, 250);
    try {
      const snapshot = {};
      layoutStorageKeys(layoutKey, profile).forEach((key) => {
        snapshot[key] = localStorage.getItem(key);
      });
      localStorage.setItem(layoutUndoKey(layoutKey, profile), JSON.stringify({ layoutKey, profile, snapshot }));
    } catch {}
  };
  const restoreLayoutUndo = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    const liveKey = liveLayoutUndoKey(layoutKey, profile);
    const stack = liveLayoutUndo.get(liveKey) || [];
    if (stack.length > 1) {
      const current = stack.pop();
      const redoStack = liveLayoutRedo.get(liveKey) || [];
      redoStack.push(current);
      liveLayoutRedo.set(liveKey, redoStack);
      restoreLiveLayoutSnapshot(stack[stack.length - 1]);
      liveLayoutUndo.set(liveKey, stack);
      return true;
    }
    return false;
  };
  const restoreLayoutRedo = (layoutKey, profile = getActivePanelProfile(layoutKey)) => {
    const liveKey = liveLayoutUndoKey(layoutKey, profile);
    const redoStack = liveLayoutRedo.get(liveKey) || [];
    const redo = redoStack.pop();
    if (!redo) return false;
    const stack = liveLayoutUndo.get(liveKey) || [];
    stack.push(redo);
    if (stack.length > 12) stack.shift();
    liveLayoutUndo.set(liveKey, stack);
    liveLayoutRedo.set(liveKey, redoStack);
    restoreLiveLayoutSnapshot(redo);
    return true;
  };
  const panelDeleteDialog = document.getElementById("panel-delete-dialog");
  const panelDeleteMessage = document.getElementById("panel-delete-message");
  const panelDeleteConfirm = panelDeleteDialog?.querySelector(".confirm-dialog-danger");
  const panelDeleteCancel = panelDeleteDialog?.querySelector(".confirm-dialog-cancel");
  const panelDeleteClose = panelDeleteDialog?.querySelector(".confirm-dialog-close");
  let pendingPanelDelete = null;
  const closePanelDeleteDialog = () => {
    pendingPanelDelete = null;
    panelDeleteDialog?.close();
  };
  const workspaceDeleteKind = (item) => {
    if (item?.classList?.contains("workspace-anchor-object")) return "anchor";
    if (item?.dataset?.workspaceObjectType === "divider" || item?.classList?.contains("workspace-divider")) return "divider";
    if (item?.classList?.contains("widget-card")) return "widget";
    if (item?.classList?.contains("db-panel")) return "panel";
    return "";
  };
  const workspaceDeleteLayout = (item) => item?.closest?.(".widget-layout, .panel-layout, .workspace-anchor-layer");
  const workspaceDeleteLayoutKey = (item) => {
    const layout = workspaceDeleteLayout(item);
    if (isPanelInternalWidgetLayout(layout)) return gridItemLayoutKey(layout);
    return layout?.dataset.widgetLayoutKey || layout?.dataset.layoutKey || layout?.dataset.anchorLayoutKey || "default";
  };
  const workspaceDeleteTitle = (item) => {
    const kind = workspaceDeleteKind(item);
    if (kind === "anchor") return item.querySelector(".workspace-anchor-label")?.textContent?.trim() || item.dataset.anchorTitle || "Anchor";
    if (kind === "widget") return item.dataset.panelTitle || item.querySelector(".stat-lbl")?.textContent?.trim() || "Widget";
    return item.dataset.panelTitle || item.querySelector(".db-panel-title")?.textContent?.trim() || (kind === "divider" ? "Divider" : "Panel");
  };
  const workspaceDeleteId = (item) => {
    const kind = workspaceDeleteKind(item);
    const key = kind === "anchor" ? item?.dataset?.anchorKey : kind === "widget" ? item?.dataset?.widgetKey : item?.dataset?.panelKey;
    return key ? `${workspaceDeleteLayoutKey(item)}:${kind}:${key}` : "";
  };
  const defaultColorForWorkspaceObject = (item) =>
    item?.querySelector?.(".panel-color-toggle")?.dataset.defaultTheme || "";
  const normalizedColor = (color) => String(color || "").trim().toLowerCase();
  const hasCustomWorkspaceColor = (item) => {
    const current = normalizedColor(item?.dataset?.panelColor);
    const fallback = normalizedColor(defaultColorForWorkspaceObject(item));
    return Boolean(current && fallback && current !== fallback);
  };
  const hasRenamedWorkspaceObject = (item) => {
    const kind = workspaceDeleteKind(item);
    if (kind === "anchor") return Boolean(item?.dataset?.anchorTitleEdited === "true");
    const title = item?.dataset?.panelTitle;
    if (!title) return false;
    const defaultTitle = item?.dataset?.defaultTitle || "";
    return !defaultTitle || title.trim() !== defaultTitle.trim();
  };
  const panelHasConfiguredContent = (panel) => {
    if (!panel || workspaceDeleteKind(panel) === "divider") return false;
    const body = panel.querySelector(":scope > .db-panel-body");
    if (!body || body.hidden) return false;
    return [...body.children].some((child) => {
      if (child.classList.contains("empty-state") || child.dataset.panelPlaceholder === "empty") return false;
      if (child.classList.contains("panel-internal-widget-grid")) return Boolean(child.querySelector(":scope > .widget-card"));
      return !child.hidden && child.textContent.trim();
    });
  };
  const widgetHasConfiguredContent = (widget) => {
    if (!widget) return false;
    const config = parseJsonRecord(widget.dataset.widgetConfig, {}) || {};
    let defaultConfig = {};
    try {
      const definition = widgetDefinitionForElement(widget);
      defaultConfig = typeof definition.getDefaultConfig === "function" ? definition.getDefaultConfig() : {};
    } catch {}
    const meaningfulConfig = Object.entries(config).some(([key, value]) => {
      if (value == null || value === "" || value === false) return false;
      if (key === "value" && String(value).trim() === "0") return false;
      const defaultValue = defaultConfig[key];
      if (JSON.stringify(value) === JSON.stringify(defaultValue)) return false;
      if ((key === "title" || key === "label") && value === (widget.dataset.defaultTitle || widget.querySelector(".stat-lbl")?.textContent?.trim())) return false;
      if (key === "title" && /^widget\s+\d+$/i.test(String(value).trim())) return false;
      return true;
    });
    if (meaningfulConfig) return true;
    if (widget.dataset.dataSource || widget.dataset.filterConfig || widget.dataset.searchConfig) return true;
    const searchValue = widget.querySelector(".search-widget-input")?.value?.trim();
    if (searchValue) return true;
    if (widget.dataset.widgetDefinition) return false;
    const value = widget.querySelector(".stat-val")?.textContent?.trim();
    if (value && value !== "0" && widget.dataset.widgetType !== "controls") return true;
    return false;
  };
  const dividerHasConfiguredContext = (divider) => {
    if (!divider) return false;
    return Boolean(
      divider.dataset.regionConfig ||
      divider.dataset.contextConfig ||
      divider.dataset.contextLabel ||
      divider.dataset.contextDescription
    );
  };
  const workspaceObjectHasMeaningfulChanges = (item) => {
    const kind = workspaceDeleteKind(item);
    if (!kind) return true;
    if (hasRenamedWorkspaceObject(item) || hasCustomWorkspaceColor(item)) return true;
    if (kind === "anchor") return Boolean(item.dataset.linkedDividerId);
    if (kind === "divider") return dividerHasConfiguredContext(item);
    if (kind === "panel") return panelHasConfiguredContent(item);
    if (kind === "widget") return widgetHasConfiguredContent(item);
    return true;
  };
  const workspaceDeleteEntries = (targets) => {
    const seen = new Set();
    return [].concat(targets || [])
      .filter((item) => item?.isConnected && !item.hidden)
      .map((item) => ({ item, id: workspaceDeleteId(item), kind: workspaceDeleteKind(item), layout: workspaceDeleteLayout(item), layoutKey: workspaceDeleteLayoutKey(item), title: workspaceDeleteTitle(item) }))
      .filter((entry) => entry.id && entry.kind && entry.layout && !seen.has(entry.id) && seen.add(entry.id));
  };
  const describeWorkspaceDeleteTargets = (entries) => {
    if (entries.length > 1) return `${entries.length} selected objects`;
    const entry = entries[0];
    return `"${entry?.title || "this"}" ${entry?.kind || "object"}`;
  };
  const saveWorkspaceDeleteLayouts = (entries) => {
    const touched = new Map();
    entries.forEach((entry) => {
      if (entry.kind === "anchor") {
        normalizeAnchorLayer(entry.layout);
        touched.set(`${entry.layoutKey}:anchor`, { layoutKey: entry.layoutKey, profile: getActivePanelProfile(entry.layoutKey) });
      } else if (entry.kind === "widget") {
        cleanupWidgetRowBreaks(entry.layout);
        saveWidgetLayouts(entry.layout, getActivePanelProfile(entry.layoutKey), { history: false });
        touched.set(`${entry.layoutKey}:grid`, { layoutKey: entry.layoutKey, profile: getActivePanelProfile(entry.layoutKey) });
      } else {
        cleanupPanelRowBreaks(entry.layout);
        savePanelLayouts(entry.layout, getActivePanelProfile(entry.layoutKey), { history: false });
        touched.set(`${entry.layoutKey}:grid`, { layoutKey: entry.layoutKey, profile: getActivePanelProfile(entry.layoutKey) });
      }
    });
    [...new Map([...touched.values()].map((value) => [`${value.profile}:${value.layoutKey}`, value])).values()]
      .forEach(({ layoutKey, profile }) => pushLiveLayoutUndo(layoutKey, profile));
  };
  const clearWorkspaceDeleteInteractionState = (entries) => {
    entries.forEach((entry) => {
      entry.item.classList.remove("widget-tools-open", "db-panel-tools-open", "group-selected");
      dashboardSettingsToggleForItem(entry.item)?.setAttribute("aria-expanded", "false");
      dashboardColorToggleForItem(entry.item)?.setAttribute("aria-expanded", "false");
      entry.item.querySelectorAll?.(".panel-color-menu-open, .anchor-link-menu-open").forEach((menu) => {
        menu.classList.remove("panel-color-menu-open", "anchor-link-menu-open");
      });
      groupSelection.delete(entry.item);
      groupSelectedIds.delete(groupItemId(entry.item));
    });
    closeInactiveDashboardTools();
    syncLayoutToolsActive();
  };
  const performWorkspaceObjectDelete = (entries) => {
    clearWorkspaceDeleteInteractionState(entries);
    const hiddenByLayout = new Map();
    removeAnchorsWithRailReflow(entries);
    const extractedByLayout = new Map();
    const extractPanelChildrenBeforeDelete = (entry) => {
      if (entry.kind !== "panel") return;
      const panel = entry.item;
      const children = panelChildWidgets(panel);
      if (!children.length) return;
      const targetLayout = entry.layout?.closest?.(".dashboard-layout-grid")
        ?.querySelector?.(`.widget-layout[data-widget-layout-key="${CSS.escape(entry.layoutKey || "default")}"]`);
      if (!targetLayout) return;
      const panelBounds = gridBoundsForItem(panel);
      let hidden = readDraftList(targetLayout, "hiddenWidgetsDraft");
      children.forEach((child, index) => {
        const key = child.dataset.widgetKey || "";
        const localBounds = gridBoundsForItem(child);
        if (key) hidden = hidden.filter((hiddenKey) => hiddenKey !== key);
        child.classList.remove(...undoTransientItemClasses);
        delete child.dataset.panelChildWidget;
        delete child.dataset.parentPanelKey;
        delete child.dataset.widgetInitialized;
        child.removeAttribute("hidden");
        child.style.removeProperty("left");
        child.style.removeProperty("top");
        child.style.removeProperty("width");
        child.style.removeProperty("position");
        targetLayout.appendChild(child);
        const target = {
          col: Math.max(1, Math.min(DASHBOARD_GRID_COLUMNS, panelBounds.col + localBounds.col - 1)),
          row: Math.max(1, panelBounds.row + localBounds.row + index),
        };
        commitInsertedGridItemWithVerticalPushdown(targetLayout, child, target);
        targetLayout.__initWidget?.(child);
      });
      writeDraftList(targetLayout, "hiddenWidgetsDraft", hidden);
      updatePanelChildEmptyState(panel);
      cleanupWidgetRowBreaks(targetLayout);
      extractedByLayout.set(targetLayout, entry.layoutKey || gridItemLayoutKey(targetLayout));
    };
    entries.forEach(extractPanelChildrenBeforeDelete);
    entries.forEach((entry) => {
      if (entry.kind === "anchor") {
        return;
      }
      const hiddenKey = entry.kind === "widget" ? "hiddenWidgetsDraft" : "hiddenPanelsDraft";
      const customKey = entry.kind === "widget" ? "customWidget" : "customPanel";
      const itemKey = entry.kind === "widget" ? "widgetKey" : "panelKey";
      const key = entry.item.dataset[itemKey];
      if (entry.kind === "widget" && isPanelInternalWidgetLayout(entry.layout)) {
        entry.item.remove();
        updatePanelChildEmptyState(panelForInternalWidgetLayout(entry.layout));
        return;
      }
      if (!entry.item.dataset[customKey]) {
        const cacheKey = `${entry.layoutKey}:${hiddenKey}`;
        const hidden = hiddenByLayout.get(cacheKey) || readDraftList(entry.layout, hiddenKey);
        if (key && !hidden.includes(key)) hidden.push(key);
        hiddenByLayout.set(cacheKey, hidden);
        entry.item.hidden = true;
      } else {
        entry.item.remove();
      }
    });
    hiddenByLayout.forEach((hidden, cacheKey) => {
      const [layoutKey, hiddenKey] = cacheKey.split(":");
      const entry = entries.find((candidate) => candidate.layoutKey === layoutKey && (candidate.kind === "widget" ? "hiddenWidgetsDraft" : "hiddenPanelsDraft") === hiddenKey);
      writeDraftList(entry?.layout, hiddenKey, hidden);
    });
    extractedByLayout.forEach((layoutKey, widgetLayout) => {
      saveWidgetLayouts(widgetLayout, getActivePanelProfile(layoutKey), { history: false });
    });
    saveWorkspaceDeleteLayouts(entries);
    syncLayoutToolsActive();
    entries.forEach((entry) => {
      emitWorkspaceEvent({
        type: entry.kind === "anchor" ? "anchor-deleted" : "object-deleted",
        source: "object-delete",
        layoutKey: entry.layoutKey,
        objectId: entry.item.dataset.anchorKey || entry.item.dataset.widgetKey || entry.item.dataset.panelKey || "",
        objectType: entry.kind,
        regionId: regionIdForWorkspaceItem(entry.item),
        panelId: entry.item.dataset.parentPanelKey || entry.item.closest?.(".db-panel")?.dataset?.panelKey || "",
        label: `${entry.title} ${entry.kind} deleted`,
        payload: { title: entry.title, extractedPanelChildren: entry.kind === "panel" ? panelChildWidgets(entry.item).length : 0 },
      });
    });
    showToast(entries.length > 1 ? `${entries.length} objects deleted.` : `${entries[0].title} ${entries[0].kind} deleted.`, "info", { activity: false });
  };
  const requestWorkspaceObjectDelete = ({ targets }) => {
    const entries = workspaceDeleteEntries(targets);
    if (!entries.length) return false;
    const needsConfirmation = entries.some((entry) => workspaceObjectHasMeaningfulChanges(entry.item));
    if (!needsConfirmation) {
      performWorkspaceObjectDelete(entries);
      return true;
    }
    pendingPanelDelete = { entries };
    if (panelDeleteMessage) {
      panelDeleteMessage.textContent = `Are you sure you want to delete ${describeWorkspaceDeleteTargets(entries)}?`;
    }
    if (typeof panelDeleteDialog?.showModal === "function") {
      panelDeleteDialog.showModal();
    } else {
      performWorkspaceObjectDelete(entries);
    }
    return true;
  };
  const requestPanelDelete = ({ panel, panels = null }) => requestWorkspaceObjectDelete({ targets: panels?.length ? panels : [panel] });
  const requestWidgetDelete = ({ widget, layout, layoutKey, title, widgets = null }) => {
    return requestWorkspaceObjectDelete({ targets: widgets?.length ? widgets : [widget] });
  };
  panelDeleteCancel?.addEventListener("click", closePanelDeleteDialog);
  panelDeleteClose?.addEventListener("click", closePanelDeleteDialog);
  panelDeleteDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePanelDeleteDialog();
  });
  panelDeleteConfirm?.addEventListener("click", () => {
    if (!pendingPanelDelete) return;
    performWorkspaceObjectDelete(pendingPanelDelete.entries || []);
    closePanelDeleteDialog();
  });
  const getPanelMinimumWidth = (panel) => {
    const drawer = panel.querySelector(".panel-tool-drawer");
    const drawerWidth = Math.ceil(drawer?.scrollWidth || 0);
    const buttonCount = drawer?.querySelectorAll(".panel-tool-button").length || 6;
    const fallbackDrawerWidth = (buttonCount * 34) + (Math.max(0, buttonCount - 1) * 6) + 8;
    const measuredDrawerWidth = Math.max(fallbackDrawerWidth, drawerWidth);
    const drawerRightOffset = 42;
    const safeInset = 28;
    return Math.ceil(measuredDrawerWidth + drawerRightOffset + safeInset);
  };

  const syncPanelMinimumWidth = (panel) => {
    panel.style.setProperty("--panel-min-width", `${getPanelMinimumWidth(panel)}px`);
  };

  const DASHBOARD_GRID_COLUMNS = 6;
  const DASHBOARD_GRID_ROW_HEIGHT = 81;

  const isPanelInternalWidgetLayout = (layout) => layout?.classList?.contains("panel-internal-widget-grid");
  const panelForInternalWidgetLayout = (layout) => layout?.closest?.(".db-panel");
  const gridHostForLayout = (layout) => isPanelInternalWidgetLayout(layout) ? layout : (layout?.closest?.(".dashboard-layout-grid") || layout);
  const isPanelInternalGridItem = (item) => Boolean(item?.closest?.(".panel-internal-widget-grid"));

  const gridContentRectForHost = (host, rect) => {
    if (!host?.classList?.contains("panel-internal-widget-grid")) return rect;
    const computed = window.getComputedStyle(host);
    const paddingLeft = parseFloat(computed.paddingLeft) || 0;
    const paddingRight = parseFloat(computed.paddingRight) || 0;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
    const left = rect.left + paddingLeft;
    const top = rect.top + paddingTop;
    const width = Math.max(1, rect.width - paddingLeft - paddingRight);
    const height = Math.max(1, rect.height - paddingTop - paddingBottom);
    return {
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  };

  const gridRectForLayout = (layout) => {
    const host = gridHostForLayout(layout);
    const rect = (host || layout).getBoundingClientRect();
    return gridContentRectForHost(host || layout, rect);
  };

  const gridGapForLayout = (layout) => {
    if (!layout) return 16;
    const host = gridHostForLayout(layout);
    const computed = window.getComputedStyle(host || layout);
    const rawGap = computed.rowGap || computed.gap || (layout.classList.contains("widget-layout") ? "12px" : "16px");
    const gap = parseFloat(rawGap);
    return Number.isFinite(gap) ? gap : (layout.classList.contains("widget-layout") ? 12 : 16);
  };

  const gridRowHeightForLayout = (layout) => {
    if (!layout) return DASHBOARD_GRID_ROW_HEIGHT;
    const host = gridHostForLayout(layout);
    const computed = window.getComputedStyle(host || layout);
    const rowHeight = parseFloat(computed.getPropertyValue("--dashboard-grid-row-height"));
    return Number.isFinite(rowHeight) && rowHeight > 0 ? rowHeight : DASHBOARD_GRID_ROW_HEIGHT;
  };

  const createGridMetrics = (layout) => {
    const rect = gridRectForLayout(layout);
    const gap = gridGapForLayout(layout);
    const rowHeight = gridRowHeightForLayout(layout);
    const width = Math.max(1, rect.width);
    const columnWidth = (width - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS;
    return {
      layout,
      rect,
      gap,
      width,
      columnWidth,
      columnStep: Math.max(1, columnWidth + gap),
      rowHeight,
      rowStep: rowHeight + gap,
      panelMinimumRows: new WeakMap(),
    };
  };

  const refreshGridMetricsRect = (metrics) => {
    if (!metrics?.layout) return metrics;
    metrics.rect = gridRectForLayout(metrics.layout);
    return metrics;
  };

  const gridHeightForRows = (rows, gap, rowHeight = DASHBOARD_GRID_ROW_HEIGHT) => {
    const safeRows = Math.max(1, Math.round(Number(rows) || 1));
    const safeRowHeight = Math.max(1, Number(rowHeight) || DASHBOARD_GRID_ROW_HEIGHT);
    return (safeRows * safeRowHeight) + (Math.max(0, safeRows - 1) * gap);
  };

  const gridRowsFromHeight = (height, gap, minRows = 1, rowHeight = DASHBOARD_GRID_ROW_HEIGHT) => {
    const safeRowHeight = Math.max(1, Number(rowHeight) || DASHBOARD_GRID_ROW_HEIGHT);
    const safeHeight = Math.max(1, Number(height) || safeRowHeight);
    return Math.max(minRows, Math.ceil((safeHeight + gap) / (safeRowHeight + gap)));
  };

  const isWidgetGridItem = (item) => (
    (item?.classList?.contains("widget-card") && !item?.classList?.contains("workspace-anchor-object")) ||
    item?.classList?.contains("widget-placeholder")
  );

  const WORKSPACE_OBJECT_TYPES = Object.freeze({
    widget: "widget",
    panel: "panel",
    divider: "divider",
    anchor: "anchor",
  });
  const WORKSPACE_OBJECT_CAPABILITIES = Object.freeze({
    [WORKSPACE_OBJECT_TYPES.widget]: Object.freeze({
      canExpand: false,
      isOpenable: false,
      hasExpandedFootprint: false,
      participatesInGridCollision: true,
      hasPanelContentArea: false,
      usesPanelHeader: false,
      usesAnchorLayer: false,
      usesDividerSurface: false,
    }),
    [WORKSPACE_OBJECT_TYPES.panel]: Object.freeze({
      canExpand: true,
      isOpenable: true,
      hasExpandedFootprint: true,
      participatesInGridCollision: true,
      hasPanelContentArea: true,
      usesPanelHeader: true,
      usesAnchorLayer: false,
      usesDividerSurface: false,
    }),
    [WORKSPACE_OBJECT_TYPES.divider]: Object.freeze({
      canExpand: false,
      isOpenable: false,
      hasExpandedFootprint: false,
      participatesInGridCollision: true,
      hasPanelContentArea: false,
      usesPanelHeader: true,
      usesAnchorLayer: false,
      usesDividerSurface: true,
    }),
    [WORKSPACE_OBJECT_TYPES.anchor]: Object.freeze({
      canExpand: false,
      isOpenable: false,
      hasExpandedFootprint: false,
      participatesInGridCollision: false,
      hasPanelContentArea: false,
      usesPanelHeader: false,
      usesAnchorLayer: true,
      usesDividerSurface: false,
    }),
  });
  const WORKSPACE_CONTEXT_MODEL_VERSION = "workspace-context-v1";
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
  const workspaceObjectTypeFromDefinition = (definition, fallback) => {
    const rawType = definition?.workspaceObjectType || definition?.objectType || definition?.type || definition?.dashboardObjectKind || fallback;
    if (rawType === "anchor") return WORKSPACE_OBJECT_TYPES.anchor;
    if (rawType === "divider" || rawType === "context-divider") return WORKSPACE_OBJECT_TYPES.divider;
    if (rawType === "panel") return WORKSPACE_OBJECT_TYPES.panel;
    return fallback || WORKSPACE_OBJECT_TYPES.widget;
  };
  const workspaceObjectType = (item) => {
    const rawType = item?.dataset?.workspaceObjectType || item?.dataset?.dashboardObjectKind || item?.dataset?.widgetType;
    if (rawType === WORKSPACE_OBJECT_TYPES.anchor) return WORKSPACE_OBJECT_TYPES.anchor;
    if (rawType === WORKSPACE_OBJECT_TYPES.divider || rawType === "context-divider") return WORKSPACE_OBJECT_TYPES.divider;
    if (item?.classList?.contains("db-panel")) return WORKSPACE_OBJECT_TYPES.panel;
    return WORKSPACE_OBJECT_TYPES.widget;
  };
  const workspaceObjectCapabilities = (item) => (
    WORKSPACE_OBJECT_CAPABILITIES[workspaceObjectType(item)] ||
    WORKSPACE_OBJECT_CAPABILITIES[WORKSPACE_OBJECT_TYPES.widget]
  );
  const syncWorkspaceCapabilityMetadata = (item) => {
    if (!item) return;
    Object.entries(workspaceObjectCapabilities(item)).forEach(([key, value]) => {
      item.dataset[key] = String(Boolean(value));
    });
  };
  const workspaceObjectKey = (item) => item?.dataset?.anchorKey || item?.dataset?.widgetKey || item?.dataset?.panelKey || "";
  const workspaceRootRegionId = (layoutKey) => `${layoutKey}:region:root`;
  const workspaceRegionIdForDivider = (divider, layoutKey) => {
    const key = workspaceObjectKey(divider) || "divider";
    const existing = divider.dataset.contextScopeId || "";
    if (existing && (layoutKey === "default" || !existing.startsWith("default:region:"))) return existing;
    return `${layoutKey}:region:${key}`;
  };
  const CONTEXT_LINK_MODES = Object.freeze({
    inherit: "inherit",
    share: "share",
    override: "override",
    reference: "reference",
  });
  const contextLinkId = () => `context-link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizeContextLinkMode = (mode) => (
    Object.values(CONTEXT_LINK_MODES).includes(mode) ? mode : CONTEXT_LINK_MODES.inherit
  );
  const normalizeContextLink = (link = {}) => ({
    id: String(link.id || contextLinkId()),
    sourceObjectId: String(link.sourceObjectId || link.sourceId || ""),
    targetObjectId: String(link.targetObjectId || link.targetId || ""),
    mode: normalizeContextLinkMode(link.mode),
    label: String(link.label || ""),
    enabled: link.enabled !== false,
    metadata: link.metadata && typeof link.metadata === "object" ? { ...link.metadata } : {},
  });
  const loadWorkspaceContextLinks = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const graph = readJsonStore(workspaceLogicGraphKey(layoutKey, profile), { contextLinks: [] });
    return Array.isArray(graph.contextLinks)
      ? graph.contextLinks.map(normalizeContextLink).filter((link) => link.id && link.sourceObjectId && link.targetObjectId)
      : [];
  };
  const contextElementById = (id, layoutKey = "builder") => {
    const key = String(id || "");
    if (!key) return null;
    const escaped = CSS.escape(key);
    return document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] .widget-card[data-widget-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-panel-key="${escaped}"]`) ||
      document.querySelector(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"] .workspace-anchor-object[data-anchor-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-context-scope-id="${escaped}"], .panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-workspace-region-id="${escaped}"]`) ||
      null;
  };
  const ensureWorkspaceObjectMetadata = (item, metadata = {}) => {
    if (!item) return;
    const inferredType = metadata.workspaceObjectType || metadata.objectType || workspaceObjectType(item);
    item.dataset.workspaceObjectType = inferredType;
    item.dataset.workspaceContextModel = WORKSPACE_CONTEXT_MODEL_VERSION;
    if (metadata.dashboardObjectKind) item.dataset.dashboardObjectKind = metadata.dashboardObjectKind;
    if (metadata.contextScopeId) item.dataset.contextScopeId = metadata.contextScopeId;
    if (metadata.workspaceRegionId) item.dataset.workspaceRegionId = metadata.workspaceRegionId;
    if (metadata.contextRole) item.dataset.contextRole = metadata.contextRole;
    if (metadata.navigationTargetType) item.dataset.navigationTargetType = metadata.navigationTargetType;
    if (metadata.navigationTargetId) item.dataset.navigationTargetId = metadata.navigationTargetId;
    if (inferredType === WORKSPACE_OBJECT_TYPES.divider) {
      item.dataset.dashboardObjectKind = metadata.dashboardObjectKind || "divider";
      item.dataset.contextRole = metadata.contextRole || "semantic-boundary";
      item.dataset.contextScopeId = metadata.contextScopeId || workspaceRegionIdForDivider(item, groupItemLayoutKey(item));
      item.dataset.workspaceRegionId = item.dataset.contextScopeId;
    } else if (inferredType === WORKSPACE_OBJECT_TYPES.anchor) {
      item.dataset.dashboardObjectKind = metadata.dashboardObjectKind || "anchor";
      item.dataset.navigationTargetType = metadata.navigationTargetType || "workspace-region";
      item.dataset.contextRole = metadata.contextRole || item.dataset.contextRole || "navigation-reference";
    } else if (inferredType === WORKSPACE_OBJECT_TYPES.panel) {
      item.dataset.dashboardObjectKind = metadata.dashboardObjectKind || item.dataset.dashboardObjectKind || "panel";
      item.dataset.contextRole = metadata.contextRole || item.dataset.contextRole || "container";
    } else {
      item.dataset.dashboardObjectKind = metadata.dashboardObjectKind || item.dataset.dashboardObjectKind || "widget";
      item.dataset.contextRole = metadata.contextRole || item.dataset.contextRole || "content";
    }
    syncWorkspaceCapabilityMetadata(item);
  };
  const workspaceObjectPersistence = (item) => ({
    workspaceObjectType: workspaceObjectType(item),
    dashboardObjectKind: item.dataset.dashboardObjectKind || null,
    workspaceRegionId: item.dataset.workspaceRegionId || null,
    contextScopeId: item.dataset.contextScopeId || null,
    contextRole: item.dataset.contextRole || null,
    workspaceContext: workspaceContextFromElement(item),
    navigationTargetType: item.dataset.navigationTargetType || null,
    navigationTargetId: item.dataset.navigationTargetId || null,
  });

  /**
   * Source-agnostic data contracts used by the workspace context layer.
   *
   * DataSource: { id, name, kind, config }
   * DataSourceAdapter: { kind, introspect(source), query(source, request), validateConfig?, suggestSemanticMapping? }
   * DataSchema: { fields: [{ name, type, nullable?, sampleValues? }] }
   * ContextQuery: { fields?, filters?, timeRange?, groupBy?, sort?, limit? }
   * SemanticMapping: { dateField?, valueField?, labelField?, categoryField?, statusField?, ownerField?, locationField?, custom? }
   * WorkspaceContext: { id, name, dataSourceId?, semanticMapping?, filters?, timeRange?, tags?, visualSettings? }
   */
  const dataSourceAdapters = new Map();
  const normalizeFieldType = (value) => {
    if (value instanceof Date) return "date";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value) || (value && typeof value === "object")) return "json";
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(value) || !Number.isNaN(Date.parse(value)) && /date|time|at$/i.test(value)) return "date";
      return "string";
    }
    return "unknown";
  };
  const inferDataSchema = (rows = [], explicitFields = []) => {
    const fieldsByName = new Map();
    explicitFields.forEach((field) => {
      if (!field?.name) return;
      fieldsByName.set(field.name, {
        name: field.name,
        type: field.type || "unknown",
        nullable: Boolean(field.nullable),
        sampleValues: Array.isArray(field.sampleValues) ? field.sampleValues.slice(0, 4) : [],
      });
    });
    rows.slice(0, 50).forEach((row) => {
      if (!row || typeof row !== "object") return;
      Object.entries(row).forEach(([name, value]) => {
        const existing = fieldsByName.get(name);
        const type = existing?.type && existing.type !== "unknown" ? existing.type : normalizeFieldType(value);
        const sampleValues = existing?.sampleValues || [];
        if (value != null && sampleValues.length < 4 && !sampleValues.some((sample) => JSON.stringify(sample) === JSON.stringify(value))) {
          sampleValues.push(value);
        }
        fieldsByName.set(name, {
          name,
          type,
          nullable: Boolean(existing?.nullable || value == null),
          sampleValues,
        });
      });
    });
    return { fields: [...fieldsByName.values()] };
  };
  const semanticFieldScore = (fieldName, candidates) => {
    const name = String(fieldName || "").toLowerCase();
    return candidates.reduce((score, candidate, index) => {
      if (name === candidate) return Math.max(score, 100 - index);
      if (name.includes(candidate)) return Math.max(score, 60 - index);
      return score;
    }, 0);
  };
  const suggestSemanticMappingFromSchema = (schema) => {
    const fields = schema?.fields || [];
    const best = (candidates, typePreference = null) => fields
      .map((field) => ({
        field,
        score: semanticFieldScore(field.name, candidates) + (typePreference && field.type === typePreference ? 18 : 0),
      }))
      .sort((a, b) => b.score - a.score)[0]?.score > 0
      ? fields
        .map((field) => ({
          field,
          score: semanticFieldScore(field.name, candidates) + (typePreference && field.type === typePreference ? 18 : 0),
        }))
        .sort((a, b) => b.score - a.score)[0].field.name
      : undefined;
    return {
      dateField: best(["created_at", "timestamp", "order_date", "date", "time", "at"], "date"),
      valueField: best(["value", "amount", "total", "count", "score", "metric"], "number"),
      labelField: best(["label", "name", "title", "description"], "string"),
      categoryField: best(["category", "type", "group", "segment"], "string"),
      statusField: best(["status", "state"], "string"),
      ownerField: best(["owner", "assignee", "user"], "string"),
      locationField: best(["location", "geo", "region", "country", "city"], "geo"),
      custom: {},
    };
  };
  const sourceRows = (source) => {
    const config = source?.config || {};
    if (Array.isArray(config.rows)) return config.rows;
    if (Array.isArray(config.data)) return config.data;
    if (Array.isArray(config.values)) return config.values;
    return [];
  };
  const comparableFilterValue = (value) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const date = Date.parse(value);
    if (Number.isFinite(date)) return date;
    return value;
  };
  const applyContextFilters = (rows, filters = []) => rows.filter((row) => filters.every((filter) => {
    if (!filter?.field && !filter?.key) return true;
    const field = filter.field || filter.key;
    const operator = filter.operator || "eq";
    const actual = row?.[field];
    const expected = filter.value;
    if (operator === "neq") return actual !== expected;
    if (operator === "contains") return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    if (operator === "in") return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
    if (operator === "gte") return comparableFilterValue(actual) >= comparableFilterValue(expected);
    if (operator === "lte") return comparableFilterValue(actual) <= comparableFilterValue(expected);
    return actual === expected;
  }));
  const applyContextTimeRange = (rows, timeRange, mapping) => {
    if (!timeRange?.start && !timeRange?.end) return rows;
    const field = timeRange.field || mapping?.dateField;
    if (!field) return rows;
    const start = timeRange.start ? Date.parse(timeRange.start) : Number.NEGATIVE_INFINITY;
    const end = timeRange.end ? Date.parse(timeRange.end) : Number.POSITIVE_INFINITY;
    return rows.filter((row) => {
      const value = Date.parse(row?.[field]);
      if (!Number.isFinite(value)) return false;
      return value >= start && value <= end;
    });
  };
  const applyContextSort = (rows, sort = []) => {
    if (!sort.length) return rows;
    return [...rows].sort((a, b) => {
      for (const rule of sort) {
        const direction = rule.direction === "desc" ? -1 : 1;
        const av = a?.[rule.field];
        const bv = b?.[rule.field];
        if (av === bv) continue;
        return av > bv ? direction : -direction;
      }
      return 0;
    });
  };
  const projectContextFields = (rows, fields = null) => {
    if (!Array.isArray(fields) || !fields.length) return rows;
    return rows.map((row) => fields.reduce((projected, field) => {
      projected[field] = row?.[field];
      return projected;
    }, {}));
  };
  const createRecordAdapter = (kind) => ({
    kind,
    introspect: async (source) => inferDataSchema(sourceRows(source), source?.config?.schema || source?.config?.fields || []),
    query: async (source, request = {}) => {
      const mapping = request.semanticMapping || {};
      const baseRows = sourceRows(source);
      const filters = [...(request.filters || [])];
      const filtered = applyContextTimeRange(applyContextFilters(baseRows, filters), request.timeRange, mapping);
      const sorted = applyContextSort(filtered, request.sort || []);
      const limited = Number.isFinite(Number(request.limit)) ? sorted.slice(0, Math.max(0, Number(request.limit))) : sorted;
      return {
        schema: inferDataSchema(limited, source?.config?.schema || source?.config?.fields || []),
        rows: projectContextFields(limited, request.fields),
        total: filtered.length,
        sourceId: source.id,
        sourceKind: source.kind,
      };
    },
    validateConfig: async (source) => ({ ok: Array.isArray(sourceRows(source)), errors: Array.isArray(sourceRows(source)) ? [] : ["Rows must be an array."] }),
    suggestSemanticMapping: async (schema) => suggestSemanticMappingFromSchema(schema),
  });
  const registerDataSourceAdapter = (adapter) => {
    if (!adapter?.kind || typeof adapter.query !== "function" || typeof adapter.introspect !== "function") return false;
    dataSourceAdapters.set(adapter.kind, adapter);
    return true;
  };
  registerDataSourceAdapter(createRecordAdapter("manual"));
  registerDataSourceAdapter(createRecordAdapter("json"));
  registerDataSourceAdapter(createRecordAdapter("csv"));

  const normalizeDataSource = (source) => ({
    id: String(source?.id || "").trim(),
    name: String(source?.name || source?.id || "Data source").trim(),
    kind: String(source?.kind || "manual").trim(),
    config: source?.config && typeof source.config === "object" ? source.config : {},
  });
  const loadDataSources = (layoutKey = "default", profile = getActivePanelProfile(layoutKey)) =>
    readJsonStore(dataSourcesKey(layoutKey, profile), []).map(normalizeDataSource).filter((source) => source.id);
  const saveDataSources = (layoutKey, profile, sources) => writeJsonStore(dataSourcesKey(layoutKey, profile), sources.map(normalizeDataSource).filter((source) => source.id));
  const loadWorkspaceContexts = (layoutKey = "default", profile = getActivePanelProfile(layoutKey)) =>
    readJsonStore(workspaceContextsKey(layoutKey, profile), []).filter((context) => context?.id);
  const saveWorkspaceContexts = (layoutKey, profile, contexts) => writeJsonStore(workspaceContextsKey(layoutKey, profile), contexts.filter((context) => context?.id));
  const workspaceContextFromElement = (item) => {
    const raw = parseJsonRecord(item?.dataset?.workspaceContext, null) || {};
    const mapping = parseJsonRecord(item?.dataset?.semanticMapping, null) || raw.semanticMapping || null;
    const filters = parseJsonRecord(item?.dataset?.contextFilters, null) || raw.filters || null;
    const timeRange = parseJsonRecord(item?.dataset?.contextTimeRange, null) || raw.timeRange || null;
    const tags = parseJsonRecord(item?.dataset?.contextTags, null) || raw.tags || null;
    const dataSourceId = item?.dataset?.dataSourceId || raw.dataSourceId || null;
    if (!dataSourceId && !mapping && !filters && !timeRange && !tags && !raw.name && !raw.visualSettings) return null;
    return {
      id: item?.dataset?.contextScopeId || item?.dataset?.workspaceRegionId || workspaceObjectKey(item),
      name: item?.dataset?.contextName || raw.name || item?.dataset?.panelTitle || item?.dataset?.defaultTitle || "Workspace context",
      dataSourceId,
      semanticMapping: mapping || undefined,
      filters: filters || undefined,
      timeRange: timeRange || undefined,
      tags: tags || undefined,
      visualSettings: raw.visualSettings || undefined,
    };
  };
  const applyWorkspaceContextToElement = (item, context) => {
    if (!item || !context) return;
    item.dataset.workspaceContext = JSON.stringify(context);
    if (context.dataSourceId) item.dataset.dataSourceId = context.dataSourceId;
    if (context.semanticMapping) item.dataset.semanticMapping = JSON.stringify(context.semanticMapping);
    if (context.filters) item.dataset.contextFilters = JSON.stringify(context.filters);
    if (context.timeRange) item.dataset.contextTimeRange = JSON.stringify(context.timeRange);
    if (context.tags) item.dataset.contextTags = JSON.stringify(context.tags);
    if (context.name) item.dataset.contextName = context.name;
  };
  const mergeWorkspaceContexts = (...contexts) => contexts.filter(Boolean).reduce((merged, context) => ({
    ...merged,
    ...context,
    semanticMapping: {
      ...(merged.semanticMapping || {}),
      ...(context.semanticMapping || {}),
      custom: {
        ...(merged.semanticMapping?.custom || {}),
        ...(context.semanticMapping?.custom || {}),
      },
    },
    filters: [...(merged.filters || []), ...(context.filters || [])],
    tags: [...new Set([...(merged.tags || []), ...(context.tags || [])])],
    visualSettings: {
      ...(merged.visualSettings || {}),
      ...(context.visualSettings || {}),
    },
  }), {});
  const filterControlFieldForType = (filter, semanticMapping = {}) => {
    const explicit = String(filter?.field || "").trim();
    if (explicit) return explicit;
    if (filter?.type === "number-range") return semanticMapping.valueField || "";
    if (filter?.type === "date-range") return semanticMapping.dateField || "";
    if (filter?.type === "boolean") return semanticMapping.statusField || semanticMapping.categoryField || "";
    if (filter?.type === "dropdown" || filter?.type === "category" || filter?.type === "multi-select") {
      return semanticMapping.categoryField || semanticMapping.statusField || semanticMapping.ownerField || semanticMapping.labelField || "";
    }
    return semanticMapping.labelField || semanticMapping.categoryField || semanticMapping.statusField || "";
  };
  const normalizedFilterWidgetFilters = (widget, inheritedContext = {}) => {
    if (!widget || widget.hidden || widget.dataset.widgetDefinition !== "filter") return [];
    const config = parseJsonRecord(widget.dataset.widgetConfig, {}) || {};
    const semanticMapping = inheritedContext.semanticMapping || {};
    const filters = Array.isArray(config.filters) ? config.filters : [];
    return filters.flatMap((filter) => {
      const type = filter.type || "text";
      const field = filterControlFieldForType(filter, semanticMapping);
      if (!field) return [];
      if (type === "number-range") {
        return [
          filter.min !== "" && filter.min != null ? { field, operator: "gte", value: filter.min } : null,
          filter.max !== "" && filter.max != null ? { field, operator: "lte", value: filter.max } : null,
        ].filter(Boolean);
      }
      if (type === "date-range") {
        return [
          filter.start ? { field, operator: "gte", value: filter.start } : null,
          filter.end ? { field, operator: "lte", value: filter.end } : null,
        ].filter(Boolean);
      }
      if (type === "multi-select") {
        const values = Array.isArray(filter.values) ? filter.values.filter((value) => value !== "" && value != null) : [];
        return values.length ? [{ field, operator: "in", value: values }] : [];
      }
      if (type === "boolean") {
        return filter.enabled ? [{ field, operator: "eq", value: Boolean(filter.value ?? true) }] : [];
      }
      const value = filter.value;
      if (value == null || value === "") return [];
      return [{ field, operator: filter.operator || (type === "text" ? "contains" : "eq"), value }];
    });
  };
  const normalizedTimeframeWidgetRange = (widget, inheritedContext = {}) => {
    if (!widget || widget.hidden || widget.dataset.widgetDefinition !== "timeframe") return null;
    const config = parseJsonRecord(widget.dataset.widgetConfig, {}) || {};
    const resolved = window.dashboardWidgetRuntime?.resolveTimeRangeConfig?.(config, inheritedContext);
    if (!resolved?.start && !resolved?.end) return null;
    return resolved;
  };
  const filterWidgetsForRegion = (layoutKey, regionId) => [
    ...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card[data-widget-definition="filter"]:not([hidden])`),
    ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card[data-widget-definition="filter"]:not([hidden])`),
  ].filter((widget) => regionIdForWorkspaceItem(widget) === regionId);
  const timeframeWidgetsForRegion = (layoutKey, regionId) => [
    ...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card[data-widget-definition="timeframe"]:not([hidden])`),
    ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card[data-widget-definition="timeframe"]:not([hidden])`),
  ].filter((widget) => regionIdForWorkspaceItem(widget) === regionId);
  const timeRangeContextForRegion = (layoutKey, regionId, inheritedContext = {}) => {
    const ranges = timeframeWidgetsForRegion(layoutKey, regionId)
      .map((widget) => normalizedTimeframeWidgetRange(widget, inheritedContext))
      .filter(Boolean);
    const timeRange = ranges[ranges.length - 1] || null;
    return timeRange ? { timeRange } : null;
  };
  const filterContextForRegion = (layoutKey, regionId, inheritedContext = {}) => {
    const filters = filterWidgetsForRegion(layoutKey, regionId)
      .flatMap((widget) => normalizedFilterWidgetFilters(widget, inheritedContext));
    return filters.length ? { filters } : null;
  };
  const dataSourceById = (layoutKey, profile, id) => loadDataSources(layoutKey, profile).find((source) => source.id === id) || null;
  const contextById = (layoutKey, profile, id) => loadWorkspaceContexts(layoutKey, profile).find((context) => context.id === id) || null;
  const activeLayoutKeyForItem = (item) => {
    const layout = groupItemLayout(item) || item?.closest?.(".widget-layout, .panel-layout");
    return gridItemLayoutKey(layout || document.querySelector(".panel-layout") || document.querySelector(".widget-layout"));
  };
  const dividerForRegionId = (regionId, layoutKey = "builder") => {
    if (!regionId || regionId === workspaceRootRegionId(layoutKey)) return null;
    return [...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .db-panel:not([hidden])`)]
      .find((panel) => workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider &&
        (workspaceRegionIdForDivider(panel, layoutKey) === regionId || panel.dataset.contextScopeId === regionId || panel.dataset.workspaceRegionId === regionId)) || null;
  };
  const contextLinksForTarget = (layoutKey, profile, targetId) =>
    loadWorkspaceContextLinks(layoutKey, profile).filter((link) => link.enabled !== false && link.targetObjectId === targetId);
  const mergeLinkedContext = (baseContext = {}, linkedContext = {}, mode = CONTEXT_LINK_MODES.inherit) => {
    if (!linkedContext || !Object.keys(linkedContext).length || mode === CONTEXT_LINK_MODES.reference) return baseContext || {};
    if (mode === CONTEXT_LINK_MODES.override) return mergeWorkspaceContexts(baseContext, linkedContext);
    return mergeWorkspaceContexts(linkedContext, baseContext);
  };
  const baseContextForSourceObject = (sourceId, layoutKey, profile, stack = new Set()) => {
    const id = String(sourceId || "");
    if (!id || stack.has(id)) return null;
    const directContext = contextById(layoutKey, profile, id);
    if (directContext) return directContext;
    const source = contextElementById(id, layoutKey);
    if (!source) return null;
    const nextStack = new Set(stack);
    nextStack.add(id);
    if (workspaceObjectType(source) === WORKSPACE_OBJECT_TYPES.divider) {
      const regionId = workspaceRegionIdForDivider(source, layoutKey);
      return resolveWorkspaceRegionContext(layoutKey, profile, regionId, nextStack);
    }
    return resolveWorkspaceContextForItem(source, { layoutKey, profile, contextLinkStack: nextStack });
  };
  const linkedContextForTarget = (targetId, layoutKey, profile, baseContext = {}, stack = new Set()) => {
    const links = contextLinksForTarget(layoutKey, profile, targetId);
    if (!links.length || stack.has(targetId)) return baseContext || {};
    const nextStack = new Set(stack);
    nextStack.add(targetId);
    return links.reduce((context, link) => {
      const sourceContext = baseContextForSourceObject(link.sourceObjectId, layoutKey, profile, nextStack);
      return mergeLinkedContext(context, sourceContext, link.mode);
    }, baseContext || {});
  };
  const resolveWorkspaceRegionContext = (layoutKey, profile, regionId, stack = new Set()) => {
    const rootContext = contextById(layoutKey, profile, workspaceRootRegionId(layoutKey));
    const regionContext = contextById(layoutKey, profile, regionId);
    const divider = dividerForRegionId(regionId, layoutKey);
    const targetId = divider ? workspaceObjectKey(divider) : regionId;
    if (!targetId) return mergeWorkspaceContexts(rootContext, regionContext);
    const linkedRegionContext = linkedContextForTarget(targetId, layoutKey, profile, regionContext || {}, stack);
    return mergeWorkspaceContexts(rootContext, linkedRegionContext);
  };
  const regionIdForWorkspaceItem = (item) => {
    const internalPanel = panelForInternalWidgetLayout(item?.closest?.(".panel-internal-widget-grid"));
    if (internalPanel) return internalPanel.dataset.workspaceRegionId || internalPanel.dataset.contextInheritedFrom;
    return item?.dataset?.workspaceRegionId || item?.dataset?.contextInheritedFrom || workspaceRootRegionId(activeLayoutKeyForItem(item));
  };
  const resolveWorkspaceContextForItem = (item, options = {}) => {
    const layoutKey = options.layoutKey || activeLayoutKeyForItem(item);
    const profile = options.profile || getActivePanelProfile(layoutKey);
    const regionId = regionIdForWorkspaceItem(item);
    const objectId = workspaceObjectKey(item);
    const localContext = workspaceContextFromElement(item);
    const inheritedContext = resolveWorkspaceRegionContext(layoutKey, profile, regionId, options.contextLinkStack || new Set());
    const objectLinkedContext = objectId
      ? linkedContextForTarget(objectId, layoutKey, profile, {}, options.contextLinkStack || new Set())
      : {};
    const timeRangeContext = timeRangeContextForRegion(layoutKey, regionId, inheritedContext);
    const filterContext = filterContextForRegion(layoutKey, regionId, mergeWorkspaceContexts(inheritedContext, objectLinkedContext, timeRangeContext));
    const resolved = mergeWorkspaceContexts(inheritedContext, objectLinkedContext, timeRangeContext, filterContext, localContext);
    const dataSource = resolved.dataSourceId ? dataSourceById(layoutKey, profile, resolved.dataSourceId) : null;
    const adapter = dataSource ? dataSourceAdapters.get(dataSource.kind) : null;
    return {
      id: resolved.id || regionId,
      name: resolved.name || regionId,
      layoutKey,
      profile,
      regionId,
      dataSourceId: resolved.dataSourceId || null,
      dataSourceKind: dataSource?.kind || null,
      dataSourceName: dataSource?.name || null,
      semanticMapping: resolved.semanticMapping || {},
      filters: resolved.filters || [],
      timeRange: resolved.timeRange || null,
      tags: resolved.tags || [],
      visualSettings: resolved.visualSettings || {},
      adapterKind: adapter?.kind || null,
      canQuery: Boolean(dataSource && adapter),
    };
  };
  const queryResolvedWorkspaceContext = async (resolvedContext, request = {}) => {
    if (!resolvedContext?.dataSourceId) {
      return { schema: { fields: [] }, rows: [], total: 0, error: "No data source resolved." };
    }
    const source = dataSourceById(resolvedContext.layoutKey, resolvedContext.profile, resolvedContext.dataSourceId);
    const adapter = source ? dataSourceAdapters.get(source.kind) : null;
    if (!source || !adapter) {
      return { schema: { fields: [] }, rows: [], total: 0, error: "Missing data source adapter." };
    }
    return adapter.query(source, {
      ...request,
      filters: [...(resolvedContext.filters || []), ...(request.filters || [])],
      timeRange: request.timeRange || resolvedContext.timeRange,
      semanticMapping: resolvedContext.semanticMapping || {},
    });
  };
  const QUERY_CACHE_TTL = 30_000;
  const widgetQueryCache = new Map();
  const widgetQueryInflight = new Map();
  const widgetQueryKeys = new WeakMap();
  const stableQueryValue = (value) => {
    if (Array.isArray(value)) return value.map(stableQueryValue);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((record, key) => {
        const next = value[key];
        if (next !== undefined) record[key] = stableQueryValue(next);
        return record;
      }, {});
    }
    return value;
  };
  const stableQueryStringify = (value) => JSON.stringify(stableQueryValue(value));
  const resolvedContextQueryFingerprint = (context = {}) => ({
    layoutKey: context.layoutKey || "",
    profile: context.profile || "",
    regionId: context.regionId || "",
    dataSourceId: context.dataSourceId || "",
    dataSourceKind: context.dataSourceKind || "",
    adapterKind: context.adapterKind || "",
    semanticMapping: context.semanticMapping || {},
    filters: context.filters || [],
    timeRange: context.timeRange || null,
    tags: context.tags || [],
  });
  const queryRowsAreEmpty = (result) => {
    if (!result || result.error) return false;
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const total = Number.isFinite(Number(result.total)) ? Number(result.total) : rows.length;
    return rows.length === 0 && total <= 0;
  };
  const widgetQueryKeyFor = ({ definition, instance, resolvedContext, query }) => stableQueryStringify({
    widgetType: definition?.type || instance?.type || "widget",
    queryConfig: queryRelevantWidgetConfig(definition, instance?.config || {}),
    context: resolvedContextQueryFingerprint(resolvedContext),
    query: query || null,
  });
  const stateFromQueryResult = (result, resolvedContext) => ({
    status: result?.error ? "error" : queryRowsAreEmpty(result) ? "empty" : "ready",
    data: {
      ...(result || {}),
      semanticMapping: resolvedContext?.semanticMapping || {},
    },
    error: result?.error || null,
    lastUpdated: Date.now(),
    isRefreshing: false,
  });
  const errorQueryState = (error) => ({
    status: "error",
    data: { error: error?.message || "Query failed" },
    error: error?.message || "Query failed",
    lastUpdated: Date.now(),
    isRefreshing: false,
  });
  const beginManagedWidgetQuery = ({ definition, instance, resolvedContext, query, force = false }) => {
    if (!query || !resolvedContext?.canQuery) {
      return {
        key: "",
        state: {
          status: "empty",
          data: null,
          error: null,
          lastUpdated: null,
          isRefreshing: false,
        },
        promise: null,
      };
    }
    const key = widgetQueryKeyFor({ definition, instance, resolvedContext, query });
    const cached = widgetQueryCache.get(key);
    const cachedAge = cached?.lastUpdated ? Date.now() - cached.lastUpdated : Number.POSITIVE_INFINITY;
    const inflight = widgetQueryInflight.get(key);
    if (cached && !force && cachedAge < QUERY_CACHE_TTL && !inflight) {
      return { key, state: { ...cached, isRefreshing: false }, promise: null };
    }
    if (inflight) {
      return {
        key,
        state: cached
          ? { ...cached, status: "stale", isRefreshing: true }
          : { status: "loading", data: null, error: null, lastUpdated: null, isRefreshing: true },
        promise: inflight.promise,
      };
    }
    const controller = new AbortController();
    emitWorkspaceEvent({
      type: "data-query-started",
      source: "query-runtime",
      layoutKey: resolvedContext.layoutKey || "builder",
      regionId: resolvedContext.regionId || "",
      objectId: instance?.id || "",
      objectType: definition?.type || instance?.type || "widget",
      label: `${definition?.displayName || "Widget"} query started`,
      payload: {
        queryKey: key,
        dataSourceId: resolvedContext.dataSourceId || "",
        status: "loading",
      },
    });
    const promise = queryResolvedWorkspaceContext(resolvedContext, {
      ...query,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return cached || { status: "idle", data: null, error: null, lastUpdated: null, isRefreshing: false };
        const state = stateFromQueryResult(result, resolvedContext);
        widgetQueryCache.set(key, state);
        emitWorkspaceEvent({
          type: result?.error ? "data-query-failed" : "data-query-succeeded",
          source: "query-runtime",
          layoutKey: resolvedContext.layoutKey || "builder",
          regionId: resolvedContext.regionId || "",
          objectId: instance?.id || "",
          objectType: definition?.type || instance?.type || "widget",
          label: result?.error
            ? `${definition?.displayName || "Widget"} query failed`
            : `${definition?.displayName || "Widget"} query succeeded`,
          detail: result?.error || "",
          payload: {
            queryKey: key,
            dataSourceId: resolvedContext.dataSourceId || "",
            rowCount: Array.isArray(result?.rows) ? result.rows.length : 0,
            total: Number.isFinite(Number(result?.total)) ? Number(result.total) : null,
            status: state.status,
          },
        });
        return state;
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === "AbortError") {
          return cached || { status: "idle", data: null, error: null, lastUpdated: null, isRefreshing: false };
        }
        const state = errorQueryState(error);
        widgetQueryCache.set(key, state);
        emitWorkspaceEvent({
          type: "data-query-failed",
          source: "query-runtime",
          layoutKey: resolvedContext.layoutKey || "builder",
          regionId: resolvedContext.regionId || "",
          objectId: instance?.id || "",
          objectType: definition?.type || instance?.type || "widget",
          label: `${definition?.displayName || "Widget"} query failed`,
          detail: error?.message || "Query failed",
          payload: {
            queryKey: key,
            dataSourceId: resolvedContext.dataSourceId || "",
            status: "error",
          },
        });
        return state;
      })
      .finally(() => {
        const current = widgetQueryInflight.get(key);
        if (current?.controller === controller) widgetQueryInflight.delete(key);
      });
    widgetQueryInflight.set(key, { promise, controller, startedAt: Date.now() });
    return {
      key,
      state: cached
        ? { ...cached, status: "stale", isRefreshing: true }
        : { status: "loading", data: null, error: null, lastUpdated: null, isRefreshing: true },
      promise,
    };
  };
  const invalidateManagedWidgetQueries = (predicate = null) => {
    if (!predicate) {
      widgetQueryCache.clear();
      return;
    }
    [...widgetQueryCache.keys()].forEach((key) => {
      let parsed = null;
      try {
        parsed = JSON.parse(key);
      } catch {}
      if (predicate(parsed, key)) widgetQueryCache.delete(key);
    });
  };
  const invalidateManagedWidgetQueriesForLayout = (layoutKey = "builder") => {
    invalidateManagedWidgetQueries((entry) => !entry || entry.context?.layoutKey === layoutKey);
  };
  const invalidateManagedWidgetQueryForWidget = (widget) => {
    const key = widget ? widgetQueryKeys.get(widget) || widget.dataset.widgetQueryKey || "" : "";
    if (key) widgetQueryCache.delete(key);
  };
  const cancelManagedWidgetQueryKey = (key) => {
    const inflight = key ? widgetQueryInflight.get(key) : null;
    if (!inflight) return false;
    inflight.controller.abort();
    widgetQueryInflight.delete(key);
    return true;
  };
  const cancelManagedWidgetQueryForWidget = (widget) => {
    if (!widget) return false;
    widget.dataset.widgetQuerySeq = String((Number(widget.dataset.widgetQuerySeq) || 0) + 1);
    return cancelManagedWidgetQueryKey(widgetQueryKeys.get(widget) || widget.dataset.widgetQueryKey || "");
  };
  const managedQueryStateForWidget = (widget) => {
    const key = widget ? widgetQueryKeys.get(widget) || widget.dataset.widgetQueryKey || "" : "";
    return key ? widgetQueryCache.get(key) || null : null;
  };
  const describeResolvedContext = (context) => {
    const mapping = context.semanticMapping || {};
    const mappedFields = [mapping.dateField, mapping.valueField, mapping.labelField, mapping.categoryField].filter(Boolean);
    return [context.dataSourceName || context.dataSourceId || "No source", ...mappedFields.slice(0, 2)].join(" · ");
  };
  const ensureContextBadge = (item) => {
    let badge = item.querySelector(":scope > .workspace-context-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "workspace-context-badge";
      item.appendChild(badge);
    }
    return badge;
  };
  const refreshResolvedContextDebug = (layoutKey = "default", profile = getActivePanelProfile(layoutKey)) => {
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
    if (panelLayout) syncWorkspaceRegions(panelLayout);
    if (widgetLayout) syncWorkspaceRegions(widgetLayout);
    const items = [
      ...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card:not(.workspace-anchor-object)`),
      ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .db-panel`),
      ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card`),
    ];
    items.forEach((item) => {
      const resolved = resolveWorkspaceContextForItem(item, { layoutKey, profile });
      const hasResolvedContext = Boolean(resolved.dataSourceId || Object.keys(resolved.semanticMapping || {}).length);
      item.dataset.resolvedContextId = resolved.id || "";
      item.dataset.resolvedWorkspaceRegionId = resolved.regionId || "";
      item.dataset.resolvedDataSourceId = resolved.dataSourceId || "";
      item.dataset.resolvedSemanticMapping = JSON.stringify(resolved.semanticMapping || {});
      let badge = item.querySelector(":scope > .workspace-context-badge");
      if (!hasResolvedContext || badge) badge?.remove();
      if (item.classList.contains("widget-card")) void refreshWidgetRuntimeData(item, resolved);
    });
    refreshWorkspaceMiniMaps(layoutKey);
    refreshWorkspaceMetaWidgets(layoutKey);
  };
  const saveWorkspaceContextState = (layoutKey, profile = getActivePanelProfile(layoutKey), options = {}) => {
    const persist = Boolean(options.persist);
    const contexts = loadWorkspaceContexts(layoutKey, profile);
    const byId = new Map(contexts.map((context) => [context.id, context]));
    document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .db-panel`).forEach((item) => {
      const context = workspaceContextFromElement(item);
      if (!context?.id) return;
      byId.set(context.id, { ...byId.get(context.id), ...context });
    });
    saveWorkspaceContexts(layoutKey, profile, [...byId.values()]);
    invalidateManagedWidgetQueriesForLayout(layoutKey);
    refreshResolvedContextDebug(layoutKey, profile);
    if (!persist && options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
  };
  const syncWorkspaceRegions = (layout) => {
    if (!layout) return;
    const host = gridHostForLayout(layout);
    const layoutKey = gridItemLayoutKey(layout);
    const profile = getActivePanelProfile(layoutKey);
    const contextDefinitions = loadWorkspaceContexts(layoutKey, profile);
    const contextByRegion = new Map(contextDefinitions.map((context) => [context.id, context]));
    let activeRegion = workspaceRootRegionId(layoutKey);
    visualGridOrder(globalGridItems(layout, { includePlaceholders: false })).forEach((item) => {
      ensureWorkspaceObjectMetadata(item);
      if (workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.divider) {
        activeRegion = workspaceRegionIdForDivider(item, layoutKey);
        item.dataset.contextScopeId = activeRegion;
        item.dataset.workspaceRegionId = activeRegion;
        item.dataset.contextRole = "semantic-boundary";
        item.dataset.navigationTargetId = activeRegion;
        const explicitContext = workspaceContextFromElement(item);
        if (explicitContext?.id) contextByRegion.set(activeRegion, { ...contextByRegion.get(activeRegion), ...explicitContext, id: activeRegion });
        return;
      }
      item.dataset.workspaceRegionId = activeRegion;
      item.dataset.contextInheritedFrom = activeRegion;
      if (workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.anchor && item.dataset.navigationTargetType === "workspace-region") {
        item.dataset.navigationTargetId = activeRegion;
      }
    });
    if (contextByRegion.size !== contextDefinitions.length || [...contextByRegion.values()].some((context, index) => context !== contextDefinitions[index])) {
      saveWorkspaceContexts(layoutKey, profile, [...contextByRegion.values()]);
    }
    host?.setAttribute("data-workspace-context-model", WORKSPACE_CONTEXT_MODEL_VERSION);
  };
  const committedContextRegionLayout = (layoutKey = "builder") => (
    document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`) ||
    document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`)
  );
  const isCommittedContextRegionItem = (item) => (
    item &&
    !item.hidden &&
    !item.classList.contains("db-panel-placeholder") &&
    !item.classList.contains("widget-placeholder") &&
    !item.classList.contains("dashboard-live-resize") &&
    !item.classList.contains("dashboard-resize-source") &&
    !item.classList.contains("db-panel-dragging") &&
    !item.classList.contains("widget-dragging")
  );
  const committedDividerRegionEntries = (layoutKey = "builder") => {
    const layout = committedContextRegionLayout(layoutKey);
    if (!layout) return [];
    syncWorkspaceRegions(layout);
    return visualGridOrder(globalGridItems(layout, { includePlaceholders: false }))
      .filter((item) => workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.divider)
      .filter(isCommittedContextRegionItem)
      .map((divider) => ({
        divider,
        key: workspaceObjectKey(divider),
        regionId: workspaceRegionIdForDivider(divider, layoutKey),
        bounds: gridBoundsForItem(divider),
      }));
  };
  const deriveWorkspaceContextRegions = (layoutKey = "builder") => {
    const dividers = committedDividerRegionEntries(layoutKey);
    const rootRegionId = workspaceRootRegionId(layoutKey);
    if (!dividers.length) {
      return [{
        id: rootRegionId,
        type: "context-region",
        layoutKey,
        dividerKey: null,
        startsAfterDividerKey: null,
        startRow: 1,
        endRow: null,
      }];
    }
    const rootEnd = Math.max(0, (Number(dividers[0].bounds.row) || 1) - 1);
    return [
      {
        id: rootRegionId,
        type: "context-region",
        layoutKey,
        dividerKey: null,
        startsAfterDividerKey: null,
        startRow: 1,
        endRow: rootEnd,
      },
      ...dividers.map((entry, index) => {
        const startRow = Math.max(1, Number(entry.bounds.row) || 1);
        const nextRow = Number(dividers[index + 1]?.bounds?.row) || null;
        return {
          id: entry.regionId,
          type: "context-region",
          layoutKey,
          dividerKey: entry.key,
          startsAfterDividerKey: entry.key,
          startRow,
          endRow: nextRow ? Math.max(startRow, nextRow - 1) : null,
        };
      }),
    ];
  };
  const gridRowFromContextRegionInput = (value, layoutKey = "builder") => {
    if (Number.isFinite(Number(value))) return Math.max(1, Math.round(Number(value)));
    const node = typeof value === "string" ? document.querySelector(value) : value;
    if (node?.nodeType === 1) return Math.max(1, Number(gridBoundsForItem(node).row) || 1);
    const layout = committedContextRegionLayout(layoutKey);
    return Math.max(1, Number(layout?.dataset?.visibleStartRow) || 1);
  };
  const nearestDividerAboveCommittedRow = (value, layoutKey = "builder") => {
    const row = gridRowFromContextRegionInput(value, layoutKey);
    return committedDividerRegionEntries(layoutKey)
      .filter((entry) => (Number(entry.bounds.row) || 1) <= row)
      .pop() || null;
  };
  const resolveWorkspaceRegionForY = (value, layoutKey = "builder") => {
    const row = gridRowFromContextRegionInput(value, layoutKey);
    return deriveWorkspaceContextRegions(layoutKey)
      .find((region) => row >= region.startRow && (region.endRow === null || row <= region.endRow)) ||
      { id: workspaceRootRegionId(layoutKey), type: "context-region", layoutKey, startRow: 1, endRow: null };
  };

  const allCommittedWorkspaceGridItems = (layoutKey = "builder") => {
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]:not(.panel-internal-widget-grid)`);
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    return [
      ...(widgetLayout ? globalGridItems(widgetLayout, { includePlaceholders: false }) : []),
      ...(panelLayout ? globalGridItems(panelLayout, { includePlaceholders: false }) : []),
    ].filter(isCommittedContextRegionItem);
  };

  const regionLabelForSummary = (regionId, layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    if (regionId === workspaceRootRegionId(layoutKey)) return "Top region";
    const divider = committedDividerRegionEntries(layoutKey)
      .find((entry) => entry.regionId === regionId)?.divider;
    const dividerLabel = divider?.querySelector?.(".db-panel-title, .divider-title, .stat-lbl")?.textContent?.trim();
    const contextLabel = contextById(layoutKey, profile, regionId)?.name;
    return dividerLabel || contextLabel || "Divider region";
  };

  const workspaceRegionSummaryForItem = (itemOrKey, options = {}) => {
    const item = typeof itemOrKey === "string"
      ? document.querySelector(`[data-widget-key="${CSS.escape(itemOrKey)}"], [data-panel-key="${CSS.escape(itemOrKey)}"]`)
      : itemOrKey;
    const layoutKey = options.layoutKey || activeLayoutKeyForItem(item) || "builder";
    const profile = options.profile || getActivePanelProfile(layoutKey);
    const regionId = item ? regionIdForWorkspaceItem(item) : workspaceRootRegionId(layoutKey);
    const regions = deriveWorkspaceContextRegions(layoutKey);
    const region = regions.find((entry) => entry.id === regionId) || resolveWorkspaceRegionForY(item, layoutKey);
    const items = allCommittedWorkspaceGridItems(layoutKey)
      .filter((candidate) => candidate !== item && regionIdForWorkspaceItem(candidate) === regionId);
    const counts = items.reduce((acc, candidate) => {
      const type = workspaceObjectType(candidate);
      if (type === WORKSPACE_OBJECT_TYPES.divider) acc.dividers += 1;
      else if (type === WORKSPACE_OBJECT_TYPES.panel) acc.panels += 1;
      else acc.widgets += 1;
      return acc;
    }, { widgets: 0, panels: 0, dividers: 0 });
    const anchors = [...document.querySelectorAll(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"] > .workspace-anchor-object`)]
      .filter((anchor) => {
        const linkedDividerId = anchor.dataset.linkedDividerId || "";
        if (!linkedDividerId) return regionId === workspaceRootRegionId(layoutKey);
        const divider = document.querySelector(`.workspace-divider[data-panel-key="${CSS.escape(linkedDividerId)}"], .workspace-divider[data-navigation-target-id="${CSS.escape(linkedDividerId)}"]`);
        return divider ? workspaceRegionIdForDivider(divider, layoutKey) === regionId : false;
      });
    const context = resolveWorkspaceContextForItem(item || committedContextRegionLayout(layoutKey), { layoutKey, profile });
    return {
      id: regionId,
      label: regionLabelForSummary(regionId, layoutKey, profile),
      startRow: region?.startRow || 1,
      endRow: region?.endRow || null,
      widgets: counts.widgets,
      panels: counts.panels,
      dividers: counts.dividers,
      anchors: anchors.length,
      totalObjects: counts.widgets + counts.panels + counts.dividers,
      dataSourceName: context?.dataSourceName || context?.dataSourceId || "",
      tags: Array.isArray(context?.tags) ? context.tags : [],
    };
  };

  const WORKSPACE_RELATIONSHIP_TYPES = Object.freeze({
    context: "context",
    filter: "filter",
    query: "query",
    containment: "containment",
    operator: "operator",
    semantic: "semantic",
  });
  const LOGICAL_OPERATOR_TYPES = Object.freeze({
    and: "AND",
    or: "OR",
    not: "NOT",
  });
  const STYLE_RULE_EFFECT_PROPERTIES = Object.freeze({
    accentColor: "accentColor",
    textColor: "textColor",
    backgroundTint: "backgroundTint",
    rimState: "rimState",
    iconState: "iconState",
    visibility: "visibility",
  });
  const LOGIC_COMPARISON_OPERATORS = new Set(["<", ">", "=", "!=", "<=", ">="]);
  const relationshipId = () => `relationship-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const operatorNodeId = () => `operator-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const styleRuleId = () => `style-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const styleRuleGraphId = (id) => `style-rule:${String(id || "")}`;
  const styleRuleIdFromGraphId = (id) => String(id || "").startsWith("style-rule:") ? String(id).slice("style-rule:".length) : "";
  const normalizeRelationshipType = (type) => (
    Object.values(WORKSPACE_RELATIONSHIP_TYPES).includes(type) ? type : WORKSPACE_RELATIONSHIP_TYPES.semantic
  );
  const normalizeLogicalOperatorType = (type) => {
    const normalized = String(type || "AND").toUpperCase();
    return Object.values(LOGICAL_OPERATOR_TYPES).includes(normalized) ? normalized : LOGICAL_OPERATOR_TYPES.and;
  };
  const normalizeWorkspaceRelationship = (relationship = {}) => ({
    id: String(relationship.id || relationshipId()),
    sourceId: String(relationship.sourceId || ""),
    targetId: String(relationship.targetId || ""),
    type: normalizeRelationshipType(relationship.type),
    visualState: String(relationship.visualState || "ambient"),
    label: String(relationship.label || ""),
    metadata: relationship.metadata && typeof relationship.metadata === "object" ? { ...relationship.metadata } : {},
  });
  const normalizeLogicalOperatorNode = (node = {}) => ({
    id: String(node.id || operatorNodeId()),
    operatorType: normalizeLogicalOperatorType(node.operatorType),
    inputs: Array.isArray(node.inputs) ? node.inputs.map(String).filter(Boolean) : [],
    outputs: Array.isArray(node.outputs) ? node.outputs.map(String).filter(Boolean) : [],
    x: Number.isFinite(Number(node.x)) ? Number(node.x) : Math.round(window.scrollX + (window.innerWidth * .5)),
    y: Number.isFinite(Number(node.y)) ? Number(node.y) : Math.round(window.scrollY + (window.innerHeight * .42)),
    label: String(node.label || node.operatorType || "AND"),
    collapsed: Boolean(node.collapsed),
  });
  const normalizeLogicExpression = (expression = {}) => {
    if (!expression || typeof expression !== "object") {
      return { type: "comparison", left: "metric.value", operator: ">", right: Number.POSITIVE_INFINITY };
    }
    const type = String(expression.type || "comparison").toLowerCase();
    if (type === "and") {
      return {
        type,
        inputs: Array.isArray(expression.inputs) ? expression.inputs.map(normalizeLogicExpression) : [],
      };
    }
    if (type === "or") {
      return {
        type,
        inputs: Array.isArray(expression.inputs) ? expression.inputs.map(normalizeLogicExpression) : [],
      };
    }
    if (type === "not") {
      return {
        type,
        input: normalizeLogicExpression(expression.input || {}),
      };
    }
    const operator = LOGIC_COMPARISON_OPERATORS.has(expression.operator) ? expression.operator : "=";
    return {
      type: "comparison",
      left: String(expression.left || "metric.value"),
      operator,
      right: expression.right,
    };
  };
  const normalizeStyleRuleEffect = (effect = {}) => {
    const property = Object.values(STYLE_RULE_EFFECT_PROPERTIES).includes(effect.property)
      ? effect.property
      : STYLE_RULE_EFFECT_PROPERTIES.accentColor;
    return {
      property,
      value: effect.value,
    };
  };
  const normalizeStyleRule = (rule = {}) => ({
    id: String(rule.id || styleRuleId()),
    targetObjectId: String(rule.targetObjectId || ""),
    condition: normalizeLogicExpression(rule.condition || {}),
    effects: Array.isArray(rule.effects) ? rule.effects.map(normalizeStyleRuleEffect) : [],
    label: String(rule.label || ""),
    enabled: rule.enabled !== false,
    metadata: rule.metadata && typeof rule.metadata === "object" ? { ...rule.metadata } : {},
  });
  const normalizeWorkspaceLogicGraph = (graph = {}) => ({
    version: 1,
    relationships: Array.isArray(graph.relationships)
      ? graph.relationships.map(normalizeWorkspaceRelationship).filter((relationship) => relationship.sourceId && relationship.targetId)
      : [],
    operators: Array.isArray(graph.operators)
      ? graph.operators.map(normalizeLogicalOperatorNode).filter((node) => node.id)
      : [],
    styleRules: Array.isArray(graph.styleRules)
      ? graph.styleRules.map(normalizeStyleRule).filter((rule) => rule.id && rule.targetObjectId && rule.effects.length)
      : [],
    contextLinks: Array.isArray(graph.contextLinks)
      ? graph.contextLinks.map(normalizeContextLink).filter((link) => link.id && link.sourceObjectId && link.targetObjectId)
      : [],
  });
  const persistedWorkspaceEndpointIds = (snapshot = {}) => new Set([
    ...(snapshot.widgets || []).map((widget) => widget.id),
    ...(snapshot.panels || []).map((panel) => panel.id),
    ...(snapshot.dividers || []).map((divider) => divider.id),
    ...(snapshot.anchors || []).map((anchor) => anchor.id),
    ...(snapshot.contexts || []).map((context) => context.id),
    ...(snapshot.operators || []).map((operator) => operator.id),
  ].map(String).filter(Boolean));
  const pruneWorkspaceLogicGraphForEndpointIds = (graph = {}, endpointIds = new Set()) => {
    const normalized = normalizeWorkspaceLogicGraph(graph);
    const hasEndpoint = (id) => endpointIds.has(String(id || ""));
    return normalizeWorkspaceLogicGraph({
      ...normalized,
      relationships: normalized.relationships.filter((relationship) => hasEndpoint(relationship.sourceId) && hasEndpoint(relationship.targetId)),
      operators: normalized.operators.map((operator) => ({
        ...operator,
        inputs: operator.inputs.filter(hasEndpoint),
        outputs: operator.outputs.filter(hasEndpoint),
      })),
      styleRules: normalized.styleRules.filter((rule) => hasEndpoint(rule.targetObjectId)),
      contextLinks: normalized.contextLinks.filter((link) => hasEndpoint(link.sourceObjectId) && hasEndpoint(link.targetObjectId)),
    });
  };
  const workspaceLogicGraphFromPersistedSnapshot = (snapshot = {}) => normalizeWorkspaceLogicGraph({
    relationships: snapshot.relationships || [],
    operators: snapshot.operators || [],
    styleRules: snapshot.styleRules || [],
    contextLinks: snapshot.contextLinks || [],
  });
  const loadWorkspaceLogicGraph = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
    normalizeWorkspaceLogicGraph(readJsonStore(workspaceLogicGraphKey(layoutKey, profile), { version: 1, relationships: [], operators: [], styleRules: [], contextLinks: [] }));
  const saveWorkspaceLogicGraph = (layoutKey = "builder", graph = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
    const normalized = normalizeWorkspaceLogicGraph(graph);
    writeJsonStore(workspaceLogicGraphKey(layoutKey, profile), normalized);
    if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
    if (options.event !== false) {
      emitWorkspaceEvent({
        type: "logic-graph-changed",
        source: "logic-graph",
        layoutKey,
        label: "Workspace logic graph changed",
        payload: {
          profile,
          relationshipCount: normalized.relationships.length,
          operatorCount: normalized.operators.length,
          styleRuleCount: normalized.styleRules.length,
          contextLinkCount: normalized.contextLinks.length,
        },
      });
    }
    refreshResolvedContextDebug(layoutKey, profile);
    refreshEngineerOverlays();
    return normalized;
  };
  const workspaceElementByGraphId = (id, layoutKey = "builder") => {
    const key = String(id || "");
    if (!key) return null;
    const escaped = CSS.escape(key);
    return document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] .widget-card[data-widget-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-panel-key="${escaped}"]`) ||
      document.querySelector(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"] .workspace-anchor-object[data-anchor-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-context-scope-id="${escaped}"], .panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-workspace-region-id="${escaped}"]`) ||
      null;
  };
  const graphIdForWorkspaceElement = (item) => workspaceObjectKey(item);
  const addUniqueRelationship = (relationships, relationship) => {
    const normalized = normalizeWorkspaceRelationship(relationship);
    if (!normalized.sourceId || !normalized.targetId || normalized.sourceId === normalized.targetId) return;
    const key = `${normalized.sourceId}->${normalized.targetId}:${normalized.type}`;
    if (relationships.some((entry) => `${entry.sourceId}->${entry.targetId}:${entry.type}` === key)) return;
    relationships.push(normalized);
  };
  const dividerKeyForRegion = (regionId, layoutKey = "builder") =>
    committedDividerRegionEntries(layoutKey).find((entry) => entry.regionId === regionId)?.key || "";
  const activeStyleRuleIdsForTarget = (targetId, layoutKey = "builder") => {
    const element = workspaceElementByGraphId(targetId, layoutKey);
    if (!element?.dataset?.activeStyleRuleIds) return new Set();
    return new Set(String(element.dataset.activeStyleRuleIds).split(",").map((id) => id.trim()).filter(Boolean));
  };
  const explicitWorkspaceRelationships = (graph = loadWorkspaceLogicGraph("builder")) => {
    const relationships = [];
    (graph.relationships || []).forEach((relationship) => addUniqueRelationship(relationships, relationship));

    graph.contextLinks.forEach((link) => {
      addUniqueRelationship(relationships, {
        id: `context-link-${link.id}`,
        sourceId: link.sourceObjectId,
        targetId: link.targetObjectId,
        type: WORKSPACE_RELATIONSHIP_TYPES.context,
        visualState: "active",
        label: link.mode,
        metadata: { mode: link.mode, contextLinkId: link.id },
      });
    });

    return relationships;
  };
  const deriveWorkspaceRelationships = (layoutKey = "builder", graph = loadWorkspaceLogicGraph(layoutKey)) => {
    const relationships = explicitWorkspaceRelationships(graph);

    const items = allCommittedWorkspaceGridItems(layoutKey);
    items.forEach((item) => {
      const itemId = graphIdForWorkspaceElement(item);
      if (!itemId || workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.divider) return;
      const regionId = regionIdForWorkspaceItem(item);
      const dividerKey = regionId === workspaceRootRegionId(layoutKey) ? "" : dividerKeyForRegion(regionId, layoutKey);
      if (dividerKey) {
        addUniqueRelationship(relationships, {
          id: `derived-context-${dividerKey}-${itemId}`,
          sourceId: dividerKey,
          targetId: itemId,
          type: WORKSPACE_RELATIONSHIP_TYPES.context,
          visualState: "ambient",
          label: "Context inheritance",
        });
      }
    });

    document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .db-panel:not([hidden])`).forEach((panel) => {
      const panelId = panel.dataset.panelKey || "";
      if (!panelId) return;
      panelChildWidgets(panel).forEach((child) => {
        const childId = child.dataset.widgetKey || "";
        addUniqueRelationship(relationships, {
          id: `derived-containment-${panelId}-${childId}`,
          sourceId: panelId,
          targetId: childId,
          type: WORKSPACE_RELATIONSHIP_TYPES.containment,
          visualState: "ambient",
          label: "Panel containment",
        });
      });
    });

    const widgets = [...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card:not([hidden]), .panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card:not([hidden])`)];
    const filterTypes = ["filter", "filter-control", "stat-filter", "search", "timeframe"];
    const filters = widgets.filter((widget) => filterTypes.some((type) => String(widget.dataset.widgetDefinition || widget.dataset.widgetType || "").includes(type)));
    filters.forEach((filterWidget) => {
      const sourceId = filterWidget.dataset.widgetKey || "";
      const regionId = regionIdForWorkspaceItem(filterWidget);
      widgets.forEach((targetWidget) => {
        const targetId = targetWidget.dataset.widgetKey || "";
        if (!sourceId || !targetId || targetWidget === filterWidget || regionIdForWorkspaceItem(targetWidget) !== regionId) return;
        if (filterTypes.some((type) => String(targetWidget.dataset.widgetDefinition || targetWidget.dataset.widgetType || "").includes(type))) return;
        addUniqueRelationship(relationships, {
          id: `derived-filter-${sourceId}-${targetId}`,
          sourceId,
          targetId,
          type: WORKSPACE_RELATIONSHIP_TYPES.filter,
          visualState: filterWidget.dataset.widgetRuntimeStatus === "ready" ? "active" : "ambient",
          label: "Filter propagation",
        });
      });
    });

    graph.operators.forEach((operator) => {
      operator.inputs.forEach((sourceId) => addUniqueRelationship(relationships, {
        id: `derived-operator-input-${sourceId}-${operator.id}`,
        sourceId,
        targetId: operator.id,
        type: WORKSPACE_RELATIONSHIP_TYPES.operator,
        visualState: "ambient",
        label: `${operator.operatorType} input`,
      }));
      operator.outputs.forEach((targetId) => addUniqueRelationship(relationships, {
        id: `derived-operator-output-${operator.id}-${targetId}`,
        sourceId: operator.id,
        targetId,
        type: WORKSPACE_RELATIONSHIP_TYPES.operator,
        visualState: "active",
        label: `${operator.operatorType} output`,
      }));
    });

    graph.styleRules.forEach((rule) => {
      const ruleNodeId = styleRuleGraphId(rule.id);
      const activeIds = activeStyleRuleIdsForTarget(rule.targetObjectId, layoutKey);
      const state = activeIds.has(rule.id) ? "active" : "ambient";
      addUniqueRelationship(relationships, {
        id: `derived-style-data-${rule.targetObjectId}-${rule.id}`,
        sourceId: rule.targetObjectId,
        targetId: ruleNodeId,
        type: WORKSPACE_RELATIONSHIP_TYPES.query,
        visualState: state,
        label: "Style rule input",
      });
      addUniqueRelationship(relationships, {
        id: `derived-style-effect-${rule.id}-${rule.targetObjectId}`,
        sourceId: ruleNodeId,
        targetId: rule.targetObjectId,
        type: WORKSPACE_RELATIONSHIP_TYPES.semantic,
        visualState: state,
        label: "Conditional style effect",
      });
    });

    return relationships;
  };
  const styleRuleEndpointPoint = (id, layoutKey, styleRules = []) => {
    const ruleId = styleRuleIdFromGraphId(id);
    if (!ruleId) return null;
    const rule = styleRules.find((entry) => entry.id === ruleId);
    if (!rule) return null;
    const target = workspaceElementByGraphId(rule.targetObjectId, layoutKey);
    if (!target || !target.isConnected || target.hidden) return null;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.left + Math.min(rect.width - 18, Math.max(18, rect.width * .72)),
      y: rect.top - 18,
      kind: "style-rule",
    };
  };
  const connectableWorkspaceElements = (layoutKey = "builder") => {
    const items = [
      ...allCommittedWorkspaceGridItems(layoutKey),
      ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card:not([hidden])`),
    ].filter((item, index, list) => (
      item?.isConnected &&
      !item.hidden &&
      list.indexOf(item) === index &&
      workspaceObjectType(item) !== WORKSPACE_OBJECT_TYPES.anchor &&
      !item.closest(".workspace-anchor-layer") &&
      !item.closest(".workspace-minimap-layer")
    ));
    return items;
  };
  const nodulePointForElement = (element) => {
    if (!element || !element.isConnected || element.hidden) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.left,
      y: rect.top + (rect.height / 2),
      rect,
    };
  };
  const relationshipEndpointPoint = (id, layoutKey, operators = [], styleRules = []) => {
    const operator = operators.find((node) => node.id === id);
    if (operator) {
      return {
        x: operator.x - window.scrollX,
        y: operator.y - window.scrollY,
        kind: "operator",
      };
    }
    const styleRulePoint = styleRuleEndpointPoint(id, layoutKey, styleRules);
    if (styleRulePoint) return styleRulePoint;
    const element = workspaceElementByGraphId(id, layoutKey);
    const point = nodulePointForElement(element);
    if (!point) return null;
    return {
      x: point.x,
      y: point.y,
      kind: workspaceObjectType(element),
    };
  };
  const createRelationshipSvgElement = (name, attrs = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };
  const workspaceWirePath = (source, target) => {
    const sx = Number(source?.x) || 0;
    const sy = Number(source?.y) || 0;
    const tx = Number(target?.x) || 0;
    const ty = Number(target?.y) || 0;
    const gutterX = Math.min(sx, tx) - Math.max(34, Math.min(96, Math.abs(tx - sx) * .28 + 36));
    if (Math.abs(ty - sy) < 16 && Math.abs(tx - sx) > 72) {
      const bendY = Math.min(window.innerHeight - 28, sy + 52);
      return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${gutterX.toFixed(1)} ${sy.toFixed(1)}, ${gutterX.toFixed(1)} ${bendY.toFixed(1)}, ${gutterX.toFixed(1)} ${bendY.toFixed(1)} C ${gutterX.toFixed(1)} ${bendY.toFixed(1)}, ${tx.toFixed(1)} ${bendY.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
    }
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${gutterX.toFixed(1)} ${sy.toFixed(1)}, ${gutterX.toFixed(1)} ${ty.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  };
  const renderWorkspaceRelationships = (layer, layoutKey = "builder") => {
    const graph = loadWorkspaceLogicGraph(layoutKey);
    const relationships = explicitWorkspaceRelationships(graph);
    const svg = createRelationshipSvgElement("svg", {
      class: "workspace-relationship-svg",
      "aria-hidden": "true",
      width: window.innerWidth,
      height: window.innerHeight,
      viewBox: `0 0 ${window.innerWidth} ${window.innerHeight}`,
    });
    relationships.forEach((relationship) => {
      const source = relationshipEndpointPoint(relationship.sourceId, layoutKey, graph.operators, graph.styleRules);
      const target = relationshipEndpointPoint(relationship.targetId, layoutKey, graph.operators, graph.styleRules);
      if (!source || !target) return;
      const min = -120;
      const maxX = window.innerWidth + 120;
      const maxY = window.innerHeight + 120;
      if ((source.x < min && target.x < min) || (source.x > maxX && target.x > maxX) || (source.y < min && target.y < min) || (source.y > maxY && target.y > maxY)) return;
      const path = createRelationshipSvgElement("path", {
        class: "workspace-relationship-path",
        "data-relationship-id": relationship.id,
        "data-relationship-type": relationship.type,
        "data-relationship-state": relationship.visualState || "ambient",
        "data-relationship-source-id": relationship.sourceId,
        "data-relationship-target-id": relationship.targetId,
        "data-relationship-label": relationship.label || "",
        d: workspaceWirePath(source, target),
      });
      svg.appendChild(path);
    });
    layer.appendChild(svg);

    graph.operators.forEach((operator) => {
      const top = operator.y - window.scrollY;
      const left = operator.x - window.scrollX;
      if (top < -80 || top > window.innerHeight + 80 || left < -120 || left > window.innerWidth + 120) return;
      const node = document.createElement("div");
      node.className = "workspace-operator-node";
      node.dataset.operatorType = operator.operatorType;
      node.dataset.operatorId = operator.id;
      node.style.left = `${Math.round(left)}px`;
      node.style.top = `${Math.round(top)}px`;
      node.textContent = operator.operatorType;
      layer.appendChild(node);
    });
  };
  let activeWorkspaceWireDrag = null;
  const cleanupWorkspaceWireDrag = () => {
    if (!activeWorkspaceWireDrag) return;
    activeWorkspaceWireDrag.previewSvg?.remove();
    activeWorkspaceWireDrag.sourceHandle?.classList.remove("workspace-wire-nodule-source");
    activeWorkspaceWireDrag.targetHandle?.classList.remove("workspace-wire-nodule-target");
    document.body.classList.remove("workspace-wire-drag-active");
    window.cancelAnimationFrame(activeWorkspaceWireDrag.frame || 0);
    window.removeEventListener("pointermove", activeWorkspaceWireDrag.onMove, true);
    window.removeEventListener("pointerup", activeWorkspaceWireDrag.onUp, true);
    window.removeEventListener("pointercancel", activeWorkspaceWireDrag.onCancel, true);
    window.removeEventListener("keydown", activeWorkspaceWireDrag.onKeyDown, true);
    window.removeEventListener("scroll", activeWorkspaceWireDrag.onScroll);
    window.removeEventListener("resize", activeWorkspaceWireDrag.onResize);
    activeWorkspaceWireDrag = null;
  };
  const createWorkspaceWirePreview = () => {
    const svg = createRelationshipSvgElement("svg", {
      class: "workspace-wire-drag-svg",
      "aria-hidden": "true",
      width: window.innerWidth,
      height: window.innerHeight,
      viewBox: `0 0 ${window.innerWidth} ${window.innerHeight}`,
    });
    const path = createRelationshipSvgElement("path", {
      class: "workspace-wire-drag-path",
      d: "",
    });
    svg.appendChild(path);
    document.body.appendChild(svg);
    return { svg, path };
  };
  const workspaceWireHandleFromPoint = (x, y) => {
    const target = document.elementFromPoint(x, y);
    return target?.closest?.(".workspace-wire-nodule") || null;
  };
  const commitWorkspaceWireConnection = (layoutKey, sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return null;
    const profile = getActivePanelProfile(layoutKey);
    const graph = loadWorkspaceLogicGraph(layoutKey, profile);
    const link = normalizeContextLink({
      sourceObjectId: sourceId,
      targetObjectId: targetId,
      mode: CONTEXT_LINK_MODES.inherit,
    });
    if (graph.contextLinks.some((entry) => entry.sourceObjectId === link.sourceObjectId && entry.targetObjectId === link.targetObjectId && entry.mode === link.mode)) {
      return null;
    }
    const existingRuntime = window.dashboardRelationshipRuntime?.addContextLink?.(layoutKey, link, profile);
    return existingRuntime;
  };
  const liveWorkspaceWireEndpointPoint = (objectId, layoutKey, fallbackHandle = null) => {
    const graph = loadWorkspaceLogicGraph(layoutKey);
    const point = relationshipEndpointPoint(objectId, layoutKey, graph.operators, graph.styleRules);
    if (point) return point;
    const rect = fallbackHandle?.isConnected ? fallbackHandle.getBoundingClientRect() : null;
    if (rect && rect.width > 0 && rect.height > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  };
  const startWorkspaceWireDrag = (event, handle, layoutKey = "builder") => {
    if (!isEngineerMode() || event.button !== 0) return;
    const sourceId = handle?.dataset?.wireObjectId || "";
    const initialSourcePoint = liveWorkspaceWireEndpointPoint(sourceId, layoutKey, handle);
    if (!sourceId) return;
    event.preventDefault();
    event.stopPropagation();
    cleanupWorkspaceWireDrag();
    const preview = createWorkspaceWirePreview();
    document.body.classList.add("workspace-wire-drag-active");
    handle.classList.add("workspace-wire-nodule-source");
    const dragState = {
      layoutKey,
      sourceId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      frame: 0,
      sourceHandle: handle,
      targetHandle: null,
      previewSvg: preview.svg,
      previewPath: preview.path,
      onMove: null,
      onUp: null,
      onCancel: null,
      onKeyDown: null,
      onScroll: null,
      onResize: null,
    };
    const updateTarget = (targetHandle) => {
      if (dragState.targetHandle === targetHandle) return;
      dragState.targetHandle?.classList.remove("workspace-wire-nodule-target");
      dragState.targetHandle = targetHandle;
      dragState.targetHandle?.classList.add("workspace-wire-nodule-target");
    };
    const updatePreview = (clientX = dragState.lastClientX, clientY = dragState.lastClientY) => {
      dragState.lastClientX = clientX;
      dragState.lastClientY = clientY;
      dragState.previewSvg.setAttribute("width", String(window.innerWidth));
      dragState.previewSvg.setAttribute("height", String(window.innerHeight));
      dragState.previewSvg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
      const sourcePoint = liveWorkspaceWireEndpointPoint(sourceId, layoutKey, dragState.sourceHandle) || initialSourcePoint;
      if (!sourcePoint) return;
      const targetHandle = workspaceWireHandleFromPoint(clientX, clientY);
      const validTarget = targetHandle && targetHandle.dataset.wireObjectId !== sourceId ? targetHandle : null;
      updateTarget(validTarget);
      const endPoint = validTarget
        ? {
          x: Number(validTarget.dataset.wireX) || clientX,
          y: Number(validTarget.dataset.wireY) || clientY,
        }
        : { x: clientX, y: clientY };
      dragState.previewPath.setAttribute("d", workspaceWirePath(sourcePoint, endPoint));
      dragState.previewPath.dataset.validTarget = validTarget ? "true" : "false";
    };
    const schedulePreviewUpdate = (clientX = dragState.lastClientX, clientY = dragState.lastClientY) => {
      dragState.lastClientX = clientX;
      dragState.lastClientY = clientY;
      window.cancelAnimationFrame(dragState.frame || 0);
      dragState.frame = window.requestAnimationFrame(() => {
        dragState.frame = 0;
        updatePreview();
      });
    };
    dragState.onMove = (moveEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      schedulePreviewUpdate(moveEvent.clientX, moveEvent.clientY);
    };
    dragState.onUp = (upEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      const targetHandle = workspaceWireHandleFromPoint(upEvent.clientX, upEvent.clientY);
      const targetId = targetHandle?.dataset?.wireObjectId || "";
      const valid = targetHandle && targetId && targetId !== sourceId;
      cleanupWorkspaceWireDrag();
      if (valid) commitWorkspaceWireConnection(layoutKey, sourceId, targetId);
    };
    dragState.onCancel = (cancelEvent) => {
      cancelEvent.preventDefault();
      cancelEvent.stopPropagation();
      cleanupWorkspaceWireDrag();
    };
    dragState.onKeyDown = (keyEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      cleanupWorkspaceWireDrag();
    };
    dragState.onScroll = () => schedulePreviewUpdate();
    dragState.onResize = () => schedulePreviewUpdate();
    activeWorkspaceWireDrag = dragState;
    window.addEventListener("pointermove", dragState.onMove, true);
    window.addEventListener("pointerup", dragState.onUp, true);
    window.addEventListener("pointercancel", dragState.onCancel, true);
    window.addEventListener("keydown", dragState.onKeyDown, true);
    window.addEventListener("scroll", dragState.onScroll, { passive: true });
    window.addEventListener("resize", dragState.onResize, { passive: true });
    updatePreview(event.clientX, event.clientY);
  };
  const renderWorkspaceWireNodules = (layer, layoutKey = "builder") => {
    const isolateWireHandleClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const setWireHoverTrace = (objectId = "") => {
      document.querySelectorAll(".workspace-relationship-path").forEach((path) => {
        const connected = objectId && (
          path.dataset.relationshipSourceId === objectId ||
          path.dataset.relationshipTargetId === objectId
        );
        if (!objectId) {
          delete path.dataset.relationshipHighlight;
        } else {
          path.dataset.relationshipHighlight = connected ? "connected" : "unrelated";
        }
      });
    };
    const bindWireHoverTrace = (handle) => {
      const objectId = handle.dataset.wireObjectId || "";
      handle.addEventListener("pointerenter", () => setWireHoverTrace(objectId));
      handle.addEventListener("focus", () => setWireHoverTrace(objectId));
      handle.addEventListener("pointerleave", () => setWireHoverTrace(""));
      handle.addEventListener("blur", () => setWireHoverTrace(""));
    };
    connectableWorkspaceElements(layoutKey).forEach((item) => {
      const objectId = graphIdForWorkspaceElement(item);
      const point = nodulePointForElement(item);
      if (!objectId || !point) return;
      if (point.rect.bottom < -40 || point.rect.top > window.innerHeight + 40) return;
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "workspace-wire-nodule";
      handle.dataset.wireObjectId = objectId;
      handle.dataset.wireObjectType = workspaceObjectType(item);
      handle.dataset.wireX = String(point.x);
      handle.dataset.wireY = String(point.y);
      handle.setAttribute("aria-label", `Create relationship from ${objectId}`);
      handle.title = "Create relationship";
      handle.style.left = `${Math.round(point.x)}px`;
      handle.style.top = `${Math.round(point.y)}px`;
      handle.addEventListener("pointerdown", (event) => startWorkspaceWireDrag(event, handle, layoutKey));
      handle.addEventListener("click", isolateWireHandleClick);
      bindWireHoverTrace(handle);
      layer.appendChild(handle);
    });
    loadWorkspaceLogicGraph(layoutKey).operators.forEach((operator) => {
      const point = relationshipEndpointPoint(operator.id, layoutKey, [operator]);
      if (!point) return;
      if (point.y < -40 || point.y > window.innerHeight + 40 || point.x < -40 || point.x > window.innerWidth + 40) return;
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "workspace-wire-nodule workspace-wire-nodule-operator";
      handle.dataset.wireObjectId = operator.id;
      handle.dataset.wireObjectType = "operator";
      handle.dataset.wireX = String(point.x);
      handle.dataset.wireY = String(point.y);
      handle.setAttribute("aria-label", `Create relationship from ${operator.operatorType} operator`);
      handle.title = "Create relationship";
      handle.style.left = `${Math.round(point.x)}px`;
      handle.style.top = `${Math.round(point.y)}px`;
      handle.addEventListener("pointerdown", (event) => startWorkspaceWireDrag(event, handle, layoutKey));
      handle.addEventListener("click", isolateWireHandleClick);
      bindWireHoverTrace(handle);
      layer.appendChild(handle);
    });
  };
  const renderWorkspaceLogicToolbox = (layer, layoutKey = "builder") => {
    const toolbox = document.createElement("section");
    toolbox.className = "workspace-logic-toolbox";
    toolbox.setAttribute("aria-label", "Logical operator tools");
    toolbox.innerHTML = `
      <strong>Logic</strong>
      ${Object.values(LOGICAL_OPERATOR_TYPES).map((type) => `<button type="button" data-operator-type="${type}">${type}</button>`).join("")}
    `;
    toolbox.querySelectorAll("button[data-operator-type]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const type = button.dataset.operatorType || "AND";
        const graph = loadWorkspaceLogicGraph(layoutKey);
        const operator = normalizeLogicalOperatorNode({
          operatorType: type,
          x: window.scrollX + Math.round(window.innerWidth * .5),
          y: window.scrollY + Math.round(window.innerHeight * .36),
        });
        saveWorkspaceLogicGraph(layoutKey, { ...graph, operators: [...graph.operators, operator] }, getActivePanelProfile(layoutKey));
      });
    });
    layer.appendChild(toolbox);
  };

  const clampMinimapValue = (value, min, max) => Math.max(min, Math.min(max, value));
  const createMinimapSvgElement = (name, attrs = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  const minimapLayoutGeometry = (layoutKey = "builder") => {
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]:not(.panel-internal-widget-grid)`);
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    const layout = widgetLayout || panelLayout;
    const host = document.querySelector(`.dashboard-layout-grid[data-dashboard-layout-key="${CSS.escape(layoutKey)}"]`) || gridHostForLayout(layout);
    if (!layout || !host) return null;
    const metrics = createGridMetrics(layout);
    const items = allCommittedWorkspaceGridItems(layoutKey);
    const maxBottom = Math.max(1, ...items.map((item) => gridBoundsForItem(item, metrics).bottom));
    const worldWidth = Math.max(1, metrics.width);
    const worldHeight = Math.max(
      gridHeightForRows(maxBottom, metrics.gap, metrics.rowHeight),
      window.innerHeight,
      host.getBoundingClientRect().height || 1
    );
    return { layout, host, metrics, items, worldWidth, worldHeight };
  };

  const renderWorkspaceMinimap = (layer) => {
    if (!layer) return;
    const layoutKey = layer.dataset.minimapLayoutKey || "builder";
    const svg = layer.querySelector(".workspace-minimap-svg");
    if (!svg) return;
    layer.classList.toggle("workspace-minimap-engineer-visible", isEngineerMode());
    if (!isEngineerMode()) return;
    const geometry = minimapLayoutGeometry(layoutKey);
    svg.replaceChildren();
    if (!geometry) return;
    const mapWidth = 160;
    const mapHeight = 240;
    const { metrics, items, worldWidth, worldHeight, host } = geometry;
    const scaleX = mapWidth / worldWidth;
    const scaleY = mapHeight / worldHeight;
    const addRect = (attrs) => svg.appendChild(createMinimapSvgElement("rect", attrs));

    deriveWorkspaceContextRegions(layoutKey).forEach((region, index) => {
      if (region.endRow === null && index > 0) return;
      const start = Math.max(0, ((Number(region.startRow) || 1) - 1) * metrics.rowStep);
      const end = region.endRow === null
        ? worldHeight
        : Math.max(start + metrics.rowHeight, (Number(region.endRow) || Number(region.startRow) || 1) * metrics.rowStep);
      addRect({
        class: `workspace-minimap-region ${region.id === workspaceRootRegionId(layoutKey) ? "workspace-minimap-region-root" : ""}`,
        x: 0,
        y: clampMinimapValue(start * scaleY, 0, mapHeight),
        width: mapWidth,
        height: clampMinimapValue((end - start) * scaleY, 1, mapHeight),
      });
    });

    items.forEach((item) => {
      const bounds = gridBoundsForItem(item, metrics);
      const type = workspaceObjectType(item);
      const left = (bounds.col - 1) * metrics.columnStep;
      const top = (bounds.row - 1) * metrics.rowStep;
      const width = (bounds.span * metrics.columnWidth) + (Math.max(0, bounds.span - 1) * metrics.gap);
      const height = (bounds.rowSpan * metrics.rowHeight) + (Math.max(0, bounds.rowSpan - 1) * metrics.gap);
      addRect({
        class: `workspace-minimap-object workspace-minimap-object-${type}`,
        x: clampMinimapValue(left * scaleX, 1, mapWidth - 2),
        y: clampMinimapValue(top * scaleY, 1, mapHeight - 2),
        width: clampMinimapValue(width * scaleX, type === WORKSPACE_OBJECT_TYPES.divider ? 2 : 3, mapWidth),
        height: clampMinimapValue(height * scaleY, type === WORKSPACE_OBJECT_TYPES.divider ? 2 : 3, mapHeight),
        rx: type === WORKSPACE_OBJECT_TYPES.divider ? 1 : 2,
      });
    });

    const anchors = [...document.querySelectorAll(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"] > .workspace-anchor-object`)];
    anchors.forEach((anchor, index) => {
      const offset = Number(anchor.dataset.anchorOffset || anchor.style.getPropertyValue("--anchor-offset").replace("px", "")) || (120 + (index * 44));
      svg.appendChild(createMinimapSvgElement("circle", {
        class: "workspace-minimap-anchor-dot",
        cx: 5,
        cy: clampMinimapValue((offset / Math.max(window.innerHeight, 1)) * mapHeight, 5, mapHeight - 5),
        r: 2.6,
      }));
    });

    const hostTop = host.getBoundingClientRect().top + window.scrollY;
    const navBottom = document.querySelector(".app-nav")?.getBoundingClientRect().bottom || 0;
    const visibleTop = Math.max(0, window.scrollY + navBottom + 8 - hostTop);
    const visibleBottom = Math.max(visibleTop + 1, window.scrollY + window.innerHeight - hostTop);
    addRect({
      class: "workspace-minimap-viewport",
      x: 1,
      y: clampMinimapValue(visibleTop * scaleY, 1, mapHeight - 4),
      width: mapWidth - 2,
      height: clampMinimapValue((visibleBottom - visibleTop) * scaleY, 8, mapHeight),
      rx: 3,
    });
    layer.dataset.minimapWorldHeight = String(worldHeight);
  };

  refreshWorkspaceMiniMaps = (layoutKey = null) => {
    const selector = layoutKey
      ? `.workspace-minimap-layer[data-minimap-layout-key="${CSS.escape(layoutKey)}"]`
      : ".workspace-minimap-layer";
    document.querySelectorAll(selector).forEach((layer) => {
      window.cancelAnimationFrame(layer.__minimapFrame || 0);
      layer.__minimapFrame = window.requestAnimationFrame(() => renderWorkspaceMinimap(layer));
    });
  };

  const setWorkspaceMinimapCollapsed = (layer, collapsed) => {
    if (!layer) return;
    layer.classList.toggle("workspace-minimap-collapsed", Boolean(collapsed));
    layer.querySelector(".workspace-minimap-toggle")?.setAttribute("aria-pressed", (!collapsed).toString());
    try {
      localStorage.setItem(`dashboard-minimap-collapsed:${layer.dataset.minimapLayoutKey || "builder"}`, collapsed ? "1" : "0");
    } catch {}
    refreshWorkspaceMiniMaps(layer.dataset.minimapLayoutKey || "builder");
  };

  const initWorkspaceMinimapLayer = (layer) => {
    if (!layer || layer.dataset.minimapInitialized === "true") return;
    layer.dataset.minimapInitialized = "true";
    const layoutKey = layer.dataset.minimapLayoutKey || "builder";
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(`dashboard-minimap-collapsed:${layoutKey}`) === "1";
    } catch {}
    setWorkspaceMinimapCollapsed(layer, collapsed);
    layer.querySelector(".workspace-minimap-collapse")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setWorkspaceMinimapCollapsed(layer, true);
    });
    layer.querySelector(".workspace-minimap-toggle")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setWorkspaceMinimapCollapsed(layer, false);
    });
    layer.querySelector(".workspace-minimap-svg")?.addEventListener("click", (event) => {
      if (!isEngineerMode()) return;
      event.preventDefault();
      event.stopPropagation();
      const geometry = minimapLayoutGeometry(layoutKey);
      if (!geometry) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const y = clampMinimapValue(event.clientY - rect.top, 0, rect.height);
      const worldY = (y / Math.max(rect.height, 1)) * geometry.worldHeight;
      const hostTop = geometry.host.getBoundingClientRect().top + window.scrollY;
      const navBottom = document.querySelector(".app-nav")?.getBoundingClientRect().bottom || 0;
      const targetTop = Math.max(0, hostTop + worldY - navBottom - 16);
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      window.scrollTo({ top: targetTop, behavior: reducedMotion ? "auto" : "smooth" });
    });
    const observer = new MutationObserver(() => refreshWorkspaceMiniMaps(layoutKey));
    const dashboard = document.querySelector(`.dashboard-layout-grid[data-dashboard-layout-key="${CSS.escape(layoutKey)}"]`);
    if (dashboard) observer.observe(dashboard, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "data-grid-col", "data-grid-row", "data-current-span", "data-grid-row-span", "hidden"] });
    layer.__minimapObserver = observer;
    refreshWorkspaceMiniMaps(layoutKey);
  };

  const engineerObjectLabel = (item) => {
    const type = workspaceObjectType(item);
    const id = item.dataset.widgetKey || item.dataset.panelKey || item.dataset.anchorKey || "unknown";
    const domain = item.closest(".workspace-anchor-layer")
      ? "anchor-rail"
      : isPanelInternalGridItem(item)
        ? "panel-grid"
        : type === WORKSPACE_OBJECT_TYPES.widget
          ? "global-widget-grid"
          : "global-panel-grid";
    const parent = item.dataset.parentPanelKey || item.closest(".db-panel")?.dataset.panelKey || "";
    const lod = item.dataset.visualLod || item.dataset.lod || "";
    return [
      `${type}:${id}`,
      domain,
      parent ? `parent:${parent}` : "",
      lod ? `lod:${lod}` : "",
    ].filter(Boolean).join(" | ");
  };

  const ensureEngineerOverlayLayer = () => {
    let layer = document.querySelector(".workspace-engineer-overlay-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "workspace-engineer-overlay-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    return layer;
  };

  const renderEngineerRegionBands = (layer, layoutKey = "builder") => {
    const geometry = minimapLayoutGeometry(layoutKey);
    if (!geometry) return;
    const { host, metrics, worldHeight } = geometry;
    const hostRect = host.getBoundingClientRect();
    deriveWorkspaceContextRegions(layoutKey).forEach((region) => {
      const top = hostRect.top + ((Math.max(1, Number(region.startRow) || 1) - 1) * metrics.rowStep);
      const endRow = region.endRow == null
        ? Math.max(Number(region.startRow) || 1, Math.ceil(worldHeight / metrics.rowStep))
        : Number(region.endRow) || Number(region.startRow) || 1;
      const height = Math.max(18, ((endRow - (Number(region.startRow) || 1) + 1) * metrics.rowStep) - metrics.gap);
      const band = document.createElement("div");
      band.className = "workspace-engineer-region-band";
      band.dataset.regionId = region.id || "";
      band.style.left = `${Math.round(hostRect.left)}px`;
      band.style.top = `${Math.round(top)}px`;
      band.style.width = `${Math.round(hostRect.width)}px`;
      band.style.height = `${Math.round(height)}px`;
      band.textContent = regionLabelForSummary(region.id, layoutKey);
      layer.appendChild(band);
    });
  };

  const renderEngineerObjectChips = (layer, layoutKey = "builder") => {
    const items = [
      ...allCommittedWorkspaceGridItems(layoutKey),
      ...document.querySelectorAll(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"] > .workspace-anchor-object:not([hidden])`),
      ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card:not([hidden])`),
    ].filter((item, index, list) => item?.isConnected && !item.hidden && list.indexOf(item) === index);
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (rect.bottom < -60 || rect.top > window.innerHeight + 60) return;
      const chip = document.createElement("div");
      chip.className = "workspace-engineer-object-chip";
      chip.dataset.objectType = workspaceObjectType(item);
      chip.textContent = engineerObjectLabel(item);
      chip.style.left = `${Math.round(Math.max(8, rect.left + 6))}px`;
      chip.style.top = `${Math.round(Math.max(88, rect.top + 6))}px`;
      layer.appendChild(chip);
      const outline = document.createElement("div");
      outline.className = "workspace-engineer-object-outline";
      outline.dataset.objectType = workspaceObjectType(item);
      outline.style.left = `${Math.round(rect.left)}px`;
      outline.style.top = `${Math.round(rect.top)}px`;
      outline.style.width = `${Math.round(rect.width)}px`;
      outline.style.height = `${Math.round(rect.height)}px`;
      layer.appendChild(outline);
    });
  };

  const renderEngineerDiagnosticsPanel = (layer, layoutKey = "builder") => {
    const events = recentWorkspaceEvents({ layoutKey, maxItems: 5 });
    const queryStats = {
      cache: widgetQueryCache.size,
      inflight: widgetQueryInflight.size,
    };
    const lodCounts = [...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card:not([hidden]), .panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .db-panel:not([hidden])`)]
      .reduce((counts, item) => {
        const lod = item.dataset.visualLod || "unset";
        counts[lod] = (counts[lod] || 0) + 1;
        return counts;
      }, {});
    const anchors = document.querySelectorAll(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"] > .workspace-anchor-object:not([hidden])`).length;
    const panelChildren = document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card:not([hidden])`).length;
    const graph = loadWorkspaceLogicGraph(layoutKey);
    const relationships = deriveWorkspaceRelationships(layoutKey, graph);
    const panel = document.createElement("section");
    panel.className = "workspace-engineer-diagnostics";
    panel.setAttribute("aria-label", "Engineer diagnostics");
    panel.innerHTML = `
      <strong>Engineer Mode</strong>
      <span>events ${workspaceEvents.length} | query cache ${queryStats.cache} | inflight ${queryStats.inflight}</span>
      <span>anchors ${anchors} | panel children ${panelChildren}</span>
      <span>relationships ${relationships.length} | operators ${graph.operators.length}</span>
      <span>LOD ${Object.entries(lodCounts).map(([key, value]) => `${key}:${value}`).join(" ") || "none"}</span>
      <ol>${events.map((event) => `<li>${escapeHtml(event.type)}</li>`).join("")}</ol>
    `;
    layer.appendChild(panel);
  };

  let engineerOverlayFrame = null;
  const renderEngineerOverlays = () => {
    const layer = ensureEngineerOverlayLayer();
    layer.replaceChildren();
    layer.hidden = !isEngineerMode();
    if (!isEngineerMode()) return;
    const layoutKey = document.querySelector(".panel-layout")?.dataset.layoutKey || "builder";
    renderWorkspaceRelationships(layer, layoutKey);
    renderWorkspaceWireNodules(layer, layoutKey);
  };

  refreshEngineerOverlays = () => {
    window.cancelAnimationFrame(engineerOverlayFrame || 0);
    engineerOverlayFrame = window.requestAnimationFrame(renderEngineerOverlays);
  };
  window.addEventListener("scroll", () => {
    if (isEngineerMode()) refreshEngineerOverlays();
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (isEngineerMode()) refreshEngineerOverlays();
  }, { passive: true });

  const gridItemMinimumSpan = (item) => {
    const explicit = Number(item?.dataset?.minW || item?.dataset?.minSpan);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(6, Math.ceil(explicit)));
    if (item?.dataset?.widgetType === "controls" || item?.classList?.contains("timeframe-widget")) return 2;
    return 1;
  };

  const gridItemMinimumRows = (item) => {
    const explicit = Number(item?.dataset?.minH || item?.dataset?.minRows);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.ceil(explicit));
    return 1;
  };

  const gridItemLayoutKey = (layout) => {
    if (isPanelInternalWidgetLayout(layout)) {
      return panelForInternalWidgetLayout(layout)?.closest?.(".panel-layout")?.dataset.layoutKey || "default";
    }
    return layout?.dataset.widgetLayoutKey || layout?.dataset.layoutKey || "default";
  };

  const saveSharedGridLayouts = (layout) => {
    const host = gridHostForLayout(layout);
    const key = gridItemLayoutKey(layout);
    if (layout?.classList?.contains("widget-layout")) {
      saveWidgetLayouts(layout);
      const panelLayout = host?.querySelector?.(`.panel-layout[data-layout-key="${CSS.escape(key)}"]`);
      if (panelLayout) savePanelLayouts(panelLayout);
    } else {
      savePanelLayouts(layout);
      const widgetLayout = host?.querySelector?.(`.widget-layout[data-widget-layout-key="${CSS.escape(key)}"]`);
      if (widgetLayout) saveWidgetLayouts(widgetLayout);
    }
  };

  const panelMinimumRows = (panel, metrics = null) => {
    if (!workspaceObjectCapabilities(panel).hasPanelContentArea) return 1;
    if (panel.classList.contains("db-panel-collapsed")) return 1;
    if (metrics?.panelMinimumRows?.has(panel)) return metrics.panelMinimumRows.get(panel);
    const layout = panel.closest(".panel-layout");
    const rows = gridRowsFromHeight(getPanelMinimumHeight(panel), metrics?.gap ?? gridGapForLayout(layout), 1);
    metrics?.panelMinimumRows?.set(panel, rows);
    return rows;
  };

  const panelExpandedMinimumRows = (panel, layout = panel.closest(".panel-layout"), metrics = null) => (
    !workspaceObjectCapabilities(panel).hasExpandedFootprint ? 1 :
    gridRowsFromHeight(getPanelMinimumHeight(panel), metrics?.gap ?? gridGapForLayout(layout), 1)
  );

  const gridItemRowSpan = (item, metrics = null) => {
    if (item.classList.contains("widget-card") || item.classList.contains("widget-placeholder")) {
      const minRows = gridItemMinimumRows(item);
      const explicitRows = Number(item.dataset.gridRowSpan);
      if (Number.isFinite(explicitRows) && explicitRows > 0) return Math.max(minRows, Math.round(explicitRows));
      return minRows;
    }
    if (!workspaceObjectCapabilities(item).hasPanelContentArea && !item.classList.contains("db-panel-placeholder")) return 1;
    if (item.classList.contains("db-panel-collapsed")) return 1;
    if (item.classList.contains("db-panel-placeholder") && Number(item.dataset.gridRowSpan) === 1) return 1;
    const layout = item.closest(".panel-layout");
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const minRows = item.classList.contains("db-panel-placeholder") ? 1 : panelMinimumRows(item, metrics);
    const explicitRows = Number(item.dataset.gridRowSpan);
    if (Number.isFinite(explicitRows) && explicitRows > 0) return Math.max(minRows, Math.round(explicitRows));
    const measuredHeight = Number(item.dataset.savedHeight) || item.getBoundingClientRect().height || DASHBOARD_GRID_ROW_HEIGHT;
    const rows = gridRowsFromHeight(measuredHeight, gap, minRows);
    return Math.max(minRows, Math.round(rows));
  };

  const syncPanelRenderedHeightToFootprint = (panel, rowSpan = null) => {
    if (!panel?.classList?.contains("db-panel") || panel.classList.contains("db-panel-placeholder")) return;
    if (!workspaceObjectCapabilities(panel).hasPanelContentArea) {
      panel.dataset.gridRowSpan = "1";
      panel.style.height = "";
      return;
    }
    if (panel.classList.contains("db-panel-collapsed")) {
      panel.style.height = "";
      return;
    }
    const layout = panel.closest(".panel-layout");
    const rows = Math.max(panelMinimumRows(panel), Math.round(Number(rowSpan) || gridItemRowSpan(panel)));
    const height = gridHeightForRows(rows, gridGapForLayout(layout));
    panel.dataset.gridRowSpan = String(rows);
    panel.dataset.savedHeight = String(height);
    panel.style.height = `${height}px`;
  };

  const applyPanelSpan = (panel, span) => {
    const rawSpan = Number(span) || Number(panel.dataset.defaultSpan) || 6;
    const minSpan = gridItemMinimumSpan(panel);
    const safeSpan = Math.max(minSpan, Math.min(6, rawSpan > 6 ? rawSpan / 2 : rawSpan));
    const displaySpan = Math.round(safeSpan);
    panel.dataset.currentSpan = String(displaySpan);
    if (panel.dataset.gridCol && panel.dataset.gridRow) {
      const currentCol = Number(panel.dataset.gridCol) || 1;
      const currentRow = Number(panel.dataset.gridRow) || 1;
      const safeCol = Math.max(1, Math.min(7 - displaySpan, currentCol));
      panel.dataset.gridCol = String(safeCol);
      panel.dataset.gridRow = String(Math.max(1, currentRow));
      panel.style.gridColumn = `${safeCol} / span ${displaySpan}`;
      panel.style.gridRow = `${panel.dataset.gridRow} / span ${gridItemRowSpan(panel)}`;
    } else {
      panel.style.gridColumn = `span ${displaySpan}`;
      panel.style.removeProperty("grid-row");
    }
    panel.style.removeProperty("width");
    panel.style.removeProperty("--panel-basis");
  };

  const applyPanelGridPosition = (panel, col, row) => {
    const span = Number(panel.dataset.currentSpan) || Number(panel.dataset.defaultSpan) || 6;
    const safeSpan = Math.max(1, Math.min(6, Math.round(span > 6 ? span / 2 : span)));
    const safeCol = Math.max(1, Math.min(7 - safeSpan, Math.round(Number(col) || 1)));
    const safeRow = Math.max(1, Math.round(Number(row) || 1));
    const rowSpan = gridItemRowSpan(panel);
    panel.dataset.gridCol = String(safeCol);
    panel.dataset.gridRow = String(safeRow);
    panel.dataset.gridRowSpan = String(rowSpan);
    panel.style.gridColumn = `${safeCol} / span ${safeSpan}`;
    panel.style.gridRow = `${safeRow} / span ${rowSpan}`;
    syncPanelRenderedHeightToFootprint(panel, rowSpan);
  };

  const gridCellFromPoint = (layout, item, clientX, clientY, metrics = null) => {
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const columnWidth = metrics?.columnWidth ?? ((Math.max(1, layoutRect.width) - (gap * 5)) / 6);
    const span = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    const safeSpan = Math.max(1, Math.min(6, Math.round(span > 6 ? span / 2 : span)));
    const itemWidth = (columnWidth * safeSpan) + (Math.max(0, safeSpan - 1) * gap);
    const col = Math.round((clientX - layoutRect.left - (itemWidth / 2)) / (columnWidth + gap)) + 1;
    const rowSpan = gridItemRowSpan(item, metrics);
    const rowHeight = metrics?.rowHeight || DASHBOARD_GRID_ROW_HEIGHT;
    const itemHeight = gridHeightForRows(rowSpan, gap, rowHeight);
    const row = Math.round((clientY - layoutRect.top - (itemHeight / 2)) / (rowHeight + gap)) + 1;
    return {
      col: Math.max(1, Math.min(7 - safeSpan, col)),
      row: Math.max(1, row),
    };
  };

  const gridCellFromDragPointer = (layout, item, clientX, clientY, offsetX, offsetY, metrics = null, dragRect = null) => {
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
      return gridCellFromPoint(layout, item, clientX, clientY, metrics);
    }
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const columnWidth = metrics?.columnWidth ?? ((Math.max(1, layoutRect.width) - (gap * 5)) / 6);
    const span = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    const safeSpan = Math.max(1, Math.min(6, Math.round(span > 6 ? span / 2 : span)));
    const itemWidth = (columnWidth * safeSpan) + (Math.max(0, safeSpan - 1) * gap);
    const rowSpan = gridItemRowSpan(item, metrics);
    const rowHeight = metrics?.rowHeight || DASHBOARD_GRID_ROW_HEIGHT;
    const itemHeight = gridHeightForRows(rowSpan, gap, rowHeight);
    const sourceWidth = Math.max(1, dragRect?.width || itemWidth);
    const sourceHeight = Math.max(1, dragRect?.height || itemHeight);
    const localOffsetX = Math.max(0, Math.min(1, offsetX / sourceWidth)) * itemWidth;
    const localOffsetY = Math.max(0, Math.min(1, offsetY / sourceHeight)) * itemHeight;
    return gridCellFromPoint(
      layout,
      item,
      (clientX - localOffsetX) + (itemWidth / 2),
      (clientY - localOffsetY) + (itemHeight / 2),
      metrics
    );
  };

  const panelGridCellFromPoint = (layout, panel, clientX, clientY) => gridCellFromPoint(layout, panel, clientX, clientY);

  const spanFromAlignedWidth = (layout, width, gap, minSpan, metrics = null) => {
    const layoutWidth = metrics?.width ?? Math.max(1, gridRectForLayout(layout).width);
    const columnCount = (layout.classList.contains("widget-layout") || layout.classList.contains("panel-layout")) ? 6 : 12;
    const columnWidth = (layoutWidth - (gap * (columnCount - 1))) / columnCount;
    return Math.max(minSpan, Math.min(columnCount, (Math.max(1, width) + gap) / (columnWidth + gap)));
  };

  const alignedResizeSpan = ({ layout, item, currentSpan, gap, minSpan, metrics = null }) => {
    const rect = item.getBoundingClientRect();
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const tolerance = 18;
    const candidates = [{ edge: layoutRect.right, priority: 1 }];
    document.querySelectorAll(".widget-layout > .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])").forEach((target) => {
      if (target === item || target.hidden) return;
      const targetRect = target.getBoundingClientRect();
      if (Math.abs(targetRect.top - rect.top) < 8 && Math.abs(targetRect.left - rect.left) < 8) return;
      candidates.push({ edge: targetRect.right, priority: 2 });
      candidates.push({ edge: targetRect.left, priority: 3 });
    });
    const match = candidates
      .map((candidate) => ({
        ...candidate,
        distance: Math.abs(rect.right - candidate.edge),
      }))
      .filter((candidate) => candidate.distance <= tolerance && candidate.edge > rect.left + 24)
      .sort((a, b) => a.distance - b.distance || a.priority - b.priority)[0];
    if (!match) return Math.round(currentSpan);
    return spanFromAlignedWidth(layout, match.edge - rect.left, gap, minSpan, metrics);
  };

  const groupedWidgetReleaseSpan = (currentSpan, groupCount) => {
    if (groupCount <= 1) return null;
    const fillSpan = 6 / groupCount;
    const nearestInteger = Math.round(currentSpan);
    const fillDistance = Math.abs(currentSpan - fillSpan);
    const integerDistance = Math.abs(currentSpan - nearestInteger);
    if ((currentSpan * groupCount > 6) || fillDistance <= Math.max(.18, integerDistance + .08)) {
      return fillSpan;
    }
    return null;
  };

  const groupedPanelReleaseSpan = (currentSpan, groupCount) => {
    if (groupCount <= 1) return null;
    const fillSpan = 6 / groupCount;
    const nearestInteger = Math.round(currentSpan);
    const fillDistance = Math.abs(currentSpan - fillSpan);
    const integerDistance = Math.abs(currentSpan - nearestInteger);
    if ((currentSpan * groupCount > 6) || fillDistance <= Math.max(.18, integerDistance + .08)) {
      return fillSpan;
    }
    return null;
  };

  const visualDropPlacement = (targets, clientX, clientY) => {
    if (targets.length < 2) return null;
    const rows = [];
    targets
      .map((item) => ({ item, rect: item.getBoundingClientRect() }))
      .sort((a, b) => Math.abs(a.rect.top - b.rect.top) > 12 ? a.rect.top - b.rect.top : a.rect.left - b.rect.left)
      .forEach((entry) => {
        const row = rows.find((candidate) => Math.abs(candidate.top - entry.rect.top) < 18);
        if (row) {
          row.items.push(entry);
          row.top = Math.min(row.top, entry.rect.top);
          row.bottom = Math.max(row.bottom, entry.rect.bottom);
        } else {
          rows.push({ top: entry.rect.top, bottom: entry.rect.bottom, items: [entry] });
        }
      });
    rows.forEach((row) => row.items.sort((a, b) => a.rect.left - b.rect.left));
    rows.sort((a, b) => a.top - b.top);
    const nearestRowIndex = rows.reduce((bestIndex, row, index) => {
      const center = (row.top + row.bottom) / 2;
      const bestCenter = (rows[bestIndex].top + rows[bestIndex].bottom) / 2;
      return Math.abs(clientY - center) < Math.abs(clientY - bestCenter) ? index : bestIndex;
    }, 0);
    const nearestRow = rows[nearestRowIndex];
    const rowHeight = nearestRow.bottom - nearestRow.top;
    const verticalInsideRow = clientY >= nearestRow.top - 8 && clientY <= nearestRow.bottom + 8;
    const verticalBetweenRows = rows.some((row, index) => {
      const nextRow = rows[index + 1];
      if (!nextRow) return false;
      return clientY > row.bottom + 10 && clientY < nextRow.top - 10;
    });
    const clearlyBelowLastRow = nearestRowIndex === rows.length - 1 && clientY > nearestRow.bottom + Math.max(14, rowHeight * .18);
    const clearlyAboveFirstRow = nearestRowIndex === 0 && clientY < nearestRow.top - Math.max(14, rowHeight * .18);
    const useExistingRow = verticalInsideRow && !verticalBetweenRows && !clearlyBelowLastRow && !clearlyAboveFirstRow;
    const targetRowIndex = useExistingRow
      ? nearestRowIndex
      : (clientY > nearestRow.bottom ? nearestRowIndex + 1 : nearestRowIndex);
    const referenceRow = rows[Math.min(targetRowIndex, rows.length - 1)] || nearestRow;
    const referenceItems = referenceRow.items;
    let columnIndex = referenceItems.length;
    for (let index = 0; index < referenceItems.length; index += 1) {
      const current = referenceItems[index].rect;
      const next = referenceItems[index + 1]?.rect;
      const boundary = next ? (current.right + next.left) / 2 : current.left + current.width / 2;
      if (clientX < boundary) {
        columnIndex = index;
        break;
      }
    }
    const beforeCount = rows.slice(0, targetRowIndex).reduce((total, row) => total + row.items.length, 0);
    return {
      index: Math.max(0, Math.min(targets.length, beforeCount + columnIndex)),
      breakBefore: !useExistingRow,
      columnIndex,
    };
  };

  const widgetDropColumn = (layout, widget, clientX) => {
    const layoutRect = gridRectForLayout(layout);
    const widgetRect = widget.getBoundingClientRect();
    const span = Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 3;
    const gap = 12;
    const columnWidth = (Math.max(1, layoutRect.width) - (gap * 5)) / 6;
    const itemWidth = (columnWidth * span) + (Math.max(0, span - 1) * gap);
    const step = itemWidth + gap;
    const maxColumn = Math.max(0, Math.floor(6 / Math.max(1, span)) - 1);
    const visualCenterX = widgetRect.left + (widgetRect.width / 2);
    const rawColumn = Math.round(((Number.isFinite(visualCenterX) ? visualCenterX : clientX) - layoutRect.left - (itemWidth / 2)) / Math.max(1, step));
    return Math.max(0, Math.min(maxColumn, rawColumn));
  };

  const getPanelMinimumHeight = (panel) => {
    const headerHeight = Math.ceil(panel.querySelector(".db-panel-hd")?.getBoundingClientRect().height || 58);
    return headerHeight + 168;
  };

  const applyPanelHeight = (panel, height) => {
    if (!height) {
      panel.style.height = "";
      delete panel.dataset.savedHeight;
      panel.dataset.gridRowSpan = String(panel.classList.contains("db-panel-collapsed") ? 1 : panelMinimumRows(panel));
      if (panel.dataset.gridCol && panel.dataset.gridRow) applyPanelGridPosition(panel, panel.dataset.gridCol, panel.dataset.gridRow);
      return;
    }
    const layout = panel.closest(".panel-layout");
    const gap = gridGapForLayout(layout);
    const rows = gridRowsFromHeight(Number(height), gap, panelMinimumRows(panel));
    const safeHeight = gridHeightForRows(rows, gap);
    panel.dataset.gridRowSpan = String(rows);
    panel.dataset.savedHeight = String(safeHeight);
    if (panel.dataset.gridCol && panel.dataset.gridRow) applyPanelGridPosition(panel, panel.dataset.gridCol, panel.dataset.gridRow);
    if (!panel.classList.contains("db-panel-collapsed")) {
      panel.style.height = `${safeHeight}px`;
    }
  };

  const hexToRgb = (hex) => {
    const clean = String(hex || "").replace("#", "").trim();
    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  };

  const readableTextFor = ({ r, g, b }) => {
    const luminance = ((0.299 * r) + (0.587 * g) + (0.114 * b)) / 255;
    return luminance > 0.62 ? "#102033" : "#ffffff";
  };

  const syncPanelThemeVars = (panel, target) => {
    if (!panel || !target) return;
    const rgb = hexToRgb(panel.dataset.panelColor);
    if (!rgb) return;
    const textColor = readableTextFor(rgb);
    const menuTextColor = readableTextFor(rgb);
    target.style.setProperty("--panel-accent", panel.dataset.panelColor);
    target.style.setProperty("--panel-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    target.style.setProperty("--panel-accent-text", textColor);
    target.style.setProperty("--panel-menu-fg", menuTextColor);
    target.style.setProperty("--panel-lock-fg", menuTextColor);
    target.style.setProperty("--panel-lock-border", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .46)`);
    target.style.setProperty("--panel-lock-glow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .24)`);
  };

  const applyPanelColor = (panel, color) => {
    const rgb = hexToRgb(color);
    if (!rgb) {
      panel.classList.remove("db-panel-custom-color");
      panel.style.removeProperty("--panel-accent");
      panel.style.removeProperty("--panel-accent-rgb");
      panel.style.removeProperty("--panel-accent-text");
      delete panel.dataset.panelColor;
      return;
    }
    panel.dataset.panelColor = `#${String(color).replace("#", "")}`;
    panel.classList.add("db-panel-custom-color");
    panel.style.setProperty("--panel-accent", panel.dataset.panelColor);
    panel.style.setProperty("--panel-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    panel.style.setProperty("--panel-accent-text", readableTextFor(rgb));
    if (panel.classList.contains("workspace-anchor-object")) {
      panel.style.setProperty("--anchor-accent", panel.dataset.panelColor);
    }
  };

  const styleRulePathValue = (source, path) => {
    if (!path) return undefined;
    const parts = String(path).split(".").filter(Boolean);
    return parts.reduce((value, part) => {
      if (value == null) return undefined;
      if (part === "length" && Array.isArray(value)) return value.length;
      return value?.[part];
    }, source);
  };

  const numericMetricValueForWidget = ({ config = {}, data = {}, resolvedContext = {} } = {}) => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
    const metric = ["count", "sum", "avg", "min", "max"].includes(config.metric) ? config.metric : "count";
    if (metric === "count") return total;
    const mapping = resolvedContext?.semanticMapping || data?.semanticMapping || {};
    const valueField = config.valueField || mapping.valueField;
    if (!valueField) return undefined;
    const values = rows.map((row) => {
      const raw = row?.[valueField];
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = Number(raw.replace(/[$,%\s,]/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }).filter((value) => value != null);
    if (!values.length) return undefined;
    if (metric === "sum") return values.reduce((sum, value) => sum + value, 0);
    if (metric === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (metric === "min") return Math.min(...values);
    if (metric === "max") return Math.max(...values);
    return total;
  };

  const styleRuleEnvironmentForWidget = (widget, options = {}) => {
    const definition = options.definition || widgetDefinitionForElement(widget);
    const instance = options.instance || widgetInstanceFromElement(widget, definition);
    const resolvedContext = options.resolvedContext || resolveWorkspaceContextForItem(widget);
    const data = options.data || managedQueryStateForWidget(widget)?.data || null;
    const status = options.status || widget.dataset.widgetRuntimeStatus || managedQueryStateForWidget(widget)?.status || "empty";
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length;
    return {
      widget,
      definition,
      instance,
      config: instance?.config || {},
      context: resolvedContext || {},
      resolvedContext: resolvedContext || {},
      data: {
        ...(data || {}),
        rows,
        total,
      },
      rows,
      status,
      metric: {
        value: numericMetricValueForWidget({ config: instance?.config || {}, data: data || {}, resolvedContext: resolvedContext || {} }),
      },
      constants: {},
    };
  };

  const logicOperandValue = (operand, environment) => {
    if (operand && typeof operand === "object" && !Array.isArray(operand)) {
      if (operand.type === "path") return styleRulePathValue(environment, operand.path);
      if (operand.type === "constant") return operand.value;
      if (operand.type === "context") return styleRulePathValue(environment.context, operand.path);
      if (operand.type === "config") return styleRulePathValue(environment.config, operand.path);
      if (operand.type === "data") return styleRulePathValue(environment.data, operand.path);
    }
    if (typeof operand !== "string") return operand;
    const trimmed = operand.trim();
    const pathLike = /^(metric|data|rows|status|config|context|resolvedContext|widget|instance|definition)\b/.test(trimmed);
    return pathLike ? styleRulePathValue(environment, trimmed) : operand;
  };

  const compareLogicValues = (left, operator, right) => {
    const leftNumber = typeof left === "number" ? left : Number(left);
    const rightNumber = typeof right === "number" ? right : Number(right);
    const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    if (operator === "<") return numeric ? leftNumber < rightNumber : String(left) < String(right);
    if (operator === ">") return numeric ? leftNumber > rightNumber : String(left) > String(right);
    if (operator === "<=") return numeric ? leftNumber <= rightNumber : String(left) <= String(right);
    if (operator === ">=") return numeric ? leftNumber >= rightNumber : String(left) >= String(right);
    if (operator === "!=") return left !== right && String(left) !== String(right);
    return left === right || String(left) === String(right);
  };

  const evaluateLogicExpression = (expression, environment) => {
    const normalized = normalizeLogicExpression(expression);
    if (normalized.type === "and") return normalized.inputs.length > 0 && normalized.inputs.every((entry) => evaluateLogicExpression(entry, environment));
    if (normalized.type === "or") return normalized.inputs.some((entry) => evaluateLogicExpression(entry, environment));
    if (normalized.type === "not") return !evaluateLogicExpression(normalized.input, environment);
    const left = logicOperandValue(normalized.left, environment);
    const right = logicOperandValue(normalized.right, environment);
    if (left == null || right == null) return false;
    return compareLogicValues(left, normalized.operator, right);
  };

  const clearConditionalStyleForWidget = (widget) => {
    if (!widget) return;
    widget.classList.remove("widget-conditional-style");
    [
      "--conditional-accent",
      "--conditional-accent-rgb",
      "--conditional-text",
      "--conditional-background-tint",
    ].forEach((property) => widget.style.removeProperty(property));
    delete widget.dataset.conditionalRimState;
    delete widget.dataset.conditionalIconState;
    delete widget.dataset.conditionalVisibility;
    delete widget.dataset.activeStyleRuleIds;
    delete widget.dataset.conditionalPanelAccentApplied;
    if (widget.dataset.panelColor && hexToRgb(widget.dataset.panelColor)) {
      applyPanelColor(widget, widget.dataset.panelColor);
    } else {
      widget.style.removeProperty("--panel-accent");
      widget.style.removeProperty("--panel-accent-rgb");
      widget.style.removeProperty("--panel-accent-text");
    }
  };

  const applyConditionalStyleEffects = (widget, effects = []) => {
    effects.forEach((effect) => {
      const property = effect.property;
      const value = effect.value;
      if (property === STYLE_RULE_EFFECT_PROPERTIES.accentColor) {
        const rgb = hexToRgb(value);
        if (!rgb) return;
        widget.style.setProperty("--conditional-accent", `#${String(value).replace("#", "")}`);
        widget.style.setProperty("--conditional-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        widget.style.setProperty("--conditional-text", readableTextFor(rgb));
        widget.style.setProperty("--panel-accent", `#${String(value).replace("#", "")}`);
        widget.style.setProperty("--panel-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        widget.style.setProperty("--panel-accent-text", readableTextFor(rgb));
        widget.dataset.conditionalPanelAccentApplied = "true";
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.textColor) {
        widget.style.setProperty("--conditional-text", String(value || ""));
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.backgroundTint) {
        const rgb = hexToRgb(value);
        if (rgb) {
          widget.style.setProperty("--conditional-background-tint", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .16)`);
        } else if (value) {
          widget.style.setProperty("--conditional-background-tint", String(value));
        }
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.rimState) {
        widget.dataset.conditionalRimState = String(value || "");
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.iconState) {
        widget.dataset.conditionalIconState = String(value || "");
      } else if (property === STYLE_RULE_EFFECT_PROPERTIES.visibility) {
        widget.dataset.conditionalVisibility = String(value || "");
      }
    });
  };

  const applyStyleRulesForWidget = (widget, options = {}) => {
    if (!widget?.classList?.contains("widget-card") || widget.classList.contains("workspace-anchor-object")) return [];
    const layoutKey = activeLayoutKeyForItem(widget);
    const graph = loadWorkspaceLogicGraph(layoutKey, getActivePanelProfile(layoutKey));
    const targetId = widget.dataset.widgetKey || "";
    const rules = graph.styleRules.filter((rule) => rule.enabled !== false && rule.targetObjectId === targetId);
    if (!rules.length) {
      clearConditionalStyleForWidget(widget);
      return [];
    }
    const environment = styleRuleEnvironmentForWidget(widget, options);
    const activeRules = [];
    rules.forEach((rule) => {
      try {
        if (evaluateLogicExpression(rule.condition, environment)) activeRules.push(rule);
      } catch {
        // Broken logic should never break a widget render.
      }
    });
    if (!activeRules.length) {
      clearConditionalStyleForWidget(widget);
      return [];
    }
    clearConditionalStyleForWidget(widget);
    widget.classList.add("widget-conditional-style");
    activeRules.forEach((rule) => applyConditionalStyleEffects(widget, rule.effects));
    widget.dataset.activeStyleRuleIds = activeRules.map((rule) => rule.id).join(",");
    return activeRules;
  };

  const applyPanelTitleColor = (panel, color) => {
    delete panel.dataset.panelTitleColor;
    panel.classList.remove("db-panel-custom-title");
    const panelRgb = hexToRgb(panel.dataset.panelColor);
    if (panelRgb) {
      panel.style.setProperty("--panel-accent-text", readableTextFor(panelRgb));
    } else {
      panel.style.removeProperty("--panel-accent-text");
    }
  };

  const panelThemePresets = [
    "#2563eb", "#0ea5e9", "#0891b2", "#14b8a6", "#16a34a", "#65a30d", "#ca8a04", "#d97706",
    "#dc2626", "#e11d48", "#db2777", "#9333ea", "#7c3aed", "#4f46e5", "#64748b", "#111827",
  ];
  const panelToolButtonsMarkup = (theme = "#2563eb", includeDelete = true, options = {}) => `
        <button class="panel-tool-button panel-move-handle" type="button" aria-label="Move panel" title="Move panel"><span class="move-icon" aria-hidden="true"></span></button>
        ${options.includeResize === false ? "" : '<button class="panel-tool-button panel-resize-handle" type="button" aria-label="Resize panel" title="Resize panel"><span class="resize-icon" aria-hidden="true"></span></button>'}
        ${options.includePin === false ? "" : '<button class="panel-tool-button panel-pin-toggle" type="button" aria-label="Pin panel" aria-pressed="false" title="Pin panel"><span class="pin-icon" aria-hidden="true"></span></button>'}
        <button class="panel-tool-button panel-title-handle" type="button" aria-label="Rename panel" title="Rename panel"><span class="text-icon" aria-hidden="true"></span></button>
        <button class="panel-tool-button panel-color-toggle" type="button" aria-label="Panel colors" aria-expanded="false" title="Panel colors" data-default-theme="${theme}"><span class="color-icon" aria-hidden="true"></span></button>
        ${options.extraButtons || ""}
        ${includeDelete ? '<button class="panel-tool-button panel-delete-handle" type="button" aria-label="Delete panel" title="Delete panel"><span class="trash-icon" aria-hidden="true"></span></button>' : ""}`;

  const createCustomPanel = (definition) => {
    const objectType = workspaceObjectTypeFromDefinition(definition, WORKSPACE_OBJECT_TYPES.panel);
    const isDivider = objectType === WORKSPACE_OBJECT_TYPES.divider;
    const safeTitle = escapeHtml(definition.title || (isDivider ? "Divider" : "Panel"));
    const panel = document.createElement("section");
    panel.className = isDivider
      ? "db-panel db-panel-empty-custom db-panel-collapsed workspace-divider"
      : "db-panel db-panel-empty-custom";
    panel.dataset.panelKey = definition.key;
    panel.dataset.defaultSpan = String(definition.span || 4);
    if (definition.gridCol) panel.dataset.gridCol = String(definition.gridCol);
    if (definition.gridRow) panel.dataset.gridRow = String(definition.gridRow);
    if (definition.minW) panel.dataset.minW = String(definition.minW);
    if (definition.locked) panel.dataset.locked = "true";
    if (definition.resizable === false) panel.dataset.resizable = "false";
    panel.dataset.customPanel = "true";
    panel.dataset.defaultTitle = definition.title || (isDivider ? "Divider" : "Panel");
    ensureWorkspaceObjectMetadata(panel, {
      ...definition,
      workspaceObjectType: objectType,
      dashboardObjectKind: definition.dashboardObjectKind || (isDivider ? "divider" : "panel"),
      contextRole: definition.contextRole || (isDivider ? "semantic-boundary" : "container"),
    });
    const headerMarkup = isDivider ? `
      <div class="db-panel-hd db-panel-hd-items workspace-divider-surface">
        <span class="db-panel-title">${safeTitle}</span>
        <span class="db-panel-count">Region</span>
        <div class="panel-tools">
          <div class="panel-tool-drawer" aria-label="Panel tools">
            ${panelToolButtonsMarkup(definition.color || "#2563eb", true)}
          </div>
          <button class="panel-settings-toggle" type="button" aria-label="Panel settings" aria-expanded="false" title="Panel settings"><span class="settings-icon" aria-hidden="true"></span></button>
        </div>
      </div>
      <div class="db-panel-body workspace-divider-body" hidden></div>` : `
      <div class="db-panel-hd db-panel-hd-items">
        <span class="db-panel-title">${safeTitle}</span>
        <span class="db-panel-count">0</span>
        <div class="panel-tools">
          <div class="panel-tool-drawer" aria-label="Panel tools">
            ${panelToolButtonsMarkup(definition.color || "#2563eb", true)}
          </div>
          <button class="panel-settings-toggle" type="button" aria-label="Panel settings" aria-expanded="false" title="Panel settings"><span class="settings-icon" aria-hidden="true"></span></button>
        </div>
      </div>
      <div class="db-panel-body">
        <div class="empty-state panel-empty-state" data-panel-placeholder="empty">
          <strong>Empty panel</strong>
          <small>Widgets will appear here when this panel is configured.</small>
          <span class="panel-empty-action" aria-hidden="true">Add widgets</span>
        </div>
      </div>`;
    panel.innerHTML = headerMarkup;
    return panel;
  };

  const savePanelLayouts = (layout, profile = getActivePanelProfile(layout.dataset.layoutKey || "default"), options = {}) => {
    const layoutKey = layout.dataset.layoutKey || "default";
    const persist = Boolean(options.persist);
    syncWorkspaceRegions(layout);
    if (!persist) {
      if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
      return;
    }
    captureLayoutUndo(layoutKey, profile);
    const expansionBaselineSnapshot = expansionBaselineSnapshotForLayoutKey(layoutKey);
    [...layout.querySelectorAll(":scope > .db-panel:not([hidden])")].forEach((panel, index) => {
      const key = panel.dataset.panelKey;
      const expansionBaseline = serializableExpansionBaselineState(expansionBaselineSnapshot, panel);
      const expansionActive = Boolean(
        expansionBaseline &&
        layout.__activeExpansionPanels?.has(panel) &&
        (Number(expansionBaseline.gridRowSpan) || 1) < gridItemRowSpan(panel)
      );
      if (!key) return;
      try {
        localStorage.setItem(panelStorageKey(layoutKey, key, profile), JSON.stringify({
          order: index,
          span: Number(panel.dataset.currentSpan) || Number(panel.dataset.defaultSpan) || 12,
          gridCol: Number(panel.dataset.gridCol) || null,
          gridRow: Number(panel.dataset.gridRow) || null,
          height: panel.dataset.savedHeight ? parseFloat(panel.dataset.savedHeight) : null,
          color: panel.dataset.panelColor || null,
          title: panel.dataset.panelTitle || null,
          pinned: panel.classList.contains("db-panel-pinned"),
          collapsed: panel.classList.contains("db-panel-collapsed"),
          minW: Number(panel.dataset.minW) || null,
          locked: panel.dataset.locked === "true",
          resizable: panel.dataset.resizable === "false" ? false : true,
          breakBefore: panel.previousElementSibling?.classList.contains("db-panel-row-break") || false,
          expansionBaseline,
          expansionActive,
          childWidgets: serializePanelChildWidgets(panel),
          ...workspaceObjectPersistence(panel),
        }));
      } catch {}
    });
    const customPanels = [...layout.querySelectorAll(':scope > .db-panel[data-custom-panel="true"]:not([hidden])')]
      .map((panel) => ({
        key: panel.dataset.panelKey,
        title: panel.dataset.panelTitle || panel.querySelector(".db-panel-title")?.textContent?.trim() || "Panel",
        color: panel.dataset.panelColor || panel.querySelector(".panel-color-toggle")?.dataset.defaultTheme || "#2563eb",
        span: Number(panel.dataset.defaultSpan) || 4,
        gridCol: Number(panel.dataset.gridCol) || null,
        gridRow: Number(panel.dataset.gridRow) || null,
        pinned: panel.classList.contains("db-panel-pinned"),
        collapsed: panel.classList.contains("db-panel-collapsed"),
        minW: Number(panel.dataset.minW) || null,
        locked: panel.dataset.locked === "true",
        resizable: panel.dataset.resizable === "false" ? false : true,
        childWidgets: serializePanelChildWidgets(panel),
        ...workspaceObjectPersistence(panel),
      }));
    try {
      localStorage.setItem(customPanelsKey(layoutKey, profile), JSON.stringify(customPanels));
      localStorage.setItem(hiddenPanelsKey(layoutKey, profile), layout.dataset.hiddenPanelsDraft || "[]");
    } catch {}
  };

  const createPanelRowBreak = () => {
    const rowBreak = document.createElement("div");
    rowBreak.className = "db-panel-row-break";
    rowBreak.setAttribute("aria-hidden", "true");
    return rowBreak;
  };

  const createWidgetRowBreak = () => {
    const rowBreak = document.createElement("div");
    rowBreak.className = "widget-row-break";
    rowBreak.setAttribute("aria-hidden", "true");
    return rowBreak;
  };

  const applyWidgetSpacerSpan = (spacer, span) => {
    const safeSpan = Math.max(1, Math.min(6, Number(span) || 1));
    const displaySpan = Math.round(safeSpan);
    spacer.dataset.widgetSpacerSpan = String(displaySpan);
    spacer.style.gridColumn = `span ${displaySpan}`;
  };

  const createWidgetSpacer = (span = 3) => {
    const spacer = document.createElement("div");
    spacer.className = "widget-spacer";
    spacer.setAttribute("aria-hidden", "true");
    applyWidgetSpacerSpan(spacer, span);
    return spacer;
  };

  const cleanupPanelRowBreaks = (layout) => {
    [...layout.querySelectorAll(":scope > .db-panel-row-break")].forEach((rowBreak) => {
      const prev = rowBreak.previousElementSibling;
      const next = rowBreak.nextElementSibling;
      if (!prev || !next || next.classList.contains("db-panel-row-break")) rowBreak.remove();
    });
  };

  const cleanupWidgetRowBreaks = (layout) => {
    [...layout.querySelectorAll(":scope > .widget-row-break")].forEach((rowBreak) => {
      const prev = rowBreak.previousElementSibling;
      const next = rowBreak.nextElementSibling;
      if (!prev || !next || next.classList.contains("widget-row-break")) rowBreak.remove();
    });
    [...layout.querySelectorAll(":scope > .widget-spacer")].forEach((spacer) => {
      const next = spacer.nextElementSibling;
      const prev = spacer.previousElementSibling;
      if (!next || next.classList.contains("widget-row-break") || !prev?.classList.contains("widget-row-break") && !prev?.classList.contains("widget-spacer")) {
        spacer.remove();
      }
    });
    [...layout.querySelectorAll(":scope > .widget-row-break")].forEach((rowBreak) => {
      const prev = rowBreak.previousElementSibling;
      const next = rowBreak.nextElementSibling;
      if (!prev || !next || next.classList.contains("widget-row-break")) rowBreak.remove();
    });
  };

  const positionPanelColorMenu = (colorToggle, menu) => {
    if (!colorToggle || !menu) return;
    const rect = colorToggle.getBoundingClientRect();
    const width = menu.offsetWidth || 248;
    const gutter = 12;
    const left = Math.max(gutter, Math.min(window.innerWidth - width - gutter, rect.right - width + 2));
    const top = Math.min(window.innerHeight - gutter, rect.bottom + 12);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  const positionDashboardToolDrawer = (item, settingsButton, drawer) => {
    if (!item || !settingsButton || !drawer) return;
    const settingsRect = settingsButton.getBoundingClientRect();
    const anchor = drawer.offsetParent || item;
    const anchorRect = anchor.getBoundingClientRect();
    const drawerWidth = drawer.offsetWidth || drawer.getBoundingClientRect().width;
    const drawerHeight = drawer.offsetHeight || drawer.getBoundingClientRect().height;
    if (!drawerWidth || !drawerHeight) return;
    const drawerStyles = window.getComputedStyle(drawer);
    const gap = parseFloat(drawerStyles.columnGap || drawerStyles.gap || "0") || 0;
    const padding = parseFloat(drawerStyles.paddingTop || "0") || 0;
    const clearance = Math.max(4, padding || gap || 4);
    const anchorGap = Math.max(4, gap || padding || 4);
    const right = Math.max(0, anchorRect.right - settingsRect.left + anchorGap);
    let top = settingsRect.top + (settingsRect.height / 2) - anchorRect.top - (drawerHeight / 2);

    const header = item.querySelector(":scope > .db-panel-hd");
    if (header?.contains(settingsButton)) {
      const headerRect = header.getBoundingClientRect();
      top = Math.min(top, headerRect.bottom - anchorRect.top - drawerHeight - clearance);
    }

    const viewportGutter = Math.max(8, clearance);
    const minTop = viewportGutter - anchorRect.top;
    const maxTop = window.innerHeight - viewportGutter - anchorRect.top - drawerHeight;
    const clampedTop = Math.max(minTop, Math.min(top, maxTop));
    drawer.style.setProperty("--dashboard-tool-drawer-top", `${Math.round(clampedTop)}px`);
    drawer.style.setProperty("--dashboard-tool-drawer-right", `${Math.round(right)}px`);
  };

  const buildPanelColorMenu = (panel, layout, colorToggle) => {
    if (!colorToggle) return null;
    if (colorToggle.__panelColorMenu) return colorToggle.__panelColorMenu;
    const menu = document.createElement("div");
    menu.className = "panel-color-menu";
    menu.setAttribute("role", "menu");
    const cleanColor = (color) => `#${String(color || "").replace("#", "").toLowerCase()}`;
    const refreshSwatchSelection = () => {
      const activeTheme = cleanColor(panel.dataset.panelColor || colorToggle.dataset.defaultTheme || "");
      menu.querySelectorAll(".panel-color-swatch").forEach((swatch) => {
        const selected = cleanColor(swatch.dataset.color) === activeTheme;
        swatch.classList.toggle("is-selected", selected);
        swatch.setAttribute("aria-pressed", selected.toString());
      });
    };
    colorToggle.__refreshPanelColorMenu = refreshSwatchSelection;

    const addGroup = (label, colors, onSelect, colorGroup) => {
      const group = document.createElement("div");
      group.className = "panel-color-group";
      const groupLabel = document.createElement("span");
      groupLabel.className = "panel-color-label";
      groupLabel.textContent = label;
      const swatches = document.createElement("div");
      swatches.className = "panel-color-swatches";
      colors.forEach((color) => {
        const swatch = document.createElement("button");
        swatch.className = "panel-color-swatch";
        swatch.type = "button";
        swatch.title = color;
        swatch.dataset.color = color;
        swatch.dataset.colorGroup = colorGroup;
        swatch.setAttribute("aria-pressed", "false");
        swatch.style.setProperty("--swatch", color);
        swatch.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(color);
          if (panel.classList.contains("group-selected")) {
            const peers = selectedGroupItems(null, groupItemLayoutKey(panel)).filter((item) => item !== panel);
            peers.forEach((item) => applyPanelColor(item, color));
            [...new Set(peers.map(groupItemLayout).filter(Boolean))].forEach((peerLayout) => {
              if (peerLayout.classList.contains("widget-layout")) {
                saveWidgetLayouts(peerLayout);
              } else {
                savePanelLayouts(peerLayout);
              }
            });
          }
          syncPanelThemeVars(panel, menu);
          if (typeof panel.__saveWidgetLayout === "function") {
            panel.__saveWidgetLayout();
          } else {
            savePanelLayouts(layout);
          }
          refreshSwatchSelection();
          colorToggle.setAttribute("aria-expanded", "true");
          positionPanelColorMenu(colorToggle, menu);
          menu.classList.add("panel-color-menu-open");
        });
        swatches.appendChild(swatch);
      });
      group.append(groupLabel, swatches);
      menu.appendChild(group);
    };

    addGroup("Theme color", panelThemePresets, (color) => applyPanelColor(panel, color), "theme");
    menu.addEventListener("click", (event) => event.stopPropagation());
    menu.addEventListener("keydown", (event) => event.stopPropagation());
    document.body.appendChild(menu);
    colorToggle.__panelColorMenu = menu;
    return menu;
  };

  const animatePanelReflow = (layout, update, excludeItem = null) => {
    const host = gridHostForLayout(layout);
    const selector = host !== layout
      ? ".panel-layout > .db-panel, .panel-layout > .db-panel-placeholder, .widget-layout > .widget-card, .widget-layout > .widget-placeholder"
      : ":scope > .db-panel, :scope > .db-panel-placeholder";
    const items = [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("db-panel-dragging") && !item.classList.contains("widget-dragging"));
    const before = new Map(items.map((item) => [item, item.getBoundingClientRect()]));
    update();
    const afterItems = [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("db-panel-dragging") && !item.classList.contains("widget-dragging"));
    afterItems.forEach((item) => {
      const first = before.get(item);
      if (!first) return;
      const last = item.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      item.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 180,
          easing: "cubic-bezier(.2, .8, .2, 1)",
        }
      );
    });
  };
  const animateWidgetReflow = (layout, update, excludeItem = null) => {
    const host = gridHostForLayout(layout);
    const selector = host !== layout
      ? ".widget-layout > .widget-card, .widget-layout > .widget-placeholder, .widget-layout > .widget-spacer, .panel-layout > .db-panel, .panel-layout > .db-panel-placeholder"
      : ":scope > .widget-card, :scope > .widget-placeholder, :scope > .widget-spacer";
    const items = [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
    const before = new Map(items.map((item) => [item, item.getBoundingClientRect()]));
    update();
    const afterItems = [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
    afterItems.forEach((item) => {
      const first = before.get(item);
      if (!first) return;
      const last = item.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      item.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 180,
          easing: "cubic-bezier(.2, .8, .2, 1)",
        }
      );
    });
  };

  const widgetRuntime = window.dashboardWidgetRuntime || null;
  const widgetDefinitionFor = (type) => widgetRuntime?.getWidgetDefinition?.(type) || {
    type: String(type || "unsupported"),
    displayName: "Unsupported Widget",
    widgetType: String(type || "unsupported"),
    dashboardObjectKind: "unsupported-widget",
    contextRole: "content",
    htmlTag: "div",
    className: "stat-card widget-card widget-card-custom unsupported-widget-card",
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    capabilities: { supportsResize: true },
    supportedSettings: ["title", "color", "pin", "delete"],
    queryRequirements: { fields: [] },
    getDefaultConfig: () => ({ title: `Unsupported: ${type || "unknown"}` }),
    resolveQuery: () => null,
    render: ({ instance }) => `
      <div class="unsupported-widget-state widget-runtime-state" role="status">
        <span class="stat-val">Unsupported widget</span>
        <span class="stat-lbl">${escapeHtml(instance.type || type || "unknown")}</span>
      </div>`,
  };
  const widgetRuntimeTypeFromElement = (widget) => (
    widget?.dataset?.widgetRuntimeType ||
    widget?.dataset?.dashboardObjectKind ||
    widget?.dataset?.widgetType ||
    "stat"
  );
  const widgetDefinitionForElement = (widget) => widgetDefinitionFor(widgetRuntimeTypeFromElement(widget));
  const parseWidgetConfig = (value) => parseJsonRecord(value, {}) || {};
  const uniqueValues = (values = []) => [...new Set(values.filter((value) => value != null && String(value).trim()))];
  const setWidgetConfig = (widget, config) => {
    if (!widget) return;
    widget.dataset.widgetConfig = JSON.stringify(config || {});
  };
  const setWidgetLinkNavigationSuspended = (widget, suspended) => {
    if (!widget || widget.tagName !== "A") return;
    if (suspended) {
      if (widget.hasAttribute("href") && !widget.dataset.widgetSuspendedHref) {
        widget.dataset.widgetSuspendedHref = widget.getAttribute("href") || "";
        widget.removeAttribute("href");
      }
      return;
    }
    if (widget.dataset.widgetSuspendedHref !== undefined) {
      if (widget.dataset.widgetSuspendedHref) widget.setAttribute("href", widget.dataset.widgetSuspendedHref);
      delete widget.dataset.widgetSuspendedHref;
    }
  };
  const setWidgetConfigValue = (widget, key, value) => {
    if (!widget || !key) return;
    setWidgetConfig(widget, {
      ...widgetConfigFromElement(widget),
      [key]: value,
    });
  };
  const widgetConfigFromElement = (widget, definition = widgetDefinitionForElement(widget)) => {
    const defaults = typeof definition.getDefaultConfig === "function" ? definition.getDefaultConfig() : {};
    const current = parseWidgetConfig(widget?.dataset?.widgetConfig);
    const label = widget?.querySelector?.(".stat-lbl, .range-search-label")?.textContent?.trim();
    const value = widget?.querySelector?.(".stat-val")?.textContent?.trim();
    return {
      ...defaults,
      ...(label && !current.title ? { title: label } : {}),
      ...(value && !current.value ? { value } : {}),
      ...current,
    };
  };
  const widgetAvailableSizeForDensity = (widget) => {
    if (!widget?.getBoundingClientRect) return { width: 0, height: 0, panelContained: false };
    const rect = widget.getBoundingClientRect();
    const tools = widget.querySelector(":scope > .widget-tools");
    const controlReserve = tools ? Math.min(52, Math.max(0, rect.width * 0.3)) : 0;
    return {
      width: Math.max(0, rect.width - controlReserve),
      height: Math.max(0, rect.height),
      panelContained: isPanelInternalGridItem(widget),
    };
  };
  const densityTiers = widgetRuntime?.densityTiers?.() || ["tiny", "compact", "standard", "expanded", "rich"];
  const applyWidgetDensityMetadata = (widget, density) => {
    if (!widget || !density) return;
    densityTiers.forEach((tier) => widget.classList.remove(`widget-density-${tier}`));
    widget.classList.add(`widget-density-${density}`);
    widget.dataset.density = density;
    widget.dataset.widgetDensity = density;
  };
  const resolveWidgetDensityForElement = (widget, definition = widgetDefinitionForElement(widget), availableSize = widgetAvailableSizeForDensity(widget)) => (
    widgetRuntime?.resolveWidgetDensity?.({
      cols: Number(widget?.dataset?.currentSpan || widget?.dataset?.defaultSpan) || definition.defaultSize?.cols || 1,
      rows: Number(widget?.dataset?.gridRowSpan) || definition.defaultSize?.rows || 1,
      parentPanelId: widget?.dataset?.parentPanelKey || null,
    }, availableSize, definition) || "standard"
  );
  const isMediaWidgetDefinition = (definition) => mediaWidgetAssetTypes.has(definition?.type || "");
  const mediaWidgetAssetState = (widget, config = widgetConfigFromElement(widget), definition = widgetDefinitionForElement(widget)) => {
    if (!isMediaWidgetDefinition(definition)) return { persistedConfig: config, renderConfig: config, asset: null, changed: false };
    const layoutKey = activeLayoutKeyForItem(widget);
    const profile = getActivePanelProfile(layoutKey);
    const persistedConfig = { ...config };
    let asset = persistedConfig.assetId ? assetById(layoutKey, profile, persistedConfig.assetId) : null;
    if (!asset && String(persistedConfig.src || "").trim()) {
      asset = createAssetFromSource(layoutKey, persistedConfig.src, {
        name: persistedConfig.title || persistedConfig.alt || definition.displayName || "Asset",
        type: definition.type,
      }, profile);
      if (asset) persistedConfig.assetId = asset.id;
    }
    if (asset) delete persistedConfig.src;
    const changed = JSON.stringify(persistedConfig) !== JSON.stringify(config);
    const renderConfig = {
      ...persistedConfig,
      src: asset ? assetSourceRef(asset) : "",
      assetId: persistedConfig.assetId || "",
      assetName: asset?.name || "",
      assetMimeType: asset?.mimeType || "",
      assetMissing: Boolean(persistedConfig.assetId && !asset),
    };
    return { persistedConfig, renderConfig, asset, changed };
  };
  const WIDGET_LOGIC_SETTING_KEYS = new Set([
    "assetId",
    "chartType",
    "columns",
    "customEnd",
    "customStart",
    "dateField",
    "eventTypes",
    "filter",
    "filters",
    "labelField",
    "limit",
    "metric",
    "page",
    "promptTemplate",
    "scope",
    "selectedPreset",
    "seriesField",
    "sortBy",
    "sortDirection",
    "source",
    "src",
    "target",
    "timeRange",
    "valueField",
    "xField",
    "yField",
  ]);
  const WIDGET_APPEARANCE_SETTING_KEYS = new Set([
    "caption",
    "density",
    "display",
    "fit",
    "format",
    "label",
    "showAxes",
    "showGrid",
    "showLabels",
    "showLegend",
    "title",
  ]);
  const widgetSettingsFields = (definition) => (definition?.settingsSchema?.sections || []).flatMap((section) => section.fields || []);
  const widgetSettingSurface = (field = {}) => {
    if (field.surface === "appearance" || field.surface === "visual") return "appearance";
    if (field.surface === "logic" || field.surface === "data" || field.surface === "context") return "logic";
    const key = String(field.key || "");
    if (field.affectsQuery || field.affectsContext) return "logic";
    if (WIDGET_LOGIC_SETTING_KEYS.has(key)) return "logic";
    if (WIDGET_APPEARANCE_SETTING_KEYS.has(key)) return "appearance";
    return "appearance";
  };
  const widgetSettingsSchemaForSurface = (definition, surface = "all") => {
    const schema = definition?.settingsSchema || { sections: [] };
    if (!surface || surface === "all") return schema;
    const sections = (schema.sections || []).map((section) => ({
      ...section,
      fields: (section.fields || []).filter((field) => widgetSettingSurface(field) === surface),
    })).filter((section) => section.fields.length);
    return { ...schema, sections };
  };
  const queryRelevantWidgetConfig = (definition, config = {}) => {
    const relevantKeys = widgetSettingsFields(definition)
      .filter((field) => field.affectsQuery || field.affectsContext)
      .map((field) => field.key);
    return relevantKeys.reduce((record, key) => {
      if (config[key] !== undefined) record[key] = config[key];
      return record;
    }, {});
  };
  const widgetInstanceFromElement = (widget, definition = widgetDefinitionForElement(widget)) => widgetRuntime?.createWidgetInstance?.(definition, {
    availableSize: widgetAvailableSizeForDensity(widget),
    density: resolveWidgetDensityForElement(widget, definition),
    parentPanelId: widget?.dataset?.parentPanelKey || null,
    id: widget?.dataset?.widgetKey || "",
    type: definition.type,
    x: Number(widget?.dataset?.gridCol) || 1,
    y: Number(widget?.dataset?.gridRow) || 1,
    cols: Number(widget?.dataset?.currentSpan || widget?.dataset?.defaultSpan) || definition.defaultSize?.cols || 1,
    rows: Number(widget?.dataset?.gridRowSpan) || definition.defaultSize?.rows || 1,
    config: widgetConfigFromElement(widget, definition),
    contextOverrideId: widget?.dataset?.contextOverrideId || null,
  }) || {
    id: widget?.dataset?.widgetKey || "",
    type: definition.type,
    x: Number(widget?.dataset?.gridCol) || 1,
    y: Number(widget?.dataset?.gridRow) || 1,
    cols: Number(widget?.dataset?.currentSpan || widget?.dataset?.defaultSpan) || definition.defaultSize?.cols || 1,
    rows: Number(widget?.dataset?.gridRowSpan) || definition.defaultSize?.rows || 1,
    config: widgetConfigFromElement(widget, definition),
    density: resolveWidgetDensityForElement(widget, definition),
    availableSize: widgetAvailableSizeForDensity(widget),
    parentPanelId: widget?.dataset?.parentPanelKey || null,
    contextOverrideId: widget?.dataset?.contextOverrideId || null,
  };
  const setWidgetRuntimeContent = (widget, html) => {
    if (!widget) return;
    const preserved = [...widget.children].filter((child) => (
      child.classList.contains("widget-tools") ||
      child.classList.contains("workspace-context-badge") ||
      child.classList.contains("dashboard-pinned-indicator")
    ));
    [...widget.children].forEach((child) => {
      if (!preserved.includes(child) && child.parentElement === widget) {
        try {
          child.remove();
        } catch {
          // A focused native control can move during blur while the runtime surface rerenders.
        }
      }
    });
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const firstPreserved = preserved[0] || null;
    [...template.content.childNodes].forEach((node) => widget.insertBefore(node, firstPreserved));
  };
  const renderWidgetRuntimeContent = (widget, options = {}) => {
    if (!widget?.classList?.contains("widget-card") || widget.classList.contains("workspace-anchor-object")) return;
    const definition = widgetDefinitionForElement(widget);
    const instance = widgetInstanceFromElement(widget, definition);
    applyWidgetDensityMetadata(widget, instance.density || "standard");
    const mediaState = mediaWidgetAssetState(widget, instance.config, definition);
    const persistedConfig = isMediaWidgetDefinition(definition) ? mediaState.persistedConfig : instance.config;
    setWidgetConfig(widget, persistedConfig);
    const renderInstance = isMediaWidgetDefinition(definition)
      ? { ...instance, config: mediaState.renderConfig }
      : instance;
    const html = widgetRuntime?.renderWidget?.(definition, {
      instance: renderInstance,
      definition,
      resolvedContext: options.resolvedContext || null,
      data: options.data,
      status: options.status || "empty",
    }) || definition.render({ instance: renderInstance, definition, resolvedContext: options.resolvedContext || null, data: options.data, status: options.status || "empty" });
    setWidgetRuntimeContent(widget, html);
    applyStyleRulesForWidget(widget, {
      definition,
      instance: renderInstance,
      resolvedContext: options.resolvedContext || null,
      data: options.data,
      status: options.status || "empty",
    });
  };
  const settingFieldOptionRecord = (option) => {
    if (option && typeof option === "object") {
      const value = String(option.value ?? option.id ?? option.key ?? option.label ?? "");
      return { value, label: String(option.label ?? option.name ?? value) };
    }
    return { value: String(option ?? ""), label: String(option ?? "") };
  };
  const fieldPickerOptionsForWidget = (widget, config = widgetConfigFromElement(widget)) => {
    const resolved = resolveWorkspaceContextForItem(widget);
    const mapping = resolved.semanticMapping || {};
    const cachedFields = managedQueryStateForWidget(widget)?.data?.schema?.fields?.map((field) => field.name) || [];
    return uniqueValues([
      ...cachedFields,
      ...Object.values(mapping).filter((value) => typeof value === "string"),
      ...(Array.isArray(config.columns) ? config.columns : []),
      config.valueField,
      config.xField,
      config.yField,
      config.seriesField,
      config.sortBy,
      config.dateField,
      config.labelField,
    ]).map((field) => ({ value: field, label: field }));
  };
  const settingRawValue = (config, field) => {
    if (config[field.key] !== undefined) return config[field.key];
    if (field.defaultValue !== undefined) return field.defaultValue;
    return field.type === "toggle" ? false : field.valueType === "array" ? [] : "";
  };
  const settingInputValue = (config, field) => {
    const value = settingRawValue(config, field);
    if (field.valueType === "array") return Array.isArray(value) ? value.join(", ") : String(value || "");
    if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2);
    return String(value ?? "");
  };
  const renderWidgetSettingField = (widget, field, config, surface = "settings") => {
    const id = `${widget.dataset.widgetKey || "widget"}-${field.key}`;
    const value = settingInputValue(config, field);
    const common = `class="widget-setting-input" data-widget-setting-key="${escapeHtml(field.key)}" data-widget-setting-type="${escapeHtml(field.type)}" data-widget-setting-surface="${escapeHtml(surface)}" aria-label="${escapeHtml(field.label)}"`;
    const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
    if (field.type === "select" || field.type === "metricPicker" || field.type === "fieldPicker") {
      const options = field.type === "fieldPicker"
        ? fieldPickerOptionsForWidget(widget, config)
        : (field.options || []).map(settingFieldOptionRecord);
      const optionMarkup = [
        field.required ? "" : `<option value="">${field.type === "fieldPicker" ? "Auto" : "Default"}</option>`,
        ...options.map((option) => `<option value="${escapeHtml(option.value)}"${String(value) === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`),
      ].join("");
      return `<label class="widget-setting-field widget-setting-field-${escapeHtml(field.type)}" for="${escapeHtml(id)}">
        <span>${escapeHtml(field.label)}</span>
        <select id="${escapeHtml(id)}" ${common}>${optionMarkup}</select>
      </label>`;
    }
    if (field.type === "toggle") {
      return `<label class="widget-setting-field widget-setting-field-toggle" for="${escapeHtml(id)}">
        <span>${escapeHtml(field.label)}</span>
        <input id="${escapeHtml(id)}" ${common} type="checkbox"${settingRawValue(config, field) ? " checked" : ""}>
      </label>`;
    }
    if (field.type === "textarea" || field.type === "json") {
      return `<label class="widget-setting-field widget-setting-field-${escapeHtml(field.type)}" for="${escapeHtml(id)}">
        <span>${escapeHtml(field.label)}</span>
        <textarea id="${escapeHtml(id)}" ${common}${placeholder}>${escapeHtml(value)}</textarea>
      </label>`;
    }
    const inputType = field.type === "number" ? "number" : field.type === "dateRange" ? "date" : "text";
    const numeric = field.type === "number"
      ? `${field.min != null ? ` min="${escapeHtml(field.min)}"` : ""}${field.max != null ? ` max="${escapeHtml(field.max)}"` : ""}${field.step != null ? ` step="${escapeHtml(field.step)}"` : ""}`
      : "";
    return `<label class="widget-setting-field widget-setting-field-${escapeHtml(field.type)}" for="${escapeHtml(id)}">
      <span>${escapeHtml(field.label)}</span>
      <input id="${escapeHtml(id)}" ${common} type="${inputType}" value="${escapeHtml(value)}"${placeholder}${numeric}>
    </label>`;
  };
  const widgetSchemaEmptyState = (definition, surface) => {
    if (surface === "logic") {
      return `<div class="widget-settings-empty-state">
        <span>${escapeHtml(definition.displayName || "Widget")}</span>
        <small>${isEngineerMode() ? "No data logic fields" : "No working controls"}</small>
      </div>`;
    }
    return `<div class="widget-settings-empty-state">
      <span>${escapeHtml(definition.displayName || "Widget")}</span>
      <small>Appearance uses title, color, and layout controls</small>
    </div>`;
  };
  const renderWidgetSettingsSchemaPanel = (widget, surface = "appearance") => {
    const definition = widgetDefinitionForElement(widget);
    const schema = widgetSettingsSchemaForSurface(definition, surface);
    const config = widgetConfigFromElement(widget, definition);
    const sections = schema.sections || [];
    return `<div class="widget-settings-schema-head">
      <span>${escapeHtml(definition.displayName || "Widget")} ${surface === "logic" ? "workbench" : "appearance"}</span>
    </div>
    ${sections.length ? sections.map((section) => `<fieldset class="widget-settings-section" data-widget-settings-section="${escapeHtml(section.id)}" data-widget-settings-surface="${escapeHtml(surface)}">
      <legend>${escapeHtml(section.label || "Settings")}</legend>
      ${(section.fields || []).map((field) => renderWidgetSettingField(widget, field, config, surface)).join("")}
    </fieldset>`).join("") : widgetSchemaEmptyState(definition, surface)}`;
  };
  const normalizeWidgetMenuFormControls = (panel) => {
    panel?.querySelectorAll?.("button:not([type])").forEach((button) => {
      button.type = "button";
    });
  };
  const ensureWidgetSettingsSchemaPanel = (widget) => {
    const tools = widget?.querySelector(":scope > .widget-tools");
    if (!tools) return null;
    let panel = tools.querySelector(":scope > .widget-settings-schema-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "widget-settings-schema-panel";
      panel.setAttribute("role", "menu");
      panel.setAttribute("aria-label", "Widget appearance");
      panel.hidden = true;
      tools.appendChild(panel);
    }
    const isOpen = widget.classList.contains("widget-settings-schema-open");
    if (isOpen) {
      panel.innerHTML = renderWidgetSettingsSchemaPanel(widget, "appearance");
      normalizeWidgetMenuFormControls(panel);
    }
    else panel.replaceChildren();
    panel.toggleAttribute("hidden", !isOpen);
    return panel;
  };
  const renderWidgetWorkbenchPanel = (widget) => {
    const definition = widgetDefinitionForElement(widget);
    const resolvedContext = resolveWorkspaceContextForItem(widget);
    const status = widget.dataset.widgetRuntimeStatus || "empty";
    const contextLabel = resolvedContext?.dataSourceName || resolvedContext?.dataSourceId || resolvedContext?.name || "Workspace";
    const engineerMarkup = isEngineerMode()
      ? `<div class="widget-workbench-context" aria-label="Resolved context">
          <span>${escapeHtml(contextLabel)}</span>
          <small>${escapeHtml(status)}</small>
        </div>`
      : "";
    return `${renderWidgetSettingsSchemaPanel(widget, "logic")}${engineerMarkup}`;
  };
  const ensureWidgetWorkbenchPanel = (widget) => {
    const tools = widget?.querySelector(":scope > .widget-tools");
    if (!tools) return null;
    let panel = tools.querySelector(":scope > .widget-workbench-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "widget-workbench-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Widget workbench");
      panel.hidden = true;
      tools.appendChild(panel);
    }
    const isOpen = widget.classList.contains("widget-workbench-open");
    if (isOpen) {
      panel.innerHTML = renderWidgetWorkbenchPanel(widget);
      normalizeWidgetMenuFormControls(panel);
    }
    else panel.replaceChildren();
    panel.toggleAttribute("hidden", !isOpen);
    return panel;
  };
  const coerceWidgetSettingValue = (input, field) => {
    if (field.type === "toggle") return Boolean(input.checked);
    if (field.type === "number") {
      let value = Number(input.value);
      if (!Number.isFinite(value)) value = Number(field.defaultValue) || 0;
      if (field.min != null) value = Math.max(Number(field.min), value);
      if (field.max != null) value = Math.min(Number(field.max), value);
      return value;
    }
    if (field.type === "json") return parseJsonRecord(input.value, settingRawValue({}, field));
    if (field.valueType === "array") {
      return String(input.value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
    }
    return String(input.value || "").trim();
  };
  const widgetSettingFieldForInput = (widget, input) => {
    const key = input?.dataset?.widgetSettingKey;
    if (!key) return null;
    return widgetSettingsFields(widgetDefinitionForElement(widget)).find((field) => field.key === key) || null;
  };
  window.dashboardWidgetSettingsRuntime = {
    schemaForWidget: (widget) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      return node ? widgetDefinitionForElement(node).settingsSchema || { sections: [] } : { sections: [] };
    },
    fieldsForWidget: (widget) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      return node ? widgetSettingsFields(widgetDefinitionForElement(node)) : [];
    },
    renderPanel: (widget, options = {}) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      return node ? renderWidgetSettingsSchemaPanel(node, options.surface || "appearance") : "";
    },
    renderWorkbench: (widget) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      return node ? renderWidgetWorkbenchPanel(node) : "";
    },
    applySetting: (widget, key, value, options = {}) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      if (!node || !key) return false;
      const field = widgetSettingsFields(widgetDefinitionForElement(node)).find((entry) => entry.key === key);
      if (!field) return false;
      const input = {
        dataset: { widgetSettingKey: key },
        value: field.valueType === "array" && Array.isArray(value) ? value.join(", ") : String(value ?? ""),
        checked: Boolean(value),
        type: field.type === "toggle" ? "checkbox" : field.type,
        removeAttribute() {},
        setAttribute() {},
      };
      return applyWidgetSettingsSchemaChange(node, input, options);
    },
  };
  const syncWidgetContextOutputs = (widget) => {
    if (!widget?.classList?.contains("widget-card")) return;
    const definition = widgetDefinitionForElement(widget);
    if (definition.type === "timeframe") {
      const resolvedContext = resolveWorkspaceContextForItem(widget);
      const timeRange = normalizedTimeframeWidgetRange(widget, resolvedContext);
      if (timeRange) {
        widget.dataset.contextTimeRange = JSON.stringify(timeRange);
        widget.dataset.timeframePreset = timeRange.preset || "";
        widget.dataset.timeframeLabel = timeRange.label || "";
      } else {
        delete widget.dataset.contextTimeRange;
        delete widget.dataset.timeframePreset;
        delete widget.dataset.timeframeLabel;
      }
    }
    if (definition.type === "filter") {
      const resolvedContext = resolveWorkspaceContextForItem(widget);
      widget.dataset.contextFilters = JSON.stringify(normalizedFilterWidgetFilters(widget, resolvedContext));
    }
  };
  const refreshWidgetRuntimeData = async (widget, resolvedContext, options = {}) => {
    if (!widget?.isConnected || widget.classList.contains("workspace-anchor-object")) return;
    if (widget.contains(document.activeElement) && !options.allowFocused) return;
    const definition = widgetDefinitionForElement(widget);
    const instance = widgetInstanceFromElement(widget, definition);
    const query = typeof definition.resolveQuery === "function"
      ? definition.resolveQuery(instance.config, resolvedContext)
      : null;
    widget.dataset.widgetQueryRequirements = JSON.stringify(definition.queryRequirements || {});
    const sequence = (Number(widget.dataset.widgetQuerySeq) || 0) + 1;
    widget.dataset.widgetQuerySeq = String(sequence);
    const managed = beginManagedWidgetQuery({
      definition,
      instance,
      resolvedContext,
      query,
      force: Boolean(options.force),
    });
    if (managed.key) {
      widget.dataset.widgetQueryKey = managed.key;
      widgetQueryKeys.set(widget, managed.key);
    } else {
      delete widget.dataset.widgetQueryKey;
      widgetQueryKeys.delete(widget);
    }
    widget.dataset.widgetRuntimeStatus = managed.state.status;
    widget.dataset.widgetQueryRefreshing = managed.state.isRefreshing ? "true" : "false";
    if (managed.state.error) widget.dataset.widgetQueryError = managed.state.error;
    else delete widget.dataset.widgetQueryError;
    if (managed.state.lastUpdated) widget.dataset.widgetQueryLastUpdated = String(managed.state.lastUpdated);
    renderWidgetRuntimeContent(widget, {
      resolvedContext,
      data: managed.state.data,
      status: managed.state.status,
    });
    if (!managed.promise) {
      return;
    }
    const finalState = await managed.promise;
    if (!widget.isConnected || (widget.contains(document.activeElement) && !options.allowFocused)) return;
    if (Number(widget.dataset.widgetQuerySeq) !== sequence) return;
    widget.dataset.widgetRuntimeStatus = finalState.status;
    widget.dataset.widgetQueryRefreshing = finalState.isRefreshing ? "true" : "false";
    if (finalState.error) widget.dataset.widgetQueryError = finalState.error;
    else delete widget.dataset.widgetQueryError;
    if (finalState.lastUpdated) widget.dataset.widgetQueryLastUpdated = String(finalState.lastUpdated);
    renderWidgetRuntimeContent(widget, {
      resolvedContext,
      data: finalState.data,
      status: finalState.status,
    });
  };
  window.dashboardQueryRuntime = {
    statusValues: ["idle", "loading", "ready", "empty", "error", "stale"],
    keyForWidget: (widget) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      if (!node) return "";
      const definition = widgetDefinitionForElement(node);
      const instance = widgetInstanceFromElement(node, definition);
      const resolvedContext = resolveWorkspaceContextForItem(node);
      const query = typeof definition.resolveQuery === "function"
        ? definition.resolveQuery(instance.config, resolvedContext)
        : null;
      return query ? widgetQueryKeyFor({ definition, instance, resolvedContext, query }) : "";
    },
    stateForWidget: (widget) => managedQueryStateForWidget(typeof widget === "string" ? document.querySelector(widget) : widget),
    refreshWidget: (widget, options = {}) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      if (!node) return Promise.resolve(false);
      return refreshWidgetRuntimeData(node, resolveWorkspaceContextForItem(node), { force: options.force !== false }).then(() => true);
    },
    retryWidget: (widget) => window.dashboardQueryRuntime.refreshWidget(widget, { force: true }),
    cancelWidget: (widget) => cancelManagedWidgetQueryForWidget(typeof widget === "string" ? document.querySelector(widget) : widget),
    cancelKey: cancelManagedWidgetQueryKey,
    invalidate: () => invalidateManagedWidgetQueries(),
    invalidateLayout: invalidateManagedWidgetQueriesForLayout,
    stats: () => ({
      cacheSize: widgetQueryCache.size,
      inflight: widgetQueryInflight.size,
      keys: [...widgetQueryCache.keys()],
    }),
  };
  const hydrateWidgetRuntime = (widget, saved = null) => {
    if (!widget?.classList?.contains("widget-card") || widget.classList.contains("workspace-anchor-object")) return null;
    if (saved?.runtimeType) widget.dataset.widgetRuntimeType = saved.runtimeType;
    if (saved?.type && !widget.dataset.widgetRuntimeType) widget.dataset.widgetRuntimeType = saved.type;
    const definition = widgetDefinitionForElement(widget);
    widget.dataset.widgetRuntimeType = definition.type;
    widget.dataset.widgetDefinition = definition.type;
    widget.dataset.widgetDisplayName = definition.displayName || definition.type;
    widget.dataset.widgetType = definition.widgetType || widget.dataset.widgetType || definition.type;
    widget.dataset.dashboardObjectKind = definition.dashboardObjectKind || widget.dataset.dashboardObjectKind || definition.type;
    widget.dataset.contextRole = definition.contextRole || widget.dataset.contextRole || "content";
    widget.dataset.widgetCapabilities = JSON.stringify(definition.capabilities || {});
    widget.dataset.widgetSupportedSettings = JSON.stringify(definition.supportedSettings || []);
    widget.dataset.widgetSettingsSchema = JSON.stringify(definition.settingsSchema || { sections: [] });
    widget.dataset.widgetQueryRequirements = JSON.stringify(definition.queryRequirements || {});
    if (!widget.dataset.defaultSpan) widget.dataset.defaultSpan = String(definition.defaultSize?.cols || 1);
    if (!widget.dataset.minW && definition.minSize?.cols) widget.dataset.minW = String(definition.minSize.cols);
    if (!widget.dataset.minH && definition.minSize?.rows > 1) widget.dataset.minH = String(definition.minSize.rows);
    if (definition.capabilities?.supportsResize === false) widget.dataset.resizable = "false";
    if (!widget.dataset.widgetConfig) setWidgetConfig(widget, widgetConfigFromElement(widget, definition));
    renderWidgetRuntimeContent(widget);
    syncWidgetContextOutputs(widget);
    return definition;
  };
  refreshWorkspaceMetaWidgets = (layoutKey = "builder") => {
    const selector = [
      `.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card[data-widget-definition="activity-feed"]`,
      `.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card[data-widget-definition="ai-assistant"]`,
      `.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card[data-widget-definition="context-inspector"]`,
      `.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card[data-widget-definition="activity-feed"]`,
      `.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card[data-widget-definition="ai-assistant"]`,
      `.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid > .widget-card[data-widget-definition="context-inspector"]`,
    ].join(",");
    document.querySelectorAll(selector).forEach((widget) => {
      renderWidgetRuntimeContent(widget, {
        resolvedContext: resolveWorkspaceContextForItem(widget),
        status: "ready",
      });
    });
  };
  const persistRuntimeControlChangeForWidget = (widget, options = {}) => {
    const layoutKey = activeLayoutKeyForItem(widget);
    const profile = getActivePanelProfile(layoutKey);
    const layout = widget.closest(".widget-layout");
    if (options.invalidateQuery !== false) invalidateManagedWidgetQueryForWidget(widget);
    if (layout) saveWidgetLayouts(layout, profile, { history: false });
    refreshResolvedContextDebug(layoutKey, profile);
    if (options.activity !== false) {
      recordWorkspaceActivity("widget-config-changed", `${widget.dataset.widgetDisplayName || "Widget"} config changed`, {
        layoutKey,
        regionId: regionIdForWorkspaceItem(widget),
      });
    }
    if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
  };
  const captureRuntimeControlBaselineForWidget = (widget) => {
    const layoutKey = activeLayoutKeyForItem(widget);
    const profile = getActivePanelProfile(layoutKey);
    pushLiveLayoutUndo(layoutKey, profile);
  };
  const applyWidgetSettingsSchemaChange = (widget, input, options = {}) => {
    const field = widgetSettingFieldForInput(widget, input);
    if (!field) return false;
    if (field.required && !String(input.type === "checkbox" ? input.checked : input.value || "").trim()) {
      input.setAttribute("aria-invalid", "true");
      return false;
    }
    input.removeAttribute("aria-invalid");
    const definition = widgetDefinitionForElement(widget);
    const config = widgetConfigFromElement(widget, definition);
    const nextValue = coerceWidgetSettingValue(input, field);
    const before = JSON.stringify(config[field.key] ?? null);
    const after = JSON.stringify(nextValue ?? null);
    if (before === after) return true;
    if (options.history !== false) captureRuntimeControlBaselineForWidget(widget);
    setWidgetConfig(widget, { ...config, [field.key]: nextValue });
    syncWidgetContextOutputs(widget);
    const affectsQuery = Boolean(field.affectsQuery || field.affectsContext);
    persistRuntimeControlChangeForWidget(widget, { history: options.history !== false, invalidateQuery: affectsQuery });
    if (affectsQuery) {
      refreshWidgetRuntimeData(widget, resolveWorkspaceContextForItem(widget), { force: true, allowFocused: true });
    } else {
      const queryState = managedQueryStateForWidget(widget);
      renderWidgetRuntimeContent(widget, {
        resolvedContext: resolveWorkspaceContextForItem(widget),
        data: queryState?.data,
        status: queryState?.status || widget.dataset.widgetRuntimeStatus || "empty",
      });
    }
    ensureWidgetSettingsSchemaPanel(widget);
    return true;
  };
  window.dashboardAssetRuntime = {
    keyForLayout: workspaceAssetsKey,
    listAssets: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => loadAssets(layoutKey, profile),
    getAsset: (id, layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => assetById(layoutKey, profile, id),
    registerAsset: (asset, layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => registerAsset(layoutKey, asset, profile),
    createAssetFromUrl: (src, options = {}, layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
      createAssetFromSource(layoutKey, src, { ...options, sourceKind: options.sourceKind || "url" }, profile),
    createAssetFromDataUrl: (dataUrl, options = {}, layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
      createAssetFromSource(layoutKey, dataUrl, { ...options, sourceKind: "data-url" }, profile),
    registerAssetFromFile: async (file, options = {}, layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
      if (!file) return null;
      const dataUrl = await fileToDataUrl(file);
      return createAssetFromSource(layoutKey, dataUrl, {
        ...options,
        name: options.name || file.name || "Uploaded asset",
        mimeType: options.mimeType || file.type || mimeTypeFromSource(dataUrl),
        size: options.size || file.size || dataUrl.length,
        type: options.type || assetTypeFromMime(file.type || mimeTypeFromSource(dataUrl), "document"),
        sourceKind: "data-url",
      }, profile);
    },
    setWidgetAsset: (widget, assetIdValue, options = {}) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      if (!node || !isMediaWidgetDefinition(widgetDefinitionForElement(node))) return false;
      if (options.history !== false) captureRuntimeControlBaselineForWidget(node);
      const config = widgetConfigFromElement(node);
      const nextConfig = { ...config, assetId: assetIdValue || "" };
      delete nextConfig.src;
      setWidgetConfig(node, nextConfig);
      renderWidgetRuntimeContent(node, { resolvedContext: resolveWorkspaceContextForItem(node), status: node.dataset.widgetRuntimeStatus || "empty" });
      persistRuntimeControlChangeForWidget(node, { history: options.history !== false, invalidateQuery: false });
      return true;
    },
    sourceForAsset: assetSourceRef,
  };
  const commitTimeframeDateInput = (input, eventType = "input") => {
    const widget = input?.closest?.(".widget-card[data-widget-definition='timeframe']");
    if (!widget || !widget.contains(input)) return false;
    const part = input.dataset.timeframePart || "customStart";
    const config = widgetConfigFromElement(widget);
    if (eventType === "change" || eventType === "focusout") captureRuntimeControlBaselineForWidget(widget);
    setWidgetConfig(widget, {
      ...config,
      selectedPreset: "custom",
      [part]: input.value,
      activeLabel: "Custom range",
    });
    syncWidgetContextOutputs(widget);
    const timeRange = parseJsonRecord(widget.dataset.contextTimeRange, null);
    widget.querySelector(".timeframe-selector")?.replaceChildren(document.createTextNode(timeRange?.label || "Custom range"));
    widget.querySelectorAll("[data-timeframe-preset]").forEach((button) => {
      const active = button.dataset.timeframePreset === "custom";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    widget.dataset.widgetRuntimeStatus = "ready";
    persistRuntimeControlChangeForWidget(widget, { history: eventType === "change" || eventType === "focusout" });
    return true;
  };
  const bindWidgetRuntimeControls = (widget) => {
    if (!widget || widget.dataset.widgetRuntimeControlsBound === "true") return;
    widget.dataset.widgetRuntimeControlsBound = "true";
    const persistRuntimeControlChange = (options = {}) => persistRuntimeControlChangeForWidget(widget, options);
    const updateFilterWidgetConfig = (target) => {
      const input = target?.closest?.(".filter-widget-input");
      const control = input?.closest?.(".filter-widget-control");
      if (!input || !control || !widget.contains(input)) return false;
      const config = widgetConfigFromElement(widget);
      const filters = Array.isArray(config.filters) ? [...config.filters] : [];
      const id = control.dataset.filterId;
      const index = Math.max(0, filters.findIndex((filter) => (filter.id || "") === id));
      const current = { ...(filters[index] || { id, type: control.dataset.filterType || "text" }) };
      current.id = current.id || id;
      current.type = current.type || control.dataset.filterType || "text";
      const part = input.dataset.filterPart || "value";
      if (part === "option") {
        const values = new Set(Array.isArray(current.values) ? current.values.map(String) : []);
        if (input.checked) values.add(input.value);
        else values.delete(input.value);
        current.values = [...values];
      } else if (part === "enabled") {
        current.enabled = input.checked;
      } else {
        current[part] = input.value;
      }
      filters[index] = current;
      const nextConfig = { ...config, filters };
      setWidgetConfig(widget, nextConfig);
      widget.dataset.contextFilters = JSON.stringify(normalizedFilterWidgetFilters(widget, resolveWorkspaceContextForItem(widget)));
      widget.dataset.widgetRuntimeStatus = "ready";
      return true;
    };
    const updateTextWidgetConfig = (target, eventType = "input") => {
      const editor = target?.closest?.(".text-widget-editor");
      if (!editor || !widget.contains(editor) || widget.dataset.widgetDefinition !== "text") return false;
      if (!widget.__textWidgetEditBaselineCaptured) {
        captureRuntimeControlBaselineForWidget(widget);
        widget.__textWidgetEditBaselineCaptured = true;
      }
      setWidgetConfigValue(widget, "body", editor.value);
      widget.dataset.widgetRuntimeStatus = "ready";
      if (eventType === "change" || eventType === "focusout") {
        widget.__textWidgetEditBaselineCaptured = false;
      }
      return true;
    };
    const updateTimeframeWidgetConfig = (target) => {
      if (widget.dataset.widgetDefinition !== "timeframe") return false;
      const presetButton = target?.closest?.("[data-timeframe-preset]");
      const dateInput = target?.closest?.(".timeframe-custom-date");
      const refreshButton = target?.closest?.(".timeframe-refresh");
      const calendarButton = target?.closest?.(".timeframe-calendar");
      if (presetButton && widget.contains(presetButton)) {
        const preset = presetButton.dataset.timeframePreset || "";
        const config = widgetConfigFromElement(widget);
        captureRuntimeControlBaselineForWidget(widget);
        setWidgetConfig(widget, {
          ...config,
          selectedPreset: preset,
          activeLabel: preset === "custom" ? "Custom range" : config.activeLabel,
        });
        renderWidgetRuntimeContent(widget);
        syncWidgetContextOutputs(widget);
        widget.dataset.widgetRuntimeStatus = "ready";
        return true;
      }
      if (dateInput && widget.contains(dateInput)) {
        return commitTimeframeDateInput(dateInput, "input");
      }
      if (refreshButton && widget.contains(refreshButton)) {
        renderWidgetRuntimeContent(widget);
        syncWidgetContextOutputs(widget);
        return true;
      }
      if (calendarButton && widget.contains(calendarButton)) {
        widget.querySelector(".timeframe-custom-date")?.focus?.();
      }
      return false;
    };
    const handleRuntimeControlChange = (event) => {
      if (event.__widgetRuntimeHandledBy === widget) return;
      const searchInput = event.target?.closest?.(".search-widget-input");
      if (searchInput && widget.contains(searchInput)) {
        event.__widgetRuntimeHandledBy = widget;
        setWidgetConfig(widget, {
          ...widgetConfigFromElement(widget),
          query: searchInput.value,
        });
        widget.dataset.widgetRuntimeStatus = "ready";
        persistRuntimeControlChange({ history: false });
        return;
      }
      if (updateFilterWidgetConfig(event.target)) {
        event.__widgetRuntimeHandledBy = widget;
        persistRuntimeControlChange({ history: event.type === "change" });
      }
      if (updateTextWidgetConfig(event.target, event.type)) {
        event.__widgetRuntimeHandledBy = widget;
        persistRuntimeControlChange({ history: event.type === "change" || event.type === "focusout" });
      }
      if (updateTimeframeWidgetConfig(event.target)) {
        event.__widgetRuntimeHandledBy = widget;
        persistRuntimeControlChange({ history: event.type === "change" || event.type === "focusout" });
      }
    };
    const handleRuntimeControlClick = (event) => {
      if (updateTimeframeWidgetConfig(event.target)) {
        event.preventDefault();
        persistRuntimeControlChange({ history: true });
      }
    };
    const handleTimeframeDateCommit = (event) => {
      if (event.__widgetRuntimeHandledBy === widget) return;
      const dateInput = event.target?.closest?.(".timeframe-custom-date");
      if (!dateInput || !widget.contains(dateInput)) return;
      if (updateTimeframeWidgetConfig(dateInput)) {
        event.__widgetRuntimeHandledBy = widget;
        persistRuntimeControlChange({ history: event.type === "change" || event.type === "focusout" });
      }
    };
    widget.addEventListener("click", handleRuntimeControlClick);
    widget.addEventListener("input", handleTimeframeDateCommit, true);
    widget.addEventListener("change", handleTimeframeDateCommit, true);
    widget.addEventListener("focusout", handleTimeframeDateCommit, true);
    widget.addEventListener("input", handleRuntimeControlChange, true);
    widget.addEventListener("input", handleRuntimeControlChange);
    widget.addEventListener("change", handleRuntimeControlChange, true);
    widget.addEventListener("change", handleRuntimeControlChange);
    widget.addEventListener("focusout", handleRuntimeControlChange);
  };
  ["input", "change", "focusout"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      if (event.__widgetRuntimeHandledBy) return;
      const input = event.target?.closest?.(".timeframe-custom-date");
      const widget = input?.closest?.(".widget-card[data-widget-definition='timeframe']");
      if (!input || !widget) return;
      if (commitTimeframeDateInput(input, event.type)) {
        event.__widgetRuntimeHandledBy = widget;
      }
    }, true);
  });

  const createCustomWidget = (definition) => {
    const runtimeDefinition = widgetDefinitionFor(definition.runtimeType || definition.widgetRuntimeType || definition.dashboardObjectKind || definition.type || "stat");
    const defaultConfig = typeof runtimeDefinition.getDefaultConfig === "function" ? runtimeDefinition.getDefaultConfig() : {};
    const config = {
      ...defaultConfig,
      ...parseWidgetConfig(definition.config),
      ...(definition.title ? { title: definition.title } : {}),
      ...(definition.value != null ? { value: definition.value } : {}),
    };
    const safeTitle = escapeHtml(config.title || runtimeDefinition.displayName || "Widget");
    const tagName = runtimeDefinition.htmlTag || "div";
    const widget = document.createElement(tagName);
    widget.className = runtimeDefinition.className || "stat-card widget-card widget-card-custom";
    if (tagName === "nav") {
      widget.setAttribute("aria-label", definition.ariaLabel || runtimeDefinition.ariaLabel || safeTitle);
    } else if (tagName !== "a") {
      widget.setAttribute("role", definition.role || "group");
      widget.setAttribute("aria-label", definition.ariaLabel || runtimeDefinition.ariaLabel || safeTitle);
    } else {
      widget.href = definition.href || window.location.pathname + window.location.search;
    }
    widget.dataset.widgetKey = definition.key;
    widget.dataset.widgetRuntimeType = runtimeDefinition.type;
    widget.dataset.widgetDefinition = runtimeDefinition.type;
    widget.dataset.widgetType = definition.type || runtimeDefinition.widgetType || runtimeDefinition.type;
    widget.dataset.defaultSpan = String(definition.span || runtimeDefinition.defaultSize?.cols || 1);
    widget.dataset.gridRowSpan = String(definition.rowSpan || definition.rows || runtimeDefinition.defaultSize?.rows || 1);
    if (definition.gridCol) widget.dataset.gridCol = String(definition.gridCol);
    if (definition.gridRow) widget.dataset.gridRow = String(definition.gridRow);
    if (definition.minW || runtimeDefinition.minSize?.cols) widget.dataset.minW = String(definition.minW || runtimeDefinition.minSize.cols);
    if (definition.minH || runtimeDefinition.minSize?.rows > 1) widget.dataset.minH = String(definition.minH || runtimeDefinition.minSize.rows);
    if (definition.locked) widget.dataset.locked = "true";
    if (definition.resizable === false || runtimeDefinition.capabilities?.supportsResize === false) widget.dataset.resizable = "false";
    setWidgetConfig(widget, config);
    widget.dataset.customWidget = "true";
    ensureWorkspaceObjectMetadata(widget, {
      ...definition,
      workspaceObjectType: WORKSPACE_OBJECT_TYPES.widget,
      dashboardObjectKind: definition.dashboardObjectKind || runtimeDefinition.dashboardObjectKind || runtimeDefinition.type,
      contextRole: definition.contextRole || runtimeDefinition.contextRole || "content",
      navigationTargetType: definition.navigationTargetType,
      navigationTargetId: definition.navigationTargetId,
    });
    hydrateWidgetRuntime(widget);
    return widget;
  };

  const panelChildWidgets = (panel) => [
    ...panel.querySelectorAll(":scope > .db-panel-body .panel-internal-widget-grid > .widget-card:not(.workspace-anchor-object):not([hidden])")
  ];

  const sanitizePanelChildWidgetClone = (widget) => {
    const clone = widget.cloneNode(true);
    delete clone.dataset.widgetInitialized;
    clone.classList.remove(...undoTransientItemClasses);
    clone.classList.remove(
      "widget-tools-open",
      "widget-dragging",
      "dashboard-active-resize",
      "dashboard-live-resize",
      "dashboard-resize-source",
      "group-selected",
      "group-transform-member"
    );
    clone.removeAttribute("hidden");
    clone.style.removeProperty("left");
    clone.style.removeProperty("top");
    clone.style.removeProperty("width");
    clone.style.removeProperty("position");
    clone.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "false");
    clone.querySelector(".panel-color-toggle")?.setAttribute("aria-expanded", "false");
    clone.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
    return clone;
  };

  const serializePanelChildWidgets = (panel) => panelChildWidgets(panel).map((widget) => ({
    key: widget.dataset.widgetKey || "",
    html: sanitizePanelChildWidgetClone(widget).outerHTML,
  }));

  const updatePanelChildEmptyState = (panel) => {
    const body = panel?.querySelector(":scope > .db-panel-body");
    if (!body) return;
    const hasChildren = Boolean(body.querySelector(".panel-internal-widget-grid > .widget-card, .panel-internal-widget-grid > .widget-placeholder"));
    body.querySelector(":scope > .panel-empty-state")?.toggleAttribute("hidden", hasChildren);
    const count = panel.querySelector(":scope > .db-panel-hd .db-panel-count");
    if (count) count.textContent = String(panelChildWidgets(panel).length);
  };

  const ensurePanelInternalWidgetGrid = (panel) => {
    const body = panel?.querySelector(":scope > .db-panel-body");
    if (!body) return null;
    let grid = body.querySelector(":scope > .panel-internal-widget-grid");
    if (!grid) {
      grid = document.createElement("div");
      grid.className = "panel-internal-widget-grid widget-layout";
      grid.dataset.widgetLayoutKey = `${groupItemLayoutKey(panel)}:panel:${panel.dataset.panelKey || "panel"}`;
      grid.dataset.panelContainerKey = panel.dataset.panelKey || "";
      body.appendChild(grid);
    }
    updatePanelChildEmptyState(panel);
    return grid;
  };

  const restorePanelChildWidgets = (panel, definitions = []) => {
    if (!workspaceObjectCapabilities(panel).hasPanelContentArea) return;
    const grid = ensurePanelInternalWidgetGrid(panel);
    if (!grid) return;
    grid.replaceChildren();
    definitions.forEach((definition) => {
      const template = document.createElement("template");
      template.innerHTML = definition?.html || "";
      const widget = template.content.firstElementChild;
      if (!widget?.classList?.contains("widget-card")) return;
      const key = widget.dataset.widgetKey || definition.key || "";
      if (key) {
        document.querySelectorAll(`.widget-layout:not(.panel-internal-widget-grid) > .widget-card[data-widget-key="${CSS.escape(key)}"]`)
          .forEach((duplicate) => duplicate.remove());
      }
      widget.dataset.panelChildWidget = "true";
      widget.dataset.parentPanelKey = panel.dataset.panelKey || "";
      delete widget.dataset.widgetInitialized;
      widget.classList.remove(...undoTransientItemClasses);
      grid.appendChild(widget);
    });
    updatePanelChildEmptyState(panel);
  };

  const anchorLayerForLayoutKey = (layoutKey = "default") =>
    document.querySelector(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"]`);

  const ANCHOR_RAIL_START = 126;
  const ANCHOR_RAIL_GAP = 8;

  const clampAnchorOffset = (offset, anchor = null) => {
    const height = Math.ceil(anchor?.getBoundingClientRect?.().height || 38);
    const min = ANCHOR_RAIL_START;
    const max = Math.max(min, window.innerHeight - height - 22);
    return Math.max(min, Math.min(max, Math.round(Number(offset) || min)));
  };

  const anchorOrderValue = (anchor, fallback = 0) => {
    const offset = Number(anchor?.dataset?.anchorOffset);
    if (Number.isFinite(offset)) return offset;
    const order = Number(anchor?.dataset?.anchorRailOrder);
    return Number.isFinite(order) ? order : fallback;
  };

  const anchorRailAnchors = (layer) => [...layer.querySelectorAll(":scope > .workspace-anchor-object:not(.workspace-anchor-drag-ghost)")]
    .sort((a, b) => anchorOrderValue(a) - anchorOrderValue(b));

  const anchorRailOffsetsForOrder = (orderedAnchors) => {
    const offsets = new Map();
    let nextOffset = ANCHOR_RAIL_START;
    orderedAnchors.forEach((anchor) => {
      offsets.set(anchor, nextOffset);
      nextOffset += Math.ceil(anchor.getBoundingClientRect().height || 81) + ANCHOR_RAIL_GAP;
    });
    return offsets;
  };

  const nextAnchorRailOffset = (layer) => {
    const anchors = anchorRailAnchors(layer);
    const lastBottom = anchors.reduce((bottom, anchor) => {
      const offset = Number(anchor.dataset.anchorOffset) || ANCHOR_RAIL_START;
      const height = Math.ceil(anchor.getBoundingClientRect().height || 81);
      return Math.max(bottom, offset + height);
    }, ANCHOR_RAIL_START - ANCHOR_RAIL_GAP);
    return clampAnchorOffset(lastBottom + ANCHOR_RAIL_GAP);
  };

  const anchorDefinitionFromElement = (anchor) => ({
    key: anchor.dataset.anchorKey,
    title: anchor.dataset.anchorTitle || "Anchor",
    side: "left",
    railOrder: Number(anchor.dataset.anchorRailOrder) || 0,
    offset: Number(anchor.dataset.anchorOffset) || 148,
    color: anchor.dataset.panelColor || "#2563eb",
    linkedDividerId: anchor.dataset.linkedDividerId || null,
    workspaceObjectType: WORKSPACE_OBJECT_TYPES.anchor,
    dashboardObjectKind: "anchor",
    contextRole: anchor.dataset.contextRole || "navigation-reference",
    workspaceRegionId: anchor.dataset.workspaceRegionId || null,
    contextScopeId: anchor.dataset.contextScopeId || null,
    navigationTargetType: anchor.dataset.navigationTargetType || (anchor.dataset.linkedDividerId ? "divider" : "workspace-top"),
    navigationTargetId: anchor.dataset.navigationTargetId || null,
  });

  const applyAnchorColor = (anchor, color) => {
    const rgb = hexToRgb(color);
    if (!rgb) return;
    anchor.dataset.panelColor = `#${String(color).replace("#", "")}`;
    anchor.style.setProperty("--panel-accent", anchor.dataset.panelColor);
    anchor.style.setProperty("--panel-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    anchor.style.setProperty("--panel-accent-text", readableTextFor(rgb));
    anchor.style.setProperty("--anchor-accent", anchor.dataset.panelColor);
  };

  const applyAnchorPosition = (anchor) => {
    const offset = Math.max(ANCHOR_RAIL_START, Math.round(Number(anchor.dataset.anchorOffset) || ANCHOR_RAIL_START));
    anchor.dataset.anchorSide = "left";
    anchor.dataset.anchorOffset = String(offset);
    anchor.style.setProperty("--anchor-offset", `${offset}px`);
  };

  const commitAnchorRailOrder = (layer, orderedAnchors = anchorRailAnchors(layer)) => {
    const offsets = anchorRailOffsetsForOrder(orderedAnchors);
    orderedAnchors.forEach((anchor, index) => {
      anchor.dataset.anchorSide = "left";
      anchor.dataset.anchorRailOrder = String(index);
      anchor.dataset.anchorOffset = String(offsets.get(anchor) || ANCHOR_RAIL_START);
      applyAnchorPosition(anchor);
      layer.appendChild(anchor);
    });
  };

  const preserveAnchorRailPositions = (layer, orderedAnchors = anchorRailAnchors(layer)) => {
    orderedAnchors.forEach((anchor, index) => {
      anchor.dataset.anchorSide = "left";
      anchor.dataset.anchorRailOrder = String(index);
      anchor.dataset.anchorOffset = String(clampAnchorOffset(anchor.dataset.anchorOffset, anchor));
      applyAnchorPosition(anchor);
      layer.appendChild(anchor);
    });
  };

  const normalizeAnchorLayer = (layer) => {
    preserveAnchorRailPositions(layer);
  };

  const animateAnchorRailOffsetShift = (anchor, previousTop) => {
    const nextTop = anchor.getBoundingClientRect().top;
    const deltaY = Math.round(previousTop - nextTop);
    if (Math.abs(deltaY) < 1) return;
    anchor.classList.add("anchor-rail-reflowing");
    anchor.style.transition = "none";
    anchor.style.transform = `translate3d(0, ${deltaY}px, 0)`;
    anchor.getBoundingClientRect();
    const clear = () => {
      anchor.classList.remove("anchor-rail-reflowing");
      anchor.style.removeProperty("transition");
      anchor.style.removeProperty("transform");
      anchor.removeEventListener("transitionend", clear);
      anchor.removeEventListener("transitioncancel", clear);
    };
    anchor.addEventListener("transitionend", clear);
    anchor.addEventListener("transitioncancel", clear);
    requestAnimationFrame(() => {
      anchor.style.removeProperty("transition");
      anchor.style.removeProperty("transform");
    });
  };

  const removeAnchorsWithRailReflow = (entries) => {
    const byLayer = new Map();
    entries
      .filter((entry) => entry.kind === "anchor")
      .forEach((entry) => {
        const group = byLayer.get(entry.layout) || [];
        group.push(entry);
        byLayer.set(entry.layout, group);
      });
    byLayer.forEach((anchorEntries, layer) => {
      const before = new Map();
      anchorRailAnchors(layer).forEach((anchor) => {
        before.set(anchor, {
          offset: Number(anchor.dataset.anchorOffset) || anchor.getBoundingClientRect().top || ANCHOR_RAIL_START,
          top: anchor.getBoundingClientRect().top,
          height: Math.ceil(anchor.getBoundingClientRect().height || 81),
        });
      });
      const deletedFootprints = anchorEntries
        .map((entry) => before.get(entry.item))
        .filter(Boolean)
        .sort((a, b) => a.offset - b.offset);
      anchorEntries.forEach((entry) => entry.item.remove());
      const remaining = anchorRailAnchors(layer);
      remaining.forEach((anchor) => {
        const old = before.get(anchor);
        if (!old) return;
        const shift = deletedFootprints.reduce((total, deleted) => (
          deleted.offset < old.offset ? total + deleted.height + ANCHOR_RAIL_GAP : total
        ), 0);
        if (shift <= 0) return;
        anchor.dataset.anchorOffset = String(clampAnchorOffset(old.offset - shift, anchor));
        applyAnchorPosition(anchor);
      });
      preserveAnchorRailPositions(layer, remaining);
      remaining.forEach((anchor) => {
        const old = before.get(anchor);
        if (!old) return;
        animateAnchorRailOffsetShift(anchor, old.top);
      });
    });
  };

  const anchorLinkedDividerTarget = (anchor) => {
    const dividerId = anchor?.dataset?.linkedDividerId || "";
    if (!dividerId) return null;
    const escapedDividerId = CSS.escape(dividerId);
    return document.querySelector([
      `.workspace-divider[data-panel-key="${escapedDividerId}"]`,
      `.workspace-divider[data-workspace-region-id="${escapedDividerId}"]`,
      `.workspace-divider[data-context-scope-id="${escapedDividerId}"]`,
    ].join(", "));
  };

  const anchorTargetViewportTop = (target) => {
    const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const grid = target.closest(".dashboard-layout-grid") || document.querySelector(".dashboard-layout-grid");
    const nav = document.querySelector(".app-nav.workspace-chrome, .app-nav");
    const navBottom = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0;
    if (!grid) return navBottom + 8;
    const gridTop = Math.round(grid.getBoundingClientRect().top + currentScroll);
    return Math.max(navBottom + 8, gridTop);
  };

  const anchorNavigationRunway = () => {
    let runway = document.querySelector(".workspace-anchor-scroll-runway");
    if (!runway) {
      runway = document.createElement("div");
      runway.className = "workspace-anchor-scroll-runway";
      runway.setAttribute("aria-hidden", "true");
      document.body.appendChild(runway);
    }
    return runway;
  };

  const clearAnchorNavigationRunway = () => {
    document.querySelector(".workspace-anchor-scroll-runway")?.remove();
  };

  const ensureAnchorNavigationRunway = (target, viewportTop) => {
    const runway = anchorNavigationRunway();
    const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const targetTop = target.getBoundingClientRect().top + currentScroll;
    const requiredScrollHeight = Math.ceil(targetTop + window.innerHeight - viewportTop + 32);
    const currentRunwayHeight = Number.parseFloat(runway.style.height || "0") || 0;
    const baseScrollHeight = document.documentElement.scrollHeight - currentRunwayHeight;
    const missingHeight = Math.max(0, requiredScrollHeight - baseScrollHeight);
    runway.style.height = `${missingHeight}px`;
  };

  const anchorTargetScrollTop = (target) => {
    const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const targetTop = target.getBoundingClientRect().top + currentScroll;
    const viewportTop = anchorTargetViewportTop(target);
    ensureAnchorNavigationRunway(target, viewportTop);
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return Math.max(0, Math.min(maxScroll, Math.round(targetTop - viewportTop)));
  };

  const syncAnchorNavigationTarget = (anchor) => {
    const target = anchorLinkedDividerTarget(anchor);
    if (target) {
      anchor.dataset.navigationTargetType = "divider";
      anchor.dataset.navigationTargetId = target.dataset.contextScopeId || target.dataset.workspaceRegionId || target.dataset.panelKey;
      anchor.dataset.workspaceRegionId = target.dataset.workspaceRegionId || target.dataset.contextScopeId || "";
      anchor.dataset.contextScopeId = target.dataset.contextScopeId || "";
    } else {
      delete anchor.dataset.linkedDividerId;
      anchor.dataset.navigationTargetType = "workspace-top";
      anchor.dataset.navigationTargetId = "";
      anchor.dataset.workspaceRegionId = "";
      anchor.dataset.contextScopeId = "";
    }
    const label = anchor.querySelector(".workspace-anchor-label");
    const targetLabel = target ? target.querySelector(".db-panel-title")?.textContent?.trim() || "Divider" : "Top";
    if (label) label.textContent = targetLabel;
    anchor.setAttribute("aria-label", `${targetLabel} spatial anchor`);
  };

  const dividerOptionsForAnchor = (layoutKey = "builder") => [
    ...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .workspace-divider[data-workspace-object-type="divider"]`)
  ];

  const refreshAnchorDividerMenu = (anchor, menu, layoutKey) => {
    if (!anchor || !menu) return;
    menu.replaceChildren();
    const makeOption = ({ label, dividerId = "" }) => {
      const option = document.createElement("button");
      option.className = "anchor-link-option";
      option.type = "button";
      option.dataset.dividerId = dividerId;
      option.setAttribute("aria-pressed", String((anchor.dataset.linkedDividerId || "") === dividerId));
      option.textContent = label;
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (dividerId) {
          anchor.dataset.linkedDividerId = dividerId;
        } else {
          delete anchor.dataset.linkedDividerId;
        }
        syncAnchorNavigationTarget(anchor);
        refreshAnchorDividerMenu(anchor, menu, layoutKey);
        anchor.classList.remove("widget-tools-open");
        anchor.querySelector(".anchor-settings-toggle")?.setAttribute("aria-expanded", "false");
        menu.classList.remove("anchor-link-menu-open");
        anchor.querySelector(".anchor-link-toggle")?.setAttribute("aria-expanded", "false");
        syncLayoutToolsActive();
        saveFloatingAnchors(layoutKey, getActivePanelProfile(layoutKey));
        emitWorkspaceEvent({
          type: "anchor-linked",
          source: "anchor-menu",
          layoutKey,
          objectId: anchor.dataset.anchorKey || "",
          objectType: "anchor",
          regionId: anchor.dataset.workspaceRegionId || "",
          label: dividerId ? "Anchor linked to divider" : "Anchor link cleared",
          payload: {
            linkedDividerId: anchor.dataset.linkedDividerId || null,
            navigationTargetType: anchor.dataset.navigationTargetType || "workspace-top",
          },
        });
      });
      menu.appendChild(option);
    };
    makeOption({ label: "Top of workspace" });
    dividerOptionsForAnchor(layoutKey).forEach((divider) => {
      makeOption({
        label: divider.querySelector(".db-panel-title")?.textContent?.trim() || "Divider",
        dividerId: divider.dataset.panelKey || "",
      });
    });
    if (menu.children.length === 1) {
      const empty = document.createElement("span");
      empty.className = "anchor-link-empty";
      empty.textContent = "No dividers yet";
      menu.appendChild(empty);
    }
  };

  const createFloatingAnchor = (definition = {}) => {
    const anchor = document.createElement("div");
    const title = definition.title || "Anchor";
    const key = definition.key || `anchor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const layoutKey = definition.layoutKey || "builder";
    anchor.className = "workspace-anchor-object widget-card stat-card db-panel-custom-color";
    anchor.setAttribute("role", "button");
    anchor.tabIndex = 0;
    anchor.dataset.anchorKey = key;
    anchor.dataset.anchorTitle = title;
    anchor.dataset.anchorSide = "left";
    anchor.dataset.anchorRailOrder = String(Number.isFinite(Number(definition.railOrder)) ? Number(definition.railOrder) : 0);
    anchor.dataset.anchorOffset = String(definition.offset || ANCHOR_RAIL_START);
    if (definition.linkedDividerId) anchor.dataset.linkedDividerId = definition.linkedDividerId;
    anchor.dataset.workspaceObjectType = WORKSPACE_OBJECT_TYPES.anchor;
    anchor.dataset.dashboardObjectKind = "anchor";
    anchor.dataset.contextRole = definition.contextRole || "navigation-reference";
    anchor.dataset.workspaceContextModel = WORKSPACE_CONTEXT_MODEL_VERSION;
    anchor.dataset.navigationTargetType = definition.navigationTargetType || (definition.linkedDividerId ? "divider" : "workspace-top");
    anchor.dataset.navigationTargetId = definition.navigationTargetId || "";
    if (definition.workspaceRegionId) anchor.dataset.workspaceRegionId = definition.workspaceRegionId;
    if (definition.contextScopeId) anchor.dataset.contextScopeId = definition.contextScopeId;
    ensureWorkspaceObjectMetadata(anchor, {
      ...definition,
      workspaceObjectType: WORKSPACE_OBJECT_TYPES.anchor,
      dashboardObjectKind: "anchor",
      contextRole: definition.contextRole || "navigation-reference",
      navigationTargetType: definition.navigationTargetType || (definition.linkedDividerId ? "divider" : "workspace-top"),
      navigationTargetId: definition.navigationTargetId || "",
    });
    anchor.setAttribute("aria-label", `${title} spatial anchor`);
    anchor.innerHTML = `
      <span class="workspace-anchor-content">
        <span class="workspace-anchor-label stat-lbl">Top</span>
      </span>
      <span class="widget-tools anchor-tools">
        <span class="panel-tool-drawer widget-tool-drawer anchor-tool-drawer" aria-label="Anchor tools">
          ${panelToolButtonsMarkup(definition.color || "#2563eb", true, {
            includeResize: false,
            includePin: false,
            extraButtons: '<button class="panel-tool-button anchor-link-toggle" type="button" aria-label="Link anchor to divider" aria-expanded="false" title="Link anchor"><span class="anchor-link-icon" aria-hidden="true"></span></button>',
          })}
        </span>
        <button class="panel-settings-toggle widget-settings-toggle anchor-settings-toggle" type="button" aria-label="Anchor settings" aria-expanded="false" title="Anchor settings"><span class="settings-icon" aria-hidden="true"></span></button>
        <span class="anchor-link-menu" role="menu" aria-label="Anchor divider link"></span>
      </span>`;
    applyAnchorColor(anchor, definition.color || "#2563eb");
    syncAnchorNavigationTarget(anchor);
    applyAnchorPosition(anchor);
    return anchor;
  };

  const saveFloatingAnchors = (layoutKey = "default", profile = getActivePanelProfile(layoutKey), options = {}) => {
    const layer = anchorLayerForLayoutKey(layoutKey);
    if (!layer) return;
    normalizeAnchorLayer(layer);
    if (!options.persist) {
      if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
      return;
    }
    try {
      localStorage.setItem(
        floatingAnchorsKey(layoutKey, profile),
        JSON.stringify([...layer.querySelectorAll(":scope > .workspace-anchor-object")].map(anchorDefinitionFromElement))
      );
    } catch {}
  };

  const legacyAnchorDefinitions = (layoutKey, profile) => {
    try {
      return JSON.parse(localStorage.getItem(customWidgetsKey(layoutKey, profile)) || "[]")
        .filter((definition) => workspaceObjectTypeFromDefinition(definition, WORKSPACE_OBJECT_TYPES.widget) === WORKSPACE_OBJECT_TYPES.anchor)
        .map((definition, index) => ({
          ...definition,
          side: "left",
          railOrder: Number.isFinite(Number(definition.railOrder)) ? Number(definition.railOrder) : index,
          offset: definition.offset || 148 + (index * 48),
          navigationTargetType: definition.navigationTargetType || (definition.linkedDividerId ? "divider" : "workspace-top"),
          navigationTargetId: definition.navigationTargetId || "",
        }));
    } catch {
      return [];
    }
  };

  const loadFloatingAnchorDefinitions = (layoutKey, profile) => {
    try {
      const saved = JSON.parse(localStorage.getItem(floatingAnchorsKey(layoutKey, profile)) || "[]");
      if (Array.isArray(saved) && saved.length) {
        return saved
          .map((definition, index) => ({
            ...definition,
            side: "left",
            railOrder: Number.isFinite(Number(definition.railOrder)) ? Number(definition.railOrder) : index,
          }))
          .sort((a, b) => Number(a.railOrder) - Number(b.railOrder));
      }
    } catch {}
    return legacyAnchorDefinitions(layoutKey, profile);
  };

  const navigateToAnchorTarget = (anchor) => {
    if (isDashboardInteractionActive()) return;
    const target = anchorLinkedDividerTarget(anchor);
    if (anchor.dataset.linkedDividerId && !target) {
      syncAnchorNavigationTarget(anchor);
      saveFloatingAnchors(anchor.closest(".workspace-anchor-layer")?.dataset.anchorLayoutKey || "builder");
    }
    if (!target) clearAnchorNavigationRunway();
    const top = target ? anchorTargetScrollTop(target) : 0;
    window.scrollTo({ top, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth" });
  };

  const initFloatingAnchor = (anchor, layer) => {
    if (anchor.dataset.anchorInitialized === "true") return;
    anchor.dataset.anchorInitialized = "true";
    let dragging = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;
    let pointerOffsetY = 0;
    let dragState = null;
    let activeMovePointerId = null;
    let activeMovePointerTarget = null;
    const layoutKey = layer.dataset.anchorLayoutKey || "default";
    anchor.__saveWidgetLayout = () => saveFloatingAnchors(layoutKey, getActivePanelProfile(layoutKey));
    const tools = anchor.querySelector(".anchor-tools");
    const settings = anchor.querySelector(".anchor-settings-toggle");
    const drawer = anchor.querySelector(".anchor-tool-drawer");
    const moveHandle = anchor.querySelector(".panel-move-handle");
    const titleButton = anchor.querySelector(".panel-title-handle");
    const colorToggle = anchor.querySelector(".panel-color-toggle");
    const deleteButton = anchor.querySelector(".panel-delete-handle");
    const linkToggle = anchor.querySelector(".anchor-link-toggle");
    const linkMenu = anchor.querySelector(".anchor-link-menu");
    const colorMenu = buildPanelColorMenu(anchor, layer, colorToggle);
    const openTools = () => {
      if (!canOpenDashboardTools(anchor)) return;
      closeInactiveDashboardTools(anchor);
      drawer?.style.removeProperty("--dashboard-tool-drawer-top");
      drawer?.style.removeProperty("--dashboard-tool-drawer-right");
      anchor.classList.add("widget-tools-open");
      settings?.setAttribute("aria-expanded", "true");
      syncLayoutToolsActive();
    };
    const closeTools = (options = {}) => {
      if (options.cancelMove !== false) cancelAnchorMoveFromMenuClose();
      anchor.classList.remove("widget-tools-open");
      settings?.setAttribute("aria-expanded", "false");
      linkToggle?.setAttribute("aria-expanded", "false");
      linkMenu?.classList.remove("anchor-link-menu-open");
      colorToggle?.setAttribute("aria-expanded", "false");
      colorMenu?.classList.remove("panel-color-menu-open");
      syncLayoutToolsActive();
    };
    const toggleLinkMenu = () => {
      if (!linkMenu || !linkToggle) return;
      const nextOpen = !linkMenu.classList.contains("anchor-link-menu-open");
      if (nextOpen) {
        refreshAnchorDividerMenu(anchor, linkMenu, layoutKey);
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
      }
      linkMenu.classList.toggle("anchor-link-menu-open", nextOpen);
      linkToggle.setAttribute("aria-expanded", String(nextOpen));
    };

    function removeAnchorMoveListeners() {
      document.removeEventListener("pointermove", handleAnchorMovePointerMove);
      document.removeEventListener("pointerup", finishAnchorMove);
      document.removeEventListener("pointercancel", finishAnchorMove);
      document.removeEventListener("keydown", handleAnchorMoveKeydown);
      window.removeEventListener("blur", handleAnchorMoveWindowBlur);
      activeMovePointerTarget?.removeEventListener?.("lostpointercapture", handleAnchorLostPointerCapture);
    }

    function releaseAnchorMovePointer() {
      if (activeMovePointerId == null || !activeMovePointerTarget?.hasPointerCapture?.(activeMovePointerId)) return;
      try {
        activeMovePointerTarget.releasePointerCapture(activeMovePointerId);
      } catch {
        // Pointer capture may already be released by cancel, blur, or browser focus changes.
      }
    }

    const startAnchorMove = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (activeMovePointerId != null || dragState) finishAnchorMove({ type: "pointercancel" });
      startX = event.clientX;
      startY = event.clientY;
      pointerOffsetY = event.clientY - anchor.getBoundingClientRect().top;
      dragging = false;
      didDrag = false;
      activeMovePointerId = event.pointerId;
      activeMovePointerTarget = anchor;
      try {
        activeMovePointerTarget?.setPointerCapture?.(event.pointerId);
      } catch {
        // Document-level listeners still cover browsers that decline capture.
      }
      document.addEventListener("pointermove", handleAnchorMovePointerMove);
      document.addEventListener("pointerup", finishAnchorMove);
      document.addEventListener("pointercancel", finishAnchorMove);
      document.addEventListener("keydown", handleAnchorMoveKeydown);
      window.addEventListener("blur", handleAnchorMoveWindowBlur);
      activeMovePointerTarget?.addEventListener?.("lostpointercapture", handleAnchorLostPointerCapture);
    };

    const previewIndexForPointer = (pointerY, peers) => {
      for (let index = 0; index < peers.length; index += 1) {
        const rect = peers[index].getBoundingClientRect();
        if (pointerY < rect.top + rect.height / 2) return index;
      }
      return peers.length;
    };

    const orderedAnchorsWithSourceAt = (source, insertIndex) => {
      const peers = anchorRailAnchors(layer).filter((candidate) => candidate !== source);
      const ordered = [...peers];
      ordered.splice(Math.max(0, Math.min(insertIndex, ordered.length)), 0, source);
      return ordered;
    };

    const applyAnchorRailPreview = (state, pointerY) => {
      const insertIndex = previewIndexForPointer(pointerY, state.peers);
      const ordered = orderedAnchorsWithSourceAt(anchor, insertIndex);
      const offsets = anchorRailOffsetsForOrder(ordered);
      ordered.forEach((candidate) => {
        if (candidate === anchor) return;
        candidate.style.setProperty("--anchor-offset", `${offsets.get(candidate)}px`);
        candidate.classList.add("anchor-rail-previewing");
      });
      state.placeholder.style.setProperty("--anchor-offset", `${offsets.get(anchor) || ANCHOR_RAIL_START}px`);
      state.previewOrder = ordered;
      state.previewIndex = insertIndex;
    };

    const beginAnchorRailDrag = (event) => {
      closeTools({ cancelMove: false });
      const rect = anchor.getBoundingClientRect();
      const ghost = anchor.cloneNode(true);
      ghost.classList.remove("widget-tools-open");
      ghost.classList.add("workspace-anchor-drag-ghost", "anchor-dragging");
      ghost.removeAttribute("id");
      ghost.removeAttribute("data-anchor-initialized");
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.setProperty("--anchor-offset", `${rect.top}px`);
      const placeholder = document.createElement("div");
      placeholder.className = "workspace-anchor-rail-placeholder";
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.setProperty("--anchor-offset", `${rect.top}px`);
      layer.appendChild(placeholder);
      layer.appendChild(ghost);
      anchor.classList.add("anchor-rail-source", "anchor-dragging");
      document.body.classList.add("anchor-rail-drag-active");
      dragState = {
        ghost,
        placeholder,
        peers: anchorRailAnchors(layer).filter((candidate) => candidate !== anchor),
        previewOrder: anchorRailAnchors(layer),
        previewIndex: Number(anchor.dataset.anchorRailOrder) || 0,
      };
      dragging = true;
      didDrag = true;
      updateAnchorRailDrag(event);
    };

    const updateAnchorRailDrag = (event) => {
      if (!dragState) return;
      event.preventDefault();
      const ghostOffset = clampAnchorOffset(event.clientY - pointerOffsetY, anchor);
      dragState.ghost.style.setProperty("--anchor-offset", `${ghostOffset}px`);
      dragState.ghost.style.setProperty("--anchor-drag-x", "0px");
      applyAnchorRailPreview(dragState, event.clientY);
    };

    const cleanupAnchorRailDrag = (commit) => {
      const state = dragState;
      dragState = null;
      anchor.classList.remove("anchor-rail-source", "anchor-dragging");
      document.body.classList.remove("anchor-rail-drag-active");
      state?.ghost.remove();
      state?.placeholder.remove();
      anchorRailAnchors(layer).forEach((candidate) => {
        candidate.classList.remove("anchor-rail-previewing");
        candidate.style.removeProperty("--anchor-drag-x");
      });
      if (commit && state?.previewOrder?.length) {
        commitAnchorRailOrder(layer, state.previewOrder);
        saveFloatingAnchors(layoutKey, getActivePanelProfile(layoutKey));
        emitWorkspaceEvent({
          type: "anchor-reordered",
          source: "anchor-rail",
          layoutKey,
          objectId: anchor.dataset.anchorKey || "",
          objectType: "anchor",
          label: "Anchor reordered",
          payload: {
            railOrder: Number(anchor.dataset.anchorRailOrder) || 0,
            offset: Number(anchor.dataset.anchorOffset) || 0,
          },
        });
      } else {
        commitAnchorRailOrder(layer);
      }
    };

    function handleAnchorMovePointerMove(event) {
      if (activeMovePointerId == null) return;
      if (event.pointerId !== undefined && event.pointerId !== activeMovePointerId) return;
      if (event.buttons !== 1) {
        finishAnchorMove({ type: "pointercancel", pointerId: activeMovePointerId });
        return;
      }
      const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (!dragging && distance < 4) return;
      if (!dragState) beginAnchorRailDrag(event);
      updateAnchorRailDrag(event);
    }

    function finishAnchorMove(event = {}) {
      if (activeMovePointerId == null && !dragState) return;
      if (event.pointerId !== undefined && activeMovePointerId != null && event.pointerId !== activeMovePointerId) return;
      const commit = event.type !== "pointercancel" && event.type !== "keydown" && event.type !== "blur" && event.type !== "lostpointercapture";
      removeAnchorMoveListeners();
      releaseAnchorMovePointer();
      if (dragState) cleanupAnchorRailDrag(commit);
      activeMovePointerId = null;
      activeMovePointerTarget = null;
      dragging = false;
    }

    function handleAnchorMoveKeydown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finishAnchorMove({ type: "keydown" });
    }

    function handleAnchorMoveWindowBlur() {
      finishAnchorMove({ type: "blur" });
    }

    function handleAnchorLostPointerCapture(event) {
      if (activeMovePointerId != null && event.pointerId !== activeMovePointerId) return;
      finishAnchorMove({ type: "lostpointercapture", pointerId: event.pointerId });
    }

    function cancelAnchorMoveFromMenuClose() {
      if (activeMovePointerId == null && !dragState) return;
      finishAnchorMove({ type: "pointercancel", pointerId: activeMovePointerId });
    }

    const clearAnchorBodyPress = () => {
      anchor.classList.remove("anchor-body-pressing");
      document.removeEventListener("pointerup", clearAnchorBodyPress, true);
      document.removeEventListener("pointercancel", clearAnchorBodyPress, true);
      window.removeEventListener("blur", clearAnchorBodyPress);
    };

    anchor.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target?.closest?.(".anchor-tools, .panel-color-menu, .anchor-link-menu")) return;
      anchor.classList.add("anchor-body-pressing");
      document.addEventListener("pointerup", clearAnchorBodyPress, { capture: true, once: true });
      document.addEventListener("pointercancel", clearAnchorBodyPress, { capture: true, once: true });
      window.addEventListener("blur", clearAnchorBodyPress, { once: true });
    });
    anchor.addEventListener("pointerleave", clearAnchorBodyPress);

    tools?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    settings?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (anchor.classList.contains("widget-tools-open")) {
        closeTools();
      } else {
        openTools();
      }
    });
    linkToggle?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTools();
      toggleLinkMenu();
    });
    colorToggle?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTools();
      linkMenu?.classList.remove("anchor-link-menu-open");
      linkToggle?.setAttribute("aria-expanded", "false");
      const nextOpen = !colorMenu?.classList.contains("panel-color-menu-open");
      if (nextOpen) {
        syncPanelThemeVars(anchor, colorMenu);
        colorToggle.__refreshPanelColorMenu?.();
        positionPanelColorMenu(colorToggle, colorMenu);
      }
      colorMenu?.classList.toggle("panel-color-menu-open", nextOpen);
      colorToggle.setAttribute("aria-expanded", String(nextOpen));
    });
    titleButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      anchor.dataset.anchorTitle = anchor.dataset.anchorTitle || anchor.querySelector(".workspace-anchor-label")?.textContent?.trim() || "Anchor";
      saveFloatingAnchors(layoutKey, getActivePanelProfile(layoutKey));
      closeTools();
    });
    deleteButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeTools();
      requestWorkspaceObjectDelete({ targets: [anchor] });
    });
    moveHandle?.addEventListener("pointerdown", startAnchorMove);

    anchor.addEventListener("click", (event) => {
      if (event.target?.closest?.(".anchor-tools, .panel-color-menu, .anchor-link-menu")) return;
      if (dragging || didDrag) {
        event.preventDefault();
        event.stopPropagation();
        didDrag = false;
        return;
      }
      navigateToAnchorTarget(anchor);
    });
    anchor.addEventListener("keydown", (event) => {
      if (event.target?.closest?.(".anchor-tools, .panel-color-menu, .anchor-link-menu")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      navigateToAnchorTarget(anchor);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!anchor.classList.contains("widget-tools-open")) return;
      if (anchor.contains(event.target) || colorMenu?.contains(event.target)) return;
      closeTools();
    });
  };

  const initFloatingAnchorLayer = (layer) => {
    const layoutKey = layer.dataset.anchorLayoutKey || "default";
    const profile = getActivePanelProfile(layoutKey);
    const definitions = loadFloatingAnchorDefinitions(layoutKey, profile);
    layer.replaceChildren();
    definitions.forEach((definition) => {
      const anchor = createFloatingAnchor({
        ...definition,
        layoutKey,
        navigationTargetType: definition.navigationTargetType || (definition.linkedDividerId ? "divider" : "workspace-top"),
        navigationTargetId: definition.navigationTargetId || "",
      });
      layer.appendChild(anchor);
      initFloatingAnchor(anchor, layer);
    });
    normalizeAnchorLayer(layer);
  };

  const ensureWidgetTools = (widget, theme = "#2563eb") => {
    if (widget.querySelector(".widget-tools")) return;
    widget.insertAdjacentHTML("beforeend", `
      <div class="widget-tools" aria-label="Widget tools">
        <div class="panel-tool-drawer widget-tool-drawer">
          ${panelToolButtonsMarkup(theme, true)}
        </div>
        <div class="widget-settings-schema-panel" role="menu" aria-label="Widget settings" hidden></div>
        <div class="widget-workbench-panel" role="dialog" aria-label="Widget workbench" hidden></div>
        <button class="panel-settings-toggle widget-settings-toggle" type="button" aria-label="Widget appearance" aria-expanded="false" title="Widget appearance"><span class="settings-icon" aria-hidden="true"></span></button>
      </div>`);
  };

  const syncWidgetRenderedHeightToFootprint = (widget, rowSpan = null, metrics = null) => {
    if (!isWidgetGridItem(widget)) return;
    const layout = widget.closest(".widget-layout");
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const rowHeight = metrics?.rowHeight ?? gridRowHeightForLayout(layout);
    const rows = Math.max(gridItemMinimumRows(widget), Math.round(Number(rowSpan) || gridItemRowSpan(widget, metrics)));
    widget.dataset.gridRowSpan = String(rows);
    if (rows > 1 || widget.classList.contains("widget-placeholder")) {
      widget.style.height = `${gridHeightForRows(rows, gap, rowHeight)}px`;
    } else {
      widget.style.removeProperty("height");
    }
  };

  const applyWidgetSpan = (widget, span) => {
    const rawSpan = Number(span) || Number(widget.dataset.defaultSpan) || 1;
    const minSpan = gridItemMinimumSpan(widget);
    const safeSpan = Math.max(minSpan, Math.min(6, rawSpan > 6 ? rawSpan / 2 : rawSpan));
    const displaySpan = Math.round(safeSpan);
    const rowSpan = gridItemRowSpan(widget);
    widget.dataset.currentSpan = String(displaySpan);
    if (widget.dataset.gridCol && widget.dataset.gridRow) {
      const currentCol = Number(widget.dataset.gridCol) || 1;
      const currentRow = Number(widget.dataset.gridRow) || 1;
      const safeCol = Math.max(1, Math.min(7 - displaySpan, currentCol));
      widget.dataset.gridCol = String(safeCol);
      widget.dataset.gridRow = String(Math.max(1, currentRow));
      widget.dataset.gridRowSpan = String(rowSpan);
      widget.style.gridColumn = `${safeCol} / span ${displaySpan}`;
      widget.style.gridRow = `${widget.dataset.gridRow} / span ${rowSpan}`;
    } else {
      widget.style.gridColumn = `span ${displaySpan}`;
      widget.style.removeProperty("grid-row");
    }
    widget.style.removeProperty("width");
    widget.style.removeProperty("flex-basis");
    syncWidgetRenderedHeightToFootprint(widget, rowSpan);
  };

  const applyWidgetGridPosition = (widget, col, row, rowSpan = null) => {
    const span = Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 1;
    const safeSpan = Math.max(1, Math.min(6, span > 6 ? span / 2 : span));
    const safeCol = Math.max(1, Math.min(7 - safeSpan, Math.round(Number(col) || 1)));
    const safeRow = Math.max(1, Math.round(Number(row) || 1));
    const safeRows = Math.max(gridItemMinimumRows(widget), Math.round(Number(rowSpan) || gridItemRowSpan(widget)));
    widget.dataset.gridCol = String(safeCol);
    widget.dataset.gridRow = String(safeRow);
    widget.dataset.gridRowSpan = String(safeRows);
    widget.style.gridColumn = `${safeCol} / span ${Math.round(safeSpan)}`;
    widget.style.gridRow = `${safeRow} / span ${safeRows}`;
    syncWidgetRenderedHeightToFootprint(widget, safeRows);
    if (widget.classList.contains("widget-card") && !widget.classList.contains("workspace-anchor-object")) {
      applyWidgetDensityMetadata(widget, resolveWidgetDensityForElement(widget));
    }
  };

  const widgetGridCellFromPoint = (layout, widget, clientX, clientY) => gridCellFromPoint(layout, widget, clientX, clientY);

  const gridItemSpan = (item) => {
    const rawSpan = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    return Math.max(gridItemMinimumSpan(item), Math.min(6, Math.round(rawSpan > 6 ? rawSpan / 2 : rawSpan)));
  };

  const applyGridItemPosition = (item, col, row) => {
    if (isWidgetGridItem(item)) {
      applyWidgetGridPosition(item, col, row);
    } else {
      applyPanelGridPosition(item, col, row);
    }
  };

  const gridItemPixelWidthForSpan = (layout, span, metrics = null) => {
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const layoutWidth = metrics?.width ?? Math.max(1, gridRectForLayout(layout).width);
    const columnWidth = metrics?.columnWidth ?? ((layoutWidth - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS);
    const safeSpan = Math.max(1, Math.min(DASHBOARD_GRID_COLUMNS, Number(span) || 1));
    return (columnWidth * safeSpan) + (gap * Math.max(0, safeSpan - 1));
  };

  const resizeEdgeFromPointer = (event, item, threshold = 10) => {
    if (!event || !item) return null;
    const rect = item.getBoundingClientRect();
    if (event.clientX <= rect.left + threshold) return "left";
    if (event.clientX >= rect.right - threshold) return "right";
    return null;
  };

  let activeInteractionAutoScroll = null;

  const beginInteractionAutoScroll = ({ layout = null, onScrollFrame } = {}) => {
    activeInteractionAutoScroll?.stop();
    const edgeZone = 104;
    const edgeDeadZone = 22;
    const topBrakeDistance = edgeZone * 2.25;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const maxVelocity = prefersReducedMotion ? 120 : 280;
    const minVelocity = prefersReducedMotion ? 8 : 18;
    const startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    let frame = null;
    let startTimer = null;
    let lastFrameTime = 0;
    let stopped = false;
    let lastClientX = 0;
    let lastClientY = 0;
    let lastEvent = null;
    let currentVelocity = 0;
    let scrollRemainderY = 0;
    let extensionHeight = 0;
    let extensionTargetHeight = 0;
    let originalBodyPaddingBottom = null;
    const host = layout ? gridHostForLayout(layout) : null;
    const originalRootOverflowAnchor = document.documentElement.style.overflowAnchor || "";
    const originalBodyOverflowAnchor = document.body.style.overflowAnchor || "";
    const originalHostOverflowAnchor = host?.style?.overflowAnchor || "";
    const originalRootOverscrollBehaviorY = document.documentElement.style.overscrollBehaviorY || "";
    const originalBodyOverscrollBehaviorY = document.body.style.overscrollBehaviorY || "";
    const originalRootScrollBehavior = document.documentElement.style.scrollBehavior || "";
    document.documentElement.style.overflowAnchor = "none";
    document.body.style.overflowAnchor = "none";
    document.documentElement.style.overscrollBehaviorY = "none";
    document.body.style.overscrollBehaviorY = "none";
    document.documentElement.style.scrollBehavior = "auto";
    if (host?.style) host.style.overflowAnchor = "none";

    const maxScrollY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const edgePressure = (distance) => {
      if (distance >= edgeZone) return 0;
      const activeRange = Math.max(1, edgeZone - edgeDeadZone);
      return Math.max(0, Math.min(1, (edgeZone - distance) / activeRange));
    };
    const topDistancePressure = (scrollY) => {
      if (scrollY <= 0) return 0;
      return Math.max(0, Math.min(1, scrollY / topBrakeDistance));
    };
    const bottomEdgePressure = () => edgePressure(window.innerHeight - lastClientY);
    const topEdgePressure = () => edgePressure(lastClientY);
    const hasEdgePressure = () => (lastClientY < edgeZone && window.scrollY > 0) || bottomEdgePressure() > 0;
    const targetVelocityForPointer = () => {
      if (lastClientY < edgeZone && window.scrollY > 0) {
        const pressure = topEdgePressure();
        if (!pressure) return 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const distancePressure = topDistancePressure(scrollY);
        const easedDistancePressure = distancePressure * distancePressure * (3 - (2 * distancePressure));
        const baseVelocity = minVelocity + ((maxVelocity - minVelocity) * pressure * pressure * pressure);
        const brakedVelocity = minVelocity + ((baseVelocity - minVelocity) * easedDistancePressure);
        return -Math.min(baseVelocity, brakedVelocity);
      }
      const bottomDistance = window.innerHeight - lastClientY;
      if (bottomDistance < edgeZone && window.scrollY < maxScrollY() - 1) {
        const pressure = edgePressure(bottomDistance);
        if (!pressure) return 0;
        return minVelocity + ((maxVelocity - minVelocity) * pressure * pressure * pressure);
      }
      return 0;
    };
    const smoothVelocityForFrame = (targetVelocity, deltaMs) => {
      const smoothing = 1 - Math.exp(-Math.max(8, Math.min(50, deltaMs)) / 86);
      currentVelocity += (targetVelocity - currentVelocity) * smoothing;
      if (!targetVelocity && Math.abs(currentVelocity) < 2) currentVelocity = 0;
      return currentVelocity;
    };
    const ensureExtension = (deltaMs = 16.7) => {
      const bottomDistance = window.innerHeight - lastClientY;
      const pressure = edgePressure(bottomDistance);
      if (!pressure) return;
      if (originalBodyPaddingBottom == null) {
        originalBodyPaddingBottom = document.body.style.paddingBottom || "";
        document.body.classList.add("dashboard-interaction-scroll-extended");
      }
      const remaining = Math.max(0, document.documentElement.scrollHeight - (window.scrollY + window.innerHeight));
      const desiredRunway = Math.round(window.innerHeight * (.55 + (.85 * pressure)));
      if (remaining < desiredRunway) {
        extensionTargetHeight = Math.max(extensionTargetHeight, extensionHeight + (desiredRunway - remaining));
      }
      if (extensionTargetHeight <= extensionHeight) return;
      const growRate = prefersReducedMotion ? 900 : 1200;
      const maxStep = Math.max(12, growRate * (Math.max(8, Math.min(50, deltaMs)) / 1000));
      extensionHeight = Math.min(extensionTargetHeight, extensionHeight + maxStep);
      document.body.style.paddingBottom = `${Math.ceil(extensionHeight)}px`;
    };
    const stopFrame = () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      if (startTimer != null) window.clearTimeout(startTimer);
      frame = null;
      startTimer = null;
      document.body.classList.remove("dashboard-auto-scroll-active");
      currentVelocity = 0;
      scrollRemainderY = 0;
    };
    const removeExtension = () => {
      if (originalBodyPaddingBottom) {
        document.body.style.paddingBottom = originalBodyPaddingBottom;
      } else {
        document.body.style.removeProperty("padding-bottom");
      }
      document.body.classList.remove("dashboard-interaction-scroll-extended");
      extensionHeight = 0;
      extensionTargetHeight = 0;
      originalBodyPaddingBottom = null;
      if (originalRootOverflowAnchor) {
        document.documentElement.style.overflowAnchor = originalRootOverflowAnchor;
      } else {
        document.documentElement.style.removeProperty("overflow-anchor");
      }
      if (originalBodyOverflowAnchor) {
        document.body.style.overflowAnchor = originalBodyOverflowAnchor;
      } else {
        document.body.style.removeProperty("overflow-anchor");
      }
      if (host?.style) {
        if (originalHostOverflowAnchor) {
          host.style.overflowAnchor = originalHostOverflowAnchor;
        } else {
          host.style.removeProperty("overflow-anchor");
        }
      }
      if (originalRootOverscrollBehaviorY) {
        document.documentElement.style.overscrollBehaviorY = originalRootOverscrollBehaviorY;
      } else {
        document.documentElement.style.removeProperty("overscroll-behavior-y");
      }
      if (originalBodyOverscrollBehaviorY) {
        document.body.style.overscrollBehaviorY = originalBodyOverscrollBehaviorY;
      } else {
        document.body.style.removeProperty("overscroll-behavior-y");
      }
      if (originalRootScrollBehavior) {
        document.documentElement.style.scrollBehavior = originalRootScrollBehavior;
      } else {
        document.documentElement.style.removeProperty("scroll-behavior");
      }
    };
    const tick = (frameTime = performance.now()) => {
      frame = null;
      if (stopped) return;
      const deltaMs = lastFrameTime ? Math.min(50, Math.max(8, frameTime - lastFrameTime)) : 16.7;
      lastFrameTime = frameTime;
      ensureExtension(deltaMs);
      const targetVelocity = targetVelocityForPointer();
      if (!targetVelocity) {
        stopFrame();
        return;
      }
      const velocity = smoothVelocityForFrame(targetVelocity, deltaMs);
      const before = window.scrollY || document.documentElement.scrollTop || 0;
      const requestedDelta = (velocity * (deltaMs / 1000)) + scrollRemainderY;
      const maxUpwardDelta = () => {
        const distancePressure = topDistancePressure(before);
        const allowedVelocity = minVelocity + ((maxVelocity - minVelocity) * distancePressure);
        return Math.max(1, allowedVelocity * (deltaMs / 1000));
      };
      const boundedDelta = requestedDelta < 0
        ? Math.max(requestedDelta, -before, -maxUpwardDelta())
        : Math.min(requestedDelta, maxScrollY() - before);
      window.scrollBy(0, boundedDelta);
      const after = window.scrollY || document.documentElement.scrollTop || 0;
      const actualDelta = after - before;
      const atScrollLimit = (boundedDelta < 0 && after <= 0) || (boundedDelta > 0 && after >= maxScrollY() - .5);
      scrollRemainderY = atScrollLimit ? 0 : Math.max(-1.5, Math.min(1.5, boundedDelta - actualDelta));
      if (Math.abs(after - before) > 0.1) {
        onScrollFrame?.(lastEvent, {
          clientX: lastClientX,
          clientY: lastClientY,
          deltaY: after - before,
          totalDeltaY: after - startScrollY,
          scrollY: after,
        });
      }
      if (!stopped && targetVelocityForPointer()) {
        document.body.classList.add("dashboard-auto-scroll-active");
        frame = window.requestAnimationFrame(tick);
      } else {
        lastFrameTime = 0;
        stopFrame();
      }
    };
    const ensureFrame = () => {
      if (frame != null || startTimer != null || stopped) return;
      if (!targetVelocityForPointer() && !hasEdgePressure()) {
        stopFrame();
        return;
      }
      startTimer = window.setTimeout(() => {
        startTimer = null;
        if (stopped || (!targetVelocityForPointer() && !hasEdgePressure())) {
          stopFrame();
          return;
        }
        document.body.classList.add("dashboard-auto-scroll-active");
        lastFrameTime = 0;
        frame = window.requestAnimationFrame(tick);
      }, 90);
    };
    const controller = {
      update(event) {
        if (!event || stopped) return;
        lastEvent = event;
        lastClientX = event.clientX;
        lastClientY = event.clientY;
        ensureFrame();
      },
      clearExtension() {
        removeExtension();
      },
      stop(options = {}) {
        stopped = true;
        stopFrame();
        if (!options.preserveExtension) removeExtension();
        if (activeInteractionAutoScroll === controller) activeInteractionAutoScroll = null;
      },
    };
    activeInteractionAutoScroll = controller;
    return controller;
  };

  let activeResizeLifecycle = null;

  const beginResizeLifecycle = ({ event, source, layout = null, onMove, onEnd, onCleanup }) => {
    activeResizeLifecycle?.cancel();
    let ended = false;
    let lastMoveEvent = event;
    const autoScroll = beginInteractionAutoScroll({
      layout,
      onScrollFrame: (scrollEvent) => {
        if (ended || !lastMoveEvent) return;
        try {
          onMove?.(scrollEvent || lastMoveEvent);
        } catch (error) {
          fail(error, scrollEvent || lastMoveEvent);
        }
      },
    });
    const pointerId = event.pointerId;
    const pointerTarget = event.currentTarget || source;
    const removeListeners = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handlePointerEnd);
      document.removeEventListener("pointercancel", handlePointerEnd);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("blur", handleWindowBlur);
    };
    const releasePointer = () => {
      if (pointerId == null || !pointerTarget?.hasPointerCapture?.(pointerId)) return;
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be released by the browser during cancel.
      }
    };
    const finish = (finishEvent = null, canceled = false) => {
      if (ended) return;
      ended = true;
      autoScroll.stop({ preserveExtension: !canceled });
      removeListeners();
      releasePointer();
      document.body.classList.remove("panel-interaction-active");
      document.body.classList.remove("panel-resize-active");
      source?.classList?.remove("dashboard-active-resize");
      try {
        onEnd?.(finishEvent, canceled);
      } finally {
        onCleanup?.(finishEvent, canceled);
        autoScroll.clearExtension();
        if (activeResizeLifecycle?.finish === finish) activeResizeLifecycle = null;
      }
    };
    const fail = (error, failEvent) => {
      try {
        finish(failEvent, true);
      } finally {
        window.setTimeout(() => {
          throw error;
        }, 0);
      }
    };
    function handleMove(moveEvent) {
      try {
        lastMoveEvent = moveEvent;
        autoScroll.update(moveEvent);
        onMove?.(moveEvent);
      } catch (error) {
        fail(error, moveEvent);
      }
    }
    function handlePointerEnd(endEvent) {
      finish(endEvent, endEvent.type === "pointercancel");
    }
    function handleKeydown(keyEvent) {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      finish(keyEvent, true);
    }
    function handleWindowBlur(blurEvent) {
      finish(blurEvent, true);
    }

    try {
      if (pointerId != null) pointerTarget?.setPointerCapture?.(pointerId);
    } catch {
      // Document-level listeners still cover browsers that decline capture.
    }
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerEnd);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("blur", handleWindowBlur);
    activeResizeLifecycle = {
      finish,
      cancel: () => finish(null, true),
    };
    return activeResizeLifecycle;
  };

  const createResizePreview = (layout, item, placeholderClass, rect, metrics = null) => {
    const placeholder = document.createElement("div");
    placeholder.className = `${placeholderClass} dashboard-resize-preview`;
    placeholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
    placeholder.dataset.defaultSpan = item.dataset.defaultSpan || placeholder.dataset.currentSpan;
    placeholder.dataset.gridRowSpan = String(gridItemRowSpan(item, metrics));
    if (item.dataset.minW) placeholder.dataset.minW = item.dataset.minW;
    if (item.dataset.minSpan) placeholder.dataset.minSpan = item.dataset.minSpan;
    if (item.dataset.minH) placeholder.dataset.minH = item.dataset.minH;
    if (item.dataset.minRows) placeholder.dataset.minRows = item.dataset.minRows;
    if (item.dataset.widgetType) placeholder.dataset.widgetType = item.dataset.widgetType;
    if (item.dataset.gridCol) placeholder.dataset.gridCol = item.dataset.gridCol;
    if (item.dataset.gridRow) placeholder.dataset.gridRow = item.dataset.gridRow;
    placeholder.style.gridColumn = item.style.gridColumn || `span ${placeholder.dataset.currentSpan}`;
    placeholder.style.gridRow = item.style.gridRow || "";
    const footprintHeight = placeholderClass === "db-panel-placeholder"
      ? gridHeightForRows(gridItemRowSpan(item, metrics), metrics?.gap ?? gridGapForLayout(layout))
      : Math.max(DASHBOARD_GRID_ROW_HEIGHT, rect.height);
    placeholder.style.height = `${footprintHeight}px`;
    layout.insertBefore(placeholder, item);
    return placeholder;
  };

  const expandedPanelFootprintRows = (panel, layout, proposedRows = null, metrics = null) => {
    if (!workspaceObjectCapabilities(panel).hasExpandedFootprint) return 1;
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const minRows = panelExpandedMinimumRows(panel, layout, metrics);
    const candidateRows = Number(proposedRows);
    if (Number.isFinite(candidateRows) && candidateRows > 0) {
      return Math.max(minRows, Math.round(candidateRows));
    }
    const savedHeight = Number(panel.dataset.savedHeight);
    if (Number.isFinite(savedHeight) && savedHeight > 0) {
      return gridRowsFromHeight(savedHeight, gap, minRows);
    }
    if (!panel.classList.contains("db-panel-collapsed")) {
      return Math.max(minRows, gridItemRowSpan(panel, metrics));
    }
    return minRows;
  };

  const expandedPanelFootprintHeight = (panel, layout, proposedRows = null, metrics = null) => {
    const rows = expandedPanelFootprintRows(panel, layout, proposedRows, metrics);
    return gridHeightForRows(rows, metrics?.gap ?? gridGapForLayout(layout));
  };

  const createExpandedFootprintGhost = (panel, layout, rect, proposedRows = null, metrics = null) => {
    if (!workspaceObjectCapabilities(panel).hasExpandedFootprint) return null;
    if (!panel?.classList?.contains("db-panel-collapsed")) return null;
    const ghost = document.createElement("div");
    ghost.className = "dashboard-expanded-footprint-ghost";
    ghost.setAttribute("aria-hidden", "true");
    document.body.appendChild(ghost);
    updateExpandedFootprintGhost(ghost, panel, layout, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      rows: proposedRows,
    }, metrics);
    return ghost;
  };

  const updateExpandedFootprintGhost = (ghost, panel, layout, rect, metrics = null) => {
    if (!ghost) return;
    const height = expandedPanelFootprintHeight(panel, layout, rect.rows, metrics);
    ghost.style.left = `${Math.round(rect.left)}px`;
    ghost.style.top = `${Math.round(rect.top)}px`;
    ghost.style.width = `${Math.round(rect.width)}px`;
    ghost.style.height = `${Math.round(height)}px`;
  };

  const beginLiveResizeSurface = (item, rect) => {
    const preview = item.cloneNode(true);
    preview.classList.add("dashboard-live-resize");
    preview.classList.remove("dashboard-active-resize", "db-panel-dragging", "widget-dragging");
    preview.setAttribute("aria-hidden", "true");
    preview.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    item.classList.add("dashboard-resize-source");
    document.body.appendChild(preview);
    updateLiveResizeSurface(preview, rect.width, rect.height, rect.left, rect.top);
    return preview;
  };

  const updateLiveResizeSurface = (preview, width, height, left = null, top = null) => {
    if (!preview) return;
    if (Number.isFinite(left)) preview.style.left = `${Math.round(left)}px`;
    if (Number.isFinite(top)) preview.style.top = `${Math.round(top)}px`;
    preview.style.width = `${Math.round(width)}px`;
    preview.style.height = `${Math.round(height)}px`;
  };

  const GROUP_BOUNDARY_OUTSET = 5;

  const createGroupBoundarySurface = (className = "") => {
    const boundary = document.createElement("div");
    boundary.className = `dashboard-group-boundary ${className}`.trim();
    boundary.setAttribute("aria-hidden", "true");
    document.body.appendChild(boundary);
    return boundary;
  };

  const updateGroupBoundarySurface = (boundary, rect) => {
    if (!boundary || !rect) return;
    updateLiveResizeSurface(
      boundary,
      Math.max(1, rect.width + (GROUP_BOUNDARY_OUTSET * 2)),
      Math.max(1, rect.height + (GROUP_BOUNDARY_OUTSET * 2)),
      rect.left - GROUP_BOUNDARY_OUTSET,
      rect.top - GROUP_BOUNDARY_OUTSET
    );
  };

  const clearLiveResizeSurface = (item, preview = null) => {
    preview?.remove();
    item.classList.remove("dashboard-resize-source");
  };

  const snapshotGridLayout = (layout) => new Map(
    [...gridHostForLayout(layout).querySelectorAll(".widget-layout > .widget-card, .panel-layout > .db-panel")]
      .filter((item) => gridHostForLayout(layout) === layout || !isPanelInternalGridItem(item))
      .map((item) => [item, {
        gridCol: item.dataset.gridCol,
        gridRow: item.dataset.gridRow,
        gridRowSpan: item.dataset.gridRowSpan,
        currentSpan: item.dataset.currentSpan,
        savedHeight: item.dataset.savedHeight,
        gridColumnStyle: item.style.gridColumn,
        gridRowStyle: item.style.gridRow,
        heightStyle: item.style.height,
      }])
  );

  const restoreGridLayoutSnapshot = (snapshot, options = {}) => {
    const excluded = new Set([].concat(options.exclude || []).filter(Boolean));
    snapshot?.forEach((state, item) => {
      if (!item.isConnected) return;
      if (excluded.has(item)) return;
      if (state.gridCol === undefined) {
        delete item.dataset.gridCol;
      } else {
        item.dataset.gridCol = state.gridCol;
      }
      if (state.gridRow === undefined) {
        delete item.dataset.gridRow;
      } else {
        item.dataset.gridRow = state.gridRow;
      }
      if (state.gridRowSpan === undefined) {
        delete item.dataset.gridRowSpan;
      } else {
        item.dataset.gridRowSpan = state.gridRowSpan;
      }
      if (state.currentSpan === undefined) {
        delete item.dataset.currentSpan;
      } else {
        item.dataset.currentSpan = state.currentSpan;
      }
      if (state.savedHeight === undefined) {
        delete item.dataset.savedHeight;
      } else {
        item.dataset.savedHeight = state.savedHeight;
      }
      item.style.gridColumn = state.gridColumnStyle || "";
      item.style.gridRow = state.gridRowStyle || "";
      item.style.height = state.heightStyle || "";
      if (item.classList.contains("db-panel-collapsed") && item.dataset.gridCol && item.dataset.gridRow) {
        item.dataset.gridRowSpan = "1";
        applyPanelGridPosition(item, item.dataset.gridCol, item.dataset.gridRow);
      }
    });
  };

  const serializableExpansionBaselineState = (snapshot, item) => {
    const state = snapshot?.get?.(item);
    if (!state?.gridCol || !state?.gridRow) return null;
    return {
      gridCol: state.gridCol,
      gridRow: state.gridRow,
      gridRowSpan: state.gridRowSpan || String(gridItemRowSpan(item)),
      currentSpan: state.currentSpan || String(gridItemSpan(item)),
      savedHeight: state.savedHeight,
      gridColumnStyle: state.gridColumnStyle,
      gridRowStyle: state.gridRowStyle,
      heightStyle: state.heightStyle,
    };
  };

  const expansionBaselineSnapshotForLayoutKey = (layoutKey) => {
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    const snapshot = panelLayout?.__expansionBaselineSnapshot || null;
    const hasActiveExpansionSource = [...(panelLayout?.__activeExpansionPanels || [])]
      .some((panel) => {
        if (!panel.__activeExpansionSource || panel.classList.contains("db-panel-collapsed")) return false;
        const baselineState = snapshot?.get(panel);
        if (!baselineState) return false;
        return (Number(baselineState.gridRowSpan) || 1) < gridItemRowSpan(panel);
      });
    return hasActiveExpansionSource ? snapshot : null;
  };

  const markLoadedExpansionBaseline = (item, state) => {
    if (state?.gridCol && state?.gridRow) {
      item.__loadedExpansionBaselineState = state;
    } else {
      delete item.__loadedExpansionBaselineState;
    }
  };

  const restoreLoadedExpansionBaseline = (layoutKey) => {
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    if (!panelLayout) return;
    const expandedPanels = [...panelLayout.querySelectorAll(":scope > .db-panel:not(.db-panel-collapsed):not([hidden])")]
      .filter((panel) => {
        const baselineState = panel.__loadedExpansionBaselineState;
        if (!baselineState) return false;
        if (panel.__loadedExpansionActive) return true;
        return (Number(baselineState.gridRowSpan) || 1) < gridItemRowSpan(panel);
      });
    if (!expandedPanels.length) return;
    const currentSnapshot = snapshotGridLayout(panelLayout);
    let hasStoredBaseline = false;
    currentSnapshot.forEach((state, item) => {
      const loaded = item.__loadedExpansionBaselineState;
      if (loaded?.gridCol && loaded?.gridRow) {
        hasStoredBaseline = true;
        currentSnapshot.set(item, { ...state, ...loaded });
      }
    });
    if (!hasStoredBaseline) return;
    panelLayout.__expansionBaselineSnapshot = currentSnapshot;
    panelLayout.__activeExpansionPanels = new Set(expandedPanels);
    expandedPanels.forEach((panel) => {
      panel.__activeExpansionSource = true;
    });
  };

  const gridBoundsForItem = (item, metrics = null) => {
    const col = Math.max(1, Math.round(Number(item.dataset.gridCol) || 1));
    const row = Math.max(1, Math.round(Number(item.dataset.gridRow) || 1));
    const span = gridItemSpan(item);
    const rowSpan = gridItemRowSpan(item, metrics);
    return {
      col,
      row,
      span,
      rowSpan,
      right: col + span - 1,
      bottom: row + rowSpan - 1,
    };
  };

  const gridBoundsOverlap = (a, b) => (
    a.col <= b.right &&
    a.right >= b.col &&
    a.row <= b.bottom &&
    a.bottom >= b.row
  );

  const SPATIAL_INDEX_MIN_ENTRIES = 18;
  const occupancyIndexCache = new WeakMap();
  const indexedCollisionEntries = (bounds, occupied) => {
    if (!Array.isArray(occupied) || occupied.length < SPATIAL_INDEX_MIN_ENTRIES) return occupied || [];
    const cached = occupancyIndexCache.get(occupied);
    let index = cached?.length === occupied.length ? cached : null;
    if (!index) {
      const rowBuckets = new Map();
      occupied.forEach((entry) => {
        if (!entry?.bounds) return;
        for (let row = entry.bounds.row; row <= entry.bounds.bottom; row += 1) {
          if (!rowBuckets.has(row)) rowBuckets.set(row, []);
          rowBuckets.get(row).push(entry);
        }
      });
      index = { length: occupied.length, rowBuckets };
      occupancyIndexCache.set(occupied, index);
    }
    const candidates = [];
    const seen = new Set();
    for (let row = bounds.row; row <= bounds.bottom; row += 1) {
      (index.rowBuckets.get(row) || []).forEach((entry) => {
        if (seen.has(entry)) return;
        seen.add(entry);
        candidates.push(entry);
      });
    }
    return candidates;
  };

  const nextGridSlot = (bounds) => {
    if (bounds.col < 7 - bounds.span) {
      return { col: bounds.col + 1, row: bounds.row };
    }
    return { col: 1, row: bounds.row + 1 };
  };

  const localCollisionItems = (layout) => {
    const host = gridHostForLayout(layout);
    const selector = host !== layout
      ? ".widget-layout > .widget-card:not([hidden]), .widget-layout > .widget-placeholder, .panel-layout > .db-panel:not([hidden]), .panel-layout > .db-panel-placeholder"
      : layout.classList.contains("widget-layout")
        ? ":scope > .widget-card:not([hidden]), :scope > .widget-placeholder"
        : ":scope > .db-panel:not([hidden]), :scope > .db-panel-placeholder";
    return [...host.querySelectorAll(selector)]
      .filter((item) => (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
  };

  const applyLocalCollisionLayout = (layout, activeItems, options = {}) => {
    const orderedItems = orderedGridItems?.(layout, { includePlaceholders: true }) || [];
    if (orderedItems.length) {
      applyOrderedGridLayout(layout, orderedItems);
      return;
    }
    const activeSet = new Set([].concat(activeItems || []).filter(Boolean));
    if (!activeSet.size) return;
    const origin = options.origin || null;
    const target = options.target || null;
    const items = localCollisionItems(layout);
    const occupied = new Set();
    const sortedItems = items
      .filter((item) => !activeSet.has(item))
      .map((item) => ({ item, bounds: gridBoundsForItem(item) }))
      .sort((a, b) => (
        a.bounds.row - b.bounds.row ||
        a.bounds.col - b.bounds.col ||
        [...gridHostForLayout(layout).querySelectorAll(".widget-card, .db-panel, .widget-placeholder, .db-panel-placeholder")].indexOf(a.item) -
          [...gridHostForLayout(layout).querySelectorAll(".widget-card, .db-panel, .widget-placeholder, .db-panel-placeholder")].indexOf(b.item)
      ));
    const occupy = (bounds) => {
      for (let row = bounds.row; row <= bounds.bottom; row += 1) {
        for (let col = bounds.col; col <= bounds.right; col += 1) {
          occupied.add(`${row}:${col}`);
        }
      }
    };
    const canOccupy = (bounds) => {
      if (bounds.col < 1 || bounds.right > DASHBOARD_GRID_COLUMNS) return false;
      for (let row = bounds.row; row <= bounds.bottom; row += 1) {
        for (let col = bounds.col; col <= bounds.right; col += 1) {
          if (occupied.has(`${row}:${col}`)) return false;
        }
      }
      return true;
    };
    const boundsAt = (bounds, col, row) => ({
      ...bounds,
      col,
      row,
      right: col + bounds.span - 1,
      bottom: row + bounds.rowSpan - 1,
    });
    const findAvailableSlotFrom = (bounds, col, row) => {
      let nextBounds = boundsAt(bounds, col, row);
      for (let attempts = 0; attempts < 120; attempts += 1) {
        if (canOccupy(nextBounds)) return nextBounds;
        const next = nextGridSlot(nextBounds);
        nextBounds = boundsAt(bounds, next.col, next.row);
      }
      return null;
    };
    const findNearestAvailableSlot = (bounds, preferred = bounds) => {
      const maxCol = Math.max(1, DASHBOARD_GRID_COLUMNS - bounds.span + 1);
      const preferredCol = Math.max(1, Math.min(maxCol, Math.round(Number(preferred.col) || bounds.col)));
      const preferredRow = Math.max(1, Math.round(Number(preferred.row) || bounds.row));
      const rowLimit = Math.max(
        preferredRow + 24,
        bounds.row + 24,
        ...sortedItems.map((entry) => entry.bounds.bottom + 8),
        ...activeBounds.map((entry) => entry.bottom + 8),
      );
      let best = null;
      for (let row = 1; row <= rowLimit; row += 1) {
        for (let col = 1; col <= maxCol; col += 1) {
          const candidate = boundsAt(bounds, col, row);
          if (!canOccupy(candidate)) continue;
          if (options.forwardOnly && (row < bounds.row || (row === bounds.row && col < bounds.col))) continue;
          const distance = (Math.abs(row - preferredRow) * DASHBOARD_GRID_COLUMNS) + Math.abs(col - preferredCol);
          const beforePreferred = row < preferredRow || (row === preferredRow && col < preferredCol);
          const placementRank = distance + (beforePreferred ? 0.25 : 0);
          if (
            !best ||
            placementRank < best.placementRank ||
            (placementRank === best.placementRank && row < best.bounds.row) ||
            (placementRank === best.placementRank && row === best.bounds.row && col < best.bounds.col)
          ) {
            best = { bounds: candidate, placementRank };
          }
        }
      }
      return best?.bounds || null;
    };

    [...activeSet].map(gridBoundsForItem).forEach(occupy);

    if (options.protectBeforeOrigin && origin) {
      const protectedItems = sortedItems.filter(({ bounds }) => (
        bounds.row < origin.row ||
        (bounds.row === origin.row && bounds.col < origin.col)
      ));
      protectedItems.forEach(({ bounds }) => occupy(bounds));
      protectedItems.forEach((entry) => sortedItems.splice(sortedItems.indexOf(entry), 1));
    }

    const activeBounds = [...activeSet].map(gridBoundsForItem);
    const primaryActive = [...activeSet][0];
    const originBounds = origin && primaryActive ? boundsAt(gridBoundsForItem(primaryActive), origin.col, origin.row) : null;
    const swapCandidate = originBounds
      ? sortedItems.find(({ bounds }) => activeBounds.some((active) => gridBoundsOverlap(bounds, active)))
      : null;

    if (swapCandidate) {
      const swapBounds = findNearestAvailableSlot(swapCandidate.bounds, originBounds) ||
        findAvailableSlotFrom(swapCandidate.bounds, originBounds.col, originBounds.row);
      if (swapBounds) {
        applyGridItemPosition(swapCandidate.item, swapBounds.col, swapBounds.row);
        occupy(swapBounds);
        sortedItems.splice(sortedItems.indexOf(swapCandidate), 1);
      }
    }

    sortedItems.forEach(({ item, bounds }) => {
      if (canOccupy(bounds)) {
        occupy(bounds);
        return;
      }
      const nearestBounds = findNearestAvailableSlot(bounds);
      if (nearestBounds) {
        applyGridItemPosition(item, nearestBounds.col, nearestBounds.row);
        occupy(nearestBounds);
        return;
      }
      const next = nextGridSlot(bounds);
      const shiftedBounds = findAvailableSlotFrom(bounds, next.col, next.row);
      if (shiftedBounds) {
        applyGridItemPosition(item, shiftedBounds.col, shiftedBounds.row);
        occupy(shiftedBounds);
      }
    });
  };

  const syncDefaultDashboardGrid = (layoutKey, options = {}) => {
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    if (!widgetLayout || !panelLayout || !widgetLayout.closest(".dashboard-layout-grid")) return;
    const force = Boolean(options.force);

    const widgets = [...widgetLayout.querySelectorAll(":scope > .widget-card:not([hidden])")];
    const panels = [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")];
    if (!force) {
      const occupied = [];
      const hasCommittedGrid = (item) => Boolean(Number(item.dataset.gridCol) && Number(item.dataset.gridRow));
      const reserve = (item) => occupied.push({ item, bounds: gridBoundsForItem(item) });
      widgets.filter(hasCommittedGrid).forEach(reserve);
      panels.filter(hasCommittedGrid).forEach(reserve);
      const findOpenSlot = (item, startCol, startRow) => {
        const span = gridItemSpan(item);
        for (let candidateRow = Math.max(1, startRow); candidateRow < Math.max(1, startRow) + 160; candidateRow += 1) {
          const firstCol = candidateRow === startRow ? Math.max(1, startCol) : 1;
          for (let candidateCol = firstCol; candidateCol <= DASHBOARD_GRID_COLUMNS - span + 1; candidateCol += 1) {
            const bounds = boundsAtGridSlot(item, candidateCol, candidateRow);
            if (canPlaceBounds(bounds, occupied)) return bounds;
          }
        }
        return nearestSparseSlot(item, { col: Math.max(1, startCol), row: Math.max(1, startRow) }, occupied);
      };
      const placeMissing = (items, startRow = 1) => {
        let cursorCol = 1;
        let cursorRow = startRow;
        items.forEach((item) => {
          if (hasCommittedGrid(item)) return;
          const bounds = findOpenSlot(item, cursorCol, cursorRow);
          applyGridItemPosition(item, bounds.col, bounds.row);
          occupied.push({ item, bounds: gridBoundsForItem(item) });
          cursorRow = bounds.row;
          cursorCol = bounds.col + bounds.span;
          if (cursorCol > DASHBOARD_GRID_COLUMNS) {
            cursorRow += 1;
            cursorCol = 1;
          }
        });
      };
      placeMissing(widgets, 1);
      const widgetBottom = widgets.reduce((bottom, item) => {
        const bounds = gridBoundsForItem(item);
        return Math.max(bottom, bounds.bottom);
      }, 0);
      placeMissing(panels, Math.max(3, widgetBottom + 1));
      return;
    }

    const occupied = [];
    const placeForcedItems = (items, applyPosition, startRow = 1) => {
      let cursorCol = 1;
      let cursorRow = startRow;
      const findSequentialBounds = (item) => {
        const span = gridItemSpan(item);
        for (let candidateRow = Math.max(1, cursorRow); candidateRow < Math.max(1, cursorRow) + 160; candidateRow += 1) {
          const firstCol = candidateRow === cursorRow ? Math.max(1, cursorCol) : 1;
          for (let candidateCol = firstCol; candidateCol <= DASHBOARD_GRID_COLUMNS - span + 1; candidateCol += 1) {
            const bounds = boundsAtGridSlot(item, candidateCol, candidateRow);
            if (canPlaceBounds(bounds, occupied)) return bounds;
          }
        }
        return nearestSparseSlot(item, { col: Math.max(1, cursorCol), row: Math.max(1, cursorRow) }, occupied);
      };

      items.forEach((item) => {
        const defaultCol = Number(item.dataset.defaultGridCol);
        const defaultRow = Number(item.dataset.defaultGridRow);
        let bounds = null;
        if (defaultCol && defaultRow && defaultRow >= startRow) {
          const defaultBounds = boundsAtGridSlot(item, defaultCol, defaultRow);
          if (canPlaceBounds(defaultBounds, occupied)) bounds = defaultBounds;
        }
        bounds = bounds || findSequentialBounds(item);
        applyPosition(item, bounds.col, bounds.row);
        occupied.push({ item, bounds: gridBoundsForItem(item) });
        cursorRow = bounds.row;
        cursorCol = bounds.col + bounds.span;
        if (cursorCol > DASHBOARD_GRID_COLUMNS) {
          cursorRow += 1;
          cursorCol = 1;
        }
      });
    };

    placeForcedItems(widgets, applyWidgetGridPosition, 1);
    const widgetBottom = widgets.reduce((bottom, item) => {
      const bounds = gridBoundsForItem(item);
      return Math.max(bottom, bounds.bottom);
    }, 0);
    placeForcedItems(panels, applyPanelGridPosition, Math.max(3, widgetBottom + 1));
  };

  const normalizeGridLayout = (layout, priorityItem = null) => {
    const host = gridHostForLayout(layout);
    const selector = host !== layout
      ? ".widget-layout > .widget-card:not([hidden]), .widget-layout > .widget-placeholder, .panel-layout > .db-panel:not([hidden]), .panel-layout > .db-panel-placeholder"
      : layout.classList.contains("widget-layout")
        ? ":scope > .widget-card:not([hidden]), :scope > .widget-placeholder"
        : ":scope > .db-panel:not([hidden]), :scope > .db-panel-placeholder";
    const items = [...host.querySelectorAll(selector)]
      .filter((item) => !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
    const occupied = new Set();
    const orderedItems = items.sort((a, b) => {
      if (a === priorityItem) return -1;
      if (b === priorityItem) return 1;
      const rowDelta = (Number(a.dataset.gridRow) || 1) - (Number(b.dataset.gridRow) || 1);
      if (rowDelta) return rowDelta;
      const colDelta = (Number(a.dataset.gridCol) || 1) - (Number(b.dataset.gridCol) || 1);
      if (colDelta) return colDelta;
      return [...host.querySelectorAll(".widget-card, .db-panel, .widget-placeholder, .db-panel-placeholder")].indexOf(a) -
        [...host.querySelectorAll(".widget-card, .db-panel, .widget-placeholder, .db-panel-placeholder")].indexOf(b);
    });
    const canOccupy = (row, col, span, rowSpan) => {
      if (col < 1 || col + span - 1 > DASHBOARD_GRID_COLUMNS) return false;
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        for (let colOffset = 0; colOffset < span; colOffset += 1) {
          if (occupied.has(`${row + rowOffset}:${col + colOffset}`)) return false;
        }
      }
      return true;
    };
    const occupy = (row, col, span, rowSpan) => {
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        for (let colOffset = 0; colOffset < span; colOffset += 1) {
          occupied.add(`${row + rowOffset}:${col + colOffset}`);
        }
      }
    };
    orderedItems.forEach((item) => {
      const span = gridItemSpan(item);
      const rowSpan = gridItemRowSpan(item);
      const preferredCol = Math.max(1, Math.min(7 - span, Number(item.dataset.gridCol) || 1));
      const preferredRow = Math.max(1, Math.round(Number(item.dataset.gridRow) || 1));
      let nextCol = preferredCol;
      let nextRow = preferredRow;
      let placed = false;
      for (let row = preferredRow; row < preferredRow + 80 && !placed; row += 1) {
        const startCol = row === preferredRow ? preferredCol : 1;
        for (let col = startCol; col <= 7 - span; col += 1) {
          if (!canOccupy(row, col, span, rowSpan)) continue;
          nextCol = col;
          nextRow = row;
          placed = true;
          break;
        }
      }
      applyGridItemPosition(item, nextCol, nextRow);
      occupy(nextRow, nextCol, span, rowSpan);
    });
  };

  const orderedGridSelectorForLayout = (layout, includePlaceholders = false) => {
    if (layout.classList.contains("widget-layout")) {
      return includePlaceholders
        ? ":scope > .widget-card:not([hidden]), :scope > .widget-placeholder"
        : ":scope > .widget-card:not([hidden])";
    }
    return includePlaceholders
      ? ":scope > .db-panel:not([hidden]), :scope > .db-panel-placeholder"
      : ":scope > .db-panel:not([hidden])";
  };

  const orderedGridItems = (layout, { includePlaceholders = false, exclude = [] } = {}) => {
    const excluded = new Set([].concat(exclude || []).filter(Boolean));
    return [...layout.querySelectorAll(orderedGridSelectorForLayout(layout, includePlaceholders))]
      .filter((item) => !excluded.has(item) && !item.classList.contains("workspace-anchor-object"));
  };

  const globalGridItems = (layout, { includePlaceholders = false, exclude = [] } = {}) => {
    const host = gridHostForLayout(layout);
    const excluded = new Set([].concat(exclude || []).filter(Boolean));
    const selector = includePlaceholders
      ? ".widget-layout > .widget-card:not([hidden]), .widget-layout > .widget-placeholder, .panel-layout > .db-panel:not([hidden]), .panel-layout > .db-panel-placeholder"
      : ".widget-layout > .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])";
    return [...host.querySelectorAll(selector)]
      .filter((item) => !excluded.has(item) && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("workspace-anchor-object") && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging") && !item.classList.contains("dashboard-live-resize") && !item.classList.contains("dashboard-resize-source") && !item.classList.contains("dashboard-group-source") && !item.classList.contains("dashboard-group-member-preview"));
  };

  const layoutItemsForLogicalResolution = (layout, options = {}) => {
    const excluded = new Set([].concat(options.exclude || []).filter(Boolean));
    const provided = Array.isArray(options.items) ? options.items : null;
    const items = provided || globalGridItems(layout, {
      includePlaceholders: options.includePlaceholders !== false,
      exclude: [...excluded],
    });
    return [...new Set(items)]
      .filter((item) => (
        item?.isConnected &&
        !excluded.has(item) &&
        !item.classList.contains("workspace-anchor-object") &&
        !item.classList.contains("widget-dragging") &&
        !item.classList.contains("db-panel-dragging") &&
        !item.classList.contains("dashboard-live-resize") &&
        !item.classList.contains("dashboard-resize-source") &&
        !item.classList.contains("dashboard-group-source") &&
        !item.classList.contains("dashboard-group-member-preview")
      ));
  };

  const createGridGeometryRecords = (items, metrics = null) => {
    const records = new Map();
    items.forEach((item) => {
      if (!item?.isConnected || records.has(item)) return;
      records.set(item, {
        item,
        bounds: gridBoundsForItem(item, metrics),
      });
    });
    return records;
  };

  const gridGeometryEntry = (item, records, metrics = null) => {
    if (!item?.isConnected) return null;
    if (!records.has(item)) {
      records.set(item, {
        item,
        bounds: gridBoundsForItem(item, metrics),
      });
    }
    return records.get(item);
  };

  const gridGeometryEntriesForItems = (items, records, metrics = null, exclude = []) => {
    const excluded = new Set([].concat(exclude || []).filter(Boolean));
    return items
      .filter((item) => item?.isConnected && !excluded.has(item))
      .map((item) => gridGeometryEntry(item, records, metrics))
      .filter(Boolean);
  };

  const WORKSPACE_VISUAL_LOD_TIERS = Object.freeze({
    active: "active",
    visible: "visible",
    near: "near",
    far: "far",
  });

  const WORKSPACE_VISUAL_LOD_OVERSCAN = Object.freeze({
    visibleMin: 180,
    visibleViewportRatio: .35,
    nearMin: 900,
    nearViewportRatio: 1.5,
  });

  const workspaceVisualViewport = () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const height = window.innerHeight || document.documentElement.clientHeight || 800;
    return {
      top: scrollY,
      bottom: scrollY + height,
      height,
      visibleOverscan: Math.max(WORKSPACE_VISUAL_LOD_OVERSCAN.visibleMin, height * WORKSPACE_VISUAL_LOD_OVERSCAN.visibleViewportRatio),
      nearOverscan: Math.max(WORKSPACE_VISUAL_LOD_OVERSCAN.nearMin, height * WORKSPACE_VISUAL_LOD_OVERSCAN.nearViewportRatio),
    };
  };

  const gridItemDocumentBounds = (item, metrics = null) => {
    const resolvedMetrics = metrics || createGridMetrics(item.closest(".widget-layout, .panel-layout, .panel-internal-widget-grid"));
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const bounds = gridBoundsForItem(item, resolvedMetrics);
    const top = resolvedMetrics.rect.top + scrollY + ((bounds.row - 1) * resolvedMetrics.rowStep);
    const height = gridHeightForRows(bounds.rowSpan, resolvedMetrics.gap, resolvedMetrics.rowHeight);
    return { top, bottom: top + height, bounds };
  };

  const workspaceVisualLodForItem = (item, metrics = null, viewport = workspaceVisualViewport()) => {
    if (item.closest?.(".workspace-anchor-layer")) {
      return item.classList.contains("anchor-dragging") || item.classList.contains("anchor-rail-source")
        ? WORKSPACE_VISUAL_LOD_TIERS.active
        : WORKSPACE_VISUAL_LOD_TIERS.visible;
    }
    if (
      item.matches?.(":focus-within") ||
      item.classList.contains("active") ||
      item.classList.contains("group-selected") ||
      item.classList.contains("widget-dragging") ||
      item.classList.contains("db-panel-dragging") ||
      item.classList.contains("dashboard-active-resize") ||
      item.classList.contains("dashboard-live-resize") ||
      item.classList.contains("dashboard-resize-source") ||
      item.classList.contains("dashboard-group-member-preview") ||
      item.classList.contains("dashboard-group-source") ||
      item.classList.contains("widget-tools-open") ||
      item.classList.contains("db-panel-tools-open")
    ) {
      return WORKSPACE_VISUAL_LOD_TIERS.active;
    }
    const { top, bottom } = gridItemDocumentBounds(item, metrics);
    if (bottom >= viewport.top - viewport.visibleOverscan && top <= viewport.bottom + viewport.visibleOverscan) return WORKSPACE_VISUAL_LOD_TIERS.visible;
    if (bottom >= viewport.top - viewport.nearOverscan && top <= viewport.bottom + viewport.nearOverscan) return WORKSPACE_VISUAL_LOD_TIERS.near;
    return WORKSPACE_VISUAL_LOD_TIERS.far;
  };

  const syncWorkspaceVisualLod = (scope = document) => {
    const viewport = workspaceVisualViewport();
    const layouts = [...scope.querySelectorAll?.(".widget-layout, .panel-layout, .panel-internal-widget-grid") || []]
      .filter((layout) => layout.isConnected);
    const processedItems = new Set();
    layouts.forEach((layout) => {
      const metrics = createGridMetrics(layout);
      const items = isPanelInternalWidgetLayout(layout)
        ? [...layout.querySelectorAll(":scope > .widget-card:not([hidden])")]
        : globalGridItems(layout, { includePlaceholders: false });
      items.forEach((item) => {
        if (processedItems.has(item)) return;
        processedItems.add(item);
        const lod = workspaceVisualLodForItem(item, metrics, viewport);
        item.dataset.visualLod = lod;
        item.dataset.lod = lod;
      });
    });
    [...scope.querySelectorAll?.(".workspace-anchor-layer > .workspace-anchor-object:not([hidden])") || []]
      .forEach((item) => {
        const lod = workspaceVisualLodForItem(item, null, viewport);
        item.dataset.visualLod = lod;
        item.dataset.lod = lod;
      });
  };

  let visualLodRefreshFrame = null;
  const scheduleWorkspaceVisualLodRefresh = (scope = document) => {
    if (visualLodRefreshFrame) return;
    visualLodRefreshFrame = window.requestAnimationFrame(() => {
      visualLodRefreshFrame = null;
      syncWorkspaceVisualLod(scope);
    });
  };

  const committedWorkspaceNaturalHeight = (layout) => {
    const items = globalGridItems(layout, { includePlaceholders: false });
    const maxBottom = items.reduce((bottom, item) => Math.max(bottom, gridBoundsForItem(item).bottom), 1);
    return gridHeightForRows(maxBottom, gridGapForLayout(layout));
  };

  const clearCommittedWorkspaceScrollFloor = (layout) => {
    const host = gridHostForLayout(layout);
    if (!host?.dataset?.committedScrollFloor) return;
    host.style.removeProperty("min-height");
    delete host.dataset.committedScrollFloor;
  };

  const syncCommittedWorkspaceScrollFloor = (layout, { preserveViewport = false, scrollY = null } = {}) => {
    const host = gridHostForLayout(layout);
    if (!host?.classList?.contains("dashboard-layout-grid")) return;
    const naturalHeight = committedWorkspaceNaturalHeight(layout);
    if (!preserveViewport) {
      clearCommittedWorkspaceScrollFloor(layout);
      return;
    }
    const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const targetScrollY = Number.isFinite(scrollY) ? Math.max(0, scrollY) : currentScrollY;
    const desiredViewportBottom = targetScrollY + window.innerHeight + 16;
    const hostTop = host.getBoundingClientRect().top + currentScrollY;
    const requiredHeight = Math.max(0, desiredViewportBottom - hostTop);
    if (requiredHeight > naturalHeight + 1) {
      host.dataset.committedScrollFloor = "true";
      host.style.minHeight = `${Math.ceil(requiredHeight)}px`;
    } else {
      clearCommittedWorkspaceScrollFloor(layout);
    }
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(targetScrollY, maxScrollY));
  };

  const boundsAtGridSlot = (item, col, row, metrics = null) => {
    const span = gridItemSpan(item);
    const rowSpan = gridItemRowSpan(item, metrics);
    const safeCol = Math.max(1, Math.min(DASHBOARD_GRID_COLUMNS - span + 1, Math.round(Number(col) || 1)));
    const safeRow = Math.max(1, Math.round(Number(row) || 1));
    return {
      col: safeCol,
      row: safeRow,
      span,
      rowSpan,
      right: safeCol + span - 1,
      bottom: safeRow + rowSpan - 1,
    };
  };

  const ensureRenderedGridPosition = (layout, item) => {
    if (!item?.isConnected || (Number(item.dataset.gridCol) && Number(item.dataset.gridRow))) return;
    const layoutRect = gridRectForLayout(layout);
    const itemRect = item.getBoundingClientRect();
    const gap = gridGapForLayout(layout);
    const columnWidth = (Math.max(1, layoutRect.width) - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS;
    const colStep = columnWidth + gap;
    const rowStep = DASHBOARD_GRID_ROW_HEIGHT + gap;
    const col = Math.round((itemRect.left - layoutRect.left) / Math.max(1, colStep)) + 1;
    const row = Math.round((itemRect.top - layoutRect.top) / Math.max(1, rowStep)) + 1;
    applyGridItemPosition(item, col, row);
  };

  const canPlaceBounds = (bounds, occupied) => {
    if (bounds.col < 1 || bounds.right > DASHBOARD_GRID_COLUMNS) return false;
    return !indexedCollisionEntries(bounds, occupied).some((entry) => gridBoundsOverlap(bounds, entry.bounds));
  };

  const nearestSparseSlot = (item, preferred, occupied, rowLimit = null, metrics = null) => {
    const base = boundsAtGridSlot(item, preferred?.col || 1, preferred?.row || 1, metrics);
    const maxCol = DASHBOARD_GRID_COLUMNS - base.span + 1;
    const maxOccupiedRow = occupied.reduce((max, entry) => Math.max(max, entry.bounds.bottom), base.row);
    const limit = Math.max(base.row + 48, maxOccupiedRow + 24, rowLimit || 0);
    let best = null;
    for (let row = 1; row <= limit; row += 1) {
      for (let col = 1; col <= maxCol; col += 1) {
        const candidate = boundsAtGridSlot(item, col, row, metrics);
        if (!canPlaceBounds(candidate, occupied)) continue;
        const upwardPenalty = row < base.row ? .65 : 0;
        const leftPenalty = row === base.row && col < base.col ? .15 : 0;
        const score = (Math.abs(row - base.row) * DASHBOARD_GRID_COLUMNS) + Math.abs(col - base.col) + upwardPenalty + leftPenalty;
        if (!best || score < best.score || (score === best.score && row < best.bounds.row) || (score === best.score && row === best.bounds.row && col < best.bounds.col)) {
          best = { bounds: candidate, score };
        }
      }
    }
    return best?.bounds || base;
  };

  const nearestSparseSlotAtOrAfter = (item, preferred, occupied, rowLimit = null, metrics = null) => {
    const base = boundsAtGridSlot(item, preferred?.col || 1, preferred?.row || 1, metrics);
    const maxCol = DASHBOARD_GRID_COLUMNS - base.span + 1;
    const maxOccupiedRow = occupied.reduce((max, entry) => Math.max(max, entry.bounds.bottom), base.row);
    const limit = Math.max(base.row + 80, maxOccupiedRow + 40, rowLimit || 0);
    for (let row = base.row; row <= limit; row += 1) {
      const startCol = row === base.row ? base.col : 1;
      for (let col = startCol; col <= maxCol; col += 1) {
        const candidate = boundsAtGridSlot(item, col, row, metrics);
        if (canPlaceBounds(candidate, occupied)) return candidate;
      }
    }
    return nearestSparseSlot(item, base, occupied, limit, metrics);
  };

  const localVacancyCandidates = (item, vacancy, metrics = null) => {
    if (!vacancy) return [];
    const itemBounds = boundsAtGridSlot(item, vacancy.col, vacancy.row, metrics);
    const maxCol = Math.min(DASHBOARD_GRID_COLUMNS - itemBounds.span + 1, vacancy.right - itemBounds.span + 1);
    const maxRow = Math.max(vacancy.row, vacancy.bottom - itemBounds.rowSpan + 1);
    const candidates = [];
    for (let row = vacancy.row; row <= maxRow; row += 1) {
      for (let col = vacancy.col; col <= maxCol; col += 1) {
        candidates.push(boundsAtGridSlot(item, col, row, metrics));
      }
    }
    return candidates;
  };

  const canPlaceLocalDisplacementBounds = (bounds, occupied, reserved = []) => (
    canPlaceBounds(bounds, occupied) && canPlaceBounds(bounds, reserved)
  );

  const localBelowDisplacementSlot = (item, base, occupied, reserved = [], metrics = null) => {
    const candidate = boundsAtGridSlot(item, base.col, base.row + base.rowSpan, metrics);
    return canPlaceLocalDisplacementBounds(candidate, occupied, reserved) ? candidate : null;
  };

  const localLeftDisplacementSlot = (item, base, occupied, localVacancy = null, reserved = [], metrics = null) => {
    const explicitPrevious = base.col > 1
      ? boundsAtGridSlot(item, base.col - 1, base.row, metrics)
      : null;
    const leftVacancyCandidates = localVacancyCandidates(item, localVacancy, metrics)
      .filter((candidate) => candidate.row === base.row && candidate.col < base.col)
      .sort((a, b) => (
        Math.abs(a.col - base.col) - Math.abs(b.col - base.col) ||
        b.col - a.col
      ));
    return [explicitPrevious, ...leftVacancyCandidates]
      .filter((candidate) => candidate && canPlaceLocalDisplacementBounds(candidate, occupied, reserved))[0] || null;
  };

  const nearestLocalDisplacementSlot = (item, preferred, occupied, options = {}) => {
    const metrics = options.metrics || null;
    const base = boundsAtGridSlot(item, preferred?.col || 1, preferred?.row || 1, metrics);
    const reserved = options.reserved || [];
    const below = localBelowDisplacementSlot(item, base, occupied, reserved, metrics);
    if (below) return below;
    const left = localLeftDisplacementSlot(item, base, occupied, options.localVacancy, reserved, metrics);
    if (left) return left;
    const fallback = options.fallback || nearestSparseSlotAtOrAfter(item, base, occupied, null, metrics);
    return canPlaceBounds(fallback, occupied)
      ? fallback
      : nearestSparseSlotAtOrAfter(item, base, occupied, null, metrics);
  };

  const visualGridOrder = (items, metrics = null) => [...items].sort((a, b) => {
    const aBounds = gridBoundsForItem(a, metrics);
    const bBounds = gridBoundsForItem(b, metrics);
    const documentOrder = a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    return aBounds.row - bBounds.row ||
      aBounds.col - bBounds.col ||
      documentOrder;
  });

  const boundsAtRow = (bounds, row) => ({
    ...bounds,
    row,
    bottom: row + bounds.rowSpan - 1,
  });

  const gridBoundsShareColumns = (a, b) => a.col <= b.right && a.right >= b.col;

  const firstVerticalOpenRow = (bounds, occupied) => {
    let nextBounds = { ...bounds };
    for (let attempts = 0; attempts < 120; attempts += 1) {
      const conflicts = indexedCollisionEntries(nextBounds, occupied).filter((entry) => (
        gridBoundsShareColumns(nextBounds, entry.bounds) &&
        gridBoundsOverlap(nextBounds, entry.bounds)
      ));
      if (!conflicts.length) return nextBounds;
      const nextRow = Math.max(nextBounds.row, ...conflicts.map((entry) => entry.bounds.bottom + 1));
      nextBounds = boundsAtRow(nextBounds, nextRow);
    }
    return nextBounds;
  };

  const applyVerticalPanelExpansion = (layout, panel) => {
    if (!panel?.isConnected) return;
    ensureRenderedGridPosition(layout, panel);
    const items = globalGridItems(layout, { includePlaceholders: false, exclude: [panel] });
    const movableItems = visualGridOrder(items);
    const occupied = [{ item: panel, bounds: gridBoundsForItem(panel) }];

    movableItems.forEach((item) => {
      const current = gridBoundsForItem(item);
      const next = firstVerticalOpenRow(current, occupied);
      if (next.row !== current.row) applyGridItemPosition(item, current.col, next.row);
      occupied.push({ item, bounds: next });
    });
  };

  const beginPanelExpansionSession = (layout, panel) => {
    if (!layout || !panel) return;
    if (!layout.__expansionBaselineSnapshot) {
      layout.__expansionBaselineSnapshot = snapshotGridLayout(layout);
    }
    if (!layout.__activeExpansionPanels) layout.__activeExpansionPanels = new Set();
    layout.__activeExpansionPanels.add(panel);
    panel.__activeExpansionSource = true;
  };

  const relaxCollapsedExpansionDisplacement = (layout, collapsedPanel) => {
    const baseline = layout?.__expansionBaselineSnapshot;
    if (!baseline) return;
    const collapsedBounds = collapsedPanel?.isConnected ? gridBoundsForItem(collapsedPanel) : null;
    const candidates = globalGridItems(layout, { includePlaceholders: false, exclude: [collapsedPanel] })
      .filter((item) => baseline.has(item))
      .sort((a, b) => {
        const aState = baseline.get(a);
        const bState = baseline.get(b);
        const aRow = Number(aState?.gridRow) || gridBoundsForItem(a).row;
        const bRow = Number(bState?.gridRow) || gridBoundsForItem(b).row;
        const aCol = Number(aState?.gridCol) || gridBoundsForItem(a).col;
        const bCol = Number(bState?.gridCol) || gridBoundsForItem(b).col;
        return aRow - bRow || aCol - bCol;
      });

    candidates.forEach((item) => {
      if (!item.isConnected) return;
      const baselineState = baseline.get(item);
      const baselineRow = Number(baselineState?.gridRow);
      const baselineCol = Number(baselineState?.gridCol);
      if (!Number.isFinite(baselineRow) || !Number.isFinite(baselineCol)) return;
      const current = gridBoundsForItem(item);
      if (current.row <= baselineRow) return;
      if (current.col !== baselineCol) return;
      const occupied = globalGridItems(layout, { includePlaceholders: false, exclude: [item] })
        .map((other) => ({ item: other, bounds: gridBoundsForItem(other) }));
      const preserveSourceOrder = collapsedBounds &&
        gridBoundsShareColumns(current, collapsedBounds) &&
        current.row > collapsedBounds.row;
      const localBaselineRow = preserveSourceOrder
        ? Math.max(baselineRow, collapsedBounds.bottom + 1)
        : baselineRow;
      const desired = boundsAtRow(current, localBaselineRow);
      const next = firstVerticalOpenRow(desired, occupied);
      if (next.row < current.row) applyGridItemPosition(item, current.col, next.row);
    });
  };

  const endPanelExpansionSession = (layout, panel) => {
    layout?.__activeExpansionPanels?.delete(panel);
    if (panel) panel.__activeExpansionSource = false;
    layout?.__activeExpansionPanels?.forEach((activePanel) => {
      if (!activePanel.isConnected || activePanel.classList.contains("db-panel-collapsed") || !activePanel.__activeExpansionSource) {
        layout.__activeExpansionPanels.delete(activePanel);
      }
    });
    const hasActiveExpansionSource = [...(layout?.__activeExpansionPanels || [])]
      .some((activePanel) => activePanel.__activeExpansionSource && !activePanel.classList.contains("db-panel-collapsed"));
    if (!hasActiveExpansionSource) {
      delete layout.__activeExpansionPanels;
      delete layout.__expansionBaselineSnapshot;
    }
  };

  const resolveSparseGridLayout = (layout, activeItem = null, preferredTarget = null, options = {}) => {
    const metrics = options.metrics || null;
    const localVacancy = options.localVacancy || null;
    const items = layoutItemsForLogicalResolution(layout, {
      includePlaceholders: true,
      items: options.items,
    });
    if (activeItem?.isConnected && !items.includes(activeItem)) items.push(activeItem);
    const records = createGridGeometryRecords(items, metrics);
    const placements = new Map();
    const occupied = [];
    const pinned = items.filter((item) => item !== activeItem && item.classList.contains("db-panel-pinned"));
    pinned.forEach((item) => {
      const bounds = gridGeometryEntry(item, records, metrics).bounds;
      placements.set(item, bounds);
      occupied.push({ item, bounds });
    });

    if (activeItem?.isConnected) {
      const target = preferredTarget || gridGeometryEntry(activeItem, records, metrics).bounds;
      let activeBounds = boundsAtGridSlot(activeItem, target.col, target.row, metrics);
      if (!canPlaceBounds(activeBounds, occupied)) {
        activeBounds = options.afterOnly
          ? nearestSparseSlotAtOrAfter(activeItem, activeBounds, occupied, null, metrics)
          : nearestSparseSlot(activeItem, activeBounds, occupied, null, metrics);
      }
      placements.set(activeItem, activeBounds);
      occupied.push({ item: activeItem, bounds: activeBounds });
    }

    visualGridOrder(items, metrics)
      .filter((item) => item !== activeItem && !item.classList.contains("db-panel-pinned"))
      .forEach((item) => {
        const current = gridGeometryEntry(item, records, metrics).bounds;
        const reserved = gridGeometryEntriesForItems(
          items.filter((other) => other !== activeItem && other !== item),
          records,
          metrics
        );
        const verticalFallback = options.verticalDisplacement
          ? verticalSlotAtOrAfter(item, current, occupied, null, metrics) || nearestSparseSlotAtOrAfter(item, current, occupied, null, metrics)
          : null;
        const bounds = canPlaceBounds(current, occupied)
          ? current
          : options.afterOnly
            ? nearestLocalDisplacementSlot(item, current, occupied, { localVacancy, metrics, reserved, fallback: verticalFallback })
            : nearestSparseSlot(item, current, occupied, null, metrics);
        placements.set(item, bounds);
        occupied.push({ item, bounds });
      });

    placements.forEach((bounds, item) => applyGridItemPosition(item, bounds.col, bounds.row));
    return placements;
  };

  const resolveSparseGridLayoutForActiveItems = (layout, activeItems = [], options = {}) => {
    const metrics = options.metrics || null;
    const activeList = visualGridOrder([].concat(activeItems || []).filter((item) => item?.isConnected), metrics);
    if (!activeList.length) return new Map();
    const activeSet = new Set(activeList);
    const excluded = new Set([].concat(options.exclude || []).filter(Boolean));
    const items = layoutItemsForLogicalResolution(layout, {
      includePlaceholders: true,
      items: options.items,
      exclude: [...excluded, ...activeList],
    });
    const allItems = [...activeList, ...items];
    const records = createGridGeometryRecords(allItems, metrics);
    const placements = new Map();
    const occupied = [];
    items
      .filter((item) => item.classList.contains("db-panel-pinned"))
      .forEach((item) => {
        const bounds = gridGeometryEntry(item, records, metrics).bounds;
        placements.set(item, bounds);
        occupied.push({ item, bounds });
      });

    activeList.forEach((item) => {
      const target = gridGeometryEntry(item, records, metrics).bounds;
      let bounds = boundsAtGridSlot(item, target.col, target.row, metrics);
      if (!canPlaceBounds(bounds, occupied)) {
        bounds = options.afterOnly
          ? nearestSparseSlotAtOrAfter(item, bounds, occupied, null, metrics)
          : nearestSparseSlot(item, bounds, occupied, null, metrics);
      }
      placements.set(item, bounds);
      occupied.push({ item, bounds });
    });

    visualGridOrder(items, metrics)
      .filter((item) => !activeSet.has(item) && !item.classList.contains("db-panel-pinned"))
      .forEach((item) => {
        const current = gridGeometryEntry(item, records, metrics).bounds;
        const reserved = gridGeometryEntriesForItems(
          allItems.filter((other) => other !== item && !excluded.has(other)),
          records,
          metrics
        );
        const bounds = canPlaceBounds(current, occupied)
          ? current
          : options.afterOnly
            ? nearestLocalDisplacementSlot(item, current, occupied, {
              metrics,
              reserved,
              fallback: verticalSlotAtOrAfter(item, current, occupied, null, metrics) || nearestSparseSlotAtOrAfter(item, current, occupied, null, metrics),
            })
            : nearestSparseSlot(item, current, occupied, null, metrics);
        placements.set(item, bounds);
        occupied.push({ item, bounds });
      });

    placements.forEach((bounds, item) => applyGridItemPosition(item, bounds.col, bounds.row));
    return placements;
  };

  const resolveActiveDropSlot = (layout, item, preferredTarget) => {
    const occupied = globalGridItems(layout, { includePlaceholders: false, exclude: [item] })
      .map((other) => ({ item: other, bounds: gridBoundsForItem(other) }));
    const target = preferredTarget || gridBoundsForItem(item);
    let bounds = boundsAtGridSlot(item, target.col, target.row);
    if (!canPlaceBounds(bounds, occupied)) {
      bounds = nearestSparseSlotAtOrAfter(item, bounds, occupied);
    }
    return bounds;
  };

  const commitActiveDropSlot = (layout, item, preferredTarget, options = {}) => {
    const localVacancy = options.localVacancy || null;
    const target = preferredTarget || gridBoundsForItem(item);
    let activeBounds = boundsAtGridSlot(item, target.col, target.row);
    const items = globalGridItems(layout, { includePlaceholders: false, exclude: [item] });
    const pinned = items
      .filter((other) => other.classList.contains("db-panel-pinned"))
      .map((other) => ({ item: other, bounds: gridBoundsForItem(other) }));

    if (!canPlaceBounds(activeBounds, pinned)) {
      activeBounds = nearestSparseSlotAtOrAfter(item, activeBounds, pinned);
      applyGridItemPosition(item, activeBounds.col, activeBounds.row);
      return { bounds: activeBounds, movedItems: 0 };
    }

    const movableItems = items.filter((other) => !other.classList.contains("db-panel-pinned"));
    const targetCollides = movableItems.some((other) => gridBoundsOverlap(activeBounds, gridBoundsForItem(other)));
    if (!targetCollides) {
      applyGridItemPosition(item, activeBounds.col, activeBounds.row);
      return { bounds: activeBounds, movedItems: 0 };
    }

    const occupied = [...pinned, { item, bounds: activeBounds }];
    applyGridItemPosition(item, activeBounds.col, activeBounds.row);
    let movedItems = 0;
    visualGridOrder(movableItems).forEach((other) => {
      const current = gridBoundsForItem(other);
      const reserved = items
        .filter((item) => item !== other)
        .map((item) => ({ item, bounds: gridBoundsForItem(item) }));
      const next = canPlaceBounds(current, occupied)
        ? current
        : nearestLocalDisplacementSlot(other, current, occupied, {
          localVacancy,
          reserved,
          fallback: nearestSparseSlotAtOrAfter(other, current, occupied),
        });
      if (next.col !== current.col || next.row !== current.row) movedItems += 1;
      applyGridItemPosition(other, next.col, next.row);
      occupied.push({ item: other, bounds: next });
    });
    return { bounds: activeBounds, movedItems };
  };

  const commitExpandedPanelDropSlot = (layout, item, preferredTarget, options = {}) => {
    const localVacancy = options.localVacancy || null;
    const target = preferredTarget || gridBoundsForItem(item);
    let activeBounds = boundsAtGridSlot(item, target.col, target.row);
    const items = globalGridItems(layout, { includePlaceholders: false, exclude: [item] });
    const pinned = items
      .filter((other) => other.classList.contains("db-panel-pinned"))
      .map((other) => ({ item: other, bounds: gridBoundsForItem(other) }));

    if (!canPlaceBounds(activeBounds, pinned)) {
      activeBounds = nearestSparseSlotAtOrAfter(item, activeBounds, pinned);
    }

    applyGridItemPosition(item, activeBounds.col, activeBounds.row);
    const occupied = [...pinned, { item, bounds: activeBounds }];
    let movedItems = 0;
    visualGridOrder(items.filter((other) => !other.classList.contains("db-panel-pinned"))).forEach((other) => {
      const current = gridBoundsForItem(other);
      const reserved = items
        .filter((item) => item !== other)
        .map((item) => ({ item, bounds: gridBoundsForItem(item) }));
      const next = canPlaceBounds(current, occupied)
        ? current
        : nearestLocalDisplacementSlot(other, current, occupied, {
          localVacancy,
          reserved,
          fallback: verticalSlotAtOrAfter(other, current, occupied) || nearestSparseSlotAtOrAfter(other, current, occupied),
        });
      if (next.col !== current.col || next.row !== current.row) movedItems += 1;
      applyGridItemPosition(other, next.col, next.row);
      occupied.push({ item: other, bounds: next });
    });

    return { bounds: activeBounds, movedItems };
  };

  const verticalSlotAtOrAfter = (item, preferred, occupied, rowLimit = null, metrics = null) => {
    const base = boundsAtGridSlot(item, preferred?.col || 1, preferred?.row || 1, metrics);
    const maxOccupiedRow = occupied.reduce((max, entry) => Math.max(max, entry.bounds.bottom), base.row);
    const limit = Math.max(base.row + 80, maxOccupiedRow + 40, rowLimit || 0);
    for (let row = base.row; row <= limit; row += 1) {
      const candidate = boundsAtGridSlot(item, base.col, row, metrics);
      if (canPlaceBounds(candidate, occupied)) return candidate;
    }
    return null;
  };

  const dividerInsertionRegionsForLayout = (layout, metrics = createGridMetrics(layout)) => {
    const host = gridHostForLayout(layout);
    const layoutKey = gridItemLayoutKey(layout);
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const viewportTop = scrollY;
    const viewportBottom = scrollY + window.innerHeight;
    const viewportCenter = viewportTop + (window.innerHeight / 2);
    const hostRect = gridRectForLayout(layout);
    const hostTop = hostRect.top + scrollY;
    const hostBottom = hostRect.bottom + scrollY;
    const rowStep = metrics?.rowStep || (DASHBOARD_GRID_ROW_HEIGHT + gridGapForLayout(layout));
    const dividers = [...host.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] > .workspace-divider[data-workspace-object-type="divider"]:not([hidden])`)]
      .filter((divider) => !divider.classList.contains("db-panel-placeholder") && !divider.classList.contains("db-panel-dragging"))
      .map((divider) => {
        const rect = divider.getBoundingClientRect();
        return {
          item: divider,
          bounds: gridBoundsForItem(divider, metrics),
          top: rect.top + scrollY,
          bottom: rect.bottom + scrollY,
        };
      })
      .sort((a, b) => a.top - b.top || a.bounds.row - b.bounds.row);
    const itemBottom = globalGridItems(layout, { includePlaceholders: false })
      .reduce((bottom, item) => Math.max(bottom, item.getBoundingClientRect().bottom + scrollY), hostBottom);
    const lastDivider = dividers.length ? dividers[dividers.length - 1] : null;
    const workspaceBottom = Math.max(hostBottom, itemBottom, viewportBottom, lastDivider?.bottom + (rowStep * 10) || 0);
    const rowForDocY = (docY, mode = "floor") => {
      const raw = (docY - hostTop) / Math.max(1, rowStep);
      return Math.max(1, (mode === "ceil" ? Math.ceil(raw) : Math.floor(raw)) + 1);
    };
    const buildRegion = ({ id = "", kind = "divider", order = 0, divider = null, nextDivider = null, startRow = 1, endRow = Infinity, top = hostTop, bottom = workspaceBottom }) => {
      const visibleTop = Math.max(top, viewportTop);
      const visibleBottom = Math.min(bottom, viewportBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const visibleStartRow = Math.max(startRow, rowForDocY(visibleTop, "floor"));
      const visibleEndRow = Math.min(Number.isFinite(endRow) ? endRow : Number.POSITIVE_INFINITY, rowForDocY(visibleBottom, "ceil"));
      const visibleRows = visibleHeight > 0 && visibleEndRow >= visibleStartRow
        ? Math.max(0, visibleEndRow - visibleStartRow + 1)
        : 0;
      const center = visibleHeight > 0
        ? visibleTop + (visibleHeight / 2)
        : top + ((Math.max(1, bottom - top)) / 2);
      return {
        id: id || divider?.item?.dataset.panelKey || `${layoutKey}:${kind}:${order}`,
        kind,
        order,
        divider: divider?.item || null,
        nextDivider: nextDivider?.item || null,
        startRow: Math.max(1, Math.round(startRow)),
        endRow,
        top,
        bottom,
        visibleTop,
        visibleBottom,
        visibleHeight,
        visibleStartRow,
        visibleEndRow,
        visibleRows,
        viewportDistance: Math.abs(center - viewportCenter),
      };
    };
    if (!dividers.length) {
      return [buildRegion({ id: `${layoutKey}:top`, kind: "top", order: 0, startRow: 1, endRow: Infinity, top: hostTop, bottom: workspaceBottom })];
    }
    const regions = [
      buildRegion({
        id: `${layoutKey}:top`,
        kind: "top",
        order: 0,
        startRow: 1,
        endRow: Math.max(0, dividers[0].bounds.row - 1),
        top: hostTop,
        bottom: dividers[0].top,
        nextDivider: dividers[0],
      }),
    ];
    dividers.forEach((divider, index) => {
      const nextDivider = dividers[index + 1] || null;
      regions.push(buildRegion({
        id: divider.item?.dataset.panelKey || `${layoutKey}:divider:${index + 1}`,
        kind: nextDivider ? "divider" : "final",
        order: index + 1,
        divider,
        nextDivider,
        startRow: divider.bounds.bottom + 1,
        endRow: nextDivider ? Math.max(divider.bounds.bottom + 1, nextDivider.bounds.row - 1) : Infinity,
        top: divider.bottom,
        bottom: nextDivider ? nextDivider.top : workspaceBottom,
      }));
    });
    return regions;
  };

  const findOrderedInsertionSlot = (layout, item, startRow, occupied, options = {}) => {
    const metrics = options.metrics || createGridMetrics(layout);
    const base = boundsAtGridSlot(item, options.startCol || 1, Math.max(1, startRow), metrics);
    const maxCol = DASHBOARD_GRID_COLUMNS - base.span + 1;
    const maxOccupiedRow = occupied.reduce((max, entry) => Math.max(max, entry.bounds.bottom), base.row);
    const hardLimit = Number.isFinite(options.endRow)
      ? Math.max(base.row, Math.round(options.endRow))
      : Math.max(base.row + 80, maxOccupiedRow + 40);
    for (let row = base.row; row <= hardLimit; row += 1) {
      const firstCol = row === base.row ? base.col : 1;
      for (let col = firstCol; col <= maxCol; col += 1) {
        const candidate = boundsAtGridSlot(item, col, row, metrics);
        if (canPlaceBounds(candidate, occupied)) return candidate;
      }
    }
    return null;
  };

  const visibleRegionInsertionTarget = (layout, item) => {
    const metrics = createGridMetrics(layout);
    const occupied = globalGridItems(layout, { includePlaceholders: false, exclude: [item] })
      .map((other) => {
        const bounds = gridBoundsForItem(other, metrics);
        const rect = other.getBoundingClientRect();
        return {
          item: other,
          bounds,
          top: rect.top + (window.scrollY || document.documentElement.scrollTop || 0),
          bottom: rect.bottom + (window.scrollY || document.documentElement.scrollTop || 0),
        };
      });
    const regions = dividerInsertionRegionsForLayout(layout, metrics);
    const scoredRegions = regions.map((region) => {
      const visibleArea = region.visibleHeight * DASHBOARD_GRID_COLUMNS;
      const occupiedArea = occupied.reduce((sum, entry) => {
        if (!region.visibleHeight) return sum;
        const top = Math.max(entry.top, region.visibleTop);
        const bottom = Math.min(entry.bottom, region.visibleBottom);
        if (bottom <= top) return sum;
        return sum + ((bottom - top) * entry.bounds.span);
      }, 0);
      const availableArea = Math.max(0, visibleArea - occupiedArea);
      return {
        ...region,
        availableArea,
        score: availableArea,
      };
    }).sort((a, b) => (
      b.score - a.score ||
      a.viewportDistance - b.viewportDistance ||
      a.visibleTop - b.visibleTop ||
      a.order - b.order ||
      String(a.id).localeCompare(String(b.id))
    ));
    const region = scoredRegions[0] || regions[0];
    if (!region) return null;
    const visibleStart = region.visibleRows
      ? Math.max(region.startRow, region.visibleStartRow)
      : region.startRow;
    const visibleEnd = region.visibleRows
      ? Math.min(region.endRow, region.visibleEndRow)
      : null;
    const visibleSlot = region.visibleRows
      ? findOrderedInsertionSlot(layout, item, visibleStart, occupied, { metrics, endRow: visibleEnd })
      : null;
    if (visibleSlot) return visibleSlot;
    const regionSlot = findOrderedInsertionSlot(layout, item, region.startRow, occupied, { metrics, endRow: region.endRow });
    if (regionSlot) return regionSlot;
    return nearestSparseSlotAtOrAfter(item, { col: 1, row: region.startRow }, occupied, null, metrics);
  };

  const panelAddTarget = (layout, panel) => {
    const smartTarget = visibleRegionInsertionTarget(layout, panel);
    if (smartTarget) return smartTarget;
    const panels = visualGridOrder(
      [...layout.querySelectorAll(":scope > .db-panel:not([hidden])")]
        .filter((item) => item !== panel && !item.classList.contains("db-panel-placeholder"))
    );
    if (!panels.length) {
      return { col: 1, row: orderedLayoutStartRow(layout) };
    }
    const anchor = gridBoundsForItem(panels[panels.length - 1]);
    if (anchor.right < DASHBOARD_GRID_COLUMNS) {
      return { col: anchor.right + 1, row: anchor.row };
    }
    return { col: 1, row: anchor.bottom + 1 };
  };

  const commitInsertedGridItemWithVerticalPushdown = (layout, item, preferredTarget = null) => {
    const allItems = globalGridItems(layout, { includePlaceholders: false, exclude: [item] });
    const pinnedItems = allItems.filter((other) => other.classList.contains("db-panel-pinned"));
    let fixedEntries = allItems.map((other) => ({ item: other, bounds: gridBoundsForItem(other) }));
    const pinnedEntries = fixedEntries.filter((entry) => pinnedItems.includes(entry.item));
    const target = preferredTarget || gridBoundsForItem(item);
    let activeBounds = boundsAtGridSlot(item, target.col, target.row);
    if (!canPlaceBounds(activeBounds, pinnedEntries)) {
      activeBounds = nearestSparseSlotAtOrAfter(item, activeBounds, pinnedEntries);
    }
    applyGridItemPosition(item, activeBounds.col, activeBounds.row);

    let movedItems = 0;
    const movedEntries = [];
    visualGridOrder(allItems.filter((other) => !pinnedItems.includes(other))).forEach((other) => {
      const currentEntry = fixedEntries.find((entry) => entry.item === other);
      if (!currentEntry || !gridBoundsOverlap(activeBounds, currentEntry.bounds)) return;
      fixedEntries = fixedEntries.filter((entry) => entry.item !== other);
      const occupied = [{ item, bounds: activeBounds }, ...fixedEntries, ...movedEntries];
      const next = verticalSlotAtOrAfter(other, currentEntry.bounds, occupied) ||
        nearestSparseSlotAtOrAfter(other, currentEntry.bounds, occupied);
      if (next.col !== currentEntry.bounds.col || next.row !== currentEntry.bounds.row) movedItems += 1;
      applyGridItemPosition(other, next.col, next.row);
      movedEntries.push({ item: other, bounds: next });
    });

    return { bounds: activeBounds, movedItems };
  };

  const nextPastedObjectId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const selectedClipboardRoots = () => {
    const selected = selectedGroupItems(null);
    const selectedSet = new Set(selected);
    return selected
      .filter((item) => item?.isConnected && !item.hidden)
      .filter((item) => {
        if (!isPanelInternalGridItem(item)) return true;
        const parentPanel = item.closest(".db-panel");
        return !selectedSet.has(parentPanel);
      });
  };

  const copySelectedWorkspaceObjects = () => {
    const roots = selectedClipboardRoots();
    if (!roots.length) return false;
    const layoutKey = groupItemLayoutKey(roots[0]);
    const selectedIds = new Set(roots.flatMap((item) => {
      const ids = [workspaceObjectKey(item)].filter(Boolean);
      item.querySelectorAll?.("[data-widget-key], [data-panel-key], [data-anchor-key]").forEach((node) => {
        const id = workspaceObjectKey(node);
        if (id) ids.push(id);
      });
      return ids;
    }));
    const graph = loadWorkspaceLogicGraph(layoutKey, getActivePanelProfile(layoutKey));
    workspaceObjectClipboard = {
      layoutKey,
      copiedAt: Date.now(),
      contextLinks: graph.contextLinks.filter((link) => selectedIds.has(link.sourceObjectId) && selectedIds.has(link.targetObjectId)),
      items: visualGridOrder(roots).map((item) => ({
        kind: workspaceDeleteKind(item),
        layoutKey: groupItemLayoutKey(item),
        parentPanelKey: isPanelInternalGridItem(item) ? item.closest(".db-panel")?.dataset.panelKey || null : null,
        bounds: gridBoundsForItem(item),
        html: sanitizeLayoutElementForUndo(item),
      })),
    };
    showToast(roots.length > 1 ? `${roots.length} selected objects copied.` : "Selected object copied.");
    return true;
  };

  const remapDataReference = (element, property, idMap, { clearUnsafe = false } = {}) => {
    const current = element?.dataset?.[property];
    if (!current) return;
    if (idMap.has(current)) {
      element.dataset[property] = idMap.get(current);
    } else if (clearUnsafe) {
      delete element.dataset[property];
    }
  };

  const preparePastedWorkspaceElement = (element, idMap, layoutKey, rootKind) => {
    element.classList.remove(...undoTransientItemClasses);
    element.removeAttribute("aria-selected");
    element.removeAttribute("hidden");
    delete element.dataset.panelInitialized;
    delete element.dataset.widgetInitialized;
    element.querySelectorAll(".group-selected").forEach((node) => {
      node.classList.remove("group-selected");
      node.removeAttribute("aria-selected");
    });
    element.querySelectorAll(".panel-settings-toggle, .panel-color-toggle, .anchor-link-toggle").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
    element.querySelectorAll(".panel-color-menu-open, .anchor-link-menu-open").forEach((menu) => {
      menu.classList.remove("panel-color-menu-open", "anchor-link-menu-open");
    });

    const panelNodes = [
      ...(element.dataset.panelKey ? [element] : []),
      ...element.querySelectorAll("[data-panel-key]"),
    ];
    panelNodes.forEach((panel) => {
      const oldKey = panel.dataset.panelKey;
      if (!oldKey) return;
      if (!idMap.has(oldKey)) idMap.set(oldKey, nextPastedObjectId("panel"));
      panel.dataset.panelKey = idMap.get(oldKey);
      panel.dataset.customPanel = "true";
      delete panel.dataset.panelInitialized;
      if (workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider) {
        delete panel.dataset.contextScopeId;
        delete panel.dataset.workspaceRegionId;
        delete panel.dataset.contextInheritedFrom;
        delete panel.dataset.navigationTargetId;
      }
    });

    const widgetNodes = [
      ...(element.dataset.widgetKey ? [element] : []),
      ...element.querySelectorAll("[data-widget-key]"),
    ];
    widgetNodes.forEach((widget) => {
      const oldKey = widget.dataset.widgetKey;
      if (!oldKey) return;
      if (!idMap.has(oldKey)) idMap.set(oldKey, nextPastedObjectId("widget"));
      widget.dataset.widgetKey = idMap.get(oldKey);
      widget.dataset.customWidget = "true";
      delete widget.dataset.widgetInitialized;
      delete widget.dataset.contextInheritedFrom;
      delete widget.dataset.workspaceRegionId;
      if (rootKind === "widget" && widget === element) {
        delete widget.dataset.panelChildWidget;
        delete widget.dataset.parentPanelKey;
      }
    });

    element.querySelectorAll(".panel-internal-widget-grid").forEach((grid) => {
      const panel = grid.closest(".db-panel");
      const panelKey = panel?.dataset.panelKey || "";
      grid.dataset.panelContainerKey = panelKey;
      grid.dataset.widgetLayoutKey = `${layoutKey}:panel:${panelKey || "panel"}`;
    });

    element.querySelectorAll("[data-parent-panel-key]").forEach((child) => {
      remapDataReference(child, "parentPanelKey", idMap, { clearUnsafe: true });
    });
    [element, ...element.querySelectorAll("[data-navigation-target-id], [data-linked-divider-id]")].forEach((node) => {
      remapDataReference(node, "navigationTargetId", idMap);
      remapDataReference(node, "linkedDividerId", idMap, { clearUnsafe: true });
    });
  };

  const pasteClipboardContextLinks = (layoutKey, profile, clipboard, idMap) => {
    const links = Array.isArray(clipboard?.contextLinks) ? clipboard.contextLinks : [];
    if (!links.length) return;
    const remapped = links.flatMap((link) => {
      const sourceObjectId = idMap.get(link.sourceObjectId);
      const targetObjectId = idMap.get(link.targetObjectId);
      if (!sourceObjectId || !targetObjectId) return [];
      return normalizeContextLink({
        ...link,
        id: contextLinkId(),
        sourceObjectId,
        targetObjectId,
      });
    });
    if (!remapped.length) return;
    const graph = loadWorkspaceLogicGraph(layoutKey, profile);
    saveWorkspaceLogicGraph(layoutKey, {
      ...graph,
      contextLinks: [...graph.contextLinks, ...remapped],
    }, profile, { history: false, event: false });
  };

  const createGroupPasteFootprint = (boundsList) => {
    const minCol = Math.min(...boundsList.map((bounds) => bounds.col));
    const minRow = Math.min(...boundsList.map((bounds) => bounds.row));
    const maxRight = Math.max(...boundsList.map((bounds) => bounds.right));
    const maxBottom = Math.max(...boundsList.map((bounds) => bounds.bottom));
    const footprint = document.createElement("div");
    footprint.className = "db-panel-placeholder dashboard-group-paste-footprint";
    footprint.dataset.defaultSpan = String(Math.max(1, maxRight - minCol + 1));
    footprint.dataset.currentSpan = footprint.dataset.defaultSpan;
    footprint.dataset.gridRowSpan = String(Math.max(1, maxBottom - minRow + 1));
    return {
      footprint,
      origin: { col: minCol, row: minRow },
    };
  };

  const pasteWorkspaceClipboardObjects = (layoutKey = "builder") => {
    const clipboard = workspaceObjectClipboard;
    if (!clipboard?.items?.length) return false;
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    const targetLayout = panelLayout || widgetLayout;
    if (!targetLayout) return false;

    const idMap = new Map();
    const pasted = clipboard.items.map((entry) => {
      const template = document.createElement("template");
      template.innerHTML = entry.html || "";
      const element = template.content.firstElementChild;
      if (!element) return null;
      preparePastedWorkspaceElement(element, idMap, layoutKey, entry.kind);
      return {
        ...entry,
        element,
        bounds: entry.bounds,
        kind: entry.kind === "divider" ? "panel" : entry.kind,
      };
    }).filter((entry) => entry?.element && entry.bounds);
    if (!pasted.length) return false;

    const profile = getActivePanelProfile(layoutKey);
    pushLiveLayoutUndo(layoutKey, profile);
    const { footprint, origin } = createGroupPasteFootprint(pasted.map((entry) => entry.bounds));
    const target = visibleRegionInsertionTarget(targetLayout, footprint) || { col: 1, row: orderedLayoutStartRow(targetLayout) };

    const appendPastedObjects = () => {
      commitInsertedGridItemWithVerticalPushdown(targetLayout, footprint, target);
      clearGroupSelection();
      pasted.forEach((entry) => {
        const nextCol = target.col + (entry.bounds.col - origin.col);
        const nextRow = target.row + (entry.bounds.row - origin.row);
        if (entry.element.classList.contains("widget-card")) {
          if (!widgetLayout) return;
          widgetLayout.appendChild(entry.element);
          applyWidgetGridPosition(entry.element, nextCol, nextRow);
          widgetLayout.__initWidget?.(entry.element);
          bindDashboardKeywordForms(entry.element);
        } else {
          if (!panelLayout) return;
          panelLayout.appendChild(entry.element);
          applyPanelGridPosition(entry.element, nextCol, nextRow);
          ensureWorkspaceObjectMetadata(entry.element);
          panelLayout.__initPanel?.(entry.element);
        }
        setGroupItemSelected(entry.element, true);
      });
      syncWorkspaceRegions(targetLayout);
      pasteClipboardContextLinks(layoutKey, profile, clipboard, idMap);
    };

    const animationLayout = panelLayout || widgetLayout;
    if (animationLayout?.classList?.contains("panel-layout")) {
      animatePanelReflow(animationLayout, appendPastedObjects);
    } else if (animationLayout) {
      animateWidgetReflow(animationLayout, appendPastedObjects);
    } else {
      appendPastedObjects();
    }

    if (panelLayout) {
      cleanupPanelRowBreaks(panelLayout);
      savePanelLayouts(panelLayout, profile, { history: false });
    }
    if (widgetLayout) {
      cleanupWidgetRowBreaks(widgetLayout);
      saveWidgetLayouts(widgetLayout, profile, { history: false });
    }
    pushLiveLayoutUndo(layoutKey, profile);
    showToast(pasted.length > 1 ? `${pasted.length} objects pasted.` : "Object pasted.");
    return true;
  };

  const groupEntriesFit = (entries, deltaCol, deltaRow, occupied) => {
    const nextBounds = entries.map((entry) => {
      const col = entry.startBounds.col + deltaCol;
      const row = entry.startBounds.row + deltaRow;
      return {
        item: entry.item,
        bounds: {
          ...entry.startBounds,
          col,
          row,
          right: col + entry.startBounds.span - 1,
          bottom: row + entry.startBounds.rowSpan - 1,
        },
      };
    });
    return nextBounds.every(({ bounds }) => bounds.col >= 1 && bounds.row >= 1 && bounds.right <= DASHBOARD_GRID_COLUMNS) &&
      nextBounds.every(({ bounds }, index) => (
        !occupied.some((entry) => gridBoundsOverlap(bounds, entry.bounds)) &&
        !nextBounds.slice(index + 1).some((other) => gridBoundsOverlap(bounds, other.bounds))
      ));
  };

  const clampGroupDelta = (entries, deltaCol, deltaRow) => {
    const minCol = Math.min(...entries.map((entry) => entry.startBounds.col));
    const maxRight = Math.max(...entries.map((entry) => entry.startBounds.right));
    const minRow = Math.min(...entries.map((entry) => entry.startBounds.row));
    const minDeltaCol = 1 - minCol;
    const maxDeltaCol = DASHBOARD_GRID_COLUMNS - maxRight;
    const minDeltaRow = 1 - minRow;
    return {
      deltaCol: Math.max(minDeltaCol, Math.min(maxDeltaCol, Math.round(deltaCol))),
      deltaRow: Math.max(minDeltaRow, Math.round(deltaRow)),
    };
  };

  const findGroupDelta = (entries, preferredDelta, occupied) => {
    const preferred = clampGroupDelta(entries, preferredDelta.deltaCol, preferredDelta.deltaRow);
    if (groupEntriesFit(entries, preferred.deltaCol, preferred.deltaRow, occupied)) return preferred;
    let best = null;
    const maxRadius = 24;
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let rowDelta = preferred.deltaRow - radius; rowDelta <= preferred.deltaRow + radius; rowDelta += 1) {
        for (let colDelta = preferred.deltaCol - radius; colDelta <= preferred.deltaCol + radius; colDelta += 1) {
          if (Math.abs(rowDelta - preferred.deltaRow) !== radius && Math.abs(colDelta - preferred.deltaCol) !== radius) continue;
          const candidate = clampGroupDelta(entries, colDelta, rowDelta);
          if (!groupEntriesFit(entries, candidate.deltaCol, candidate.deltaRow, occupied)) continue;
          const upwardPenalty = candidate.deltaRow < preferred.deltaRow ? .7 : 0;
          const leftPenalty = candidate.deltaRow === preferred.deltaRow && candidate.deltaCol < preferred.deltaCol ? .2 : 0;
          const score = (Math.abs(candidate.deltaRow - preferred.deltaRow) * DASHBOARD_GRID_COLUMNS) +
            Math.abs(candidate.deltaCol - preferred.deltaCol) + upwardPenalty + leftPenalty;
          if (!best || score < best.score) best = { ...candidate, score };
        }
      }
      if (best) return best;
    }
    return { deltaCol: 0, deltaRow: 0 };
  };

  const applyGroupDelta = (entries, delta) => {
    entries.forEach((entry) => {
      applyGridItemPosition(entry.item, entry.startBounds.col + delta.deltaCol, entry.startBounds.row + delta.deltaRow);
    });
  };

  const groupDragEntries = (activeItem, placeholder, groupItems, startBounds) => groupItems
    .map((groupItem) => ({
      item: groupItem === activeItem ? placeholder : groupItem,
      sourceItem: groupItem,
      startBounds: startBounds.get(groupItem),
    }))
    .filter((entry) => entry.item && entry.startBounds);

  const externalOccupiedForGroup = (layout, excludedItems) => {
    const excluded = new Set(excludedItems.filter(Boolean));
    return globalGridItems(layout, { includePlaceholders: true })
      .filter((other) => !excluded.has(other))
      .map((other) => ({ item: other, bounds: gridBoundsForItem(other) }));
  };

  const commitGroupDropSlot = (layout, activeItem, groupItems, preferredTarget, startBounds) => {
    const entries = groupItems
      .map((groupItem) => ({ item: groupItem, sourceItem: groupItem, startBounds: startBounds.get(groupItem) }))
      .filter((entry) => entry.startBounds);
    if (entries.length < 2) return commitActiveDropSlot(layout, activeItem, preferredTarget);
    const activeStart = startBounds.get(activeItem) || gridBoundsForItem(activeItem);
    const preferred = preferredTarget || activeStart;
    const occupied = externalOccupiedForGroup(layout, entries.map((entry) => entry.item));
    const delta = findGroupDelta(entries, {
      deltaCol: preferred.col - activeStart.col,
      deltaRow: preferred.row - activeStart.row,
    }, occupied);
    applyGroupDelta(entries, delta);
    return {
      bounds: boundsAtGridSlot(activeItem, activeStart.col + delta.deltaCol, activeStart.row + delta.deltaRow),
      movedItems: entries.length - 1,
    };
  };

  const orderedLayoutStartRow = (layout) => {
    if (!layout?.classList?.contains("panel-layout")) return 1;
    const host = gridHostForLayout(layout);
    if (host === layout) return 1;
    const key = gridItemLayoutKey(layout);
    const widgetLayout = host.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(key)}"]`);
    if (!widgetLayout) return 1;
    const widgetBottom = orderedGridItems(widgetLayout, { includePlaceholders: true })
      .filter((item) => !item.classList.contains("widget-dragging"))
      .reduce((bottom, item) => {
        const row = Number(item.dataset.gridRow) || 1;
        return Math.max(bottom, row + gridItemRowSpan(item) - 1);
      }, 0);
    return Math.max(1, widgetBottom + 1);
  };

  const packOrderedGridItems = (layout, items) => {
    const placements = new Map();
    const occupied = new Set();
    const startRow = orderedLayoutStartRow(layout);
    let cursorRow = startRow;
    let cursorCol = 1;
    const canOccupy = (row, col, span, rowSpan) => {
      if (col < 1 || col + span - 1 > DASHBOARD_GRID_COLUMNS) return false;
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        for (let colOffset = 0; colOffset < span; colOffset += 1) {
          if (occupied.has(`${row + rowOffset}:${col + colOffset}`)) return false;
        }
      }
      return true;
    };
    const occupy = (row, col, span, rowSpan) => {
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        for (let colOffset = 0; colOffset < span; colOffset += 1) {
          occupied.add(`${row + rowOffset}:${col + colOffset}`);
        }
      }
    };
    const findSlot = (span, rowSpan) => {
      for (let row = cursorRow; row < cursorRow + 160; row += 1) {
        const startCol = row === cursorRow ? cursorCol : 1;
        for (let col = startCol; col <= DASHBOARD_GRID_COLUMNS - span + 1; col += 1) {
          if (canOccupy(row, col, span, rowSpan)) return { row, col };
        }
      }
      return { row: cursorRow, col: 1 };
    };
    items.forEach((item) => {
      const span = gridItemSpan(item);
      const rowSpan = gridItemRowSpan(item);
      const slot = findSlot(span, rowSpan);
      placements.set(item, { ...slot, span, rowSpan });
      occupy(slot.row, slot.col, span, rowSpan);
      cursorRow = slot.row;
      cursorCol = slot.col + span;
      if (cursorCol > DASHBOARD_GRID_COLUMNS) {
        cursorRow += 1;
        cursorCol = 1;
      }
    });
    return placements;
  };

  const applyOrderedGridLayout = (layout, items = orderedGridItems(layout, { includePlaceholders: true })) => {
    if (gridHostForLayout(layout) !== layout) {
      return resolveSparseGridLayout(layout);
    }
    const placements = packOrderedGridItems(layout, items.filter((item) => item.isConnected));
    placements.forEach((placement, item) => applyGridItemPosition(item, placement.col, placement.row));
    return placements;
  };

  const reflowItemsForLayout = (layout, excludeItem = null) => {
    const host = gridHostForLayout(layout);
    const selector = ".widget-layout > .widget-card, .widget-layout > .widget-placeholder, .panel-layout > .db-panel, .panel-layout > .db-panel-placeholder";
    return [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
  };

  const shouldAnimateGridReflowItem = (item, metrics, viewport, options = {}) => {
    if (options.activeItems?.has?.(item)) return true;
    const lod = workspaceVisualLodForItem(item, metrics, viewport);
    return lod === "active" || lod === "visible" || lod === "near";
  };

  const animateOrderedGridReflow = (layout, update, excludeItem = null, options = {}) => {
    const items = (options.items || reflowItemsForLayout(layout, excludeItem))
      .filter((item) => item.isConnected && item !== excludeItem && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
    const metrics = options.metrics || createGridMetrics(layout);
    const viewport = workspaceVisualViewport();
    const activeItems = new Set([].concat(options.activeItems || []).filter(Boolean));
    const animatableItems = items.filter((item) => shouldAnimateGridReflowItem(item, metrics, viewport, { activeItems }));
    const before = new Map(animatableItems.map((item) => [item, item.getBoundingClientRect()]));
    update();
    scheduleWorkspaceVisualLodRefresh(gridHostForLayout(layout));
    const afterItems = (options.items || reflowItemsForLayout(layout, excludeItem))
      .filter((item) => (
        item.isConnected &&
        item !== excludeItem &&
        !item.classList.contains("widget-dragging") &&
        !item.classList.contains("db-panel-dragging") &&
        before.has(item) &&
        shouldAnimateGridReflowItem(item, metrics, viewport, { activeItems })
      ));
    afterItems.forEach((item) => {
      const first = before.get(item);
      if (!first) return;
      const last = item.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      item.animate(
        [
          { transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 180, easing: "cubic-bezier(.2, .8, .2, 1)" }
      );
    });
  };

  const insertItemAtOrderedIndex = (layout, item, index, excludeItems = []) => {
    const siblings = orderedGridItems(layout, { includePlaceholders: true, exclude: [item, ...excludeItems] });
    const reference = siblings[Math.max(0, Math.min(index, siblings.length))] || null;
    layout.insertBefore(item, reference);
  };

  const panelBodyRectFromSnapshot = (panel, snapshot) => {
    const state = snapshot?.get?.(panel);
    const body = panel?.querySelector?.(":scope > .db-panel-body");
    const layout = panel?.closest?.(".panel-layout");
    if (!state || !body || !layout) return null;
    const metrics = createGridMetrics(layout);
    const col = Number(state.gridCol) || Number(panel.dataset.gridCol) || 1;
    const row = Number(state.gridRow) || Number(panel.dataset.gridRow) || 1;
    const span = Math.max(1, Math.min(DASHBOARD_GRID_COLUMNS, Number(state.currentSpan) || Number(panel.dataset.currentSpan) || 6));
    const rowSpan = Math.max(1, Number(state.gridRowSpan) || gridItemRowSpan(panel, metrics));
    const headerHeight = panel.querySelector(":scope > .db-panel-hd")?.getBoundingClientRect?.().height || 0;
    const left = metrics.rect.left + ((col - 1) * metrics.columnStep);
    const top = metrics.rect.top + ((row - 1) * metrics.rowStep);
    const width = (span * metrics.columnWidth) + (Math.max(0, span - 1) * metrics.gap);
    const height = Number(state.savedHeight) || gridHeightForRows(rowSpan, metrics.gap);
    return {
      left,
      right: left + width,
      top: top + headerHeight,
      bottom: top + Math.max(headerHeight + 1, height),
    };
  };

  const panelHeaderRectFromSnapshot = (panel, snapshot) => {
    const bodyRect = panelBodyRectFromSnapshot(panel, snapshot);
    const state = snapshot?.get?.(panel);
    const layout = panel?.closest?.(".panel-layout");
    const header = panel?.querySelector?.(":scope > .db-panel-hd");
    if (!bodyRect || !state || !layout || !header) return null;
    const metrics = createGridMetrics(layout);
    const row = Number(state.gridRow) || Number(panel.dataset.gridRow) || 1;
    const top = metrics.rect.top + ((row - 1) * metrics.rowStep);
    return {
      left: bodyRect.left,
      right: bodyRect.right,
      top,
      bottom: bodyRect.top,
    };
  };

  const pointInRect = (clientX, clientY, rect) => (
    rect &&
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
  const PANEL_ENTRY_TOLERANCE_PX = 42;
  const expandPanelEntryBodyRect = (rect, tolerance = PANEL_ENTRY_TOLERANCE_PX) => rect
    ? {
      left: rect.left - tolerance,
      right: rect.right + tolerance,
      top: rect.top - tolerance,
      bottom: rect.bottom + tolerance,
    }
    : null;
  const clampPointToPanelBodyRect = (panel, clientX, clientY, snapshot = null) => {
    const body = panel?.querySelector?.(":scope > .db-panel-body");
    const rect = body?.getBoundingClientRect?.() || panelBodyRectFromSnapshot(panel, snapshot);
    if (!rect) return { clientX, clientY };
    return {
      clientX: Math.max(rect.left, Math.min(rect.right, clientX)),
      clientY: Math.max(rect.top, Math.min(rect.bottom, clientY)),
    };
  };

  const panelEntryCandidateAt = (clientX, clientY, draggedWidget, options = {}) => {
    const panels = [...document.querySelectorAll(".panel-layout > .db-panel:not([hidden])")]
      .filter((panel) => panel.isConnected)
      .filter((panel) => panel !== draggedWidget)
      .filter((panel) => !panel.classList.contains("db-panel-collapsed"))
      .filter((panel) => !panel.classList.contains("db-panel-dragging"))
      .filter((panel) => workspaceObjectCapabilities(panel).hasPanelContentArea);
    for (const panel of panels) {
      const body = panel.querySelector(":scope > .db-panel-body");
      const header = panel.querySelector(":scope > .db-panel-hd");
      if (!body || body.offsetParent === null || !header) continue;
      const rect = body.getBoundingClientRect();
      const snapshotBodyRect = panelBodyRectFromSnapshot(panel, options.snapshot);
      const headerRect = header.getBoundingClientRect();
      const snapshotHeaderRect = panelHeaderRectFromSnapshot(panel, options.snapshot);
      if (pointInRect(clientX, clientY, headerRect) || pointInRect(clientX, clientY, snapshotHeaderRect)) {
        return { panel, zone: "header" };
      }
      if (pointInRect(clientX, clientY, rect) || pointInRect(clientX, clientY, snapshotBodyRect)) {
        return { panel, zone: "body" };
      }
      if (pointInRect(clientX, clientY, expandPanelEntryBodyRect(rect)) || pointInRect(clientX, clientY, expandPanelEntryBodyRect(snapshotBodyRect))) {
        return { panel, zone: "body-tolerance" };
      }
    }
    return null;
  };

  const animateAbsorbedWidgetIntoPanel = (widget, fromRect) => {
    if (!widget || !fromRect) return;
    const toRect = widget.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    widget.animate(
      [
        { transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(1.006)`, opacity: .94 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 280, easing: "cubic-bezier(.2, .8, .2, 1)" }
    );
  };

  const workspaceWidgetLayoutForPanel = (panel) => {
    const host = panel?.closest?.(".dashboard-layout-grid");
    const layoutKey = panel?.closest?.(".panel-layout")?.dataset?.layoutKey || groupItemLayoutKey(panel);
    if (!host || !layoutKey) return null;
    return host.querySelector(`:scope > .widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]:not(.panel-internal-widget-grid)`);
  };

  const absorbWidgetIntoPanel = ({ widget, sourceLayout, panel, clientX, clientY, fromRect, targetCell = null }) => {
    const internalGrid = ensurePanelInternalWidgetGrid(panel);
    if (!internalGrid) return null;
    const widgetKey = widget.dataset.widgetKey || "";
    if (widgetKey && !widget.dataset.customWidget) {
      const hidden = readDraftList(sourceLayout, "hiddenWidgetsDraft");
      if (!hidden.includes(widgetKey)) hidden.push(widgetKey);
      writeDraftList(sourceLayout, "hiddenWidgetsDraft", hidden);
    }
    const clone = sanitizePanelChildWidgetClone(widget);
    clone.dataset.panelChildWidget = "true";
    clone.dataset.parentPanelKey = panel.dataset.panelKey || "";
    delete clone.dataset.widgetInitialized;
    if (!clone.dataset.gridRowSpan) clone.dataset.gridRowSpan = "1";
    applyWidgetSpan(clone, Math.max(gridItemMinimumSpan(clone), Math.min(DASHBOARD_GRID_COLUMNS, Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 1)));
    widget.remove();
    internalGrid.appendChild(clone);
    const metrics = createGridMetrics(internalGrid);
    const target = targetCell || gridCellFromPoint(internalGrid, clone, clientX, clientY, metrics);
    applyWidgetGridPosition(clone, target.col, target.row);
    resolveSparseGridLayout(internalGrid, clone, target, { metrics });
    initWidgetLayout(internalGrid);
    updatePanelChildEmptyState(panel);
    animateAbsorbedWidgetIntoPanel(clone, fromRect);
    emitWorkspaceEvent({
      type: "widget-moved-into-panel",
      source: "panel-containment",
      layoutKey: gridItemLayoutKey(sourceLayout || internalGrid),
      objectId: clone.dataset.widgetKey || "",
      objectType: "widget",
      panelId: panel.dataset.panelKey || "",
      regionId: regionIdForWorkspaceItem(panel),
      label: `${clone.dataset.widgetDisplayName || "Widget"} moved into panel`,
      payload: {
        parentPanelId: panel.dataset.panelKey || "",
        col: Number(clone.dataset.gridCol) || 0,
        row: Number(clone.dataset.gridRow) || 0,
      },
    });
    return clone;
  };

  const extractPanelChildWidgetToWorkspace = ({ widget, sourceLayout, targetLayout, panel, targetCell, fromRect }) => {
    if (!widget || !sourceLayout || !targetLayout || !panel) return null;
    const widgetKey = widget.dataset.widgetKey || "";
    if (widgetKey) {
      const hidden = readDraftList(targetLayout, "hiddenWidgetsDraft")
        .filter((hiddenKey) => hiddenKey !== widgetKey);
      writeDraftList(targetLayout, "hiddenWidgetsDraft", hidden);
    }
    const clone = sanitizePanelChildWidgetClone(widget);
    delete clone.dataset.panelChildWidget;
    delete clone.dataset.parentPanelKey;
    delete clone.dataset.widgetInitialized;
    widget.remove();
    targetLayout.appendChild(clone);
    applyWidgetGridPosition(clone, targetCell?.col || 1, targetCell?.row || 1);
    const result = commitActiveDropSlot(targetLayout, clone, targetCell || gridBoundsForItem(clone));
    targetLayout.__initWidget?.(clone);
    updatePanelChildEmptyState(panel);
    animateAbsorbedWidgetIntoPanel(clone, fromRect);
    cleanupWidgetRowBreaks(targetLayout);
    emitWorkspaceEvent({
      type: "widget-moved-out-of-panel",
      source: "panel-containment",
      layoutKey: gridItemLayoutKey(targetLayout),
      objectId: clone.dataset.widgetKey || "",
      objectType: "widget",
      panelId: panel.dataset.panelKey || "",
      regionId: regionIdForWorkspaceItem(clone),
      label: `${clone.dataset.widgetDisplayName || "Widget"} moved out of panel`,
      payload: {
        fromPanelId: panel.dataset.panelKey || "",
        col: Number(clone.dataset.gridCol) || 0,
        row: Number(clone.dataset.gridRow) || 0,
      },
    });
    return { widget: clone, ...result };
  };

  const orderedInsertionIndexFromPoint = (layout, placeholder, activeItem, clientX, clientY) => {
    const target = gridCellFromPoint(layout, activeItem, clientX, clientY);
    const siblings = orderedGridItems(layout, { includePlaceholders: false, exclude: [activeItem] });
    let best = { index: siblings.length, score: Infinity };
    for (let index = 0; index <= siblings.length; index += 1) {
      const candidate = [...siblings];
      candidate.splice(index, 0, placeholder);
      const placement = packOrderedGridItems(layout, candidate).get(placeholder);
      if (!placement) continue;
      const score = (Math.abs(placement.row - target.row) * DASHBOARD_GRID_COLUMNS) + Math.abs(placement.col - target.col);
      if (score < best.score || (score === best.score && index > best.index && target.row >= placement.row)) {
        best = { index, score };
      }
    }
    return best.index;
  };

  const runOrderedDrag = ({
    layout,
    item,
    event,
    draggingClass,
    placeholderClass,
    threshold = 6,
    onCommit,
    onCancel,
    onStart,
    onEnd,
  }) => {
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.add("panel-interaction-active");
    window.getSelection?.()?.removeAllRanges();
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const pointerTarget = event.currentTarget || item;
    let ended = false;
    let rect = null;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    let placeholder = null;
    let startSnapshot = null;
    let targetCell = null;
    let groupDrag = null;
    let groupLive = null;
    let expandedFootprintGhost = null;
    let dragMetrics = null;
    let reflowItems = null;
    const panelEntryIntent = {
      lastX: startX,
      lastY: startY,
      lastTime: event.timeStamp || performance.now(),
      headerPanel: null,
      headerSince: 0,
    };
    const canAbsorbIntoPanel = (
      item.classList.contains("widget-card") &&
      !item.classList.contains("workspace-anchor-object") &&
      item.dataset.dashboardObjectKind !== "timeframe" &&
      layout.classList.contains("widget-layout") &&
      !isPanelInternalWidgetLayout(layout)
    );
    let panelDrag = null;
    const sourcePanelForPanelLocalDrag = isPanelInternalWidgetLayout(layout)
      ? panelForInternalWidgetLayout(layout)
      : null;
    const workspaceExitLayout = sourcePanelForPanelLocalDrag
      ? workspaceWidgetLayoutForPanel(sourcePanelForPanelLocalDrag)
      : null;
    const canExitPanelToWorkspace = (
      item.classList.contains("widget-card") &&
      !item.classList.contains("workspace-anchor-object") &&
      !groupDrag &&
      Boolean(sourcePanelForPanelLocalDrag) &&
      Boolean(workspaceExitLayout)
    );
    let panelExitDrag = null;
    const originalCell = {
      col: Number(item.dataset.gridCol) || 1,
      row: Number(item.dataset.gridRow) || 1,
    };
    let lastMoveEvent = event;
    const autoScroll = beginInteractionAutoScroll({
      layout,
      onScrollFrame: (scrollEvent) => {
        if (!dragging || !lastMoveEvent) return;
        try {
          onMove(scrollEvent || lastMoveEvent);
        } catch (error) {
          onUp({ type: "pointercancel" });
          window.setTimeout(() => {
            throw error;
          }, 0);
        }
      },
    });

    const startDrag = () => {
      if (dragging) return;
      dragging = true;
      item.dataset.visualLod = "active";
      item.dataset.lod = "active";
      rect = item.getBoundingClientRect();
      startSnapshot = snapshotGridLayout(layout);
      const groupItems = groupTransformItems(item)
        .filter((groupItem) => groupItem === item || !groupItem.classList.contains("db-panel-pinned"));
      if (item.classList.contains("group-selected") && groupItems.length > 1) {
        const startBounds = new Map(groupItems.map((groupItem) => [groupItem, gridBoundsForItem(groupItem)]));
        const groupBox = groupGridBox([...startBounds.values()]);
        const footprint = createGroupFootprint(layout, groupBox, "dashboard-group-drag-footprint");
        placeholder = footprint.footprint;
        groupLive = beginGroupLiveSurfaces(groupItems);
        groupDrag = { items: groupItems, startBounds, groupBox, footprintLayout: footprint.footprintLayout };
        offsetX = startX - groupLive.groupRect.left;
        offsetY = startY - groupLive.groupRect.top;
        targetCell = { col: groupBox.col, row: groupBox.row };
        document.body.classList.add("group-transform-active");
        groupItems.forEach((groupItem) => groupItem.classList.add("group-transform-member"));
      } else {
        placeholder = document.createElement("div");
        placeholder.className = placeholderClass;
        placeholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
        placeholder.dataset.defaultSpan = item.dataset.defaultSpan || placeholder.dataset.currentSpan;
        placeholder.dataset.gridRowSpan = String(gridItemRowSpan(item));
        placeholder.style.gridColumn = item.style.gridColumn || `span ${placeholder.dataset.currentSpan}`;
        placeholder.style.gridRow = item.style.gridRow || "";
        const placeholderMinHeight = isPanelInternalWidgetLayout(layout)
          ? Math.max(1, rect.height)
          : DASHBOARD_GRID_ROW_HEIGHT;
        placeholder.style.height = `${Math.max(placeholderMinHeight, rect.height)}px`;
        layout.insertBefore(placeholder, item);
        item.classList.add(draggingClass);
        item.style.width = `${rect.width}px`;
        if (item.classList.contains("db-panel")) item.style.height = `${rect.height}px`;
        item.style.left = `${Math.round(rect.left)}px`;
        item.style.top = `${Math.round(rect.top)}px`;
        expandedFootprintGhost = createExpandedFootprintGhost(item, layout, rect);
        offsetX = startX - rect.left;
        offsetY = startY - rect.top;
        targetCell = originalCell;
      }
      dragMetrics = createGridMetrics(layout);
      reflowItems = reflowItemsForLayout(layout, item);
      closeInactiveDashboardTools(item);
      onStart?.();
    };

    const createPanelDropPlaceholder = () => {
      const panelPlaceholder = document.createElement("div");
      panelPlaceholder.className = "widget-placeholder panel-local-drop-placeholder";
      panelPlaceholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
      panelPlaceholder.dataset.defaultSpan = item.dataset.defaultSpan || panelPlaceholder.dataset.currentSpan;
      panelPlaceholder.dataset.gridRowSpan = String(gridItemRowSpan(item));
      panelPlaceholder.style.gridColumn = item.style.gridColumn || `span ${panelPlaceholder.dataset.currentSpan}`;
      panelPlaceholder.style.gridRow = item.style.gridRow || "";
      panelPlaceholder.style.height = `${Math.max(DASHBOARD_GRID_ROW_HEIGHT, rect?.height || DASHBOARD_GRID_ROW_HEIGHT)}px`;
      return panelPlaceholder;
    };

    const createWorkspaceExitPlaceholder = () => {
      const workspacePlaceholder = document.createElement("div");
      workspacePlaceholder.className = "widget-placeholder panel-workspace-exit-placeholder";
      workspacePlaceholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
      workspacePlaceholder.dataset.defaultSpan = item.dataset.defaultSpan || workspacePlaceholder.dataset.currentSpan;
      workspacePlaceholder.dataset.gridRowSpan = String(gridItemRowSpan(item));
      workspacePlaceholder.style.gridColumn = item.style.gridColumn || `span ${workspacePlaceholder.dataset.currentSpan}`;
      workspacePlaceholder.style.gridRow = item.style.gridRow || "";
      workspacePlaceholder.style.height = `${Math.max(DASHBOARD_GRID_ROW_HEIGHT, rect?.height || DASHBOARD_GRID_ROW_HEIGHT)}px`;
      return workspacePlaceholder;
    };

    const panelEntryMotionFor = (moveEvent) => {
      const now = moveEvent.timeStamp || performance.now();
      const elapsed = Math.max(1, now - panelEntryIntent.lastTime);
      const stepDx = moveEvent.clientX - panelEntryIntent.lastX;
      const stepDy = moveEvent.clientY - panelEntryIntent.lastY;
      panelEntryIntent.lastX = moveEvent.clientX;
      panelEntryIntent.lastY = moveEvent.clientY;
      panelEntryIntent.lastTime = now;
      return {
        now,
        stepDx,
        stepDy,
        totalDx: moveEvent.clientX - startX,
        totalDy: moveEvent.clientY - startY,
        speed: Math.hypot(stepDx, stepDy) / elapsed,
      };
    };

    const triggerPanelHeaderEntryFeedback = (panel) => {
      if (!panel) return;
      panel.classList.remove("panel-header-entry-accept");
      void panel.offsetWidth;
      panel.classList.add("panel-header-entry-accept");
      panel.addEventListener("animationend", () => {
        panel.classList.remove("panel-header-entry-accept");
      }, { once: true });
    };

    const triggerPanelBoundaryExitFeedback = (panel) => {
      if (!panel) return;
      panel.dataset.panelBoundaryExitFeedback = "true";
      panel.classList.remove("panel-boundary-exit-release");
      void panel.offsetWidth;
      panel.classList.add("panel-boundary-exit-release");
      panel.addEventListener("animationend", () => {
        panel.classList.remove("panel-boundary-exit-release");
      }, { once: true });
    };

    const clampPanelEntryDelta = (value, limit = 28) => Math.max(-limit, Math.min(limit, value));

    const restartPanelEntryAnimation = (element, className) => {
      if (!element) return;
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
    };

    const animatePanelEntryTransition = (state) => {
      if (!state?.placeholder || !state.placeholder.isConnected) return;
      const placeholderRect = state.placeholder.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const previewDx = Math.round(itemRect.left - placeholderRect.left);
      const previewDy = Math.round(itemRect.top - placeholderRect.top);
      state.placeholder.style.setProperty("--panel-entry-preview-x", `${previewDx}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-y", `${previewDy}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-overshoot-x", `${clampPanelEntryDelta(previewDx * -.08, 8)}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-overshoot-y", `${clampPanelEntryDelta(previewDy * -.08, 8)}px`);
      restartPanelEntryAnimation(state.placeholder, "panel-entry-preview-transition");

      const ghostDx = clampPanelEntryDelta((placeholderRect.left - itemRect.left) * .12);
      const ghostDy = clampPanelEntryDelta((placeholderRect.top - itemRect.top) * .12);
      item.style.setProperty("--panel-entry-ghost-x", `${Math.round(ghostDx)}px`);
      item.style.setProperty("--panel-entry-ghost-y", `${Math.round(ghostDy)}px`);
      item.style.setProperty("--panel-entry-ghost-return-x", `${Math.round(ghostDx * -.28)}px`);
      item.style.setProperty("--panel-entry-ghost-return-y", `${Math.round(ghostDy * -.28)}px`);
      restartPanelEntryAnimation(item, "panel-entry-ghost-transition");
    };

    const animatePanelExitTransition = (state) => {
      if (!state?.placeholder || !state.placeholder.isConnected) return;
      const placeholderRect = state.placeholder.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const previewDx = Math.round(itemRect.left - placeholderRect.left);
      const previewDy = Math.round(itemRect.top - placeholderRect.top);
      state.placeholder.style.setProperty("--panel-entry-preview-x", `${previewDx}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-y", `${previewDy}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-overshoot-x", `${clampPanelEntryDelta(previewDx * -.08, 8)}px`);
      state.placeholder.style.setProperty("--panel-entry-preview-overshoot-y", `${clampPanelEntryDelta(previewDy * -.08, 8)}px`);
      restartPanelEntryAnimation(state.placeholder, "panel-exit-preview-transition");

      const ghostDx = clampPanelEntryDelta((placeholderRect.left - itemRect.left) * .12);
      const ghostDy = clampPanelEntryDelta((placeholderRect.top - itemRect.top) * .12);
      item.style.setProperty("--panel-entry-ghost-x", `${Math.round(ghostDx)}px`);
      item.style.setProperty("--panel-entry-ghost-y", `${Math.round(ghostDy)}px`);
      item.style.setProperty("--panel-entry-ghost-return-x", `${Math.round(ghostDx * -.28)}px`);
      item.style.setProperty("--panel-entry-ghost-return-y", `${Math.round(ghostDy * -.28)}px`);
      restartPanelEntryAnimation(item, "panel-exit-ghost-transition");
      triggerPanelBoundaryExitFeedback(state.panel);
    };

    const acceptsHeaderPanelEntry = (panel, motion) => {
      if (!motion) return false;
      if (panelEntryIntent.headerPanel !== panel) {
        panelEntryIntent.headerPanel = panel;
        panelEntryIntent.headerSince = motion.now;
      }
      const dwell = motion.now - panelEntryIntent.headerSince;
      const clearlyDownward = motion.totalDy > 20 &&
        motion.stepDy >= -1 &&
        motion.totalDy >= Math.abs(motion.totalDx) * .7;
      const slowEnough = motion.speed <= .36;
      return clearlyDownward && (slowEnough || dwell >= 120);
    };

    const clearPanelDragPreview = ({ restore = true } = {}) => {
      if (!panelDrag) return;
      const state = panelDrag;
      panelDrag = null;
      state.panel.classList.remove("panel-container-drag-active", "panel-header-entry-accept");
      item.classList.remove("panel-entry-ghost-transition", "panel-exit-ghost-transition");
      if (restore) restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
      state.placeholder.remove();
      updatePanelChildEmptyState(state.panel);
      if (placeholder) placeholder.style.visibility = "";
      targetCell = null;
    };

    const clearPanelExitPreview = ({ restore = true } = {}) => {
      if (!panelExitDrag) return;
      const state = panelExitDrag;
      panelExitDrag = null;
      state.panel.classList.remove("panel-container-drag-active", "panel-boundary-exit-release");
      delete state.panel.dataset.panelBoundaryExitFeedback;
      item.classList.remove("panel-exit-ghost-transition");
      if (restore) restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
      state.placeholder.remove();
      updatePanelChildEmptyState(state.panel);
      if (placeholder) placeholder.style.visibility = "";
      targetCell = null;
    };

    const enterPanelDragPreview = (panel, options = {}) => {
      if (panelDrag?.panel === panel) return panelDrag;
      clearPanelDragPreview();
      if (!panel || groupDrag) return null;
      const internalGrid = ensurePanelInternalWidgetGrid(panel);
      if (!internalGrid) return null;
      restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
      if (placeholder) {
        applyWidgetGridPosition(placeholder, originalCell.col, originalCell.row);
        placeholder.style.visibility = "hidden";
      }
      const snapshot = snapshotGridLayout(internalGrid);
      const panelPlaceholder = createPanelDropPlaceholder();
      internalGrid.appendChild(panelPlaceholder);
      panel.classList.add("panel-container-drag-active");
      if (options.zone === "header") triggerPanelHeaderEntryFeedback(panel);
      panelDrag = {
        panel,
        layout: internalGrid,
        placeholder: panelPlaceholder,
        snapshot,
        metrics: createGridMetrics(internalGrid),
        reflowItems: reflowItemsForLayout(internalGrid, panelPlaceholder),
        targetCell: null,
        entryZone: options.zone || "body",
        entryTransitionPlayed: false,
      };
      updatePanelChildEmptyState(panel);
      return panelDrag;
    };

    const updatePanelDragPreview = (moveEvent, motion = null) => {
      if (!canAbsorbIntoPanel || groupDrag || !dragging || !placeholder) {
        clearPanelDragPreview();
        return false;
      }
      const candidate = panelEntryCandidateAt(moveEvent.clientX, moveEvent.clientY, item, { snapshot: startSnapshot });
      if (!candidate) {
        panelEntryIntent.headerPanel = null;
        panelEntryIntent.headerSince = 0;
        clearPanelDragPreview();
        return false;
      }
      if (!panelDrag) {
        if (candidate.zone === "header") {
          if (!acceptsHeaderPanelEntry(candidate.panel, motion)) return false;
        }
      }
      const state = enterPanelDragPreview(candidate.panel, { zone: candidate.zone });
      if (!state) return false;
      const metrics = refreshGridMetricsRect(state.metrics);
      const previewPoint = candidate.zone === "body-tolerance"
        ? clampPointToPanelBodyRect(candidate.panel, moveEvent.clientX, moveEvent.clientY, startSnapshot)
        : { clientX: moveEvent.clientX, clientY: moveEvent.clientY };
      const nextCell = gridCellFromDragPointer(state.layout, state.placeholder, previewPoint.clientX, previewPoint.clientY, offsetX, offsetY, metrics, rect);
      const shouldPlayEntryTransition = state.entryZone === "header" && !state.entryTransitionPlayed;
      if (state.targetCell && state.targetCell.col === nextCell.col && state.targetCell.row === nextCell.row) return true;
      state.targetCell = nextCell;
      animateOrderedGridReflow(state.layout, () => {
        restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
        resolveSparseGridLayout(state.layout, state.placeholder, nextCell, { afterOnly: true, metrics, items: state.reflowItems });
      }, state.placeholder, { items: state.reflowItems, metrics });
      if (shouldPlayEntryTransition) {
        state.entryTransitionPlayed = true;
        animatePanelEntryTransition(state);
      }
      updatePanelChildEmptyState(state.panel);
      return true;
    };

    const pointerInsidePanelShell = (panel, clientX, clientY) => {
      if (!panel || panel.classList.contains("db-panel-collapsed")) return false;
      return pointInRect(clientX, clientY, panel.getBoundingClientRect());
    };

    const enterWorkspaceExitPreview = () => {
      if (panelExitDrag) return panelExitDrag;
      if (!sourcePanelForPanelLocalDrag || !workspaceExitLayout || groupDrag) return null;
      restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
      if (placeholder) {
        applyWidgetGridPosition(placeholder, originalCell.col, originalCell.row);
        placeholder.style.visibility = "hidden";
      }
      const snapshot = snapshotGridLayout(workspaceExitLayout);
      const workspacePlaceholder = createWorkspaceExitPlaceholder();
      workspaceExitLayout.appendChild(workspacePlaceholder);
      sourcePanelForPanelLocalDrag.classList.add("panel-container-drag-active");
      panelExitDrag = {
        panel: sourcePanelForPanelLocalDrag,
        layout: workspaceExitLayout,
        placeholder: workspacePlaceholder,
        snapshot,
        metrics: createGridMetrics(workspaceExitLayout),
        reflowItems: reflowItemsForLayout(workspaceExitLayout, workspacePlaceholder),
        targetCell: null,
        exitTransitionPlayed: false,
      };
      updatePanelChildEmptyState(sourcePanelForPanelLocalDrag);
      return panelExitDrag;
    };

    const updatePanelExitPreview = (moveEvent) => {
      if (!canExitPanelToWorkspace || !dragging || !placeholder) {
        clearPanelExitPreview();
        return false;
      }
      if (pointerInsidePanelShell(sourcePanelForPanelLocalDrag, moveEvent.clientX, moveEvent.clientY)) {
        clearPanelExitPreview();
        return false;
      }
      const state = enterWorkspaceExitPreview();
      if (!state) return false;
      const metrics = refreshGridMetricsRect(state.metrics);
      const nextCell = gridCellFromDragPointer(state.layout, state.placeholder, moveEvent.clientX, moveEvent.clientY, offsetX, offsetY, metrics, rect);
      const shouldPlayExitTransition = !state.exitTransitionPlayed;
      if (state.targetCell && state.targetCell.col === nextCell.col && state.targetCell.row === nextCell.row) return true;
      state.targetCell = nextCell;
      animateOrderedGridReflow(state.layout, () => {
        restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
        resolveSparseGridLayout(state.layout, state.placeholder, nextCell, { afterOnly: true, metrics, items: state.reflowItems });
      }, state.placeholder, { items: state.reflowItems, metrics });
      if (shouldPlayExitTransition) {
        state.exitTransitionPlayed = true;
        animatePanelExitTransition(state);
      }
      updatePanelChildEmptyState(state.panel);
      return true;
    };

    const movePreview = (clientX, clientY, metrics = null, options = {}) => {
      if (!placeholder) return;
      const previewItem = groupDrag ? placeholder : item;
      const nextCell = options.preservePointerOffset
        ? gridCellFromDragPointer(layout, previewItem, clientX, clientY, offsetX, offsetY, metrics, rect)
        : gridCellFromPoint(layout, previewItem, clientX, clientY, metrics);
      if (targetCell && targetCell.col === nextCell.col && targetCell.row === nextCell.row) return;
      targetCell = nextCell;
      const expandedPanelDrag = !groupDrag && workspaceObjectCapabilities(item).hasExpandedFootprint && !item.classList.contains("db-panel-collapsed");
      const localVacancy = groupDrag
        ? groupBoxBounds(groupDrag.groupBox)
        : expandedPanelDrag
          ? null
          : boundsAtGridSlot(placeholder, originalCell.col, originalCell.row, metrics);
      animateOrderedGridReflow(layout, () => {
        restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
        if (groupDrag) {
          applyGroupFootprintBounds(placeholder, groupDrag.footprintLayout, {
            ...groupBoxBounds(groupDrag.groupBox),
            col: nextCell.col,
            row: nextCell.row,
          });
          resolveSparseGridLayout(layout, placeholder, nextCell, { afterOnly: true, metrics, localVacancy, items: reflowItems });
        } else {
          resolveSparseGridLayout(layout, placeholder, nextCell, {
            afterOnly: true,
            metrics,
            localVacancy,
            verticalDisplacement: expandedPanelDrag,
            items: reflowItems,
          });
        }
      }, item, { items: reflowItems, metrics });
    };

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < threshold) return;
      startDrag();
      moveEvent.preventDefault();
      lastMoveEvent = moveEvent;
      autoScroll.update(moveEvent);
      const panelEntryMotion = panelEntryMotionFor(moveEvent);
      const currentMetrics = refreshGridMetricsRect(dragMetrics);
      const gridRect = currentMetrics?.rect || gridRectForLayout(layout);
      const dragRect = groupLive?.groupRect || rect;
      const minLeft = gridRect.left;
      const maxLeft = Math.max(minLeft, gridRect.right - dragRect.width);
      const rawLeft = moveEvent.clientX - offsetX;
      const rawTop = moveEvent.clientY - offsetY;
      const scrollingTowardTop = moveEvent.clientY < 104 && (window.scrollY || document.documentElement.scrollTop || 0) > 0;
      const minTop = scrollingTowardTop ? Math.min(rawTop, 0, gridRect.top) : Math.max(0, gridRect.top);
      const visibleBottom = Math.max(gridRect.bottom, window.innerHeight - 16);
      const maxTop = Math.max(minTop, visibleBottom - Math.min(dragRect.height, window.innerHeight - 32));
      const isPanelLocalDirectDrag = isPanelInternalWidgetLayout(layout) && !groupDrag;
      const nextLeft = isPanelLocalDirectDrag ? rawLeft : Math.max(minLeft, Math.min(maxLeft, rawLeft));
      const nextTop = isPanelLocalDirectDrag ? rawTop : Math.max(minTop, Math.min(maxTop, rawTop));
      if (groupDrag && groupLive) {
        groupLive.update(nextLeft, nextTop);
      } else {
        item.style.left = `${Math.round(nextLeft)}px`;
        item.style.top = `${Math.round(nextTop)}px`;
      }
      if (!groupDrag && expandedFootprintGhost) {
        updateExpandedFootprintGhost(expandedFootprintGhost, item, layout, {
          left: nextLeft,
          top: nextTop,
          width: rect.width,
        });
      }
      if (updatePanelDragPreview(moveEvent, panelEntryMotion)) {
        return;
      }
      if (updatePanelExitPreview(moveEvent)) {
        return;
      }
      const previewRect = groupDrag && groupLive
        ? { left: nextLeft, top: nextTop, width: dragRect.width, height: dragRect.height }
        : item.getBoundingClientRect();
      if (isPanelLocalDirectDrag) {
        movePreview(moveEvent.clientX, moveEvent.clientY, currentMetrics, { preservePointerOffset: true });
      } else {
        movePreview(previewRect.left + (previewRect.width / 2), previewRect.top + (previewRect.height / 2), currentMetrics);
      }
    };

    const removeListeners = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("keydown", onKeydown);
      window.removeEventListener("blur", onWindowBlur);
      pointerTarget?.removeEventListener?.("lostpointercapture", onLostPointerCapture);
    };

    const releasePointer = () => {
      if (pointerId == null || !pointerTarget?.hasPointerCapture?.(pointerId)) return;
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already be released by the browser during cancel.
      }
    };

    const onUp = (upEvent) => {
      if (ended) return;
      ended = true;
      const canceled = upEvent?.type === "pointercancel";
      const releaseScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const releaseUsedExtendedWorkspace = dragging && placeholder && !canceled && document.body.classList.contains("dashboard-interaction-scroll-extended");
      let committedExtendedWorkspaceScrollY = null;
      autoScroll.stop({ preserveExtension: dragging && placeholder && !canceled });
      removeListeners();
      releasePointer();
      document.body.classList.remove("panel-interaction-active");
      document.body.classList.remove("panel-resize-active");
      try {
        if (dragging && placeholder) {
          const releaseItemRect = item.getBoundingClientRect();
          if (!groupDrag) {
            item.classList.remove(draggingClass);
            item.style.left = "";
            item.style.top = "";
            item.style.width = "";
            if (item.classList.contains("db-panel")) item.style.height = "";
          }
          expandedFootprintGhost?.remove();
          expandedFootprintGhost = null;
          if (canceled) {
            clearPanelDragPreview();
            clearPanelExitPreview();
            restoreGridLayoutSnapshot(startSnapshot);
            placeholder.remove();
            groupLive?.clear();
            onCancel?.();
          } else {
            const releasePanel = panelDrag
              ? panelEntryCandidateAt(upEvent?.clientX ?? lastMoveEvent?.clientX ?? startX, upEvent?.clientY ?? lastMoveEvent?.clientY ?? startY, item, { snapshot: startSnapshot })?.panel
              : null;
            const activePanelDrag = panelDrag && releasePanel === panelDrag.panel ? panelDrag : null;
            if (panelDrag && !activePanelDrag) clearPanelDragPreview();
            const activePanelExitDrag = panelExitDrag;
            const finalCell = activePanelDrag
              ? {
                col: Number(activePanelDrag.placeholder.dataset.gridCol) || Number(activePanelDrag.targetCell?.col) || 1,
                row: Number(activePanelDrag.placeholder.dataset.gridRow) || Number(activePanelDrag.targetCell?.row) || 1,
              }
              : activePanelExitDrag
                ? {
                  col: Number(activePanelExitDrag.placeholder.dataset.gridCol) || Number(activePanelExitDrag.targetCell?.col) || 1,
                  row: Number(activePanelExitDrag.placeholder.dataset.gridRow) || Number(activePanelExitDrag.targetCell?.row) || 1,
                }
              : {
                col: Number(placeholder.dataset.gridCol) || originalCell.col,
                row: Number(placeholder.dataset.gridRow) || originalCell.row,
              };
            let result;
            if (activePanelDrag) {
              clearPanelExitPreview();
              clearPanelDragPreview({ restore: false });
              restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
              placeholder.remove();
              const absorbed = absorbWidgetIntoPanel({
                widget: item,
                sourceLayout: layout,
                panel: activePanelDrag.panel,
                clientX: upEvent?.clientX ?? lastMoveEvent?.clientX ?? startX,
                clientY: upEvent?.clientY ?? lastMoveEvent?.clientY ?? startY,
                fromRect: releaseItemRect,
                targetCell: finalCell,
              });
              result = absorbed
                ? { bounds: gridBoundsForItem(absorbed), movedItems: 1, absorbed: true }
                : { bounds: boundsAtGridSlot(item, originalCell.col, originalCell.row), movedItems: 0, absorbed: false };
              if (!absorbed) onCancel?.();
            } else if (activePanelExitDrag) {
              clearPanelExitPreview({ restore: false });
              restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
              placeholder.remove();
              restoreGridLayoutSnapshot(activePanelExitDrag.snapshot, { exclude: [activePanelExitDrag.placeholder] });
              const extracted = extractPanelChildWidgetToWorkspace({
                widget: item,
                sourceLayout: layout,
                targetLayout: activePanelExitDrag.layout,
                panel: activePanelExitDrag.panel,
                fromRect: releaseItemRect,
                targetCell: finalCell,
              });
              result = extracted
                ? { bounds: extracted.bounds, movedItems: extracted.movedItems + 1, extracted: true }
                : { bounds: boundsAtGridSlot(item, originalCell.col, originalCell.row), movedItems: 0, extracted: false };
              if (!extracted) onCancel?.();
            } else if (groupDrag) {
              clearPanelExitPreview();
              restoreGridLayoutSnapshot(startSnapshot);
              const localVacancy = groupBoxBounds(groupDrag.groupBox);
              applyGroupFootprintBounds(placeholder, groupDrag.footprintLayout, {
                ...groupBoxBounds(groupDrag.groupBox),
                col: finalCell.col,
                row: finalCell.row,
              });
              resolveSparseGridLayout(layout, placeholder, finalCell, { afterOnly: true, metrics: dragMetrics, localVacancy, items: reflowItems });
              const resolvedCell = {
                col: Number(placeholder.dataset.gridCol) || finalCell.col,
                row: Number(placeholder.dataset.gridRow) || finalCell.row,
              };
              const delta = {
                deltaCol: resolvedCell.col - groupDrag.groupBox.col,
                deltaRow: resolvedCell.row - groupDrag.groupBox.row,
              };
              applyGroupDelta(
                groupDrag.items.map((groupItem) => ({
                  item: groupItem,
                  sourceItem: groupItem,
                  startBounds: groupDrag.startBounds.get(groupItem),
                })).filter((entry) => entry.startBounds),
                delta
              );
              placeholder.remove();
              groupLive?.clear();
              result = {
                bounds: boundsAtGridSlot(item, (groupDrag.startBounds.get(item)?.col || originalCell.col) + delta.deltaCol, (groupDrag.startBounds.get(item)?.row || originalCell.row) + delta.deltaRow),
                movedItems: groupDrag.items.length - 1,
              };
            } else {
              clearPanelExitPreview();
              restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
              placeholder.remove();
              const expandedPanelDrag = workspaceObjectCapabilities(item).hasExpandedFootprint && !item.classList.contains("db-panel-collapsed");
              const localVacancy = expandedPanelDrag ? null : boundsAtGridSlot(item, originalCell.col, originalCell.row, dragMetrics);
              result = expandedPanelDrag
                ? commitExpandedPanelDropSlot(layout, item, finalCell, { localVacancy })
                : commitActiveDropSlot(layout, item, finalCell, { localVacancy });
            }
            const finalBounds = result.bounds;
            committedExtendedWorkspaceScrollY = releaseUsedExtendedWorkspace ? releaseScrollY : null;
            syncCommittedWorkspaceScrollFloor(layout, {
              preserveViewport: committedExtendedWorkspaceScrollY !== null,
              scrollY: committedExtendedWorkspaceScrollY,
            });
            if (result.absorbed === false) {
              // The attempted panel commit failed and onCancel has already restored callers.
            } else if (result.extracted === false) {
              // The attempted panel exit commit failed and onCancel has already restored callers.
            } else {
              onCommit?.({ moved: result.absorbed || result.extracted || finalBounds.col !== originalCell.col || finalBounds.row !== originalCell.row || result.movedItems > 0 });
            }
          }
        }
      } finally {
        autoScroll.clearExtension();
        if (committedExtendedWorkspaceScrollY !== null) {
          syncCommittedWorkspaceScrollFloor(layout, {
            preserveViewport: true,
            scrollY: committedExtendedWorkspaceScrollY,
          });
        }
      }
      if (groupDrag) {
        groupDrag.items.forEach((groupItem) => groupItem.classList.remove("group-transform-member"));
        document.body.classList.remove("group-transform-active");
      }
      scheduleWorkspaceVisualLodRefresh(gridHostForLayout(layout));
      onEnd?.(dragging);
    };

    const onKeydown = (keyEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      onUp({ type: "pointercancel" });
    };

    const onWindowBlur = () => {
      onUp({ type: "pointercancel" });
    };

    const onLostPointerCapture = (captureEvent) => {
      if (captureEvent.pointerId !== pointerId) return;
      onUp({ type: "pointercancel" });
    };

    try {
      if (pointerId != null) pointerTarget?.setPointerCapture?.(pointerId);
    } catch {
      // Document-level listeners still cover browsers that decline capture.
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("blur", onWindowBlur);
    pointerTarget?.addEventListener?.("lostpointercapture", onLostPointerCapture);
  };

  const widgetSpacerSiblingsBefore = (widget) => {
    const spacers = [];
    let cursor = widget.previousElementSibling;
    while (cursor?.classList?.contains("widget-spacer")) {
      spacers.unshift(cursor);
      cursor = cursor.previousElementSibling;
    }
    return spacers;
  };

  const widgetHasRowBreakBefore = (widget) => {
    let cursor = widget.previousElementSibling;
    while (cursor?.classList?.contains("widget-spacer")) cursor = cursor.previousElementSibling;
    return Boolean(cursor?.classList?.contains("widget-row-break"));
  };

  const alignedResizeHeight = ({ layout, item, currentHeight, metrics = null }) => {
    const rect = item.getBoundingClientRect();
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const tolerance = 18;
    const candidates = [{ edge: layoutRect.bottom, priority: 1 }];
    document.querySelectorAll(".widget-layout > .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])").forEach((target) => {
      if (target === item) return;
      if (gridHostForLayout(layout) !== layout && isPanelInternalGridItem(target)) return;
      const targetRect = target.getBoundingClientRect();
      candidates.push({ edge: targetRect.bottom, priority: 2 });
      candidates.push({ edge: targetRect.top, priority: 3 });
    });
    const match = candidates
      .map((candidate) => ({
        ...candidate,
        distance: Math.abs(rect.bottom - candidate.edge),
      }))
      .filter((candidate) => candidate.distance <= tolerance && candidate.edge > rect.top + 40)
      .sort((a, b) => a.distance - b.distance || a.priority - b.priority)[0];
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const nextHeight = match ? Math.max(getPanelMinimumHeight(item), Math.round(match.edge - rect.top)) : currentHeight;
    return gridHeightForRows(gridRowsFromHeight(nextHeight, gap, panelMinimumRows(item, metrics)), gap);
  };

  const groupGridBox = (boundsList) => ({
    col: Math.min(...boundsList.map((bounds) => bounds.col)),
    row: Math.min(...boundsList.map((bounds) => bounds.row)),
    right: Math.max(...boundsList.map((bounds) => bounds.right)),
    bottom: Math.max(...boundsList.map((bounds) => bounds.bottom)),
  });

  const groupFootprintLayout = (layout) => {
    const host = gridHostForLayout(layout);
    const key = gridItemLayoutKey(layout);
    return host?.querySelector?.(`.panel-layout[data-layout-key="${CSS.escape(key)}"]`) || layout;
  };

  const groupBoxBounds = (groupBox, col = groupBox.col, row = groupBox.row) => ({
    col,
    row,
    span: Math.max(1, groupBox.right - groupBox.col + 1),
    rowSpan: Math.max(1, groupBox.bottom - groupBox.row + 1),
  });

  const applyGroupFootprintBounds = (footprint, layout, bounds, metrics = null) => {
    const span = Math.max(1, Math.min(DASHBOARD_GRID_COLUMNS, Math.round(Number(bounds.span) || 1)));
    const rowSpan = Math.max(1, Math.round(Number(bounds.rowSpan) || 1));
    const col = Math.max(1, Math.min(DASHBOARD_GRID_COLUMNS - span + 1, Math.round(Number(bounds.col) || 1)));
    const row = Math.max(1, Math.round(Number(bounds.row) || 1));
    footprint.dataset.currentSpan = String(span);
    footprint.dataset.defaultSpan = String(span);
    footprint.dataset.gridRowSpan = String(rowSpan);
    footprint.dataset.gridCol = String(col);
    footprint.dataset.gridRow = String(row);
    footprint.style.gridColumn = `${col} / span ${span}`;
    footprint.style.gridRow = `${row} / span ${rowSpan}`;
    footprint.style.height = `${gridHeightForRows(rowSpan, metrics?.gap ?? gridGapForLayout(layout))}px`;
  };

  const groupResizePanelRowSpan = (start, groupBox, scaleY, minRows = 1) => {
    const relRow = Math.max(0, start.row - groupBox.row);
    const relBottomExclusive = relRow + Math.max(1, start.rowSpan);
    const scaledSizeRows = Math.round(start.rowSpan * scaleY);
    const scaledBottomRows = Math.floor(relBottomExclusive * scaleY) - relRow;
    return Math.max(minRows, scaledSizeRows, scaledBottomRows, 1);
  };

  const groupResizeCollapsedPanelExpandedRows = (panel, start, groupBox, scaleY, layout, metrics = null) => {
    const minRows = panelExpandedMinimumRows(panel, layout, metrics);
    const expandedRows = expandedPanelFootprintRows(panel, layout, null, metrics);
    return groupResizePanelRowSpan(
      {
        ...start,
        rowSpan: expandedRows,
        bottom: start.row + expandedRows - 1,
      },
      groupBox,
      scaleY,
      minRows
    );
  };

  const groupResizeWidgetRowSpan = (start, groupBox, scaleY, minRows = 1) => {
    const relRow = Math.max(0, start.row - groupBox.row);
    const relBottomExclusive = relRow + Math.max(1, start.rowSpan);
    const scaledSizeRows = Math.round(start.rowSpan * scaleY);
    const scaledBottomRows = Math.floor(relBottomExclusive * scaleY) - relRow;
    return Math.max(minRows, scaledSizeRows, scaledBottomRows, 1);
  };

  const commitGroupResizeFromPreviews = (entries, layout) => {
    entries.forEach((entry) => {
      const { member, preview } = entry;
      const col = Number(preview.dataset.gridCol) || Number(member.dataset.gridCol) || 1;
      const row = Number(preview.dataset.gridRow) || Number(member.dataset.gridRow) || 1;
      const span = Number(preview.dataset.currentSpan) || Number(preview.dataset.defaultSpan) || Number(member.dataset.currentSpan) || 1;
      const rowSpan = Math.max(gridItemMinimumRows(member), Number(preview.dataset.gridRowSpan) || 1);
      if (isWidgetGridItem(member)) {
        applyWidgetSpan(member, span);
        applyWidgetGridPosition(member, col, row, rowSpan);
        return;
      }
      applyPanelSpan(member, span);
      if (member.classList.contains("db-panel-collapsed")) {
        const memberLayout = groupItemLayout(member) || layout;
        const expandedRows = Math.max(
          panelExpandedMinimumRows(member, memberLayout),
          Number(preview.dataset.expandedGridRowSpan) || expandedPanelFootprintRows(member, memberLayout)
        );
        const expandedHeight = gridHeightForRows(expandedRows, gridGapForLayout(memberLayout));
        member.dataset.savedHeight = String(expandedHeight);
        member.dataset.gridRowSpan = "1";
        member.style.height = "";
      } else {
        const memberLayout = groupItemLayout(member) || layout;
        applyPanelHeight(member, gridHeightForRows(rowSpan, gridGapForLayout(memberLayout)));
      }
      applyPanelGridPosition(member, col, row);
    });
  };

  const createGroupFootprint = (layout, groupBox, className = "") => {
    const footprintLayout = groupFootprintLayout(layout);
    const footprint = document.createElement("div");
    footprint.className = `db-panel-placeholder dashboard-group-footprint ${className}`.trim();
    footprint.setAttribute("aria-hidden", "true");
    applyGroupFootprintBounds(footprint, footprintLayout, groupBoxBounds(groupBox));
    footprintLayout.appendChild(footprint);
    return { footprint, footprintLayout };
  };

  const beginGroupLiveSurfaces = (members) => {
    const rects = new Map(members.map((member) => [member, member.getBoundingClientRect()]));
    const groupRect = [...rects.values()].reduce((box, rect) => ({
      left: Math.min(box.left, rect.left),
      top: Math.min(box.top, rect.top),
      right: Math.max(box.right, rect.right),
      bottom: Math.max(box.bottom, rect.bottom),
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    groupRect.width = Math.max(1, groupRect.right - groupRect.left);
    groupRect.height = Math.max(1, groupRect.bottom - groupRect.top);
    const shell = createGroupBoundarySurface("dashboard-group-live-shell");
    updateGroupBoundarySurface(shell, groupRect);
    const entries = members.map((member) => {
      const rect = rects.get(member);
      const live = member.cloneNode(true);
      live.classList.add("dashboard-group-live-member");
      live.classList.remove("dashboard-active-resize", "db-panel-dragging", "widget-dragging");
      live.setAttribute("aria-hidden", "true");
      live.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      member.classList.add("dashboard-group-source");
      document.body.appendChild(live);
      updateLiveResizeSurface(live, rect.width, rect.height, rect.left, rect.top);
      return { member, live, rect };
    });
    const update = (left, top) => {
      updateGroupBoundarySurface(shell, {
        left,
        top,
        width: groupRect.width,
        height: groupRect.height,
      });
      entries.forEach((entry) => {
        updateLiveResizeSurface(
          entry.live,
          entry.rect.width,
          entry.rect.height,
          left + (entry.rect.left - groupRect.left),
          top + (entry.rect.top - groupRect.top)
        );
      });
    };
    const clear = () => {
      shell.remove();
      entries.forEach((entry) => {
        entry.live.remove();
        entry.member.classList.remove("dashboard-group-source");
      });
    };
    return { groupRect, entries, update, clear };
  };

  const applyGroupResizeLayout = (layout, members, startBounds, groupBox, scaleX, scaleY, options = {}) => {
    const sourceForMember = options.sourceForMember || new Map();
    const sourceItemFor = (member) => sourceForMember.get(member) || member;
    const gap = gridGapForLayout(layout);
    const width = Math.max(1, groupBox.right - groupBox.col + 1);
    const height = Math.max(1, groupBox.bottom - groupBox.row + 1);
    const minScaleX = Math.max(...members.map((member) => gridItemMinimumSpan(sourceItemFor(member)) / Math.max(1, startBounds.get(member).span)));
    const minScaleY = Math.max(...members.map((member) => {
      const bounds = startBounds.get(member);
      const sourceItem = sourceItemFor(member);
      if (isWidgetGridItem(sourceItem)) return gridItemMinimumRows(sourceItem) / Math.max(1, bounds.rowSpan);
      return panelMinimumRows(sourceItem) / Math.max(1, bounds.rowSpan);
    }));
    const maxScaleX = (DASHBOARD_GRID_COLUMNS - groupBox.col + 1) / width;
    const safeScaleX = Math.max(minScaleX, Math.min(maxScaleX, scaleX));
    const safeScaleY = Math.max(minScaleY, scaleY);
    const occupied = options.collision === false
      ? []
      : externalOccupiedForGroup(layout, members.concat(options.excludeFromCollision || []));
    const nearestSizedSlot = (desired) => {
      const maxCol = DASHBOARD_GRID_COLUMNS - desired.span + 1;
      const limit = Math.max(desired.row + 48, ...occupied.map((entry) => entry.bounds.bottom + 24), desired.bottom + 24);
      let best = null;
      for (let row = 1; row <= limit; row += 1) {
        for (let col = 1; col <= maxCol; col += 1) {
          const candidate = {
            ...desired,
            col,
            row,
            right: col + desired.span - 1,
            bottom: row + desired.rowSpan - 1,
          };
          if (!canPlaceBounds(candidate, occupied)) continue;
          const score = (Math.abs(row - desired.row) * DASHBOARD_GRID_COLUMNS) + Math.abs(col - desired.col) + (row < desired.row ? .7 : 0);
          if (!best || score < best.score || (score === best.score && row < best.bounds.row) || (score === best.score && row === best.bounds.row && col < best.bounds.col)) {
            best = { bounds: candidate, score };
          }
        }
      }
      return best?.bounds || desired;
    };

    visualGridOrder(members).forEach((member) => {
      const sourceItem = sourceItemFor(member);
      const start = startBounds.get(member);
      const relCol = start.col - groupBox.col;
      const relRow = start.row - groupBox.row;
      const nextSpan = Math.max(gridItemMinimumSpan(sourceItem), Math.min(6, Math.round(start.span * safeScaleX)));
      const maxCol = DASHBOARD_GRID_COLUMNS - nextSpan + 1;
      let nextCol = groupBox.col + Math.round(relCol * safeScaleX);
      nextCol = Math.max(1, Math.min(maxCol, nextCol));
      let nextRow = Math.max(1, groupBox.row + relRow);
      let nextRowSpan = isWidgetGridItem(sourceItem)
        ? groupResizeWidgetRowSpan(start, groupBox, safeScaleY, gridItemMinimumRows(sourceItem))
        : groupResizePanelRowSpan(start, groupBox, safeScaleY, panelMinimumRows(sourceItem));
      let desired = {
        col: nextCol,
        row: nextRow,
        span: nextSpan,
        rowSpan: nextRowSpan,
        right: nextCol + nextSpan - 1,
        bottom: nextRow + nextRowSpan - 1,
      };
      if (!canPlaceBounds(desired, occupied)) {
        desired = nearestSizedSlot(desired);
        nextCol = desired.col;
        nextRow = desired.row;
        nextRowSpan = desired.rowSpan;
      }

      if (isWidgetGridItem(sourceItem)) {
        applyWidgetSpan(member, nextSpan);
        applyWidgetGridPosition(member, nextCol, nextRow, nextRowSpan);
        if (member.classList.contains("widget-placeholder")) {
          member.style.height = `${gridHeightForRows(nextRowSpan, gridGapForLayout(groupItemLayout(member) || layout) || gap)}px`;
        }
      } else {
        applyPanelSpan(member, nextSpan);
        if (sourceItem.classList.contains("db-panel-collapsed")) {
          const memberLayout = groupItemLayout(member) || layout;
          const memberMetrics = options.metricsForMember?.get?.(member) || null;
          const expandedRows = groupResizeCollapsedPanelExpandedRows(
            sourceItem,
            start,
            groupBox,
            safeScaleY,
            groupItemLayout(sourceItem) || layout,
            memberMetrics
          );
          const memberGap = gridGapForLayout(memberLayout) || gap;
          member.dataset.gridRowSpan = "1";
          member.dataset.expandedGridRowSpan = String(expandedRows);
          member.dataset.savedHeight = String(gridHeightForRows(expandedRows, memberGap));
          member.style.height = "";
        } else {
          const memberGap = gridGapForLayout(groupItemLayout(member) || layout) || gap;
          const nextHeight = gridHeightForRows(nextRowSpan, memberGap);
          if (member.classList.contains("db-panel-placeholder")) {
            member.dataset.gridRowSpan = String(nextRowSpan);
            member.dataset.savedHeight = String(nextHeight);
            member.style.height = `${nextHeight}px`;
          } else {
            applyPanelHeight(member, nextHeight);
          }
        }
        applyPanelGridPosition(member, nextCol, nextRow);
      }
      occupied.push({ item: member, bounds: gridBoundsForItem(member) });
    });
  };

  const runGroupResize = ({ layout, source, event, onCommit, onEnd }) => {
    const members = groupTransformItems(source)
      .filter((member) => member === source || !member.classList.contains("db-panel-pinned"))
      .filter((member) => member.dataset.locked !== "true" && member.dataset.resizable !== "false");
    if (members.length < 2) return false;

    event.preventDefault();
    event.stopPropagation();
    document.body.classList.add("panel-interaction-active");
    document.body.classList.add("panel-resize-active");
    document.body.classList.add("group-transform-active");
    members.forEach((member) => member.classList.add("group-transform-member"));
    source.classList.add("dashboard-active-resize");
    closeInactiveDashboardTools(source);
    window.getSelection?.()?.removeAllRanges();

    const gridMetricsByLayout = new Map();
    const metricsForLayout = (targetLayout) => {
      if (!gridMetricsByLayout.has(targetLayout)) {
        gridMetricsByLayout.set(targetLayout, createGridMetrics(targetLayout));
      }
      return gridMetricsByLayout.get(targetLayout);
    };
    const startX = event.clientX;
    const startY = event.clientY;
    const layoutMetrics = metricsForLayout(layout);
    const gap = layoutMetrics.gap;
    const startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const layoutRect = layoutMetrics.rect;
    const columnWidth = (Math.max(1, layoutRect.width) - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS;
    const columnStep = Math.max(1, columnWidth + gap);
    const rowStep = DASHBOARD_GRID_ROW_HEIGHT + gap;
    const resizeStartSnapshot = snapshotGridLayout(layout);
    const startRects = new Map(members.map((member) => [member, member.getBoundingClientRect()]));
    const startBounds = new Map(members.map((member) => [member, gridBoundsForItem(member)]));
    const groupBox = groupGridBox([...startBounds.values()]);
    const startWidth = Math.max(1, groupBox.right - groupBox.col + 1);
    const startHeight = Math.max(1, groupBox.bottom - groupBox.row + 1);
    const groupStartRect = [...startRects.values()].reduce((box, rect) => ({
      left: Math.min(box.left, rect.left),
      top: Math.min(box.top, rect.top),
      right: Math.max(box.right, rect.right),
      bottom: Math.max(box.bottom, rect.bottom),
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    groupStartRect.width = Math.max(1, groupStartRect.right - groupStartRect.left);
    groupStartRect.height = Math.max(1, groupStartRect.bottom - groupStartRect.top);
    const resizeBoundary = createGroupBoundarySurface("dashboard-group-resize-boundary");
    updateGroupBoundarySurface(resizeBoundary, groupStartRect);
    const liveMinScaleX = Math.max(...members.map((member) => gridItemMinimumSpan(member) / Math.max(1, startBounds.get(member).span)));
    const liveMinScaleY = Math.max(...members.map((member) => (
      isWidgetGridItem(member)
        ? gridItemMinimumRows(member) / Math.max(1, startBounds.get(member).rowSpan)
        : panelMinimumRows(member) / Math.max(1, startBounds.get(member).rowSpan)
    )));
    const liveMaxScaleX = (DASHBOARD_GRID_COLUMNS - groupBox.col + 1) / startWidth;
    const previewEntries = members.map((member) => {
      const memberLayout = groupItemLayout(member) || layout;
      const memberMetrics = metricsForLayout(memberLayout);
      const rect = startRects.get(member);
      const preview = createResizePreview(
        memberLayout,
        member,
        isWidgetGridItem(member) ? "widget-placeholder" : "db-panel-placeholder",
        rect,
        memberMetrics
      );
      preview.classList.add("dashboard-group-member-preview");
      if (member.classList.contains("db-panel-collapsed")) {
        preview.classList.add("db-panel-collapsed");
        preview.dataset.gridRowSpan = "1";
        preview.style.height = `${gridHeightForRows(1, memberMetrics.gap)}px`;
      }
      const live = beginLiveResizeSurface(member, rect);
      const expandedGhost = createExpandedFootprintGhost(member, memberLayout, rect, null, memberMetrics);
      return { member, memberLayout, memberMetrics, preview, live, expandedGhost, rect };
    });
    const previewMembers = previewEntries.map((entry) => entry.preview);
    const previewStartBounds = new Map(previewEntries.map((entry) => [entry.preview, startBounds.get(entry.member)]));
    const sourceForPreview = new Map(previewEntries.map((entry) => [entry.preview, entry.member]));
    const metricsForPreview = new Map(previewEntries.map((entry) => [entry.preview, entry.memberMetrics]));
    const groupFootprint = createGroupFootprint(layout, groupBox, "dashboard-resize-preview dashboard-group-resize-footprint");
    const memberSet = new Set(members);
    const reflowItems = reflowItemsForLayout(layout, source).filter((item) => !memberSet.has(item));
    let previewCols = startWidth;
    let previewRows = startHeight;

    const updateLiveGroupResize = (clientX, clientY) => {
      const scrollDeltaY = (window.scrollY || document.documentElement.scrollTop || 0) - startScrollY;
      const effectiveClientY = clientY + scrollDeltaY;
      const rawCols = Math.max(1, startWidth + ((clientX - startX) / columnStep));
      const rawRows = Math.max(1, startHeight + ((effectiveClientY - startY) / rowStep));
      const scaleX = Math.max(liveMinScaleX, Math.min(liveMaxScaleX, rawCols / startWidth));
      const scaleY = Math.max(liveMinScaleY, rawRows / startHeight);
      const liveBounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      previewEntries.forEach((entry) => {
        const startRect = entry.rect;
        const left = groupStartRect.left + ((startRect.left - groupStartRect.left) * scaleX);
        const top = groupStartRect.top - scrollDeltaY + (startRect.top - groupStartRect.top);
        const width = Math.max(gridItemPixelWidthForSpan(entry.memberLayout, gridItemMinimumSpan(entry.member), entry.memberMetrics), startRect.width * scaleX);
        const liveRows = isWidgetGridItem(entry.member)
          ? groupResizeWidgetRowSpan(
            startBounds.get(entry.member),
            groupBox,
            scaleY,
            gridItemMinimumRows(entry.member)
          )
          : entry.member.classList.contains("db-panel-collapsed")
            ? 1
            : groupResizePanelRowSpan(
            startBounds.get(entry.member),
            groupBox,
            scaleY,
            panelMinimumRows(entry.member, entry.memberMetrics)
          );
        const height = isWidgetGridItem(entry.member)
          ? gridHeightForRows(liveRows, entry.memberMetrics.gap)
          : entry.member.classList.contains("db-panel-collapsed")
            ? startRect.height
            : Math.max(getPanelMinimumHeight(entry.member), gridHeightForRows(liveRows, entry.memberMetrics.gap));
        updateLiveResizeSurface(entry.live, width, height, left, top);
        liveBounds.left = Math.min(liveBounds.left, left);
        liveBounds.top = Math.min(liveBounds.top, top);
        liveBounds.right = Math.max(liveBounds.right, left + width);
        liveBounds.bottom = Math.max(liveBounds.bottom, top + height);
        if (entry.expandedGhost) {
          const ghostRows = entry.member.classList.contains("db-panel-collapsed")
            ? groupResizeCollapsedPanelExpandedRows(
              entry.member,
              startBounds.get(entry.member),
              groupBox,
              scaleY,
              entry.memberLayout,
              entry.memberMetrics
            )
            : Math.max(
              expandedPanelFootprintRows(entry.member, entry.memberLayout, null, entry.memberMetrics),
              Math.round(startBounds.get(entry.member).rowSpan * scaleY)
            );
          updateExpandedFootprintGhost(entry.expandedGhost, entry.member, entry.memberLayout, {
            left,
            top,
            width,
            rows: ghostRows,
          }, entry.memberMetrics);
        }
      });
      updateGroupBoundarySurface(resizeBoundary, {
        left: liveBounds.left,
        top: liveBounds.top,
        width: Math.max(1, liveBounds.right - liveBounds.left),
        height: Math.max(1, liveBounds.bottom - liveBounds.top),
      });
    };

    const applyFromPointer = (clientX, clientY) => {
      updateLiveGroupResize(clientX, clientY);
      const scrollDeltaY = (window.scrollY || document.documentElement.scrollTop || 0) - startScrollY;
      const effectiveClientY = clientY + scrollDeltaY;
      const nextCols = Math.max(1, startWidth + Math.round((clientX - startX) / columnStep));
      const nextRows = Math.max(1, startHeight + Math.round((effectiveClientY - startY) / rowStep));
      if (nextCols === previewCols && nextRows === previewRows) return;
      previewCols = nextCols;
      previewRows = nextRows;
      animateOrderedGridReflow(layout, () => {
        applyGroupFootprintBounds(groupFootprint.footprint, groupFootprint.footprintLayout, {
          col: groupBox.col,
          row: groupBox.row,
          span: nextCols,
          rowSpan: nextRows,
        }, metricsForLayout(groupFootprint.footprintLayout));
        applyGroupResizeLayout(layout, previewMembers, previewStartBounds, groupBox, nextCols / startWidth, nextRows / startHeight, {
          sourceForMember: sourceForPreview,
          metricsForMember: metricsForPreview,
          collision: false,
        });
        resolveSparseGridLayoutForActiveItems(layout, previewMembers, {
          afterOnly: true,
          metrics: layoutMetrics,
          exclude: [groupFootprint.footprint],
          items: reflowItems,
        });
      }, source, { items: reflowItems, metrics: layoutMetrics });
    };

    const finishResize = (upEvent, canceled) => {
      if (canceled) {
        restoreGridLayoutSnapshot(resizeStartSnapshot);
      } else {
        animateOrderedGridReflow(layout, () => {
          previewEntries.forEach((entry) => entry.expandedGhost?.remove());
          restoreGridLayoutSnapshot(resizeStartSnapshot);
          applyGroupFootprintBounds(groupFootprint.footprint, groupFootprint.footprintLayout, {
            col: groupBox.col,
            row: groupBox.row,
            span: previewCols,
            rowSpan: previewRows,
          }, metricsForLayout(groupFootprint.footprintLayout));
          applyGroupResizeLayout(layout, previewMembers, previewStartBounds, groupBox, previewCols / startWidth, previewRows / startHeight, {
            sourceForMember: sourceForPreview,
            metricsForMember: metricsForPreview,
            collision: false,
          });
          resolveSparseGridLayoutForActiveItems(layout, previewMembers, {
            afterOnly: true,
            metrics: layoutMetrics,
            exclude: [groupFootprint.footprint],
            items: reflowItems,
          });
          commitGroupResizeFromPreviews(previewEntries, layout);
          previewEntries.forEach((entry) => entry.preview.remove());
          groupFootprint.footprint.remove();
          previewEntries.forEach((entry) => clearLiveResizeSurface(entry.member, entry.live));
        }, source, { items: reflowItems, metrics: layoutMetrics });
        syncCommittedWorkspaceScrollFloor(layout, {
          preserveViewport: document.body.classList.contains("dashboard-interaction-scroll-extended"),
        });
        onCommit?.();
      }
    };
    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      applyFromPointer(moveEvent.clientX, moveEvent.clientY);
    };

    beginResizeLifecycle({
      event,
      source,
      layout,
      onMove,
      onEnd: finishResize,
      onCleanup: () => {
        previewEntries.forEach((entry) => entry.preview.remove());
        previewEntries.forEach((entry) => clearLiveResizeSurface(entry.member, entry.live));
        previewEntries.forEach((entry) => entry.expandedGhost?.remove());
        resizeBoundary.remove();
        groupFootprint.footprint.remove();
        document.body.classList.remove("group-transform-active");
        members.forEach((member) => member.classList.remove("group-transform-member"));
        onEnd?.();
      },
    });
    return true;
  };

  const saveWidgetLayouts = (layout, profile = getActivePanelProfile(layout.dataset.widgetLayoutKey || "default"), options = {}) => {
    if (isPanelInternalWidgetLayout(layout)) {
      const panel = panelForInternalWidgetLayout(layout);
      const panelLayout = panel?.closest?.(".panel-layout");
      if (!panel || !panelLayout) return;
      updatePanelChildEmptyState(panel);
      savePanelLayouts(panelLayout, getActivePanelProfile(panelLayout.dataset.layoutKey || "default"), options);
      return;
    }
    const layoutKey = layout.dataset.widgetLayoutKey || "default";
    const persist = Boolean(options.persist);
    syncWorkspaceRegions(layout);
    if (!persist) {
      if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
      return;
    }
    captureLayoutUndo(layoutKey, profile);
    const expansionBaselineSnapshot = expansionBaselineSnapshotForLayoutKey(layoutKey);
    [...layout.querySelectorAll(":scope > .widget-card:not(.workspace-anchor-object):not([hidden])")].forEach((widget, index) => {
      const key = widget.dataset.widgetKey;
      const expansionBaseline = serializableExpansionBaselineState(expansionBaselineSnapshot, widget);
      if (!key) return;
      try {
        localStorage.setItem(widgetStorageKey(layoutKey, key, profile), JSON.stringify({
          order: index,
          span: Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 3,
          gridCol: Number(widget.dataset.gridCol) || null,
          gridRow: Number(widget.dataset.gridRow) || null,
          rowSpan: Number(widget.dataset.gridRowSpan) || 1,
          color: widget.dataset.panelColor || null,
          title: widget.dataset.panelTitle || null,
          pinned: widget.classList.contains("db-panel-pinned"),
          type: widget.dataset.widgetType || null,
          runtimeType: widget.dataset.widgetRuntimeType || widget.dataset.widgetDefinition || null,
          minW: Number(widget.dataset.minW) || null,
          minH: Number(widget.dataset.minH) || null,
          locked: widget.dataset.locked === "true",
          resizable: widget.dataset.resizable === "false" ? false : true,
          config: widget.dataset.widgetConfig || null,
          breakBefore: widgetHasRowBreakBefore(widget),
          spacerBefore: widgetSpacerSiblingsBefore(widget).length,
          expansionBaseline,
          ...workspaceObjectPersistence(widget),
        }));
      } catch {}
    });
    const customWidgets = [...layout.querySelectorAll(':scope > .widget-card[data-custom-widget="true"]:not(.workspace-anchor-object):not([hidden])')]
      .map((widget) => ({
        key: widget.dataset.widgetKey,
        title: widget.dataset.panelTitle || widget.querySelector(".stat-lbl")?.textContent?.trim() || "Widget",
        value: widget.querySelector(".stat-val")?.textContent?.trim() || "0",
        color: widget.dataset.panelColor || widget.querySelector(".panel-color-toggle")?.dataset.defaultTheme || "#2563eb",
        span: Number(widget.dataset.currentSpan) || 3,
        gridCol: Number(widget.dataset.gridCol) || null,
        gridRow: Number(widget.dataset.gridRow) || null,
        rowSpan: Number(widget.dataset.gridRowSpan) || 1,
        type: widget.dataset.widgetType || "tracker",
        runtimeType: widget.dataset.widgetRuntimeType || widget.dataset.widgetDefinition || null,
        href: widget.getAttribute("href") || "",
        pinned: widget.classList.contains("db-panel-pinned"),
        minW: Number(widget.dataset.minW) || null,
        minH: Number(widget.dataset.minH) || null,
        locked: widget.dataset.locked === "true",
        resizable: widget.dataset.resizable === "false" ? false : true,
        config: widget.dataset.widgetConfig || null,
        ...workspaceObjectPersistence(widget),
      }));
    try {
      localStorage.setItem(customWidgetsKey(layoutKey, profile), JSON.stringify(customWidgets));
      localStorage.setItem(hiddenWidgetsKey(layoutKey, profile), layout.dataset.hiddenWidgetsDraft || "[]");
    } catch {}
  };

  const initWidgetLayout = (layout) => {
    const internalLayout = isPanelInternalWidgetLayout(layout);
    const layoutKey = internalLayout ? gridItemLayoutKey(layout) : (layout.dataset.widgetLayoutKey || "default");
    const profile = getActivePanelProfile(layoutKey);
    let customDefinitions = [];
    if (!internalLayout) {
      try {
        customDefinitions = JSON.parse(localStorage.getItem(customWidgetsKey(layoutKey, profile)) || "[]");
      } catch {
        customDefinitions = [];
      }
    }
    customDefinitions
      .filter((definition) => workspaceObjectTypeFromDefinition(definition, WORKSPACE_OBJECT_TYPES.widget) !== WORKSPACE_OBJECT_TYPES.anchor)
      .filter((definition) => definition?.key && !layout.querySelector(`:scope > .widget-card[data-widget-key="${CSS.escape(definition.key)}"]`))
      .forEach((definition) => layout.appendChild(createCustomWidget(definition)));
    let hiddenWidgets = [];
    if (!internalLayout) {
      try {
        hiddenWidgets = JSON.parse(localStorage.getItem(hiddenWidgetsKey(layoutKey, profile)) || "[]");
      } catch {
        hiddenWidgets = [];
      }
    }
    writeDraftList(layout, "hiddenWidgetsDraft", hiddenWidgets);
    hiddenWidgets.forEach((key) => {
      const widget = layout.querySelector(`:scope > .widget-card[data-widget-key="${CSS.escape(key)}"]`);
      if (widget) widget.hidden = true;
    });
    const widgets = [...layout.querySelectorAll(":scope > .widget-card:not(.workspace-anchor-object)")];
    const savedByWidget = new Map();
    widgets.forEach((widget, index) => {
      const key = widget.dataset.widgetKey || `widget-${index}`;
      widget.dataset.defaultOrder = String(index);
      widget.dataset.defaultTitle = widget.querySelector(".stat-lbl")?.textContent?.trim() || "Widget";
      let saved = null;
      if (!internalLayout) {
        try {
          saved = JSON.parse(localStorage.getItem(widgetStorageKey(layoutKey, key, profile)) || "null");
        } catch {}
      }
      if (saved?.runtimeType) widget.dataset.widgetRuntimeType = saved.runtimeType;
      if (saved?.type && !widget.dataset.widgetRuntimeType) widget.dataset.widgetRuntimeType = saved.type;
      if (saved?.config) widget.dataset.widgetConfig = saved.config;
      const runtimeDefinition = hydrateWidgetRuntime(widget, saved);
      ensureWidgetTools(widget);
      savedByWidget.set(widget, saved);
      markLoadedExpansionBaseline(widget, saved?.expansionBaseline);
      ensureWorkspaceObjectMetadata(widget, {
        workspaceObjectType: saved?.workspaceObjectType || widget.dataset.workspaceObjectType || workspaceObjectType(widget),
        dashboardObjectKind: saved?.dashboardObjectKind || widget.dataset.dashboardObjectKind || runtimeDefinition?.dashboardObjectKind,
        workspaceRegionId: saved?.workspaceRegionId,
        contextScopeId: saved?.contextScopeId,
        contextRole: saved?.contextRole || runtimeDefinition?.contextRole,
        navigationTargetType: saved?.navigationTargetType,
        navigationTargetId: saved?.navigationTargetId,
      });
      if (saved?.workspaceContext) applyWorkspaceContextToElement(widget, saved.workspaceContext);
      const defaultWidgetSpan = widget.dataset.widgetType === "controls" ? 6 : 1;
      applyWidgetSpan(widget, saved?.span ?? widget.dataset.currentSpan ?? widget.dataset.defaultSpan ?? defaultWidgetSpan);
      if (saved?.gridCol && saved?.gridRow) applyWidgetGridPosition(widget, saved.gridCol, saved.gridRow, saved?.rowSpan);
      widget.classList.toggle("db-panel-pinned", Boolean(saved?.pinned));
      widget.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", Boolean(saved?.pinned).toString());
      if (saved?.minW) widget.dataset.minW = String(saved.minW);
      if (saved?.minH) widget.dataset.minH = String(saved.minH);
      if (saved?.locked) widget.dataset.locked = "true";
      if (saved?.resizable === false) widget.dataset.resizable = "false";
      applyPanelColor(widget, saved?.color || widget.querySelector(".panel-color-toggle")?.dataset.defaultTheme);
      applyPanelTitleColor(widget, "");
      if (saved?.title) {
        widget.dataset.panelTitle = saved.title;
        setWidgetConfig(widget, { ...widgetConfigFromElement(widget), title: saved.title });
        const label = widget.querySelector(".stat-lbl");
        if (label) label.textContent = saved.title;
      }
    });
    widgets
      .sort((a, b) => Number(savedByWidget.get(a)?.order ?? a.dataset.defaultOrder ?? 0) - Number(savedByWidget.get(b)?.order ?? b.dataset.defaultOrder ?? 0))
      .forEach((widget) => {
        if (savedByWidget.get(widget)?.breakBefore) layout.appendChild(createWidgetRowBreak());
        const spacerCount = Math.max(0, Math.min(11, Number(savedByWidget.get(widget)?.spacerBefore) || 0));
        for (let index = 0; index < spacerCount; index += 1) {
          layout.appendChild(createWidgetSpacer(savedByWidget.get(widget)?.span || widget.dataset.defaultSpan || 3));
        }
        layout.appendChild(widget);
      });
    cleanupWidgetRowBreaks(layout);
    let defaultCol = 1;
    let defaultRow = 1;
    [...layout.querySelectorAll(":scope > .widget-card:not(.workspace-anchor-object)")].forEach((widget) => {
      if (widget.dataset.gridCol && widget.dataset.gridRow) return;
      if (!internalLayout && layout.closest(".dashboard-layout-grid")) return;
      const span = Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 1;
      if (defaultCol + span - 1 > 6) {
        defaultRow += 1;
        defaultCol = 1;
      }
      applyWidgetGridPosition(widget, defaultCol, defaultRow);
      defaultCol += span;
    });
    if (!internalLayout && layout.closest(".dashboard-layout-grid")) {
      syncDefaultDashboardGrid(layoutKey);
    } else {
      normalizeGridLayout(layout);
    }
    syncWorkspaceRegions(layout);

    const initWidget = (widget) => {
      if (widget.dataset.widgetInitialized === "true") return;
      widget.dataset.widgetInitialized = "true";
      widget.__saveWidgetLayout = () => saveWidgetLayouts(layout);
      delete widget.dataset.widgetRuntimeControlsBound;
      bindWidgetRuntimeControls(widget);
      const tools = widget.querySelector(".widget-tools");
      const drawer = widget.querySelector(".widget-tool-drawer");
      const settings = widget.querySelector(".widget-settings-toggle");
      const moveHandle = widget.querySelector(".panel-move-handle");
      const resizeHandle = widget.querySelector(".panel-resize-handle");
      const pinButton = widget.querySelector(".panel-pin-toggle");
      const titleButton = widget.querySelector(".panel-title-handle");
      const colorToggle = widget.querySelector(".panel-color-toggle");
      const deleteButton = widget.querySelector(".panel-delete-handle");
      const colorMenu = buildPanelColorMenu(widget, layout, colorToggle);
      const settingsSchemaPanel = ensureWidgetSettingsSchemaPanel(widget);
      const workbenchPanel = ensureWidgetWorkbenchPanel(widget);
      const syncOpenWidgetToolPosition = () => {
        if (!widget.classList.contains("widget-tools-open") && !widget.classList.contains("widget-workbench-open")) return;
        if (isDashboardInteractionActive()) return;
        positionDashboardToolDrawer(widget, settings, drawer);
        const drawerTop = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-top");
        const drawerRight = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-right");
        if (drawerTop) tools?.style?.setProperty("--dashboard-tool-drawer-top", drawerTop);
        if (drawerRight) tools?.style?.setProperty("--dashboard-tool-drawer-right", drawerRight);
      };
      if (!widget.__widgetToolPositionObserver) {
        widget.__widgetToolPositionObserver = new MutationObserver(syncOpenWidgetToolPosition);
        widget.__widgetToolPositionObserver.observe(widget, {
          attributes: true,
          attributeFilter: ["style", "data-grid-col", "data-grid-row", "data-current-span", "data-grid-row-span"],
        });
      }
      let closeTimer;
      let suppressToolOpenUntil = 0;
      let suppressWidgetClickUntil = 0;
      let dragging = false;
      let suppressSettingsClickUntil = 0;
      let ignoreToolLeaveCloseUntilPointerActivity = false;
      let releaseToolLeaveCloseResume = null;
      let toolsOpenedByApproach = false;
      const releaseToolLeaveClose = (event = null) => {
        const closeRestoredTools = (event?.type === "pointerdown" || event?.type === "pointermove") &&
          !tools?.contains(event.target) &&
          !colorMenu?.contains(event.target);
        ignoreToolLeaveCloseUntilPointerActivity = false;
        if (!releaseToolLeaveCloseResume) return;
        document.removeEventListener("pointermove", releaseToolLeaveCloseResume, true);
        document.removeEventListener("pointerdown", releaseToolLeaveCloseResume, true);
        releaseToolLeaveCloseResume = null;
        if (closeRestoredTools) closeTools();
      };
      const armToolLeaveCloseResume = () => {
        releaseToolLeaveClose();
        ignoreToolLeaveCloseUntilPointerActivity = true;
        releaseToolLeaveCloseResume = releaseToolLeaveClose;
        document.addEventListener("pointermove", releaseToolLeaveCloseResume, { capture: true, once: true });
        document.addEventListener("pointerdown", releaseToolLeaveCloseResume, { capture: true, once: true });
      };
      const openTools = () => {
        if (performance.now() < suppressToolOpenUntil) return;
        if (!canOpenDashboardTools(widget)) return;
        window.clearTimeout(closeTimer);
        positionDashboardToolDrawer(widget, settings, drawer);
        setWidgetLinkNavigationSuspended(widget, true);
        widget.classList.add("widget-tools-open");
        settings?.setAttribute("aria-expanded", "true");
        syncLayoutToolsActive();
      };
      const closeTools = () => {
        releaseToolLeaveClose();
        toolsOpenedByApproach = false;
        if (tools?.contains(document.activeElement)) document.activeElement?.blur?.();
        widget.classList.remove("widget-tools-open");
        widget.classList.remove("widget-settings-schema-open");
        widget.classList.remove("widget-workbench-open");
        settings?.setAttribute("aria-expanded", "false");
        settingsSchemaPanel?.setAttribute("hidden", "");
        workbenchPanel?.setAttribute("hidden", "");
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        setWidgetLinkNavigationSuspended(widget, false);
        syncLayoutToolsActive();
      };
      const closeWorkbench = () => {
        widget.classList.remove("widget-workbench-open");
        workbenchPanel?.setAttribute("hidden", "");
        if (!widget.classList.contains("widget-tools-open")) setWidgetLinkNavigationSuspended(widget, false);
        syncLayoutToolsActive();
      };
      const openWorkbench = () => {
        if (isDashboardInteractionActive()) return;
        closeInactiveDashboardTools(widget);
        window.clearTimeout(closeTimer);
        widget.classList.remove("widget-tools-open");
        widget.classList.remove("widget-settings-schema-open");
        settings?.setAttribute("aria-expanded", "false");
        settingsSchemaPanel?.setAttribute("hidden", "");
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        setWidgetLinkNavigationSuspended(widget, true);
        widget.classList.add("widget-workbench-open");
        const panel = ensureWidgetWorkbenchPanel(widget);
        if (panel) {
          positionDashboardToolDrawer(widget, settings, drawer);
          const drawerTop = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-top");
          const drawerRight = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-right");
          if (drawerTop) tools?.style?.setProperty("--dashboard-tool-drawer-top", drawerTop);
          if (drawerRight) tools?.style?.setProperty("--dashboard-tool-drawer-right", drawerRight);
          panel.hidden = false;
        }
        syncLayoutToolsActive();
      };
      const toggleAppearanceSettings = () => {
        releaseToolLeaveClose();
        closeWorkbench();
        if (!canOpenDashboardTools(widget)) return;
        const shouldClose = widget.classList.contains("widget-tools-open") &&
          widget.classList.contains("widget-settings-schema-open") &&
          !toolsOpenedByApproach;
        toolsOpenedByApproach = false;
        if (shouldClose) {
          closeTools();
          return;
        }
        suppressToolOpenUntil = 0;
        closeInactiveDashboardTools(widget);
        openTools();
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        widget.classList.add("widget-settings-schema-open");
        const panel = ensureWidgetSettingsSchemaPanel(widget);
        if (panel) {
          panel.hidden = false;
          positionDashboardToolDrawer(widget, settings, drawer);
        }
      };
      const scheduleClose = () => {
        window.clearTimeout(closeTimer);
        if (isDashboardInteractionActive() || ignoreToolLeaveCloseUntilPointerActivity) return;
        closeTimer = window.setTimeout(() => {
          if (isDashboardInteractionActive()) return;
          if (ignoreToolLeaveCloseUntilPointerActivity) return;
          if (!tools?.matches(":hover") && !colorMenu?.matches(":hover")) closeTools();
        }, 260);
      };
      const resumeToolHoverClose = () => {
        const wasOpen = widget.classList.contains("widget-tools-open");
        releaseToolLeaveClose();
        if (wasOpen) {
          window.clearTimeout(closeTimer);
          return;
        }
        openTools();
        if (!wasOpen && widget.classList.contains("widget-tools-open")) toolsOpenedByApproach = true;
      };
      tools?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      widget.addEventListener("click", (event) => {
        if (event.target?.closest?.(".widget-tools")) return;
        const interactiveTarget = event.target?.closest?.("input, textarea, select, button, video, iframe, .media-widget-stage, [contenteditable='true']");
        if (interactiveTarget && widget.contains(interactiveTarget)) return;
        event.preventDefault();
        event.stopPropagation();
        if (performance.now() < suppressWidgetClickUntil) return;
        suppressToolOpenUntil = 0;
        openWorkbench();
        try {
          widget.focus?.({ preventScroll: true });
        } catch {
          widget.focus?.();
        }
      }, true);
      tools?.addEventListener("mouseenter", resumeToolHoverClose);
      tools?.addEventListener("mouseleave", scheduleClose);
      settingsSchemaPanel?.addEventListener("mouseenter", resumeToolHoverClose);
      settingsSchemaPanel?.addEventListener("mouseleave", scheduleClose);
      settingsSchemaPanel?.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      settingsSchemaPanel?.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      settingsSchemaPanel?.addEventListener("input", (event) => {
        event.stopPropagation();
      });
      settingsSchemaPanel?.addEventListener("change", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const input = event.target?.closest?.(".widget-setting-input");
        if (!input || !widget.contains(input)) return;
        applyWidgetSettingsSchemaChange(widget, input, { history: true });
      });
      settingsSchemaPanel?.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          widget.classList.remove("widget-settings-schema-open");
          settingsSchemaPanel.hidden = true;
          settings?.focus?.({ preventScroll: true });
        }
      });
      workbenchPanel?.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      workbenchPanel?.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      workbenchPanel?.addEventListener("input", (event) => {
        event.stopPropagation();
      });
      workbenchPanel?.addEventListener("change", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const input = event.target?.closest?.(".widget-setting-input");
        if (!input || !widget.contains(input)) return;
        applyWidgetSettingsSchemaChange(widget, input, { history: true });
        ensureWidgetWorkbenchPanel(widget);
      });
      workbenchPanel?.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          closeWorkbench();
          widget.focus?.({ preventScroll: true });
        }
      });
      settings?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (performance.now() < suppressSettingsClickUntil) return;
        toggleAppearanceSettings();
      });
      settings?.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        suppressSettingsClickUntil = performance.now() + 320;
        toggleAppearanceSettings();
      });
      colorToggle?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        widget.classList.remove("widget-settings-schema-open");
        settingsSchemaPanel?.setAttribute("hidden", "");
        const nextOpen = !colorMenu?.classList.contains("panel-color-menu-open");
        if (nextOpen) {
          syncPanelThemeVars(widget, colorMenu);
          colorToggle.__refreshPanelColorMenu?.();
          positionPanelColorMenu(colorToggle, colorMenu);
        }
        colorMenu?.classList.toggle("panel-color-menu-open", nextOpen);
        colorToggle.setAttribute("aria-expanded", nextOpen.toString());
      });
      colorMenu?.addEventListener("mouseenter", resumeToolHoverClose);
      colorMenu?.addEventListener("mouseleave", () => {
        if (isDashboardInteractionActive()) return;
        closeTools();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!colorMenu?.classList.contains("panel-color-menu-open")) return;
        if (widget.contains(event.target) || colorMenu.contains(event.target)) return;
        closeTools();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!widget.classList.contains("widget-settings-schema-open")) return;
        if (widget.contains(event.target) || colorMenu?.contains(event.target)) return;
        closeTools();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!widget.classList.contains("widget-workbench-open")) return;
        if (widget.contains(event.target) || colorMenu?.contains(event.target)) return;
        closeWorkbench();
      });
      pinButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const pinned = widget.classList.toggle("db-panel-pinned");
        pinButton.setAttribute("aria-pressed", pinned.toString());
        groupPeers(widget, "widget").forEach((peer) => {
          peer.classList.toggle("db-panel-pinned", pinned);
          peer.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", pinned.toString());
        });
        saveWidgetLayouts(layout);
        suppressToolOpenUntil = performance.now() + 320;
        if (tools?.contains(document.activeElement)) document.activeElement.blur();
        closeTools();
      });
      titleButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const label = widget.querySelector(".stat-lbl");
        if (!label) return;
        const original = label.textContent.trim();
        label.contentEditable = "true";
        label.focus();
        window.getSelection?.()?.selectAllChildren(label);
        const finish = (commit) => {
          label.contentEditable = "false";
          label.removeEventListener("blur", onBlur);
          label.removeEventListener("keydown", onKeydown);
          const clean = commit ? label.textContent.trim().replace(/\s+/g, " ").slice(0, 36) : original;
          label.textContent = clean || original;
          widget.dataset.panelTitle = label.textContent;
          saveWidgetLayouts(layout);
        };
        const onBlur = () => finish(true);
        const onKeydown = (keyEvent) => {
          keyEvent.stopPropagation();
          if (keyEvent.key === "Enter") {
            keyEvent.preventDefault();
            finish(true);
          } else if (keyEvent.key === "Escape") {
            keyEvent.preventDefault();
            finish(false);
          }
        };
        label.addEventListener("blur", onBlur);
        label.addEventListener("keydown", onKeydown);
      });
      deleteButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const targets = [widget, ...groupPeers(widget, "widget").filter((peer) => groupItemLayout(peer) === layout)];
        const title = widget.querySelector(".widget-title")?.textContent?.trim() || widget.dataset.panelTitle || "Widget";
        requestWidgetDelete({ widget, widgets: targets, layout, layoutKey, title });
      });
      moveHandle?.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || widget.classList.contains("db-panel-pinned")) return;
        const restoreToolsAfterDrag = widget.classList.contains("widget-tools-open") ||
          settings?.getAttribute("aria-expanded") === "true" ||
          drawer?.matches(":hover") ||
          isDashboardToolInteractionTarget(event);
        window.clearTimeout(closeTimer);
        openTools();
        runOrderedDrag({
          layout,
          item: widget,
          event,
          draggingClass: "widget-dragging",
          placeholderClass: "widget-placeholder",
          threshold: 5,
          onCommit: () => {
            cleanupWidgetRowBreaks(layout);
            saveSharedGridLayouts(layout);
            emitWorkspaceEvent({
              type: "object-moved",
              source: "drag",
              layoutKey,
              objectId: widget.dataset.widgetKey || "",
              objectType: "widget",
              regionId: regionIdForWorkspaceItem(widget),
              panelId: widget.dataset.parentPanelKey || "",
              label: `${widget.dataset.widgetDisplayName || "Widget"} moved`,
              payload: {
                col: Number(widget.dataset.gridCol) || 0,
                row: Number(widget.dataset.gridRow) || 0,
              },
            });
          },
          onEnd: (didDrag) => {
            dragging = false;
            if (didDrag) suppressWidgetClickUntil = performance.now() + 360;
            if (restoreToolsAfterDrag) {
              armToolLeaveCloseResume();
              openTools();
            } else {
              closeTools();
            }
          },
          onStart: () => {
            dragging = true;
            window.clearTimeout(closeTimer);
          },
        });
      });
      const beginWidgetResize = (event, resizeEdge = "right") => {
        if (widget.classList.contains("db-panel-pinned") || widget.dataset.locked === "true" || widget.dataset.resizable === "false") return;
        const restoreToolsAfterResize = widget.classList.contains("widget-tools-open") ||
          settings?.getAttribute("aria-expanded") === "true" ||
          drawer?.matches(":hover") ||
          isDashboardToolInteractionTarget(event);
        window.clearTimeout(closeTimer);
        if (widget.classList.contains("group-selected") && groupTransformItems(widget).length > 1) {
          openTools();
          const handled = runGroupResize({
            layout,
            source: widget,
            event,
            onCommit: () => saveSharedGridLayouts(layout),
            onEnd: () => {
              if (restoreToolsAfterResize) {
                armToolLeaveCloseResume();
                openTools();
              } else {
                closeTools();
              }
            },
          });
          if (handled) return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (restoreToolsAfterResize) openTools();
        suppressWidgetClickUntil = Number.POSITIVE_INFINITY;
        document.body.classList.add("panel-interaction-active");
        document.body.classList.add("panel-resize-active");
        widget.classList.add("dashboard-active-resize");
        closeInactiveDashboardTools(widget);
        window.getSelection?.()?.removeAllRanges();
        const layoutMetrics = createGridMetrics(layout);
        const layoutWidth = layoutMetrics.width;
        const startSpan = Number(widget.dataset.currentSpan) || 1;
        const startRows = gridItemRowSpan(widget, layoutMetrics);
        const startRect = widget.getBoundingClientRect();
        const startCol = Number(widget.dataset.gridCol) || 1;
        const startRow = Number(widget.dataset.gridRow) || 1;
        const startRightCol = startCol + startSpan - 1;
        const minLiveWidth = gridItemPixelWidthForSpan(layout, gridItemMinimumSpan(widget), layoutMetrics);
        const maxLiveWidth = gridItemPixelWidthForSpan(layout, resizeEdge === "left" ? startRightCol : DASHBOARD_GRID_COLUMNS, layoutMetrics);
        const minRows = gridItemMinimumRows(widget);
        const minLiveHeight = gridHeightForRows(minRows, layoutMetrics.gap, layoutMetrics.rowHeight);
        const resizePreview = createResizePreview(layout, widget, "widget-placeholder", startRect, layoutMetrics);
        const reflowItems = reflowItemsForLayout(layout, widget);
        const previewStartCell = {
          col: Number(resizePreview.dataset.gridCol) || Number(widget.dataset.gridCol) || 1,
          row: Number(resizePreview.dataset.gridRow) || Number(widget.dataset.gridRow) || 1,
        };
        const liveResizePreview = beginLiveResizeSurface(widget, startRect);
        const resizePeers = groupPeers(widget, "widget")
          .filter((peer) => !peer.classList.contains("db-panel-pinned") && groupItemLayout(peer) === layout)
          .map((peer) => ({
            peer,
            startSpan: Number(peer.dataset.currentSpan) || Number(peer.dataset.defaultSpan) || 1,
            startRows: gridItemRowSpan(peer, layoutMetrics),
          }));
        const groupResizeItems = [{ peer: widget, startSpan, startRows }, ...resizePeers];
        const startX = event.clientX;
        const startY = event.clientY;
        const startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const resizeStartSnapshot = snapshotGridLayout(layout);
        let previewSpan = startSpan;
        let previewRows = startRows;
        const applyResize = (nextSpan, nextRows) => {
          const requestedDelta = nextSpan - startSpan;
          const minDelta = Math.max(...groupResizeItems.map(({ peer, startSpan }) => gridItemMinimumSpan(peer) - startSpan));
          const edgeMaxDelta = resizeEdge === "left" ? startCol - 1 : 6 - startSpan;
          const maxDelta = Math.min(edgeMaxDelta, ...groupResizeItems.map(({ startSpan }) => 6 - startSpan));
          const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
          const snappedSpan = startSpan + delta;
          const snappedCol = resizeEdge === "left" ? startRightCol - snappedSpan + 1 : previewStartCell.col;
          const requestedRowDelta = nextRows - startRows;
          const minRowDelta = Math.max(...groupResizeItems.map(({ peer, startRows }) => gridItemMinimumRows(peer) - startRows));
          const rowDelta = Math.max(minRowDelta, requestedRowDelta);
          const snappedRows = startRows + rowDelta;
          restoreGridLayoutSnapshot(resizeStartSnapshot, { exclude: [widget] });
          applyWidgetSpan(resizePreview, snappedSpan);
          applyWidgetGridPosition(resizePreview, snappedCol, startRow, snappedRows);
          resizePeers.forEach(({ peer, startSpan: peerStartSpan, startRows: peerStartRows }) => {
            applyWidgetSpan(peer, peerStartSpan + delta);
            applyWidgetGridPosition(peer, peer.dataset.gridCol, peer.dataset.gridRow, peerStartRows + rowDelta);
          });
          resolveSparseGridLayout(layout, resizePreview, { col: snappedCol, row: previewStartCell.row }, { metrics: layoutMetrics, items: reflowItems });
          previewSpan = snappedSpan;
          previewRows = snappedRows;
        };
        const onMove = (moveEvent) => {
          moveEvent.preventDefault();
          const scrollDeltaY = (window.scrollY || document.documentElement.scrollTop || 0) - startScrollY;
          const deltaX = moveEvent.clientX - startX;
          const effectiveClientY = moveEvent.clientY + scrollDeltaY;
          const deltaY = effectiveClientY - startY;
          const liveWidth = Math.max(minLiveWidth, Math.min(maxLiveWidth, startRect.width + (resizeEdge === "left" ? -deltaX : deltaX)));
          const liveHeight = Math.max(minLiveHeight, startRect.height + deltaY);
          const liveLeft = resizeEdge === "left" ? startRect.right - liveWidth : startRect.left;
          updateLiveResizeSurface(liveResizePreview, liveWidth, liveHeight, liveLeft, startRect.top - scrollDeltaY);
          const rawSpan = startSpan + ((((resizeEdge === "left" ? -deltaX : deltaX)) / layoutWidth) * 6);
          const nextSpan = Math.max(gridItemMinimumSpan(widget), Math.min(6, Math.round(rawSpan)));
          const rawRows = startRows + (deltaY / layoutMetrics.rowStep);
          const nextRows = Math.max(minRows, Math.round(rawRows));
          if (nextSpan === previewSpan && nextRows === previewRows) return;
          animateOrderedGridReflow(layout, () => applyResize(nextSpan, nextRows), widget, { items: reflowItems, metrics: layoutMetrics });
        };
        const finishWidgetResize = (upEvent, canceled) => {
          if (canceled) {
            restoreGridLayoutSnapshot(resizeStartSnapshot);
          } else {
            animateOrderedGridReflow(layout, () => {
              const currentSpan = previewSpan || Number(widget.dataset.currentSpan) || startSpan;
              const groupedSpan = groupedWidgetReleaseSpan(currentSpan, resizePeers.length + 1);
              const snappedSpan = groupedSpan ?? (resizeEdge === "left" ? Math.round(currentSpan) : alignedResizeSpan({
                layout,
                item: resizePreview,
                currentSpan,
                gap: 12,
                minSpan: gridItemMinimumSpan(widget),
                metrics: refreshGridMetricsRect(layoutMetrics),
              }));
              const requestedDelta = snappedSpan - startSpan;
              const minDelta = Math.max(...groupResizeItems.map(({ peer, startSpan }) => gridItemMinimumSpan(peer) - startSpan));
              const edgeMaxDelta = resizeEdge === "left" ? startCol - 1 : 6 - startSpan;
              const maxDelta = Math.min(edgeMaxDelta, ...groupResizeItems.map(({ startSpan }) => 6 - startSpan));
              const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
              const finalSpan = startSpan + delta;
              const finalCol = resizeEdge === "left" ? startRightCol - finalSpan + 1 : startCol;
              const currentRows = Math.max(minRows, Math.round(previewRows || gridItemRowSpan(resizePreview, layoutMetrics) || startRows));
              const requestedRowDelta = currentRows - startRows;
              const minRowDelta = Math.max(...groupResizeItems.map(({ peer, startRows }) => gridItemMinimumRows(peer) - startRows));
              const rowDelta = Math.max(minRowDelta, requestedRowDelta);
              const finalRows = startRows + rowDelta;
              clearLiveResizeSurface(widget, liveResizePreview);
              restoreGridLayoutSnapshot(resizeStartSnapshot);
              resizePreview.remove();
              applyWidgetSpan(widget, finalSpan);
              applyWidgetGridPosition(widget, finalCol, startRow, finalRows);
              resizePeers.forEach(({ peer, startSpan: peerStartSpan, startRows: peerStartRows }) => {
                applyWidgetSpan(peer, peerStartSpan + delta);
                applyWidgetGridPosition(peer, peer.dataset.gridCol, peer.dataset.gridRow, peerStartRows + rowDelta);
              });
              resolveSparseGridLayout(layout, widget, { col: finalCol, row: startRow }, {
                metrics: layoutMetrics,
                items: reflowItems,
              });
            }, widget, { items: reflowItems, metrics: layoutMetrics });
            saveSharedGridLayouts(layout);
            emitWorkspaceEvent({
              type: "object-resized",
              source: "resize",
              layoutKey,
              objectId: widget.dataset.widgetKey || "",
              objectType: "widget",
              regionId: regionIdForWorkspaceItem(widget),
              panelId: widget.dataset.parentPanelKey || "",
              label: `${widget.dataset.widgetDisplayName || "Widget"} resized`,
              payload: {
                cols: Number(widget.dataset.currentSpan) || 0,
                rows: Number(widget.dataset.gridRowSpan) || 0,
              },
            });
            syncCommittedWorkspaceScrollFloor(layout, {
              preserveViewport: document.body.classList.contains("dashboard-interaction-scroll-extended"),
            });
          }
        };
        beginResizeLifecycle({
          event,
          source: widget,
          layout,
          onMove,
          onEnd: finishWidgetResize,
          onCleanup: () => {
            resizePreview.remove();
            clearLiveResizeSurface(widget, liveResizePreview);
            suppressWidgetClickUntil = performance.now() + 360;
            if (restoreToolsAfterResize) {
              armToolLeaveCloseResume();
              openTools();
            } else {
              closeTools();
            }
          },
        });
      };
      resizeHandle?.addEventListener("pointerdown", (event) => beginWidgetResize(event, "right"));
      widget.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        if (event.target?.closest?.(".widget-tools, .panel-tools, .panel-color-menu")) return;
        const resizeEdge = resizeEdgeFromPointer(event, widget);
        if (!resizeEdge) return;
        beginWidgetResize(event, resizeEdge);
      }, { capture: true });
    };
    widgets.forEach(initWidget);
    layout.__initWidget = initWidget;
  };

  document.querySelectorAll(".widget-layout").forEach(initWidgetLayout);

  document.querySelectorAll(".panel-layout").forEach((layout) => {
    const layoutKey = layout.dataset.layoutKey || "default";
    const layoutProfile = getActivePanelProfile(layoutKey);
    let customPanelDefinitions = [];
    try {
      customPanelDefinitions = JSON.parse(localStorage.getItem(customPanelsKey(layoutKey, layoutProfile)) || "[]");
    } catch {
      customPanelDefinitions = [];
    }
    customPanelDefinitions
      .filter((definition) => definition?.key && !layout.querySelector(`:scope > .db-panel[data-panel-key="${CSS.escape(definition.key)}"]`))
      .forEach((definition) => layout.appendChild(createCustomPanel(definition)));
    let hiddenPanels = [];
    try {
      hiddenPanels = JSON.parse(localStorage.getItem(hiddenPanelsKey(layoutKey, layoutProfile)) || "[]");
    } catch {
      hiddenPanels = [];
    }
    writeDraftList(layout, "hiddenPanelsDraft", hiddenPanels);
    hiddenPanels.forEach((key) => {
      const panel = layout.querySelector(`:scope > .db-panel[data-panel-key="${CSS.escape(key)}"]`);
      if (panel) panel.hidden = true;
    });
    const panels = [...layout.querySelectorAll(":scope > .db-panel")];
    const savedByPanel = new Map();
    panels.forEach((panel, index) => {
      const key = panel.dataset.panelKey || `panel-${index}`;
      const titleEl = panel.querySelector(".db-panel-title");
      const defaultTheme = panel.querySelector(".panel-color-toggle")?.dataset.defaultTheme;
      panel.dataset.defaultOrder = String(index);
      if (titleEl) panel.dataset.defaultTitle = titleEl.textContent.trim();
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(panelStorageKey(layoutKey, key, layoutProfile)) || "null");
      } catch {}
      savedByPanel.set(panel, saved);
      markLoadedExpansionBaseline(panel, saved?.expansionBaseline);
      panel.__loadedExpansionActive = Boolean(saved?.expansionActive);
      ensureWorkspaceObjectMetadata(panel, {
        workspaceObjectType: saved?.workspaceObjectType || panel.dataset.workspaceObjectType || workspaceObjectType(panel),
        dashboardObjectKind: saved?.dashboardObjectKind || panel.dataset.dashboardObjectKind,
        workspaceRegionId: saved?.workspaceRegionId,
        contextScopeId: saved?.contextScopeId,
        contextRole: saved?.contextRole,
        navigationTargetType: saved?.navigationTargetType,
        navigationTargetId: saved?.navigationTargetId,
      });
      if (saved?.workspaceContext) applyWorkspaceContextToElement(panel, saved.workspaceContext);
      panel.classList.remove("db-panel-unlocked", "db-panel-pinned");
      if (saved?.pinned) panel.classList.add("db-panel-pinned");
      panel.classList.toggle("db-panel-collapsed", saved?.collapsed ?? panel.classList.contains("db-panel-collapsed"));
      if (workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider) {
        panel.classList.add("db-panel-collapsed");
        panel.dataset.gridRowSpan = "1";
      }
      if (saved?.minW) panel.dataset.minW = String(saved.minW);
      if (saved?.locked) panel.dataset.locked = "true";
      if (saved?.resizable === false) panel.dataset.resizable = "false";
      applyPanelSpan(panel, saved?.span ?? panel.dataset.defaultSpan ?? 6);
      if (saved?.gridCol && saved?.gridRow) applyPanelGridPosition(panel, saved.gridCol, saved.gridRow);
      if (saved?.height) applyPanelHeight(panel, saved.height);
      applyPanelColor(panel, saved?.color || defaultTheme);
      applyPanelTitleColor(panel, "");
      if (saved?.title && titleEl) {
        panel.dataset.panelTitle = saved.title;
        titleEl.textContent = saved.title;
      }
      restorePanelChildWidgets(panel, saved?.childWidgets || []);
    });

    panels
      .sort((a, b) => {
        const aSaved = savedByPanel.get(a);
        const bSaved = savedByPanel.get(b);
        return Number(aSaved?.order ?? a.dataset.defaultOrder ?? 0) - Number(bSaved?.order ?? b.dataset.defaultOrder ?? 0);
      })
      .forEach((panel) => {
        if (savedByPanel.get(panel)?.breakBefore) layout.appendChild(createPanelRowBreak());
        layout.appendChild(panel);
      });
    cleanupPanelRowBreaks(layout);
    let defaultPanelCol = 1;
    let defaultPanelRow = 1;
    [...layout.querySelectorAll(":scope > .db-panel")].forEach((panel) => {
      if (panel.dataset.gridCol && panel.dataset.gridRow) return;
      if (layout.closest(".dashboard-layout-grid")) return;
      const span = Number(panel.dataset.currentSpan) || Number(panel.dataset.defaultSpan) || 6;
      if (defaultPanelCol + span - 1 > 6) {
        defaultPanelRow += 1;
        defaultPanelCol = 1;
      }
      applyPanelGridPosition(panel, defaultPanelCol, defaultPanelRow);
      defaultPanelCol += span;
    });
    if (layout.closest(".dashboard-layout-grid")) {
      syncDefaultDashboardGrid(layoutKey);
    } else {
      normalizeGridLayout(layout);
    }
    syncWorkspaceRegions(layout);

    const initPanel = (panel) => {
      if (panel.dataset.panelInitialized === "true") return;
      panel.dataset.panelInitialized = "true";
      syncPanelMinimumWidth(panel);
      const header = panel.querySelector(":scope > .db-panel-hd");
      const body = panel.querySelector(":scope > .db-panel-body");
      const settingsButton = header?.querySelector(".panel-settings-toggle");
      const panelTools = header?.querySelector(".panel-tools");
      const panelToolDrawer = panelTools?.querySelector(":scope > .panel-tool-drawer");
      const capabilities = workspaceObjectCapabilities(panel);
      if (panelToolDrawer && !panelToolDrawer.querySelector(".panel-delete-handle")) {
        panelToolDrawer.insertAdjacentHTML("beforeend", '<button class="panel-tool-button panel-delete-handle" type="button" aria-label="Delete panel" title="Delete panel"><span class="trash-icon" aria-hidden="true"></span></button>');
      }
      const moveHandle = panelToolDrawer?.querySelector(".panel-move-handle");
      const resizeHandle = panelToolDrawer?.querySelector(".panel-resize-handle");
      const pinButton = panelToolDrawer?.querySelector(".panel-pin-toggle");
      const titleButton = panelToolDrawer?.querySelector(".panel-title-handle");
      const colorToggle = panelToolDrawer?.querySelector(".panel-color-toggle");
      const deleteButton = panelToolDrawer?.querySelector(".panel-delete-handle");
      if (!header || !body) return;
      const internalWidgetGrid = capabilities.hasPanelContentArea ? ensurePanelInternalWidgetGrid(panel) : null;
      if (internalWidgetGrid) initWidgetLayout(internalWidgetGrid);
      if (internalWidgetGrid && !panel.__panelChildHoverOwnershipBound) {
        panel.__panelChildHoverOwnershipBound = true;
        const childWidgetFromEvent = (event) => {
          const child = event.target?.closest?.(".panel-internal-widget-grid > .widget-card");
          return child && internalWidgetGrid.contains(child) ? child : null;
        };
        internalWidgetGrid.addEventListener("pointerover", (event) => {
          if (childWidgetFromEvent(event)) panel.classList.add("panel-child-hover-active");
        });
        internalWidgetGrid.addEventListener("pointerout", (event) => {
          const relatedChild = event.relatedTarget?.closest?.(".panel-internal-widget-grid > .widget-card");
          if (relatedChild && internalWidgetGrid.contains(relatedChild)) return;
          panel.classList.remove("panel-child-hover-active");
        });
        panel.addEventListener("pointerleave", () => {
          panel.classList.remove("panel-child-hover-active");
        });
      }
      const colorMenu = buildPanelColorMenu(panel, layout, colorToggle);
      pinButton?.setAttribute("aria-pressed", panel.classList.contains("db-panel-pinned").toString());
      let movedDuringPointer = false;
      let toolsCloseTimer;
      let toolPointerCapture = false;
      let suppressHeaderToggleUntil = 0;
      let suppressToolOpenUntil = 0;
      let ignorePanelToolLeaveCloseUntilPointerActivity = false;
      let releasePanelToolLeaveCloseResume = null;
      let panelToolsOpenedByApproach = false;
      const releasePanelToolLeaveClose = (event = null) => {
        const closeRestoredTools = (event?.type === "pointerdown" || event?.type === "pointermove") &&
          !panelTools?.contains(event.target) &&
          !colorMenu?.contains(event.target);
        ignorePanelToolLeaveCloseUntilPointerActivity = false;
        if (!releasePanelToolLeaveCloseResume) return;
        document.removeEventListener("pointermove", releasePanelToolLeaveCloseResume, true);
        document.removeEventListener("pointerdown", releasePanelToolLeaveCloseResume, true);
        releasePanelToolLeaveCloseResume = null;
        if (closeRestoredTools) closePanelTools();
      };
      const armPanelToolLeaveCloseResume = () => {
        releasePanelToolLeaveClose();
        ignorePanelToolLeaveCloseUntilPointerActivity = true;
        releasePanelToolLeaveCloseResume = releasePanelToolLeaveClose;
        document.addEventListener("pointermove", releasePanelToolLeaveCloseResume, { capture: true, once: true });
        document.addEventListener("pointerdown", releasePanelToolLeaveCloseResume, { capture: true, once: true });
      };
      const openPanelTools = () => {
        if (performance.now() < suppressToolOpenUntil) return;
        if (!canOpenDashboardTools(panel)) return;
        window.clearTimeout(toolsCloseTimer);
        positionDashboardToolDrawer(panel, settingsButton, panelToolDrawer);
        panel.classList.add("db-panel-tools-open");
        settingsButton?.setAttribute("aria-expanded", "true");
        syncLayoutToolsActive();
      };

      const closePanelTools = () => {
        releasePanelToolLeaveClose();
        panelToolsOpenedByApproach = false;
        if (panelTools?.contains(document.activeElement)) document.activeElement?.blur?.();
        panel.classList.remove("db-panel-tools-open");
        settingsButton?.setAttribute("aria-expanded", "false");
        colorToggle?.setAttribute("aria-expanded", "false");
        colorMenu?.classList.remove("panel-color-menu-open");
        syncLayoutToolsActive();
      };

      const scheduleClosePanelTools = () => {
        window.clearTimeout(toolsCloseTimer);
        if (isDashboardInteractionActive() || toolPointerCapture || ignorePanelToolLeaveCloseUntilPointerActivity) return;
        toolsCloseTimer = window.setTimeout(() => {
          if (isDashboardInteractionActive()) return;
          if (toolPointerCapture) return;
          if (ignorePanelToolLeaveCloseUntilPointerActivity) return;
          const activeElement = document.activeElement;
          const stillUsingTools =
            settingsButton?.matches(":hover") ||
            panelToolDrawer?.matches(":hover") ||
            colorMenu?.matches(":hover") ||
            (panelTools?.contains(activeElement) && activeElement !== colorToggle);
          if (!stillUsingTools) closePanelTools();
        }, 300);
      };
      const resumePanelToolHoverClose = () => {
        const wasOpen = panel.classList.contains("db-panel-tools-open");
        releasePanelToolLeaveClose();
        if (wasOpen) {
          window.clearTimeout(toolsCloseTimer);
          return;
        }
        openPanelTools();
        if (!wasOpen && panel.classList.contains("db-panel-tools-open")) panelToolsOpenedByApproach = true;
      };

      panelTools?.addEventListener("click", (event) => event.stopPropagation());
      panelTools?.addEventListener("keydown", (event) => event.stopPropagation());
      panelTools?.addEventListener("mouseleave", scheduleClosePanelTools);
      panelTools?.addEventListener("focusin", resumePanelToolHoverClose);
      panelTools?.addEventListener("focusout", scheduleClosePanelTools);
      settingsButton?.addEventListener("mouseenter", () => {
        if (performance.now() < suppressToolOpenUntil) return;
        suppressHeaderToggleUntil = performance.now() + 250;
        resumePanelToolHoverClose();
      });
      settingsButton?.addEventListener("mouseleave", scheduleClosePanelTools);
      panelToolDrawer?.addEventListener("mouseenter", resumePanelToolHoverClose);
      panelToolDrawer?.addEventListener("mouseleave", scheduleClosePanelTools);
      colorMenu?.addEventListener("mouseenter", resumePanelToolHoverClose);
      colorMenu?.addEventListener("mouseleave", () => {
        if (isDashboardInteractionActive()) return;
        if (!toolPointerCapture) closePanelTools();
      });

      settingsButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressHeaderToggleUntil = 0;
        releasePanelToolLeaveClose();
        if (!canOpenDashboardTools(panel)) return;
        const shouldClose = panel.classList.contains("db-panel-tools-open") && !panelToolsOpenedByApproach;
        panelToolsOpenedByApproach = false;
        if (shouldClose) {
          closePanelTools();
        } else {
          suppressToolOpenUntil = 0;
          closeInactiveDashboardTools(panel);
          openPanelTools();
        }
      });

      colorToggle?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressHeaderToggleUntil = 0;
        const nextOpen = !colorMenu?.classList.contains("panel-color-menu-open");
        if (nextOpen) {
          syncPanelThemeVars(panel, colorMenu);
          colorToggle.__refreshPanelColorMenu?.();
          positionPanelColorMenu(colorToggle, colorMenu);
        }
        colorMenu?.classList.toggle("panel-color-menu-open", nextOpen);
        colorToggle.setAttribute("aria-expanded", nextOpen.toString());
      });

      window.addEventListener("resize", () => {
        if (colorMenu?.classList.contains("panel-color-menu-open")) positionPanelColorMenu(colorToggle, colorMenu);
      });
      window.addEventListener("scroll", () => {
        if (colorMenu?.classList.contains("panel-color-menu-open")) positionPanelColorMenu(colorToggle, colorMenu);
      }, true);

      pinButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressHeaderToggleUntil = 0;
        const pinned = panel.classList.toggle("db-panel-pinned");
        pinButton.setAttribute("aria-pressed", pinned.toString());
        groupPeers(panel, "panel").forEach((peer) => {
          peer.classList.toggle("db-panel-pinned", pinned);
          peer.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", pinned.toString());
        });
        savePanelLayouts(layout);
        suppressToolOpenUntil = performance.now() + 320;
        if (panelTools?.contains(document.activeElement)) document.activeElement.blur();
        closePanelTools();
      });

      titleButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressHeaderToggleUntil = 0;
        const titleEl = panel.querySelector(".db-panel-title");
        if (!titleEl) return;
        const originalTitle = panel.dataset.panelTitle || titleEl.textContent.trim();
        panel.classList.add("db-panel-title-editing");
        titleEl.contentEditable = "true";
        titleEl.spellcheck = false;
        titleEl.focus();
        window.getSelection?.()?.selectAllChildren(titleEl);

        const finishEdit = (commit) => {
          titleEl.removeEventListener("blur", onBlur);
          titleEl.removeEventListener("keydown", onKeydown);
          titleEl.contentEditable = "false";
          panel.classList.remove("db-panel-title-editing");
          if (!commit) {
            titleEl.textContent = originalTitle;
            return;
          }
          const cleanTitle = titleEl.textContent.trim().replace(/\s+/g, " ").slice(0, 36);
          if (cleanTitle) {
            panel.dataset.panelTitle = cleanTitle;
            titleEl.textContent = cleanTitle;
          } else {
            delete panel.dataset.panelTitle;
            titleEl.textContent = panel.dataset.defaultTitle || originalTitle;
          }
          savePanelLayouts(layout);
        };

        const onBlur = () => finishEdit(true);
        const onKeydown = (keyEvent) => {
          keyEvent.stopPropagation();
          if (keyEvent.key === "Enter") {
            keyEvent.preventDefault();
            finishEdit(true);
          } else if (keyEvent.key === "Escape") {
            keyEvent.preventDefault();
            finishEdit(false);
          }
        };

        titleEl.addEventListener("blur", onBlur);
        titleEl.addEventListener("keydown", onKeydown);
      });

      deleteButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const title = panel.dataset.panelTitle || panel.querySelector(".db-panel-title")?.textContent?.trim() || "this";
        const targets = [panel, ...groupPeers(panel, "panel").filter((peer) => groupItemLayout(peer) === layout)];
        requestPanelDelete({ panel, panels: targets, layout, layoutKey, title });
      });

      if (capabilities.canExpand) {
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-expanded", (!panel.classList.contains("db-panel-collapsed")).toString());
      } else {
        header.removeAttribute("role");
        header.removeAttribute("tabindex");
        header.removeAttribute("aria-expanded");
        header.removeAttribute("aria-disabled");
      }
      const togglePanel = () => {
        if (!capabilities.canExpand) return;
        if (panel.classList.contains("db-panel-title-editing")) return;
        if (movedDuringPointer) {
          movedDuringPointer = false;
          return;
        }
        const wasCollapsed = panel.classList.contains("db-panel-collapsed");
        if (wasCollapsed) {
          ensureRenderedGridPosition(layout, panel);
          beginPanelExpansionSession(layout, panel);
        }
        const collapsed = panel.classList.toggle("db-panel-collapsed");
        if (collapsed) {
          if (panel.style.height) panel.dataset.savedHeight = String(parseFloat(panel.style.height));
          panel.dataset.gridRowSpan = "1";
          panel.style.height = "";
        } else if (panel.dataset.savedHeight) {
          applyPanelHeight(panel, panel.dataset.savedHeight);
        } else {
          panel.dataset.gridRowSpan = String(panelMinimumRows(panel));
        }
        if (panel.dataset.gridCol && panel.dataset.gridRow) applyPanelGridPosition(panel, panel.dataset.gridCol, panel.dataset.gridRow);
        animatePanelReflow(layout, () => {
          if (collapsed) {
            panel.classList.add("db-panel-collapsed");
            panel.dataset.gridRowSpan = "1";
            panel.style.height = "";
            if (panel.dataset.gridCol && panel.dataset.gridRow) applyPanelGridPosition(panel, panel.dataset.gridCol, panel.dataset.gridRow);
            relaxCollapsedExpansionDisplacement(layout, panel);
            endPanelExpansionSession(layout, panel);
          } else {
            applyVerticalPanelExpansion(layout, panel);
          }
        }, panel);
        if (capabilities.canExpand) header.setAttribute("aria-expanded", (!collapsed).toString());
        savePanelLayouts(layout);
        emitWorkspaceEvent({
          type: collapsed ? "panel-collapsed" : "panel-opened",
          source: "panel-toggle",
          layoutKey,
          objectId: panel.dataset.panelKey || "",
          objectType: workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider ? "divider" : "panel",
          regionId: regionIdForWorkspaceItem(panel),
          label: `${panel.dataset.panelTitle || panel.dataset.defaultTitle || "Panel"} ${collapsed ? "collapsed" : "opened"}`,
          payload: {
            collapsed,
            rows: Number(panel.dataset.gridRowSpan) || 0,
          },
        });
      };
      header.addEventListener("click", (event) => {
        if (event.target?.closest?.(".panel-tools")) return;
        if (performance.now() < suppressHeaderToggleUntil) return;
        togglePanel();
      });
      header.addEventListener("keydown", (event) => {
        if (event.target?.closest?.(".panel-tools")) return;
        if (event.target?.isContentEditable) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        togglePanel();
      });

      moveHandle?.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        if (panel.classList.contains("db-panel-pinned")) return;
        const restoreToolsAfterDrag = panel.classList.contains("db-panel-tools-open") ||
          settingsButton?.getAttribute("aria-expanded") === "true" ||
          panelToolDrawer?.matches(":hover") ||
          isDashboardToolInteractionTarget(event);
        window.clearTimeout(toolsCloseTimer);
        toolPointerCapture = true;
        openPanelTools();
        runOrderedDrag({
          layout,
          item: panel,
          event,
          draggingClass: "db-panel-dragging",
          placeholderClass: "db-panel-placeholder",
          threshold: 6,
          onCommit: () => {
            cleanupPanelRowBreaks(layout);
            saveSharedGridLayouts(layout);
            emitWorkspaceEvent({
              type: workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider ? "divider-moved" : "object-moved",
              source: "drag",
              layoutKey,
              objectId: panel.dataset.panelKey || "",
              objectType: workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider ? "divider" : "panel",
              regionId: regionIdForWorkspaceItem(panel),
              label: `${panel.dataset.panelTitle || panel.dataset.defaultTitle || "Panel"} moved`,
              payload: {
                col: Number(panel.dataset.gridCol) || 0,
                row: Number(panel.dataset.gridRow) || 0,
              },
            });
          },
          onEnd: (didDrag) => {
            toolPointerCapture = false;
            if (restoreToolsAfterDrag) {
              armPanelToolLeaveCloseResume();
              openPanelTools();
            } else {
              closePanelTools();
            }
            movedDuringPointer = didDrag;
            requestAnimationFrame(() => {
              movedDuringPointer = false;
            });
          },
        });
      });

      const beginPanelResize = (event, resizeEdge = "right") => {
        if (panel.classList.contains("db-panel-pinned") || panel.dataset.locked === "true" || panel.dataset.resizable === "false") return;
        const restoreToolsAfterResize = panel.classList.contains("db-panel-tools-open") ||
          settingsButton?.getAttribute("aria-expanded") === "true" ||
          panelToolDrawer?.matches(":hover") ||
          isDashboardToolInteractionTarget(event);
        window.clearTimeout(toolsCloseTimer);
        if (panel.classList.contains("group-selected") && groupTransformItems(panel).length > 1) {
          toolPointerCapture = true;
          openPanelTools();
          const handled = runGroupResize({
            layout,
            source: panel,
            event,
            onCommit: () => saveSharedGridLayouts(layout),
            onEnd: () => {
              toolPointerCapture = false;
              if (restoreToolsAfterResize) {
                armPanelToolLeaveCloseResume();
                openPanelTools();
              } else {
                closePanelTools();
              }
            },
          });
          if (handled) return;
          toolPointerCapture = false;
        }
        event.preventDefault();
        event.stopPropagation();
        toolPointerCapture = true;
        openPanelTools();
        document.body.classList.add("panel-interaction-active");
        document.body.classList.add("panel-resize-active");
        panel.classList.add("dashboard-active-resize");
        closeInactiveDashboardTools(panel);
        window.getSelection?.()?.removeAllRanges();
        const startX = event.clientX;
        const startY = event.clientY;
        const startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const startRect = panel.getBoundingClientRect();
        const layoutMetrics = createGridMetrics(layout);
        const gap = layoutMetrics.gap;
        const startRows = gridItemRowSpan(panel, layoutMetrics);
        const rowStep = DASHBOARD_GRID_ROW_HEIGHT + gap;
        const startFootprintHeight = gridHeightForRows(gridItemRowSpan(panel, layoutMetrics), gap);
        const layoutWidth = layoutMetrics.width;
        const startSpan = Number(panel.dataset.currentSpan) || Number(panel.dataset.defaultSpan) || 6;
        const startCol = Number(panel.dataset.gridCol) || 1;
        const startRow = Number(panel.dataset.gridRow) || 1;
        const startRightCol = startCol + startSpan - 1;
        const collapsedPanelResize = panel.classList.contains("db-panel-collapsed");
        const minLiveWidth = gridItemPixelWidthForSpan(layout, gridItemMinimumSpan(panel), layoutMetrics);
        const maxLiveWidth = gridItemPixelWidthForSpan(layout, resizeEdge === "left" ? startRightCol : DASHBOARD_GRID_COLUMNS, layoutMetrics);
        const minLiveHeight = collapsedPanelResize ? startRect.height : getPanelMinimumHeight(panel);
        const resizePreview = createResizePreview(layout, panel, "db-panel-placeholder", startRect, layoutMetrics);
        const reflowItems = reflowItemsForLayout(layout, panel);
        const previewStartCell = {
          col: Number(resizePreview.dataset.gridCol) || Number(panel.dataset.gridCol) || 1,
          row: Number(resizePreview.dataset.gridRow) || Number(panel.dataset.gridRow) || 1,
        };
        const liveResizePreview = beginLiveResizeSurface(panel, startRect);
        const expandedFootprintGhost = createExpandedFootprintGhost(panel, layout, startRect, null, layoutMetrics);
        const resizePeers = groupPeers(panel, "panel")
          .filter((peer) => !peer.classList.contains("db-panel-pinned") && groupItemLayout(peer) === layout)
          .map((peer) => ({ peer, startSpan: Number(peer.dataset.currentSpan) || Number(peer.dataset.defaultSpan) || 6 }));
        const groupResizeItems = [{ peer: panel, startSpan }, ...resizePeers];
        const resizeStartSnapshot = snapshotGridLayout(layout);
        let previewSpan = startSpan;
        let previewHeight = startFootprintHeight;
        let previewRows = startRows;
        const applyResize = (nextSpan, nextHeight, nextRows) => {
          const requestedDelta = nextSpan - startSpan;
          const minDelta = Math.max(...groupResizeItems.map(({ peer, startSpan }) => gridItemMinimumSpan(peer) - startSpan));
          const edgeMaxDelta = resizeEdge === "left" ? startCol - 1 : 6 - startSpan;
          const maxDelta = Math.min(edgeMaxDelta, ...groupResizeItems.map(({ startSpan }) => 6 - startSpan));
          const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
          const snappedSpan = startSpan + delta;
          const snappedCol = resizeEdge === "left" ? startRightCol - snappedSpan + 1 : previewStartCell.col;
          restoreGridLayoutSnapshot(resizeStartSnapshot, { exclude: [panel] });
          applyPanelSpan(resizePreview, snappedSpan);
          if (resizeEdge === "left") applyPanelGridPosition(resizePreview, snappedCol, startRow);
          if (collapsedPanelResize) {
            resizePreview.dataset.gridRowSpan = "1";
            resizePreview.style.height = `${Math.max(DASHBOARD_GRID_ROW_HEIGHT, startRect.height)}px`;
            if (resizePreview.dataset.gridCol && resizePreview.dataset.gridRow) {
              applyPanelGridPosition(resizePreview, resizePreview.dataset.gridCol, resizePreview.dataset.gridRow);
            }
          } else {
            applyPanelHeight(resizePreview, nextHeight);
          }
          resizePeers.forEach(({ peer, startSpan: peerStartSpan }) => {
            applyPanelSpan(peer, peerStartSpan + delta);
            applyPanelHeight(peer, Math.max(getPanelMinimumHeight(peer), nextHeight));
          });
          resolveSparseGridLayout(layout, resizePreview, { col: snappedCol, row: previewStartCell.row }, { metrics: layoutMetrics, items: reflowItems });
          previewSpan = snappedSpan;
          previewHeight = nextHeight;
          previewRows = nextRows;
        };

        const onResizeMove = (moveEvent) => {
          moveEvent.preventDefault();
          const scrollDeltaY = (window.scrollY || document.documentElement.scrollTop || 0) - startScrollY;
          const effectiveClientY = moveEvent.clientY + scrollDeltaY;
          const deltaX = moveEvent.clientX - startX;
          const liveWidth = Math.max(minLiveWidth, Math.min(maxLiveWidth, startRect.width + (resizeEdge === "left" ? -deltaX : deltaX)));
          const liveLeft = resizeEdge === "left" ? startRect.right - liveWidth : startRect.left;
          const liveHeight = collapsedPanelResize ? startRect.height : Math.max(minLiveHeight, startRect.height + (effectiveClientY - startY));
          updateLiveResizeSurface(liveResizePreview, liveWidth, liveHeight, liveLeft, startRect.top - scrollDeltaY);
          const rawSpan = startSpan + ((((resizeEdge === "left" ? -deltaX : deltaX)) / layoutWidth) * 6);
          const nextSpan = Math.max(gridItemMinimumSpan(panel), Math.min(6, Math.round(rawSpan)));
          const nextRows = Math.max(panelMinimumRows(panel, layoutMetrics), startRows + Math.round((effectiveClientY - startY) / rowStep));
          const nextHeight = gridHeightForRows(nextRows, gap);
          if (collapsedPanelResize) {
            const liveRect = liveResizePreview.getBoundingClientRect();
            updateExpandedFootprintGhost(expandedFootprintGhost, panel, layout, {
              left: liveRect.left,
              top: liveRect.top,
              width: liveRect.width,
              rows: nextRows,
            }, layoutMetrics);
          }
          if (nextSpan === previewSpan && nextHeight === previewHeight) return;
          animateOrderedGridReflow(layout, () => applyResize(nextSpan, nextHeight, nextRows), panel, { items: reflowItems, metrics: layoutMetrics });
        };

        const finishPanelResize = (upEvent, canceled) => {
          if (canceled) {
            restoreGridLayoutSnapshot(resizeStartSnapshot);
          } else {
            animateOrderedGridReflow(layout, () => {
              const currentSpan = previewSpan || Number(panel.dataset.currentSpan) || startSpan;
              const groupedSpan = groupedPanelReleaseSpan(currentSpan, resizePeers.length + 1);
              const snappedSpan = groupedSpan ?? (resizeEdge === "left" ? Math.round(currentSpan) : alignedResizeSpan({
                layout,
                item: resizePreview,
                currentSpan,
                gap: 16,
                minSpan: gridItemMinimumSpan(panel),
                metrics: refreshGridMetricsRect(layoutMetrics),
              }));
              const snappedHeight = collapsedPanelResize
                ? expandedPanelFootprintHeight(panel, layout, previewRows)
                : alignedResizeHeight({
                  layout,
                  item: resizePreview,
                  currentHeight: previewHeight || Number(panel.dataset.savedHeight) || panel.getBoundingClientRect().height,
                  metrics: refreshGridMetricsRect(layoutMetrics),
                });
              const requestedDelta = snappedSpan - startSpan;
              const minDelta = Math.max(...groupResizeItems.map(({ peer, startSpan }) => gridItemMinimumSpan(peer) - startSpan));
              const edgeMaxDelta = resizeEdge === "left" ? startCol - 1 : 6 - startSpan;
              const maxDelta = Math.min(edgeMaxDelta, ...groupResizeItems.map(({ startSpan }) => 6 - startSpan));
              const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
              const finalSpan = startSpan + delta;
              const finalCol = resizeEdge === "left" ? startRightCol - finalSpan + 1 : startCol;
              clearLiveResizeSurface(panel, liveResizePreview);
              restoreGridLayoutSnapshot(resizeStartSnapshot);
              resizePreview.remove();
              expandedFootprintGhost?.remove();
              applyPanelSpan(panel, finalSpan);
              applyPanelHeight(panel, snappedHeight);
              if (resizeEdge === "left") applyPanelGridPosition(panel, finalCol, startRow);
              resizePeers.forEach(({ peer, startSpan: peerStartSpan }) => {
                applyPanelSpan(peer, peerStartSpan + delta);
                applyPanelHeight(peer, Math.max(getPanelMinimumHeight(peer), snappedHeight));
              });
              applyOrderedGridLayout(layout);
            }, panel, { items: reflowItems, metrics: layoutMetrics });
            saveSharedGridLayouts(layout);
            emitWorkspaceEvent({
              type: workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider ? "divider-resized" : "object-resized",
              source: "resize",
              layoutKey,
              objectId: panel.dataset.panelKey || "",
              objectType: workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider ? "divider" : "panel",
              regionId: regionIdForWorkspaceItem(panel),
              label: `${panel.dataset.panelTitle || panel.dataset.defaultTitle || "Panel"} resized`,
              payload: {
                cols: Number(panel.dataset.currentSpan) || 0,
                rows: Number(panel.dataset.gridRowSpan) || 0,
              },
            });
            syncCommittedWorkspaceScrollFloor(layout, {
              preserveViewport: document.body.classList.contains("dashboard-interaction-scroll-extended"),
            });
          }
        };

        beginResizeLifecycle({
          event,
          source: panel,
          layout,
          onMove: onResizeMove,
          onEnd: finishPanelResize,
          onCleanup: () => {
            toolPointerCapture = false;
            resizePreview.remove();
            expandedFootprintGhost?.remove();
            clearLiveResizeSurface(panel, liveResizePreview);
            if (restoreToolsAfterResize) {
              armPanelToolLeaveCloseResume();
              openPanelTools();
            } else {
              closePanelTools();
            }
          },
        });
      };
      resizeHandle?.addEventListener("pointerdown", (event) => beginPanelResize(event, "right"));
      panel.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        if (event.target?.closest?.(".panel-tools, .widget-tools, .panel-color-menu")) return;
        const resizeEdge = resizeEdgeFromPointer(event, panel);
        if (!resizeEdge) return;
        beginPanelResize(event, resizeEdge);
      }, { capture: true });
    };

    panels.forEach(initPanel);
    layout.__initPanel = initPanel;
  });

  [...new Set([
    ...[...document.querySelectorAll(".panel-layout")].map((layout) => layout.dataset.layoutKey || "default"),
  ])].forEach(restoreLoadedExpansionBaseline);

  document.querySelectorAll(".workspace-anchor-layer").forEach(initFloatingAnchorLayer);
  document.querySelectorAll(".workspace-minimap-layer").forEach(initWorkspaceMinimapLayer);
  window.addEventListener("scroll", () => refreshWorkspaceMiniMaps(), { passive: true });
  window.addEventListener("resize", () => refreshWorkspaceMiniMaps(), { passive: true });
  window.dashboardSpatialRuntime = {
    refreshMiniMaps: refreshWorkspaceMiniMaps,
    regionSummaryForWidget: (widgetKey) => workspaceRegionSummaryForItem(widgetKey),
  };
  const canonicalWidgetInstanceForPersistence = (widget, parentPanel = null) => {
    const definition = widgetDefinitionForElement(widget);
    const instance = widgetInstanceFromElement(widget, definition);
    const mediaState = mediaWidgetAssetState(widget, instance.config || {}, definition);
    const config = isMediaWidgetDefinition(definition) ? mediaState.persistedConfig : instance.config || {};
    if (mediaState.changed) setWidgetConfig(widget, config);
    const parentPanelId = parentPanel?.dataset?.panelKey || widget.dataset.parentPanelKey || null;
    return {
      id: instance.id || widget.dataset.widgetKey || "",
      type: instance.type || definition.type || "unsupported",
      layoutDomain: parentPanelId ? "panel-internal-grid" : "global-workspace-grid",
      parentPanelId,
      x: instance.x,
      y: instance.y,
      cols: instance.cols,
      rows: instance.rows,
      config,
      contextOverrideId: instance.contextOverrideId || widget.dataset.contextOverrideId || null,
      color: widget.dataset.panelColor || null,
      title: widget.dataset.panelTitle || instance.config?.title || null,
      pinned: widget.classList.contains("db-panel-pinned"),
      locked: widget.dataset.locked === "true",
      resizable: widget.dataset.resizable === "false" ? false : true,
      minSize: {
        cols: Number(widget.dataset.minW) || definition.minSize?.cols || 1,
        rows: Number(widget.dataset.minH) || definition.minSize?.rows || 1,
      },
      workspaceObjectType: WORKSPACE_OBJECT_TYPES.widget,
      context: workspaceContextFromElement(widget),
    };
  };

  const canonicalPanelInstanceForPersistence = (panel) => {
    const isDivider = workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider;
    const bounds = gridBoundsForItem(panel);
    return {
      id: panel.dataset.panelKey || "",
      type: isDivider ? WORKSPACE_OBJECT_TYPES.divider : WORKSPACE_OBJECT_TYPES.panel,
      layoutDomain: "global-workspace-grid",
      x: bounds.col,
      y: bounds.row,
      cols: bounds.span,
      rows: bounds.rowSpan,
      title: panel.dataset.panelTitle || panel.querySelector(":scope > .db-panel-hd .db-panel-title")?.textContent?.trim() || null,
      color: panel.dataset.panelColor || null,
      collapsed: panel.classList.contains("db-panel-collapsed"),
      pinned: panel.classList.contains("db-panel-pinned"),
      locked: panel.dataset.locked === "true",
      resizable: panel.dataset.resizable === "false" ? false : true,
      savedHeight: panel.dataset.savedHeight ? Number(panel.dataset.savedHeight) : null,
      expansionBaseline: serializableExpansionBaselineState(expansionBaselineSnapshotForLayoutKey(activeLayoutKeyForItem(panel)), panel),
      childWidgetIds: panelChildWidgets(panel).map((widget) => widget.dataset.widgetKey).filter(Boolean),
      context: workspaceContextFromElement(panel),
      ...workspaceObjectPersistence(panel),
    };
  };

  const canonicalAnchorInstanceForPersistence = (anchor) => ({
    id: anchor.dataset.anchorKey || "",
    type: WORKSPACE_OBJECT_TYPES.anchor,
    layoutDomain: "anchor-rail",
    railOrder: Number(anchor.dataset.anchorRailOrder) || 0,
    railY: Number(anchor.dataset.anchorOffset) || ANCHOR_RAIL_START,
    side: "left",
    title: anchor.dataset.anchorTitle || anchor.querySelector(".workspace-anchor-label")?.textContent?.trim() || "Anchor",
    color: anchor.dataset.panelColor || null,
    linkedDividerId: anchor.dataset.linkedDividerId || null,
    navigationTargetType: anchor.dataset.navigationTargetType || (anchor.dataset.linkedDividerId ? "divider" : "workspace-top"),
    navigationTargetId: anchor.dataset.navigationTargetId || null,
    workspaceObjectType: WORKSPACE_OBJECT_TYPES.anchor,
    contextRole: anchor.dataset.contextRole || "navigation-reference",
  });

  const assetReferencesFromWidget = (widgetRecord) => {
    if (!["image", "video", "document"].includes(widgetRecord.type)) return [];
    const assetIdValue = String(widgetRecord.config?.assetId || "").trim();
    if (!assetIdValue) return [];
    return [{
      id: assetIdValue,
      widgetId: widgetRecord.id,
      kind: widgetRecord.type,
      persistence: "registry",
    }];
  };

  const currentTransientPersistenceWarnings = (layoutKey = "builder") => {
    const objectSelector = [
      `.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] .widget-card`,
      `.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel`,
      `.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"] .workspace-anchor-object`,
    ].join(",");
    const warnings = [];
    document.querySelectorAll(objectSelector).forEach((item) => {
      const classes = undoTransientItemClasses.filter((className) => item.classList.contains(className));
      if (!classes.length) return;
      warnings.push({
        severity: "warning",
        code: "transient-object-state",
        objectId: workspaceObjectKey(item),
        objectType: workspaceObjectType(item),
        message: `Transient UI classes are active and will not be persisted: ${classes.join(", ")}`,
      });
    });
    const transientNodes = document.querySelectorAll(
      ".dashboard-live-resize, .dashboard-resize-preview, .dashboard-expanded-footprint-ghost, .dashboard-group-boundary, .dashboard-group-member-preview, .widget-placeholder, .db-panel-placeholder, .workspace-anchor-drag-ghost, .workspace-anchor-rail-placeholder"
    );
    if (transientNodes.length) {
      warnings.push({
        severity: "warning",
        code: "transient-preview-nodes",
        objectId: "",
        objectType: "workspace",
        message: `${transientNodes.length} transient preview node(s) are active and excluded from persistence.`,
      });
    }
    return warnings;
  };

  const currentPersistedWorkspaceSnapshot = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const panelLayout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
    const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
    if (panelLayout) syncWorkspaceRegions(panelLayout);
    if (widgetLayout) syncWorkspaceRegions(widgetLayout);

    const panels = panelLayout
      ? [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")]
          .filter((panel) => workspaceObjectType(panel) !== WORKSPACE_OBJECT_TYPES.divider)
          .map(canonicalPanelInstanceForPersistence)
      : [];
    const dividers = panelLayout
      ? [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")]
          .filter((panel) => workspaceObjectType(panel) === WORKSPACE_OBJECT_TYPES.divider)
          .map(canonicalPanelInstanceForPersistence)
      : [];
    const rootWidgets = widgetLayout
      ? [...widgetLayout.querySelectorAll(":scope > .widget-card:not(.workspace-anchor-object):not([hidden])")]
          .map((widget) => canonicalWidgetInstanceForPersistence(widget, null))
      : [];
    const childWidgets = panelLayout
      ? [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")]
          .flatMap((panel) => panelChildWidgets(panel).map((widget) => canonicalWidgetInstanceForPersistence(widget, panel)))
      : [];
    const widgets = [...rootWidgets, ...childWidgets];
    const anchorLayer = anchorLayerForLayoutKey(layoutKey);
    const anchors = anchorLayer ? anchorRailAnchors(anchorLayer).map(canonicalAnchorInstanceForPersistence) : [];
    const contexts = loadWorkspaceContexts(layoutKey, profile);
    const dataSources = loadDataSources(layoutKey, profile);
    const assets = loadAssets(layoutKey, profile);
    const rawLogicGraph = loadWorkspaceLogicGraph(layoutKey, profile);
    const logicEndpointIds = persistedWorkspaceEndpointIds({
      widgets,
      panels,
      dividers,
      anchors,
      contexts,
      operators: rawLogicGraph.operators,
    });
    const logicGraph = pruneWorkspaceLogicGraphForEndpointIds(rawLogicGraph, logicEndpointIds);
    const objects = [
      ...widgets.map((widget) => ({ id: widget.id, type: WORKSPACE_OBJECT_TYPES.widget, layoutDomain: widget.layoutDomain, parentId: widget.parentPanelId || null })),
      ...panels.map((panel) => ({ id: panel.id, type: WORKSPACE_OBJECT_TYPES.panel, layoutDomain: panel.layoutDomain, parentId: null })),
      ...dividers.map((divider) => ({ id: divider.id, type: WORKSPACE_OBJECT_TYPES.divider, layoutDomain: divider.layoutDomain, parentId: null })),
      ...anchors.map((anchor) => ({ id: anchor.id, type: WORKSPACE_OBJECT_TYPES.anchor, layoutDomain: anchor.layoutDomain, parentId: null })),
      ...logicGraph.operators.map((operator) => ({ id: operator.id, type: "logical-operator", layoutDomain: "logic-overlay", parentId: null })),
    ];
    return {
      version: PERSISTED_WORKSPACE_VERSION,
      layoutKey,
      profile,
      savedAt: new Date().toISOString(),
      objects,
      widgets,
      panels,
      dividers,
      anchors,
      contexts,
      dataSources,
      relationships: logicGraph.relationships,
      operators: logicGraph.operators,
      styleRules: logicGraph.styleRules,
      contextLinks: logicGraph.contextLinks,
      assets,
      assetReferences: widgets.flatMap(assetReferencesFromWidget),
    };
  };

  const knownWidgetRuntimeTypes = () => new Set(
    (widgetRuntime?.listWidgetDefinitions?.() || []).map((definition) => definition.type)
  );

  const validatePersistedWorkspaceSnapshot = (snapshot = currentPersistedWorkspaceSnapshot()) => {
    const diagnostics = [];
    const addDiagnostic = (severity, code, message, objectId = "", objectType = "") => {
      diagnostics.push({ severity, code, message, objectId, objectType });
    };
    const ids = new Map();
    const addId = (type, id) => {
      if (!id) {
        addDiagnostic("error", "missing-object-id", `${type} is missing a stable id.`, "", type);
        return;
      }
      if (ids.has(id)) {
        addDiagnostic("error", "duplicate-object-id", `Duplicate object id "${id}" found for ${type}.`, id, type);
        return;
      }
      ids.set(id, type);
    };
    const panelIds = new Set((snapshot.panels || []).map((panel) => panel.id).filter(Boolean));
    const dividerIds = new Set((snapshot.dividers || []).map((divider) => divider.id).filter(Boolean));
    const assetIds = new Set((snapshot.assets || []).map((asset) => asset.id).filter(Boolean));
    const contextIds = new Set();
    const operatorIds = new Set();
    const widgetTypes = knownWidgetRuntimeTypes();
    (snapshot.widgets || []).forEach((widget) => {
      addId(WORKSPACE_OBJECT_TYPES.widget, widget.id);
      if (!widget.type) addDiagnostic("error", "missing-widget-type", "Widget is missing a runtime type.", widget.id, WORKSPACE_OBJECT_TYPES.widget);
      if (widget.type && !widgetTypes.has(widget.type)) {
        addDiagnostic("warning", "unknown-widget-type", `Widget type "${widget.type}" will render through the unsupported-widget fallback.`, widget.id, WORKSPACE_OBJECT_TYPES.widget);
      }
      if (widget.parentPanelId && !panelIds.has(widget.parentPanelId)) {
        addDiagnostic("error", "missing-parent-panel", `Panel child widget references missing panel "${widget.parentPanelId}".`, widget.id, WORKSPACE_OBJECT_TYPES.widget);
      }
      if (["image", "video", "document"].includes(widget.type) && widget.config?.assetId && !assetIds.has(widget.config.assetId)) {
        addDiagnostic("warning", "missing-asset", `Media widget references missing asset "${widget.config.assetId}".`, widget.id, WORKSPACE_OBJECT_TYPES.widget);
      }
      if (["image", "video", "document"].includes(widget.type) && widget.config?.src) {
        addDiagnostic("warning", "legacy-media-src", "Media widget config still contains a legacy src field; it should migrate to assetId.", widget.id, WORKSPACE_OBJECT_TYPES.widget);
      }
    });
    (snapshot.panels || []).forEach((panel) => addId(WORKSPACE_OBJECT_TYPES.panel, panel.id));
    (snapshot.dividers || []).forEach((divider) => {
      addId(WORKSPACE_OBJECT_TYPES.divider, divider.id);
      if (divider.contextScopeId && !String(divider.contextScopeId).includes(":region:")) {
        addDiagnostic("warning", "divider-context-id-format", "Divider context id does not look like a workspace region id.", divider.id, WORKSPACE_OBJECT_TYPES.divider);
      }
    });
    (snapshot.anchors || []).forEach((anchor) => {
      addId(WORKSPACE_OBJECT_TYPES.anchor, anchor.id);
      if (anchor.linkedDividerId && !dividerIds.has(anchor.linkedDividerId)) {
        addDiagnostic("warning", "missing-linked-divider", `Anchor references missing divider "${anchor.linkedDividerId}" and will fall back to Top.`, anchor.id, WORKSPACE_OBJECT_TYPES.anchor);
      }
      if ("linkedDividerTop" in anchor || "targetTop" in anchor || "scrollTop" in anchor) {
        addDiagnostic("error", "anchor-stores-pixel-target", "Anchor persistence must store divider identity only, not cached pixel coordinates.", anchor.id, WORKSPACE_OBJECT_TYPES.anchor);
      }
    });
    (snapshot.contexts || []).forEach((context) => {
      if (!context?.id) {
        addDiagnostic("error", "missing-context-id", "Workspace context is missing an id.", "", "context");
        return;
      }
      if (contextIds.has(context.id)) addDiagnostic("error", "duplicate-context-id", `Duplicate context id "${context.id}".`, context.id, "context");
      contextIds.add(context.id);
    });
    (snapshot.assets || []).forEach((asset) => {
      addId("asset", asset.id);
      if (asset.source?.kind === "blob-url" || String(asset.source?.ref || "").startsWith("blob:")) {
        addDiagnostic("warning", "temporary-asset-reference", "Temporary blob URLs are not durable saved asset references.", asset.id, "asset");
      }
    });
    (snapshot.operators || []).forEach((operator) => {
      addId("logical-operator", operator.id);
      operatorIds.add(operator.id);
      if (!Object.values(LOGICAL_OPERATOR_TYPES).includes(operator.operatorType)) {
        addDiagnostic("error", "invalid-logical-operator", `Unsupported logical operator "${operator.operatorType}".`, operator.id, "logical-operator");
      }
    });
    const relationshipEndpointIds = new Set([
      ...(snapshot.widgets || []).map((widget) => widget.id),
      ...(snapshot.panels || []).map((panel) => panel.id),
      ...(snapshot.dividers || []).map((divider) => divider.id),
      ...(snapshot.anchors || []).map((anchor) => anchor.id),
      ...operatorIds,
      ...(snapshot.contexts || []).map((context) => context.id),
    ].filter(Boolean));
    (snapshot.relationships || []).forEach((relationship) => {
      addId("relationship", relationship.id);
      if (!relationship.sourceId || !relationship.targetId) {
        addDiagnostic("error", "relationship-missing-endpoint", "Relationship must include both sourceId and targetId.", relationship.id, "relationship");
      }
      if (relationship.type && !Object.values(WORKSPACE_RELATIONSHIP_TYPES).includes(relationship.type)) {
        addDiagnostic("error", "invalid-relationship-type", `Unsupported relationship type "${relationship.type}".`, relationship.id, "relationship");
      }
      if (relationship.sourceId && !relationshipEndpointIds.has(relationship.sourceId)) {
        addDiagnostic("warning", "missing-relationship-source", `Relationship source "${relationship.sourceId}" is not present in persisted objects.`, relationship.id, "relationship");
      }
      if (relationship.targetId && !relationshipEndpointIds.has(relationship.targetId)) {
        addDiagnostic("warning", "missing-relationship-target", `Relationship target "${relationship.targetId}" is not present in persisted objects.`, relationship.id, "relationship");
      }
    });
    (snapshot.contextLinks || []).forEach((link) => {
      addId("context-link", link.id);
      if (!link.sourceObjectId || !link.targetObjectId) {
        addDiagnostic("error", "context-link-missing-endpoint", "Context link must include both sourceObjectId and targetObjectId.", link.id, "context-link");
      }
      if (link.sourceObjectId === link.targetObjectId) {
        addDiagnostic("error", "context-link-self-cycle", "Context link source and target must be different objects.", link.id, "context-link");
      }
      if (link.mode && !Object.values(CONTEXT_LINK_MODES).includes(link.mode)) {
        addDiagnostic("error", "invalid-context-link-mode", `Unsupported context link mode "${link.mode}".`, link.id, "context-link");
      }
      if (link.sourceObjectId && !relationshipEndpointIds.has(link.sourceObjectId)) {
        addDiagnostic("warning", "missing-context-link-source", `Context link source "${link.sourceObjectId}" is not present in persisted objects.`, link.id, "context-link");
      }
      if (link.targetObjectId && !relationshipEndpointIds.has(link.targetObjectId)) {
        addDiagnostic("warning", "missing-context-link-target", `Context link target "${link.targetObjectId}" is not present in persisted objects.`, link.id, "context-link");
      }
    });
    const styleRuleProperties = new Set(Object.values(STYLE_RULE_EFFECT_PROPERTIES));
    (snapshot.styleRules || []).forEach((rule) => {
      addId("style-rule", rule.id);
      if (!rule.targetObjectId) {
        addDiagnostic("error", "style-rule-missing-target", "Style rule must include a target object id.", rule.id, "style-rule");
      } else if (!relationshipEndpointIds.has(rule.targetObjectId)) {
        addDiagnostic("warning", "missing-style-rule-target", `Style rule target "${rule.targetObjectId}" is not present in persisted objects.`, rule.id, "style-rule");
      }
      if (!rule.condition || typeof rule.condition !== "object") {
        addDiagnostic("error", "style-rule-missing-condition", "Style rule must include a logic condition.", rule.id, "style-rule");
      }
      if (!Array.isArray(rule.effects) || !rule.effects.length) {
        addDiagnostic("error", "style-rule-missing-effects", "Style rule must include at least one visual effect.", rule.id, "style-rule");
      } else {
        rule.effects.forEach((effect) => {
          if (!styleRuleProperties.has(effect.property)) {
            addDiagnostic("error", "invalid-style-rule-effect", `Unsupported style effect "${effect.property}".`, rule.id, "style-rule");
          }
        });
      }
    });
    currentTransientPersistenceWarnings(snapshot.layoutKey).forEach((warning) => diagnostics.push(warning));
    const errors = diagnostics.filter((entry) => entry.severity === "error");
    const warnings = diagnostics.filter((entry) => entry.severity !== "error");
    return {
      ok: errors.length === 0,
      version: snapshot.version || 0,
      layoutKey: snapshot.layoutKey || "builder",
      profile: snapshot.profile || getActivePanelProfile(snapshot.layoutKey || "builder"),
      errors,
      warnings,
      diagnostics,
    };
  };

  const savePersistedWorkspaceSnapshot = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const snapshot = currentPersistedWorkspaceSnapshot(layoutKey, profile);
    writeJsonStore(persistedWorkspaceKey(layoutKey, profile), snapshot);
    return snapshot;
  };

  const loadPersistedWorkspaceSnapshot = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const saved = readJsonStore(persistedWorkspaceKey(layoutKey, profile), null);
    if (!saved || Number(saved.version) !== PERSISTED_WORKSPACE_VERSION) return currentPersistedWorkspaceSnapshot(layoutKey, profile);
    const logicGraph = pruneWorkspaceLogicGraphForEndpointIds(
      workspaceLogicGraphFromPersistedSnapshot(saved),
      persistedWorkspaceEndpointIds(saved)
    );
    const hydrated = {
      ...saved,
      relationships: logicGraph.relationships,
      operators: logicGraph.operators,
      styleRules: logicGraph.styleRules,
      contextLinks: logicGraph.contextLinks,
    };
    writeJsonStore(workspaceLogicGraphKey(layoutKey, profile), logicGraph);
    writeJsonStore(persistedWorkspaceKey(layoutKey, profile), hydrated);
    refreshResolvedContextDebug(layoutKey, profile);
    refreshEngineerOverlays();
    return hydrated;
  };

  const migratePersistedWorkspaceSnapshot = (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => {
    const saved = readJsonStore(persistedWorkspaceKey(layoutKey, profile), null);
    if (saved && Number(saved.version) === PERSISTED_WORKSPACE_VERSION) return saved;
    return savePersistedWorkspaceSnapshot(layoutKey, profile);
  };

  window.dashboardPersistenceRuntime = {
    version: PERSISTED_WORKSPACE_VERSION,
    keyForLayout: persistedWorkspaceKey,
    snapshot: currentPersistedWorkspaceSnapshot,
    saveSnapshot: savePersistedWorkspaceSnapshot,
    loadSnapshot: loadPersistedWorkspaceSnapshot,
    migrateLegacyLayout: migratePersistedWorkspaceSnapshot,
    validate: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
      validatePersistedWorkspaceSnapshot(currentPersistedWorkspaceSnapshot(layoutKey, profile)),
    validateSnapshot: validatePersistedWorkspaceSnapshot,
  };

  const logicEditAllowed = (options = {}) => isEngineerMode() || options.force === true;
  const normalizedOperatorCondition = (operator) => ({
    id: operator.id,
    operator: String(operator.operatorType || "AND").toLowerCase(),
    inputs: [...(operator.inputs || [])],
    outputs: [...(operator.outputs || [])],
  });
  window.dashboardRelationshipRuntime = {
    types: () => ({ ...WORKSPACE_RELATIONSHIP_TYPES }),
    operatorTypes: () => ({ ...LOGICAL_OPERATOR_TYPES }),
    getGraph: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => loadWorkspaceLogicGraph(layoutKey, profile),
    setGraph: (layoutKey = "builder", graph = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return loadWorkspaceLogicGraph(layoutKey, profile);
      return saveWorkspaceLogicGraph(layoutKey, graph, profile, options);
    },
    relationships: (layoutKey = "builder", options = {}) => {
      const graph = loadWorkspaceLogicGraph(layoutKey, options.profile || getActivePanelProfile(layoutKey));
      return options.derived === false ? graph.relationships : deriveWorkspaceRelationships(layoutKey, graph);
    },
    contextLinkModes: () => ({ ...CONTEXT_LINK_MODES }),
    contextLinks: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
      loadWorkspaceLogicGraph(layoutKey, profile).contextLinks,
    addContextLink: (layoutKey = "builder", link = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return null;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const next = normalizeContextLink(link);
      if (!next.sourceObjectId || !next.targetObjectId || next.sourceObjectId === next.targetObjectId) return null;
      const candidateLinks = graph.contextLinks.filter((entry) => entry.id !== next.id);
      const cycleCheck = [...candidateLinks, next];
      const reachesSource = (currentId, targetId, visited = new Set()) => {
        if (currentId === targetId) return true;
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        return cycleCheck
          .filter((entry) => entry.targetObjectId === currentId && entry.enabled !== false)
          .some((entry) => reachesSource(entry.sourceObjectId, targetId, visited));
      };
      if (reachesSource(next.sourceObjectId, next.targetObjectId)) return null;
      const contextLinks = candidateLinks.filter((entry) => !(entry.sourceObjectId === next.sourceObjectId && entry.targetObjectId === next.targetObjectId && entry.mode === next.mode));
      contextLinks.push(next);
      saveWorkspaceLogicGraph(layoutKey, { ...graph, contextLinks }, profile, options);
      return next;
    },
    updateContextLink: (layoutKey = "builder", linkId = "", patch = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return null;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const contextLinks = graph.contextLinks.map((link) => link.id === linkId
        ? normalizeContextLink({ ...link, ...patch, id: link.id })
        : link);
      const updated = contextLinks.find((link) => link.id === linkId) || null;
      if (!updated || updated.sourceObjectId === updated.targetObjectId) return null;
      const reachesSource = (currentId, targetId, visited = new Set()) => {
        if (currentId === targetId) return true;
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        return contextLinks
          .filter((entry) => entry.id !== updated.id && entry.targetObjectId === currentId && entry.enabled !== false)
          .some((entry) => reachesSource(entry.sourceObjectId, targetId, visited));
      };
      if (reachesSource(updated.sourceObjectId, updated.targetObjectId)) return null;
      saveWorkspaceLogicGraph(layoutKey, { ...graph, contextLinks }, profile, options);
      return updated;
    },
    removeContextLink: (layoutKey = "builder", linkId = "", profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return false;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const contextLinks = graph.contextLinks.filter((link) => link.id !== linkId);
      if (contextLinks.length === graph.contextLinks.length) return false;
      saveWorkspaceLogicGraph(layoutKey, { ...graph, contextLinks }, profile, options);
      return true;
    },
    addRelationship: (layoutKey = "builder", relationship = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return null;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const next = normalizeWorkspaceRelationship(relationship);
      const relationships = graph.relationships.filter((entry) => entry.id !== next.id);
      relationships.push(next);
      saveWorkspaceLogicGraph(layoutKey, { ...graph, relationships }, profile, options);
      return next;
    },
    removeRelationship: (layoutKey = "builder", relationshipId = "", profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return false;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const relationships = graph.relationships.filter((entry) => entry.id !== relationshipId);
      if (relationships.length === graph.relationships.length) return false;
      saveWorkspaceLogicGraph(layoutKey, { ...graph, relationships }, profile, options);
      return true;
    },
    styleRules: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
      loadWorkspaceLogicGraph(layoutKey, profile).styleRules,
    addStyleRule: (layoutKey = "builder", rule = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return null;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const next = normalizeStyleRule(rule);
      if (!next.targetObjectId || !next.effects.length) return null;
      const styleRules = graph.styleRules.filter((entry) => entry.id !== next.id);
      styleRules.push(next);
      saveWorkspaceLogicGraph(layoutKey, { ...graph, styleRules }, profile, options);
      return next;
    },
    updateStyleRule: (layoutKey = "builder", ruleId = "", patch = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return null;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const styleRules = graph.styleRules.map((rule) => rule.id === ruleId
        ? normalizeStyleRule({ ...rule, ...patch, id: rule.id })
        : rule);
      const updated = styleRules.find((rule) => rule.id === ruleId) || null;
      if (!updated) return null;
      saveWorkspaceLogicGraph(layoutKey, { ...graph, styleRules }, profile, options);
      return updated;
    },
    removeStyleRule: (layoutKey = "builder", ruleId = "", profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return false;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const styleRules = graph.styleRules.filter((rule) => rule.id !== ruleId);
      if (styleRules.length === graph.styleRules.length) return false;
      saveWorkspaceLogicGraph(layoutKey, { ...graph, styleRules }, profile, options);
      return true;
    },
    evaluateStyleRulesForWidget: (widget, options = {}) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      return node ? applyStyleRulesForWidget(node, options).map((rule) => rule.id) : [];
    },
    addOperator: (layoutKey = "builder", operator = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return null;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const node = normalizeLogicalOperatorNode(operator);
      saveWorkspaceLogicGraph(layoutKey, { ...graph, operators: [...graph.operators, node] }, profile, options);
      return node;
    },
    updateOperator: (layoutKey = "builder", operatorId = "", patch = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return null;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const operators = graph.operators.map((operator) => operator.id === operatorId
        ? normalizeLogicalOperatorNode({ ...operator, ...patch, id: operator.id })
        : operator);
      const updated = operators.find((operator) => operator.id === operatorId) || null;
      if (!updated) return null;
      saveWorkspaceLogicGraph(layoutKey, { ...graph, operators }, profile, options);
      return updated;
    },
    connectOperator: (layoutKey = "builder", operatorId = "", { inputs = [], outputs = [] } = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
      if (!logicEditAllowed(options)) return null;
      const graph = loadWorkspaceLogicGraph(layoutKey, profile);
      const operators = graph.operators.map((operator) => operator.id === operatorId
        ? normalizeLogicalOperatorNode({
          ...operator,
          inputs: [...new Set([...(operator.inputs || []), ...inputs.map(String).filter(Boolean)])],
          outputs: [...new Set([...(operator.outputs || []), ...outputs.map(String).filter(Boolean)])],
        })
        : operator);
      const updated = operators.find((operator) => operator.id === operatorId) || null;
      if (!updated) return null;
      saveWorkspaceLogicGraph(layoutKey, { ...graph, operators }, profile, options);
      return updated;
    },
    operatorConditions: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) =>
      loadWorkspaceLogicGraph(layoutKey, profile).operators.map(normalizedOperatorCondition),
    refresh: (layoutKey = "builder") => {
      refreshResolvedContextDebug(layoutKey, getActivePanelProfile(layoutKey));
      refreshEngineerOverlays();
      return deriveWorkspaceRelationships(layoutKey, loadWorkspaceLogicGraph(layoutKey));
    },
  };

  const selectedWorkspaceObjectSummary = () => {
    const selected = selectedGroupItems(null);
    const active = document.querySelector(".widget-tools-open, .db-panel-tools-open, .workspace-anchor-object.anchor-tools-open") ||
      document.activeElement?.closest?.(".widget-card, .db-panel, .workspace-anchor-object") ||
      selected[0] || null;
    if (!active) return null;
    return {
      id: active.dataset.widgetKey || active.dataset.panelKey || active.dataset.anchorKey || "",
      type: workspaceObjectType(active),
      label: active.dataset.panelTitle || active.dataset.widgetDisplayName || active.querySelector?.(".stat-lbl, .db-panel-title")?.textContent?.trim() || "Workspace object",
      regionId: active.classList.contains("workspace-anchor-object") ? "" : regionIdForWorkspaceItem(active),
      selectionCount: selected.length,
    };
  };
  const currentContextInspectorSnapshot = ({ instanceId = "", target = "currentRegion", resolvedContext = null } = {}) => {
    const widget = instanceId ? document.querySelector(`.widget-card[data-widget-key="${CSS.escape(instanceId)}"]`) : null;
    const layoutKey = widget ? activeLayoutKeyForItem(widget) : "builder";
    const context = resolvedContext || (widget ? resolveWorkspaceContextForItem(widget) : mergeWorkspaceContexts(
      contextById(layoutKey, getActivePanelProfile(layoutKey), workspaceRootRegionId(layoutKey))
    ));
    const selectedObject = selectedWorkspaceObjectSummary();
    const regionSummary = widget
      ? workspaceRegionSummaryForItem(widget)
      : workspaceRegionSummaryForItem(null, { layoutKey });
    const persistenceValidation = validatePersistedWorkspaceSnapshot(currentPersistedWorkspaceSnapshot(layoutKey, getActivePanelProfile(layoutKey)));
    return {
      engineerMode: isEngineerMode(),
      target,
      layoutKey,
      objectId: widget?.dataset.widgetKey || "",
      objectKind: widget?.dataset.dashboardObjectKind || "",
      selectedObject,
      region: regionSummary,
      context: {
        id: context?.id || "",
        name: context?.name || "",
        regionId: context?.regionId || regionSummary?.id || "",
        dataSourceId: context?.dataSourceId || "",
        dataSourceName: context?.dataSourceName || "",
        filters: Array.isArray(context?.filters) ? context.filters : [],
        timeRange: context?.timeRange || null,
        tags: Array.isArray(context?.tags) ? context.tags : [],
        semanticMapping: context?.semanticMapping || {},
      },
      regions: deriveWorkspaceContextRegions(layoutKey).map((region) => ({
        id: region.id,
        label: regionLabelForSummary(region.id, layoutKey),
        startRow: region.startRow,
        endRow: region.endRow,
      })),
      persistence: {
        version: persistenceValidation.version,
        ok: persistenceValidation.ok,
        errors: persistenceValidation.errors,
        warnings: persistenceValidation.warnings.slice(0, 12),
      },
    };
  };
  window.dashboardEngineerMode = {
    isEnabled: isEngineerMode,
    getState: () => ({ ...engineerModeState }),
    set: (enabled) => setEngineerMode(Boolean(enabled), { source: "api" }),
    toggle: () => toggleEngineerMode(),
    onChange: onEngineerModeChange,
    refresh: () => {
      refreshEngineerContextVisibility();
      return { ...engineerModeState };
    },
  };
  window.dashboardMetaRuntime = {
    isEngineerMode,
    recordActivity: recordWorkspaceActivity,
    recentActivity: (options = {}) => {
      const maxItems = Math.max(1, Math.min(20, Number(options.maxItems) || 8));
      const filtered = recentWorkspaceEvents({ ...options, maxItems });
      return (filtered.length ? filtered : [{
        id: "activity-workspace-ready",
        type: "workspace-update",
        label: "Workspace ready",
        detail: "Local activity will appear here",
        layoutKey: "builder",
        regionId: "",
        time: new Date().toISOString(),
      }]).slice(0, maxItems);
    },
    assistantScope: ({ scope = "region", instanceId = "", resolvedContext = null } = {}) => {
      const widget = instanceId ? document.querySelector(`.widget-card[data-widget-key="${CSS.escape(instanceId)}"]`) : null;
      const context = resolvedContext || (widget ? resolveWorkspaceContextForItem(widget) : null);
      const region = widget ? workspaceRegionSummaryForItem(widget) : null;
      const selectedObject = selectedWorkspaceObjectSummary();
      const scopedObject = scope === "selection" ? selectedObject : scope === "panel" ? widget?.closest(".db-panel") : null;
      return {
        scope,
        regionLabel: region?.label || context?.name || "Workspace",
        dataSourceId: context?.dataSourceId || "",
        dataSourceName: context?.dataSourceName || "",
        filters: Array.isArray(context?.filters) ? context.filters : [],
        timeRange: context?.timeRange || null,
        selectedObject,
        scopedObjectLabel: scopedObject?.dataset?.panelTitle || scopedObject?.querySelector?.(".db-panel-title")?.textContent?.trim() || "",
      };
    },
    contextSnapshot: currentContextInspectorSnapshot,
    selectedObject: selectedWorkspaceObjectSummary,
  };
  window.dashboardWorkspaceEvents = {
    emit: emitWorkspaceEvent,
    on: onWorkspaceEvent,
    subscribe: onWorkspaceEvent,
    recent: recentWorkspaceEvents,
    history: () => [...workspaceEvents],
    clear: () => {
      workspaceEvents.splice(0);
      scheduleWorkspaceMetaRefresh();
    },
    configure: ({ retention } = {}) => {
      if (Number.isFinite(Number(retention))) {
        workspaceEventRetention = Math.max(1, Math.min(1000, Number(retention)));
        workspaceEvents.splice(workspaceEventRetention);
      }
      return { retention: workspaceEventRetention };
    },
    retention: () => workspaceEventRetention,
  };

  const bindRangeCustomControls = (root = document) => {
    root.querySelectorAll(".range-custom").forEach((form) => {
      if (form.dataset.rangeCustomBound === "true") return;
      form.dataset.rangeCustomBound = "true";
      const startInput = form.querySelector('input[name="start"]');
      const endInput = form.querySelector('input[name="end"]');
      const trigger = form.querySelector(".range-custom-trigger");
      const openPicker = (input) => {
        if (!input) return;
        if (typeof input.showPicker === "function") {
          input.showPicker();
        } else {
          input.focus();
          input.click();
        }
      };
      trigger?.addEventListener("click", () => {
        form.dataset.pickingRange = "start";
        openPicker(startInput);
      });
      startInput?.addEventListener("change", () => {
        form.dataset.pickingRange = "end";
        window.setTimeout(() => openPicker(endInput), 120);
      });
      endInput?.addEventListener("change", () => {
        const start = startInput?.value;
        const end = endInput?.value;
        if (start && end) {
          form.classList.add("range-complete");
          form.requestSubmit();
        }
      });
    });
  };

  const bindDashboardKeywordForms = (root = document) => {
    root.querySelectorAll(".range-search").forEach((form) => {
      if (form.dataset.keywordSearchBound === "true") return;
      form.dataset.keywordSearchBound = "true";
      const input = form.querySelector(".range-search-input");
      if (!input) return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        applyDashboardKeywordSearch(input);
      });
      input.addEventListener("input", () => applyDashboardKeywordSearch(input));
      applyDashboardKeywordSearch(input);
    });
  };
  bindDashboardKeywordForms();

  const updatePanelFromFetchedPanel = (panel, nextPanel) => {
    const nextTitle = nextPanel.querySelector(".db-panel-title");
    const title = panel.querySelector(".db-panel-title");
    if (title && nextTitle && !panel.dataset.panelTitle) title.textContent = nextTitle.textContent;
    const nextCount = nextPanel.querySelector(".db-panel-count");
    const count = panel.querySelector(".db-panel-count");
    if (count && nextCount) {
      count.textContent = nextCount.textContent;
      panel.dataset.originalPanelCount = nextCount.textContent.trim();
    }
    const nextBody = nextPanel.querySelector(".db-panel-body");
    const body = panel.querySelector(".db-panel-body");
    if (body && nextBody) {
      body.className = nextBody.className;
      body.innerHTML = nextBody.innerHTML;
    }
  };

  const replaceDashboardFilterContent = (nextDocument) => {
    nextDocument.querySelectorAll(".widget-layout").forEach((nextLayout) => {
      const key = nextLayout.dataset.widgetLayoutKey || "default";
      const layout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(key)}"]`);
      if (!layout) return;
      layout.replaceWith(nextLayout);
      initWidgetLayout(nextLayout);
      bindRangeCustomControls(nextLayout);
      bindDashboardKeywordForms(nextLayout);
    });

    nextDocument.querySelectorAll(".panel-layout").forEach((nextLayout) => {
      const key = nextLayout.dataset.layoutKey || "default";
      const layout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(key)}"]`);
      if (!layout) return;
      nextLayout.querySelectorAll(":scope > .db-panel").forEach((nextPanel) => {
        const panelKey = nextPanel.dataset.panelKey;
        if (!panelKey) return;
        const panel = layout.querySelector(`:scope > .db-panel[data-panel-key="${CSS.escape(panelKey)}"]`);
        if (panel) updatePanelFromFetchedPanel(panel, nextPanel);
      });
    });

    restoreGroupSelection();
    scheduleOverflowTitles();
  };

  const loadDashboardFilter = async (url, { push = true } = {}) => {
    document.body.classList.add("dashboard-filter-loading");
    try {
      const response = await fetch(url, {
        headers: { "X-Requested-With": "fetch" },
      });
      if (!response.ok) throw new Error("Filter request failed");
      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, "text/html");
      replaceDashboardFilterContent(nextDocument);
      if (push) window.history.pushState({ dashboardFilterUrl: url }, "", url);
    } catch (error) {
      window.location.href = url;
    } finally {
      document.body.classList.remove("dashboard-filter-loading");
    }
  };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const filterTarget = event.target?.closest?.(".widget-card[data-widget-type='tracker'], .range-bar a[href]");
    if (!filterTarget || filterTarget.closest(".widget-tools")) return;
    const href = filterTarget.getAttribute("href");
    if (!href) return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname !== "/dashboard" && url.pathname !== "/") return;
    event.preventDefault();
    loadDashboardFilter(url.toString());
  });

  document.addEventListener("submit", (event) => {
    const form = event.target?.closest?.(".range-custom");
    if (!form) return;
    const action = form.getAttribute("action") || window.location.pathname;
    const url = new URL(action, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname !== "/dashboard" && url.pathname !== "/") return;
    event.preventDefault();
    const params = new URLSearchParams(new FormData(form));
    url.search = params.toString();
    loadDashboardFilter(url.toString());
  });

  window.addEventListener("popstate", () => {
    if (window.location.pathname !== "/dashboard" && window.location.pathname !== "/") return;
    loadDashboardFilter(window.location.href, { push: false });
  });

  [...new Set([
    ...[...document.querySelectorAll(".panel-layout")].map((layout) => layout.dataset.layoutKey || "default"),
    ...[...document.querySelectorAll(".widget-layout")].map((layout) => layout.dataset.widgetLayoutKey || "default"),
  ])].forEach((layoutKey) => pushLiveLayoutUndo(layoutKey));

  window.dashboardContextEngine = {
    registerAdapter: registerDataSourceAdapter,
    adapters: () => [...dataSourceAdapters.keys()],
    setDataSources: (layoutKey = "builder", sources = [], profile = getActivePanelProfile(layoutKey)) => {
      saveDataSources(layoutKey, profile, sources);
      invalidateManagedWidgetQueriesForLayout(layoutKey);
      refreshResolvedContextDebug(layoutKey, profile);
      pushLiveLayoutUndo(layoutKey, profile);
      emitWorkspaceEvent({
        type: "context-changed",
        source: "context-engine",
        layoutKey,
        label: "Data sources changed",
        payload: { profile, dataSourceCount: Array.isArray(sources) ? sources.length : 0 },
      });
      return loadDataSources(layoutKey, profile);
    },
    getDataSources: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => loadDataSources(layoutKey, profile),
    setWorkspaceContexts: (layoutKey = "builder", contexts = [], profile = getActivePanelProfile(layoutKey)) => {
      saveWorkspaceContexts(layoutKey, profile, contexts);
      invalidateManagedWidgetQueriesForLayout(layoutKey);
      refreshResolvedContextDebug(layoutKey, profile);
      pushLiveLayoutUndo(layoutKey, profile);
      emitWorkspaceEvent({
        type: "context-changed",
        source: "context-engine",
        layoutKey,
        label: "Workspace contexts changed",
        payload: { profile, contextCount: Array.isArray(contexts) ? contexts.length : 0 },
      });
      return loadWorkspaceContexts(layoutKey, profile);
    },
    setWorkspaceContext: (layoutKey = "builder", context, profile = getActivePanelProfile(layoutKey)) => {
      const contexts = loadWorkspaceContexts(layoutKey, profile).filter((entry) => entry.id !== context?.id);
      if (context?.id) contexts.push(context);
      saveWorkspaceContexts(layoutKey, profile, contexts);
      invalidateManagedWidgetQueriesForLayout(layoutKey);
      refreshResolvedContextDebug(layoutKey, profile);
      pushLiveLayoutUndo(layoutKey, profile);
      emitWorkspaceEvent({
        type: "context-changed",
        source: "context-engine",
        layoutKey,
        regionId: context?.id || "",
        label: "Workspace context changed",
        payload: { profile, contextId: context?.id || "" },
      });
      return context;
    },
    getWorkspaceContexts: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => loadWorkspaceContexts(layoutKey, profile),
    assignContextToDivider: (divider, context, profile = null) => {
      const node = typeof divider === "string" ? document.querySelector(divider) : divider;
      if (!node) return null;
      ensureWorkspaceObjectMetadata(node);
      const layoutKey = activeLayoutKeyForItem(node);
      const resolvedProfile = profile || getActivePanelProfile(layoutKey);
      const regionId = workspaceRegionIdForDivider(node, layoutKey);
      const nextContext = { ...context, id: regionId, name: context?.name || node.dataset.defaultTitle || "Workspace context" };
      applyWorkspaceContextToElement(node, nextContext);
      invalidateManagedWidgetQueriesForLayout(layoutKey);
      saveWorkspaceContextState(layoutKey, resolvedProfile);
      emitWorkspaceEvent({
        type: "divider-context-changed",
        source: "context-engine",
        layoutKey,
        objectId: node.dataset.panelKey || "",
        objectType: "divider",
        regionId,
        label: "Divider context changed",
        payload: { profile: resolvedProfile, contextId: regionId },
      });
      return nextContext;
    },
    resolveContextForElement: (item) => resolveWorkspaceContextForItem(typeof item === "string" ? document.querySelector(item) : item),
    deriveContextRegions: (layoutKey = "builder") => deriveWorkspaceContextRegions(layoutKey),
    getNearestDividerAbove: (value, layoutKey = "builder") => {
      const entry = nearestDividerAboveCommittedRow(value, layoutKey);
      return entry ? {
        divider: entry.divider,
        key: entry.key,
        regionId: entry.regionId,
        row: entry.bounds.row,
        col: entry.bounds.col,
        rowSpan: entry.bounds.rowSpan,
        colSpan: entry.bounds.colSpan,
      } : null;
    },
    resolveRegionForY: (value, layoutKey = "builder") => resolveWorkspaceRegionForY(value, layoutKey),
    resolveObjectContext: (item) => resolveWorkspaceContextForItem(typeof item === "string" ? document.querySelector(item) : item),
    mergeContext: (inheritedContext, localOverride) => mergeWorkspaceContexts(inheritedContext, localOverride),
    queryContext: (context, request = {}) => queryResolvedWorkspaceContext(context, request),
    queryWidget: (widget, request = {}) => {
      const node = typeof widget === "string" ? document.querySelector(widget) : widget;
      return queryResolvedWorkspaceContext(resolveWorkspaceContextForItem(node), request);
    },
    introspectContext: async (context) => {
      const source = dataSourceById(context.layoutKey, context.profile, context.dataSourceId);
      const adapter = source ? dataSourceAdapters.get(source.kind) : null;
      return adapter ? adapter.introspect(source) : { fields: [] };
    },
    refresh: (layoutKey = "builder", profile = getActivePanelProfile(layoutKey)) => refreshResolvedContextDebug(layoutKey, profile),
  };
  document.querySelectorAll(".panel-layout").forEach((layout) => {
    const layoutKey = layout.dataset.layoutKey || "default";
    refreshResolvedContextDebug(layoutKey, getActivePanelProfile(layoutKey));
  });
  window.addEventListener("scroll", () => scheduleWorkspaceVisualLodRefresh(), { passive: true });
  window.addEventListener("resize", () => scheduleWorkspaceVisualLodRefresh(), { passive: true });
  document.addEventListener("focusin", () => scheduleWorkspaceVisualLodRefresh(), true);
  document.addEventListener("focusout", () => scheduleWorkspaceVisualLodRefresh(), true);
  window.dashboardPerformanceEngine = {
    refreshVisualLod: () => syncWorkspaceVisualLod(),
    visualLodForElement: (item) => {
      const node = typeof item === "string" ? document.querySelector(item) : item;
      return node ? workspaceVisualLodForItem(node) : null;
    },
    collisionCandidatesForBounds: (bounds, occupied = []) => indexedCollisionEntries(bounds, occupied).length,
  };
  scheduleWorkspaceVisualLodRefresh();

  const activeLayoutSlot = (layoutKey) => {
    return document.querySelector(`.layout-slot-trigger[data-layout-target="${CSS.escape(layoutKey)}"]`)?.dataset.currentSlot || getActivePanelProfile(layoutKey);
  };

  document.querySelectorAll(".layout-slot-picker").forEach((picker) => {
    const layoutKey = picker.dataset.layoutTarget || "default";
    const trigger = picker.querySelector(".layout-slot-trigger");
    const triggerLabel = trigger?.querySelector(".layout-slot-label");
    const menu = picker.querySelector(".layout-slot-menu");
    const activeSlot = getActivePanelProfile(layoutKey);
    if (trigger) {
      trigger.dataset.layoutTarget = layoutKey;
      trigger.dataset.currentSlot = activeSlot;
      if (triggerLabel) triggerLabel.textContent = `Layout ${activeSlot}`;
      else trigger.textContent = `Layout ${activeSlot}`;
    }
    menu?.querySelectorAll("[data-slot]").forEach((option) => {
      option.classList.toggle("is-active", option.dataset.slot === activeSlot);
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const slot = option.dataset.slot || "1";
        if (trigger) {
          trigger.dataset.currentSlot = slot;
          const label = trigger.querySelector(".layout-slot-label");
          if (label) label.textContent = `Layout ${slot}`;
          else trigger.textContent = `Layout ${slot}`;
          trigger.setAttribute("aria-expanded", "false");
        }
        menu.classList.remove("open");
        menu.querySelectorAll("[data-slot]").forEach((item) => item.classList.toggle("is-active", item.dataset.slot === slot));
      });
    });
    let closeTimer;
    const openMenu = () => {
      window.clearTimeout(closeTimer);
      menu?.classList.add("open");
      trigger?.setAttribute("aria-expanded", "true");
    };
    const scheduleClose = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        closeMenu();
      }, 140);
    };
    const closeMenu = () => {
      window.clearTimeout(closeTimer);
      menu?.classList.remove("open");
      trigger?.setAttribute("aria-expanded", "false");
    };
    picker.addEventListener("mouseenter", openMenu);
    picker.addEventListener("mouseleave", scheduleClose);
    trigger?.addEventListener("focus", openMenu);
    trigger?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMenu();
    });
    menu?.addEventListener("pointerenter", (event) => {
      const group = event.target?.closest?.(".object-add-category, .object-add-subcategory");
      if (!group || !menu.contains(group)) return;
      setObjectAddSubmenuOpen(group, true);
    }, true);
    menu?.addEventListener("focusin", (event) => {
      const group = event.target?.closest?.(".object-add-category, .object-add-subcategory");
      if (!group || !menu.contains(group)) return;
      setObjectAddSubmenuOpen(group, true);
    });
    menu?.addEventListener("click", (event) => {
      const triggerButton = event.target?.closest?.(".object-add-category-trigger, .object-add-subcategory-trigger");
      if (!triggerButton || !menu.contains(triggerButton)) return;
      event.preventDefault();
      event.stopPropagation();
      const group = triggerButton.closest(".object-add-category, .object-add-subcategory");
      const willOpen = !group.classList.contains("is-open");
      const scope = group.parentElement;
      scope?.querySelectorAll?.(":scope > .object-add-category.is-open, :scope > .object-add-subcategory.is-open")
        .forEach((openGroup) => {
          if (openGroup !== group) setObjectAddSubmenuOpen(openGroup, false);
        });
      setObjectAddSubmenuOpen(group, willOpen);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!picker.contains(event.target)) closeMenu();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  });

  document.querySelectorAll(".layout-load-button").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.layoutTarget || "default";
      const selected = activeLayoutSlot(layoutKey) || "1";
      try {
        localStorage.setItem(`${panelProfilePrefix}${layoutKey}`, selected);
      } catch {}
      showToast(`Loading layout ${selected}.`, "info", {
        type: "layout-load-completed",
        source: "layout-load",
        layoutKey,
        payload: { profile: selected },
      });
      window.location.reload();
    });
  });

  document.querySelectorAll(".layout-save-button").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.layoutTarget || "default";
      const selected = activeLayoutSlot(layoutKey) || "1";
      const currentProfile = getActivePanelProfile(layoutKey);
      const currentDataSources = loadDataSources(layoutKey, currentProfile);
      const currentWorkspaceContexts = loadWorkspaceContexts(layoutKey, currentProfile);
      const currentAssets = loadAssets(layoutKey, currentProfile);
      const currentLogicGraph = loadWorkspaceLogicGraph(layoutKey, currentProfile);
      try {
        localStorage.setItem(`${panelProfilePrefix}${layoutKey}`, selected);
        layoutStorageKeys(layoutKey, selected).forEach((key) => localStorage.removeItem(key));
      } catch {}
      saveDataSources(layoutKey, selected, currentDataSources);
      saveWorkspaceContexts(layoutKey, selected, currentWorkspaceContexts);
      saveAssets(layoutKey, selected, currentAssets);
      saveWorkspaceLogicGraph(layoutKey, currentLogicGraph, selected, { history: false, event: false });
      const layout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
      if (layout) savePanelLayouts(layout, selected, { persist: true });
      const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
      if (widgetLayout) saveWidgetLayouts(widgetLayout, selected, { persist: true });
      saveFloatingAnchors(layoutKey, selected, { persist: true });
      saveWorkspaceContextState(layoutKey, selected, { persist: true, history: false });
      savePersistedWorkspaceSnapshot(layoutKey, selected);
      showToast(`Layout ${selected} saved.`, "info", {
        type: "layout-save-completed",
        source: "layout-save",
        layoutKey,
        payload: { profile: selected },
      });
    });
  });

  document.querySelectorAll(".layout-group-button").forEach((button) => {
    button.addEventListener("click", () => {
      setGroupMode(!groupMode);
      showToast(groupMode ? "Select mode enabled." : "Selection cleared.");
    });
  });

  document.addEventListener("click", (event) => {
    if (!groupMode || event.button !== 0) return;
    if (event.target?.closest?.(".app-nav, .panel-tools, .widget-tools, .panel-color-menu, .panel-add-menu, .layout-slot-menu, .nav-status-popover")) return;
    const item = event.target?.closest?.(".widget-layout > .widget-card, .panel-layout > .db-panel");
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    toggleGroupItem(item);
  }, true);

  const objectAddCategories = [
    { id: "data", label: "Data" },
    { id: "visualization", label: "Visualization" },
    { id: "controls", label: "Controls" },
    { id: "content", label: "Content" },
    { id: "media", label: "Media" },
    { id: "system", label: "System" },
    { id: "experimental", label: "Experimental" },
    { id: "containers", label: "Containers" },
    { id: "navigation", label: "Navigation" },
    { id: "dividers", label: "Dividers" },
  ];
  const objectAddItems = [
    { category: "data", displayName: "Stat", actionClass: "widget-add-action", dataset: { widgetKind: "stat" } },
    { category: "data", displayName: "Table", actionClass: "widget-add-action", dataset: { widgetKind: "table" } },
    { category: "visualization", subcategory: "Charts", displayName: "Bar", actionClass: "widget-add-action", dataset: { widgetKind: "graph", widgetCreateKind: "graph", objectDisplayName: "Bar Chart", widgetConfig: JSON.stringify({ title: "Bar Chart", chartType: "bar" }), chartType: "bar" } },
    { category: "visualization", subcategory: "Charts", displayName: "Line", actionClass: "widget-add-action", dataset: { widgetKind: "chart-line", widgetCreateKind: "graph", objectDisplayName: "Line Chart", widgetConfig: JSON.stringify({ title: "Line Chart", chartType: "line" }), chartType: "line" } },
    { category: "visualization", subcategory: "Charts", displayName: "Area", actionClass: "widget-add-action", dataset: { widgetKind: "chart-area", widgetCreateKind: "graph", objectDisplayName: "Area Chart", widgetConfig: JSON.stringify({ title: "Area Chart", chartType: "area" }), chartType: "area" } },
    { category: "visualization", subcategory: "Charts", displayName: "Scatter", actionClass: "widget-add-action", dataset: { widgetKind: "chart-scatter", widgetCreateKind: "graph", objectDisplayName: "Scatter Chart", widgetConfig: JSON.stringify({ title: "Scatter Chart", chartType: "scatter" }), chartType: "scatter" } },
    { category: "visualization", subcategory: "Charts", displayName: "Histogram", actionClass: "widget-add-action", dataset: { widgetKind: "chart-histogram", widgetCreateKind: "graph", objectDisplayName: "Histogram", widgetConfig: JSON.stringify({ title: "Histogram", chartType: "histogram" }), chartType: "histogram" } },
    { category: "visualization", subcategory: "Charts", displayName: "Heatmap", actionClass: "widget-add-action", dataset: { widgetKind: "chart-heatmap", widgetCreateKind: "graph", objectDisplayName: "Heatmap", widgetConfig: JSON.stringify({ title: "Heatmap", chartType: "heatmap" }), chartType: "heatmap" } },
    { category: "visualization", subcategory: "Charts", displayName: "Pie / Donut", actionClass: "widget-add-action", dataset: { widgetKind: "chart-donut", widgetCreateKind: "graph", objectDisplayName: "Donut Chart", widgetConfig: JSON.stringify({ title: "Donut Chart", chartType: "donut" }), chartType: "donut" } },
    { category: "visualization", subcategory: "Charts", displayName: "Gauge", actionClass: "widget-add-action", dataset: { widgetKind: "chart-gauge", widgetCreateKind: "graph", objectDisplayName: "Gauge", widgetConfig: JSON.stringify({ title: "Gauge", chartType: "gauge" }), chartType: "gauge" } },
    { category: "visualization", subcategory: "Charts", displayName: "Sparkline", actionClass: "widget-add-action", dataset: { widgetKind: "chart-sparkline", widgetCreateKind: "graph", objectDisplayName: "Sparkline", widgetConfig: JSON.stringify({ title: "Sparkline", chartType: "sparkline" }), chartType: "sparkline" } },
    { category: "controls", displayName: "Search Bar", actionClass: "widget-add-action", dataset: { widgetKind: "search" } },
    { category: "controls", displayName: "Filter Control", actionClass: "widget-add-action", dataset: { widgetKind: "filter" } },
    { category: "controls", displayName: "Timeframe", actionClass: "widget-add-action", dataset: { widgetKind: "timeframe" } },
    { category: "controls", displayName: "Calendar", actionClass: "widget-add-action", dataset: { widgetKind: "calendar" } },
    { category: "content", displayName: "Text / Notes", actionClass: "widget-add-action", dataset: { widgetKind: "text" } },
    { category: "content", displayName: "Region Summary", actionClass: "widget-add-action", dataset: { widgetKind: "region-summary" } },
    { category: "media", displayName: "Image", actionClass: "widget-add-action", dataset: { widgetKind: "image" } },
    { category: "media", displayName: "Video", actionClass: "widget-add-action", dataset: { widgetKind: "video" } },
    { category: "media", displayName: "PDF / Document", actionClass: "widget-add-action", dataset: { widgetKind: "document" } },
    { category: "system", displayName: "Activity Feed", actionClass: "widget-add-action", dataset: { widgetKind: "activity-feed" } },
    { category: "system", displayName: "AI Assistant", actionClass: "widget-add-action", dataset: { widgetKind: "ai-assistant" } },
    { category: "system", displayName: "Context Inspector", actionClass: "widget-add-action", engineerOnly: true, dataset: { widgetKind: "context-inspector" } },
    { category: "containers", displayName: "Panel", actionClass: "panel-add-action", dataset: { panelKind: "panel" } },
    { category: "navigation", displayName: "Anchor", actionClass: "widget-add-action", dataset: { widgetKind: "anchor" } },
    { category: "dividers", displayName: "Divider", actionClass: "divider-add-action", dataset: { dividerKind: "context-divider" } },
  ];
  const objectAddSetDataset = (element, dataset = {}) => {
    Object.entries(dataset).forEach(([key, value]) => {
      if (value == null) return;
      element.dataset[key] = String(value);
    });
  };
  const createObjectAddAction = (item, layoutKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `object-add-action ${item.actionClass || ""}`.trim();
    button.textContent = item.displayName;
    if (item.actionClass === "panel-add-action" || item.actionClass === "divider-add-action") {
      button.dataset.layoutTarget = layoutKey;
    } else {
      button.dataset.widgetTarget = layoutKey;
    }
    button.dataset.objectAddCategory = item.category;
    if (item.subcategory) button.dataset.objectAddSubcategory = item.subcategory;
    objectAddSetDataset(button, item.dataset);
    return button;
  };
  const createObjectAddSubmenu = (items, layoutKey) => {
    const submenu = document.createElement("div");
    submenu.className = "object-add-submenu";
    submenu.setAttribute("role", "menu");
    const bySubcategory = new Map();
    items.filter((item) => !item.subcategory).forEach((item) => submenu.appendChild(createObjectAddAction(item, layoutKey)));
    items.filter((item) => item.subcategory).forEach((item) => {
      if (!bySubcategory.has(item.subcategory)) bySubcategory.set(item.subcategory, []);
      bySubcategory.get(item.subcategory).push(item);
    });
    bySubcategory.forEach((subcategoryItems, subcategory) => {
      const group = document.createElement("div");
      group.className = "object-add-subcategory";
      group.dataset.objectAddSubcategory = subcategory;
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "object-add-subcategory-trigger";
      trigger.textContent = subcategory;
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-expanded", "false");
      const nested = document.createElement("div");
      nested.className = "object-add-submenu object-add-chart-submenu";
      nested.setAttribute("role", "menu");
      subcategoryItems.forEach((item) => nested.appendChild(createObjectAddAction(item, layoutKey)));
      group.append(trigger, nested);
      submenu.appendChild(group);
    });
    return submenu;
  };
  const setObjectAddSubmenuOpen = (group, open) => {
    if (!group) return;
    group.classList.toggle("is-open", Boolean(open));
    group.querySelector(":scope > .object-add-category-trigger, :scope > .object-add-subcategory-trigger")
      ?.setAttribute("aria-expanded", String(Boolean(open)));
  };
  const openObjectAddSubmenuBranch = (group) => {
    if (!group) return;
    group.parentElement?.querySelectorAll?.(":scope > .object-add-category.is-open, :scope > .object-add-subcategory.is-open")
      .forEach((openGroup) => {
        if (openGroup !== group) setObjectAddSubmenuOpen(openGroup, false);
      });
    setObjectAddSubmenuOpen(group, true);
  };
  const renderObjectAddMenus = () => {
    document.querySelectorAll(".panel-add-picker").forEach((picker) => {
      const layoutKey = picker.dataset.layoutTarget || "default";
      const browser = picker.querySelector(".object-add-browser");
      if (!browser) return;
      browser.replaceChildren();
      const availableItems = objectAddItems.filter((item) => !item.engineerOnly || isEngineerMode());
      objectAddCategories.forEach((category) => {
        const items = availableItems.filter((item) => item.category === category.id);
        if (!items.length) return;
        const group = document.createElement("div");
        group.className = "object-add-category";
        group.dataset.objectMenuCategory = category.id;
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "object-add-category-trigger";
        trigger.textContent = category.label;
        trigger.setAttribute("aria-haspopup", "true");
        trigger.setAttribute("aria-expanded", "false");
        group.append(trigger, createObjectAddSubmenu(items, layoutKey));
        browser.appendChild(group);
      });
    });
  };
  renderObjectAddMenus();
  onEngineerModeChange(renderObjectAddMenus);

  document.querySelectorAll(".panel-add-picker").forEach((picker) => {
    const trigger = picker.querySelector(".panel-add-button");
    const menu = picker.querySelector(".panel-add-menu");
    let closeTimer;
    const openMenu = () => {
      window.clearTimeout(closeTimer);
      menu?.classList.add("open");
      trigger?.setAttribute("aria-expanded", "true");
    };
    const scheduleClose = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        closeMenu();
      }, 140);
    };
    const closeMenu = () => {
      window.clearTimeout(closeTimer);
      menu?.classList.remove("open");
      trigger?.setAttribute("aria-expanded", "false");
    };
    picker.addEventListener("mouseenter", openMenu);
    picker.addEventListener("mouseleave", scheduleClose);
    trigger?.addEventListener("focus", openMenu);
    trigger?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMenu();
    });
    menu?.addEventListener("pointerenter", (event) => {
      const group = event.target?.closest?.(".object-add-category, .object-add-subcategory");
      if (!group || !menu.contains(group)) return;
      openObjectAddSubmenuBranch(group);
    }, true);
    menu?.addEventListener("focusin", (event) => {
      const group = event.target?.closest?.(".object-add-category, .object-add-subcategory");
      if (!group || !menu.contains(group)) return;
      openObjectAddSubmenuBranch(group);
    });
    menu?.addEventListener("click", (event) => {
      const triggerButton = event.target?.closest?.(".object-add-category-trigger, .object-add-subcategory-trigger");
      if (!triggerButton || !menu.contains(triggerButton)) return;
      event.preventDefault();
      event.stopPropagation();
      const group = triggerButton.closest(".object-add-category, .object-add-subcategory");
      const willOpen = !group.classList.contains("is-open");
      if (willOpen) {
        openObjectAddSubmenuBranch(group);
      } else {
        setObjectAddSubmenuOpen(group, false);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!picker.contains(event.target)) closeMenu();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  });

  const closeObjectAddMenu = (button) => {
    const picker = button?.closest?.(".panel-add-picker");
    const trigger = picker?.querySelector?.(".panel-add-button");
    const menu = picker?.querySelector?.(".panel-add-menu");
    menu?.classList.remove("open");
    trigger?.setAttribute("aria-expanded", "false");
  };

  const handlePanelAddAction = (button) => {
      closeObjectAddMenu(button);
      const layoutKey = button.dataset.layoutTarget || "default";
      const layout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
      if (!layout) return;
      const selected = getActivePanelProfile(layoutKey);
      savePanelLayouts(layout, selected);
      syncDefaultDashboardGrid(layoutKey);
      layout.querySelectorAll(":scope > .db-panel").forEach(syncPanelMinimumWidth);
      const used = new Set(
        [...layout.querySelectorAll(":scope > .db-panel")]
          .map((panel) => panel.dataset.panelColor || panel.querySelector(".panel-color-toggle")?.dataset.defaultTheme)
          .filter(Boolean)
          .map((color) => color.toLowerCase())
      );
      const customCount = layout.querySelectorAll(':scope > .db-panel[data-custom-panel="true"]').length;
      const nextColor =
        panelThemePresets.find((color) => !used.has(color.toLowerCase())) ||
        panelThemePresets[customCount % panelThemePresets.length];
      const key = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const title = `Panel ${customCount + 1}`;
      const definition = {
        key,
        title,
        color: nextColor,
        span: 1,
        workspaceObjectType: WORKSPACE_OBJECT_TYPES.panel,
        dashboardObjectKind: "panel",
        contextRole: "container",
      };
      const order = [...layout.querySelectorAll(":scope > .db-panel")].length;
      const panel = createCustomPanel(definition);
      panel.dataset.defaultOrder = String(order);
      panel.classList.add("db-panel-collapsed");
      panel.dataset.gridRowSpan = "1";
      applyPanelSpan(panel, 1);
      applyPanelColor(panel, nextColor);
      applyPanelTitleColor(panel, "#ffffff");
      const target = panelAddTarget(layout, panel);
      applyPanelGridPosition(panel, target.col, target.row);
      animatePanelReflow(layout, () => {
        layout.appendChild(panel);
        commitInsertedGridItemWithVerticalPushdown(layout, panel, target);
        syncWorkspaceRegions(layout);
      });
      layout.__initPanel?.(panel);
      savePanelLayouts(layout, selected);
      showToast(`${title} added.`, "info", {
        type: "object-created",
        source: "object-add",
        layoutKey,
        objectId: key,
        objectType: "panel",
        regionId: regionIdForWorkspaceItem(panel),
        payload: { title, cols: Number(panel.dataset.currentSpan) || 1, rows: Number(panel.dataset.gridRowSpan) || 1 },
      });
  };

  const handleDividerAddAction = (button) => {
      closeObjectAddMenu(button);
      const layoutKey = button.dataset.layoutTarget || "default";
      const layout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
      if (!layout) return;
      const selected = getActivePanelProfile(layoutKey);
      savePanelLayouts(layout, selected);
      syncDefaultDashboardGrid(layoutKey);
      const key = `divider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const customCount = layout.querySelectorAll(':scope > .db-panel[data-workspace-object-type="divider"]').length;
      const definition = {
        key,
        title: `Divider ${customCount + 1}`,
        color: "#64748b",
        span: 6,
        minW: 2,
        workspaceObjectType: WORKSPACE_OBJECT_TYPES.divider,
        dashboardObjectKind: "divider",
        contextRole: "semantic-boundary",
        navigationTargetType: "workspace-region",
      };
      const divider = createCustomPanel(definition);
      ensureWorkspaceObjectMetadata(divider, {
        ...definition,
        dashboardObjectKind: button.dataset.dividerKind || "divider",
      });
      divider.dataset.defaultOrder = String([...layout.querySelectorAll(":scope > .db-panel")].length);
      divider.classList.add("db-panel-collapsed", "dashboard-divider-placeholder");
      divider.dataset.gridRowSpan = "1";
      applyPanelSpan(divider, 6);
      applyPanelColor(divider, definition.color);
      applyPanelTitleColor(divider, "#ffffff");
      const target = panelAddTarget(layout, divider);
      applyPanelGridPosition(divider, target.col, target.row);
      animatePanelReflow(layout, () => {
        layout.appendChild(divider);
        commitInsertedGridItemWithVerticalPushdown(layout, divider, target);
        syncWorkspaceRegions(layout);
      });
      layout.__initPanel?.(divider);
      savePanelLayouts(layout, selected);
      showToast(`${definition.title} added.`, "info", {
        type: "object-created",
        source: "object-add",
        layoutKey,
        objectId: key,
        objectType: "divider",
        regionId: regionIdForWorkspaceItem(divider),
        payload: { title: definition.title, dividerKind: button.dataset.dividerKind || "divider" },
      });
  };

  const handleWidgetAddAction = (button) => {
      closeObjectAddMenu(button);
      const layoutKey = button.dataset.widgetTarget || "default";
      const layout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
      const kind = button.dataset.widgetCreateKind || button.dataset.widgetKind || "widget";
      if (kind === "anchor") {
        const layer = anchorLayerForLayoutKey(layoutKey);
        if (!layer) return;
        const selected = getActivePanelProfile(layoutKey);
        const customCount = layer.querySelectorAll(":scope > .workspace-anchor-object").length;
        const nextColor = panelThemePresets[customCount % panelThemePresets.length];
        const title = `Anchor ${customCount + 1}`;
        const anchor = createFloatingAnchor({
          key: `anchor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          layoutKey,
          title,
          color: nextColor,
          side: "left",
          railOrder: customCount,
          offset: nextAnchorRailOffset(layer),
          navigationTargetType: "workspace-top",
          navigationTargetId: "",
        });
        layer.appendChild(anchor);
        initFloatingAnchor(anchor, layer);
        normalizeAnchorLayer(layer);
        saveFloatingAnchors(layoutKey, selected);
        refreshWorkspaceMiniMaps(layoutKey);
        showToast(`${title} added.`, "info", {
          type: "object-created",
          source: "object-add",
          layoutKey,
          objectId: anchor.dataset.anchorKey,
          objectType: "anchor",
          payload: { title, railOrder: Number(anchor.dataset.anchorRailOrder) || 0, offset: Number(anchor.dataset.anchorOffset) || 0 },
        });
        return;
      }
      if (!layout) return;
      const selected = getActivePanelProfile(layoutKey);
      saveWidgetLayouts(layout, selected);
      const used = new Set(
        [...layout.querySelectorAll(":scope > .widget-card")]
          .map((widget) => widget.dataset.panelColor || widget.querySelector(".panel-color-toggle")?.dataset.defaultTheme)
          .filter(Boolean)
          .map((color) => color.toLowerCase())
      );
      const customCount = layout.querySelectorAll(':scope > .widget-card[data-custom-widget="true"]').length;
      const nextColor =
        panelThemePresets.find((color) => !used.has(color.toLowerCase())) ||
        panelThemePresets[customCount % panelThemePresets.length];
      const key = `widget-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const runtimeDefinition = widgetDefinitionFor(kind);
      const runtimeDefaults = typeof runtimeDefinition.getDefaultConfig === "function" ? runtimeDefinition.getDefaultConfig() : {};
      const runtimeConfigOverrides = parseJsonRecord(button.dataset.widgetConfig, {});
      const objectName = button.dataset.objectDisplayName || (kind === "graph" ? "Graph" : (runtimeDefinition.displayName || "Widget"));
      const widgetConfig = { ...runtimeDefaults, ...runtimeConfigOverrides };
      const title = widgetConfig.title || `${objectName} ${customCount + 1}`;
      const definition = {
        key,
        title,
        value: widgetConfig.value,
        color: nextColor,
        span: runtimeDefinition.defaultSize?.cols || 1,
        rowSpan: runtimeDefinition.defaultSize?.rows || 1,
        minW: runtimeDefinition.minSize?.cols || 1,
        minH: runtimeDefinition.minSize?.rows || null,
        type: runtimeDefinition.widgetType || runtimeDefinition.type,
        runtimeType: runtimeDefinition.type,
        workspaceObjectType: WORKSPACE_OBJECT_TYPES.widget,
        dashboardObjectKind: runtimeDefinition.dashboardObjectKind || runtimeDefinition.type,
        contextRole: runtimeDefinition.contextRole || "content",
        config: JSON.stringify(widgetConfig),
      };
      const widget = createCustomWidget(definition);
      ensureWidgetTools(widget, nextColor);
      applyWidgetSpan(widget, definition.span);
      applyPanelColor(widget, nextColor);
      applyPanelTitleColor(widget, "#ffffff");
      const target = visibleRegionInsertionTarget(layout, widget);
      if (target) applyWidgetGridPosition(widget, target.col, target.row, definition.rowSpan);
      animateWidgetReflow(layout, () => {
        layout.appendChild(widget);
        if (target) commitInsertedGridItemWithVerticalPushdown(layout, widget, target);
        syncWorkspaceRegions(layout);
      });
      layout.__initWidget?.(widget);
      bindDashboardKeywordForms(widget);
      refreshResolvedContextDebug(layoutKey, selected);
      saveWidgetLayouts(layout, selected);
      showToast(`${objectName || title} added.`, "info", {
        type: "object-created",
        source: "object-add",
        layoutKey,
        objectId: key,
        objectType: "widget",
        regionId: regionIdForWorkspaceItem(widget),
        payload: {
          title,
          widgetType: runtimeDefinition.type,
          cols: Number(widget.dataset.currentSpan) || definition.span,
          rows: Number(widget.dataset.gridRowSpan) || definition.rowSpan,
        },
      });
  };

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".panel-add-action, .divider-add-action, .widget-add-action");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.classList.contains("panel-add-action")) {
      handlePanelAddAction(button);
    } else if (button.classList.contains("divider-add-action")) {
      handleDividerAddAction(button);
    } else {
      handleWidgetAddAction(button);
    }
  });

  const undoDashboardLayoutChange = (layoutKey, profile, options = {}) => {
    if (!restoreLayoutUndo(layoutKey, profile)) {
      if (options.toast !== false) showToast("No layout change to undo.", "warn");
      return false;
    }
    if (options.toast !== false) {
      showToast("Layout change undone.", "info", {
        type: "history-undo",
        source: "history",
        layoutKey,
        payload: { profile },
      });
    } else {
      emitWorkspaceEvent({ type: "history-undo", source: "history", layoutKey, label: "Layout change undone", payload: { profile } });
    }
    return true;
  };

  const redoDashboardLayoutChange = (layoutKey, profile, options = {}) => {
    if (!restoreLayoutRedo(layoutKey, profile)) {
      if (options.toast !== false) showToast("No layout change to redo.", "warn");
      return false;
    }
    if (options.toast !== false) {
      showToast("Layout change redone.", "info", {
        type: "history-redo",
        source: "history",
        layoutKey,
        payload: { profile },
      });
    } else {
      emitWorkspaceEvent({ type: "history-redo", source: "history", layoutKey, label: "Layout change redone", payload: { profile } });
    }
    return true;
  };

  const isEditableUndoTarget = (target) => {
    if (!target) return false;
    if (target.isContentEditable) return true;
    return Boolean(target.closest?.("input, textarea, select, [contenteditable='true'], [role='textbox']"));
  };

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key !== "c" && key !== "v") return;
    if (isEditableUndoTarget(event.target)) return;
    const layoutKey = document.querySelector(".panel-layout")?.dataset.layoutKey || "builder";
    const handled = key === "c"
      ? copySelectedWorkspaceObjects()
      : pasteWorkspaceClipboardObjects(layoutKey);
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.querySelectorAll(".panel-undo-button").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.layoutTarget || "default";
      const profile = getActivePanelProfile(layoutKey);
      undoDashboardLayoutChange(layoutKey, profile);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const redoShortcut = key === "y" || (key === "z" && event.shiftKey);
    const undoShortcut = key === "z" && !event.shiftKey;
    if (!undoShortcut && !redoShortcut) return;
    if (isEditableUndoTarget(event.target)) return;
    const layoutKey = document.querySelector(".panel-layout")?.dataset.layoutKey || "default";
    const profile = getActivePanelProfile(layoutKey);
    const handled = redoShortcut
      ? redoDashboardLayoutChange(layoutKey, profile)
      : undoDashboardLayoutChange(layoutKey, profile);
    if (!handled) return;
    event.preventDefault();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.key !== "Delete") return;
    if (isEditableUndoTarget(event.target)) return;
    if (panelDeleteDialog?.open) return;
    const focusedObject = event.target?.closest?.(".workspace-anchor-object, .widget-layout > .widget-card, .panel-layout > .db-panel");
    const selectedTargets = selectedGroupItems(null);
    const targets = focusedObject && !focusedObject.classList.contains("group-selected")
      ? [focusedObject]
      : selectedTargets.length ? selectedTargets : [focusedObject].filter(Boolean);
    if (!targets.length) return;
    if (!requestWorkspaceObjectDelete({ targets })) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.querySelectorAll(".panel-reset-button").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.layoutTarget || document.querySelector(".panel-layout")?.dataset.layoutKey || "default";
      const profile = getActivePanelProfile(layoutKey);
      const layouts = [...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`)];
      const widgetLayouts = [...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`)];
      const anchorLayers = [...document.querySelectorAll(`.workspace-anchor-layer[data-anchor-layout-key="${CSS.escape(layoutKey)}"]`)];
      captureLayoutUndo(layoutKey, profile);
      try {
        localStorage.removeItem(dataSourcesKey(layoutKey, profile));
        localStorage.removeItem(workspaceContextsKey(layoutKey, profile));
        localStorage.removeItem(persistedWorkspaceKey(layoutKey, profile));
      } catch {}
      widgetLayouts.forEach((layout) => {
        writeDraftList(layout, "hiddenWidgetsDraft", []);
        layout.querySelectorAll(":scope > .widget-row-break").forEach((rowBreak) => rowBreak.remove());
        layout.querySelectorAll(":scope > .widget-spacer").forEach((spacer) => spacer.remove());
        layout.querySelectorAll(':scope > .widget-card[data-custom-widget="true"]').forEach((widget) => widget.remove());
        [...layout.querySelectorAll(":scope > .widget-card")]
          .sort((a, b) => Number(a.dataset.defaultOrder || 0) - Number(b.dataset.defaultOrder || 0))
          .forEach((widget) => {
            widget.hidden = false;
            widget.classList.remove("db-panel-pinned", "widget-tools-open", "db-panel-custom-color", "db-panel-custom-title");
            widget.style.gridColumn = "";
            delete widget.dataset.currentSpan;
            delete widget.dataset.panelColor;
            delete widget.dataset.panelTitleColor;
            delete widget.dataset.panelTitle;
            delete widget.dataset.workspaceContext;
            delete widget.dataset.dataSourceId;
            delete widget.dataset.semanticMapping;
            delete widget.dataset.contextFilters;
            delete widget.dataset.contextTimeRange;
            delete widget.dataset.contextTags;
            delete widget.dataset.contextName;
            widget.style.removeProperty("--panel-accent");
            widget.style.removeProperty("--panel-accent-rgb");
            widget.style.removeProperty("--panel-accent-text");
            applyWidgetSpan(widget, widget.dataset.defaultSpan || 3);
            const label = widget.querySelector(".stat-lbl");
            if (label && widget.dataset.defaultTitle) label.textContent = widget.dataset.defaultTitle;
            const defaultTheme = widget.querySelector(".panel-color-toggle")?.dataset.defaultTheme;
            applyPanelColor(widget, defaultTheme);
            applyPanelTitleColor(widget, "");
            layout.appendChild(widget);
          });
      });
      layouts.forEach((layout) => {
        writeDraftList(layout, "hiddenPanelsDraft", []);
        layout.querySelectorAll(":scope > .db-panel-row-break").forEach((rowBreak) => rowBreak.remove());
        layout.querySelectorAll(':scope > .db-panel[data-custom-panel="true"]').forEach((panel) => panel.remove());
        [...layout.querySelectorAll(":scope > .db-panel")]
          .sort((a, b) => Number(a.dataset.defaultOrder || 0) - Number(b.dataset.defaultOrder || 0))
          .forEach((panel) => {
            panel.hidden = false;
            panel.classList.remove("db-panel-unlocked", "db-panel-dragging");
            panel.classList.remove("db-panel-pinned");
            panel.classList.remove("db-panel-tools-open", "db-panel-custom-color", "db-panel-custom-title");
            panel.style.gridColumn = "";
            panel.style.height = "";
            delete panel.dataset.savedHeight;
            delete panel.dataset.panelColor;
            delete panel.dataset.panelTitleColor;
            delete panel.dataset.panelTitle;
            delete panel.dataset.workspaceContext;
            delete panel.dataset.dataSourceId;
            delete panel.dataset.semanticMapping;
            delete panel.dataset.contextFilters;
            delete panel.dataset.contextTimeRange;
            delete panel.dataset.contextTags;
            delete panel.dataset.contextName;
            panel.querySelector(":scope > .db-panel-body > .panel-internal-widget-grid")?.remove();
            updatePanelChildEmptyState(panel);
            panel.style.left = "";
            panel.style.top = "";
            panel.style.width = "";
            panel.style.removeProperty("--panel-accent");
            panel.style.removeProperty("--panel-accent-rgb");
            panel.style.removeProperty("--panel-accent-text");
            applyPanelSpan(panel, panel.dataset.defaultSpan || 6);
            const defaultTheme = panel.querySelector(".panel-color-toggle")?.dataset.defaultTheme;
            applyPanelColor(panel, defaultTheme);
            applyPanelTitleColor(panel, "#ffffff");
            const titleEl = panel.querySelector(".db-panel-title");
            if (titleEl && panel.dataset.defaultTitle) titleEl.textContent = panel.dataset.defaultTitle;
            layout.appendChild(panel);
            const settingsButton = panel.querySelector(".panel-settings-toggle");
            settingsButton?.setAttribute("aria-expanded", "false");
            const pinButton = panel.querySelector(".panel-pin-toggle");
            pinButton?.setAttribute("aria-pressed", "false");
          });
      });
      syncDefaultDashboardGrid(layoutKey, { force: true });
      widgetLayouts.filter((layout) => !layout.closest(".dashboard-layout-grid")).forEach((layout) => normalizeGridLayout(layout));
      layouts.filter((layout) => !layout.closest(".dashboard-layout-grid")).forEach((layout) => normalizeGridLayout(layout));
      anchorLayers.forEach((layer) => layer.replaceChildren());
      showToast("Layout reset to default.");
      pushLiveLayoutUndo(layoutKey, profile);
    });
  });

  const form = document.getElementById("settings-form");
  const dashboardBtn = document.getElementById("settings-dashboard-btn");
  const saveButton = document.getElementById("settings-save-btn");
  const dirtyNote = document.getElementById("settings-dirty-note");

  if (!form || !dashboardBtn) return;

  const serialize = (targetForm) => {
    const data = [...new FormData(targetForm).entries()];
    return data.sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  };

  const initialState = serialize(form);
  const isDirty = () => serialize(form) !== initialState;

  const updateDirtyState = () => {
    const dirty = isDirty();
    form.classList.toggle("is-dirty", dirty);
    if (dirtyNote) dirtyNote.textContent = dirty ? "Unsaved changes pending." : "Changes are saved to the local dashboard database.";
  };

  form.addEventListener("input", updateDirtyState);
  form.addEventListener("change", updateDirtyState);

  window.addEventListener("beforeunload", (event) => {
    if (!isDirty() || form.dataset.submitting === "true") return;
    event.preventDefault();
    event.returnValue = "";
  });

  dashboardBtn.addEventListener("click", (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    const saveFirst = window.confirm(
      "You have unsaved settings changes. OK to save and go back to Dashboard, or Cancel to discard changes and go back."
    );
    if (saveFirst) {
      form.submit();
    } else {
      window.location.href = dashboardBtn.dataset.href || "/dashboard";
    }
  });

  form.addEventListener("submit", () => {
    form.dataset.submitting = "true";
    saveButton?.classList.add("is-saving");
    if (saveButton) saveButton.disabled = true;
  });
});
