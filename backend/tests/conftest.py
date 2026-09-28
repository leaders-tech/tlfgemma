"""Build isolated test apps and sessions. Edit for shared fixtures; copy fixtures for related tests."""

from pathlib import Path
import secrets
import pytest
from backend.config import Settings
from backend.main import create_app
from backend.tests.fake_services import FakeServices


@pytest.fixture
async def provider(aiohttp_server):
    provider = FakeServices()
    server = await aiohttp_server(provider.app)
    provider.issuer = str(server.make_url("")).rstrip("/")
    return provider


@pytest.fixture
def test_settings(tmp_path: Path):
    return Settings(
        mode="test",
        host="127.0.0.1",
        port=8081,
        db_path=tmp_path / "test.sqlite3",
        cookie_secret="test-secret",
        frontend_origin="http://127.0.0.1:5101",
        client_id="tlfgemma",
        client_secret="test",
        openrouter_api_key="test",
    )


@pytest.fixture
async def app(test_settings, provider):
    test_settings.oidc_issuer = provider.issuer
    test_settings.openrouter_url = provider.issuer + "/completion"
    return create_app(test_settings)


@pytest.fixture
async def client(aiohttp_client, app):
    return await aiohttp_client(app)


@pytest.fixture
async def identity(client, app):
    async def create(email="student@example.org", roles=None):
        user = await app["store"].identity(email, email, roles or [])
        token = secrets.token_urlsafe(32)
        await app["store"].create_session(token, user["id"])
        return user, {"Cookie": f"tlf_gemma_session={token}"}

    return create
