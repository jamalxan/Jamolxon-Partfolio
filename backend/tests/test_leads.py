"""TZ 7 lead flow + TZ 12 acceptance (persist before notify, spam, retries, email fallback)."""

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from arq import Retry
from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.models import Lead, User
from app.services import notify
from app.workers import main as worker
from tests.conftest import csrf, jobs

GOOD: dict[str, Any] = {"name": "Aziz Karimov", "contact_type": "telegram", "contact_value": "@aziz_k",
                        "service": "crm-erp", "budget_range": "1000-3000", "deadline": "1_oy",
                        "message": "O'quv markazimiz uchun CRM kerak, gaplashsak", "consent": True,
                        "source_page": "/xizmatlar/crm-erp", "utm": {"utm_source": "instagram"}, "website": "",
                        "elapsed_ms": 15000}


async def all_leads() -> list[Lead]:
    async with get_sessionmaker()() as s:
        return list((await s.scalars(select(Lead).order_by(Lead.number))).all())


async def test_valid_lead_saved_and_notification_queued(client: AsyncClient, seeded: None) -> None:
    r = await client.post("/api/v1/leads", json=GOOD)
    assert r.status_code == 201
    assert r.json()["message"] == "Rahmat, 2 soat ichida bog'lanaman"
    [lead] = await all_leads()
    assert lead.status == "new" and lead.number == 1 and lead.service_id is not None
    assert lead.ip_hash and "127" not in lead.ip_hash  # raw IP never stored
    assert jobs("notify_lead") == [(str(lead.id),)]


@pytest.mark.parametrize("field,value,err_field", [
    ("name", "A", "name"), ("message", "qisqa", "message"), ("contact_value", "@ab", "contact_value"),
    ("consent", False, "consent"), ("service", "yoq-xizmat", "service"), ("budget_range", "1 mln", "budget_range"),
])
async def test_validation_errors_are_field_mapped(client: AsyncClient, seeded: None, field: str, value: Any,
                                                  err_field: str) -> None:
    r = await client.post("/api/v1/leads", json={**GOOD, field: value})
    assert r.status_code == 422
    body = r.json()
    assert body["type"] == "validation_error" and body["request_id"]
    assert any(e["field"] == err_field for e in body["errors"]), body


@pytest.mark.parametrize("ctype,value,expected", [
    ("email", "Aziz@Example.COM", "aziz@example.com"), ("telegram", "aziz_k", "@aziz_k"),
    ("phone", "93 160 67 06", "+998931606706"), ("phone", "+998 (93) 160-67-06", "+998931606706"),
])
async def test_contact_normalization(client: AsyncClient, seeded: None, ctype: str, value: str,
                                     expected: str) -> None:
    r = await client.post("/api/v1/leads", json={**GOOD, "contact_type": ctype, "contact_value": value})
    assert r.status_code == 201, r.text
    assert (await all_leads())[0].contact_value == expected


async def test_unknown_fields_rejected(client: AsyncClient, seeded: None) -> None:
    r = await client.post("/api/v1/leads", json={**GOOD, "status": "won"})
    assert r.status_code == 422


@pytest.mark.parametrize("override", [{"website": "http://spam.example"}, {"elapsed_ms": 900}])
async def test_bots_saved_as_spam_without_notification(client: AsyncClient, seeded: None,
                                                       override: dict[str, Any]) -> None:
    r = await client.post("/api/v1/leads", json={**GOOD, **override})
    assert r.status_code == 201  # bots get the same answer
    [lead] = await all_leads()
    assert lead.status == "spam" and lead.spam_score >= 50
    assert jobs("notify_lead") == []


async def test_failed_turnstile_is_spam(client: AsyncClient, seeded: None) -> None:
    with patch("app.services.leads.verify_turnstile", AsyncMock(return_value=False)):
        await client.post("/api/v1/leads", json=GOOD)
    assert (await all_leads())[0].status == "spam"


async def test_duplicate_message_scores_higher(client: AsyncClient, seeded: None) -> None:
    await client.post("/api/v1/leads", json=GOOD)
    await client.post("/api/v1/leads", json={**GOOD, "contact_value": "@boshqa_odam"})
    a, b = await all_leads()
    assert b.spam_score > a.spam_score


async def test_rate_limit_per_ip(client: AsyncClient, seeded: None) -> None:
    for i in range(5):
        r = await client.post("/api/v1/leads", json={**GOOD, "message": f"Xabar raqami {i} — CRM kerak"})
        assert r.status_code == 201
    r = await client.post("/api/v1/leads", json={**GOOD, "message": "Oltinchi xabar, CRM kerak"})
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0


async def test_no_js_form_post_redirects(client: AsyncClient, seeded: None) -> None:
    form = {"name": "Aziz", "contact_type": "email", "contact_value": "a@example.com", "service": "boshqa",
            "message": "Sayt kerak, iltimos bog'laning", "consent": "on", "website": "", "elapsed_ms": "20000"}
    r = await client.post("/api/v1/leads", data=form)
    assert r.status_code == 303 and r.headers["location"] == "/taklif/?yuborildi=1"
    r = await client.post("/api/v1/leads", data={**form, "consent": ""})
    assert r.headers["location"] == "/taklif/?xato=1"


