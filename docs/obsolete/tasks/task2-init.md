# Task 2 Init: Workspace Manifest Runtime

## Source
- Human specification: `docs/task2-human.md`

## Goal
Reframe OptiDev around a manifest-first runtime where a workspace is a reproducible object described by `.optidev/workspace.yaml`.

## Scope for this task definition phase
- Define the manifest-first architecture for OptiDev runtime.
- Describe bootstrap vs restore behavior around workspace state.
- Define atomic features needed to introduce workspace manifests without losing current functionality.
- Define a test strategy for manifest loading, runtime restore, branching, and workspace lifecycle.
- Prepare the implementation sequence required before coding starts.

## Constraints
- Follow strict process from `AGENTS.md`.
- Use sequence: `task -> architecture -> features -> tests -> implementation`.
- Do not start atomic implementation before architecture/features are reviewed and approved.
- Treat plugins as extensions around the runtime, not as the primary model for this task.
- Treat this as release `v1-1`.

## Expected outputs
1. `docs/tasks/task2-init-arc.md`
2. `docs/tasks/task2-init-features.md`
3. `docs/tasks/task2-init-features-tests.md`
4. Human approval for architecture and feature breakdown.
5. Only after approval: transition to atomic feature lifecycle.
