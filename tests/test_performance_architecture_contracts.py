from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")
DASHBOARD_CSS = (ROOT / "app" / "static" / "dashboard-grid.css").read_text(encoding="utf-8")
THEMES_CSS = (ROOT / "app" / "static" / "themes.css").read_text(encoding="utf-8")
PERFORMANCE_PLAN = (ROOT / "docs" / "performance-stabilization-plan.md").read_text(encoding="utf-8")


def test_visual_reflow_is_viewport_aware_without_changing_layout_commit_paths():
    for name in (
        "WORKSPACE_VISUAL_LOD_TIERS",
        "WORKSPACE_VISUAL_LOD_OVERSCAN",
        "workspaceVisualLodForItem",
        "gridItemDocumentBounds",
        "shouldAnimateGridReflowItem",
        "scheduleWorkspaceVisualLodRefresh",
    ):
        assert name in APP_JS

    reflow_body = APP_JS[
        APP_JS.index("const animateOrderedGridReflow"):
        APP_JS.index("const insertItemAtOrderedIndex")
    ]
    assert "getBoundingClientRect" in reflow_body
    assert "shouldAnimateGridReflowItem" in reflow_body
    assert "update();" in reflow_body
    assert "scheduleWorkspaceVisualLodRefresh" in reflow_body


def test_collision_queries_use_spatial_row_buckets_for_large_occupied_sets():
    for name in (
        "SPATIAL_INDEX_MIN_ENTRIES",
        "occupancyIndexCache",
        "indexedCollisionEntries",
    ):
        assert name in APP_JS

    can_place_body = APP_JS[
        APP_JS.index("const canPlaceBounds"):
        APP_JS.index("const nearestSparseSlot")
    ]
    assert "indexedCollisionEntries(bounds, occupied)" in can_place_body
    assert "occupied.some" not in can_place_body


def test_sparse_resolution_uses_cached_logical_geometry_records():
    for name in (
        "layoutItemsForLogicalResolution",
        "createGridGeometryRecords",
        "gridGeometryEntry",
        "gridGeometryEntriesForItems",
    ):
        assert name in APP_JS

    sparse_body = APP_JS[
        APP_JS.index("const resolveSparseGridLayout"):
        APP_JS.index("const resolveActiveDropSlot")
    ]
    assert "items: options.items" in sparse_body
    assert "createGridGeometryRecords(items, metrics)" in sparse_body
    assert "gridGeometryEntry(item, records, metrics).bounds" in sparse_body
    assert "gridGeometryEntriesForItems(" in sparse_body


def test_visual_lod_css_reduces_far_offscreen_render_cost_only():
    for tier in ('data-lod="active"', 'data-lod="near"', 'data-lod="far"', 'data-visual-lod="far"'):
        assert tier in THEMES_CSS

    assert "dataset.lod" in APP_JS
    assert 'item.matches?.(":focus-within")' in APP_JS
    assert 'item.classList.contains("group-selected")' in APP_JS
    assert "document.addEventListener(\"focusin\"" in APP_JS
    assert ".workspace-anchor-layer > .workspace-anchor-object:not([hidden])" in APP_JS
    assert "--workspace-lod-near-shadow" in THEMES_CSS
    assert "--workspace-lod-far-shadow" in THEMES_CSS
    assert "backdrop-filter: none" in THEMES_CSS
    assert "transition: var(--workspace-lod-far-transition)" in THEMES_CSS
    assert "transform: none !important" in THEMES_CSS
    assert ":not(.widget-dragging)" in THEMES_CSS
    assert ":not(.dashboard-active-resize)" in THEMES_CSS
    assert ":not(.group-selected)" in THEMES_CSS


def test_performance_pass_two_is_documented():
    assert "Performance Pass #2" in PERFORMANCE_PLAN
    assert "Viewport-aware visual reflow" in PERFORMANCE_PLAN
    assert "Visual LOD" in PERFORMANCE_PLAN
    assert "Spatial indexing" in PERFORMANCE_PLAN
