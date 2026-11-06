import re
import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

import phonenumbers
from pydantic import EmailStr, Field, StringConstraints, TypeAdapter, ValidationInfo, field_validator

from app.schemas.common import In, Out

ContactType = Literal["email", "telegram", "phone"]
Budget = Literal["<500", "500-1000", "1000-3000", "3000-10000", "10000+", "aniq_emas"]
Deadline = Literal["shoshilinch", "1_oy", "3_oy", "aniq_emas"]
LeadStatus = Literal["new", "contacted", "proposal_sent", "won", "lost", "spam"]

_TG = re.compile(r"^@[A-Za-z0-9_]{5,32}$")
_email = TypeAdapter(EmailStr)


def normalize_contact(contact_type: str, value: str) -> str:
    """Validates and normalizes contact_value per TZ 7. Raises ValueError with an Uzbek message."""
    value = value.strip()
    if contact_type == "email":
        try:
            return str(_email.validate_python(value)).lower()
        except Exception as e:
            raise ValueError("Email manzili noto'g'ri") from e
    if contact_type == "telegram":
        if not value.startswith("@"):
            value = "@" + value
        if not _TG.match(value):
            raise ValueError("Telegram: @ va 5–32 ta lotin harfi, raqam yoki _")
        return value
    try:
        num = phonenumbers.parse(value, "UZ")
    except phonenumbers.NumberParseException as e:
        raise ValueError("Telefon raqami noto'g'ri") from e
    if not phonenumbers.is_valid_number(num):
        raise ValueError("Telefon raqami noto'g'ri")
    return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)


UtmKey = Annotated[str, StringConstraints(pattern=r"^utm_[a-z]+$")]
UtmValue = Annotated[str, StringConstraints(max_length=100)]


class LeadCreate(In):
    name: Annotated[str, StringConstraints(min_length=2, max_length=80)]
    contact_type: ContactType
    contact_value: Annotated[str, StringConstraints(min_length=3, max_length=254)]
    service: Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]+$", max_length=80)]
    budget_range: Budget | None = None
    deadline: Deadline | None = None
    message: Annotated[str, StringConstraints(min_length=10, max_length=4000)]
    consent: bool
    source_page: Annotated[str, StringConstraints(max_length=300)] = ""
    utm: dict[UtmKey, UtmValue] = Field(default_factory=dict, max_length=6)
    website: Annotated[str, StringConstraints(max_length=200)] = ""  # honeypot
    elapsed_ms: int | None = Field(None, ge=0)
    turnstile_token: Annotated[str, StringConstraints(max_length=4096)] = ""

    @field_validator("consent")
    @classmethod
    def _consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Ma'lumotlarni qayta ishlashga rozilik kerak")
        return v

    @field_validator("contact_value")
    @classmethod
    def _contact(cls, v: str, info: ValidationInfo) -> str:
        ctype = info.data.get("contact_type")
        if ctype is None:
            return v
        return normalize_contact(ctype, v)


class LeadCreated(Out):
    id: uuid.UUID
    message: str


class LeadEventOut(Out):
    id: uuid.UUID
    kind: str
    actor: dict[str, Any] | None
    payload: dict[str, Any]
    created_at: datetime


class LeadOut(Out):
    id: uuid.UUID
    number: int
    name: str
    contact_type: str
    contact_value: str
    service: str
    budget_range: str | None
    deadline: str | None
    message: str
    status: str
    source_page: str
    utm: dict[str, str]
    spam_score: int
    assigned_to: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    events: list[LeadEventOut] = []  # noqa: RUF012 - pydantic copies defaults


class LeadPatch(In):
    status: LeadStatus | None = None
    assigned_to: uuid.UUID | None = None


class LeadEventCreate(In):
    kind: Literal["note", "call"]
    payload: dict[Literal["text"], Annotated[str, StringConstraints(min_length=1, max_length=4000)]]
