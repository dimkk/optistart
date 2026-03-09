# memory-sql-001: SQLite memory persistence

## description
Add SQLite-backed memory store at `~/.optidev/memory.sqlite` with schema:
- `sessions`
- `messages`
- `tasks`
- `decisions`

Integrate store into workspace/app lifecycle for persisted history.

## current implementation state
- Added `MemoryStore` in `optidev/memory.py` with `memory.sqlite` schema initialization.
- Implemented CRUD APIs for `sessions/messages/tasks/decisions`.
- Wired workspace lifecycle to record session state transitions into SQLite.
- Wired app startup to record system message events.
- Added resume-history e2e validation using persisted SQLite records.

## implementation plan
1. Completed: `MemoryStore` with schema initialization.
2. Completed: CRUD methods for sessions/messages/tasks/decisions.
3. Completed: workspace lifecycle persistence hooks.
4. Completed: startup message persistence.
5. Completed: unit/integration/e2e coverage for DB creation and persistence.
