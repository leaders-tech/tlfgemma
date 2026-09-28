"""Run test-only OIDC and model routes beside the app. Edit for e2e setup; never use this entrypoint in production."""

from aiohttp import web
from backend.config import load_settings
from backend.main import create_app
from backend.tests.fake_services import FakeServices


def main():
    settings = load_settings()
    settings.mode = "test"
    fake = FakeServices()
    fake.issuer = f"http://127.0.0.1:{settings.port}/api/test-oidc"
    fake.authorization_url = settings.frontend_origin + "/api/test-oidc/authorize"
    settings.oidc_issuer = fake.issuer
    settings.openrouter_url = fake.issuer + "/completion"
    settings.client_id = "tlfgemma-test"
    settings.client_secret = "test-only"
    settings.openrouter_api_key = "test-only"
    app = create_app(settings)
    for route in fake.app.router.routes():
        app.router.add_route(route.method, "/api/test-oidc" + route.resource.canonical, route.handler)
    web.run_app(app, host=settings.host, port=settings.port, access_log=None)


if __name__ == "__main__":
    main()
