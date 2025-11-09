"""Tool routers exposed to the planner."""

from fastapi import APIRouter

from . import audit, detect, forecast, match, route

router = APIRouter(prefix="/tools", tags=["tools"])

router.include_router(detect.router)
router.include_router(match.router)
router.include_router(audit.router)
router.include_router(forecast.router)
router.include_router(route.router)

__all__ = ["router"]
