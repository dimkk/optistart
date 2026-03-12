# Task 4 Architecture Proposal: Plugin-local Telegram Transport, Runner Specs, and Report Path Migration

## 1. Objective
Refactor three weak seams in the current OptiDev implementation:
- Telegram transport is split between `plugins/` and `messenger/`.
- `runners/` exists but owns almost no runtime logic.
- implementation reports still live under `tasks/`, which should become `tasks-log/`.

At the same time, increase e2e coverage, especially for Telegram flows.

## 2. Architectural direction
This task stays inside release `v1-2` and is a cleanup/reliability pass over the current runtime.

The target state is:
- plugin-owned Telegram runtime helpers
- runner-owned command resolution and bootstrap metadata
- repository-wide `tasks-log/` path for implementation reports
- broader runtime e2e coverage as a first-class acceptance condition

## 3. Telegram architecture
Telegram should exist only under `optidev/plugins/telegram.py`.

Why:
- Telegram is not a generic core subsystem yet.
- The user explicitly wants messenger behavior delivered as plugin architecture.
- Having both `plugins/telegram.py` and `messenger/telegram.py` duplicates responsibility and weakens the plugin contract.

Target design:
- `optidev/plugins/telegram.py` owns:
  - command handling (`start/stop/status`)
  - config persistence
  - event logging
  - Telegram HTTP client helpers used by the chat bridge
  - active-project gating
- `optidev/chat_bridge.py` depends directly on Telegram plugin helpers.
- `optidev/messenger/` is removed.

This keeps replacement straightforward: a future Slack/Discord/etc plugin can expose its own bridge helpers without pretending there is already a generic messenger abstraction.

## 4. Runner architecture
`optidev/runners/` must own real runner behavior.

Current problem:
- `run/resume/stop` placeholder strings are not part of actual runtime execution.
- actual chat runner command selection is hardcoded in `chat_bridge.py`.

Target design:
- `runners/` defines runner specs, not fake runtime adapters.
- each runner module provides:
  - runner name
  - default chat command for a project directory
  - bootstrap metadata needed by runtime/session artifacts
- `RunnerManager` persists bootstrap metadata.
- `chat_bridge.py` resolves the default command through `runners/`, not local `if runner == ...` logic.

This makes the runner package meaningful and keeps runner behavior in one place.

## 5. Report path migration
Implementation reports move from `tasks/` to `tasks-log/`.

Target rules:
- new reports are written only to `tasks-log/`
- ingestion reads `tasks-log/task-*-report.md`
- AGENTS, README, docs, and tests reference `tasks-log/`
- existing repository report files are migrated to the new directory

This path should be treated as part of repository contract, not just a cosmetic rename.

## 6. E2E strategy
E2E is part of the architecture gate for this cleanup because the weak seams are integration-heavy.

Required e2e outcomes:
- Telegram start/status/stop with saved config
- chat bridge can use plugin-local Telegram helpers end-to-end against a fake Telegram API
- runner bootstrap still works after runner-spec refactor
- memory/report ingestion still works after `tasks-log/` migration

## 7. Acceptance criteria
- No runtime Telegram code remains under `optidev/messenger/`
- `chat_bridge.py` uses plugin-owned Telegram helpers only
- `runners/` owns default runner command resolution
- `tasks/` report references are migrated to `tasks-log/`
- e2e coverage for Telegram and runtime flows is materially expanded
