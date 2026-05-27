(() => {
  const interactionState = window.dashboardInteractionState;
  const resizeLifecycleState = interactionState?.slot?.("activeResizeLifecycle");

  const noopAutoScroll = Object.freeze({
    update() {},
    stop() {},
    clearExtension() {},
  });

  const beginResizeLifecycle = ({
    event,
    source,
    layout = null,
    onMove,
    onEnd,
    onCleanup,
    beginInteractionAutoScroll,
    clearSurfaceResponse,
  } = {}) => {
    resizeLifecycleState?.get()?.cancel();
    const pointerTarget = event?.currentTarget || source;
    const interactionToken = interactionState?.beginInteraction?.("resize", {
      pointerId: event?.pointerId,
      pointerType: event?.pointerType,
      target: pointerTarget,
      clientX: event?.clientX,
      clientY: event?.clientY,
    });
    clearSurfaceResponse?.();
    if (interactionState?.state) {
      interactionState.state.activeResizeState = {
        layout,
        source,
        pointerId: event?.pointerId,
        startedAt: performance.now(),
      };
    }
    let ended = false;
    let lastMoveEvent = event;
    const autoScroll = beginInteractionAutoScroll?.({
      layout,
      onScrollFrame: (scrollEvent) => {
        if (ended || !lastMoveEvent) return;
        try {
          onMove?.(scrollEvent || lastMoveEvent);
        } catch (error) {
          fail(error, scrollEvent || lastMoveEvent);
        }
      },
    }) || noopAutoScroll;
    const pointerId = event?.pointerId;

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
        if (interactionState?.state) interactionState.state.activeResizeState = null;
        interactionToken?.end?.();
        if (resizeLifecycleState?.get()?.finish === finish) resizeLifecycleState.clear();
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
    const lifecycle = {
      finish,
      cancel: () => finish(null, true),
      interactionToken,
    };
    resizeLifecycleState?.set(lifecycle);
    return lifecycle;
  };

  window.dashboardResizeRuntime = Object.freeze({
    beginResizeLifecycle,
  });
})();
