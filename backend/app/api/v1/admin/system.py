import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, Owner, Staff
from app.api.v1.admin.auth import revoke_user_sessions
from app.api.v1.admin.leads import lead_out
from app.core.errors import field_error, not_found
from app.core.queue import enqueue
from app.core.redis import get_redis
from app.core.security import hash_password, validate_new_password
from app.models import AuditLog, Heartbeat, Lead, Post, Project, Redirect, Service, Setting, User
from app.schemas.system import RedirectIn, RedirectOut, SettingsIn, UserCreate, UserOut, UserPatch
from app.services.audit import make_diff, record

router = APIRouter(tags=["admin-system"])

SETTING_KEYS = ("contact", "social", "seo", "telegram")


@router.get("/dashboard")
async def dashboard(session: DB, user: Staff) -> dict[str, Any]:
    now = datetime.now(UTC)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    async def count_since(since: datetime) -> int:
        return await session.scalar(select(func.count()).select_from(Lead).where(
            Lead.created_at >= since, Lead.status != "spam")) or 0

    new = (await session.scalars(select(Lead).where(Lead.status == "new").order_by(Lead.created_at.desc())
                                 .limit(10))).all()
    pubs: list[dict[str, Any]] = []
    for entity, model in (("project", Project), ("service", Service), ("post", Post)):
        rows = (await session.scalars(select(model).where(model.status == "published", model.deleted_at.is_(None))
                                      .order_by(model.published_at.desc().nulls_last()).limit(5))).all()
        pubs += [{"entity": entity, "id": str(r.id), "title": r.title, "published_at": r.published_at} for r in rows]
    pubs.sort(key=lambda x: x["published_at"] or datetime.min.replace(tzinfo=UTC), reverse=True)
    backup = await session.get(Heartbeat, "backup")
    worker = await session.get(Heartbeat, "worker")
    errors = int(await get_redis().get("metrics:errors_24h") or 0)
    return {
        "leads": {"today": await count_since(start), "week": await count_since(now - timedelta(days=7)),
                  "month": await count_since(now - timedelta(days=30))},
        "new_leads": [lead_out(x) for x in new],
        "recent_publications": pubs[:8],
        "system": {"last_backup_at": backup.at if backup else None, "errors_24h": errors,
                   "worker_ok": bool(worker and worker.at > now - timedelta(minutes=5))},
    }


@router.get("/settings")
async def get_settings_(session: DB, user: Owner) -> dict[str, Any]:
    rows = {r.key: r.value for r in (await session.scalars(select(Setting).where(Setting.key.in_(SETTING_KEYS))))}
    return {k: rows.get(k, {}) for k in SETTING_KEYS}


@router.put("/settings")
async def put_settings(body: SettingsIn, request: Request, session: DB, user: Owner) -> dict[str, Any]:
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        row = await session.get(Setting, key)
        before = row.value if row else {}
        if row is None:
            session.add(Setting(key=key, value=value))
        else:
            row.value = value
        await record(session, actor_id=user.id, action="update", entity="settings", entity_id=key,
                     diff=make_diff(before or {}, value or {}), request=request)
    await session.commit()
    await enqueue("rebuild_site")
    return await get_settings_(session, user)


@router.get("/users")
async def list_users(session: DB, user: Owner) -> dict[str, Any]:
    rows = (await session.scalars(select(User).order_by(User.created_at))).all()
    items = [UserOut.model_validate(u).model_dump() for u in rows]
    return {"items": items, "total": len(items), "page": 1, "limit": len(items) or 1}


@router.post("/users", status_code=201, response_model=UserOut)
async def create_user(body: UserCreate, request: Request, session: DB, user: Owner) -> User:
    err = await validate_new_password(body.password)
    if err:
        raise field_error("password", err)
    u = User(email=body.email.lower(), name=body.name, role=body.role, password_hash=hash_password(body.password))
    session.add(u)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise field_error("email", "Bu email band") from None
    await record(session, actor_id=user.id, action="create", entity="user", entity_id=u.id,
                 diff={"email": u.email, "role": u.role}, request=request)
    await session.commit()
    await session.refresh(u)
    return u


