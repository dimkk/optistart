# Task Report: runner-api-001

## Feature
- ID: `runner-api-001`
- Title: Agent runner abstraction
- Final status: `DONE`

## Implemented
- Added runner abstraction package:
  - `optidev/runners/base.py`
  - `optidev/runners/codex.py`
  - `optidev/runners/claude.py`
  - `optidev/runners/factory.py`
  - `optidev/runners/manager.py`
- Added config-driven runner selection (`default_runner` with `codex|claude`).
- Wired startup flow to bootstrap runner and persist `runner.json` in session dir.

## Tests
- Unit: runner contract and factory selection
- Integration: runner selection from global config
- E2E: runner bootstrap smoke on CLI start

Command:
```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```
Result: `29 passed, 0 failed`.
