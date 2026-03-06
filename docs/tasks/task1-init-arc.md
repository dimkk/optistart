# Task 1 Architecture Proposal: OptiDev MVP

## 1. Objective
Deliver a terminal-first local orchestrator (`optid`) that restores project development context with agents, workspace layout, and automation hooks.

## 2. Architectural style
- Single-process CLI entrypoint for MVP.
- Modular internal services for discovery, config, workspace state, and runner abstraction.
- File-system + SQLite persistence.
- Integration boundary for external tools (Zellij, project commands, agent runners).

## 3. Proposed module map
- `optidev/cli.py`:
  - Command parsing and UX (`optid <project>`, `stop`, `status`, `logs`, `projects`).
- `optidev/config.py`:
  - Global config loading (`~/.optidev/config.yaml`).
  - Per-project config loading (`.project/config.yaml`).
- `optidev/discovery.py`:
  - Project discovery from configured paths and fallback folders.
- `optidev/workspace.py`:
  - Session bootstrap/restore logic.
  - Workspace lifecycle orchestration via terminal multiplexer abstraction.
- `optidev/mux/base.py`:
  - Terminal multiplexer contract (`start`, `stop`, `attach`, `status`, `render_layout`).
- `optidev/mux/zellij.py`:
  - Zellij adapter (default MVP backend).
- `optidev/memory.py`:
  - SQLite session/message/task/decision persistence.
- `optidev/runners/`:
  - Abstract runner interface.
  - Concrete adapters: `codex`, `claude` (OpenCode later).
- `optidev/hooks.py`:
  - Dev/test/log command execution from config.
- `optidev/plugins/`:
  - Minimal plugin lifecycle hooks for workspace start/message/stop.

## 4. Runtime flow (MVP)
1. CLI receives `optid <project>`.
2. Discovery resolves project path.
3. Config loader builds effective config (global + project).
4. Workspace service restores prior session state if exists.
5. Hooks start dev/test/log commands.
6. Mux manager uses `zellij` backend through abstract mux interface.
7. Selected backend renders layout and starts terminal session.
8. Runner manager starts configured agents.
9. Memory service resumes persisted context.

## 5. Data and state
- Global state directory: `~/.optidev/`.
- Database: `~/.optidev/memory.sqlite`.
- Session artifacts: `~/.optidev/sessions/<project>/`.
- Generated layout file per session.

## 6. Non-goals for MVP
- Multi-host/distributed orchestration.
- Vector memory and semantic retrieval.
- Web dashboard and metrics.
- Advanced autonomous swarm management.

## 7. Risks and mitigations
- External process orchestration complexity:
  - Mitigation: isolate subprocess operations and add deterministic integration tests.
- Cross-platform shell command behavior:
  - Mitigation: explicit command wrappers and path normalization.
- Runner API differences:
  - Mitigation: strict adapter contract with feature flags per runner.
- Future backend differences (layout syntax, pane behavior):
  - Mitigation: keep mux interface stable and isolate backend-specific renderers.

## 8. Acceptance criteria for architecture phase
- Module boundaries clear and minimal.
- Runtime lifecycle defined end-to-end.
- Data storage locations and contracts defined.
- Atomic feature planning can proceed without architectural ambiguity.
