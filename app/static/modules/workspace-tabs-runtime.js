import {
  panelToolButtonsMarkup,
  positionPanelColorMenu,
} from "./panel-appearance-runtime.js";

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
  initialState = null,
  persistTabs = true,
  onStateChange,
  onActivate,
  onCreateTab,
} = {}) => {
  const root = document.querySelector("[data-workspace-tabs]");
  if (!root || !readJsonStore || !writeJsonStore) return null;

  let state = normalizeState(initialState || readJsonStore(storageKey, null));
  let menu = null;
  let colorMenu = null;
  let invokingTab = null;
  let stateChangeHandler = typeof onStateChange === "function" ? onStateChange : null;
  let activationHandler = typeof onActivate === "function" ? onActivate : null;
  let createHandler = typeof onCreateTab === "function" ? onCreateTab : null;
  let mutationHandler = null;
  const undoStack = [];

  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Workspace tabs");

  const stateSnapshot = () => normalizeState({
    tabs: state.tabs.map((tab) => ({ ...tab })),
    activeIndex: state.activeIndex,
  });
  const save = () => {
    const snapshot = stateSnapshot();
    if (persistTabs) writeJsonStore(storageKey, snapshot);
    stateChangeHandler?.(snapshot);
  };
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
    const closingColorMenu = colorMenu;
    menu = null;
    colorMenu = null;
    if (closingMenu?.isConnected) {
      try {
        closingMenu.remove();
      } catch {}
    }
    if (closingColorMenu?.isConnected) {
      try {
        closingColorMenu.remove();
      } catch {}
    }
    invokingTab = null;
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

  const commitRename = (index, value, { renderTabs = true } = {}) => {
    pushUndo();
    const fallback = state.tabs[index]?.label || `tab ${index + 1}`;
    const nextLabel = cleanLabel(value, fallback);
    if (nextLabel === state.tabs[index]?.label) {
      undoStack.pop();
      return;
    }
    state.tabs[index] = {
      ...state.tabs[index],
      label: nextLabel,
    };
    save();
    notifyMutation("rename");
    if (renderTabs) render();
  };

  const openMenu = (index, button) => {
    closeMenu({ restoreFocus: false });
    invokingTab = button;
    menu = document.createElement("div");
    menu.className = "panel-tools workspace-tab-tools";
    menu.setAttribute("role", "menu");
    menu.dataset.tabIndex = String(index);
    menu.innerHTML = `
      <div class="panel-tool-drawer dashboard-tool-drawer-open workspace-tab-tool-drawer" aria-label="Tab tools">
        ${panelToolButtonsMarkup(state.tabs[index]?.color || "", true, { includeResize: false, includePin: false })}
      </div>`;
    const drawer = menu.querySelector(".panel-tool-drawer");
    const moveHandle = menu.querySelector(".panel-move-handle");
    const colorToggle = menu.querySelector(".panel-color-toggle");
    const titleButton = menu.querySelector(".panel-title-handle");
    const deleteButton = menu.querySelector(".panel-delete-handle");
    colorToggle?.setAttribute("aria-label", "Tab colors");
    colorToggle?.setAttribute("title", "Tab colors");
    titleButton?.setAttribute("aria-label", "Rename tab");
    titleButton?.setAttribute("title", "Rename tab");
    deleteButton?.setAttribute("aria-label", "Delete tab");
    deleteButton?.setAttribute("title", "Delete tab");
    const refreshColorMenuSelection = () => {
      const tab = state.tabs[Number(menu?.dataset.tabIndex) || 0];
      colorMenu?.querySelectorAll(".panel-color-swatch").forEach((swatch) => {
        const selected = cleanHex(swatch.dataset.color) === tab?.color;
        swatch.classList.toggle("is-selected", selected);
        swatch.setAttribute("aria-pressed", String(selected));
      });
    };
    const openColorMenu = () => {
      if (colorMenu?.isConnected) {
        colorMenu.classList.toggle("panel-color-menu-open");
        positionPanelColorMenu(colorToggle, colorMenu);
        return;
      }
      colorMenu = document.createElement("div");
      colorMenu.className = "panel-color-menu panel-color-menu-open";
      colorMenu.setAttribute("role", "menu");
      const group = document.createElement("div");
      group.className = "panel-color-group";
      const label = document.createElement("span");
      label.className = "panel-color-label";
      label.textContent = "Theme color";
      const swatches = document.createElement("div");
      swatches.className = "panel-color-swatches";
      panelThemePresets.forEach((color) => {
        const swatch = document.createElement("button");
        swatch.className = "panel-color-swatch";
        swatch.type = "button";
        swatch.dataset.color = color;
        swatch.style.setProperty("--swatch", color === "#ffffff" ? "#d1d5db" : color);
        swatch.setAttribute("aria-label", color);
        swatch.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const liveIndex = Number(menu?.dataset.tabIndex) || 0;
          const nextColor = cleanHex(color);
          if (state.tabs[liveIndex]?.color !== nextColor) {
            pushUndo();
            state.tabs[liveIndex] = { ...state.tabs[liveIndex], color: nextColor };
            save();
            notifyMutation("color");
            root.querySelector(`[data-tab-index="${liveIndex}"]`)?.style.setProperty("--tab-accent", nextColor);
          }
          refreshColorMenuSelection();
          colorToggle?.setAttribute("aria-expanded", "true");
          positionPanelColorMenu(colorToggle, colorMenu);
        });
        swatches.appendChild(swatch);
      });
      group.append(label, swatches);
      colorMenu.appendChild(group);
      colorMenu.addEventListener("click", (event) => event.stopPropagation());
      colorMenu.addEventListener("keydown", (event) => event.stopPropagation());
      document.body.appendChild(colorMenu);
      refreshColorMenuSelection();
      positionPanelColorMenu(colorToggle, colorMenu);
    };
    const beginTitleEdit = () => {
      const liveIndex = Number(menu?.dataset.tabIndex) || 0;
      const tabButton = root.querySelector(`[data-tab-index="${liveIndex}"]`);
      const label = tabButton?.querySelector(".workspace-tab-label");
      if (!label) return;
      const original = label.textContent.trim();
      label.contentEditable = "true";
      label.spellcheck = false;
      label.focus();
      window.getSelection?.()?.selectAllChildren(label);
      const finish = (commit) => {
        label.contentEditable = "false";
        label.removeEventListener("blur", onBlur);
        label.removeEventListener("keydown", onKeydown);
        const nextText = commit ? label.textContent : original;
        commitRename(liveIndex, nextText, { renderTabs: true });
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
    };
    const beginHorizontalMove = (event) => {
      event.preventDefault();
      event.stopPropagation();
      let liveIndex = Number(menu?.dataset.tabIndex) || index;
      const pointerId = event.pointerId;
      moveHandle?.setPointerCapture?.(pointerId);
      const onPointerMove = (moveEvent) => {
        const buttons = [...root.querySelectorAll(".workspace-tab")];
        const targetIndex = buttons.findIndex((tabButton) => {
          const rect = tabButton.getBoundingClientRect();
          return moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right;
        });
        if (targetIndex < 0 || targetIndex === liveIndex) return;
        moveTab(liveIndex, targetIndex - liveIndex);
        liveIndex = targetIndex;
        menu.dataset.tabIndex = String(liveIndex);
        invokingTab = root.querySelector(`[data-tab-index="${liveIndex}"]`);
        positionMenu(invokingTab);
      };
      const onPointerUp = () => {
        moveHandle?.releasePointerCapture?.(pointerId);
        window.removeEventListener("pointermove", onPointerMove, true);
        window.removeEventListener("pointerup", onPointerUp, true);
      };
      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerup", onPointerUp, true);
    };
    moveHandle?.addEventListener("pointerdown", beginHorizontalMove);
    colorToggle?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openColorMenu();
    });
    titleButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      beginTitleEdit();
    });
    deleteButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteTab(Number(menu?.dataset.tabIndex) || 0);
      closeMenu({ restoreFocus: false });
    });
    if (state.tabs.length <= 1) deleteButton?.setAttribute("disabled", "");
    drawer?.addEventListener("click", (event) => event.stopPropagation());
    document.body.appendChild(menu);
    positionMenu(button);
  };

  document.addEventListener("pointerdown", (event) => {
    if (!menu) return;
    if (menu.contains(event.target) || colorMenu?.contains(event.target) || root.contains(event.target)) return;
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
    setStateChangeHandler: (handler) => {
      stateChangeHandler = typeof handler === "function" ? handler : null;
    },
    activateTab,
    createTab,
    moveTab,
    deleteTab,
    undoLastTabChange,
  };
};
