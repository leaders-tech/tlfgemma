"""Test real signed OIDC exchanges and session rules. Edit for auth changes; copy for new auth scenarios."""

from urllib.parse import urlsplit, parse_qs
import pytest


async def oidc_login(client, provider, email="student@example.org"):
    response = await client.post("/api/auth/login", json={})
    assert response.status == 200
    url = (await response.json())["data"]["url"]
    params = {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}
    code = "test-code"
    provider.codes[code] = {**params, "email": email}
    return await client.get("/api/auth/oidc/callback", params={"state": params["state"], "code": code}, allow_redirects=False)


async def test_oidc_login_and_logout(client, provider):
    response = await oidc_login(client, provider)
    assert response.status == 302 and response.headers["Location"] == "/"
    assert response.cookies["tlf_gemma_session"]["httponly"]
    assert response.cookies["tlf_gemma_session"]["samesite"] == "Lax"
    response = await client.post("/api/auth/me", json={})
    assert (await response.json())["data"]["user"]["email"] == "student@example.org"
    await client.post("/api/auth/logout", json={})
    assert (await client.post("/api/auth/me", json={})).status == 401


@pytest.mark.parametrize(
    "claims", [{"iss": "https://evil.invalid"}, {"aud": "other"}, {"exp": 1}, {"nonce": "wrong"}, {"azp": "other"}, {"aud": ["tlfgemma", "other"]}]
)
async def test_rejects_invalid_id_token(client, provider, claims):
    provider.claim_overrides = claims
    response = await oidc_login(client, provider)
    assert response.headers["Location"] == "/login?error=login_failed"
    assert (await client.post("/api/auth/me", json={})).status == 401


async def test_rejects_userinfo_subject_mismatch(client, provider):
    provider.info_overrides = {"sub": "other"}
    assert (await oidc_login(client, provider)).headers["Location"].startswith("/login?")


async def test_state_is_bound_and_one_use(client, provider):
    response = await client.post("/api/auth/login", json={})
    url = (await response.json())["data"]["url"]
    params = {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}
    assert await client.app["store"].take_state(params["state"], "wrong") is None
    binding = client.session.cookie_jar.filter_cookies(client.make_url("/api/auth"))["tlf_gemma_login"].value
    assert await client.app["store"].take_state(params["state"], binding)
    assert await client.app["store"].take_state(params["state"], binding) is None


async def test_origin_and_bad_json(client):
    assert (await client.post("/api/auth/login", json={}, headers={"Origin": "https://evil.invalid"})).status == 403
    assert (await client.post("/api/auth/login", data="broken", headers={"Content-Type": "application/json"})).status == 400


async def test_teacher_role_from_userinfo(client, provider):
    await oidc_login(client, provider, "teacher@example.org")
    assert (await client.post("/review/users", json={})).status == 404
    assert (await client.post("/api/review/users", json={})).status == 200


async def test_rejects_bad_signature(client, provider):
    from cryptography.hazmat.primitives.asymmetric import rsa

    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    original_key = provider.key
    provider.key = wrong_key
    # Signing with a key absent from the trusted issuer's published JWKS must fail.
    from unittest.mock import patch

    original_get = client.app["http"].get

    def get(url, **kwargs):
        if url.endswith("/jwks"):
            provider.key = original_key
        return original_get(url, **kwargs)

    with patch.object(client.app["http"], "get", side_effect=get):
        response = await oidc_login(client, provider)
    assert response.headers["Location"].startswith("/login?")


async def test_expired_session_and_state(client, identity, app, monkeypatch):
    from datetime import timedelta
    from backend.db.store import now

    user, headers = await identity()
    await app["store"].save_state("state", "binding", "nonce")
    future = now() + timedelta(hours=13)
    monkeypatch.setattr("backend.db.store.now", lambda: future)
    assert (await client.post("/api/auth/me", headers=headers, json={})).status == 401
    assert await app["store"].take_state("state", "binding") is None
