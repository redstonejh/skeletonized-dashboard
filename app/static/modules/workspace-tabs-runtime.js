const STORAGE_KEY = "dashboard-workspace-tabs:builder";

const DEFAULT_TABS = Object.freeze([
  { id: "tab-1", label: "tab 1", color: "#edf2f8" },
  { id: "tab-2", label: "tab 2", color: "#dbe7f3" },
  { id: "tab-3", label: "tab 3", color: "#ded8cf" },
]);

const cleanHex = (value, fallback = "#edf2f8") => {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
};

const cleanLabel = (value, fallback) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, 32);
};

const normalizeState = (value) => {
  const sourceTabs = Array.isArray(value?.tabs) ? value.tabs : DEFAULT_TABS;
  const tabs = sourceTabs.map((tab, index) => ({
    id: String(tab?.id || DEFAULT_TABS[index]?.id || `tab-${index + 1}`).replace(/[^a-z0-9_-]/gi, "") || `tab-${index + 1}`,
    label: cleanLabel(tab?.label, DEFAULT_TABS[index]?.label || `tab ${index + 1}`),
    color: cleanHex(tab?.color, DEFAULT_TABS[index]?.color || "#edf2f8"),
  }));
  while (tabs.length < 3) {
    const fallback = DEFAULT_TABS[tabs.length];
    tabs.push({ id: fallback.id, label: fallback.label, color: fallback.color });
  }
  const activeIndex = Math.max(0, Math.min(tabs.length - 1, Number(value?.activeIndex) || 0));
  return { tabs, activeIndex };
};

