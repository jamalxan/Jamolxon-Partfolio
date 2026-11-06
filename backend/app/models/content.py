import uuid
from typing import Any

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String, Table, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, ContentMixin, IdMixin


class Category(IdMixin, Base):
    __tablename__ = "categories"

    slug: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    short: Mapped[str] = mapped_column(String(60), default="")
    badge: Mapped[str] = mapped_column(String(40), default="")
    dot: Mapped[str] = mapped_column(String(40), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(20), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Media(IdMixin, Base):
    __tablename__ = "media"

    storage_key: Mapped[str] = mapped_column(String(200), unique=True)
    original_name: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(60))
    size_bytes: Mapped[int] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    variants: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    alt: Mapped[str] = mapped_column(String(300))
    blurhash: Mapped[str | None] = mapped_column(String(100))
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class ProjectImage(IdMixin, Base):
    __tablename__ = "project_images"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    media_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("media.id", ondelete="CASCADE"))
    caption: Mapped[str] = mapped_column(String(300), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Project(ContentMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_projects_status_sort", "status", "sort_order"),
        Index("ix_projects_stack_gin", "stack", postgresql_using="gin"),
    )

    slug: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    subtitle: Mapped[str] = mapped_column(String(300), default="")
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL")
    )
    url: Mapped[str] = mapped_column(String(300), default="")
    year: Mapped[str] = mapped_column(String(10), default="")
    client: Mapped[str] = mapped_column(String(120), default="")
    role: Mapped[str] = mapped_column(String(200), default="")
    stack: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list)
    summary: Mapped[str] = mapped_column(Text, default="")
    # The design renders structured sections (h + paragraphs); body_html is derived and sanitized.
    sections: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    body_md: Mapped[str] = mapped_column(Text, default="")
    body_html: Mapped[str] = mapped_column(Text, default="")
    results: Mapped[list[str]] = mapped_column(JSONB, default=list)
    links: Mapped[list[dict[str, str]]] = mapped_column(JSONB, default=list)
    illo: Mapped[str] = mapped_column(String(40), default="dashboard")
    image: Mapped[str | None] = mapped_column(String(500))
    cover_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media.id", ondelete="SET NULL")
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)

    category: Mapped[Category | None] = relationship(lazy="joined")
    gallery: Mapped[list[ProjectImage]] = relationship(
        cascade="all, delete-orphan", order_by=ProjectImage.sort_order, lazy="selectin"
    )


class Service(ContentMixin, Base):
    __tablename__ = "services"

    slug: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str] = mapped_column(String(40), default="")
    illo: Mapped[str] = mapped_column(String(40), default="")
    short: Mapped[str] = mapped_column(Text, default="")
    who: Mapped[list[str]] = mapped_column(JSONB, default=list)
    includes: Mapped[list[str]] = mapped_column(JSONB, default=list)
    process: Mapped[list[str]] = mapped_column(JSONB, default=list)
    examples: Mapped[list[str]] = mapped_column(JSONB, default=list)
    stack: Mapped[list[str]] = mapped_column(JSONB, default=list)
    timeline: Mapped[str] = mapped_column(String(300), default="")
    faq: Mapped[list[list[str]]] = mapped_column(JSONB, default=list)
    price_from: Mapped[str | None] = mapped_column(String(60))
    duration: Mapped[str | None] = mapped_column(String(60))


post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(IdMixin, Base):
    __tablename__ = "tags"

    slug: Mapped[str] = mapped_column(String(60), unique=True)
    title: Mapped[str] = mapped_column(String(60))


class Post(ContentMixin, Base):
    __tablename__ = "posts"
    __table_args__ = (
        Index("ix_posts_search_gin", "search_vector", postgresql_using="gin"),
        Index("ix_posts_status_published", "status", text("published_at DESC")),
    )

    slug: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    excerpt: Mapped[str] = mapped_column(Text, default="")
    body_md: Mapped[str] = mapped_column(Text, default="")
    body_html: Mapped[str] = mapped_column(Text, default="")
    cover_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media.id", ondelete="SET NULL")
    )
    reading_min: Mapped[int] = mapped_column(Integer, default=1)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    search_vector: Mapped[Any] = mapped_column(TSVECTOR, nullable=True)

    tags: Mapped[list[Tag]] = relationship(secondary=post_tags, lazy="selectin", order_by=Tag.title)


class Offer(IdMixin, Base):
    __tablename__ = "offers"

    key: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str] = mapped_column(String(40), default="")
    problem: Mapped[str] = mapped_column(Text, default="")
    solution: Mapped[str] = mapped_column(Text, default="")
    examples: Mapped[list[list[str]]] = mapped_column(JSONB, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class ProcessStep(IdMixin, Base):
    __tablename__ = "process_steps"

    title: Mapped[str] = mapped_column(String(120))
    text: Mapped[str] = mapped_column(Text, default="")
    get: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
