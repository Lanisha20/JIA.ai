"""FastAPI application wiring."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.db import init_db
from backend.demo import demo_router
from backend.planner.runner import router as planner_router
from backend.state import state_router
from backend.tools import router as tool_router

init_db()

app = FastAPI(title="JIA.ai Backend", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.get("/healthz")
def healthcheck() -> dict:
    return {"ok": True}

@app.get("/api/overview")
def get_overview(mode: str = "live", date: str | None = None):
    data = run_demo(mode=mode, date=date)

    # ... your coordinate/link injection ...

    # Ensure forecast exists (either a single series or map by cauldron)
    if "forecast" not in data:
        # minimal safe fallback so the UI draws
        data["forecast"] = {
            "overflow_eta": None,
            "series": [
                # [iso_ts, volume] points
            ]
        }

    return data



app.include_router(tool_router)
app.include_router(state_router)
app.include_router(demo_router)
app.include_router(planner_router)
