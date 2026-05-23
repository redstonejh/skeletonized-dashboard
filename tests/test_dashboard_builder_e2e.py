import math
import re
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect


pytestmark = pytest.mark.e2e


def goto(page: Page, base_url: str, path: str = "/dashboard") -> None:
    page.goto(f"{base_url}{path}", wait_until="networkidle")
    page.wait_for_selector(".page")


def assert_clean_browser(page: Page) -> None:
    assert page.console_errors == []
    assert page.page_errors == []
    assert page.network_errors == []


def box_center(box: dict[str, float]) -> tuple[float, float]:
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def drag_by(page: Page, locator, dx: float, dy: float, steps: int = 12) -> None:
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    assert box, f"No bounding box for {locator}"
    x, y = box_center(box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx, y + dy, steps=steps)
    page.mouse.up()


def begin_drag(page: Page, locator, dx: float, dy: float, steps: int = 8) -> tuple[float, float]:
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    assert box, f"No bounding box for {locator}"
    x, y = box_center(box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx, y + dy, steps=steps)
    return x + dx, y + dy


def end_drag(page: Page, x: float, y: float, dx: float, dy: float, steps: int = 8) -> None:
    page.mouse.move(x + dx, y + dy, steps=steps)
    page.mouse.up()


def open_tools(item) -> None:
    item.locator(".panel-settings-toggle").click(force=True)
    expect(item.locator(".panel-tool-drawer")).to_be_visible()


def close_dialog_if_open(page: Page) -> None:
    dialog = page.locator("#panel-delete-dialog")
    if dialog.evaluate("node => Boolean(node.open)"):
        page.locator(".confirm-dialog-cancel").click()


def add_panel_for_setup(page: Page):
    page.locator('.panel-add-action[data-panel-kind="panel"]').evaluate("node => node.click()")
    panel = page.locator('.panel-layout > .db-panel[data-custom-panel="true"]').last
    expect(panel).to_be_visible()
    return panel


def add_widget_for_setup(page: Page):
    page.locator('.widget-add-action[data-widget-kind="stat"]').evaluate("node => node.click()")
    widget = page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').last
    expect(widget).to_be_visible()
    return widget


def no_visible_overlaps(page: Page, selector: str) -> list[tuple[int, int]]:
    return page.locator(selector).evaluate_all(
        """
        nodes => {
          const boxes = nodes
            .filter(node => !node.hidden && getComputedStyle(node).display !== "none")
            .map((node, index) => {
              const rect = node.getBoundingClientRect();
              return { index, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            });
          const overlaps = [];
          for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
              const a = boxes[i];
              const b = boxes[j];
              const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (width > 2 && height > 2) overlaps.push([a.index, b.index]);
            }
          }
          return overlaps;
        }
        """
    )


def grid_alignment_error(page: Page, item_selector: str) -> float:
    return page.evaluate(
        """
        ({ itemSelector }) => {
          const item = document.querySelector(itemSelector);
          const grid = document.querySelector(".dashboard-layout-grid");
          if (!item || !grid) return 999;
          const itemRect = item.getBoundingClientRect();
          const gridRect = grid.getBoundingClientRect();
          const styles = getComputedStyle(grid);
          const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
          const columns = styles.gridTemplateColumns.split(" ").map(value => parseFloat(value)).filter(Number.isFinite);
          const starts = [];
          let x = gridRect.left;
          columns.forEach((width) => {
            starts.push(x);
            x += width + gap;
          });
          return Math.min(...starts.map(start => Math.abs(start - itemRect.left)));
        }
        """,
        {"itemSelector": item_selector},
    )


def visual_grid_items(page: Page, selector: str) -> list[dict]:
    return page.locator(selector).evaluate_all(
        """
        nodes => nodes
          .filter(node => !node.hidden && getComputedStyle(node).display !== "none")
          .map(node => ({
            text: node.textContent.trim().replace(/\\s+/g, " "),
            col: Number(node.dataset.gridCol || 0),
            row: Number(node.dataset.gridRow || 0),
            span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 1),
            rect: node.getBoundingClientRect().toJSON(),
          }))
          .sort((a, b) => a.row - b.row || a.col - b.col)
        """
    )


def grid_item_state(page: Page, selector: str) -> dict:
    return page.locator(selector).first.evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          return {
            col: Number(node.dataset.gridCol || 0),
            row: Number(node.dataset.gridRow || 0),
            span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 1),
            rowSpan: Number(node.dataset.gridRowSpan || 1),
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };
        }
        """
    )


def grid_item_states(page: Page, selector: str) -> list[dict]:
    return page.locator(selector).evaluate_all(
        """
        nodes => nodes.map(node => ({
          key: node.dataset.widgetKey || node.dataset.panelKey || node.textContent.trim().replace(/\\s+/g, " "),
          type: node.classList.contains("widget-card") ? "widget" : "panel",
          col: Number(node.dataset.gridCol || 0),
          row: Number(node.dataset.gridRow || 0),
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 1),
          rowSpan: Number(node.dataset.gridRowSpan || 1),
          pinned: node.classList.contains("db-panel-pinned"),
          collapsed: node.classList.contains("db-panel-collapsed"),
        }))
        """
    )


def test_app_dashboard_settings_and_assets_load(page: Page, app_server: str) -> None:
    goto(page, app_server, "/")
    expect(page).to_have_title(re.compile("Configurable Dashboard Builder"))
    expect(page.locator(".dashboard-layout-grid")).to_be_visible()
    expect(page.locator(".app-nav")).to_be_visible()

    css_loaded = page.evaluate(
        """
        () => [...document.styleSheets]
          .filter(sheet => sheet.href && sheet.href.includes("/static/"))
          .map(sheet => sheet.href)
        """
    )
    assert any(href.endswith("/static/style.css?v=dashboard-builder") for href in css_loaded)

    goto(page, app_server, "/settings")
    expect(page.locator("#settings-form")).to_be_visible()
    expect(page.locator(".settings-save-bar")).to_be_visible()
    assert_clean_browser(page)


def test_add_panel_menu_actions_are_pointer_clickable(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.locator(".panel-add-button").click()
    expect(page.locator(".panel-add-menu")).to_have_class(re.compile("open"))
    page.locator('.panel-add-action[data-panel-kind="panel"]').click()
    expect(page.locator('.panel-layout > .db-panel[data-custom-panel="true"]')).to_have_count(1)
    assert_clean_browser(page)


def test_theme_toggle_persists(page: Page, app_server: str) -> None:
    goto(page, app_server)
    root = page.locator("html")
    expect(root).not_to_have_attribute("data-theme", "dark")

    page.locator(".theme-toggle").click()
    expect(root).to_have_attribute("data-theme", "dark")
    assert page.evaluate("localStorage.getItem('dashboard-theme')") == "dark"

    page.reload(wait_until="networkidle")
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")

    page.locator(".theme-toggle").click()
    expect(page.locator("html")).not_to_have_attribute("data-theme", "dark")
    assert_clean_browser(page)


def test_background_presets_and_secondary_surfaces_share_glass_language(page: Page, app_server: str) -> None:
    goto(page, app_server)
    artifact_dir = Path("test-results") / "workspace-visual-language"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    page.locator(".background-tone-trigger").first.click()
    expect(page.locator('.background-tone-option[data-background-tone="cool-grey"]').first).to_be_visible()
    expect(page.locator('.background-tone-option[data-background-tone="graphite-light"]').first).to_be_visible()
    swatch = page.locator('.background-tone-option[data-background-tone="graphite-light"]').first.evaluate(
        """
        node => {
          const before = getComputedStyle(node, "::before");
          return {
            width: parseFloat(before.width),
            height: parseFloat(before.height),
            background: before.backgroundImage,
          };
        }
        """
    )
    assert swatch["width"] >= 10
    assert swatch["height"] >= 10
    assert swatch["background"] != "none"
    page.locator('.background-tone-option[data-background-mode="light"][data-background-tone="graphite-light"]').first.click()
    expect(page.locator("html")).to_have_attribute("data-background", "graphite-light")
    assert page.evaluate("localStorage.getItem('dashboard-background-light')") == "graphite-light"
    page.screenshot(path=str(artifact_dir / "dashboard-light-graphite-light.png"), full_page=True)

    palette_styles = page.evaluate(
        """
        () => {
          const toRgb = (value) => {
            const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
            if (hex) {
              return [0, 2, 4].map((start) => parseInt(hex[1].slice(start, start + 2), 16));
            }
            const rgb = value.match(/rgba?\\(([^)]+)\\)/);
            if (rgb) {
              return rgb[1].split(/[\\s,\\/]+/).filter(Boolean).slice(0, 3).map((part) => Math.round(Number(part)));
            }
            return [];
          };
          const root = getComputedStyle(document.documentElement);
          const nav = getComputedStyle(document.querySelector(".app-nav"));
          const panel = getComputedStyle(document.querySelector(".db-panel"));
          return {
            bg: toRgb(root.getPropertyValue("--bg")),
            glassBorder: toRgb(root.getPropertyValue("--glass-border")),
            navBackground: nav.backgroundImage,
            navBorder: toRgb(nav.borderTopColor),
            panelBackground: panel.backgroundColor,
            panelBorder: toRgb(panel.borderTopColor),
          };
        }
        """
    )
    assert max(palette_styles["bg"]) <= 214
    assert palette_styles["navBackground"] != "none"
    assert palette_styles["panelBackground"] != "rgba(0, 0, 0, 0)"
    assert palette_styles["panelBorder"] != palette_styles["bg"]
    if palette_styles["glassBorder"]:
        assert max(palette_styles["glassBorder"]) <= 190

    page.locator(".panel-add-button").click()
    expect(page.locator(".panel-add-menu")).to_have_class(re.compile("open"))
    page.locator(".panel-add-menu").screenshot(path=str(artifact_dir / "dashboard-add-menu-glass.png"))

    goto(page, app_server, "/settings")
    expect(page.locator("#settings-form")).to_be_visible()
    expect(page.locator('.background-tone-option[data-background-tone="stone-slate"]').first).to_be_attached()
    page.screenshot(path=str(artifact_dir / "settings-light-graphite-light.png"), full_page=True)
    light_styles = page.evaluate(
        """
        () => {
          const section = document.querySelector(".form-section");
          const input = document.querySelector(".form-grid input");
          const save = document.querySelector(".settings-save-bar");
          const read = (node) => {
            const styles = getComputedStyle(node);
            return {
              background: styles.backgroundColor,
              border: styles.borderColor,
              radius: parseFloat(styles.borderTopLeftRadius),
              shadow: styles.boxShadow,
            };
          };
          return { section: read(section), input: read(input), save: read(save) };
        }
        """
    )
    assert light_styles["section"]["radius"] >= 20
    assert light_styles["input"]["radius"] >= 14
    assert light_styles["section"]["shadow"] != "none"
    assert light_styles["input"]["shadow"] != "none"
    assert light_styles["save"]["shadow"] != "none"

    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    page.locator(".background-tone-trigger").first.click()
    expect(page.locator('.background-tone-option[data-background-tone="soft-charcoal"]').first).to_be_visible()
    expect(page.locator('.background-tone-option[data-background-tone="deep-slate"]').first).to_be_visible()
    page.locator('.background-tone-option[data-background-mode="dark"][data-background-tone="deep-slate"]').first.click()
    expect(page.locator("html")).to_have_attribute("data-background", "deep-slate")
    assert page.evaluate("localStorage.getItem('dashboard-background-dark')") == "deep-slate"
    page.screenshot(path=str(artifact_dir / "settings-dark-deep-slate.png"), full_page=True)

    dark_palette_styles = page.evaluate(
        """
        () => {
          const toRgb = (value) => {
            const rgb = value.match(/rgba?\\(([^)]+)\\)/);
            if (rgb) {
              return rgb[1].split(/[\\s,\\/]+/).filter(Boolean).slice(0, 3).map((part) => Math.round(Number(part)));
            }
            const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
            if (hex) {
              return [0, 2, 4].map((start) => parseInt(hex[1].slice(start, start + 2), 16));
            }
            return [];
          };
          const root = getComputedStyle(document.documentElement);
          const nav = getComputedStyle(document.querySelector(".app-nav"));
          const section = getComputedStyle(document.querySelector(".form-section"));
          return {
            bg: toRgb(root.getPropertyValue("--bg")),
            glassBorder: toRgb(root.getPropertyValue("--glass-border")),
            navBorder: toRgb(nav.borderTopColor),
            sectionBackground: section.backgroundImage,
            sectionBorder: toRgb(section.borderTopColor),
          };
        }
        """
    )
    assert max(dark_palette_styles["bg"]) <= 34
    for key in ("glassBorder", "navBorder", "sectionBorder"):
        if dark_palette_styles[key]:
            assert max(dark_palette_styles[key]) <= 150
    assert dark_palette_styles["sectionBackground"] != "none"

    goto(page, app_server)
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    expect(page.locator("html")).to_have_attribute("data-background", "deep-slate")
    page.screenshot(path=str(artifact_dir / "dashboard-dark-deep-slate.png"), full_page=True)
    assert_clean_browser(page)


def test_workspace_chrome_is_spatial_and_modes_still_work(page: Page, app_server: str) -> None:
    goto(page, app_server)
    artifact_dir = Path("test-results") / "workspace-toolbar"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    expect(page.locator(".workspace-chrome")).to_be_visible()
    expect(page.locator(".workspace-identity-island .dash-switch-hero")).to_be_visible()
    expect(page.locator(".layout-command-island .layout-slot-controls")).to_be_visible()
    expect(page.locator(".composition-add-button")).to_have_attribute("aria-label", "Add dashboard object")
    expect(page.locator(".mode-command-island .engineer-mode-button")).to_be_visible()
    expect(page.locator(".context-command-island .nav-status-icon-only")).to_be_visible()
    expect(page.locator(".appearance-command-island .background-tone-trigger")).to_be_visible()

    chrome_styles = page.locator(".workspace-chrome").evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
            return {
              radius: parseFloat(styles.borderTopLeftRadius),
              border: parseFloat(styles.borderTopWidth),
              shadow: styles.boxShadow,
              backdrop: styles.backdropFilter || styles.webkitBackdropFilter,
              background: styles.backgroundColor,
              image: styles.backgroundImage,
            };
          }
        """
    )
    assert chrome_styles["radius"] >= 24
    assert chrome_styles["border"] >= 1
    assert chrome_styles["shadow"] != "none"
    assert chrome_styles["backdrop"] != "none"
    assert chrome_styles["background"] != "rgba(0, 0, 0, 0)" or chrome_styles["image"] != "none"

    floating_styles = page.locator(".workspace-identity-island").evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
          return {
            radius: parseFloat(styles.borderTopLeftRadius),
            shadow: styles.boxShadow,
            backdrop: styles.backdropFilter || styles.webkitBackdropFilter,
            background: styles.backgroundColor,
            image: styles.backgroundImage,
          };
        }
        """
    )
    assert floating_styles["radius"] >= 22
    assert floating_styles["shadow"] != "none"
    assert floating_styles["backdrop"] != "none"
    assert floating_styles["background"] != "rgba(0, 0, 0, 0)" or floating_styles["image"] != "none"

    add_styles = page.locator(".composition-add-button").evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
          return {
            width: parseFloat(styles.width),
            radius: parseFloat(styles.borderTopLeftRadius),
            shadow: styles.boxShadow,
            backdrop: styles.backdropFilter || styles.webkitBackdropFilter,
          };
        }
        """
    )
    assert add_styles["width"] <= 52
    assert add_styles["radius"] >= 20
    assert add_styles["shadow"] != "none"
    assert add_styles["backdrop"] != "none"

    island_styles = page.locator(".layout-command-island").evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
          return {
            border: parseFloat(styles.borderTopWidth),
            shadow: styles.boxShadow,
            background: styles.backgroundColor,
          };
        }
        """
    )
    assert island_styles["border"] >= 1
    assert island_styles["shadow"] != "none"
    assert island_styles["background"] != "rgba(0, 0, 0, 0)"
    page.locator(".app-nav").screenshot(path=str(artifact_dir / "toolbar-light-spatial-chrome.png"))

    page.locator(".layout-slot-trigger").click()
    expect(page.locator(".layout-slot-menu")).to_have_class(re.compile("open"))
    expect(page.locator(".layout-slot-menu")).to_contain_text("Layout 10")
    page.keyboard.press("Escape")

    page.locator(".panel-add-button").click()
    expect(page.locator(".panel-add-menu")).to_have_class(re.compile("open"))
    for label in ("Stat", "Stat + Filter", "Graph", "Table", "Calendar", "Panel", "Context Panel"):
        expect(page.locator(".panel-add-menu")).to_contain_text(label)

    page.locator(".engineer-mode-button").click()
    expect(page.locator(".engineer-mode-button")).to_have_attribute("aria-pressed", "true")
    assert page.locator("body").evaluate("node => node.classList.contains('engineer-mode-active')")

    page.locator(".context-view-button").click()
    expect(page.locator(".context-view-button")).to_have_attribute("aria-pressed", "true")
    assert page.locator("body").evaluate("node => node.classList.contains('context-view-active')")

    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    dark_chrome_styles = page.locator(".workspace-chrome").evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
          const rgb = styles.borderTopColor.match(/rgba?\\(([^)]+)\\)/);
          return {
            border: parseFloat(styles.borderTopWidth),
            borderRgb: rgb ? rgb[1].split(/[\\s,\\/]+/).filter(Boolean).slice(0, 3).map(Number) : [],
            shadow: styles.boxShadow,
            background: styles.backgroundColor,
            image: styles.backgroundImage,
          };
        }
        """
    )
    assert dark_chrome_styles["border"] >= 1
    assert dark_chrome_styles["shadow"] != "none"
    assert dark_chrome_styles["background"] != "rgba(0, 0, 0, 0)" or dark_chrome_styles["image"] != "none"
    if dark_chrome_styles["borderRgb"]:
        assert max(dark_chrome_styles["borderRgb"]) <= 170
    page.locator(".app-nav").screenshot(path=str(artifact_dir / "toolbar-dark-spatial-chrome.png"))
    assert_clean_browser(page)


