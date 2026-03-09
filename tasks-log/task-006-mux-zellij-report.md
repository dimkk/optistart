# Task Report: mux-zellij-001

## Feature
- ID: `mux-zellij-001`
- Title: Zellij backend adapter
- Final status: `DONE`

## Implemented
- Added explicit zellij adapter contract helpers:
  - `session_name_for(...)`
  - `build_start_command(...)`
  - `build_stop_command(...)`
  - `render_layout(...)`
- Added subprocess call injection points for deterministic invocation tests.
- Added layout generation e2e verification.

## Changed files
- `optidev/mux/zellij.py`
- `tests/unit/test_zellij_mux.py`
- `tests/integration/test_zellij_invocation.py`
- `tests/e2e/test_cli_module_entrypoint.py`

## Tests
Command:
```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```
Result: `24 passed, 0 failed`.
