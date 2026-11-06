"""Worker jobs, notifications and site build (TZ 5, 7, 11)."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.models import Heartbeat, Lead, Post, Project, Service
from app.services import notify
from app.workers import main as worker


def ctx() -> dict[str, Any]:
    return {"job_try": 1, "redis": AsyncMock()}


async def add_lead(**kw: Any) -> Lead:
    async with get_sessionmaker()() as s:
        lead = Lead(name="Ali", contact_type="email", contact_value="ali@example.com", message="Salom, sayt kerak",
                    **kw)
        s.add(lead)
        await s.commit()
        await s.refresh(lead)
        return lead


async def test_rebuild_writes_site_and_is_debounced(seeded: None, tmp_path: Path,
                                                    monkeypatch: pytest.MonkeyPatch) -> None:
    out = tmp_path / "site"
    monkeypatch.setattr(get_settings(), "site_out_dir", out)
    monkeypatch.setattr(get_settings(), "frontend_dist", None)
    c = ctx()
    n = await worker.rebuild_site_job(c)
    assert n >= 28
    assert (out / "index.html").exists() and (out / "loyihalar" / "socialauto" / "index.html").exists()
    assert "Jamolxon" in (out / "index.html").read_text(encoding="utf-8")
    from app.core.redis import get_redis

    await get_redis().set(worker.REBUILD_LOCK, "1")
    assert await worker.rebuild_site_job(c) == 0  # a build is running: collapse into a pending rebuild
    assert await get_redis().get("rebuild:pending") == "1"


async def test_unpublished_project_disappears_from_site(seeded: None, tmp_path: Path,
                                                        monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "site_out_dir", tmp_path / "s")
    monkeypatch.setattr(get_settings(), "frontend_dist", None)
    async with get_sessionmaker()() as s:
        p = await s.scalar(select(Project).where(Project.slug == "socialauto"))
        assert p is not None
        p.status = "draft"
        await s.commit()
    await worker.rebuild_site_job(ctx())
    assert not (tmp_path / "s" / "loyihalar" / "socialauto").exists()
    assert "/loyihalar/socialauto/" not in (tmp_path / "s" / "sitemap.xml").read_text(encoding="utf-8")


async def test_scheduled_publish_triggers_rebuild(seeded: None) -> None:
    from app.core.redis import get_redis

    await get_redis().set("scheduled:last_check", (datetime.now(UTC) - timedelta(minutes=5)).isoformat())
    async with get_sessionmaker()() as s:
        for model in (Project, Service, Post):  # seeded rows were published long ago
            await s.execute(update(model).values(published_at=datetime.now(UTC) - timedelta(days=30)))
        p = await s.scalar(select(Project).where(Project.slug == "vocably"))
        assert p is not None
        p.published_at = datetime.now(UTC) - timedelta(minutes=1)
        await s.commit()
    c = ctx()
    assert await worker.publish_scheduled(c) == 1
    c["redis"].enqueue_job.assert_awaited_with("rebuild_site")


async def test_future_published_at_is_hidden(seeded: None) -> None:
    from app.services.content import build_site_content

    async with get_sessionmaker()() as s:
        p = await s.scalar(select(Project).where(Project.slug == "vocably"))
        assert p is not None
        p.published_at = datetime.now(UTC) + timedelta(days=1)
        await s.commit()
        content = await build_site_content(s)
    assert "vocably" not in [x["slug"] for x in content["PROJECTS"]]


async def test_stale_lead_reminder_once() -> None:
    lead = await add_lead()
    async with get_sessionmaker()() as s:
        row = await s.get(Lead, lead.id)
        assert row is not None
        row.created_at = datetime.now(UTC) - timedelta(hours=25)
        await s.commit()
    c = ctx()
    assert await worker.remind_stale_leads(c) == 1
    assert "24 soatdan beri" in c["redis"].enqueue_job.call_args.args[1]
    assert await worker.remind_stale_leads(ctx()) == 0


async def test_anonymize_after_24_months() -> None:
    old, new = await add_lead(), await add_lead()
    async with get_sessionmaker()() as s:
        row = await s.get(Lead, old.id)
        assert row is not None
        row.created_at = datetime.now(UTC) - timedelta(days=731)
        await s.commit()
    assert await worker.anonymize_old_leads(ctx()) == 1
    async with get_sessionmaker()() as s:
        a, b = await s.get(Lead, old.id), await s.get(Lead, new.id)
        assert a is not None and b is not None
        assert a.contact_value == "anonim" and a.anonymized_at is not None
        assert b.contact_value == "ali@example.com"


async def test_heartbeat() -> None:
    await worker.heartbeat(ctx())
    await worker.heartbeat(ctx())
    async with get_sessionmaker()() as s:
        assert await s.get(Heartbeat, "worker") is not None


async def test_send_alert_swallows_errors() -> None:
    with patch.object(notify, "send_telegram", AsyncMock(side_effect=notify.NotifyError("x"))):
        await worker.send_alert(ctx(), "salom")


async def test_client_confirmation_email() -> None:
    lead = await add_lead()
    send = AsyncMock()
    with patch.object(notify, "email_configured", lambda: True), patch.object(notify, "send_email", send):
        await worker.send_client_confirmation(lead)
    assert send.call_args.args[0] == "ali@example.com" and "qabul qilindi" in send.call_args.args[1]


async def test_all_channels_down_returns_failed() -> None:
    lead = await add_lead()
    with patch.object(notify, "send_telegram", AsyncMock(side_effect=notify.NotifyError("x"))):
        assert await worker.notify_lead({"job_try": 5}, str(lead.id)) == "failed"


async def test_telegram_call_http(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "telegram_bot_token", SecretStr("123:abc"))
    monkeypatch.setattr(get_settings(), "telegram_chat_id", "42")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/bot123:abc/sendMessage"
        return httpx.Response(200, json={"ok": True, "result": {}})

    transport = httpx.MockTransport(handler)
    orig = httpx.AsyncClient

    def client(*a: Any, **kw: Any) -> httpx.AsyncClient:
        return orig(*a, transport=transport, **kw)

    with patch("app.services.notify.httpx.AsyncClient", client):
        await notify.send_telegram("salom", [[{"text": "x", "url": "https://t.me/x"}]])

    def bad(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"ok": False, "description": "chat not found"})

    transport = httpx.MockTransport(bad)
    with patch("app.services.notify.httpx.AsyncClient", client), pytest.raises(notify.NotifyError):
        await notify.send_telegram("salom")
    monkeypatch.setattr(get_settings(), "telegram_bot_token", None)
    with pytest.raises(notify.NotifyError):
        await notify.send_telegram("salom")
    assert notify.telegram_configured() is False


async def test_email_not_configured() -> None:
    with pytest.raises(notify.NotifyError):
        await notify.send_email("a@b.uz", "s", "b")


async def test_turnstile_verification(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import leads

    assert await leads.verify_turnstile("", "1.1.1.1") is True  # not configured
    monkeypatch.setattr(get_settings(), "turnstile_secret", SecretStr("s"))
    assert await leads.verify_turnstile("", "1.1.1.1") is False
    orig = httpx.AsyncClient

    def client(*a: Any, **kw: Any) -> httpx.AsyncClient:
        return orig(*a, transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"success": True})), **kw)

    with patch("app.services.leads.httpx.AsyncClient", client):
        assert await leads.verify_turnstile("tok", "1.1.1.1") is True
