const STORAGE_KEY = "dashboard-workspace-pages:builder";
const PERSIST_DEBOUNCE_MS = 350;

const emptyStoredPage = () => ({
  widgetHtml: "",
  panelHtml: "",
});

const normalizeStore = (value) => {
  const pages = value?.pages && typeof value.pages === "object" ? value.pages : {};
  return { tabs: value?.tabs || null, pages: { ...pages } };
};

const fragmentFromHtml = (html = "") => {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  return template.content;
};

const moveChildren = (from, to) => {
  if (!from || !to) return;
  while (from.firstChild) to.appendChild(from.firstChild);
};

const transitionDirection = (value, fallback = 1) => {
  const direction = Number(value);
  if (direction > 0) return 1;
  if (direction < 0) return -1;
  return fallback >= 0 ? 1 : -1;
};

const swipeDirectionFromDelta = (deltaX) => transitionDirection(-Number(deltaX), 1);

export const initializeWorkspacePagesRuntime = ({
  tabsRuntime,
  readJsonStore,
  writeJsonStore,
  storageKey = STORAGE_KEY,
  onPageMounted,
  onPageAttached,
  persistOnChange = false,
} = {}) => {
  const grid = document.querySelector(".dashboard-layout-grid[data-dashboard-layout-key='builder'], .dashboard-layout-grid");
  const widgetLayout = () => document.querySelector(".widget-layout[data-widget-layout-key='builder'], .widget-layout");
  const panelLayout = () => document.querySelector(".panel-layout[data-layout-key='builder'], .panel-layout");
  if (!grid || !tabsRuntime || !readJsonStore || !writeJsonStore) return null;

  const stored = normalizeStore(readJsonStore(storageKey, null));
  const pages = new Map();
  let activeTabId = tabsRuntime.getState().tabs[tabsRuntime.getState().activeIndex]?.id || "tab-1";
  let switching = false;
  let skipBeforeUnloadPersist = false;
  let persistTimer = null;
  let suppressPersistenceObserver = false;
  let swipeState = null;

  grid.classList.add("workspace-page-surface");

  const createDetachedPage = ({ widgetHtml = "", panelHtml = "" } = {}) => ({
    widgets: fragmentFromHtml(widgetHtml),
    panels: fragmentFromHtml(panelHtml),
    mounted: false,
    needsHydration: Boolean(widgetHtml || panelHtml),
    transitionPreview: null,
  });

  const ensurePage = (tabId, storedPage = null) => {
    if (!tabId) return null;
    if (!pages.has(tabId)) {
      pages.set(tabId, createDetachedPage(storedPage || emptyStoredPage()));
    }
    return pages.get(tabId);
  };

  const restorePortaledToolDrawers = () => {
    document.querySelectorAll(".db-panel, .widget-card").forEach((item) => {
      const drawer = item.__dashboardToolDrawer;
      if (!drawer || item.contains(drawer)) return;
      const tools = item.classList.contains("db-panel")
        ? item.querySelector(":scope > .db-panel-hd .panel-tools")
        : item.querySelector(":scope > .widget-tools");
      try {
        tools?.appendChild(drawer);
      } catch {}
    });
  };

  const cleanTransientMarkup = (root) => {
    const clone = root?.cloneNode?.(true);
    if (!clone) return "";
    const nodes = [clone, ...clone.querySelectorAll("*")];
    nodes.forEach((node) => {
      delete node.dataset.panelInitialized;
      delete node.dataset.widgetInitialized;
      node.classList?.remove(
        "db-panel-tools-open",
        "widget-tools-open",
        "db-panel-dragging",
        "widget-dragging",
        "dashboard-active-resize",
        "dashboard-resize-source",
        "group-selected",
        "group-transform-member",
      );
      node.removeAttribute?.("aria-selected");
    });
    clone.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
    clone.querySelectorAll(".panel-settings-toggle[aria-expanded='true'], .panel-color-toggle[aria-expanded='true'], .workspace-tab-menu-button[aria-expanded='true']")
      .forEach((node) => node.setAttribute("aria-expanded", "false"));
    return clone.innerHTML;
  };

  const serializeFragment = (fragment) => {
    const shell = document.createElement("div");
    fragment?.childNodes?.forEach((node) => shell.appendChild(node.cloneNode(true)));
    return cleanTransientMarkup(shell);
  };

  const serializePage = (tabId) => {
    const page = ensurePage(tabId);
    if (tabId === activeTabId && page?.mounted) {
      restorePortaledToolDrawers();
      return {
        widgetHtml: cleanTransientMarkup(widgetLayout()),
        panelHtml: cleanTransientMarkup(panelLayout()),
      };
    }
    if (page?.transitionPreview) {
      return {
        widgetHtml: cleanTransientMarkup(page.transitionPreview.widgets),
        panelHtml: cleanTransientMarkup(page.transitionPreview.panels),
      };
    }
    return {
      widgetHtml: serializeFragment(page?.widgets),
      panelHtml: serializeFragment(page?.panels),
    };
  };

  const serializeAllPages = () => {
    const state = tabsRuntime.getState();
    const nextPages = {};
    state.tabs.forEach((tab) => {
      ensurePage(tab.id);
      nextPages[tab.id] = serializePage(tab.id);
    });
    return { tabs: state, pages: nextPages };
  };

  const flushPersistAllPages = () => {
    if (persistTimer) {
      window.clearTimeout(persistTimer);
      persistTimer = null;
    }
    writeJsonStore(storageKey, serializeAllPages());
  };

  const schedulePersistAllPages = () => {
    if (!persistOnChange) return;
    if (suppressPersistenceObserver) return;
    if (persistTimer) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(flushPersistAllPages, PERSIST_DEBOUNCE_MS);
  };

  const parkActivePage = () => {
    const activeStillExists = tabsRuntime.getState().tabs.some((tab) => tab.id === activeTabId);
    if (!activeStillExists) {
      restorePortaledToolDrawers();
      const widgets = widgetLayout();
      const panels = panelLayout();
      if (widgets) widgets.textContent = "";
      if (panels) panels.textContent = "";
      return;
    }
    const page = ensurePage(activeTabId);
    restorePortaledToolDrawers();
    page.widgets.textContent = "";
    page.panels.textContent = "";
    moveChildren(widgetLayout(), page.widgets);
    moveChildren(panelLayout(), page.panels);
    page.mounted = false;
  };

  const attachPage = (tabId) => {
    const page = ensurePage(tabId);
    const widgets = widgetLayout();
    const panels = panelLayout();
    if (widgets) widgets.textContent = "";
    if (panels) panels.textContent = "";
    moveChildren(page.widgets, widgets);
    moveChildren(page.panels, panels);
    page.mounted = true;
    grid.dataset.activeWorkspacePage = tabId;
    activeTabId = tabId;
    if (page.needsHydration) {
      grid.dataset.workspacePageSnapshotHydrating = "true";
      try {
        onPageMounted?.({ tabId });
      } finally {
        delete grid.dataset.workspacePageSnapshotHydrating;
      }
      page.needsHydration = false;
    }
    onPageAttached?.({ tabId });
  };

  const switchToPage = (tabId) => {
    suppressPersistenceObserver = true;
    try {
      parkActivePage();
      attachPage(tabId);
    } finally {
      suppressPersistenceObserver = false;
    }
  };

  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const activatePage = ({ nextTab, direction = 1, instant = false } = {}) => {
    const nextTabId = nextTab?.id;
    const transitionSign = transitionDirection(direction);
    if (!nextTabId || nextTabId === activeTabId || (switching && !instant)) return;
    if (instant || reducedMotion()) {
      switchToPage(nextTabId);
      switching = false;
      return;
    }
    animateToPage(nextTabId, transitionSign);
  };

  const workspaceSwipeBlockSelector = [
    ".widget-card",
    ".db-panel",
    ".workspace-divider",
    ".app-nav",
    ".workspace-tab-bar",
    ".workspace-menu-overlay-layer",
    ".panel-tools",
    ".widget-tools",
    ".panel-color-menu",
    ".panel-add-menu",
    ".background-tone-popover",
    ".window-control-cluster",
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
    "[role='textbox']",
  ].join(", ");

  const isBareWorkspacePointer = (event) => {
    if (!event || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
    if (switching || swipeState) return false;
    if (event.target?.closest?.(workspaceSwipeBlockSelector)) return false;
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    return Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      y >= 0 &&
      x <= window.innerWidth &&
      y <= window.innerHeight;
  };

  const createSwipePreview = (tabId, direction) => {
    const page = ensurePage(tabId);
    if (!page) return null;
    const transitionSign = transitionDirection(direction);
    const preview = document.createElement("div");
    preview.className = "dashboard-layout-grid workspace-page-swipe-preview";
    preview.setAttribute("aria-hidden", "true");
    preview.dataset.swipeDirection = String(transitionSign);
    const widgets = document.createElement("div");
    widgets.className = "stat-band widget-layout";
    widgets.dataset.widgetLayoutKey = "builder";
    const panels = document.createElement("div");
    panels.className = "panel-layout";
    panels.dataset.layoutKey = "builder";
    moveChildren(page.widgets, widgets);
    moveChildren(page.panels, panels);
    preview.append(widgets, panels);
    const rect = grid.getBoundingClientRect();
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;
    preview.style.width = `${rect.width}px`;
    preview.style.minHeight = `${Math.max(rect.height, grid.scrollHeight || 0)}px`;
    document.body.appendChild(preview);
    const transitionPreview = { surface: preview, widgets, panels, tabId };
    page.transitionPreview = transitionPreview;
    if (page.needsHydration) {
      preview.dataset.workspacePageSnapshotHydrating = "true";
      try {
        onPageMounted?.({ tabId });
      } finally {
        delete preview.dataset.workspacePageSnapshotHydrating;
      }
      page.needsHydration = false;
    }
    return transitionPreview;
  };

  const clearSwipeStyles = (state = swipeState) => {
    grid.classList.remove("workspace-page-swipe-active");
    grid.style.removeProperty("transform");
    grid.style.removeProperty("transition");
    state?.preview?.surface?.remove();
    document.body.classList.remove("workspace-page-swipe-dragging");
    if (swipeState === state) swipeState = null;
  };

  const restorePreviewPage = (state) => {
    const preview = state?.preview;
    const page = preview ? ensurePage(preview.tabId) : null;
    if (!preview || !page) return;
    moveChildren(preview.widgets, page.widgets);
    moveChildren(preview.panels, page.panels);
    page.mounted = false;
    if (page.transitionPreview === preview) page.transitionPreview = null;
  };

  const commitPreviewPage = (state) => {
    const preview = state?.preview;
    const page = preview ? ensurePage(preview.tabId) : null;
    if (!preview || !page) return;
    suppressPersistenceObserver = true;
    try {
      parkActivePage();
      const widgets = widgetLayout();
      const panels = panelLayout();
      if (widgets) widgets.textContent = "";
      if (panels) panels.textContent = "";
      moveChildren(preview.widgets, widgets);
      moveChildren(preview.panels, panels);
      page.mounted = true;
      if (page.transitionPreview === preview) page.transitionPreview = null;
      grid.dataset.activeWorkspacePage = preview.tabId;
      activeTabId = preview.tabId;
    } finally {
      suppressPersistenceObserver = false;
    }
    onPageAttached?.({ tabId: preview.tabId });
  };

  const setSwipeOffset = (offset, state = swipeState) => {
    if (!state) return;
    const { width, preview } = state;
    const direction = transitionDirection(state.direction);
    const activeX = offset;
    const previewX = (direction > 0 ? width : -width) + offset;
    grid.style.transform = `translateX(${activeX}px)`;
    if (preview?.surface) preview.surface.style.transform = `translateX(${previewX}px)`;
    window.LiquidGlassWebGL?.markDirty?.();
  };

  const finishSwipe = ({ commit }) => {
    if (!swipeState) return;
    const state = swipeState;
    const direction = transitionDirection(state.direction);
    const targetX = commit ? -direction * state.width : 0;
    document.body.classList.remove("workspace-page-swipe-dragging");
    grid.style.transition = "transform 220ms cubic-bezier(.19, 1, .22, 1)";
    if (state.preview?.surface) {
      state.preview.surface.style.transition = "transform 220ms cubic-bezier(.19, 1, .22, 1)";
    }
    setSwipeOffset(targetX, state);
    const cleanup = () => {
      if (commit) {
        commitPreviewPage(state);
        tabsRuntime.activateTab(state.targetIndex, {
          source: "swipe",
          instant: true,
          direction: transitionDirection(state.direction),
        });
      } else {
        restorePreviewPage(state);
      }
      clearSwipeStyles(state);
      switching = false;
      window.LiquidGlassWebGL?.markDirty?.();
    };
    window.setTimeout(cleanup, 230);
  };

  const animateToPage = (nextTabId, direction) => {
    if (!nextTabId || switching) return;
    const transitionSign = transitionDirection(direction);
    const width = Math.max(1, grid.getBoundingClientRect().width || window.innerWidth || 1);
    const state = {
      width,
      direction: transitionSign,
      preview: createSwipePreview(nextTabId, transitionSign),
    };
    swipeState = state;
    switching = true;
    grid.classList.add("workspace-page-swipe-active");
    setSwipeOffset(0, state);
    window.requestAnimationFrame(() => {
      grid.style.transition = "transform 220ms cubic-bezier(.19, 1, .22, 1)";
      if (state.preview?.surface) {
        state.preview.surface.style.transition = "transform 220ms cubic-bezier(.19, 1, .22, 1)";
      }
      setSwipeOffset(-transitionSign * width, state);
    });
    window.setTimeout(() => {
      commitPreviewPage(state);
      clearSwipeStyles(state);
      switching = false;
      window.LiquidGlassWebGL?.markDirty?.();
    }, 240);
  };

  const beginWorkspaceSwipe = (event) => {
    if (!isBareWorkspacePointer(event)) return;
    window.getSelection?.()?.removeAllRanges?.();
    const startState = tabsRuntime.getState();
    const startIndex = startState.activeIndex;
    const startX = event.clientX;
    const startY = event.clientY;
    const startTime = performance.now();
    const pointerId = event.pointerId;
    let locked = false;
    let canceled = false;

    const cleanupListeners = () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
    };

    const cancelPending = () => {
      canceled = true;
      cleanupListeners();
    };

    const startLockedSwipe = (moveEvent, dx) => {
      const direction = swipeDirectionFromDelta(dx);
      const targetIndex = startIndex + direction;
      if (targetIndex < 0 || targetIndex >= startState.tabs.length) {
        const width = Math.max(1, grid.getBoundingClientRect().width || window.innerWidth || 1);
        swipeState = {
          pointerId,
          startX,
          startTime,
          width,
          direction,
          targetIndex: startIndex,
          preview: null,
          edge: true,
        };
      } else {
        const width = Math.max(1, grid.getBoundingClientRect().width || window.innerWidth || 1);
        swipeState = {
          pointerId,
          startX,
          startTime,
          width,
          direction,
          targetIndex,
          preview: createSwipePreview(startState.tabs[targetIndex]?.id, direction),
          edge: false,
        };
      }
      locked = true;
      switching = true;
      document.body.classList.add("workspace-page-swipe-dragging");
      grid.classList.add("workspace-page-swipe-active");
      try {
        grid.setPointerCapture?.(pointerId);
      } catch {}
      window.getSelection?.()?.removeAllRanges?.();
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
    };

    function onPointerMove(moveEvent) {
      if (canceled || moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          cancelPending();
          return;
        }
        startLockedSwipe(moveEvent, dx);
      }
      if (!swipeState) return;
      const rawOffset = moveEvent.clientX - startX;
      const directionalOffset = swipeState.direction > 0 ? Math.min(0, rawOffset) : Math.max(0, rawOffset);
      const offset = swipeState.edge ? directionalOffset * 0.28 : directionalOffset;
      setSwipeOffset(offset);
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
    }

    function onPointerUp(upEvent) {
      if (upEvent.pointerId !== pointerId) return;
      cleanupListeners();
      if (!locked || !swipeState) return;
      const dx = upEvent.clientX - startX;
      const elapsed = Math.max(1, performance.now() - startTime);
      const velocity = dx / elapsed;
      const progress = Math.min(1, Math.abs(dx) / swipeState.width);
      const directionMatches = swipeState.direction > 0 ? dx < 0 : dx > 0;
      const commit = !swipeState.edge && directionMatches && (progress > 0.32 || Math.abs(velocity) > 0.55);
      finishSwipe({ commit });
      upEvent.preventDefault();
      upEvent.stopPropagation();
    }

    function onPointerCancel(cancelEvent) {
      if (cancelEvent.pointerId !== pointerId) return;
      cleanupListeners();
      if (swipeState) finishSwipe({ commit: false });
    }

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
  };

  document.addEventListener("pointerdown", beginWorkspaceSwipe, true);

  const reconcileTabs = () => {
    const state = tabsRuntime.getState();
    state.tabs.forEach((tab) => ensurePage(tab.id, stored.pages[tab.id] || emptyStoredPage()));
    const validIds = new Set(state.tabs.map((tab) => tab.id));
    [...pages.keys()].forEach((id) => {
      if (!validIds.has(id)) pages.delete(id);
    });
    schedulePersistAllPages();
  };

  const reconcileAfterTabMutation = () => {
    reconcileTabs();
  };

  const observeActiveLayouts = () => {
    const observer = new MutationObserver(schedulePersistAllPages);
    const config = {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    };
    const widgets = widgetLayout();
    const panels = panelLayout();
    if (widgets) observer.observe(widgets, config);
    if (panels) observer.observe(panels, config);
  };

  const initialState = tabsRuntime.getState();
  activeTabId = initialState.tabs[initialState.activeIndex]?.id || activeTabId;
  initialState.tabs.forEach((tab) => ensurePage(tab.id, stored.pages[tab.id] || emptyStoredPage()));
  const activeStoredPage = stored.pages[activeTabId];
  if (activeStoredPage || initialState.activeIndex > 0) {
    attachPage(activeTabId);
  } else {
    const page = ensurePage(activeTabId);
    page.mounted = true;
    page.needsHydration = false;
    grid.dataset.activeWorkspacePage = activeTabId;
  }
  reconcileTabs();
  observeActiveLayouts();

  tabsRuntime.setCreateHandler(({ tab }) => {
    ensurePage(tab.id, emptyStoredPage());
    schedulePersistAllPages();
  });
  tabsRuntime.setActivationHandler((event) => activatePage(event));
  tabsRuntime.setMutationHandler(reconcileAfterTabMutation);
  tabsRuntime.setStateChangeHandler?.(schedulePersistAllPages);
  if (persistOnChange) {
    window.addEventListener("beforeunload", () => {
      if (skipBeforeUnloadPersist) {
        skipBeforeUnloadPersist = false;
        return;
      }
      flushPersistAllPages();
    });
  }

  window.dashboardWorkspacePagesRuntime = {
    persistAllPages: flushPersistAllPages,
    schedulePersistAllPages,
    skipNextBeforeUnloadPersist: () => {
      skipBeforeUnloadPersist = true;
    },
    activeTabId: () => activeTabId,
    pageIds: () => [...pages.keys()],
    pageForTab: (tabId) => {
      const page = pages.get(tabId);
      if (!page) return null;
      return {
        mounted: page.mounted,
        needsHydration: page.needsHydration,
        widgetCount: tabId === activeTabId && page.mounted
          ? widgetLayout()?.children?.length || 0
          : page.widgets.children.length,
        panelCount: tabId === activeTabId && page.mounted
          ? panelLayout()?.children?.length || 0
          : page.panels.children.length,
      };
    },
  };
  return window.dashboardWorkspacePagesRuntime;
};
