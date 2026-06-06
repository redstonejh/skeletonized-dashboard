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
            panelRuntime.applyPanelGridPosition(state.panel, state.panel.dataset.gridCol, state.panel.dataset.gridRow);
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
        widgetRuntimeController.applyGridPosition(placeholder, originalCell.col, originalCell.row);
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
        widgetRuntimeController.applyGridPosition(placeholder, originalCell.col, originalCell.row);
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
    const nextHeight = match ? Math.max(panelRuntime.getPanelMinimumHeight(item), Math.round(match.edge - rect.top)) : currentHeight;
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
        widgetRuntimeController.applySpan(member, span);
        widgetRuntimeController.applyGridPosition(member, col, row, rowSpan);
        return;
      }
      panelRuntime.applyPanelSpan(member, span);
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
        panelRuntime.applyPanelHeight(member, gridHeightForRows(rowSpan, gridGapForLayout(memberLayout)));
      }
      panelRuntime.applyPanelGridPosition(member, col, row);
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
        widgetRuntimeController.applySpan(member, nextSpan);
        widgetRuntimeController.applyGridPosition(member, nextCol, nextRow, nextRowSpan);
        if (member.classList.contains("widget-placeholder")) {
          member.style.height = `${gridHeightForRows(nextRowSpan, gridGapForLayout(groupItemLayout(member) || layout) || gap)}px`;
        }
      } else {
        panelRuntime.applyPanelSpan(member, nextSpan);
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
            panelRuntime.applyPanelHeight(member, nextHeight);
          }
        }
        panelRuntime.applyPanelGridPosition(member, nextCol, nextRow);
      }
      occupied.push({ item: member, bounds: gridBoundsForItem(member) });
    });
  };

