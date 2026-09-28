"""Test actionable production configuration errors. Edit for settings validation; copy for new configuration rules."""

from dataclasses import replace

import pytest

from backend.config import validate_settings


@pytest.mark.parametrize("field,name", [("frontend_origin", "FRONTEND_ORIGIN"), ("oidc_issuer", "X_OIDC_ISSUER")])
@pytest.mark.parametrize("value", ["", "http://localhost:5105", "https://"])
def test_invalid_production_url_names_the_setting(test_settings, field, name, value):
    settings = replace(test_settings, mode="prod", frontend_origin="https://tlfgemma.tlfedu.tech", oidc_issuer="https://auth.leaders.tech")
    setattr(settings, field, value)
    with pytest.raises(ValueError, match=f"{name} must be a complete HTTPS URL"):
        validate_settings(settings)


def test_production_urls_are_valid(test_settings):
    settings = replace(test_settings, mode="prod", frontend_origin="https://tlfgemma.tlfedu.tech", oidc_issuer="https://auth.leaders.tech")
    validate_settings(settings)


def test_local_http_remains_available(test_settings):
    validate_settings(test_settings)