async def notify_ctx(attempt: int) -> dict[str, Any]:
    return {"job_try": attempt, "redis": AsyncMock()}


async def test_worker_sends_telegram_with_buttons(client: AsyncClient, seeded: None) -> None:
    await client.post("/api/v1/leads", json=GOOD)
    [lead] = await all_leads()
    send = AsyncMock()
    with patch.object(notify, "send_telegram", send):
        assert await worker.notify_lead(await notify_ctx(1), str(lead.id)) == "telegram"
    text, buttons = send.call_args.args
    assert "Yangi taklif #1 — CRM va ERP tizimlar" in text and "@aziz_k" in text and "utm_source=instagram" in text
    assert buttons[0][0]["url"] == "https://t.me/aziz_k"
    assert {b["callback_data"] for b in buttons[1]} == {f"lead:{lead.id}:contacted", f"lead:{lead.id}:spam"}
    [lead] = await all_leads()
    assert lead.notified_at is not None
    # idempotent: a retried job does not send twice
    with patch.object(notify, "send_telegram", send):
        assert await worker.notify_lead(await notify_ctx(2), str(lead.id)) == "skip"


async def test_telegram_down_retries_then_email_fallback(client: AsyncClient, seeded: None,
                                                         monkeypatch: pytest.MonkeyPatch) -> None:
    await client.post("/api/v1/leads", json=GOOD)
    [lead] = await all_leads()
    fail = AsyncMock(side_effect=notify.NotifyError("down"))
    email = AsyncMock()
    monkeypatch.setattr(notify, "email_configured", lambda: True)
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "owner_email", "owner@jamolxon.uz")
    with patch.object(notify, "send_telegram", fail), patch.object(notify, "send_email", email):
        for attempt in range(1, 5):
            with pytest.raises(Retry):
                await worker.notify_lead(await notify_ctx(attempt), str(lead.id))
        assert await worker.notify_lead(await notify_ctx(5), str(lead.id)) == "email"
    assert email.call_args.args[0] == "owner@jamolxon.uz"
    [lead] = await all_leads()
    assert lead.notified_at is not None  # lead never lost


async def test_backoff_is_exponential() -> None:
    assert [worker.backoff(i) for i in range(1, 6)] == [10, 20, 40, 80, 160]


async def test_admin_lead_flow(client: AsyncClient, owner: User, seeded: None) -> None:
    await client.post("/api/v1/leads", json=GOOD)
    lst = (await client.get("/api/v1/admin/leads?status=new")).json()
    assert lst["total"] == 1
    lead_id = lst["items"][0]["id"]
    r = await client.patch(f"/api/v1/admin/leads/{lead_id}", json={"status": "contacted"}, headers=csrf(client))
    assert r.json()["status"] == "contacted"
    assert r.json()["events"][0]["kind"] == "status_change"
    r = await client.post(f"/api/v1/admin/leads/{lead_id}/events", headers=csrf(client),
                          json={"kind": "note", "payload": {"text": "Ertaga qo'ng'iroq"}})
    assert r.status_code == 201
    csv = await client.get("/api/v1/admin/leads/export.csv")
    assert csv.headers["content-type"].startswith("text/csv") and "Aziz Karimov" in csv.text


async def test_editor_can_note_but_not_change_status(editor_client: AsyncClient, seeded: None,
                                                     client: AsyncClient) -> None:
    await client.post("/api/v1/leads", json=GOOD)
    lead_id = (await all_leads())[0].id
    c = editor_client
    assert (await c.patch(f"/api/v1/admin/leads/{lead_id}", json={"status": "won"}, headers=csrf(c))).status_code == 403
    r = await c.post(f"/api/v1/admin/leads/{lead_id}/events", headers=csrf(c),
                     json={"kind": "note", "payload": {"text": "ko'rdim"}})
    assert r.status_code == 201


async def test_telegram_webhook_buttons(client: AsyncClient, seeded: None, monkeypatch: pytest.MonkeyPatch) -> None:
    from pydantic import SecretStr

    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "telegram_webhook_secret", SecretStr("hook-secret"))
    monkeypatch.setattr(get_settings(), "telegram_chat_id", "42")
    await client.post("/api/v1/leads", json=GOOD)
    lead = (await all_leads())[0]
    update = {"callback_query": {"id": "1", "data": f"lead:{lead.id}:spam", "message": {"chat": {"id": 42}}}}
    assert (await client.post("/api/v1/telegram/webhook", json=update)).status_code == 403  # no secret header
    other = {"callback_query": {**update["callback_query"], "message": {"chat": {"id": 7}}}}
    with patch("app.api.v1.public.routes.telegram_call", AsyncMock()):
        await client.post("/api/v1/telegram/webhook", json=other,
                          headers={"X-Telegram-Bot-Api-Secret-Token": "hook-secret"})
        assert (await all_leads())[0].status == "new"  # foreign chat ignored
        await client.post("/api/v1/telegram/webhook", json=update,
                          headers={"X-Telegram-Bot-Api-Secret-Token": "hook-secret"})
    assert (await all_leads())[0].status == "spam"
