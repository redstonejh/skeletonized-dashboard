from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class Dashboard:
    id: str = "default"
    title: str = "Dashboard"
    description: str = ""
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)


@dataclass(slots=True)
class Panel:
    key: str
    dashboard_id: str = "default"
    title: str = "Panel"
    color: str = "#2563eb"
    span: int = 3
    collapsed: bool = False
    pinned: bool = False
    content: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Widget:
    key: str
    dashboard_id: str = "default"
    title: str = "Widget"
    value: str = "0"
    widget_type: str = "tracker"
    color: str = "#2563eb"
    span: int = 1
    pinned: bool = False


@dataclass(slots=True)
class LayoutProfile:
    dashboard_id: str = "default"
    slot: str = "1"
    layout_json: str = "{}"
    updated_at: str = field(default_factory=utc_now)


@dataclass(slots=True)
class WidgetType:
    key: str
    label: str
    description: str = ""


@dataclass(slots=True)
class MenuItem:
    key: str
    label: str
    href: str = "#"
    active: bool = False