def test_settings_and_delete_modal_share_spatial_glass_language(page: Page, app_server: str) -> None:
    page.goto(f"{app_server}/settings")
    expect(page.locator(".settings-nav")).to_be_visible()
    artifact_dir = Path("test-results") / "workspace-surfaces"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    settings_styles = page.locator(".form-section").first.evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
            return {
              radius: parseFloat(styles.borderTopLeftRadius),
              shadow: styles.boxShadow,
              backdrop: styles.backdropFilter || styles.webkitBackdropFilter,
              background: styles.backgroundColor,
              image: styles.backgroundImage,
            };
          }
        """
    )
    assert settings_styles["radius"] >= 24
    assert settings_styles["shadow"] != "none"
    assert settings_styles["backdrop"] != "none"
    assert settings_styles["background"] != "rgba(0, 0, 0, 0)" or settings_styles["image"] != "none"
    page.screenshot(path=str(artifact_dir / "settings-spatial-glass.png"), full_page=True)

    goto(page, app_server)
    panel = page.locator(".db-panel").first
    panel.locator(".panel-settings-toggle").click(force=True)
    panel.locator(".panel-delete-handle").click(force=True)
    dialog = page.locator(".confirm-dialog")
    expect(dialog).to_be_visible()
    dialog_styles = dialog.evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
            return {
              radius: parseFloat(styles.borderTopLeftRadius),
              shadow: styles.boxShadow,
              backdrop: styles.backdropFilter || styles.webkitBackdropFilter,
              background: styles.backgroundColor,
              image: styles.backgroundImage,
            };
          }
        """
    )
    assert dialog_styles["radius"] >= 24
    assert dialog_styles["shadow"] != "none"
    assert dialog_styles["backdrop"] != "none"
    assert dialog_styles["background"] != "rgba(0, 0, 0, 0)" or dialog_styles["image"] != "none"
    dialog.screenshot(path=str(artifact_dir / "delete-dialog-spatial-glass.png"))
    page.locator(".confirm-dialog-cancel").click()
    assert_clean_browser(page)


def test_dark_mode_uses_midnight_glass_not_neon_edges(page: Page, app_server: str) -> None:
    goto(page, app_server)
    artifact_dir = Path("test-results") / "theme-polish"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    page.wait_for_timeout(260)
    page.locator(".stat-card[data-widget-key='widget-1']").hover()
    page.wait_for_timeout(260)

    styles = page.evaluate(
        """
        () => {
          const toRgb = (value) => {
            const rgb = value.match(/rgba?\\(([^)]+)\\)/);
            if (rgb) {
              return rgb[1].split(/[\\s,\\/]+/).filter(Boolean).slice(0, 3).map((part) => Math.round(Number(part)));
            }
            const oklab = value.match(/oklab\\(([\\d.-]+)\\s+([\\d.-]+)\\s+([\\d.-]+)/);
            if (oklab) {
              const L = Number(oklab[1]);
              const a = Number(oklab[2]);
              const b = Number(oklab[3]);
              const l = (L + (0.3963377774 * a) + (0.2158037573 * b)) ** 3;
              const m = (L - (0.1055613458 * a) - (0.0638541728 * b)) ** 3;
              const s = (L - (0.0894841775 * a) - (1.2914855480 * b)) ** 3;
              const linear = [
                (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s),
                (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s),
                (-0.0041960863 * l) - (0.7034186147 * m) + (1.7076147010 * s),
              ];
              const gamma = (channel) => {
                const safe = Math.max(0, Math.min(1, channel));
                return safe <= 0.0031308 ? safe * 12.92 : (1.055 * (safe ** (1 / 2.4))) - 0.055;
              };
              return linear.map((channel) => Math.round(gamma(channel) * 255));
            }
            const srgb = value.match(/color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/);
            if (srgb) {
              return srgb.slice(1, 4).map((part) => Math.round(Number(part) * 255));
            }
            return [];
          };
          const root = getComputedStyle(document.documentElement);
          const stat = getComputedStyle(document.querySelector(".stat-card[data-widget-key='widget-1']"));
          const panel = getComputedStyle(document.querySelector(".db-panel"));
          const tableHeader = getComputedStyle(document.querySelector(".al-table th"));
          const empty = getComputedStyle(document.querySelector(".empty-state"));
          const timeframe = getComputedStyle(document.querySelector(".timeframe-command-surface"));
          const add = getComputedStyle(document.querySelector(".composition-add-button"));
          const marker = getComputedStyle(document.querySelector(".workspace-accent-marker"));
          return {
            accent: root.getPropertyValue("--blue").trim(),
            statBorder: stat.borderTopColor,
            statBorderRgb: toRgb(stat.borderTopColor),
            statShadow: stat.boxShadow,
            panelBorder: panel.borderTopColor,
            panelBorderRgb: toRgb(panel.borderTopColor),
            panelShadow: panel.boxShadow,
            tableBorder: tableHeader.borderBottomColor,
            tableBorderRgb: toRgb(tableHeader.borderBottomColor),
            emptyBorder: empty.borderTopColor,
            emptyBorderRgb: toRgb(empty.borderTopColor),
            timeframeBorder: timeframe.borderTopColor,
            timeframeBorderRgb: toRgb(timeframe.borderTopColor),
            addShadow: add.boxShadow,
            markerShadow: marker.boxShadow,
          };
        }
        """
    )

    stat_border = styles["statBorderRgb"]
    panel_border = styles["panelBorderRgb"]
    table_border = styles["tableBorderRgb"]
    empty_border = styles["emptyBorderRgb"]
    timeframe_border = styles["timeframeBorderRgb"]
    assert styles["accent"].lower() == "#86acd2"
    if stat_border:
        assert max(stat_border) <= 190
        assert stat_border[2] - stat_border[0] <= 65
    if panel_border:
        assert max(panel_border) <= 160
    for name, border in (("table", table_border), ("empty", empty_border), ("timeframe", timeframe_border)):
        if border:
            assert max(border) <= 170, (name, border)
            assert border[2] - border[0] <= 70, (name, border)
    old_neon_values = ("103, 169, 255", "147, 197, 253", "#67a9ff", "#75b9ff", "#9dccff")
    combined_styles = " ".join(str(value) for value in styles.values())
    for neon_value in old_neon_values:
        assert neon_value not in combined_styles
    page.screenshot(path=str(artifact_dir / "dashboard-dark-midnight-glass.png"), full_page=True)
    assert_clean_browser(page)


