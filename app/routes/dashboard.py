from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.storage import get_dashboard, list_panels, list_widgets

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
@router.get("/dashboard")
def dashboard(request: Request):
    query = request.query_params.get("q", "").strip()
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "dashboard": get_dashboard(),
            "widgets": list_widgets(),
            "panels": list_panels(),
            "search_query": query,
        },
    )
