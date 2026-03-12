# graph-release-001: Release-feature memory linking

## description
Link features to releases so runtime and CLI can reason about scope by release.

## current implementation state
- Implemented through the native TS/Bun memory ingestion and relation model in `ui/apps/server/src/optidevMemory.ts`.
- Release links are derived from `docs/v*/features-matrix.md`.
- `optid memory show release <id>` resolves included features.

## implementation plan
1. Completed: release entity persistence.
2. Completed: feature-release relation writes from matrices.
3. Completed: CLI and e2e coverage for release lookup.
