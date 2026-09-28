"""Test backend logging settings and request/error log behavior.

Edit this file when backend log flags, request logs, or exception logs change.
Copy a test pattern here when you add another shared logging rule.
"""

from __future__ import annotations

import logging
from dataclasses import replace

import pytest
from aiohttp import web

from backend.config import parse_bool_env
from backend.main import create_app


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("1", True),
        ("true", True),
        ("yes", True),
        ("on", True),
        ("0", False),
        ("false", False),
        ("no", False),
        ("off", False),
    ],
)
def test_parse_bool_env(value: str, expected: bool) -> None:
    assert parse_bool_env(value, default=False) is expected


def test_parse_bool_env_uses_default_for_missing_value() -> None:
    assert parse_bool_env(None, default=True) is True
    assert parse_bool_env("", default=False) is False


@pytest.mark.asyncio
async def test_debug_request_logging_records_success(aiohttp_client, test_settings, caplog) -> None:
    app = create_app(replace(test_settings, debug_logs=True))
    client = await aiohttp_client(app)

    with caplog.at_level(logging.INFO, logger="backend.request"):
        response = await client.get("/api/health")

    assert response.status == 200
    assert "GET /api/health 200" in caplog.text


@pytest.mark.asyncio
async def test_debug_request_logging_can_be_disabled(aiohttp_client, test_settings, caplog) -> None:
    app = create_app(replace(test_settings, debug_logs=False))
    client = await aiohttp_client(app)

    with caplog.at_level(logging.INFO, logger="backend.request"):
        response = await client.get("/api/health")

    assert response.status == 200
    assert "GET /api/health 200" not in caplog.text


@pytest.mark.asyncio
async def test_unexpected_exception_logs_stack_trace_and_returns_json(aiohttp_client, test_settings, caplog) -> None:
    async def boom(_request: web.Request) -> web.Response:
        raise RuntimeError("boom")

    app = create_app(replace(test_settings, debug_logs=False))
    app.router.add_get("/boom", boom)
    client = await aiohttp_client(app)

    with caplog.at_level(logging.ERROR, logger="backend.error"):
        response = await client.get("/boom")

    payload = await response.json()
    assert response.status == 500
    assert payload == {"ok": False, "error": {"code": "server_error", "message": "Server error."}}
    assert "Unhandled backend error while handling GET /boom" in caplog.text
    assert "RuntimeError: boom" in caplog.text
