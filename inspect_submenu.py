import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.goto("http://127.0.0.1:5000/dashboard", wait_until="networkidle")
    page.wait_for_selector(".panel-add-button")

    # Hard refresh to pick up updated CSS (utilities.css)
    page.evaluate("location.reload(true)")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector(".panel-add-button")

    # Open Add Object menu
    page.locator(".panel-add-button").click()
    page.wait_for_selector(".panel-add-menu.open", timeout=3000)

    # Hover Visualization to open its submenu
    vis = page.locator('.object-add-category[data-object-menu-category="visualization"]')
    vis.locator(".object-add-category-trigger").hover()
    page.wait_for_timeout(350)

    submenu_info = vis.locator(":scope > .object-add-submenu").evaluate("""
        el => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
                visible: r.height > 0 && r.width > 0,
                height: Math.round(r.height),
                width: Math.round(r.width),
                right: Math.round(r.right),
                bottom: Math.round(r.bottom),
                viewportHeight: window.innerHeight,
                viewportWidth: window.innerWidth,
                overflowY: cs.overflowY,
                overflowX: cs.overflowX,
                maxHeight: cs.maxHeight,
                hasVertScrollbar: el.scrollHeight > el.clientHeight,
                hasHorizScrollbar: el.scrollWidth > el.clientWidth
            }
        }
    """)
    print("=== Visualization submenu ===")
    print(json.dumps(submenu_info, indent=2))

    # Hover Charts nested subcategory
    charts = vis.locator('.object-add-subcategory[data-object-add-subcategory="Charts"]')
    charts.locator(".object-add-subcategory-trigger").hover()
    page.wait_for_timeout(350)

    chart_info = charts.locator(":scope > .object-add-submenu").evaluate("""
        el => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
                visible: r.height > 0 && r.width > 0,
                height: Math.round(r.height),
                width: Math.round(r.width),
                right: Math.round(r.right),
                bottom: Math.round(r.bottom),
                viewportHeight: window.innerHeight,
                viewportWidth: window.innerWidth,
                overflowY: cs.overflowY,
                overflowX: cs.overflowX,
                maxHeight: cs.maxHeight,
                hasVertScrollbar: el.scrollHeight > el.clientHeight,
                hasHorizScrollbar: el.scrollWidth > el.clientWidth
            }
        }
    """)
    print("=== Charts nested submenu ===")
    print(json.dumps(chart_info, indent=2))

    # Screenshot
    import os
    os.makedirs("test-results", exist_ok=True)
    page.screenshot(path="test-results/submenu-inspection.png")
    print("Screenshot: test-results/submenu-inspection.png")

    # Also check identity/profile selector
    page.locator(".dash-switch-hero").hover()
    page.wait_for_timeout(300)
    dash_info = page.locator("#dash-switch-menu").evaluate("""
        el => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
                visible: r.height > 0 && r.width > 0,
                height: Math.round(r.height),
                width: Math.round(r.width),
                overflowY: cs.overflowY,
                overflowX: cs.overflowX,
                background: cs.background.substring(0, 60),
                portaled: el.dataset.menuPortaled === 'true',
                hasOpenClass: el.classList.contains('open'),
                hasNavMenuShell: el.classList.contains('nav-menu-shell'),
                hasGlassMenu: el.classList.contains('floating-glass-menu')
            }
        }
    """)
    print("=== Profile/identity selector ===")
    print(json.dumps(dash_info, indent=2))

    browser.close()
