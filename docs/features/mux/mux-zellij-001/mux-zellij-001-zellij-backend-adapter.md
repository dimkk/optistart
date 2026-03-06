# mux-zellij-001: Zellij backend adapter

## description
Implement concrete zellij backend for mux abstraction:
- generate `layout.kdl`
- produce deterministic zellij start/stop commands
- start/stop zellij sessions using subprocess contract

## current implementation state
- Zellij adapter now exposes explicit contract helpers:
  - `render_layout(...)`
  - `build_start_command(...)`
  - `build_stop_command(...)`
  - `session_name_for(...)`
- Subprocess invocation is now testable via injected callables.
- Layout generation and invocation contract covered by dedicated unit/integration/e2e tests.

## implementation plan
1. Completed: explicit layout render helper.
2. Completed: deterministic command builders for start/stop.
3. Completed: unit tests for command/layout/session name.
4. Completed: integration test for subprocess invocation contract.
5. Completed: e2e assertion on generated `layout.kdl`.