export const initializeWorkspaceTabsRuntime = ({
  readJsonStore,
  writeJsonStore,
  panelThemePresets,
  storageKey = STORAGE_KEY,
  onActivate,
  onCreateTab,
} = {}) => {
  const root = document.querySelector("[data-workspace-tabs]");
  if (!root || !readJsonStore || !writeJsonStore) return null;

  let state = normalizeState(readJsonStore(storageKey, null));
  let menu = null;
  let editingIndex = -1;
  let invokingTab = null;
  let menuActionInProgress = false;
  let activationHandler = typeof onActivate === "function" ? onActivate : null;
  let createHandler = typeof onCreateTab === "function" ? onCreateTab : null;

  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Workspace tabs");

  const save = () => writeJsonStore(storageKey, state);

  const closeMenu = ({ restoreFocus = true } = {}) => {
    const focusTarget = invokingTab;
    const closingMenu = menu;
    menu = null;
    if (closingMenu?.isConnected) {
      try {
        closingMenu.remove();
      } catch {}
    }
    editingIndex = -1;
    invokingTab = null;
    menuActionInProgress = false;
    if (restoreFocus) focusTarget?.focus?.({ preventScroll: true });
  };

  const positionMenu = (button) => {
    if (!menu || !button) return;
    const rect = button.getBoundingClientRect();
    const width = menu.offsetWidth || 248;
    const gutter = 12;
    const left = Math.max(gutter, Math.min(window.innerWidth - width - gutter, rect.left));
    const top = Math.max(gutter, rect.bottom + 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  const activateTab = (index) => {
    if (index === state.activeIndex) return;
    const previousIndex = state.activeIndex;
    const previousTab = state.tabs[previousIndex] || null;
    const nextTab = state.tabs[index] || null;
    state = { ...state, activeIndex: index };
    save();
    activationHandler?.({
      previousIndex,
      nextIndex: index,
      previousTab,
      nextTab,
      direction: index > previousIndex ? 1 : -1,
      state: normalizeState(state),
    });
    render();
  };

  const createTab = () => {
    const nextNumber = state.tabs.length + 1;
    const tab = {
      id: `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      label: `tab ${nextNumber}`,
      color: DEFAULT_TABS[(nextNumber - 1) % DEFAULT_TABS.length]?.color || "#edf2f8",
    };
    const previousIndex = state.activeIndex;
    state = { tabs: [...state.tabs, tab], activeIndex: state.tabs.length };
    save();
    createHandler?.({ tab, index: state.activeIndex, previousIndex, state: normalizeState(state) });
    activationHandler?.({
      previousIndex,
      nextIndex: state.activeIndex,
      previousTab: state.tabs[previousIndex] || null,
      nextTab: tab,
      direction: 1,
      state: normalizeState(state),
    });
    render();
  };

  const render = () => {
    root.innerHTML = "";
    root.style.setProperty("--workspace-tab-count", String(state.tabs.length));
    state.tabs.forEach((tab, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-tab";
      button.dataset.tabIndex = String(index);
      button.id = `workspace-tab-${tab.id}`;
      button.setAttribute("aria-pressed", String(index === state.activeIndex));
      button.setAttribute("tabindex", index === state.activeIndex ? "0" : "-1");
      button.style.setProperty("--tab-accent", tab.color);
      button.dataset.tabLabel = tab.label;
      button.title = tab.label;
      const label = document.createElement("span");
      label.className = "workspace-tab-label";
      label.textContent = tab.label;
      button.appendChild(label);
      button.addEventListener("click", () => {
        activateTab(index);
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openMenu(index, button);
      });
      button.addEventListener("keydown", (event) => {
        const last = state.tabs.length - 1;
        const nextIndex = event.key === "ArrowRight"
          ? Math.min(last, index + 1)
          : event.key === "ArrowLeft"
            ? Math.max(0, index - 1)
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? last
                : index;
        if (nextIndex !== index) {
          event.preventDefault();
          activateTab(nextIndex);
          root.querySelector(`[data-tab-index="${nextIndex}"]`)?.focus({ preventScroll: true });
          return;
        }
        if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
          event.preventDefault();
          openMenu(index, button);
        }
      });
      root.appendChild(button);
    });
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "workspace-tab workspace-tab-add";
    addButton.setAttribute("aria-label", "Add workspace page");
    addButton.title = "Add workspace page";
    addButton.dataset.tabLabel = "+";
    const addLabel = document.createElement("span");
    addLabel.className = "workspace-tab-label";
    addLabel.textContent = "+";
    addButton.appendChild(addLabel);
    addButton.addEventListener("click", createTab);
    root.appendChild(addButton);
  };

  const commitRename = (index, input, { renderTabs = true } = {}) => {
    const fallback = state.tabs[index]?.label || `tab ${index + 1}`;
    state.tabs[index] = {
      ...state.tabs[index],
      label: cleanLabel(input.value, fallback),
    };
    save();
    if (renderTabs) render();
  };

  const openMenu = (index, button) => {
    closeMenu({ restoreFocus: false });
    editingIndex = index;
    invokingTab = button;
    const tab = state.tabs[index];
    menu = document.createElement("div");
    menu.className = "workspace-tab-menu panel-color-menu panel-color-menu-open";
    menu.setAttribute("role", "menu");
    menu.dataset.tabIndex = String(index);

    const renameGroup = document.createElement("div");
    renameGroup.className = "workspace-tab-menu-group";
    const renameLabel = document.createElement("label");
    renameLabel.className = "panel-color-label";
    renameLabel.textContent = "Rename tab";
    const input = document.createElement("input");
    input.className = "workspace-tab-rename-input";
    input.type = "text";
    input.maxLength = 32;
    input.value = tab.label;
    input.setAttribute("aria-label", "Rename tab");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitRename(index, input, { renderTabs: false });
        closeMenu();
        render();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    });
    input.addEventListener("blur", (event) => {
      if (event.relatedTarget && menu?.contains(event.relatedTarget)) return;
      if (menuActionInProgress) return;
      if (editingIndex === index && menu?.isConnected) {
        commitRename(index, input, { renderTabs: false });
        closeMenu({ restoreFocus: false });
        render();
      }
    });
    renameGroup.append(renameLabel, input);

    const colorGroup = document.createElement("div");
    colorGroup.className = "panel-color-group";
    const colorLabel = document.createElement("span");
    colorLabel.className = "panel-color-label";
    colorLabel.textContent = "Tab color";
    const swatches = document.createElement("div");
    swatches.className = "panel-color-swatches";
    panelThemePresets.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "panel-color-swatch";
      swatch.dataset.color = color;
      swatch.style.setProperty("--swatch", color);
      swatch.setAttribute("role", "menuitemradio");
      swatch.setAttribute("aria-label", `Set tab color ${color}`);
      swatch.setAttribute("aria-checked", String(cleanHex(color) === tab.color));
      swatch.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextColor = cleanHex(color);
        state.tabs[index] = { ...state.tabs[index], color: nextColor };
        save();
        render();
        invokingTab = root.querySelector(`[data-tab-index="${index}"]`);
        menu?.querySelectorAll(".panel-color-swatch").forEach((item) => {
          item.setAttribute("aria-checked", String(cleanHex(item.dataset.color) === nextColor));
        });
        menuActionInProgress = false;
      });
      swatches.appendChild(swatch);
    });
    colorGroup.append(colorLabel, swatches);
    menu.append(renameGroup, colorGroup);
    menu.addEventListener("pointerdown", (event) => {
      menuActionInProgress = !event.target?.closest?.(".workspace-tab-rename-input");
      if (menuActionInProgress) event.preventDefault();
    });
    document.body.appendChild(menu);
    positionMenu(button);
    requestAnimationFrame(() => input.select());
  };

  document.addEventListener("pointerdown", (event) => {
    if (!menu) return;
    if (menu.contains(event.target) || root.contains(event.target)) return;
    closeMenu();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  }, true);
  window.addEventListener("resize", () => {
    if (!menu) return;
    const button = root.querySelector(`[data-tab-index="${menu.dataset.tabIndex}"]`);
    positionMenu(button);
  });

  render();
  return {
    getState: () => normalizeState(state),
    setState: (nextState) => {
      state = normalizeState(nextState);
      save();
      render();
    },
    setActivationHandler: (handler) => {
      activationHandler = typeof handler === "function" ? handler : null;
    },
    setCreateHandler: (handler) => {
      createHandler = typeof handler === "function" ? handler : null;
    },
    activateTab,
    createTab,
  };
};
