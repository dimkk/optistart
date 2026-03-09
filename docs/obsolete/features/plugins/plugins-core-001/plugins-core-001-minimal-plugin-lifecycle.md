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
- Startup augmentation hook integrated:
  - `prepare_workspace_start`
- Command plugins routed from CLI through `run_command(...)`.
- Deterministic plugin ordering based on filename sorting.
- Unit/integration/e2e coverage added.
- Current extension points:
  - plugin-owned transport/runtime helpers used by chat bridge
  - catalog/source provider used by skills and agents plugins
  - startup prompt injection used by the advice plugin
  - plugin-owned `layout_spec` used by the workspace bootstrap plugin
  - startup artifact generation used to expose memory, skills, agents, and command files to the runner

## implementation plan
1. Completed: plugin API contract and manager.
2. Completed: dynamic plugin loading from plugin directory.
3. Completed: lifecycle callbacks for start/message/stop.
4. Completed: command plugin routing from CLI.
5. Completed: startup preparation hook for plugins that need to influence runner bootstrap.
6. Completed: app integration with plugin manager.
7. Completed: unit/integration/e2e tests.
