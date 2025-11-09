"""Nemotron planner orchestration."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core import queries
from backend.core.db import get_session

TOOL_ENDPOINTS = {
    "detect": "/tools/detect",
    "match": "/tools/match",
    "audit": "/tools/audit",
    "forecast": "/tools/forecast",
}


class PlannerRunRequest(BaseModel):
    goal: str = Field(..., description="High-level instruction")
    context: Dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = False


class PlannerRunResponse(BaseModel):
    ran_at: datetime = Field(default_factory=datetime.utcnow)
    plan: Dict[str, Any]
    steps: List[Dict[str, Any]]


router = APIRouter(prefix="/planner", tags=["planner"])


@router.post("/run", response_model=PlannerRunResponse)
async def run_planner(payload: PlannerRunRequest, session: Session = Depends(get_session)) -> PlannerRunResponse:
    plan = await _build_plan(payload.goal, payload.context)
    steps: List[Dict[str, Any]] = []
    if not payload.dry_run:
        steps = await _execute_plan(plan)

    response = PlannerRunResponse(plan=plan, steps=steps)
    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="planner",
        input_payload=payload.model_dump(),
        output_payload=response.model_dump(),
        tags=["planner"],
    )
    return response


async def _build_plan(goal: str, context: Dict[str, Any]) -> Dict[str, Any]:
    if os.getenv("NEMO_API_KEY"):
        return await _call_nemotron(goal, context)
    return _fallback_plan(goal, context)


async def _call_nemotron(goal: str, context: Dict[str, Any]) -> Dict[str, Any]:
    prompt = (
        "You coordinate field tools. Return JSON with 'strategy' and 'steps'. "
        "Each step needs a 'tool' (detect, match, audit, forecast) and a 'payload'."
    )
    payload = {
        "model": os.getenv("NEMO_MODEL", "nemotron-4-340b-instruct"),
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps({"goal": goal, "context": context})},
        ],
        "temperature": 0.1,
    }
    headers = {"Authorization": f"Bearer {os.getenv('NEMO_API_KEY')}"}
    url = os.getenv("NEMO_BASE_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        message = data["choices"][0]["message"]["content"]
        try:
            return json.loads(message)
        except json.JSONDecodeError:
            return _fallback_plan(goal, context)


def _fallback_plan(goal: str, context: Dict[str, Any]) -> Dict[str, Any]:
    goal_lower = goal.lower()
    steps: List[Dict[str, Any]] = []
    if "detect" in goal_lower or "anomaly" in goal_lower:
        steps.append({"tool": "detect", "payload": {"minutes": 180}})
    if "match" in goal_lower or not steps:
        steps.append({"tool": "match", "payload": {}})
    if "audit" in goal_lower:
        steps.append({"tool": "audit", "payload": {}})
    if "forecast" in goal_lower:
        steps.append({"tool": "forecast", "payload": {"cauldron_id": context.get("cauldron_id", "cauldron_001")}})
    return {"strategy": "fallback", "steps": steps}


async def _execute_plan(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = plan.get("steps", [])
    results: List[Dict[str, Any]] = []
    if not steps:
        return results

    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=30) as client:
        for step in steps:
            tool = step.get("tool")
            payload = step.get("payload", {})
            endpoint = TOOL_ENDPOINTS.get(tool)
            if not endpoint:
                results.append({"tool": tool, "status": "skipped", "reason": "unknown tool"})
                continue
            try:
                response = await client.post(endpoint, json=payload)
                response.raise_for_status()
                results.append({"tool": tool, "status": "ok", "payload": payload, "response": response.json()})
            except httpx.HTTPError as exc:
                results.append({"tool": tool, "status": "error", "payload": payload, "error": str(exc)})
    return results
