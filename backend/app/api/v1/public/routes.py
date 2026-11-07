"""Public API (no auth). Cached in Redis for 5 minutes, ETag + Cache-Control for the CDN (TZ 4/9)."""

import hashlib
import hmac
import json
import logging
import uuid
from typing import Any
from urllib.parse import parse_qs

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import ValidationError
from sqlalchemy import func, select, text

from app.api.deps import DB
from app.core.config import get_settings
from app.core.errors import Problem, not_found
from app.core.queue import enqueue
from app.core.redis import get_redis
from app.models import Category, Lead, Post, Project, Service, Tag
from app.schemas.lead import LeadCreate
from app.services import content as c
from app.services.leads import create_lead
from app.services.notify import STATUS_LABELS, telegram_call
from app.services.site import preview_html

log = logging.getLogger("app.public")
router = APIRouter(tags=["public"])

CACHE_TTL = 300
PUBLIC_CACHE = "public, max-age=60, stale-while-revalidate=600"


def _json(data: Any) -> bytes:
    return json.dumps(data, ensure_ascii=False, default=str, separators=(",", ":")).encode()


async def cached(request: Request, build: Any) -> Response:
    key = "pub:" + request.url.path + "?" + str(request.url.query)
    r = get_redis()
    body = await r.get(key)
    if body is None:
        body = _json(await build()).decode()
        await r.set(key, body, ex=CACHE_TTL)
    etag = '"' + hashlib.sha1(body.encode(), usedforsecurity=False).hexdigest() + '"'
    headers = {"ETag": etag, "Cache-Control": PUBLIC_CACHE}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(body, media_type="application/json", headers=headers)


async def invalidate_public_cache() -> None:
    r = get_redis()
    async for key in r.scan_iter("pub:*"):
        await r.delete(key)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(session: DB) -> JSONResponse:
    checks = {"db": "ok", "redis": "ok"}
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        checks["db"] = "fail"
    try:
        await get_redis().ping()
    except Exception:
        checks["redis"] = "fail"
    ok = all(v == "ok" for v in checks.values())
    return JSONResponse({"status": "ok" if ok else "fail", "checks": checks}, status_code=200 if ok else 503)


def project_card(p: Project) -> dict[str, Any]:
    d = c.site_project(p)
    return {k: d[k] for k in ("slug", "cat", "title", "tagline", "summary", "illo", "image", "stack", "year",
                              "is_featured")}


@router.get("/projects")
async def projects(request: Request, session: DB, category: str | None = Query(None, max_length=40),
                   featured: bool | None = None, page: int = Query(1, ge=1),
                   limit: int = Query(12, ge=1, le=50)) -> Response:
    async def build() -> dict[str, Any]:
        stmt = c.published(select(Project), Project)
        if category:
            stmt = stmt.join(Category, Project.category_id == Category.id).where(Category.slug == category)
        if featured is not None:
            stmt = stmt.where(Project.is_featured == featured)
        total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = (await session.scalars(stmt.order_by(Project.sort_order).offset((page - 1) * limit).limit(limit))).unique().all()
        return {"items": [project_card(p) for p in rows], "total": total, "page": page, "limit": limit}

    return await cached(request, build)


@router.get("/projects/{slug}")
async def project(slug: str, request: Request, session: DB) -> Response:
    p = await session.scalar(c.published(select(Project), Project).where(Project.slug == slug))
    if p is None:
        raise not_found()
    return await cached(request, lambda: _const(c.site_project(p)))


async def _const(v: Any) -> Any:
    return v


@router.get("/services")
async def services(request: Request, session: DB) -> Response:
    async def build() -> dict[str, Any]:
        rows = (await session.scalars(c.published(select(Service), Service).order_by(Service.sort_order))).all()
        return {"items": [c.site_service(s) for s in rows]}

    return await cached(request, build)


@router.get("/services/{slug}")
async def service(slug: str, request: Request, session: DB) -> Response:
    s = await session.scalar(c.published(select(Service), Service).where(Service.slug == slug))
    if s is None:
        raise not_found()
    return await cached(request, lambda: _const(c.site_service(s)))


@router.get("/posts")
async def posts(request: Request, session: DB, tag: str | None = Query(None, max_length=60),
                q: str | None = Query(None, max_length=100), page: int = Query(1, ge=1),
                limit: int = Query(12, ge=1, le=50)) -> Response:
    async def build() -> dict[str, Any]:
        stmt = c.published(select(Post), Post)
        if tag:
            stmt = stmt.where(Post.tags.any(Tag.slug == tag))
        if q:
            stmt = stmt.where(Post.search_vector.op("@@")(func.plainto_tsquery("simple", q)))
        total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = (await session.scalars(stmt.order_by(Post.published_at.desc().nulls_last())
                                      .offset((page - 1) * limit).limit(limit))).all()
        items = []
        for p in rows:
            d = c.site_post(p)
            d.pop("body")
            items.append(d)
        return {"items": items, "total": total, "page": page, "limit": limit}

    return await cached(request, build)


