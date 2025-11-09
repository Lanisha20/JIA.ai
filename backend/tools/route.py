"""Placeholder route-planning endpoint."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class RouteRequest(BaseModel):
    origin: str
    destination: str


class RouteResponse(BaseModel):
    origin: str
    destination: str
    distance_km: float
    hops: list[str]


@router.post("/route", response_model=RouteResponse)
def plan_route(payload: RouteRequest) -> RouteResponse:
    # Placeholder logic. Real implementation would use NetworkRoute data.
    return RouteResponse(
        origin=payload.origin,
        destination=payload.destination,
        distance_km=42.0,
        hops=[payload.origin, payload.destination],
    )
