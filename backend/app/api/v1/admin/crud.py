"""Generic admin CRUD for content resources (docs/API.md "Kontent CRUD")."""

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, Staff
from app.core.errors import Problem, field_error, not_found
from app.core.queue import enqueue
from app.models import Redirect
from app.schemas.common import PublishIn, ReorderIn
from app.services.audit import make_diff, record
from app.services.site import create_preview_token

Apply = Callable[[Any, dict[str, Any], DB], Awaitable[None]]
Serialize = Callable[[Any], dict[str, Any]]


@dataclass
class Resource:
    name: str  # URL segment, e.g. "projects"
    entity: str  # audit entity, e.g. "project"
    model: Any
    create_schema: type[BaseModel]
    patch_schema: type[BaseModel]
    serialize: Serialize
    apply: Apply | None = None
    has_status: bool = False
    soft_delete: bool = False
    search: tuple[str, ...] = ("title",)
    public_prefix: str | None = None  # e.g. "/loyihalar/" — slug changes create 301 redirects
    unique_fields: tuple[str, ...] = ("slug",)
    order: list[Any] = field(default_factory=list)


def _same_instant(a: datetime, b: datetime) -> bool:
    if a.tzinfo is None:
        a = a.replace(tzinfo=UTC)
    if b.tzinfo is None:
        b = b.replace(tzinfo=UTC)
    return abs((a - b).total_seconds()) < 0.001


