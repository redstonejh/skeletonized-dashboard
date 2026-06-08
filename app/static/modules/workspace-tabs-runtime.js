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
  while (tabs.length < 1) {
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
  let mutationHandler = null;
  const undoStack = [];

  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Workspace tabs");

  const save = () => writeJsonStore(storageKey, state);
  const stateSnapshot = () => normalizeState({
    tabs: state.tabs.map((tab) => ({ ...tab })),
    activeIndex: state.activeIndex,
  });
  const pushUndo = () => {
    undoStack.push(stateSnapshot());
    if (undoStack.length > 40) undoStack.shift();
  };
  const notifyMutation = (type, detail = {}) => {
    mutationHandler?.({ type, state: normalizeState(state), ...detail });
  };
  const applyState = (nextState, { type = "update", direction = 0 } = {}) => {
    const previousState = stateSnapshot();
    const previousIndex = previousState.activeIndex;
    const previousTab = previousState.tabs[previousIndex] || null;
    state = normalizeState(nextState);
    save();
    const nextTab = state.tabs[state.activeIndex] || null;
    if (previousTab?.id !== nextTab?.id) {
      activationHandler?.({
        previousIndex,
        nextIndex: state.activeIndex,
        previousTab,
        nextTab,
        direction: direction || (state.activeIndex > previousIndex ? 1 : -1),
        state: normalizeState(state),
      });
    }
    notifyMutation(type, { previousState });
    render();
  };

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
    pushUndo();
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

  const moveTab = (index, direction) => {
    const nextIndex = Math.max(0, Math.min(state.tabs.length - 1, index + direction));
    if (nextIndex === index) return;
    pushUndo();
    const tabs = [...state.tabs];
    const [tab] = tabs.splice(index, 1);
    tabs.splice(nextIndex, 0, tab);
    const activeTab = state.tabs[state.activeIndex];
    const activeIndex = Math.max(0, tabs.findIndex((item) => item.id === activeTab?.id));
    applyState({ tabs, activeIndex }, { type: "move", direction });
  };

  const deleteTab = (index) => {
    if (state.tabs.length <= 1) return;
    pushUndo();
    const tabs = state.tabs.filter((_, tabIndex) => tabIndex !== index);
    const activeIndex = Math.max(0, Math.min(tabs.length - 1, index <= state.activeIndex ? state.activeIndex - 1 : state.activeIndex));
    applyState({ tabs, activeIndex }, { type: "delete", direction: index <= state.activeIndex ? -1 : 0 });
  };

  const undoLastTabChange = () => {
    const previous = undoStack.pop();
    if (!previous) return false;
    applyState(previous, { type: "undo" });
    return true;
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
  };

  const commitRename = (index, input, { renderTabs = true } = {}) => {
    pushUndo();
    const fallback = state.tabs[index]?.label || `tab ${index + 1}`;
    state.tabs[index] = {
      ...state.tabs[index],
      label: cleanLabel(input.value, fallback),
    };
    save();
    notifyMutation("rename");
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

    const moveGroup = document.createElement("div");
    moveGroup.className = "workspace-tab-menu-group workspace-tab-move-group";
    const moveLabel = document.createElement("span");
    moveLabel.className = "panel-color-label";
    moveLabel.textContent = "Move";
    const moveControls = document.createElement("div");
    moveControls.className = "workspace-tab-menu-actions";
    const leftButton = document.createElement("button");
    leftButton.type = "button";
    leftButton.className = "panel-tool-button workspace-tab-menu-action workspace-tab-move-left";
    leftButton.setAttribute("aria-label", "Move tab left");
    leftButton.disabled = index <= 0;
    leftButton.textContent = "Left";
    const rightButton = document.createElement("button");
    rightButton.type = "button";
    rightButton.className = "panel-tool-button workspace-tab-menu-action workspace-tab-move-right";
    rightButton.setAttribute("aria-label", "Move tab right");
    rightButton.disabled = index >= state.tabs.length - 1;
    rightButton.textContent = "Right";
    leftButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveTab(index, -1);
      closeMenu({ restoreFocus: false });
    });
    rightButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveTab(index, 1);
      closeMenu({ restoreFocus: false });
    });
    moveControls.append(leftButton, rightButton);
    moveGroup.append(moveLabel, moveControls);

    const renameGroup = document.createElement("div");
    renameGroup.className = "workspace-tab-menu-group";
    const renameLabel = document.createElement("label");
    renameLabel.className = "panel-color-label";
    renameLabel.textContent = "Text";
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
        pushUndo();
        const nextColor = cleanHex(color);
        state.tabs[index] = { ...state.tabs[index], color: nextColor };
        save();
        notifyMutation("color");
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
    const deleteGroup = document.createElement("div");
    deleteGroup.className = "workspace-tab-menu-group workspace-tab-delete-group";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "panel-tool-button workspace-tab-menu-action workspace-tab-delete-action";
    deleteButton.textContent = "Delete";
    deleteButton.disabled = state.tabs.length <= 1;
    deleteButton.setAttribute("aria-label", "Delete tab");
    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteTab(index);
      closeMenu({ restoreFocus: false });
    });
    deleteGroup.appendChild(deleteButton);
    menu.append(moveGroup, colorGroup, renameGroup, deleteGroup);
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
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (event.key.toLowerCase() !== "z") return;
    if (event.target?.closest?.("input, textarea, select, [contenteditable='true'], [role='textbox']")) return;
    if (!undoLastTabChange()) return;
    event.preventDefault();
    event.stopPropagation();
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
    setMutationHandler: (handler) => {
      mutationHandler = typeof handler === "function" ? handler : null;
    },
    activateTab,
    createTab,
    moveTab,
    deleteTab,
    undoLastTabChange,
  };
};
