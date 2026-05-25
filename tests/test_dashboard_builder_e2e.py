import math
import os
import re
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect


pytestmark = pytest.mark.e2e

RESPONSIVE_E2E_ENABLED = os.environ.get("DASHBOARD_ENABLE_RESPONSIVE_E2E", "").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
skip_responsive_during_desktop_iteration = pytest.mark.skipif(
    not RESPONSIVE_E2E_ENABLED,
    reason=(
        "Temporarily disabled during the desktop-interaction iteration phase; "
        "set DASHBOARD_ENABLE_RESPONSIVE_E2E=1 to run responsive/mobile coverage."
    ),
)


def goto(page: Page, base_url: str, path: str = "/dashboard") -> None:
    page.goto(f"{base_url}{path}", wait_until="networkidle")
    page.wait_for_selector(".page")


def assert_clean_browser(page: Page) -> None:
    assert page.console_errors == []
    assert page.page_errors == []
    assert page.network_errors == []


ANCHOR_DIVIDER_ALIGNMENT_JS = """
node => {
  const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
  const grid = node.closest(".dashboard-layout-grid") || document.querySelector(".dashboard-layout-grid");
  const nav = document.querySelector(".app-nav.workspace-chrome, .app-nav");
  const navBottom = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0;
  const targetViewportTop = grid
    ? Math.max(navBottom + 8, Math.round(grid.getBoundingClientRect().top + currentScroll))
    : navBottom + 8;
  const targetTop = node.getBoundingClientRect().top + currentScroll;
  const rawTop = Math.max(0, Math.round(targetTop - targetViewportTop));
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const scrollTarget = Math.min(rawTop, maxScroll);
  return {
    scrollTarget,
    scrollY: window.scrollY,
    rectTop: node.getBoundingClientRect().top,
    targetViewportTop,
    delta: node.getBoundingClientRect().top - targetViewportTop,
    navBottom,
    maxScroll,
  };
}
"""


def anchor_divider_alignment(locator) -> dict:
    return locator.evaluate(ANCHOR_DIVIDER_ALIGNMENT_JS)


def wait_for_anchor_divider_alignment(page: Page, locator, tolerance: int = 8) -> dict:
    handle = locator.element_handle()
    assert handle
    page.wait_for_function(
        f"""
        node => {{
          const state = ({ANCHOR_DIVIDER_ALIGNMENT_JS})(node);
          return Math.abs(state.scrollY - state.scrollTarget) <= 32 &&
            Math.abs(state.delta) <= {tolerance};
        }}
        """,
        arg=handle,
    )
    alignment = anchor_divider_alignment(locator)
    assert abs(alignment["delta"]) <= tolerance
    return alignment


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
    is_open = item.evaluate(
        """
        node => node.classList.contains("widget-tools-open") || node.classList.contains("db-panel-tools-open")
        """
    )
    if not is_open:
        item.locator(".panel-settings-toggle").click(force=True)
    expect(item.locator(".panel-tool-drawer")).to_be_visible()


def force_open_tools_for_interaction(page: Page, item) -> None:
    item.evaluate(
        """
        node => {
          const isWidget = node.classList.contains("widget-card");
          node.classList.add(isWidget ? "widget-tools-open" : "db-panel-tools-open");
          node.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "true");
          document.body.classList.add("layout-tools-active");
        }
        """
    )
    expect(item.locator(".panel-tool-drawer")).to_be_visible()
    page.wait_for_function(
        """
        node => {
          const drawer = node.querySelector(".panel-tool-drawer");
          return Number(getComputedStyle(drawer).opacity) > .99 &&
            drawer.getBoundingClientRect().width >= drawer.offsetWidth - .25;
        }
        """,
        arg=item.element_handle(),
    )


def force_close_tools(item) -> None:
    item.evaluate(
        """
        node => {
          node.classList.remove("widget-tools-open", "db-panel-tools-open");
          node.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "false");
          node.querySelector(".panel-color-toggle")?.setAttribute("aria-expanded", "false");
          document.querySelectorAll(".panel-color-menu-open").forEach(menu => menu.classList.remove("panel-color-menu-open"));
          document.body.classList.toggle(
            "layout-tools-active",
            Boolean(document.querySelector(".widget-tools-open, .db-panel-tools-open"))
          );
        }
        """
    )


def resize_cleanup_state(page: Page) -> dict:
    return page.evaluate(
        """
        () => ({
          live: document.querySelectorAll(".dashboard-live-resize").length,
          preview: document.querySelectorAll(".dashboard-resize-preview").length,
          source: document.querySelectorAll(".dashboard-resize-source").length,
          active: document.querySelectorAll(".dashboard-active-resize").length,
          bodyResize: document.body.classList.contains("panel-resize-active"),
          bodyInteraction: document.body.classList.contains("panel-interaction-active"),
          groupActive: document.body.classList.contains("group-transform-active"),
        })
        """
    )


def assert_no_resize_artifacts(page: Page) -> None:
    assert resize_cleanup_state(page) == {
        "live": 0,
        "preview": 0,
        "source": 0,
        "active": 0,
        "bodyResize": False,
        "bodyInteraction": False,
        "groupActive": False,
    }


def assert_no_undo_artifacts(page: Page) -> None:
    state = page.evaluate(
        """
        () => ({
          liveResize: document.querySelectorAll(".dashboard-live-resize").length,
          resizePreview: document.querySelectorAll(".dashboard-resize-preview").length,
          expandedGhost: document.querySelectorAll(".dashboard-expanded-footprint-ghost").length,
          groupBoundary: document.querySelectorAll(".dashboard-group-boundary").length,
          memberPreview: document.querySelectorAll(".dashboard-group-member-preview").length,
          dragPreview: document.querySelectorAll(".widget-placeholder, .db-panel-placeholder").length,
          resizeSource: document.querySelectorAll(".dashboard-resize-source").length,
          activeResize: document.querySelectorAll(".dashboard-active-resize").length,
          bodyResize: document.body.classList.contains("panel-resize-active"),
          bodyInteraction: document.body.classList.contains("panel-interaction-active"),
          groupActive: document.body.classList.contains("group-transform-active"),
          autoScroll: document.body.classList.contains("dashboard-auto-scroll-active"),
          scrollExtended: document.body.classList.contains("dashboard-interaction-scroll-extended"),
        })
        """
    )
    assert state == {
        "liveResize": 0,
        "resizePreview": 0,
        "expandedGhost": 0,
        "groupBoundary": 0,
        "memberPreview": 0,
        "dragPreview": 0,
        "resizeSource": 0,
        "activeResize": 0,
        "bodyResize": False,
        "bodyInteraction": False,
        "groupActive": False,
        "autoScroll": False,
        "scrollExtended": False,
    }


def press_dashboard_undo(page: Page) -> None:
    page.keyboard.press("Control+Z")
    page.wait_for_timeout(260)


def press_dashboard_redo(page: Page) -> None:
    page.keyboard.press("Control+Y")
    page.wait_for_timeout(260)


def dashboard_scroll_state(page: Page) -> dict:
    return page.evaluate(
        """
        () => ({
          scrollY: window.scrollY,
          autoScrollActive: document.body.classList.contains("dashboard-auto-scroll-active"),
          rootHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          bodyHorizontalOverflow: document.body.scrollWidth > document.body.clientWidth + 1,
          liveResize: document.querySelectorAll(".dashboard-live-resize").length,
          resizePreview: document.querySelectorAll(".dashboard-resize-preview").length,
          groupBoundary: document.querySelectorAll(".dashboard-group-boundary").length,
          groupFootprint: document.querySelectorAll(".dashboard-group-footprint, .dashboard-group-resize-footprint").length,
          extension: document.body.classList.contains("dashboard-interaction-scroll-extended") ? 1 : 0,
          extensionHeight: Number.parseFloat(document.body.style.paddingBottom || "0"),
        })
        """
    )


def assert_no_auto_scroll_artifacts(page: Page) -> None:
    page.wait_for_function('!document.body.classList.contains("dashboard-auto-scroll-active")')
    state = dashboard_scroll_state(page)
    assert state["autoScrollActive"] is False
    assert state["extension"] == 0
    assert state["extensionHeight"] == 0
    assert state["rootHorizontalOverflow"] is False
    assert state["bodyHorizontalOverflow"] is False


def sample_auto_scroll_motion(page: Page, frames: int = 14) -> list[dict]:
    return page.evaluate(
        """
        (frames) => new Promise((resolve) => {
          const samples = [];
          const read = () => {
            samples.push({
              scrollY: window.scrollY,
              extensionHeight: Number.parseFloat(document.body.style.paddingBottom || "0"),
            });
            if (samples.length >= frames) {
              resolve(samples);
            } else {
              requestAnimationFrame(read);
            }
          };
          requestAnimationFrame(read);
        })
        """,
        frames,
    )


def assert_smooth_auto_scroll_motion(samples: list[dict]) -> None:
    scroll_deltas = [
        samples[index + 1]["scrollY"] - samples[index]["scrollY"]
        for index in range(len(samples) - 1)
    ]
    extension_deltas = [
        samples[index + 1]["extensionHeight"] - samples[index]["extensionHeight"]
        for index in range(len(samples) - 1)
    ]
    positive_scroll = [delta for delta in scroll_deltas if delta > 0.25]
    positive_extension = [delta for delta in extension_deltas if delta > 0.25]
    assert_shared_edge_scroll_motion(samples, 1)
    if positive_extension:
        assert max(positive_extension) < 72, samples


def assert_shared_edge_scroll_motion(samples: list[dict], direction: int) -> None:
    scroll_deltas = [
        samples[index + 1]["scrollY"] - samples[index]["scrollY"]
        for index in range(len(samples) - 1)
    ]
    directional = [delta * direction for delta in scroll_deltas]
    active = [delta for delta in directional if delta > 0.25]
    assert len(active) >= 6, samples
    assert all(delta >= -0.1 for delta in directional), samples
    assert max(active) < 44, samples
    assert max(active) <= max(12, sum(active) * 0.42), samples


def assert_smooth_upward_auto_scroll_motion(samples: list[dict]) -> None:
    assert_shared_edge_scroll_motion(samples, -1)


def prepare_edge_autoscroll_fixture(page: Page) -> None:
    page.evaluate(
        """
        () => {
          const rowHeight = 81;
          const gap = 16;
          const panelHeight = (rows) => (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const place = (node, col, row, span = 1, rowSpan = 1) => {
            if (!node) return;
            node.hidden = false;
            node.dataset.currentSpan = String(span);
            node.dataset.defaultSpan = node.dataset.defaultSpan || String(span);
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            if (node.classList.contains("db-panel")) {
              node.classList.remove("db-panel-collapsed");
              node.dataset.savedHeight = String(panelHeight(rowSpan));
              node.style.height = `${panelHeight(rowSpan)}px`;
              node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "true");
            } else {
              node.style.removeProperty("height");
            }
          };
          place(document.querySelector('[data-widget-key="builder-search"]'), 1, 1, 4, 1);
          place(document.querySelector('[data-widget-key="widget-1"]'), 1, 3, 1, 1);
          place(document.querySelector('[data-widget-key="widget-2"]'), 1, 20, 1, 1);
          place(document.querySelector('[data-widget-key="widget-3"]'), 2, 20, 1, 1);
          place(document.querySelector('[data-panel-key="builder-content"]'), 3, 3, 2, 2);
          place(document.querySelector('[data-panel-key="builder-menu"]'), 3, 6, 2, 2);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 5, 20, 2, 2);
          document.querySelectorAll(".group-selected").forEach((node) => node.classList.remove("group-selected"));
          document.body.classList.remove("group-transform-active", "dashboard-auto-scroll-active");
          window.scrollTo(0, 0);
        }
        """
    )


def move_pointer_to_bottom_edge(page: Page, x: float, start_y: float, x_delta: float = 80, steps: int = 18) -> None:
    viewport = page.viewport_size or {"height": 560}
    page.mouse.move(x + 18, start_y + 18, steps=4)
    page.mouse.move(x + x_delta, viewport["height"] - 8, steps=steps)


def move_pointer_to_top_edge(page: Page, x: float, start_y: float, x_delta: float = 40, steps: int = 18) -> None:
    page.mouse.move(x + 12, start_y - 12, steps=4)
    page.mouse.move(x + x_delta, 8, steps=steps)


def drag_to_auto_expanded_row(page: Page, item_selector: str, placeholder_selector: str, target_row: int, x_delta: float = 80) -> dict:
    item = page.locator(item_selector)
    item.scroll_into_view_if_needed()
    page.wait_for_timeout(120)
    before = grid_item_state(page, item_selector)
    open_tools(item)
    handle_box = item.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, x, y, x_delta=x_delta, steps=20)
    page.wait_for_function(
        """
        ([placeholderSelector, targetRow]) => {
          const placeholder = document.querySelector(placeholderSelector);
          return window.scrollY > 120 &&
            document.body.classList.contains("dashboard-interaction-scroll-extended") &&
            placeholder &&
            Number(placeholder.dataset.gridRow || 0) >= targetRow;
        }
        """,
        arg=[placeholder_selector, target_row + 3],
        timeout=45000,
    )
    viewport = page.viewport_size or {"height": 560}
    page.mouse.move(x + x_delta, viewport["height"] - 140, steps=4)
    page.wait_for_function(
        """
        ([placeholderSelector, targetRow]) => {
          const placeholder = document.querySelector(placeholderSelector);
          return !document.body.classList.contains("dashboard-auto-scroll-active") &&
            placeholder &&
            Number(placeholder.dataset.gridRow || 0) >= targetRow;
        }
        """,
        arg=[placeholder_selector, target_row],
        timeout=10000,
    )
    preview = page.locator(placeholder_selector).evaluate(
        """
        node => ({
          col: Number(node.dataset.gridCol || 0),
          row: Number(node.dataset.gridRow || 0),
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
          rowSpan: Number(node.dataset.gridRowSpan || 1),
        })
        """
    )
    drop_scroll_y = dashboard_scroll_state(page)["scrollY"]
    page.mouse.up()
    page.wait_for_timeout(420)
    after = grid_item_state(page, item_selector)
    return {
        "before": before,
        "preview": preview,
        "after": after,
        "dropScrollY": drop_scroll_y,
        "afterScrollY": dashboard_scroll_state(page)["scrollY"],
    }


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
            height: Math.round(rect.height),
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


def grid_state_tuple(state: dict) -> tuple[int, int, int, int]:
    return state["col"], state["row"], state["span"], state["rowSpan"]


def occupied_grid_cells(page: Page, selector: str) -> list[str]:
    return page.locator(selector).evaluate_all(
        """
        nodes => nodes.flatMap((node) => {
          const col = Number(node.dataset.gridCol || 0);
          const row = Number(node.dataset.gridRow || 0);
          const span = Number(node.dataset.currentSpan || node.dataset.defaultSpan || 1);
          const rowSpan = Number(node.dataset.gridRowSpan || 1);
          const cells = [];
          for (let y = row; y < row + rowSpan; y += 1) {
            for (let x = col; x < col + span; x += 1) {
              cells.push(`${y}:${x}`);
            }
          }
          return cells;
        })
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


def test_adding_many_panels_appends_without_global_layout_scramble(page: Page, app_server: str) -> None:
    goto(page, app_server)

    stable_selector = ".dashboard-layout-grid .widget-card:not([hidden]), .panel-layout > .db-panel[data-panel-key^='builder-']:not([hidden])"
    before = {item["key"]: item for item in grid_item_states(page, stable_selector)}

    for index in range(8):
        page.locator('.panel-add-action[data-panel-kind="panel"]').evaluate("node => node.click()")
        expect(page.locator('.panel-layout > .db-panel[data-custom-panel="true"]')).to_have_count(index + 1)

    after = {item["key"]: item for item in grid_item_states(page, stable_selector)}
    for key, original in before.items():
        assert after[key]["col"] == original["col"], (key, original, after[key])
        assert after[key]["row"] == original["row"], (key, original, after[key])
        assert after[key]["span"] == original["span"], (key, original, after[key])
        assert after[key]["rowSpan"] == original["rowSpan"], (key, original, after[key])

    custom = grid_item_states(page, '.panel-layout > .db-panel[data-custom-panel="true"]')
    assert len(custom) == 8
    assert all(item["col"] > 0 and item["row"] > 0 for item in custom)
    custom_positions = [(item["row"], item["col"]) for item in custom]
    assert custom_positions == sorted(custom_positions)
    cells = occupied_grid_cells(page, ".dashboard-layout-grid .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])")
    assert len(cells) == len(set(cells))
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    committed = {
        item["key"]: (item["col"], item["row"], item["span"], item["rowSpan"])
        for item in grid_item_states(page, '.panel-layout > .db-panel[data-custom-panel="true"]')
    }
    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    expect(page.locator('.panel-layout > .db-panel[data-custom-panel="true"]')).to_have_count(8)
    reloaded = {
        item["key"]: (item["col"], item["row"], item["span"], item["rowSpan"])
        for item in grid_item_states(page, '.panel-layout > .db-panel[data-custom-panel="true"]')
    }
    assert reloaded == committed
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    victim = page.locator('.panel-layout > .db-panel[data-custom-panel="true"]').nth(3)
    open_tools(victim)
    victim.locator(".panel-delete-handle").click(force=True)
    expect(page.locator("#panel-delete-dialog")).not_to_be_visible()
    expect(page.locator('.panel-layout > .db-panel[data-custom-panel="true"]')).to_have_count(7)
    page.locator('.panel-add-action[data-panel-kind="panel"]').evaluate("node => node.click()")
    expect(page.locator('.panel-layout > .db-panel[data-custom-panel="true"]')).to_have_count(8)
    cells_after_readd = occupied_grid_cells(page, ".dashboard-layout-grid .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])")
    assert len(cells_after_readd) == len(set(cells_after_readd))
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_panel_add_collision_uses_local_vertical_pushdown(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const place = (node, col, row, span = 1, rowSpan = 1) => {
            node.hidden = false;
            node.dataset.currentSpan = String(span);
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            if (node.classList.contains("db-panel")) {
              node.classList.add("db-panel-collapsed");
              node.style.height = "";
              delete node.dataset.savedHeight;
              node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
            }
          };
          place(document.querySelector('[data-widget-key="builder-search"]'), 1, 1, 4, 1);
          place(document.querySelector('[data-widget-key="widget-1"]'), 1, 5, 1, 1);
          place(document.querySelector('[data-widget-key="widget-2"]'), 5, 2, 1, 1);
          place(document.querySelector('[data-widget-key="widget-3"]'), 6, 2, 1, 1);
          [...document.querySelectorAll(".widget-layout > .widget-card:not([data-widget-key='builder-search'])")]
            .filter((node) => !["widget-1", "widget-2", "widget-3"].includes(node.dataset.widgetKey))
            .forEach((node, index) => place(node, 2 + index, 8, 1, 1));
          place(document.querySelector('[data-panel-key="builder-menu"]'), 1, 2, 2, 1);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 3, 2, 2, 1);
          place(document.querySelector('[data-panel-key="builder-content"]'), 1, 4, 6, 1);
        }
        """
    )
    blocker_before = grid_item_state(page, '[data-widget-key="widget-1"]')
    unrelated_before = {
        "widget": grid_item_state(page, '[data-widget-key="widget-2"]'),
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "content": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }

    page.locator('.panel-add-action[data-panel-kind="panel"]').evaluate("node => node.click()")
    new_panel = page.locator('.panel-layout > .db-panel[data-custom-panel="true"]').last
    expect(new_panel).to_be_visible()
    inserted = grid_item_state(page, '.panel-layout > .db-panel[data-custom-panel="true"]')
    blocker_after = grid_item_state(page, '[data-widget-key="widget-1"]')
    unrelated_after = {
        "widget": grid_item_state(page, '[data-widget-key="widget-2"]'),
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "content": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }

    assert inserted["col"] == 1
    assert inserted["row"] == 5
    assert blocker_after["col"] == blocker_before["col"]
    assert blocker_after["row"] == blocker_before["row"] + 1
    for key, original in unrelated_before.items():
        assert unrelated_after[key]["col"] == original["col"], (key, original, unrelated_after[key])
        assert unrelated_after[key]["row"] == original["row"], (key, original, unrelated_after[key])
    cells = occupied_grid_cells(page, ".dashboard-layout-grid .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])")
    assert len(cells) == len(set(cells))
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_panels_are_generic_containers_not_table_panel_types(page: Page, app_server: str) -> None:
    goto(page, app_server)
    expect(page.locator('[data-panel-key="builder-table"]')).to_have_count(0)
    panel_layout = page.locator('.panel-layout[data-layout-key="builder"]')
    content_panel = page.locator('[data-panel-key="builder-content"]')
    expect(content_panel).to_be_visible()
    expect(content_panel.locator(".db-panel-title")).to_have_text("Content")
    expect(panel_layout.locator("th")).to_have_count(0)
    for legacy_header in ("Name", "Type", "Value", "State"):
        expect(panel_layout.locator("th", has_text=legacy_header)).to_have_count(0)

    default_panels = page.locator('.panel-layout > .db-panel[data-panel-key^="builder-"]')
    for index in range(default_panels.count()):
        panel = default_panels.nth(index)
        if panel.evaluate("node => node.classList.contains('db-panel-collapsed')"):
            panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
            expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
        placeholder = panel.locator('.db-panel-body > .empty-state.panel-empty-state[data-panel-placeholder="empty"]')
        expect(placeholder).to_have_count(1)
        expect(placeholder.locator("strong")).to_have_text("Empty panel")
        expect(placeholder.locator("small")).to_have_text("Widgets will appear here when this panel is configured.")
        expect(placeholder.locator(".panel-empty-action")).to_have_text("Add widgets")

    page.locator(".panel-add-button").click()
    expect(page.locator('.panel-add-action[data-panel-kind="table"]')).to_have_count(0)
    expect(page.locator('.panel-add-action[data-panel-kind="context-panel"]')).to_have_count(0)
    expect(page.locator('.panel-add-action[data-panel-kind="panel"]')).to_have_count(1)
    expect(page.locator(".panel-add-menu")).not_to_contain_text("Context Panel")
    expect(page.locator('.widget-add-action[data-widget-kind="table"]')).to_have_count(1)
    expect(page.locator('.widget-add-action[data-widget-kind="search"]')).to_have_count(1)
    expect(page.locator('.widget-add-action[data-widget-kind="search"]')).to_have_text("Search Bar")
    expect(page.locator('.widget-add-action[data-widget-kind="anchor"]')).to_have_count(1)
    expect(page.locator('.divider-add-action[data-divider-kind="context-divider"]')).to_have_count(1)

    page.locator('.panel-add-action[data-panel-kind="panel"]').click()
    new_panel = page.locator('.panel-layout > .db-panel[data-custom-panel="true"]').last
    expect(new_panel.locator(".db-panel-title")).to_have_text(re.compile(r"Panel \d+"))
    if new_panel.evaluate("node => node.classList.contains('db-panel-collapsed')"):
        new_panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        expect(new_panel).not_to_have_class(re.compile("db-panel-collapsed"))
    new_placeholder = new_panel.locator('.db-panel-body > .empty-state.panel-empty-state[data-panel-placeholder="empty"]')
    expect(new_placeholder).to_have_count(1)
    expect(new_placeholder.locator("strong")).to_have_text("Empty panel")
    expect(new_placeholder.locator("small")).to_have_text("Widgets will appear here when this panel is configured.")
    expect(new_placeholder.locator(".panel-empty-action")).to_have_text("Add widgets")
    assert_clean_browser(page)


def test_search_bar_widget_uses_normal_widget_creation_and_controls(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")

    expect(page.locator(".timeframe-widget .timeframe-command-surface")).to_be_visible()
    page.locator(".panel-add-button").click()
    expect(page.locator('.widget-add-action[data-widget-kind="search"]')).to_have_text("Search Bar")
    page.locator('.widget-add-action[data-widget-kind="search"]').click()

    search_widget = page.locator(
        '.widget-layout > .widget-card[data-custom-widget="true"][data-dashboard-object-kind="search"]'
    ).last
    expect(search_widget).to_be_visible()
    search_input = search_widget.locator(".search-widget-input")
    expect(search_input).to_be_visible()
    expect(search_widget.locator(".range-search-label")).to_have_text("Search")
    search_input.fill("panel")
    expect(search_input).to_have_value("panel")

    state = search_widget.evaluate(
        """
        node => {
          const input = node.querySelector(".search-widget-input");
          const inputStyles = getComputedStyle(input);
          const label = node.querySelector(".range-search-label");
          return {
            tag: node.tagName,
            widgetType: node.dataset.widgetType,
            objectType: node.dataset.workspaceObjectType,
            objectKind: node.dataset.dashboardObjectKind,
            contextRole: node.dataset.contextRole,
            inWidgetLayout: Boolean(node.closest(".widget-layout")),
            inAnchorLayer: Boolean(node.closest(".workspace-anchor-layer")),
            position: getComputedStyle(node).position,
            href: node.getAttribute("href"),
            hasMoveToggle: Boolean(node.querySelector(".panel-move-handle")),
            hasResizeToggle: Boolean(node.querySelector(".panel-resize-handle")),
            hasPinToggle: Boolean(node.querySelector(".panel-pin-toggle")),
            hasTitleToggle: Boolean(node.querySelector(".panel-title-handle")),
            hasColorToggle: Boolean(node.querySelector(".panel-color-toggle")),
            hasDeleteToggle: Boolean(node.querySelector(".panel-delete-handle")),
            hasSettingsToggle: Boolean(node.querySelector(".widget-settings-toggle")),
            inputType: input?.getAttribute("type"),
            inputBackground: inputStyles.backgroundColor,
            inputBorder: inputStyles.borderTopColor,
            inputRadius: inputStyles.borderTopLeftRadius,
            labelTextTransform: label ? getComputedStyle(label).textTransform : null,
          };
        }
        """
    )
    assert state["tag"] == "DIV"
    assert state["widgetType"] == "search"
    assert state["objectType"] == "widget"
    assert state["objectKind"] == "search"
    assert state["contextRole"] == "search-control"
    assert state["inWidgetLayout"] is True
    assert state["inAnchorLayer"] is False
    assert state["position"] != "fixed"
    assert state["href"] is None
    assert state["hasMoveToggle"] is True
    assert state["hasResizeToggle"] is True
    assert state["hasPinToggle"] is True
    assert state["hasTitleToggle"] is True
    assert state["hasColorToggle"] is True
    assert state["hasDeleteToggle"] is True
    assert state["hasSettingsToggle"] is True
    assert state["inputType"] == "search"
    assert state["inputBackground"] != "rgba(0, 0, 0, 0)"
    assert state["inputBorder"] != "rgba(0, 0, 0, 0)"
    assert state["inputRadius"] in ("999px", "50%") or float(state["inputRadius"].replace("px", "")) >= 18
    assert state["labelTextTransform"] == "none"

    force_open_tools_for_interaction(page, search_widget)
    search_widget.locator(".panel-pin-toggle").click(force=True)
    expect(search_widget.locator(".panel-pin-toggle")).to_have_attribute("aria-pressed", "true")
    force_open_tools_for_interaction(page, search_widget)
    search_widget.locator(".panel-pin-toggle").click(force=True)
    expect(search_widget.locator(".panel-pin-toggle")).to_have_attribute("aria-pressed", "false")

    force_open_tools_for_interaction(page, search_widget)
    drag_by(page, search_widget.locator(".panel-move-handle"), 260, 90, steps=12)
    assert_no_undo_artifacts(page)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    anchor = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]').last
    expect(anchor).to_be_visible()
    expect(anchor.locator(".workspace-anchor-label")).to_have_text("Top")
    expect(page.locator(".timeframe-widget .timeframe-command-surface")).to_be_visible()
    assert_clean_browser(page)


def test_widget_absorbs_into_open_panel_after_stable_hover_and_round_trips(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const gap = parseFloat(getComputedStyle(grid).rowGap || "16") || 16;
          const place = (node, col, row, span, rowSpan = 1) => {
            node.hidden = false;
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            if (node.classList.contains("db-panel")) {
              node.classList.remove("db-panel-collapsed");
              const height = (rowSpan * 81) + (Math.max(0, rowSpan - 1) * gap);
              node.dataset.savedHeight = String(height);
              node.style.height = `${height}px`;
              node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "true");
            }
          };
          document.querySelectorAll(".panel-internal-widget-grid").forEach((node) => node.remove());
          place(document.querySelector('[data-widget-key="widget-1"]'), 1, 1, 1, 1);
          place(document.querySelector('[data-widget-key="widget-2"]'), 6, 1, 1, 1);
          place(document.querySelector('[data-panel-key="builder-content"]'), 2, 4, 4, 4);
          place(document.querySelector('[data-panel-key="builder-menu"]'), 1, 10, 2, 2);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 4, 10, 2, 2);
        }
        """
    )

    widget = page.locator('.widget-layout[data-widget-layout-key="builder"] > .widget-card[data-widget-key="widget-1"]')
    panel = page.locator('[data-panel-key="builder-content"]')
    open_tools(widget)
    handle_box = widget.locator(".panel-move-handle").bounding_box()
    body_box = panel.locator(".db-panel-body").bounding_box()
    assert handle_box and body_box
    start_x, start_y = box_center(handle_box)
    target_x = body_box["x"] + body_box["width"] * 0.42
    target_y = body_box["y"] + body_box["height"] * 0.52
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(target_x, target_y, steps=16)
    body_box = panel.locator(".db-panel-body").bounding_box()
    assert body_box
    target_x = body_box["x"] + body_box["width"] * 0.5
    target_y = body_box["y"] + body_box["height"] * 0.5
    page.mouse.move(target_x, target_y, steps=8)
    expect(panel).to_have_class(re.compile("panel-absorption-receptive"))
    page.wait_for_timeout(1750)
    page.mouse.up()

    internal_widget = panel.locator('.panel-internal-widget-grid > .widget-card[data-widget-key="widget-1"]')
    expect(internal_widget).to_be_visible()
    expect(page.locator('.widget-layout[data-widget-layout-key="builder"]:not(.panel-internal-widget-grid) > .widget-card[data-widget-key="widget-1"]')).to_have_count(0)
    expect(panel.locator(".panel-empty-state")).to_be_hidden()
    expect(panel).not_to_have_class(re.compile("panel-absorption-receptive"))
    assert_no_undo_artifacts(page)

    press_dashboard_undo(page)
    expect(panel.locator('.panel-internal-widget-grid > .widget-card[data-widget-key="widget-1"]')).to_have_count(0)
    expect(page.locator('.widget-layout[data-widget-layout-key="builder"] > .widget-card[data-widget-key="widget-1"]')).to_be_visible()

    press_dashboard_redo(page)
    expect(panel.locator('.panel-internal-widget-grid > .widget-card[data-widget-key="widget-1"]')).to_be_visible()
    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    panel = page.locator('[data-panel-key="builder-content"]')
    expect(panel.locator('.panel-internal-widget-grid > .widget-card[data-widget-key="widget-1"]')).to_be_visible()
    expect(page.locator('.widget-layout[data-widget-layout-key="builder"]:not(.panel-internal-widget-grid) > .widget-card[data-widget-key="widget-1"]')).to_have_count(0)
    assert_clean_browser(page)


def test_widget_hover_over_collapsed_panel_does_not_absorb(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1) => {
            node.hidden = false;
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
          };
          document.querySelectorAll(".panel-internal-widget-grid").forEach((node) => node.remove());
          place(document.querySelector('[data-widget-key="widget-2"]'), 1, 1, 1, 1);
          const panel = document.querySelector('[data-panel-key="builder-menu"]');
          place(panel, 2, 4, 3, 1);
          panel.classList.add("db-panel-collapsed");
          panel.style.height = "";
          panel.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
        }
        """
    )

    widget = page.locator('.widget-layout[data-widget-layout-key="builder"] > .widget-card[data-widget-key="widget-2"]')
    panel = page.locator('[data-panel-key="builder-menu"]')
    open_tools(widget)
    handle_box = widget.locator(".panel-move-handle").bounding_box()
    panel_box = panel.bounding_box()
    assert handle_box and panel_box
    start_x, start_y = box_center(handle_box)
    target_x = panel_box["x"] + panel_box["width"] * 0.5
    target_y = panel_box["y"] + panel_box["height"] * 0.5
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(target_x, target_y, steps=12)
    page.wait_for_timeout(1700)
    page.mouse.up()

    expect(panel).not_to_have_class(re.compile("panel-absorption-receptive"))
    expect(panel.locator('.panel-internal-widget-grid > .widget-card[data-widget-key="widget-2"]')).to_have_count(0)
    expect(page.locator('.widget-layout[data-widget-layout-key="builder"] > .widget-card[data-widget-key="widget-2"]')).to_be_visible()
    assert_no_undo_artifacts(page)
    assert_clean_browser(page)


def test_background_system_has_no_mode_toggle(page: Page, app_server: str) -> None:
    goto(page, app_server)
    assert page.evaluate("() => !('theme' in document.documentElement.dataset)")
    expect(page.locator("[class*='theme']")).to_have_count(0)

    page.evaluate("document.documentElement.dataset.theme = 'legacy'")
    page.reload(wait_until="networkidle")
    assert page.evaluate("() => !('theme' in document.documentElement.dataset)")
    expect(page.locator("[class*='theme']")).to_have_count(0)
    assert_clean_browser(page)

def test_background_palette_hover_previews_without_saving(page: Page, app_server: str) -> None:
    goto(page, app_server)
    root = page.locator("html")
    expect(root).to_have_attribute("data-background", "frosted-light")

    page.locator(".background-tone-trigger").first.click()
    for tone in [
        "very-pale-grey",
        "pale-cool-grey",
        "pale-warm-grey",
        "medium-cool-grey",
        "medium-soft-grey",
        "medium-grey",
        "neutral-grey",
        "graphite-grey",
        "blue-slate",
        "charcoal-grey",
        "deep-grey",
        "near-black-grey",
        "black",
        "charcoal",
        "gunmetal",
        "deep-navy",
        "muted-midnight-blue",
        "cool-dark-steel",
        "soft-cinema",
    ]:
        expect(page.locator(f'.background-tone-option[data-background-tone="{tone}"]').first).to_be_visible()

    palette = page.evaluate(
        """
        () => {
          const toRgb = (value) => {
            const rgb = value.match(/rgba?\\(([^)]+)\\)/);
            if (rgb) {
              return rgb[1].split(/[\\s,\\/]+/).filter(Boolean).slice(0, 3).map((part) => Math.round(Number(part)));
            }
            const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
            if (hex) return [0, 2, 4].map((start) => parseInt(hex[1].slice(start, start + 2), 16));
            return [];
          };
          return ["very-pale-grey", "medium-grey", "neutral-grey", "charcoal-grey", "near-black-grey", "graphite-grey", "blue-slate", "black", "charcoal", "gunmetal", "deep-navy", "soft-cinema"].map((tone) => {
            document.documentElement.dataset.background = tone;
            const bg = toRgb(getComputedStyle(document.documentElement).getPropertyValue("--bg"));
            const surface = getComputedStyle(document.documentElement).getPropertyValue("--glass-surface").trim();
            return { tone, bg, surface, max: Math.max(...bg), min: Math.min(...bg) };
          });
        }
        """
    )
    assert len({tuple(entry["bg"]) for entry in palette}) == len(palette)
    assert min(entry["min"] for entry in palette) <= 16
    assert len({entry["surface"] for entry in palette}) == 1

    page.evaluate("document.documentElement.dataset.background = 'frosted-light'")
    preview = page.locator('.background-tone-option[data-background-tone="graphite-grey"]').first
    preview.hover()
    expect(root).to_have_attribute("data-background", "graphite-grey")
    assert page.evaluate("localStorage.getItem('dashboard-background')") is None

    page.locator(".workspace-identity-island").hover()
    expect(root).to_have_attribute("data-background", "frosted-light")
    assert page.evaluate("localStorage.getItem('dashboard-background')") is None

    focus_preview = page.locator('.background-tone-option[data-background-tone="deep-navy"]').first
    focus_preview.focus()
    expect(root).to_have_attribute("data-background", "deep-navy")
    assert page.evaluate("localStorage.getItem('dashboard-background')") is None
    page.locator(".dash-switch-hero").focus()
    expect(root).to_have_attribute("data-background", "frosted-light")

    page.locator('.background-tone-option[data-background-tone="deep-slate"]').first.click()
    expect(root).to_have_attribute("data-background", "deep-slate")
    assert page.evaluate("localStorage.getItem('dashboard-background')") == "deep-slate"
    assert_clean_browser(page)

