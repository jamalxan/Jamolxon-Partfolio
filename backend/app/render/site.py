"""Static site generator: content dict -> pre-rendered HTML (TZ 5 and 9).

Public API: :func:`render_site` (whole site, atomic swap) and :func:`render_page`
(single page, e.g. a draft preview).
"""

from __future__ import annotations

import datetime as dt
import json
import re
import shutil
import uuid
from dataclasses import dataclass, field
from email.utils import format_datetime
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

from . import illustrations
from .icons import ICON

TEMPLATES_DIR = Path(__file__).parent / "templates"
POSTS_PER_PAGE = 12
TITLE_MAX = 60
DESC_MAX = 155
HOME_TITLE = "Jamolxon — Python Backend Developer | AI yechimlar"
HOME_DESC = (
    "Python backend dasturchi: FastAPI, PostgreSQL, Redis. Savdo, ta'lim va marketing uchun "
    "AI yechimlar — real ishlayotgan loyihalar, blog va taklif formasi. Toshkent."
)
MQ1 = ["Python", "FastAPI", "PostgreSQL", "Redis", "AI integratsiya", "Telegram botlar",
       "Multi-tenant SaaS", "Meta webhooks", "Xavfsizlik audit", "Docker"]
MQ2 = ["Savdo", "Ta'lim", "Marketing", "CRM / ERP", "Instagram", "EdTech", "No-code", "Claude", "Gemini", "Next.js"]
MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
# "Shu yechim kerak" (offers) -> service slug preselected in the form (same map as the old app.js)
OFFER_SERVICE = {"aloqa": "ai-agentlar", "smm": "integratsiyalar", "talim": "ai-agentlar",
                 "biznes": "crm-erp", "bot": "telegram-botlar", "kontent": "ai-agentlar"}


# --------------------------------------------------------------------------- urls
class Urls:
    home = "/"
    projects = "/loyihalar/"
    blog = "/blog/"
    taklif = "/taklif/"

    @staticmethod
    def project(slug: str) -> str:
        return f"/loyihalar/{slug}/"

    @staticmethod
    def service(slug: str) -> str:
        return f"/xizmatlar/{slug}/"

    @staticmethod
    def post(slug: str) -> str:
        return f"/blog/{slug}/"

    @staticmethod
    def blog_page(n: int) -> str:
        return "/blog/" if n <= 1 else f"/blog/sahifa/{n}/"

    @staticmethod
    def section(sec: str) -> str:
        return f"/#{sec}"

    @staticmethod
    def taklif_offer(offer: str) -> str:
        """Form link that preselects a service (works for SPA and full page loads)."""
        if offer.startswith("svc:"):
            return f"/taklif/?xizmat={offer[4:]}"
        if offer.startswith("sale:"):
            return f"/taklif/?tayyor={offer[5:]}"
        if offer in OFFER_SERVICE:
            return f"/taklif/?xizmat={OFFER_SERVICE[offer]}&soha={offer}"
        return "/taklif/"


url = Urls()

_LEGACY_HREF = re.compile(r'href=(["\'])#([^"\']*)\1')


def legacy_hash_to_path(h: str) -> str | None:
    """Map an old hash route (without '#') to its clean URL; None = in-page anchor."""
    if h in ("", "top"):
        return "/"
    if h == "loyihalar":
        return url.projects
    if h.startswith("loyiha-"):
        return url.project(h[7:])
    if h.startswith("xizmat-"):
        return url.service(h[7:])
    if h == "blog":
        return url.blog
    if h.startswith("blog-"):
        return url.post(h[5:])
    if h == "taklif":
        return url.taklif
    if h.startswith("s-"):
        return url.section(h[2:])
    return None


def rewrite_hash_links(html: str) -> str:
    """Rewrite legacy ``href="#route"`` links inside trusted HTML (post bodies)."""

    def sub(m: re.Match[str]) -> str:
        new = legacy_hash_to_path(m.group(2))
        if new is None:
            return m.group(0)
        q = m.group(1)
        return f"href={q}{new}{q}"

    return _LEGACY_HREF.sub(sub, html)


# --------------------------------------------------------------------------- helpers
def fmt_date(d: str) -> str:
    y, mo, da = d[:10].split("-")
    return f"{int(da)} {MONTHS[int(mo) - 1]} {y}"


