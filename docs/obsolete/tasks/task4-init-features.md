# Task 4 Atomic Feature Breakdown: Runtime Cleanup and Coverage Expansion

## Release target
- Release: `v1-2`

## Atomic features

### 1. `plugins-tele-002` — Telegram transport consolidated into plugin layer
- Remove `optidev/messenger/` runtime dependency.
- Move Telegram bridge client/runtime helpers into `optidev/plugins/telegram.py`.
- Keep CLI behavior `optid telegram start|stop|status` unchanged.

### 2. `runner-api-002` — Runner specs and command resolution cleanup
- Replace placeholder runner adapter methods with meaningful runner specs.
- Move default chat command resolution into `optidev/runners/`.
- Keep runtime bootstrap artifact generation in the runner layer.

### 3. `repo-paths-001` — Root report path migration to `tasks-log`
- Rename repository report directory from `tasks/` to `tasks-log/`.
- Update ingestion, docs, tests, and process rules.
- Migrate existing report files.

### 4. `qa-e2e-001` — Expanded end-to-end runtime coverage
- Add materially broader e2e coverage for Telegram and runtime behaviors.
- Cover plugin-local Telegram flow, report-ingestion path migration, and runner-spec runtime behavior.

## Sequencing
1. `plugins-tele-002`
2. `runner-api-002`
3. `repo-paths-001`
4. `qa-e2e-001`

## Approval note
- User requested these follow-up tasks immediately after `v1-2` completion and then explicitly said `go`.
