# JIA.ai
HackUTD project

## Backend setup

1. `cd backend && python -m venv .venv && source .venv/bin/activate`
2. `pip install -r requirements.txt`
3. `uvicorn backend.app:app --host 0.0.0.0 --port 8000`

The API persists state in `backend/data/app.db` (SQLite). To reset, delete that file and rerun `python -m backend.core.seed` to pull fresh data from the EOG API.
