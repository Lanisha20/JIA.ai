"""Database utilities for the FastAPI backend."""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker


def _default_sqlite_path() -> str:
    data_dir = Path("backend/data")
    data_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{data_dir / 'app.db'}"


DATABASE_URL = os.getenv("DATABASE_URL", _default_sqlite_path())

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Provide a transactional scope for DB work."""

    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session."""

    with session_scope() as session:
        yield session


def init_db() -> None:
    """Create database tables if they do not yet exist."""

    from . import models  # noqa: F401 - ensure model metadata is registered

    Base.metadata.create_all(bind=engine)
