const createTimerSlot = () => {
  let timer = null;
  return {
    clear() {
      window.clearTimeout(timer);
      timer = null;
    },
    set(value) {
      window.clearTimeout(timer);
      timer = value || null;
      return timer;
    },
  };
};

export const createWidgetToolSession = () => {
  const closeTimer = createTimerSlot();
  let suppressToolOpenUntil = 0;
  let suppressWidgetClickUntil = 0;
  let suppressSettingsClickUntil = 0;
  let ignoreToolLeaveCloseUntilPointerActivity = false;
  let toolsOpenedByApproach = false;

  return Object.freeze({
    clearCloseTimer: closeTimer.clear,
    getSuppressSettingsClickUntil: () => suppressSettingsClickUntil,
    getSuppressToolOpenUntil: () => suppressToolOpenUntil,
    getSuppressWidgetClickUntil: () => suppressWidgetClickUntil,
    getToolsOpenedByApproach: () => toolsOpenedByApproach,
    isIgnoringToolLeaveCloseUntilPointerActivity: () => ignoreToolLeaveCloseUntilPointerActivity,
    setCloseTimer: closeTimer.set,
    setIgnoreToolLeaveCloseUntilPointerActivity(value) {
      ignoreToolLeaveCloseUntilPointerActivity = Boolean(value);
    },
    setSuppressSettingsClickUntil(value) {
      suppressSettingsClickUntil = Number(value) || 0;
    },
    setSuppressToolOpenUntil(value) {
      suppressToolOpenUntil = Number(value) || 0;
    },
    setSuppressWidgetClickUntil(value) {
      suppressWidgetClickUntil = Number(value) || 0;
    },
    setToolsOpenedByApproach(value) {
      toolsOpenedByApproach = Boolean(value);
    },
  });
};

export const createPanelToolSession = () => {
  const toolsCloseTimer = createTimerSlot();
  let ignoreToolLeaveCloseUntilPointerActivity = false;
  let movedDuringPointer = false;
  let suppressToolOpenUntil = 0;
  let suppressHeaderToggleUntil = 0;
  let toolsOpenedByApproach = false;
  let toolPointerCapture = false;

  const setMovedDuringPointer = (value) => {
    movedDuringPointer = Boolean(value);
  };
  const getMovedDuringPointer = () => movedDuringPointer;
  const setSuppressToolOpenUntil = (value) => {
    suppressToolOpenUntil = Number(value) || 0;
  };
  const getSuppressToolOpenUntil = () => suppressToolOpenUntil;
  const setSuppressHeaderToggleUntil = (value) => {
    suppressHeaderToggleUntil = Number(value) || 0;
  };
  const getSuppressHeaderToggleUntil = () => suppressHeaderToggleUntil;
  const setToolsOpenedByApproach = (value) => {
    toolsOpenedByApproach = Boolean(value);
  };
  const getToolsOpenedByApproach = () => toolsOpenedByApproach;
  const setIgnoreToolLeaveCloseUntilPointerActivity = (value) => {
    ignoreToolLeaveCloseUntilPointerActivity = Boolean(value);
  };
  const isIgnoringToolLeaveCloseUntilPointerActivity = () => ignoreToolLeaveCloseUntilPointerActivity;
  const setToolPointerCapture = (value) => {
    toolPointerCapture = Boolean(value);
  };
  const isToolPointerCaptured = () => toolPointerCapture;

  return Object.freeze({
    clearToolsCloseTimer: toolsCloseTimer.clear,
    getMovedDuringPointer,
    getSuppressHeaderToggleUntil,
    getSuppressToolOpenUntil,
    getToolsOpenedByApproach,
    isIgnoringToolLeaveCloseUntilPointerActivity,
    isToolPointerCaptured,
    setIgnoreToolLeaveCloseUntilPointerActivity,
    setMovedDuringPointer,
    setSuppressHeaderToggleUntil,
    setSuppressToolOpenUntil,
    setToolPointerCapture,
    setToolsOpenedByApproach,
    setToolsCloseTimer: toolsCloseTimer.set,
  });
};

export const createResizeSessionGeometry = ({
  groupBox,
  initialPreviewEntries = [],
  initialReflowItems = [],
  initialRuntime = {},
  resizeParentPanelLayoutSnapshot = null,
  resizeStartSnapshot,
  startBounds,
  startHeight,
  startRects,
  startWidth,
} = {}) => {
  let previewCols = startWidth;
  let previewRows = startHeight;
  let previewEntries = initialPreviewEntries;
  let reflowItems = initialReflowItems;
  let runtime = initialRuntime;

  const previewMembers = () => previewEntries.map((entry) => entry.preview);
  const previewStartBounds = () => new Map(previewEntries.map((entry) => [entry.preview, startBounds.get(entry.member)]));
  const sourceForPreview = () => new Map(previewEntries.map((entry) => [entry.preview, entry.member]));
  const metricsForPreview = () => new Map(previewEntries.map((entry) => [entry.preview, entry.memberMetrics]));

  return Object.freeze({
    groupBox,
    resizeParentPanelLayoutSnapshot,
    resizeStartSnapshot,
    startBounds,
    startHeight,
    startRects,
    startWidth,
    getPreviewEntries: () => previewEntries,
    getPreviewCols: () => previewCols,
    getPreviewMembers: previewMembers,
    getPreviewRows: () => previewRows,
    getPreviewStartBounds: previewStartBounds,
    getReflowItems: () => reflowItems,
    getRuntime: () => runtime,
    getSourceForPreview: sourceForPreview,
    getMetricsForPreview: metricsForPreview,
    setPreviewEntries(entries) {
      previewEntries = entries || [];
    },
    setPreviewSize(cols, rows) {
      previewCols = cols;
      previewRows = rows;
    },
    setReflowItems(items) {
      reflowItems = items || [];
    },
    setRuntime(nextRuntime) {
      runtime = nextRuntime || {};
    },
  });
};
