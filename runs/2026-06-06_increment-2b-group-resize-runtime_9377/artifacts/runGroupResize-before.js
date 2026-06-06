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
    const resizeSession = createResizeSessionGeometry({
      groupBox,
      resizeParentPanelLayoutSnapshot,
      resizeStartSnapshot,
      startBounds,
      startHeight,
      startRects,
      startWidth,
    });
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
    resizeSession.setPreviewEntries(previewEntries);
    const groupFootprint = createGroupFootprint(layout, groupBox, "dashboard-resize-preview dashboard-group-resize-footprint");
    const memberSet = new Set(members);
    resizeSession.setReflowItems(reflowItemsForLayout(layout, source).filter((item) => !memberSet.has(item)));
    resizeSession.setRuntime({ groupFootprint, resizeBoundary });
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
            : Math.max(panelRuntime.getPanelMinimumHeight(entry.member), gridHeightForRows(liveRows, entry.memberMetrics.gap));
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
      if (nextCols === resizeSession.getPreviewCols() && nextRows === resizeSession.getPreviewRows()) return;
      resizeSession.setPreviewSize(nextCols, nextRows);
      animateOrderedGridReflow(layout, () => {
        applyGroupFootprintBounds(groupFootprint.footprint, groupFootprint.footprintLayout, {
          col: groupBox.col,
          row: groupBox.row,
          span: nextCols,
          rowSpan: nextRows,
        }, metricsForLayout(groupFootprint.footprintLayout));
        applyGroupResizeLayout(layout, resizeSession.getPreviewMembers(), resizeSession.getPreviewStartBounds(), groupBox, nextCols / startWidth, nextRows / startHeight, {
          sourceForMember: resizeSession.getSourceForPreview(),
          metricsForMember: resizeSession.getMetricsForPreview(),
          collision: false,
        });
        resolveSparseGridLayoutForActiveItems(layout, resizeSession.getPreviewMembers(), {
          afterOnly: true,
          metrics: layoutMetrics,
          exclude: [groupFootprint.footprint],
          items: resizeSession.getReflowItems(),
        });
        if (resizeParentPanel) syncOpenPanelHeightToInternalGrid(resizeParentPanel, { includePlaceholders: true });
      }, source, { items: resizeSession.getReflowItems(), metrics: layoutMetrics });
    };

    const finishResize = (upEvent, canceled) => {
      if (canceled) {
        restoreGridLayoutSnapshot(resizeSession.resizeStartSnapshot);
        if (resizeSession.resizeParentPanelLayoutSnapshot) restoreGridLayoutSnapshot(resizeSession.resizeParentPanelLayoutSnapshot);
      } else {
        animateOrderedGridReflow(layout, () => {
          previewEntries.forEach((entry) => entry.expandedGhost?.remove());
          restoreGridLayoutSnapshot(resizeSession.resizeStartSnapshot);
          applyGroupFootprintBounds(groupFootprint.footprint, groupFootprint.footprintLayout, {
            col: groupBox.col,
            row: groupBox.row,
            span: resizeSession.getPreviewCols(),
            rowSpan: resizeSession.getPreviewRows(),
          }, metricsForLayout(groupFootprint.footprintLayout));
          applyGroupResizeLayout(layout, resizeSession.getPreviewMembers(), resizeSession.getPreviewStartBounds(), groupBox, resizeSession.getPreviewCols() / startWidth, resizeSession.getPreviewRows() / startHeight, {
            sourceForMember: resizeSession.getSourceForPreview(),
            metricsForMember: resizeSession.getMetricsForPreview(),
            collision: false,
          });
          resolveSparseGridLayoutForActiveItems(layout, resizeSession.getPreviewMembers(), {
            afterOnly: true,
            metrics: layoutMetrics,
            exclude: [groupFootprint.footprint],
            items: resizeSession.getReflowItems(),
          });
          commitGroupResizeFromPreviews(previewEntries, layout);
          previewEntries.forEach((entry) => entry.preview.remove());
          groupFootprint.footprint.remove();
          previewEntries.forEach((entry) => clearLiveResizeSurface(entry.member, entry.live));
          if (resizeParentPanel) syncOpenPanelHeightToInternalGrid(resizeParentPanel);
        }, source, { items: resizeSession.getReflowItems(), metrics: layoutMetrics });
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
