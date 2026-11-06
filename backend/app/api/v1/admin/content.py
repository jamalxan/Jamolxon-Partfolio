"""Admin content resources wired into the generic CRUD."""

import re
import unicodedata
from typing import Any

from sqlalchemy import func, select

from app.api.deps import DB
from app.api.v1.admin.crud import Resource, build_router
from app.core.errors import field_error
from app.models import Category, Media, Offer, Post, ProcessStep, Project, ProjectImage, Service, Tag
from app.schemas import content as s
from app.services.content import post_out, project_out
from app.services.markdown import plain_text, reading_minutes, render_markdown, sections_to_html


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "teg"


async def apply_project(obj: Project, data: dict[str, Any], session: DB) -> None:
    if "category" in data:
        slug = data.pop("category")
        if slug is None:
            obj.category_id = None
        else:
            cat = await session.scalar(select(Category).where(Category.slug == slug))
            if cat is None:
                raise field_error("category", "Bunday kategoriya yo'q")
            obj.category_id = cat.id
            obj.category = cat
    if "links" in data and data["links"] is not None:
        data["links"] = [{"label": link["label"], "url": str(link["url"])} for link in data["links"]]
    if "sections" in data and data["sections"] is not None:
        obj.body_html = sections_to_html(data["sections"])
    for key in ("cover_id",):
        if data.get(key) is not None and await session.get(Media, data[key]) is None:
            raise field_error(key, "Media topilmadi")
    if "gallery" in data:
        items = data.pop("gallery") or []
        for it in items:
            if await session.get(Media, it["media_id"]) is None:
                raise field_error("gallery", "Media topilmadi")
        obj.gallery = [ProjectImage(media_id=it["media_id"], caption=it.get("caption", ""), sort_order=i)
                       for i, it in enumerate(items)]
    for key in ("stack", "results"):
        if key in data and data[key] is None:
            data[key] = []


async def apply_post(obj: Post, data: dict[str, Any], session: DB) -> None:
    if "body_md" in data and data["body_md"] is not None:
        obj.body_html = render_markdown(data["body_md"])
        obj.reading_min = reading_minutes(obj.body_html)
    if "tags" in data:
        titles = data.pop("tags") or []
        tags = []
        for title in dict.fromkeys(titles):
            slug = slugify(title)
            tag = await session.scalar(select(Tag).where(Tag.slug == slug))
            if tag is None:
                tag = Tag(slug=slug, title=title)
                session.add(tag)
            tags.append(tag)
        obj.tags = tags
    title = data.get("title", obj.title) or ""
    excerpt = data.get("excerpt", obj.excerpt) or ""
    body = plain_text(obj.body_html or "")
    obj.search_vector = func.to_tsvector("simple", f"{title} {excerpt} {body}")


def simple(model_out: type[Any]) -> Any:
    return lambda o: model_out.model_validate(o).model_dump()


def service_out(o: Service) -> dict[str, Any]:
    return s.ServiceOut.model_validate(o).model_dump()


RESOURCES = [
    Resource("projects", "project", Project, s.ProjectCreate, s.ProjectPatch, project_out, apply=apply_project,
             has_status=True, soft_delete=True, search=("title", "slug", "summary"), public_prefix="/loyihalar/"),
    Resource("services", "service", Service, s.ServiceCreate, s.ServicePatch, service_out, has_status=True,
             soft_delete=True, search=("title", "slug", "short"), public_prefix="/xizmatlar/"),
    Resource("posts", "post", Post, s.PostCreate, s.PostPatch, post_out, apply=apply_post, has_status=True,
             soft_delete=True, search=("title", "slug", "excerpt"), public_prefix="/blog/",
             order=[Post.published_at.desc().nulls_first(), Post.created_at.desc()]),
    Resource("categories", "category", Category, s.CategoryCreate, s.CategoryPatch, simple(s.CategoryOut),
             search=("title", "slug")),
    Resource("tags", "tag", Tag, s.TagCreate, s.TagPatch, simple(s.TagOut), search=("title", "slug"),
             order=[Tag.title]),
    Resource("offers", "offer", Offer, s.OfferCreate, s.OfferPatch, simple(s.OfferOut), search=("title", "key"),
             unique_fields=("key",)),
    Resource("steps", "step", ProcessStep, s.StepCreate, s.StepPatch, simple(s.StepOut), search=("title",),
             unique_fields=("title",)),
]

routers = [build_router(r) for r in RESOURCES]
