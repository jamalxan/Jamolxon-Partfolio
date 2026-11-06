import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import AnyHttpUrl, Field, StringConstraints, field_validator

from app.schemas.common import ContentStatus, In, Out, Slug

Title = Annotated[str, StringConstraints(min_length=1, max_length=120)]
ShortText = Annotated[str, StringConstraints(max_length=300)]
LongText = Annotated[str, StringConstraints(max_length=20000)]
Item = Annotated[str, StringConstraints(min_length=1, max_length=500)]
SeoTitle = Annotated[str, StringConstraints(max_length=60)]
SeoDesc = Annotated[str, StringConstraints(max_length=155)]


class Section(In):
    h: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    p: list[Annotated[str, StringConstraints(min_length=1, max_length=5000)]] = Field(max_length=30)


class Link(In):
    label: Annotated[str, StringConstraints(min_length=1, max_length=80)]
    url: AnyHttpUrl

    @field_validator("url")
    @classmethod
    def _https_or_http(cls, v: AnyHttpUrl) -> AnyHttpUrl:
        if v.scheme not in ("http", "https"):
            raise ValueError("Faqat http(s) havola")
        return v


class GalleryItem(In):
    media_id: uuid.UUID
    caption: ShortText = ""


# ---- Projects ----------------------------------------------------------------------------------


class ProjectFields(In):
    slug: Slug | None = None
    title: Title | None = None
    subtitle: ShortText | None = None
    category: Slug | None = None
    url: Annotated[str, StringConstraints(max_length=300)] | None = None
    year: Annotated[str, StringConstraints(max_length=10)] | None = None
    client: Annotated[str, StringConstraints(max_length=120)] | None = None
    role: Annotated[str, StringConstraints(max_length=200)] | None = None
    stack: list[Annotated[str, StringConstraints(min_length=1, max_length=60)]] | None = Field(None, max_length=40)
    summary: LongText | None = None
    sections: list[Section] | None = Field(None, max_length=20)
    results: list[Item] | None = Field(None, max_length=20)
    links: list[Link] | None = Field(None, max_length=10)
    illo: Annotated[str, StringConstraints(max_length=40)] | None = None
    image: Annotated[str, StringConstraints(max_length=500)] | None = None
    cover_id: uuid.UUID | None = None
    gallery: list[GalleryItem] | None = Field(None, max_length=40)
    seo_title: SeoTitle | None = None
    seo_description: SeoDesc | None = None
    is_featured: bool | None = None


class ProjectCreate(ProjectFields):
    slug: Slug
    title: Title


class ProjectPatch(ProjectFields):
    updated_at: datetime


class ProjectOut(Out):
    id: uuid.UUID
    slug: str
    title: str
    subtitle: str
    category: str | None
    url: str
    year: str
    client: str
    role: str
    stack: list[str]
    summary: str
    sections: list[dict[str, Any]]
    results: list[str]
    links: list[dict[str, str]]
    illo: str
    image: str | None
    cover_id: uuid.UUID | None
    gallery: list[dict[str, Any]]
    seo_title: str | None
    seo_description: str | None
    is_featured: bool
    status: ContentStatus
    published_at: datetime | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ---- Services ----------------------------------------------------------------------------------


class ServiceFields(In):
    slug: Slug | None = None
    title: Title | None = None
    icon: Annotated[str, StringConstraints(max_length=40)] | None = None
    illo: Annotated[str, StringConstraints(max_length=40)] | None = None
    short: LongText | None = None
    who: list[Item] | None = Field(None, max_length=20)
    includes: list[Item] | None = Field(None, max_length=30)
    process: list[Item] | None = Field(None, max_length=20)
    examples: list[Slug] | None = Field(None, max_length=10)
    stack: list[Annotated[str, StringConstraints(min_length=1, max_length=60)]] | None = Field(None, max_length=40)
    timeline: ShortText | None = None
    faq: list[tuple[Item, Annotated[str, StringConstraints(min_length=1, max_length=3000)]]] | None = Field(
        None, max_length=30
    )
    price_from: Annotated[str, StringConstraints(max_length=60)] | None = None
    duration: Annotated[str, StringConstraints(max_length=60)] | None = None
    seo_title: SeoTitle | None = None
    seo_description: SeoDesc | None = None


