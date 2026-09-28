"""Start the Gemma backend and manage resources. Edit for lifecycle changes; do not copy this module."""

import asyncio
from aiohttp import web, ClientSession, ClientTimeout
from backend.auth.routes import setup_auth_routes
from backend.config import load_settings, validate_settings
from backend.db.connection import open_db
from backend.db.migrations import run_migrations
from backend.db.store import Store
from backend.http.middleware import cors_middleware, error_middleware, request_logging_middleware
from backend.http.routes import setup_api_routes
from backend.logging_config import configure_logging
from backend.ws.hub import WebSocketHub
from backend.ws.routes import setup_ws_routes
from backend.chat import stop_generations


async def startup(app):
    settings = app["settings"]
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    run_migrations(settings.db_path, settings.migrations_path)
    app["db"] = await open_db(settings.db_path)
    app["store"] = Store(app["db"])
    await app["store"].recover()
    app["http"] = ClientSession(timeout=ClientTimeout(total=20))


async def shutdown(app):
    await app["ws_hub"].close()
    await stop_generations(app)


async def cleanup(app):
    await app["http"].close()
    await app["db"].close()


def create_app(settings=None):
    settings = settings or load_settings()
    validate_settings(settings)
    configure_logging(settings)
    app = web.Application(middlewares=[request_logging_middleware, error_middleware, cors_middleware], client_max_size=16384)
    app["settings"] = settings
    app["ws_hub"] = WebSocketHub()
    app["operations"] = asyncio.Lock()
    app["generations"] = {}
    setup_auth_routes(app)
    setup_api_routes(app)
    setup_ws_routes(app)
    app.on_startup.append(startup)
    app.on_shutdown.append(shutdown)
    app.on_cleanup.append(cleanup)
    return app


def run():
    settings = load_settings()
    web.run_app(create_app(settings), host=settings.host, port=settings.port, access_log=None)


if __name__ == "__main__":
    run()