def test_background_presets_do_not_change_shared_glass_materials(page: Page, app_server: str) -> None:
    goto(page, app_server)
    artifact_dir = Path("test-results") / "workspace-visual-language"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    page.locator(".background-tone-trigger").first.click()
    expect(page.locator('.background-tone-option[data-background-tone="cool-grey"]').first).to_be_visible()
    expect(page.locator('.background-tone-option[data-background-tone="gunmetal"]').first).to_be_visible()
    swatch = page.locator('.background-tone-option[data-background-tone="gunmetal"]').first.evaluate(
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

    def read_materials() -> dict:
        return page.evaluate(
            """
            () => {
              const read = (selector) => {
                const styles = getComputedStyle(document.querySelector(selector));
                return {
                  backgroundColor: styles.backgroundColor,
                  backgroundImage: styles.backgroundImage,
                  borderColor: styles.borderTopColor,
                  boxShadow: styles.boxShadow,
                  color: styles.color,
                };
              };
              const root = getComputedStyle(document.documentElement);
              return {
                bg: root.getPropertyValue("--bg").trim(),
                glassSurface: root.getPropertyValue("--glass-surface").trim(),
                glassBorder: root.getPropertyValue("--glass-border").trim(),
                nav: read(".app-nav"),
                panel: read(".panel-layout > .db-panel"),
                widget: read(".widget-layout > .stat-card.widget-card:not(.range-bar)"),
                timeframe: read(".timeframe-widget .preset-btn.active"),
                settings: read(".timeframe-widget .panel-settings-toggle"),
              };
            }
            """
        )

    initial = read_materials()
    page.screenshot(path=str(artifact_dir / "dashboard-frosted-background.png"), full_page=True)
    page.locator('.background-tone-option[data-background-tone="deep-slate"]').first.click()
    expect(page.locator("html")).to_have_attribute("data-background", "deep-slate")
    assert page.evaluate("localStorage.getItem('dashboard-background')") == "deep-slate"
    page.screenshot(path=str(artifact_dir / "dashboard-deep-slate-background.png"), full_page=True)
    deep = read_materials()

    assert initial["bg"] != deep["bg"]
    for key in ("glassSurface", "glassBorder", "nav", "panel", "widget", "timeframe", "settings"):
        assert deep[key] == initial[key], key

    page.locator(".panel-add-button").click()
    expect(page.locator(".panel-add-menu")).to_have_class(re.compile("open"))
    page.locator(".panel-add-menu").screenshot(path=str(artifact_dir / "dashboard-add-menu-glass.png"))

    goto(page, app_server, "/settings")
    expect(page.locator("#settings-form")).to_be_visible()
    expect(page.locator("html")).to_have_attribute("data-background", "deep-slate")
    expect(page.locator('.background-tone-option[data-background-tone="soft-cinema"]').first).to_be_attached()
    page.screenshot(path=str(artifact_dir / "settings-deep-slate-background.png"), full_page=True)
    assert_clean_browser(page)

def test_workspace_chrome_is_spatial_and_modes_still_work(page: Page, app_server: str) -> None:
    goto(page, app_server)
    artifact_dir = Path("test-results") / "workspace-toolbar"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    expect(page.locator(".workspace-chrome")).to_be_visible()
    expect(page.locator(".workspace-identity-island .dash-switch-hero")).to_be_visible()
    expect(page.locator(".workspace-identity-island .workspace-accent-marker")).to_have_count(0)
    expect(page.locator(".workspace-identity-island .dash-switch-arrow")).to_have_count(0)
    expect(page.locator(".dash-switch-hero")).to_contain_text("Workspace User")
    expect(page.locator(".dash-switch-hero")).to_contain_text("user@example.com")
    expect(page.locator(".dash-switch-hero")).not_to_contain_text("Dashboard")
    expect(page.locator(".layout-command-island .layout-slot-controls")).to_be_visible()
    expect(page.locator(".composition-add-button")).to_have_attribute("aria-label", "Add dashboard object")
    expect(page.locator(".mode-command-island .engineer-mode-button")).to_be_visible()
    expect(page.locator(".appearance-command-island .background-tone-trigger")).to_be_visible()
    expect(page.locator(".context-command-island")).to_have_count(0)
    expect(page.locator(".nav-status-icon-only")).to_have_count(0)
    expect(page.locator(".app-nav.workspace-chrome .cmd-btn-icon-only")).to_have_count(0)
    expect(page.locator('.app-nav.workspace-chrome a[href="/settings"]')).to_have_count(0)

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
    assert chrome_styles["radius"] >= 16
    assert chrome_styles["border"] >= 1
    assert chrome_styles["shadow"] != "none"
    assert chrome_styles["backdrop"] != "none"
    assert chrome_styles["background"] != "rgba(0, 0, 0, 0)" or chrome_styles["image"] != "none"
    widget_styles = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first.evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
          return {
            radius: parseFloat(styles.borderTopLeftRadius),
            border: parseFloat(styles.borderTopWidth),
            shadow: styles.boxShadow,
            background: styles.backgroundColor,
            image: styles.backgroundImage,
          };
        }
        """
    )
    assert abs(chrome_styles["radius"] - widget_styles["radius"]) <= 8
    assert abs(chrome_styles["border"] - widget_styles["border"]) <= 1
    assert chrome_styles["shadow"] != "none" and widget_styles["shadow"] != "none"
    navbar_button_material = page.locator(".layout-save-button").evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
          return {
            background: styles.backgroundColor,
            image: styles.backgroundImage,
            border: styles.borderTopColor,
            shadow: styles.boxShadow,
          };
        }
        """
    )
    assert navbar_button_material["background"] != "rgba(0, 0, 0, 0)" or navbar_button_material["image"] != "none"
    assert navbar_button_material["border"] != "rgba(0, 0, 0, 0)"
    assert navbar_button_material["shadow"] != "none"

    island_styles = page.locator(".app-nav.workspace-chrome .workspace-command-island").evaluate_all(
        """
        nodes => nodes.map((node) => {
          const styles = getComputedStyle(node);
          return {
            border: parseFloat(styles.borderTopWidth),
            shadow: styles.boxShadow,
            background: styles.backgroundColor,
            image: styles.backgroundImage,
          };
        })
        """
    )
    assert island_styles
    for styles in island_styles:
        assert styles["border"] == 0
        assert styles["shadow"] == "none"
        assert styles["background"] == "rgba(0, 0, 0, 0)"
        assert styles["image"] == "none"

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
    identity_metrics = page.locator(".dash-switch-hero").evaluate(
        """
        node => {
          const rect = node.getBoundingClientRect();
          const styles = getComputedStyle(node);
          return {
            width: rect.width,
            height: rect.height,
            radius: parseFloat(styles.borderTopLeftRadius),
          };
        }
        """
    )
    assert 118 <= identity_metrics["width"] <= 170
    assert 34 <= identity_metrics["height"] <= 38
    assert identity_metrics["radius"] >= 12

    hover_contract = page.locator(".layout-command-island").evaluate(
        """
        node => {
          const read = (el) => {
            const styles = getComputedStyle(el);
            return { background: styles.backgroundColor, shadow: styles.boxShadow, transform: styles.transform };
          };
          return {
            island: read(node),
            save: read(node.querySelector(".layout-save-button")),
            load: read(node.querySelector(".layout-load-button")),
          };
        }
        """
    )
    assert hover_contract["island"]["background"] == "rgba(0, 0, 0, 0)"
    assert hover_contract["island"]["shadow"] == "none"
    page.locator(".layout-save-button").hover()
    page.wait_for_timeout(220)
    button_hover_contract = page.locator(".layout-command-island").evaluate(
        """
        node => {
          const read = (el) => {
            const styles = getComputedStyle(el);
            return { background: styles.backgroundColor, shadow: styles.boxShadow, transform: styles.transform };
          };
          return {
            island: read(node),
            save: read(node.querySelector(".layout-save-button")),
            load: read(node.querySelector(".layout-load-button")),
          };
        }
        """
    )
    assert button_hover_contract["island"] == hover_contract["island"]
    assert button_hover_contract["save"]["background"] != hover_contract["save"]["background"]
    assert button_hover_contract["load"]["background"] == hover_contract["load"]["background"]
    page.mouse.move(24, 24)
    page.wait_for_timeout(120)
    control_metrics = page.locator(
        ".app-nav.workspace-chrome button.dash-switch-hero, "
        ".app-nav.workspace-chrome .layout-slot-trigger, "
        ".app-nav.workspace-chrome .layout-slot-button, "
        ".app-nav.workspace-chrome .panel-undo-button, "
        ".app-nav.workspace-chrome .panel-reset-button, "
        ".app-nav.workspace-chrome .workspace-mode-button, "
        ".app-nav.workspace-chrome .background-tone-trigger, "
        ".app-nav.workspace-chrome .composition-add-button"
    ).evaluate_all(
        """
        nodes => nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          const parentRect = node.closest(".workspace-command-island").getBoundingClientRect();
          const styles = getComputedStyle(node);
          const transform = styles.transform && styles.transform !== "none"
            ? new DOMMatrixReadOnly(styles.transform)
            : new DOMMatrixReadOnly();
          return {
            height: rect.height,
            centerDelta: Math.abs((rect.top + rect.height / 2) - (parentRect.top + parentRect.height / 2)),
            radius: parseFloat(styles.borderTopLeftRadius),
            transformY: transform.m42,
          };
        })
        """
    )
    assert control_metrics
    for metric in control_metrics:
        assert 34 <= metric["height"] <= 38
        assert metric["centerDelta"] <= 1.5
        assert metric["radius"] >= 12
        assert abs(metric["transformY"]) <= .1
    expect(page.locator(".layout-slot-arrow")).to_have_count(0)
    layout_label_metrics = page.locator(".layout-slot-trigger").evaluate(
        """
        node => {
          const label = node.querySelector(".layout-slot-label").getBoundingClientRect();
          const rect = node.getBoundingClientRect();
          return {
            centerDelta: Math.abs((label.left + label.width / 2) - (rect.left + rect.width / 2)),
            rightInset: rect.right - label.right,
            leftInset: label.left - rect.left,
          };
        }
        """
    )
    assert layout_label_metrics["centerDelta"] <= 1.5
    assert abs(layout_label_metrics["rightInset"] - layout_label_metrics["leftInset"]) <= 2
    page.locator(".app-nav").screenshot(path=str(artifact_dir / "toolbar-light-spatial-chrome.png"))
    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    page.wait_for_timeout(120)
    page.locator(".app-nav").screenshot(path=str(artifact_dir / "toolbar-deep-slate-widget-chrome.png"))
    expect(page.locator(".composition-add-button")).to_be_visible()

    page.locator(".dash-switch-hero").click()
    expect(page.locator(".dash-switch-menu")).to_have_class(re.compile("open"))
    expect(page.locator(".dash-switch-menu")).not_to_contain_text("Workspace settings")
    expect(page.locator(".dash-switch-menu")).not_to_contain_text("Configure environment")
    expect(page.locator(".dash-switch-menu")).to_contain_text("Workspace User")
    expect(page.locator(".dash-switch-menu")).to_contain_text("user@example.com")
    expect(page.locator(".dash-switch-menu")).to_contain_text("Current workspace")
    expect(page.locator(".dash-switch-menu")).to_contain_text("Sign out")
    page.mouse.click(24, 24)

    page.locator(".layout-slot-trigger").click()
    expect(page.locator(".layout-slot-menu")).to_have_class(re.compile("open"))
    expect(page.locator(".layout-slot-menu")).to_contain_text("Layout 8")
    layout_menu_styles = page.locator(".layout-slot-menu").evaluate(
        """
        node => {
          const styles = getComputedStyle(node);
          const firstButton = node.querySelector("button");
          const firstStyles = getComputedStyle(firstButton);
          const firstRect = firstButton.getBoundingClientRect();
          firstButton.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
          return {
            radius: parseFloat(styles.borderTopLeftRadius),
            border: parseFloat(styles.borderTopWidth),
            shadow: styles.boxShadow,
            backdrop: styles.backdropFilter || styles.webkitBackdropFilter,
            background: styles.backgroundColor,
            image: styles.backgroundImage,
            buttonBackground: firstStyles.backgroundColor,
            buttonBorder: firstStyles.borderTopColor,
            buttonHeight: firstRect.height,
          };
        }
        """
    )
    assert layout_menu_styles["radius"] >= 12
    assert layout_menu_styles["border"] >= 1
    assert layout_menu_styles["shadow"] != "none"
    assert layout_menu_styles["backdrop"] != "none"
    assert layout_menu_styles["background"] != "rgba(0, 0, 0, 0)" or layout_menu_styles["image"] != "none"
    assert layout_menu_styles["buttonBackground"] != "rgba(0, 0, 0, 0)"
    assert layout_menu_styles["buttonBorder"] != "rgba(0, 0, 0, 0)"
    assert layout_menu_styles["buttonHeight"] >= 32
    page.keyboard.press("Escape")
    expect(page.locator(".layout-slot-menu")).not_to_have_class(re.compile("open"))

    page.locator(".panel-add-button").click()
    expect(page.locator(".panel-add-menu")).to_have_class(re.compile("open"))
    page.wait_for_timeout(220)
    add_alignment = page.locator(".panel-add-picker").evaluate(
        """
        node => {
          const button = node.querySelector(".panel-add-button").getBoundingClientRect();
          const menu = node.querySelector(".panel-add-menu").getBoundingClientRect();
          return {
            leftDelta: Math.abs(button.left - menu.left),
            topGap: menu.top - button.bottom,
          };
        }
        """
    )
    assert add_alignment["leftDelta"] <= 1.5
    assert 6 <= add_alignment["topGap"] <= 14
    for label in ("Stat", "Timeframe", "Stat + Filter", "Graph", "Table", "Calendar", "Anchor", "Panel", "Divider"):
        expect(page.locator(".panel-add-menu")).to_contain_text(label)
    expect(page.locator(".panel-add-menu")).not_to_contain_text("Context Panel")
    page.mouse.click(24, 24)
    expect(page.locator(".panel-add-menu")).not_to_have_class(re.compile("open"))

    page.locator(".engineer-mode-button").click()
    expect(page.locator(".engineer-mode-button")).to_have_attribute("aria-pressed", "true")
    assert page.locator("body").evaluate("node => node.classList.contains('engineer-mode-active')")

    page.locator(".context-view-button").click()
    expect(page.locator(".context-view-button")).to_have_attribute("aria-pressed", "true")
    assert page.locator("body").evaluate("node => node.classList.contains('context-view-active')")

    assert_clean_browser(page)


def test_workspace_composition_uses_balanced_shell_and_column_rhythm(page: Page, app_server: str) -> None:
    goto(page, app_server)
    artifact_dir = Path("test-results") / "workspace-composition"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    composition = page.evaluate(
        """
        () => {
          const readRect = (selector) => {
            const node = document.querySelector(selector);
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width, top: rect.top, bottom: rect.bottom };
          };
          const readGrid = (selector) => {
            const node = document.querySelector(selector);
            return {
              col: Number(node.dataset.gridCol || 0),
              row: Number(node.dataset.gridRow || 0),
              span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
              rect: readRect(selector),
            };
          };
          const grid = document.querySelector(".dashboard-layout-grid");
          const gridRect = grid.getBoundingClientRect();
          const gridStyles = getComputedStyle(grid);
          const gap = parseFloat(gridStyles.columnGap || gridStyles.gap || "0") || 0;
          const columnWidth = (gridRect.width - (gap * 5)) / 6;
          const timeframe = readGrid('[data-widget-key="builder-search"]');
          const firstStat = readGrid('[data-widget-key="widget-1"]');
          const secondStat = readGrid('[data-widget-key="widget-2"]');
          const content = readGrid('[data-panel-key="builder-content"]');
          const menu = readGrid('[data-panel-key="builder-menu"]');
          const notes = readGrid('[data-panel-key="builder-notes"]');
          const leftMass = timeframe.span + content.span;
          const rightMass = (6 - timeframe.span) + menu.span + notes.span;
          return {
            page: readRect(".page"),
            nav: readRect(".app-nav.workspace-chrome"),
            grid: { ...gridRect.toJSON(), gap, columnWidth },
            timeframe,
            firstStat,
            secondStat,
            content,
            menu,
            notes,
            leftMass,
            rightMass,
          };
        }
        """
    )

    assert 1200 <= composition["page"]["width"] <= 1226
    assert abs(composition["nav"]["left"] - composition["grid"]["left"]) <= 1
    assert abs(composition["nav"]["right"] - composition["grid"]["right"]) <= 1
    assert abs(composition["nav"]["width"] - composition["grid"]["width"]) <= 1
    assert 13 <= composition["grid"]["gap"] <= 19
    assert composition["grid"]["columnWidth"] >= 180

    assert composition["timeframe"]["span"] == 4
    assert composition["timeframe"]["col"] == 1
    assert composition["firstStat"]["col"] == 5
    assert composition["secondStat"]["col"] == 6
    assert composition["firstStat"]["row"] == composition["timeframe"]["row"]
    assert composition["secondStat"]["row"] == composition["timeframe"]["row"]

    assert composition["content"]["span"] == 4
    assert composition["menu"]["span"] == 2
    assert composition["notes"]["span"] == 2
    assert composition["content"]["col"] == 1
    assert composition["menu"]["col"] == 5
    assert composition["notes"]["col"] == 5
    assert composition["notes"]["row"] > composition["menu"]["row"]
    assert abs(composition["leftMass"] - composition["rightMass"]) <= 2

    page.locator(".panel-add-button").click()
    page.locator('.divider-add-action[data-divider-kind="context-divider"]').click()
    divider_alignment = page.locator(".workspace-divider").last.evaluate(
        """
        node => {
          const divider = node.getBoundingClientRect();
          const grid = document.querySelector(".dashboard-layout-grid").getBoundingClientRect();
          return {
            leftDelta: Math.abs(divider.left - grid.left),
            rightDelta: Math.abs(divider.right - grid.right),
            widthDelta: Math.abs(divider.width - grid.width),
            span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
          };
        }
        """
    )
    assert divider_alignment["span"] == 6
    assert divider_alignment["leftDelta"] <= 1.5
    assert divider_alignment["rightDelta"] <= 1.5
    assert divider_alignment["widthDelta"] <= 2

    page.screenshot(path=str(artifact_dir / "balanced-workspace-default.png"), full_page=True)
    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    page.wait_for_timeout(120)
    page.screenshot(path=str(artifact_dir / "balanced-workspace-deep-slate.png"), full_page=True)
    assert_clean_browser(page)


def test_spatial_workspace_objects_keep_anchors_on_floating_navigation_layer(page: Page, app_server: str) -> None:
    goto(page, app_server)

    page.locator(".panel-add-button").click()
    page.locator('.divider-add-action[data-divider-kind="context-divider"]').click()
    divider = page.locator('.workspace-divider[data-workspace-object-type="divider"]').last
    expect(divider).to_be_visible()
    expect(divider.locator(".db-panel-title")).to_contain_text("Divider")

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    anchor = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]').last
    expect(anchor).to_be_visible()
    expect(anchor.locator(".workspace-anchor-label")).to_have_text("Top")

    created_state = page.evaluate(
        """
        () => {
          const divider = document.querySelector('.workspace-divider[data-workspace-object-type="divider"]');
          const anchor = document.querySelector('.workspace-anchor-object[data-workspace-object-type="anchor"]');
          const anchorRect = anchor.getBoundingClientRect();
          const gridObjects = [...document.querySelectorAll('.widget-layout > .widget-card, .panel-layout > .db-panel')]
            .map((node) => node.dataset.workspaceObjectType || node.dataset.dashboardObjectKind || "");
          return {
            dividerType: divider?.dataset.workspaceObjectType,
            dividerRole: divider?.dataset.contextRole,
            dividerScope: divider?.dataset.contextScopeId,
            dividerRegion: divider?.dataset.workspaceRegionId,
            dividerSpan: divider?.dataset.currentSpan,
            dividerRows: divider?.dataset.gridRowSpan,
            anchorType: anchor?.dataset.workspaceObjectType,
            anchorKind: anchor?.dataset.dashboardObjectKind,
            anchorKey: anchor?.dataset.anchorKey,
            anchorWidgetKey: anchor?.dataset.widgetKey || null,
            anchorInWidgetLayout: Boolean(anchor?.closest(".widget-layout")),
            anchorSide: anchor?.dataset.anchorSide,
            anchorPosition: getComputedStyle(anchor).position,
            anchorTop: anchorRect.top,
            anchorTargetType: anchor?.dataset.navigationTargetType,
            anchorRole: anchor?.getAttribute("role"),
            anchorClass: anchor?.className || "",
            anchorInGridObjectList: gridObjects.includes("anchor"),
            anchorHasWidgetTools: Boolean(anchor?.querySelector(".widget-tools, .panel-tool-drawer")),
            contextModel: document.querySelector('.dashboard-layout-grid')?.dataset.workspaceContextModel,
          };
        }
        """
    )
    assert created_state["dividerType"] == "divider"
    assert created_state["dividerRole"] == "semantic-boundary"
    assert created_state["dividerScope"] == created_state["dividerRegion"]
    assert created_state["dividerSpan"] == "6"
    assert created_state["dividerRows"] == "1"
    assert created_state["anchorType"] == "anchor"
    assert created_state["anchorKind"] == "anchor"
    assert created_state["anchorKey"]
    assert created_state["anchorWidgetKey"] is None
    assert created_state["anchorInWidgetLayout"] is False
    assert created_state["anchorSide"] == "left"
    assert created_state["anchorPosition"] == "fixed"
    assert created_state["anchorTop"] >= 100
    assert created_state["anchorTargetType"] == "workspace-top"
    assert created_state["anchorRole"] == "button"
    assert "widget-card" in created_state["anchorClass"]
    assert "db-panel-custom-color" in created_state["anchorClass"]
    assert created_state["anchorInGridObjectList"] is False
    assert created_state["anchorHasWidgetTools"] is True
    assert created_state["contextModel"] == "workspace-context-v1"

    anchor_before_divider_drag = anchor.evaluate(
        "node => ({ side: node.dataset.anchorSide, offset: Number(node.dataset.anchorOffset) || 0 })"
    )
    divider_row_before = int(divider.evaluate("node => Number(node.dataset.gridRow) || 1"))
    open_tools(divider)
    drag_by(page, divider.locator(".panel-move-handle"), 0, 260, steps=16)
    divider_row_after = int(divider.evaluate("node => Number(node.dataset.gridRow) || 1"))
    assert divider_row_after > divider_row_before
    anchor_after_divider_drag = anchor.evaluate(
        "node => ({ side: node.dataset.anchorSide, offset: Number(node.dataset.anchorOffset) || 0 })"
    )
    assert anchor_after_divider_drag == anchor_before_divider_drag

    anchor_box = anchor.bounding_box()
    assert anchor_box
    page.mouse.move(anchor_box["x"] + anchor_box["width"] / 2, anchor_box["y"] + anchor_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(640, anchor_box["y"] + 170, steps=14)
    page.mouse.up()
    page.wait_for_timeout(180)
    body_drag_state = anchor.evaluate(
        """
        node => ({
          side: node.dataset.anchorSide,
          railOrder: Number(node.dataset.anchorRailOrder),
          offset: Number(node.dataset.anchorOffset),
          position: getComputedStyle(node).position,
          gridCol: node.dataset.gridCol || null,
          gridRow: node.dataset.gridRow || null,
          left: node.getBoundingClientRect().left,
          top: node.getBoundingClientRect().top,
          ghostCount: document.querySelectorAll(".workspace-anchor-drag-ghost").length,
          placeholderCount: document.querySelectorAll(".workspace-anchor-rail-placeholder").length,
          bodyDragging: document.body.classList.contains("anchor-rail-drag-active"),
        })
        """
    )
    assert body_drag_state["side"] == "left"
    assert body_drag_state["railOrder"] == 0
    assert body_drag_state["offset"] == anchor_before_divider_drag["offset"]
    assert body_drag_state["left"] < 40
    assert body_drag_state["position"] == "fixed"
    assert body_drag_state["gridCol"] is None
    assert body_drag_state["gridRow"] is None
    assert body_drag_state["ghostCount"] == 0
    assert body_drag_state["placeholderCount"] == 0
    assert body_drag_state["bodyDragging"] is False

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    anchors = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]')
    expect(anchors).to_have_count(2)
    first_anchor = anchors.nth(0)
    second_anchor = anchors.nth(1)
    first_after_move_box = first_anchor.bounding_box()
    second_box = second_anchor.bounding_box()
    assert first_after_move_box and second_box
    second_key = second_anchor.evaluate("node => node.dataset.anchorKey")
    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(120)
    scroll_before_anchor_drag = page.evaluate("window.scrollY")
    second_anchor.locator(".anchor-settings-toggle").click(force=True)
    move_box = second_anchor.locator(".panel-move-handle").bounding_box()
    assert move_box
    page.mouse.move(move_box["x"] + move_box["width"] / 2, move_box["y"] + move_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(move_box["x"] + move_box["width"] / 2, first_after_move_box["y"] + 8, steps=14)
    active_rail_drag = page.evaluate(
        """
        () => {
          const ghost = document.querySelector(".workspace-anchor-drag-ghost");
          const placeholder = document.querySelector(".workspace-anchor-rail-placeholder");
          const source = document.querySelector(".workspace-anchor-object.anchor-rail-source");
          return {
            ghostCount: document.querySelectorAll(".workspace-anchor-drag-ghost").length,
            placeholderCount: document.querySelectorAll(".workspace-anchor-rail-placeholder").length,
            sourceCount: document.querySelectorAll(".workspace-anchor-object.anchor-rail-source").length,
            ghostLeft: ghost?.getBoundingClientRect().left ?? null,
            ghostTop: ghost?.getBoundingClientRect().top ?? null,
            placeholderLeft: placeholder?.getBoundingClientRect().left ?? null,
            placeholderTop: placeholder?.getBoundingClientRect().top ?? null,
            sourceOpacity: source ? getComputedStyle(source).opacity : null,
            bodyDragging: document.body.classList.contains("anchor-rail-drag-active"),
            gridAnchorCount: document.querySelectorAll('.widget-layout > .workspace-anchor-object, .panel-layout > .workspace-anchor-object').length,
          };
        }
        """
    )
    assert active_rail_drag["ghostCount"] == 1
    assert active_rail_drag["placeholderCount"] == 1
    assert active_rail_drag["sourceCount"] == 1
    assert active_rail_drag["ghostLeft"] < 40
    assert active_rail_drag["placeholderLeft"] < 40
    assert active_rail_drag["placeholderTop"] <= first_after_move_box["y"] + 10
    assert float(active_rail_drag["sourceOpacity"]) == 0
    assert active_rail_drag["bodyDragging"] is True
    assert active_rail_drag["gridAnchorCount"] == 0
    page.mouse.up()
    page.wait_for_timeout(360)
    scroll_after_anchor_drag = page.evaluate("window.scrollY")
    assert abs(scroll_after_anchor_drag - scroll_before_anchor_drag) <= 8
    rail_state = page.evaluate(
        """
        () => {
          const anchors = [...document.querySelectorAll('.workspace-anchor-object[data-workspace-object-type="anchor"]')];
          return {
            anchors: anchors.map((anchor) => {
              const rect = anchor.getBoundingClientRect();
              return {
                key: anchor.dataset.anchorKey,
                side: anchor.dataset.anchorSide,
                railOrder: Number(anchor.dataset.anchorRailOrder),
                offset: Number(anchor.dataset.anchorOffset) || 0,
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
              };
            }),
            gridAnchorCount: document.querySelectorAll('.widget-layout > .workspace-anchor-object, .panel-layout > .workspace-anchor-object').length,
          };
        }
        """
    )
    left_rail = [entry for entry in rail_state["anchors"] if entry["side"] == "left"]
    assert rail_state["gridAnchorCount"] == 0
    assert len(left_rail) >= 2
    visual_left_rail = sorted(left_rail, key=lambda entry: entry["top"])
    assert visual_left_rail[0]["key"] == second_key
    assert [entry["railOrder"] for entry in visual_left_rail] == list(range(len(visual_left_rail)))
    for index, current in enumerate(visual_left_rail):
        for other in visual_left_rail[index + 1 :]:
            overlap = min(current["bottom"], other["bottom"]) - max(current["top"], other["top"])
            assert overlap <= 1

    before_scroll_top = first_anchor.evaluate("node => node.getBoundingClientRect().top")
    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(180)
    after_scroll_top = first_anchor.evaluate("node => node.getBoundingClientRect().top")
    assert abs(after_scroll_top - before_scroll_top) <= 2
    page.evaluate("window.scrollTo(0, 0)")

    page.locator(".layout-save-button").click()
    page.reload(wait_until="networkidle")
    expect(page.locator('.workspace-divider[data-workspace-object-type="divider"]')).to_have_count(1)
    expect(page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]')).to_have_count(2)
    persisted_state = page.evaluate(
        """
        () => {
          const divider = document.querySelector('.workspace-divider[data-workspace-object-type="divider"]');
          const anchors = [...document.querySelectorAll('.workspace-anchor-object[data-workspace-object-type="anchor"]')];
          const anchor = anchors[0];
          return {
            dividerScope: divider?.dataset.contextScopeId,
            anchorTarget: anchor?.dataset.navigationTargetId,
            anchorTargetType: anchor?.dataset.navigationTargetType,
            dividerRow: Number(divider?.dataset.gridRow) || 0,
            anchorSide: anchor?.dataset.anchorSide,
            anchorRailOrder: Number(anchor?.dataset.anchorRailOrder) || 0,
            anchorOffset: Number(anchor?.dataset.anchorOffset) || 0,
            anchorPosition: getComputedStyle(anchor).position,
            anchorInWidgetLayout: Boolean(anchor?.closest(".widget-layout")),
            anchorCount: anchors.length,
            leftAnchorCount: anchors.filter((node) => node.dataset.anchorSide === "left").length,
            orderedKeys: anchors.map((node) => node.dataset.anchorKey),
          };
        }
        """
    )
    assert persisted_state["anchorCount"] == 2
    assert persisted_state["anchorSide"] == "left"
    assert persisted_state["anchorRailOrder"] == 0
    assert persisted_state["leftAnchorCount"] >= 1
    assert persisted_state["anchorPosition"] == "fixed"
    assert persisted_state["anchorInWidgetLayout"] is False
    assert persisted_state["anchorTargetType"] == "workspace-top"
    assert persisted_state["anchorTarget"] in ("", None)
    assert persisted_state["orderedKeys"][0] == second_key
    assert_clean_browser(page)


def test_anchor_links_to_divider_or_workspace_top_and_persists(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")

    page.locator(".panel-add-button").click()
    page.locator('.divider-add-action[data-divider-kind="context-divider"]').click()
    divider = page.locator('.workspace-divider[data-workspace-object-type="divider"]').last
    expect(divider).to_be_visible()
    divider.evaluate(
        """
        node => {
          node.dataset.gridCol = "1";
          node.dataset.gridRow = "28";
          node.dataset.currentSpan = "6";
          node.dataset.gridRowSpan = "1";
          node.style.gridColumn = "1 / span 6";
          node.style.gridRow = "28 / span 1";
        }
        """
    )

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    anchor = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]').last
    expect(anchor).to_be_visible()

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="stat"]').click()
    normal_widget = page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').last
    expect(normal_widget).to_be_visible()

    default_state = anchor.evaluate(
        """
        node => ({
          side: node.dataset.anchorSide,
          targetType: node.dataset.navigationTargetType,
          linkedDividerId: node.dataset.linkedDividerId || "",
          position: getComputedStyle(node).position,
          inGrid: Boolean(node.closest(".widget-layout, .panel-layout")),
          backgroundImage: getComputedStyle(node).backgroundImage,
          border: getComputedStyle(node).borderTopColor,
          radius: getComputedStyle(node).borderTopLeftRadius,
          shadow: getComputedStyle(node).boxShadow,
          minHeight: parseFloat(getComputedStyle(node).minHeight),
          hasWidgetClass: node.classList.contains("widget-card"),
          bodyText: node.querySelector(".workspace-anchor-content")?.textContent?.trim(),
          hasGlyph: Boolean(node.querySelector(".workspace-anchor-glyph")),
          hasMeta: Boolean(node.querySelector(".workspace-anchor-meta")),
          hasAnchorTitleText: /anchor\\s*\\d*/i.test(node.querySelector(".workspace-anchor-content")?.textContent || ""),
          hasStatLabelTypography: node.querySelector(".workspace-anchor-label")?.classList.contains("stat-lbl"),
          hasMoveToggle: Boolean(node.querySelector(".panel-move-handle")),
          hasResizeToggle: Boolean(node.querySelector(".panel-resize-handle")),
          hasPinToggle: Boolean(node.querySelector(".panel-pin-toggle")),
          hasTitleToggle: Boolean(node.querySelector(".panel-title-handle")),
          hasColorToggle: Boolean(node.querySelector(".panel-color-toggle")),
          hasLinkToggle: Boolean(node.querySelector(".anchor-link-toggle")),
          hasDeleteToggle: Boolean(node.querySelector(".panel-delete-handle")),
          labelFontSize: parseFloat(getComputedStyle(node.querySelector(".workspace-anchor-label")).fontSize),
          labelFontWeight: Number(getComputedStyle(node.querySelector(".workspace-anchor-label")).fontWeight),
          labelCenterDelta: (() => {
            const anchorRect = node.getBoundingClientRect();
            const labelRect = node.querySelector(".workspace-anchor-label")?.getBoundingClientRect();
            return labelRect ? Math.abs((labelRect.top + labelRect.height / 2) - (anchorRect.top + anchorRect.height / 2)) : 999;
          })(),
          labelSettingsGap: (() => {
            const labelRect = node.querySelector(".workspace-anchor-label")?.getBoundingClientRect();
            const settingsRect = node.querySelector(".anchor-settings-toggle")?.getBoundingClientRect();
            return labelRect && settingsRect ? settingsRect.left - labelRect.right : -999;
          })(),
        })
        """
    )
    widget_visual_state = page.evaluate(
        """
        () => {
          const anchor = document.querySelector('.workspace-anchor-object[data-workspace-object-type="anchor"]');
          const widget = document.querySelector('.widget-layout > .widget-card[data-custom-widget="true"]');
          const anchorSettings = anchor?.querySelector(".anchor-settings-toggle");
          const widgetSettings = widget?.querySelector(".widget-settings-toggle");
          const anchorLayer = document.querySelector(".workspace-anchor-layer");
          const pickControl = (node) => {
            const style = getComputedStyle(node);
            return {
              width: style.width,
              height: style.height,
              radius: style.borderTopLeftRadius,
              background: style.backgroundColor,
              shadow: style.boxShadow,
              transform: style.transform,
            };
          };
          return {
            anchorRadius: getComputedStyle(anchor).borderTopLeftRadius,
            widgetRadius: getComputedStyle(widget).borderTopLeftRadius,
            anchorBackgroundImage: getComputedStyle(anchor).backgroundImage,
            widgetBackgroundImage: getComputedStyle(widget).backgroundImage,
            anchorShadow: getComputedStyle(anchor).boxShadow,
            widgetShadow: getComputedStyle(widget).boxShadow,
            anchorControl: pickControl(anchorSettings),
            widgetControl: pickControl(widgetSettings),
            anchorLayerZ: Number(getComputedStyle(anchorLayer).zIndex),
            objectPopoverZ: Number(getComputedStyle(document.documentElement).getPropertyValue("--z-object-popover")),
            navbarDropdownZ: Number(getComputedStyle(document.documentElement).getPropertyValue("--z-navbar-dropdown")),
          };
        }
        """
    )
    assert default_state["side"] == "left"
    assert default_state["targetType"] == "workspace-top"
    assert default_state["linkedDividerId"] == ""
    assert default_state["position"] == "fixed"
    assert default_state["inGrid"] is False
    assert default_state["hasWidgetClass"] is True
    assert default_state["bodyText"] == "Top"
    assert default_state["hasGlyph"] is False
    assert default_state["hasMeta"] is False
    assert default_state["hasAnchorTitleText"] is False
    assert default_state["hasStatLabelTypography"] is True
    assert default_state["hasMoveToggle"] is True
    assert default_state["hasResizeToggle"] is False
    assert default_state["hasPinToggle"] is False
    assert default_state["hasTitleToggle"] is True
    assert default_state["hasColorToggle"] is True
    assert default_state["hasLinkToggle"] is True
    assert default_state["hasDeleteToggle"] is True
    assert default_state["labelFontSize"] >= 13
    assert default_state["labelFontWeight"] >= 800
    assert default_state["labelCenterDelta"] <= 3
    assert default_state["labelSettingsGap"] >= 10
    assert default_state["backgroundImage"] != "none"
    assert default_state["border"] != "rgba(0, 0, 0, 0)"
    assert default_state["radius"] == widget_visual_state["widgetRadius"]
    assert default_state["minHeight"] >= 80
    assert default_state["shadow"] != "none"
    assert "linear-gradient" in widget_visual_state["anchorBackgroundImage"]
    assert "linear-gradient" in widget_visual_state["widgetBackgroundImage"]
    assert widget_visual_state["anchorShadow"] != "none"
    assert widget_visual_state["widgetShadow"] != "none"
    assert widget_visual_state["anchorControl"]["width"] == widget_visual_state["widgetControl"]["width"]
    assert widget_visual_state["anchorControl"]["height"] == widget_visual_state["widgetControl"]["height"]
    assert widget_visual_state["anchorControl"]["radius"] == widget_visual_state["widgetControl"]["radius"]
    assert widget_visual_state["anchorControl"]["shadow"] != "none"
    assert widget_visual_state["anchorLayerZ"] < widget_visual_state["objectPopoverZ"]
    assert widget_visual_state["anchorLayerZ"] < widget_visual_state["navbarDropdownZ"]

    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(160)
    anchor.click(position={"x": 24, "y": 24})
    page.wait_for_function("() => window.scrollY < 20")

    anchor.locator(".anchor-settings-toggle").click(force=True)
    expect(anchor.locator(".anchor-tool-drawer")).to_be_visible()
    anchor.locator(".panel-color-toggle").click(force=True)
    expect(page.locator(".panel-color-menu-open")).to_be_visible()
    page.locator(".panel-color-menu-open .panel-color-swatch").nth(3).click()
    recolored = anchor.evaluate("node => node.dataset.panelColor")
    assert recolored

    anchor.locator(".anchor-settings-toggle").click(force=True)
    expect(anchor.locator(".anchor-tool-drawer")).to_be_visible()
    anchor.locator(".anchor-link-toggle").click(force=True)
    expect(anchor.locator(".anchor-link-menu")).to_have_class(re.compile("anchor-link-menu-open"))
    link_menu_state = anchor.locator(".anchor-link-menu").evaluate(
        """
        node => {
          const drawer = node.closest(".workspace-anchor-object")?.querySelector(".widget-tool-drawer");
          return {
            background: getComputedStyle(node).backgroundImage,
            drawerBackground: getComputedStyle(drawer).backgroundImage,
            border: getComputedStyle(node).borderTopColor,
            shadow: getComputedStyle(node).boxShadow,
            hasLinkOption: Boolean(node.querySelector(".anchor-link-option")),
          };
        }
        """
    )
    assert link_menu_state["hasLinkOption"] is True
    assert link_menu_state["background"] != "none"
    assert link_menu_state["background"] == link_menu_state["drawerBackground"]
    assert link_menu_state["border"] != "rgba(0, 0, 0, 0)"
    assert link_menu_state["shadow"] != "none"
    divider_id = divider.evaluate("node => node.dataset.panelKey")
    anchor.locator(f'.anchor-link-option[data-divider-id="{divider_id}"]').click(force=True)
    linked_state = anchor.evaluate(
        """
        node => ({
          linkedDividerId: node.dataset.linkedDividerId,
          targetType: node.dataset.navigationTargetType,
          targetId: node.dataset.navigationTargetId,
          label: node.querySelector(".workspace-anchor-label")?.textContent?.trim(),
          bodyText: node.querySelector(".workspace-anchor-content")?.textContent?.trim(),
          labelFontSize: parseFloat(getComputedStyle(node.querySelector(".workspace-anchor-label")).fontSize),
          labelFontWeight: Number(getComputedStyle(node.querySelector(".workspace-anchor-label")).fontWeight),
          labelCenterDelta: (() => {
            const anchorRect = node.getBoundingClientRect();
            const labelRect = node.querySelector(".workspace-anchor-label")?.getBoundingClientRect();
            return labelRect ? Math.abs((labelRect.top + labelRect.height / 2) - (anchorRect.top + anchorRect.height / 2)) : 999;
          })(),
        })
        """
    )
    assert linked_state["linkedDividerId"] == divider_id
    assert linked_state["targetType"] == "divider"
    assert linked_state["targetId"]
    assert linked_state["label"].lower().startswith("divider")
    assert linked_state["bodyText"] == linked_state["label"]
    assert linked_state["labelFontSize"] >= 13
    assert linked_state["labelFontWeight"] >= 800
    assert linked_state["labelCenterDelta"] <= 3

    page.evaluate("window.scrollTo(0, 0)")
    anchor.click(position={"x": 24, "y": 24})
    initial_alignment = wait_for_anchor_divider_alignment(page, divider)
    initial_link_scroll = initial_alignment["scrollY"]

    page.evaluate("window.scrollTo(0, 0)")
    divider.evaluate(
        """
        node => {
          node.dataset.gridRow = "42";
          node.style.gridRow = "42 / span 1";
        }
        """
    )
    page.wait_for_timeout(120)
    moved_target_top = anchor_divider_alignment(divider)["scrollTarget"]
    assert moved_target_top > initial_link_scroll + 300
    anchor.click(position={"x": 24, "y": 24})
    moved_alignment = wait_for_anchor_divider_alignment(page, divider)
    assert moved_alignment["scrollTarget"] > initial_link_scroll + 300

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    reloaded_anchor = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]').last
    expect(reloaded_anchor).to_be_visible()
    persisted = reloaded_anchor.evaluate(
        """
        node => ({
          side: node.dataset.anchorSide,
          linkedDividerId: node.dataset.linkedDividerId,
          targetType: node.dataset.navigationTargetType,
          color: node.dataset.panelColor,
        })
        """
    )
    assert persisted["side"] == "left"
    assert persisted["linkedDividerId"] == divider_id
    assert persisted["targetType"] == "divider"
    assert persisted["color"] == recolored

    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(120)
    reloaded_anchor.evaluate("node => document.querySelector(`[data-panel-key='${node.dataset.linkedDividerId}']`)?.remove()")
    reloaded_anchor.click(position={"x": 24, "y": 24})
    page.wait_for_function("() => window.scrollY < 20")
    fallback = reloaded_anchor.evaluate(
        "node => ({ linkedDividerId: node.dataset.linkedDividerId || '', targetType: node.dataset.navigationTargetType })"
    )
    assert fallback["linkedDividerId"] == ""
    assert fallback["targetType"] == "workspace-top"
    assert_clean_browser(page)


