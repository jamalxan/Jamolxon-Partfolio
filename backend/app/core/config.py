"""Application settings — read from environment / .env (never hardcode secrets)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["local", "test", "staging", "production"] = "local"
    site_url: str = "http://localhost:8080"
    admin_url: str = "http://localhost:5173"

    database_url: str = "postgresql+asyncpg://jamolxon:jamolxon@localhost:5432/jamolxon"
    redis_url: str = "redis://localhost:6379/0"

    # >= 32 random bytes each (TZ 8). Generate: python -c "import secrets;print(secrets.token_urlsafe(48))"
    secret_key: SecretStr = SecretStr("dev-secret-key-change-me-dev-secret-key-change-me")
    jwt_key: SecretStr = SecretStr("dev-jwt-key-change-me-dev-jwt-key-change-me-0000")
    # base64 of 32 bytes, used for AES-GCM (TOTP secrets)
    encryption_key: SecretStr = SecretStr("ZGV2LWVuY3J5cHRpb24ta2V5LTMyLWJ5dGVzLWxvbmc=")
    ip_hash_salt: SecretStr = SecretStr("dev-ip-salt")

    cookie_secure: bool = True
    cors_origins: list[str] = Field(default_factory=lambda: ["https://jamolxon.uz", "https://admin.jamolxon.uz"])
    trusted_proxies: str = "*"

    access_token_minutes: int = 15
    refresh_token_days: int = 7
    login_max_attempts: int = 5
    login_window_minutes: int = 15

    lead_rate_per_ip_hour: int = 5
    lead_rate_per_contact_day: int = 20

    turnstile_secret: SecretStr | None = None
    turnstile_site_key: str = ""

    telegram_bot_token: SecretStr | None = None
    telegram_chat_id: str = ""
    telegram_webhook_secret: SecretStr | None = None

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr | None = None
    smtp_from: str = "Jamolxon <noreply@jamolxon.uz>"
    owner_email: str = ""

    # Media: R2 (S3) if configured, otherwise local directory served under /media/
    s3_endpoint: str = ""
    s3_bucket: str = ""
    s3_access_key: str = ""
    s3_secret_key: SecretStr | None = None
    media_public_url: str = "/media"
    media_dir: Path = Path("var/media")

    # Static site output (nginx serves it)
    site_out_dir: Path = Path("var/site")
    frontend_dist: Path | None = None

    sentry_dsn: str = ""
    heartbeat_url: str = ""

    @property
    def is_prod(self) -> bool:
        return self.env == "production"

    @property
    def openapi_enabled(self) -> bool:
        return self.env != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
