"""Audit trail endpoint for Nemotron."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session
from backend.logic.services import audit_cauldron


class AuditRequest(BaseModel):
    cauldron_id: str = Field(..., description="Cauldron to audit")


class AuditResponse(BaseModel):
    ran_at: datetime = Field(default_factory=datetime.utcnow)
    result: dict


router = APIRouter()


@router.post("/audit", response_model=AuditResponse)
def run_audit(payload: AuditRequest, session: Session = Depends(get_session)) -> AuditResponse:
    try:
        result = audit_cauldron(session, cauldron_id=payload.cauldron_id)
    except ValueError as exc:  # surface as 404
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    response = AuditResponse(result=result)
    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="audit",
        input_payload=payload.model_dump(),
        output_payload=response.model_dump(),
        tags=["audit"],
    )
    return response
