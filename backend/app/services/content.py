"""DB <-> public content. `build_site_content` returns the exact shape of backend/seed/content.json,
which is what the static generator (app.render.render_site) consumes."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, Offer, Post, ProcessStep, Project, Service, Setting

DEFAULT_SEO = {
    "title": "Jamolxon — Python Backend Developer | AI yechimlar biznes uchun",
    "description": "Python backend dasturchi: FastAPI, PostgreSQL, Redis. Savdo, ta'lim va marketing uchun AI "
    "yechimlar — real ishlayotgan loyihalar, blog va taklif formasi. Toshkent.",
    "og_image": "",
}


def published(stmt: Select[Any], model: Any) -> Select[Any]:
    now = datetime.now(UTC)
    return stmt.where(model.deleted_at.is_(None), model.status == "published",
                      (model.published_at.is_(None)) | (model.published_at <= now))


def iso(dt: datetime | None) -> str | None:
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z") if dt else None


def project_out(p: Project) -> dict[str, Any]:
    return {
        "id": p.id, "slug": p.slug, "title": p.title, "subtitle": p.subtitle,
        "category": p.category.slug if p.category else None, "url": p.url, "year": p.year, "client": p.client,
        "role": p.role, "stack": list(p.stack or []), "summary": p.summary, "sections": p.sections or [],
        "results": p.results or [], "links": p.links or [], "illo": p.illo, "image": p.image,
        "cover_id": p.cover_id,
        "gallery": [{"media_id": str(g.media_id), "caption": g.caption} for g in p.gallery],
        "seo_title": p.seo_title, "seo_description": p.seo_description, "is_featured": p.is_featured,
        "status": p.status, "published_at": p.published_at, "sort_order": p.sort_order,
        "created_at": p.created_at, "updated_at": p.updated_at,
    }


def post_out(p: Post) -> dict[str, Any]:
    return {
        "id": p.id, "slug": p.slug, "title": p.title, "excerpt": p.excerpt, "body_md": p.body_md,
        "body_html": p.body_html, "tags": [t.title for t in p.tags], "cover_id": p.cover_id,
        "reading_min": p.reading_min, "seo_title": p.seo_title, "seo_description": p.seo_description,
        "status": p.status, "published_at": p.published_at, "sort_order": p.sort_order,
        "created_at": p.created_at, "updated_at": p.updated_at,
    }


def site_project(p: Project) -> dict[str, Any]:
    return {
        "slug": p.slug, "cat": p.category.slug if p.category else "own", "title": p.title, "url": p.url,
        "year": p.year, "tagline": p.subtitle, "summary": p.summary, "illo": p.illo, "image": p.image,
        "stack": list(p.stack or []), "role": p.role, "sections": p.sections or [], "results": p.results or [],
        "links": p.links or [], "seo_title": p.seo_title, "seo_description": p.seo_description,
        "is_featured": p.is_featured, "updated_at": iso(p.updated_at),
    }


def site_service(s: Service) -> dict[str, Any]:
    return {
        "slug": s.slug, "title": s.title, "icon": s.icon, "illo": s.illo, "short": s.short, "who": s.who,
        "includes": s.includes, "process": s.process, "examples": s.examples, "stack": s.stack,
        "timeline": s.timeline, "faq": s.faq, "price_from": s.price_from, "duration": s.duration,
        "seo_title": s.seo_title, "seo_description": s.seo_description, "updated_at": iso(s.updated_at),
    }


def site_post(p: Post) -> dict[str, Any]:
    date = (p.published_at or p.created_at).astimezone(UTC).date().isoformat()
    return {
        "slug": p.slug, "title": p.title, "date": date, "read": f"{p.reading_min} daqiqa",
        "tags": [t.title for t in p.tags], "excerpt": p.excerpt, "body": p.body_html,
        "seo_title": p.seo_title, "seo_description": p.seo_description, "updated_at": iso(p.updated_at),
    }


async def get_setting(session: AsyncSession, key: str, default: Any = None) -> Any:
    row = await session.get(Setting, key)
    return row.value if row else default


async def build_site_content(session: AsyncSession) -> dict[str, Any]:
    cats = (await session.scalars(select(Category).order_by(Category.sort_order))).all()
    projects = (await session.scalars(published(select(Project), Project).order_by(Project.sort_order))).all()
    services = (await session.scalars(published(select(Service), Service).order_by(Service.sort_order))).all()
    posts = (await session.scalars(
        published(select(Post), Post).order_by(Post.published_at.desc().nulls_last(), Post.sort_order))).all()
    offers = (await session.scalars(select(Offer).order_by(Offer.sort_order))).all()
    steps = (await session.scalars(select(ProcessStep).order_by(ProcessStep.sort_order))).all()
    contact = await get_setting(session, "contact", {})
    seo = {**DEFAULT_SEO, **(await get_setting(session, "seo", {}) or {})}
    return {
        "CATS": {c.slug: {"label": c.title, "short": c.short, "badge": c.badge, "dot": c.dot, "desc": c.description}
                 for c in cats},
        "PROJECTS": [site_project(p) for p in projects],
        "SERVICES": [site_service(s) for s in services],
        "POSTS": [site_post(p) for p in posts],
        "OFFERS": [{"key": o.key, "title": o.title, "icon": o.icon, "problem": o.problem, "solution": o.solution,
                    "example": o.examples} for o in offers],
        "STEPS": [{"h": s.title, "d": s.text, "get": s.get} for s in steps],
        "CONTACT": contact,
        "SETTINGS": {"seo": seo, "turnstile_site_key": get_settings().turnstile_site_key},
    }


def compute_facts(content: dict[str, Any]) -> list[dict[str, Any]]:
    projects = content["PROJECTS"]
    return [
        {"n": len(projects), "suf": "", "t": "ta loyiha — saytlar, botlar, CRM va SaaS"},
        {"n": sum(p["cat"] == "prod" for p in projects), "suf": "", "t": "ta tizim hozir ishlab turibdi (Live)"},
        {"n": sum(p["cat"] == "pm" for p in projects), "suf": "",
         "t": "ta yirik loyihani menejer sifatida boshqarganman"},
        {"n": sum(p["cat"] == "sale" for p in projects), "suf": "", "t": "ta tayyor yechim — 1–2 haftada ishga tushadi"},
    ]