def clip(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    if " " in cut:
        cut = cut[: cut.rfind(" ")]
    return cut.rstrip(" ,.;:—-") + "…"


def fit_title(main: str, suffix: str = " — Jamolxon") -> str:
    main = re.sub(r"\s+", " ", main).strip()
    if len(main) + len(suffix) <= TITLE_MAX:
        return main + suffix
    return clip(main, TITLE_MAX)


def compute_facts(projects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Same as FACTS in data.js — computed, never stored."""

    def cnt(cat: str) -> int:
        return sum(1 for p in projects if p.get("cat") == cat)

    return [
        {"n": len(projects), "suf": "", "t": "ta loyiha — saytlar, botlar, CRM va SaaS"},
        {"n": cnt("prod"), "suf": "", "t": "ta tizim hozir ishlab turibdi (Live)"},
        {"n": cnt("pm"), "suf": "", "t": "ta yirik loyihani menejer sifatida boshqarganman"},
        {"n": cnt("sale"), "suf": "", "t": "ta tayyor yechim — 1–2 haftada ishga tushadi"},
    ]


def _jsonld(obj: Any) -> Markup:
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    # never let content close the <script> element
    s = s.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return Markup(s)


def _lastmod(item: dict[str, Any], fallback: str | None) -> str | None:
    v = item.get("updated_at") or item.get("published_at") or item.get("date")
    return str(v)[:10] if v else fallback


# --------------------------------------------------------------------------- assets
@dataclass
class Assets:
    css: list[str]
    js: str
    modulepreload: list[str] = field(default_factory=list)
    preload_fonts: list[str] = field(default_factory=list)
    root: Path | None = None  # dist/ directory to copy, if any

    @classmethod
    def dev(cls) -> Assets:
        """Unbundled sources, served by the Vite dev server (``npm run dev``)."""
        return cls(css=["/assets/css/index.css"], js="/assets/js/main.js",
                   preload_fonts=["/assets/fonts/unbounded-latin.woff2"])

    @classmethod
    def from_dist(cls, dist: Path) -> Assets:
        manifest_path = dist / ".vite" / "manifest.json"
        manifest: dict[str, dict[str, Any]] = json.loads(manifest_path.read_text(encoding="utf-8"))

        def entry(src: str) -> dict[str, Any]:
            if src not in manifest:
                raise KeyError(f"{src} not in {manifest_path}")
            return manifest[src]

        main = entry("assets/js/main.js")
        style = entry("assets/css/index.css")
        css = ["/" + style["file"]] + ["/" + c for c in main.get("css", [])]
        pre = ["/" + manifest[i]["file"] for i in main.get("imports", []) if i in manifest]
        fonts = []
        font_src = "assets/fonts/unbounded-latin.woff2"
        if font_src in manifest:
            fonts.append("/" + manifest[font_src]["file"])
        else:  # older Vite: assets referenced from CSS are not in the manifest
            found = sorted((dist / "assets").glob("unbounded-latin*.woff2"))
            if found:
                fonts.append("/" + found[0].relative_to(dist).as_posix())
        return cls(css=css, js="/" + main["file"], modulepreload=pre, preload_fonts=fonts, root=dist)


# --------------------------------------------------------------------------- pages
@dataclass
class Page:
    path: str  # URL path, e.g. "/loyihalar/x/" or "/404.html"
    template: str
    view: str
    ctx: dict[str, Any]
    title: str
    description: str
    og_type: str = "website"
    jsonld: list[Any] = field(default_factory=list)
    nav_active: str = ""
    lastmod: str | None = None
    indexable: bool = True


class _Site:
    def __init__(self, content: dict[str, Any], site_url: str) -> None:
        self.c = content
        self.site_url = site_url.rstrip("/")
        self.cats: dict[str, dict[str, Any]] = content["CATS"]
        self.projects: list[dict[str, Any]] = list(content["PROJECTS"])
        self.services: list[dict[str, Any]] = list(content["SERVICES"])
        self.posts: list[dict[str, Any]] = list(content["POSTS"])
        self.contact: dict[str, Any] = content["CONTACT"]
        self.settings: dict[str, Any] = content.get("SETTINGS") or {}
        self.seo_settings: dict[str, Any] = self.settings.get("seo") or {}
        self.project_by_slug = {p["slug"]: p for p in self.projects}
        dates = [d for d in (_lastmod(x, None) for x in [*self.projects, *self.services, *self.posts]) if d]
        self.global_lastmod = max(dates) if dates else None
        self.og_image = self.seo_settings.get("og_image") or f"{self.site_url}/assets/img/portrait.jpg"
        if self.og_image.startswith("/"):
            self.og_image = self.site_url + self.og_image

    def abs(self, path: str) -> str:
        return self.site_url + path

    # ---- JSON-LD
    def person(self) -> dict[str, Any]:
        c = self.contact
        return {
            "@type": "Person", "@id": self.abs("/#person"), "name": "Jamolxon",
            "jobTitle": "Python Backend Developer", "url": self.abs("/"),
            "image": self.abs("/assets/img/portrait.jpg"),
            "sameAs": [x for x in (c.get("tgUrl"), c.get("ghUrl"), c.get("igUrl"), c.get("studioUrl")) if x],
            "address": {"@type": "PostalAddress", "addressLocality": "Toshkent", "addressCountry": "UZ"},
        }

    def breadcrumbs(self, items: list[tuple[str, str]]) -> dict[str, Any]:
        return {
            "@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": name, "item": self.abs(path)}
                for i, (name, path) in enumerate(items)
            ],
        }

    # ---- page list
    def pages(self) -> list[Page]:
        out: list[Page] = [self.home(), self.catalog()]
        out += [self.project(i) for i in range(len(self.projects))]
        out += [self.service(i) for i in range(len(self.services))]
        out += self.blog_pages()
        out += [self.post(i) for i in range(len(self.posts))]
        out += [self.taklif(), self.not_found()]
        return out

    def home(self) -> Page:
        title = self.seo_settings.get("title") or HOME_TITLE
        desc = self.seo_settings.get("description") or HOME_DESC
        ld = {
            "@context": "https://schema.org",
            "@graph": [
                self.person(),
                {
                    "@type": "ProfessionalService", "@id": self.abs("/#service"), "name": "Jamolxon — Python backend va AI yechimlar",
                    "url": self.abs("/"), "image": self.og_image, "description": clip(desc, DESC_MAX),
                    "founder": {"@id": self.abs("/#person")}, "areaServed": "UZ",
                    "address": {"@type": "PostalAddress", "addressLocality": "Toshkent", "addressCountry": "UZ"},
                    "hasOfferCatalog": {
                        "@type": "OfferCatalog", "name": "Xizmatlar",
                        "itemListElement": [
                            {"@type": "Offer", "itemOffered": {"@type": "Service", "name": s["title"], "url": self.abs(url.service(s["slug"]))}}
                            for s in self.services
                        ],
                    },
                },
                {"@type": "WebSite", "@id": self.abs("/#website"), "url": self.abs("/"), "name": "Jamolxon", "inLanguage": "uz"},
            ],
        }
        return Page("/", "home.html", "home", {}, clip(title, TITLE_MAX), desc, jsonld=[ld], nav_active="home",
                    lastmod=self.global_lastmod)

    def catalog(self) -> Page:
        return Page(url.projects, "projects.html", "projects", {}, "Loyihalar — Jamolxon",
                    "Barcha ishlar toifalar bo'yicha: real ishlayotgan tizimlar, menejer sifatida boshqarilgan loyihalar, "
                    "shaxsiy ishlar va sotuvdagi tayyor yechimlar.",
                    jsonld=[self.breadcrumbs([("Bosh sahifa", "/"), ("Loyihalar", url.projects)])],
                    nav_active="loyihalar", lastmod=self.global_lastmod)

    def project(self, i: int) -> Page:
        ps = self.projects
        p = ps[i]
        prev, nxt = ps[(i - 1) % len(ps)], ps[(i + 1) % len(ps)]
        path = url.project(p["slug"])
        desc = p.get("seo_description") or p.get("summary") or p.get("tagline") or ""
        lm = _lastmod(p, self.global_lastmod)
        work: dict[str, Any] = {
            "@context": "https://schema.org", "@type": "CreativeWork", "name": p["title"],
            "headline": p.get("tagline") or p["title"], "description": clip(desc, DESC_MAX), "url": self.abs(path),
            "author": {"@type": "Person", "name": "Jamolxon", "url": self.abs("/")},
            "keywords": ", ".join(p.get("stack") or []), "inLanguage": "uz",
            "genre": self.cats.get(p["cat"], {}).get("label", ""),
        }
        if p.get("year"):
            work["dateCreated"] = str(p["year"])
        if p.get("url"):
            work["sameAs"] = p["url"]
        if p.get("image"):
            work["image"] = p["image"]
        return Page(path, "project.html", "project", {"p": p, "index": i, "prev": prev, "next": nxt},
                    p.get("seo_title") or fit_title(p["title"]), desc, og_type="article",
                    jsonld=[work, self.breadcrumbs([("Bosh sahifa", "/"), ("Loyihalar", url.projects), (p["title"], path)])],
                    nav_active="loyihalar", lastmod=lm)

    def service(self, i: int) -> Page:
        ss = self.services
        sv = ss[i]
        prev, nxt = ss[(i - 1) % len(ss)], ss[(i + 1) % len(ss)]
        path = url.service(sv["slug"])
        examples = [self.project_by_slug[s] for s in sv.get("examples", []) if s in self.project_by_slug]
        desc = sv.get("seo_description") or sv.get("short") or ""
        ld: list[Any] = [{
            "@context": "https://schema.org", "@type": "Service", "name": sv["title"], "serviceType": sv["title"],
            "description": clip(desc, DESC_MAX), "url": self.abs(path), "areaServed": "UZ",
            "provider": {"@type": "Person", "name": "Jamolxon", "url": self.abs("/")},
        }]
        if sv.get("faq"):
            ld.append({
                "@context": "https://schema.org", "@type": "FAQPage",
                "mainEntity": [
                    {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in sv["faq"]
                ],
            })
        ld.append(self.breadcrumbs([("Bosh sahifa", "/"), ("Xizmatlar", "/#xizmatlar"), (sv["title"], path)]))
        return Page(path, "service.html", "service",
                    {"sv": sv, "index": i, "prev": prev, "next": nxt, "examples": examples},
                    sv.get("seo_title") or fit_title(sv["title"]), desc, jsonld=ld, nav_active="xizmatlar",
                    lastmod=_lastmod(sv, self.global_lastmod))

    def blog_pages(self) -> list[Page]:
        posts = self.posts
        count = max(1, -(-len(posts) // POSTS_PER_PAGE))
        out = []
        for n in range(1, count + 1):
            chunk = posts[(n - 1) * POSTS_PER_PAGE: n * POSTS_PER_PAGE]
            path = url.blog_page(n)
            crumbs = [("Bosh sahifa", "/"), ("Blog", url.blog)] + ([(f"{n}-sahifa", path)] if n > 1 else [])
            lm = max((d for d in (_lastmod(p, None) for p in chunk) if d), default=self.global_lastmod)
            out.append(Page(
                path, "blog.html", "blog", {"posts": chunk, "page_no": n, "page_count": count},
                "Blog — Jamolxon" if n == 1 else f"Blog — {n}-sahifa — Jamolxon",
                "AI, backend va avtomatlashtirish haqida yozuvlar: real loyihalardan olingan saboqlar."
                + ("" if n == 1 else f" {n}-sahifa."),
                jsonld=[self.breadcrumbs(crumbs)], nav_active="blog", lastmod=lm,
            ))
        return out

    def post(self, i: int) -> Page:
        ps = self.posts
        p = ps[i]
        nxt = ps[(i + 1) % len(ps)]
        path = url.post(p["slug"])
        desc = p.get("seo_description") or p.get("excerpt") or ""
        published = str(p.get("published_at") or p.get("date") or "")[:10]
        art: dict[str, Any] = {
            "@context": "https://schema.org", "@type": "BlogPosting", "headline": clip(p["title"], 110),
            "description": clip(desc, DESC_MAX), "url": self.abs(path), "mainEntityOfPage": self.abs(path),
            "inLanguage": "uz", "keywords": ", ".join(p.get("tags") or []), "image": self.og_image,
            "author": {"@type": "Person", "name": "Jamolxon", "url": self.abs("/")},
            "publisher": {"@type": "Person", "name": "Jamolxon", "url": self.abs("/")},
        }
        if published:
            art["datePublished"] = published
            art["dateModified"] = _lastmod(p, published)
        body = Markup(rewrite_hash_links(str(p.get("body") or "")))  # trusted, sanitized server-side (nh3)
        return Page(path, "post.html", "post", {"p": p, "next": nxt, "body": body},
                    p.get("seo_title") or fit_title(p["title"]), desc, og_type="article",
                    jsonld=[art, self.breadcrumbs([("Bosh sahifa", "/"), ("Blog", url.blog), (p["title"], path)])],
                    nav_active="blog", lastmod=_lastmod(p, self.global_lastmod))

    def taklif(self) -> Page:
        return Page(url.taklif, "taklif.html", "taklif",
                    {"turnstile_site_key": (self.settings.get("turnstile_site_key") or "").strip()},
                    "Loyiha taklif qilish — Jamolxon",
                    "Loyihangizni qisqacha yozing: soha, muammo, kutilgan natija. 24 soat ichida yechim varianti, "
                    "bosqichlar va narx oralig'ini yuboraman.",
                    jsonld=[self.breadcrumbs([("Bosh sahifa", "/"), ("Taklif", url.taklif)])], nav_active="",
                    lastmod=self.global_lastmod)

    def not_found(self) -> Page:
        return Page("/404.html", "404.html", "404", {}, "Sahifa topilmadi — Jamolxon",
                    "Bu sahifa topilmadi: havola eskirgan bo'lishi mumkin. Bosh sahifaga qayting.",
                    nav_active="home", indexable=False)


# --------------------------------------------------------------------------- jinja
def _env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"], default_for_string=True, default=True),
        keep_trailing_newline=True,
    )
    env.globals.update(
        ICON={k: Markup(v) for k, v in ICON.items()},
        illo=lambda kind, theme: Markup(illustrations.draw(kind, theme)),
        illo_theme=lambda i: ["red", "yellow", "cream"][i % 3],
        fmt_date=fmt_date,
        url=url,
        MQ1=MQ1,
        MQ2=MQ2,
    )
    return env


_ENV: Environment | None = None


def env() -> Environment:
    global _ENV
    if _ENV is None:
        _ENV = _env()
    return _ENV


def _render(site: _Site, page: Page, assets: Assets, *, noindex: bool = False) -> str:
    canonical = site.abs(page.path if page.path != "/404.html" else "/404.html")
    title = clip(page.title, TITLE_MAX)
    seo = {
        "title": title,
        "og_title": title,
        "description": clip(page.description, DESC_MAX),
        "canonical": canonical,
        "og_type": page.og_type,
        "og_image": site.og_image,
        "noindex": noindex or not page.indexable,
        "jsonld": [_jsonld(x) for x in page.jsonld],
    }
    c = site.contact
    site_data = {"mail": c.get("mailParts", []), "tel": c.get("telParts", []), "tgUrl": c.get("tgUrl", ""),
                 "sale": {p["slug"]: p["title"] for p in site.projects if p.get("cat") == "sale"}}
    ctx = {
        "CATS": site.cats, "PROJECTS": site.projects, "SERVICES": site.services, "POSTS": site.posts,
        "OFFERS": site.c.get("OFFERS", []), "STEPS": site.c.get("STEPS", []), "CONTACT": c,
        "FACTS": compute_facts(site.projects), "project_by_slug": site.project_by_slug,
        "seo": seo, "assets": assets, "view": page.view, "nav_active": page.nav_active,
        "year": dt.date.today().year, "site_data": _jsonld(site_data),
        "ym_id": str(site.settings.get("yandex_metrika_id") or ""),
        **page.ctx,
    }
    return env().get_template(page.template).render(ctx)


def _assets(assets_dir: Path | None) -> Assets:
    return Assets.from_dist(Path(assets_dir)) if assets_dir else Assets.dev()


def _norm_path(path: str) -> str:
    path = (path or "/").split("?")[0].split("#")[0]
    if not path.startswith("/"):
        path = "/" + path
    if path.endswith("/index.html"):
        path = path[: -len("index.html")]
    if not path.endswith("/") and not path.endswith(".html"):
        path += "/"
    return path


def render_page(content: dict[str, Any], path: str, *, site_url: str = "https://jamolxon.uz",
                assets_dir: Path | None = None, noindex: bool = False) -> str:
    """Render one page (e.g. a draft preview). Unknown paths render the 404 page."""
    site = _Site(content, site_url)
    want = _norm_path(path)
    pages = site.pages()
    page = next((p for p in pages if p.path == want), None) or pages[-1]
    return _render(site, page, _assets(assets_dir), noindex=noindex)


# --------------------------------------------------------------------------- feeds
def _sitemap(site: _Site, pages: list[Page]) -> str:
    rows = []
    for p in pages:
        if not p.indexable:
            continue
        lm = f"<lastmod>{p.lastmod}</lastmod>" if p.lastmod else ""
        rows.append(f"  <url><loc>{xml_escape(site.abs(p.path))}</loc>{lm}</url>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(rows) + "\n</urlset>\n")


def _robots(site: _Site) -> str:
    return ("User-agent: *\nDisallow: /preview/\nDisallow: /api/\n\n"
            f"Sitemap: {site.abs('/sitemap.xml')}\n")


def _rfc822(d: str) -> str:
    try:
        when = dt.datetime.fromisoformat(d)
    except ValueError:
        when = dt.datetime.fromisoformat(d[:10])
    if when.tzinfo is None:
        when = when.replace(tzinfo=dt.UTC)
    return format_datetime(when)


def _rss(site: _Site) -> str:
    items = []
    for p in site.posts:
        link = site.abs(url.post(p["slug"]))
        date = str(p.get("published_at") or p.get("date") or "")
        pub = f"<pubDate>{_rfc822(date)}</pubDate>" if date else ""
        cats = "".join(f"<category>{xml_escape(t)}</category>" for t in p.get("tags") or [])
        items.append(
            f"<item><title>{xml_escape(p['title'])}</title><link>{link}</link><guid isPermaLink=\"true\">{link}</guid>"
            f"{pub}{cats}<description>{xml_escape(p.get('excerpt') or '')}</description></item>"
        )
    last = site.posts[0].get("published_at") or site.posts[0].get("date") if site.posts else None
    build = f"<lastBuildDate>{_rfc822(str(last))}</lastBuildDate>" if last else ""
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'
            f"<title>Jamolxon — Blog</title><link>{site.abs(url.blog)}</link>"
            f'<atom:link href="{site.abs("/rss.xml")}" rel="self" type="application/rss+xml"/>'
            "<description>AI, backend va avtomatlashtirish haqida yozuvlar</description><language>uz</language>"
            f"{build}{''.join(items)}</channel></rss>\n")


# --------------------------------------------------------------------------- build
def _file_for(out: Path, path: str) -> Path:
    if path.endswith(".html"):
        return out / path.lstrip("/")
    return out / path.strip("/") / "index.html" if path != "/" else out / "index.html"


def render_site(content: dict[str, Any], out_dir: Path, *, site_url: str = "https://jamolxon.uz",
                assets_dir: Path | None = None) -> list[str]:
    """Render the whole public site into ``out_dir`` atomically.

    Everything is written into a temp dir next to ``out_dir`` which then replaces
    ``out_dir`` via rename, so a half-written site is never served.
    Returns the URL paths written (pages and feeds).
    """
    out_dir = Path(out_dir).resolve()
    out_dir.parent.mkdir(parents=True, exist_ok=True)
    assets = _assets(assets_dir)
    site = _Site(content, site_url)
    pages = site.pages()
    tag = uuid.uuid4().hex[:10]
    tmp = out_dir.parent / f".{out_dir.name}.tmp-{tag}"
    old = out_dir.parent / f".{out_dir.name}.old-{tag}"
    written: list[str] = []
    try:
        tmp.mkdir()
        if assets.root:
            shutil.copytree(assets.root, tmp, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".vite"))
        for page in pages:
            f = _file_for(tmp, page.path)
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(_render(site, page, assets), encoding="utf-8", newline="\n")
            written.append(page.path)
        for name, text in (("sitemap.xml", _sitemap(site, pages)), ("robots.txt", _robots(site)), ("rss.xml", _rss(site))):
            (tmp / name).write_text(text, encoding="utf-8", newline="\n")
            written.append("/" + name)
        # swap: out -> old, tmp -> out, drop old
        if out_dir.exists():
            out_dir.rename(old)
        try:
            tmp.rename(out_dir)
        except OSError:
            if old.exists() and not out_dir.exists():
                old.rename(out_dir)  # roll back
            raise
        shutil.rmtree(old, ignore_errors=True)
    finally:
        if tmp.exists():
            shutil.rmtree(tmp, ignore_errors=True)
    return written
