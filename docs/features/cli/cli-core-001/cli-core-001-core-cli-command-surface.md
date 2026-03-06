# cli-core-001: Core CLI command surface

## description
Implement the first working CLI contract for `optid` with commands:
- `optid <project>`
- `optid stop`
- `optid status`
- `optid logs`
- `optid projects`

The command surface must be deterministic and callable from terminal entrypoint.

## current implementation state
- Implemented in `optidev` package with module entrypoint (`python -m optidev`).
- Command surface implemented:
  - start: `optid <project>`
  - service commands: `stop`, `status`, `logs`, `projects`
- Workspace state persisted in `~/.optidev` (or `OPTIDEV_HOME` override).
- Zellij backend wired behind mux abstraction (`optidev/mux/base.py`, `optidev/mux/zellij.py`).
- Test suite added and passing via `python3 -m unittest discover -s tests -p 'test_*.py' -v`.

## implementation plan
1. Completed: package entrypoint and CLI dispatcher.
2. Completed: workspace/session service integration with state persistence.
3. Completed: mux abstraction with zellij backend for MVP.
4. Completed: unit/integration/e2e smoke coverage.
5. Completed: feature moved to `DONE` with report.
