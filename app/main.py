import logging

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.database import init_db
from app.logger import setup_logging
from app.routes import api, dashboard, settings

logger = logging.getLogger(__name__)
templates = Jinja2Templates(directory="app/templates")


def create_app() -> FastAPI:
    setup_logging()
    init_db()
    app = FastAPI(title="Configurable Dashboard Builder")
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    app.include_router(dashboard.router)
    app.include_router(settings.router)
    app.include_router(api.router)

    @app.exception_handler(Exception)
    async def handle_exception(request: Request, exc: Exception) -> HTMLResponse:
        logger.exception("Unhandled request error")
        return templates.TemplateResponse(
            "base.html",
            {"request": request, "error": str(exc)},
            status_code=500,
        )

    return app


app = create_app()
