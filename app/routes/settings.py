from fastapi import APIRouter, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates

from app.models import Dashboard
from app.storage import get_dashboard, save_dashboard

router = APIRouter(prefix="/settings")
templates = Jinja2Templates(directory="app/templates")


@router.get("")
def settings_page(request: Request):
    return templates.TemplateResponse(
        "settings.html",
        {"request": request, "dashboard": get_dashboard()},
    )


@router.post("")
def save_settings(
    title: str = Form("Dashboard"),
    description: str = Form(""),
):
    dashboard = get_dashboard()
    save_dashboard(
        Dashboard(
            id=dashboard.id,
            title=title.strip() or "Dashboard",
            description=description.strip(),
            created_at=dashboard.created_at,
        )
    )
    return RedirectResponse("/settings?saved=1", status_code=303)