@router.get("/posts/{slug}")
async def post(slug: str, request: Request, session: DB) -> Response:
    p = await session.scalar(c.published(select(Post), Post).where(Post.slug == slug))
    if p is None:
        raise not_found()
    return await cached(request, lambda: _const(c.site_post(p)))


@router.get("/site")
async def site(request: Request, session: DB) -> Response:
    async def build() -> dict[str, Any]:
        content = await c.build_site_content(session)
        return {"contact": content["CONTACT"], "facts": c.compute_facts(content), "cats": content["CATS"],
                "offers": content["OFFERS"], "steps": content["STEPS"], "seo": content["SETTINGS"]["seo"]}

    return await cached(request, build)


FORM_FIELDS = ("name", "contact_type", "contact_value", "service", "budget_range", "deadline", "message",
               "source_page", "website", "elapsed_ms")


@router.post("/leads", status_code=201)
async def submit_lead(request: Request, session: DB) -> Response:
    ctype = request.headers.get("content-type", "")
    is_form = ctype.startswith("application/x-www-form-urlencoded")
    raw = await request.body()
    if len(raw) > 64 * 1024:
        raise Problem(413, "payload_too_large")
    try:
        if is_form:
            form = {k: v[0] for k, v in parse_qs(raw.decode("utf-8", "replace"), keep_blank_values=True).items()}
            payload: dict[str, Any] = {k: form[k] for k in FORM_FIELDS if k in form and form[k] != ""}
            if "website" in form:
                payload["website"] = form["website"]
            payload["consent"] = form.get("consent") in ("on", "1", "true", "yes")
            payload["turnstile_token"] = form.get("cf-turnstile-response", "")
            payload["utm"] = {k: form[k] for k in form if k.startswith("utm_") and form[k]}
            data = LeadCreate.model_validate(payload)
        elif ctype.startswith("application/json"):
            data = LeadCreate.model_validate_json(raw)
        else:
            raise Problem(415, "unsupported_media")
    except ValidationError as e:
        if is_form:
            return RedirectResponse("/taklif/?xato=1", status_code=303)
        errors = [{"field": ".".join(str(x) for x in err["loc"]) or "body",
                   "msg": str(err["msg"]).removeprefix("Value error, ")} for err in e.errors()]
        raise Problem(422, "validation_error", errors=errors) from None
    try:
        lead = await create_lead(session, data, request)
    except Problem:
        if is_form:
            return RedirectResponse("/taklif/?xato=1", status_code=303)
        raise
    if lead.status != "spam":
        await enqueue("notify_lead", str(lead.id))
    if is_form:
        return RedirectResponse("/taklif/?yuborildi=1", status_code=303)
    return JSONResponse({"id": str(lead.id), "message": "Rahmat, 2 soat ichida bog'lanaman"}, status_code=201)


@router.get("/resolve", include_in_schema=False)
async def resolve(session: DB, path: str = Query(..., max_length=300)) -> Response:
    """nginx asks here for paths with no static file: admin/slug redirects (301/302), else 404."""
    from app.models import Redirect

    candidates = {path, path if path.endswith("/") else path + "/"}
    r = await session.scalar(select(Redirect).where(Redirect.from_path.in_(candidates)))
    if r is None:
        raise not_found()
    return RedirectResponse(r.to_path, status_code=r.code, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/preview/{token}", response_class=HTMLResponse, include_in_schema=False)
async def preview(token: str, session: DB) -> HTMLResponse:
    if len(token) > 100:
        raise not_found()
    html = await preview_html(session, token)
    if html is None:
        raise not_found()
    return HTMLResponse(html, headers={"X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store"})


@router.post("/telegram/webhook", include_in_schema=False)
async def telegram_webhook(request: Request, session: DB) -> dict[str, bool]:
    """Inline buttons on lead messages. Only the configured chat may change statuses (TZ 7)."""
    s = get_settings()
    secret = s.telegram_webhook_secret.get_secret_value() if s.telegram_webhook_secret else ""
    given = request.headers.get("x-telegram-bot-api-secret-token", "")
    if not secret or not hmac.compare_digest(given.encode(), secret.encode()):
        raise Problem(403, "forbidden")
    update = await request.json()
    cq = update.get("callback_query") or {}
    chat_id = str(((cq.get("message") or {}).get("chat") or {}).get("id", ""))
    data = str(cq.get("data", ""))
    if not cq or chat_id != str(s.telegram_chat_id) or not data.startswith("lead:"):
        return {"ok": True}
    try:
        _, lead_id, status = data.split(":")
        lead = await session.get(Lead, uuid.UUID(lead_id))
    except ValueError:
        return {"ok": True}
    answer = "Topilmadi"
    if lead is not None and status in ("contacted", "spam"):
        from app.models import LeadEvent

        session.add(LeadEvent(lead_id=lead.id, kind="status_change",
                              payload={"from": lead.status, "to": status, "via": "telegram"}))
        lead.status = status
        await session.commit()
        answer = f"#{lead.number}: {STATUS_LABELS[status]}"
    try:
        await telegram_call("answerCallbackQuery", {"callback_query_id": cq.get("id"), "text": answer})
    except Exception:
        log.warning("answerCallbackQuery failed")
    return {"ok": True}

