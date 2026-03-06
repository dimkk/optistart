from __future__ import annotations

import sqlite3
from pathlib import Path


class MemoryStore:
    def __init__(self, home_dir: Path) -> None:
        self.home_dir = home_dir
        self.home_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.home_dir / "memory.sqlite"
        self._init_schema()

    def record_session(
        self,
        *,
        project: str,
        status: str,
        mux_backend: str,
        mux_session_name: str,
        started_at: str,
        stopped_at: str | None,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions(
                    project, status, mux_backend, mux_session_name, started_at, stopped_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (project, status, mux_backend, mux_session_name, started_at, stopped_at),
            )

    def add_message(self, *, project: str, role: str, content: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO messages(project, role, content) VALUES (?, ?, ?)",
                (project, role, content),
            )

    def add_task(self, *, project: str, title: str, status: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO tasks(project, title, status) VALUES (?, ?, ?)",
                (project, title, status),
            )

    def add_decision(self, *, project: str, key: str, value: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO decisions(project, key, value) VALUES (?, ?, ?)",
                (project, key, value),
            )

    def recent_sessions(self, *, project: str, limit: int = 10) -> list[dict[str, str | None]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT project, status, mux_backend, mux_session_name, started_at, stopped_at
                FROM sessions
                WHERE project = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (project, limit),
            ).fetchall()

        return [
            {
                "project": row[0],
                "status": row[1],
                "mux_backend": row[2],
                "mux_session_name": row[3],
                "started_at": row[4],
                "stopped_at": row[5],
            }
            for row in rows
        ]

    def recent_messages(self, *, project: str, limit: int = 20) -> list[dict[str, str]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT role, content, created_at
                FROM messages
                WHERE project = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (project, limit),
            ).fetchall()

        return [{"role": row[0], "content": row[1], "created_at": row[2]} for row in rows]

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project TEXT NOT NULL,
                    status TEXT NOT NULL,
                    mux_backend TEXT NOT NULL,
                    mux_session_name TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    stopped_at TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS decisions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
