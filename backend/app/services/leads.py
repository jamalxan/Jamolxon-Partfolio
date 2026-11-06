"""Lead intake: Turnstile, rate limits, spam score, persist-before-notify (TZ 7)."""

import logging
import re
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import field_error
from app.core.ratelimit import client_ip, enforce
from app.core.security import hash_ip
from app.models import Lead, Service
from app.schemas.lead import LeadCreate

log = logging.getLogger("app.leads")

SPAM_THRESHOLD = 50
_URL = re.compile(r"https?://|www\.", re.I)


async def verify_turnstile(token: str, ip: str) -> bool:
    s = get_settings()
    if not s.turnstile_secret:
        return True  # not configured (local/test) — other spam signals still apply
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post("https://challenges.cloudflare.com/turnstile/v0/siteverify",
                                  data={"secret": s.turnstile_secret.get_secret_value(), "response": token,
                                        "remoteip": ip})
            return bool(r.json().get("success"))
    except (httpx.HTTPError, ValueError):
        log.warning("turnstile unreachable")
        return False


async def spam_score(session: AsyncSession, data: LeadCreate, *, turnstile_ok: bool) -> int:
    score = 0
    if data.website:
        score += 100  # honeypot filled
    if not turnstile_ok:
        score += 100
    if data.elapsed_ms is not None and data.elapsed_ms < 3000:
        score += 60  # faster than a human can fill the form
    links = len(_URL.findall(data.message))
    score += min(links * 15, 60)
    since = datetime.now(UTC) - timedelta(days=7)
    dupes = await session.scalar(select(func.count()).select_from(Lead).where(
        Lead.message == data.message, Lead.created_at >= since))
    if dupes:
        score += 50
    return min(score, 100)


async def create_lead(session: AsyncSession, data: LeadCreate, request: Request) -> Lead:
    s = get_settings()
    ip = client_ip(request)
    ip_h = hash_ip(ip)
    await enforce(f"lead:ip:{ip_h}", s.lead_rate_per_ip_hour, 3600)
    await enforce(f"lead:contact:{data.contact_value.lower()}", s.lead_rate_per_contact_day, 86400)

    service_id = None
    if data.service != "boshqa":
        svc = await session.scalar(select(Service).where(Service.slug == data.service, Service.deleted_at.is_(None)))
        if svc is None:
            raise field_error("service", "Bunday xizmat yo'q")
        service_id = svc.id

    turnstile_ok = await verify_turnstile(data.turnstile_token, ip)
    score = await spam_score(session, data, turnstile_ok=turnstile_ok)
    lead = Lead(
        name=data.name, contact_type=data.contact_type, contact_value=data.contact_value, service_id=service_id,
        service_slug=data.service, budget_range=data.budget_range, deadline=data.deadline, message=data.message,
        status="spam" if score >= SPAM_THRESHOLD else "new", source_page=data.source_page, utm=data.utm,
        ip_hash=ip_h, user_agent=request.headers.get("user-agent", "")[:300], spam_score=score,
    )
    session.add(lead)
    await session.commit()  # persisted before any notification is attempted
    await session.refresh(lead)
    return lead
