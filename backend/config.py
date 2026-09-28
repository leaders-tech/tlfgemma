"""Load server configuration. Edit for environment settings; do not copy this module."""

from dataclasses import dataclass
from pathlib import Path
import os
from urllib.parse import urlsplit
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent


@dataclass(slots=True)
class Settings:
    mode: str
    host: str
    port: int
    db_path: Path
    cookie_secret: str
    frontend_origin: str
    debug_logs: bool = True
    oidc_issuer: str = "http://localhost:8000"
    client_id: str = ""
    client_secret: str = ""
    openrouter_api_key: str = ""
    openrouter_url: str = "https://openrouter.ai/api/v1/chat/completions"
    session_cookie_name: str = "tlf_gemma_session"

    @property
    def secure_cookies(self):
        return self.mode == "prod"

    @property
    def allowed_origins(self):
        return {self.frontend_origin}

    @property
    def callback_url(self):
        return self.frontend_origin + "/api/auth/oidc/callback"

    @property
    def migrations_path(self):
        return ROOT_DIR / "backend/db/schema"


def parse_bool_env(value, *, default):
    if value is None or value.strip() == "":
        return default
    if value.lower() in {"1", "true", "yes", "on"}:
        return True
    if value.lower() in {"0", "false", "no", "off"}:
        return False
    raise ValueError("Expected a boolean environment value.")


def validate_settings(settings):
    if settings.mode == "prod":
        for name, value in (("FRONTEND_ORIGIN", settings.frontend_origin), ("X_OIDC_ISSUER", settings.oidc_issuer)):
            parsed = urlsplit(value)
            if parsed.scheme != "https" or not parsed.hostname:
                raise ValueError(f"{name} must be a complete HTTPS URL in production. Set {name} in deployment settings and redeploy.")
        if not settings.client_id or not settings.client_secret or not settings.openrouter_api_key:
            raise ValueError("Set X_CLIENT_ID, X_SECRET and OPENROUTER_API_KEY.")
        if settings.openrouter_url != "https://openrouter.ai/api/v1/chat/completions":
            raise ValueError("Production must use OpenRouter.")


def load_settings():
    load_dotenv(ROOT_DIR / ".env")
    mode = os.getenv("APP_MODE", "dev")
    settings = Settings(
        mode=mode,
        host=os.getenv("APP_HOST", "localhost"),
        port=int(os.getenv("APP_PORT", "3101")),
        db_path=ROOT_DIR / os.getenv("DB_PATH", "tlfgemma.sqlite3"),
        cookie_secret=os.getenv("COOKIE_SECRET", ""),
        frontend_origin=os.getenv(
            "FRONTEND_ORIGIN", "http://" + os.getenv("FRONTEND_PUBLIC_HOST", "localhost") + ":" + os.getenv("FRONTEND_PORT", "5101")
        ).rstrip("/"),
        debug_logs=parse_bool_env(os.getenv("APP_DEBUG_LOGS"), default=mode != "prod"),
        oidc_issuer=os.getenv("X_OIDC_ISSUER", "http://localhost:8000").rstrip("/"),
        client_id=os.getenv("X_CLIENT_ID", ""),
        client_secret=os.getenv("X_SECRET", ""),
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
    )
    validate_settings(settings)
    return settings
