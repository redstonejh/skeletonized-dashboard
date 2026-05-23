import json
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.models import LayoutProfile, Panel, Widget
from app.storage import (
    get_layout_profile,
    list_layout_profiles,
    list_panels,
    list_widgets,
    public_dashboard_state,
    save_layout_profile,
    save_panel,
    save_widget,
)

router = APIRouter(prefix="/api/dashboard")


@router.get("/layout")
def get_layout(slot: str = "1", dashboard_id: str = "default") -> dict[str, Any]:
    profile = get_layout_profile(dashboard_id=dashboard_id, slot=slot)
    try:
        layout = json.loads(profile.layout_json)
    except json.JSONDecodeError:
        layout = {}
    return {"dashboard_id": dashboard_id, "slot": slot, "layout": layout, "updated_at": profile.updated_at}


@router.post("/layout")
async def save_layout(request: Request) -> dict[str, str]:
    payload = await request.json()
    dashboard_id = str(payload.get("dashboard_id") or "default")
    slot = str(payload.get("slot") or "1")
    layout = payload.get("layout") or {}
    save_layout_profile(
        LayoutProfile(
            dashboard_id=dashboard_id,
            slot=slot,
            layout_json=json.dumps(layout),
        )
    )
    return {"message": "Layout saved", "dashboard_id": dashboard_id, "slot": slot}


@router.get("/widgets")
def get_widgets(dashboard_id: str = "default") -> dict[str, Any]:
    return {"widgets": [asdict(widget) for widget in list_widgets(dashboard_id)]}


@router.post("/widgets")
async def upsert_widget(request: Request) -> dict[str, Any]:
    payload = await request.json()
    key = str(payload.get("key") or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Widget key is required")
    widget = Widget(
        key=key,
        dashboard_id=str(payload.get("dashboard_id") or "default"),
        title=str(payload.get("title") or "Widget"),
        value=str(payload.get("value") or "0"),
        widget_type=str(payload.get("widget_type") or payload.get("type") or "tracker"),
        color=str(payload.get("color") or "#2563eb"),
        span=int(payload.get("span") or 1),
        pinned=bool(payload.get("pinned")),
    )
    save_widget(widget)
    return {"widget": asdict(widget)}


@router.get("/panels")
def get_panels(dashboard_id: str = "default") -> dict[str, Any]:
    return {"panels": [asdict(panel) for panel in list_panels(dashboard_id)]}


@router.post("/panels")
async def upsert_panel(request: Request) -> dict[str, Any]:
    payload = await request.json()
    key = str(payload.get("key") or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Panel key is required")
    panel = Panel(
        key=key,
        dashboard_id=str(payload.get("dashboard_id") or "default"),
        title=str(payload.get("title") or "Panel"),
        color=str(payload.get("color") or "#2563eb"),
        span=int(payload.get("span") or 3),
        collapsed=bool(payload.get("collapsed")),
        pinned=bool(payload.get("pinned")),
        content=payload.get("content") if isinstance(payload.get("content"), dict) else {},
    )
    save_panel(panel)
    return {"panel": asdict(panel)}


@router.get("/profiles")
def get_profiles(dashboard_id: str = "default") -> dict[str, Any]:
    return {"profiles": list_layout_profiles(dashboard_id)}


@router.get("")
def get_dashboard_state(dashboard_id: str = "default") -> dict[str, Any]:
    return public_dashboard_state(dashboard_id)
