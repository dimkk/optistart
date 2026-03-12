# Task 3 Init: Agent Memory Graph

## Source
- Human specification: `docs/task3-human.md`

## Goal
Add a structured Agent Memory Graph to OptiDev so the system restores project thinking, not just chat/session history.

## Scope for this task definition phase
- Define the architecture for structured project memory on top of the current runtime.
- Define the MVP graph entities, relations, and storage abstraction.
- Define startup digest and lookup UX for memory-aware restore.
- Define atomic features and test strategy for release `v1-2`.
- Prepare the implementation sequence required before coding starts.

## Constraints
- Follow strict process from `AGENTS.md`.
- Use sequence: `task -> architecture -> features -> tests -> implementation`.
- Do not start atomic implementation before architecture/features are reviewed and approved.
- Treat this as release `v1-2`.
- Keep the storage layer replaceable: SQLite today, different graph backend later.

## Expected outputs
1. `docs/tasks/task3-init-arc.md`
2. `docs/tasks/task3-init-features.md`
3. `docs/tasks/task3-init-features-tests.md`
4. Human approval for architecture and feature breakdown.
5. Only after approval: transition to atomic feature lifecycle.
