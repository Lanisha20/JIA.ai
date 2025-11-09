"""State endpoints for dashboard consumption."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.db import get_session
from backend.core.queries import build_state_overview

router = APIRouter(prefix="/state", tags=["state"])


@router.get("/overview")
def overview(session: Session = Depends(get_session)) -> dict:
    return build_state_overview(session)
