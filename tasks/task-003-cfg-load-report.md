# Task Report: cfg-load-001

## Feature
- ID: `cfg-load-001`
- Title: Config loading and validation
- Final status: `DONE`

## Implemented
- Added `optidev/config.py` with:
  - global config schema/defaults/validation
  - project config schema/defaults/validation
  - effective config merge
  - parse fallback (`yaml.safe_load`, then JSON)
- Wired `OptiDevApp` to load global config and validate project config before startup.
- Added CLI error handling for config failures with explicit message.

## Tests
- Unit: `tests/unit/test_config.py`
- Integration: `tests/integration/test_config_merge.py`
- E2E: `test_invalid_global_config_fails_start`

Command:
```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```
Result: `12 passed, 0 failed`.