def test_object_capabilities_gate_panel_previews_and_affordances(page: Page, app_server: str) -> None:
    goto(page, app_server)

    page.locator(".panel-add-button").click()
    page.locator('.divider-add-action[data-divider-kind="context-divider"]').click()
    divider = page.locator('.workspace-divider[data-workspace-object-type="divider"]').last
    expect(divider).to_be_visible()

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    anchor = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]').last
    expect(anchor).to_be_visible()

    capability_state = page.evaluate(
        """
        () => {
          const divider = document.querySelector('.workspace-divider[data-workspace-object-type="divider"]');
          const anchor = document.querySelector('.workspace-anchor-object[data-workspace-object-type="anchor"]');
          const panel = document.querySelector('.panel-layout > .db-panel[data-panel-key="builder-menu"]');
          const dividerHeader = divider?.querySelector(".workspace-divider-surface");
          const panelHeader = panel?.querySelector(".db-panel-hd");
          const pick = (node) => ({
            canExpand: node?.dataset.canExpand,
            isOpenable: node?.dataset.isOpenable,
            hasExpandedFootprint: node?.dataset.hasExpandedFootprint,
            participatesInGridCollision: node?.dataset.participatesInGridCollision,
            hasPanelContentArea: node?.dataset.hasPanelContentArea,
            usesPanelHeader: node?.dataset.usesPanelHeader,
            usesAnchorLayer: node?.dataset.usesAnchorLayer,
            usesDividerSurface: node?.dataset.usesDividerSurface,
          });
          return {
            divider: pick(divider),
            anchor: pick(anchor),
            panel: pick(panel),
            dividerDotCount: divider?.querySelectorAll(".workspace-divider-node").length,
            dividerHeaderRole: dividerHeader?.getAttribute("role"),
            dividerHeaderTabIndex: dividerHeader?.getAttribute("tabindex"),
            dividerHeaderExpanded: dividerHeader?.getAttribute("aria-expanded"),
            panelHeaderRole: panelHeader?.getAttribute("role"),
            panelHeaderTabIndex: panelHeader?.getAttribute("tabindex"),
            panelHeaderExpanded: panelHeader?.getAttribute("aria-expanded"),
          };
        }
        """
    )
    assert capability_state["divider"] == {
        "canExpand": "false",
        "isOpenable": "false",
        "hasExpandedFootprint": "false",
        "participatesInGridCollision": "true",
        "hasPanelContentArea": "false",
        "usesPanelHeader": "true",
        "usesAnchorLayer": "false",
        "usesDividerSurface": "true",
    }
    assert capability_state["anchor"] == {
        "canExpand": "false",
        "isOpenable": "false",
        "hasExpandedFootprint": "false",
        "participatesInGridCollision": "false",
        "hasPanelContentArea": "false",
        "usesPanelHeader": "false",
        "usesAnchorLayer": "true",
        "usesDividerSurface": "false",
    }
    assert capability_state["panel"]["canExpand"] == "true"
    assert capability_state["panel"]["isOpenable"] == "true"
    assert capability_state["panel"]["hasExpandedFootprint"] == "true"
    assert capability_state["panel"]["hasPanelContentArea"] == "true"
    assert capability_state["dividerDotCount"] == 0
    assert capability_state["dividerHeaderRole"] is None
    assert capability_state["dividerHeaderTabIndex"] is None
    assert capability_state["dividerHeaderExpanded"] is None
    assert capability_state["panelHeaderRole"] == "button"
    assert capability_state["panelHeaderTabIndex"] == "0"
    assert capability_state["panelHeaderExpanded"] in ("true", "false")

    open_tools(divider)
    divider_move_box = divider.locator(".panel-move-handle").bounding_box()
    assert divider_move_box
    x, y = box_center(divider_move_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x, y + 220, steps=14)
    page.wait_for_timeout(160)
    expect(page.locator(".dashboard-expanded-footprint-ghost")).to_have_count(0)
    expect(page.locator(".db-panel-placeholder")).to_have_count(1)
    assert page.locator(".db-panel-placeholder").evaluate("node => Number(node.dataset.gridRowSpan || 0)") == 1
    page.mouse.up()
    page.wait_for_timeout(240)
    expect(page.locator(".dashboard-expanded-footprint-ghost")).to_have_count(0)
    expect(page.locator(".db-panel-placeholder")).to_have_count(0)

    open_tools(divider)
    divider_resize_box = divider.locator(".panel-resize-handle").bounding_box()
    assert divider_resize_box
    rx, ry = box_center(divider_resize_box)
    page.mouse.move(rx, ry)
    page.mouse.down()
    page.mouse.move(rx - 180, ry, steps=12)
    page.wait_for_timeout(160)
    expect(page.locator(".dashboard-expanded-footprint-ghost")).to_have_count(0)
    expect(page.locator(".dashboard-resize-preview.db-panel-placeholder")).to_have_count(1)
    assert page.locator(".dashboard-resize-preview.db-panel-placeholder").evaluate(
        "node => Number(node.dataset.gridRowSpan || 0)"
    ) == 1
    page.mouse.up()
    page.wait_for_timeout(240)
    expect(page.locator(".dashboard-resize-preview.db-panel-placeholder")).to_have_count(0)

    anchor_box = anchor.bounding_box()
    assert anchor_box
    ax, ay = box_center(anchor_box)
    page.mouse.move(ax, ay)
    page.mouse.down()
    page.mouse.move(18, ay + 160, steps=14)
    page.wait_for_timeout(160)
    expect(page.locator(".dashboard-expanded-footprint-ghost")).to_have_count(0)
    expect(page.locator(".db-panel-placeholder, .widget-placeholder, .dashboard-resize-preview")).to_have_count(0)
    page.mouse.up()
    page.wait_for_timeout(180)

    panel = page.locator('.panel-layout > .db-panel[data-panel-key="builder-menu"]')
    page.evaluate(
        """
        node => {
          node.classList.add("db-panel-collapsed");
          node.dataset.gridRowSpan = "1";
          node.style.height = "";
          node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
        }
        """,
        arg=panel.element_handle(),
    )
    open_tools(panel)
    panel_move_box = panel.locator(".panel-move-handle").bounding_box()
    assert panel_move_box
    px, py = box_center(panel_move_box)
    page.mouse.move(px, py)
    page.mouse.down()
    page.mouse.move(px, py + 160, steps=12)
    page.wait_for_timeout(160)
    expect(page.locator(".dashboard-expanded-footprint-ghost")).to_have_count(1)
    panel_ghost_state = page.locator(".dashboard-expanded-footprint-ghost").evaluate(
        """
        node => {
          const source = document.querySelector('.panel-layout > .db-panel[data-panel-key="builder-menu"]');
          return {
            ghostHeight: node.getBoundingClientRect().height,
            sourceHeight: source.getBoundingClientRect().height,
          };
        }
        """
    )
    assert panel_ghost_state["ghostHeight"] > panel_ghost_state["sourceHeight"] + 40
    page.mouse.up()
    page.wait_for_timeout(240)
    expect(page.locator(".dashboard-expanded-footprint-ghost")).to_have_count(0)
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
    panel.evaluate(
        """
        node => {
          node.dataset.panelTitle = "Configured Panel";
          const title = node.querySelector(".db-panel-title");
          if (title) title.textContent = "Configured Panel";
        }
        """
    )
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


def test_timeframe_controls_use_shared_glass_color(page: Page, app_server: str) -> None:
    goto(page, app_server)
    control = page.locator(".timeframe-widget")
    expect(control).to_be_visible()
    assert control.evaluate("node => node.dataset.defaultSpan") == "4"

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

    artifact_dir = Path("test-results") / "timeframe-shared-controls"
    artifact_dir.mkdir(parents=True, exist_ok=True)

    apply_swatch(3)
    teal = read_timeframe_style()
    control.screenshot(path=str(artifact_dir / "timeframe-teal.png"))

    apply_swatch(10)
    pink = read_timeframe_style()
    control.screenshot(path=str(artifact_dir / "timeframe-pink.png"))

    assert teal["accent"].lower() == "#14b8a6"
    assert pink["accent"].lower() == "#db2777"
    assert teal["presetBackground"] != pink["presetBackground"]
    assert teal["presetBorder"] != pink["presetBorder"]
    assert teal["selectorBackground"] != pink["selectorBackground"]
    assert teal["refreshBackground"] != pink["refreshBackground"]
    for styles in (teal, pink):
        assert_near_white(styles["presetColor"])
        assert_near_white(styles["selectorColor"])
        assert_near_white(styles["refreshColor"])
        assert_near_white(styles["calendarColor"])
        assert_near_white(styles["settingsColor"])
    assert_clean_browser(page)


