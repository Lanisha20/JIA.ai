"""Route utility for Nemotron."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.logic.services import shortest_route


class RouteRequest(BaseModel):
    origin: str = Field(..., description="Start depot or hub")
    destination: str = Field(..., description="End depot or hub")


class RouteResponse(BaseModel):
    ran_at: datetime = Field(default_factory=datetime.utcnow)
    origin: str
    destination: str
    distance_km: float | None
    path: list[dict]


router = APIRouter()


@router.post("/route", response_model=RouteResponse)
def plan_route(payload: RouteRequest, session: Session = Depends(get_session)) -> RouteResponse:
    route = shortest_route(
        session,
        origin=payload.origin,
        destination=payload.destination,
    )
    response = RouteResponse(**route)
    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="route",
        input_payload=payload.model_dump(),
        output_payload=response.model_dump(),
        tags=["route"],
    )
    return response
