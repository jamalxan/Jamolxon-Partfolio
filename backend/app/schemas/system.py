import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import EmailStr, Field, StringConstraints

from app.schemas.common import In, Out

Role = Literal["owner", "editor"]


class LoginIn(In):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=256, strip_whitespace=False)]


class VerifyIn(In):
    code: Annotated[str, StringConstraints(max_length=10)] | None = None
    backup_code: Annotated[str, StringConstraints(max_length=12)] | None = None


class PasswordChangeIn(In):
    current_password: Annotated[str, StringConstraints(max_length=256, strip_whitespace=False)]
    new_password: Annotated[str, StringConstraints(max_length=256, strip_whitespace=False)]


class UserOut(Out):
    id: uuid.UUID
    email: str
    name: str
    role: Role
    is_active: bool
    last_login_at: datetime | None
    totp_enabled: bool


class UserCreate(In):
    email: EmailStr
    name: Annotated[str, StringConstraints(max_length=120)] = ""
    role: Role
    password: Annotated[str, StringConstraints(max_length=256, strip_whitespace=False)]


class UserPatch(In):
    name: Annotated[str, StringConstraints(max_length=120)] | None = None
    role: Role | None = None
    is_active: bool | None = None
    revoke_sessions: bool = False


class MediaOut(Out):
    id: uuid.UUID
    url: str
    original_name: str
    mime: str
    size_bytes: int
    width: int | None
    height: int | None
    variants: dict[str, Any]
    alt: str
    blurhash: str | None
    used_in: list[dict[str, Any]] = []  # noqa: RUF012 - pydantic copies defaults
    created_at: datetime


class MediaPatch(In):
    alt: Annotated[str, StringConstraints(min_length=1, max_length=300)]


class SettingsIn(In):
    contact: dict[str, Any] | None = None
    social: dict[str, Any] | None = None
    seo: dict[str, Any] | None = None
    telegram: dict[str, Any] | None = None


class RedirectIn(In):
    from_path: Annotated[str, StringConstraints(pattern=r"^/[^\s]*$", max_length=300)]
    to_path: Annotated[str, StringConstraints(pattern=r"^(/|https://)[^\s]*$", max_length=300)]
    code: Literal[301, 302] = 301


class RedirectOut(Out):
    id: uuid.UUID
    from_path: str
    to_path: str
    code: int


class AuditOut(Out):
    id: uuid.UUID
    actor: dict[str, Any] | None
    action: str
    entity: str
    entity_id: str | None
    diff: dict[str, Any]
    ip: str
    created_at: datetime


class JobOut(Out):
    job_id: str


class PreviewOut(Out):
    url: str


class DashboardOut(Out):
    leads: dict[str, int]
    new_leads: list[dict[str, Any]]
    recent_publications: list[dict[str, Any]]
    system: dict[str, Any] = Field(default_factory=dict)
