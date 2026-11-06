"""Markdown -> sanitized HTML (nh3 whitelist, TZ 3/8)."""

import math
import re

import nh3
from markdown_it import MarkdownIt

_md = MarkdownIt("commonmark", {"html": True, "linkify": False, "typographer": False}).enable("table")

ALLOWED_TAGS = {"p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "b", "i", "a", "blockquote", "code", "pre",
                "br", "hr", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "span"}
ALLOWED_ATTRS = {"a": {"href", "title", "class"}, "img": {"src", "alt", "width", "height", "loading"},
                 "span": {"class"}, "code": {"class"}, "th": {"align"}, "td": {"align"}}


def _link_rel(element: str, attribute: str, value: str) -> str | None:
    return value


def sanitize_html(html: str) -> str:
    return nh3.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, url_schemes={"http", "https", "mailto", "tel"},
                     link_rel="noopener noreferrer")


def render_markdown(md: str) -> str:
    return sanitize_html(_md.render(md))


_TAG = re.compile(r"<[^>]+>")


def plain_text(html: str) -> str:
    return re.sub(r"\s+", " ", _TAG.sub(" ", html)).strip()


def reading_minutes(html: str, wpm: int = 200) -> int:
    return max(1, math.ceil(len(plain_text(html).split()) / wpm))


def sections_to_html(sections: list[dict[str, object]]) -> str:
    from html import escape

    parts = []
    for s in sections:
        parts.append(f"<h3>{escape(str(s.get('h', '')))}</h3>")
        paras = s.get("p", [])
        if isinstance(paras, list):
            parts.extend(f"<p>{escape(str(p))}</p>" for p in paras)
    return "".join(parts)
