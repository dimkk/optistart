# Task 4 Feature Test Plan: Runtime Cleanup and Coverage Expansion

## `plugins-tele-002`
- Unit:
  - plugin Telegram config/state helpers
  - plugin-owned Telegram bridge client send/update behavior
- Integration:
  - chat bridge uses plugin helpers without `messenger/`
- E2E:
  - `optid telegram start/status/stop`
  - chat bridge mirrors runner traffic through fake Telegram API

## `runner-api-002`
- Unit:
  - runner spec selection
  - default command generation per runner
- Integration:
  - app bootstrap persists runner metadata from runner spec layer
- E2E:
  - runtime still starts and runner bootstrap artifact stays correct

## `repo-paths-001`
- Unit:
  - ingestion reads `tasks-log/` reports
- Integration:
  - memory graph rebuild continues to ingest decisions/open loops after migration
- E2E:
  - runtime + memory CLI work with `tasks-log/` only

## `qa-e2e-001`
- Unit:
  - none beyond supporting helpers
- Integration:
  - e2e fixtures/fake Telegram API helpers
- E2E:
  - expanded runtime/Telegram path coverage becomes mandatory acceptance evidence
