"""ARQ worker (TZ 7, 5, 11): lead notifications with retries + email fallback, debounced site rebuilds,
scheduled publishing, 24h reminders for untouched leads, 24-month anonymization, heartbeat.

Run: arq app.workers.main.WorkerSettings
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from arq import Retry, cron, func
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import dispose_engine, get_sessionmaker
from app.core.logging import setup_logging
from app.core.queue import redis_settings
from app.core.redis import close_redis, get_redis
from app.models import Heartbeat, Lead, LeadEvent, Post, Project, Service
from app.services import notify
from app.services.site import rebuild_site

log = logging.getLogger("app.worker")

MAX_TRIES = 5  # TZ 7: retry Telegram 5 times with exponential backoff, then email fallback
REBUILD_LOCK = "lock:rebuild"


def backoff(attempt: int) -> int:
    return min(2 ** attempt * 5, 300)  # 10s, 20s, 40s, 80s, 160s


async def notify_lead(ctx: dict[str, Any], lead_id: str) -> str:
    attempt: int = ctx.get("job_try", 1)
    async with get_sessionmaker()() as session:
        lead = await session.get(Lead, uuid.UUID(lead_id))
        if lead is None or lead.notified_at is not None:
            return "skip"
        svc = await session.get(Service, lead.service_id) if lead.service_id else None
        title = svc.title if svc else "Boshqa"
        text, buttons = notify.lead_message(lead, title)
        try:
            await notify.send_telegram(text, buttons)
            channel = "telegram"
        except notify.NotifyError as e:
            log.warning("telegram failed", extra={"lead": lead_id, "attempt": attempt, "error": str(e)})
            if attempt < MAX_TRIES:
                raise Retry(defer=backoff(attempt)) from None
            s = get_settings()
            if not (notify.email_configured() and s.owner_email):
                log.error("lead notification failed on all channels", extra={"lead": lead_id})
                return "failed"
            try:
                await notify.send_email(s.owner_email, f"Yangi taklif #{lead.number} — {title}",
                                        text.replace("<b>", "").replace("</b>", ""))
            except notify.NotifyError:
                log.error("email fallback failed", extra={"lead": lead_id})
                return "failed"
            channel = "email"
        lead.notified_at = datetime.now(UTC)
        session.add(LeadEvent(lead_id=lead.id, kind="notify", payload={"channel": channel, "attempt": attempt}))
        await session.commit()
        await send_client_confirmation(lead)
        return channel


async def send_client_confirmation(lead: Lead) -> None:
    if lead.contact_type != "email" or not notify.email_configured():
        return
    try:
        await notify.send_email(lead.contact_value, "Taklifingiz qabul qilindi — jamolxon.uz",
                                f"Assalomu alaykum, {lead.name}!\n\nTaklifingiz qabul qilindi (#{lead.number}). "
                                "2 soat ichida (ish vaqtida) bog'lanaman.\n\nJamolxon\nhttps://jamolxon.uz")
    except notify.NotifyError:
        log.warning("client confirmation failed", extra={"lead": str(lead.id)})


async def send_alert(ctx: dict[str, Any], text: str) -> None:
    try:
        await notify.send_telegram(text)
    except notify.NotifyError:
        log.warning("alert not delivered", extra={"alert": text})


async def rebuild_site_job(ctx: dict[str, Any], force: bool = False) -> int:
    """Debounced: bursts of edits collapse into one build (lock held while building)."""
    r = get_redis()
    if not await r.set(REBUILD_LOCK, "1", nx=True, ex=120):
        await r.set("rebuild:pending", "1", ex=300)
        return 0
    try:
        await r.delete("rebuild:pending")
        async with get_sessionmaker()() as session:
            paths = await rebuild_site(session)
        async for key in r.scan_iter("pub:*"):
            await r.delete(key)
        await purge_cdn(paths)
        return len(paths)
    finally:
        await r.delete(REBUILD_LOCK)
        if await r.get("rebuild:pending"):
            await ctx["redis"].enqueue_job("rebuild_site", _defer_by=timedelta(seconds=3))


async def purge_cdn(paths: list[str]) -> None:
    """Purges changed URLs from Cloudflare cache (only when CF credentials are configured)."""
    import os

    zone, token = os.environ.get("CF_ZONE_ID"), os.environ.get("CF_API_TOKEN")
    if not (zone and token and paths):
        return
    base = get_settings().site_url.rstrip("/")
    urls = [base + p for p in paths]
    async with httpx.AsyncClient(timeout=15) as client:
        for i in range(0, len(urls), 30):
            await client.post(f"https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache",
                              headers={"Authorization": f"Bearer {token}"}, json={"files": urls[i:i + 30]})


async def publish_scheduled(ctx: dict[str, Any]) -> int:
    """Items published with a future published_at become visible on time: trigger a rebuild when one is due."""
    now = datetime.now(UTC)
    last = await get_redis().get("scheduled:last_check")
    since = datetime.fromisoformat(last) if last else now - timedelta(minutes=2)
    due = 0
    async with get_sessionmaker()() as session:
        for model in (Project, Service, Post):
            due += len((await session.scalars(select(model.id).where(
                model.status == "published", model.deleted_at.is_(None), model.published_at > since,
                model.published_at <= now))).all())
    await get_redis().set("scheduled:last_check", now.isoformat())
    if due:
        await ctx["redis"].enqueue_job("rebuild_site")
    return due


async def remind_stale_leads(ctx: dict[str, Any]) -> int:
    cutoff = datetime.now(UTC) - timedelta(hours=24)
    async with get_sessionmaker()() as session:
        rows = (await session.scalars(select(Lead).where(Lead.status == "new", Lead.created_at <= cutoff,
                                                         Lead.reminded_at.is_(None)))).all()
        for lead in rows:
            await ctx["redis"].enqueue_job(
                "send_alert", f"⏰ Taklif #{lead.number} ({lead.name}) 24 soatdan beri «Yangi» holatida")
            lead.reminded_at = datetime.now(UTC)
        await session.commit()
        return len(rows)


async def anonymize_old_leads(ctx: dict[str, Any]) -> int:
    """TZ 3: leads older than 24 months are anonymized."""
    cutoff = datetime.now(UTC) - timedelta(days=730)
    async with get_sessionmaker()() as session:
        result = await session.execute(update(Lead).where(Lead.created_at <= cutoff, Lead.anonymized_at.is_(None))
                                       .values(name="anonim", contact_value="anonim", message="[anonimlashtirildi]",
                                               ip_hash="", user_agent="", utm={}, anonymized_at=datetime.now(UTC)))
        await session.commit()
        return int(getattr(result, "rowcount", 0) or 0)


async def heartbeat(ctx: dict[str, Any]) -> None:
    async with get_sessionmaker()() as session:
        hb = await session.get(Heartbeat, "worker")
        if hb is None:
            session.add(Heartbeat(name="worker", at=datetime.now(UTC)))
        else:
            hb.at = datetime.now(UTC)
        await session.commit()


async def startup(ctx: dict[str, Any]) -> None:
    setup_logging()
    if get_settings().sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(dsn=get_settings().sentry_dsn, traces_sample_rate=0.1, environment=get_settings().env)
    await ctx["redis"].enqueue_job("rebuild_site", force=True)  # site always matches DB after deploy


async def shutdown(ctx: dict[str, Any]) -> None:
    await close_redis()
    await dispose_engine()


class WorkerSettings:
    functions = [notify_lead, send_alert, func(rebuild_site_job, name="rebuild_site")]
    cron_jobs = [
        cron(publish_scheduled, second={0}),
        cron(heartbeat, second={30}),
        cron(remind_stale_leads, minute={5, 35}),
        cron(anonymize_old_leads, hour={2}, minute={15}),
    ]
    redis_settings = redis_settings()
    on_startup = startup
    on_shutdown = shutdown
    max_tries = MAX_TRIES
    job_timeout = 300
    keep_result = 3600

