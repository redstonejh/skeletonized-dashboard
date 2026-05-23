import math
import re

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
    page.locator(".panel-add-action").evaluate("node => node.click()")
    panel = page.locator('.panel-layout > .db-panel[data-custom-panel="true"]').last
    expect(panel).to_be_visible()
    return panel


def add_widget_for_setup(page: Page):
    page.locator(".widget-add-action").evaluate("node => node.click()")
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
          col: Number(node.dataset.gridCol || 0),
          row: Number(node.dataset.gridRow || 0),
          span: Number(node.dataset.currentSpan || node.dataset.defaultSpan || 1),
          rowSpan: Number(node.dataset.gridRowSpan || 1),
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
    page.locator(".panel-add-action").click()
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
    panel.locator(".panel-pin-toggle").click(force=True)
    expect(panel).not_to_have_class(re.compile("db-panel-pinned"))

    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    expect(panel).not_to_have_class(re.compile("db-panel-collapsed"))
    panel.locator(".db-panel-hd").click(position={"x": 18, "y": 18})
    expect(panel).to_have_class(re.compile("db-panel-collapsed"))

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
    widget.locator(".panel-pin-toggle").click(force=True)

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
    assert moved["col"] >= 4
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
          return {
            panel: centerDelta(document.querySelector(".panel-layout > .db-panel .panel-settings-toggle")),
            widget: centerDelta(document.querySelector(".widget-layout > .stat-card.widget-card:not(.range-bar) .panel-settings-toggle")),
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