@router.patch("/users/{user_id}", response_model=UserOut)
async def patch_user(user_id: uuid.UUID, body: UserPatch, request: Request, session: DB, user: Owner) -> User:
    u = await session.get(User, user_id)
    if u is None:
        raise not_found()
    before = {"role": u.role, "is_active": u.is_active, "name": u.name}
    data = body.model_dump(exclude_unset=True)
    revoke = data.pop("revoke_sessions", False)
    if u.id == user.id and (data.get("role", "owner") != "owner" or data.get("is_active") is False):
        raise field_error("role", "O'zingizni owner'likdan chiqarib yoki bloklab bo'lmaydi")
    for k, v in data.items():
        setattr(u, k, v)
    if revoke or data.get("is_active") is False or "role" in data:
        await revoke_user_sessions(session, u.id)
    await record(session, actor_id=user.id, action="update", entity="user", entity_id=u.id,
                 diff={**make_diff(before, {"role": u.role, "is_active": u.is_active, "name": u.name}),
                       **({"revoke_sessions": True} if revoke else {})}, request=request)
    await session.commit()
    await session.refresh(u)
    return u


@router.get("/audit-logs")
async def audit_logs(session: DB, user: Owner, entity: str | None = Query(None, max_length=40),
                     actor_id: uuid.UUID | None = None, page: int = Query(1, ge=1),
                     limit: int = Query(20, ge=1, le=50)) -> dict[str, Any]:
    stmt = select(AuditLog)
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.scalars(stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * limit)
                                  .limit(limit))).unique().all()
    items = [{"id": r.id, "actor": {"id": r.actor.id, "email": r.actor.email} if r.actor else None,
              "action": r.action, "entity": r.entity, "entity_id": r.entity_id, "diff": r.diff, "ip": r.ip,
              "created_at": r.created_at} for r in rows]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/redirects")
async def list_redirects(session: DB, user: Owner) -> dict[str, Any]:
    rows = (await session.scalars(select(Redirect).order_by(Redirect.from_path))).all()
    items = [RedirectOut.model_validate(r).model_dump() for r in rows]
    return {"items": items, "total": len(items), "page": 1, "limit": len(items) or 1}


@router.post("/redirects", status_code=201, response_model=RedirectOut)
async def create_redirect(body: RedirectIn, request: Request, session: DB, user: Owner) -> Redirect:
    if body.from_path == body.to_path:
        raise field_error("to_path", "Manzil o'ziga yo'naltira olmaydi")
    r = Redirect(from_path=body.from_path, to_path=body.to_path, code=body.code)
    session.add(r)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise field_error("from_path", "Bu manzil uchun redirect bor") from None
    await record(session, actor_id=user.id, action="create", entity="redirect", entity_id=r.id,
                 diff=body.model_dump(), request=request)
    await session.commit()
    await session.refresh(r)
    await enqueue("rebuild_site")
    return r


@router.delete("/redirects/{redirect_id}", status_code=204)
async def delete_redirect(redirect_id: uuid.UUID, request: Request, session: DB, user: Owner) -> Response:
    r = await session.get(Redirect, redirect_id)
    if r is None:
        raise not_found()
    await session.delete(r)
    await record(session, actor_id=user.id, action="delete", entity="redirect", entity_id=redirect_id,
                 request=request)
    await session.commit()
    await enqueue("rebuild_site")
    return Response(status_code=204)


@router.post("/site/rebuild", status_code=202)
async def rebuild(request: Request, session: DB, user: Owner) -> dict[str, str]:
    job_id = await enqueue("rebuild_site", force=True)
    await record(session, actor_id=user.id, action="rebuild", entity="site", request=request)
    await session.commit()
    return {"job_id": job_id}
