export function initializeLayoutSourceRuntime(deps) {
  const {
    layoutSourceKey,
    readJsonStore,
    writeJsonStore,
    portalFloatingMenu,
    restoreFloatingMenu,
    layoutPersistence,
    showToast,
    getActivePanelProfile,
    loadDataSources,
    loadWorkspaceContexts,
    loadAssets,
    refreshResolvedContextDebug,
    scheduleWorkspaceVisualLodRefresh,
    savePanelLayouts,
    saveWidgetLayouts,
    saveWorkspaceContextState,
    savePersistedWorkspaceSnapshot,
  } = deps;
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
  
  return {
    setActiveLayoutSource,
    activeLayoutSource,
    activeLayoutSlot,
    layoutSourceLabel,
    layoutSourceGroups,
    renderLayoutSourceMenus,
    closeLayoutSourceMenus,
    setLayoutTriggerSelection,
    activateLayoutSource,
    loadSavedLayout,
  };
}
