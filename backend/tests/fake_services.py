"""Provide test-only OIDC and model servers. Edit for integration scenarios; copy for other test doubles."""

import asyncio
import html
import json
import secrets
import time
from urllib.parse import urlencode
import jwt
from aiohttp import web
from cryptography.hazmat.primitives.asymmetric import rsa


class FakeServices:
    def __init__(self):
        self.issuer = ""
        self.authorization_url = None
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.codes = {}
        self.tokens = {}
        self.requests = []
        self.claim_overrides = {}
        self.info_overrides = {}
        self.app = web.Application()
        self.app.router.add_get("/.well-known/openid-configuration", self.discovery)
        self.app.router.add_get("/authorize", self.authorize)
        self.app.router.add_post("/token", self.token)
        self.app.router.add_get("/jwks", self.jwks)
        self.app.router.add_get("/userinfo", self.userinfo)
        self.app.router.add_post("/completion", self.completion)

    async def discovery(self, request):
        return web.json_response(
            {
                "issuer": self.issuer,
                "authorization_endpoint": self.authorization_url or self.issuer + "/authorize",
                "token_endpoint": self.issuer + "/token",
                "userinfo_endpoint": self.issuer + "/userinfo",
                "jwks_uri": self.issuer + "/jwks",
            }
        )

    async def authorize(self, request):
        if not request.query.get("email"):
            fields = "".join(f'<input type="hidden" name="{html.escape(k)}" value="{html.escape(v)}">' for k, v in request.query.items())
            return web.Response(
                text=f'<html><body><h1>Test TLF sign-in</h1><form>{fields}<label>Email<input name="email" type="email" required></label><button>Continue</button></form></body></html>',
                content_type="text/html",
            )
        code = secrets.token_urlsafe(20)
        self.codes[code] = dict(request.query)
        raise web.HTTPFound(request.query["redirect_uri"] + "?" + urlencode({"code": code, "state": request.query["state"]}))

    async def token(self, request):
        if not request.headers.get("Authorization", "").startswith("Basic "):
            raise web.HTTPUnauthorized()
        data = await request.post()
        info = self.codes.pop(data.get("code"), None)
        if not info or info["redirect_uri"] != data.get("redirect_uri"):
            raise web.HTTPBadRequest()
        email = info["email"]
        roles = [email.split("@")[0]] if email.split("@")[0] in {"teacher", "admin"} else []
        access = secrets.token_urlsafe(20)
        self.tokens[access] = {"sub": email, "email": email, "roles": roles, **self.info_overrides}
        claims = {
            "iss": self.issuer,
            "sub": email,
            "aud": info["client_id"],
            "iat": int(time.time()),
            "exp": int(time.time()) + 300,
            "nonce": info["nonce"],
            **self.claim_overrides,
        }
        return web.json_response(
            {"id_token": jwt.encode(claims, self.key, algorithm="RS256", headers={"kid": "test"}), "access_token": access, "token_type": "Bearer"}
        )

    async def jwks(self, request):
        key = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(self.key.public_key()))
        return web.json_response({"keys": [{**key, "kid": "test", "alg": "RS256", "use": "sig"}]})

    async def userinfo(self, request):
        info = self.tokens.get(request.headers.get("Authorization", "").removeprefix("Bearer "))
        if not info:
            raise web.HTTPUnauthorized()
        return web.json_response(info)

    async def completion(self, request):
        data = await request.json()
        self.requests.append(data)
        text = data["messages"][0]["content"]
        if text == "fail":
            return web.json_response({"error": "test failure"}, status=503)
        response = web.StreamResponse(headers={"Content-Type": "text/event-stream"})
        await response.prepare(request)
        answer = "🦊" * 1100 if text == "long" else "**Hello** from Gemma.\n\n$$x^2 + y^2 = z^2$$\n\n```python\nprint('hello')\n```"
        try:
            for offset in range(0, len(answer), 9):
                await response.write(("data: " + json.dumps({"choices": [{"delta": {"content": answer[offset : offset + 9]}}]}) + "\n\n").encode())
                if text == "partial":
                    await response.write(b'data: {"error":{"message":"failed"}}\n\n')
                    break
                await asyncio.sleep(0.1 if text == "slow" else 0.005)
            else:
                await response.write(b"data: [DONE]\n\n")
        except ConnectionResetError, RuntimeError:
            pass
        return response