def test_dark_widget_focus_and_active_borders_match_panel_softness(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")

    page.evaluate(
        """
        () => {
          const widget = document.querySelector(".widget-layout > .stat-card.widget-card:not(.range-bar)");
          const panel = document.querySelector(".panel-layout > .db-panel");
          const custom = widget.cloneNode(true);
          custom.classList.add("db-panel-custom-color", "stat-danger");
          custom.dataset.widgetKey = "dark-parity-custom";
          custom.style.setProperty("--panel-accent", "#dc2626");
          custom.style.setProperty("--panel-accent-rgb", "220, 38, 38");
          custom.style.setProperty("--panel-accent-text", "#ffffff");
          widget.after(custom);

          widget.classList.add("active");
          custom.classList.add("active");
          panel.classList.add("group-selected");
          widget.classList.add("group-selected");
        }
        """
    )
    page.wait_for_timeout(320)

    state = page.evaluate(
        """
        () => {
          const toRgb = (value) => {
            const rgb = value.match(/rgba?\\(([^)]+)\\)/);
            if (rgb) {
              return rgb[1].split(/[\\s,\\/]+/).filter(Boolean).slice(0, 3).map((part) => Math.round(Number(part)));
            }
            const oklab = value.match(/oklab\\(([\\d.-]+)\\s+([\\d.-]+)\\s+([\\d.-]+)/);
            if (oklab) {
              const L = Number(oklab[1]);
              const a = Number(oklab[2]);
              const b = Number(oklab[3]);
              const l = (L + (0.3963377774 * a) + (0.2158037573 * b)) ** 3;
              const m = (L - (0.1055613458 * a) - (0.0638541728 * b)) ** 3;
              const s = (L - (0.0894841775 * a) - (1.2914855480 * b)) ** 3;
              const linear = [
                (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s),
                (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s),
                (-0.0041960863 * l) - (0.7034186147 * m) + (1.7076147010 * s),
              ];
              const gamma = (channel) => {
                const safe = Math.max(0, Math.min(1, channel));
                return safe <= 0.0031308 ? safe * 12.92 : (1.055 * (safe ** (1 / 2.4))) - 0.055;
              };
              return linear.map((channel) => Math.round(gamma(channel) * 255));
            }
            const srgb = value.match(/color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/);
            if (srgb) {
              return srgb.slice(1, 4).map((part) => Math.round(Number(part) * 255));
            }
            return [];
          };
          const widget = document.querySelector(".widget-layout > .stat-card.widget-card:not(.range-bar)");
          const panel = document.querySelector(".panel-layout > .db-panel");
          const custom = document.querySelector('[data-widget-key="dark-parity-custom"]');

          const read = (node) => {
            const styles = getComputedStyle(node);
            return {
              borderColor: styles.borderTopColor,
              borderRgb: toRgb(styles.borderTopColor),
              outlineColor: styles.outlineColor,
              outlineRgb: toRgb(styles.outlineColor),
              outlineWidth: parseFloat(styles.outlineWidth || "0") || 0,
              outlineOffset: parseFloat(styles.outlineOffset || "0") || 0,
              boxShadow: styles.boxShadow,
            };
          };

          return {
            panel: read(panel),
            widget: read(widget),
            custom: read(custom),
            widgetBackground: getComputedStyle(widget).backgroundImage,
            customBackground: getComputedStyle(custom).backgroundImage,
          };
        }
        """
    )

    for key in ("widget", "custom"):
        border = state[key]["borderRgb"]
        outline = state[key]["outlineRgb"]
        assert border and max(border) <= 175, (key, state[key]["borderColor"])
        assert border[2] - border[0] <= 70, (key, state[key]["borderColor"])
        if state[key]["outlineWidth"]:
            assert max(outline) <= 215, (key, state[key]["outlineColor"])
            assert state[key]["outlineOffset"] <= 0
        assert "103, 169, 255" not in state[key]["boxShadow"]
        assert "147, 197, 253" not in state[key]["boxShadow"]
        assert "0 0 18px" not in state[key]["boxShadow"]
        assert "0 0 24px" not in state[key]["boxShadow"]

    assert state["widget"]["outlineColor"] == state["custom"]["outlineColor"]
    assert state["widget"]["outlineWidth"] == state["custom"]["outlineWidth"]
    assert state["widgetBackground"] != state["customBackground"]
    assert_clean_browser(page)


def test_timeframe_controls_use_theme_aware_glass_color(page: Page, app_server: str) -> None:
    goto(page, app_server)
    control = page.locator(".timeframe-widget")
    expect(control).to_be_visible()
    assert control.evaluate("node => node.dataset.defaultSpan") == "5"

    def ensure_control_tools_open() -> None:
        if not control.evaluate("node => node.classList.contains('widget-tools-open')"):
            control.locator(".panel-settings-toggle").click(force=True)
        expect(control.locator(".panel-tool-drawer")).to_be_visible()

    def apply_swatch(index: int) -> None:
        ensure_control_tools_open()
        if not page.locator(".panel-color-menu-open").count():
            control.locator(".panel-color-toggle").click(force=True)
        page.locator(".panel-color-menu-open .panel-color-swatch").nth(index).click()

    def rgb_values(value: str) -> list[int]:
        return [int(part) for part in re.findall(r"\d+", value)[:3]]

    def assert_near_white(value: str) -> None:
        red, green, blue = rgb_values(value)
        assert min(red, green, blue) >= 238

    def read_timeframe_style() -> dict:
        return control.evaluate(
            """
            node => {
              const preset = node.querySelector(".preset-btn.active");
              const selector = node.querySelector(".timeframe-selector");
              const refresh = node.querySelector(".range-icon-button");
              const calendar = node.querySelector(".timeframe-calendar");
              const settings = node.querySelector(".panel-settings-toggle");
              return {
                accent: getComputedStyle(node).getPropertyValue("--panel-accent").trim(),
                presetBackground: getComputedStyle(preset).backgroundColor,
                presetBorder: getComputedStyle(preset).borderColor,
                presetColor: getComputedStyle(preset).color,
                selectorBackground: getComputedStyle(selector).backgroundColor,
                selectorColor: getComputedStyle(selector).color,
                refreshBackground: getComputedStyle(refresh).backgroundColor,
                refreshColor: getComputedStyle(refresh).color,
                calendarColor: getComputedStyle(calendar).color,
                settingsColor: getComputedStyle(settings).color,
              };
            }
            """
        )

    artifact_dir = Path("test-results") / "timeframe-theme-controls"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    apply_swatch(3)
    teal = read_timeframe_style()
    control.screenshot(path=str(artifact_dir / "timeframe-light-teal.png"))

    apply_swatch(10)
    pink = read_timeframe_style()
    control.screenshot(path=str(artifact_dir / "timeframe-light-pink.png"))

    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")

    apply_swatch(3)
    dark_teal = read_timeframe_style()
    control.screenshot(path=str(artifact_dir / "timeframe-dark-teal.png"))

    apply_swatch(10)
    dark_pink = read_timeframe_style()
    control.screenshot(path=str(artifact_dir / "timeframe-dark-pink.png"))

    assert teal["accent"].lower() == "#14b8a6"
    assert pink["accent"].lower() == "#db2777"
    assert teal["presetBackground"] != pink["presetBackground"]
    assert teal["presetBorder"] != pink["presetBorder"]
    assert teal["selectorBackground"] != pink["selectorBackground"]
    assert teal["refreshBackground"] != pink["refreshBackground"]
    for styles in (teal, pink, dark_teal, dark_pink):
        assert_near_white(styles["presetColor"])
        assert_near_white(styles["selectorColor"])
        assert_near_white(styles["refreshColor"])
        assert_near_white(styles["calendarColor"])
        assert_near_white(styles["settingsColor"])
    assert_clean_browser(page)


def test_minimum_panel_menu_opens_without_resizing_panel(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = page.locator('.panel-layout > .db-panel[data-panel-key="builder-menu"]')
    expect(panel).to_be_visible()
    before = panel.evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            span: node.dataset.currentSpan,
            rowSpan: node.dataset.gridRowSpan,
            gridColumn: getComputedStyle(node).gridColumnEnd,
            gridRow: getComputedStyle(node).gridRowEnd,
          };
        }
        """
    )

    open_tools(panel)
    page.wait_for_timeout(220)

    after = panel.evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            span: node.dataset.currentSpan,
            rowSpan: node.dataset.gridRowSpan,
            gridColumn: getComputedStyle(node).gridColumnEnd,
            gridRow: getComputedStyle(node).gridRowEnd,
          };
        }
        """
    )
    assert abs(after["width"] - before["width"]) <= 1
    assert abs(after["height"] - before["height"]) <= 1
    assert after["span"] == before["span"]
    assert after["rowSpan"] == before["rowSpan"]
    assert after["gridColumn"] == before["gridColumn"]
    assert after["gridRow"] == before["gridRow"]
    assert_clean_browser(page)


def test_timeframe_widget_uses_shared_resize_system(page: Page, app_server: str) -> None:
    goto(page, app_server)
    control = page.locator(".timeframe-widget")
    before = control.evaluate("node => Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0)")

    open_tools(control)
    drag_by(page, control.locator(".panel-resize-handle"), -360, 0, steps=14)
    page.wait_for_timeout(350)

    after = control.evaluate(
        """
        node => ({
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
          gridColumn: node.style.gridColumn,
          row: Number(node.dataset.gridRow || 0),
        })
        """
    )
    assert before == 5
    assert 1 <= after["span"] < before
    assert "span 5" not in after["gridColumn"]
    assert after["row"] >= 1
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_timeframe_resize_clamps_to_content_minimum(page: Page, app_server: str) -> None:
    goto(page, app_server)
    control = page.locator(".timeframe-widget")

    open_tools(control)
    drag_by(page, control.locator(".panel-resize-handle"), -900, 0, steps=18)
    page.wait_for_timeout(350)

    state = control.evaluate(
        """
        node => {
          const root = node.getBoundingClientRect();
          const visibleControls = [...node.querySelectorAll(".preset-btn, .range-custom-trigger, .range-icon-button, .panel-settings-toggle")]
            .filter((control) => {
              const styles = getComputedStyle(control);
              return styles.display !== "none" && styles.visibility !== "hidden";
            })
            .map((control) => {
              const rect = control.getBoundingClientRect();
              return {
                width: rect.width,
                height: rect.height,
                clipped: rect.left < root.left - 1 || rect.right > root.right + 1 || rect.top < root.top - 1 || rect.bottom > root.bottom + 1,
              };
            });
          return {
            span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
            minW: Number(node.dataset.minW || 0),
            gridColumn: getComputedStyle(node).gridColumnEnd,
            clipped: visibleControls.filter((control) => control.clipped || control.width < 24 || control.height < 24),
          };
        }
        """
    )

    assert state["span"] == state["minW"] == 4
    assert state["gridColumn"] == "span 4"
    assert state["clipped"] == []
    assert_clean_browser(page)


def test_panel_crud_controls_and_visual_state(page: Page, app_server: str) -> None:
    goto(page, app_server)

    initial_count = page.locator(".panel-layout > .db-panel").count()
    panel = add_panel_for_setup(page)
    assert page.locator(".panel-layout > .db-panel").count() == initial_count + 1

    open_tools(panel)
    panel.locator(".panel-title-handle").click(force=True)
    title = panel.locator(".db-panel-title")
    expect(title).to_have_attribute("contenteditable", "true")
    title.fill("QA Panel")
    title.press("Enter")
    expect(title).to_have_text("QA Panel")

    open_tools(panel)
    panel.locator(".panel-color-toggle").click(force=True)
    expect(page.locator(".panel-color-menu-open")).to_be_visible()
    page.locator(".panel-color-menu-open .panel-color-swatch").nth(2).click()
    expect(panel).to_have_class(re.compile("db-panel-custom-color"))

    open_tools(panel)
    panel.locator(".panel-pin-toggle").click(force=True)
    expect(panel).to_have_class(re.compile("db-panel-pinned"))
    expect(panel).not_to_have_class(re.compile("db-panel-tools-open"))
    open_tools(panel)
    panel.locator(".panel-pin-toggle").click(force=True)
    expect(panel).not_to_have_class(re.compile("db-panel-pinned"))

    if panel.evaluate("node => node.classList.contains('db-panel-collapsed')"):
        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        expect(panel).to_have_class(re.compile("db-panel-collapsed"))
    else:
        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        expect(panel).to_have_class(re.compile("db-panel-collapsed"))
        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))

    open_tools(panel)
    panel.locator(".panel-delete-handle").click(force=True)
    expect(page.locator("#panel-delete-dialog")).to_be_visible()
    page.locator(".confirm-dialog-danger").click()
    expect(page.locator(".panel-layout > .db-panel", has_text="QA Panel")).to_have_count(0)
    close_dialog_if_open(page)
    assert_clean_browser(page)


