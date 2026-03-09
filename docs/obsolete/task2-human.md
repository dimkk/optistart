Ключевая идея — Workspace Manifest.

1. Главная проблема всех agent tools

Большинство систем делают:

agent → task → result

или

agent → repo

Но не моделируют workspace как объект.

В итоге:

нет restore

нет reproducibility

нет branching

нет orchestration

2. Workspace Manifest

Workspace = описание состояния разработки.

Файл:

.optidev/workspace.yaml

Пример:

project: opticlaw

agents:
  - planner
  - coder
  - tester

active_task: orc-run-014

layout:
  type: zellij
  panes:
    - planner
    - coder
    - tests
    - logs

services:
  - docker compose up
  - npm run dev

tests:
  command: pytest -f

logs:
  command: docker logs app

context:
  agents: .agents/agents/
  skills: .agents/skills/
  mcp: .agents/mcp/

session:
  last_run: 2026-03-05

Это state snapshot.

3. optid runtime

Теперь optid работает так:

optid opticlaw

↓

load workspace.yaml

↓

restore runtime
4. Runtime компоненты
optid
 ├ workspace loader
 ├ agent manager
 ├ environment manager
 ├ session store
 └ plugin manager
5. Workspace Loader
class Workspace:

    def __init__(self, path):
        self.config = load_yaml(path)

    def agents(self):
        return self.config["agents"]

    def services(self):
        return self.config["services"]
6. Runtime Start
workspace = Workspace(".optidev/workspace.yaml")

start_services(workspace.services())
start_agents(workspace.agents())
start_layout(workspace.layout())
7. Zellij Layout Generator

manifest → layout

def generate_layout(workspace):

    panes = workspace.layout()["panes"]

    return f"""
layout {{
    pane split_direction="vertical" {{
        pane command="{panes[0]}"
        pane command="{panes[1]}"
    }}
}}
"""
8. Agent Manager
agents/
  planner
  coder
  tester

manager:

class AgentManager:

    def start(self, agent):
        runner = load_runner(agent)
        runner.start()
9. Session Restore

Session state:

.optidev/session.json

пример:

{
  "active_task": "orc-run-014",
  "agents": ["planner","coder","tester"],
  "branch": "dev"
}

restore:

if session_exists():
    restore_session()
else:
    bootstrap_workspace()
10. Bootstrap vs Restore
Bootstrap
repo scan
skills discovery
agents suggestion
Restore
load session
restore agents
restore workspace
11. Plugin System
plugins/
  telegram
  github
  metrics

интерфейс:

class Plugin:

    def on_workspace_start(self):
        pass

    def on_agent_message(self, msg):
        pass
12. Telegram Plugin

пример:

telegram
  ↓
optid API
  ↓
agents

команды:

/status
/logs
/tests
/stop
13. Context Engine

контекст строится из:

.agents/agents/
.agents/skills/
.agents/mcp/
repo scan
session memory

pipeline:

repo
↓
skills
↓
agents
↓
memory
14. Task Sandbox (очень крутая идея)
optid task feature-x

создаёт:

workspace branch

пример:

.optidev/workspaces/
  main
  feature-x
15. Workspace branching
optid workspace clone feature-x

↓

новый manifest.

16. Agent Lifecycle

команды:

optid start
optid stop
optid resume
optid reset
17. Tool Registry

похоже на MCP:

.agents/mcp/

пример:

git.yaml
tests.yaml
repo.yaml
18. Repo Discovery

при bootstrap:

scan repo
detect stack
suggest skills
suggest agents
19. OptiDev Runtime

итоговая архитектура:

optid
  ↓
workspace manifest
  ↓
runtime
  ↓
agents
  ↓
repo
20. Почему это мощно

Теперь:

workspace = reproducible object

Можно:

restore
branch
clone
share
21. Пример полного UX
optid opticlaw

↓

Restoring workspace...

planner resumed
coder resumed
tests running
logs attached

↓

Continue task orc-run-014?
22. Это делает OptiDev

не просто CLI

а:

agent workspace runtime
23. Что получится

архитектура уровня:

tmux
docker
kubectl

но для:

AI development