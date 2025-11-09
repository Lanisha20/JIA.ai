"""Tool routers exposed to the planner."""

from fastapi import APIRouter

from . import audit, detect, forecast, match, route

tool_router = APIRouter(prefix="/tools", tags=["tools"])

for module in (detect, match, audit, forecast, route):
    tool_router.include_router(module.router)

__all__ = ["tool_router"]
