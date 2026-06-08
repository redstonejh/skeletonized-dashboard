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

  grid.classList.add("workspace-page-surface");

  const createDetachedPage = ({ widgetHtml = "", panelHtml = "" } = {}) => ({
    widgets: fragmentFromHtml(widgetHtml),
    panels: fragmentFromHtml(panelHtml),
    mounted: false,
    needsHydration: Boolean(widgetHtml || panelHtml),
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
    clone.querySelectorAll("[aria-expanded='true']").forEach((node) => node.setAttribute("aria-expanded", "false"));
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
      onPageMounted?.({ tabId });
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
  const activatePage = ({ nextTab, direction = 1 } = {}) => {
    const nextTabId = nextTab?.id;
    if (!nextTabId || nextTabId === activeTabId || switching) return;
    const finish = () => {
      switchToPage(nextTabId);
      const enterX = direction >= 0 ? 28 : -28;
      grid.style.setProperty("--workspace-page-enter-x", `${enterX}px`);
      grid.classList.remove("workspace-page-slide-out");
      grid.classList.add("workspace-page-slide-in");
      window.requestAnimationFrame(() => {
        grid.classList.remove("workspace-page-slide-in");
        switching = false;
      });
    };
    if (reducedMotion()) {
      switchToPage(nextTabId);
      return;
    }
    switching = true;
    const exitX = direction >= 0 ? -28 : 28;
    grid.style.setProperty("--workspace-page-exit-x", `${exitX}px`);
    grid.classList.add("workspace-page-slide-out");
    window.setTimeout(finish, 130);
  };

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
