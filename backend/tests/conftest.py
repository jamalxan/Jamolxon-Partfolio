"""Tests run against real PostgreSQL + Redis (TZ 12). Configure with TEST_DATABASE_URL / TEST_REDIS_URL."""

import os

os.environ["ENV"] = "test"
os.environ["COOKIE_SECURE"] = "false"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://jamolxon:jamolxon@127.0.0.1:5432/jamolxon_test")
os.environ["REDIS_URL"] = os.environ.get("TEST_REDIS_URL", "redis://:devredis@127.0.0.1:6380/15")
os.environ["SITE_URL"] = "https://jamolxon.test"
os.environ["TURNSTILE_SECRET"] = ""
os.environ["TELEGRAM_BOT_TOKEN"] = ""

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pyotp
import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core import queue
from app.core.config import get_settings
from app.core.db import dispose_engine, get_sessionmaker
from app.core.redis import close_redis, get_redis
from app.core.security import encrypt, hash_password
from app.models import User

BACKEND = Path(__file__).resolve().parents[1]
PASSWORD = "to'g'ri-parol-2026!"


@pytest.fixture(scope="session", autouse=True)
def migrated_db() -> None:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")  # also proves migrations apply cleanly from scratch


TABLES = ["post_tags", "project_images", "lead_events", "leads", "refresh_tokens", "audit_logs", "projects",
          "posts", "services", "tags", "categories", "offers", "process_steps", "media", "redirects", "settings",
          "heartbeats", "users"]


@pytest.fixture(autouse=True)
async def clean() -> AsyncIterator[None]:
    async with get_sessionmaker()() as s:
        await s.execute(text("TRUNCATE " + ", ".join(TABLES) + " RESTART IDENTITY CASCADE"))
        await s.commit()
    await get_redis().flushdb()
    queue.test_jobs.clear()
    yield
    await close_redis()
    await dispose_engine()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def make_user(email: str = "owner@jamolxon.uz", role: str = "owner", totp: bool = True,
                    password: str = PASSWORD) -> tuple[User, str]:
    secret = pyotp.random_base32()
    async with get_sessionmaker()() as s:
        u = User(email=email, name=role, role=role, password_hash=hash_password(password),
                 totp_secret=encrypt(secret) if totp else None, totp_enabled=totp)
        s.add(u)
        await s.commit()
        await s.refresh(u)
    return u, secret


def csrf(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("jx_csrf") or ""}


async def login(client: AsyncClient, email: str, secret: str, password: str = PASSWORD) -> dict[str, Any]:
    r = await client.post("/api/v1/admin/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    r = await client.post("/api/v1/admin/auth/2fa/verify", json={"code": pyotp.TOTP(secret).now()})
    assert r.status_code == 200, r.text
    data: dict[str, Any] = r.json()
    return data


@pytest.fixture
async def owner(client: AsyncClient) -> User:
    u, secret = await make_user()
    await login(client, u.email, secret)
    return u


@pytest.fixture
async def editor_client() -> AsyncIterator[AsyncClient]:
    from app.main import app

    u, secret = await make_user("editor@jamolxon.uz", "editor")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await login(c, u.email, secret)
        yield c


@pytest.fixture
async def seeded() -> None:
    from scripts.seed_from_datajs import DEFAULT_FILE, load, seed

    await seed(load(DEFAULT_FILE, refresh=False))


def jobs(name: str) -> list[tuple[Any, ...]]:
    return [args for n, args, _ in queue.test_jobs if n == name]


assert get_settings().env == "test"