def test_timeframe_widget_is_createable_and_uses_widget_system(page: Page, app_server: str) -> None:
    goto(page, app_server)

    page.locator(".panel-add-button").click()
    expect(page.locator('.widget-add-action[data-widget-kind="timeframe"]')).to_have_count(1)
    page.locator('.widget-add-action[data-widget-kind="timeframe"]').click()

    timeframe_widgets = page.locator('.widget-layout > .timeframe-widget[data-widget-type="controls"]')
    expect(timeframe_widgets).to_have_count(2)
    created = timeframe_widgets.last
    expect(created).to_be_visible()
    expect(created.locator(".timeframe-command-surface")).to_be_visible()
    expect(created.locator(".preset-btn", has_text="Today")).to_have_count(1)
    expect(created.locator(".preset-btn", has_text="7 days")).to_have_count(1)
    expect(created.locator(".preset-btn", has_text="30 days")).to_have_count(1)
    expect(created.locator(".range-custom-trigger")).to_contain_text("This week")
    expect(created.locator(".timeframe-refresh")).to_have_count(1)
    expect(created.locator(".timeframe-calendar")).to_have_count(1)

    widget_state = created.evaluate(
        """
        node => ({
          tag: node.tagName.toLowerCase(),
          widgetType: node.dataset.widgetType,
          objectType: node.dataset.workspaceObjectType,
          objectKind: node.dataset.dashboardObjectKind,
          contextRole: node.dataset.contextRole,
          minW: Number(node.dataset.minW || 0),
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
          hasTools: Boolean(node.querySelector(".widget-tools")),
          cursor: getComputedStyle(node).cursor,
        })
        """
    )
    assert widget_state == {
        "tag": "nav",
        "widgetType": "controls",
        "objectType": "widget",
        "objectKind": "timeframe",
        "contextRole": "timeframe-control",
        "minW": 2,
        "span": 4,
        "hasTools": True,
        "cursor": "pointer",
    }

    before = grid_item_state(page, ".widget-layout > .timeframe-widget:last-of-type")
    open_tools(created)
    drag_by(page, created.locator(".panel-move-handle"), 0, 170, steps=16)
    page.wait_for_timeout(320)
    moved = grid_item_state(page, ".widget-layout > .timeframe-widget:last-of-type")
    assert moved["row"] > before["row"]

    open_tools(created)
    handle_box = created.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - 900, y, steps=18)
    page.wait_for_timeout(120)
    preview = page.locator(".dashboard-resize-preview.widget-placeholder")
    expect(preview).to_have_count(1)
    assert preview.evaluate("node => Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0)") == 2
    page.mouse.up()
    page.wait_for_timeout(350)

    resized = created.evaluate(
        """
        node => {
          const surface = node.querySelector(".timeframe-command-surface");
          const preset = node.querySelector(".preset-btn");
          const selector = node.querySelector(".range-custom-trigger");
          return {
            span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
            surfaceGap: parseFloat(getComputedStyle(surface).gap),
            presetMinWidth: parseFloat(getComputedStyle(preset).minWidth),
            selectorMinWidth: parseFloat(getComputedStyle(selector).minWidth),
          };
        }
        """
    )
    assert resized["span"] == 2
    assert resized["surfaceGap"] <= 4
    assert resized["presetMinWidth"] <= 46
    assert resized["selectorMinWidth"] <= 74

    created.locator(".preset-btn:not(.active)").first.hover()
    hover_transform = created.locator(".preset-btn:not(.active)").first.evaluate("node => getComputedStyle(node).transform")
    created.locator(".range-custom-trigger").hover()
    selector_transform = created.locator(".range-custom-trigger").evaluate("node => getComputedStyle(node).transform")
    assert hover_transform != "none"
    assert selector_transform != "none"

    page.locator(".layout-save-button").click()
    page.reload(wait_until="networkidle")
    expect(page.locator('.widget-layout > .timeframe-widget[data-custom-widget="true"][data-widget-type="controls"]')).to_have_count(1)
    persisted = page.locator('.widget-layout > .timeframe-widget[data-custom-widget="true"][data-widget-type="controls"]').last
    assert grid_item_state(page, '.widget-layout > .timeframe-widget[data-custom-widget="true"][data-widget-type="controls"]')["span"] == 2
    expect(persisted.locator(".timeframe-command-surface")).to_be_visible()
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
    assert before == 4
    assert 1 <= after["span"] < before
    assert "span 4" not in after["gridColumn"]
    assert after["row"] >= 1
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_ctrl_z_undoes_widget_move_and_resize_one_commit_at_a_time(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator('[data-widget-key="widget-1"]')

    before_move = grid_item_state(page, '[data-widget-key="widget-1"]')
    open_tools(widget)
    drag_by(page, widget.locator(".panel-move-handle"), 230, 170, steps=18)
    page.wait_for_timeout(360)
    moved = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert (moved["col"], moved["row"]) != (before_move["col"], before_move["row"])

    press_dashboard_undo(page)
    restored_move = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert grid_state_tuple(restored_move) == grid_state_tuple(before_move)
    assert_no_undo_artifacts(page)

    before_resize = grid_item_state(page, '[data-widget-key="widget-1"]')
    open_tools(widget)
    drag_by(page, widget.locator(".panel-resize-handle"), 260, 0, steps=16)
    page.wait_for_timeout(360)
    resized = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert resized["span"] != before_resize["span"]

    press_dashboard_undo(page)
    restored_resize = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert grid_state_tuple(restored_resize) == grid_state_tuple(before_resize)
    assert_no_undo_artifacts(page)
    assert_clean_browser(page)


def test_ctrl_z_undoes_group_move_and_group_resize(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator('[data-widget-key="widget-1"]')
    panel = page.locator('[data-panel-key="builder-content"]')
    page.locator(".layout-group-button").click()
    widget.click(position={"x": 20, "y": 20}, force=True)
    panel.click(position={"x": 20, "y": 20}, force=True)
    expect(page.locator(".group-selected")).to_have_count(2)

    before_move = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    open_tools(widget)
    drag_by(page, widget.locator(".panel-move-handle"), 0, 220, steps=18)
    page.wait_for_timeout(360)
    moved = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert moved["widget"]["row"] != before_move["widget"]["row"]
    assert moved["panel"]["row"] - before_move["panel"]["row"] == moved["widget"]["row"] - before_move["widget"]["row"]

    press_dashboard_undo(page)
    restored_move = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert grid_state_tuple(restored_move["widget"]) == grid_state_tuple(before_move["widget"])
    assert grid_state_tuple(restored_move["panel"]) == grid_state_tuple(before_move["panel"])
    assert_no_undo_artifacts(page)
    expect(page.locator(".group-selected")).to_have_count(2)

    before_resize = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    open_tools(widget)
    drag_by(page, widget.locator(".panel-resize-handle"), 300, 80, steps=18)
    page.wait_for_timeout(360)
    resized = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert (
        resized["widget"]["span"],
        resized["panel"]["span"],
        resized["panel"]["rowSpan"],
        resized["panel"]["height"],
    ) != (
        before_resize["widget"]["span"],
        before_resize["panel"]["span"],
        before_resize["panel"]["rowSpan"],
        before_resize["panel"]["height"],
    )

    press_dashboard_undo(page)
    restored_resize = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert grid_state_tuple(restored_resize["widget"]) == grid_state_tuple(before_resize["widget"])
    assert grid_state_tuple(restored_resize["panel"]) == grid_state_tuple(before_resize["panel"])
    assert restored_resize["panel"]["height"] == before_resize["panel"]["height"]
    assert_no_undo_artifacts(page)
    assert_clean_browser(page)


def test_ctrl_z_undoes_add_panel_and_expand_collapse(page: Page, app_server: str) -> None:
    goto(page, app_server)
    initial_count = page.locator(".panel-layout > .db-panel").count()
    add_panel_for_setup(page)
    expect(page.locator(".panel-layout > .db-panel")).to_have_count(initial_count + 1)

    press_dashboard_undo(page)
    expect(page.locator(".panel-layout > .db-panel")).to_have_count(initial_count)
    assert_no_undo_artifacts(page)

    panel_selector = '[data-panel-key="builder-menu"]'
    before_toggle = grid_item_state(page, panel_selector)
    before_collapsed = page.locator(panel_selector).evaluate("node => node.classList.contains('db-panel-collapsed')")
    page.locator(f"{panel_selector} .db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(360)
    after_collapsed = page.locator(panel_selector).evaluate("node => node.classList.contains('db-panel-collapsed')")
    assert after_collapsed != before_collapsed

    press_dashboard_undo(page)
    restored_toggle = grid_item_state(page, panel_selector)
    restored_collapsed = page.locator(panel_selector).evaluate("node => node.classList.contains('db-panel-collapsed')")
    assert restored_collapsed == before_collapsed
    assert grid_state_tuple(restored_toggle) == grid_state_tuple(before_toggle)
    assert_no_undo_artifacts(page)
    assert_clean_browser(page)


def test_anchor_reorder_starts_from_menu_move_control_and_cleans_preview_state(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    anchors = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]')
    expect(anchors).to_have_count(2)
    first_anchor = anchors.nth(0)
    second_anchor = anchors.nth(1)
    second_key = second_anchor.evaluate("node => node.dataset.anchorKey")

    def anchor_order() -> list[str]:
        return page.evaluate(
            """
            () => [...document.querySelectorAll('.workspace-anchor-layer > .workspace-anchor-object')]
              .sort((a, b) => Number(a.dataset.anchorRailOrder) - Number(b.dataset.anchorRailOrder))
              .map((anchor) => anchor.dataset.anchorKey)
            """
        )

    def anchor_drag_artifacts() -> dict:
        return page.evaluate(
            """
            () => ({
              ghostCount: document.querySelectorAll(".workspace-anchor-drag-ghost").length,
              placeholderCount: document.querySelectorAll(".workspace-anchor-rail-placeholder").length,
              sourceCount: document.querySelectorAll(".workspace-anchor-object.anchor-rail-source").length,
              previewingCount: document.querySelectorAll(".workspace-anchor-object.anchor-rail-previewing").length,
              bodyDragging: document.body.classList.contains("anchor-rail-drag-active"),
            })
            """
        )

    expected_clear = {
        "ghostCount": 0,
        "placeholderCount": 0,
        "sourceCount": 0,
        "previewingCount": 0,
        "bodyDragging": False,
    }

    def open_anchor_tools(anchor) -> None:
        if not anchor.evaluate("node => node.classList.contains('widget-tools-open')"):
            anchor.locator(".anchor-settings-toggle").click(force=True)
        expect(anchor.locator(".anchor-tool-drawer")).to_be_visible()

    order_before_body_drag = anchor_order()
    body_box = second_anchor.bounding_box()
    assert body_box
    page.mouse.move(body_box["x"] + body_box["width"] / 2, body_box["y"] + body_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(body_box["x"] + body_box["width"] + 280, body_box["y"] - 90, steps=12)
    page.mouse.up()
    page.wait_for_timeout(140)
    assert anchor_drag_artifacts() == expected_clear
    assert anchor_order() == order_before_body_drag

    page.evaluate("window.scrollTo(0, 600)")
    page.wait_for_timeout(80)
    second_anchor.click(position={"x": 24, "y": 24})
    page.wait_for_function("() => window.scrollY <= 32")

    open_anchor_tools(second_anchor)
    first_box = first_anchor.bounding_box()
    move_box = second_anchor.locator(".panel-move-handle").bounding_box()
    assert first_box and move_box
    page.mouse.move(move_box["x"] + move_box["width"] / 2, move_box["y"] + move_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(move_box["x"] + move_box["width"] / 2, first_box["y"] + 8, steps=12)
    expect(page.locator(".workspace-anchor-drag-ghost")).to_have_count(1)
    expect(page.locator(".workspace-anchor-rail-placeholder")).to_have_count(1)
    page.keyboard.press("Escape")
    page.wait_for_timeout(140)
    assert anchor_drag_artifacts() == expected_clear
    page.mouse.move(900, 900)
    page.mouse.up()
    page.keyboard.press("Escape")
    assert anchor_order() == order_before_body_drag

    open_anchor_tools(second_anchor)
    move_box = second_anchor.locator(".panel-move-handle").bounding_box()
    assert move_box
    page.mouse.move(move_box["x"] + move_box["width"] / 2, move_box["y"] + move_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(move_box["x"] + move_box["width"] / 2, first_box["y"] + 8, steps=12)
    expect(page.locator(".workspace-anchor-drag-ghost")).to_have_count(1)
    second_anchor.evaluate(
        """
        node => node.dispatchEvent(new PointerEvent("lostpointercapture", {
          pointerId: 1,
          bubbles: false,
          cancelable: false,
          pointerType: "mouse",
        }))
        """
    )
    page.wait_for_timeout(140)
    assert anchor_drag_artifacts() == expected_clear
    page.mouse.move(900, 900)
    page.mouse.up()
    page.keyboard.press("Escape")
    assert anchor_order() == order_before_body_drag

    open_anchor_tools(second_anchor)
    move_box = second_anchor.locator(".panel-move-handle").bounding_box()
    assert move_box
    page.mouse.move(move_box["x"] + move_box["width"] / 2, move_box["y"] + move_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(move_box["x"] + move_box["width"] / 2, first_box["y"] + 8, steps=12)
    page.mouse.up()
    page.wait_for_timeout(260)
    assert anchor_drag_artifacts() == expected_clear
    order_after_menu_drag = anchor_order()
    assert order_after_menu_drag[0] == second_key
    assert order_after_menu_drag != order_before_body_drag
    assert_clean_browser(page)


def test_anchor_delete_reflows_lower_anchors_without_repacking_arbitrary_offsets(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")

    for _ in range(3):
        page.locator(".panel-add-button").click()
        page.locator('.widget-add-action[data-widget-kind="anchor"]').click()

    anchors = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]')
    expect(anchors).to_have_count(3)
    page.evaluate(
        """
        () => {
          const offsets = [126, 268, 442];
          [...document.querySelectorAll('.workspace-anchor-layer > .workspace-anchor-object')]
            .forEach((anchor, index) => {
              anchor.dataset.anchorRailOrder = String(index);
              anchor.dataset.anchorOffset = String(offsets[index]);
              anchor.style.setProperty("--anchor-offset", `${offsets[index]}px`);
            });
        }
        """
    )

    first = anchors.nth(0)
    first.locator(".anchor-settings-toggle").click(force=True)
    first.locator(".panel-color-toggle").click(force=True)
    page.locator(".panel-color-menu-open .panel-color-swatch").nth(2).click(force=True)

    def rail_state() -> list[dict]:
        return page.evaluate(
            """
            () => [...document.querySelectorAll('.workspace-anchor-layer > .workspace-anchor-object')]
              .sort((a, b) => Number(a.dataset.anchorOffset) - Number(b.dataset.anchorOffset))
              .map((anchor) => ({
                key: anchor.dataset.anchorKey,
                offset: Number(anchor.dataset.anchorOffset),
                top: Math.round(anchor.getBoundingClientRect().top),
                height: Math.ceil(anchor.getBoundingClientRect().height),
                reflowing: anchor.classList.contains("anchor-rail-reflowing"),
                transform: getComputedStyle(anchor).transform,
              }))
            """
        )

    def delete_anchor(anchor) -> None:
        anchor.evaluate("node => node.focus()")
        page.keyboard.press("Delete")
        if page.locator(".confirm-dialog[open]").count():
            page.locator(".confirm-dialog .confirm-dialog-danger").click()

    initial = rail_state()
    assert [entry["offset"] for entry in initial] == [126, 268, 442]
    middle_shift = initial[1]["height"] + 8

    middle_anchor = page.locator(f'.workspace-anchor-object[data-anchor-key="{initial[1]["key"]}"]')
    delete_anchor(middle_anchor)
    expect(anchors).to_have_count(2)
    after_middle_delete = rail_state()
    assert [entry["key"] for entry in after_middle_delete] == [initial[0]["key"], initial[2]["key"]]
    assert after_middle_delete[0]["offset"] == initial[0]["offset"]
    assert after_middle_delete[1]["offset"] == initial[2]["offset"] - middle_shift
    assert after_middle_delete[0]["reflowing"] is False
    assert after_middle_delete[1]["reflowing"] is True
    assert after_middle_delete[1]["transform"] != "none"
    page.wait_for_timeout(420)
    assert all(entry["reflowing"] is False for entry in rail_state())

    press_dashboard_undo(page)
    expect(anchors).to_have_count(3)
    restored = rail_state()
    assert [entry["key"] for entry in restored] == [entry["key"] for entry in initial]
    assert [entry["offset"] for entry in restored] == [entry["offset"] for entry in initial]

    top_anchor = page.locator(f'.workspace-anchor-object[data-anchor-key="{initial[0]["key"]}"]')
    top_shift = restored[0]["height"] + 8
    delete_anchor(top_anchor)
    expect(anchors).to_have_count(2)
    after_top_delete = rail_state()
    assert [entry["key"] for entry in after_top_delete] == [initial[1]["key"], initial[2]["key"]]
    assert [entry["offset"] for entry in after_top_delete] == [
        initial[1]["offset"] - top_shift,
        initial[2]["offset"] - top_shift,
    ]
    assert all(entry["reflowing"] is True and entry["transform"] != "none" for entry in after_top_delete)
    page.wait_for_timeout(420)

    press_dashboard_undo(page)
    expect(anchors).to_have_count(3)
    restored = rail_state()
    bottom_anchor = page.locator(f'.workspace-anchor-object[data-anchor-key="{initial[2]["key"]}"]')
    delete_anchor(bottom_anchor)
    expect(anchors).to_have_count(2)
    after_bottom_delete = rail_state()
    assert [entry["key"] for entry in after_bottom_delete] == [initial[0]["key"], initial[1]["key"]]
    assert [entry["offset"] for entry in after_bottom_delete] == [initial[0]["offset"], initial[1]["offset"]]
    assert all(entry["reflowing"] is False and entry["transform"] == "none" for entry in after_bottom_delete)
    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    expect(page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]')).to_have_count(2)
    after_reload = rail_state()
    assert [entry["key"] for entry in after_reload] == [initial[0]["key"], initial[1]["key"]]
    assert [entry["offset"] for entry in after_reload] == [initial[0]["offset"], initial[1]["offset"]]
    assert_clean_browser(page)


def test_anchors_join_layout_history_and_saved_layout_state(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")

    def anchor_order() -> list[str]:
        return page.evaluate(
            """
            () => [...document.querySelectorAll('.workspace-anchor-layer > .workspace-anchor-object')]
              .sort((a, b) => Number(a.dataset.anchorRailOrder) - Number(b.dataset.anchorRailOrder))
              .map((anchor) => anchor.dataset.anchorKey)
            """
        )

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    anchors = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]')
    expect(anchors).to_have_count(1)
    linked_anchor = anchors.first
    linked_key = linked_anchor.evaluate("node => node.dataset.anchorKey")

    press_dashboard_undo(page)
    expect(anchors).to_have_count(0)
    press_dashboard_redo(page)
    expect(anchors).to_have_count(1)
    linked_anchor = page.locator(f'.workspace-anchor-object[data-anchor-key="{linked_key}"]')
    expect(linked_anchor).to_be_visible()

    page.locator(".panel-add-button").click()
    page.locator('.divider-add-action[data-divider-kind="context-divider"]').click()
    divider = page.locator('.workspace-divider[data-workspace-object-type="divider"]').last
    expect(divider).to_be_visible()
    divider.evaluate(
        """
        node => {
          node.dataset.gridCol = "1";
          node.dataset.gridRow = "30";
          node.dataset.currentSpan = "6";
          node.dataset.gridRowSpan = "1";
          node.style.gridColumn = "1 / span 6";
          node.style.gridRow = "30 / span 1";
        }
        """
    )
    divider_id = divider.evaluate("node => node.dataset.panelKey")

    linked_anchor.locator(".anchor-settings-toggle").click(force=True)
    linked_anchor.locator(".anchor-link-toggle").click(force=True)
    linked_anchor.locator(f'.anchor-link-option[data-divider-id="{divider_id}"]').click(force=True)
    expect(linked_anchor.locator(".workspace-anchor-label")).to_contain_text("Divider")
    assert linked_anchor.evaluate("node => node.dataset.linkedDividerId") == divider_id

    press_dashboard_undo(page)
    expect(linked_anchor.locator(".workspace-anchor-label")).to_have_text("Top")
    assert linked_anchor.evaluate("node => node.dataset.linkedDividerId || ''") == ""
    press_dashboard_redo(page)
    expect(linked_anchor.locator(".workspace-anchor-label")).to_contain_text("Divider")
    assert linked_anchor.evaluate("node => node.dataset.linkedDividerId") == divider_id

    original_color = linked_anchor.evaluate("node => node.dataset.panelColor")
    linked_anchor.locator(".anchor-settings-toggle").click(force=True)
    linked_anchor.locator(".panel-color-toggle").click(force=True)
    page.locator(".panel-color-menu-open .panel-color-swatch").nth(4).click()
    changed_color = linked_anchor.evaluate("node => node.dataset.panelColor")
    assert changed_color != original_color

    press_dashboard_undo(page)
    assert linked_anchor.evaluate("node => node.dataset.panelColor") == original_color
    press_dashboard_redo(page)
    assert linked_anchor.evaluate("node => node.dataset.panelColor") == changed_color

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    expect(anchors).to_have_count(2)
    second_anchor = anchors.nth(1)
    second_key = second_anchor.evaluate("node => node.dataset.anchorKey")
    order_before_drag = anchor_order()
    first_box = linked_anchor.bounding_box()
    second_box = second_anchor.bounding_box()
    assert first_box and second_box
    second_anchor.locator(".anchor-settings-toggle").click(force=True)
    move_box = second_anchor.locator(".panel-move-handle").bounding_box()
    assert move_box
    page.mouse.move(move_box["x"] + move_box["width"] / 2, move_box["y"] + move_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(move_box["x"] + move_box["width"] / 2, first_box["y"] + 8, steps=14)
    page.mouse.up()
    page.wait_for_timeout(360)
    order_after_drag = anchor_order()
    assert order_after_drag[0] == second_key
    assert order_after_drag != order_before_drag

    press_dashboard_undo(page)
    assert anchor_order() == order_before_drag
    press_dashboard_redo(page)
    assert anchor_order() == order_after_drag

    second_anchor = page.locator(f'.workspace-anchor-object[data-anchor-key="{second_key}"]')
    second_anchor.locator(".anchor-settings-toggle").click(force=True)
    second_anchor.locator(".panel-delete-handle").click(force=True)
    expect(anchors).to_have_count(1)
    assert page.locator(f'.workspace-anchor-object[data-anchor-key="{linked_key}"]').count() == 1

    press_dashboard_undo(page)
    expect(anchors).to_have_count(2)
    press_dashboard_redo(page)
    expect(anchors).to_have_count(1)
    linked_anchor = page.locator(f'.workspace-anchor-object[data-anchor-key="{linked_key}"]')
    expect(linked_anchor).to_be_visible()
    assert linked_anchor.evaluate("node => node.dataset.linkedDividerId") == divider_id

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    reloaded_anchor = page.locator(f'.workspace-anchor-object[data-anchor-key="{linked_key}"]')
    expect(reloaded_anchor).to_be_visible()
    expect(page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]')).to_have_count(1)
    reloaded_divider = page.locator(f'.workspace-divider[data-panel-key="{divider_id}"]')
    expect(reloaded_divider).to_be_visible()
    assert reloaded_anchor.evaluate("node => node.dataset.linkedDividerId") == divider_id

    page.evaluate("window.scrollTo(0, 0)")
    reloaded_anchor.click(position={"x": 24, "y": 24})
    initial_alignment = wait_for_anchor_divider_alignment(page, reloaded_divider)
    initial_scroll = initial_alignment["scrollY"]

    page.evaluate("window.scrollTo(0, 0)")
    reloaded_divider.evaluate(
        """
        node => {
          node.dataset.gridRow = "46";
          node.style.gridRow = "46 / span 1";
        }
        """
    )
    page.wait_for_timeout(120)
    moved_target = anchor_divider_alignment(reloaded_divider)["scrollTarget"]
    assert moved_target > initial_scroll + 300
    reloaded_anchor.click(position={"x": 24, "y": 24})
    moved_alignment = wait_for_anchor_divider_alignment(page, reloaded_divider)
    assert moved_alignment["scrollTarget"] > initial_scroll + 300

    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(120)
    reloaded_divider.evaluate("node => node.remove()")
    reloaded_anchor.click(position={"x": 24, "y": 24})
    page.wait_for_function("() => window.scrollY < 20")
    assert reloaded_anchor.evaluate("node => node.dataset.linkedDividerId || ''") == ""
    assert_no_undo_artifacts(page)
    assert_clean_browser(page)


def test_smart_delete_confirms_only_meaningful_workspace_objects(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")

    dialog = page.locator("#panel-delete-dialog")

    def dialog_open() -> bool:
        return dialog.evaluate("node => Boolean(node.open)")

    def activate_group_selection() -> None:
        if page.evaluate("document.body.classList.contains('group-select-active')"):
            page.locator(".layout-group-button").click()
        page.locator(".layout-group-button").click()
        expect(page.locator(".layout-group-button")).to_have_attribute("aria-pressed", "true")

    def select_for_keyboard_delete(item) -> None:
        activate_group_selection()
        item.click(position={"x": 18, "y": 18}, force=True)
        expect(item).to_have_class(re.compile("group-selected"))

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="search"]').click()
    search_widget = page.locator('.widget-layout > .search-widget-card[data-custom-widget="true"]').last
    expect(search_widget).to_be_visible()
    search_key = search_widget.evaluate("node => node.dataset.widgetKey")
    select_for_keyboard_delete(search_widget)
    page.keyboard.press("Delete")
    page.wait_for_timeout(260)
    assert dialog_open() is False
    expect(page.locator(f'.widget-layout > .widget-card[data-widget-key="{search_key}"]')).to_have_count(0)
    press_dashboard_undo(page)
    expect(page.locator(f'.widget-layout > .widget-card[data-widget-key="{search_key}"]')).to_be_visible()

    edited_widget = add_widget_for_setup(page)
    edited_key = edited_widget.evaluate("node => node.dataset.widgetKey")
    edited_widget.evaluate(
        """
        node => {
          node.dataset.panelTitle = "Edited Widget";
          const label = node.querySelector(".stat-lbl");
          if (label) label.textContent = "Edited Widget";
        }
        """
    )
    select_for_keyboard_delete(edited_widget)
    page.keyboard.press("Delete")
    expect(dialog).to_be_visible()
    page.locator(".confirm-dialog-cancel").click()
    expect(page.locator(f'.widget-layout > .widget-card[data-widget-key="{edited_key}"]')).to_be_visible()
    page.keyboard.press("Delete")
    expect(dialog).to_be_visible()
    page.locator(".confirm-dialog-danger").click()
    expect(page.locator(f'.widget-layout > .widget-card[data-widget-key="{edited_key}"]')).to_have_count(0)
    press_dashboard_undo(page)
    expect(page.locator(f'.widget-layout > .widget-card[data-widget-key="{edited_key}"]')).to_be_visible()

    blank_panel = add_panel_for_setup(page)
    blank_panel_key = blank_panel.evaluate("node => node.dataset.panelKey")
    select_for_keyboard_delete(blank_panel)
    page.keyboard.press("Delete")
    page.wait_for_timeout(260)
    assert dialog_open() is False
    expect(page.locator(f'.panel-layout > .db-panel[data-panel-key="{blank_panel_key}"]')).to_have_count(0)
    press_dashboard_undo(page)
    expect(page.locator(f'.panel-layout > .db-panel[data-panel-key="{blank_panel_key}"]')).to_be_visible()

    content_panel = add_panel_for_setup(page)
    content_panel_key = content_panel.evaluate("node => node.dataset.panelKey")
    content_panel.evaluate(
        """
        node => {
          const body = node.querySelector(".db-panel-body");
          const note = document.createElement("div");
          note.className = "panel-configured-content";
          note.textContent = "Configured content";
          body?.appendChild(note);
        }
        """
    )
    select_for_keyboard_delete(content_panel)
    page.keyboard.press("Delete")
    expect(dialog).to_be_visible()
    page.locator(".confirm-dialog-cancel").click()
    expect(page.locator(f'.panel-layout > .db-panel[data-panel-key="{content_panel_key}"]')).to_be_visible()
    page.keyboard.press("Delete")
    expect(dialog).to_be_visible()
    page.locator(".confirm-dialog-danger").click()
    expect(page.locator(f'.panel-layout > .db-panel[data-panel-key="{content_panel_key}"]')).to_have_count(0)
    press_dashboard_undo(page)
    expect(page.locator(f'.panel-layout > .db-panel[data-panel-key="{content_panel_key}"]')).to_be_visible()

    page.locator(".panel-add-button").click()
    page.locator('.divider-add-action[data-divider-kind="context-divider"]').click()
    blank_divider = page.locator('.workspace-divider[data-workspace-object-type="divider"]').last
    blank_divider_key = blank_divider.evaluate("node => node.dataset.panelKey")
    select_for_keyboard_delete(blank_divider)
    page.keyboard.press("Delete")
    page.wait_for_timeout(260)
    assert dialog_open() is False
    expect(page.locator(f'.workspace-divider[data-panel-key="{blank_divider_key}"]')).to_have_count(0)
    press_dashboard_undo(page)
    expect(page.locator(f'.workspace-divider[data-panel-key="{blank_divider_key}"]')).to_be_visible()

    page.locator(".panel-add-button").click()
    page.locator('.divider-add-action[data-divider-kind="context-divider"]').click()
    renamed_divider = page.locator('.workspace-divider[data-workspace-object-type="divider"]').last
    renamed_divider_key = renamed_divider.evaluate("node => node.dataset.panelKey")
    renamed_divider.evaluate(
        """
        node => {
          node.dataset.panelTitle = "Renamed Divider";
          const title = node.querySelector(".db-panel-title");
          if (title) title.textContent = "Renamed Divider";
        }
        """
    )
    select_for_keyboard_delete(renamed_divider)
    page.keyboard.press("Delete")
    expect(dialog).to_be_visible()
    page.locator(".confirm-dialog-danger").click()
    expect(page.locator(f'.workspace-divider[data-panel-key="{renamed_divider_key}"]')).to_have_count(0)
    press_dashboard_undo(page)
    expect(page.locator(f'.workspace-divider[data-panel-key="{renamed_divider_key}"]')).to_be_visible()

    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    default_anchor = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]').last
    default_anchor_key = default_anchor.evaluate("node => node.dataset.anchorKey")
    default_anchor.locator(".anchor-settings-toggle").click(force=True)
    default_anchor.locator(".panel-delete-handle").click(force=True)
    page.wait_for_timeout(260)
    assert dialog_open() is False
    expect(page.locator(f'.workspace-anchor-object[data-anchor-key="{default_anchor_key}"]')).to_have_count(0)
    press_dashboard_undo(page)
    expect(page.locator(f'.workspace-anchor-object[data-anchor-key="{default_anchor_key}"]')).to_be_visible()

    linked_anchor = page.locator(f'.workspace-anchor-object[data-anchor-key="{default_anchor_key}"]')
    page.locator(".panel-add-button").click()
    page.locator('.divider-add-action[data-divider-kind="context-divider"]').click()
    link_divider = page.locator('.workspace-divider[data-workspace-object-type="divider"]').last
    link_divider_id = link_divider.evaluate("node => node.dataset.panelKey")
    linked_anchor.locator(".anchor-settings-toggle").click(force=True)
    linked_anchor.locator(".anchor-link-toggle").click(force=True)
    linked_anchor.locator(f'.anchor-link-option[data-divider-id="{link_divider_id}"]').click(force=True)
    linked_anchor.evaluate("node => node.focus()")
    page.keyboard.press("Delete")
    expect(dialog).to_be_visible()
    page.locator(".confirm-dialog-cancel").click()
    expect(page.locator(f'.workspace-anchor-object[data-anchor-key="{default_anchor_key}"]')).to_be_visible()
    linked_anchor.evaluate("node => node.focus()")
    page.keyboard.press("Delete")
    expect(dialog).to_be_visible()
    page.locator(".confirm-dialog-danger").click()
    expect(page.locator(f'.workspace-anchor-object[data-anchor-key="{default_anchor_key}"]')).to_have_count(0)
    press_dashboard_undo(page)
    expect(page.locator(f'.workspace-anchor-object[data-anchor-key="{default_anchor_key}"]')).to_be_visible()

    assert_no_undo_artifacts(page)
    assert_clean_browser(page)


def test_ctrl_z_ignores_text_inputs_and_canceled_interaction_previews(page: Page, app_server: str) -> None:
    goto(page, app_server)
    initial_count = page.locator(".panel-layout > .db-panel").count()
    add_panel_for_setup(page)
    expect(page.locator(".panel-layout > .db-panel")).to_have_count(initial_count + 1)

    page.evaluate(
        """
        () => {
          const input = document.createElement("input");
          input.id = "undo-input-safety";
          input.value = "";
          document.body.appendChild(input);
          input.focus();
        }
        """
    )
    page.keyboard.type("typed text")
    page.keyboard.press("Control+Z")
    page.wait_for_timeout(180)
    expect(page.locator(".panel-layout > .db-panel")).to_have_count(initial_count + 1)
    assert page.locator("#undo-input-safety").input_value() in {"", "typed text"}

    page.locator("#undo-input-safety").evaluate("node => node.remove()")
    press_dashboard_undo(page)
    expect(page.locator(".panel-layout > .db-panel")).to_have_count(initial_count)

    widget = page.locator('[data-widget-key="widget-1"]')
    before_drag = grid_item_state(page, '[data-widget-key="widget-1"]')
    open_tools(widget)
    handle_box = widget.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 180, y + 160, steps=12)
    expect(page.locator(".widget-placeholder")).to_have_count(1)
    page.keyboard.press("Escape")
    page.wait_for_timeout(260)
    assert grid_state_tuple(grid_item_state(page, '[data-widget-key="widget-1"]')) == grid_state_tuple(before_drag)
    assert_no_undo_artifacts(page)

    press_dashboard_undo(page)
    assert grid_state_tuple(grid_item_state(page, '[data-widget-key="widget-1"]')) == grid_state_tuple(before_drag)
    assert_no_undo_artifacts(page)
    assert_clean_browser(page)


def test_timeframe_resize_clamps_to_adaptive_density_minimum(page: Page, app_server: str) -> None:
    goto(page, app_server)
    control = page.locator(".timeframe-widget")
    before = grid_item_state(page, ".timeframe-widget")

    open_tools(control)
    handle_box = control.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - 900, y, steps=18)
    page.wait_for_timeout(120)
    preview = page.locator(".dashboard-resize-preview.widget-placeholder")
    expect(preview).to_have_count(1)
    preview_span = preview.evaluate("node => Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0)")
    assert preview_span == 2
    page.mouse.up()
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
          const surface = node.querySelector(".timeframe-command-surface");
          const preset = node.querySelector(".preset-btn");
          const selector = node.querySelector(".range-custom-trigger");
          const icon = node.querySelector(".range-icon-button");
          return {
            span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
            minW: Number(node.dataset.minW || 0),
            gridColumn: getComputedStyle(node).gridColumnEnd,
            surfaceGap: parseFloat(getComputedStyle(surface).gap),
            presetMinWidth: parseFloat(getComputedStyle(preset).minWidth),
            selectorMinWidth: parseFloat(getComputedStyle(selector).minWidth),
            iconWidth: icon.getBoundingClientRect().width,
            iconHeight: icon.getBoundingClientRect().height,
            clipped: visibleControls.filter((control) => control.clipped || control.width < 24 || control.height < 24),
          };
        }
        """
    )

    assert before["span"] == 4
    assert state["span"] == state["minW"] == 2
    assert state["gridColumn"] == "span 2"
    assert state["surfaceGap"] <= 4
    assert state["presetMinWidth"] <= 46
    assert state["selectorMinWidth"] <= 74
    assert state["iconWidth"] >= 30
    assert state["iconHeight"] >= 30
    assert state["clipped"] == []
    control.locator(".preset-btn").first.hover()
    hovered = control.locator(".preset-btn").first.evaluate("node => getComputedStyle(node).boxShadow")
    assert hovered != "none"
    control.locator(".range-custom-trigger").focus()
    focused = control.locator(".range-custom-trigger").evaluate(
        "node => ({ outline: getComputedStyle(node).outlineStyle, border: getComputedStyle(node).borderColor })"
    )
    assert focused["outline"] in {"none", "solid"}
    assert focused["border"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
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
          const table = panelLayout.querySelector('[data-panel-key="builder-content"]');
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
    table = page.locator('.panel-layout > .db-panel[data-panel-key="builder-content"]')
    expect(notes).to_have_class(re.compile("db-panel-collapsed"))

    notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(350)

    expanded = page.evaluate(
        """
        () => {
          const notes = document.querySelector('[data-panel-key="builder-notes"]');
          const table = document.querySelector('[data-panel-key="builder-content"]');
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
          const table = document.querySelector('[data-panel-key="builder-content"]');
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


def test_dragging_expanded_panel_preserves_temporary_pushdown_restoration(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const styles = getComputedStyle(grid);
          const rowHeight = parseFloat(styles.gridAutoRows) || 81;
          const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
          const panelHeight = (rows) => (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const setItem = (node, col, row, span, rowSpan = 1) => {
            node.hidden = false;
            node.classList.remove("db-panel-pinned", "group-selected");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
          };
          const setPanel = (node, col, row, span, rowSpan, collapsed) => {
            setItem(node, col, row, span, collapsed ? 1 : rowSpan);
            node.dataset.savedHeight = String(panelHeight(rowSpan));
            node.classList.toggle("db-panel-collapsed", collapsed);
            node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", (!collapsed).toString());
            node.style.height = collapsed ? "" : `${panelHeight(rowSpan)}px`;
          };
          const movingPanel = document.querySelector('[data-panel-key="builder-content"]');
          const displacedWidget = document.querySelector('[data-widget-key="widget-1"]');
          const otherWidget = document.querySelector('[data-widget-key="widget-2"]');
          const otherPanel = document.querySelector('[data-panel-key="builder-menu"]');
          setPanel(movingPanel, 1, 1, 2, 3, true);
          setItem(displacedWidget, 1, 2, 1, 1);
          setItem(otherWidget, 5, 2, 1, 1);
          setPanel(otherPanel, 4, 8, 2, 2, true);
          document.querySelectorAll(".widget-layout > .widget-card, .panel-layout > .db-panel").forEach((node, index) => {
            if ([movingPanel, displacedWidget, otherWidget, otherPanel].includes(node)) return;
            if (node.classList.contains("db-panel")) {
              setPanel(node, 6, 16 + index, 1, 2, true);
            } else {
              setItem(node, 6, 16 + index, 1, 1);
            }
          });
          document.body.classList.remove("group-transform-active");
          window.scrollTo(0, 0);
        }
        """
    )

    panel = page.locator('[data-panel-key="builder-content"]')
    displaced = page.locator('[data-widget-key="widget-1"]')
    unrelated = page.locator('[data-widget-key="widget-2"]')
    baseline_displaced = grid_item_state(page, '[data-widget-key="widget-1"]')
    baseline_unrelated = grid_item_state(page, '[data-widget-key="widget-2"]')
    assert baseline_displaced["col"] == 1
    assert baseline_displaced["row"] == 2

    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(360)
    expanded_displaced = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert expanded_displaced["col"] == baseline_displaced["col"]
    assert expanded_displaced["row"] > baseline_displaced["row"]
    expanded_visual = page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const styles = getComputedStyle(grid);
          const rowHeight = parseFloat(styles.gridAutoRows) || 81;
          const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
          const panel = document.querySelector('[data-panel-key="builder-content"]');
          const rows = Number(panel.dataset.gridRowSpan || 1);
          const expectedHeight = (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const rect = panel.getBoundingClientRect();
          return {
            collapsed: panel.classList.contains("db-panel-collapsed"),
            rows,
            expectedHeight,
            rect: rect.toJSON(),
            styleHeight: parseFloat(getComputedStyle(panel).height),
          };
        }
        """
    )
    assert expanded_visual["collapsed"] is False
    assert expanded_visual["rows"] > 1
    assert abs(expanded_visual["rect"]["height"] - expanded_visual["expectedHeight"]) <= 2
    assert abs(expanded_visual["styleHeight"] - expanded_visual["expectedHeight"]) <= 2

    open_tools(panel)
    x, y = begin_drag(page, panel.locator(".panel-move-handle"), 0, 60, steps=10)
    during_drag = page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const styles = getComputedStyle(grid);
          const rowHeight = parseFloat(styles.gridAutoRows) || 81;
          const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
          const panel = document.querySelector('[data-panel-key="builder-content"]');
          const active = document.querySelector(".db-panel-dragging");
          const placeholder = document.querySelector(".db-panel-placeholder");
          const rows = Number(placeholder?.dataset.gridRowSpan || panel.dataset.gridRowSpan || 1);
          const expectedHeight = (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          return {
            panelCollapsed: panel.classList.contains("db-panel-collapsed"),
            activeHeight: active?.getBoundingClientRect().height || 0,
            placeholderHeight: placeholder?.getBoundingClientRect().height || 0,
            placeholderRows: rows,
            expectedHeight,
            expandedGhosts: document.querySelectorAll(".dashboard-expanded-footprint-ghost").length,
          };
        }
        """
    )
    assert during_drag["panelCollapsed"] is False
    assert during_drag["placeholderRows"] == expanded_visual["rows"]
    assert abs(during_drag["activeHeight"] - expanded_visual["expectedHeight"]) <= 2
    assert abs(during_drag["placeholderHeight"] - expanded_visual["expectedHeight"]) <= 2
    assert abs(during_drag["placeholderHeight"] - during_drag["expectedHeight"]) <= 2
    assert during_drag["expandedGhosts"] == 0
    end_drag(page, x, y, 0, 190, steps=18)
    page.wait_for_timeout(420)
    after_drag_displaced = grid_item_state(page, '[data-widget-key="widget-1"]')
    after_drag_panel = grid_item_state(page, '[data-panel-key="builder-content"]')
    assert after_drag_panel["row"] > 1
    assert after_drag_panel["rowSpan"] == expanded_visual["rows"]
    assert after_drag_displaced["col"] == baseline_displaced["col"]
    assert after_drag_displaced["row"] > expanded_displaced["row"]
    after_drag_visual = page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const styles = getComputedStyle(grid);
          const rowHeight = parseFloat(styles.gridAutoRows) || 81;
          const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
          const panel = document.querySelector('[data-panel-key="builder-content"]');
          const rows = Number(panel.dataset.gridRowSpan || 1);
          const expectedHeight = (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const rect = panel.getBoundingClientRect();
          return {
            collapsed: panel.classList.contains("db-panel-collapsed"),
            expectedHeight,
            rect: rect.toJSON(),
            styleHeight: parseFloat(getComputedStyle(panel).height),
          };
        }
        """
    )
    assert after_drag_visual["collapsed"] is False
    assert abs(after_drag_visual["rect"]["height"] - after_drag_visual["expectedHeight"]) <= 2
    assert abs(after_drag_visual["styleHeight"] - after_drag_visual["expectedHeight"]) <= 2

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")
    panel = page.locator('[data-panel-key="builder-content"]')
    expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
    loaded_expanded_displaced = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert loaded_expanded_displaced["col"] == baseline_displaced["col"]
    assert loaded_expanded_displaced["row"] == after_drag_displaced["row"]

    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(420)
    collapsed_panel = grid_item_state(page, '[data-panel-key="builder-content"]')
    collapsed_displaced = grid_item_state(page, '[data-widget-key="widget-1"]')
    collapsed_unrelated = grid_item_state(page, '[data-widget-key="widget-2"]')
    assert collapsed_displaced["col"] == baseline_displaced["col"]
    assert collapsed_displaced["row"] >= collapsed_panel["row"] + collapsed_panel["rowSpan"]
    assert collapsed_displaced["row"] <= after_drag_displaced["row"]
    assert grid_state_tuple(collapsed_unrelated) == grid_state_tuple(baseline_unrelated)
    expect(panel).to_have_class(re.compile("db-panel-collapsed"))
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    local_restored_displaced = collapsed_displaced

    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(420)
    expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
    reopened_displaced = grid_item_state(page, '[data-widget-key="widget-1"]')
    reopened_visual = page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const styles = getComputedStyle(grid);
          const rowHeight = parseFloat(styles.gridAutoRows) || 81;
          const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
          const panel = document.querySelector('[data-panel-key="builder-content"]');
          const rows = Number(panel.dataset.gridRowSpan || 1);
          const expectedHeight = (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          return {
            rows,
            expectedHeight,
            rect: panel.getBoundingClientRect().toJSON(),
          };
        }
        """
    )
    assert reopened_visual["rows"] == expanded_visual["rows"]
    assert abs(reopened_visual["rect"]["height"] - reopened_visual["expectedHeight"]) <= 2
    assert reopened_displaced["col"] == baseline_displaced["col"]
    reopened_footprint_bottom = after_drag_panel["row"] + reopened_visual["rows"] - 1
    if after_drag_panel["row"] <= local_restored_displaced["row"] <= reopened_footprint_bottom:
        assert reopened_displaced["row"] > local_restored_displaced["row"]
    else:
        assert grid_state_tuple(reopened_displaced) == grid_state_tuple(local_restored_displaced)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(420)
    expect(panel).to_have_class(re.compile("db-panel-collapsed"))
    collapsed_again_displaced = grid_item_state(page, '[data-widget-key="widget-1"]')
    collapsed_again_unrelated = grid_item_state(page, '[data-widget-key="widget-2"]')
    assert grid_state_tuple(collapsed_again_displaced) == grid_state_tuple(local_restored_displaced)
    assert grid_state_tuple(collapsed_again_unrelated) == grid_state_tuple(baseline_unrelated)

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")
    reloaded_displaced = grid_item_state(page, '[data-widget-key="widget-1"]')
    reloaded_unrelated = grid_item_state(page, '[data-widget-key="widget-2"]')
    assert grid_state_tuple(reloaded_displaced) == grid_state_tuple(local_restored_displaced)
    assert grid_state_tuple(reloaded_unrelated) == grid_state_tuple(baseline_unrelated)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_closing_moved_expanded_panel_preserves_displaced_panel_order(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const styles = getComputedStyle(grid);
          const rowHeight = parseFloat(styles.gridAutoRows) || 81;
          const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
          const panelHeight = (rows) => (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const placePanel = (node, col, row, span, rowSpan, collapsed) => {
            node.hidden = false;
            node.classList.remove("db-panel-pinned", "group-selected", "db-panel-tools-open");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(collapsed ? 1 : rowSpan);
            node.dataset.savedHeight = String(panelHeight(rowSpan));
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${collapsed ? 1 : rowSpan}`;
            node.classList.toggle("db-panel-collapsed", collapsed);
            node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", (!collapsed).toString());
            node.style.height = collapsed ? "" : `${panelHeight(rowSpan)}px`;
          };
          const placeWidget = (node, col, row) => {
            node.hidden = false;
            node.classList.remove("db-panel-pinned", "group-selected", "widget-tools-open");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = "1";
            node.dataset.defaultSpan = "1";
            node.dataset.gridRowSpan = "1";
            node.style.gridColumn = `${col} / span 1`;
            node.style.gridRow = `${row} / span 1`;
            node.style.height = "";
          };
          const moving = document.querySelector('[data-panel-key="builder-menu"]');
          const displaced = document.querySelector('[data-panel-key="builder-notes"]');
          const unrelated = document.querySelector('[data-panel-key="builder-content"]');
          placePanel(moving, 1, 1, 2, 5, true);
          placePanel(displaced, 1, 2, 2, 2, true);
          placePanel(unrelated, 4, 2, 2, 2, true);
          document.querySelectorAll(".panel-layout > .db-panel").forEach((node, index) => {
            if ([moving, displaced, unrelated].includes(node)) return;
            placePanel(node, 6, 18 + index, 1, 2, true);
          });
          document.querySelectorAll(".widget-layout > .widget-card").forEach((node, index) => {
            placeWidget(node, 6, 26 + index);
          });
          document.body.classList.remove("group-transform-active");
          window.scrollTo(0, 0);
        }
        """
    )

    moving = page.locator('[data-panel-key="builder-menu"]')
    displaced = page.locator('[data-panel-key="builder-notes"]')
    unrelated = page.locator('[data-panel-key="builder-content"]')
    baseline_displaced = grid_item_state(page, '[data-panel-key="builder-notes"]')
    baseline_unrelated = grid_item_state(page, '[data-panel-key="builder-content"]')
    assert baseline_displaced["row"] == 2

    moving.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(380)
    expanded_moving = grid_item_state(page, '[data-panel-key="builder-menu"]')
    expanded_displaced = grid_item_state(page, '[data-panel-key="builder-notes"]')
    assert expanded_moving["rowSpan"] >= 5
    assert expanded_displaced["row"] > baseline_displaced["row"]
    assert expanded_displaced["row"] > expanded_moving["row"] + expanded_moving["rowSpan"] - 1

    open_tools(moving)
    x, y = begin_drag(page, moving.locator(".panel-move-handle"), 0, 110, steps=12)
    end_drag(page, x, y, 0, 210, steps=18)
    page.wait_for_timeout(460)

    moved_open = grid_item_state(page, '[data-panel-key="builder-menu"]')
    moved_displaced = grid_item_state(page, '[data-panel-key="builder-notes"]')
    assert moved_open["row"] > expanded_moving["row"]
    assert moved_displaced["row"] > moved_open["row"] + moved_open["rowSpan"] - 1
    assert grid_state_tuple(grid_item_state(page, '[data-panel-key="builder-content"]')) == grid_state_tuple(baseline_unrelated)

    page.locator('[data-panel-key="builder-menu"] .db-panel-hd').click(position={"x": 18, "y": 18})
    page.wait_for_timeout(460)

    collapsed_moving = grid_item_state(page, '[data-panel-key="builder-menu"]')
    collapsed_displaced = grid_item_state(page, '[data-panel-key="builder-notes"]')
    collapsed_unrelated = grid_item_state(page, '[data-panel-key="builder-content"]')
    expect(moving).to_have_class(re.compile("db-panel-collapsed"))
    assert collapsed_displaced["col"] == baseline_displaced["col"]
    assert collapsed_displaced["row"] > collapsed_moving["row"]
    assert collapsed_displaced["row"] >= collapsed_moving["row"] + collapsed_moving["rowSpan"]
    assert collapsed_displaced["row"] <= moved_displaced["row"]
    assert grid_state_tuple(collapsed_unrelated) == grid_state_tuple(baseline_unrelated)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_panel_expand_temporarily_displaces_pinned_widget_then_restores_baseline(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const styles = getComputedStyle(grid);
          const rowHeight = parseFloat(styles.gridAutoRows) || 81;
          const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
          const panelHeight = (rows) => (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const placeItem = (node, col, row, span, rowSpan = 1) => {
            node.hidden = false;
            node.classList.remove("group-selected");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
          };
          const placePanel = (node, col, row, span, rowSpan, collapsed) => {
            placeItem(node, col, row, span, collapsed ? 1 : rowSpan);
            node.dataset.savedHeight = String(panelHeight(rowSpan));
            node.classList.toggle("db-panel-collapsed", collapsed);
            node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", (!collapsed).toString());
            node.style.height = collapsed ? "" : `${panelHeight(rowSpan)}px`;
          };
          const setPinned = (node, pinned) => {
            node.classList.toggle("db-panel-pinned", pinned);
            node.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", String(pinned));
          };
          const sourcePanel = document.querySelector('[data-panel-key="builder-content"]');
          const pinnedWidget = document.querySelector('[data-widget-key="widget-1"]');
          const pinnedPanel = document.querySelector('[data-panel-key="builder-menu"]');
          placePanel(sourcePanel, 1, 1, 2, 3, true);
          placeItem(pinnedWidget, 1, 2, 1, 1);
          setPinned(pinnedWidget, true);
          placePanel(pinnedPanel, 2, 2, 1, 2, true);
          setPinned(pinnedPanel, true);
          document.querySelectorAll(".widget-layout > .widget-card, .panel-layout > .db-panel").forEach((node, index) => {
            if ([sourcePanel, pinnedWidget, pinnedPanel].includes(node)) return;
            setPinned(node, false);
            if (node.classList.contains("db-panel")) {
              placePanel(node, 5, 14 + index, 1, 2, true);
            } else {
              placeItem(node, 6, 14 + index, 1, 1);
            }
          });
          document.body.classList.remove("group-transform-active");
          window.scrollTo(0, 0);
        }
        """
    )

    panel = page.locator('[data-panel-key="builder-content"]')
    pinned_widget = page.locator('[data-widget-key="widget-1"]')
    pinned_panel = page.locator('[data-panel-key="builder-menu"]')
    baseline_widget = grid_item_state(page, '[data-widget-key="widget-1"]')
    baseline_panel = grid_item_state(page, '[data-panel-key="builder-menu"]')
    expect(pinned_widget).to_have_class(re.compile("db-panel-pinned"))
    expect(pinned_panel).to_have_class(re.compile("db-panel-pinned"))

    open_tools(pinned_widget)
    drag_by(page, pinned_widget.locator(".panel-move-handle"), 160, 0, steps=8)
    page.wait_for_timeout(260)
    after_drag_attempt = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert grid_state_tuple(after_drag_attempt) == grid_state_tuple(baseline_widget)
    resize_box = pinned_widget.locator(".panel-resize-handle").bounding_box()
    assert resize_box
    rx, ry = box_center(resize_box)
    page.mouse.move(rx, ry)
    page.mouse.down()
    page.mouse.move(rx + 240, ry + 4, steps=8)
    page.mouse.up()
    page.wait_for_timeout(260)
    after_resize_attempt = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert grid_state_tuple(after_resize_attempt) == grid_state_tuple(baseline_widget)

    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(420)
    expanded_widget = grid_item_state(page, '[data-widget-key="widget-1"]')
    expanded_panel = grid_item_state(page, '[data-panel-key="builder-menu"]')
    assert expanded_widget["col"] == baseline_widget["col"]
    assert expanded_widget["row"] > baseline_widget["row"]
    assert expanded_panel["col"] == baseline_panel["col"]
    assert expanded_panel["row"] > baseline_panel["row"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    stored = page.evaluate(
        """
        () => ({
          widget: JSON.parse(localStorage.getItem("dashboard-widget-six-grid-layout:1:builder:widget-1")),
          panel: JSON.parse(localStorage.getItem("dashboard-panel-six-grid-layout:1:builder:builder-menu")),
        })
        """
    )
    assert stored["widget"]["gridRow"] == expanded_widget["row"]
    assert int(stored["widget"]["expansionBaseline"]["gridRow"]) == baseline_widget["row"]
    assert stored["panel"]["gridRow"] == expanded_panel["row"]
    assert int(stored["panel"]["expansionBaseline"]["gridRow"]) == baseline_panel["row"]

    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")
    panel = page.locator('[data-panel-key="builder-content"]')
    expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
    reloaded_widget = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert reloaded_widget["row"] == expanded_widget["row"]

    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(420)
    collapsed_widget = grid_item_state(page, '[data-widget-key="widget-1"]')
    collapsed_panel = grid_item_state(page, '[data-panel-key="builder-menu"]')
    assert grid_state_tuple(collapsed_widget) == grid_state_tuple(baseline_widget)
    assert grid_state_tuple(collapsed_panel) == grid_state_tuple(baseline_panel)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


@pytest.mark.parametrize("after_group_resize", [False, True])
def test_panel_collapse_restores_local_pushdown_after_group_resize(page: Page, app_server: str, after_group_resize: bool) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const layout = document.querySelector('.panel-layout[data-layout-key="builder"]');
          const menu = layout.querySelector('[data-panel-key="builder-menu"]');
          const notes = layout.querySelector('[data-panel-key="builder-notes"]');
          const table = layout.querySelector('[data-panel-key="builder-content"]');
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
              node.style.height = "";
            }
          };
          document.querySelectorAll(".widget-layout > .widget-card").forEach((node, index) => {
            node.dataset.gridCol = String(1 + (index % 6));
            node.dataset.gridRow = String(18 + index);
            node.dataset.currentSpan = "1";
            node.dataset.gridRowSpan = "1";
            node.style.gridColumn = `${1 + (index % 6)} / span 1`;
            node.style.gridRow = `${18 + index} / span 1`;
          });
          [menu, notes].forEach((node) => {
            node.classList.add("db-panel-collapsed");
            node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
            node.style.height = "";
          });
          table.classList.remove("db-panel-collapsed");
          table.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "true");
          place(menu, 1, 4, 2, 1, 275);
          place(notes, 1, 5, 2, 1, 275);
          place(table, 1, 6, 2, 3, 275);
          window.scrollTo(0, 0);
        }
        """
    )

    menu = page.locator('[data-panel-key="builder-menu"]')
    notes = page.locator('[data-panel-key="builder-notes"]')
    table = page.locator('[data-panel-key="builder-content"]')

    if after_group_resize:
        page.locator(".layout-group-button").click()
        menu.click(position={"x": 20, "y": 20})
        notes.click(position={"x": 20, "y": 20})
        table.click(position={"x": 20, "y": 20})
        expect(page.locator(".group-selected")).to_have_count(3)
        open_tools(table)
        handle_box = table.locator(".panel-resize-handle").bounding_box()
        assert handle_box
        x, y = box_center(handle_box)
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 220, y + 20, steps=14)
        page.mouse.up()
        page.wait_for_timeout(380)
        page.locator(".layout-group-button").click()
        expect(page.locator(".group-selected")).to_have_count(0)

    baseline = page.evaluate(
        """
        () => {
          const read = (key) => {
            const node = document.querySelector(`[data-panel-key="${key}"]`);
            return {
              col: Number(node.dataset.gridCol),
              row: Number(node.dataset.gridRow),
              span: Number(node.dataset.currentSpan),
              rowSpan: Number(node.dataset.gridRowSpan),
              collapsed: node.classList.contains("db-panel-collapsed"),
            };
          };
          return {
            menu: read("builder-menu"),
            notes: read("builder-notes"),
            table: read("builder-content"),
            widgets: [...document.querySelectorAll(".widget-layout > .widget-card")].map((node) => ({
              key: node.dataset.widgetKey,
              row: Number(node.dataset.gridRow),
              col: Number(node.dataset.gridCol),
            })),
          };
        }
        """
    )
    assert baseline["menu"]["collapsed"] is True
    assert baseline["notes"]["collapsed"] is True

    for cycle in range(2):
        menu.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        page.wait_for_timeout(260)
        notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        page.wait_for_timeout(320)
        expanded = {
            "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
            "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
            "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
        }
        assert expanded["table"]["row"] > baseline["table"]["row"]
        assert expanded["menu"]["row"] == baseline["menu"]["row"]
        assert expanded["notes"]["row"] >= baseline["notes"]["row"]

        menu.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        page.wait_for_timeout(260)
        notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        page.wait_for_timeout(360)
        collapsed = {
            "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
            "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
            "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
        }
        assert collapsed["menu"]["row"] == baseline["menu"]["row"], cycle
        assert collapsed["notes"]["row"] == baseline["notes"]["row"], cycle
        assert collapsed["table"]["row"] == baseline["table"]["row"], cycle
        assert collapsed["table"]["col"] == baseline["table"]["col"], cycle
        assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    widgets_after = page.evaluate(
        """
        () => [...document.querySelectorAll(".widget-layout > .widget-card")].map((node) => ({
          key: node.dataset.widgetKey,
          row: Number(node.dataset.gridRow),
          col: Number(node.dataset.gridCol),
        }))
        """
    )
    assert widgets_after == baseline["widgets"]

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")
    reloaded = {
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert reloaded["menu"]["row"] == baseline["menu"]["row"]
    assert reloaded["notes"]["row"] == baseline["notes"]["row"]
    assert reloaded["table"]["row"] == baseline["table"]["row"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_loaded_expanded_panels_restore_pushdown_on_collapse(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const layout = document.querySelector('.panel-layout[data-layout-key="builder"]');
          const menu = layout.querySelector('[data-panel-key="builder-menu"]');
          const notes = layout.querySelector('[data-panel-key="builder-notes"]');
          const content = layout.querySelector('[data-panel-key="builder-content"]');
          const unrelated = document.querySelector('.widget-layout > .widget-card:not(.range-bar)');
          const grid = document.querySelector(".dashboard-layout-grid");
          const styles = getComputedStyle(grid);
          const rowHeight = parseFloat(styles.gridAutoRows) || 81;
          const gap = parseFloat(styles.rowGap || styles.gap || "16") || 16;
          const panelHeight = (rows) => (rows * rowHeight) + (Math.max(0, rows - 1) * gap);
          const placePanel = (node, col, row, span, rowSpan, collapsed) => {
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(collapsed ? 1 : rowSpan);
            node.dataset.savedHeight = String(panelHeight(rowSpan));
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${collapsed ? 1 : rowSpan}`;
            node.classList.toggle("db-panel-collapsed", collapsed);
            node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", (!collapsed).toString());
            node.style.height = collapsed ? "" : `${panelHeight(rowSpan)}px`;
          };
          const placeWidget = (node, col, row, span) => {
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span 1`;
          };
          placePanel(menu, 1, 4, 3, 2, true);
          placePanel(notes, 1, 5, 3, 2, true);
          placePanel(content, 1, 6, 3, 2, false);
          placeWidget(unrelated, 5, 4, 1);
        }
        """
    )

    menu = page.locator('[data-panel-key="builder-menu"]')
    notes = page.locator('[data-panel-key="builder-notes"]')
    content = page.locator('[data-panel-key="builder-content"]')
    unrelated = page.locator(".widget-layout > .widget-card:not(.range-bar)").first
    baseline = {
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "content": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "unrelated": grid_item_state(page, ".widget-layout > .widget-card:not(.range-bar)"),
    }

    menu.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(320)
    notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(320)
    expanded_before_save = {
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "content": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "unrelated": grid_item_state(page, ".widget-layout > .widget-card:not(.range-bar)"),
    }
    assert expanded_before_save["content"]["row"] > baseline["content"]["row"]
    assert expanded_before_save["unrelated"]["row"] == baseline["unrelated"]["row"]

    page.locator(".layout-save-button").click()
    persisted_baseline = page.evaluate(
        """
        () => JSON.parse(localStorage.getItem("dashboard-panel-six-grid-layout:1:builder:builder-content")).expansionBaseline
        """
    )
    assert persisted_baseline["gridRow"] == str(baseline["content"]["row"])

    notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(320)
    menu.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(320)
    same_session_collapsed = {
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "content": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "unrelated": grid_item_state(page, ".widget-layout > .widget-card:not(.range-bar)"),
    }
    assert same_session_collapsed["menu"]["row"] == baseline["menu"]["row"]
    assert same_session_collapsed["notes"]["row"] == baseline["notes"]["row"]
    assert same_session_collapsed["content"]["row"] == baseline["content"]["row"]
    assert same_session_collapsed["unrelated"]["row"] == baseline["unrelated"]["row"]

    page.reload(wait_until="networkidle")
    menu = page.locator('[data-panel-key="builder-menu"]')
    notes = page.locator('[data-panel-key="builder-notes"]')
    expect(menu).not_to_have_class(re.compile("db-panel-collapsed"))
    expect(notes).not_to_have_class(re.compile("db-panel-collapsed"))
    loaded_expanded = {
        "content": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "unrelated": grid_item_state(page, ".widget-layout > .widget-card:not(.range-bar)"),
    }
    assert loaded_expanded["content"]["row"] == expanded_before_save["content"]["row"]
    assert loaded_expanded["unrelated"]["row"] == baseline["unrelated"]["row"]

    notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(320)
    menu.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(320)
    loaded_collapsed = {
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "content": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "unrelated": grid_item_state(page, ".widget-layout > .widget-card:not(.range-bar)"),
    }
    assert loaded_collapsed["menu"]["row"] == baseline["menu"]["row"]
    assert loaded_collapsed["notes"]["row"] == baseline["notes"]["row"]
    assert loaded_collapsed["content"]["row"] == baseline["content"]["row"]
    assert loaded_collapsed["unrelated"]["row"] == baseline["unrelated"]["row"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    page.locator(".layout-save-button").click()
    page.reload(wait_until="networkidle")
    expect(page.locator('[data-panel-key="builder-menu"]')).to_have_class(re.compile("db-panel-collapsed"))
    expect(page.locator('[data-panel-key="builder-notes"]')).to_have_class(re.compile("db-panel-collapsed"))
    assert grid_item_state(page, '[data-panel-key="builder-content"]')["row"] == baseline["content"]["row"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_panel_expand_collapse_does_not_shift_dashboard_when_scrollbar_changes(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1100, "height": 700})
    goto(page, app_server)

    setup = page.evaluate(
        """
        () => {
          const setGrid = (node, col, row, span, rowSpan = 1, height = null) => {
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
          const widgets = [...document.querySelectorAll(".widget-layout > .widget-card")];
          let nextWidgetCol = 1;
          let nextWidgetRow = 1;
          widgets.forEach((node, index) => {
            node.hidden = index > 1;
            if (node.hidden) return;
            const span = node.classList.contains("timeframe-widget")
              ? Math.max(Number(node.dataset.minW || 2), Number(node.dataset.defaultSpan || 5))
              : 1;
            if (nextWidgetCol + span - 1 > 6) {
              nextWidgetRow += 1;
              nextWidgetCol = 1;
            }
            setGrid(node, nextWidgetCol, nextWidgetRow, span);
            nextWidgetCol += span;
          });
          const notes = document.querySelector('[data-panel-key="builder-notes"]');
          const menu = document.querySelector('[data-panel-key="builder-menu"]');
          const table = document.querySelector('[data-panel-key="builder-content"]');
          [notes, menu, table].forEach((node) => {
            node.classList.add("db-panel-collapsed");
            node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
            node.style.height = "";
          });
          setGrid(notes, 1, 2, 2, 1, 760);
          setGrid(menu, 3, 2, 2, 1, 260);
          setGrid(table, 5, 2, 2, 1, 260);
          window.scrollTo(0, 0);
          const rootStyles = getComputedStyle(document.documentElement);
          return {
            scrollbarGutter: rootStyles.scrollbarGutter,
            initialOverflows: document.documentElement.scrollHeight > document.documentElement.clientHeight,
          };
        }
        """
    )
    assert "stable" in setup["scrollbarGutter"]
    assert setup["initialOverflows"] is False

    def horizontal_metrics() -> dict:
        return page.evaluate(
            """
            () => {
              const grid = document.querySelector(".dashboard-layout-grid");
              const page = document.querySelector(".page");
              const gridRect = grid.getBoundingClientRect();
              const pageRect = page.getBoundingClientRect();
          const root = document.documentElement;
          const rootStyles = getComputedStyle(root);
          const bodyStyles = getComputedStyle(document.body);
          const bodyScrollbarStyles = getComputedStyle(document.body, "::-webkit-scrollbar");
          const bodyTrackStyles = getComputedStyle(document.body, "::-webkit-scrollbar-track");
          const bodyCornerStyles = getComputedStyle(document.body, "::-webkit-scrollbar-corner");
          return {
            gridLeft: gridRect.left,
            gridWidth: gridRect.width,
            pageLeft: pageRect.left,
            pageWidth: pageRect.width,
            clientWidth: root.clientWidth,
            innerWidth: window.innerWidth,
            rootScrollWidth: root.scrollWidth,
            bodyClientWidth: document.body.clientWidth,
            bodyScrollWidth: document.body.scrollWidth,
            scrollHeight: root.scrollHeight,
            clientHeight: root.clientHeight,
            overflows: root.scrollHeight > root.clientHeight,
            rootBackground: rootStyles.backgroundImage || rootStyles.backgroundColor,
            bodyBackground: bodyStyles.backgroundImage || bodyStyles.backgroundColor,
            bodyScrollbarColor: bodyStyles.scrollbarColor,
            bodyScrollbarBackground: bodyScrollbarStyles.backgroundColor,
            bodyScrollbarTrack: bodyTrackStyles.backgroundColor,
            bodyScrollbarCorner: bodyCornerStyles.backgroundColor,
            bodyOverflowX: bodyStyles.overflowX,
          };
        }
        """
    )

    collapsed_before = horizontal_metrics()
    assert collapsed_before["rootScrollWidth"] <= collapsed_before["clientWidth"]
    assert collapsed_before["bodyScrollWidth"] <= collapsed_before["bodyClientWidth"]
    assert collapsed_before["bodyOverflowX"] == "clip"
    assert collapsed_before["rootBackground"] != "none"
    assert collapsed_before["rootBackground"] == collapsed_before["bodyBackground"]
    assert collapsed_before["bodyScrollbarBackground"] == "rgba(0, 0, 0, 0)"
    assert collapsed_before["bodyScrollbarTrack"] == "rgba(0, 0, 0, 0)"
    assert collapsed_before["bodyScrollbarCorner"] == "rgba(0, 0, 0, 0)"
    assert "rgba(0, 0, 0, 0)" in collapsed_before["bodyScrollbarColor"]
    notes = page.locator('.panel-layout > .db-panel[data-panel-key="builder-notes"]')
    expect(notes).to_have_class(re.compile("db-panel-collapsed"))

    notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(350)
    expanded = horizontal_metrics()
    assert expanded["overflows"] is True
    assert expanded["rootScrollWidth"] <= expanded["clientWidth"]
    assert expanded["bodyScrollWidth"] <= expanded["bodyClientWidth"]
    assert expanded["rootBackground"] == expanded["bodyBackground"]
    assert expanded["bodyScrollbarBackground"] == "rgba(0, 0, 0, 0)"
    assert expanded["bodyScrollbarTrack"] == "rgba(0, 0, 0, 0)"
    assert expanded["bodyScrollbarCorner"] == "rgba(0, 0, 0, 0)"
    assert abs(expanded["gridLeft"] - collapsed_before["gridLeft"]) <= 1
    assert abs(expanded["gridWidth"] - collapsed_before["gridWidth"]) <= 1
    assert abs(expanded["pageLeft"] - collapsed_before["pageLeft"]) <= 1
    assert abs(expanded["pageWidth"] - collapsed_before["pageWidth"]) <= 1

    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    page.wait_for_timeout(250)
    expanded_deep = horizontal_metrics()
    assert expanded_deep["overflows"] is True
    assert expanded_deep["rootScrollWidth"] <= expanded_deep["clientWidth"]
    assert expanded_deep["bodyScrollWidth"] <= expanded_deep["bodyClientWidth"]
    assert expanded_deep["rootBackground"] != "none"
    assert expanded_deep["rootBackground"] == expanded_deep["bodyBackground"]
    assert expanded_deep["bodyScrollbarBackground"] == "rgba(0, 0, 0, 0)"
    assert expanded_deep["bodyScrollbarTrack"] == "rgba(0, 0, 0, 0)"
    assert expanded_deep["bodyScrollbarCorner"] == "rgba(0, 0, 0, 0)"
    assert "rgba(0, 0, 0, 0)" in expanded_deep["bodyScrollbarColor"]
    assert abs(expanded_deep["gridLeft"] - collapsed_before["gridLeft"]) <= 1
    assert abs(expanded_deep["gridWidth"] - collapsed_before["gridWidth"]) <= 1
    assert abs(expanded_deep["pageLeft"] - collapsed_before["pageLeft"]) <= 1
    assert abs(expanded_deep["pageWidth"] - collapsed_before["pageWidth"]) <= 1

    notes.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    page.wait_for_timeout(350)
    collapsed_after = horizontal_metrics()
    assert collapsed_after["overflows"] is False
    assert collapsed_after["rootScrollWidth"] <= collapsed_after["clientWidth"]
    assert collapsed_after["bodyScrollWidth"] <= collapsed_after["bodyClientWidth"]
    assert collapsed_after["rootBackground"] == collapsed_after["bodyBackground"]
    assert collapsed_after["bodyScrollbarBackground"] == "rgba(0, 0, 0, 0)"
    assert collapsed_after["bodyScrollbarTrack"] == "rgba(0, 0, 0, 0)"
    assert collapsed_after["bodyScrollbarCorner"] == "rgba(0, 0, 0, 0)"
    assert abs(collapsed_after["gridLeft"] - collapsed_before["gridLeft"]) <= 1
    assert abs(collapsed_after["gridWidth"] - collapsed_before["gridWidth"]) <= 1
    assert abs(collapsed_after["pageLeft"] - collapsed_before["pageLeft"]) <= 1
    assert abs(collapsed_after["pageWidth"] - collapsed_before["pageWidth"]) <= 1
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_ordered_drag_reflows_widgets_without_overlap(page: Page, app_server: str) -> None:
    goto(page, app_server)
    before = visual_grid_items(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    moved_before = next(item for item in before if item["text"] == "0 Widget 3")
    assert moved_before["col"] >= 5

    dragged = page.locator('[data-widget-key="widget-3"]')
    open_tools(dragged)
    x, y = begin_drag(page, dragged.locator(".panel-move-handle"), -40, 8)
    expect(page.locator(".widget-placeholder")).to_have_count(1)
    end_drag(page, x, y, -390, 10)
    page.wait_for_timeout(350)

    after = visual_grid_items(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    moved = next(item for item in after if item["text"] == "0 Widget 3")
    assert moved["col"] < moved_before["col"]
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
    force_close_tools(panel)

    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    force_open_tools_for_interaction(page, widget)
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


def test_single_resize_control_infers_left_edge_resize_for_right_side_widget(page: Page, app_server: str) -> None:
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
    expect(widget.locator(".panel-resize-handle")).to_have_count(1)
    expect(widget.locator(".panel-resize-left-handle")).to_have_count(0)
    toolbar_buttons = widget.locator(".panel-tool-drawer .panel-tool-button").evaluate_all(
        """
        nodes => nodes.map((node) => node.getAttribute("aria-label"))
        """
    )
    assert toolbar_buttons.count("Resize panel") == 1
    assert "Resize panel from left" not in toolbar_buttons
    x = start_rect["x"] + 3
    y = start_rect["y"] + start_rect["height"] / 2
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


def test_widget_resize_lifecycle_repeats_cancels_and_persists(page: Page, app_server: str) -> None:
    goto(page, app_server)
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
          setGrid(widgets[0], 2, 1, 3);
          widgets.slice(1).forEach((node, index) => setGrid(node, 1 + ((index * 2) % 5), 4 + index, 1));
          document.querySelectorAll(".panel-layout > .db-panel").forEach((node, index) => {
            node.classList.remove("db-panel-collapsed");
            setGrid(node, 1, 10 + index * 4, Number(node.dataset.currentSpan || node.dataset.defaultSpan || 3), 3);
          });
        }
        """
    )
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    panel = page.locator('.panel-layout > .db-panel[data-panel-key="builder-content"]')
    start_span = int(widget.evaluate("node => node.dataset.currentSpan || node.dataset.defaultSpan"))
    seen_spans = {start_span}

    for delta in [260, -170, 220, -120]:
        open_tools(widget)
        drag_by(page, widget.locator(".panel-resize-handle"), delta, 0, steps=10)
        page.wait_for_timeout(260)
        assert_no_resize_artifacts(page)
        assert grid_alignment_error(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)") <= 3
        seen_spans.add(int(widget.evaluate("node => node.dataset.currentSpan || node.dataset.defaultSpan")))

    assert len(seen_spans) > 1

    open_tools(panel)
    drag_by(page, panel.locator(".panel-resize-handle"), 180, 90, steps=12)
    page.wait_for_timeout(300)
    assert_no_resize_artifacts(page)
    assert grid_alignment_error(page, '.panel-layout > .db-panel[data-panel-key="builder-content"]') <= 3
    force_close_tools(panel)

    widget.hover()
    force_open_tools_for_interaction(page, widget)
    drag_by(page, widget.locator(".panel-resize-handle"), 180, 0, steps=10)
    page.wait_for_timeout(260)
    assert_no_resize_artifacts(page)

    handle = widget.locator(".panel-resize-handle")
    handle.scroll_into_view_if_needed()
    handle_box = handle.bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 140, y, steps=5)
    expect(page.locator(".dashboard-live-resize")).to_have_count(1)
    expect(page.locator(".widget-placeholder.dashboard-resize-preview")).to_have_count(1)
    page.evaluate(
        """
        () => document.dispatchEvent(new PointerEvent("pointercancel", {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
        }))
        """
    )
    page.mouse.up()
    page.wait_for_timeout(260)
    assert_no_resize_artifacts(page)

    open_tools(widget)
    drag_by(page, widget.locator(".panel-resize-handle"), -150, 0, steps=10)
    page.wait_for_timeout(260)
    assert_no_resize_artifacts(page)
    persisted_span = int(widget.evaluate("node => node.dataset.currentSpan || node.dataset.defaultSpan"))
    page.locator(".layout-save-button").click()
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")
    reloaded_span = int(widget.evaluate("node => node.dataset.currentSpan || node.dataset.defaultSpan"))
    assert reloaded_span == persisted_span
    assert_no_resize_artifacts(page)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
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

    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    panel.screenshot(path=str(artifact_dir / "placeholder-deep-resized.png"))
    deep = body_alignment()

    for state in (light, deep):
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


def test_empty_panel_surface_is_translucent_without_affecting_populated_content(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = add_panel_for_setup(page)
    if panel.evaluate("node => node.classList.contains('db-panel-collapsed')"):
        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))

    def read_empty_material() -> dict:
        return panel.evaluate(
            """
            node => {
              const empty = node.querySelector(".db-panel-body > .panel-empty-state");
              const strong = empty.querySelector("strong");
              const helper = empty.querySelector("small");
              const action = empty.querySelector(".panel-empty-action");
              const populated = document.querySelector(".timeframe-widget .timeframe-command-surface");
              const styles = getComputedStyle(empty);
              const actionStyles = getComputedStyle(action);
              const alphaValues = (value) => {
                const values = [];
                const rgba = value.matchAll(/rgba\\([^)]*,\\s*([\\d.]+)\\)/g);
                for (const match of rgba) values.push(Number.parseFloat(match[1]));
                const colorMix = value.matchAll(/color-mix\\([^)]*\\s([\\d.]+)%/g);
                for (const match of colorMix) values.push(Number.parseFloat(match[1]) / 100);
                return values.filter(Number.isFinite);
              };
              return {
                background: styles.background,
                backgroundColor: styles.backgroundColor,
                backgroundImage: styles.backgroundImage,
                borderStyle: styles.borderTopStyle,
                borderColor: styles.borderTopColor,
                backdropFilter: styles.backdropFilter || styles.webkitBackdropFilter || "",
                textColor: getComputedStyle(strong).color,
                helperColor: getComputedStyle(helper).color,
                actionText: action.textContent.trim(),
                actionPointerEvents: actionStyles.pointerEvents,
                actionBackground: actionStyles.background,
                alphaValues: alphaValues(styles.background),
                populatedBackground: getComputedStyle(populated).background,
                populatedBackgroundColor: getComputedStyle(populated).backgroundColor,
              };
            }
            """
        )

    light = read_empty_material()
    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    deep = read_empty_material()

    for material in (light, deep):
        assert material["backgroundImage"] != "none"
        assert material["backgroundColor"] == "rgba(0, 0, 0, 0)"
        assert material["borderStyle"] == "dashed"
        assert material["borderColor"] != "rgb(255, 255, 255)"
        assert material["backdropFilter"] != "none"
        assert material["alphaValues"]
        assert max(material["alphaValues"]) <= .40
        assert material["textColor"] != "rgba(0, 0, 0, 0)"
        assert material["helperColor"] != "rgba(0, 0, 0, 0)"
        assert material["actionText"] == "Add widgets"
        assert material["actionPointerEvents"] == "none"
        assert material["actionBackground"] != "none"
        assert material["populatedBackground"] != material["background"]
        assert material["populatedBackgroundColor"] != "rgba(0, 0, 0, 0)"
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

    assert metrics["small"]["headerHeight"] == metrics["large"]["headerHeight"]
    assert metrics["small"]["bodyHeight"] >= 90
    assert metrics["small"]["emptyPadTop"] < metrics["large"]["emptyPadTop"]
    assert metrics["small"]["emptyPadBottom"] < metrics["large"]["emptyPadBottom"]
    assert metrics["small"]["emptyGap"] < metrics["large"]["emptyGap"]
    assert metrics["small"]["emptyStrongSize"] <= metrics["large"]["emptyStrongSize"]
    assert metrics["small"]["emptySmallLineHeight"] < metrics["large"]["emptySmallLineHeight"]
    assert metrics["small"]["emptyClipped"] is False
    assert metrics["small"]["bodyScrolls"] is False
    assert metrics["small"]["overflowY"] == "auto"

    content_metrics = page.locator('.panel-layout > .db-panel[data-panel-key="builder-content"]').evaluate(
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
            const empty = node.querySelector(".db-panel-body > .panel-empty-state");
            const action = empty.querySelector(".panel-empty-action");
            const emptyStyles = getComputedStyle(empty);
            const actionStyles = getComputedStyle(action);
            return {
              placeholderCount: node.querySelectorAll(".db-panel-body > .panel-empty-state").length,
              tableHeaderCount: node.querySelectorAll(".al-table th").length,
              emptyPadY: parseFloat(emptyStyles.paddingTop) + parseFloat(emptyStyles.paddingBottom),
              emptyGap: parseFloat(emptyStyles.gap),
              actionHeight: action.getBoundingClientRect().height,
              actionPointerEvents: actionStyles.pointerEvents,
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

    assert content_metrics["large"]["placeholderCount"] == 1
    assert content_metrics["small"]["placeholderCount"] == 1
    assert content_metrics["large"]["tableHeaderCount"] == 0
    assert content_metrics["small"]["tableHeaderCount"] == 0
    assert content_metrics["small"]["emptyPadY"] < content_metrics["large"]["emptyPadY"]
    assert content_metrics["small"]["emptyGap"] < content_metrics["large"]["emptyGap"]
    assert content_metrics["small"]["actionHeight"] <= content_metrics["large"]["actionHeight"]
    assert content_metrics["small"]["actionPointerEvents"] == "none"
    assert_clean_browser(page)


def test_edge_auto_scroll_supports_widget_drag_resize_and_upward_drag(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)

    widget = page.locator('[data-widget-key="widget-1"]')
    before_drag = grid_item_state(page, '[data-widget-key="widget-1"]')
    open_tools(widget)
    handle_box = widget.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, x, y, x_delta=96)
    page.wait_for_function("window.scrollY > 35")
    edge_scroll = dashboard_scroll_state(page)
    assert 35 < edge_scroll["scrollY"] < 480
    assert edge_scroll["extension"] == 1
    assert edge_scroll["extensionHeight"] >= 0
    assert page.locator(".widget-placeholder").count() >= 1
    page.mouse.move(240, 240, steps=10)
    page.wait_for_function('!document.body.classList.contains("dashboard-auto-scroll-active")')
    page.mouse.up()
    page.wait_for_timeout(360)
    after_drag = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert after_drag["row"] >= 1
    assert_no_auto_scroll_artifacts(page)

    prepare_edge_autoscroll_fixture(page)
    widget = page.locator('[data-widget-key="widget-1"]')
    open_tools(widget)
    before_resize = grid_item_state(page, '[data-widget-key="widget-1"]')
    resize_box = widget.locator(".panel-resize-handle").bounding_box()
    assert resize_box
    rx, ry = box_center(resize_box)
    page.mouse.move(rx, ry)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, rx, ry, x_delta=340)
    page.wait_for_function("window.scrollY > 35")
    page.mouse.up()
    page.wait_for_timeout(360)
    after_resize = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert after_resize["span"] > before_resize["span"]
    assert_no_resize_artifacts(page)
    assert_no_auto_scroll_artifacts(page)

    lower_widget = page.locator('[data-widget-key="widget-2"]')
    lower_widget.scroll_into_view_if_needed()
    page.wait_for_timeout(120)
    start_scroll = dashboard_scroll_state(page)["scrollY"]
    assert start_scroll > 80
    open_tools(lower_widget)
    top_handle_box = lower_widget.locator(".panel-move-handle").bounding_box()
    assert top_handle_box
    tx, ty = box_center(top_handle_box)
    page.mouse.move(tx, ty)
    page.mouse.down()
    move_pointer_to_top_edge(page, tx, ty, x_delta=36)
    page.wait_for_function(f"window.scrollY < {start_scroll - 35}")
    page.mouse.up()
    page.wait_for_timeout(260)
    assert_no_auto_scroll_artifacts(page)
    assert_clean_browser(page)


def test_edge_auto_scroll_upward_is_smooth_and_keeps_navbar_stable(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)

    lower_widget = page.locator('[data-widget-key="widget-2"]')
    lower_widget.scroll_into_view_if_needed()
    page.wait_for_timeout(160)
    start_scroll = dashboard_scroll_state(page)["scrollY"]
    assert start_scroll > 500
    nav_before = page.locator(".app-nav").evaluate("node => node.getBoundingClientRect().toJSON()")

    open_tools(lower_widget)
    handle_box = lower_widget.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_top_edge(page, x, y, x_delta=42, steps=18)
    page.wait_for_function(
        f"""
        () => window.scrollY < {start_scroll - 45} &&
          document.body.classList.contains("dashboard-auto-scroll-active") &&
          document.querySelector(".widget-placeholder")
        """
    )
    motion = sample_auto_scroll_motion(page)
    assert_smooth_upward_auto_scroll_motion(motion)
    nav_during = page.locator(".app-nav").evaluate("node => node.getBoundingClientRect().toJSON()")
    assert abs(nav_during["x"] - nav_before["x"]) <= 1
    assert abs(nav_during["y"] - nav_before["y"]) <= 1
    assert abs(nav_during["height"] - nav_before["height"]) <= 1
    assert dashboard_scroll_state(page)["rootHorizontalOverflow"] is False
    assert dashboard_scroll_state(page)["bodyHorizontalOverflow"] is False

    page.wait_for_function(
        """
        () => window.scrollY <= 12 &&
          Number(document.querySelector(".widget-placeholder")?.dataset.gridRow || 0) === 1
        """,
        timeout=12000,
    )
    page.mouse.up()
    page.wait_for_timeout(420)
    after = grid_item_state(page, '[data-widget-key="widget-2"]')
    assert after["row"] == 1
    assert_no_auto_scroll_artifacts(page)
    assert_clean_browser(page)


def test_edge_auto_scroll_supports_group_drag_upward(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)

    page.locator(".layout-group-button").click()
    widget = page.locator('[data-widget-key="widget-2"]')
    panel = page.locator('[data-panel-key="builder-notes"]')
    widget.scroll_into_view_if_needed()
    page.wait_for_timeout(160)
    start_scroll = dashboard_scroll_state(page)["scrollY"]
    assert start_scroll > 500
    widget.click(position={"x": 18, "y": 18}, force=True)
    panel.click(position={"x": 18, "y": 18}, force=True)
    expect(page.locator(".group-selected")).to_have_count(2)

    before = {
        "widget": grid_item_state(page, '[data-widget-key="widget-2"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-notes"]'),
    }
    open_tools(widget)
    handle_box = widget.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_top_edge(page, x, y, x_delta=42, steps=18)
    page.wait_for_function(
        f"""
        () => window.scrollY < {start_scroll - 45} &&
          document.body.classList.contains("dashboard-auto-scroll-active") &&
          document.querySelector(".dashboard-group-footprint")
        """
    )
    motion = sample_auto_scroll_motion(page)
    assert_smooth_upward_auto_scroll_motion(motion)
    page.wait_for_function(
        """
        () => window.scrollY <= 12 &&
          Number(document.querySelector(".dashboard-group-footprint")?.dataset.gridRow || 0) === 1
        """,
        timeout=12000,
    )
    page.mouse.up()
    page.wait_for_timeout(420)
    after = {
        "widget": grid_item_state(page, '[data-widget-key="widget-2"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-notes"]'),
    }
    assert after["widget"]["row"] == 1
    assert after["panel"]["row"] - after["widget"]["row"] == before["panel"]["row"] - before["widget"]["row"]
    assert_no_auto_scroll_artifacts(page)
    expect(page.locator(".dashboard-group-live-shell")).to_have_count(0)
    expect(page.locator(".dashboard-group-footprint")).to_have_count(0)
    assert_clean_browser(page)


def test_edge_auto_scroll_extends_temporary_workspace_for_deep_drag(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)

    lower_widget = page.locator('[data-widget-key="widget-2"]')
    lower_widget.scroll_into_view_if_needed()
    page.wait_for_timeout(120)
    before = grid_item_state(page, '[data-widget-key="widget-2"]')
    open_tools(lower_widget)
    handle_box = lower_widget.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, x, y, x_delta=80)
    page.wait_for_function(
        """
        () => {
          const placeholder = document.querySelector(".widget-placeholder");
          return window.scrollY > 120 &&
            document.body.classList.contains("dashboard-interaction-scroll-extended") &&
            placeholder &&
            Number(placeholder.dataset.gridRow || 0) >= 23;
        }
        """
    )
    motion = sample_auto_scroll_motion(page)
    assert_smooth_auto_scroll_motion(motion)
    during = dashboard_scroll_state(page)
    assert during["extension"] == 1
    assert 0 < during["extensionHeight"] < 1800
    preview_row = int(page.locator(".widget-placeholder").evaluate("node => node.dataset.gridRow"))
    assert preview_row >= 23
    page.mouse.up()
    page.wait_for_timeout(420)
    after = grid_item_state(page, '[data-widget-key="widget-2"]')
    assert after["row"] >= preview_row - 1
    assert after["row"] > before["row"]
    assert_no_auto_scroll_artifacts(page)
    assert_clean_browser(page)


def test_edge_auto_scroll_drop_commits_newly_revealed_lower_rows(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)

    original_bottom = max(
        item["row"] + item["rowSpan"] - 1
        for item in grid_item_states(
            page,
            ".dashboard-layout-grid .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])",
        )
    )
    widget = page.locator('[data-widget-key="widget-1"]')
    before = grid_item_state(page, '[data-widget-key="widget-1"]')
    open_tools(widget)
    handle_box = widget.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, x, y, x_delta=72)
    page.wait_for_function(
        """
        ([bottom]) => {
          const placeholder = document.querySelector(".widget-placeholder");
          return window.scrollY > 180 &&
            document.body.classList.contains("dashboard-interaction-scroll-extended") &&
            placeholder &&
            Number(placeholder.dataset.gridRow || 0) >= bottom + 8;
        }
        """,
        arg=[original_bottom],
    )
    viewport = page.viewport_size or {"height": 560}
    page.mouse.move(x + 72, viewport["height"] - 140, steps=4)
    page.wait_for_function(
        """
        ([bottom]) => {
          const placeholder = document.querySelector(".widget-placeholder");
          return !document.body.classList.contains("dashboard-auto-scroll-active") &&
            placeholder &&
            Number(placeholder.dataset.gridRow || 0) >= bottom + 5;
        }
        """,
        arg=[original_bottom],
    )
    preview = page.locator(".widget-placeholder").evaluate(
        """
        node => ({
          col: Number(node.dataset.gridCol || 0),
          row: Number(node.dataset.gridRow || 0),
        })
        """
    )
    assert preview["row"] >= original_bottom + 5
    drop_scroll_y = dashboard_scroll_state(page)["scrollY"]
    page.mouse.up()
    page.wait_for_timeout(420)

    after = grid_item_state(page, '[data-widget-key="widget-1"]')
    after_scroll_y = dashboard_scroll_state(page)["scrollY"]
    assert after["row"] == preview["row"]
    assert after["col"] == preview["col"]
    assert after["row"] > before["row"]
    assert after["row"] > original_bottom
    assert after_scroll_y >= drop_scroll_y - 80
    scroll_state = dashboard_scroll_state(page)
    assert scroll_state["rootHorizontalOverflow"] is False
    assert scroll_state["bodyHorizontalOverflow"] is False
    assert_no_auto_scroll_artifacts(page)

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    reloaded = grid_item_state(page, '[data-widget-key="widget-1"]')
    assert reloaded["row"] == preview["row"]
    assert reloaded["col"] == preview["col"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_edge_auto_scroll_commits_minimum_size_widget_to_lower_workspace(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)

    page.evaluate(
        """
        () => {
          const widget = document.querySelector(".timeframe-widget");
          widget.dataset.currentSpan = widget.dataset.minW || "2";
          widget.dataset.defaultSpan = widget.dataset.defaultSpan || "5";
          widget.dataset.gridCol = "1";
          widget.dataset.gridRow = "1";
          widget.dataset.gridRowSpan = "1";
          widget.style.gridColumn = "1 / span 2";
          widget.style.gridRow = "1 / span 1";
          window.scrollTo(0, 0);
        }
        """
    )
    original_bottom = max(
        item["row"] + item["rowSpan"] - 1
        for item in grid_item_states(
            page,
            ".dashboard-layout-grid .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])",
        )
    )
    control = page.locator(".timeframe-widget")
    before = grid_item_state(page, ".timeframe-widget")
    assert before["span"] == 2
    open_tools(control)
    handle_box = control.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, x, y, x_delta=80)
    page.wait_for_function(
        """
        ([bottom]) => {
          const placeholder = document.querySelector(".widget-placeholder");
          return window.scrollY > 90 &&
            document.body.classList.contains("dashboard-interaction-scroll-extended") &&
            placeholder &&
            Number(placeholder.dataset.currentSpan || placeholder.dataset.defaultSpan || 0) === 2 &&
            Number(placeholder.dataset.gridRow || 0) >= bottom + 10;
        }
        """,
        arg=[original_bottom],
    )
    page.wait_for_function('document.body.classList.contains("dashboard-auto-scroll-active")')
    preview = page.locator(".widget-placeholder").evaluate(
        """
        node => ({
          col: Number(node.dataset.gridCol || 0),
          row: Number(node.dataset.gridRow || 0),
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 0),
        })
        """
    )
    assert preview["row"] >= original_bottom + 10
    drop_scroll_y = dashboard_scroll_state(page)["scrollY"]
    page.mouse.up()
    page.wait_for_timeout(420)

    after = grid_item_state(page, ".timeframe-widget")
    after_scroll_y = dashboard_scroll_state(page)["scrollY"]
    assert after["span"] == preview["span"] == 2
    assert after["col"] == preview["col"]
    assert after["row"] >= preview["row"]
    assert after["row"] <= preview["row"] + 1
    assert after["row"] > before["row"]
    assert after["row"] > original_bottom
    assert after_scroll_y >= drop_scroll_y - 80
    assert_no_auto_scroll_artifacts(page)
    assert dashboard_scroll_state(page)["rootHorizontalOverflow"] is False
    assert dashboard_scroll_state(page)["bodyHorizontalOverflow"] is False

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    reloaded = grid_item_state(page, ".timeframe-widget")
    assert reloaded["span"] == 2
    assert reloaded["col"] == after["col"]
    assert reloaded["row"] == after["row"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_edge_auto_scroll_widget_far_down_commits_preview_across_depths(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)
    original_bottom = max(
        item["row"] + item["rowSpan"] - 1
        for item in grid_item_states(
            page,
            ".dashboard-layout-grid .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])",
        )
    )

    for offset in (6, 34, 82):
        prepare_edge_autoscroll_fixture(page)
        result = drag_to_auto_expanded_row(
            page,
            '[data-widget-key="widget-1"]',
            ".widget-placeholder",
            original_bottom + offset,
            x_delta=76,
        )
        before = result["before"]
        preview = result["preview"]
        after = result["after"]
        assert preview["row"] >= original_bottom + offset
        assert after["row"] == preview["row"]
        assert after["col"] == preview["col"]
        assert after["row"] != before["row"]
        assert after["row"] > original_bottom
        assert result["afterScrollY"] >= result["dropScrollY"] - 80
        assert_no_auto_scroll_artifacts(page)
        assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    assert_clean_browser(page)


def test_edge_auto_scroll_widget_and_panel_share_far_down_bounds(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)
    original_bottom = max(
        item["row"] + item["rowSpan"] - 1
        for item in grid_item_states(
            page,
            ".dashboard-layout-grid .widget-card:not([hidden]), .panel-layout > .db-panel:not([hidden])",
        )
    )
    target_row = original_bottom + 28

    page.evaluate(
        """
        () => {
          const widget = document.querySelector(".timeframe-widget");
          widget.dataset.currentSpan = widget.dataset.minW || "2";
          widget.dataset.defaultSpan = widget.dataset.defaultSpan || "5";
          widget.dataset.gridCol = "1";
          widget.dataset.gridRow = "1";
          widget.dataset.gridRowSpan = "1";
          widget.style.gridColumn = "1 / span 2";
          widget.style.gridRow = "1 / span 1";
          window.scrollTo(0, 0);
        }
        """
    )
    minimum_widget_result = drag_to_auto_expanded_row(
        page,
        ".timeframe-widget",
        ".widget-placeholder",
        target_row,
        x_delta=80,
    )
    assert minimum_widget_result["preview"]["span"] == minimum_widget_result["after"]["span"] == 2
    assert minimum_widget_result["after"]["row"] == minimum_widget_result["preview"]["row"]
    assert minimum_widget_result["after"]["col"] == minimum_widget_result["preview"]["col"]
    assert minimum_widget_result["after"]["row"] >= target_row
    assert minimum_widget_result["after"]["row"] > minimum_widget_result["before"]["row"]
    assert_no_auto_scroll_artifacts(page)

    prepare_edge_autoscroll_fixture(page)
    widget_result = drag_to_auto_expanded_row(
        page,
        '[data-widget-key="builder-search"]',
        ".widget-placeholder",
        target_row,
        x_delta=120,
    )
    assert widget_result["preview"]["span"] == widget_result["after"]["span"] == 4
    assert widget_result["after"]["row"] == widget_result["preview"]["row"]
    assert widget_result["after"]["col"] == widget_result["preview"]["col"]
    assert widget_result["after"]["row"] >= target_row
    assert widget_result["after"]["row"] > widget_result["before"]["row"]
    assert_no_auto_scroll_artifacts(page)

    prepare_edge_autoscroll_fixture(page)
    panel_result = drag_to_auto_expanded_row(
        page,
        '[data-panel-key="builder-content"]',
        ".db-panel-placeholder",
        target_row,
        x_delta=120,
    )
    assert panel_result["after"]["row"] == panel_result["preview"]["row"]
    assert panel_result["after"]["col"] == panel_result["preview"]["col"]
    assert panel_result["after"]["rowSpan"] == panel_result["preview"]["rowSpan"]
    assert panel_result["after"]["row"] >= target_row
    assert panel_result["after"]["row"] > panel_result["before"]["row"]
    assert_no_auto_scroll_artifacts(page)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_edge_auto_scroll_supports_panel_drag_cleanup(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)

    panel = page.locator('[data-panel-key="builder-content"]')
    before = grid_item_state(page, '[data-panel-key="builder-content"]')
    open_tools(panel)
    handle_box = panel.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, x, y, x_delta=96)
    page.wait_for_function(
        """
        () => window.scrollY > 60 &&
          document.body.classList.contains("dashboard-interaction-scroll-extended") &&
          document.querySelector(".db-panel-placeholder")
        """
    )
    during = dashboard_scroll_state(page)
    assert during["extension"] == 1
    assert during["rootHorizontalOverflow"] is False
    assert during["bodyHorizontalOverflow"] is False
    page.mouse.up()
    page.wait_for_timeout(420)
    after = grid_item_state(page, '[data-panel-key="builder-content"]')
    assert after["row"] > before["row"]
    assert_no_auto_scroll_artifacts(page)
    assert_clean_browser(page)