def test_widget_crud_controls_resize_and_delete(page: Page, app_server: str) -> None:
    goto(page, app_server)

    widget = add_widget_for_setup(page)

    open_tools(widget)
    widget.locator(".panel-title-handle").click(force=True)
    label = widget.locator(".stat-lbl")
    expect(label).to_have_attribute("contenteditable", "true")
    label.fill("QA Widget")
    label.press("Enter")
    expect(label).to_have_text("QA Widget")

    open_tools(widget)
    widget.locator(".panel-color-toggle").click(force=True)
    expect(page.locator(".panel-color-menu-open")).to_be_visible()
    page.locator(".panel-color-menu-open .panel-color-swatch").nth(3).click()
    expect(widget).to_have_class(re.compile("db-panel-custom-color"))

    original_span = widget.evaluate("node => node.dataset.currentSpan || node.dataset.defaultSpan")
    open_tools(widget)
    drag_by(page, widget.locator(".panel-resize-handle"), 260, 0)
    page.wait_for_timeout(320)
    resized_span = widget.evaluate("node => node.dataset.currentSpan || node.dataset.defaultSpan")
    assert int(resized_span) >= int(original_span)

    open_tools(widget)
    widget.locator(".panel-pin-toggle").click(force=True)
    expect(widget).to_have_class(re.compile("db-panel-pinned"))
    expect(widget).not_to_have_class(re.compile("widget-tools-open"))
    open_tools(widget)
    widget.locator(".panel-pin-toggle").click(force=True)
    expect(widget).not_to_have_class(re.compile("db-panel-pinned"))

    open_tools(widget)
    widget.locator(".panel-delete-handle").click(force=True)
    expect(page.locator("#panel-delete-dialog")).to_be_visible()
    page.locator(".confirm-dialog-danger").click()
    expect(page.locator(".widget-layout > .widget-card", has_text="QA Widget")).to_have_count(0)
    assert_clean_browser(page)


