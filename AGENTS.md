
# AGENTS

This repository uses **agent‑driven development** and is designed to work with AI coding agents
(Codex, Claude Code, OpenCode) inside the **OptiDev workspace orchestrator**.

The workflow enforces strict rules for:
- task planning
- atomic feature implementation
- documentation
- testing
- release packaging
- git promotion

---

# Project Context

Repository root file policy:

- Allowed markdown files in root: `AGENTS.md`, `README.md`.
- Executable/utility scripts must be stored only in:

```
./scripts/
```

Agent configuration paths:

```
.agents/
  agents/
  skills/
  mcp/
```

Example absolute path:

```
opticlaw/.agents/
```

Contents:

```
.agents/
  agents/      -> agent definitions
  skills/      -> reusable capability guides
  mcp/         -> MCP tool configs
```

---

# Work Flow

## Initial Task Creation

First meaningful task:

```
./docs/tasks/task1-init.md
```

Architecture proposal:

```
./docs/tasks/task1-init-arc.md
```

Feature breakdown:

```
./docs/tasks/task1-init-features.md
```

Feature test plan:

```
./docs/tasks/task1-init-features-tests.md
```

Workflow:

```
task -> architecture -> features -> tests -> implementation
```

Strict execution order:

1. Create/refresh `task` document.
2. Create architecture document.
3. Create feature breakdown document.
4. Create feature tests document.
5. Wait for required human approvals.
6. Only then start atomic feature lifecycle.

Human approval required for:

```
architecture
features
```

Optional approval:

```
tests
```

Hard gate:

- Atomic implementation work is **not allowed** before steps `architecture -> features -> tests` are documented.
- If architecture/features are not approved, agent must stop after documentation and request approval.

---

# Atomic Feature Flow (Mandatory)

Execution source of truth:

```
./docs/<release>/features-matrix.md
./docs/<release>/test-matrix.md
```

Example for current release:

```
./docs/v1-0/features-matrix.md
./docs/v1-0/test-matrix.md
```

These files define:

- atomic features
- status
- test mapping

Agents must implement **one atomic feature lifecycle at a time** unless parallel execution is explicitly requested.

---

# Atomic Feature Lifecycle

1. Pick atomic feature ID from:

```
docs/<release>/features-matrix.md
```

2. Set feature status:

```
DESCRIBING
```

3. Create feature documentation:

```
docs/features/<component-id>/<feature-id>/
```

Example:

```
docs/features/orc/orc-run-014/orc-run-014-agent-runner.md
```

Mandatory sections:

- description
- current implementation state
- implementation plan

4. Update tests matrix:

```
docs/<release>/test-matrix.md
```

5. Change status:

```
DEVELOPING
```

6. Implement feature.

7. Add/update tests:

```
unit
integration
e2e
```

8. Run tests until all pass.

9. Change status:

```
DONE
```

10. Write implementation report.

11. Save report:

```
tasks/task-xxx-<topic>-report.md
```

Example:

```
tasks/task-512-agent-runner-report.md
```

---

# Feature Documentation Rules

Strict path:

```
docs/features/<component-id>/<feature-id>/
```

Component ID = prefix before first `-`.

Examples:

```
st-can-001 -> component st
orc-run-014 -> component orc
```

Never place feature documentation directly under `docs/`.

---

# Release Workflow

Features are grouped into **releases**.

Release documentation:

```
docs/releases/
```

Example:

```
docs/releases/v1-0.md
```

Release document must contain:

- release scope
- included features
- migration notes
- deployment notes

Release matrix files (mandatory, same release folder):

```
docs/<release>/features-matrix.md
docs/<release>/test-matrix.md
```

Version handling rule (mandatory):

- If user does not explicitly provide release version, agent must auto-bump release.
- Auto-bump strategy: detect latest `v<major>-<minor>` folder in `docs/`, increment `<minor>` by `+1`.
- Example: if latest is `v1-0`, next inferred release is `v1-1`.
- Agent must create missing matrix files for inferred release automatically.

---

# Release Process

When release features are DONE:

1. Merge to `dev`

2. Promote

```
dev -> test
```

3. Deploy staging and verify.

4. Promote

```
test -> prod
```

5. Create git tag

```
git tag v1.0
git push origin v1.0
```

Release tag must correspond to release documentation.

---

# Tasks

After finishing task add report:

```
tasks/task-xxx-<topic>-report.md
```

Example:

```
task-512-ops-auth-guard-report.md
```

Reports must contain:

- implemented behavior
- tests added
- problems encountered
- resolutions

No placeholder content allowed.

---

# Architecture Rules

Constraints:

```
Max 70 lines per code file
Max 7 files per folder
```

Documentation files are exempt.

Programming rules:

```
no classes
prefer pure functions
side effects isolated
no global mutable state
```

Architecture rules:

```
transport layer contains no business logic
secrets stored in .env
application options stored in DB
```

---

# Skills Alignment

Skills location:

```
.agents/skills/
```

Examples:

```
.agents/skills/backend.md
.agents/skills/orchestrator.md
.agents/skills/testing.md
```

Rules:

- if component skill exists → implementation must follow it
- if no skill exists → create one first

Task reports must reference the used skill.

---

# Agent Definitions

Agent definitions live in:

```
.agents/agents/
```

Examples:

```
planner.md
coder.md
tester.md
reviewer.md
```

Each agent defines:

- role
- responsibilities
- skills
- execution constraints

Example:

```
Agent: coder

Role:
implement code changes

Skills:
backend
refactoring
testing
```

---

# MCP Integration

MCP configuration:

```
.agents/mcp/
```

Examples:

```
filesystem-tools.yaml
repo-index.yaml
test-runner.yaml
```

MCP tools provide:

- repo navigation
- test execution
- filesystem access
- build orchestration

Agents should prefer MCP tools over direct shell commands when possible.

---

# OptiDev Integration

Repository designed to run inside **OptiDev workspace**.

Startup command:

```
optid <project>
```

OptiDev restores:

- agent workspace
- conversation history
- development environment
- test runners
- logs

Default workspace layout:

```
planner
coder
tests
logs
```

Agents should assume repository is executed inside an OptiDev workspace.

---

# Parallel Agent Mode

Parallel execution allowed only when explicitly requested.

Rules:

- agents must own component scope
- no shared file ownership
- coordinator agent updates shared control files

Shared files (single writer):

```
docs/<release>/features-matrix.md
docs/<release>/test-matrix.md
plan-v3.md
tasks/*
```

Worker agents modify only files within their component scope.

---

# Git Flow

Mandatory branches:

```
dev
test
prod
```

Promotion order:

```
dev -> test -> prod
```

Production releases must correspond to **git tags**.

---

# Test Rules

Tests must not be blocked by missing data.

If required create:

```
fixtures
seeds
mocks
```

inside the test scope.

Never keep feature IN_PROGRESS due to missing inputs.

---

# Architecture Source of Truth

Architecture documentation:

```
docs/*arc*.md
```

Deprecated architecture files:

```
docs/*arc*.deprecated.md
```

AGENTS.md must not duplicate architecture rules.
Update architecture docs instead.

---

# Principle

This repository follows **agent‑native development**.

Primary flow:

```
features -> tests -> releases
```

Traceability must exist between:

```
task
feature
test
release
git tag
```
