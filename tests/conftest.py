import os
import tempfile
from pathlib import Path

import pytest

os.environ.setdefault("AUTOPILOT_DB_PATH", ":memory:")

from backend.db import get_db, init_db


@pytest.fixture()
def db():
    """Provide a fresh in-memory database for each test."""
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "test.db"
        os.environ["AUTOPILOT_DB_PATH"] = str(db_path)
        init_db()
        conn = get_db()
        try:
            yield conn
        finally:
            conn.close()
