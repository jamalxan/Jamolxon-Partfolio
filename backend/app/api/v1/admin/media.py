import uuid
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, Query, Request, Response, UploadFile
from sqlalchemy import func, or_, select

from app.api.deps import DB, Staff
from app.core.errors import Problem, field_error, not_found
from app.models import Media, Post, Project, ProjectImage
from app.schemas.system import MediaPatch
from app.services.audit import record
from app.services.storage import MAX_BYTES, get_backend, store_upload

router = APIRouter(prefix="/media", tags=["admin-media"])


async def used_in(session: DB, media_id: uuid.UUID) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in (await session.scalars(select(Project).where(Project.deleted_at.is_(None), or_(
            Project.cover_id == media_id,
            Project.id.in_(select(ProjectImage.project_id).where(ProjectImage.media_id == media_id)))))).unique():
        out.append({"entity": "project", "id": str(p.id), "title": p.title})
    for post in (await session.scalars(select(Post).where(Post.deleted_at.is_(None), Post.cover_id == media_id))):
        out.append({"entity": "post", "id": str(post.id), "title": post.title})
    return out


def media_out(m: Media, used: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {"id": m.id, "url": get_backend().url(m.storage_key), "original_name": m.original_name, "mime": m.mime,
            "size_bytes": m.size_bytes, "width": m.width, "height": m.height, "variants": m.variants, "alt": m.alt,
            "blurhash": m.blurhash, "used_in": used or [], "created_at": m.created_at}


@router.post("", status_code=201)
async def upload(request: Request, session: DB, user: Staff, file: Annotated[UploadFile, File()],
                 alt: Annotated[str, Form(max_length=300)]) -> dict[str, Any]:
    if not alt.strip():
        raise field_error("alt", "Alt matn majburiy")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise Problem(413, "payload_too_large")
    stored = await store_upload(data)
    name = (file.filename or "fayl")[-255:]
    m = Media(storage_key=stored.storage_key, original_name=name, mime=stored.mime, size_bytes=stored.size_bytes,
              width=stored.width, height=stored.height, variants=stored.variants, alt=alt.strip(),
              uploaded_by=user.id)
    session.add(m)
    await session.flush()
    await record(session, actor_id=user.id, action="upload", entity="media", entity_id=m.id,
                 diff={"name": name, "mime": stored.mime}, request=request)
    await session.commit()
    await session.refresh(m)
    return media_out(m)


@router.get("")
async def list_media(session: DB, user: Staff, q: str | None = Query(None, max_length=100),
                     page: int = Query(1, ge=1), limit: int = Query(12, ge=1, le=50)) -> dict[str, Any]:
    stmt = select(Media)
    if q:
        stmt = stmt.where(or_(Media.original_name.ilike(f"%{q}%"), Media.alt.ilike(f"%{q}%")))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.scalars(stmt.order_by(Media.created_at.desc()).offset((page - 1) * limit).limit(limit))).all()
    return {"items": [media_out(m, await used_in(session, m.id)) for m in rows], "total": total, "page": page,
            "limit": limit}


@router.patch("/{media_id}")
async def patch_media(media_id: uuid.UUID, body: MediaPatch, request: Request, session: DB,
                      user: Staff) -> dict[str, Any]:
    m = await session.get(Media, media_id)
    if m is None:
        raise not_found()
    old = m.alt
    m.alt = body.alt
    await record(session, actor_id=user.id, action="update", entity="media", entity_id=m.id,
                 diff={"alt": {"from": old, "to": body.alt}}, request=request)
    await session.commit()
    await session.refresh(m)
    return media_out(m, await used_in(session, m.id))


@router.delete("/{media_id}", status_code=204)
async def delete_media(media_id: uuid.UUID, request: Request, session: DB, user: Staff) -> Response:
    m = await session.get(Media, media_id)
    if m is None:
        raise not_found()
    if await used_in(session, m.id):
        raise Problem(409, "conflict", "Media ishlatilmoqda, avval undan foydalanishni olib tashlang")
    key = m.storage_key
    await session.delete(m)
    await record(session, actor_id=user.id, action="delete", entity="media", entity_id=media_id, request=request)
    await session.commit()
    await get_backend().delete(key)
    return Response(status_code=204)
