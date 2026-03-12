# Task Report: status-obsv-001

## Feature
- ID: `status-obsv-001`
- Title: Status and logs observability
- Final status: `DONE`

## Implemented
- Extended `optid status` with runtime metadata:
  - runner name
  - hooks running summary
- Implemented `optid logs` lookup from active session hook metadata.
- Added supporting helper logic in app layer.

## Tests
- Unit: status formatting assertions
- Integration: log source lookup from hook metadata
- E2E: runtime smoke for `status` and `logs`

Command:
```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```
Result: `42 passed, 0 failed`.
