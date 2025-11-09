"""State overview endpoints consumed by the dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session

router = APIRouter(prefix="/state", tags=["state"])


@router.get("/overview")
def overview(session: Session = Depends(get_session)) -> dict:
    return queries.build_state_overview(session)
