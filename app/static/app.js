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
  const showToast = showGlobalToast;
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

  document.querySelectorAll(".workspace-mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.workspaceMode || "";
      const className = mode === "engineer" ? "engineer-mode-active" : mode === "context" ? "context-view-active" : "";
      if (!className) return;
      const enabled = !document.body.classList.contains(className);
      document.body.classList.toggle(className, enabled);
      button.setAttribute("aria-pressed", enabled.toString());
      showToast(`${button.textContent.trim()} ${enabled ? "enabled" : "disabled"}.`);
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
  const layoutUndoPrefix = "dashboard-layout-undo:";
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
  const layoutUndoKey = (layoutKey, profile = getActivePanelProfile(layoutKey)) => `${layoutUndoPrefix}${profile}:${layoutKey}`;
  let layoutUndoCaptureLock = false;
  const layoutScopedPrefixes = (layoutKey, profile = getActivePanelProfile(layoutKey)) => [
    `${panelStoragePrefix}${profile}:${layoutKey}:`,
    `${customPanelsPrefix}${profile}:${layoutKey}`,
    `${hiddenPanelsPrefix}${profile}:${layoutKey}`,
    `${widgetStoragePrefix}${profile}:${layoutKey}:`,
    `${customWidgetsPrefix}${profile}:${layoutKey}`,
    `${hiddenWidgetsPrefix}${profile}:${layoutKey}`,
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
  const syncLayoutToolsActive = () => {
    const hasOpenTools = Boolean(document.querySelector(".db-panel-tools-open, .widget-tools-open"));
    document.body.classList.toggle("layout-tools-active", hasOpenTools);
  };
  const isDashboardInteractionActive = () => (
    document.body.classList.contains("panel-interaction-active") ||
    document.body.classList.contains("panel-resize-active")
  );
  const isInteractionSource = (item) => Boolean(item?.classList?.contains("widget-dragging") ||
    item?.classList?.contains("db-panel-dragging") ||
    item?.classList?.contains("dashboard-active-resize"));
  const canOpenDashboardTools = (item) => !isDashboardInteractionActive() || isInteractionSource(item);
  const closeInactiveDashboardTools = (activeItem = null) => {
    document.querySelectorAll(".widget-tools-open, .db-panel-tools-open").forEach((item) => {
      if (item === activeItem) return;
      item.classList.remove("widget-tools-open", "db-panel-tools-open");
      item.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "false");
      item.querySelector(".panel-color-toggle")?.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
    syncLayoutToolsActive();
  };
  const isDashboardToolInteractionTarget = (event) =>
    Boolean(event?.target?.closest?.(".panel-tool-drawer, .panel-settings-toggle"));
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
  ];
  const sanitizeLayoutElementForUndo = (element) => {
    const clone = element.cloneNode(true);
    clone.classList.remove(...undoTransientItemClasses);
    clone.removeAttribute("aria-selected");
    clone.style.removeProperty("left");
    clone.style.removeProperty("top");
    clone.style.removeProperty("width");
    clone.querySelectorAll(".panel-settings-toggle, .panel-color-toggle").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
    clone.querySelectorAll(".panel-color-menu-open").forEach((menu) => menu.classList.remove("panel-color-menu-open"));
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
    profile,
  });
  const liveLayoutUndoSignature = (snapshot) => JSON.stringify({
    panels: snapshot.panels,
    widgets: snapshot.widgets,
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
    return true;
  };
  const cleanupDashboardUndoArtifacts = () => {
    document.querySelectorAll(
      ".dashboard-live-resize, .dashboard-resize-preview, .dashboard-expanded-footprint-ghost, .dashboard-group-boundary, .dashboard-group-member-preview, .widget-placeholder, .db-panel-placeholder"
    ).forEach((node) => node.remove());
    document.body.classList.remove(
      "panel-interaction-active",
      "panel-resize-active",
      "group-transform-active",
      "dashboard-auto-scroll-active",
      "dashboard-interaction-scroll-extended"
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
      cleanupDashboardUndoArtifacts();
      stack.pop();
      const undo = stack[stack.length - 1];
      undo.widgets.forEach((snapshot) => {
        const layout = document.querySelector(snapshot.selector);
        if (!layout) return;
        layout.dataset.hiddenWidgetsDraft = snapshot.hiddenDraft;
        restoreLayoutItems(layout, snapshot.items, layout.__initWidget);
        cleanupWidgetRowBreaks(layout);
      });
      undo.panels.forEach((snapshot) => {
        const layout = document.querySelector(snapshot.selector);
        if (!layout) return;
        layout.dataset.hiddenPanelsDraft = snapshot.hiddenDraft;
        restoreLayoutItems(layout, snapshot.items, layout.__initPanel);
        cleanupPanelRowBreaks(layout);
      });
      restoreGroupSelection();
      liveLayoutUndo.set(liveKey, stack);
      syncLayoutToolsActive();
      cleanupDashboardUndoArtifacts();
      return true;
    }
    return false;
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
  const requestPanelDelete = ({ panel, layout, layoutKey, title, panels = null }) => {
    const targets = panels?.length ? panels : [panel];
    pendingPanelDelete = { type: "panel", panel, panels: targets, layout, layoutKey, title };
    if (panelDeleteMessage) {
      panelDeleteMessage.textContent = targets.length > 1
        ? `Are you sure you want to delete ${targets.length} selected panels?`
        : `Are you sure you want to delete "${title}" panel?`;
    }
    if (typeof panelDeleteDialog?.showModal === "function") {
      panelDeleteDialog.showModal();
    } else if (window.confirm(targets.length > 1 ? `Are you sure you want to delete ${targets.length} selected panels?` : `Are you sure you want to delete "${title}" panel?`)) {
      panelDeleteConfirm?.click();
    }
  };
  const requestWidgetDelete = ({ widget, layout, layoutKey, title, widgets = null }) => {
    const targets = widgets?.length ? widgets : [widget];
    pendingPanelDelete = { type: "widget", widget, widgets: targets, layout, layoutKey, title };
    if (panelDeleteMessage) {
      panelDeleteMessage.textContent = targets.length > 1
        ? `Are you sure you want to delete ${targets.length} selected widgets?`
        : `Are you sure you want to delete "${title}" widget?`;
    }
    if (typeof panelDeleteDialog?.showModal === "function") {
      panelDeleteDialog.showModal();
    } else if (window.confirm(targets.length > 1 ? `Are you sure you want to delete ${targets.length} selected widgets?` : `Are you sure you want to delete "${title}" widget?`)) {
      panelDeleteConfirm?.click();
    }
  };
  panelDeleteCancel?.addEventListener("click", closePanelDeleteDialog);
  panelDeleteClose?.addEventListener("click", closePanelDeleteDialog);
  panelDeleteDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePanelDeleteDialog();
  });
  panelDeleteConfirm?.addEventListener("click", () => {
    if (!pendingPanelDelete) return;
    const { layout, title, type } = pendingPanelDelete;
    const targets = type === "widget"
      ? (pendingPanelDelete.widgets?.length ? pendingPanelDelete.widgets : [pendingPanelDelete.widget])
      : (pendingPanelDelete.panels?.length ? pendingPanelDelete.panels : [pendingPanelDelete.panel]);
    const hiddenKey = type === "widget" ? "hiddenWidgetsDraft" : "hiddenPanelsDraft";
    const customKey = type === "widget" ? "customWidget" : "customPanel";
    const itemKey = type === "widget" ? "widgetKey" : "panelKey";
    const hidden = readDraftList(layout, hiddenKey);
    targets.forEach((target) => {
      const key = target.dataset[itemKey];
      if (!target.dataset[customKey] && !hidden.includes(key)) hidden.push(key);
      groupSelection.delete(target);
      target.classList.remove("group-selected");
      groupSelectedIds.delete(groupItemId(target));
      if (target.dataset[customKey]) {
        target.remove();
      } else {
        target.hidden = true;
      }
    });
    if (targets.some((target) => !target.dataset[customKey])) writeDraftList(layout, hiddenKey, hidden);
    if (type === "widget") {
      cleanupWidgetRowBreaks(layout);
      saveWidgetLayouts(layout);
    } else {
      cleanupPanelRowBreaks(layout);
      savePanelLayouts(layout);
    }
    showToast(targets.length > 1
      ? `${targets.length} ${type === "widget" ? "widgets" : "panels"} deleted.`
      : `${title} ${type === "widget" ? "widget" : "panel"} deleted.`);
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

  const gridHostForLayout = (layout) => layout?.closest?.(".dashboard-layout-grid") || layout;

  const gridRectForLayout = (layout) => {
    const host = gridHostForLayout(layout);
    return (host || layout).getBoundingClientRect();
  };

  const gridGapForLayout = (layout) => {
    if (!layout) return 16;
    const host = gridHostForLayout(layout);
    const computed = window.getComputedStyle(host || layout);
    const rawGap = computed.rowGap || computed.gap || (layout.classList.contains("widget-layout") ? "12px" : "16px");
    const gap = parseFloat(rawGap);
    return Number.isFinite(gap) ? gap : (layout.classList.contains("widget-layout") ? 12 : 16);
  };

  const gridHeightForRows = (rows, gap) => {
    const safeRows = Math.max(1, Math.round(Number(rows) || 1));
    return (safeRows * DASHBOARD_GRID_ROW_HEIGHT) + (Math.max(0, safeRows - 1) * gap);
  };

  const gridRowsFromHeight = (height, gap, minRows = 1) => {
    const safeHeight = Math.max(1, Number(height) || DASHBOARD_GRID_ROW_HEIGHT);
    return Math.max(minRows, Math.ceil((safeHeight + gap) / (DASHBOARD_GRID_ROW_HEIGHT + gap)));
  };

  const isWidgetGridItem = (item) => item?.classList?.contains("widget-card") || item?.classList?.contains("widget-placeholder");

  const gridItemMinimumSpan = (item) => {
    const explicit = Number(item?.dataset?.minW || item?.dataset?.minSpan);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(6, Math.ceil(explicit)));
    if (item?.dataset?.widgetType === "controls" || item?.classList?.contains("timeframe-widget")) return 2;
    return 1;
  };

  const gridItemLayoutKey = (layout) => layout?.dataset.widgetLayoutKey || layout?.dataset.layoutKey || "default";

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

  const panelMinimumRows = (panel) => {
    if (panel.classList.contains("db-panel-collapsed")) return 1;
    const layout = panel.closest(".panel-layout");
    return gridRowsFromHeight(getPanelMinimumHeight(panel), gridGapForLayout(layout), 1);
  };

  const panelExpandedMinimumRows = (panel, layout = panel.closest(".panel-layout")) => (
    gridRowsFromHeight(getPanelMinimumHeight(panel), gridGapForLayout(layout), 1)
  );

  const gridItemRowSpan = (item) => {
    if (item.classList.contains("widget-card") || item.classList.contains("widget-placeholder")) return 1;
    if (item.classList.contains("db-panel-collapsed")) return 1;
    if (item.classList.contains("db-panel-placeholder") && Number(item.dataset.gridRowSpan) === 1) return 1;
    const layout = item.closest(".panel-layout");
    const gap = gridGapForLayout(layout);
    const measuredHeight = Number(item.dataset.savedHeight) || item.getBoundingClientRect().height || DASHBOARD_GRID_ROW_HEIGHT;
    const minRows = item.classList.contains("db-panel-placeholder") ? 1 : panelMinimumRows(item);
    const explicitRows = Number(item.dataset.gridRowSpan);
    const rows = Number.isFinite(explicitRows) && explicitRows > 0
      ? explicitRows
      : gridRowsFromHeight(measuredHeight, gap, minRows);
    return Math.max(minRows, Math.round(rows));
  };

  const syncPanelRenderedHeightToFootprint = (panel, rowSpan = null) => {
    if (!panel?.classList?.contains("db-panel") || panel.classList.contains("db-panel-placeholder")) return;
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

  const gridCellFromPoint = (layout, item, clientX, clientY) => {
    const layoutRect = gridRectForLayout(layout);
    const gap = gridGapForLayout(layout);
    const columnWidth = (Math.max(1, layoutRect.width) - (gap * 5)) / 6;
    const span = Number(item.dataset.currentSpan) || Number(item.dataset.defaultSpan) || 1;
    const safeSpan = Math.max(1, Math.min(6, Math.round(span > 6 ? span / 2 : span)));
    const itemWidth = (columnWidth * safeSpan) + (Math.max(0, safeSpan - 1) * gap);
    const col = Math.round((clientX - layoutRect.left - (itemWidth / 2)) / (columnWidth + gap)) + 1;
    const rowSpan = isWidgetGridItem(item) ? 1 : gridItemRowSpan(item);
    const itemHeight = isWidgetGridItem(item) ? DASHBOARD_GRID_ROW_HEIGHT : gridHeightForRows(rowSpan, gap);
    const row = Math.round((clientY - layoutRect.top - (itemHeight / 2)) / (DASHBOARD_GRID_ROW_HEIGHT + gap)) + 1;
    return {
      col: Math.max(1, Math.min(7 - safeSpan, col)),
      row: Math.max(1, row),
    };
  };

  const panelGridCellFromPoint = (layout, panel, clientX, clientY) => gridCellFromPoint(layout, panel, clientX, clientY);

  const spanFromAlignedWidth = (layout, width, gap, minSpan) => {
    const layoutWidth = Math.max(1, gridRectForLayout(layout).width);
    const columnCount = (layout.classList.contains("widget-layout") || layout.classList.contains("panel-layout")) ? 6 : 12;
    const columnWidth = (layoutWidth - (gap * (columnCount - 1))) / columnCount;
    return Math.max(minSpan, Math.min(columnCount, (Math.max(1, width) + gap) / (columnWidth + gap)));
  };

  const alignedResizeSpan = ({ layout, item, currentSpan, gap, minSpan }) => {
    const rect = item.getBoundingClientRect();
    const layoutRect = gridRectForLayout(layout);
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
    return spanFromAlignedWidth(layout, match.edge - rect.left, gap, minSpan);
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
  const panelToolButtonsMarkup = (theme = "#2563eb", includeDelete = true) => `
        <button class="panel-tool-button panel-move-handle" type="button" aria-label="Move panel" title="Move panel"><span class="move-icon" aria-hidden="true"></span></button>
        <button class="panel-tool-button panel-resize-handle" type="button" aria-label="Resize panel" title="Resize panel"><span class="resize-icon" aria-hidden="true"></span></button>
        <button class="panel-tool-button panel-pin-toggle" type="button" aria-label="Pin panel" aria-pressed="false" title="Pin panel"><span class="pin-icon" aria-hidden="true"></span></button>
        <button class="panel-tool-button panel-title-handle" type="button" aria-label="Rename panel" title="Rename panel"><span class="text-icon" aria-hidden="true"></span></button>
        <button class="panel-tool-button panel-color-toggle" type="button" aria-label="Panel colors" aria-expanded="false" title="Panel colors" data-default-theme="${theme}"><span class="color-icon" aria-hidden="true"></span></button>
        ${includeDelete ? '<button class="panel-tool-button panel-delete-handle" type="button" aria-label="Delete panel" title="Delete panel"><span class="trash-icon" aria-hidden="true"></span></button>' : ""}`;

  const createCustomPanel = (definition) => {
    const safeTitle = String(definition.title || "Panel").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
    const panel = document.createElement("section");
    panel.className = "db-panel db-panel-empty-custom";
    panel.dataset.panelKey = definition.key;
    panel.dataset.defaultSpan = String(definition.span || 4);
    if (definition.gridCol) panel.dataset.gridCol = String(definition.gridCol);
    if (definition.gridRow) panel.dataset.gridRow = String(definition.gridRow);
    if (definition.minW) panel.dataset.minW = String(definition.minW);
    if (definition.locked) panel.dataset.locked = "true";
    if (definition.resizable === false) panel.dataset.resizable = "false";
    panel.dataset.customPanel = "true";
    panel.dataset.defaultTitle = definition.title || "Panel";
    panel.innerHTML = `
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
    return panel;
  };

  const savePanelLayouts = (layout, profile = getActivePanelProfile(layout.dataset.layoutKey || "default"), options = {}) => {
    const layoutKey = layout.dataset.layoutKey || "default";
    const persist = Boolean(options.persist);
    if (!persist) {
      pushLiveLayoutUndo(layoutKey, profile);
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
      .filter((item) => item !== excludeItem && !item.classList.contains("db-panel-dragging") && !item.classList.contains("widget-dragging"));
    const before = new Map(items.map((item) => [item, item.getBoundingClientRect()]));
    update();
    const afterItems = [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && !item.classList.contains("db-panel-dragging") && !item.classList.contains("widget-dragging"));
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
      .filter((item) => item !== excludeItem && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
    const before = new Map(items.map((item) => [item, item.getBoundingClientRect()]));
    update();
    const afterItems = [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
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

  const createCustomWidget = (definition) => {
    const safeTitle = String(definition.title || "Widget").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
    const widget = document.createElement("a");
    widget.className = "stat-card widget-card widget-card-custom";
    widget.href = definition.href || window.location.pathname + window.location.search;
    widget.dataset.widgetKey = definition.key;
    widget.dataset.widgetType = definition.type || "tracker";
    widget.dataset.defaultSpan = String(definition.span || 3);
    if (definition.gridCol) widget.dataset.gridCol = String(definition.gridCol);
    if (definition.gridRow) widget.dataset.gridRow = String(definition.gridRow);
    if (definition.minW) widget.dataset.minW = String(definition.minW);
    if (definition.minH) widget.dataset.minH = String(definition.minH);
    if (definition.locked) widget.dataset.locked = "true";
    if (definition.resizable === false) widget.dataset.resizable = "false";
    if (definition.config) widget.dataset.widgetConfig = definition.config;
    widget.dataset.customWidget = "true";
    widget.innerHTML = `
      <span class="stat-val">${definition.value || "0"}</span>
      <span class="stat-lbl">${safeTitle}</span>`;
    return widget;
  };

  const ensureWidgetTools = (widget, theme = "#2563eb") => {
    if (widget.querySelector(".widget-tools")) return;
    widget.insertAdjacentHTML("beforeend", `
      <div class="widget-tools" aria-label="Widget tools">
        <div class="panel-tool-drawer widget-tool-drawer">
          ${panelToolButtonsMarkup(theme, true)}
        </div>
        <button class="panel-settings-toggle widget-settings-toggle" type="button" aria-label="Widget settings" aria-expanded="false" title="Widget settings"><span class="settings-icon" aria-hidden="true"></span></button>
      </div>`);
  };

  const applyWidgetSpan = (widget, span) => {
    const rawSpan = Number(span) || Number(widget.dataset.defaultSpan) || 1;
    const minSpan = gridItemMinimumSpan(widget);
    const safeSpan = Math.max(minSpan, Math.min(6, rawSpan > 6 ? rawSpan / 2 : rawSpan));
    const displaySpan = Math.round(safeSpan);
    widget.dataset.currentSpan = String(displaySpan);
    if (widget.dataset.gridCol && widget.dataset.gridRow) {
      const currentCol = Number(widget.dataset.gridCol) || 1;
      const currentRow = Number(widget.dataset.gridRow) || 1;
      const safeCol = Math.max(1, Math.min(7 - displaySpan, currentCol));
      widget.dataset.gridCol = String(safeCol);
      widget.dataset.gridRow = String(Math.max(1, currentRow));
      widget.dataset.gridRowSpan = "1";
      widget.style.gridColumn = `${safeCol} / span ${displaySpan}`;
      widget.style.gridRow = `${widget.dataset.gridRow} / span 1`;
    } else {
      widget.style.gridColumn = `span ${displaySpan}`;
      widget.style.removeProperty("grid-row");
    }
    widget.style.removeProperty("width");
    widget.style.removeProperty("flex-basis");
  };

  const applyWidgetGridPosition = (widget, col, row) => {
    const span = Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 1;
    const safeSpan = Math.max(1, Math.min(6, span > 6 ? span / 2 : span));
    const safeCol = Math.max(1, Math.min(7 - safeSpan, Math.round(Number(col) || 1)));
    const safeRow = Math.max(1, Math.round(Number(row) || 1));
    widget.dataset.gridCol = String(safeCol);
    widget.dataset.gridRow = String(safeRow);
    widget.dataset.gridRowSpan = "1";
    widget.style.gridColumn = `${safeCol} / span ${Math.round(safeSpan)}`;
    widget.style.gridRow = `${safeRow} / span 1`;
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

  const gridItemPixelWidthForSpan = (layout, span) => {
    const gap = gridGapForLayout(layout);
    const layoutWidth = Math.max(1, gridRectForLayout(layout).width);
    const columnWidth = (layoutWidth - (gap * (DASHBOARD_GRID_COLUMNS - 1))) / DASHBOARD_GRID_COLUMNS;
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
    const bottomEdgePressure = () => edgePressure(window.innerHeight - lastClientY);
    const topEdgePressure = () => edgePressure(lastClientY);
    const hasEdgePressure = () => (lastClientY < edgeZone && window.scrollY > 0) || bottomEdgePressure() > 0;
    const targetVelocityForPointer = () => {
      if (lastClientY < edgeZone && window.scrollY > 0) {
        const pressure = topEdgePressure();
        if (!pressure) return 0;
        return -(minVelocity + ((maxVelocity - minVelocity) * pressure * pressure * pressure));
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
      const boundedDelta = requestedDelta < 0
        ? Math.max(requestedDelta, -before)
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

  const createResizePreview = (layout, item, placeholderClass, rect) => {
    const placeholder = document.createElement("div");
    placeholder.className = `${placeholderClass} dashboard-resize-preview`;
    placeholder.dataset.currentSpan = item.dataset.currentSpan || item.dataset.defaultSpan || "1";
    placeholder.dataset.defaultSpan = item.dataset.defaultSpan || placeholder.dataset.currentSpan;
    placeholder.dataset.gridRowSpan = String(gridItemRowSpan(item));
    if (item.dataset.minW) placeholder.dataset.minW = item.dataset.minW;
    if (item.dataset.minSpan) placeholder.dataset.minSpan = item.dataset.minSpan;
    if (item.dataset.widgetType) placeholder.dataset.widgetType = item.dataset.widgetType;
    if (item.dataset.gridCol) placeholder.dataset.gridCol = item.dataset.gridCol;
    if (item.dataset.gridRow) placeholder.dataset.gridRow = item.dataset.gridRow;
    placeholder.style.gridColumn = item.style.gridColumn || `span ${placeholder.dataset.currentSpan}`;
    placeholder.style.gridRow = item.style.gridRow || "";
    const footprintHeight = placeholderClass === "db-panel-placeholder"
      ? gridHeightForRows(gridItemRowSpan(item), gridGapForLayout(layout))
      : Math.max(DASHBOARD_GRID_ROW_HEIGHT, rect.height);
    placeholder.style.height = `${footprintHeight}px`;
    layout.insertBefore(placeholder, item);
    return placeholder;
  };

  const expandedPanelFootprintRows = (panel, layout, proposedRows = null) => {
    const gap = gridGapForLayout(layout);
    const minRows = panelExpandedMinimumRows(panel, layout);
    const candidateRows = Number(proposedRows);
    if (Number.isFinite(candidateRows) && candidateRows > 0) {
      return Math.max(minRows, Math.round(candidateRows));
    }
    const savedHeight = Number(panel.dataset.savedHeight);
    if (Number.isFinite(savedHeight) && savedHeight > 0) {
      return gridRowsFromHeight(savedHeight, gap, minRows);
    }
    if (!panel.classList.contains("db-panel-collapsed")) {
      return Math.max(minRows, gridItemRowSpan(panel));
    }
    return minRows;
  };

  const expandedPanelFootprintHeight = (panel, layout, proposedRows = null) => {
    const rows = expandedPanelFootprintRows(panel, layout, proposedRows);
    return gridHeightForRows(rows, gridGapForLayout(layout));
  };

  const createExpandedFootprintGhost = (panel, layout, rect, proposedRows = null) => {
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
    });
    return ghost;
  };

  const updateExpandedFootprintGhost = (ghost, panel, layout, rect) => {
    if (!ghost) return;
    const height = expandedPanelFootprintHeight(panel, layout, rect.rows);
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

  const gridBoundsForItem = (item) => {
    const col = Math.max(1, Math.round(Number(item.dataset.gridCol) || 1));
    const row = Math.max(1, Math.round(Number(item.dataset.gridRow) || 1));
    const span = gridItemSpan(item);
    const rowSpan = gridItemRowSpan(item);
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
      .filter((item) => !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
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

    let col = 1;
    let row = 1;
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

    widgets.forEach((widget) => {
      const span = gridItemSpan(widget);
      if (col + span - 1 > DASHBOARD_GRID_COLUMNS) {
        row += 1;
        col = 1;
      }
      applyWidgetGridPosition(widget, col, row);
      col += span;
    });

    const panelStartRow = Math.max(3, row + 1);
    let panelCol = 1;
    let panelRow = panelStartRow;
    panels.forEach((panel) => {
      const span = gridItemSpan(panel);
      if (panelCol + span - 1 > DASHBOARD_GRID_COLUMNS) {
        panelRow += 1;
        panelCol = 1;
      }
      applyPanelGridPosition(panel, panelCol, panelRow);
      panelCol += span;
    });
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
      .filter((item) => !excluded.has(item) && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging") && !item.classList.contains("dashboard-live-resize") && !item.classList.contains("dashboard-resize-source") && !item.classList.contains("dashboard-group-source") && !item.classList.contains("dashboard-group-member-preview"));
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

  const boundsAtGridSlot = (item, col, row) => {
    const span = gridItemSpan(item);
    const rowSpan = gridItemRowSpan(item);
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
    return !occupied.some((entry) => gridBoundsOverlap(bounds, entry.bounds));
  };

  const nearestSparseSlot = (item, preferred, occupied, rowLimit = null) => {
    const base = boundsAtGridSlot(item, preferred?.col || 1, preferred?.row || 1);
    const maxCol = DASHBOARD_GRID_COLUMNS - base.span + 1;
    const maxOccupiedRow = occupied.reduce((max, entry) => Math.max(max, entry.bounds.bottom), base.row);
    const limit = Math.max(base.row + 48, maxOccupiedRow + 24, rowLimit || 0);
    let best = null;
    for (let row = 1; row <= limit; row += 1) {
      for (let col = 1; col <= maxCol; col += 1) {
        const candidate = boundsAtGridSlot(item, col, row);
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

  const nearestSparseSlotAtOrAfter = (item, preferred, occupied, rowLimit = null) => {
    const base = boundsAtGridSlot(item, preferred?.col || 1, preferred?.row || 1);
    const maxCol = DASHBOARD_GRID_COLUMNS - base.span + 1;
    const maxOccupiedRow = occupied.reduce((max, entry) => Math.max(max, entry.bounds.bottom), base.row);
    const limit = Math.max(base.row + 80, maxOccupiedRow + 40, rowLimit || 0);
    for (let row = base.row; row <= limit; row += 1) {
      const startCol = row === base.row ? base.col : 1;
      for (let col = startCol; col <= maxCol; col += 1) {
        const candidate = boundsAtGridSlot(item, col, row);
        if (canPlaceBounds(candidate, occupied)) return candidate;
      }
    }
    return nearestSparseSlot(item, base, occupied, limit);
  };

  const visualGridOrder = (items) => [...items].sort((a, b) => {
    const aBounds = gridBoundsForItem(a);
    const bBounds = gridBoundsForItem(b);
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
      const conflicts = occupied.filter((entry) => (
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
      const desired = boundsAtRow(current, baselineRow);
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
    const items = globalGridItems(layout, { includePlaceholders: true });
    const placements = new Map();
    const occupied = [];
    const pinned = items.filter((item) => item !== activeItem && item.classList.contains("db-panel-pinned"));
    pinned.forEach((item) => {
      const bounds = gridBoundsForItem(item);
      placements.set(item, bounds);
      occupied.push({ item, bounds });
    });

    if (activeItem?.isConnected) {
      const target = preferredTarget || gridBoundsForItem(activeItem);
      let activeBounds = boundsAtGridSlot(activeItem, target.col, target.row);
      if (!canPlaceBounds(activeBounds, occupied)) {
        activeBounds = options.afterOnly
          ? nearestSparseSlotAtOrAfter(activeItem, activeBounds, occupied)
          : nearestSparseSlot(activeItem, activeBounds, occupied);
      }
      placements.set(activeItem, activeBounds);
      occupied.push({ item: activeItem, bounds: activeBounds });
    }

    visualGridOrder(items)
      .filter((item) => item !== activeItem && !item.classList.contains("db-panel-pinned"))
      .forEach((item) => {
        const current = gridBoundsForItem(item);
        const bounds = canPlaceBounds(current, occupied)
          ? current
          : options.afterOnly
            ? nearestSparseSlotAtOrAfter(item, current, occupied)
            : nearestSparseSlot(item, current, occupied);
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

  const commitActiveDropSlot = (layout, item, preferredTarget) => {
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
      const next = canPlaceBounds(current, occupied)
        ? current
        : nearestSparseSlotAtOrAfter(other, current, occupied);
      if (next.col !== current.col || next.row !== current.row) movedItems += 1;
      applyGridItemPosition(other, next.col, next.row);
      occupied.push({ item: other, bounds: next });
    });
    return { bounds: activeBounds, movedItems };
  };

  const commitExpandedPanelDropSlot = (layout, item, preferredTarget) => {
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
      const next = canPlaceBounds(current, occupied)
        ? current
        : verticalSlotAtOrAfter(other, current, occupied) || nearestSparseSlotAtOrAfter(other, current, occupied);
      if (next.col !== current.col || next.row !== current.row) movedItems += 1;
      applyGridItemPosition(other, next.col, next.row);
      occupied.push({ item: other, bounds: next });
    });

    return { bounds: activeBounds, movedItems };
  };

  const verticalSlotAtOrAfter = (item, preferred, occupied, rowLimit = null) => {
    const base = boundsAtGridSlot(item, preferred?.col || 1, preferred?.row || 1);
    const maxOccupiedRow = occupied.reduce((max, entry) => Math.max(max, entry.bounds.bottom), base.row);
    const limit = Math.max(base.row + 80, maxOccupiedRow + 40, rowLimit || 0);
    for (let row = base.row; row <= limit; row += 1) {
      const candidate = boundsAtGridSlot(item, base.col, row);
      if (canPlaceBounds(candidate, occupied)) return candidate;
    }
    return null;
  };

  const panelAddTarget = (layout, panel) => {
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

  const animateOrderedGridReflow = (layout, update, excludeItem = null) => {
    const host = gridHostForLayout(layout);
    const selector = ".widget-layout > .widget-card, .widget-layout > .widget-placeholder, .panel-layout > .db-panel, .panel-layout > .db-panel-placeholder";
    const items = [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
    const before = new Map(items.map((item) => [item, item.getBoundingClientRect()]));
    update();
    const afterItems = [...host.querySelectorAll(selector)]
      .filter((item) => item !== excludeItem && !item.classList.contains("widget-dragging") && !item.classList.contains("db-panel-dragging"));
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
        placeholder.style.height = `${Math.max(DASHBOARD_GRID_ROW_HEIGHT, rect.height)}px`;
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
      closeInactiveDashboardTools(item);
      onStart?.();
    };

    const movePreview = (clientX, clientY) => {
      if (!placeholder) return;
      const nextCell = gridCellFromPoint(layout, groupDrag ? placeholder : item, clientX, clientY);
      if (targetCell && targetCell.col === nextCell.col && targetCell.row === nextCell.row) return;
      targetCell = nextCell;
      animateOrderedGridReflow(layout, () => {
        restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
        if (groupDrag) {
          applyGroupFootprintBounds(placeholder, groupDrag.footprintLayout, {
            ...groupBoxBounds(groupDrag.groupBox),
            col: nextCell.col,
            row: nextCell.row,
          });
          resolveSparseGridLayout(layout, placeholder, nextCell, { afterOnly: true });
        } else {
          resolveSparseGridLayout(layout, placeholder, nextCell, { afterOnly: true });
        }
      }, item);
    };

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < threshold) return;
      startDrag();
      moveEvent.preventDefault();
      lastMoveEvent = moveEvent;
      autoScroll.update(moveEvent);
      const gridRect = gridRectForLayout(layout);
      const dragRect = groupLive?.groupRect || rect;
      const minLeft = gridRect.left;
      const maxLeft = Math.max(minLeft, gridRect.right - dragRect.width);
      const scrollingTowardTop = moveEvent.clientY < 104 && (window.scrollY || document.documentElement.scrollTop || 0) > 0;
      const minTop = scrollingTowardTop ? Math.min(0, gridRect.top) : Math.max(0, gridRect.top);
      const visibleBottom = Math.max(gridRect.bottom, window.innerHeight - 16);
      const maxTop = Math.max(minTop, visibleBottom - Math.min(dragRect.height, window.innerHeight - 32));
      const nextLeft = Math.max(minLeft, Math.min(maxLeft, moveEvent.clientX - offsetX));
      const nextTop = Math.max(minTop, Math.min(maxTop, moveEvent.clientY - offsetY));
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
      const previewRect = groupDrag && groupLive
        ? { left: nextLeft, top: nextTop, width: dragRect.width, height: dragRect.height }
        : item.getBoundingClientRect();
      movePreview(previewRect.left + (previewRect.width / 2), previewRect.top + (previewRect.height / 2));
    };

    const onUp = (upEvent) => {
      const canceled = upEvent?.type === "pointercancel";
      const releaseScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const releaseUsedExtendedWorkspace = dragging && placeholder && !canceled && document.body.classList.contains("dashboard-interaction-scroll-extended");
      let committedExtendedWorkspaceScrollY = null;
      autoScroll.stop({ preserveExtension: dragging && placeholder && !canceled });
      document.body.classList.remove("panel-interaction-active");
      document.body.classList.remove("panel-resize-active");
      try {
        if (dragging && placeholder) {
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
            restoreGridLayoutSnapshot(startSnapshot);
            placeholder.remove();
            groupLive?.clear();
            onCancel?.();
          } else {
            const finalCell = {
              col: Number(placeholder.dataset.gridCol) || originalCell.col,
              row: Number(placeholder.dataset.gridRow) || originalCell.row,
            };
            let result;
            if (groupDrag) {
              restoreGridLayoutSnapshot(startSnapshot);
              applyGroupFootprintBounds(placeholder, groupDrag.footprintLayout, {
                ...groupBoxBounds(groupDrag.groupBox),
                col: finalCell.col,
                row: finalCell.row,
              });
              resolveSparseGridLayout(layout, placeholder, finalCell, { afterOnly: true });
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
              restoreGridLayoutSnapshot(startSnapshot, { exclude: [item] });
              placeholder.remove();
              result = item.classList.contains("db-panel") && !item.classList.contains("db-panel-collapsed")
                ? commitExpandedPanelDropSlot(layout, item, finalCell)
                : commitActiveDropSlot(layout, item, finalCell);
            }
            const finalBounds = result.bounds;
            committedExtendedWorkspaceScrollY = releaseUsedExtendedWorkspace ? releaseScrollY : null;
            syncCommittedWorkspaceScrollFloor(layout, {
              preserveViewport: committedExtendedWorkspaceScrollY !== null,
              scrollY: committedExtendedWorkspaceScrollY,
            });
            onCommit?.({ moved: finalBounds.col !== originalCell.col || finalBounds.row !== originalCell.row || result.movedItems > 0 });
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
      onEnd?.(dragging);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("keydown", onKeydown);
      window.removeEventListener("blur", onWindowBlur);
    };

    const onKeydown = (keyEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      onUp({ type: "pointercancel" });
    };

    const onWindowBlur = () => {
      onUp({ type: "pointercancel" });
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("blur", onWindowBlur);
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

  const alignedResizeHeight = ({ layout, item, currentHeight }) => {
    const rect = item.getBoundingClientRect();
    const layoutRect = gridRectForLayout(layout);
    const tolerance = 18;
    const candidates = [{ edge: layoutRect.bottom, priority: 1 }];
    document.querySelectorAll(".widget-layout > .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])").forEach((target) => {
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
    const gap = gridGapForLayout(layout);
    const nextHeight = match ? Math.max(getPanelMinimumHeight(item), Math.round(match.edge - rect.top)) : currentHeight;
    return gridHeightForRows(gridRowsFromHeight(nextHeight, gap, panelMinimumRows(item)), gap);
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

  const applyGroupFootprintBounds = (footprint, layout, bounds) => {
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
    footprint.style.height = `${gridHeightForRows(rowSpan, gridGapForLayout(layout))}px`;
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
      if (isWidgetGridItem(sourceItem)) return 1 / Math.max(1, bounds.rowSpan);
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
        ? 1
        : Math.max(panelMinimumRows(sourceItem), Math.round(start.rowSpan * safeScaleY));
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
        applyWidgetGridPosition(member, nextCol, nextRow);
      } else {
        applyPanelSpan(member, nextSpan);
        if (sourceItem.classList.contains("db-panel-collapsed")) {
          member.dataset.gridRowSpan = "1";
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

    const startX = event.clientX;
    const startY = event.clientY;
    const gap = gridGapForLayout(layout);
    const startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const layoutRect = gridRectForLayout(layout);
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
        ? 1 / Math.max(1, startBounds.get(member).rowSpan)
        : panelMinimumRows(member) / Math.max(1, startBounds.get(member).rowSpan)
    )));
    const liveMaxScaleX = (DASHBOARD_GRID_COLUMNS - groupBox.col + 1) / startWidth;
    const previewEntries = members.map((member) => {
      const memberLayout = groupItemLayout(member) || layout;
      const rect = startRects.get(member);
      const preview = createResizePreview(
        memberLayout,
        member,
        isWidgetGridItem(member) ? "widget-placeholder" : "db-panel-placeholder",
        rect
      );
      preview.classList.add("dashboard-group-member-preview");
      if (member.classList.contains("db-panel-collapsed")) {
        preview.classList.add("db-panel-collapsed");
        preview.dataset.gridRowSpan = "1";
        preview.style.height = `${gridHeightForRows(1, gridGapForLayout(memberLayout))}px`;
      }
      const live = beginLiveResizeSurface(member, rect);
      const expandedGhost = createExpandedFootprintGhost(member, memberLayout, rect);
      return { member, memberLayout, preview, live, expandedGhost, rect };
    });
    const previewMembers = previewEntries.map((entry) => entry.preview);
    const previewStartBounds = new Map(previewEntries.map((entry) => [entry.preview, startBounds.get(entry.member)]));
    const sourceForPreview = new Map(previewEntries.map((entry) => [entry.preview, entry.member]));
    const groupFootprint = createGroupFootprint(layout, groupBox, "dashboard-resize-preview dashboard-group-resize-footprint");
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
        const width = Math.max(gridItemPixelWidthForSpan(entry.memberLayout, gridItemMinimumSpan(entry.member)), startRect.width * scaleX);
        const height = isWidgetGridItem(entry.member) || entry.member.classList.contains("db-panel-collapsed")
          ? startRect.height
          : Math.max(getPanelMinimumHeight(entry.member), startRect.height * scaleY);
        updateLiveResizeSurface(entry.live, width, height, left, top);
        liveBounds.left = Math.min(liveBounds.left, left);
        liveBounds.top = Math.min(liveBounds.top, top);
        liveBounds.right = Math.max(liveBounds.right, left + width);
        liveBounds.bottom = Math.max(liveBounds.bottom, top + height);
        if (entry.expandedGhost) {
          const ghostRows = Math.max(
            expandedPanelFootprintRows(entry.member, entry.memberLayout),
            Math.round(startBounds.get(entry.member).rowSpan * scaleY)
          );
          updateExpandedFootprintGhost(entry.expandedGhost, entry.member, entry.memberLayout, {
            left,
            top,
            width,
            rows: ghostRows,
          });
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
        });
        resolveSparseGridLayout(layout, groupFootprint.footprint, { col: groupBox.col, row: groupBox.row }, { afterOnly: true });
        applyGroupResizeLayout(layout, previewMembers, previewStartBounds, groupBox, nextCols / startWidth, nextRows / startHeight, {
          sourceForMember: sourceForPreview,
          collision: false,
        });
      }, source);
    };

    const finishResize = (upEvent, canceled) => {
      if (canceled) {
        restoreGridLayoutSnapshot(resizeStartSnapshot);
      } else {
        animateOrderedGridReflow(layout, () => {
          previewEntries.forEach((entry) => entry.preview.remove());
          previewEntries.forEach((entry) => entry.expandedGhost?.remove());
          restoreGridLayoutSnapshot(resizeStartSnapshot);
          applyGroupFootprintBounds(groupFootprint.footprint, groupFootprint.footprintLayout, {
            col: groupBox.col,
            row: groupBox.row,
            span: previewCols,
            rowSpan: previewRows,
          });
          resolveSparseGridLayout(layout, groupFootprint.footprint, { col: groupBox.col, row: groupBox.row }, { afterOnly: true });
          const resolvedCol = Number(groupFootprint.footprint.dataset.gridCol) || groupBox.col;
          const resolvedRow = Number(groupFootprint.footprint.dataset.gridRow) || groupBox.row;
          const commitGroupBox = {
            ...groupBox,
            col: resolvedCol,
            row: resolvedRow,
            right: resolvedCol + startWidth - 1,
            bottom: resolvedRow + startHeight - 1,
          };
          applyGroupResizeLayout(layout, members, startBounds, commitGroupBox, previewCols / startWidth, previewRows / startHeight, {
            collision: false,
          });
          groupFootprint.footprint.remove();
          previewEntries.forEach((entry) => clearLiveResizeSurface(entry.member, entry.live));
        }, source);
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
    const layoutKey = layout.dataset.widgetLayoutKey || "default";
    const persist = Boolean(options.persist);
    if (!persist) {
      pushLiveLayoutUndo(layoutKey, profile);
      return;
    }
    captureLayoutUndo(layoutKey, profile);
    const expansionBaselineSnapshot = expansionBaselineSnapshotForLayoutKey(layoutKey);
    [...layout.querySelectorAll(":scope > .widget-card:not([hidden])")].forEach((widget, index) => {
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
          minW: Number(widget.dataset.minW) || null,
          minH: Number(widget.dataset.minH) || null,
          locked: widget.dataset.locked === "true",
          resizable: widget.dataset.resizable === "false" ? false : true,
          config: widget.dataset.widgetConfig || null,
          breakBefore: widgetHasRowBreakBefore(widget),
          spacerBefore: widgetSpacerSiblingsBefore(widget).length,
          expansionBaseline,
        }));
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
        type: widget.dataset.widgetType || "tracker",
        href: widget.getAttribute("href") || "",
        pinned: widget.classList.contains("db-panel-pinned"),
        minW: Number(widget.dataset.minW) || null,
        minH: Number(widget.dataset.minH) || null,
        locked: widget.dataset.locked === "true",
        resizable: widget.dataset.resizable === "false" ? false : true,
        config: widget.dataset.widgetConfig || null,
      }));
    try {
      localStorage.setItem(customWidgetsKey(layoutKey, profile), JSON.stringify(customWidgets));
      localStorage.setItem(hiddenWidgetsKey(layoutKey, profile), layout.dataset.hiddenWidgetsDraft || "[]");
    } catch {}
  };

  const initWidgetLayout = (layout) => {
    const layoutKey = layout.dataset.widgetLayoutKey || "default";
    const profile = getActivePanelProfile(layoutKey);
    let customDefinitions = [];
    try {
      customDefinitions = JSON.parse(localStorage.getItem(customWidgetsKey(layoutKey, profile)) || "[]");
    } catch {
      customDefinitions = [];
    }
    customDefinitions
      .filter((definition) => definition?.key && !layout.querySelector(`:scope > .widget-card[data-widget-key="${CSS.escape(definition.key)}"]`))
      .forEach((definition) => layout.appendChild(createCustomWidget(definition)));
    let hiddenWidgets = [];
    try {
      hiddenWidgets = JSON.parse(localStorage.getItem(hiddenWidgetsKey(layoutKey, profile)) || "[]");
    } catch {
      hiddenWidgets = [];
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
      ensureWidgetTools(widget);
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(widgetStorageKey(layoutKey, key, profile)) || "null");
      } catch {}
      savedByWidget.set(widget, saved);
      markLoadedExpansionBaseline(widget, saved?.expansionBaseline);
      const defaultWidgetSpan = widget.dataset.widgetType === "controls" ? 6 : 1;
      applyWidgetSpan(widget, saved?.span ?? widget.dataset.defaultSpan ?? defaultWidgetSpan);
      if (saved?.gridCol && saved?.gridRow) applyWidgetGridPosition(widget, saved.gridCol, saved.gridRow);
      widget.classList.toggle("db-panel-pinned", Boolean(saved?.pinned));
      widget.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", Boolean(saved?.pinned).toString());
      if (saved?.minW) widget.dataset.minW = String(saved.minW);
      if (saved?.minH) widget.dataset.minH = String(saved.minH);
      if (saved?.locked) widget.dataset.locked = "true";
      if (saved?.resizable === false) widget.dataset.resizable = "false";
      if (saved?.config) widget.dataset.widgetConfig = saved.config;
      applyPanelColor(widget, saved?.color || widget.querySelector(".panel-color-toggle")?.dataset.defaultTheme);
      applyPanelTitleColor(widget, "");
      if (saved?.title) {
        widget.dataset.panelTitle = saved.title;
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
      if (layout.closest(".dashboard-layout-grid")) return;
      const span = Number(widget.dataset.currentSpan) || Number(widget.dataset.defaultSpan) || 1;
      if (defaultCol + span - 1 > 6) {
        defaultRow += 1;
        defaultCol = 1;
      }
      applyWidgetGridPosition(widget, defaultCol, defaultRow);
      defaultCol += span;
    });
    if (layout.closest(".dashboard-layout-grid")) {
      syncDefaultDashboardGrid(layoutKey);
    } else {
      normalizeGridLayout(layout);
    }

    const initWidget = (widget) => {
      if (widget.dataset.widgetInitialized === "true") return;
      widget.dataset.widgetInitialized = "true";
      widget.__saveWidgetLayout = () => saveWidgetLayouts(layout);
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
      let closeTimer;
      let suppressToolOpenUntil = 0;
      let suppressWidgetClickUntil = 0;
      let dragging = false;
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
        widget.classList.add("widget-tools-open");
        settings?.setAttribute("aria-expanded", "true");
        syncLayoutToolsActive();
      };
      const closeTools = () => {
        releaseToolLeaveClose();
        toolsOpenedByApproach = false;
        widget.classList.remove("widget-tools-open");
        settings?.setAttribute("aria-expanded", "false");
        colorMenu?.classList.remove("panel-color-menu-open");
        colorToggle?.setAttribute("aria-expanded", "false");
        syncLayoutToolsActive();
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
        openTools();
        if (!wasOpen && widget.classList.contains("widget-tools-open")) toolsOpenedByApproach = true;
      };
      tools?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      widget.addEventListener("click", (event) => {
        if (performance.now() >= suppressWidgetClickUntil) return;
        if (event.target?.closest?.(".widget-tools")) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
      tools?.addEventListener("mouseenter", resumeToolHoverClose);
      tools?.addEventListener("mouseleave", scheduleClose);
      settings?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        releaseToolLeaveClose();
        if (!canOpenDashboardTools(widget)) return;
        const shouldClose = widget.classList.contains("widget-tools-open") && !toolsOpenedByApproach;
        toolsOpenedByApproach = false;
        if (shouldClose) {
          closeTools();
        } else {
          suppressToolOpenUntil = 0;
          closeInactiveDashboardTools(widget);
          openTools();
        }
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
        const layoutWidth = Math.max(1, gridRectForLayout(layout).width);
        const startSpan = Number(widget.dataset.currentSpan) || 1;
        const startRect = widget.getBoundingClientRect();
        const startCol = Number(widget.dataset.gridCol) || 1;
        const startRow = Number(widget.dataset.gridRow) || 1;
        const startRightCol = startCol + startSpan - 1;
        const minLiveWidth = gridItemPixelWidthForSpan(layout, gridItemMinimumSpan(widget));
        const maxLiveWidth = gridItemPixelWidthForSpan(layout, resizeEdge === "left" ? startRightCol : DASHBOARD_GRID_COLUMNS);
        const resizePreview = createResizePreview(layout, widget, "widget-placeholder", startRect);
        const previewStartCell = {
          col: Number(resizePreview.dataset.gridCol) || Number(widget.dataset.gridCol) || 1,
          row: Number(resizePreview.dataset.gridRow) || Number(widget.dataset.gridRow) || 1,
        };
        const liveResizePreview = beginLiveResizeSurface(widget, startRect);
        const resizePeers = groupPeers(widget, "widget")
          .filter((peer) => !peer.classList.contains("db-panel-pinned") && groupItemLayout(peer) === layout)
          .map((peer) => ({ peer, startSpan: Number(peer.dataset.currentSpan) || Number(peer.dataset.defaultSpan) || 1 }));
        const groupResizeItems = [{ peer: widget, startSpan }, ...resizePeers];
        const startX = event.clientX;
        const startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const resizeStartSnapshot = snapshotGridLayout(layout);
        let previewSpan = startSpan;
        const applyResize = (nextSpan) => {
          const requestedDelta = nextSpan - startSpan;
          const minDelta = Math.max(...groupResizeItems.map(({ peer, startSpan }) => gridItemMinimumSpan(peer) - startSpan));
          const edgeMaxDelta = resizeEdge === "left" ? startCol - 1 : 6 - startSpan;
          const maxDelta = Math.min(edgeMaxDelta, ...groupResizeItems.map(({ startSpan }) => 6 - startSpan));
          const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
          const snappedSpan = startSpan + delta;
          const snappedCol = resizeEdge === "left" ? startRightCol - snappedSpan + 1 : previewStartCell.col;
          restoreGridLayoutSnapshot(resizeStartSnapshot, { exclude: [widget] });
          applyWidgetSpan(resizePreview, snappedSpan);
          if (resizeEdge === "left") applyWidgetGridPosition(resizePreview, snappedCol, startRow);
          resizePeers.forEach(({ peer, startSpan: peerStartSpan }) => applyWidgetSpan(peer, peerStartSpan + delta));
          resolveSparseGridLayout(layout, resizePreview, { col: snappedCol, row: previewStartCell.row });
          previewSpan = snappedSpan;
        };
        const onMove = (moveEvent) => {
          moveEvent.preventDefault();
          const scrollDeltaY = (window.scrollY || document.documentElement.scrollTop || 0) - startScrollY;
          const deltaX = moveEvent.clientX - startX;
          const liveWidth = Math.max(minLiveWidth, Math.min(maxLiveWidth, startRect.width + (resizeEdge === "left" ? -deltaX : deltaX)));
          const liveLeft = resizeEdge === "left" ? startRect.right - liveWidth : startRect.left;
          updateLiveResizeSurface(liveResizePreview, liveWidth, startRect.height, liveLeft, startRect.top - scrollDeltaY);
          const rawSpan = startSpan + ((((resizeEdge === "left" ? -deltaX : deltaX)) / layoutWidth) * 6);
          const nextSpan = Math.max(gridItemMinimumSpan(widget), Math.min(6, Math.round(rawSpan)));
          if (nextSpan === previewSpan) return;
          animateOrderedGridReflow(layout, () => applyResize(nextSpan), widget);
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
              }));
              const requestedDelta = snappedSpan - startSpan;
              const minDelta = Math.max(...groupResizeItems.map(({ peer, startSpan }) => gridItemMinimumSpan(peer) - startSpan));
              const edgeMaxDelta = resizeEdge === "left" ? startCol - 1 : 6 - startSpan;
              const maxDelta = Math.min(edgeMaxDelta, ...groupResizeItems.map(({ startSpan }) => 6 - startSpan));
              const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
              const finalSpan = startSpan + delta;
              const finalCol = resizeEdge === "left" ? startRightCol - finalSpan + 1 : startCol;
              clearLiveResizeSurface(widget, liveResizePreview);
              restoreGridLayoutSnapshot(resizeStartSnapshot);
              resizePreview.remove();
              applyWidgetSpan(widget, finalSpan);
              if (resizeEdge === "left") applyWidgetGridPosition(widget, finalCol, startRow);
              resizePeers.forEach(({ peer, startSpan: peerStartSpan }) => applyWidgetSpan(peer, peerStartSpan + delta));
              applyOrderedGridLayout(layout);
            }, widget);
            saveSharedGridLayouts(layout);
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
      panel.classList.remove("db-panel-unlocked", "db-panel-pinned");
      if (saved?.pinned) panel.classList.add("db-panel-pinned");
      panel.classList.toggle("db-panel-collapsed", saved?.collapsed ?? panel.classList.contains("db-panel-collapsed"));
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

    const initPanel = (panel) => {
      if (panel.dataset.panelInitialized === "true") return;
      panel.dataset.panelInitialized = "true";
      syncPanelMinimumWidth(panel);
      const header = panel.querySelector(".db-panel-hd");
      const body = panel.querySelector(".db-panel-body");
      const settingsButton = panel.querySelector(".panel-settings-toggle");
      const panelTools = panel.querySelector(".panel-tools");
      const panelToolDrawer = panel.querySelector(".panel-tool-drawer");
      if (panelToolDrawer && !panelToolDrawer.querySelector(".panel-delete-handle")) {
        panelToolDrawer.insertAdjacentHTML("beforeend", '<button class="panel-tool-button panel-delete-handle" type="button" aria-label="Delete panel" title="Delete panel"><span class="trash-icon" aria-hidden="true"></span></button>');
      }
      const moveHandle = panel.querySelector(".panel-move-handle");
      const resizeHandle = panel.querySelector(".panel-resize-handle");
      const pinButton = panel.querySelector(".panel-pin-toggle");
      const titleButton = panel.querySelector(".panel-title-handle");
      const colorToggle = panel.querySelector(".panel-color-toggle");
      const deleteButton = panel.querySelector(".panel-delete-handle");
      if (!header || !body) return;
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

      header.setAttribute("role", "button");
      header.setAttribute("tabindex", "0");
      header.setAttribute("aria-expanded", (!panel.classList.contains("db-panel-collapsed")).toString());
      const togglePanel = () => {
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
        header.setAttribute("aria-expanded", (!collapsed).toString());
        savePanelLayouts(layout);
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
        const gap = gridGapForLayout(layout);
        const startRows = gridItemRowSpan(panel);
        const rowStep = DASHBOARD_GRID_ROW_HEIGHT + gap;
        const startFootprintHeight = gridHeightForRows(gridItemRowSpan(panel), gap);
        const layoutWidth = Math.max(1, gridRectForLayout(layout).width);
        const startSpan = Number(panel.dataset.currentSpan) || Number(panel.dataset.defaultSpan) || 6;
        const startCol = Number(panel.dataset.gridCol) || 1;
        const startRow = Number(panel.dataset.gridRow) || 1;
        const startRightCol = startCol + startSpan - 1;
        const collapsedPanelResize = panel.classList.contains("db-panel-collapsed");
        const minLiveWidth = gridItemPixelWidthForSpan(layout, gridItemMinimumSpan(panel));
        const maxLiveWidth = gridItemPixelWidthForSpan(layout, resizeEdge === "left" ? startRightCol : DASHBOARD_GRID_COLUMNS);
        const minLiveHeight = collapsedPanelResize ? startRect.height : getPanelMinimumHeight(panel);
        const resizePreview = createResizePreview(layout, panel, "db-panel-placeholder", startRect);
        const previewStartCell = {
          col: Number(resizePreview.dataset.gridCol) || Number(panel.dataset.gridCol) || 1,
          row: Number(resizePreview.dataset.gridRow) || Number(panel.dataset.gridRow) || 1,
        };
        const liveResizePreview = beginLiveResizeSurface(panel, startRect);
        const expandedFootprintGhost = createExpandedFootprintGhost(panel, layout, startRect);
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
          resolveSparseGridLayout(layout, resizePreview, { col: snappedCol, row: previewStartCell.row });
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
          const nextRows = Math.max(panelMinimumRows(panel), startRows + Math.round((effectiveClientY - startY) / rowStep));
          const nextHeight = gridHeightForRows(nextRows, gap);
          if (collapsedPanelResize) {
            const liveRect = liveResizePreview.getBoundingClientRect();
            updateExpandedFootprintGhost(expandedFootprintGhost, panel, layout, {
              left: liveRect.left,
              top: liveRect.top,
              width: liveRect.width,
              rows: nextRows,
            });
          }
          if (nextSpan === previewSpan && nextHeight === previewHeight) return;
          animateOrderedGridReflow(layout, () => applyResize(nextSpan, nextHeight, nextRows), panel);
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
              }));
              const snappedHeight = collapsedPanelResize
                ? expandedPanelFootprintHeight(panel, layout, previewRows)
                : alignedResizeHeight({
                  layout,
                  item: resizePreview,
                  currentHeight: previewHeight || Number(panel.dataset.savedHeight) || panel.getBoundingClientRect().height,
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
            }, panel);
            saveSharedGridLayouts(layout);
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
      showToast(`Loading layout ${selected}.`);
      window.location.reload();
    });
  });

  document.querySelectorAll(".layout-save-button").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.layoutTarget || "default";
      const selected = activeLayoutSlot(layoutKey) || "1";
      try {
        localStorage.setItem(`${panelProfilePrefix}${layoutKey}`, selected);
        layoutStorageKeys(layoutKey, selected).forEach((key) => localStorage.removeItem(key));
      } catch {}
      const layout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
      if (layout) savePanelLayouts(layout, selected, { persist: true });
      const widgetLayout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
      if (widgetLayout) saveWidgetLayouts(widgetLayout, selected, { persist: true });
      showToast(`Layout ${selected} saved.`);
    });
  });

  document.querySelectorAll(".layout-group-button").forEach((button) => {
    button.addEventListener("click", () => {
      setGroupMode(!groupMode);
      showToast(groupMode ? "Group selection enabled." : "Group selection cleared.");
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
    document.addEventListener("pointerdown", (event) => {
      if (!picker.contains(event.target)) closeMenu();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  });

  document.querySelectorAll(".panel-add-action").forEach((button) => {
    button.addEventListener("click", () => {
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
      const definition = { key, title, color: nextColor, span: 1 };
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
      });
      layout.__initPanel?.(panel);
      savePanelLayouts(layout, selected);
      showToast(`${title} added.`);
    });
  });

  document.querySelectorAll(".divider-add-action").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.layoutTarget || "default";
      const layout = document.querySelector(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`);
      if (!layout) return;
      const selected = getActivePanelProfile(layoutKey);
      savePanelLayouts(layout, selected);
      syncDefaultDashboardGrid(layoutKey);
      const key = `divider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const customCount = layout.querySelectorAll(':scope > .db-panel[data-dashboard-object-kind="divider"]').length;
      const definition = {
        key,
        title: `Divider ${customCount + 1}`,
        color: "#64748b",
        span: 6,
        minW: 2,
      };
      const divider = createCustomPanel(definition);
      divider.dataset.dashboardObjectKind = button.dataset.dividerKind || "divider";
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
      });
      layout.__initPanel?.(divider);
      savePanelLayouts(layout, selected);
      showToast(`${definition.title} added.`);
    });
  });

  document.querySelectorAll(".widget-add-action").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.widgetTarget || "default";
      const layout = document.querySelector(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`);
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
      const kind = button.dataset.widgetKind || "widget";
      const objectName = kind === "anchor" ? "Anchor" : "Widget";
      const key = `${kind === "anchor" ? "anchor" : "widget"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const title = `${objectName} ${customCount + 1}`;
      const definition = { key, title, value: "0", color: nextColor, span: kind === "anchor" ? 2 : 1, type: kind === "anchor" ? "anchor" : "tracker" };
      const widget = createCustomWidget(definition);
      if (kind === "anchor") widget.dataset.dashboardObjectKind = "anchor";
      ensureWidgetTools(widget, nextColor);
      applyWidgetSpan(widget, definition.span);
      applyPanelColor(widget, nextColor);
      applyPanelTitleColor(widget, "#ffffff");
      animateWidgetReflow(layout, () => layout.appendChild(widget));
      layout.__initWidget?.(widget);
      saveWidgetLayouts(layout, selected);
      showToast(`${title} added.`);
    });
  });

  const undoDashboardLayoutChange = (layoutKey, profile, options = {}) => {
    if (!restoreLayoutUndo(layoutKey, profile)) {
      if (options.toast !== false) showToast("No layout change to undo.", "warn");
      return false;
    }
    if (options.toast !== false) showToast("Layout change undone.");
    return true;
  };

  const isEditableUndoTarget = (target) => {
    if (!target) return false;
    if (target.isContentEditable) return true;
    return Boolean(target.closest?.("input, textarea, select, [contenteditable='true'], [role='textbox']"));
  };

  document.querySelectorAll(".panel-undo-button").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.layoutTarget || "default";
      const profile = getActivePanelProfile(layoutKey);
      undoDashboardLayoutChange(layoutKey, profile);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
    if (event.key.toLowerCase() !== "z") return;
    if (isEditableUndoTarget(event.target)) return;
    const layoutKey = document.querySelector(".panel-layout")?.dataset.layoutKey || "default";
    const profile = getActivePanelProfile(layoutKey);
    if (!undoDashboardLayoutChange(layoutKey, profile)) return;
    event.preventDefault();
  });

  document.querySelectorAll(".panel-reset-button").forEach((button) => {
    button.addEventListener("click", () => {
      const layoutKey = button.dataset.layoutTarget || document.querySelector(".panel-layout")?.dataset.layoutKey || "default";
      const profile = getActivePanelProfile(layoutKey);
      const layouts = [...document.querySelectorAll(`.panel-layout[data-layout-key="${CSS.escape(layoutKey)}"]`)];
      const widgetLayouts = [...document.querySelectorAll(`.widget-layout[data-widget-layout-key="${CSS.escape(layoutKey)}"]`)];
      captureLayoutUndo(layoutKey, profile);
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