def test_edge_auto_scroll_supports_panel_resize(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)

    panel = page.locator('[data-panel-key="builder-content"]')
    before = grid_item_state(page, '[data-panel-key="builder-content"]')
    open_tools(panel)
    handle_box = panel.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, x, y, x_delta=180)
    page.wait_for_function("window.scrollY > 35")
    assert page.locator(".dashboard-live-resize").count() == 1
    assert page.locator(".dashboard-resize-preview").count() >= 1
    motion = sample_auto_scroll_motion(page)
    assert_smooth_auto_scroll_motion(motion)
    page.mouse.up()
    page.wait_for_timeout(360)
    after = grid_item_state(page, '[data-panel-key="builder-content"]')
    assert after["rowSpan"] > before["rowSpan"]
    assert_no_resize_artifacts(page)
    assert_no_auto_scroll_artifacts(page)
    assert_clean_browser(page)


def test_edge_auto_scroll_supports_group_drag_and_resize(page: Page, app_server: str) -> None:
    page.set_viewport_size({"width": 1280, "height": 560})
    goto(page, app_server)
    prepare_edge_autoscroll_fixture(page)

    page.locator(".layout-group-button").click()
    widget = page.locator('[data-widget-key="widget-1"]')
    panel = page.locator('[data-panel-key="builder-content"]')
    widget.click(position={"x": 18, "y": 18})
    panel.click(position={"x": 18, "y": 18})
    expect(page.locator(".group-selected")).to_have_count(2)
    before_drag = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    open_tools(widget)
    handle_box = widget.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, x, y, x_delta=90)
    page.wait_for_function("window.scrollY > 35")
    expect(page.locator(".dashboard-group-live-shell")).to_have_count(1)
    expect(page.locator(".dashboard-group-footprint")).to_have_count(1)
    motion = sample_auto_scroll_motion(page)
    assert_smooth_auto_scroll_motion(motion)
    page.mouse.up()
    page.wait_for_timeout(420)
    after_drag = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert after_drag["widget"]["row"] > before_drag["widget"]["row"]
    assert after_drag["panel"]["row"] > before_drag["panel"]["row"]
    expect(page.locator(".dashboard-group-live-shell")).to_have_count(0)
    expect(page.locator(".dashboard-group-footprint")).to_have_count(0)
    assert_no_auto_scroll_artifacts(page)
    page.locator(".layout-group-button").click()
    expect(page.locator(".layout-group-button")).to_have_attribute("aria-pressed", "false")

    prepare_edge_autoscroll_fixture(page)
    page.locator(".layout-group-button").click()
    panel = page.locator('[data-panel-key="builder-content"]')
    menu = page.locator('[data-panel-key="builder-menu"]')
    panel.click(position={"x": 18, "y": 18})
    menu.click(position={"x": 18, "y": 18})
    expect(page.locator(".group-selected")).to_have_count(2)
    before_resize = grid_item_state(page, '[data-panel-key="builder-content"]')
    panel.locator(".panel-settings-toggle").hover()
    expect(panel.locator(".panel-tool-drawer")).to_be_visible()
    resize_box = panel.locator(".panel-resize-handle").bounding_box()
    assert resize_box
    rx, ry = box_center(resize_box)
    page.mouse.move(rx, ry)
    page.mouse.down()
    move_pointer_to_bottom_edge(page, rx, ry, x_delta=220)
    page.wait_for_function("window.scrollY > 35")
    expect(page.locator(".dashboard-group-resize-footprint")).to_have_count(1)
    expect(page.locator(".dashboard-group-resize-boundary")).to_have_count(1)
    page.mouse.up()
    page.wait_for_timeout(420)
    after_resize = grid_item_state(page, '[data-panel-key="builder-content"]')
    assert after_resize["rowSpan"] > before_resize["rowSpan"]
    expect(page.locator(".dashboard-group-resize-footprint")).to_have_count(0)
    expect(page.locator(".dashboard-group-resize-boundary")).to_have_count(0)
    assert_no_resize_artifacts(page)
    assert_no_auto_scroll_artifacts(page)
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


