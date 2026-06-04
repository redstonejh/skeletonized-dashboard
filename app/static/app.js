import "./widget-registry.js";
import "./widget-runtime.js";
import "./interaction-state.js";
import "./menu-overlay.js";
import "./layout-persistence.js";
import "./drag-runtime.js";
import "./resize-runtime.js";
import "./dashboard-geometry.js";
import "./panel-runtime.js";
import "./panel-containment.js";
import "./collision-reflow.js";
import { showGlobalToast } from "./modules/toast.js";
import { bindInitialRangeControls } from "./modules/range-controls.js";
import { initializeBackgroundController } from "./modules/background-controller.js";

bindInitialRangeControls();

document.addEventListener("DOMContentLoaded", () => {
  const emitWorkspaceEvent = () => null;
  const showToast = (message, tone = "info") => showGlobalToast(message, tone);  const dashboardInteractionState = window.dashboardInteractionState;
  const dashboardDragRuntime = window.dashboardDragRuntime;
  const dashboardResizeRuntime = window.dashboardResizeRuntime;
  const dashboardPanelRuntime = window.dashboardPanelRuntime;
  const dashboardPanelContainment = window.dashboardPanelContainment;
  const dashboardCollisionReflowRuntime = window.dashboardCollisionReflowRuntime;
  const dashboardMenuOverlayRuntime = window.dashboardMenuOverlayRuntime;
  const positionPortaledMenu = (menu, trigger, options = {}) => dashboardMenuOverlayRuntime?.position?.(menu, trigger, options);
  const portalFloatingMenu = (menu, trigger, options = {}) => dashboardMenuOverlayRuntime?.portal?.(menu, trigger, options);
  const restoreFloatingMenu = (menu) => dashboardMenuOverlayRuntime?.restore?.(menu);
  const originalMenuParent = (menu) => dashboardMenuOverlayRuntime?.originalParent?.(menu);
  const menuOverlayLayer = () => dashboardMenuOverlayRuntime?.ensureLayer?.() || document.body;
  const dashboardToolDrawerVars = [
    "--panel-lock-bg",
    "--panel-lock-fg",
    "--panel-lock-border",
    "--panel-lock-glow",
    "--panel-drawer-bg",
    "--panel-drawer-border",
    "--panel-drawer-shadow",
    "--panel-control-rest-shadow",
    "--panel-control-hover-border",
    "--panel-control-hover-shadow",
    "--panel-control-active-shadow",
    "--widget-control-bg",
    "--widget-control-hover-bg",
    "--widget-control-active-bg",
    "--widget-drawer-bg",
  ];
  const portalDashboardToolDrawer = (drawer, trigger) => {
    if (!drawer || !trigger) return;
    const drawerStyles = window.getComputedStyle(drawer);
    dashboardToolDrawerVars.forEach((name) => {
      const value = drawerStyles.getPropertyValue(name);
      if (value) drawer.style.setProperty(name, value);
    });
    portalFloatingMenu(drawer, trigger, { skipPosition: true });
    drawer.classList.add("dashboard-tool-drawer-portaled", "dashboard-tool-drawer-open");
  };
  const restoreDashboardToolDrawer = (drawer) => {
    if (!drawer) return;
    drawer.classList.remove("dashboard-tool-drawer-portaled", "dashboard-tool-drawer-open");
    drawer.style.removeProperty("--dashboard-tool-drawer-fixed-left");
    drawer.style.removeProperty("--dashboard-tool-drawer-fixed-top");
    dashboardToolDrawerVars.forEach((name) => drawer.style.removeProperty(name));
    restoreFloatingMenu(drawer);
  };
  initializeBackgroundController({ portalFloatingMenu, restoreFloatingMenu, originalMenuParent });
  let refreshWorkspaceMiniMaps = () => {};
  let refreshEngineerOverlays = () => {};
  const engineerModeState = Object.freeze({ enabled: false, source: "removed", updatedAt: 0 });
  const isEngineerMode = () => false;
  const refreshEngineerContextVisibility = () => {
    refreshWorkspaceMiniMaps();
  };
  const setEngineerMode = () => false;
  const toggleEngineerMode = () => false;
  const onEngineerModeChange = () => () => {};
  document.body.classList.remove("engineer-mode-active");
  document.documentElement.dataset.engineerMode = "false";

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
      portalFloatingMenu(switcherMenu, switcherToggle, { align: "left", offset: 8 });
      switcherToggle.setAttribute("aria-expanded", "true");
    };
    const closeSwitcher = () => {
      switcherMenu.classList.remove("open");
      restoreFloatingMenu(switcherMenu);
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

  const layoutPersistence = window.dashboardLayoutPersistence;
  // One-time migration: move working data from numbered save slots to WORKING_PROFILE.
  // Old code set active profile = save slot on save; this migrates any such state so
  // the numbered slots become immutable save snapshots.
  (() => {
    const WORKING = layoutPersistence.WORKING_PROFILE;
    document.querySelectorAll("[data-layout-key]").forEach((el) => {
      const lk = el.dataset.layoutKey;
      if (!lk) return;
      const current = layoutPersistence.getActiveProfile(lk);
      if (current !== WORKING && /^[1-9][0-9]*$/.test(current)) {
        layoutPersistence.copyProfile(lk, current, WORKING);
        layoutPersistence.setActiveProfile(lk, WORKING);
      }
    });
  })();
  const PERSISTED_WORKSPACE_VERSION = layoutPersistence.version;
  const getActivePanelProfile = layoutPersistence.getActiveProfile;
  const panelStorageKey = layoutPersistence.key.panelStorage;
  const customPanelsKey = layoutPersistence.key.customPanels;
  const hiddenPanelsKey = layoutPersistence.key.hiddenPanels;
  const widgetStorageKey = layoutPersistence.key.widgetStorage;
  const customWidgetsKey = layoutPersistence.key.customWidgets;
  const hiddenWidgetsKey = layoutPersistence.key.hiddenWidgets;
  const dataSourcesKey = layoutPersistence.key.dataSources;
  const workspaceContextsKey = layoutPersistence.key.workspaceContexts;
  const workspaceAssetsKey = layoutPersistence.key.workspaceAssets;
  const workspaceLogicGraphKey = layoutPersistence.key.workspaceLogicGraph;
  const persistedWorkspaceKey = layoutPersistence.key.persistedWorkspace;
  const layoutUndoKey = layoutPersistence.key.layoutUndo;
  const layoutSourceKey = layoutPersistence.key.layoutSource;
  const generatedLayoutRegistryKey = layoutPersistence.key.generatedLayoutRegistry;
  let layoutUndoCaptureLock = false;
  const layoutStorageKeys = layoutPersistence.storageKeys;
  const clearLayoutStorage = layoutPersistence.clearScopedStorage;
  const readDraftList = layoutPersistence.readDraftList;
  const writeDraftList = layoutPersistence.writeDraftList;
  const parseJsonRecord = layoutPersistence.parseJsonRecord;
  const readJsonStore = layoutPersistence.readJson;
  const writeJsonStore = layoutPersistence.writeJson;
  const readRawStore = layoutPersistence.readRaw;
  const writeRawStore = layoutPersistence.writeRaw;
  const removeStore = layoutPersistence.remove;
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
  const isDashboardInteractionActive = () => dashboardInteractionState.isInteractionActive(document.body);
  const isInteractionSource = (item) => Boolean(item?.classList?.contains("widget-dragging") ||
    item?.classList?.contains("db-panel-dragging") ||
    item?.classList?.contains("dashboard-active-resize"));
  const surfaceResponseSelector = [
    ".widget-layout > .widget-card",
    ".panel-internal-widget-grid > .widget-card",
    ".panel-layout > .db-panel:not(.workspace-divider)",
  ].join(", ");
  const surfaceResponseControlSelector = [
    ".app-nav",
    ".panel-tools",
    ".widget-tools",
    ".panel-settings-toggle",
    ".panel-tool-button",
    ".panel-tool-drawer",
    ".panel-color-menu",
    ".widget-workbench-panel",
    ".panel-add-menu",
    ".layout-slot-menu",
    ".background-tone-popover",
    ".workspace-minimap-layer",
    "[data-widget-control-surface='true']",
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
  ].join(", ");
  const isWorkspaceSurfaceDragStart = (event, item) => {
    if (!event || !item || event.button !== 0) return false;
    if (isDashboardInteractionActive() || isInteractionSource(item)) return false;
    const controlTarget = event.target?.closest?.(surfaceResponseControlSelector);
    if (controlTarget && controlTarget !== item) return false;
    if (item.classList?.contains("db-panel")) {
      if (event.target?.closest?.(".panel-internal-widget-grid > .widget-card")) return false;
      if (typeof resizeEdgeFromPointer === "function" && resizeEdgeFromPointer(event, item)) return false;
    }
    return true;
  };
  const isWorkspaceObjectInteractiveSurfaceTarget = (event) => {
    return Boolean(
      event?.target?.closest?.(
        `${surfaceResponseControlSelector}, .media-widget-stage`,
      ),
    );
  };
  const surfaceResponseState = dashboardInteractionState.createSurfaceResponseState(window);
  const clearSurfaceResponse = (target = surfaceResponseState.target) => {
    if (!target) return;
    target.classList.remove("surface-response-active");
    target.removeAttribute("data-hover-zone");
    target.removeAttribute("data-surface-pressed");
    dashboardInteractionState.clearHoverSuppression("surface-response");
    if (surfaceResponseState.target === target) {
      surfaceResponseState.target = null;
      surfaceResponseState.rect = null;
    }
  };
  const surfaceZoneForPoint = (rect, clientX, clientY) => {
    if (!rect?.width || !rect?.height) return "center";
    const normalizedX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normalizedY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const horizontal = normalizedX < 1 / 3 ? "left" : normalizedX > 2 / 3 ? "right" : "center";
    const vertical = normalizedY < 1 / 3 ? "top" : normalizedY > 2 / 3 ? "bottom" : "middle";
    if (horizontal === "center" && vertical === "middle") return "center";
    return `${vertical}-${horizontal}`;
  };
  const surfaceResponseTargetFromEvent = (event) => {
    if (isDashboardInteractionActive()) return null;
    const target = event.target?.closest?.(surfaceResponseSelector);
    if (!target || !target.isConnected) return null;
    const controlTarget = event.target?.closest?.(surfaceResponseControlSelector);
    if (controlTarget && controlTarget !== target) return null;
    if (
      target.classList.contains("widget-placeholder") ||
      target.classList.contains("db-panel-placeholder") ||
      target.classList.contains("dashboard-live-resize") ||
      target.classList.contains("dashboard-resize-preview") ||
      target.classList.contains("dashboard-active-resize") ||
      target.classList.contains("dashboard-resize-source") ||
      target.classList.contains("widget-dragging") ||
      target.classList.contains("db-panel-dragging") ||
      target.classList.contains("dashboard-group-boundary") ||
      target.classList.contains("dashboard-group-member-preview")
    ) return null;
    return target;
  };
  const updateSurfaceResponse = () => {
    surfaceResponseState.frame = 0;
    const target = surfaceResponseState.target;
    if (!target || !target.isConnected || isDashboardInteractionActive()) {
      clearSurfaceResponse(target);
      return;
    }
    const currentScrollX = window.scrollX || 0;
    const currentScrollY = window.scrollY || 0;
    if (
      !surfaceResponseState.rect ||
      surfaceResponseState.scrollX !== currentScrollX ||
      surfaceResponseState.scrollY !== currentScrollY
    ) {
      surfaceResponseState.rect = target.getBoundingClientRect();
      surfaceResponseState.scrollX = currentScrollX;
      surfaceResponseState.scrollY = currentScrollY;
    }
    const rect = surfaceResponseState.rect;
    if (!rect?.width || !rect?.height) {
      clearSurfaceResponse(target);
      return;
    }
    target.dataset.hoverZone = surfaceZoneForPoint(rect, surfaceResponseState.clientX, surfaceResponseState.clientY);
    target.classList.add("surface-response-active");
    dashboardInteractionState.setHoverSuppression("surface-response", target);
  };
  const scheduleSurfaceResponse = (event) => {
    const target = surfaceResponseTargetFromEvent(event);
    if ((event.buttons || 0) === 0) {
      document.querySelectorAll("[data-surface-pressed='true']").forEach((pressedTarget) => pressedTarget.removeAttribute("data-surface-pressed"));
    }
    if (target !== surfaceResponseState.target) {
      clearSurfaceResponse();
      surfaceResponseState.target = target;
      surfaceResponseState.rect = target?.getBoundingClientRect?.() || null;
      surfaceResponseState.scrollX = window.scrollX || 0;
      surfaceResponseState.scrollY = window.scrollY || 0;
    }
    if (!target) return;
    surfaceResponseState.clientX = event.clientX;
    surfaceResponseState.clientY = event.clientY;
    if (!surfaceResponseState.frame) {
      surfaceResponseState.frame = requestAnimationFrame(updateSurfaceResponse);
    }
  };
  document.addEventListener("pointermove", scheduleSurfaceResponse, { passive: true });
  document.addEventListener("pointerleave", () => clearSurfaceResponse(), { passive: true });
  document.addEventListener("pointerdown", (event) => {
    const target = surfaceResponseTargetFromEvent(event);
    if (!target || isDashboardInteractionActive()) {
      clearSurfaceResponse();
      return;
    }
    if (target !== surfaceResponseState.target) {
      clearSurfaceResponse();
      surfaceResponseState.target = target;
      surfaceResponseState.rect = target.getBoundingClientRect();
      surfaceResponseState.scrollX = window.scrollX || 0;
      surfaceResponseState.scrollY = window.scrollY || 0;
    }
    surfaceResponseState.clientX = event.clientX;
    surfaceResponseState.clientY = event.clientY;
    target.dataset.hoverZone = surfaceZoneForPoint(surfaceResponseState.rect, event.clientX, event.clientY);
    target.dataset.surfacePressed = "true";
    target.classList.add("surface-response-active");
    requestAnimationFrame(() => {
      if (!target.isConnected || isDashboardInteractionActive()) return;
      if (target.dataset.surfacePressed !== "true") return;
      const rect = target.getBoundingClientRect();
      target.dataset.hoverZone = surfaceZoneForPoint(rect, event.clientX, event.clientY);
      target.dataset.surfacePressed = "true";
      target.classList.add("surface-response-active");
      surfaceResponseState.target = target;
      surfaceResponseState.rect = rect;
    });
  }, true);
  document.addEventListener("pointerdown", (event) => {
    const target = surfaceResponseTargetFromEvent(event);
    if (!target || isDashboardInteractionActive()) return;
    const rect = target.getBoundingClientRect();
    target.dataset.hoverZone = surfaceZoneForPoint(rect, event.clientX, event.clientY);
    target.dataset.surfacePressed = "true";
    target.classList.add("surface-response-active");
    surfaceResponseState.target = target;
    surfaceResponseState.rect = rect;
    surfaceResponseState.clientX = event.clientX;
    surfaceResponseState.clientY = event.clientY;
  });
  const clearSurfacePress = () => {
    document.querySelectorAll("[data-surface-pressed='true']").forEach((target) => target.removeAttribute("data-surface-pressed"));
  };
  document.addEventListener("pointerup", clearSurfacePress, true);
  document.addEventListener("pointercancel", clearSurfacePress, true);
  window.addEventListener("scroll", () => {
    if (!surfaceResponseState.target) return;
    surfaceResponseState.rect = null;
    if (!surfaceResponseState.frame) {
      surfaceResponseState.frame = requestAnimationFrame(updateSurfaceResponse);
    }
  }, { passive: true });
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
      item.classList.remove("widget-tools-open", "widget-workbench-open", "db-panel-tools-open");
      restoreDashboardToolDrawer(item.__dashboardToolDrawer);
      dashboardSettingsToggleForItem(item)?.setAttribute("aria-expanded", "false");
      dashboardColorToggleForItem(item)?.setAttribute("aria-expanded", "false");
      if (item.__widgetWorkbenchPanel) {
        restoreFloatingMenu(item.__widgetWorkbenchPanel);
        item.__widgetWorkbenchPanel.setAttribute("hidden", "");
      }
      setWidgetLinkNavigationSuspended(item, false);
    });
    document.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
    syncLayoutToolsActive();
  };
  const isDashboardToolInteractionTarget = (event) =>
    Boolean(event?.target?.closest?.(".panel-tool-drawer, .panel-settings-toggle, .widget-workbench-panel"));
  document.addEventListener("pointerdown", (event) => {
    if (isDashboardInteractionActive()) return;
    if (event.target?.closest?.(".panel-tool-drawer, .panel-settings-toggle, .panel-color-menu, .widget-workbench-panel")) return;
    closeInactiveDashboardTools();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!document.querySelector(".widget-tools-open, .widget-workbench-open, .db-panel-tools-open")) return;
    if (event.target?.closest?.(".panel-tool-drawer, .widget-workbench-panel, .panel-color-menu")) return;
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
  const liveLayoutUndo = new Map();
  const liveLayoutRedo = new Map();
  const liveLayoutUndoKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${profile}:${layoutKey}`;
  const undoTransientItemClasses = [...layoutPersistence.transientClasses];
  const sanitizeLayoutElementForUndo = layoutPersistence.sanitizeHtml;
  const serializeLayoutElement = layoutPersistence.serializeElement;
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
    dataSources: readRawStore(dataSourcesKey(layoutKey, profile), "[]"),
    workspaceContexts: readRawStore(workspaceContextsKey(layoutKey, profile), "[]"),
    profile,
  });
  const liveLayoutUndoSignature = (snapshot) => JSON.stringify({
    panels: snapshot.panels,
    widgets: snapshot.widgets,
    dataSources: snapshot.dataSources,
    workspaceContexts: snapshot.workspaceContexts,
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
  const RESIZE_AUTO_ZOOM_MIN_SCALE = 0.30;
  const RESIZE_AUTO_ZOOM_MARGIN = 22;
  const RESIZE_AUTO_ZOOM_EASE = 0.18;
  const resizeAutoZoomCamera = {
    active: false,
    frame: 0,
    scale: 1,
    targetScale: 1,
  };
  const clampResizeAutoZoomScale = (scale) => Math.max(RESIZE_AUTO_ZOOM_MIN_SCALE, Math.min(1, scale));
  const resizeAutoZoomViewport = () => {
    const navRect = document.querySelector(".app-nav")?.getBoundingClientRect?.();
    const top = Math.max(0, (navRect?.bottom || 0) + 12);
    const bottom = Math.max(top + 120, window.innerHeight - 18);
    const centerY = top + ((bottom - top) / 2);
    return {
      top,
      bottom,
      centerX: window.innerWidth / 2,
      centerY,
      height: bottom - top,
    };
  };
  const resizeAutoZoomTargetForBounds = (bounds) => {
    if (!bounds) return 1;
    const top = Number(bounds.top);
    const bottom = Number(bounds.bottom);
    const height = Number(bounds.height) || (bottom - top);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(height) || height <= 0) return 1;
    const viewport = resizeAutoZoomViewport();
    const fitsVertically = top >= viewport.top && bottom <= viewport.bottom && height <= viewport.height;
    if (fitsVertically) return 1;
    let target = 1;
    const usableHeight = Math.max(120, viewport.height - (RESIZE_AUTO_ZOOM_MARGIN * 2));
    if (height > usableHeight) {
      target = Math.min(target, usableHeight / height);
    }
    if (bottom > viewport.bottom && bottom > viewport.centerY) {
      const denominator = bottom - viewport.centerY;
      if (denominator > 0) {
        const bottomFitScale = (viewport.bottom - RESIZE_AUTO_ZOOM_MARGIN - viewport.centerY) / denominator;
        target = Math.min(target, Math.max(RESIZE_AUTO_ZOOM_MIN_SCALE, bottomFitScale));
      }
    }
    if (top < viewport.top && top < viewport.centerY) {
      const denominator = viewport.centerY - top;
      if (denominator > 0) {
        const topFitScale = (viewport.centerY - viewport.top - RESIZE_AUTO_ZOOM_MARGIN) / denominator;
        target = Math.min(target, Math.max(RESIZE_AUTO_ZOOM_MIN_SCALE, topFitScale));
      }
    }
    return clampResizeAutoZoomScale(target);
  };
  const resizeAutoZoomElementLayoutRect = (element) => {
    if (!element) return null;
    let left = 0;
    let top = 0;
    let node = element;
    while (node && node instanceof HTMLElement) {
      left += node.offsetLeft || 0;
      top += node.offsetTop || 0;
      node = node.offsetParent;
    }
    return {
      left: left - (window.scrollX || 0),
      top: top - (window.scrollY || document.documentElement.scrollTop || 0),
      width: element.offsetWidth || 0,
      height: element.offsetHeight || 0,
    };
  };
  const resizeAutoZoomSceneHosts = () => [...document.querySelectorAll(".dashboard-layout-grid")];
  const resizeAutoZoomSurfaces = () => [...document.querySelectorAll(
    ".dashboard-live-resize, .dashboard-expanded-footprint-ghost"
  )].filter((surface) => !surface.classList.contains("dashboard-group-resize-footprint"));
  const applyResizeAutoZoomSceneStyles = (scale, viewport) => {
    resizeAutoZoomSceneHosts().forEach((host) => {
      const rect = resizeAutoZoomElementLayoutRect(host);
      if (!rect) return;
      const originX = Number.isFinite(rect.left) ? `${Math.round(viewport.centerX - rect.left)}px` : "50%";
      const originY = Number.isFinite(rect.top) ? `${Math.round(viewport.centerY - rect.top)}px` : "50%";
      host.style.setProperty("--resize-camera-origin-x", originX);
      host.style.setProperty("--resize-camera-origin-y", originY);
      host.style.setProperty("transform-origin", `${originX} ${originY}`, "important");
      host.style.setProperty("transform", `scale(${scale.toFixed(4)})`, "important");
    });
  };
  const applyResizeAutoZoomSurfaceStyles = () => {
    const scale = Math.max(RESIZE_AUTO_ZOOM_MIN_SCALE, Math.min(1, resizeAutoZoomCamera.scale));
    const viewport = resizeAutoZoomViewport();
    document.documentElement.style.setProperty("--resize-camera-scale", scale.toFixed(4));
    const cameraVisible = scale < 0.999 || resizeAutoZoomCamera.targetScale < 0.999;
    document.body.classList.toggle("resize-auto-zoom-active", cameraVisible);
    if (cameraVisible) {
      document.body.dataset.resizeCameraScale = scale.toFixed(4);
    } else {
      delete document.body.dataset.resizeCameraScale;
    }
    applyResizeAutoZoomSceneStyles(scale, viewport);
    resizeAutoZoomSurfaces().forEach((surface) => {
      const left = Number.parseFloat(surface.style.left);
      const top = Number.parseFloat(surface.style.top);
      const originX = Number.isFinite(left) ? `${Math.round(viewport.centerX - left)}px` : "50%";
      const originY = Number.isFinite(top) ? `${Math.round(viewport.centerY - top)}px` : "50%";
      surface.style.setProperty("transform-origin", `${originX} ${originY}`, "important");
      surface.style.setProperty("transform", `scale(${scale.toFixed(4)})`, "important");
    });
    if (cameraVisible && isEngineerMode()) refreshEngineerOverlays();
  };
  const clearResizeAutoZoomSurfaceStyles = () => {
    resizeAutoZoomSceneHosts().forEach((host) => {
      host.style.removeProperty("--resize-camera-origin-x");
      host.style.removeProperty("--resize-camera-origin-y");
      host.style.removeProperty("transform");
      host.style.removeProperty("transform-origin");
    });
    resizeAutoZoomSurfaces().forEach((surface) => {
      surface.style.removeProperty("transform");
      surface.style.removeProperty("transform-origin");
    });
  };
  const resizeAutoZoomPointerToScenePoint = (clientX, clientY) => {
    const scale = Math.max(RESIZE_AUTO_ZOOM_MIN_SCALE, Math.min(1, resizeAutoZoomCamera.scale || 1));
    if (!resizeAutoZoomCamera.active || Math.abs(scale - 1) < 0.002) {
      return { x: clientX, y: clientY };
    }
    const viewport = resizeAutoZoomViewport();
    return {
      x: viewport.centerX + ((clientX - viewport.centerX) / scale),
      y: viewport.centerY + ((clientY - viewport.centerY) / scale),
    };
  };
  const tickResizeAutoZoomCamera = () => {
    resizeAutoZoomCamera.frame = 0;
    const delta = resizeAutoZoomCamera.targetScale - resizeAutoZoomCamera.scale;
    if (Math.abs(delta) < 0.002) {
      resizeAutoZoomCamera.scale = resizeAutoZoomCamera.targetScale;
    } else {
      resizeAutoZoomCamera.scale += delta * RESIZE_AUTO_ZOOM_EASE;
    }
    applyResizeAutoZoomSurfaceStyles();
    const shouldContinue = Math.abs(resizeAutoZoomCamera.targetScale - resizeAutoZoomCamera.scale) > 0.002 ||
      Math.abs(resizeAutoZoomCamera.scale - 1) > 0.002 ||
      (resizeAutoZoomCamera.active && resizeAutoZoomCamera.targetScale < 0.999);
    if (shouldContinue) {
      resizeAutoZoomCamera.frame = requestAnimationFrame(tickResizeAutoZoomCamera);
      return;
    }
    resizeAutoZoomCamera.scale = 1;
    resizeAutoZoomCamera.targetScale = 1;
    document.documentElement.style.removeProperty("--resize-camera-scale");
    document.body.classList.remove("resize-auto-zoom-active");
    delete document.body.dataset.resizeCameraScale;
    clearResizeAutoZoomSurfaceStyles();
  };
  const ensureResizeAutoZoomFrame = () => {
    if (!resizeAutoZoomCamera.frame) {
      resizeAutoZoomCamera.frame = requestAnimationFrame(tickResizeAutoZoomCamera);
    }
  };
  const beginResizeAutoZoomCamera = () => {
    resizeAutoZoomCamera.active = true;
    resizeAutoZoomCamera.targetScale = 1;
    ensureResizeAutoZoomFrame();
  };
  const updateResizeAutoZoomCamera = (bounds) => {
    resizeAutoZoomCamera.active = true;
    resizeAutoZoomCamera.targetScale = resizeAutoZoomTargetForBounds(bounds);
    ensureResizeAutoZoomFrame();
  };
  const endResizeAutoZoomCamera = ({ immediate = false } = {}) => {
    resizeAutoZoomCamera.active = false;
    resizeAutoZoomCamera.targetScale = 1;
    if (immediate) {
      if (resizeAutoZoomCamera.frame) cancelAnimationFrame(resizeAutoZoomCamera.frame);
      resizeAutoZoomCamera.frame = 0;
      resizeAutoZoomCamera.scale = 1;
      document.documentElement.style.removeProperty("--resize-camera-scale");
      document.body.classList.remove("resize-auto-zoom-active");
      delete document.body.dataset.resizeCameraScale;
      clearResizeAutoZoomSurfaceStyles();
      return;
    }
    ensureResizeAutoZoomFrame();
  };
  const cleanupDashboardUndoArtifacts = () => {
    endResizeAutoZoomCamera({ immediate: true });
    document.querySelectorAll(
      ".dashboard-live-resize, .dashboard-resize-preview, .dashboard-expanded-footprint-ghost, .dashboard-group-boundary, .dashboard-group-member-preview, .widget-placeholder, .db-panel-placeholder"
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
  const restoreLiveLayoutSnapshot = (snapshot) => {
    cleanupDashboardUndoArtifacts();
    const layoutKeyForSnapshot = snapshot.panels?.[0]?.selector?.match(/data-layout-key="([^"]+)"/)?.[1] ||
      snapshot.widgets?.[0]?.selector?.match(/data-widget-layout-key="([^"]+)"/)?.[1] ||
      "builder";
    if (snapshot.dataSources != null) writeRawStore(dataSourcesKey(layoutKeyForSnapshot, snapshot.profile), snapshot.dataSources);
    if (snapshot.workspaceContexts != null) writeRawStore(workspaceContextsKey(layoutKeyForSnapshot, snapshot.profile), snapshot.workspaceContexts);
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
        snapshot[key] = readRawStore(key, null);
      });
      writeJsonStore(layoutUndoKey(layoutKey, profile), { layoutKey, profile, snapshot });
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
    if (item?.dataset?.workspaceObjectType === "divider" || item?.classList?.contains("workspace-divider")) return "divider";
    if (item?.classList?.contains("widget-card")) return "widget";
    if (item?.classList?.contains("db-panel")) return "panel";
    return "";
  };
  const workspaceDeleteLayout = (item) => item?.closest?.(".widget-layout, .panel-layout");
  const workspaceDeleteLayoutKey = (item) => {
    const layout = workspaceDeleteLayout(item);
    if (isPanelInternalWidgetLayout(layout)) return gridItemLayoutKey(layout);
    return layout?.dataset.widgetLayoutKey || layout?.dataset.layoutKey || "default";
  };
  const workspaceDeleteTitle = (item) => {
    const kind = workspaceDeleteKind(item);
    if (kind === "widget") return item.dataset.panelTitle || item.querySelector(".stat-lbl")?.textContent?.trim() || "Widget";
    return item.dataset.panelTitle || item.querySelector(".db-panel-title")?.textContent?.trim() || (kind === "divider" ? "Divider" : "Panel");
  };
  const workspaceDeleteId = (item) => {
    const kind = workspaceDeleteKind(item);
    const key = kind === "widget" ? item?.dataset?.widgetKey : item?.dataset?.panelKey;
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
      if (entry.kind === "widget") {
        cleanupWidgetRowBreaks(entry.layout);
        saveWidgetLayouts(entry.layout, getActivePanelProfile(entry.layoutKey), { persist: true, history: false });
        touched.set(`${entry.layoutKey}:grid`, { layoutKey: entry.layoutKey, profile: getActivePanelProfile(entry.layoutKey) });
      } else {
        cleanupPanelRowBreaks(entry.layout);
        savePanelLayouts(entry.layout, getActivePanelProfile(entry.layoutKey), { persist: true, history: false });
        touched.set(`${entry.layoutKey}:grid`, { layoutKey: entry.layoutKey, profile: getActivePanelProfile(entry.layoutKey) });
      }
    });
    [...new Map([...touched.values()].map((value) => [`${value.profile}:${value.layoutKey}`, value])).values()]
      .forEach(({ layoutKey, profile }) => pushLiveLayoutUndo(layoutKey, profile));
  };
  const clearWorkspaceDeleteInteractionState = (entries) => {
    entries.forEach((entry) => {
      restoreDashboardToolDrawer(entry.item.__dashboardToolDrawer);
      entry.item.classList.remove("widget-tools-open", "db-panel-tools-open", "group-selected");
      dashboardSettingsToggleForItem(entry.item)?.setAttribute("aria-expanded", "false");
      dashboardColorToggleForItem(entry.item)?.setAttribute("aria-expanded", "false");
      entry.item.querySelectorAll?.(".panel-color-menu-open").forEach((menu) => {
        menu.classList.remove("panel-color-menu-open");
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
        if (entry.kind === "panel" && entry.layout && entry.item.__activeExpansionSource) {
          relaxCollapsedExpansionDisplacement(entry.layout, null);
          endPanelExpansionSession(entry.layout, entry.item);
        }
      } else {
        if (entry.kind === "panel" && entry.layout && entry.item.__activeExpansionSource) {
          entry.item.hidden = true;
          relaxCollapsedExpansionDisplacement(entry.layout, null);
          endPanelExpansionSession(entry.layout, entry.item);
        }
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
        type: "object-deleted",
        source: "object-delete",
        layoutKey: entry.layoutKey,
        objectId: entry.item.dataset.widgetKey || entry.item.dataset.panelKey || "",
        objectType: entry.kind,
        regionId: regionIdForWorkspaceItem(entry.item),
        panelId: entry.item.dataset.parentPanelKey || entry.item.closest?.(".db-panel")?.dataset?.panelKey || "",
        label: `${entry.title} ${entry.kind} deleted`,
        payload: { title: entry.title, extractedPanelChildren: entry.kind === "panel" ? panelChildWidgets(entry.item).length : 0 },
      });
    });
    showToast(entries.length > 1 ? `${entries.length} objects deleted.` : `${entries[0].title} ${entries[0].kind} deleted.`, "info");
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
  const getPanelMinimumWidth = (panel) => panelRuntime.getPanelMinimumWidth(panel);

  const syncPanelMinimumWidth = (panel) => panelRuntime.syncPanelMinimumWidth(panel);

  const DASHBOARD_GRID_COLUMNS = 6;
  const DASHBOARD_GRID_ROW_HEIGHT = 81;
  const dashboardGeometry = window.dashboardGeometry;
  let panelRuntime = null;
  let panelContainmentRuntime = null;

  const isPanelInternalWidgetLayout = (layout) => dashboardPanelContainment.isPanelInternalWidgetLayout(layout);
  const panelForInternalWidgetLayout = (layout) => dashboardPanelContainment.panelForInternalWidgetLayout(layout);
  const gridHostForLayout = (layout) => dashboardPanelContainment.gridHostForLayout(layout);
  const isPanelInternalGridItem = (item) => dashboardPanelContainment.isPanelInternalGridItem(item);

  const gridContentRectForHost = (host, rect) => dashboardPanelContainment.gridContentRectForHost(host, rect);

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
    return dashboardGeometry.gridHeightForRows(rows, gap, rowHeight);
  };

  const gridRowsFromHeight = (height, gap, minRows = 1, rowHeight = DASHBOARD_GRID_ROW_HEIGHT) => {
    return dashboardGeometry.gridRowsFromHeight(height, gap, minRows, rowHeight);
  };

  const isWidgetGridItem = (item) => (
    item?.classList?.contains("widget-card") ||
    item?.classList?.contains("widget-placeholder")
  );

  const WORKSPACE_OBJECT_TYPES = Object.freeze({
    widget: "widget",
    panel: "panel",
    divider: "divider",
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
    if (rawType === "divider" || rawType === "context-divider") return WORKSPACE_OBJECT_TYPES.divider;
    if (rawType === "panel") return WORKSPACE_OBJECT_TYPES.panel;
    return fallback || WORKSPACE_OBJECT_TYPES.widget;
  };
  const workspaceObjectType = (item) => {
    const rawType = item?.dataset?.workspaceObjectType || item?.dataset?.dashboardObjectKind || item?.dataset?.widgetType;
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
  const workspaceObjectKey = (item) => item?.dataset?.widgetKey || item?.dataset?.panelKey || "";
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
  const loadWorkspaceContextLinks = () => [];
  const contextElementById = (id, layoutKey = "builder") => {
    const key = String(id || "");
    if (!key) return null;
    const escaped = CSS.escape(key);
    return document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] .widget-card[data-widget-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .panel-internal-widget-grid .widget-card[data-widget-key="${escaped}"]`) ||
      document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"] .db-panel[data-panel-key="${escaped}"]`) ||
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
  const dataOriginDefinitions = new Map();
  const registerDataOriginDefinition = (definition = {}) => {
    const kind = String(definition.kind || "").trim();
    if (!kind) return false;
    dataOriginDefinitions.set(kind, {
      kind,
      label: String(definition.label || kind),
      category: String(definition.category || "dataset"),
      description: String(definition.description || ""),
      durable: definition.durable !== false,
      realtime: Boolean(definition.realtime),
      derived: Boolean(definition.derived),
      implemented: definition.implemented !== false,
    });
    return true;
  };
  [
    { kind: "manual", label: "Dataset Origin", category: "local", description: "Normalized in-workspace rows." },
    { kind: "json", label: "Uploaded JSON Origin", category: "file", description: "Uploaded or pasted JSON rows." },
    { kind: "csv", label: "Uploaded CSV Origin", category: "file", description: "Uploaded CSV rows normalized into records." },
    { kind: "sql", label: "SQL Origin", category: "external", description: "Future normalized SQL query output." },
    { kind: "api", label: "API Origin", category: "external", description: "Future normalized API response rows." },
    { kind: "uploaded-file", label: "Uploaded File Origin", category: "file", description: "Future file-backed normalized data." },
    { kind: "scenario", label: "Scenario Origin", category: "scenario", description: "Scenario branch rows derived without mutating base data." },
    { kind: "derived", label: "Derived Dataset Origin", category: "derived", description: "Reusable transformed dataset stream.", derived: true },
    { kind: "ai-generated", label: "AI Generated Dataset Origin", category: "derived", description: "AI-created normalized dataset that remains inspectable.", derived: true },
    { kind: "realtime-stream", label: "Real-time Stream Origin", category: "stream", description: "Future streaming records cache.", realtime: true },
    { kind: "cached-query", label: "Cached Query Origin", category: "cache", description: "Cached query result promoted to substrate." },
  ].forEach(registerDataOriginDefinition);
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
      dateField: best(["created_at", "createdat", "updated_at", "updatedat", "timestamp", "order_date", "date", "time"], "date"),
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
  const dataSubstrateRowsForSource = (source, layoutKey = "builder", profile = getActivePanelProfile(layoutKey), stack = new Set()) => {
    if (!source?.id) return [];
    if (source.kind !== "derived") return sourceRows(source);
    if (stack.has(source.id)) return [];
    const sourceId = source.config?.sourceId || source.config?.baseSourceId || "";
    const base = dataSourceById(layoutKey, profile, sourceId);
    if (!base) return sourceRows(source);
    const baseRows = dataSubstrateRowsForSource(base, layoutKey, profile, new Set([...stack, source.id]));
    const transformRuntime = window.dashboardDataTransformRuntime;
    if (!transformRuntime?.queryRows) return baseRows;
    try {
      const transformed = transformRuntime.queryRows(baseRows, source.config?.transform || {}, {
        semanticMapping: source.config?.semanticMapping || {},
        now: transformRuntime.demoNow,
      });
      return transformed.rows || [];
    } catch {
      return [];
    }
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
    introspect: async (source) => inferDataSchema(
      dataSubstrateRowsForSource(
        source,
        source?.config?.layoutKey || "builder",
        source?.config?.profile || getActivePanelProfile(source?.config?.layoutKey || "builder")
      ),
      source?.config?.schema || source?.config?.fields || []
    ),
    query: async (source, request = {}) => {
      const mapping = request.semanticMapping || {};
      const baseRows = dataSubstrateRowsForSource(
        source,
        request.layoutKey || "builder",
        request.profile || getActivePanelProfile(request.layoutKey || "builder")
      );
      const filters = [...(request.filters || [])];
      const transformRuntime = window.dashboardDataTransformRuntime;
      if (transformRuntime?.queryRows) {
        try {
          const transformed = transformRuntime.queryRows(baseRows, {
            ...request,
            filters,
            semanticMapping: mapping,
          }, {
            semanticMapping: mapping,
            now: transformRuntime.demoNow,
          });
          return {
            schema: transformed.schema || inferDataSchema(transformed.rows, source?.config?.schema || source?.config?.fields || []),
            rows: transformed.rows || [],
            total: Number.isFinite(Number(transformed.total)) ? Number(transformed.total) : (transformed.rows || []).length,
            sourceId: source.id,
            sourceKind: source.kind,
          };
        } catch (error) {
          return {
            schema: { fields: [] },
            rows: [],
            total: 0,
            error: error?.message || "Data transform failed.",
            sourceId: source.id,
            sourceKind: source.kind,
          };
        }
      }
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
  registerDataSourceAdapter(createRecordAdapter("sql"));
  registerDataSourceAdapter(createRecordAdapter("api"));
  registerDataSourceAdapter(createRecordAdapter("uploaded-file"));
  registerDataSourceAdapter(createRecordAdapter("scenario"));
  registerDataSourceAdapter(createRecordAdapter("derived"));
  registerDataSourceAdapter(createRecordAdapter("ai-generated"));
  registerDataSourceAdapter(createRecordAdapter("realtime-stream"));
  registerDataSourceAdapter(createRecordAdapter("cached-query"));

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
      dataSourceId: dataSourceId || undefined,
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
  const mergeWorkspaceContexts = (...contexts) => contexts.filter(Boolean).reduce((merged, context) => {
    const scalarContext = Object.fromEntries(Object.entries(context)
      .filter(([key, value]) =>
        !["semanticMapping", "filters", "tags", "visualSettings"].includes(key) &&
        value !== undefined &&
        value !== null
      ));
    return {
      ...merged,
      ...scalarContext,
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
    };
  }, {});
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
  const activeExpansionBaselineLayoutForItem = (item) => {
    if (!item || isPanelInternalGridItem(item)) return null;
    if (item.closest?.(".panel-layout")) return item.closest(".panel-layout");
    const layoutKey = activeLayoutKeyForItem(item) || "default";
    return document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
  };
  const layoutHasActiveExpansionSource = (layout) => [...(layout?.__activeExpansionPanels || [])]
    .some((panel) => panel?.isConnected && panel.__activeExpansionSource && !panel.classList.contains("db-panel-collapsed"));
  const expansionBaselineStateForItem = (item) => {
    const layout = activeExpansionBaselineLayoutForItem(item);
    const snapshot = layout?.__expansionBaselineSnapshot;
    if (!snapshot || !layoutHasActiveExpansionSource(layout)) return null;
    if (item?.__activeExpansionSource && layout.__activeExpansionPanels?.has(item)) return null;
    return snapshot.get(item) || null;
  };
  const gridStateFromElement = (item) => ({
    gridCol: item.dataset.gridCol,
    gridRow: item.dataset.gridRow,
    gridRowSpan: item.dataset.gridRowSpan,
    currentSpan: item.dataset.currentSpan,
    savedHeight: item.dataset.savedHeight,
    gridColumnStyle: item.style.gridColumn,
    gridRowStyle: item.style.gridRow,
    heightStyle: item.style.height,
  });
  const applyGridStateToElement = (item, state = {}) => {
    if (!item || !state) return;
    ["gridCol", "gridRow", "gridRowSpan", "currentSpan", "savedHeight"].forEach((key) => {
      if (state[key] === undefined || state[key] === null || state[key] === "") {
        delete item.dataset[key];
      } else {
        item.dataset[key] = state[key];
      }
    });
    item.style.gridColumn = state.gridColumnStyle || "";
    item.style.gridRow = state.gridRowStyle || "";
    item.style.height = state.heightStyle || "";
  };
  const persistentGridStateForItem = (item) => expansionBaselineStateForItem(item) || gridStateFromElement(item);
  const commitExpansionBaselineForItem = (item) => {
    const layout = activeExpansionBaselineLayoutForItem(item);
    const snapshot = layout?.__expansionBaselineSnapshot;
    if (!snapshot || !layoutHasActiveExpansionSource(layout) || !snapshot.has(item)) return;
    snapshot.set(item, gridStateFromElement(item));
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
  const panelContextForInternalWidget = (item) => {
    const internalPanel = panelForInternalWidgetLayout(item?.closest?.(".panel-internal-widget-grid"));
    return internalPanel ? workspaceContextFromElement(internalPanel) : null;
  };
  const resolveWorkspaceContextForItem = (item, options = {}) => {
    const layoutKey = options.layoutKey || activeLayoutKeyForItem(item);
    const profile = options.profile || getActivePanelProfile(layoutKey);
    const regionId = regionIdForWorkspaceItem(item);
    const objectId = workspaceObjectKey(item);
    const localContext = workspaceContextFromElement(item);
    const panelContext = panelContextForInternalWidget(item);
    const inheritedContext = resolveWorkspaceRegionContext(layoutKey, profile, regionId, options.contextLinkStack || new Set());
    const objectLinkedContext = objectId
      ? linkedContextForTarget(objectId, layoutKey, profile, {}, options.contextLinkStack || new Set())
      : {};
    const scopedContext = mergeWorkspaceContexts(inheritedContext, panelContext);
    const timeRangeContext = timeRangeContextForRegion(layoutKey, regionId, scopedContext);
    const filterContext = filterContextForRegion(layoutKey, regionId, mergeWorkspaceContexts(scopedContext, objectLinkedContext, timeRangeContext));
    const resolved = mergeWorkspaceContexts(scopedContext, objectLinkedContext, timeRangeContext, filterContext, localContext);
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
      layoutKey: resolvedContext.layoutKey,
      profile: resolvedContext.profile,
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
  const demoQueryStateForWidget = async (definition, instance, resolvedContext, options = {}) => {
    if (typeof definition?.getDemoData !== "function") return null;
    const demo = definition.getDemoData(instance.config || {}, resolvedContext || {}) || null;
    const rows = Array.isArray(demo?.rows) ? demo.rows : [];
    if (!rows.length) return null;
    const semanticMapping = {
      ...(demo.semanticMapping || {}),
      ...(resolvedContext?.semanticMapping || {}),
    };
    const demoContext = {
      ...(resolvedContext || {}),
      id: resolvedContext?.id || `${definition.type || "widget"}:demo`,
      name: resolvedContext?.name || demo.name || "Demo data",
      dataSourceId: demo.sourceId || "__demo-widget-source",
      dataSourceName: demo.sourceName || "Demo data",
      dataSourceKind: "manual",
      adapterKind: "manual",
      semanticMapping,
      canQuery: true,
    };
    const query = typeof definition.resolveQuery === "function"
      ? definition.resolveQuery(instance.config || {}, demoContext)
      : null;
    if (!query) return null;
    const adapter = dataSourceAdapters.get("manual");
    if (!adapter) return null;
    const result = await adapter.query({
      id: demoContext.dataSourceId,
      name: demoContext.dataSourceName,
      kind: "manual",
      config: {
        rows,
        schema: demo.schema?.fields || demo.fields || [],
      },
    }, {
      ...query,
      filters: [...(demoContext.filters || []), ...(query.filters || [])],
      timeRange: query.timeRange || demoContext.timeRange,
      semanticMapping,
    });
    return {
      context: demoContext,
      query,
      state: stateFromQueryResult({
        ...result,
        demo: true,
        sourceId: demoContext.dataSourceId,
        sourceKind: "manual",
      }, demoContext),
    };
  };
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
    return [context.dataSourceName || context.dataSourceId || "No source", ...mappedFields.slice(0, 2)].join(" / ");
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
      ...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"] > .widget-card`),
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
    !(workspaceObjectType(item) === WORKSPACE_OBJECT_TYPES.widget && widgetLayerForElement(item) === "backend" && !isEngineerMode()) &&
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
    const context = resolveWorkspaceContextForItem(item || committedContextRegionLayout(layoutKey), { layoutKey, profile });
    return {
      id: regionId,
      label: regionLabelForSummary(regionId, layoutKey, profile),
      startRow: region?.startRow || 1,
      endRow: region?.endRow || null,
      widgets: counts.widgets,
      panels: counts.panels,
      dividers: counts.dividers,
      totalObjects: counts.widgets + counts.panels + counts.dividers,
      dataSourceName: context?.dataSourceName || context?.dataSourceId || "",
      tags: Array.isArray(context?.tags) ? context.tags : [],
    };
  };

  const emptyWorkspaceLogicGraph = () => ({ version: 1, links: [], relationships: [], operators: [], styleRules: [], contextLinks: [] });
  const normalizeWorkspaceLogicGraph = () => emptyWorkspaceLogicGraph();
  const persistedWorkspaceEndpointIds = (snapshot = {}) => new Set([
    ...(snapshot.widgets || []).map((widget) => widget.id),
    ...(snapshot.panels || []).map((panel) => panel.id),
    ...(snapshot.dividers || []).map((divider) => divider.id),
    ...(snapshot.contexts || []).map((context) => context.id),
  ].map(String).filter(Boolean));
  const pruneWorkspaceLogicGraphForEndpointIds = () => emptyWorkspaceLogicGraph();
  const workspaceLogicGraphFromPersistedSnapshot = () => emptyWorkspaceLogicGraph();
  const loadWorkspaceLogicGraph = () => emptyWorkspaceLogicGraph();
  const saveWorkspaceLogicGraph = (layoutKey = "builder", _graph = {}, profile = getActivePanelProfile(layoutKey), options = {}) => {
    removeStore(workspaceLogicGraphKey(layoutKey, profile));
    if (options.history !== false) pushLiveLayoutUndo(layoutKey, profile);
    return emptyWorkspaceLogicGraph();
  };
  const deriveWorkspaceRelationships = () => [];
  const inspectDataSubstrate = () => [];
  const datasetOriginExposedDatasets = () => [];  const clampMinimapValue = (value, min, max) => Math.max(min, Math.min(max, value));
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

  const gridItemMinimumSpan = (item) => {
    const explicit = Number(item?.dataset?.minW || item?.dataset?.minSpan);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(6, Math.ceil(explicit)));
    if (item?.dataset?.widgetType === "controls") return 2;
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

  const panelMinimumRows = (panel, metrics = null) => panelRuntime.panelMinimumRows(panel, metrics);

  const panelExpandedMinimumRows = (panel, layout = panel.closest(".panel-layout"), metrics = null) => (
    panelRuntime.panelExpandedMinimumRows(panel, layout, metrics)
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

  const syncPanelRenderedHeightToFootprint = (panel, rowSpan = null) => (
    panelRuntime.syncPanelRenderedHeightToFootprint(panel, rowSpan)
  );

  const applyPanelSpan = (panel, span) => panelRuntime.applyPanelSpan(panel, span);

  const applyPanelGridPosition = (panel, col, row) => panelRuntime.applyPanelGridPosition(panel, col, row);

  const gridCellFromPoint = (layout, item, clientX, clientY, metrics = null) => {
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const columnWidth = metrics?.columnWidth ?? ((Math.max(1, layoutRect.width) - (gap * 5)) / 6);
    const span = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    const rowSpan = gridItemRowSpan(item, metrics);
    const rowHeight = metrics?.rowHeight || DASHBOARD_GRID_ROW_HEIGHT;
    return dashboardGeometry.gridCellFromPoint({
      layoutRect,
      clientX,
      clientY,
      itemSpan: span,
      itemRowSpan: rowSpan,
      columnWidth,
      gap,
      rowHeight,
      columns: DASHBOARD_GRID_COLUMNS,
    });
  };

  const gridCellFromDragPointer = (layout, item, clientX, clientY, offsetX, offsetY, metrics = null, dragRect = null) => {
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
      return gridCellFromPoint(layout, item, clientX, clientY, metrics);
    }
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const gap = metrics?.gap ?? gridGapForLayout(layout);
    const columnWidth = metrics?.columnWidth ?? ((Math.max(1, layoutRect.width) - (gap * 5)) / 6);
    const span = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    const rowSpan = gridItemRowSpan(item, metrics);
    const rowHeight = metrics?.rowHeight || DASHBOARD_GRID_ROW_HEIGHT;
    return dashboardGeometry.gridCellFromDragPointer({
      layoutRect,
      clientX,
      clientY,
      offsetX,
      offsetY,
      sourceWidth: dragRect?.width,
      sourceHeight: dragRect?.height,
      itemSpan: span,
      itemRowSpan: rowSpan,
      columnWidth,
      gap,
      rowHeight,
      columns: DASHBOARD_GRID_COLUMNS,
    });
  };

  const panelGridCellFromPoint = (layout, panel, clientX, clientY) => gridCellFromPoint(layout, panel, clientX, clientY);

  const spanFromAlignedWidth = (layout, width, gap, minSpan, metrics = null) => {
    const layoutWidth = metrics?.width ?? Math.max(1, gridRectForLayout(layout).width);
    const columnCount = (layout.classList.contains("widget-layout") || layout.classList.contains("panel-layout")) ? 6 : 12;
    const columnWidth = (layoutWidth - (gap * (columnCount - 1))) / columnCount;
    return Math.max(minSpan, Math.min(columnCount, (Math.max(1, width) + gap) / (columnWidth + gap)));
  };

  const resizeAlignmentTargetsForLayout = (layout) => {
    if (isPanelInternalWidgetLayout(layout)) {
      return [...layout.querySelectorAll(":scope > .widget-card:not([hidden]), :scope > .widget-placeholder")];
    }
    return globalGridItems(layout, { includePlaceholders: true });
  };

  const alignedResizeSpan = ({ layout, item, currentSpan, gap, minSpan, metrics = null }) => {
    const rect = item.getBoundingClientRect();
    const layoutRect = metrics?.rect || gridRectForLayout(layout);
    const tolerance = 18;
    const candidates = [{ edge: layoutRect.right, priority: 1 }];
    resizeAlignmentTargetsForLayout(layout).forEach((target) => {
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

  const getPanelMinimumHeight = (panel) => panelRuntime.getPanelMinimumHeight(panel);

  const applyPanelHeight = (panel, height) => panelRuntime.applyPanelHeight(panel, height);

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
    if (!widget?.classList?.contains("widget-card")) return [];
    clearConditionalStyleForWidget(widget);
    return [];
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
        ${options.includeTitle === false ? "" : '<button class="panel-tool-button panel-title-handle" type="button" aria-label="Rename panel" title="Rename panel"><span class="text-icon" aria-hidden="true"></span></button>'}
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
        </div>
      </div>
      <div class="db-panel-body">
        <div class="empty-state panel-empty-state" data-panel-placeholder="empty">
          <strong>Empty panel</strong>
          <small>Drop widgets here</small>
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
        writeJsonStore(panelStorageKey(layoutKey, key, profile), {
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
        });
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
      writeJsonStore(customPanelsKey(layoutKey, profile), customPanels);
      writeRawStore(hiddenPanelsKey(layoutKey, profile), layout.dataset.hiddenPanelsDraft || "[]");
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
    const height = menu.offsetHeight || menu.getBoundingClientRect().height || 0;
    const gutter = 12;
    const left = Math.max(gutter, Math.min(window.innerWidth - width - gutter, rect.right - width + 2));
    const belowTop = rect.bottom + 12;
    const aboveTop = rect.top - height - 12;
    const top = belowTop + height > window.innerHeight - gutter && aboveTop >= gutter
      ? aboveTop
      : Math.max(gutter, Math.min(window.innerHeight - height - gutter, belowTop));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  const positionDashboardToolDrawer = (item, settingsButton, drawer) => {
    if (!item || !settingsButton || !drawer) return;
    const settingsRect = settingsButton.getBoundingClientRect();
    const drawerWidth = drawer.offsetWidth || drawer.getBoundingClientRect().width;
    const drawerHeight = drawer.offsetHeight || drawer.getBoundingClientRect().height;
    if (!drawerWidth || !drawerHeight) return;
    const drawerStyles = window.getComputedStyle(drawer);
    const gap = parseFloat(drawerStyles.columnGap || drawerStyles.gap || "0") || 0;
    const padding = parseFloat(drawerStyles.paddingTop || "0") || 0;
    const clearance = Math.max(4, padding || gap || 4);
    const anchorGap = Math.max(4, gap || padding || 4);
    if (drawer.classList.contains("dashboard-tool-drawer-portaled")) {
      const viewportGutter = Math.max(8, clearance);
      let left = settingsRect.left - anchorGap - drawerWidth;
      let top = settingsRect.top + (settingsRect.height / 2) - (drawerHeight / 2);
      const header = item.querySelector(":scope > .db-panel-hd");
      if (header?.contains(settingsButton)) {
        const headerRect = header.getBoundingClientRect();
        top = Math.min(top, headerRect.bottom - drawerHeight - clearance);
      }
      left = Math.max(viewportGutter, Math.min(left, window.innerWidth - viewportGutter - drawerWidth));
      top = Math.max(viewportGutter, Math.min(top, window.innerHeight - viewportGutter - drawerHeight));
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-left", `${Math.round(left)}px`);
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-top", `${Math.round(top)}px`);
      return;
    }
    const anchor = drawer.offsetParent || item;
    const anchorRect = anchor.getBoundingClientRect();
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

  const positionDashboardToolDrawerAtPointer = (item, drawer, clientX, clientY) => {
    if (!item || !drawer || clientX == null || clientY == null) return;
    const drawerWidth = drawer.offsetWidth || drawer.getBoundingClientRect().width;
    const drawerHeight = drawer.offsetHeight || drawer.getBoundingClientRect().height;
    if (!drawerWidth || !drawerHeight) return;
    const viewportGutter = 8;
    if (drawer.classList.contains("dashboard-tool-drawer-portaled")) {
      const left = Math.max(viewportGutter, Math.min(clientX - drawerWidth, window.innerWidth - viewportGutter - drawerWidth));
      const top = Math.max(viewportGutter, Math.min(clientY, window.innerHeight - viewportGutter - drawerHeight));
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-left", `${Math.round(left)}px`);
      drawer.style.setProperty("--dashboard-tool-drawer-fixed-top", `${Math.round(top)}px`);
      return;
    }
    const anchor = drawer.offsetParent || item;
    const anchorRect = anchor.getBoundingClientRect();
    let right = Math.max(0, anchorRect.right - clientX);
    const maxRight = Math.max(0, anchorRect.right - viewportGutter - drawerWidth);
    right = Math.min(right, maxRight);
    let top = clientY - anchorRect.top;
    const minTop = viewportGutter - anchorRect.top;
    const maxTop = window.innerHeight - viewportGutter - anchorRect.top - drawerHeight;
    top = Math.max(minTop, Math.min(top, maxTop));
    drawer.style.setProperty("--dashboard-tool-drawer-top", `${Math.round(top)}px`);
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
    menuOverlayLayer().appendChild(menu);
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

  const widgetRuntimeController = window.dashboardWidgetRuntimeController.createRuntime({
    escapeHtml,
    parseJsonRecord,
    isPanelInternalGridItem,
    isWidgetGridItem,
    gridGapForLayout,
    gridRowHeightForLayout,
    gridHeightForRows,
    gridItemMinimumRows,
    gridItemMinimumSpan,
    gridItemRowSpan,
    panelToolButtonsMarkup,
    ensureWorkspaceObjectMetadata,
    WORKSPACE_OBJECT_TYPES,
    isMediaWidgetDefinition: (definition) => isMediaWidgetDefinition(definition),
    mediaWidgetAssetState: (widget, config, definition) => mediaWidgetAssetState(widget, config, definition),
    isSignalConsumerWidget: (widget, definition) => isSignalConsumerWidget(widget, definition),
    dataflowSignalStateForWidget: (widget) => dataflowSignalStateForWidget(widget),
    applySignalConsumerState: (widget, signalState, config) => applySignalConsumerState(widget, signalState, config),
    clearSignalConsumerState: (widget) => clearSignalConsumerState(widget),
    applyStyleRulesForWidget,
    syncWidgetContextOutputs: (widget) => syncWidgetContextOutputs(widget),
  });
  const widgetRuntime = widgetRuntimeController.registry;
  const widgetDefinitionFor = (type) => widgetRuntimeController.definitionFor(type);
  const widgetRuntimeTypeFromElement = (widget) => widgetRuntimeController.runtimeTypeFromElement(widget);
  const widgetDefinitionForElement = (widget) => widgetRuntimeController.definitionForElement(widget);
  const normalizeWorkspaceWidgetLayer = (value, fallback = "presentation") => widgetRuntimeController.normalizeWorkspaceWidgetLayer(value, fallback);
  const widgetLayerForElement = (widget, definition = widgetDefinitionForElement(widget)) => widgetRuntimeController.layerForElement(widget, definition);
  const applyWidgetLayerMetadata = (widget, definition = widgetDefinitionForElement(widget), explicitLayer = "") => widgetRuntimeController.applyLayerMetadata(widget, definition, explicitLayer);
  const parseWidgetConfig = (value) => widgetRuntimeController.parseConfig(value);
  const uniqueValues = (values = []) => [...new Set(values.filter((value) => value != null && String(value).trim()))];
  const setWidgetConfig = (widget, config) => widgetRuntimeController.setConfig(widget, config);
  const setWidgetLinkNavigationSuspended = (widget, suspended) => widgetRuntimeController.setLinkNavigationSuspended(widget, suspended);
  const setWidgetConfigValue = (widget, key, value) => widgetRuntimeController.setConfigValue(widget, key, value);
  const widgetConfigFromElement = (widget, definition = widgetDefinitionForElement(widget)) => widgetRuntimeController.configFromElement(widget, definition);
  const widgetAvailableSizeForDensity = (widget) => widgetRuntimeController.availableSizeForDensity(widget);
  const applyWidgetDensityMetadata = (widget, density) => widgetRuntimeController.applyDensityMetadata(widget, density);
  const resolveWidgetDensityForElement = (widget, definition = widgetDefinitionForElement(widget), availableSize = widgetAvailableSizeForDensity(widget)) => (
    widgetRuntimeController.resolveDensityForElement(widget, definition, availableSize)
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
  const isSignalConsumerWidget = (widget, definition = widgetDefinitionForElement(widget)) =>
    Boolean(definition?.capabilities?.consumesSignals) || widgetRuntimeTypeFromElement(widget) === "shift";
  const dataflowSignalStateForWidget = (widget, layoutKey = activeLayoutKeyForItem(widget), profile = getActivePanelProfile(layoutKey)) => {
    const targetId = widget?.dataset?.widgetKey || "";
    if (!targetId) return { connected: false, active: false, incomingCount: 0, sourceIds: [] };
    return { connected: false, active: false, incomingCount: 0, sourceIds: [], sourceLabels: [], linkIds: [], activeLinkId: "" };
  };
  const applySignalConsumerState = (widget, signalState = {}, config = {}) => {
    if (!widget) return;
    const active = Boolean(signalState.active);
    const color = String(active ? (config.stateBColor || "#f59e0b") : (config.stateAColor || "#64748b"));
    const opacity = Math.max(.35, Math.min(1, Number(active ? config.stateBOpacity : config.stateAOpacity) || (active ? .92 : .72)));
    const rgb = hexToRgb(color);
    widget.classList.toggle("shift-widget-signal-active", active);
    widget.classList.toggle("shift-widget-signal-inactive", !active);
    widget.classList.toggle("shift-widget-signal-connected", Boolean(signalState.connected));
    widget.dataset.shiftSignalActive = active ? "true" : "false";
    widget.dataset.shiftSignalConnected = signalState.connected ? "true" : "false";
    widget.dataset.shiftSignalIncomingCount = String(signalState.incomingCount || 0);
    widget.dataset.shiftSignalSourceIds = (signalState.sourceIds || []).join(",");
    widget.dataset.shiftSignalLinkIds = (signalState.linkIds || []).join(",");
    widget.dataset.shiftSignalReason = signalState.connected
      ? `${active ? "Active" : "Inactive"} from ${signalState.sourceLabels?.[0] || signalState.sourceIds?.[0] || "dataflow"}`
      : "No dataflow input";
    widget.style.setProperty("--shift-state-opacity", String(opacity));
    if (rgb) {
      widget.style.setProperty("--shift-state-color", `#${color.replace("#", "")}`);
      widget.style.setProperty("--shift-state-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      widget.style.setProperty("--panel-accent", `#${color.replace("#", "")}`);
      widget.style.setProperty("--panel-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      widget.style.setProperty("--panel-accent-text", readableTextFor(rgb));
    }
  };
  const clearSignalConsumerState = (widget) => {
    if (!widget?.classList?.contains("shift-widget-card")) return;
    widget.classList.remove("shift-widget-signal-active", "shift-widget-signal-inactive", "shift-widget-signal-connected");
    ["--shift-state-color", "--shift-state-rgb", "--shift-state-opacity"].forEach((property) => widget.style.removeProperty(property));
    delete widget.dataset.shiftSignalActive;
    delete widget.dataset.shiftSignalConnected;
    delete widget.dataset.shiftSignalIncomingCount;
    delete widget.dataset.shiftSignalSourceIds;
    delete widget.dataset.shiftSignalLinkIds;
    delete widget.dataset.shiftSignalReason;
  };
  const refreshSignalConsumerWidgetsForLinks = (layoutKey = "builder", links = []) => {
    const targetIds = new Set((links || []).map((link) => link?.target?.objectId).filter(Boolean));
    const selector = targetIds.size
      ? [...targetIds].map((id) => `.widget-card[data-widget-key="${CSS.escape(id)}"]`).join(",")
      : ".widget-card[data-widget-definition='shift']";
    document.querySelectorAll(selector).forEach((widget) => {
      if (!isSignalConsumerWidget(widget)) return;
      renderWidgetRuntimeContent(widget, {
        resolvedContext: resolveWorkspaceContextForItem(widget),
        status: widget.dataset.widgetRuntimeStatus || "ready",
      });
    });
  };
  const runtimeMeaningStatusValue = (value) => String(value ?? "").trim().toLowerCase();
  const runtimeMeaningStatusKind = (value) => {
    const status = runtimeMeaningStatusValue(value);
    if (!status) return "";
    if (/(critical|error|failed|failure|down|offline|blocked|breach)/.test(status)) return "error";
    if (/(warn|risk|watch|urgent|late|degraded|attention|elevated)/.test(status)) return "warning";
    if (/(stale|expired|old|paused|inactive|dormant)/.test(status)) return "stale";
    if (/(live|stream|refresh|running|processing)/.test(status)) return "active";
    if (/(ok|ready|healthy|normal|complete|completed|green|clear)/.test(status)) return "healthy";
    return "";
  };
  const runtimeMeaningFreshnessFromTimestamp = (timestamp) => {
    const value = Number(timestamp) || Date.parse(timestamp || "");
    if (!Number.isFinite(value)) return "";
    const age = Date.now() - value;
    if (age < 0) return "fresh";
    if (age <= 2 * 60 * 1000) return "live";
    if (age <= 24 * 60 * 60 * 1000) return "fresh";
    return "stale";
  };
  const runtimeMeaningDataTimestamp = (data, widget) => (
    data?.metadata?.freshness ||
    data?.metadata?.lastUpdated ||
    data?.freshness ||
    data?.lastUpdated ||
    data?.updatedAt ||
    widget?.dataset?.widgetQueryLastUpdated ||
    ""
  );
  const runtimeMeaningConfidence = (data, config = {}) => {
    const raw = data?.confidence ?? data?.metadata?.confidence ?? config.confidence ?? config.runtimeConfidence;
    const value = Number(raw);
    if (!Number.isFinite(value)) return "unknown";
    if (value < .5) return "low";
    if (value < .75) return "medium";
    return "high";
  };
  const deriveWidgetRuntimeMeaning = ({ widget = null, definition = null, instance = null, resolvedContext = null, data = null, status = "empty" } = {}) => {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const config = instance?.config || widgetConfigFromElement(widget, definition || widgetDefinitionForElement(widget));
    const mapping = resolvedContext?.semanticMapping || data?.semanticMapping || {};
    const statusFields = uniqueValues([
      mapping.statusField,
      "status",
      "state",
      "health",
      "condition",
      "priority",
      "urgency",
      "freshness",
    ]).filter(Boolean);
    const counts = { error: 0, warning: 0, stale: 0, active: 0, healthy: 0 };
    rows.forEach((row) => {
      statusFields.forEach((field) => {
        const kind = runtimeMeaningStatusKind(row?.[field]);
        if (kind && counts[kind] !== undefined) counts[kind] += 1;
      });
    });
    const rowCount = Math.max(1, rows.length);
    const freshness = runtimeMeaningFreshnessFromTimestamp(runtimeMeaningDataTimestamp(data, widget)) ||
      (counts.stale / rowCount >= .25 ? "stale" : data?.live || data?.sourceKind === "stream" ? "live" : data ? "fresh" : "unknown");
    const refreshing = widget?.dataset?.widgetQueryRefreshing === "true" || data?.refreshing === true;
    let condition = "idle";
    if (status === "error" || counts.error > 0) condition = "error";
    else if (status === "loading") condition = "loading";
    else if (widget?.dataset?.shiftSignalActive === "true") condition = "active";
    else if (widget?.dataset?.shiftSignalConnected === "true") condition = "healthy";
    else if (refreshing || data?.live === true || data?.sourceKind === "stream") condition = "active";
    else if (status === "stale" || freshness === "stale" || counts.stale / rowCount >= .25) condition = "stale";
    else if (counts.warning / rowCount >= .20) condition = "warning";
    else if (status === "ready" || rows.length || counts.healthy > 0) condition = "healthy";
    const urgency = condition === "error"
      ? "urgent"
      : condition === "warning"
        ? "watch"
        : condition === "stale"
          ? "low"
          : "normal";
    const motion = condition === "loading" || refreshing || condition === "active"
      ? "active"
      : condition === "stale" || status === "empty"
        ? "inactive"
        : "steady";
    return {
      condition,
      urgency,
      freshness,
      motion,
      confidence: runtimeMeaningConfidence(data, config),
      counts,
    };
  };
  const applyWidgetRuntimeMeaning = (widget, context = {}) => {
    if (!widget?.classList?.contains("widget-card")) return null;
    const meaning = deriveWidgetRuntimeMeaning({ widget, ...context });
    widget.classList.add("widget-runtime-meaning");
    widget.dataset.runtimeCondition = meaning.condition;
    widget.dataset.runtimeUrgency = meaning.urgency;
    widget.dataset.runtimeFreshness = meaning.freshness;
    widget.dataset.runtimeMotion = meaning.motion;
    widget.dataset.runtimeConfidence = meaning.confidence;
    widget.dataset.runtimeMeaningSummary = [
      meaning.condition,
      meaning.freshness,
      meaning.confidence !== "unknown" ? `${meaning.confidence}-confidence` : "",
    ].filter(Boolean).join(" ");
    return meaning;
  };
  const WIDGET_LOGIC_SETTING_KEYS = new Set([
    "assetId",
    "aggregations",
    "calculatedFields",
    "chartType",
    "columns",
    "customEnd",
    "customStart",
    "dateField",
    "eventTypes",
    "filter",
    "filterMode",
    "filters",
    "equationFilters",
    "fallbackBehavior",
    "fallbackValue",
    "labelField",
    "latitudeField",
    "limit",
    "locationField",
    "longitudeField",
    "metric",
    "operator",
    "page",
    "promptTemplate",
    "scope",
    "selectedFilterId",
    "selectedPreset",
    "seriesField",
    "sortBy",
    "sortDirection",
    "source",
    "sourceType",
    "src",
    "stateAColor",
    "stateALabel",
    "stateAOpacity",
    "stateBColor",
    "stateBLabel",
    "stateBOpacity",
    "target",
    "targetType",
    "timeRange",
    "thresholds",
    "unitConversions",
    "staleRules",
    "valueField",
    "weekStartDay",
    "xField",
    "yField",
    "allowMultipleInputs",
    "conversionBehavior",
    "invertOutput",
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
  const widgetInstanceFromElement = (widget, definition = widgetDefinitionForElement(widget)) => widgetRuntimeController.instanceFromElement(widget, definition);
  const setWidgetRuntimeContent = (widget, html) => widgetRuntimeController.setRuntimeContent(widget, html);
  const renderWidgetRuntimeContent = (widget, options = {}) => widgetRuntimeController.renderRuntimeContent(widget, options);
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
      config.latitudeField,
      config.longitudeField,
      config.locationField,
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
    const isTimeframeCustomization = surface === "appearance" && (
      definition.type === "timeframe" || widget?.dataset?.widgetDefinition === "timeframe"
    );
    const schema = widgetSettingsSchemaForSurface(definition, surface);
    const config = widgetConfigFromElement(widget, definition);
    const sections = schema.sections || [];
    const renderableSections = sections
      .map((section) => {
        const fields = (section.fields || []).filter(Boolean);
        return fields.length ? { ...section, fields } : null;
      })
      .filter(Boolean);
    if (surface === "appearance" && (isTimeframeCustomization || renderableSections.length === 0)) {
      return "";
    }
    return `<div class="widget-settings-schema-head">
      <span>${escapeHtml(definition.displayName || "Widget")} ${surface === "logic" ? "workbench" : "appearance"}</span>
    </div>
    ${renderableSections.length ? renderableSections.map((section) => `<fieldset class="widget-settings-section" data-widget-settings-section="${escapeHtml(section.id)}" data-widget-settings-surface="${escapeHtml(surface)}">
      <legend>${escapeHtml(section.label || "Settings")}</legend>
      ${section.fields.map((field) => renderWidgetSettingField(widget, field, config, surface)).join("")}
    </fieldset>`).join("") : widgetSchemaEmptyState(definition, surface)}`;
  };
  const timeframeWorkbenchOptions = (options = [], selected = "") => options.map((option) => {
    const value = String(option.value ?? option.id ?? "");
    const label = String(option.label ?? value);
    return `<option value="${escapeHtml(value)}"${String(selected) === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
  const timeframeFilterValue = (filter, key, fallback = "") => String(filter?.[key] ?? fallback ?? "");
  const renderTimeframeWorkbenchFilterFields = (filter) => {
    const type = String(filter?.type || "today");
    const fixedFields = type === "custom_fixed" || type === "custom"
      ? `<div class="timeframe-workbench-inline">
          <label class="widget-setting-field">Start<input class="timeframe-filter-config-input" type="date" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="start" value="${escapeHtml(timeframeFilterValue(filter, "start"))}"></label>
          <label class="widget-setting-field">End<input class="timeframe-filter-config-input" type="date" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="end" value="${escapeHtml(timeframeFilterValue(filter, "end"))}"></label>
        </div>`
      : "";
    const repeatingFields = type === "custom_repeating"
      ? `<div class="timeframe-workbench-inline">
          <label class="widget-setting-field">Seed start<input class="timeframe-filter-config-input" type="date" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="seedStart" value="${escapeHtml(timeframeFilterValue(filter, "seedStart"))}"></label>
          <label class="widget-setting-field">Seed end<input class="timeframe-filter-config-input" type="date" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="seedEnd" value="${escapeHtml(timeframeFilterValue(filter, "seedEnd"))}"></label>
        </div>
        <div class="timeframe-workbench-inline">
          <label class="widget-setting-field">Repeat every<input class="timeframe-filter-config-input" type="number" min="1" step="1" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="repeatEvery" value="${escapeHtml(timeframeFilterValue(filter, "repeatEvery", 2))}"></label>
          <label class="widget-setting-field">Unit<select class="timeframe-filter-config-input" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="repeatUnit">
            ${timeframeWorkbenchOptions([{ value: "days", label: "Days" }, { value: "weeks", label: "Weeks" }, { value: "monthly", label: "Monthly" }], filter.repeatUnit || "weeks")}
          </select></label>
          <label class="widget-setting-field">Occurrence<select class="timeframe-filter-config-input" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="occurrence">
            ${timeframeWorkbenchOptions([{ value: "current", label: "Current" }, { value: "previous", label: "Previous" }, { value: "next", label: "Next" }], filter.occurrence || "current")}
          </select></label>
        </div>`
      : "";
    return `${fixedFields}${repeatingFields}`;
  };
  const renderTimeframeWorkbenchPanel = (widget) => {
    const runtime = window.dashboardWidgetRuntime;
    const config = widgetConfigFromElement(widget);
    const filters = runtime?.normalizeTimeframeFilters?.(config) || [];
    const selectedFilterId = config.selectedFilterId || "";
    const filterTypes = runtime?.timeframeFilterTypes?.() || [];
    const weekOptions = runtime?.weekStartOptions?.() || [];
    return `<div class="widget-settings-schema-head">
      <span>Time filter workbench</span>
    </div>
    <fieldset class="widget-settings-section timeframe-workbench-section" data-widget-settings-section="timeframe-global" data-widget-settings-surface="logic">
      <legend>Calendar logic</legend>
      <label class="widget-setting-field" for="${escapeHtml(widget.dataset.widgetKey || "timeframe")}-week-start">
        <span>Week starts on</span>
        <select id="${escapeHtml(widget.dataset.widgetKey || "timeframe")}-week-start" class="timeframe-config-input" data-timeframe-config-part="weekStartDay">
          ${timeframeWorkbenchOptions(weekOptions, config.weekStartDay ?? 0)}
        </select>
      </label>
    </fieldset>
    <fieldset class="widget-settings-section timeframe-workbench-section" data-widget-settings-section="timeframe-filters" data-widget-settings-surface="logic">
      <legend>Filter buttons</legend>
      <div class="timeframe-filter-editor-list">
        ${filters.map((filter, index) => `<div class="timeframe-filter-editor" data-timeframe-filter-id="${escapeHtml(filter.id)}">
          <div class="timeframe-filter-editor-head">
            <label class="widget-setting-field timeframe-filter-label-field">Label<input class="timeframe-filter-config-input" type="text" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="label" value="${escapeHtml(filter.label)}"></label>
            <button class="timeframe-remove-filter widget-workbench-action widget-workbench-action-danger" type="button" data-timeframe-filter-id="${escapeHtml(filter.id)}" aria-label="Remove ${escapeHtml(filter.label)}">Remove</button>
          </div>
          <label class="widget-setting-field">
            <span>Filter type</span>
            <select class="timeframe-filter-config-input" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="type">
              ${timeframeWorkbenchOptions(filterTypes, filter.type)}
            </select>
          </label>
          ${renderTimeframeWorkbenchFilterFields(filter)}
          <label class="timeframe-filter-selected-row">
            <input class="timeframe-filter-config-input" type="radio" name="${escapeHtml(widget.dataset.widgetKey || "timeframe")}-selected-filter" data-timeframe-filter-id="${escapeHtml(filter.id)}" data-timeframe-filter-part="selected" value="${escapeHtml(filter.id)}"${filter.id === selectedFilterId ? " checked" : ""}>
            <span>Use this filter now</span>
          </label>
        </div>`).join("")}
      </div>
      <button class="timeframe-add-filter widget-workbench-action" type="button">Add time filter</button>
    </fieldset>`;
  };
  const normalizeWidgetMenuFormControls = (panel) => {
    panel?.querySelectorAll?.("button:not([type])").forEach((button) => {
      button.type = "button";
    });
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
    const logicMarkup = definition.type === "timeframe"
      ? renderTimeframeWorkbenchPanel(widget)
      : renderWidgetSettingsSchemaPanel(widget, "logic");
    return `${logicMarkup}${engineerMarkup}`;
  };
  const ensureWidgetWorkbenchPanel = (widget) => {
    const tools = widget?.querySelector(":scope > .widget-tools");
    if (!tools) return null;
    let panel = tools.querySelector(":scope > .widget-workbench-panel") || widget.__widgetWorkbenchPanel || null;
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "widget-workbench-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Widget workbench");
      panel.hidden = true;
      tools.appendChild(panel);
    }
    widget.__widgetWorkbenchPanel = panel;
    const isOpen = widget.classList.contains("widget-workbench-open");
    if (isOpen) {
      window.dashboardWidgetRuntime?.destroyTimeframeFlatpickr?.(panel);
      panel.innerHTML = renderWidgetWorkbenchPanel(widget);
      normalizeWidgetMenuFormControls(panel);
      window.dashboardWidgetRuntime?.mountTimeframeFlatpickr?.(panel);
    }
    else {
      window.dashboardWidgetRuntime?.destroyTimeframeFlatpickr?.(panel);
      panel.replaceChildren();
    }
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
    if (!widget?.isConnected) return;
    if (widget.contains(document.activeElement) && !options.allowFocused) return;
    const definition = widgetDefinitionForElement(widget);
    const instance = widgetInstanceFromElement(widget, definition);
    const query = typeof definition.resolveQuery === "function"
      ? definition.resolveQuery(instance.config, resolvedContext)
      : null;
    widget.dataset.widgetQueryRequirements = JSON.stringify(definition.queryRequirements || {});
    const sequence = (Number(widget.dataset.widgetQuerySeq) || 0) + 1;
    widget.dataset.widgetQuerySeq = String(sequence);
    if (!resolvedContext?.canQuery && typeof definition.getDemoData === "function") {
      try {
        const demo = await demoQueryStateForWidget(definition, instance, resolvedContext, options);
        if (!widget.isConnected || (widget.contains(document.activeElement) && !options.allowFocused)) return;
        if (Number(widget.dataset.widgetQuerySeq) !== sequence) return;
        if (demo?.state) {
          delete widget.dataset.widgetQueryKey;
          widgetQueryKeys.delete(widget);
          widget.dataset.widgetRuntimeStatus = demo.state.status;
          widget.dataset.widgetRuntimeMode = "demo";
          widget.dataset.widgetQueryRefreshing = "false";
          delete widget.dataset.widgetQueryError;
          if (demo.state.lastUpdated) widget.dataset.widgetQueryLastUpdated = String(demo.state.lastUpdated);
          renderWidgetRuntimeContent(widget, {
            resolvedContext: demo.context,
            data: demo.state.data,
            status: demo.state.status,
          });
          return;
        }
      } catch (error) {
        if (!widget.isConnected || (widget.contains(document.activeElement) && !options.allowFocused)) return;
        if (Number(widget.dataset.widgetQuerySeq) !== sequence) return;
        widget.dataset.widgetRuntimeMode = "demo";
        widget.dataset.widgetRuntimeStatus = "error";
        widget.dataset.widgetQueryError = error?.message || "Demo data failed";
        renderWidgetRuntimeContent(widget, {
          resolvedContext,
          data: { error: error?.message || "Demo data failed" },
          status: "error",
        });
        return;
      }
    }
    delete widget.dataset.widgetRuntimeMode;
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

  window.dashboardWidgetRuntimeMeaning = {
    derive: (options = {}) => widgetRuntimeController.deriveRuntimeMeaning(options),
    apply: (widget, options = {}) => widgetRuntimeController.applyRuntimeMeaning(
      typeof widget === "string" ? document.querySelector(widget) : widget,
      options
    ),
  };
  const hydrateWidgetRuntime = (widget, saved = null) => widgetRuntimeController.hydrateRuntime(widget, saved);
  const persistRuntimeControlChangeForWidget = (widget, options = {}) => {
    const layoutKey = activeLayoutKeyForItem(widget);
    const profile = getActivePanelProfile(layoutKey);
    const layout = widget.closest(".widget-layout");
    if (options.invalidateQuery !== false) invalidateManagedWidgetQueryForWidget(widget);
    if (layout) saveWidgetLayouts(layout, profile, { history: false });
    refreshResolvedContextDebug(layoutKey, profile);
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
  const bindWidgetRuntimeControls = (widget) => {
    if (!widget || widget.dataset.widgetRuntimeControlsBound === "true") return;
    widget.dataset.widgetRuntimeControlsBound = "true";
    const persistRuntimeControlChange = (options = {}) => persistRuntimeControlChangeForWidget(widget, options);
    const widgetRuntimeKey = () => widget.dataset.widgetKey || "";
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
    const updateTimeframeWidgetConfig = (target, eventType = "input") => {
      if (widget.dataset.widgetDefinition !== "timeframe") return false;
      const globalConfigInput = target?.closest?.(".timeframe-config-input");
      const filterConfigInput = target?.closest?.(".timeframe-filter-config-input");
      const addFilterButton = target?.closest?.(".timeframe-add-filter");
      const removeFilterButton = target?.closest?.(".timeframe-remove-filter");
      const runtime = window.dashboardWidgetRuntime;
      const normalizedFilters = (config) => runtime?.normalizeTimeframeFilters?.(config) || [];
      const setTimeframeConfig = (nextConfig, options = {}) => {
        setWidgetConfig(widget, nextConfig);
        renderWidgetRuntimeContent(widget, {
          resolvedContext: resolveWorkspaceContextForItem(widget),
          status: widget.dataset.widgetRuntimeStatus || "ready",
        });
        syncWidgetContextOutputs(widget);
        widget.dataset.widgetRuntimeStatus = "ready";
        if (widget.classList.contains("widget-workbench-open") && options.refreshWorkbench !== false) {
          ensureWidgetWorkbenchPanel(widget);
        }
      };
      if (addFilterButton && widget.contains(addFilterButton)) {
        if (addFilterButton.dataset.timeframeAddHandled === "true") return true;
        addFilterButton.dataset.timeframeAddHandled = "true";
        const config = widgetConfigFromElement(widget);
        const filters = normalizedFilters(config);
        const id = `time-filter-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
        if (eventType !== "input") captureRuntimeControlBaselineForWidget(widget);
        setTimeframeConfig({
          ...config,
          filters: [...filters, { id, label: "New filter", type: "today" }],
          selectedFilterId: id,
          selectedPreset: "today",
          activeLabel: "New filter",
        });
        return true;
      }
      if (removeFilterButton && widget.contains(removeFilterButton)) {
        const config = widgetConfigFromElement(widget);
        const id = removeFilterButton.dataset.timeframeFilterId || "";
        const filters = normalizedFilters(config).filter((filter) => filter.id !== id);
        const selectedFilterId = config.selectedFilterId === id ? (filters[0]?.id || "") : config.selectedFilterId;
        const selectedFilter = filters.find((filter) => filter.id === selectedFilterId);
        if (eventType !== "input") captureRuntimeControlBaselineForWidget(widget);
        setTimeframeConfig({
          ...config,
          filters,
          selectedFilterId,
          selectedPreset: selectedFilter?.type || "",
          activeLabel: selectedFilter?.label || "",
        });
        return true;
      }
      if (globalConfigInput && widget.contains(globalConfigInput)) {
        const config = widgetConfigFromElement(widget);
        const part = globalConfigInput.dataset.timeframeConfigPart || "";
        if (!part) return false;
        if (eventType !== "input") captureRuntimeControlBaselineForWidget(widget);
        setTimeframeConfig({
          ...config,
          [part]: globalConfigInput.type === "number" ? Number(globalConfigInput.value) : globalConfigInput.value,
        }, { refreshWorkbench: eventType !== "input" });
        return true;
      }
      if (filterConfigInput && widget.contains(filterConfigInput)) {
        const config = widgetConfigFromElement(widget);
        const id = filterConfigInput.dataset.timeframeFilterId || "";
        const part = filterConfigInput.dataset.timeframeFilterPart || "";
        if (!id || !part) return false;
        const filters = normalizedFilters(config);
        const nextFilters = filters.map((filter) => {
          if (filter.id !== id) return filter;
          if (part === "selected") return filter;
          const value = filterConfigInput.type === "number"
            ? Math.max(1, Math.round(Number(filterConfigInput.value) || 1))
            : filterConfigInput.value;
          return { ...filter, [part]: value };
        });
        const selected = part === "selected" ? id : config.selectedFilterId;
        const selectedFilter = nextFilters.find((filter) => filter.id === selected);
        captureRuntimeControlBaselineForWidget(widget);
        setTimeframeConfig({
          ...config,
          filters: nextFilters,
          selectedFilterId: selected || "",
          selectedPreset: selectedFilter?.type || config.selectedPreset || "",
          activeLabel: selectedFilter?.label || config.activeLabel || "",
        }, { refreshWorkbench: eventType !== "input" });
        return true;
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
      if (updateTimeframeWidgetConfig(event.target, event.type)) {
        event.__widgetRuntimeHandledBy = widget;
        persistRuntimeControlChange({ history: event.type === "change" || event.type === "focusout" });
      }
    };
    const handleRuntimeControlClick = (event) => {
      if (event.__widgetRuntimeHandledBy === widget) return;
      const filterBtn = event.target?.closest?.(".timeframe-filter-btn[data-filter-id]");
      if (filterBtn && widget.contains(filterBtn) && widget.dataset.widgetDefinition === "timeframe") {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        event.stopPropagation();
        const filterId = filterBtn.dataset.filterId;
        const config = widgetConfigFromElement(widget);
        const filters = window.dashboardWidgetRuntime?.normalizeTimeframeFilters?.(config) || [];
        const selectedFilter = filters.find((f) => f.id === filterId);
        captureRuntimeControlBaselineForWidget(widget);
        setWidgetConfig(widget, {
          ...config,
          selectedFilterId: filterId,
          selectedPreset: selectedFilter?.type || "",
          activeLabel: selectedFilter?.label || "",
        });
        renderWidgetRuntimeContent(widget, {
          resolvedContext: resolveWorkspaceContextForItem(widget),
          status: "ready",
        });
        syncWidgetContextOutputs(widget);
        widget.dataset.widgetRuntimeStatus = "ready";
        event.__widgetRuntimeHandledBy = widget;
        persistRuntimeControlChange({ history: true });
        return;
      }
      const clickableTimeframeControl = event.target?.closest?.(
        ".timeframe-add-filter, .timeframe-remove-filter, .timeframe-filter-config-input[type='radio']"
      );
      if (!clickableTimeframeControl || !widget.contains(clickableTimeframeControl)) return;
      if (updateTimeframeWidgetConfig(event.target, event.type)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        event.stopPropagation();
        persistRuntimeControlChange({ history: true });
      }
    };
    widget.addEventListener("click", handleRuntimeControlClick, true);
    widget.addEventListener("input", handleRuntimeControlChange, true);
    widget.addEventListener("input", handleRuntimeControlChange);
    widget.addEventListener("change", handleRuntimeControlChange, true);
    widget.addEventListener("change", handleRuntimeControlChange);
    widget.addEventListener("focusout", handleRuntimeControlChange);
  };
  const createCustomWidget = (definition) => widgetRuntimeController.createCustomWidget(definition);

  const panelChildWidgets = (panel) => dashboardPanelContainment.panelChildWidgets(panel);

  const panelInternalGridBlockInsets = (grid) => dashboardPanelContainment.panelInternalGridBlockInsets(grid);

  const requiredPanelHeightForInternalGrid = (panel, options = {}) => (
    panelContainmentRuntime.requiredPanelHeightForInternalGrid(panel, options)
  );

  const syncOpenPanelHeightToInternalGrid = (panel, options = {}) => (
    panelContainmentRuntime.syncOpenPanelHeightToInternalGrid(panel, options)
  );

  const panelRequiredSpanForInternalItem = (panel, item = null) => (
    panelContainmentRuntime.panelRequiredSpanForInternalItem(panel, item)
  );

  const openPanelForInternalDrop = (panel) => panelRuntime.openPanelForInternalDrop(panel);

  const syncPanelFootprintToInternalItem = (panel, item = null, options = {}) => (
    panelContainmentRuntime.syncPanelFootprintToInternalItem(panel, item, options)
  );

  const sanitizePanelChildWidgetClone = (widget) => panelContainmentRuntime.sanitizePanelChildWidgetClone(widget);

  const serializePanelChildWidgets = (panel) => panelContainmentRuntime.serializePanelChildWidgets(panel);

  const updatePanelChildEmptyState = (panel) => panelContainmentRuntime.updatePanelChildEmptyState(panel);

  const ensurePanelInternalWidgetGrid = (panel) => panelContainmentRuntime.ensurePanelInternalWidgetGrid(panel);

  const restorePanelChildWidgets = (panel, definitions = []) => panelContainmentRuntime.restorePanelChildWidgets(panel, definitions);

  const ensureWidgetTools = (widget, theme = "#2563eb") => widgetRuntimeController.ensureTools(widget, theme);

  const syncWidgetRenderedHeightToFootprint = (widget, rowSpan = null, metrics = null) => widgetRuntimeController.syncRenderedHeightToFootprint(widget, rowSpan, metrics);

  const applyWidgetSpan = (widget, span) => widgetRuntimeController.applySpan(widget, span);

  const applyWidgetGridPosition = (widget, col, row, rowSpan = null) => widgetRuntimeController.applyGridPosition(widget, col, row, rowSpan);

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
    return dashboardGeometry.gridItemPixelWidthForSpan({
      span,
      gap,
      columnWidth,
      columns: DASHBOARD_GRID_COLUMNS,
    });
  };

  const resizeEdgeFromPointer = (event, item, threshold = 10) => {
    if (!event || !item) return null;
    const rect = item.getBoundingClientRect();
    return dashboardGeometry.resizeEdgeFromRect({ clientX: event.clientX, rect, threshold });
  };

  const beginInteractionAutoScroll = ({ layout = null, onScrollFrame } = {}) => dashboardDragRuntime.beginInteractionAutoScroll({
    layout,
    onScrollFrame,
    gridHostForLayout,
  });
  const beginResizeLifecycle = (options = {}) => dashboardResizeRuntime.beginResizeLifecycle({
    ...options,
    beginInteractionAutoScroll,
    clearSurfaceResponse,
  });

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

  const expandedPanelFootprintRows = (panel, layout, proposedRows = null, metrics = null) => (
    panelRuntime.expandedPanelFootprintRows(panel, layout, proposedRows, metrics)
  );

  const expandedPanelFootprintHeight = (panel, layout, proposedRows = null, metrics = null) => (
    panelRuntime.expandedPanelFootprintHeight(panel, layout, proposedRows, metrics)
  );

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
    [...gridHostForLayout(layout).querySelectorAll(".widget-layout > .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])")]
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

  const gridBoundsOverlap = (a, b) => dashboardGeometry.gridBoundsOverlap(a, b);
  let collisionReflowRuntime = null;

  const indexedCollisionEntries = (bounds, occupied) => (
    collisionReflowRuntime?.indexedCollisionEntries?.(bounds, occupied) ||
    dashboardCollisionReflowRuntime.indexedCollisionEntries(bounds, occupied)
  );

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
      .filter((item) => !excluded.has(item));
  };

  const globalGridItems = (layout, { includePlaceholders = false, exclude = [] } = {}) => {
    const host = gridHostForLayout(layout);
    const excluded = new Set([].concat(exclude || []).filter(Boolean));
    const selector = includePlaceholders
      ? ".widget-layout > .widget-card:not([hidden]), .widget-layout > .widget-placeholder, .panel-layout > .db-panel:not([hidden]), .panel-layout > .db-panel-placeholder"
      : ".widget-layout > .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])";
    return [...host.querySelectorAll(selector)]
      .filter((item) => !excluded.has(item) && (host === layout || !isPanelInternalGridItem(item)) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging") && !item.classList.contains("dashboard-live-resize") && !item.classList.contains("dashboard-resize-source") && !item.classList.contains("dashboard-group-source") && !item.classList.contains("dashboard-group-member-preview"));
  };

  const layoutItemsForLogicalResolution = (layout, options = {}) => {
    const excluded = new Set([].concat(options.exclude || []).filter(Boolean));
    const provided = Array.isArray(options.items) ? options.items : null;
    const items = provided || globalGridItems(layout, {
      includePlaceholders: options.includePlaceholders !== false,
      exclude: [...excluded],
    });
    // Defensive: when resolving against a workspace-level layout (not a
    // panel-internal grid), panel-contained widgets must never enter the
    // global occupancy set — the panel container is the single global
    // object/footprint. Upstream callers (reflowItemsForLayout,
    // globalGridItems) filter this, but this final-mile filter catches
    // any path that supplies a provided `items` array that leaks panel-
    // internal widgets, which would otherwise cause unrelated widgets in
    // the row above the panel to be displaced downward during drag
    // preview by the panel-local widgets' panel-local row positions
    // being interpreted as global rows.
    const allowPanelInternal = isPanelInternalWidgetLayout(layout);
    return [...new Set(items)]
      .filter((item) => (
        item?.isConnected &&
        !excluded.has(item) &&
        (allowPanelInternal || !isPanelInternalGridItem(item)) &&
        !item.classList.contains("widget-dragging") &&
        !item.classList.contains("db-panel-dragging") &&
        !item.classList.contains("dashboard-live-resize") &&
        !item.classList.contains("dashboard-resize-source") &&
        !item.classList.contains("dashboard-group-source") &&
        !item.classList.contains("dashboard-group-member-preview")
      ));
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
    return dashboardGeometry.boundsAtGridSlot({
      col,
      row,
      span,
      rowSpan,
      columns: DASHBOARD_GRID_COLUMNS,
    });
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

  const canPlaceBounds = (bounds, occupied) => collisionReflowRuntime.canPlaceBounds(bounds, occupied);

  const nearestSparseSlot = (item, preferred, occupied, rowLimit = null, metrics = null) => (
    collisionReflowRuntime.nearestSparseSlot(item, preferred, occupied, rowLimit, metrics)
  );

  const nearestSparseSlotAtOrAfter = (item, preferred, occupied, rowLimit = null, metrics = null) => (
    collisionReflowRuntime.nearestSparseSlotAtOrAfter(item, preferred, occupied, rowLimit, metrics)
  );

  const localVacancyCandidates = (item, vacancy, metrics = null) => collisionReflowRuntime.localVacancyCandidates(item, vacancy, metrics);

  const canPlaceLocalDisplacementBounds = (bounds, occupied, reserved = []) => (
    collisionReflowRuntime.canPlaceLocalDisplacementBounds(bounds, occupied, reserved)
  );

  const localBelowDisplacementSlot = (item, base, occupied, reserved = [], metrics = null) => (
    collisionReflowRuntime.localBelowDisplacementSlot(item, base, occupied, reserved, metrics)
  );

  const localLeftDisplacementSlot = (item, base, occupied, localVacancy = null, reserved = [], metrics = null) => (
    collisionReflowRuntime.localLeftDisplacementSlot(item, base, occupied, localVacancy, reserved, metrics)
  );

  const nearestLocalDisplacementSlot = (item, preferred, occupied, options = {}) => (
    collisionReflowRuntime.nearestLocalDisplacementSlot(item, preferred, occupied, options)
  );

  const visualGridOrder = (items, metrics = null) => [...items].sort((a, b) => {
    const aBounds = gridBoundsForItem(a, metrics);
    const bBounds = gridBoundsForItem(b, metrics);
    const documentOrder = a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    return aBounds.row - bBounds.row ||
      aBounds.col - bBounds.col ||
      documentOrder;
  });

  const boundsAtRow = (bounds, row) => dashboardGeometry.boundsAtRow(bounds, row);

  const gridBoundsShareColumns = (a, b) => dashboardGeometry.gridBoundsShareColumns(a, b);

  collisionReflowRuntime = dashboardCollisionReflowRuntime.createRuntime({
    columns: DASHBOARD_GRID_COLUMNS,
    boundsAtGridSlot,
    gridBoundsForItem,
    applyGridItemPosition,
    gridItemSpan,
    gridItemRowSpan,
    gridHostForLayout,
    globalGridItems,
    layoutItemsForLogicalResolution,
    visualGridOrder,
    ensureRenderedGridPosition,
    orderedLayoutStartRow: (layout) => orderedLayoutStartRow(layout),
    orderedGridItems: (layout, options = {}) => orderedGridItems(layout, options),
  });

  const firstVerticalOpenRow = (bounds, occupied) => collisionReflowRuntime.firstVerticalOpenRow(bounds, occupied);

  const applyVerticalPanelExpansion = (layout, panel) => collisionReflowRuntime.applyVerticalPanelExpansion(layout, panel);

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

  const resolveSparseGridLayout = (layout, activeItem = null, preferredTarget = null, options = {}) => (
    collisionReflowRuntime.resolveSparseGridLayout(layout, activeItem, preferredTarget, options)
  );

  const resolveSparseGridLayoutForActiveItems = (layout, activeItems = [], options = {}) => (
    collisionReflowRuntime.resolveSparseGridLayoutForActiveItems(layout, activeItems, options)
  );

  const resolveActiveDropSlot = (layout, item, preferredTarget) => (
    collisionReflowRuntime.resolveActiveDropSlot(layout, item, preferredTarget)
  );

  const commitActiveDropSlot = (layout, item, preferredTarget, options = {}) => (
    collisionReflowRuntime.commitActiveDropSlot(layout, item, preferredTarget, options)
  );

  const commitExpandedPanelDropSlot = (layout, item, preferredTarget, options = {}) => (
    collisionReflowRuntime.commitExpandedPanelDropSlot(layout, item, preferredTarget, options)
  );

  const verticalSlotAtOrAfter = (item, preferred, occupied, rowLimit = null, metrics = null) => (
    collisionReflowRuntime.verticalSlotAtOrAfter(item, preferred, occupied, rowLimit, metrics)
  );

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
      a.viewportDistance - b.viewportDistance ||
      b.score - a.score ||
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

  const commitInsertedGridItemWithVerticalPushdown = (layout, item, preferredTarget = null) => (
    collisionReflowRuntime.commitInsertedGridItemWithVerticalPushdown(layout, item, preferredTarget)
  );

  const nextPastedObjectId = layoutPersistence.nextObjectId;

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
      item.querySelectorAll?.("[data-widget-key], [data-panel-key]").forEach((node) => {
        const id = workspaceObjectKey(node);
        if (id) ids.push(id);
      });
      return ids;
    }));
    const graph = loadWorkspaceLogicGraph(layoutKey, getActivePanelProfile(layoutKey));
    layoutPersistence.clipboard.set({
      layoutKey,
      copiedAt: Date.now(),
      links: graph.links.filter((link) => selectedIds.has(link.source.objectId) && selectedIds.has(link.target.objectId)),
      items: visualGridOrder(roots).map((item) => ({
        kind: workspaceDeleteKind(item),
        layoutKey: groupItemLayoutKey(item),
        parentPanelKey: isPanelInternalGridItem(item) ? item.closest(".db-panel")?.dataset.panelKey || null : null,
        bounds: gridBoundsForItem(item),
        html: sanitizeLayoutElementForUndo(item),
      })),
    });
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
    element.querySelectorAll(".panel-settings-toggle, .panel-color-toggle").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
    element.querySelectorAll(".panel-color-menu-open").forEach((menu) => {
      menu.classList.remove("panel-color-menu-open");
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

  const pasteClipboardDataflowLinks = (layoutKey, profile, clipboard, idMap) => {
    const links = Array.isArray(clipboard?.links) ? clipboard.links : [];
    if (!links.length) return;
    const remapped = links.flatMap((link) => {
      const sourceObjectId = idMap.get(link.source?.objectId);
      const targetObjectId = idMap.get(link.target?.objectId);
      if (!sourceObjectId || !targetObjectId) return [];
      const normalized = normalizeWorkspaceLink({
        ...link,
        id: graphLinkId(),
        source: { ...(link.source || {}), objectId: sourceObjectId },
        target: { ...(link.target || {}), objectId: targetObjectId },
      });
      return normalized ? [normalized] : [];
    });
    if (!remapped.length) return;
    const graph = loadWorkspaceLogicGraph(layoutKey, profile);
    saveWorkspaceLogicGraph(layoutKey, {
      ...graph,
      links: [...graph.links, ...remapped],
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
    const clipboard = layoutPersistence.clipboard.get();
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
      pasteClipboardDataflowLinks(layoutKey, profile, clipboard, idMap);
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

  const groupEntriesFit = (entries, deltaCol, deltaRow, occupied) => (
    collisionReflowRuntime.groupEntriesFit(entries, deltaCol, deltaRow, occupied)
  );

  const clampGroupDelta = (entries, deltaCol, deltaRow) => collisionReflowRuntime.clampGroupDelta(entries, deltaCol, deltaRow);

  const findGroupDelta = (entries, preferredDelta, occupied) => collisionReflowRuntime.findGroupDelta(entries, preferredDelta, occupied);

  const applyGroupDelta = (entries, delta) => collisionReflowRuntime.applyGroupDelta(entries, delta);

  const groupDragEntries = (activeItem, placeholder, groupItems, startBounds) => (
    collisionReflowRuntime.groupDragEntries(activeItem, placeholder, groupItems, startBounds)
  );

  const externalOccupiedForGroup = (layout, excludedItems) => collisionReflowRuntime.externalOccupiedForGroup(layout, excludedItems);

  const commitGroupDropSlot = (layout, activeItem, groupItems, preferredTarget, startBounds) => (
    collisionReflowRuntime.commitGroupDropSlot(layout, activeItem, groupItems, preferredTarget, startBounds)
  );

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

  const packOrderedGridItems = (layout, items) => collisionReflowRuntime.packOrderedGridItems(layout, items);

  const applyOrderedGridLayout = (layout, items = orderedGridItems(layout, { includePlaceholders: true })) => {
    return collisionReflowRuntime.applyOrderedGridLayout(layout, items);
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

  const panelBodyRectFromSnapshot = (panel, snapshot) => panelContainmentRuntime.panelBodyRectFromSnapshot(panel, snapshot);

  const panelHeaderRectFromSnapshot = (panel, snapshot) => panelContainmentRuntime.panelHeaderRectFromSnapshot(panel, snapshot);

  const pointInRect = (clientX, clientY, rect) => dashboardGeometry.pointInRect(clientX, clientY, rect);
  const PANEL_ENTRY_TOLERANCE_PX = 42;
  const expandPanelEntryBodyRect = (rect, tolerance = PANEL_ENTRY_TOLERANCE_PX) => dashboardGeometry.expandRect(rect, tolerance);
  const PANEL_HEADER_ENTRY_TOLERANCE_PX = 18;
  const expandPanelEntryHeaderRect = (rect, tolerance = PANEL_HEADER_ENTRY_TOLERANCE_PX) => dashboardGeometry.expandRect(rect, tolerance);
  const clampPointToPanelBodyRect = (panel, clientX, clientY, snapshot = null) => (
    panelContainmentRuntime.clampPointToPanelBodyRect(panel, clientX, clientY, snapshot)
  );

  const panelEntryCandidateAt = (clientX, clientY, draggedWidget, options = {}) => (
    panelContainmentRuntime.panelEntryCandidateAt(clientX, clientY, draggedWidget, options)
  );

  const animateAbsorbedWidgetIntoPanel = (widget, fromRect) => (
    panelContainmentRuntime.animateAbsorbedWidgetIntoPanel(widget, fromRect)
  );

  const workspaceWidgetLayoutForPanel = (panel) => panelContainmentRuntime.workspaceWidgetLayoutForPanel(panel);

  const refreshPanelContainedWidgetRuntime = (widget, options = {}) => {
    if (!widget || !widget.classList?.contains("widget-card") || !widget.isConnected) return;
    const layout = widget.closest(".widget-layout");
    const panelLayout = widget.closest(".panel-layout");
    if (panelLayout) syncWorkspaceRegions(panelLayout);
    if (layout) syncWorkspaceRegions(layout);
    const layoutKey = options.layoutKey || activeLayoutKeyForItem(widget);
    const resolved = resolveWorkspaceContextForItem(widget, { layoutKey, profile: options.profile || getActivePanelProfile(layoutKey) });
    cancelManagedWidgetQueryForWidget(widget);
    invalidateManagedWidgetQueryForWidget(widget);
    syncWidgetContextOutputs(widget);
    void refreshWidgetRuntimeData(widget, resolved, { force: true });
  };

  const absorbWidgetIntoPanel = (options) => {
    const result = panelContainmentRuntime.absorbWidgetIntoPanel(options);
    if (!result) return null;
    const panelLayout = options?.panel?.closest?.(".panel-layout");
    if (panelLayout) syncWorkspaceRegions(panelLayout);
    refreshPanelContainedWidgetRuntime(result, {
      layoutKey: options?.widget?.dataset?.widgetLayoutKey || options?.widget?.dataset?.layoutKey,
      profile: options?.layout?.dataset?.layoutProfile || null,
    });
    return result;
  };

  const extractPanelChildWidgetToWorkspace = (options) => {
    const result = panelContainmentRuntime.extractPanelChildWidgetToWorkspace(options);
    if (!result?.widget) return null;
    const targetLayout = options?.targetLayout;
    if (targetLayout) syncWorkspaceRegions(targetLayout);
    refreshPanelContainedWidgetRuntime(result.widget, {
      layoutKey: options?.targetLayout?.dataset?.widgetLayoutKey || options?.targetLayout?.dataset?.layoutKey,
    });
    return result;
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
    deferStartEventHandling = false,
  }) => {
    let interactionStarted = false;
    const markInteractionStarted = (sourceEvent = null) => {
      if (interactionStarted) return;
      interactionStarted = true;
      sourceEvent?.preventDefault?.();
      sourceEvent?.stopPropagation?.();
      document.body.classList.add("panel-interaction-active");
      window.getSelection?.()?.removeAllRanges();
    };
    if (!deferStartEventHandling) {
      markInteractionStarted(event);
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const dragController = dashboardDragRuntime.createPointerDragController({ event, item, mode: "drag" });
    const pointerId = dragController.pointerId;
    const pointerTarget = dragController.pointerTarget;
    const capturePointer = () => dragController.capturePointer();
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

    const startDrag = (sourceEvent = null) => {
      if (dragging) return;
      markInteractionStarted(sourceEvent);
      clearSurfaceResponse();
      dragController.beginInteraction({
        layout,
        item,
        clientX: sourceEvent?.clientX ?? startX,
        clientY: sourceEvent?.clientY ?? startY,
      });
      if (deferStartEventHandling) capturePointer();
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
      const feedbackToken = String(performance.now());
      const minVisibleUntil = performance.now() + 260;
      panel.dataset.panelHeaderEntryFeedbackToken = feedbackToken;
      const clearFeedback = () => {
        if (panel.dataset.panelHeaderEntryFeedbackToken !== feedbackToken) return;
        const remaining = minVisibleUntil - performance.now();
        if (remaining > 0) {
          window.setTimeout(clearFeedback, remaining);
          return;
        }
        panel.classList.remove("panel-header-entry-accept");
        delete panel.dataset.panelHeaderEntryFeedbackToken;
      };
      panel.addEventListener("animationend", clearFeedback, { once: true });
      window.setTimeout(clearFeedback, 320);
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

    const acceptsHeaderPanelEntry = (panel, motion, options = {}) => {
      if (!motion) return false;
      if (panelEntryIntent.headerPanel !== panel) {
        panelEntryIntent.headerPanel = panel;
        panelEntryIntent.headerSince = motion.now;
      }
      const dwell = motion.now - panelEntryIntent.headerSince;
      const clearlyDownward = motion.totalDy > 20 &&
        motion.stepDy >= -1 &&
        motion.totalDy >= Math.abs(motion.totalDx) * .7;
      const slowIntentionalHeaderEntry = dwell >= 120 && motion.speed <= .42;
      const slowEnough = motion.speed <= .36;
      const directionalHeaderEntry = !options.requiresSlowIntent &&
        dwell >= 40 &&
        clearlyDownward &&
        (slowEnough || dwell >= 120);
      return slowIntentionalHeaderEntry || directionalHeaderEntry;
    };

    const clearPanelDragPreview = ({ restore = true } = {}) => {
      if (!panelDrag) return;
      const state = panelDrag;
      panelDrag = null;
      state.panel.classList.remove("panel-container-drag-active", "panel-header-entry-accept");
      item.classList.remove("panel-entry-ghost-transition", "panel-exit-ghost-transition");
      if (restore) restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
      if (restore && state.panelLayout && state.panelLayoutSnapshot) {
        restoreGridLayoutSnapshot(state.panelLayoutSnapshot);
        if (state.wasCollapsed) {
          state.panel.classList.add("db-panel-collapsed");
          state.panel.querySelector(":scope > .db-panel-hd")?.setAttribute("aria-expanded", "false");
          state.panel.dataset.gridRowSpan = "1";
          state.panel.style.height = "";
          if (state.panel.dataset.gridCol && state.panel.dataset.gridRow) {
            applyPanelGridPosition(state.panel, state.panel.dataset.gridCol, state.panel.dataset.gridRow);
          }
        }
      }
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
      const panelLayout = panel.closest(".panel-layout");
      const panelLayoutSnapshot = panelLayout ? snapshotGridLayout(panelLayout) : null;
      const panelPlaceholder = createPanelDropPlaceholder();
      internalGrid.appendChild(panelPlaceholder);
      panel.classList.add("panel-container-drag-active");
      const wasCollapsed = panel.classList.contains("db-panel-collapsed");
      syncPanelFootprintToInternalItem(panel, panelPlaceholder, {
        includePlaceholders: true,
        openCollapsed: true,
        metrics: panelLayout ? createGridMetrics(panelLayout) : null,
      });
      if (options.zone === "header" || options.zone === "header-tolerance") triggerPanelHeaderEntryFeedback(panel);
      panelDrag = {
        panel,
        panelLayout,
        panelLayoutSnapshot,
        layout: internalGrid,
        placeholder: panelPlaceholder,
        snapshot,
        metrics: createGridMetrics(internalGrid),
        reflowItems: reflowItemsForLayout(internalGrid, panelPlaceholder),
        targetCell: null,
        entryZone: options.zone || "body",
        entryTransitionPlayed: false,
        wasCollapsed,
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
        if (candidate.zone === "header" || candidate.zone === "header-tolerance") {
          if (!acceptsHeaderPanelEntry(candidate.panel, motion, { requiresSlowIntent: candidate.zone === "header-tolerance" })) return false;
        }
      }
      const state = enterPanelDragPreview(candidate.panel, { zone: candidate.zone });
      if (!state) return false;
      const candidateIsHeaderEntry = candidate.zone === "header" || candidate.zone === "header-tolerance";
      if (candidateIsHeaderEntry && state.entryZone !== candidate.zone && state.entryZone !== "header") {
        state.entryZone = candidate.zone;
        state.entryTransitionPlayed = false;
        triggerPanelHeaderEntryFeedback(candidate.panel);
      }
      const metrics = refreshGridMetricsRect(state.metrics);
      const previewPoint = candidate.zone === "body-tolerance" || candidate.zone === "header" || candidate.zone === "header-tolerance"
        ? clampPointToPanelBodyRect(candidate.panel, moveEvent.clientX, moveEvent.clientY, startSnapshot)
        : { clientX: moveEvent.clientX, clientY: moveEvent.clientY };
      const nextCell = gridCellFromDragPointer(state.layout, state.placeholder, previewPoint.clientX, previewPoint.clientY, offsetX, offsetY, metrics, rect);
      const shouldPlayEntryTransition = (state.entryZone === "header" || state.entryZone === "header-tolerance") && !state.entryTransitionPlayed;
      if (state.targetCell && state.targetCell.col === nextCell.col && state.targetCell.row === nextCell.row && !shouldPlayEntryTransition) return true;
      state.targetCell = nextCell;
      animateOrderedGridReflow(state.layout, () => {
        restoreGridLayoutSnapshot(state.snapshot, { exclude: [state.placeholder] });
        resolveSparseGridLayout(state.layout, state.placeholder, nextCell, { afterOnly: true, metrics, items: state.reflowItems });
      }, state.placeholder, { items: state.reflowItems, metrics });
      syncPanelFootprintToInternalItem(state.panel, state.placeholder, {
        includePlaceholders: true,
        metrics: state.panelLayout ? createGridMetrics(state.panelLayout) : null,
      });
      state.metrics = createGridMetrics(state.layout);
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
      startDrag(moveEvent);
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      lastMoveEvent = moveEvent;
      autoScroll.update(moveEvent);
      const isAutoScrollFrame = moveEvent.type === "autoscroll";
      const panelEntryMotion = isAutoScrollFrame ? null : panelEntryMotionFor(moveEvent);
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
      if (!isAutoScrollFrame && updatePanelDragPreview(moveEvent, panelEntryMotion)) {
        return;
      }
      if (isAutoScrollFrame && panelDrag) {
        clearPanelDragPreview();
      }
      if (!isAutoScrollFrame && updatePanelExitPreview(moveEvent)) {
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
      dragController.removeListeners();
    };

    const releasePointer = () => {
      dragController.releasePointer();
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
      dragController.endInteraction();
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

    if (!deferStartEventHandling) capturePointer();
    dragController.install({
      onMove,
      onPointerEnd: onUp,
      onKeydown,
      onBlur: onWindowBlur,
      onLostPointerCapture,
    });
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
    resizeAlignmentTargetsForLayout(layout).forEach((target) => {
      if (target === item) return;
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

  const groupGridBox = (boundsList) => dashboardGeometry.groupGridBox(boundsList);

  const groupFootprintLayout = (layout) => {
    const host = gridHostForLayout(layout);
    const key = gridItemLayoutKey(layout);
    return host?.querySelector?.(`.panel-layout[data-layout-key="${CSS.escape(key)}"]`) || layout;
  };

  const groupBoxBounds = (groupBox, col = groupBox.col, row = groupBox.row) => dashboardGeometry.groupBoxBounds(groupBox, col, row);

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
    const resizeParentPanel = isPanelInternalWidgetLayout(layout) ? panelForInternalWidgetLayout(layout) : null;
    const resizeParentPanelLayout = resizeParentPanel?.closest?.(".panel-layout") || null;
    const gap = layoutMetrics.gap;
    const startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const layoutRect = layoutMetrics.rect;
    const columnWidth = (Math.max(1, layoutRect.width) - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS;
    const columnStep = Math.max(1, columnWidth + gap);
    const rowStep = DASHBOARD_GRID_ROW_HEIGHT + gap;
    const resizeStartSnapshot = snapshotGridLayout(layout);
    const resizeParentPanelLayoutSnapshot = resizeParentPanelLayout ? snapshotGridLayout(resizeParentPanelLayout) : null;
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
        if (resizeParentPanel) syncOpenPanelHeightToInternalGrid(resizeParentPanel, { includePlaceholders: true });
      }, source, { items: reflowItems, metrics: layoutMetrics });
    };

    const finishResize = (upEvent, canceled) => {
      if (canceled) {
        restoreGridLayoutSnapshot(resizeStartSnapshot);
        if (resizeParentPanelLayoutSnapshot) restoreGridLayoutSnapshot(resizeParentPanelLayoutSnapshot);
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
          if (resizeParentPanel) syncOpenPanelHeightToInternalGrid(resizeParentPanel);
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
      syncOpenPanelHeightToInternalGrid(panel);
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
    [...layout.querySelectorAll(":scope > .widget-card:not([hidden])")].forEach((widget, index) => {
      const key = widget.dataset.widgetKey;
      const expansionBaseline = serializableExpansionBaselineState(expansionBaselineSnapshot, widget);
      if (!key) return;
      try {
        writeJsonStore(widgetStorageKey(layoutKey, key, profile), {
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
          widgetLayer: widgetLayerForElement(widget),
          minW: Number(widget.dataset.minW) || null,
          minH: Number(widget.dataset.minH) || null,
          locked: widget.dataset.locked === "true",
          resizable: widget.dataset.resizable === "false" ? false : true,
          config: widget.dataset.widgetConfig || null,
          breakBefore: widgetHasRowBreakBefore(widget),
          spacerBefore: widgetSpacerSiblingsBefore(widget).length,
          expansionBaseline,
          ...workspaceObjectPersistence(widget),
        });
      } catch {}
    });
    const customWidgets = [...layout.querySelectorAll(':scope > .widget-card[data-custom-widget="true"]:not([hidden])')]
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
        widgetLayer: widgetLayerForElement(widget),
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
      writeJsonStore(customWidgetsKey(layoutKey, profile), customWidgets);
      writeRawStore(hiddenWidgetsKey(layoutKey, profile), layout.dataset.hiddenWidgetsDraft || "[]");
    } catch {}
  };

  const initWidgetLayout = (layout) => {
    const internalLayout = isPanelInternalWidgetLayout(layout);
    const layoutKey = internalLayout ? gridItemLayoutKey(layout) : (layout.dataset.widgetLayoutKey || "default");
    const profile = getActivePanelProfile(layoutKey);
    let customDefinitions = [];
    if (!internalLayout) {
      try {
        customDefinitions = readJsonStore(customWidgetsKey(layoutKey, profile), []);
      } catch {
        customDefinitions = [];
      }
    }
    customDefinitions
      .filter((definition) => definition?.key && !layout.querySelector(`:scope > .widget-card[data-widget-key="${CSS.escape(definition.key)}"]`))
      .forEach((definition) => layout.appendChild(createCustomWidget(definition)));
    let hiddenWidgets = [];
    if (!internalLayout) {
      try {
        hiddenWidgets = parseJsonRecord(readRawStore(hiddenWidgetsKey(layoutKey, profile), "[]"), []);
      } catch {
        hiddenWidgets = [];
      }
    }
    writeDraftList(layout, "hiddenWidgetsDraft", hiddenWidgets);
    hiddenWidgets.forEach((key) => {
      const widget = layout.querySelector(`:scope > .widget-card[data-widget-key="${CSS.escape(key)}"]`);
      if (widget) widget.hidden = true;
    });
    const widgets = [...layout.querySelectorAll(":scope > .widget-card")];
    const savedByWidget = new Map();
    widgets.forEach((widget, index) => {
      const key = widget.dataset.widgetKey || `widget-${index}`;
      widget.dataset.defaultOrder = String(index);
      widget.dataset.defaultTitle = widget.querySelector(".stat-lbl")?.textContent?.trim() || "Widget";
      let saved = null;
      if (!internalLayout) {
        try {
          saved = readJsonStore(widgetStorageKey(layoutKey, key, profile), null);
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
      // Preserve widget.dataset.panelColor when re-initializing — panel-
      // containment re-runs initWidgetLayout on the cloned widget (the
      // panel-internal layout has no saved store, so `saved` is null).
      // Falling straight through to defaultTheme would reset any custom
      // color the widget carried, making widgets revert to default blue
      // after being dropped into a panel.
      applyPanelColor(widget, saved?.color || widget.dataset.panelColor || widget.querySelector(".panel-color-toggle")?.dataset.defaultTheme);
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
    [...layout.querySelectorAll(":scope > .widget-card")].forEach((widget) => {
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
      ensureWidgetTools(widget);
      widget.__saveWidgetLayout = () => saveWidgetLayouts(layout);
      delete widget.dataset.widgetRuntimeControlsBound;
      bindWidgetRuntimeControls(widget);
      const tools = widget.querySelector(".widget-tools");
      const drawer = widget.querySelector(".widget-tool-drawer");
      widget.__dashboardToolDrawer = drawer;
      const settings = widget.querySelector(".widget-settings-toggle");
      const moveHandle = widget.querySelector(".panel-move-handle");
      const resizeHandle = widget.querySelector(".panel-resize-handle");
      const pinButton = widget.querySelector(".panel-pin-toggle");
      const titleButton = widget.querySelector(".panel-title-handle");
      const colorToggle = widget.querySelector(".panel-color-toggle");
      const deleteButton = widget.querySelector(".panel-delete-handle");
      const colorMenu = buildPanelColorMenu(widget, layout, colorToggle);
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
          !drawer?.contains(event.target) &&
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
      const openTools = (pointerCoords = null) => {
        if (performance.now() < suppressToolOpenUntil) return;
        if (!canOpenDashboardTools(widget)) return;
        window.clearTimeout(closeTimer);
        portalDashboardToolDrawer(drawer, settings || widget);
        if (pointerCoords) {
          positionDashboardToolDrawerAtPointer(widget, drawer, pointerCoords.clientX, pointerCoords.clientY);
        } else {
          positionDashboardToolDrawer(widget, settings, drawer);
        }
        const _openToolsTop = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-top");
        const _openToolsRight = drawer?.style?.getPropertyValue("--dashboard-tool-drawer-right");
        if (_openToolsTop) tools?.style?.setProperty("--dashboard-tool-drawer-top", _openToolsTop);
        if (_openToolsRight) tools?.style?.setProperty("--dashboard-tool-drawer-right", _openToolsRight);
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
        widget.classList.remove("widget-workbench-open");
        settings?.setAttribute("aria-expanded", "false");
        if (workbenchPanel) restoreFloatingMenu(workbenchPanel);
        workbenchPanel?.setAttribute("hidden", "");
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        restoreDashboardToolDrawer(drawer);
        setWidgetLinkNavigationSuspended(widget, false);
        syncLayoutToolsActive();
      };
      const closeWorkbench = () => {
        if (workbenchPanel) restoreFloatingMenu(workbenchPanel);
        widget.classList.remove("widget-workbench-open");
        workbenchPanel?.setAttribute("hidden", "");
        if (!widget.classList.contains("widget-tools-open")) setWidgetLinkNavigationSuspended(widget, false);
        syncLayoutToolsActive();
      };
      const openWorkbench = (pointerCoords = null) => {
        if (isDashboardInteractionActive()) return;
        closeInactiveDashboardTools(widget);
        window.clearTimeout(closeTimer);
        widget.classList.remove("widget-tools-open");
        settings?.setAttribute("aria-expanded", "false");
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        setWidgetLinkNavigationSuspended(widget, true);
        widget.classList.add("widget-workbench-open");
        const panel = ensureWidgetWorkbenchPanel(widget);
        if (panel) {
          portalFloatingMenu(panel, settings || widget, { skipPosition: true });
          panel.style.left = "0px";
          panel.style.top = "0px";
          panel.hidden = false;
          const panelWidth = panel.offsetWidth || 318;
          const panelHeight = panel.offsetHeight || 200;
          const vg = 8;
          const coords = pointerCoords || (() => {
            const r = (settings || widget).getBoundingClientRect();
            return { clientX: r.right, clientY: r.top };
          })();
          const left = Math.max(vg, Math.min(coords.clientX - panelWidth, window.innerWidth - vg - panelWidth));
          const top = Math.max(vg, Math.min(coords.clientY, window.innerHeight - vg - panelHeight));
          panel.style.left = `${Math.round(left)}px`;
          panel.style.top = `${Math.round(top)}px`;
        }
        syncLayoutToolsActive();
      };
      const toggleAppearanceSettings = (pointerCoords = null) => {
        releaseToolLeaveClose();
        closeWorkbench();
        if (!canOpenDashboardTools(widget)) return;
        const shouldClose = widget.classList.contains("widget-tools-open") &&
          !toolsOpenedByApproach;
        toolsOpenedByApproach = false;
        if (shouldClose) {
          closeTools();
          return;
        }
        suppressToolOpenUntil = 0;
        closeInactiveDashboardTools(widget);
        openTools(pointerCoords);
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
      };
      const pointerIntersectsSettingsToggle = (event) => {
        if (!settings || event?.clientX == null || event?.clientY == null) return false;
        const rect = settings.getBoundingClientRect();
        return pointInRect(event.clientX, event.clientY, rect);
      };
      const scheduleClose = () => {
        window.clearTimeout(closeTimer);
        if (isDashboardInteractionActive() || ignoreToolLeaveCloseUntilPointerActivity) return;
        closeTimer = window.setTimeout(() => {
          if (isDashboardInteractionActive()) return;
          if (ignoreToolLeaveCloseUntilPointerActivity) return;
          const activeElement = document.activeElement;
          if (
            !tools?.matches(":hover") &&
            !drawer?.matches(":hover") &&
            !drawer?.contains(activeElement) &&
            !colorMenu?.matches(":hover")
          ) closeTools();
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
      settings?.addEventListener("mouseenter", resumeToolHoverClose);
      settings?.addEventListener("pointermove", resumeToolHoverClose, { passive: true });
      const isInteractiveWidgetSurfaceTarget = (event) => {
        const interactiveTarget = event.target?.closest?.(
          `${surfaceResponseControlSelector}, .media-widget-stage, [contenteditable='true']`,
        );
        return interactiveTarget && interactiveTarget !== widget && widget.contains(interactiveTarget);
      };
      widget.addEventListener("click", (event) => {
        if (!event.target?.closest?.(".widget-tools") && pointerIntersectsSettingsToggle(event)) {
          event.preventDefault();
          event.stopPropagation();
          suppressSettingsClickUntil = performance.now() + 320;
          toggleAppearanceSettings();
          return;
        }
        if (event.target?.closest?.(".widget-tools")) return;
        if (isInteractiveWidgetSurfaceTarget(event)) return;
        event.preventDefault();
        event.stopPropagation();
        if (performance.now() < suppressWidgetClickUntil) return;
        suppressToolOpenUntil = 0;
        openWorkbench({ clientX: event.clientX, clientY: event.clientY });
        try {
          widget.focus?.({ preventScroll: true });
        } catch {
          widget.focus?.();
        }
      }, true);
      widget.__openCustomization = (event) => {
        if (event.target?.closest?.(".widget-tools") || isInteractiveWidgetSurfaceTarget(event)) return;
        event.preventDefault();
        event.stopPropagation();
        toggleAppearanceSettings({ clientX: event.clientX, clientY: event.clientY });
      };
      widget.addEventListener("pointermove", (event) => {
        if (event.target?.closest?.(".widget-tools")) return;
        if (!pointerIntersectsSettingsToggle(event)) return;
        resumeToolHoverClose();
      }, { passive: true });
      tools?.addEventListener("mouseenter", resumeToolHoverClose);
      tools?.addEventListener("mouseleave", scheduleClose);
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
      const beginWidgetMove = (event, options = {}) => {
        if (event.button !== 0 || (widget.classList.contains("db-panel-pinned") && !isPanelInternalGridItem(widget))) return;
        const surfaceShortcut = Boolean(options.surfaceShortcut);
        if (surfaceShortcut && !isWorkspaceSurfaceDragStart(event, widget)) return;
        const restoreToolsAfterDrag = widget.classList.contains("widget-tools-open") ||
          settings?.getAttribute("aria-expanded") === "true" ||
          drawer?.matches(":hover") ||
          isDashboardToolInteractionTarget(event);
        window.clearTimeout(closeTimer);
        if (surfaceShortcut) {
          setWidgetLinkNavigationSuspended(widget, true);
        } else {
          openTools();
        }
        runOrderedDrag({
          layout,
          item: widget,
          event,
          draggingClass: "widget-dragging",
          placeholderClass: "widget-placeholder",
          threshold: 5,
          deferStartEventHandling: surfaceShortcut,
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
      };
      widget.__beginWidgetMoveFromDragRuntime = beginWidgetMove;
      moveHandle?.addEventListener("pointerdown", beginWidgetMove);
      widget.addEventListener("pointerdown", (event) => {
        if (!isInteractiveWidgetSurfaceTarget(event) && !event.target?.closest?.(".panel-settings-toggle, .panel-tool-button")) {
          event.preventDefault();
        }
        beginWidgetMove(event, { surfaceShortcut: true });
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
        const resizeParentPanel = isPanelInternalWidgetLayout(layout) ? panelForInternalWidgetLayout(layout) : null;
        const resizeParentPanelLayout = resizeParentPanel?.closest?.(".panel-layout") || null;
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
        beginResizeAutoZoomCamera();
        updateResizeAutoZoomCamera({
          top: startRect.top,
          bottom: startRect.bottom,
          height: startRect.height,
        });
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
        const resizeParentPanelLayoutSnapshot = resizeParentPanelLayout ? snapshotGridLayout(resizeParentPanelLayout) : null;
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
          if (resizeParentPanel) syncOpenPanelHeightToInternalGrid(resizeParentPanel, { includePlaceholders: true });
          previewSpan = snappedSpan;
          previewRows = snappedRows;
        };
        const onMove = (moveEvent) => {
          moveEvent.preventDefault();
          const scrollDeltaY = (window.scrollY || document.documentElement.scrollTop || 0) - startScrollY;
          const scenePoint = resizeAutoZoomPointerToScenePoint(moveEvent.clientX, moveEvent.clientY);
          const deltaX = moveEvent.clientX - startX;
          const effectiveClientY = scenePoint.y + scrollDeltaY;
          const deltaY = effectiveClientY - startY;
          const liveWidth = Math.max(minLiveWidth, Math.min(maxLiveWidth, startRect.width + (resizeEdge === "left" ? -deltaX : deltaX)));
          const liveHeight = Math.max(minLiveHeight, startRect.height + deltaY);
          const liveLeft = resizeEdge === "left" ? startRect.right - liveWidth : startRect.left;
          const liveTop = startRect.top - scrollDeltaY;
          updateLiveResizeSurface(liveResizePreview, liveWidth, liveHeight, liveLeft, liveTop);
          updateResizeAutoZoomCamera({
            top: liveTop,
            bottom: liveTop + liveHeight,
            height: liveHeight,
          });
          const rawSpan = startSpan + ((((resizeEdge === "left" ? -deltaX : deltaX)) / layoutWidth) * 6);
          const nextSpan = Math.max(gridItemMinimumSpan(widget), Math.min(6, Math.round(rawSpan)));
          const rawRows = startRows + (deltaY / layoutMetrics.rowStep);
          const nextRows = Math.max(minRows, Math.round(rawRows));
          if (nextSpan === previewSpan && nextRows === previewRows) return;
          animateOrderedGridReflow(layout, () => applyResize(nextSpan, nextRows), widget, { items: reflowItems, metrics: layoutMetrics });
        };
        const finishWidgetResize = (upEvent, canceled) => {
          endResizeAutoZoomCamera({ immediate: true });
          if (canceled) {
            restoreGridLayoutSnapshot(resizeStartSnapshot);
            if (resizeParentPanelLayoutSnapshot) restoreGridLayoutSnapshot(resizeParentPanelLayoutSnapshot);
          } else {
            animateOrderedGridReflow(layout, () => {
              const currentSpan = previewSpan || Number(widget.dataset.currentSpan) || startSpan;
              const groupedSpan = groupedWidgetReleaseSpan(currentSpan, resizePeers.length + 1);
              const releaseSpan = document.body.classList.contains("dashboard-interaction-scroll-extended")
                ? Math.round(currentSpan)
                : alignedResizeSpan({
                  layout,
                  item: resizePreview,
                  currentSpan,
                  gap: 12,
                  minSpan: gridItemMinimumSpan(widget),
                  metrics: refreshGridMetricsRect(layoutMetrics),
                });
              const snappedSpan = groupedSpan ?? (resizeEdge === "left" ? Math.round(currentSpan) : releaseSpan);
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
              if (resizeParentPanel) syncOpenPanelHeightToInternalGrid(resizeParentPanel);
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
            endResizeAutoZoomCamera({ immediate: true });
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
    if (internalLayout && layout.dataset.dragRuntimeDelegateBound !== "true") {
      layout.dataset.dragRuntimeDelegateBound = "true";
      layout.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !layout.contains(event.target)) return;
        if (event.target?.closest?.(".widget-card")) return;
        const handle = [...layout.querySelectorAll(":scope > .widget-card .panel-move-handle")]
          .filter((candidate) => candidate.offsetParent !== null)
          .find((candidate) => pointInRect(event.clientX, event.clientY, candidate.getBoundingClientRect()));
        const widget = handle?.closest?.(".widget-card");
        if (widget?.parentElement !== layout) return;
        widget?.__beginWidgetMoveFromDragRuntime?.(event);
      }, { capture: true });
    }
  };

  panelRuntime = dashboardPanelRuntime.createRuntime({
    columns: DASHBOARD_GRID_COLUMNS,
    workspaceObjectCapabilities,
    gridRowsFromHeight,
    gridHeightForRows,
    gridGapForLayout,
    gridItemRowSpan,
    gridItemMinimumSpan,
  });

  panelContainmentRuntime = dashboardPanelContainment.createRuntime({
    columns: DASHBOARD_GRID_COLUMNS,
    rowHeight: DASHBOARD_GRID_ROW_HEIGHT,
    workspaceObjectCapabilities,
    createGridMetrics,
    gridBoundsForItem,
    gridHeightForRows,
    gridRowsFromHeight,
    gridGapForLayout,
    gridItemRowSpan,
    gridItemMinimumSpan,
    getPanelMinimumHeight,
    panelMinimumRows,
    applyPanelHeight,
    applyPanelSpan,
    openPanelForInternalDrop,
    applyVerticalPanelExpansion,
    resolveSparseGridLayout,
    reflowItemsForLayout,
    undoTransientItemClasses,
    groupItemLayoutKey,
    applyWidgetSpan,
    applyWidgetGridPosition,
    gridCellFromPoint,
    initWidgetLayout,
    readDraftList,
    writeDraftList,
    gridItemLayoutKey,
    regionIdForWorkspaceItem,
    emitWorkspaceEvent,
    commitActiveDropSlot,
    cleanupWidgetRowBreaks,
  });

  document.querySelectorAll(".widget-layout").forEach(initWidgetLayout);

  document.querySelectorAll(".panel-layout").forEach((layout) => {
    const layoutKey = layout.dataset.layoutKey || "default";
    const layoutProfile = getActivePanelProfile(layoutKey);
    let customPanelDefinitions = [];
    try {
      customPanelDefinitions = readJsonStore(customPanelsKey(layoutKey, layoutProfile), []);
    } catch {
      customPanelDefinitions = [];
    }
    customPanelDefinitions
      .filter((definition) => definition?.key && !layout.querySelector(`:scope > .db-panel[data-panel-key="${CSS.escape(definition.key)}"]`))
      .forEach((definition) => layout.appendChild(createCustomPanel(definition)));
    let hiddenPanels = [];
    try {
      hiddenPanels = parseJsonRecord(readRawStore(hiddenPanelsKey(layoutKey, layoutProfile), "[]"), []);
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
        saved = readJsonStore(panelStorageKey(layoutKey, key, layoutProfile), null);
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
      if (panel.hidden) return;
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
      panel.__dashboardToolDrawer = panelToolDrawer;
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
      if (internalWidgetGrid) syncOpenPanelHeightToInternalGrid(panel, { reflow: false });
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
          if (event.relatedTarget && panel.contains(event.relatedTarget) && !isDashboardInteractionActive()) {
            surfaceResponseState.target = panel;
            surfaceResponseState.rect = panel.getBoundingClientRect();
            surfaceResponseState.clientX = event.clientX;
            surfaceResponseState.clientY = event.clientY;
            surfaceResponseState.scrollX = window.scrollX || 0;
            surfaceResponseState.scrollY = window.scrollY || 0;
            if (!surfaceResponseState.frame) {
              surfaceResponseState.frame = requestAnimationFrame(updateSurfaceResponse);
            }
          }
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
          !panelToolDrawer?.contains(event.target) &&
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
      const openPanelTools = (pointerCoords = null) => {
        if (performance.now() < suppressToolOpenUntil) return;
        if (!canOpenDashboardTools(panel)) return;
        window.clearTimeout(toolsCloseTimer);
        portalDashboardToolDrawer(panelToolDrawer, settingsButton || panel);
        if (pointerCoords) {
          positionDashboardToolDrawerAtPointer(panel, panelToolDrawer, pointerCoords.clientX, pointerCoords.clientY);
        } else {
          positionDashboardToolDrawer(panel, settingsButton, panelToolDrawer);
        }
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
        restoreDashboardToolDrawer(panelToolDrawer);
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
            panelToolDrawer?.contains(activeElement) ||
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
      const isInteractivePanelSurfaceTarget = (event) => {
        if (event?.target?.closest?.(".panel-internal-widget-grid > .widget-card")) return true;
        const interactiveTarget = event?.target?.closest?.(`${surfaceResponseControlSelector}, [contenteditable='true']`);
        return interactiveTarget && panel.contains(interactiveTarget);
      };

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
      panel.__openCustomization = (event) => {
        if (event.target?.closest?.(".panel-tools") || isInteractivePanelSurfaceTarget(event)) return;
        event.preventDefault();
        event.stopPropagation();
        releasePanelToolLeaveClose();
        if (!canOpenDashboardTools(panel)) return;
        closeInactiveDashboardTools(panel);
        openPanelTools({ clientX: event.clientX, clientY: event.clientY });
      };
      header.addEventListener("keydown", (event) => {
        if (event.target?.closest?.(".panel-tools")) return;
        if (event.target?.isContentEditable) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        togglePanel();
      });

      const beginPanelMove = (event, options = {}) => {
        if (event.button !== 0) return;
        if (panel.classList.contains("db-panel-pinned")) return;
        const surfaceShortcut = Boolean(options.surfaceShortcut);
        if (surfaceShortcut && !isWorkspaceSurfaceDragStart(event, panel)) return;
        const restoreToolsAfterDrag = panel.classList.contains("db-panel-tools-open") ||
          settingsButton?.getAttribute("aria-expanded") === "true" ||
          panelToolDrawer?.matches(":hover") ||
          isDashboardToolInteractionTarget(event);
        window.clearTimeout(toolsCloseTimer);
        toolPointerCapture = true;
        if (!surfaceShortcut) openPanelTools();
        runOrderedDrag({
          layout,
          item: panel,
          event,
          draggingClass: "db-panel-dragging",
          placeholderClass: "db-panel-placeholder",
          threshold: 6,
          deferStartEventHandling: surfaceShortcut,
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
      };
      moveHandle?.addEventListener("pointerdown", beginPanelMove);
      panel.addEventListener("pointerdown", (event) => {
        if (!isInteractivePanelSurfaceTarget(event)) event.preventDefault();
        beginPanelMove(event, { surfaceShortcut: true });
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
        beginResizeAutoZoomCamera();
        updateResizeAutoZoomCamera({
          top: startRect.top,
          bottom: startRect.bottom,
          height: startRect.height,
        });
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
          const scenePoint = resizeAutoZoomPointerToScenePoint(moveEvent.clientX, moveEvent.clientY);
          const effectiveClientY = scenePoint.y + scrollDeltaY;
          const deltaX = moveEvent.clientX - startX;
          const liveWidth = Math.max(minLiveWidth, Math.min(maxLiveWidth, startRect.width + (resizeEdge === "left" ? -deltaX : deltaX)));
          const liveLeft = resizeEdge === "left" ? startRect.right - liveWidth : startRect.left;
          const liveHeight = collapsedPanelResize ? startRect.height : Math.max(minLiveHeight, startRect.height + (effectiveClientY - startY));
          const liveTop = startRect.top - scrollDeltaY;
          updateLiveResizeSurface(liveResizePreview, liveWidth, liveHeight, liveLeft, liveTop);
          const rawSpan = startSpan + ((((resizeEdge === "left" ? -deltaX : deltaX)) / layoutWidth) * 6);
          const nextSpan = Math.max(gridItemMinimumSpan(panel), Math.min(6, Math.round(rawSpan)));
          const nextRows = Math.max(panelMinimumRows(panel, layoutMetrics), startRows + Math.round((effectiveClientY - startY) / rowStep));
          const nextHeight = gridHeightForRows(nextRows, gap);
          const cameraHeight = collapsedPanelResize
            ? expandedPanelFootprintHeight(panel, layout, nextRows, layoutMetrics)
            : liveHeight;
          updateResizeAutoZoomCamera({
            top: liveTop,
            bottom: liveTop + cameraHeight,
            height: cameraHeight,
          });
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
          endResizeAutoZoomCamera({ immediate: true });
          if (canceled) {
            restoreGridLayoutSnapshot(resizeStartSnapshot);
          } else {
            animateOrderedGridReflow(layout, () => {
              const currentSpan = previewSpan || Number(panel.dataset.currentSpan) || startSpan;
              const groupedSpan = groupedPanelReleaseSpan(currentSpan, resizePeers.length + 1);
              const releaseSpan = document.body.classList.contains("dashboard-interaction-scroll-extended")
                ? Math.round(currentSpan)
                : alignedResizeSpan({
                  layout,
                  item: resizePreview,
                  currentSpan,
                  gap: 16,
                  minSpan: gridItemMinimumSpan(panel),
                  metrics: refreshGridMetricsRect(layoutMetrics),
                });
              const snappedSpan = groupedSpan ?? (resizeEdge === "left" ? Math.round(currentSpan) : releaseSpan);
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
            endResizeAutoZoomCamera({ immediate: true });
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
        if (event.target?.closest?.(".panel-internal-widget-grid > .widget-card")) return;
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

  document.addEventListener("contextmenu", (event) => {
    const target = event.target?.closest?.(surfaceResponseSelector) ||
      event.target?.closest?.(".panel-layout > .workspace-divider");
    target?.__openCustomization?.(event);
  }, true);
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
      layer: widgetLayerForElement(widget, definition),
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
      ".dashboard-live-resize, .dashboard-resize-preview, .dashboard-expanded-footprint-ghost, .dashboard-group-boundary, .dashboard-group-member-preview, .widget-placeholder, .db-panel-placeholder"
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
      ? [...widgetLayout.querySelectorAll(":scope > .widget-card:not([hidden])")]
          .map((widget) => canonicalWidgetInstanceForPersistence(widget, null))
      : [];
    const childWidgets = panelLayout
      ? [...panelLayout.querySelectorAll(":scope > .db-panel:not([hidden])")]
          .flatMap((panel) => panelChildWidgets(panel).map((widget) => canonicalWidgetInstanceForPersistence(widget, panel)))
      : [];
    const widgets = [...rootWidgets, ...childWidgets];
    const contexts = loadWorkspaceContexts(layoutKey, profile);
    const dataSources = loadDataSources(layoutKey, profile);
    const assets = loadAssets(layoutKey, profile);
    const objects = [
      ...widgets.map((widget) => ({ id: widget.id, type: WORKSPACE_OBJECT_TYPES.widget, layoutDomain: widget.layoutDomain, parentId: widget.parentPanelId || null })),
      ...panels.map((panel) => ({ id: panel.id, type: WORKSPACE_OBJECT_TYPES.panel, layoutDomain: panel.layoutDomain, parentId: null })),
      ...dividers.map((divider) => ({ id: divider.id, type: WORKSPACE_OBJECT_TYPES.divider, layoutDomain: divider.layoutDomain, parentId: null })),
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
      contexts,
      dataSources,
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
    return saved;
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

  [...new Set([
    ...[...document.querySelectorAll(".panel-layout")].map((layout) => layout.dataset.layoutKey || "default"),
    ...[...document.querySelectorAll(".widget-layout")].map((layout) => layout.dataset.widgetLayoutKey || "default"),
  ])].forEach((layoutKey) => pushLiveLayoutUndo(layoutKey));


  const setActiveLayoutSource = (layoutKey = "builder", source = {}) => {
    const slot = source.slot || source.id || "1";
    writeJsonStore(layoutSourceKey(layoutKey), {
      kind: "saved",
      id: slot,
      label: source.label || `Layout ${slot}`,
      slot,
    });
  };
  const activeLayoutSource = (layoutKey = "builder") => {
    const stored = readJsonStore(layoutSourceKey(layoutKey), null);
    const slot = stored?.kind === "saved" ? (stored.slot || stored.id || "1") : "1";
    return { kind: "saved", id: slot, slot, label: stored?.label || `Layout ${slot}` };
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

  const layoutSourceLabel = (source = {}, layoutKey = "builder") =>
    `Layout ${source.slot || source.id || getActivePanelProfile(layoutKey)}`;
  const layoutSourceGroups = () => ([{
    id: "saved-layouts",
    label: "Saved Layouts",
    entries: Array.from({ length: 10 }, (_, index) => {
      const slot = String(index + 1);
      return { kind: "saved", id: slot, slot, label: `Layout ${slot}` };
    }),
  }]);
  const renderLayoutSourceMenus = () => {
    document.querySelectorAll(".layout-slot-picker").forEach((picker) => {
      const layoutKey = picker.dataset.layoutTarget || "default";
      const trigger = picker.querySelector(".layout-slot-trigger");
      const triggerLabel = trigger?.querySelector(".layout-slot-label");
      const menu = picker.querySelector(".layout-slot-menu");
      const activeSource = activeLayoutSource(layoutKey);
      const currentSlot = activeSource.slot || activeSource.id || getActivePanelProfile(layoutKey);
      if (trigger) {
        trigger.dataset.layoutTarget = layoutKey;
        trigger.dataset.currentSlot = currentSlot;
        trigger.dataset.layoutSourceKind = "saved";
        trigger.dataset.layoutSourceId = currentSlot;
        if (triggerLabel) triggerLabel.textContent = layoutSourceLabel(activeSource, layoutKey);
        else trigger.textContent = layoutSourceLabel(activeSource, layoutKey);
      }
      if (!menu) return;
      menu.replaceChildren();
      layoutSourceGroups(layoutKey).forEach((group) => {
        const section = document.createElement("div");
        section.className = "layout-source-group glass-menu-section";
        section.dataset.layoutSourceGroup = group.id;
        const header = document.createElement("div");
        header.className = "layout-source-heading";
        header.textContent = group.label;
        section.appendChild(header);
        group.entries.forEach((entry) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "layout-source-option glass-menu-item";
          option.setAttribute("role", "menuitem");
          option.dataset.layoutSourceKind = "saved";
          option.dataset.layoutSourceId = entry.id;
          option.dataset.layoutSourceLabel = entry.label;
          option.dataset.slot = entry.slot;
          option.dataset.layoutSlot = entry.slot;
          option.textContent = entry.label;
          option.classList.toggle("is-active", currentSlot === entry.slot);
          section.appendChild(option);
        });
        menu.appendChild(section);
      });
    });
  };
  renderLayoutSourceMenus();
  const closeLayoutSourceMenus = () => {
    document.querySelectorAll(".layout-slot-menu.open").forEach((menu) => {
      menu.classList.remove("open");
      restoreFloatingMenu(menu);
    });
    document.querySelectorAll(".layout-slot-trigger[aria-expanded='true']").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  };

  const setLayoutTriggerSelection = (picker, source = {}) => {
    const layoutKey = picker.dataset.layoutTarget || "default";
    const trigger = picker.querySelector(".layout-slot-trigger");
    const triggerLabel = trigger?.querySelector(".layout-slot-label");
    if (!trigger) return;
    if (source.kind === "saved") trigger.dataset.currentSlot = source.slot || source.id || "1";
    trigger.dataset.layoutSourceKind = source.kind || "saved";
    trigger.dataset.layoutSourceId = source.id || source.slot || "1";
    if (triggerLabel) triggerLabel.textContent = layoutSourceLabel(source, layoutKey);
    else trigger.textContent = layoutSourceLabel(source, layoutKey);
    const menu = picker.querySelector(".layout-slot-menu") || document.querySelector(".workspace-menu-overlay-layer > .layout-slot-menu");
    (menu || picker).querySelectorAll(".layout-source-option, [data-slot]").forEach((item) => {
      const sameKind = (item.dataset.layoutSourceKind || "saved") === (source.kind || "saved");
      const sameId = String(item.dataset.layoutSourceId || item.dataset.slot || "") === String(source.id || source.slot || "");
      item.classList.toggle("is-active", sameKind && sameId);
    });
  };

  const activateLayoutSource = async (layoutKey = "builder", source = {}) => {
    if ((source.kind || "saved") === "saved") {
      loadSavedLayout(layoutKey, source.slot || source.id || "1");
      return { ok: true, source };
    }
    return { ok: false, error: "Unsupported layout source.", source };
  };
  window.dashboardLayoutSourceRuntime = {
    groups: layoutSourceGroups,
    active: activeLayoutSource,
    activate: activateLayoutSource,
    render: renderLayoutSourceMenus,
  };

  const loadSavedLayout = (layoutKey = "builder", slot = "1") => {
    try {
      layoutPersistence.copyProfile(layoutKey, slot, layoutPersistence.WORKING_PROFILE);
      layoutPersistence.setActiveProfile(layoutKey, layoutPersistence.WORKING_PROFILE);
    } catch {}
    setActiveLayoutSource(layoutKey, { kind: "saved", id: slot, slot, label: `Layout ${slot}` });
    showToast(`Loading layout ${slot}.`, "info", {
      type: "layout-load-completed",
      source: "layout-load",
      layoutKey,
      payload: { profile: slot },
    });
    window.location.reload();
  };

  document.querySelectorAll(".layout-slot-picker").forEach((picker) => {
    const layoutKey = picker.dataset.layoutTarget || "default";
    const trigger = picker.querySelector(".layout-slot-trigger");
    const menu = picker.querySelector(".layout-slot-menu");
    let closeTimer;
    const openMenu = () => {
      window.clearTimeout(closeTimer);
      renderLayoutSourceMenus();
      portalFloatingMenu(menu, trigger, { align: "left", offset: 8 });
      if (!menu?.classList.contains("open")) {
        menu?.classList.remove("open");
        void menu?.offsetHeight;
        window.requestAnimationFrame(() => {
          menu?.classList.add("open");
        });
      }
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
      const restoreAfterAnimation = () => {
        if (menu?.classList?.contains("open")) return;
        restoreFloatingMenu(menu);
        trigger?.setAttribute("aria-expanded", "false");
      };
      if (menu?.classList.contains("menu-portaled")) {
        const duration = parseFloat(getComputedStyle(menu).transitionDuration || "0");
        if (duration > 0) {
          trigger?.setAttribute("aria-expanded", "false");
          menu?.addEventListener("transitionend", restoreAfterAnimation, { once: true });
          return;
        }
      }
      restoreFloatingMenu(menu);
      trigger?.setAttribute("aria-expanded", "false");
    };
    picker.addEventListener("mouseenter", openMenu);
    picker.addEventListener("mouseleave", scheduleClose);
    menu?.addEventListener("mouseenter", openMenu);
    menu?.addEventListener("mouseleave", scheduleClose);
    trigger?.addEventListener("focus", openMenu);
    trigger?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMenu();
    });
    menu?.addEventListener("click", async (event) => {
      const option = event.target?.closest?.(".layout-source-option, [data-slot]");
      if (!option || !menu.contains(option)) return;
      event.preventDefault();
      event.stopPropagation();
      const source = {
        kind: option.dataset.layoutSourceKind || "saved",
        id: option.dataset.layoutSourceId || option.dataset.slot || "1",
        slot: option.dataset.layoutSlot || option.dataset.slot || "",
        label: option.dataset.layoutSourceLabel || option.textContent?.trim() || "",
        prompt: option.dataset.aiPrompt || "",
        scenario: option.dataset.demoScenario || "",
        profile: option.dataset.layoutProfile || "",
      };
      setLayoutTriggerSelection(picker, source);
      closeMenu();
      if (source.kind === "saved") {
        loadSavedLayout(layoutKey, source.slot || source.id || "1");
        return;
      }
      await activateLayoutSource(layoutKey, source);
    });
    document.addEventListener("pointerdown", (event) => {
      if (picker.contains(event.target) || menu?.contains(event.target)) return;
      closeMenu();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  });

  document.querySelectorAll(".layout-load-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const layoutKey = button.dataset.layoutTarget || "default";
      const trigger = document.querySelector(`.layout-slot-trigger[data-layout-target="${CSS.escape(layoutKey)}"]`);
      const source = {
        kind: trigger?.dataset.layoutSourceKind || "saved",
        id: trigger?.dataset.layoutSourceId || trigger?.dataset.currentSlot || "1",
        slot: trigger?.dataset.currentSlot || "1",
        label: trigger?.querySelector(".layout-slot-label")?.textContent?.trim() || "",
      };
      if (source.kind !== "saved") {
        await activateLayoutSource(layoutKey, source);
        return;
      }
      loadSavedLayout(layoutKey, activeLayoutSlot(layoutKey) || "1");
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
      const layout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
      if (layout) savePanelLayouts(layout, selected, { persist: true });
      const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
      if (widgetLayout) saveWidgetLayouts(widgetLayout, selected, { persist: true });
      saveWorkspaceContextState(layoutKey, selected, { persist: true, history: false });
      savePersistedWorkspaceSnapshot(layoutKey, selected);
      if (selected !== layoutPersistence.WORKING_PROFILE) {
        layoutPersistence.copyProfile(layoutKey, selected, layoutPersistence.WORKING_PROFILE);
      }
      setActiveLayoutSource(layoutKey, { kind: "saved", id: selected, slot: selected, label: `Layout ${selected}` });
      renderLayoutSourceMenus();
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
    if (event.target?.closest?.(".app-nav, .workspace-menu-overlay-layer, .panel-tools, .widget-tools, .panel-color-menu, .panel-add-menu, .layout-slot-menu, .nav-status-popover")) return;
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
    { category: "visualization", subcategory: "Geospatial", displayName: "Map", actionClass: "widget-add-action", dataset: { widgetKind: "map" } },
    { category: "controls", displayName: "Timeframe", actionClass: "widget-add-action", dataset: { widgetKind: "timeframe" } },
    { category: "controls", displayName: "Calendar", actionClass: "widget-add-action", dataset: { widgetKind: "calendar" } },
    { category: "content", displayName: "Text / Notes", actionClass: "widget-add-action", dataset: { widgetKind: "text" } },
    { category: "content", displayName: "Region Summary", actionClass: "widget-add-action", dataset: { widgetKind: "region-summary" } },
    { category: "media", displayName: "Image", actionClass: "widget-add-action", dataset: { widgetKind: "image" } },
    { category: "media", displayName: "Video", actionClass: "widget-add-action", dataset: { widgetKind: "video" } },
    { category: "media", displayName: "PDF / Document", actionClass: "widget-add-action", dataset: { widgetKind: "document" } },
    { category: "containers", displayName: "Panel", actionClass: "panel-add-action", dataset: { panelKind: "panel" } },
    { category: "dividers", displayName: "Divider", actionClass: "divider-add-action", dataset: { dividerKind: "context-divider" } },
  ];
  const objectAddItemRuntimeDefinition = (item = {}) => {
    if (item.actionClass !== "widget-add-action") return null;
    const kind = item.dataset?.widgetCreateKind || item.dataset?.widgetKind || "";
    if (!kind) return null;
    return widgetDefinitionFor(kind);
  };
  const objectAddItemLayer = (item = {}) => (
    normalizeWorkspaceWidgetLayer(
      item.layer ||
      item.dataset?.widgetLayer ||
      objectAddItemRuntimeDefinition(item)?.layer,
      "presentation"
    )
  );
  const objectAddItemEngineerOnly = (item = {}) => (
    Boolean(item.engineerOnly || objectAddItemRuntimeDefinition(item)?.engineerOnly || objectAddItemLayer(item) === "backend")
  );
  const objectAddSetDataset = (element, dataset = {}) => {
    Object.entries(dataset).forEach(([key, value]) => {
      if (value == null) return;
      element.dataset[key] = String(value);
    });
  };
  const suppressObjectAddBrowserTitles = (root) => {
    if (!root) return;
    const nodes = root.matches?.("[title]") ? [root] : [];
    root.querySelectorAll?.("[title]")?.forEach((node) => nodes.push(node));
    nodes.forEach((node) => {
      const title = node.getAttribute("title") || "";
      if (title && !node.getAttribute("aria-label") && !node.textContent?.trim()) {
        node.setAttribute("aria-label", title);
      }
      node.removeAttribute("title");
    });
  };
  const createObjectAddAction = (item, layoutKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `object-add-action glass-menu-item ${item.actionClass || ""}`.trim();
    button.textContent = item.displayName;
    if (item.actionClass === "panel-add-action" || item.actionClass === "divider-add-action") {
      button.dataset.layoutTarget = layoutKey;
    } else {
      button.dataset.widgetTarget = layoutKey;
    }
    button.dataset.objectAddCategory = item.category;
    if (item.subcategory) button.dataset.objectAddSubcategory = item.subcategory;
    const layer = objectAddItemLayer(item);
    if (item.actionClass === "widget-add-action" && layer) button.dataset.widgetLayer = layer;
    objectAddSetDataset(button, item.dataset);
    return button;
  };
  const createObjectAddSubmenu = (items, layoutKey) => {
    const submenu = document.createElement("div");
    submenu.className = "object-add-submenu glass-submenu-panel floating-glass-menu";
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
      trigger.className = "object-add-subcategory-trigger glass-menu-item";
      trigger.textContent = subcategory;
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-expanded", "false");
      const nested = document.createElement("div");
      nested.className = "object-add-submenu object-add-chart-submenu glass-submenu-panel floating-glass-menu";
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
    group.closest(".panel-add-menu")?.classList.toggle("submenu-active", Boolean(open || group.closest(".panel-add-menu")?.querySelector(".object-add-category.is-open, .object-add-subcategory.is-open")));
    group.querySelector(":scope > .object-add-category-trigger, :scope > .object-add-subcategory-trigger")
      ?.setAttribute("aria-expanded", String(Boolean(open)));
  };
  const updateObjectAddSubmenuPlacement = (group) => {
    const submenu = group?.querySelector?.(":scope > .object-add-submenu");
    if (!submenu) return;
    submenu.classList.remove("submenu-opens-left", "submenu-pin-bottom");
    submenu.style.removeProperty("--glass-submenu-max-height");
    const rect = submenu.getBoundingClientRect();
    const viewportPadding = 12;
    if (rect.right > window.innerWidth - viewportPadding) {
      submenu.classList.add("submenu-opens-left");
    }
    const nextRect = submenu.getBoundingClientRect();
    if (nextRect.bottom > window.innerHeight - viewportPadding) {
      submenu.classList.add("submenu-pin-bottom");
      submenu.style.setProperty("--glass-submenu-max-height", `${Math.max(120, window.innerHeight - viewportPadding - Math.max(viewportPadding, nextRect.top))}px`);
    }
  };
  const closeObjectAddSubmenus = (menu) => {
    if (!menu) return;
    const activeGroups = menu.querySelectorAll(".object-add-category.is-open, .object-add-subcategory.is-open");
    activeGroups.forEach((group) => setObjectAddSubmenuOpen(group, false));
  };
  const openObjectAddSubmenuBranch = (group) => {
    if (!group) return;
    group.parentElement?.querySelectorAll?.(":scope > .object-add-category.is-open, :scope > .object-add-subcategory.is-open")
      .forEach((openGroup) => {
        if (openGroup !== group) setObjectAddSubmenuOpen(openGroup, false);
      });
    setObjectAddSubmenuOpen(group, true);
    updateObjectAddSubmenuPlacement(group);
    window.requestAnimationFrame(() => updateObjectAddSubmenuPlacement(group));
  };
  const renderObjectAddMenus = () => {
    document.querySelectorAll(".panel-add-menu.menu-portaled").forEach((menu) => restoreFloatingMenu(menu));
    document.querySelectorAll(".panel-add-picker").forEach((picker) => {
      const layoutKey = picker.dataset.layoutTarget || "default";
      const browser = picker.querySelector(".object-add-browser");
      if (!browser) return;
      browser.replaceChildren();
      const availableItems = objectAddItems.filter((item) => !objectAddItemEngineerOnly(item) || isEngineerMode());
      objectAddCategories.forEach((category) => {
        const items = availableItems.filter((item) => item.category === category.id);
        if (!items.length) return;
        const group = document.createElement("div");
        group.className = "object-add-category";
        group.dataset.objectMenuCategory = category.id;
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "object-add-category-trigger glass-menu-item";
        trigger.textContent = category.label;
        trigger.setAttribute("aria-haspopup", "true");
        trigger.setAttribute("aria-expanded", "false");
        group.append(trigger, createObjectAddSubmenu(items, layoutKey));
        browser.appendChild(group);
      });
      suppressObjectAddBrowserTitles(browser);
    });
  };
  renderObjectAddMenus();

  document.querySelectorAll(".panel-add-picker").forEach((picker) => {
    const trigger = picker.querySelector(".panel-add-button");
    const menu = picker.querySelector(".panel-add-menu");
    let closeTimer;
    const syncMenuViewportSize = () => {
      if (!menu) return;
      const triggerRect = trigger?.getBoundingClientRect?.();
      const menuTop = triggerRect ? triggerRect.bottom + 8 : menu.getBoundingClientRect().top;
      const availableHeight = Math.max(160, Math.floor(window.innerHeight - menuTop - 12));
      menu.style.setProperty("--panel-add-menu-max-height", `${availableHeight}px`);
      const menuStyles = getComputedStyle(menu);
      const verticalPadding =
        (parseFloat(menuStyles.paddingTop) || 0) +
        (parseFloat(menuStyles.paddingBottom) || 0);
      const browserMaxHeight = Math.max(96, availableHeight - verticalPadding);
      menu.style.setProperty("--object-add-browser-max-height", `${browserMaxHeight}px`);
      const browser = menu.querySelector(".object-add-browser");
      menu.classList.toggle("menu-scroll", Boolean(browser && browser.scrollHeight > browserMaxHeight + 1));
    };
    const openMenu = () => {
      closeObjectAddSubmenus(menu);
      window.clearTimeout(closeTimer);
      syncMenuViewportSize();
      portalFloatingMenu(menu, trigger, { align: "left", offset: 8 });
      if (!menu?.classList.contains("open")) {
        menu?.classList.remove("open");
        void menu?.offsetHeight;
        window.requestAnimationFrame(() => {
          menu?.classList.add("open");
          requestAnimationFrame(() => {
            syncMenuViewportSize();
            positionPortaledMenu(menu, trigger, { align: "left", offset: 8 });
          });
        });
      }
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
      closeObjectAddSubmenus(menu);
      menu?.classList.remove("open");
      menu?.classList.remove("menu-scroll");
      menu?.classList.remove("submenu-active");
      const restoreAfterAnimation = () => {
        if (menu?.classList?.contains("open")) return;
        restoreFloatingMenu(menu);
      };
      if (menu?.classList.contains("menu-portaled")) {
        const duration = parseFloat(getComputedStyle(menu).transitionDuration || "0");
        if (duration > 0) {
          menu?.addEventListener("transitionend", restoreAfterAnimation, { once: true });
          return;
        }
      }
      restoreFloatingMenu(menu);
      trigger?.setAttribute("aria-expanded", "false");
    };
    window.addEventListener("resize", () => {
      if (menu?.classList.contains("open")) syncMenuViewportSize();
    });
    picker.addEventListener("mouseenter", openMenu);
    picker.addEventListener("mouseleave", scheduleClose);
    menu?.addEventListener("mouseenter", openMenu);
    menu?.addEventListener("mouseleave", scheduleClose);
    trigger?.addEventListener("focus", openMenu);
    trigger?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMenu();
    });
    menu?.addEventListener("pointerenter", (event) => {
      suppressObjectAddBrowserTitles(menu);
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
      if (picker.contains(event.target) || menu?.contains(event.target)) return;
      closeMenu();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  });

  const closeObjectAddMenu = (button) => {
    const menu = button?.closest?.(".panel-add-menu");
    const picker = button?.closest?.(".panel-add-picker") || originalMenuParent(menu);
    const trigger = picker?.querySelector?.(".panel-add-button");
    const activeMenu = menu || picker?.querySelector?.(".panel-add-menu");
    closeObjectAddSubmenus(activeMenu);
    activeMenu?.classList.remove("open");
    activeMenu?.classList.remove("menu-scroll", "submenu-active");
    restoreFloatingMenu(activeMenu);
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
      refreshEngineerOverlays();
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
      refreshEngineerOverlays();
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
      if (!layout) return;
      const selected = getActivePanelProfile(layoutKey);
      saveWidgetLayouts(layout, selected);
      const used = new Set(
        [...layout.querySelectorAll(":scope > .widget-card")]
          .map((widget) => widget.dataset.panelColor || widget.querySelector(".panel-color-toggle")?.dataset.defaultTheme)
          .filter(Boolean)
          .map((color) => color.toLowerCase())
      );
      const key = `widget-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const runtimeDefinition = widgetDefinitionFor(kind);
      const customCount = layout.querySelectorAll(':scope > .widget-card[data-custom-widget="true"]').length;
      const nextColor = runtimeDefinition.type === "dataset-origin"
        ? "#64748b"
        : (
          panelThemePresets.find((color) => !used.has(color.toLowerCase())) ||
          panelThemePresets[customCount % panelThemePresets.length]
        );
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
        widgetLayer: button.dataset.widgetLayer || runtimeDefinition.layer || "presentation",
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
      refreshEngineerOverlays();
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
    const focusedObject = event.target?.closest?.(".widget-layout > .widget-card, .panel-layout > .db-panel");
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
      captureLayoutUndo(layoutKey, profile);
      removeStore(dataSourcesKey(layoutKey, profile));
      removeStore(workspaceContextsKey(layoutKey, profile));
      removeStore(persistedWorkspaceKey(layoutKey, profile));
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
      showToast("Layout reset to default.");
      pushLiveLayoutUndo(layoutKey, profile);
    });
  });

});

void import("./liquid-glass-webgl.js");
