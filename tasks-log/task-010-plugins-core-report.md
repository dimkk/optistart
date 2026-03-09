# Task Report: plugins-core-001

## Feature
- ID: `plugins-core-001`
- Title: Minimal plugin lifecycle
- Final status: `DONE`

## Implemented
- Added plugin API contract and plugin manager.
- Added dynamic plugin loading from plugin directory (`OPTIDEV_PLUGIN_DIR` supported).
- Added lifecycle callbacks integration in app start/message/stop flow.
- Added deterministic callback ordering by plugin filename.

## Tests
- Unit: plugin loading validation
- Integration: callback ordering
- E2E: sample plugin event capture on start/stop

Command:
```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```
Result: `39 passed, 0 failed`.
