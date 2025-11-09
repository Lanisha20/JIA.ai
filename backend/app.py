"""FastAPI application wiring all routers together."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.db import init_db
from backend.demo import demo_router
from backend.planner.runner import planner_router
from backend.state import state_router
from backend.tools import tool_router

#init_db()

app = FastAPI(title="JIA.ai Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthcheck() -> dict:
    return {"ok": True}


app.include_router(tool_router)
app.include_router(state_router)
app.include_router(demo_router)
app.include_router(planner_router)
