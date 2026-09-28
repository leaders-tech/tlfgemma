"""Build and run the backend aiohttp application.

Edit this file when startup, cleanup, or top-level route setup changes.
Do not copy this file. Change it when the whole backend app boot flow changes.
"""

from __future__ import annotations

import logging

from aiohttp import web

from backend.auth.routes import setup_auth_routes
from backend.config import Settings, load_settings, validate_settings
from backend.db.connection import open_db
from backend.db.migrations import run_migrations
from backend.db.seed import seed_dev_data
from backend.http.middleware import cors_middleware, error_middleware, request_logging_middleware
from backend.http.routes import setup_api_routes
from backend.logging_config import configure_logging
from backend.ws.hub import WebSocketHub
from backend.ws.routes import setup_ws_routes

LOGGER = logging.getLogger("backend.app")


async def on_startup(app: web.Application) -> None:
    settings: Settings = app["settings"]
    LOGGER.info(
        "Starting backend mode=%s host=%s port=%s db=%s frontend=%s debug_logs=%s",
        settings.mode,
        settings.host,
        settings.port,
        settings.db_path,
        settings.frontend_origin,
        settings.debug_logs,
    )
    LOGGER.info("Running database migrations.")
    run_migrations(settings.db_path, settings.migrations_path)
    LOGGER.info("Database migrations finished.")
    app["db"] = await open_db(settings.db_path)
    if settings.mode == "dev":
        LOGGER.info("Seeding dev users if they are missing.")
    await seed_dev_data(app["db"], settings)
    LOGGER.info("Backend startup finished.")


async def on_cleanup(app: web.Application) -> None:
    db = app.get("db")
    if db is not None:
        await db.close()
        LOGGER.info("Database connection closed.")


def create_app(settings: Settings | None = None) -> web.Application:
    resolved_settings = settings or load_settings()
    validate_settings(resolved_settings)
    configure_logging(resolved_settings)
    app = web.Application(middlewares=[request_logging_middleware, error_middleware, cors_middleware])
    app["settings"] = resolved_settings
    app["ws_hub"] = WebSocketHub()

    setup_auth_routes(app)
    setup_api_routes(app)
    setup_ws_routes(app)

    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


def run() -> None:
    settings = load_settings()
    web.run_app(create_app(settings), host=settings.host, port=settings.port)


if __name__ == "__main__":
    run()
