"""Handle OIDC login and local sessions. Edit for login changes; copy only endpoint patterns."""

import secrets
from urllib.parse import urlencode
import jwt
from aiohttp import web, BasicAuth, ClientError
from backend.auth.access import require_user
from backend.http.json_api import AppError, ok, read_json


async def discovery(request):
    settings = request.app["settings"]
    async with request.app["http"].get(settings.oidc_issuer + "/.well-known/openid-configuration") as response:
        response.raise_for_status()
        data = await response.json()
    if data.get("issuer") != settings.oidc_issuer:
        raise ValueError("Issuer mismatch")
    for key in ("authorization_endpoint", "token_endpoint", "userinfo_endpoint", "jwks_uri"):
        if not isinstance(data.get(key), str) or (settings.secure_cookies and not data[key].startswith("https://")):
            raise ValueError("Invalid discovery endpoint")
    return data


async def login(request):
    await read_json(request)
    settings = request.app["settings"]
    if not settings.client_id or not settings.client_secret:
        raise AppError(503, "auth_not_configured", "Login is not configured yet.")
    try:
        config = await discovery(request)
    except ClientError, ValueError, TimeoutError:
        raise AppError(502, "auth_unavailable", "Login service is unavailable.") from None
    state, binding, nonce = (secrets.token_urlsafe(32) for _ in range(3))
    await request.app["store"].save_state(state, binding, nonce)
    url = (
        config["authorization_endpoint"]
        + "?"
        + urlencode(
            {
                "response_type": "code",
                "client_id": settings.client_id,
                "redirect_uri": settings.callback_url,
                "scope": "openid email profile",
                "state": state,
                "nonce": nonce,
            }
        )
    )
    response = ok({"url": url})
    response.set_cookie("tlf_gemma_login", binding, max_age=600, httponly=True, secure=settings.secure_cookies, samesite="Lax", path="/api/auth")
    return response


async def callback(request):
    settings = request.app["settings"]
    store = request.app["store"]
    state = await store.take_state(request.query.get("state", ""), request.cookies.get("tlf_gemma_login", ""))
    response = web.Response(status=302, headers={"Location": "/login?error=login_failed"})
    if state and request.query.get("code") and not request.query.get("error"):
        try:
            config = await discovery(request)
            async with request.app["http"].post(
                config["token_endpoint"],
                auth=BasicAuth(settings.client_id, settings.client_secret),
                data={"grant_type": "authorization_code", "code": request.query["code"], "redirect_uri": settings.callback_url},
            ) as upstream:
                upstream.raise_for_status()
                tokens = await upstream.json()
            async with request.app["http"].get(config["jwks_uri"]) as upstream:
                upstream.raise_for_status()
                keys = jwt.PyJWKSet.from_dict(await upstream.json())
            header = jwt.get_unverified_header(tokens["id_token"])
            key = next(k for k in keys.keys if k.key_id == header.get("kid") and k.algorithm_name == "RS256")
            claims = jwt.decode(
                tokens["id_token"],
                key.key,
                algorithms=["RS256"],
                audience=settings.client_id,
                issuer=settings.oidc_issuer,
                options={"require": ["iss", "sub", "aud", "iat", "exp", "nonce"]},
            )
            if claims["nonce"] != state["nonce"] or (claims.get("azp") and claims["azp"] != settings.client_id):
                raise ValueError("Invalid nonce or authorized party")
            if isinstance(claims["aud"], list) and len(claims["aud"]) > 1 and claims.get("azp") != settings.client_id:
                raise ValueError("Missing authorized party")
            async with request.app["http"].get(config["userinfo_endpoint"], headers={"Authorization": "Bearer " + tokens["access_token"]}) as upstream:
                upstream.raise_for_status()
                info = await upstream.json()
            if info.get("sub") != claims["sub"] or not isinstance(info.get("email"), str) or not info["email"]:
                raise ValueError("Invalid user identity")
            roles = info.get("roles", [])
            if not isinstance(roles, list) or not all(isinstance(role, str) for role in roles):
                raise ValueError("Invalid roles")
            user = await store.identity(claims["sub"], info["email"], roles)
            token = secrets.token_urlsafe(48)
            await store.create_session(token, user["id"])
            old = request.cookies.get(settings.session_cookie_name)
            if old:
                await store.logout(old)
                await request.app["ws_hub"].close_session(old)
            response = web.Response(status=302, headers={"Location": "/"})
            response.set_cookie(settings.session_cookie_name, token, max_age=43200, httponly=True, secure=settings.secure_cookies, samesite="Lax", path="/")
        except ClientError, jwt.PyJWTError, ValueError, KeyError, StopIteration, TypeError, TimeoutError:
            pass
    response.del_cookie("tlf_gemma_login", path="/api/auth")
    return response


async def me(request):
    return ok({"user": await require_user(request)})


async def logout(request):
    await read_json(request)
    token = request.cookies.get(request.app["settings"].session_cookie_name, "")
    await request.app["store"].logout(token)
    await request.app["ws_hub"].close_session(token)
    response = ok({"logged_out": True})
    response.del_cookie(request.app["settings"].session_cookie_name, path="/")
    return response


def setup_auth_routes(app):
    app.router.add_post("/api/auth/login", login)
    app.router.add_get("/api/auth/oidc/callback", callback)
    app.router.add_post("/api/auth/me", me)
    app.router.add_post("/api/auth/logout", logout)
