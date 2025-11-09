# backend/app.py
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.logic.demo import run_demo
# backend/app.py
from .logic.demo import run_demo


app = FastAPI()

# CORS (dev-friendly)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/overview")
def api_overview(mode: str = Query("live"), date: str | None = None):
    """
    mode=live      -> run pipeline on latest data
    mode=playback  -> run pipeline but lock to `date` (YYYY-MM-DD) if provided
    """
    return run_demo(mode=mode, date=date)
