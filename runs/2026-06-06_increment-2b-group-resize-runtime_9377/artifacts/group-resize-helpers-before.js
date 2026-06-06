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