class ServiceCreate(ServiceFields):
    slug: Slug
    title: Title


class ServicePatch(ServiceFields):
    updated_at: datetime


class ServiceOut(Out):
    id: uuid.UUID
    slug: str
    title: str
    icon: str
    illo: str
    short: str
    who: list[str]
    includes: list[str]
    process: list[str]
    examples: list[str]
    stack: list[str]
    timeline: str
    faq: list[list[str]]
    price_from: str | None
    duration: str | None
    seo_title: str | None
    seo_description: str | None
    status: ContentStatus
    published_at: datetime | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ---- Posts -------------------------------------------------------------------------------------


class PostFields(In):
    slug: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)] | None = None
    title: Annotated[str, StringConstraints(min_length=1, max_length=200)] | None = None
    excerpt: Annotated[str, StringConstraints(max_length=1000)] | None = None
    body_md: Annotated[str, StringConstraints(max_length=200000)] | None = None
    tags: list[Annotated[str, StringConstraints(min_length=1, max_length=60)]] | None = Field(None, max_length=10)
    cover_id: uuid.UUID | None = None
    seo_title: SeoTitle | None = None
    seo_description: SeoDesc | None = None


class PostCreate(PostFields):
    slug: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)]
    title: Annotated[str, StringConstraints(min_length=1, max_length=200)]


class PostPatch(PostFields):
    updated_at: datetime


class PostOut(Out):
    id: uuid.UUID
    slug: str
    title: str
    excerpt: str
    body_md: str
    body_html: str
    tags: list[str]
    cover_id: uuid.UUID | None
    reading_min: int
    seo_title: str | None
    seo_description: str | None
    status: ContentStatus
    published_at: datetime | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ---- Small resources ---------------------------------------------------------------------------


class CategoryFields(In):
    slug: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=40)] | None = None
    title: Title | None = None
    short: Annotated[str, StringConstraints(max_length=60)] | None = None
    badge: Annotated[str, StringConstraints(max_length=40)] | None = None
    dot: Annotated[str, StringConstraints(max_length=40)] | None = None
    description: LongText | None = None
    color: Annotated[str, StringConstraints(max_length=20)] | None = None


class CategoryCreate(CategoryFields):
    slug: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=40)]
    title: Title


class CategoryPatch(CategoryFields):
    updated_at: datetime


class CategoryOut(Out):
    id: uuid.UUID
    slug: str
    title: str
    short: str
    badge: str
    dot: str
    description: str
    color: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class TagFields(In):
    slug: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=60)] | None = None
    title: Annotated[str, StringConstraints(min_length=1, max_length=60)] | None = None


class TagCreate(TagFields):
    slug: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=60)]
    title: Annotated[str, StringConstraints(min_length=1, max_length=60)]


class TagPatch(TagFields):
    updated_at: datetime


class TagOut(Out):
    id: uuid.UUID
    slug: str
    title: str
    created_at: datetime
    updated_at: datetime


class OfferFields(In):
    key: Annotated[str, StringConstraints(pattern=r"^[a-z0-9_-]+$", max_length=40)] | None = None
    title: Title | None = None
    icon: Annotated[str, StringConstraints(max_length=40)] | None = None
    problem: LongText | None = None
    solution: LongText | None = None
    examples: list[tuple[Title, Slug]] | None = Field(None, max_length=10)


class OfferCreate(OfferFields):
    key: Annotated[str, StringConstraints(pattern=r"^[a-z0-9_-]+$", max_length=40)]
    title: Title


class OfferPatch(OfferFields):
    updated_at: datetime


class OfferOut(Out):
    id: uuid.UUID
    key: str
    title: str
    icon: str
    problem: str
    solution: str
    examples: list[list[str]]
    sort_order: int
    created_at: datetime
    updated_at: datetime


class StepFields(In):
    title: Title | None = None
    text: LongText | None = None
    get: LongText | None = None


class StepCreate(StepFields):
    title: Title


class StepPatch(StepFields):
    updated_at: datetime


class StepOut(Out):
    id: uuid.UUID
    title: str
    text: str
    get: str
    sort_order: int
    created_at: datetime
    updated_at: datetime
