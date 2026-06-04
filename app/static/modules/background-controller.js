export function initializeBackgroundController({ portalFloatingMenu, restoreFloatingMenu, originalMenuParent }) {
  const closeBackgroundToneMenu = (menu) => {
    if (!menu) return;
    const popover = menu.querySelector(".background-tone-popover") || document.querySelector(".workspace-menu-overlay-layer > .background-tone-popover");
    popover?.classList.remove("open");
    restoreFloatingMenu(popover);
    menu.removeAttribute("open");
  };
  const linearizeChannel = (value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  const parseRgbFromColorValue = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    if (trimmed.startsWith("#")) {
      const hex = trimmed.replace("#", "");
      if (hex.length === 3 || hex.length === 4) {
        const normalized = hex
          .split("")
          .slice(0, 3)
          .map((digit) => parseInt(`${digit}${digit}`, 16))
          .filter((number) => !Number.isNaN(number));
        if (normalized.length !== 3) return null;
        return { r: normalized[0], g: normalized[1], b: normalized[2] };
      }
      if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;
        return { r, g, b };
      }
      return null;
    }
    const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)/);
    if (!rgbMatch) return null;
    const channels = rgbMatch[1]
      .split(",")
      .slice(0, 3)
      .map((channel) => parseFloat(channel.trim()))
      .filter((channel) => Number.isFinite(channel));
    if (channels.length !== 3) return null;
    return {
      r: Math.max(0, Math.min(255, channels[0])),
      g: Math.max(0, Math.min(255, channels[1])),
      b: Math.max(0, Math.min(255, channels[2])),
    };
  };
  const computeRelativeLuminance = (color) => {
    if (!color) return 0;
    const { r, g, b } = color;
    const linearR = linearizeChannel(r);
    const linearG = linearizeChannel(g);
    const linearB = linearizeChannel(b);
    return (0.2126 * linearR) + (0.7152 * linearG) + (0.0722 * linearB);
  };
  const clamp01 = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric <= 0) return 0;
    if (numeric >= 1) return 1;
    return numeric;
  };
  const getBackgroundThemeRoots = () => {
    const roots = [document.documentElement, document.body];
    return roots.filter((element) => element instanceof HTMLElement);
  };
  const backgroundToneLuminanceCache = new Map();
  const backgroundTonePaletteCache = new Map();
  const getBackgroundTonePalette = (tone) => {
    if (!tone) return null;
    if (backgroundTonePaletteCache.has(tone)) return backgroundTonePaletteCache.get(tone);
    const option = document.querySelector(`.background-tone-option[data-background-tone="${tone}"]`);
    if (!option) {
      backgroundTonePaletteCache.set(tone, null);
      return null;
    }
    const optionStyle = getComputedStyle(option);
    const bg = optionStyle.getPropertyValue("--tone-swatch-start")?.trim();
    const bgEnd = optionStyle.getPropertyValue("--tone-swatch-end")?.trim();
    const palette = bg ? { bg, bgEnd: bgEnd || bg } : null;
    backgroundTonePaletteCache.set(tone, palette);
    return palette;
  };
  const getBackgroundToneLuminance = (button) => {
    const tone = button?.dataset?.backgroundTone || "";
    if (!tone) return 0;
    if (backgroundToneLuminanceCache.has(tone)) return backgroundToneLuminanceCache.get(tone);
    const buttonStyle = getComputedStyle(button);
    const toneColor = parseRgbFromColorValue(buttonStyle.getPropertyValue("--tone-swatch-start")) || parseRgbFromColorValue(buttonStyle.getPropertyValue("--tone-swatch-end"));
    const computed = toneColor ? computeRelativeLuminance(toneColor) : 0;
    backgroundToneLuminanceCache.set(tone, computed);
    return computed;
  };
  // Adaptive material compensation was removed: objects now use one stable
  // material recipe regardless of background luminance. The fixed default
  // values in tokens.css for --workspace-bg-luminance,
  // --workspace-bg-darkness, --surface-exposure-compensation,
  // --surface-white-mix-compensation, --surface-saturation-compensation,
  // and --surface-glass-alpha are the single source of truth. This
  // function is kept as a no-op so existing call sites stay valid; no
  // adaptive vars are written.
  const setBackgroundExposureCompensation = () => {};
  // ── Photo / image background system ───────────────────────────────
  const PHOTO_BACKGROUNDS = {
    "photo-bark":        { src: "app/static/backgrounds/nature/bark.jpg",        luminance: 0.08 },
    "photo-cloud":       { src: "app/static/backgrounds/nature/cloud.jpg",       luminance: 0.70 },
    "photo-jungle":      { src: "app/static/backgrounds/nature/jungle.jpg",      luminance: 0.06 },
    "photo-moss":        { src: "app/static/backgrounds/nature/moss.jpg",        luminance: 0.10 },
    "photo-sand":        { src: "app/static/backgrounds/nature/sand.jpg",        luminance: 0.65 },
    "photo-shore":       { src: "app/static/backgrounds/nature/shore.jpg",       luminance: 0.42 },
    "photo-turf":        { src: "app/static/backgrounds/nature/turf.jpg",        luminance: 0.12 },
    "photo-water":       { src: "app/static/backgrounds/nature/water.jpg",       luminance: 0.08 },
    "photo-water2":      { src: "app/static/backgrounds/nature/water2.jpg",      luminance: 0.58 },
    "photo-denim":       { src: "app/static/backgrounds/textures/denim.jpg",     luminance: 0.08 },
    "photo-marble":      { src: "app/static/backgrounds/textures/marble.jpg",    luminance: 0.72 },
    "photo-leather":     { src: "app/static/backgrounds/textures/leather.jpg",   luminance: 0.22 },
    "photo-texture":     { src: "app/static/backgrounds/textures/texture.jpg",   luminance: 0.55 },
    "photo-paint":       { src: "app/static/backgrounds/abstract/paint.jpg",     luminance: 0.50 },
    "photo-paintspill":  { src: "app/static/backgrounds/abstract/paintspill.jpg",luminance: 0.05 },
    "photo-city":        { src: "app/static/backgrounds/urban/city.jpg",         luminance: 0.04 },
    "photo-modern":      { src: "app/static/backgrounds/urban/modern.jpg",       luminance: 0.40 },
    "photo-mercury":     { src: "app/static/backgrounds/space/mercury.jpg",      luminance: 0.04 },
    "photo-venus":       { src: "app/static/backgrounds/space/venus.jpg",        luminance: 0.12 },
    "photo-earth":       { src: "app/static/backgrounds/space/earth.jpg",        luminance: 0.06 },
    "photo-mars":        { src: "app/static/backgrounds/space/mars.jpg",         luminance: 0.08 },
    "photo-jupiter":     { src: "app/static/backgrounds/space/jupiter.jpg",      luminance: 0.12 },
    "photo-saturn":      { src: "app/static/backgrounds/space/saturn.jpg",       luminance: 0.06 },
    "photo-uranus":      { src: "app/static/backgrounds/space/uranus.jpg",       luminance: 0.10 },
    "photo-neptune":     { src: "app/static/backgrounds/space/neptune.jpg",      luminance: 0.08 },
    "photo-pluto":       { src: "app/static/backgrounds/space/pluto.jpg",        luminance: 0.06 },
    "solar-system":      { luminance: 0.06, solarSystem: true },
  };
  const SOLAR_SYSTEM_SEQUENCE = [
    "app/static/backgrounds/space/mercury.jpg",
    "app/static/backgrounds/space/venus.jpg",
    "app/static/backgrounds/space/earth.jpg",
    "app/static/backgrounds/space/mars.jpg",
    "app/static/backgrounds/space/jupiter.jpg",
    "app/static/backgrounds/space/saturn.jpg",
    "app/static/backgrounds/space/uranus.jpg",
    "app/static/backgrounds/space/neptune.jpg",
    "app/static/backgrounds/space/pluto.jpg",
  ];
  const isPhotoTone = (tone) => tone && (tone.startsWith("photo-") || tone === "solar-system");
  const getPhotoImages = (tone) =>
    tone === "solar-system"
      ? [...SOLAR_SYSTEM_SEQUENCE]
      : (PHOTO_BACKGROUNDS[tone]?.src ? [PHOTO_BACKGROUNDS[tone].src] : []);
  
  let photoBackdropEl = null;
  let photoTrackEl = null;
  let photoScrollHandler = null;
  let photoResizeObserver = null;
  let photoPanelCount = 0;
  let photoCurrentTone = null;
  let photoCurrentImages = [];
  
  const photoEnsurePanel = (panelIndex) => {
    if (!photoTrackEl || !photoCurrentImages.length) return;
    const src = photoCurrentImages[panelIndex % photoCurrentImages.length];
    const panel = document.createElement("div");
    panel.className = "workspace-photo-panel";
    panel.style.backgroundImage = `url("${src}")`;
    photoTrackEl.appendChild(panel);
    photoPanelCount++;
  };
  
  const photoEnsureEnoughPanels = () => {
    if (!photoTrackEl) return;
    const vh = window.innerHeight || 1;
    const needed = Math.max(3, Math.ceil((window.scrollY + vh * 3) / vh));
    while (photoPanelCount < needed) photoEnsurePanel(photoPanelCount);
  };
  
  const photoSyncScroll = () => {
    if (!photoTrackEl) return;
    photoTrackEl.style.transform = `translateY(${-window.scrollY}px)`;
    photoEnsureEnoughPanels();
  };
  
  const applyPhotoBackground = (tone) => {
    const meta = PHOTO_BACKGROUNDS[tone];
    if (!meta) return;
    const newImages = getPhotoImages(tone);
    const toneChanged = tone !== photoCurrentTone;
    if (toneChanged) {
      if (photoTrackEl) photoTrackEl.replaceChildren();
      photoPanelCount = 0;
      photoCurrentTone = tone;
      photoCurrentImages = newImages;
    }
    if (!photoBackdropEl) {
      photoBackdropEl = document.createElement("div");
      photoBackdropEl.className = "workspace-photo-backdrop";
      photoBackdropEl.setAttribute("aria-hidden", "true");
      photoTrackEl = document.createElement("div");
      photoTrackEl.className = "workspace-photo-track";
      photoBackdropEl.appendChild(photoTrackEl);
      document.body.insertBefore(photoBackdropEl, document.body.firstChild);
    }
    photoBackdropEl.hidden = false;
    if (!photoScrollHandler) {
      photoScrollHandler = () => photoSyncScroll();
      window.addEventListener("scroll", photoScrollHandler, { passive: true });
    }
    if (!photoResizeObserver) {
      photoResizeObserver = new ResizeObserver(() => photoEnsureEnoughPanels());
      photoResizeObserver.observe(document.documentElement);
    }
    document.documentElement.classList.add("has-photo-background");
    document.body.classList.add("has-photo-background");
    // Adaptive material vars intentionally NOT written here. Photo
    // backgrounds use the same fixed token values as solid backgrounds;
    // photo-specific glass comes from the body.has-photo-background CSS
    // block in themes.css with its own fixed tokens.
    photoEnsureEnoughPanels();
    photoSyncScroll();
  };
  
  const destroyPhotoBackground = () => {
    if (photoScrollHandler) {
      window.removeEventListener("scroll", photoScrollHandler, { passive: true });
      photoScrollHandler = null;
    }
    if (photoResizeObserver) {
      photoResizeObserver.disconnect();
      photoResizeObserver = null;
    }
    photoBackdropEl?.remove();
    photoBackdropEl = null;
    photoTrackEl = null;
    photoPanelCount = 0;
    photoCurrentTone = null;
    photoCurrentImages = [];
    document.documentElement.classList.remove("has-photo-background");
    document.body.classList.remove("has-photo-background");
  };
  
  const sortBackgroundToneMenuOptionsByBrightness = () => {
    document.querySelectorAll(".background-tone-menu").forEach((menu) => {
      const popover = menu.querySelector(".background-tone-popover");
      if (!popover) return;
      const options = [...popover.querySelectorAll(".background-tone-option")];
      if (!options.length) return;
      const sortedOptions = options.sort((a, b) => {
        const aLuminance = getBackgroundToneLuminance(a);
        const bLuminance = getBackgroundToneLuminance(b);
        if (aLuminance === bLuminance) return 0;
        return bLuminance - aLuminance;
      });
      const groups = [...popover.querySelectorAll(".background-tone-group")];
      const primaryGroup = groups[0] || (() => {
        const fallbackGroup = document.createElement("div");
        fallbackGroup.className = "background-tone-group";
        popover.appendChild(fallbackGroup);
        return fallbackGroup;
      })();
      const groupLabel = primaryGroup.querySelector(".background-tone-label");
      if (groupLabel) {
        primaryGroup.replaceChildren(groupLabel);
      } else {
        primaryGroup.replaceChildren();
      }
      sortedOptions.forEach((option) => {
        primaryGroup.appendChild(option);
      });
      groups.slice(1).forEach((group) => group.remove());
    });
  };
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
    const themeRoots = getBackgroundThemeRoots();
    const selectedTone = options.preview ? savedBackgroundTone() : tone;
    const syncSelectionUI = (activeTone) => {
      document.querySelectorAll(".background-tone-option, .background-photo-option").forEach((btn) => {
        const sel = btn.dataset.backgroundTone === activeTone;
        btn.classList.toggle("is-selected", sel);
        btn.setAttribute("aria-pressed", sel.toString());
      });
      document.querySelectorAll(".background-tone-trigger").forEach((trigger) => {
        trigger.setAttribute("aria-label", `Workspace background: ${(activeTone || tone).replace(/-/g, " ")}`);
      });
    };
  
    if (isPhotoTone(tone)) {
      themeRoots.forEach((root) => { root.dataset.background = tone; });
      applyPhotoBackground(tone);
      syncSelectionUI(selectedTone);
      return;
    }
  
    // Color tone — hide backdrop during preview (cheap), destroy on commit (clean).
    if (photoBackdropEl) {
      if (options.preview) {
        photoBackdropEl.hidden = true;
        document.documentElement.classList.remove("has-photo-background");
        document.body.classList.remove("has-photo-background");
      } else {
        destroyPhotoBackground();
      }
    }
  
    const palette = getBackgroundTonePalette(tone);
    if (palette?.bg) {
      themeRoots.forEach((themeRoot) => {
        themeRoot.style.setProperty("--bg", palette.bg);
        themeRoot.style.setProperty("--bg-end", palette.bgEnd || palette.bg);
      });
    }
    if (tone) {
      themeRoots.forEach((themeRoot) => {
        themeRoot.dataset.background = tone;
      });
    } else {
      themeRoots.forEach((themeRoot) => {
        delete themeRoot.dataset.background;
      });
    }
    setBackgroundExposureCompensation(tone, palette, themeRoots);
    syncSelectionUI(selectedTone);
  };
  sortBackgroundToneMenuOptionsByBrightness();
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
  document.querySelectorAll(".background-tone-option, .background-photo-option").forEach((button) => {
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
      const toneMenu = button.closest(".background-tone-menu") ||
        originalMenuParent(button.closest(".background-tone-popover"));
      closeBackgroundToneMenu(toneMenu);
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
    const trigger = menu.querySelector(".background-tone-trigger");
    const popover = menu.querySelector(".background-tone-popover");
    menu.addEventListener("toggle", () => {
      if (menu.open) {
        popover?.classList.add("open");
        portalFloatingMenu(popover, trigger, { align: "right", offset: 8 });
        return;
      }
      revertBackgroundPreview();
      popover?.classList.remove("open");
      restoreFloatingMenu(popover);
    });
    popover?.addEventListener("pointerdown", (event) => event.stopPropagation());
    popover?.addEventListener("click", (event) => event.stopPropagation());
    popover?.addEventListener("pointerleave", revertBackgroundPreview);
    popover?.addEventListener("focusout", (event) => {
      if (event.relatedTarget && popover.contains(event.relatedTarget)) return;
      revertBackgroundPreview();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!menu.open) return;
      if (menu.contains(event.target) || popover?.contains(event.target)) return;
      closeBackgroundToneMenu(menu);
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeBackgroundToneMenu(menu);
    });
  });
  
}
