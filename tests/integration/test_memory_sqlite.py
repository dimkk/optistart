from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from optidev.memory import MemoryStore


class MemorySqliteIntegrationTests(unittest.TestCase):
    def test_sqlite_file_and_schema_created(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = MemoryStore(home)
            self.assertTrue(store.db_path.exists())

            with sqlite3.connect(store.db_path) as conn:
                tables = {
                    row[0]
                    for row in conn.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    ).fetchall()
                }
            self.assertIn("sessions", tables)
            self.assertIn("messages", tables)
            self.assertIn("tasks", tables)
            self.assertIn("decisions", tables)


if __name__ == "__main__":
    unittest.main()
