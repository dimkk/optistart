# graph-sqlite-001: SQLite graph store implementation

## description
Implement the memory graph MVP on SQLite without leaking SQLite-specific logic into runtime or CLI.

## current implementation state
- Implemented in the native TS/Bun memory persistence under `ui/apps/server/src/optidevMemory.ts`.
- Uses `~/.optidev/memory.sqlite` and initializes graph tables on demand.
- Persists relations for task-feature, feature-release, decisions, open loops, sessions, and agents.

## implementation plan
1. Completed: schema initialization.
2. Completed: CRUD helpers for graph entities and relations.
3. Completed: unit and e2e coverage for persistence across runtime commands.
