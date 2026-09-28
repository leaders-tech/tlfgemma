"""Apply shared backend middleware such as errors, CORS, and origin checks.

Edit this file when request-wide backend rules change.
Copy the helper style here when you add another small shared middleware helper.
"""

from __future__ import annotations

import logging
from time import perf_counter

from aiohttp import web

from backend.config import Settings
from backend.http.json_api import AppError, fail

ERROR_LOGGER = logging.getLogger("backend.error")
REQUEST_LOGGER = logging.getLogger("backend.request")
EXPECTED_ANONYMOUS_401_PATHS = {"/api/auth/me", "/api/auth/refresh"}


def add_cors_headers(request: web.Request, response: web.StreamResponse) -> web.StreamResponse:
    settings: Settings = request.app["settings"]
    origin = request.headers.get("Origin", "").rstrip("/")
    # Production stays same-origin behind a reverse proxy. These CORS headers are only for localhost-style dev splits.
    if settings.mode != "prod" and origin in settings.allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


@web.middleware
async def error_middleware(request: web.Request, handler):
    try:
        return await handler(request)
    except AppError as error:
        return add_cors_headers(request, fail(error.status, error.code, error.message))
    except web.HTTPException as error:
        if error.status >= 400:
            return add_cors_headers(request, fail(error.status, "http_error", error.reason or "Request failed."))
        raise
    except Exception:
        ERROR_LOGGER.exception("Unhandled backend error while handling %s %s", request.method, request.path)
        return add_cors_headers(request, fail(500, "server_error", "Server error."))


@web.middleware
async def request_logging_middleware(request: web.Request, handler):
    started_at = perf_counter()
    response = await handler(request)
    settings: Settings = request.app["settings"]
    duration_ms = round((perf_counter() - started_at) * 1000)
    user = request.get("current_user")
    user_part = f" user={user['id']}" if isinstance(user, dict) and "id" in user else ""
    message = f"{request.method} {request.path} {response.status} {duration_ms}ms{user_part}"

    if response.status == 401 and request.path in EXPECTED_ANONYMOUS_401_PATHS and user is None:
        return response
    if response.status >= 500:
        REQUEST_LOGGER.error(message)
    elif settings.debug_logs:
        REQUEST_LOGGER.info(message)
    return response


@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        response = await handler(request)
    return add_cors_headers(request, response)


def require_allowed_origin(request: web.Request) -> None:
    settings: Settings = request.app["settings"]
    origin = request.headers.get("Origin")
    # This is only a small same-site check when Origin is present. SameSite=Lax cookies and JSON-only POST endpoints
    # are the main simplified CSRF barrier in this template, not this helper alone.
    if origin is None:
        return
    if origin.rstrip("/") not in settings.allowed_origins:
        raise AppError(403, "forbidden_origin", "Origin is not allowed.")
