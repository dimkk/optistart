# plugins-core-001: Minimal plugin lifecycle

## description
Implement minimal plugin runtime:
- plugin discovery and loading
- lifecycle callbacks on workspace start/message/stop
- deterministic callback ordering

## current implementation state
- Plugin manager implemented (`optidev/plugin_manager.py`).
- Dynamic plugin loading from plugin directory implemented.
- Lifecycle callbacks integrated in app flow:
  - `on_workspace_start`
  - `on_agent_message`
  - `on_workspace_stop`
- Deterministic plugin ordering based on filename sorting.
- Unit/integration/e2e coverage added.

## implementation plan
1. Completed: plugin API contract and manager.
2. Completed: dynamic plugin loading from plugin directory.
3. Completed: lifecycle callbacks for start/message/stop.
4. Completed: app integration with plugin manager.
5. Completed: unit/integration/e2e tests.
