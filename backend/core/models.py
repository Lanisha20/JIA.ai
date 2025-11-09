"""SQLAlchemy ORM models for the JIA.ai backend."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class TimestampMixin:
    """Shared timestamp columns for auditing."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class Cauldron(Base, TimestampMixin):
    __tablename__ = "cauldrons"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    max_volume: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fill_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    extra: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict)

    levels: Mapped[list["CauldronLevel"]] = relationship(
        "CauldronLevel", back_populates="cauldron", cascade="all, delete-orphan"
    )
    tickets: Mapped[list["Ticket"]] = relationship(
        "Ticket", back_populates="cauldron", cascade="all, delete-orphan"
    )
    matches: Mapped[list["MatchRecord"]] = relationship(
        "MatchRecord", back_populates="cauldron", cascade="all, delete-orphan"
    )
    drain_events: Mapped[list["DrainEvent"]] = relationship(
        "DrainEvent", back_populates="cauldron", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - repr helper
        return f"Cauldron(id={self.id!r}, name={self.name!r})"


class CauldronLevel(Base, TimestampMixin):
    __tablename__ = "levels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cauldron_id: Mapped[str] = mapped_column(
        String, ForeignKey("cauldrons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), index=True)
    volume: Mapped[Optional[float]] = mapped_column(Float)
    fill_percent: Mapped[Optional[float]] = mapped_column(Float)
    raw_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    cauldron: Mapped[Cauldron] = relationship("Cauldron", back_populates="levels")


class Ticket(Base, TimestampMixin):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_code: Mapped[str] = mapped_column(String, unique=True, index=True)
    cauldron_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("cauldrons.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False))
    volume: Mapped[Optional[float]] = mapped_column(Float)
    route_id: Mapped[Optional[str]] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="scheduled")
    extra: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict)

    cauldron: Mapped[Optional[Cauldron]] = relationship("Cauldron", back_populates="tickets")
    matches: Mapped[list["MatchRecord"]] = relationship(
        "MatchRecord", back_populates="ticket", cascade="all, delete-orphan"
    )


class DrainEvent(Base, TimestampMixin):
    __tablename__ = "drain_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cauldron_id: Mapped[str] = mapped_column(
        String, ForeignKey("cauldrons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    estimated_loss: Mapped[Optional[float]] = mapped_column(Float)
    reason: Mapped[Optional[str]] = mapped_column(String)
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    extra: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict)

    cauldron: Mapped[Cauldron] = relationship("Cauldron", back_populates="drain_events")


class MatchRecord(Base, TimestampMixin):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cauldron_id: Mapped[str] = mapped_column(
        String, ForeignKey("cauldrons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ticket_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True
    )
    level_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("levels.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="pending")
    discrepancy: Mapped[Optional[float]] = mapped_column(Float)
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    extra: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict)

    cauldron: Mapped[Cauldron] = relationship("Cauldron", back_populates="matches")
    ticket: Mapped[Optional[Ticket]] = relationship("Ticket", back_populates="matches")


class AgentTrace(Base):
    __tablename__ = "agent_trace"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    input_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    output_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "agent": self.agent,
            "action": self.action,
            "input": self.input_payload,
            "output": self.output_payload,
            "tags": self.tags,
            "created_at": self.created_at.isoformat(),
        }


class NetworkRoute(Base, TimestampMixin):
    __tablename__ = "network_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    edge_id: Mapped[str] = mapped_column(String, index=True)
    origin: Mapped[Optional[str]] = mapped_column(String)
    destination: Mapped[Optional[str]] = mapped_column(String)
    distance_km: Mapped[Optional[float]] = mapped_column(Float)
    extra: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


__all__ = [
    "AgentTrace",
    "Cauldron",
    "CauldronLevel",
    "DrainEvent",
    "MatchRecord",
    "NetworkRoute",
    "Ticket",
]
