"""Ticket-to-level correlation tool."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.logic.services import match_tickets


class MatchRequest(BaseModel):
    cauldron_ids: Optional[List[str]] = None
    persist: bool = Field(default=True, description="Persist match rows to the DB")


class MatchResult(BaseModel):
    ticket_code: str
    cauldron_id: Optional[str]
    status: str
    discrepancy: Optional[float]
    confidence: Optional[float]
    match_id: Optional[int] = None


class MatchResponse(BaseModel):
    ran_at: datetime = Field(default_factory=datetime.utcnow)
    matches: List[MatchResult]


router = APIRouter()


@router.post("/match", response_model=MatchResponse)
def run_match(payload: MatchRequest, session: Session = Depends(get_session)) -> MatchResponse:
    matches = match_tickets(
        session,
        cauldron_ids=payload.cauldron_ids,
        auto_persist=payload.persist,
    )
    response = MatchResponse(matches=[MatchResult(**item) for item in matches])
    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="match",
        input_payload=payload.model_dump(),
        output_payload=response.model_dump(),
        tags=["match"],
    )
    return response
