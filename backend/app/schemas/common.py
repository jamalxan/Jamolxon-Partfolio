from datetime import datetime
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

T = TypeVar("T")

SLUG_RE = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
Slug = Annotated[str, StringConstraints(pattern=SLUG_RE, min_length=1, max_length=80)]
ContentStatus = Literal["draft", "published", "archived"]


class In(BaseModel):
    """Input schemas reject unknown fields (TZ 8: extra = forbid)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    limit: int


class PageParams(In):
    page: int = Field(1, ge=1)
    limit: int = Field(12, ge=1, le=50)


class PublishIn(In):
    status: ContentStatus
    published_at: datetime | None = None


class ReorderIn(In):
    ids: list[str] = Field(min_length=1, max_length=500)
