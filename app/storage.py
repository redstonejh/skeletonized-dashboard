import json
from dataclasses import asdict
from typing import Any

from app.database import get_connection
from app.models import Dashboard, LayoutProfile, Panel, Widget, utc_now


DEFAULT_WIDGETS = [
    Widget(key="search-controls", title="Search", value="", widget_type="controls", span=6, color="#2563eb"),
    Widget(key="widget-1", title="Widget 1", value="0", span=1, color="#2563eb"),
    Widget(key="widget-2", title="Widget 2", value="0", span=1, color="#16a34a"),
    Widget(key="widget-3", title="Widget 3", value="0", span=1, color="#d97706"),
    Widget(key="widget-4", title="Widget 4", value="0", span=1, color="#9333ea"),
]

DEFAULT_PANELS = [
    Panel(key="panel-table", title="Table", color="#2563eb", span=3),
    Panel(key="panel-menu", title="Menu", color="#16a34a", span=2, collapsed=True),
    Panel(key="panel-notes", title="Notes", color="#9333ea", span=1),
]


def get_dashboard(dashboard_id: str = "default") -> Dashboard:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM dashboards WHERE id = ?", (dashboard_id,)).fetchone()
    if not row:
        dashboard = Dashboard(id=dashboard_id)
        save_dashboard(dashboard)
        return dashboard
    return Dashboard(
        id=row["id"],
        title=row["title"],
        description=row["description"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def save_dashboard(dashboard: Dashboard) -> None:
    dashboard.updated_at = utc_now()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO dashboards(id, title, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                updated_at = excluded.updated_at
            """,
            (
                dashboard.id,
                dashboard.title,
                dashboard.description,
                dashboard.created_at,
                dashboard.updated_at,
            ),
        )


def list_widgets(dashboard_id: str = "default") -> list[Widget]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM widgets WHERE dashboard_id = ? ORDER BY key",
            (dashboard_id,),
        ).fetchall()
    if not rows:
        return DEFAULT_WIDGETS
    return [
        Widget(
            key=row["key"],
            dashboard_id=row["dashboard_id"],
            title=row["title"],
            value=row["value"],
            widget_type=row["widget_type"],
            color=row["color"],
            span=row["span"],
            pinned=bool(row["pinned"]),
        )
        for row in rows
    ]


def save_widget(widget: Widget) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO widgets(dashboard_id, key, title, value, widget_type, color, span, pinned, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(dashboard_id, key) DO UPDATE SET
                title = excluded.title,
                value = excluded.value,
                widget_type = excluded.widget_type,
                color = excluded.color,
                span = excluded.span,
                pinned = excluded.pinned,
                updated_at = excluded.updated_at
            """,
            (
                widget.dashboard_id,
                widget.key,
                widget.title,
                widget.value,
                widget.widget_type,
                widget.color,
                widget.span,
                1 if widget.pinned else 0,
                utc_now(),
            ),
        )


def list_panels(dashboard_id: str = "default") -> list[Panel]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM panels WHERE dashboard_id = ? ORDER BY key",
            (dashboard_id,),
        ).fetchall()
    if not rows:
        return DEFAULT_PANELS
    panels: list[Panel] = []
    for row in rows:
        try:
            content = json.loads(row["content_json"] or "{}")
        except json.JSONDecodeError:
            content = {}
        panels.append(
            Panel(
                key=row["key"],
                dashboard_id=row["dashboard_id"],
                title=row["title"],
                color=row["color"],
                span=row["span"],
                collapsed=bool(row["collapsed"]),
                pinned=bool(row["pinned"]),
                content=content,
            )
        )
    return panels


def save_panel(panel: Panel) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO panels(dashboard_id, key, title, color, span, collapsed, pinned, content_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(dashboard_id, key) DO UPDATE SET
                title = excluded.title,
                color = excluded.color,
                span = excluded.span,
                collapsed = excluded.collapsed,
                pinned = excluded.pinned,
                content_json = excluded.content_json,
                updated_at = excluded.updated_at
            """,
            (
                panel.dashboard_id,
                panel.key,
                panel.title,
                panel.color,
                panel.span,
                1 if panel.collapsed else 0,
                1 if panel.pinned else 0,
                json.dumps(panel.content),
                utc_now(),
            ),
        )


def get_layout_profile(dashboard_id: str = "default", slot: str = "1") -> LayoutProfile:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM layout_profiles WHERE dashboard_id = ? AND slot = ?",
            (dashboard_id, slot),
        ).fetchone()
    if not row:
        return LayoutProfile(dashboard_id=dashboard_id, slot=slot)
    return LayoutProfile(
        dashboard_id=row["dashboard_id"],
        slot=row["slot"],
        layout_json=row["layout_json"],
        updated_at=row["updated_at"],
    )


def save_layout_profile(profile: LayoutProfile) -> None:
    profile.updated_at = utc_now()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO layout_profiles(dashboard_id, slot, layout_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(dashboard_id, slot) DO UPDATE SET
                layout_json = excluded.layout_json,
                updated_at = excluded.updated_at
            """,
            (profile.dashboard_id, profile.slot, profile.layout_json, profile.updated_at),
        )


def list_layout_profiles(dashboard_id: str = "default") -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT dashboard_id, slot, updated_at FROM layout_profiles WHERE dashboard_id = ? ORDER BY CAST(slot AS INTEGER)",
            (dashboard_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def public_dashboard_state(dashboard_id: str = "default") -> dict[str, Any]:
    return {
        "dashboard": asdict(get_dashboard(dashboard_id)),
        "widgets": [asdict(widget) for widget in list_widgets(dashboard_id)],
        "panels": [asdict(panel) for panel in list_panels(dashboard_id)],
        "profiles": list_layout_profiles(dashboard_id),
    }
