(() => {
  const interactionState = window.dashboardInteractionState;
  const interactionAutoScrollState = interactionState?.slot?.("activeAutoScroll");

  const beginInteractionAutoScroll = ({ layout = null, onScrollFrame, gridHostForLayout } = {}) => {
    interactionAutoScrollState?.get()?.stop();
    const edgeZone = 104;
    const edgeDeadZone = 22;
    const topBrakeDistance = edgeZone * 2.25;
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
    const host = layout && typeof gridHostForLayout === "function" ? gridHostForLayout(layout) : null;
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
    const topDistancePressure = (scrollY) => {
      if (scrollY <= 0) return 0;
      return Math.max(0, Math.min(1, scrollY / topBrakeDistance));
    };
    const bottomEdgePressure = () => edgePressure(window.innerHeight - lastClientY);
    const topEdgePressure = () => edgePressure(lastClientY);
    const hasEdgePressure = () => (lastClientY < edgeZone && window.scrollY > 0) || bottomEdgePressure() > 0;
    const targetVelocityForPointer = () => {
      if (lastClientY < edgeZone && window.scrollY > 0) {
        const pressure = topEdgePressure();
        if (!pressure) return 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const distancePressure = topDistancePressure(scrollY);
        const easedDistancePressure = distancePressure * distancePressure * (3 - (2 * distancePressure));
        const baseVelocity = minVelocity + ((maxVelocity - minVelocity) * pressure * pressure * pressure);
        const brakedVelocity = minVelocity + ((baseVelocity - minVelocity) * easedDistancePressure);
        return -Math.min(baseVelocity, brakedVelocity);
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
      const maxUpwardDelta = () => {
        const distancePressure = topDistancePressure(before);
        const allowedVelocity = minVelocity + ((maxVelocity - minVelocity) * distancePressure);
        return Math.max(1, allowedVelocity * (deltaMs / 1000));
      };
      const boundedDelta = requestedDelta < 0
        ? Math.max(requestedDelta, -before, -maxUpwardDelta())
        : Math.min(requestedDelta, maxScrollY() - before);
      window.scrollBy(0, boundedDelta);
      const after = window.scrollY || document.documentElement.scrollTop || 0;
      const actualDelta = after - before;
      const atScrollLimit = (boundedDelta < 0 && after <= 0) || (boundedDelta > 0 && after >= maxScrollY() - .5);
      scrollRemainderY = atScrollLimit ? 0 : Math.max(-1.5, Math.min(1.5, boundedDelta - actualDelta));
      if (Math.abs(after - before) > 0.1) {
        const scrollPointerEvent = {
          type: "autoscroll",
          buttons: lastEvent?.buttons ?? 1,
          clientX: lastClientX,
          clientY: lastClientY,
          pointerId: lastEvent?.pointerId,
          pointerType: lastEvent?.pointerType,
          timeStamp: frameTime,
          preventDefault() {},
          stopPropagation() {},
        };
        onScrollFrame?.(scrollPointerEvent, {
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
        interactionAutoScrollState?.clear(controller);
      },
    };
    interactionAutoScrollState?.set(controller);
    return controller;
  };

  const createPointerDragController = ({ event, item, mode = "drag" } = {}) => {
    const pointerId = event?.pointerId;
    const pointerTarget = event?.currentTarget || item;
    let interactionToken = null;
    let installed = null;

    const capturePointer = () => {
      if (pointerId == null || pointerTarget?.hasPointerCapture?.(pointerId)) return;
      try {
        pointerTarget?.setPointerCapture?.(pointerId);
      } catch {
        // Document-level listeners still cover browsers that decline capture.
      }
    };

    const releasePointer = () => {
      if (pointerId == null || !pointerTarget?.hasPointerCapture?.(pointerId)) return;
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already be released by the browser during cancel.
      }
    };

    const beginInteraction = ({ layout = null, clientX = event?.clientX, clientY = event?.clientY } = {}) => {
      if (interactionToken) return interactionToken;
      interactionToken = interactionState?.beginInteraction?.(mode, {
        pointerId,
        pointerType: event?.pointerType,
        target: pointerTarget,
        clientX,
        clientY,
      });
      if (interactionState?.state) {
        interactionState.state.activeDragState = {
          layout,
          item,
          pointerId,
          startedAt: performance.now(),
        };
      }
      return interactionToken;
    };

    const endInteraction = () => {
      if (interactionState?.state?.activeDragState?.item === item) {
        interactionState.state.activeDragState = null;
      }
      interactionToken?.end?.();
      interactionToken = null;
    };

    const removeListeners = () => {
      if (!installed) return;
      document.removeEventListener("pointermove", installed.onMove);
      document.removeEventListener("pointerup", installed.onPointerEnd);
      document.removeEventListener("pointercancel", installed.onPointerEnd);
      document.removeEventListener("keydown", installed.onKeydown);
      window.removeEventListener("blur", installed.onBlur);
      pointerTarget?.removeEventListener?.("lostpointercapture", installed.onLostPointerCapture);
      installed = null;
    };

    const install = ({ onMove, onPointerEnd, onKeydown, onBlur, onLostPointerCapture } = {}) => {
      removeListeners();
      installed = { onMove, onPointerEnd, onKeydown, onBlur, onLostPointerCapture };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onPointerEnd);
      document.addEventListener("pointercancel", onPointerEnd);
      document.addEventListener("keydown", onKeydown);
      window.addEventListener("blur", onBlur);
      pointerTarget?.addEventListener?.("lostpointercapture", onLostPointerCapture);
    };

    return {
      pointerId,
      pointerTarget,
      beginInteraction,
      capturePointer,
      endInteraction,
      install,
      releasePointer,
      removeListeners,
    };
  };

  window.dashboardDragRuntime = Object.freeze({
    beginInteractionAutoScroll,
    createPointerDragController,
  });
})();