def test_collision_prefers_below_then_left_before_forward_for_widgets_and_panels(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          localStorage.clear();
        }
        """
    )
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")
    page.evaluate("window.scrollTo(0, 0)")
    page.mouse.move(24, 24)

    def ensure_item_count(selector: str, count: int, add_item) -> None:
        while page.locator(selector).count() < count:
            add_item(page)

    def park_all(selector: str, start_row: int) -> None:
        page.locator(selector).evaluate_all(
            """
            (nodes, startRow) => nodes.forEach((node, index) => {
              const col = (index % 6) + 1;
              const row = startRow + Math.floor(index / 6);
              node.dataset.currentSpan = "1";
              node.dataset.defaultSpan = "1";
              node.dataset.gridCol = String(col);
              node.dataset.gridRow = String(row);
              node.dataset.gridRowSpan = "1";
              node.style.gridColumn = `${col} / span 1`;
              node.style.gridRow = `${row} / span 1`;
              node.style.height = "";
              node.style.left = "";
              node.style.top = "";
              node.style.width = "";
              node.classList.remove("db-panel-pinned", "widget-tools-open", "db-panel-tools-open", "widget-dragging", "db-panel-dragging", "dashboard-active-resize", "dashboard-live-resize", "dashboard-resize-source");
              if (node.classList.contains("db-panel")) {
                node.classList.add("db-panel-collapsed");
                node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
              }
            })
            """,
            start_row,
        )

    def arrange_case(selector: str, key_attr: str, positions: list[tuple[int, int]], park_start_row: int) -> list[str]:
        keys = page.locator(selector).evaluate_all(
            """
            (nodes, payload) => nodes.map((node, index) => {
              const position = payload.positions[index] ||
                { col: (index % 6) + 1, row: payload.parkStartRow + Math.floor(index / 6) };
              const key = node.dataset[payload.keyAttr] || `${payload.keyAttr}-${index}`;
              node.dataset.currentSpan = "1";
              node.dataset.defaultSpan = "1";
              node.dataset.gridCol = String(position.col);
              node.dataset.gridRow = String(position.row);
              node.dataset.gridRowSpan = "1";
              node.style.gridColumn = `${position.col} / span 1`;
              node.style.gridRow = `${position.row} / span 1`;
              node.style.height = "";
              node.style.left = "";
              node.style.top = "";
              node.style.width = "";
              node.classList.remove("db-panel-pinned", "widget-tools-open", "db-panel-tools-open", "widget-dragging", "db-panel-dragging", "dashboard-active-resize", "dashboard-live-resize", "dashboard-resize-source");
              if (node.classList.contains("db-panel")) {
                node.classList.add("db-panel-collapsed");
                node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
              }
              return key;
            })
            """,
            {
                "positions": [{"col": col, "row": row} for col, row in positions],
                "parkStartRow": park_start_row,
                "keyAttr": key_attr,
            },
        )
        assert len(keys) >= len(positions)
        return keys

    ensure_item_count(".widget-layout > .widget-card:not(.range-bar)", 4, add_widget_for_setup)
    ensure_item_count(".panel-layout > .db-panel", 4, add_panel_for_setup)

    def run_collision_case(
        *,
        selector: str,
        key_attr: str,
        data_attr: str,
        placeholder_selector: str,
        positions: list[tuple[int, int]],
        target_index: int,
        expected_displaced: tuple[int, int],
        blocker_index: int,
        park_row: int,
    ) -> None:
        page.evaluate(
            """
            () => {
              window.scrollTo(0, 0);
              document.body.classList.remove("panel-interaction-active", "panel-resize-active", "group-transform-active");
            }
            """
        )
        park_all(".widget-layout > .widget-card", 12)
        park_all(".panel-layout > .db-panel", 18)
        keys = arrange_case(selector, key_attr, positions, park_row)
        active_selector = f'[{data_attr}="{keys[0]}"]'
        displaced_selector = f'[{data_attr}="{keys[1]}"]'
        blocker_selector = f'[{data_attr}="{keys[blocker_index]}"]'
        unrelated_selector = f'[{data_attr}="{keys[-1]}"]'
        active = page.locator(active_selector)
        displaced = page.locator(displaced_selector)
        blocker_before = grid_item_state(page, blocker_selector)
        unrelated_before = page.locator(unrelated_selector).evaluate(
            "node => ({ col: Number(node.dataset.gridCol), row: Number(node.dataset.gridRow) })"
        )

        force_open_tools_for_interaction(page, active)
        active.evaluate(
            """
            node => {
              const isWidget = node.classList.contains("widget-card");
              node.classList.add(isWidget ? "widget-tools-open" : "db-panel-tools-open");
              node.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "true");
              document.body.classList.remove("panel-interaction-active", "panel-resize-active", "group-transform-active");
              document.body.classList.add("layout-tools-active");
            }
            """
        )
        handle = active.locator(".panel-move-handle").bounding_box()
        active_box = active.bounding_box()
        target_box = page.locator(f'[{data_attr}="{keys[target_index]}"]').bounding_box()
        assert handle and active_box and target_box
        dx = (target_box["x"] + target_box["width"] / 2) - (active_box["x"] + active_box["width"] / 2)
        dy = (target_box["y"] + target_box["height"] / 2) - (active_box["y"] + active_box["height"] / 2)
        x, y = box_center(handle)
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + dx, y + dy, steps=14)
        drag_debug = page.evaluate(
            """
            ({ activeSelector, placeholderSelector }) => {
              const active = document.querySelector(activeSelector);
              return {
                body: document.body.className,
                activeClass: active?.className || "",
                placeholder: Boolean(document.querySelector(placeholderSelector)),
                activePointer: active ? getComputedStyle(active).pointerEvents : "",
              };
            }
            """,
            {"activeSelector": active_selector, "placeholderSelector": placeholder_selector},
        )
        assert drag_debug["placeholder"], drag_debug
        preview_displaced = grid_item_state(page, displaced_selector)
        assert (preview_displaced["col"], preview_displaced["row"]) == expected_displaced
        preview_blocker = grid_item_state(page, blocker_selector)
        assert (preview_blocker["col"], preview_blocker["row"]) == (blocker_before["col"], blocker_before["row"])

        page.mouse.up()
        page.wait_for_timeout(360)
        committed_active = grid_item_state(page, active_selector)
        committed_displaced = grid_item_state(page, displaced_selector)
        committed_unrelated = page.locator(unrelated_selector).evaluate(
            "node => ({ col: Number(node.dataset.gridCol), row: Number(node.dataset.gridRow) })"
        )
        expected_active = positions[target_index]
        assert (committed_active["col"], committed_active["row"]) == expected_active
        assert (committed_displaced["col"], committed_displaced["row"]) == expected_displaced
        assert (preview_displaced["col"], preview_displaced["row"]) == (committed_displaced["col"], committed_displaced["row"])
        assert committed_unrelated == unrelated_before

    object_configs = [
        {
            "selector": ".widget-layout > .widget-card:not(.range-bar)",
            "key_attr": "widgetKey",
            "data_attr": "data-widget-key",
            "placeholder_selector": ".widget-placeholder",
            "park_row": 24,
        },
        {
            "selector": ".panel-layout > .db-panel",
            "key_attr": "panelKey",
            "data_attr": "data-panel-key",
            "placeholder_selector": ".db-panel-placeholder",
            "park_row": 30,
        },
    ]

    cases = [
        {
            "positions": [(1, 3), (2, 3), (3, 3), (6, 7)],
            "target_index": 1,
            "expected_displaced": (2, 4),
            "blocker_index": 2,
        },
        {
            "positions": [(1, 3), (2, 3), (2, 4), (6, 7)],
            "target_index": 1,
            "expected_displaced": (1, 3),
            "blocker_index": 2,
        },
        {
            "positions": [(2, 3), (1, 3), (1, 4), (6, 7)],
            "target_index": 1,
            "expected_displaced": (2, 3),
            "blocker_index": 2,
        },
    ]

    for config in object_configs:
        for case in cases:
            run_collision_case(**config, **case)

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
    handle = dragged.locator(".panel-move-handle")
    handle.hover()
    page.wait_for_timeout(120)
    handle_box = handle.bounding_box()
    top_box = top_item.bounding_box()
    assert handle_box
    assert top_box
    start_x, start_y = box_center(handle_box)
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.wait_for_timeout(80)
    page.mouse.move(start_x + 42, start_y + 8, steps=6)
    page.mouse.move(top_box["x"] + 28, top_box["y"] + 28, steps=14)
    page.mouse.up()
    page.wait_for_timeout(420)

    dragged_state = grid_item_state(page, ".widget-layout > .stat-card.widget-card:not(.range-bar)")
    top_after = grid_item_state(page, ".timeframe-widget")
    all_rows = [item["row"] for item in grid_item_states(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel")]
    assert dragged_state["row"] == 1
    assert top_after["row"] <= 2
    assert top_after["row"] < max(all_rows)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_dragging_over_items_does_not_open_underlying_menus(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator('.widget-layout:not([hidden]) > [data-widget-key="widget-1"]')
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


def test_widget_move_preview_cleanup_handles_click_escape_and_lost_capture(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator('.widget-layout:not([hidden]) > [data-widget-key="widget-1"]')
    open_tools(widget)
    handle = widget.locator(".panel-move-handle")

    def assert_move_preview_cleared() -> None:
        state = page.evaluate(
            """
            () => ({
              bodyDragging: document.body.classList.contains("panel-interaction-active"),
              autoScrollActive: document.body.classList.contains("dashboard-auto-scroll-active"),
              draggingItems: document.querySelectorAll(".widget-dragging, .db-panel-dragging").length,
              placeholders: document.querySelectorAll(".widget-placeholder, .db-panel-placeholder").length,
              expandedGhosts: document.querySelectorAll(".dashboard-expanded-footprint-ghost").length,
              groupLive: document.querySelectorAll(".dashboard-group-live-shell, .dashboard-group-live-member").length,
            })
            """
        )
        assert state == {
            "bodyDragging": False,
            "autoScrollActive": False,
            "draggingItems": 0,
            "placeholders": 0,
            "expandedGhosts": 0,
            "groupLive": 0,
        }

    handle_box = handle.bounding_box()
    assert handle_box
    start_x, start_y = box_center(handle_box)

    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.up()
    page.wait_for_timeout(80)
    assert_move_preview_cleared()

    open_tools(widget)
    handle_box = handle.bounding_box()
    assert handle_box
    start_x, start_y = box_center(handle_box)
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + 82, start_y + 18, steps=8)
    expect(page.locator(".widget-dragging")).to_have_count(1)
    expect(page.locator(".widget-placeholder")).to_have_count(1)
    page.keyboard.press("Escape")
    page.wait_for_timeout(120)
    assert_move_preview_cleared()

    open_tools(widget)
    handle_box = handle.bounding_box()
    assert handle_box
    start_x, start_y = box_center(handle_box)
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + 86, start_y + 20, steps=8)
    expect(page.locator(".widget-dragging")).to_have_count(1)
    expect(page.locator(".widget-placeholder")).to_have_count(1)
    handle.evaluate(
        """
        node => node.dispatchEvent(new PointerEvent("lostpointercapture", {
          pointerId: 1,
          bubbles: false,
          cancelable: false,
          pointerType: "mouse",
        }))
        """
    )
    page.wait_for_timeout(120)
    assert_move_preview_cleared()
    page.mouse.up()

    assert_clean_browser(page)


def test_open_settings_menu_hides_during_drag_and_resize_then_restores(page: Page, app_server: str) -> None:
    goto(page, app_server)

    def drawer_state(item) -> dict:
        return item.evaluate(
            """
            node => {
              const drawer = node.querySelector(".panel-tool-drawer");
              const button = node.querySelector(".panel-settings-toggle");
              const styles = getComputedStyle(drawer);
              return {
                open: node.classList.contains("widget-tools-open") || node.classList.contains("db-panel-tools-open"),
                expanded: button?.getAttribute("aria-expanded"),
                visibility: styles.visibility,
                opacity: Number(styles.opacity),
                pointerEvents: styles.pointerEvents,
              };
            }
            """
        )

    def open_tools_by_hover(item) -> None:
        item.locator(".panel-settings-toggle").hover(force=True)
        expect(item.locator(".panel-tool-drawer")).to_be_visible()
        expect(item.locator(".panel-settings-toggle")).to_have_attribute("aria-expanded", "true")
        page.wait_for_function(
            """
            node => {
              const drawer = node.querySelector(".panel-tool-drawer");
              return Number(getComputedStyle(drawer).opacity) > .99 &&
                drawer.getBoundingClientRect().width >= drawer.offsetWidth - .25;
            }
            """,
            arg=item.element_handle(),
        )

    widget = page.locator('.widget-layout:not([hidden]) > [data-widget-key="widget-1"]')
    open_tools_by_hover(widget)
    before_drag = drawer_state(widget)
    assert before_drag["open"] is True
    assert before_drag["expanded"] == "true"
    assert before_drag["visibility"] == "visible"
    assert before_drag["opacity"] > .9

    handle_box = widget.locator(".panel-move-handle").bounding_box()
    assert handle_box
    start_x, start_y = box_center(handle_box)
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + 92, start_y + 18, steps=10)
    expect(page.locator(".widget-dragging")).to_have_count(1)
    during_drag = drawer_state(widget)
    assert during_drag["open"] is True
    assert during_drag["expanded"] == "true"
    assert during_drag["visibility"] == "hidden"
    assert during_drag["opacity"] == 0
    assert during_drag["pointerEvents"] == "none"

    page.mouse.up()
    page.wait_for_timeout(40)
    expect(page.locator(".widget-dragging")).to_have_count(0)
    after_drag = drawer_state(widget)
    assert after_drag["open"] is True
    assert after_drag["expanded"] == "true"
    assert after_drag["visibility"] == "visible"
    page.wait_for_function(
        """
        node => Number(getComputedStyle(node.querySelector(".panel-tool-drawer")).opacity) > .9
        """,
        arg=widget.element_handle(),
    )
    after_drag = drawer_state(widget)
    assert after_drag["opacity"] > .9

    panel = page.locator('.panel-layout > .db-panel[data-panel-key="builder-notes"]')
    open_tools_by_hover(panel)
    before_resize = drawer_state(panel)
    assert before_resize["open"] is True
    assert before_resize["expanded"] == "true"
    assert before_resize["visibility"] == "visible"

    resize_box = panel.locator(".panel-resize-handle").bounding_box()
    assert resize_box
    resize_x, resize_y = box_center(resize_box)
    page.mouse.move(resize_x, resize_y)
    page.mouse.down()
    expect(page.locator(".dashboard-live-resize")).to_have_count(1)
    during_resize = drawer_state(panel)
    assert during_resize["open"] is True
    assert during_resize["expanded"] == "true"
    assert during_resize["visibility"] == "hidden"
    assert during_resize["opacity"] == 0
    assert during_resize["pointerEvents"] == "none"

    page.mouse.move(resize_x + 120, resize_y + 80, steps=8)
    page.mouse.up()
    page.wait_for_timeout(320)
    expect(page.locator(".dashboard-live-resize")).to_have_count(0)
    after_resize = drawer_state(panel)
    assert after_resize["open"] is True
    assert after_resize["expanded"] == "true"
    assert after_resize["visibility"] == "visible"
    assert after_resize["opacity"] > .9
    assert_clean_browser(page)


def test_large_dashboard_drag_resize_cleanup_stays_bounded(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const layout = document.querySelector(".widget-layout");
          const source = document.querySelector('[data-widget-key="widget-1"]');
          const place = (node, col, row, span = 1) => {
            node.dataset.currentSpan = String(span);
            node.dataset.defaultSpan = node.dataset.defaultSpan || String(span);
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.gridRowSpan = "1";
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span 1`;
          };
          for (let index = 0; index < 24; index += 1) {
            const clone = source.cloneNode(true);
            clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
            clone.dataset.widgetKey = `large-widget-${index}`;
            clone.dataset.panelTitle = `Large Widget ${index + 1}`;
            clone.dataset.defaultTitle = `Large Widget ${index + 1}`;
            delete clone.dataset.widgetInitialized;
            clone.classList.remove("widget-tools-open", "db-panel-pinned", "group-selected");
            clone.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "false");
            clone.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", "false");
            const label = clone.querySelector(".stat-lbl");
            if (label) label.textContent = `Large Widget ${index + 1}`;
            layout.appendChild(clone);
            place(clone, (index % 6) + 1, 8 + Math.floor(index / 6));
            layout.__initWidget?.(clone);
          }
        }
        """
    )

    moved = page.locator('[data-widget-key="large-widget-0"]')
    force_open_tools_for_interaction(page, moved)
    drag_by(page, moved.locator(".panel-move-handle"), 0, 260, steps=18)
    page.wait_for_timeout(360)

    resized = page.locator('[data-widget-key="large-widget-5"]')
    force_open_tools_for_interaction(page, resized)
    drag_by(page, resized.locator(".panel-resize-handle"), 220, 0, steps=16)
    page.wait_for_timeout(360)

    assert_no_resize_artifacts(page)
    assert_no_undo_artifacts(page)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_object_settings_click_and_hover_share_menu_geometry(page: Page, app_server: str) -> None:
    goto(page, app_server)

    def menu_geometry(item) -> dict:
        return item.evaluate(
            """
            node => {
              const drawer = node.querySelector(".panel-tool-drawer");
              const settings = node.querySelector(".panel-settings-toggle");
              const header = node.querySelector(".db-panel-hd");
              const hostRect = node.getBoundingClientRect();
              const drawerRect = drawer.getBoundingClientRect();
              const settingsRect = settings.getBoundingClientRect();
              const headerRect = header?.getBoundingClientRect() || hostRect;
              const drawerStyle = getComputedStyle(drawer);
              return {
                drawer: drawerRect.toJSON(),
                settings: settingsRect.toJSON(),
                header: headerRect.toJSON(),
                host: hostRect.toJSON(),
                hasHeader: Boolean(header),
                visibility: drawerStyle.visibility,
                opacity: Number(drawerStyle.opacity),
                transform: drawerStyle.transform,
                pointerEvents: drawerStyle.pointerEvents,
              };
            }
            """
        )

    def close_tools(item) -> None:
        item.evaluate(
            """
            node => {
              node.classList.remove("widget-tools-open", "db-panel-tools-open");
              node.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "false");
              if (!document.querySelector(".widget-tools-open, .db-panel-tools-open")) {
                document.body.classList.remove("layout-tools-active");
              }
            }
            """
        )
        page.mouse.move(16, 16)
        page.wait_for_timeout(180)

    def open_by_hover(item) -> dict:
        item.locator(".panel-settings-toggle").hover(force=True)
        expect(item.locator(".panel-tool-drawer")).to_be_visible()
        page.wait_for_function(
            """
            node => {
              const drawer = node.querySelector(".panel-tool-drawer");
              return Number(getComputedStyle(drawer).opacity) > .99 &&
                drawer.getBoundingClientRect().width >= drawer.offsetWidth - .25;
            }
            """,
            arg=item.element_handle(),
        )
        return menu_geometry(item)

    def open_by_click_without_hover(item) -> dict:
        item.locator(".panel-settings-toggle").evaluate("node => node.click()")
        expect(item.locator(".panel-tool-drawer")).to_be_visible()
        page.wait_for_function(
            """
            node => {
              const drawer = node.querySelector(".panel-tool-drawer");
              return Number(getComputedStyle(drawer).opacity) > .99 &&
                drawer.getBoundingClientRect().width >= drawer.offsetWidth - .25;
            }
            """,
            arg=item.element_handle(),
        )
        return menu_geometry(item)

    def open_by_pointer_click(item) -> dict:
        item.locator(".panel-settings-toggle").click(force=True)
        expect(item.locator(".panel-tool-drawer")).to_be_visible()
        page.wait_for_function(
            """
            node => {
              const drawer = node.querySelector(".panel-tool-drawer");
              return Number(getComputedStyle(drawer).opacity) > .99 &&
                drawer.getBoundingClientRect().width >= drawer.offsetWidth - .25;
            }
            """,
            arg=item.element_handle(),
        )
        return menu_geometry(item)

    def assert_equivalent_menu_geometry(hover_state: dict, click_state: dict) -> None:
        assert click_state["visibility"] == "visible"
        assert click_state["opacity"] > .9
        assert click_state["pointerEvents"] == "auto"
        assert abs(click_state["drawer"]["x"] - hover_state["drawer"]["x"]) <= 1.5
        assert abs(click_state["drawer"]["y"] - hover_state["drawer"]["y"]) <= 1.5
        assert abs(click_state["drawer"]["width"] - hover_state["drawer"]["width"]) <= .5
        assert abs(click_state["drawer"]["height"] - hover_state["drawer"]["height"]) <= .5
        assert click_state["drawer"]["bottom"] <= click_state["host"]["bottom"] + click_state["drawer"]["height"]
        if click_state["hasHeader"]:
            assert click_state["drawer"]["bottom"] <= click_state["header"]["bottom"] - 3
        assert click_state["drawer"]["right"] <= click_state["settings"]["left"] - 4

    panel = page.locator('[data-panel-key="builder-content"]')
    widget = page.locator('[data-widget-key="widget-1"]')
    for item in (panel, widget):
        hover_state = open_by_hover(item)
        close_tools(item)
        click_state = open_by_click_without_hover(item)
        assert_equivalent_menu_geometry(hover_state, click_state)
        close_tools(item)
        pointer_click_state = open_by_pointer_click(item)
        assert_equivalent_menu_geometry(hover_state, pointer_click_state)
        close_tools(item)

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
          place(document.querySelector('[data-panel-key="builder-content"]'), 5, 8, 2, 1);
          place(document.querySelector('[data-widget-key="widget-1"]'), 6, 3, 1, 1);
          window.scrollTo(0, 0);
        }
        """
    )

    for item in (panel, widget):
        hover_state = open_by_hover(item)
        close_tools(item)
        click_state = open_by_click_without_hover(item)
        assert_equivalent_menu_geometry(hover_state, click_state)
        close_tools(item)
        pointer_click_state = open_by_pointer_click(item)
        assert_equivalent_menu_geometry(hover_state, pointer_click_state)
        close_tools(item)

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


def test_pin_control_uses_soft_dashboard_chrome(page: Page, app_server: str) -> None:
    goto(page, app_server)

    def read_pin_state(item) -> dict:
        return item.evaluate(
            """
            node => {
              const settings = node.querySelector(".panel-settings-toggle");
              const pin = node.querySelector(".panel-pin-toggle");
              const icon = pin.querySelector(".pin-icon");
              const settingsRect = settings.getBoundingClientRect();
              const pinRect = pin.getBoundingClientRect();
              const iconRect = icon.getBoundingClientRect();
              const settingsStyle = getComputedStyle(settings);
              const pinStyle = getComputedStyle(pin);
              const iconStyle = getComputedStyle(icon);
              const markerStyle = getComputedStyle(node, "::after");
              const markerIconStyle = getComputedStyle(node, "::before");
              const centerDelta = {
                x: Math.abs((pinRect.left + pinRect.width / 2) - (iconRect.left + iconRect.width / 2)),
                y: Math.abs((pinRect.top + pinRect.height / 2) - (iconRect.top + iconRect.height / 2)),
              };
              const rgb = (value) => {
                const match = value.match(/rgba?\\(([^)]+)\\)/);
                if (match) return match[1].split(/[\\s,\\/]+/).filter(Boolean).slice(0, 3).map((part) => Number.parseFloat(part)).filter(Number.isFinite);
                const srgb = value.match(/color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/);
                if (srgb) return srgb.slice(1, 4).map((part) => Math.round(Number.parseFloat(part) * 255));
                return [];
              };
              return {
                settingsWidth: parseFloat(settingsStyle.width),
                settingsHeight: parseFloat(settingsStyle.height),
                pinWidth: parseFloat(pinStyle.width),
                pinHeight: parseFloat(pinStyle.height),
                iconWidth: iconRect.width,
                iconHeight: iconRect.height,
                centerDelta,
                borderWidth: parseFloat(pinStyle.borderTopWidth),
                borderColor: pinStyle.borderTopColor,
                borderRgb: rgb(pinStyle.borderTopColor),
                background: pinStyle.background,
                boxShadow: pinStyle.boxShadow,
                outlineStyle: pinStyle.outlineStyle,
                iconOpacity: parseFloat(iconStyle.opacity || "1"),
                markerWidth: parseFloat(markerStyle.width),
                markerHeight: parseFloat(markerStyle.height),
                markerBorderWidth: parseFloat(markerStyle.borderTopWidth),
                markerBorderColor: markerStyle.borderTopColor,
                markerBackground: markerStyle.background,
                markerBorderRadius: markerStyle.borderTopLeftRadius,
                markerBoxShadow: markerStyle.boxShadow,
                markerIconWidth: parseFloat(markerIconStyle.width),
                markerIconHeight: parseFloat(markerIconStyle.height),
                markerIconColor: markerIconStyle.backgroundColor,
                markerIconDisplay: markerIconStyle.display,
                markerIconContent: markerIconStyle.content,
              };
            }
            """,
        )

    for selector in (
        '[data-panel-key="builder-content"]',
        '[data-panel-key="builder-menu"]',
        ".widget-layout > .stat-card.widget-card:not(.range-bar)",
    ):
        item = page.locator(selector).first
        open_tools(item)
        page.mouse.move(24, 24)
        page.wait_for_timeout(80)
        unpinned = read_pin_state(item)
        assert abs(unpinned["pinWidth"] - unpinned["settingsWidth"]) <= 1
        assert abs(unpinned["pinHeight"] - unpinned["settingsHeight"]) <= 1
        assert 15 <= unpinned["iconWidth"] <= 17
        assert 15 <= unpinned["iconHeight"] <= 17
        assert unpinned["centerDelta"]["x"] <= 1
        assert unpinned["centerDelta"]["y"] <= 1
        assert unpinned["borderWidth"] <= 1.5
        assert unpinned["iconOpacity"] >= .9

        pin = item.locator(".panel-pin-toggle")
        pin.hover()
        page.wait_for_timeout(220)
        hovered = pin.evaluate(
            """
            node => ({
              isHover: node.matches(":hover"),
              background: getComputedStyle(node).background,
              borderColor: getComputedStyle(node).borderTopColor,
              boxShadow: getComputedStyle(node).boxShadow,
              iconOpacity: parseFloat(getComputedStyle(node.querySelector(".pin-icon")).opacity || "1"),
              iconTransform: getComputedStyle(node.querySelector(".pin-icon")).transform,
            })
            """
        )
        assert hovered["isHover"]
        item.locator(".panel-move-handle").hover(force=True)
        page.wait_for_timeout(220)
        peer_hovered = item.locator(".panel-move-handle").evaluate(
            """
            node => ({
              background: getComputedStyle(node).background,
              borderColor: getComputedStyle(node).borderTopColor,
              boxShadow: getComputedStyle(node).boxShadow,
            })
            """
        )
        assert (
            hovered["boxShadow"] != unpinned["boxShadow"]
            or hovered["background"] != unpinned["background"]
            or hovered["borderColor"] != unpinned["borderColor"]
            or hovered["iconOpacity"] != unpinned["iconOpacity"]
            or hovered["iconTransform"] != "none"
        )
        assert "linear-gradient" not in hovered["background"]
        assert hovered["borderColor"] != "rgb(255, 255, 255)"
        assert "0px 6px 14px" in hovered["boxShadow"]
        assert "0px 6px 14px" in peer_hovered["boxShadow"]
        assert "0px 0px 16px" not in hovered["boxShadow"]
        assert "0px 0px 18px" not in hovered["boxShadow"]
        assert "0px 0px 22px" not in hovered["boxShadow"]
        pin.focus()
        focused = pin.evaluate("node => ({ outline: getComputedStyle(node).outlineStyle, border: getComputedStyle(node).borderTopColor })")
        assert focused["outline"] in {"solid", "none"}
        assert focused["border"]

        pin.click(force=True)
        page.wait_for_timeout(120)
        expect(item).to_have_class(re.compile("db-panel-pinned"))
        pinned = read_pin_state(item)
        assert 5 <= pinned["markerWidth"] <= 9
        assert 5 <= pinned["markerHeight"] <= 9
        assert pinned["markerBorderWidth"] <= 1.1
        assert pinned["markerBorderRadius"] in {"999px", "50%"} or float(pinned["markerBorderRadius"].replace("px", "")) >= 3
        assert pinned["markerBackground"] != "none"
        assert pinned["markerIconDisplay"] == "none"
        assert pinned["markerIconContent"] in {"none", "normal"}
        assert "0 0 26px" not in pinned["boxShadow"]
        assert "0 0 26px" not in pinned["markerBoxShadow"]
        assert "0px 7px" not in pinned["markerBoxShadow"]
        assert "103, 169, 255" not in pinned["borderColor"]
        assert "147, 197, 253" not in pinned["borderColor"]
        assert "103, 169, 255" not in pinned["boxShadow"]
        item.evaluate(
            """
            node => {
              node.classList.remove("db-panel-pinned", "db-panel-tools-open", "widget-tools-open");
              node.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", "false");
              node.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "false");
            }
            """
        )

    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    deep_item = page.locator('[data-panel-key="builder-content"]').first
    open_tools(deep_item)
    deep_item.locator(".panel-pin-toggle").click(force=True)
    page.wait_for_timeout(120)
    deep_pinned = read_pin_state(deep_item)
    assert 5 <= deep_pinned["markerWidth"] <= 9
    assert 5 <= deep_pinned["markerHeight"] <= 9
    assert deep_pinned["markerIconDisplay"] == "none"
    assert "0 0 26px" not in deep_pinned["markerBoxShadow"]
    assert "103, 169, 255" not in deep_pinned["markerBoxShadow"]

    assert_clean_browser(page)


def test_widget_surface_controls_use_translucent_widget_glass(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    timeframe = page.locator(".timeframe-widget")
    panel = page.locator(".panel-layout > .db-panel").first
    page.locator(".panel-add-button").click()
    page.locator('.widget-add-action[data-widget-kind="anchor"]').click()
    anchor = page.locator('.workspace-anchor-object[data-workspace-object-type="anchor"]').last
    expect(anchor).to_be_visible()

    def material_state(item) -> dict:
        page.evaluate(
            """
            () => {
              document.querySelectorAll(".widget-tools-open, .db-panel-tools-open").forEach((node) => {
                node.classList.remove("widget-tools-open", "db-panel-tools-open");
                node.querySelector(".panel-settings-toggle")?.setAttribute("aria-expanded", "false");
              });
              document.querySelectorAll(".panel-color-menu-open").forEach((node) => node.classList.remove("panel-color-menu-open"));
              document.body.classList.remove("layout-tools-active");
            }
            """
        )
        open_tools(item)
        page.wait_for_function(
            """
            node => Number(getComputedStyle(node.querySelector(".panel-tool-drawer")).opacity) > .99
            """,
            arg=item.element_handle(),
        )
        return item.evaluate(
            """
            node => {
              const alphaFromColor = (value) => {
                if (!value || value === "transparent") return 0;
                const rgba = value.match(/rgba?\\(([^)]+)\\)/);
                if (rgba) {
                  const parts = rgba[1].split(/[\\s,\\/]+/).filter(Boolean);
                  return parts.length >= 4 ? Number(parts[3]) : 1;
                }
                const slashAlpha = value.match(/\\/\\s*([\\d.]+)\\s*\\)/);
                if (slashAlpha) return Number(slashAlpha[1]);
                const color = value.match(/color\\([^/]+\\/\\s*([\\d.]+)\\s*\\)/);
                if (color) return Number(color[1]);
                return 1;
              };
              const alphaValues = (value) => [...String(value).matchAll(/(?:rgba?\\([^)]+\\)|color\\([^)]+\\))/g)]
                .map((match) => alphaFromColor(match[0]))
                .filter((alpha) => Number.isFinite(alpha));
              const settings = node.querySelector(".panel-settings-toggle");
              const button = node.querySelector(".panel-tool-button");
              const drawer = node.querySelector(".panel-tool-drawer");
              const icon = settings.querySelector(".settings-icon");
              const settingsStyles = getComputedStyle(settings);
              const buttonStyles = getComputedStyle(button);
              const drawerStyles = getComputedStyle(drawer);
              const iconStyles = getComputedStyle(icon);
                return {
                  settingsAlpha: alphaFromColor(settingsStyles.backgroundColor),
                buttonAlpha: alphaFromColor(buttonStyles.backgroundColor),
                drawerAlphas: alphaValues(`${drawerStyles.backgroundImage}, ${drawerStyles.backgroundColor}`),
                drawerOpacity: Number(drawerStyles.opacity || "1"),
                drawerBorder: drawerStyles.borderTopColor,
                drawerShadow: drawerStyles.boxShadow,
                settingsBorder: settingsStyles.borderTopColor,
                buttonBorder: buttonStyles.borderTopColor,
                settingsShadow: settingsStyles.boxShadow,
                iconColor: iconStyles.backgroundColor,
                iconOpacity: Number(iconStyles.opacity || "1"),
              };
            }
            """
        )

    widget_default = material_state(widget)
    panel_default = material_state(panel)
    timeframe_default = material_state(timeframe)
    anchor_default = material_state(anchor)

    widget.locator(".panel-settings-toggle").hover(force=True)
    page.wait_for_timeout(180)
    widget_hover = material_state(widget)

    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    page.wait_for_timeout(120)
    widget_deep = material_state(widget)
    timeframe_deep = material_state(timeframe)
    anchor_deep = material_state(anchor)

    for state in (widget_default, widget_hover, widget_deep, timeframe_default, timeframe_deep, anchor_default, anchor_deep):
        assert .86 <= state["settingsAlpha"] <= 1
        assert .86 <= state["buttonAlpha"] <= 1
        assert state["drawerAlphas"]
        assert .90 <= max(state["drawerAlphas"]) <= 1
        assert state["drawerOpacity"] >= .99
        assert state["drawerBorder"] != "rgba(0, 0, 0, 0)"
        assert state["drawerShadow"] != "none"
        assert state["settingsBorder"] != "rgb(255, 255, 255)"
        assert state["buttonBorder"] != "rgb(255, 255, 255)"
        assert "0px 0px 22px" not in state["settingsShadow"]
        assert state["iconColor"] != "rgba(0, 0, 0, 0)"
        assert state["iconOpacity"] >= .9

    assert max(widget_default["drawerAlphas"]) >= max(panel_default["drawerAlphas"]) - .08
    assert widget_default["settingsAlpha"] >= panel_default["settingsAlpha"] - .08
    assert widget_default["buttonAlpha"] >= panel_default["buttonAlpha"] - .08
    assert max(timeframe_default["drawerAlphas"]) >= max(panel_default["drawerAlphas"]) - .08
    assert max(anchor_default["drawerAlphas"]) >= max(panel_default["drawerAlphas"]) - .08
    assert_clean_browser(page)


def test_navbar_dropdowns_layer_above_object_controls(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    panel = page.locator(".panel-layout > .db-panel").first
    open_tools(widget)
    open_tools(panel)

    page.locator(".panel-add-button").click()
    expect(page.locator(".panel-add-menu")).to_have_class(re.compile("open"))

    layers = page.evaluate(
        """
        () => {
          const z = (selector) => {
            const node = document.querySelector(selector);
            const value = node ? getComputedStyle(node).zIndex : "auto";
            return value === "auto" ? 0 : Number(value);
          };
          return {
            navbar: z(".app-nav.workspace-chrome"),
            navbarDropdown: z(".app-nav.workspace-chrome .panel-add-menu"),
            widgetOpen: z(".widget-layout > .widget-card.widget-tools-open"),
            widgetControls: z(".widget-layout > .widget-card.widget-tools-open .widget-tools"),
            panelOpen: z(".panel-layout > .db-panel.db-panel-tools-open"),
            panelControls: z(".panel-layout > .db-panel.db-panel-tools-open .panel-tool-drawer"),
          };
        }
        """
    )

    assert layers["widgetControls"] < layers["navbar"], layers
    assert layers["panelControls"] < layers["navbar"], layers
    assert layers["widgetOpen"] < layers["navbar"], layers
    assert layers["panelOpen"] < layers["navbar"], layers
    assert layers["navbarDropdown"] > layers["navbar"], layers

    page.locator(".panel-add-button").click()
    page.locator(".layout-slot-trigger").click()
    expect(page.locator(".layout-slot-menu")).to_have_class(re.compile("open"))
    layout_layer = page.locator(".layout-slot-menu").evaluate(
        """node => Number(getComputedStyle(node).zIndex)"""
    )
    assert layout_layer == layers["navbarDropdown"]
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

    def rgb_tuple(value: str) -> tuple[float, float, float]:
        if value.startswith("oklab("):
            parts = [float(part) for part in re.findall(r"-?[\d.]+", value)[:3]]
            if len(parts) == 3:
                l_value, a_value, b_value = parts
                l_channel = (l_value + 0.3963377774 * a_value + 0.2158037573 * b_value) ** 3
                m_channel = (l_value - 0.1055613458 * a_value - 0.0638541728 * b_value) ** 3
                s_channel = (l_value - 0.0894841775 * a_value - 1.2914855480 * b_value) ** 3
                linear = (
                    +4.0767416621 * l_channel - 3.3077115913 * m_channel + 0.2309699292 * s_channel,
                    -1.2684380046 * l_channel + 2.6097574011 * m_channel - 0.3413193965 * s_channel,
                    -0.0041960863 * l_channel - 0.7034186147 * m_channel + 1.7076147010 * s_channel,
                )
                return tuple(
                    255 * (12.92 * channel if channel <= 0.0031308 else 1.055 * (channel ** (1 / 2.4)) - 0.055)
                    for channel in (min(1, max(0, channel)) for channel in linear)
                )
        parts = [float(part) for part in re.findall(r"[\d.]+", value)[:3]]
        if len(parts) != 3:
            return (0, 0, 0)
        if value.startswith("color(") and max(parts) <= 1:
            return tuple(part * 255 for part in parts)
        return tuple(parts)

    def assert_material_border_close(actual: str, expected: str, tolerance: float = 14) -> None:
        assert max(abs(a - b) for a, b in zip(rgb_tuple(actual), rgb_tuple(expected))) <= tolerance

    def assert_material_shadow(value: str) -> None:
        assert value and value != "none"
        assert "0 0 26px" not in value
        assert "103, 169, 255" not in value

    def transform_y(value: str) -> float:
        if value == "none":
            return 0
        parts = [float(part) for part in re.findall(r"-?[\d.]+", value)]
        if value.startswith("matrix3d") and len(parts) >= 16:
            return parts[13]
        if value.startswith("matrix") and len(parts) >= 6:
            return parts[5]
        return 0

    def assert_transform_close(actual: str, expected: str, tolerance: float = 0.05) -> None:
        assert abs(transform_y(actual) - transform_y(expected)) <= tolerance

    widget.hover()
    page.wait_for_timeout(260)
    widget_hover = read_surface(widget)

    panel.hover()
    page.wait_for_timeout(260)
    panel_hover = read_surface(panel)
    assert_material_border_close(panel_hover["borderColor"], widget_hover["borderColor"])
    assert_material_shadow(panel_hover["boxShadow"])
    assert_material_shadow(widget_hover["boxShadow"])
    assert_transform_close(panel_hover["transform"], widget_hover["transform"])

    if collapsed_panel.count():
        collapsed_panel.hover()
        page.wait_for_timeout(260)
        collapsed_hover = read_surface(collapsed_panel)
        assert_material_shadow(collapsed_hover["boxShadow"])
        assert_transform_close(collapsed_hover["transform"], widget_hover["transform"])

    timeframe.hover()
    page.wait_for_timeout(260)
    timeframe_hover = read_surface(timeframe)
    assert_material_border_close(timeframe_hover["borderColor"], widget_hover["borderColor"])
    assert_material_shadow(timeframe_hover["boxShadow"])
    assert_transform_close(timeframe_hover["transform"], widget_hover["transform"])

    page.mouse.move(24, 24)
    panel.locator(".db-panel-hd").focus()
    page.wait_for_timeout(180)
    panel_focus = read_surface(panel)
    page.mouse.move(24, 24)
    widget.focus()
    page.wait_for_timeout(180)
    widget_focus = read_surface(widget)
    assert_material_border_close(panel_focus["borderColor"], widget_focus["borderColor"])
    assert_material_shadow(panel_focus["boxShadow"])
    assert_material_shadow(widget_focus["boxShadow"])
    assert_transform_close(panel_focus["transform"], widget_focus["transform"])
    assert panel_focus["outlineStyle"] != "solid" or panel_focus["outlineWidth"] in {"0px", "1px", "2px"}
    assert_clean_browser(page)


def test_widget_hover_shadow_stays_subtle_and_neutral(page: Page, app_server: str) -> None:
    goto(page, app_server)
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first

    def read_shadow(locator) -> dict:
        return locator.evaluate(
            """
            node => {
              const computed = getComputedStyle(node);
              const splitLayers = (value) => {
                if (!value || value === "none") return [];
                return value.split(/,(?![^()]*\\))/).map((raw) => {
                  const color = raw.match(/rgba?\\(([^)]+)\\)/);
                  const channels = color
                    ? color[1].split(/[\\s,\\/]+/).filter(Boolean).map((part) => Number.parseFloat(part))
                    : [];
                  const lengths = raw
                    .replace(/rgba?\\([^)]+\\)/, "")
                    .replace(/inset/g, "")
                    .trim()
                    .split(/\\s+/)
                    .map((part) => Number.parseFloat(part))
                    .filter(Number.isFinite);
                  return {
                    raw,
                    r: channels[0] ?? 0,
                    g: channels[1] ?? 0,
                    b: channels[2] ?? 0,
                    alpha: channels[3] ?? 1,
                    offsetY: lengths[1] ?? 0,
                    blur: lengths[2] ?? 0,
                    inset: raw.includes("inset"),
                  };
                });
              };
              return {
                boxShadow: computed.boxShadow,
                transform: computed.transform,
                layers: splitLayers(computed.boxShadow),
              };
            }
            """
        )

    def assert_shadow_is_restrained(state: dict, *, max_blur: float) -> None:
        assert state["boxShadow"] and state["boxShadow"] != "none"
        assert max(layer["blur"] for layer in state["layers"]) <= max_blur
        saturated_layers = [
            layer for layer in state["layers"]
            if not layer["inset"]
            and layer["alpha"] >= .11
            and max(layer["r"], layer["g"], layer["b"]) - min(layer["r"], layer["g"], layer["b"]) > 70
        ]
        assert saturated_layers == []

    widget.hover()
    page.wait_for_timeout(260)
    hovered = read_shadow(widget)
    assert hovered["transform"] != "none"
    assert_shadow_is_restrained(hovered, max_blur=24)

    page.mouse.move(24, 24)
    page.wait_for_timeout(80)
    widget.evaluate(
        """
        node => {
          node.classList.add("db-panel-custom-color", "active");
          node.dataset.panelColor = "#dc2626";
          node.style.setProperty("--panel-accent", "#dc2626");
          node.style.setProperty("--panel-accent-rgb", "220, 38, 38");
          node.style.setProperty("--panel-accent-text", "#7f1d1d");
        }
        """
    )
    widget.hover()
    page.wait_for_timeout(260)
    custom_hovered = read_shadow(widget)
    assert_shadow_is_restrained(custom_hovered, max_blur=28)

    page.mouse.move(24, 24)
    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    expect(page.locator("html")).to_have_attribute("data-background", "deep-slate")
    widget.hover()
    page.wait_for_timeout(260)
    deep_background_hovered = read_shadow(widget)
    assert_shadow_is_restrained(deep_background_hovered, max_blur=28)
    assert_clean_browser(page)


def test_compact_pressable_controls_depress_without_sinking_large_surfaces(page: Page, app_server: str) -> None:
    goto(page, app_server)
    panel = page.locator(".panel-layout > .db-panel").first
    widget = page.locator(".widget-layout > .stat-card.widget-card:not(.range-bar)").first
    timeframe = page.locator(".timeframe-widget")
    timeframe_preset = timeframe.locator(".preset-btn:not(.active)").first
    background_trigger = page.locator(".background-tone-trigger").first

    def transform_y(locator) -> float:
        return locator.evaluate(
            """
            node => {
              const transform = getComputedStyle(node).transform;
              if (!transform || transform === "none") {
                return 0;
              }
              return new DOMMatrixReadOnly(transform).m42;
            }
            """
        )

    def control_state(locator) -> dict:
        return locator.evaluate(
            """
            node => {
              const styles = getComputedStyle(node);
              const transform = styles.transform && styles.transform !== "none"
                ? new DOMMatrixReadOnly(styles.transform)
                : new DOMMatrixReadOnly();
              const icon = node.querySelector(".settings-icon,.move-icon,.resize-icon,.pin-icon,.text-icon,.color-icon,.trash-icon");
              const iconStyles = icon ? getComputedStyle(icon) : null;
              const iconTransform = iconStyles && iconStyles.transform && iconStyles.transform !== "none"
                ? new DOMMatrixReadOnly(iconStyles.transform)
                : new DOMMatrixReadOnly();
              const rect = node.getBoundingClientRect();
              return {
                y: transform.m42,
                scaleX: transform.a,
                scaleY: transform.d,
                width: rect.width,
                height: rect.height,
                boxShadow: styles.boxShadow,
                iconY: iconTransform.m42,
                iconScaleX: iconTransform.a,
                iconScaleY: iconTransform.d,
              };
            }
            """
        )

    def assert_compact_hover(locator) -> dict:
        locator.hover(force=True)
        page.wait_for_timeout(220)
        state = control_state(locator)
        assert state["y"] > 0.4
        assert math.isclose(state["scaleX"], 1, abs_tol=.01)
        assert math.isclose(state["scaleY"], 1, abs_tol=.01)
        assert state["iconY"] >= -0.05
        assert state["iconScaleX"] <= 1.01
        assert state["iconScaleY"] <= 1.01
        assert "0px 0px 16px" not in state["boxShadow"]
        assert "0px 0px 18px" not in state["boxShadow"]
        assert "0px 0px 22px" not in state["boxShadow"]
        return state

    def assert_disabled_static(locator) -> None:
        before = control_state(locator)
        locator.hover(force=True)
        page.wait_for_timeout(160)
        after = control_state(locator)
        assert abs(after["y"]) <= 0.05
        assert math.isclose(after["scaleX"], before["scaleX"], abs_tol=.01)
        assert math.isclose(after["scaleY"], before["scaleY"], abs_tol=.01)

    def drawer_rect(item) -> dict:
        return item.locator(".panel-tool-drawer").evaluate(
            """
            node => {
              const rect = node.getBoundingClientRect();
              return { width: rect.width, height: rect.height };
            }
            """
        )

    widget.hover()
    page.wait_for_timeout(220)
    assert transform_y(widget) < -0.5

    panel.hover()
    page.wait_for_timeout(220)
    assert transform_y(panel) < -0.5

    timeframe.hover()
    page.wait_for_timeout(220)
    assert transform_y(timeframe) < -0.5

    timeframe_preset.hover()
    page.wait_for_timeout(220)
    preset_hover = transform_y(timeframe_preset)
    assert preset_hover > 0.4

    page.mouse.down()
    page.wait_for_timeout(120)
    assert transform_y(timeframe_preset) > preset_hover
    page.mouse.up()

    open_tools(widget)
    page.wait_for_timeout(220)
    settings = widget.locator(".panel-settings-toggle")
    widget_drawer_before = drawer_rect(widget)

    assert_compact_hover(settings)
    widget_buttons = widget.locator(".panel-tool-drawer .panel-tool-button")
    for index in range(widget_buttons.count()):
        assert_compact_hover(widget_buttons.nth(index))

    widget_title_button = widget.locator(".panel-title-handle")
    widget_title_button.hover(force=True)
    page.wait_for_timeout(120)
    title_hover = control_state(widget_title_button)
    page.mouse.down()
    page.wait_for_timeout(120)
    title_active = control_state(widget_title_button)
    assert title_active["y"] > title_hover["y"]
    page.mouse.move(24, 24)
    page.mouse.up()

    widget_drawer_after = drawer_rect(widget)
    assert abs(widget_drawer_after["width"] - widget_drawer_before["width"]) <= .5
    assert abs(widget_drawer_after["height"] - widget_drawer_before["height"]) <= .5

    open_tools(panel)
    page.wait_for_timeout(220)
    panel_drawer_before = drawer_rect(panel)
    assert_compact_hover(panel.locator(".panel-settings-toggle"))
    panel_buttons = panel.locator(".panel-tool-drawer .panel-tool-button")
    for index in range(panel_buttons.count()):
        assert_compact_hover(panel_buttons.nth(index))
    panel_drawer_after = drawer_rect(panel)
    assert abs(panel_drawer_after["width"] - panel_drawer_before["width"]) <= .5
    assert abs(panel_drawer_after["height"] - panel_drawer_before["height"]) <= .5

    layout_trigger = page.locator(".layout-slot-trigger")
    assert_compact_hover(layout_trigger)
    page.mouse.move(24, 24)
    layout_trigger.focus()
    page.wait_for_timeout(120)
    assert abs(control_state(layout_trigger)["y"]) <= 0.05

    for selector in [
        ".layout-save-button",
        ".layout-load-button",
        ".panel-undo-button",
        ".layout-group-button",
        ".engineer-mode-button",
        ".context-view-button",
        ".composition-add-button",
        ".restore-layout-button",
    ]:
        assert_compact_hover(page.locator(selector))

    layout_trigger.click()
    expect(page.locator(".layout-slot-menu")).to_have_class(re.compile("open"))
    assert_compact_hover(page.locator(".layout-slot-menu button").first)
    page.mouse.click(24, 24)
    page.wait_for_timeout(120)

    page.locator(".composition-add-button").click()
    expect(page.locator(".panel-add-menu")).to_have_class(re.compile("open"))
    assert_compact_hover(page.locator('.widget-add-action[data-widget-kind="timeframe"]'))
    assert_compact_hover(page.locator('.panel-add-action[data-panel-kind="panel"]'))
    assert_compact_hover(page.locator('.divider-add-action[data-divider-kind="context-divider"]'))
    page.mouse.click(24, 24)
    page.wait_for_timeout(120)

    page.locator(".dash-switch-hero").click()
    expect(page.locator(".dash-switch-menu")).to_have_class(re.compile("open"))
    assert_compact_hover(page.locator(".dash-switch-opt:not(:disabled)").first)
    disabled_profile = page.locator(".dash-switch-opt:disabled").first
    expect(disabled_profile).to_be_visible()
    assert_disabled_static(disabled_profile)
    page.mouse.click(24, 24)
    page.wait_for_timeout(120)

    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    page.wait_for_timeout(120)
    open_tools(widget)
    assert_compact_hover(widget.locator(".panel-pin-toggle"))

    background_trigger.hover()
    page.wait_for_timeout(220)
    assert transform_y(background_trigger) > 0.4
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

    page.evaluate("document.documentElement.dataset.background = 'deep-slate'")
    for metric in chevron_metrics():
        assert metric["xOffset"] <= 0.5, metric
        assert metric["topOffset"] <= 0.5, metric
        assert metric["maskImage"] != "none", metric

    assert_clean_browser(page)


def test_panel_chevron_size_stays_stable_across_expand_collapse_states(page: Page, app_server: str) -> None:
    goto(page, app_server)

    panel = page.locator('[data-panel-key="builder-menu"]')
    expect(panel).to_have_class(re.compile("db-panel-collapsed"))

    def chevron_state() -> dict:
        return panel.evaluate(
            """
            node => {
              const header = node.querySelector(".db-panel-hd");
              const headerRect = header.getBoundingClientRect();
              const headerStyles = getComputedStyle(header);
              const before = getComputedStyle(header, "::before");
              const after = getComputedStyle(header, "::after");
              return {
                collapsed: node.classList.contains("db-panel-collapsed"),
                headerHeight: headerRect.height,
                minHeight: headerStyles.minHeight,
                paddingLeft: headerStyles.paddingLeft,
                paddingTop: headerStyles.paddingTop,
                controlWidth: before.width,
                controlHeight: before.height,
                controlMinWidth: before.minWidth,
                controlTransform: before.transform,
                iconWidth: after.width,
                iconHeight: after.height,
                iconLeft: after.left,
                iconMaskSize: after.webkitMaskSize || after.maskSize,
              };
            }
            """
        )

    def assert_same_size(actual: dict, expected: dict) -> None:
        for key in (
            "headerHeight",
            "minHeight",
            "paddingLeft",
            "paddingTop",
            "controlWidth",
            "controlHeight",
            "controlMinWidth",
            "controlTransform",
            "iconWidth",
            "iconHeight",
            "iconLeft",
            "iconMaskSize",
        ):
            assert actual[key] == expected[key], (key, actual, expected)

    collapsed = chevron_state()
    assert collapsed["controlWidth"] == "34px"
    assert collapsed["controlHeight"] == "34px"
    assert collapsed["iconWidth"] == "15px"
    assert collapsed["iconHeight"] == "15px"
    assert collapsed["iconMaskSize"] == "14px 14px"

    panel.hover()
    hover = chevron_state()
    assert_same_size(hover, collapsed)

    page.locator(".layout-group-button").click()
    panel.click(position={"x": 20, "y": 20})
    expect(panel).to_have_class(re.compile("group-selected"))
    grouped = chevron_state()
    assert_same_size(grouped, collapsed)
    page.locator(".layout-group-button").click()
    expect(panel).not_to_have_class(re.compile("group-selected"))

    for _ in range(2):
        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        page.wait_for_timeout(320)
        expanded = chevron_state()
        assert expanded["collapsed"] is False
        assert_same_size(expanded, collapsed)

        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        page.wait_for_timeout(320)
        recollapsed = chevron_state()
        assert recollapsed["collapsed"] is True
        assert_same_size(recollapsed, collapsed)

    assert_clean_browser(page)


def test_default_panel_header_titles_do_not_shift_across_expand_collapse(page: Page, app_server: str) -> None:
    goto(page, app_server)

    panel_keys = ["builder-menu", "builder-notes", "builder-content"]
    header_structure = page.evaluate(
        """
        (keys) => keys.map((key) => {
          const panel = document.querySelector(`[data-panel-key="${key}"]`);
          const header = panel?.querySelector(".db-panel-hd");
          return {
            key,
            classes: [...header.classList].filter((className) => className.startsWith("db-panel-hd")).sort(),
            children: [...header.children].map((child) => {
              if (child.classList.contains("db-panel-title")) return "title";
              if (child.classList.contains("db-panel-count")) return "count";
              if (child.classList.contains("panel-tools")) return "tools";
              return child.className;
            }),
          };
        })
        """,
        panel_keys,
    )

    for structure in header_structure:
        assert structure["classes"] == ["db-panel-hd", "db-panel-hd-items"], structure
        assert structure["children"] == ["title", "count", "tools"], structure

    def title_left(panel_key: str) -> float:
        return page.locator(f'[data-panel-key="{panel_key}"] .db-panel-title').evaluate(
            "node => node.getBoundingClientRect().left"
        )

    for panel_key in panel_keys:
        panel = page.locator(f'[data-panel-key="{panel_key}"]')
        panel.scroll_into_view_if_needed()
        if not panel.evaluate("node => node.classList.contains('db-panel-collapsed')"):
            panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
            page.wait_for_timeout(320)
            expect(panel).to_have_class(re.compile("db-panel-collapsed"))

        collapsed_left = title_left(panel_key)

        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        page.wait_for_timeout(320)
        expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
        expanded_left = title_left(panel_key)
        assert abs(expanded_left - collapsed_left) <= 1, (panel_key, collapsed_left, expanded_left)

        panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
        page.wait_for_timeout(320)
        expect(panel).to_have_class(re.compile("db-panel-collapsed"))
        recollapsed_left = title_left(panel_key)
        assert abs(recollapsed_left - collapsed_left) <= 1, (panel_key, collapsed_left, recollapsed_left)

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
          const unused = document.querySelector('[data-widget-key="widget-4"]');
          const panel = document.querySelector('[data-panel-key="builder-content"]');
          place(widget, 1, 2, 1);
          place(pinned, 6, 2, 1);
          if (unused) place(unused, 6, 12, 1);
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
    panel = page.locator('[data-panel-key="builder-content"]')
    widget.click(position={"x": 20, "y": 20})
    pinned.click(position={"x": 20, "y": 20})
    panel.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(3)

    before = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "pinned": grid_item_state(page, '[data-widget-key="widget-2"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    open_tools(widget)
    drag_by(page, widget.locator(".panel-move-handle"), 0, 220, steps=18)
    page.wait_for_timeout(360)
    after = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "pinned": grid_item_state(page, '[data-widget-key="widget-2"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
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


def test_group_drag_uses_composite_footprint_and_preserves_member_spacing(page: Page, app_server: str) -> None:
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
            if (node.classList.contains("db-panel") && !node.classList.contains("db-panel-collapsed")) {
              const gap = parseFloat(getComputedStyle(document.querySelector(".dashboard-layout-grid")).rowGap || "16") || 16;
              const height = (rowSpan * 81) + (Math.max(0, rowSpan - 1) * gap);
              node.dataset.savedHeight = String(height);
              node.style.height = `${height}px`;
            }
          };
          place(document.querySelector('[data-widget-key="widget-1"]'), 1, 2, 2);
          place(document.querySelector('[data-panel-key="builder-content"]'), 3, 2, 2, 3);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 2, 6, 3, 2);
          place(document.querySelector('[data-widget-key="widget-2"]'), 5, 6, 1);
        }
        """
    )

    page.locator(".layout-group-button").click()
    widget = page.locator('[data-widget-key="widget-1"]')
    panel = page.locator('[data-panel-key="builder-content"]')
    blocker = page.locator('[data-panel-key="builder-notes"]')
    widget.click(position={"x": 20, "y": 20})
    panel.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(2)

    before = page.evaluate(
        """
        () => {
          const read = (selector) => {
            const node = document.querySelector(selector);
            const rect = node.getBoundingClientRect();
            return {
              col: Number(node.dataset.gridCol),
              row: Number(node.dataset.gridRow),
              span: Number(node.dataset.currentSpan),
              rowSpan: Number(node.dataset.gridRowSpan),
              left: rect.left,
              top: rect.top,
            };
          };
          return {
            widget: read('[data-widget-key="widget-1"]'),
            panel: read('[data-panel-key="builder-content"]'),
            blocker: read('[data-panel-key="builder-notes"]'),
          };
        }
        """
    )

    force_open_tools_for_interaction(page, widget)
    handle = widget.locator(".panel-move-handle")
    handle_box = handle.bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x, y + 355, steps=16)
    page.wait_for_timeout(220)

    during = page.evaluate(
        """
        () => {
          const read = (selector) => {
            const node = document.querySelector(selector);
            return {
              col: Number(node.dataset.gridCol),
              row: Number(node.dataset.gridRow),
              span: Number(node.dataset.currentSpan),
              rowSpan: Number(node.dataset.gridRowSpan),
            };
          };
          const liveRect = (selector) => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
          };
          const shell = document.querySelector(".dashboard-group-live-shell");
          const shellStyles = getComputedStyle(shell);
          const footprint = document.querySelector(".dashboard-group-footprint");
          return {
            originals: {
              widget: read('[data-widget-key="widget-1"]'),
              panel: read('[data-panel-key="builder-content"]'),
            },
            blocker: read('[data-panel-key="builder-notes"]'),
            liveWidget: liveRect('.dashboard-group-live-member[data-widget-key="widget-1"]'),
            livePanel: liveRect('.dashboard-group-live-member[data-panel-key="builder-content"]'),
            liveCount: document.querySelectorAll(".dashboard-group-live-member").length,
            sourceCount: document.querySelectorAll(".dashboard-group-source").length,
            footprintCount: document.querySelectorAll(".dashboard-group-footprint").length,
            footprintSpan: Number(footprint.dataset.currentSpan),
            footprintRows: Number(footprint.dataset.gridRowSpan),
            shellBackground: shellStyles.backgroundImage,
            shellBackgroundColor: shellStyles.backgroundColor,
            shellBorderColor: shellStyles.borderTopColor,
          };
        }
        """
    )

    assert during["originals"]["widget"] == {key: before["widget"][key] for key in ("col", "row", "span", "rowSpan")}
    assert during["originals"]["panel"] == {key: before["panel"][key] for key in ("col", "row", "span", "rowSpan")}
    assert during["liveCount"] == 2
    assert during["sourceCount"] == 2
    assert during["footprintCount"] == 1
    assert during["footprintSpan"] == 4
    assert during["footprintRows"] == 3
    assert during["blocker"]["row"] > before["blocker"]["row"]
    assert during["shellBackground"] != "none"
    assert during["shellBackgroundColor"] != "rgb(0, 0, 0)"
    assert during["shellBorderColor"] != "rgb(0, 0, 0)"
    before_dx = before["panel"]["left"] - before["widget"]["left"]
    before_dy = before["panel"]["top"] - before["widget"]["top"]
    live_dx = during["livePanel"]["left"] - during["liveWidget"]["left"]
    live_dy = during["livePanel"]["top"] - during["liveWidget"]["top"]
    assert abs(live_dx - before_dx) <= 1
    assert abs(live_dy - before_dy) <= 1

    page.mouse.up()
    page.wait_for_timeout(360)
    first_after = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "blocker": grid_item_state(page, '[data-panel-key="builder-notes"]'),
    }
    assert first_after["panel"]["col"] - first_after["widget"]["col"] == before["panel"]["col"] - before["widget"]["col"]
    assert first_after["panel"]["row"] - first_after["widget"]["row"] == before["panel"]["row"] - before["widget"]["row"]
    assert first_after["blocker"]["row"] > before["blocker"]["row"]
    expect(page.locator(".dashboard-group-live-shell")).to_have_count(0)
    expect(page.locator(".dashboard-group-footprint")).to_have_count(0)
    expect(page.locator(".dashboard-group-source")).to_have_count(0)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    open_tools(widget)
    drag_by(page, widget.locator(".panel-move-handle"), 0, -95, steps=10)
    page.wait_for_timeout(300)
    second_after = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert second_after["panel"]["col"] - second_after["widget"]["col"] == before["panel"]["col"] - before["widget"]["col"]
    assert second_after["panel"]["row"] - second_after["widget"]["row"] == before["panel"]["row"] - before["widget"]["row"]
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".page")
    reloaded = {
        "widget": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert reloaded["widget"]["col"] == second_after["widget"]["col"]
    assert reloaded["widget"]["row"] == second_after["widget"]["row"]
    assert reloaded["panel"]["col"] == second_after["panel"]["col"]
    assert reloaded["panel"]["row"] == second_after["panel"]["row"]
    assert_clean_browser(page)


def test_group_drag_can_target_top_grid_row(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1) => {
            node.classList.remove("db-panel-collapsed");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            if (node.classList.contains("db-panel")) {
              const gap = parseFloat(getComputedStyle(document.querySelector(".dashboard-layout-grid")).rowGap || "16") || 16;
              const height = (rowSpan * 81) + (Math.max(0, rowSpan - 1) * gap);
              node.dataset.savedHeight = String(height);
              node.style.height = `${height}px`;
            }
          };
          document.querySelectorAll(".widget-layout > .widget-card").forEach((node, index) => place(node, 1 + (index % 6), 14 + index, 1));
          place(document.querySelector('[data-panel-key="builder-content"]'), 1, 7, 2, 2);
          place(document.querySelector('[data-panel-key="builder-menu"]'), 3, 7, 2, 2);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 5, 10, 2, 2);
          window.scrollTo(0, 0);
        }
        """
    )

    page.locator(".layout-group-button").click()
    table = page.locator('[data-panel-key="builder-content"]')
    menu = page.locator('[data-panel-key="builder-menu"]')
    table.click(position={"x": 20, "y": 20})
    menu.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(2)

    open_tools(table)
    handle_box = table.locator(".panel-move-handle").bounding_box()
    grid_box = page.locator(".dashboard-layout-grid").bounding_box()
    assert handle_box
    assert grid_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(grid_box["x"] + 44, grid_box["y"] + 18, steps=18)
    page.wait_for_timeout(220)
    expect(page.locator(".dashboard-group-footprint")).to_have_count(1)
    preview_row = int(page.locator(".dashboard-group-footprint").evaluate("node => node.dataset.gridRow"))
    assert preview_row == 1
    page.mouse.up()
    page.wait_for_timeout(360)

    after = {
        "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
    }
    assert min(after["table"]["row"], after["menu"]["row"]) == 1
    assert after["menu"]["col"] - after["table"]["col"] == 2
    assert after["menu"]["row"] == after["table"]["row"]
    expect(page.locator(".dashboard-group-footprint")).to_have_count(0)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_group_boundary_visuals_match_selection_during_move_and_resize(page: Page, app_server: str) -> None:
    goto(page, app_server)

    page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1) => {
            node.classList.remove("db-panel-collapsed");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            if (node.classList.contains("db-panel")) {
              const gap = parseFloat(getComputedStyle(document.querySelector(".dashboard-layout-grid")).rowGap || "16") || 16;
              const height = (rowSpan * 81) + (Math.max(0, rowSpan - 1) * gap);
              node.dataset.savedHeight = String(height);
              node.style.height = `${height}px`;
            }
          };
          document.querySelectorAll(".widget-layout > .widget-card").forEach((node, index) => place(node, 1 + (index % 6), 14 + index, 1));
          place(document.querySelector('[data-panel-key="builder-content"]'), 1, 5, 2, 2);
          place(document.querySelector('[data-panel-key="builder-menu"]'), 3, 5, 2, 2);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 5, 9, 2, 2);
          window.scrollTo(0, 0);
        }
        """
    )

    page.locator(".layout-group-button").click()
    table = page.locator('[data-panel-key="builder-content"]')
    menu = page.locator('[data-panel-key="builder-menu"]')
    table.click(position={"x": 20, "y": 20})
    menu.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(2)

    def selected_visual() -> dict:
        return page.evaluate(
            """
            () => {
              const nodes = [...document.querySelectorAll(".group-selected")];
              const rects = nodes.map((node) => {
                const rect = node.getBoundingClientRect();
                const styles = getComputedStyle(node);
                const offset = Math.max(0, parseFloat(styles.outlineOffset || "0") || 0);
                return {
                  left: rect.left - offset,
                  top: rect.top - offset,
                  right: rect.right + offset,
                  bottom: rect.bottom + offset,
                  outlineColor: styles.outlineColor,
                  outlineWidth: styles.outlineWidth,
                  outlineOffset: styles.outlineOffset,
                  borderRadius: styles.borderRadius,
                };
              });
              const left = Math.min(...rects.map((rect) => rect.left));
              const top = Math.min(...rects.map((rect) => rect.top));
              const right = Math.max(...rects.map((rect) => rect.right));
              const bottom = Math.max(...rects.map((rect) => rect.bottom));
              return {
                left,
                top,
                width: right - left,
                height: bottom - top,
                outlineColor: rects[0].outlineColor,
                outlineWidth: rects[0].outlineWidth,
                outlineOffset: rects[0].outlineOffset,
                borderRadius: rects[0].borderRadius,
                members: Object.fromEntries(nodes.map((node) => {
                  const styles = getComputedStyle(node);
                  return [node.dataset.widgetKey || node.dataset.panelKey, {
                    outlineColor: styles.outlineColor,
                    outlineWidth: styles.outlineWidth,
                    outlineOffset: styles.outlineOffset,
                  }];
                })),
              };
            }
            """
        )

    def boundary_visual(selector: str = ".dashboard-group-boundary") -> dict:
        return page.locator(selector).evaluate(
            """
            node => {
              const rect = node.getBoundingClientRect();
              const styles = getComputedStyle(node);
              return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                borderColor: styles.borderTopColor,
                borderWidth: styles.borderTopWidth,
                borderRadius: styles.borderRadius,
                boxShadow: styles.boxShadow,
              };
            }
            """
        )

    selected_before_move = selected_visual()
    open_tools(table)
    handle_box = table.locator(".panel-move-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 100, y + 45, steps=10)
    page.wait_for_timeout(180)

    expect(page.locator(".dashboard-group-live-shell")).to_have_count(1)
    move_boundary = boundary_visual(".dashboard-group-live-shell")
    assert abs(move_boundary["width"] - selected_before_move["width"]) <= 1
    assert abs(move_boundary["height"] - selected_before_move["height"]) <= 1
    assert move_boundary["borderColor"] == selected_before_move["outlineColor"]
    assert move_boundary["borderWidth"] == selected_before_move["outlineWidth"]
    assert move_boundary["borderRadius"] == selected_before_move["borderRadius"]
    assert "rgb(0, 0, 0)" not in move_boundary["borderColor"]
    page.mouse.up()
    page.wait_for_timeout(360)
    expect(page.locator(".dashboard-group-boundary")).to_have_count(0)

    selected_before_resize = selected_visual()
    open_tools(table)
    resize_box = table.locator(".panel-resize-handle").bounding_box()
    assert resize_box
    rx, ry = box_center(resize_box)
    page.mouse.move(rx, ry)
    page.mouse.down()
    page.wait_for_timeout(160)

    expect(page.locator(".dashboard-group-resize-boundary")).to_have_count(1)
    resize_boundary = boundary_visual(".dashboard-group-resize-boundary")
    assert abs(resize_boundary["width"] - selected_before_resize["width"]) <= 2
    assert abs(resize_boundary["height"] - selected_before_resize["height"]) <= 2
    assert resize_boundary["borderColor"] == selected_before_resize["outlineColor"]
    assert resize_boundary["borderWidth"] == selected_before_resize["outlineWidth"]
    assert resize_boundary["borderRadius"] == selected_before_resize["borderRadius"]

    live_styles = page.locator(".dashboard-live-resize.group-selected").evaluate_all(
        """
        nodes => nodes.map((node) => {
          const styles = getComputedStyle(node);
          return {
            key: node.dataset.widgetKey || node.dataset.panelKey,
            borderColor: styles.borderTopColor,
            outlineColor: styles.outlineColor,
            outlineWidth: styles.outlineWidth,
            outlineOffset: styles.outlineOffset,
            boxShadow: styles.boxShadow,
          };
        })
        """
    )
    assert len(live_styles) == 2
    for style in live_styles:
        member_style = selected_before_resize["members"][style["key"]]
        assert style["outlineColor"] == member_style["outlineColor"]
        assert style["outlineWidth"] == member_style["outlineWidth"]
        assert style["outlineOffset"] == member_style["outlineOffset"]
        assert "rgb(0, 0, 0)" not in style["borderColor"]
        assert "rgb(0, 0, 0)" not in style["outlineColor"]
        assert "rgba(0, 0, 0" not in style["boxShadow"]

    page.mouse.up()
    page.wait_for_timeout(360)
    expect(page.locator(".dashboard-group-boundary")).to_have_count(0)
    assert_no_resize_artifacts(page)
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
          const panel = document.querySelector('[data-panel-key="builder-content"]');
          timeframe.dataset.minW = "2";
          place(timeframe, 1, 1, 6);
          place(stat, 1, 4, 3);
          place(panel, 4, 4, 3, 3);
          panel.style.height = "275px";
          panel.dataset.savedHeight = "275";
        }
        """
    )

    page.locator(".layout-group-button").click()
    timeframe = page.locator('[data-widget-key="builder-search"]')
    stat = page.locator('[data-widget-key="widget-1"]')
    panel = page.locator('[data-panel-key="builder-content"]')
    timeframe.click(position={"x": 20, "y": 20}, force=True)
    stat.click(position={"x": 20, "y": 20}, force=True)
    panel.click(position={"x": 20, "y": 20}, force=True)
    expect(page.locator(".group-selected")).to_have_count(3)

    outline_width = stat.evaluate("node => parseFloat(getComputedStyle(node).outlineWidth)")
    assert outline_width <= 2

    open_tools(stat)
    drag_by(page, stat.locator(".panel-resize-handle"), -1000, 0, steps=18)
    page.wait_for_timeout(360)

    sizes = page.evaluate(
        """
        () => ({
          timeframe: Number(document.querySelector('[data-widget-key="builder-search"]').dataset.currentSpan),
          stat: Number(document.querySelector('[data-widget-key="widget-1"]').dataset.currentSpan),
          panel: Number(document.querySelector('[data-panel-key="builder-content"]').dataset.currentSpan),
          timeframeMin: Number(document.querySelector('[data-widget-key="builder-search"]').dataset.minW),
          panelRows: Number(document.querySelector('[data-panel-key="builder-content"]').dataset.gridRowSpan),
        })
        """
    )

    assert sizes["timeframe"] == sizes["timeframeMin"] == 2
    assert sizes["stat"] >= 1
    assert sizes["panel"] >= 1
    assert len({sizes["timeframe"], sizes["stat"], sizes["panel"]}) > 1
    assert sizes["panelRows"] >= 1
    assert_no_resize_artifacts(page)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_group_resize_uses_live_clones_snapped_previews_and_collapsed_ghost(page: Page, app_server: str) -> None:
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
          const panel = document.querySelector('[data-panel-key="builder-content"]');
          timeframe.dataset.minW = "2";
          place(timeframe, 1, 1, 6);
          place(stat, 1, 4, 2);
          place(panel, 4, 4, 3, 1);
          panel.classList.add("db-panel-collapsed");
          panel.dataset.savedHeight = "275";
          panel.style.height = "";
          panel.querySelector(".panel-collapse-toggle")?.setAttribute("aria-expanded", "false");
        }
        """
    )

    page.locator(".layout-group-button").click()
    timeframe = page.locator('[data-widget-key="builder-search"]')
    stat = page.locator('[data-widget-key="widget-1"]')
    panel = page.locator('[data-panel-key="builder-content"]')
    timeframe.click(position={"x": 20, "y": 20}, force=True)
    stat.click(position={"x": 20, "y": 20}, force=True)
    panel.click(position={"x": 20, "y": 20}, force=True)
    expect(page.locator(".group-selected")).to_have_count(3)

    before = page.evaluate(
        """
        () => {
          const state = (selector) => {
            const node = document.querySelector(selector);
            return {
              col: Number(node.dataset.gridCol),
              row: Number(node.dataset.gridRow),
              span: Number(node.dataset.currentSpan),
              rowSpan: Number(node.dataset.gridRowSpan),
            };
          };
          return {
            timeframe: state('[data-widget-key="builder-search"]'),
            stat: state('[data-widget-key="widget-1"]'),
            panel: state('[data-panel-key="builder-content"]'),
          };
        }
        """
    )

    open_tools(stat)
    handle = stat.locator(".panel-resize-handle")
    handle.scroll_into_view_if_needed()
    box = handle.bounding_box()
    assert box, "No group resize handle"
    x, y = box_center(box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - 36, y + 18, steps=4)

    micro = page.evaluate(
        """
        () => {
          const source = document.querySelector('[data-widget-key="widget-1"]');
          const live = document.querySelector('.dashboard-live-resize[data-widget-key="widget-1"]');
          const sourceRect = source.getBoundingClientRect();
          const liveRect = live.getBoundingClientRect();
          return {
            live: document.querySelectorAll(".dashboard-live-resize").length,
            preview: document.querySelectorAll(".dashboard-resize-preview").length,
            groupFootprint: document.querySelectorAll(".dashboard-group-resize-footprint").length,
            memberPreview: document.querySelectorAll(".dashboard-group-member-preview").length,
            source: document.querySelectorAll(".dashboard-resize-source").length,
            ghost: document.querySelectorAll(".dashboard-expanded-footprint-ghost").length,
            liveSelected: [...document.querySelectorAll(".dashboard-live-resize")].every((node) => node.classList.contains("group-selected")),
            sourceWidth: sourceRect.width,
            liveWidth: liveRect.width,
          };
        }
        """
    )
    assert micro["live"] == 3
    assert micro["preview"] == 4
    assert micro["groupFootprint"] == 1
    assert micro["memberPreview"] == 3
    assert micro["source"] == 3
    assert micro["ghost"] == 1
    assert micro["liveSelected"]
    assert abs(micro["liveWidth"] - micro["sourceWidth"]) > 2

    page.mouse.move(x - 420, y + 120, steps=14)
    during = page.evaluate(
        """
        () => {
          const state = (selector) => {
            const node = document.querySelector(selector);
            return {
              col: Number(node.dataset.gridCol),
              row: Number(node.dataset.gridRow),
              span: Number(node.dataset.currentSpan),
              rowSpan: Number(node.dataset.gridRowSpan),
            };
          };
          return {
            originals: {
              timeframe: state('[data-widget-key="builder-search"]'),
              stat: state('[data-widget-key="widget-1"]'),
              panel: state('[data-panel-key="builder-content"]'),
            },
            previewSpans: [...document.querySelectorAll(".dashboard-resize-preview")].map((node) => Number(node.dataset.currentSpan)),
          };
        }
        """
    )
    assert during["originals"] == before
    assert any(span not in {2, 3, 6} for span in during["previewSpans"])

    page.mouse.up()
    page.wait_for_timeout(360)
    after = {
        "timeframe": grid_item_state(page, '[data-widget-key="builder-search"]'),
        "stat": grid_item_state(page, '[data-widget-key="widget-1"]'),
        "panel": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }

    assert after["timeframe"]["span"] >= 2
    assert after["stat"]["span"] >= 1
    assert after["panel"]["rowSpan"] == 1
    assert_no_resize_artifacts(page)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_group_resize_composite_footprint_pushes_surrounding_items(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1) => {
            node.classList.remove("db-panel-collapsed");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            const gap = parseFloat(getComputedStyle(document.querySelector(".dashboard-layout-grid")).rowGap || "16") || 16;
            const height = (rowSpan * 81) + (Math.max(0, rowSpan - 1) * gap);
            node.dataset.savedHeight = String(height);
            node.style.height = `${height}px`;
          };
          place(document.querySelector('[data-panel-key="builder-content"]'), 1, 4, 2, 2);
          place(document.querySelector('[data-panel-key="builder-menu"]'), 3, 4, 2, 2);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 1, 7, 4, 2);
        }
        """
    )

    page.locator(".layout-group-button").click()
    table = page.locator('[data-panel-key="builder-content"]')
    menu = page.locator('[data-panel-key="builder-menu"]')
    blocker = page.locator('[data-panel-key="builder-notes"]')
    table.click(position={"x": 20, "y": 20})
    menu.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(2)

    before = {
        "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "blocker": grid_item_state(page, '[data-panel-key="builder-notes"]'),
    }

    open_tools(table)
    handle = table.locator(".panel-resize-handle")
    handle_box = handle.bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 260, y + 220, steps=16)
    page.wait_for_timeout(220)

    during = page.evaluate(
        """
        () => {
          const state = (selector) => {
            const node = document.querySelector(selector);
            return {
              col: Number(node.dataset.gridCol),
              row: Number(node.dataset.gridRow),
              span: Number(node.dataset.currentSpan),
              rowSpan: Number(node.dataset.gridRowSpan),
            };
          };
          const footprint = document.querySelector(".dashboard-group-resize-footprint");
          return {
            originals: {
              table: state('[data-panel-key="builder-content"]'),
              menu: state('[data-panel-key="builder-menu"]'),
            },
            blocker: state('[data-panel-key="builder-notes"]'),
            live: document.querySelectorAll(".dashboard-live-resize").length,
            memberPreview: document.querySelectorAll(".dashboard-group-member-preview").length,
            footprint: document.querySelectorAll(".dashboard-group-resize-footprint").length,
            footprintSpan: Number(footprint.dataset.currentSpan),
            footprintRows: Number(footprint.dataset.gridRowSpan),
          };
        }
        """
    )
    assert during["originals"]["table"] == {key: before["table"][key] for key in ("col", "row", "span", "rowSpan")}
    assert during["originals"]["menu"] == {key: before["menu"][key] for key in ("col", "row", "span", "rowSpan")}
    assert during["live"] == 2
    assert during["memberPreview"] == 2
    assert during["footprint"] == 1
    assert during["footprintSpan"] >= 4
    assert during["footprintRows"] > 2
    assert during["blocker"]["row"] > before["blocker"]["row"]

    page.mouse.up()
    page.wait_for_timeout(360)
    after = {
        "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "blocker": grid_item_state(page, '[data-panel-key="builder-notes"]'),
    }
    assert after["menu"]["col"] > after["table"]["col"]
    assert after["menu"]["row"] == after["table"]["row"]
    assert after["blocker"]["row"] > before["blocker"]["row"]
    assert_no_resize_artifacts(page)
    expect(page.locator(".dashboard-group-resize-footprint")).to_have_count(0)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_group_resize_expanded_ghost_is_visual_only_for_collision(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const grid = document.querySelector(".dashboard-layout-grid");
          const gap = parseFloat(getComputedStyle(grid).rowGap || "16") || 16;
          const place = (node, col, row, span, rowSpan = 1, collapsed = false) => {
            node.classList.toggle("db-panel-collapsed", collapsed);
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(collapsed ? 1 : rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${collapsed ? 1 : rowSpan}`;
            const height = (rowSpan * 81) + (Math.max(0, rowSpan - 1) * gap);
            node.dataset.savedHeight = String(height);
            node.style.height = collapsed ? "" : `${height}px`;
          };
          const widget = document.querySelector('[data-widget-key="widget-1"]');
          widget.dataset.gridCol = "1";
          widget.dataset.gridRow = "1";
          widget.dataset.currentSpan = "2";
          widget.dataset.gridRowSpan = "1";
          widget.style.gridColumn = "1 / span 2";
          widget.style.gridRow = "1 / span 1";
          place(document.querySelector('[data-panel-key="builder-menu"]'), 1, 4, 2, 5, true);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 1, 6, 2, 3, false);
          place(document.querySelector('[data-panel-key="builder-content"]'), 4, 6, 2, 3, false);
        }
        """
    )

    page.locator(".layout-group-button").click()
    widget = page.locator('[data-widget-key="widget-1"]')
    collapsed = page.locator('[data-panel-key="builder-menu"]')
    blocker = page.locator('[data-panel-key="builder-notes"]')
    widget.click(position={"x": 20, "y": 20}, force=True)
    collapsed.click(position={"x": 20, "y": 20}, force=True)
    expect(page.locator(".group-selected")).to_have_count(2)

    before_blocker = grid_item_state(page, '[data-panel-key="builder-notes"]')
    before_collapsed = grid_item_state(page, '[data-panel-key="builder-menu"]')

    open_tools(collapsed)
    handle_box = collapsed.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 8, y + 300, steps=18)
    page.wait_for_timeout(240)

    during = page.evaluate(
        """
        () => {
          const blocker = document.querySelector('[data-panel-key="builder-notes"]');
          const collapsed = document.querySelector('[data-panel-key="builder-menu"]');
          const ghost = document.querySelector(".dashboard-expanded-footprint-ghost");
          const blockerRect = blocker.getBoundingClientRect();
          const ghostRect = ghost?.getBoundingClientRect();
          return {
            ghostCount: document.querySelectorAll(".dashboard-expanded-footprint-ghost").length,
            ghostOverlapsBlocker: Boolean(ghostRect) &&
              ghostRect.left < blockerRect.right &&
              ghostRect.right > blockerRect.left &&
              ghostRect.top < blockerRect.bottom &&
              ghostRect.bottom > blockerRect.top,
            blocker: {
              col: Number(blocker.dataset.gridCol),
              row: Number(blocker.dataset.gridRow),
              rowSpan: Number(blocker.dataset.gridRowSpan),
            },
            collapsedRows: Number(collapsed.dataset.gridRowSpan),
            previewRows: [...document.querySelectorAll(".dashboard-group-member-preview")]
              .map((node) => Number(node.dataset.gridRowSpan)),
          };
        }
        """
    )
    assert during["ghostCount"] == 1
    assert during["ghostOverlapsBlocker"] is True
    assert during["blocker"]["row"] == before_blocker["row"]
    assert during["blocker"]["rowSpan"] == before_blocker["rowSpan"]
    assert during["collapsedRows"] == before_collapsed["rowSpan"] == 1
    assert 1 in during["previewRows"]

    page.mouse.up()
    page.wait_for_timeout(420)
    after_blocker = grid_item_state(page, '[data-panel-key="builder-notes"]')
    after_collapsed = grid_item_state(page, '[data-panel-key="builder-menu"]')
    assert grid_state_tuple(after_blocker) == grid_state_tuple(before_blocker)
    assert after_collapsed["rowSpan"] == 1
    assert_no_resize_artifacts(page)
    expect(page.locator(".dashboard-expanded-footprint-ghost")).to_have_count(0)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_group_resize_preserves_stacked_panel_spacing(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1) => {
            node.classList.remove("db-panel-collapsed");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            const gap = parseFloat(getComputedStyle(document.querySelector(".dashboard-layout-grid")).rowGap || "16") || 16;
            const height = (rowSpan * 81) + (Math.max(0, rowSpan - 1) * gap);
            node.dataset.savedHeight = String(height);
            node.style.height = `${height}px`;
          };
          document.querySelectorAll(".widget-layout > .widget-card").forEach((node, index) => {
            node.dataset.gridCol = String(1 + (index % 6));
            node.dataset.gridRow = String(18 + index);
            node.dataset.currentSpan = "1";
            node.dataset.gridRowSpan = "1";
            node.style.gridColumn = `${1 + (index % 6)} / span 1`;
            node.style.gridRow = `${18 + index} / span 1`;
          });
          place(document.querySelector('[data-panel-key="builder-menu"]'), 1, 4, 2, 2);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 1, 7, 2, 2);
          place(document.querySelector('[data-panel-key="builder-content"]'), 1, 10, 2, 2);
        }
        """
    )

    page.locator(".layout-group-button").click()
    menu = page.locator('[data-panel-key="builder-menu"]')
    notes = page.locator('[data-panel-key="builder-notes"]')
    table = page.locator('[data-panel-key="builder-content"]')
    menu.click(position={"x": 20, "y": 20})
    notes.click(position={"x": 20, "y": 20})
    table.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(3)

    before = page.evaluate(
        """
        () => {
          const rows = ["builder-menu", "builder-notes", "builder-content"].map((key) => Number(document.querySelector(`[data-panel-key="${key}"]`).dataset.gridRow));
          const tops = ["builder-menu", "builder-notes", "builder-content"].map((key) => document.querySelector(`[data-panel-key="${key}"]`).getBoundingClientRect().top);
          return { rows, tops, rowGaps: [rows[1] - rows[0], rows[2] - rows[1]], topGaps: [tops[1] - tops[0], tops[2] - tops[1]] };
        }
        """
    )

    open_tools(menu)
    handle_box = menu.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 330, y + 12, steps=16)
    page.wait_for_timeout(220)

    during = page.evaluate(
        """
        () => {
          const originalRows = ["builder-menu", "builder-notes", "builder-content"].map((key) => Number(document.querySelector(`[data-panel-key="${key}"]`).dataset.gridRow));
          const previewRows = [...document.querySelectorAll(".dashboard-group-member-preview")]
            .sort((a, b) => Number(a.dataset.gridRow) - Number(b.dataset.gridRow))
            .map((node) => Number(node.dataset.gridRow));
          const liveTops = [...document.querySelectorAll(".dashboard-live-resize")]
            .map((node) => node.getBoundingClientRect().top)
            .sort((a, b) => a - b);
          return {
            originalRows,
            previewRows,
            previewGaps: [previewRows[1] - previewRows[0], previewRows[2] - previewRows[1]],
            liveGaps: [liveTops[1] - liveTops[0], liveTops[2] - liveTops[1]],
            liveCount: liveTops.length,
            footprint: document.querySelectorAll(".dashboard-group-resize-footprint").length,
          };
        }
        """
    )
    assert during["originalRows"] == before["rows"]
    assert during["liveCount"] == 3
    assert during["previewGaps"] == before["rowGaps"]
    assert during["footprint"] == 1
    assert abs(during["liveGaps"][0] - before["topGaps"][0]) <= 1
    assert abs(during["liveGaps"][1] - before["topGaps"][1]) <= 1

    page.mouse.up()
    page.wait_for_timeout(360)
    after_rows = page.evaluate(
        """
        () => ["builder-menu", "builder-notes", "builder-content"].map((key) => Number(document.querySelector(`[data-panel-key="${key}"]`).dataset.gridRow))
        """
    )
    assert [after_rows[1] - after_rows[0], after_rows[2] - after_rows[1]] == before["rowGaps"]
    assert_no_resize_artifacts(page)
    expect(page.locator(".dashboard-group-resize-footprint")).to_have_count(0)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)


def test_group_resize_vertical_growth_extends_open_panel_members(page: Page, app_server: str) -> None:
    goto(page, app_server)
    page.evaluate(
        """
        () => {
          const place = (node, col, row, span, rowSpan = 1) => {
            node.classList.remove("db-panel-collapsed");
            node.dataset.gridCol = String(col);
            node.dataset.gridRow = String(row);
            node.dataset.currentSpan = String(span);
            node.dataset.gridRowSpan = String(rowSpan);
            node.style.gridColumn = `${col} / span ${span}`;
            node.style.gridRow = `${row} / span ${rowSpan}`;
            const gap = parseFloat(getComputedStyle(document.querySelector(".dashboard-layout-grid")).rowGap || "16") || 16;
            const height = (rowSpan * 81) + (Math.max(0, rowSpan - 1) * gap);
            node.dataset.savedHeight = String(height);
            node.style.height = `${height}px`;
          };
          document.querySelectorAll(".widget-layout > .widget-card").forEach((node, index) => {
            node.dataset.gridCol = String(1 + (index % 6));
            node.dataset.gridRow = String(22 + index);
            node.dataset.currentSpan = "1";
            node.dataset.gridRowSpan = "1";
            node.style.gridColumn = `${1 + (index % 6)} / span 1`;
            node.style.gridRow = `${22 + index} / span 1`;
          });
          place(document.querySelector('[data-panel-key="builder-menu"]'), 1, 4, 2, 2);
          place(document.querySelector('[data-panel-key="builder-notes"]'), 1, 7, 2, 2);
          place(document.querySelector('[data-panel-key="builder-content"]'), 1, 10, 2, 2);
        }
        """
    )

    page.locator(".layout-group-button").click()
    menu = page.locator('[data-panel-key="builder-menu"]')
    notes = page.locator('[data-panel-key="builder-notes"]')
    table = page.locator('[data-panel-key="builder-content"]')
    menu.click(position={"x": 20, "y": 20})
    notes.click(position={"x": 20, "y": 20})
    table.click(position={"x": 20, "y": 20})
    expect(page.locator(".group-selected")).to_have_count(3)

    before = {
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }

    open_tools(menu)
    handle_box = menu.locator(".panel-resize-handle").bounding_box()
    assert handle_box
    x, y = box_center(handle_box)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 18, y + 300, steps=18)
    page.wait_for_timeout(240)

    during = page.evaluate(
        """
        () => {
          const sourceRows = ["builder-menu", "builder-notes", "builder-content"].map((key) => Number(document.querySelector(`[data-panel-key="${key}"]`).dataset.gridRowSpan));
          const previews = [...document.querySelectorAll(".dashboard-group-member-preview")]
            .sort((a, b) => Number(a.dataset.gridRow) - Number(b.dataset.gridRow))
            .map((node) => ({
              row: Number(node.dataset.gridRow),
              rowSpan: Number(node.dataset.gridRowSpan),
              savedHeight: Number(node.dataset.savedHeight || 0),
              rectHeight: Math.round(node.getBoundingClientRect().height),
              bottom: Number(node.dataset.gridRow) + Number(node.dataset.gridRowSpan) - 1,
            }));
          const live = [...document.querySelectorAll(".dashboard-live-resize")]
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
            .map((node) => Math.round(node.getBoundingClientRect().height));
          const footprint = document.querySelector(".dashboard-group-resize-footprint");
          return {
            sourceRows,
            previews,
            live,
            footprintRows: Number(footprint.dataset.gridRowSpan),
            footprintBottom: Number(footprint.dataset.gridRow) + Number(footprint.dataset.gridRowSpan) - 1,
            previewBottom: Math.max(...previews.map((preview) => preview.bottom)),
          };
        }
        """
    )
    assert during["sourceRows"] == [2, 2, 2]
    assert during["footprintRows"] > 8
    assert len(during["previews"]) == 3
    assert all(preview["rowSpan"] > 2 for preview in during["previews"])
    assert all(preview["rectHeight"] == preview["savedHeight"] for preview in during["previews"])
    assert max(during["live"]) > before["table"]["height"] + 150
    assert during["previewBottom"] == during["footprintBottom"]

    page.mouse.up()
    page.wait_for_timeout(420)
    after = {
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert all(after[key]["rowSpan"] > before[key]["rowSpan"] for key in after)
    assert all(after[key]["height"] > before[key]["height"] for key in after)
    assert after["table"]["row"] + after["table"]["rowSpan"] - 1 == max(
        item["row"] + item["rowSpan"] - 1 for item in after.values()
    )
    assert_no_resize_artifacts(page)
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []

    page.locator(".layout-save-button").click()
    expect(page.locator(".toast", has_text="saved")).to_be_visible()
    page.reload(wait_until="networkidle")
    reloaded = {
        "menu": grid_item_state(page, '[data-panel-key="builder-menu"]'),
        "notes": grid_item_state(page, '[data-panel-key="builder-notes"]'),
        "table": grid_item_state(page, '[data-panel-key="builder-content"]'),
    }
    assert {key: reloaded[key]["rowSpan"] for key in reloaded} == {key: after[key]["rowSpan"] for key in after}
    assert {key: reloaded[key]["height"] for key in reloaded} == {key: after[key]["height"] for key in after}
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
            table: panelLayout.querySelector('[data-panel-key="builder-content"]'),
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
    expect(page.locator(".dash-switch-hero")).to_contain_text("Workspace User")
    page.locator(".dash-switch-hero").click()
    expect(page.locator(".dash-switch-menu")).to_have_class(re.compile("open"))
    expect(page.locator(".dash-switch-menu")).to_contain_text("QA Dashboard")
    assert_clean_browser(page)


@pytest.mark.responsive
@skip_responsive_during_desktop_iteration
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
    assert no_visible_overlaps(page, ".dashboard-layout-grid .widget-card, .dashboard-layout-grid .db-panel") == []
    assert_clean_browser(page)
