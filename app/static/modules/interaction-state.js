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
  return Object.freeze({
    clearCloseTimer: closeTimer.clear,
    setCloseTimer: closeTimer.set,
  });
};

export const createPanelToolSession = () => {
  const toolsCloseTimer = createTimerSlot();
  let movedDuringPointer = false;
  let suppressHeaderToggleUntil = 0;
  let toolPointerCapture = false;

  const setMovedDuringPointer = (value) => {
    movedDuringPointer = Boolean(value);
  };
  const getMovedDuringPointer = () => movedDuringPointer;
  const setSuppressHeaderToggleUntil = (value) => {
    suppressHeaderToggleUntil = Number(value) || 0;
  };
  const getSuppressHeaderToggleUntil = () => suppressHeaderToggleUntil;
  const setToolPointerCapture = (value) => {
    toolPointerCapture = Boolean(value);
  };
  const isToolPointerCaptured = () => toolPointerCapture;

  return Object.freeze({
    clearToolsCloseTimer: toolsCloseTimer.clear,
    getMovedDuringPointer,
    getSuppressHeaderToggleUntil,
    isToolPointerCaptured,
    setMovedDuringPointer,
    setSuppressHeaderToggleUntil,
    setToolPointerCapture,
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