def test_drag_ghost_grid_snapping_and_collision_handling(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = page.locator(".panel-layout > .db-panel").first
    open_tools(panel)

    x, y = begin_drag(page, panel.locator(".panel-move-handle"), 80, 40)
    expect(page.locator(".db-panel-placeholder")).to_have_count(1)
    assert grid_alignment_error(page, ".db-panel-placeholder") <= 3
    end_drag(page, x, y, 360, 80)
    page.wait_for_timeout(350)

    assert panel.evaluate("node => Number(node.dataset.gridCol || 0)") >= 1
    assert panel.evaluate("node => Number(node.dataset.gridRow || 0)") >= 1
    assert no_visible_overlaps(page, ".panel-layout > .db-panel") == []

    widget = page.locator(".widget-layout > .stat-card.widget-card").nth(1)
    open_tools(widget)
    x, y = begin_drag(page, widget.locator(".panel-move-handle"), 80, 20)
    expect(page.locator(".widget-placeholder")).to_have_count(1)
    assert grid_alignment_error(page, ".widget-placeholder") <= 3
    end_drag(page, x, y, 300, 0)
    page.wait_for_timeout(350)
    assert no_visible_overlaps(page, ".widget-layout > .widget-card") == []
    assert_clean_browser(page)


def test_collapsed_panel_drag_and_resize_show_expanded_footprint_ghost(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = page.locator('.panel-layout > .db-panel[data-panel-key="builder-menu"]')
    expect(panel).to_have_class(re.compile("db-panel-collapsed"))
    collapsed_box = panel.bounding_box()
    assert collapsed_box

    open_tools(panel)
    x, y = begin_drag(page, panel.locator(".panel-move-handle"), 52, 24)
    ghost = page.locator(".dashboard-expanded-footprint-ghost")
    placeholder = page.locator(".db-panel-placeholder")
    expect(ghost).to_have_count(1)
    expect(placeholder).to_have_count(1)
    drag_state = page.evaluate(
        """
        () => {
          const ghost = document.querySelector(".dashboard-expanded-footprint-ghost");
          const placeholder = document.querySelector(".db-panel-placeholder");
          const panel = document.querySelector('.panel-layout > .db-panel[data-panel-key="builder-menu"]');
          return {
            ghostRect: ghost.getBoundingClientRect().toJSON(),
            placeholderRect: placeholder.getBoundingClientRect().toJSON(),
            panelRect: panel.getBoundingClientRect().toJSON(),
            ghostParentTag: ghost.parentElement.tagName,
            ghostInsideGrid: Boolean(ghost.closest(".dashboard-layout-grid")),
            placeholderRowSpan: Number(placeholder.dataset.gridRowSpan || 0),
            placeholderGridRow: getComputedStyle(placeholder).gridRow,
          };
        }
        """
    )
    assert drag_state["ghostParentTag"] == "BODY"
    assert drag_state["ghostInsideGrid"] is False
    assert drag_state["ghostRect"]["height"] > drag_state["panelRect"]["height"] + 80
    assert drag_state["placeholderRowSpan"] == 1
    assert "span 1" in drag_state["placeholderGridRow"]
    assert grid_alignment_error(page, ".db-panel-placeholder") <= 3
    end_drag(page, x, y, 120, 0)
    page.wait_for_timeout(350)
    expect(ghost).to_have_count(0)
    expect(panel).to_have_class(re.compile("db-panel-collapsed"))

    collapsed_box = panel.bounding_box()
    assert collapsed_box
    open_tools(panel)
    handle_box = panel.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    resize_ghost = page.locator(".dashboard-expanded-footprint-ghost")
    resize_preview = page.locator(".db-panel-placeholder.dashboard-resize-preview")
    live_resize = page.locator(".dashboard-live-resize")
    expect(resize_ghost).to_have_count(1)
    expect(resize_preview).to_have_count(1)
    expect(live_resize).to_have_count(1)
    preview_start_box = resize_preview.bounding_box()
    assert preview_start_box
    page.mouse.move(x + 8, y + 7, steps=2)
    subgrid_resize_state = page.evaluate(
        """
        () => {
          const ghost = document.querySelector(".dashboard-expanded-footprint-ghost");
          const preview = document.querySelector(".db-panel-placeholder.dashboard-resize-preview");
          const live = document.querySelector(".dashboard-live-resize");
          return {
            ghostRect: ghost.getBoundingClientRect().toJSON(),
            previewRect: preview.getBoundingClientRect().toJSON(),
            liveRect: live.getBoundingClientRect().toJSON(),
          };
        }
        """
    )
    assert abs(subgrid_resize_state["ghostRect"]["left"] - subgrid_resize_state["liveRect"]["left"]) <= 2
    assert abs(subgrid_resize_state["ghostRect"]["top"] - subgrid_resize_state["liveRect"]["top"]) <= 2
    assert abs(subgrid_resize_state["ghostRect"]["width"] - subgrid_resize_state["liveRect"]["width"]) <= 2
    assert subgrid_resize_state["ghostRect"]["height"] > subgrid_resize_state["liveRect"]["height"] + 80
    assert subgrid_resize_state["liveRect"]["width"] >= collapsed_box["width"] + 6
    assert abs(subgrid_resize_state["previewRect"]["width"] - preview_start_box["width"]) < 2
    assert abs(subgrid_resize_state["previewRect"]["height"] - preview_start_box["height"]) < 2
    page.mouse.move(x + 46, y + 58, steps=8)

    expect(resize_ghost).to_have_count(1)
    expect(resize_preview).to_have_count(1)
    resize_state = page.evaluate(
        """
        () => {
          const ghost = document.querySelector(".dashboard-expanded-footprint-ghost");
          const preview = document.querySelector(".db-panel-placeholder.dashboard-resize-preview");
          const live = document.querySelector(".dashboard-live-resize");
          const panel = document.querySelector('.panel-layout > .db-panel[data-panel-key="builder-menu"]');
          return {
            ghostRect: ghost.getBoundingClientRect().toJSON(),
            previewRect: preview.getBoundingClientRect().toJSON(),
            liveRect: live.getBoundingClientRect().toJSON(),
            panelRect: panel.getBoundingClientRect().toJSON(),
            ghostInsideGrid: Boolean(ghost.closest(".dashboard-layout-grid")),
            previewRowSpan: Number(preview.dataset.gridRowSpan || 0),
            previewGridRow: getComputedStyle(preview).gridRow,
            livePreview: live.classList.contains("dashboard-live-resize"),
            sourceHidden: panel.classList.contains("dashboard-resize-source"),
            panelCollapsed: panel.classList.contains("db-panel-collapsed"),
          };
        }
        """
    )
    assert resize_state["ghostInsideGrid"] is False
    assert resize_state["livePreview"] is True
    assert resize_state["sourceHidden"] is True
    assert resize_state["panelCollapsed"] is True
    assert abs(resize_state["ghostRect"]["left"] - resize_state["liveRect"]["left"]) <= 2
    assert abs(resize_state["ghostRect"]["top"] - resize_state["liveRect"]["top"]) <= 2
    assert abs(resize_state["ghostRect"]["width"] - resize_state["liveRect"]["width"]) <= 2
    assert resize_state["ghostRect"]["height"] > resize_state["previewRect"]["height"] + 80
    assert resize_state["liveRect"]["height"] <= collapsed_box["height"] + 8
    assert resize_state["previewRowSpan"] == 1
    assert "span 1" in resize_state["previewGridRow"]
    assert grid_alignment_error(page, ".db-panel-placeholder.dashboard-resize-preview") <= 3
    page.mouse.up()
    page.wait_for_timeout(350)
    expect(resize_ghost).to_have_count(0)
    expect(panel).to_have_class(re.compile("db-panel-collapsed"))
    committed_collapsed_box = panel.bounding_box()
    assert committed_collapsed_box
    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(350)
    opened_state = panel.evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          return {
            rect: rect.toJSON(),
            collapsed: node.classList.contains("db-panel-collapsed"),
          };
        }
        """
    )
    assert opened_state["collapsed"] is False
    assert abs(opened_state["rect"]["left"] - committed_collapsed_box["x"]) <= 3
    assert abs(opened_state["rect"]["top"] - committed_collapsed_box["y"]) <= 3
    assert abs(opened_state["rect"]["width"] - committed_collapsed_box["width"]) <= 3
    assert abs(opened_state["rect"]["height"] - resize_state["ghostRect"]["height"]) <= 3
    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(250)
    expect(panel).to_have_class(re.compile("db-panel-collapsed"))
    assert no_visible_overlaps(page, ".panel-layout > .db-panel") == []
    assert_clean_browser(page)


def test_panel_expand_uses_vertical_pushdown_not_sideways_reflow(page: Page, app_server: str) -> None:
    goto(page, app_server)

    setup = page.evaluate(
        """
        () => {
          const panelLayout = document.querySelector('.panel-layout[data-layout-key="builder"]');
          const notes = panelLayout.querySelector('[data-panel-key="builder-notes"]');
          const table = panelLayout.querySelector('[data-panel-key="builder-table"]');
          const menu = panelLayout.querySelector('[data-panel-key="builder-menu"]');
          const place = (node, col, row, span, rowSpan, height = null) => {
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            if (height) {
              node.dataset.savedHeight = String(height);
              if (!node.classList.contains("db-panel-collapsed")) node.style.height = `${height}px`;
            } else {
              delete node.dataset.savedHeight;
              node.style.height = "";
            }
          };
          notes.classList.add("db-panel-collapsed");
          notes.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
          place(notes, 1, 7, 3, 1, 275);
          notes.style.height = "";
          table.classList.remove("db-panel-collapsed");
          table.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "true");
          place(table, 1, 8, 3, 3, 275);
          menu.classList.add("db-panel-collapsed");
          place(menu, 4, 7, 2, 1);
          return {
            notes: notes.getBoundingClientRect().toJSON(),
            table: table.getBoundingClientRect().toJSON(),
            tableCol: Number(table.dataset.gridCol || 0),
            tableRow: Number(table.dataset.gridRow || 0),
          };
        }
        """
    )

    notes = page.locator('.panel-layout > .db-panel[data-panel-key="builder-notes"]')
    table = page.locator('.panel-layout > .db-panel[data-panel-key="builder-table"]')
    expect(notes).to_have_class(re.compile("db-panel-collapsed"))

    notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(350)

    expanded = page.evaluate(
        """
        () => {
          const notes = document.querySelector('[data-panel-key="builder-notes"]');
          const table = document.querySelector('[data-panel-key="builder-table"]');
          return {
            notesCollapsed: notes.classList.contains("db-panel-collapsed"),
            notesRowSpan: Number(notes.dataset.gridRowSpan || 0),
            tableCol: Number(table.dataset.gridCol || 0),
            tableRow: Number(table.dataset.gridRow || 0),
            tableRect: table.getBoundingClientRect().toJSON(),
          };
        }
        """
    )
    assert expanded["notesCollapsed"] is False
    assert expanded["notesRowSpan"] > 1
    assert expanded["tableCol"] == setup["tableCol"]
    assert expanded["tableRow"] > setup["tableRow"]
    assert abs(expanded["tableRect"]["left"] - setup["table"]["left"]) <= 3
    assert expanded["tableRect"]["top"] > setup["table"]["top"] + 40
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(350)

    collapsed = page.evaluate(
        """
        () => {
          const notes = document.querySelector('[data-panel-key="builder-notes"]');
          const table = document.querySelector('[data-panel-key="builder-table"]');
          return {
            notesCollapsed: notes.classList.contains("db-panel-collapsed"),
            notesRowSpan: Number(notes.dataset.gridRowSpan || 0),
            tableCol: Number(table.dataset.gridCol || 0),
            tableRow: Number(table.dataset.gridRow || 0),
            tableRect: table.getBoundingClientRect().toJSON(),
          };
        }
        """
    )
    assert collapsed["notesCollapsed"] is True
    assert collapsed["notesRowSpan"] == 1
    assert collapsed["tableCol"] == setup["tableCol"]
    assert collapsed["tableRow"] == setup["tableRow"]
    assert abs(collapsed["tableRect"]["left"] - setup["table"]["left"]) <= 3
    assert abs(collapsed["tableRect"]["top"] - setup["table"]["top"]) <= 3
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_ordered_drag_reflows_widgets_without_overlap(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widgets = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)")
    before = visual_grid_items(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    assert "Widget 2" in before[1]["text"]

    dragged = widgets.nth(1)
    open_tools(dragged)
    x, y = begin_drag(page, dragged.locator(".panel-move-handle"), 40, 8)
    expect(page.locator(".widget-placeholder")).to_have_count(1)
    end_drag(page, x, y, 390, 10)
    page.wait_for_timeout(350)

    after = visual_grid_items(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    moved = next(item for item in after if item["text"] == "0 Widget 2")
    assert moved["col"] > before[1]["col"]
    assert no_visible_overlaps(page, ".widget-layout > .widget-card") == []
    assert grid_alignment_error(page, ".widget-layout > .stat-card.widget-card:not(.range-bar):nth-of-type(3)") <= 3
    assert_clean_browser(page)


def test_resize_preview_snaps_to_grid_and_persists(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = page.locator(".panel-layout > .db-panel").first
    start = panel.evaluate("node => ({ span: Number(node.dataset.currentSpan || node.dataset.defaultSpan), rowSpan: Number(node.dataset.gridRowSpan || 1) })")

    open_tools(panel)
    drag_by(page, panel.locator(".panel-resize-handle"), 240, 110)
    page.wait_for_timeout(350)

    end = panel.evaluate("node => ({ span: Number(node.dataset.currentSpan || node.dataset.defaultSpan), rowSpan: Number(node.dataset.gridRowSpan || 1), col: Number(node.dataset.gridCol || 0), row: Number(node.dataset.gridRow || 0) })")
    assert end["span"] >= start["span"]
    assert end["rowSpan"] >= start["rowSpan"]
    assert end["col"] >= 1
    assert end["row"] >= 1
    assert grid_alignment_error(page, ".panel-layout > .db-panel") <= 3
    assert no_visible_overlaps(page, ".panel-layout > .db-panel") == []
    assert_clean_browser(page)


def test_resize_has_live_surface_and_grid_preview(page: Page, app_server: str) -> None:
    goto(page, app_server)

    panel = page.locator('.panel-layout > .db-panel[data-panel-key="builder-notes"]')
    open_tools(panel)
    panel_start = panel.bounding_box()
    assert panel_start
    panel_committed_span = panel.evaluate("node => Number(node.dataset.currentSpan || node.dataset.defaultSpan)")
    handle_box = panel.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    panel_preview = page.locator(".db-panel-placeholder.dashboard-resize-preview")
    expect(panel_preview).to_have_count(1)
    panel_preview_start = panel_preview.bounding_box()
    assert panel_preview_start
    panel_live_start = page.locator(".dashboard-live-resize").bounding_box()
    assert panel_live_start
    page.mouse.move(x + 8, y + 7, steps=2)
    panel_micro = page.locator(".dashboard-live-resize").evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            opacity: Number(getComputedStyle(node).opacity),
          };
        }
        """
    )
    panel_preview_micro = panel_preview.bounding_box()
    assert panel_preview_micro
    assert panel_micro["width"] >= panel_live_start["width"] + 6
    assert panel_micro["height"] >= panel_live_start["height"] + 5
    assert abs(panel_preview_micro["width"] - panel_preview_start["width"]) < 2
    assert abs(panel_preview_micro["height"] - panel_preview_start["height"]) < 2
    page.mouse.move(x + 240, y + 110, steps=10)
    page.wait_for_timeout(220)

    panel_live = page.locator(".dashboard-live-resize").evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          return {
            live: node.classList.contains("dashboard-live-resize"),
            position: getComputedStyle(node).position,
            display: getComputedStyle(node).display,
            visibility: getComputedStyle(node).visibility,
            width: rect.width,
            height: rect.height,
            opacity: Number(getComputedStyle(node).opacity),
          };
        }
        """
    )
    preview_box = panel_preview.bounding_box()
    assert preview_box
    panel_source = panel.evaluate(
        """
        node => ({
          active: node.classList.contains("dashboard-active-resize"),
          hidden: node.classList.contains("dashboard-resize-source"),
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan),
        })
        """
    )
    assert panel_source["active"] is True
    assert panel_source["hidden"] is True
    assert panel_live["live"] is True
    assert panel_live["position"] == "fixed"
    assert panel_live["display"] != "none"
    assert panel_live["visibility"] == "visible"
    assert 0.55 <= panel_live["opacity"] < 0.9
    assert panel_source["span"] == panel_committed_span
    assert panel_live["width"] > panel_start["width"] + 20
    assert panel_live["height"] > panel_start["height"] + 20
    assert panel_live["width"] > panel_micro["width"]
    assert panel_live["height"] > panel_micro["height"]
    assert preview_box["width"] > panel_preview_micro["width"] + 20 or preview_box["height"] > panel_preview_micro["height"] + 20
    assert abs(panel_live["width"] - preview_box["width"]) > 8 or abs(panel_live["height"] - preview_box["height"]) > 8
    assert grid_alignment_error(page, ".db-panel-placeholder.dashboard-resize-preview") <= 3
    page.mouse.up()
    page.wait_for_timeout(350)
    expect(panel_preview).to_have_count(0)
    assert grid_alignment_error(page, '.panel-layout > .db-panel[data-panel-key="builder-notes"]') <= 3
    assert no_visible_overlaps(page, ".panel-layout > .db-panel") == []

    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    open_tools(widget)
    widget_start = widget.bounding_box()
    assert widget_start
    widget_committed_span = widget.evaluate("node => Number(node.dataset.currentSpan || node.dataset.defaultSpan)")
    handle_box = widget.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    widget_preview = page.locator(".widget-placeholder.dashboard-resize-preview")
    expect(widget_preview).to_have_count(1)
    widget_preview_start = widget_preview.bounding_box()
    assert widget_preview_start
    widget_live_start = page.locator(".dashboard-live-resize").bounding_box()
    assert widget_live_start
    page.mouse.move(x + 8, y, steps=2)
    widget_micro = page.locator(".dashboard-live-resize").evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          return {
            width: rect.width,
            opacity: Number(getComputedStyle(node).opacity),
          };
        }
        """
    )
    widget_preview_micro = widget_preview.bounding_box()
    assert widget_preview_micro
    assert widget_micro["width"] >= widget_live_start["width"] + 6
    assert abs(widget_preview_micro["width"] - widget_preview_start["width"]) < 2
    page.mouse.move(x + 320, y, steps=10)
    page.wait_for_timeout(220)

    widget_live = page.locator(".dashboard-live-resize").evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          return {
            live: node.classList.contains("dashboard-live-resize"),
            position: getComputedStyle(node).position,
            display: getComputedStyle(node).display,
            visibility: getComputedStyle(node).visibility,
            width: rect.width,
            opacity: Number(getComputedStyle(node).opacity),
          };
        }
        """
    )
    widget_preview_box = widget_preview.bounding_box()
    assert widget_preview_box
    widget_source = widget.evaluate(
        """
        node => ({
          active: node.classList.contains("dashboard-active-resize"),
          hidden: node.classList.contains("dashboard-resize-source"),
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan),
        })
        """
    )
    assert widget_source["active"] is True
    assert widget_source["hidden"] is True
    assert widget_live["live"] is True
    assert widget_live["position"] == "fixed"
    assert widget_live["display"] != "none"
    assert widget_live["visibility"] == "visible"
    assert 0.55 <= widget_live["opacity"] < 0.9
    assert widget_source["span"] == widget_committed_span
    assert widget_live["width"] > widget_start["width"] + 20
    assert widget_live["width"] > widget_micro["width"]
    assert widget_preview_box["width"] > widget_preview_micro["width"] + 20
    assert abs(widget_live["width"] - widget_preview_box["width"]) > 8
    assert grid_alignment_error(page, ".widget-placeholder.dashboard-resize-preview") <= 3
    page.mouse.up()
    page.wait_for_timeout(350)
    expect(widget_preview).to_have_count(0)
    assert grid_alignment_error(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)") <= 3
    assert no_visible_overlaps(page, ".widget-layout > .widget-card") == []
    assert_clean_browser(page)


def test_left_edge_resize_anchors_right_edge_for_right_side_widget(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    page.evaluate(
        """
        () => {
          const setGrid = (node, col, row, span, rowSpan = 1) => {
            node.dataset.currentSpan = String(span);
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            if (node.classList.contains("db-panel") && !node.classList.contains("db-panel-collapsed")) {
              const grid = node.closest(".dashboard-layout-grid");
              const styles = getComputedStyle(grid);
              const rowHeight = parseFloat(styles.gridAutoRows) || 81;
              const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
              const height = (rowSpan * rowHeight) + (Math.max(0, rowSpan - 1) * gap);
              node.dataset.savedHeight = String(height);
              node.style.height = `${height}px`;
            }
          };
          const widgets = [...document.querySelectorAll(".widget-layout > .widget-card:not(.range-bar)")];
          const target = widgets[0];
          setGrid(target, 5, 1, 2);
          widgets.slice(1).forEach((node, index) => setGrid(node, 1 + (index % 3), 3 + Math.floor(index / 3), 1));
          document.querySelectorAll(".panel-layout > .db-panel").forEach((node, index) => setGrid(node, 1, 6 + index * 4, Number(node.dataset.currentSpan || node.dataset.defaultSpan || 3), Number(node.dataset.gridRowSpan || 2)));
        }
        """
    )
    start = grid_item_state(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    assert start["col"] == 5
    assert start["span"] == 2
    start_right = start["col"] + start["span"]
    start_rect = widget.bounding_box()
    assert start_rect

    open_tools(widget)
    left_handle = widget.locator(".panel-resize-left-handle")
    expect(left_handle).to_be_visible()
    handle_box = left_handle.bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - 22, y, steps=3)

    live_micro = page.locator(".dashboard-live-resize").bounding_box()
    assert live_micro
    assert live_micro["x"] < start_rect["x"] - 10
    assert live_micro["width"] > start_rect["width"] + 10
    assert abs((live_micro["x"] + live_micro["width"]) - (start_rect["x"] + start_rect["width"])) <= 3

    page.mouse.move(x - 280, y, steps=14)
    preview = page.locator(".widget-placeholder.dashboard-resize-preview")
    expect(preview).to_have_count(1)
    preview_state = preview.evaluate(
        """
        node => ({
          col: Number(node.dataset.gridCol || 0),
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
          rect: node.getBoundingClientRect().toJSON(),
        })
        """
    )
    assert preview_state["col"] < start["col"]
    assert preview_state["span"] > start["span"]
    assert preview_state["col"] + preview_state["span"] == start_right
    assert abs((preview_state["rect"]["left"] + preview_state["rect"]["width"]) - (start_rect["x"] + start_rect["width"])) <= 4
    assert grid_alignment_error(page, ".widget-placeholder.dashboard-resize-preview") <= 3

    page.mouse.up()
    page.wait_for_timeout(360)
    end = grid_item_state(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    assert end["col"] < start["col"]
    assert end["span"] > start["span"]
    assert end["col"] + end["span"] == start_right
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    page.locator(".layout-save-button").click()
    saved = page.evaluate(
        """
        key => JSON.parse(localStorage.getItem(`dashboard-widget-six-grid-layout:1:builder:${key}`) || "null")
        """,
        widget.evaluate("node => node.dataset.widgetKey"),
    )
    assert saved["gridCol"] == end["col"]
    assert saved["span"] == end["span"]
    assert_clean_browser(page)


def test_panel_empty_placeholder_tracks_resized_body_area(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = add_panel_for_setup(page)
    body = panel.locator(".db-panel-body")
    placeholder = panel.locator(".db-panel-body > .empty-state")
    artifact_dir = Path("test-results") / "panel-placeholder-sizing"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    def body_alignment() -> dict:
        return panel.evaluate(
            """
            node => {
              const body = node.querySelector(".db-panel-body");
              const empty = body.querySelector(":scope > .empty-state");
              const bodyRect = body.getBoundingClientRect();
              const emptyRect = empty.getBoundingClientRect();
              const headerRect = node.querySelector(".db-panel-hd").getBoundingClientRect();
              return {
                body: bodyRect.toJSON(),
                empty: emptyRect.toJSON(),
                header: headerRect.toJSON(),
                panel: node.getBoundingClientRect().toJSON(),
              };
            }
            """
        )

    if panel.evaluate("node => node.classList.contains('db-panel-collapsed')"):
        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
        page.wait_for_timeout(260)
    open_tools(panel)
    drag_by(page, panel.locator(".panel-resize-handle"), 300, 190, steps=16)
    page.wait_for_timeout(360)
    panel.screenshot(path=str(artifact_dir / "placeholder-light-resized.png"))
    light = body_alignment()

    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    panel.screenshot(path=str(artifact_dir / "placeholder-dark-resized.png"))
    dark = body_alignment()

    for state in (light, dark):
        body_rect = state["body"]
        empty_rect = state["empty"]
        header_rect = state["header"]
        assert body_rect["top"] >= header_rect["bottom"] - 1
        assert abs(empty_rect["left"] - body_rect["left"]) <= 1
        assert abs(empty_rect["right"] - body_rect["right"]) <= 1
        assert abs(empty_rect["top"] - body_rect["top"]) <= 1
        assert abs(empty_rect["bottom"] - body_rect["bottom"]) <= 1
        assert empty_rect["width"] >= body_rect["width"] - 2
        assert empty_rect["height"] >= body_rect["height"] - 2
    assert_clean_browser(page)


def test_panel_content_density_adapts_before_overflow(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = add_panel_for_setup(page)
    if panel.evaluate("node => node.classList.contains('db-panel-collapsed')"):
        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
        page.wait_for_timeout(260)

    metrics = panel.evaluate(
        """
        node => {
          const grid = node.closest(".dashboard-layout-grid");
          const gridStyles = getComputedStyle(grid);
          const rowHeight = parseFloat(gridStyles.gridAutoRows) || 81;
          const gap = parseFloat(gridStyles.rowGap || gridStyles.gap || "16") || 16;
          const panelHeight = (rows) => (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const setRows = (rows) => {
            node.classList.remove("db-panel-collapsed");
            node.dataset.gridRowSpan = String(rows);
            node.style.height = `${panelHeight(rows)}px`;
            node.style.gridRow = `${node.dataset.gridRow || 1} / span ${rows}`;
          };
          const read = () => {
            const body = node.querySelector(".db-panel-body");
            const empty = body.querySelector(":scope > .empty-state");
            const header = node.querySelector(".db-panel-hd");
            const bodyRect = body.getBoundingClientRect();
            const emptyRect = empty.getBoundingClientRect();
            const bodyStyles = getComputedStyle(body);
            const emptyStyles = getComputedStyle(empty);
            const strongStyles = getComputedStyle(empty.querySelector("strong"));
            const smallStyles = getComputedStyle(empty.querySelector("small"));
            return {
              headerHeight: header.getBoundingClientRect().height,
              bodyHeight: bodyRect.height,
              bodyScrolls: body.scrollHeight > body.clientHeight + 1,
              emptyClipped:
                emptyRect.top < bodyRect.top - 1 ||
                emptyRect.bottom > bodyRect.bottom + 1 ||
                emptyRect.left < bodyRect.left - 1 ||
                emptyRect.right > bodyRect.right + 1,
              emptyPadTop: parseFloat(emptyStyles.paddingTop),
              emptyPadBottom: parseFloat(emptyStyles.paddingBottom),
              emptyGap: parseFloat(emptyStyles.gap),
              emptyStrongSize: parseFloat(strongStyles.fontSize),
              emptySmallLineHeight: parseFloat(smallStyles.lineHeight),
              overflowY: bodyStyles.overflowY,
            };
          };
          setRows(5);
          const large = read();
          setRows(2);
          const small = read();
          return { large, small };
        }
        """
    )

    assert metrics["small"]["headerHeight"] < metrics["large"]["headerHeight"]
    assert metrics["small"]["bodyHeight"] > 100
    assert metrics["small"]["emptyPadTop"] < metrics["large"]["emptyPadTop"]
    assert metrics["small"]["emptyPadBottom"] < metrics["large"]["emptyPadBottom"]
    assert metrics["small"]["emptyGap"] < metrics["large"]["emptyGap"]
    assert metrics["small"]["emptyStrongSize"] <= metrics["large"]["emptyStrongSize"]
    assert metrics["small"]["emptySmallLineHeight"] < metrics["large"]["emptySmallLineHeight"]
    assert metrics["small"]["emptyClipped"] is False
    assert metrics["small"]["bodyScrolls"] is False
    assert metrics["small"]["overflowY"] == "auto"

    table_metrics = page.locator('.panel-layout > .db-panel[data-panel-key="builder-table"]').evaluate(
        """
        node => {
          const grid = node.closest(".dashboard-layout-grid");
          const gridStyles = getComputedStyle(grid);
          const rowHeight = parseFloat(gridStyles.gridAutoRows) || 81;
          const gap = parseFloat(gridStyles.rowGap || gridStyles.gap || "16") || 16;
          const panelHeight = (rows) => (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const setRows = (rows) => {
            node.classList.remove("db-panel-collapsed");
            node.dataset.gridRowSpan = String(rows);
            node.style.height = `${panelHeight(rows)}px`;
            node.style.gridRow = `${node.dataset.gridRow || 1} / span ${rows}`;
          };
          const read = () => {
            const th = node.querySelector(".al-table th");
            const td = node.querySelector(".al-table td");
            const emptyCell = node.querySelector(".al-empty");
            const thStyles = getComputedStyle(th);
            const tdStyles = getComputedStyle(td);
            const emptyStyles = getComputedStyle(emptyCell);
            return {
              thPadY: parseFloat(thStyles.paddingTop) + parseFloat(thStyles.paddingBottom),
              tdPadY: parseFloat(tdStyles.paddingTop) + parseFloat(tdStyles.paddingBottom),
              emptyPadY: parseFloat(emptyStyles.paddingTop) + parseFloat(emptyStyles.paddingBottom),
            };
          };
          setRows(5);
          const large = read();
          setRows(2);
          const small = read();
          return { large, small };
        }
        """
    )

    assert table_metrics["small"]["thPadY"] < table_metrics["large"]["thPadY"]
    assert table_metrics["small"]["tdPadY"] < table_metrics["large"]["tdPadY"]
    assert table_metrics["small"]["emptyPadY"] < table_metrics["large"]["emptyPadY"]
    assert_clean_browser(page)


def test_drag_preview_clamps_to_dashboard_grid_bounds(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = page.locator(".panel-layout > .db-panel").first
    open_tools(panel)

    x, y = begin_drag(page, panel.locator(".panel-move-handle"), -1400, -900)
    dragging_rect = page.locator(".db-panel-dragging").evaluate("node => node.getBoundingClientRect().toJSON()")
    grid_rect = page.locator(".dashboard-layout-grid").evaluate("node => node.getBoundingClientRect().toJSON()")
    assert dragging_rect["left"] >= grid_rect["left"] - 2
    assert dragging_rect["right"] <= grid_rect["right"] + 2
    assert dragging_rect["top"] >= grid_rect["top"] - 2

    end_drag(page, x, y, -1000, -500)
    page.wait_for_timeout(350)
    state = grid_item_state(page, ".panel-layout > .db-panel")
    assert state["col"] >= 1
    assert state["row"] >= 1
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_widgets_and_panels_share_global_occupancy(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    panel = page.locator(".panel-layout > .db-panel").first
    panel_state = grid_item_state(page, ".panel-layout > .db-panel")

    open_tools(widget)
    x, y = begin_drag(page, widget.locator(".panel-move-handle"), 40, 8)
    panel_box = panel.bounding_box()
    assert panel_box
    page.mouse.move(panel_box["x"] + 24, panel_box["y"] + 24, steps=10)
    page.mouse.up()
    page.wait_for_timeout(350)

    widget_state = grid_item_state(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    current_panel_state = grid_item_state(page, ".panel-layout > .db-panel")
    assert (widget_state["row"], widget_state["col"]) != (current_panel_state["row"], current_panel_state["col"])
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_pinned_items_are_not_displaced_by_drag(page: Page, app_server: str) -> None:
    goto(page, app_server)
    pinned_panel = page.locator(".panel-layout > .db-panel").first
    open_tools(pinned_panel)
    pinned_panel.locator(".panel-pin-toggle").click(force=True)
    pinned_before = grid_item_state(page, ".panel-layout > .db-panel")

    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").nth(1)
    open_tools(widget)
    x, y = begin_drag(page, widget.locator(".panel-move-handle"), 40, 8)
    panel_box = pinned_panel.bounding_box()
    assert panel_box
    page.mouse.move(panel_box["x"] + 24, panel_box["y"] + 24, steps=10)
    page.mouse.up()
    page.wait_for_timeout(350)

    pinned_after = grid_item_state(page, ".panel-layout > .db-panel")
    assert pinned_after["col"] == pinned_before["col"]
    assert pinned_after["row"] == pinned_before["row"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_sparse_empty_space_drop_is_preserved(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").nth(2)
    before = widget.evaluate("node => ({ col: Number(node.dataset.gridCol), row: Number(node.dataset.gridRow) })")

    open_tools(widget)
    drag_by(page, widget.locator(".panel-move-handle"), 0, 430, steps=18)
    page.wait_for_timeout(350)

    after = widget.evaluate("node => ({ col: Number(node.dataset.gridCol), row: Number(node.dataset.gridRow) })")
    assert after["row"] >= before["row"] + 3
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_drag_collision_preview_does_not_stick_to_neighbors(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel_selector = ".panel-layout > .db-panel"
    before_panels = grid_item_states(page, panel_selector)

    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    panel = page.locator(panel_selector).first
    open_tools(widget)
    box = widget.locator(".panel-move-handle").bounding_box()
    assert box
    start_x, start_y = box_center(box)
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + 50, start_y + 8, steps=6)

    panel_box = panel.bounding_box()
    assert panel_box
    page.mouse.move(panel_box["x"] + 24, panel_box["y"] + 24, steps=10)
    page.wait_for_timeout(120)
    page.mouse.move(panel_box["x"] + 24, panel_box["y"] + 500, steps=12)
    page.mouse.up()
    page.wait_for_timeout(350)

    after_panels = grid_item_states(page, panel_selector)
    assert after_panels == before_panels
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_drop_on_top_item_shifts_forward_without_wrapping_top_item_to_end(page: Page, app_server: str) -> None:
    goto(page, app_server)
    top_item = page.locator(".timeframe-widget")
    dragged = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    top_before = grid_item_state(page, ".timeframe-widget")
    assert top_before["row"] == 1

    open_tools(dragged)
    handle_box = dragged.locator(".panel-move-handle").bounding_box()
    top_box = top_item.bounding_box()
    assert handle_box
    assert top_box
    start_x, start_y = box_center(handle_box)
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + 42, start_y + 8, steps=6)
    page.mouse.move(top_box["x"] + 28, top_box["y"] + 28, steps=14)
    page.mouse.up()
    page.wait_for_timeout(420)

    dragged_state = grid_item_state(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    top_after = grid_item_state(page, ".timeframe-widget")
    all_rows = [item["row"] for item in grid_item_states(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel")]
    assert dragged_state["row"] == 1
    assert dragged_state["col"] == 1
    assert top_after["row"] <= 2
    assert top_after["row"] < max(all_rows)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_dragging_over_items_does_not_open_underlying_menus(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    panel = page.locator(".panel-layout > .db-panel").first
    open_tools(widget)
    page.wait_for_timeout(220)

    handle_box = widget.locator(".panel-move-handle").bounding_box()
    panel_box = panel.bounding_box()
    assert handle_box
    assert panel_box

    start_x, start_y = box_center(handle_box)
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + 86, start_y + 14, steps=10)
    expect(page.locator(".widget-dragging")).to_have_count(1)

    page.mouse.move(panel_box["x"] + panel_box["width"] - 18, panel_box["y"] + 22, steps=12)
    page.wait_for_timeout(320)

    expect(page.locator(".panel-layout > .db-panel.db-panel-tools-open")).to_have_count(0)
    expect(panel.locator(".panel-settings-toggle")).to_have_attribute("aria-expanded", "false")

    page.mouse.up()
    page.wait_for_timeout(260)
    expect(page.locator(".widget-dragging")).to_have_count(0)
    assert_clean_browser(page)


def test_pin_action_closes_tool_menu_and_restores_hover_close(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    open_tools(widget)
    widget.locator(".panel-pin-toggle").click(force=True)
    page.wait_for_timeout(180)
    expect(widget).to_have_class(re.compile("db-panel-pinned"))
    expect(widget).not_to_have_class(re.compile("widget-tools-open"))
    expect(widget.locator(".panel-settings-toggle")).to_have_attribute("aria-expanded", "false")

    open_tools(widget)
    page.mouse.move(24, 24)
    page.wait_for_timeout(360)
    expect(widget).not_to_have_class(re.compile("widget-tools-open"))
    assert_clean_browser(page)


def test_widget_menu_icons_align_like_panel_icons(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = page.locator(".panel-layout > .db-panel").first
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    open_tools(panel)
    open_tools(widget)

    delta = page.evaluate(
        """
        () => {
          const centerDelta = (button) => {
            const icon = button.querySelector(".settings-icon");
            const buttonRect = button.getBoundingClientRect();
            const iconRect = icon.getBoundingClientRect();
            return {
              x: Math.abs((buttonRect.left + buttonRect.width / 2) - (iconRect.left + iconRect.width / 2)),
              y: Math.abs((buttonRect.top + buttonRect.height / 2) - (iconRect.top + iconRect.height / 2)),
            };
          };
          const sideCenterDelta = (item, button) => {
            const itemRect = item.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            return Math.abs((itemRect.top + itemRect.height / 2) - (buttonRect.top + buttonRect.height / 2));
          };
          const rightInset = (item, button) => {
            const itemRect = item.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            return itemRect.right - buttonRect.right;
          };
          const widget = document.querySelector(".widget-layout > .stat-card.widget-card:not(.range-bar)");
          const timeframe = document.querySelector(".timeframe-widget");
          const panel = document.querySelector(".panel-layout > .db-panel");
          const panelButton = panel.querySelector(".panel-settings-toggle");
          const widgetButton = widget.querySelector(".panel-settings-toggle");
          const timeframeButton = timeframe.querySelector(".panel-settings-toggle");
          return {
            panel: centerDelta(panelButton),
            widget: centerDelta(widgetButton),
            widgetSideCenter: sideCenterDelta(widget, widgetButton),
            panelRightInset: rightInset(panel, panelButton),
            widgetRightInset: rightInset(widget, widgetButton),
            timeframeRightInset: rightInset(timeframe, timeframeButton),
          };
        }
        """
    )
    assert delta["panel"]["x"] <= 1
    assert delta["panel"]["y"] <= 1
    assert delta["widget"]["x"] <= 1
    assert delta["widget"]["y"] <= 1
    assert abs(delta["widget"]["x"] - delta["panel"]["x"]) <= 1
    assert abs(delta["widget"]["y"] - delta["panel"]["y"]) <= 1
    assert delta["widgetSideCenter"] <= 1
    assert abs(delta["widgetRightInset"] - delta["panelRightInset"]) <= 1
    assert abs(delta["timeframeRightInset"] - delta["panelRightInset"]) <= 1
    assert_clean_browser(page)


def test_panel_widget_hover_focus_surface_parity(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = page.locator(".panel-layout > .db-panel").first
    collapsed_panel = page.locator(".panel-layout > .db-panel.db-panel-collapsed").first
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    timeframe = page.locator(".timeframe-widget")

    def read_surface(locator) -> dict:
        return locator.evaluate(
            """
            node => {
              const computed = getComputedStyle(node);
              return {
                borderColor: computed.borderTopColor,
                boxShadow: computed.boxShadow,
                transform: computed.transform,
                outlineColor: computed.outlineColor,
                outlineStyle: computed.outlineStyle,
                outlineWidth: computed.outlineWidth,
              };
            }
            """
        )

    widget.hover()
    page.wait_for_timeout(260)
    widget_hover = read_surface(widget)

    panel.hover()
    page.wait_for_timeout(260)
    panel_hover = read_surface(panel)
    assert panel_hover["borderColor"] == widget_hover["borderColor"]
    assert panel_hover["boxShadow"] == widget_hover["boxShadow"]
    assert panel_hover["transform"] == widget_hover["transform"]

    if collapsed_panel.count():
        collapsed_panel.hover()
        page.wait_for_timeout(260)
        collapsed_hover = read_surface(collapsed_panel)
        assert collapsed_hover["boxShadow"] == widget_hover["boxShadow"]
        assert collapsed_hover["transform"] == widget_hover["transform"]

    timeframe.hover()
    page.wait_for_timeout(260)
    timeframe_hover = read_surface(timeframe)
    assert timeframe_hover["borderColor"] == widget_hover["borderColor"]
    assert timeframe_hover["boxShadow"] == widget_hover["boxShadow"]
    assert timeframe_hover["transform"] == widget_hover["transform"]

    page.mouse.move(24, 24)
    panel.locator(".db-panel-hd").focus()
    page.wait_for_timeout(180)
    panel_focus = read_surface(panel)
    page.mouse.move(24, 24)
    widget.focus()
    page.wait_for_timeout(180)
    widget_focus = read_surface(widget)
    assert panel_focus["borderColor"] == widget_focus["borderColor"]
    assert panel_focus["boxShadow"] == widget_focus["boxShadow"]
    assert panel_focus["transform"] == widget_focus["transform"]
    assert panel_focus["outlineStyle"] != "solid" or panel_focus["outlineWidth"] in {"0px", "1px", "2px"}
    assert_clean_browser(page)


def test_panel_header_chevrons_are_optically_centered(page: Page, app_server: str) -> None:
    goto(page, app_server)

    def chevron_metrics() -> list[dict]:
        return page.locator(".panel-layout > .db-panel .db-panel-hd").evaluate_all(
            """
            headers => headers.map((header) => {
              const headerStyles = getComputedStyle(header);
              const before = getComputedStyle(header, "::before");
              const after = getComputedStyle(header, "::after");
              const headerRect = header.getBoundingClientRect();
              const left = parseFloat(after.left);
              const top = after.top.trim();
              const topOffset = top.endsWith("%")
                ? Math.abs(parseFloat(top) - 50)
                : Math.abs(parseFloat(top) - (headerRect.height / 2));
              return {
                key: header.closest(".db-panel")?.dataset.panelKey || "",
                collapsed: header.closest(".db-panel")?.classList.contains("db-panel-collapsed") || false,
                xOffset: Math.abs(left - (parseFloat(headerStyles.paddingLeft) + (parseFloat(before.width) / 2))),
                topOffset,
                width: parseFloat(after.width),
                height: parseFloat(after.height),
                borderRightWidth: after.borderRightWidth,
                borderBottomWidth: after.borderBottomWidth,
                maskImage: after.webkitMaskImage || after.maskImage,
                transform: after.transform,
              };
            })
            """
        )

    for metric in chevron_metrics():
        assert metric["xOffset"] <= 0.5, metric
        assert metric["topOffset"] <= 0.5, metric
        assert 14 <= metric["width"] <= 16, metric
        assert 14 <= metric["height"] <= 16, metric
        assert metric["borderRightWidth"] == "0px", metric
        assert metric["borderBottomWidth"] == "0px", metric
        assert metric["maskImage"] != "none", metric

    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    for metric in chevron_metrics():
        assert metric["xOffset"] <= 0.5, metric
        assert metric["topOffset"] <= 0.5, metric
        assert metric["maskImage"] != "none", metric

    assert_clean_browser(page)


def test_dark_panel_hover_matches_widget_highlight(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")

    panel = page.locator(".panel-layout > .db-panel").first
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    panel.hover()
    page.wait_for_timeout(260)
    panel_styles = panel.evaluate("node => ({ borderColor: getComputedStyle(node).borderColor, boxShadow: getComputedStyle(node).boxShadow })")
    widget.hover()
    page.wait_for_timeout(260)
    widget_styles = widget.evaluate("node => ({ borderColor: getComputedStyle(node).borderColor, boxShadow: getComputedStyle(node).boxShadow })")

    assert panel_styles["borderColor"] == widget_styles["borderColor"]
    assert panel_styles["boxShadow"] == widget_styles["boxShadow"]
    assert_clean_browser(page)


def test_dark_panel_settings_menu_matches_widget_without_white_ring(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.locator(".theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")

    panel = page.locator(".panel-layout > .db-panel").first
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    artifact_dir = Path("test-results") / "dark-menu-parity"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    open_tools(panel)
    page.wait_for_timeout(220)
    panel.screenshot(path=str(artifact_dir / "panel-open-dark.png"))

    panel_styles = page.evaluate(
        """
        () => {
          const read = (button) => {
            const computed = getComputedStyle(button);
            return {
              backgroundColor: computed.backgroundColor,
              borderColor: computed.borderColor,
              boxShadow: computed.boxShadow,
              color: computed.color,
              outlineColor: computed.outlineColor,
              outlineStyle: computed.outlineStyle,
              outlineWidth: computed.outlineWidth,
            };
          };
          return read(document.querySelector(".panel-layout > .db-panel .panel-settings-toggle"));
        }
        """
    )

    page.mouse.move(24, 24)
    page.wait_for_timeout(360)
    open_tools(widget)
    page.wait_for_timeout(220)
    widget.screenshot(path=str(artifact_dir / "widget-open-dark.png"))

    widget_styles = page.evaluate(
        """
        () => {
          const button = document.querySelector(".widget-layout > .stat-card.widget-card:not(.range-bar) .panel-settings-toggle");
          const computed = getComputedStyle(button);
          return {
            backgroundColor: computed.backgroundColor,
            borderColor: computed.borderColor,
            boxShadow: computed.boxShadow,
            color: computed.color,
            outlineColor: computed.outlineColor,
            outlineStyle: computed.outlineStyle,
            outlineWidth: computed.outlineWidth,
          };
        }
        """
    )

    assert panel_styles["backgroundColor"] == widget_styles["backgroundColor"]
    assert panel_styles["borderColor"] == widget_styles["borderColor"]
    assert panel_styles["boxShadow"] == widget_styles["boxShadow"]
    assert panel_styles["color"] == widget_styles["color"]
    assert panel_styles["outlineStyle"] == widget_styles["outlineStyle"]
    assert panel_styles["outlineStyle"] == "none"
    assert_clean_browser(page)


def test_group_mode_and_layout_save_load_reset(page: Page, app_server: str) -> None:
    goto(page, app_server)

    saved_panel = add_panel_for_setup(page)
    open_tools(saved_panel)
    saved_panel.locator(".panel-title-handle").click(force=True)
    saved_panel.locator(".db-panel-title").fill("Saved Panel")
    saved_panel.locator(".db-panel-title").press("Enter")

    group_button = page.locator(".layout-group-button")
    group_button.click()
    expect(group_button).to_have_attribute("aria-pressed", "true")
    page.locator(".panel-layout > .db-panel").nth(0).click(position={"x": 20, "y": 20})
    page.locator(".panel-layout > .db-panel").nth(1).click(position={"x": 20, "y": 20})
    expect(page.locator(".panel-layout > .db-panel.group-selected")).to_have_count(2)
    group_button.click()
    expect(group_button).to_have_attribute("aria-pressed", "false")

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()

    page.locator(".panel-reset-button").click()
    page.wait_for_timeout(250)
    expect(page.locator(".panel-layout > .db-panel", has_text="Saved Panel")).to_have_count(0)

    page.locator(".layout-load-button").click()
    page.wait_for_timeout(350)
    expect(page.locator(".panel-layout > .db-panel", has_text="Saved Panel")).to_have_count(1)
    assert_clean_browser(page)


def test_group_drag_moves_selected_items_as_shared_transform(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1) => {
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
          };
          const widget = document.querySelector('[data-widget-key="widget-1"]');
          const pinned = document.querySelector('[data-widget-key="widget-2"]');
          const panel = document.querySelector('[data-panel-key="builder-table"]');
          place(widget, 1, 2, 1);
          place(pinned, 6, 2, 1);
          place(panel, 3, 2, 2, 3);
          pinned.classList.add("db-panel-pinned");
          pinned.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", "true");
        }
        """
    )

    group_button = page.locator(".layout-group-button")
    group_button.click()
    widget = page.locator('[data-widget-key="widget-1"]')
    pinned = page.locator('[data-widget-key="widget-2"]')
    panel = page.locator('[data-panel-key="builder-table"]')
    widget.click(position={"x": 20, "y": 20})
    pinned.click(position={"x": 20, "y": 20})
    panel.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(3)

    before = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "pinned": grid_item_state(page, '[data-widget-key="widget-2"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-table"]'),
    }
    open_tools(widget)
    drag_by(page, widget.locator(".panel-move-handle"), 0, 220, steps=18)
    page.wait_for_timeout(360)
    after = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "pinned": grid_item_state(page, '[data-widget-key="widget-2"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-table"]'),
    }

    widget_delta = after["widget"]["row"] - before["widget"]["row"]
    panel_delta = after["panel"]["row"] - before["panel"]["row"]
    assert widget_delta > 0
    assert panel_delta == widget_delta
    assert after["panel"]["col"] - after["widget"]["col"] == before["panel"]["col"] - before["widget"]["col"]
    assert after["pinned"]["row"] == before["pinned"]["row"]
    assert after["pinned"]["col"] == before["pinned"]["col"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_group_resize_is_proportional_and_minimum_aware(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1) => {
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
          };
          const timeframe = document.querySelector('[data-widget-key="builder-search"]');
          const stat = document.querySelector('[data-widget-key="widget-1"]');
          const panel = document.querySelector('[data-panel-key="builder-table"]');
          timeframe.dataset.minW = "4";
          place(timeframe, 1, 1, 6);
          place(stat, 1, 4, 2);
          place(panel, 4, 4, 3, 3);
          panel.style.height = "275px";
          panel.dataset.savedHeight = "275";
        }
        """
    )

    page.locator(".layout-group-button").click()
    timeframe = page.locator('[data-widget-key="builder-search"]')
    stat = page.locator('[data-widget-key="widget-1"]')
    panel = page.locator('[data-panel-key="builder-table"]')
    timeframe.click(position={"x": 20, "y": 20})
    stat.click(position={"x": 20, "y": 20})
    panel.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(3)

    outline_width = stat.evaluate("node => parseFloat(getComputedStyle(node).outlineWidth)")
    assert outline_width <= 2

    open_tools(stat)
    drag_by(page, stat.locator(".panel-resize-handle"), -700, 0, steps=18)
    page.wait_for_timeout(360)

    sizes = page.evaluate(
        """
        () => ({
          timeframe: Number(document.querySelector('[data-widget-key="builder-search"]').dataset.currentSpan),
          stat: Number(document.querySelector('[data-widget-key="widget-1"]').dataset.currentSpan),
          panel: Number(document.querySelector('[data-panel-key="builder-table"]').dataset.currentSpan),
          timeframeMin: Number(document.querySelector('[data-widget-key="builder-search"]').dataset.minW),
          panelRows: Number(document.querySelector('[data-panel-key="builder-table"]').dataset.gridRowSpan),
        })
        """
    )

    assert sizes["timeframe"] == sizes["timeframeMin"] == 4
    assert sizes["stat"] >= 1
    assert sizes["panel"] >= 1
    assert len({sizes["timeframe"], sizes["stat"], sizes["panel"]}) > 1
    assert sizes["panelRows"] >= 1
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_layout_save_load_round_trips_exact_item_state(page: Page, app_server: str) -> None:
    goto(page, app_server)

    expected = page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1, height = null) => {
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            if (height) {
              node.dataset.savedHeight = String(height);
              node.style.height = `${height}px`;
            }
          };
          const setPinned = (node, pinned) => {
            node.classList.toggle("db-panel-pinned", pinned);
            node.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", String(pinned));
          };
          const widgetLayout = document.querySelector('.widget-layout[data-widget-layout-key="builder"]');
          const panelLayout = document.querySelector('.panel-layout[data-layout-key="builder"]');
          const widgets = {
            A: widgetLayout.querySelector('[data-widget-key="builder-search"]'),
            B: widgetLayout.querySelector('[data-widget-key="widget-1"]'),
            C: widgetLayout.querySelector('[data-widget-key="widget-2"]'),
            D: widgetLayout.querySelector('[data-widget-key="widget-3"]'),
            E: widgetLayout.querySelector('[data-widget-key="widget-4"]'),
          };
          place(widgets.A, 1, 1, 4);
          place(widgets.B, 5, 1, 1);
          place(widgets.C, 6, 1, 1);
          place(widgets.D, 1, 4, 1);
          place(widgets.E, 5, 5, 2);
          setPinned(widgets.A, true);
          setPinned(widgets.B, false);
          setPinned(widgets.C, false);
          setPinned(widgets.D, false);
          setPinned(widgets.E, true);

          const panels = {
            table: panelLayout.querySelector('[data-panel-key="builder-table"]'),
            menu: panelLayout.querySelector('[data-panel-key="builder-menu"]'),
            notes: panelLayout.querySelector('[data-panel-key="builder-notes"]'),
          };
          panels.table.classList.remove("db-panel-collapsed");
          panels.menu.classList.add("db-panel-collapsed");
          panels.notes.classList.remove("db-panel-collapsed");
          place(panels.table, 1, 7, 3, 3, 275);
          place(panels.menu, 4, 7, 2, 1);
          place(panels.notes, 6, 10, 1, 3, 275);
          setPinned(panels.notes, true);

          return [...document.querySelectorAll('.dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel')]
            .map((node, index) => ({
              key: node.dataset.widgetKey || node.dataset.panelKey,
              type: node.classList.contains("widget-card") ? "widget" : "panel",
              index,
              col: Number(node.dataset.gridCol || 0),
              row: Number(node.dataset.gridRow || 0),
              span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 1),
              rowSpan: Number(node.dataset.gridRowSpan || 1),
              pinned: node.classList.contains("db-panel-pinned"),
              collapsed: node.classList.contains("db-panel-collapsed"),
            }));
        }
        """
    )

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()

    stored = page.evaluate(
        """
        () => {
          const read = (prefix) => Object.fromEntries(
            Object.keys(localStorage)
              .filter((key) => key.startsWith(prefix))
              .map((key) => [key.split(":").pop(), JSON.parse(localStorage.getItem(key))])
          );
          return {
            widgets: read("dashboard-widget-six-grid-layout:1:builder:"),
            panels: read("dashboard-panel-six-grid-layout:1:builder:"),
          };
        }
        """
    )
    assert stored["widgets"]["builder-search"]["pinned"] is True
    assert stored["widgets"]["widget-4"]["pinned"] is True
    assert stored["widgets"]["widget-1"]["pinned"] is False
    assert stored["widgets"]["widget-3"]["gridRow"] == 4
    assert stored["widgets"]["widget-4"]["gridRow"] == 5
    assert stored["panels"]["builder-notes"]["pinned"] is True
    assert stored["panels"]["builder-menu"]["collapsed"] is True

    page.locator(".panel-reset-button").click()
    page.wait_for_timeout(250)
    assert page.locator('[data-widget-key="widget-4"]').evaluate("node => node.classList.contains('db-panel-pinned')") is False

    with page.expect_navigation(wait_until="networkidle"):
        page.locator(".layout-load-button").click()
    page.wait_for_selector(".dashboard-layout-grid")

    actual = page.evaluate(
        """
        () => [...document.querySelectorAll('.dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel')]
          .map((node, index) => ({
            key: node.dataset.widgetKey || node.dataset.panelKey,
            type: node.classList.contains("widget-card") ? "widget" : "panel",
            index,
            col: Number(node.dataset.gridCol || 0),
            row: Number(node.dataset.gridRow || 0),
            span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 1),
            rowSpan: Number(node.dataset.gridRowSpan || 1),
            pinned: node.classList.contains("db-panel-pinned"),
            collapsed: node.classList.contains("db-panel-collapsed"),
          }))
        """
    )

    by_key = {item["key"]: item for item in actual}
    expected_by_key = {item["key"]: item for item in expected}
    for key, expected_item in expected_by_key.items():
        actual_item = by_key[key]
        assert actual_item["type"] == expected_item["type"], key
        assert actual_item["index"] == expected_item["index"], key
        assert actual_item["col"] == expected_item["col"], key
        assert actual_item["row"] == expected_item["row"], key
        assert actual_item["span"] == expected_item["span"], key
        assert actual_item["rowSpan"] == expected_item["rowSpan"], key
        assert actual_item["pinned"] == expected_item["pinned"], key
        assert actual_item["collapsed"] == expected_item["collapsed"], key

    assert by_key["builder-search"]["pinned"] is True
    assert by_key["widget-4"]["pinned"] is True
    assert by_key["widget-1"]["pinned"] is False
    assert by_key["widget-4"]["row"] == 5
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_settings_save_updates_dashboard_title(page: Page, app_server: str) -> None:
    goto(page, app_server, "/settings")
    page.locator('input[name="title"]').fill("QA Dashboard")
    page.locator('input[name="description"]').fill("Automated browser test workspace")
    page.locator("#settings-save-btn").click()
    page.wait_for_url(re.compile(r"/settings\?saved=1$"))
    expect(page.locator(".sync-note")).to_have_text("Settings saved.")

    page.locator("#settings-dashboard-btn").click()
    page.wait_for_url(re.compile(r"/dashboard$"))
    expect(page.locator(".dash-switch-hero")).to_contain_text("QA Dashboard")
    assert_clean_browser(page)


def test_mobile_viewport_has_no_horizontal_reflow_or_overflow(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 390, "height": 844})
    goto(page, app_server)

    metrics = page.evaluate(
        """
        () => {
          const nav = document.querySelector(".app-nav");
          const grid = document.querySelector(".dashboard-layout-grid");
          const navRect = nav.getBoundingClientRect();
          const gridRect = grid.getBoundingClientRect();
          return {
            docOverflow: document.documentElement.scrollWidth - window.innerWidth,
            bodyOverflow: document.body.scrollWidth - window.innerWidth,
            navLeft: navRect.left,
            navRight: navRect.right,
            gridLeft: gridRect.left,
            gridRight: gridRect.right,
          };
        }
        """
    )
    assert metrics["docOverflow"] <= 2
    assert metrics["bodyOverflow"] <= 2
    assert math.floor(metrics["navLeft"]) >= 0
    assert math.ceil(metrics["navRight"]) <= 390
    assert math.floor(metrics["gridLeft"]) >= 0
    assert math.ceil(metrics["gridRight"]) <= 390
    assert_clean_browser(page)