def build_router(res: Resource) -> APIRouter:
    router = APIRouter(prefix=f"/{res.name}", tags=[f"admin-{res.name}"])
    model = res.model

    async def get_obj(session: DB, obj_id: uuid.UUID) -> Any:
        obj = await session.get(model, obj_id)
        if obj is None or (res.soft_delete and obj.deleted_at is not None):
            raise not_found()
        return obj

    async def assign(obj: Any, data: dict[str, Any], session: DB) -> None:
        if res.apply:
            await res.apply(obj, data, session)
        for k, v in data.items():
            if hasattr(obj, k) and k not in ("updated_at",):
                setattr(obj, k, v)

    async def commit_unique(session: DB) -> None:
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            msg = str(e.orig)
            for f in res.unique_fields:
                if f in msg:
                    raise field_error(f, "Bu qiymat band") from None
            raise field_error(res.unique_fields[0], "Bu qiymat band") from None

    async def after_change(obj: Any) -> None:
        # Drafts can affect public pages too (e.g. a published item moved back to draft), so always rebuild;
        # the worker debounces bursts of rebuild jobs.
        await enqueue("rebuild_site")

    @router.get("")
    async def list_items(session: DB, user: Staff, q: str | None = Query(None, max_length=100),
                         status: str | None = Query(None, pattern="^(draft|published|archived)$"),
                         page: int = Query(1, ge=1), limit: int = Query(12, ge=1, le=50)) -> dict[str, Any]:
        stmt = select(model)
        if res.soft_delete:
            stmt = stmt.where(model.deleted_at.is_(None))
        if status and res.has_status:
            stmt = stmt.where(model.status == status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(*[getattr(model, f).ilike(like) for f in res.search]))
        total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        order = res.order or [model.sort_order, model.created_at]
        rows = (await session.scalars(stmt.order_by(*order).offset((page - 1) * limit).limit(limit))).unique().all()
        return {"items": [res.serialize(r) for r in rows], "total": total, "page": page, "limit": limit}

    @router.post("", status_code=201)
    async def create(request: Request, session: DB, user: Staff, body: res.create_schema) -> dict[str, Any]:  # type: ignore[name-defined]
        obj = model()
        data = body.model_dump(exclude_unset=True, mode="python")
        await assign(obj, data, session)
        if hasattr(obj, "sort_order"):
            obj.sort_order = (await session.scalar(select(func.coalesce(func.max(model.sort_order), 0)))) + 1
        session.add(obj)
        try:
            await session.flush()
        except IntegrityError:
            await session.rollback()
            raise field_error(res.unique_fields[0], "Bu qiymat band") from None
        await session.refresh(obj)
        await record(session, actor_id=user.id, action="create", entity=res.entity, entity_id=obj.id,
                     diff=make_diff({}, res.serialize(obj)), request=request)
        await commit_unique(session)
        await session.refresh(obj)
        await enqueue("rebuild_site")
        return res.serialize(obj)

    @router.get("/{obj_id}")
    async def get_item(obj_id: uuid.UUID, session: DB, user: Staff) -> dict[str, Any]:
        return res.serialize(await get_obj(session, obj_id))

    @router.patch("/{obj_id}")
    async def patch(obj_id: uuid.UUID, request: Request, session: DB, user: Staff,
                    body: res.patch_schema) -> dict[str, Any]:  # type: ignore[name-defined]
        obj = await get_obj(session, obj_id)
        data = body.model_dump(exclude_unset=True, mode="python")
        if not _same_instant(data.pop("updated_at"), obj.updated_at):
            raise Problem(409, "conflict")
        before = res.serialize(obj)
        old_slug = getattr(obj, "slug", None)
        await assign(obj, data, session)
        obj.updated_at = datetime.now(UTC)
        if res.public_prefix and old_slug and getattr(obj, "slug", old_slug) != old_slug:
            await upsert_redirect(session, f"{res.public_prefix}{old_slug}/", f"{res.public_prefix}{obj.slug}/")
        await session.flush()
        await record(session, actor_id=user.id, action="update", entity=res.entity, entity_id=obj.id,
                     diff=make_diff(before, res.serialize(obj)), request=request)
        await commit_unique(session)
        await session.refresh(obj)
        await after_change(obj)
        return res.serialize(obj)

    @router.delete("/{obj_id}", status_code=204)
    async def delete(obj_id: uuid.UUID, request: Request, session: DB, user: Staff) -> Response:
        obj = await get_obj(session, obj_id)
        if res.soft_delete:
            obj.deleted_at = datetime.now(UTC)
        else:
            await session.delete(obj)
        await record(session, actor_id=user.id, action="delete", entity=res.entity, entity_id=obj_id,
                     request=request)
        await session.commit()
        await enqueue("rebuild_site")
        return Response(status_code=204)

    @router.post("/reorder", status_code=204)
    async def reorder(body: ReorderIn, request: Request, session: DB, user: Staff) -> Response:
        try:
            ids = [uuid.UUID(i) for i in body.ids]
        except ValueError:
            raise field_error("ids", "Noto'g'ri ID") from None
        rows = {o.id: o for o in (await session.scalars(select(model).where(model.id.in_(ids)))).unique().all()}
        for pos, i in enumerate(ids, start=1):
            if i in rows:
                rows[i].sort_order = pos
        await record(session, actor_id=user.id, action="reorder", entity=res.entity,
                     diff={"ids": [str(i) for i in ids]}, request=request)
        await session.commit()
        await enqueue("rebuild_site")
        return Response(status_code=204)

    if res.has_status:
        @router.post("/{obj_id}/publish")
        async def publish(obj_id: uuid.UUID, body: PublishIn, request: Request, session: DB,
                          user: Staff) -> dict[str, Any]:
            obj = await get_obj(session, obj_id)
            before = {"status": obj.status, "published_at": obj.published_at}
            obj.status = body.status
            if body.status == "published":
                obj.published_at = body.published_at or obj.published_at or datetime.now(UTC)
            obj.updated_at = datetime.now(UTC)
            await record(session, actor_id=user.id, action="publish", entity=res.entity, entity_id=obj.id,
                         diff=make_diff(before, {"status": obj.status, "published_at": obj.published_at}),
                         request=request)
            await session.commit()
            await session.refresh(obj)
            await enqueue("rebuild_site")
            return res.serialize(obj)

        @router.post("/{obj_id}/preview")
        async def preview(obj_id: uuid.UUID, session: DB, user: Staff) -> dict[str, str]:
            obj = await get_obj(session, obj_id)
            return {"url": await create_preview_token(res.entity, obj.id)}

    return router


async def upsert_redirect(session: DB, from_path: str, to_path: str) -> None:
    # Collapse chains: anything that pointed to from_path now points to to_path.
    for r in (await session.scalars(select(Redirect).where(Redirect.to_path == from_path))).all():
        r.to_path = to_path
    existing = await session.scalar(select(Redirect).where(Redirect.from_path == from_path))
    if existing:
        existing.to_path = to_path
        existing.code = 301
    else:
        session.add(Redirect(from_path=from_path, to_path=to_path, code=301))
    loop = await session.scalar(select(Redirect).where(Redirect.from_path == to_path))
    if loop:
        await session.delete(loop)
