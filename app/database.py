import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.config import get_app_settings


def get_db_path() -> str:
    settings = get_app_settings()
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
    return settings.database_path


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS dashboards (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS layout_profiles (
                dashboard_id TEXT NOT NULL,
                slot TEXT NOT NULL,
                layout_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (dashboard_id, slot)
            );

            CREATE TABLE IF NOT EXISTS panels (
                dashboard_id TEXT NOT NULL,
                key TEXT NOT NULL,
                title TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#2563eb',
                span INTEGER NOT NULL DEFAULT 3,
                collapsed INTEGER NOT NULL DEFAULT 0,
                pinned INTEGER NOT NULL DEFAULT 0,
                content_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (dashboard_id, key)
            );

            CREATE TABLE IF NOT EXISTS widgets (
                dashboard_id TEXT NOT NULL,
                key TEXT NOT NULL,
                title TEXT NOT NULL,
                value TEXT NOT NULL DEFAULT '0',
                widget_type TEXT NOT NULL DEFAULT 'tracker',
                color TEXT NOT NULL DEFAULT '#2563eb',
                span INTEGER NOT NULL DEFAULT 1,
                pinned INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (dashboard_id, key)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            INSERT INTO dashboards(id, title, description)
            VALUES ('default', 'Dashboard', '')
            ON CONFLICT(id) DO NOTHING
            """
        )
