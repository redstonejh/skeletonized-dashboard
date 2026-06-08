const rectSnapshot = (rect) => ({
  left: rect.left,
  right: rect.right,
  top: rect.top,
  bottom: rect.bottom,
  width: rect.width,
  height: rect.height,
});

export const stableElementRect = (element) => {
  if (!element?.isConnected || typeof element.getBoundingClientRect !== "function") return null;
  const rect = element.getBoundingClientRect();
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) return null;
  return rectSnapshot(rect);
};

export const objectMenuAnchorRect = (owner) => {
  const rect = stableElementRect(owner);
  if (!rect) return null;
  return {
    ...rect,
    left: rect.right,
    top: rect.top,
    bottom: rect.top,
    width: 0,
    height: 0,
  };
};

export const clampViewportCoord = (value, size, gutter) => {
  const max = Math.max(gutter, window.innerWidth - size - gutter);
  return Math.max(gutter, Math.min(value, max));
};

export const clampViewportTop = (value, size, gutter) => {
  const max = Math.max(gutter, window.innerHeight - size - gutter);
  return Math.max(gutter, Math.min(value, max));
};
