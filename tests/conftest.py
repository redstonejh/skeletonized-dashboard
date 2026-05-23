import os
import re
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest
from playwright.sync_api import sync_playwright


ARTIFACT_ROOT = Path("test-results")


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _safe_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", name).strip("_")[:120]


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    setattr(item, f"rep_{call.when}", outcome.get_result())


@pytest.fixture(scope="session")
def app_server():
    port = _free_port()
    state_dir = ARTIFACT_ROOT / "state" / f"run-{os.getpid()}-{int(time.time())}"
    state_dir.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["APP_DATABASE_PATH"] = str(state_dir / "dashboard_builder_test.db")
    env["APP_LOG_PATH"] = str(state_dir / "app_test.log")
    env["PYTHONPATH"] = str(Path.cwd())

    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--log-level",
            "warning",
        ],
        cwd=Path.cwd(),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    base_url = f"http://127.0.0.1:{port}"
    deadline = time.time() + 20
    last_error = None
    while time.time() < deadline:
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"App server exited early:\n{output}")
        try:
            response = httpx.get(f"{base_url}/dashboard", timeout=1)
            if response.status_code == 200:
                break
        except Exception as exc:  # pragma: no cover - diagnostic only
            last_error = exc
        time.sleep(0.2)
    else:
        process.terminate()
        raise RuntimeError(f"App server did not become ready: {last_error}")

    yield base_url

    process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser, request):
    test_dir = ARTIFACT_ROOT / _safe_name(request.node.nodeid)
    test_dir.mkdir(parents=True, exist_ok=True)

    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        record_video_dir=str(test_dir / "video"),
    )
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    page = context.new_page()
    page.console_errors = []
    page.page_errors = []
    page.network_errors = []

    def on_console(message):
        if message.type == "error":
            page.console_errors.append(f"{message.type}: {message.text}")

    def on_response(response):
        if response.status >= 400 and not response.url.endswith("/favicon.ico"):
            page.network_errors.append(f"{response.status} {response.url}")

    page.on("console", on_console)
    page.on("pageerror", lambda exc: page.page_errors.append(str(exc)))
    page.on("requestfailed", lambda req: page.network_errors.append(f"FAILED {req.url}: {req.failure}"))
    page.on("response", on_response)

    yield page

    failed = getattr(request.node, "rep_call", None) and request.node.rep_call.failed
    if failed:
        page.screenshot(path=str(test_dir / "failure.png"), full_page=True)
        context.tracing.stop(path=str(test_dir / "trace.zip"))
    else:
        context.tracing.stop()
    context.close()
    if not failed:
        shutil.rmtree(test_dir, ignore_errors=True)
