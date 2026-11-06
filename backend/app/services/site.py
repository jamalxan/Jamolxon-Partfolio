"""Static site build + draft previews. Rendering itself lives in app.render (Jinja2 generator)."""

import logging
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import get_redis
from app.core.security import new_opaque_token
from app.models import Post, Project, Service
from app.services import content as c

log = logging.getLogger("app.site")

PREVIEW_TTL = 3600
ENTITY_MODELS: dict[str, Any] = {"project": Project, "service": Service, "post": Post}


def page_path(entity: str, slug: str) -> str:
    return {"project": f"/loyihalar/{slug}/", "service": f"/xizmatlar/{slug}/", "post": f"/blog/{slug}/"}[entity]


async def create_preview_token(entity: str, obj_id: uuid.UUID) -> str:
    token = new_opaque_token()
    await get_redis().set(f"preview:{token}", f"{entity}:{obj_id}", ex=PREVIEW_TTL)
    return f"{get_settings().site_url}/preview/{token}"


def _merge(content: dict[str, Any], key: str, item: dict[str, Any]) -> None:
    items = [x for x in content[key] if x["slug"] != item["slug"]]
    items.insert(0, item)
    content[key] = items


async def preview_html(session: AsyncSession, token: str) -> str | None:
    value = await get_redis().get(f"preview:{token}")
    if not value:
        return None
    entity, obj_id = value.split(":", 1)
    model = ENTITY_MODELS.get(entity)
    if model is None:
        return None
    obj = await session.get(model, uuid.UUID(obj_id))
    if obj is None:
        return None
    content = await c.build_site_content(session)
    if entity == "project":
        _merge(content, "PROJECTS", c.site_project(obj))
    elif entity == "service":
        _merge(content, "SERVICES", c.site_service(obj))
    else:
        _merge(content, "POSTS", c.site_post(obj))
    from app.render import render_page

    s = get_settings()
    html: str = render_page(content, page_path(entity, obj.slug), site_url=s.site_url, assets_dir=s.frontend_dist,
                            noindex=True)
    return html


async def rebuild_site(session: AsyncSession, out_dir: Path | None = None) -> list[str]:
    from app.render import render_site

    s = get_settings()
    content = await c.build_site_content(session)
    paths: list[str] = render_site(content, out_dir or s.site_out_dir, site_url=s.site_url,
                                   assets_dir=s.frontend_dist)
    log.info("site rebuilt", extra={"pages": len(paths)})
    return paths


async def published_slugs(session: AsyncSession) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for entity, model in ENTITY_MODELS.items():
        rows = await session.scalars(c.published(select(model.slug), model))
        out[entity] = list(rows.all())
    return out
