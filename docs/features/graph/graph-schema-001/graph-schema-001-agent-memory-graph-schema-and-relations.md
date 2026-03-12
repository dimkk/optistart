# graph-schema-001: Agent memory graph schema and relations

## description
Define the structured development-memory entities and relations used by OptiDev runtime.

## current implementation state
- Implemented through the native TS/Bun memory model in `ui/apps/server/src/optidevMemory.ts`.
- MVP entities include tasks, features, releases, decisions, open loops, sessions, and agents.
- Relations currently include task-feature, feature-release, feature-decision, and session-agent.

## implementation plan
1. Completed: explicit graph entity model.
2. Completed: relation persistence in SQLite.
3. Completed: integration tests for task/feature/release linking and runtime session ingestion.
