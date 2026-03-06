# status-obsv-001: Status and logs observability

## description
Improve runtime observability for:
- `optid status`
- `optid logs`

Status should reflect active runtime metadata. Logs should resolve configured log sources from current session context.

## current implementation state
- `status` output now includes runtime observability metadata:
  - project/session/mux
  - runner name
  - hooks running summary
- `logs` now resolves sources from persisted hook metadata (`hooks.json`) for active session.
- Integration and e2e runtime checks validate status/logs behavior end-to-end.

## implementation plan
1. Completed: status formatting extended with runner/hooks metadata.
2. Completed: log source lookup from persisted hook metadata.
3. Completed: integration test for log source resolution.
4. Completed: e2e status/logs runtime smoke test.
5. Completed: full test pass and feature closure.
