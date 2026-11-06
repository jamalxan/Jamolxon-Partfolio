import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Index, SmallInteger, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin
from app.models.user import User


class LeadEvent(IdMixin, Base):
    __tablename__ = "lead_events"
    __table_args__ = (Index("ix_lead_events_lead_created", "lead_id", "created_at"),)

    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    kind: Mapped[str] = mapped_column(String(20))  # status_change | note | call | notify
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    actor: Mapped[User | None] = relationship(lazy="joined")


class Lead(IdMixin, Base):
    __tablename__ = "leads"
    __table_args__ = (Index("ix_leads_status_created", "status", text("created_at DESC")),)

    number: Mapped[int] = mapped_column(BigInteger, Identity(start=1), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    contact_type: Mapped[str] = mapped_column(String(16))
    contact_value: Mapped[str] = mapped_column(String(254), index=True)
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id", ondelete="SET NULL")
    )
    service_slug: Mapped[str] = mapped_column(String(80), default="boshqa")
    budget_range: Mapped[str | None] = mapped_column(String(20))
    deadline: Mapped[str | None] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="new")
    source_page: Mapped[str] = mapped_column(String(300), default="")
    utm: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict)
    ip_hash: Mapped[str] = mapped_column(String(64), default="")
    user_agent: Mapped[str] = mapped_column(String(300), default="")
    spam_score: Mapped[int] = mapped_column(SmallInteger, default=0)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    anonymized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    events: Mapped[list[LeadEvent]] = relationship(
        order_by=LeadEvent.created_at, lazy="selectin", cascade="all, delete-orphan"
    )


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[Any] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Redirect(IdMixin, Base):
    __tablename__ = "redirects"

    from_path: Mapped[str] = mapped_column(String(300), unique=True)
    to_path: Mapped[str] = mapped_column(String(300))
    code: Mapped[int] = mapped_column(SmallInteger, default=301)


class AuditLog(IdMixin, Base):
    """Append-only: a DB trigger (see migration) rejects UPDATE and DELETE (TZ 8)."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_entity", "entity", "entity_id"), Index("ix_audit_created", "created_at"))

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(40))
    entity: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    diff: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    ip: Mapped[str] = mapped_column(String(64), default="")
    user_agent: Mapped[str] = mapped_column(String(300), default="")

    actor: Mapped[User | None] = relationship(lazy="joined")


class Heartbeat(Base):
    """Last-run markers (backup, worker) shown on the dashboard."""

    __tablename__ = "heartbeats"

    name: Mapped[str] = mapped_column(String(40), primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    info: Mapped[str] = mapped_column(Text, default="")
