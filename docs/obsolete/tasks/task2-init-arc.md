# Task 2 Architecture Proposal: Workspace Manifest Runtime

## 1. Objective
Turn OptiDev from a project launcher into a workspace runtime where the primary object is a reproducible workspace manifest.

The central artifact becomes:

- `.optidev/workspace.yaml`

This file describes the desired development state for a repository:
- project identity
- active task
- git branch
- last known HEAD commit
- agent set
- layout intent
- services
- tests
- logs
- context roots
- workspace branch metadata

## 2. Core architectural shift
Current OptiDev behavior is centered on:
- project discovery
- runtime start
- plugin-provided startup augmentation

Task 2 changes the center of gravity to:
- manifest loading
- manifest validation
- manifest-driven runtime reconciliation
- session restore from manifest + session state

New primary flow:
1. Resolve project path.
2. Load `.optidev/workspace.yaml`.
3. Load `.optidev/session.json` if present.
4. Decide `bootstrap` vs `restore`.
5. Materialize runtime from manifest.
6. Run plugin hooks only after manifest/runtime model exists.

## 3. Primary runtime model
Runtime is split into five cooperating parts:

- `workspace loader`
  - loads and validates manifest
- `session store`
  - persists live session state separate from desired manifest state
- `runtime reconciler`
  - compares manifest + session and determines what to start/restore
- `agent manager`
  - starts or resumes agents declared by manifest
- `environment manager`
  - starts services, tests, logs, and layout from manifest

Plugins remain extension points, but they do not define the base workspace model.

## 4. Manifest model
Proposed manifest location:

- `<project>/.optidev/workspace.yaml`

Proposed top-level sections:

- `project`
- `workspace`
- `agents`
- `layout`
- `services`
- `tests`
- `logs`
- `context`

Example conceptual schema:

```yaml
project: opticlaw

workspace:
  active_task: orc-run-014
  branch: main
  head_commit: abcdef123456
  mux: zellij

agents:
  - name: planner
    runner: codex
  - name: coder
    runner: codex
  - name: tester
    runner: codex

layout:
  tabs:
    - name: Chat
      pane: chat
    - name: Editor
      pane: editor
    - name: Tests
      pane: tests
    - name: Logs
      pane: logs

services:
  - name: app
    command: docker compose up
  - name: web
    command: npm run dev

tests:
  command: pytest -f

logs:
  command: docker logs app

context:
  agents_dir: .agents/agents
  skills_dir: .agents/skills
  mcp_dir: .agents/mcp
```

Rules:
- manifest describes desired steady state
- session file describes last known live state
- manifest must be portable and reproducible
- session file may be ephemeral and local

## 5. Session model
Proposed session file:

- `<project>/.optidev/session.json`

Purpose:
- track currently restored task
- running agent set
- runtime session names
- timestamps
- runtime-generated artifacts

The session file is not the source of truth for desired workspace structure.
That remains the manifest.

Git tracking rule:
- manifest stores the current working branch and last known HEAD commit
- git branch history belongs in session history or memory, not in the manifest itself

## 6. Bootstrap vs restore
### Bootstrap
Used when:
- manifest exists but no session exists
- manifest changed materially since last session
- user requested reset/bootstrap

Bootstrap responsibilities:
- scan repository
- detect stack
- inspect context directories
- suggest or update workspace defaults
- generate or update runtime artifacts
- start services/layout/agents from clean desired state

### Restore
Used when:
- manifest exists
- compatible session exists
- runtime can be resumed safely

Restore responsibilities:
- load previous live state
- restore agent processes/session references
- restore layout/session attachment
- restore active task and memory pointers

## 7. Manifest-driven layout
Layout generation should move from “default UI layout” to “manifest intent -> mux layout”.

The mux layer still renders backend-specific syntax, but the manifest owns:
- pane set
- pane roles
- logical ordering
- tab naming

This preserves the mux abstraction while moving control to manifest data.

## 8. Agent manager implications
Task 2 requires a real distinction between:
- installed agent definitions in `.agents/agents/`
- active agents declared by manifest
- runner used for each active agent

Agent manager responsibilities:
- validate declared agents exist
- resolve agent definition -> runner command
- start/resume/stop/reset active agents
- persist active agent runtime state into session file

## 9. Context engine
Context becomes a first-class runtime subsystem fed by:
- manifest context paths
- repo scan
- skill inventory
- agent inventory
- MCP/tool registry inventory
- memory snapshot

Output:
- deterministic startup context artifact(s) for the runner
- explicit trace of what inputs were used during bootstrap

This addresses the current concern that memory/skills/agents may exist but not be reliably consumed.

## 10. Workspace branching
Task 2 introduces workspace branching as a runtime concept.

Target behavior:
- `optid workspace clone <name>`
- create a branch workspace under `.optidev/workspaces/<name>/`
- clone or derive manifest from current workspace
- keep task-specific state isolated

The branching model should be manifest-first:
- branch workspace gets its own manifest
- branch workspace may get its own session
- current workspace remains intact

## 11. Compatibility and migration
Task 2 must not break current repositories.

Migration path:
1. If `.optidev/workspace.yaml` exists, use manifest-first flow.
2. If it does not exist, bootstrap can derive an initial manifest from current project config and runtime defaults.
3. Existing `.project/config.yaml` remains a source for inferred defaults during migration.
4. Existing plugin features continue to work after manifest/runtime has been resolved.

## 12. Non-goals for Task 2
- distributed multi-machine agent orchestration
- remote manifest registry/distribution
- collaborative live shared workspaces
- advanced semantic/vector memory
- provider marketplace for agents/skills/plugins

## 13. Acceptance criteria for architecture phase
- manifest is clearly defined as the primary workspace model
- bootstrap vs restore behavior is explicit
- manifest/session separation is explicit
- runtime subsystems and responsibilities are clear
- migration from current OptiDev state is defined
- atomic feature planning can proceed without architectural ambiguity
