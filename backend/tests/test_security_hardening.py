"""Security review fixes (2026-11-07): unsafe production settings, CSV formula injection, alert escaping."""

from typing import Any

import pytest

from app.api.v1.admin.leads import _csv_safe
from app.core.config import Settings

STRONG: dict[str, Any] = {"cookie_secure": True, "secret_key": "s" * 48, "jwt_key": "j" * 48, "encryption_key": "e" * 44, "ip_hash_salt": "i" * 48}


@pytest.mark.parametrize("env", ["staging", "production"])
def test_production_refuses_dev_default_secrets(env: str) -> None:
    with pytest.raises(ValueError, match="JWT_KEY"):
        Settings(env=env, cookie_secure=True, _env_file=None)  # type: ignore[call-arg]


@pytest.mark.parametrize("field", ["secret_key", "jwt_key", "encryption_key", "ip_hash_salt"])
def test_production_refuses_short_or_empty_secret(field: str) -> None:
    with pytest.raises(ValueError, match=field.upper()):
        Settings(env="production", _env_file=None, **{**STRONG, field: ""})  # type: ignore[arg-type]


def test_production_requires_secure_cookies() -> None:
    with pytest.raises(ValueError, match="COOKIE_SECURE"):
        Settings(env="production", _env_file=None, **{**STRONG, "cookie_secure": False})  # type: ignore[arg-type]


def test_production_accepts_strong_settings() -> None:
    s = Settings(env="production", _env_file=None, **STRONG)  # type: ignore[arg-type]
    assert s.cors_origins == []  # admin API is same-origin; no cross-origin credentials by default


def test_local_env_keeps_dev_defaults() -> None:
    assert Settings(env="local", _env_file=None).jwt_key.get_secret_value()  # type: ignore[call-arg]


@pytest.mark.parametrize("value", ["=HYPERLINK(\"http://x\")", "+998901234567", "-1", "@SUM(A1)", "\tcmd", "\r=1"])
def test_csv_cells_neutralized(value: str) -> None:
    assert _csv_safe(value) == "'" + value


@pytest.mark.parametrize("value", ["Ali", "ali@example.com", 42, "", None])
def test_csv_plain_cells_untouched(value: Any) -> None:
    assert _csv_safe(value) == value


async def test_alert_text_is_html_escaped(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import notify
    from app.workers.main import send_alert

    sent: list[str] = []

    async def fake_send(text: str) -> None:
        sent.append(text)

    monkeypatch.setattr(notify, "send_telegram", fake_send)
    await send_alert({}, 'Taklif (<a href="https://evil.example">bosing</a>)')
    assert sent == ['Taklif (&lt;a href="https://evil.example"&gt;bosing&lt;/a&gt;)']
