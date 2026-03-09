# Task 1 Init: OptiDev MVP Kickoff

## Source
- Human specification: `docs/task1-human.md`

## Goal
Build the first working MVP slice of `optid` as a local orchestrator for AI coding workspaces.

## Scope for initialization phase
- Convert human spec into an actionable architecture document.
- Define an ordered atomic feature backlog for MVP.
- Define test strategy mapped to each atomic feature.
- Prepare artifacts needed before implementation starts.
- Introduce a terminal multiplexer abstraction with `zellij` implementation in MVP and future backend extensibility.

## Constraints
- Follow strict process from `AGENTS.md`.
- Use sequence: `task -> architecture -> features -> tests -> implementation`.
- Do not start atomic implementation before architecture/features are reviewed.

## Expected outputs
1. `docs/tasks/task1-init-arc.md`
2. `docs/tasks/task1-init-features.md`
3. `docs/tasks/task1-init-features-tests.md`
4. Approved transition to atomic feature lifecycle.
