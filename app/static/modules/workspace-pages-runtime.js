const STORAGE_KEY = "dashboard-workspace-pages:builder";

const emptyPage = () => ({
  widgetHtml: "",
  panelHtml: "",
});

const normalizeStore = (value) => {
  const pages = value?.pages && typeof value.pages === "object" ? value.pages : {};
  return { pages: { ...pages } };
};

export const initializeWorkspacePagesRuntime = ({
  tabsRuntime,
  readJsonStore,
  writeJsonStore,
  storageKey = STORAGE_KEY,
  onPageMounted,
} = {}) => {
  const grid = document.querySelector(".dashboard-layout-grid[data-dashboard-layout-key='builder'], .dashboard-layout-grid");
  const widgetLayout = () => document.querySelector(".widget-layout[data-widget-layout-key='builder'], .widget-layout");
  const panelLayout = () => document.querySelector(".panel-layout[data-layout-key='builder'], .panel-layout");
  if (!grid || !tabsRuntime || !readJsonStore || !writeJsonStore) return null;

  let store = normalizeStore(readJsonStore(storageKey, null));
  let activeTabId = tabsRuntime.getState().tabs[tabsRuntime.getState().activeIndex]?.id || "tab-1";
  let switching = false;
  let skipBeforeUnloadPersist = false;

  grid.classList.add("workspace-page-surface");

  const save = () => writeJsonStore(storageKey, store);
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
  const serializeCurrentPage = () => ({
    widgetHtml: (restorePortaledToolDrawers(), cleanTransientMarkup(widgetLayout())),
    panelHtml: cleanTransientMarkup(panelLayout()),
  });
  const ensurePage = (tabId, page = null) => {
    if (!tabId) return;
    if (!store.pages[tabId]) {
      store.pages[tabId] = page || emptyPage();
      save();
    }
  };
  const persistActivePage = () => {
    ensurePage(activeTabId);
    store.pages[activeTabId] = serializeCurrentPage();
    save();
  };
  const mountPage = (tabId) => {
    ensurePage(tabId);
    const page = store.pages[tabId] || emptyPage();
    const widgets = widgetLayout();
    const panels = panelLayout();
    if (widgets) widgets.innerHTML = page.widgetHtml || "";
    if (panels) panels.innerHTML = page.panelHtml || "";
    grid.dataset.activeWorkspacePage = tabId;
    onPageMounted?.({ tabId });
  };
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const activatePage = ({ nextTab, direction = 1 } = {}) => {
    const nextTabId = nextTab?.id;
    if (!nextTabId || nextTabId === activeTabId || switching) return;
    persistActivePage();
    const finish = () => {
      mountPage(nextTabId);
      activeTabId = nextTabId;
      grid.style.setProperty("--workspace-page-enter-x", `${direction >= 0 ? 28 : -28}px`);
      grid.classList.remove("workspace-page-slide-out");
      grid.classList.add("workspace-page-slide-in");
      window.requestAnimationFrame(() => {
        grid.classList.remove("workspace-page-slide-in");
        switching = false;
      });
    };
    if (reducedMotion()) {
      mountPage(nextTabId);
      activeTabId = nextTabId;
      return;
    }
    switching = true;
    grid.style.setProperty("--workspace-page-exit-x", `${direction >= 0 ? -28 : 28}px`);
    grid.classList.add("workspace-page-slide-out");
    window.setTimeout(finish, 130);
  };

  const reconcileTabs = () => {
    const state = tabsRuntime.getState();
    state.tabs.forEach((tab, index) => {
      ensurePage(tab.id, index === 0 ? serializeCurrentPage() : emptyPage());
    });
    const validIds = new Set(state.tabs.map((tab) => tab.id));
    Object.keys(store.pages).forEach((id) => {
      if (!validIds.has(id)) delete store.pages[id];
    });
    save();
  };

  const initialState = tabsRuntime.getState();
  activeTabId = initialState.tabs[initialState.activeIndex]?.id || activeTabId;
  const hadStoredActivePage = Boolean(store.pages[activeTabId]);
  reconcileTabs();
  if (hadStoredActivePage || initialState.activeIndex > 0) mountPage(activeTabId);

  tabsRuntime.setCreateHandler(({ tab }) => ensurePage(tab.id, emptyPage()));
  tabsRuntime.setActivationHandler((event) => activatePage(event));
  window.addEventListener("beforeunload", () => {
    if (skipBeforeUnloadPersist) {
      skipBeforeUnloadPersist = false;
      return;
    }
    persistActivePage();
  });

  window.dashboardWorkspacePagesRuntime = {
    persistActivePage,
    skipNextBeforeUnloadPersist: () => {
      skipBeforeUnloadPersist = true;
    },
    activeTabId: () => activeTabId,
    pageIds: () => Object.keys(store.pages),
    pageForTab: (tabId) => store.pages[tabId] || null,
  };
  return window.dashboardWorkspacePagesRuntime;
};
