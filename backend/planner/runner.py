"""Nemotron planner orchestration and FastAPI router."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

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
    "route": "/tools/route",
}


class PlannerRunRequest(BaseModel):
    goal: str = Field(..., description="High level instruction for Nemotron")
    context: Dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = Field(default=False, description="Skip tool execution, return plan only")


class PlannerRunResponse(BaseModel):
    ran_at: datetime = Field(default_factory=datetime.utcnow)
    plan: Dict[str, Any]
    steps: List[Dict[str, Any]]


class NemotronPlanner:
    def __init__(self) -> None:
        base_dir = Path(__file__).resolve().parent
        prompt_dir = base_dir / "prompts"
        self.system_prompt = (prompt_dir / "planner_system.txt").read_text().strip()
        self.tool_schemas = json.loads((prompt_dir / "tool_schemas.json").read_text())
        self.api_base = os.getenv(
            "NEMOTRON_API_URL",
            "https://integrate.api.nvidia.com/v1/chat/completions",
        )
        self.api_key = os.getenv("NEMOTRON_API_KEY")
        self.internal_base_url = os.getenv("INTERNAL_API_BASE", "http://localhost:8000")
        self.gemini_url = os.getenv(
            "GEMINI_API_URL",
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
        )
        self.gemini_key = os.getenv("GEMINI_API_KEY")

    async def run(self, goal: str, context: Dict[str, Any], *, dry_run: bool = False) -> Dict[str, Any]:
        plan = await self._build_plan(goal, context)
        if dry_run:
            return {"plan": plan, "steps": []}
        steps = await self._execute_plan(plan)
        return {"plan": plan, "steps": steps}

    async def _build_plan(self, goal: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key:
            return self._fallback_plan(goal, context)

        payload = {
            "model": os.getenv("NEMOTRON_MODEL", "nemotron-4-340b-instruct"),
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "goal": goal,
                            "context": context,
                            "tool_schemas": self.tool_schemas,
                        }
                    ),
                },
            ],
            "temperature": 0.1,
            "max_tokens": 900,
        }

        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.api_base, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            message = data["choices"][0]["message"]["content"]
            try:
                return json.loads(message)
            except json.JSONDecodeError:
                return self._fallback_plan(goal, context)

    async def _execute_plan(self, plan: Dict[str, Any]) -> List[Dict[str, Any]]:
        steps = plan.get("steps") or []
        if not steps:
            return []

        results: List[Dict[str, Any]] = []
        async with httpx.AsyncClient(base_url=self.internal_base_url, timeout=60) as client:
            for index, step in enumerate(steps):
                tool = step.get("tool")
                payload = step.get("payload", {})
                endpoint = TOOL_ENDPOINTS.get(tool)
                if not endpoint:
                    results.append(
                        {
                            "tool": tool,
                            "status": "skipped",
                            "reason": "unsupported tool",
                        }
                    )
                    continue
                try:
                    response = await client.post(endpoint, json=payload)
                    response.raise_for_status()
                    results.append(
                        {
                            "tool": tool,
                            "payload": payload,
                            "status": "ok",
                            "response": response.json(),
                        }
                    )
                except httpx.HTTPError as exc:
                    results.append(
                        {
                            "tool": tool,
                            "payload": payload,
                            "status": "error",
                            "error": str(exc),
                        }
                    )
        return results

    def _fallback_plan(self, goal: str, context: Dict[str, Any]) -> Dict[str, Any]:
        goal_lower = goal.lower()
        steps: List[Dict[str, Any]] = []
        if "anomaly" in goal_lower or "detect" in goal_lower:
            steps.append({"tool": "detect", "payload": {"threshold": 8}})
        if "match" in goal_lower or "ticket" in goal_lower:
            steps.append({"tool": "match", "payload": {}})
        if "forecast" in goal_lower:
            steps.append({"tool": "forecast", "payload": {"horizon_hours": 12}})
        if "audit" in goal_lower and context.get("cauldron_id"):
            steps.append({"tool": "audit", "payload": {"cauldron_id": context["cauldron_id"]}})
        if not steps:
            steps = [
                {"tool": "detect", "payload": {"threshold": 10}},
                {"tool": "match", "payload": {}},
            ]
        return {"strategy": "fallback", "steps": steps}

    async def call_gemini(self, prompt: str) -> str:
        if not self.gemini_key:
            return "gemini-disabled"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ]
        }
        params = {"key": self.gemini_key}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.gemini_url, params=params, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")


planner_router = APIRouter(prefix="/planner", tags=["planner"])


@planner_router.post("/run", response_model=PlannerRunResponse)
async def run_planner(
    payload: PlannerRunRequest,
    session: Session = Depends(get_session),
) -> PlannerRunResponse:
    planner = NemotronPlanner()
    result = await planner.run(payload.goal, payload.context, dry_run=payload.dry_run)
    queries.log_agent_trace(
        session,
        agent="nemotron",
        action="planner",
        input_payload=payload.model_dump(),
        output_payload=result,
        tags=["planner"],
    )
    return PlannerRunResponse(plan=result["plan"], steps=result["steps"])


__all__ = ["NemotronPlanner", "planner_router"]
