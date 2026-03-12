# Task 4 Init: Telegram Plugin Consolidation, Runner Cleanup, and Report Path Migration

## Source
- Human follow-up after `v1-2` memory graph delivery.

## Goal
Clean up OptiDev runtime seams so Telegram lives only in the plugin layer, runner selection owns real command/bootstrap behavior, report artifacts move from `tasks/` to `tasks-log/`, and end-to-end coverage materially expands for runtime and Telegram flows.

## Scope for this task definition phase
- Define the architecture for plugin-local Telegram transport and chat-bridge integration.
- Define runner-layer cleanup so `runners/` owns meaningful runtime behavior instead of placeholder methods.
- Define the repository path migration from `tasks/` to `tasks-log/`.
- Define expanded e2e scope, with Telegram as the main target.
- Prepare atomic feature sequencing for the current release `v1-2`.

## Constraints
- Follow strict process from `AGENTS.md`.
- Use sequence: `task -> architecture -> features -> tests -> implementation`.
- Do not create a new release; append this work to `v1-2`.
- Treat Telegram as a plugin concern, not a separate core messenger subsystem.
- Preserve existing user-visible CLI behavior where possible while improving architecture and tests.

## Expected outputs
1. `docs/tasks/task4-init-arc.md`
2. `docs/tasks/task4-init-features.md`
3. `docs/tasks/task4-init-features-tests.md`
4. Approval context satisfied by the user's explicit continue/go instruction for this cycle.
5. Only after docs are in place: transition to atomic feature implementation.
