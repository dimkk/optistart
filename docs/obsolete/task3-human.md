Да. Agent Memory Graph — это, возможно, самый сильный слой поверх optid.
Он делает так, что система помнит не просто чат, а что делали, зачем, где, в каком контексте и к чему пришли.

Не “history log”, а рабочую память проекта.

1. Проблема обычной истории

Обычная история агента выглядит так:

user -> prompt
agent -> code
agent -> tests
agent -> answer

Проблема:

плохо ищется

не видно связи между задачами

теряются причины решений

агент помнит текст, но не помнит структуру работы

2. Что такое Agent Memory Graph

Это граф объектов проекта:

задачи

фичи

файлы

компоненты

решения

баги

тесты

релизы

агенты

И связи между ними:

task -> feature

feature -> files

feature -> tests

decision -> reason

release -> included_features

agent -> worked_on

3. Пример

Допустим, делали orc-run-014.

Граф может выглядеть так:

Task: task-512
  └─ Feature: orc-run-014
       ├─ Component: orchestrator
       ├─ File: runners/codex.py
       ├─ File: core/workspace.py
       ├─ Test: test_runner_resume.py
       ├─ Decision: use sqlite for session store
       └─ Release: v3.1

Теперь агент может ответить не только “что было”, а:

где меняли код

почему выбрали sqlite

какие тесты покрывают поведение

в какой релиз это вошло

4. Почему это сильно

Потому что следующий запуск:

optid opticlaw

может делать не просто restore сессии, а:

Loaded:
- active task: orc-run-014
- related files: 6
- unresolved issue: test flakiness in logs pane
- last decision: keep runner abstraction stateless
- pending release: v3.1

Это уже не “открыли терминал”.
Это восстановили рабочее мышление проекта.

5. Что хранить в MVP

Для MVP не нужен сложный graph DB.
Достаточно SQLite + таблицы связей - реализовать в виде меняемого модуля - сегодня sqlite, завтра какаянить граф дб (условно).

Минимальные сущности:

projects

tasks

features

files

tests

decisions

releases

agents

sessions

Связи:

task_features

feature_files

feature_tests

feature_decisions

release_features

agent_sessions

6. Самая полезная сущность — Decision

Чаще всего теряется именно это:

почему мы сделали так, а не иначе

Поэтому нужна таблица:

decisions
- id
- project_id
- related_feature_id
- title
- decision
- rationale
- alternatives
- created_at

Пример:

title: Session storage
decision: Use SQLite
rationale: simple local persistence, fast restore, no extra infra
alternatives: JSON files, LiteFS, vector DB

Это золото для следующих агентов.

7. Ещё полезнее — unresolved items

Таблица:

open_loops
- id
- feature_id
- description
- status

Примеры:

flaky integration test

logs pane restart policy not finalized

Telegram plugin auth flow postponed

На старте workspace агент видит не только done, но и незакрытые хвосты.

8. Как это пополняется

Не нужно сразу делать магию.
Достаточно 3 источников:

из tasks/*.md

из docs/features/**

из финальных отчётов агента

То есть агент после завершения atomic feature пишет не только report, но и memory entries:

feature completed
files touched
tests added
decisions made
open issues
release target
9. Как это использовать в runtime

При optid <project>:

грузим session

грузим graph summary

строим короткий context digest

Например для planner:

Current project state:
- Release: v3.1 in progress
- Active feature: orc-run-014
- Last completed: orc-run-013
- Open issues:
  - log streaming instability
  - test watcher restart policy undefined
- Key decisions:
  - SQLite for memory
  - Zellij as default multiplexer

Это уже очень сильный стартовый контекст.

10. Что это даёт твоей архитектуре

Без graph:

workspace runtime

С graph:

workspace runtime + project memory

То есть optid становится не просто оркестратором окон, а операционной памятью команды.

11. Почему это лучше обычного RAG

RAG обычно отвечает на вопрос:

найди релевантный кусок текста

Graph отвечает на вопрос:

что связано с чем и почему это важно сейчас

Для разработки это часто полезнее.

Потому что dev-процесс — это не просто документы, а связи между задачами, файлами, тестами и решениями.

12. MVP-версия без перегруза

Я бы сделал только это:

SQLite

сущности: tasks, features, decisions, releases, sessions

связи: task -> feature, feature -> release, feature -> decision

генерация memory summary при старте

команда:

optid memory
optid memory show feature orc-run-014
optid memory open-loops

Этого уже хватит.

13. Что не делать в MVP

Не надо пока:

vector DB

embeddings

graph database

auto-extraction из всего репо

сложный semantic search

fully autonomous knowledge mining

Это всё легко раздует проект.

14. Идеальная формулировка для ТЗ

Можно прямо так:

## Agent Memory Graph

OptiDev must maintain a local structured project memory in SQLite.

The memory system stores:
- tasks
- atomic features
- releases
- key decisions
- open loops
- sessions

The system must expose:
- restore summary on workspace start
- lookup by task/feature/release
- unresolved work items
- decision history

The goal is not generic chat history storage, but structured development memory that preserves continuity between sessions, features, tests and releases.
15. Самая сильная practical-фича

На старте optid opticlaw:

не просто

workspace restored

а

workspace restored
release: v3.1
active feature: orc-run-014
last decision: sqlite session store
open loop: log pane restart policy
next suggested action: finish test watcher contract