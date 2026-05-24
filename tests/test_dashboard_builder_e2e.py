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
    is_open = item.evaluate(
        """
        node => node.classList.contains("widget-tools-open") || node.classList.contains("db-panel-tools-open")
        """
    )
    if not is_open:
        item.locator(".panel-settings-toggle").click(force=True)
    expect(item.locator(".panel-tool-drawer")).to_be_visible()


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
    assert len(positive_scroll) >= 4, samples
    assert max(positive_scroll) < 44, samples
    if positive_extension:
        assert max(positive_extension) < 72, samples


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
    expect(page.locator("#panel-delete-dialog")).to_be_visible()
    page.locator(".confirm-dialog-danger").click()
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


def test_background_palette_hover_previews_without_saving(page: Page, app_server: str) -> None:
    goto(page, app_server)
    root = page.locator("html")
    expect(root).to_have_attribute("data-background", "frosted-light")

    page.locator(".background-tone-trigger").first.click()
    for tone in [
        "medium-cool-grey",
        "darker-soft-grey",
        "slate-grey",
        "graphite-grey",
        "blue-slate",
        "neutral-dim",
        "stone-grey",
        "industrial-grey",
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
          return [
            "medium-cool-grey",
            "darker-soft-grey",
            "slate-grey",
            "graphite-grey",
            "blue-slate",
            "neutral-dim",
            "stone-grey",
            "industrial-grey",
          ].map((tone) => {
            document.documentElement.dataset.background = tone;
            const bg = toRgb(getComputedStyle(document.documentElement).getPropertyValue("--bg"));
            return { tone, bg, max: Math.max(...bg), min: Math.min(...bg) };
          });
        }
        """
    )
    assert len({tuple(entry["bg"]) for entry in palette}) == len(palette)
    assert max(entry["max"] for entry in palette) <= 208
    assert min(entry["min"] for entry in palette) <= 174

    page.evaluate("document.documentElement.dataset.background = 'frosted-light'")
    preview = page.locator('.background-tone-option[data-background-mode="light"][data-background-tone="graphite-grey"]').first
    preview.hover()
    expect(root).to_have_attribute("data-background", "graphite-grey")
    assert page.evaluate("localStorage.getItem('dashboard-background-light')") is None

    page.locator(".workspace-identity-island").hover()
    expect(root).to_have_attribute("data-background", "frosted-light")
    assert page.evaluate("localStorage.getItem('dashboard-background-light')") is None

    focus_preview = page.locator('.background-tone-option[data-background-mode="light"][data-background-tone="blue-slate"]').first
    focus_preview.focus()
    expect(root).to_have_attribute("data-background", "blue-slate")
    assert page.evaluate("localStorage.getItem('dashboard-background-light')") is None
    page.locator(".dash-switch-hero").focus()
    expect(root).to_have_attribute("data-background", "frosted-light")

    page.locator('.background-tone-option[data-background-mode="light"][data-background-tone="slate-grey"]').first.click()
    expect(root).to_have_attribute("data-background", "slate-grey")
    assert page.evaluate("localStorage.getItem('dashboard-background-light')") == "slate-grey"
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
    for label in ("Stat", "Stat + Filter", "Graph", "Table", "Calendar", "Panel"):
        expect(page.locator(".panel-add-menu")).to_contain_text(label)
    expect(page.locator(".panel-add-menu")).not_to_contain_text("Context Panel")

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
          const empty = getComputedStyle(document.querySelector(".panel-empty-state"));
          const emptyAction = getComputedStyle(document.querySelector(".panel-empty-action"));
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
            emptyBorder: empty.borderTopColor,
            emptyBorderRgb: toRgb(empty.borderTopColor),
            emptyActionBorder: emptyAction.borderTopColor,
            emptyActionBorderRgb: toRgb(emptyAction.borderTopColor),
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
    empty_border = styles["emptyBorderRgb"]
    empty_action_border = styles["emptyActionBorderRgb"]
    timeframe_border = styles["timeframeBorderRgb"]
    assert styles["accent"].lower() == "#86acd2"
    if stat_border:
        assert max(stat_border) <= 190
        assert stat_border[2] - stat_border[0] <= 65
    if panel_border:
        assert max(panel_border) <= 160
    for name, border in (("empty", empty_border), ("empty action", empty_action_border), ("timeframe", timeframe_border)):
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
            if key == "widget":
                assert state[key]["outlineOffset"] == state["panel"]["outlineOffset"]
            else:
                assert state[key]["outlineOffset"] <= 0
        assert "103, 169, 255" not in state[key]["boxShadow"]
        assert "147, 197, 253" not in state[key]["boxShadow"]
        assert "0 0 18px" not in state[key]["boxShadow"]
        assert "0 0 24px" not in state[key]["boxShadow"]

    assert state["widget"]["outlineColor"] == state["panel"]["outlineColor"]
    assert state["widget"]["outlineWidth"] == state["panel"]["outlineWidth"]
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


@pytest.mark.parametrize("theme", ["light", "dark"])
def test_timeframe_resize_clamps_to_adaptive_density_minimum(page: Page, app_server: str, theme: str) -> None:
    goto(page, app_server)
    if theme == "dark":
        page.locator(".theme-toggle").click()
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")
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
    assert preview_span == 3
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

    assert before["span"] == 5
    assert state["span"] == state["minW"] == 3
    assert state["gridColumn"] == "span 3"
    assert state["surfaceGap"] <= 6
    assert state["presetMinWidth"] <= 54
    assert state["selectorMinWidth"] <= 88
    assert state["iconWidth"] >= 32
    assert state["iconHeight"] >= 32
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
    page.set_viewport_size({"width": 1100, "height": 620})
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
          widgets.forEach((node, index) => setGrid(node, 1 + index, 1, 1));
          const notes = document.querySelector('[data-panel-key="builder-notes"]');
          const menu = document.querySelector('[data-panel-key="builder-menu"]');
          const table = document.querySelector('[data-panel-key="builder-content"]');
          [notes, menu, table].forEach((node) => {
            node.classList.add("db-panel-collapsed");
            node.querySelector(".db-panel-hd")?.setAttribute("aria-expanded", "false");
            node.style.height = "";
          });
          setGrid(notes, 1, 3, 2, 1, 760);
          setGrid(menu, 3, 3, 2, 1, 260);
          setGrid(table, 5, 3, 2, 1, 260);
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

    page.locator(".theme-toggle").click()
    page.wait_for_timeout(250)
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    expanded_dark = horizontal_metrics()
    assert expanded_dark["overflows"] is True
    assert expanded_dark["rootScrollWidth"] <= expanded_dark["clientWidth"]
    assert expanded_dark["bodyScrollWidth"] <= expanded_dark["bodyClientWidth"]
    assert expanded_dark["rootBackground"] != "none"
    assert expanded_dark["rootBackground"] == expanded_dark["bodyBackground"]
    assert expanded_dark["bodyScrollbarBackground"] == "rgba(0, 0, 0, 0)"
    assert expanded_dark["bodyScrollbarTrack"] == "rgba(0, 0, 0, 0)"
    assert expanded_dark["bodyScrollbarCorner"] == "rgba(0, 0, 0, 0)"
    assert "rgba(0, 0, 0, 0)" in expanded_dark["bodyScrollbarColor"]
    assert abs(expanded_dark["gridLeft"] - collapsed_before["gridLeft"]) <= 1
    assert abs(expanded_dark["gridWidth"] - collapsed_before["gridWidth"]) <= 1
    assert abs(expanded_dark["pageLeft"] - collapsed_before["pageLeft"]) <= 1
    assert abs(expanded_dark["pageWidth"] - collapsed_before["pageWidth"]) <= 1

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

    widget.hover()
    widget.evaluate("node => node.classList.add('widget-tools-open')")
    expect(widget.locator(".panel-tool-drawer")).to_be_visible()
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


@pytest.mark.parametrize("theme", ["light", "dark"])
def test_panel_chevron_size_stays_stable_across_expand_collapse_states(page: Page, app_server: str, theme: str) -> None:
    goto(page, app_server)
    if theme == "dark":
        page.locator(".theme-toggle").click()
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")

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


@pytest.mark.parametrize("theme", ["light", "dark"])
def test_default_panel_header_titles_do_not_shift_across_expand_collapse(page: Page, app_server: str, theme: str) -> None:
    goto(page, app_server)
    if theme == "dark":
        page.locator(".theme-toggle").click()
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")

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
          const panel = document.querySelector('[data-panel-key="builder-content"]');
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

    widget.evaluate("node => node.classList.add('widget-tools-open')")
    expect(widget.locator(".panel-tool-drawer")).to_be_visible()
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


@pytest.mark.parametrize("theme", ["light", "dark"])
def test_group_boundary_visuals_match_selection_during_move_and_resize(page: Page, app_server: str, theme: str) -> None:
    goto(page, app_server)
    if theme == "dark":
        page.locator(".theme-toggle").click()
        expect(page.locator("html")).to_have_attribute("data-theme", "dark")

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
          timeframe.dataset.minW = "3";
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
    panel = page.locator('[data-panel-key="builder-content"]')
    timeframe.click(position={"x": 20, "y": 20}, force=True)
    stat.click(position={"x": 20, "y": 20}, force=True)
    panel.click(position={"x": 20, "y": 20}, force=True)
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
          panel: Number(document.querySelector('[data-panel-key="builder-content"]').dataset.currentSpan),
          timeframeMin: Number(document.querySelector('[data-widget-key="builder-search"]').dataset.minW),
          panelRows: Number(document.querySelector('[data-panel-key="builder-content"]').dataset.gridRowSpan),
        })
        """
    )

    assert sizes["timeframe"] == sizes["timeframeMin"] == 3
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
          timeframe.dataset.minW = "3";
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

    assert after["timeframe"]["span"] >= 3
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

    table.evaluate("node => node.classList.add('db-panel-tools-open')")
    expect(table.locator(".panel-tool-drawer")).to_be_visible()
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
