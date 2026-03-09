# Features Tests v1-1

| Feature ID | Unit | Integration | E2E | Status |
| --- | --- | --- | --- | --- |
| manifest-schema-001 | schema defaults and validation errors | manifest file parsing from project root | invalid manifest blocks startup with actionable error | PASSED |
| manifest-load-001 | manifest accessor behavior | loader reads `.optidev/workspace.yaml` | startup uses manifest-defined values | PASSED |
| session-store-001 | session read/write and compatibility metadata | project-local session persistence | lifecycle updates `.optidev/session.json` | PASSED |
| runtime-reconcile-001 | bootstrap vs restore decision matrix | manifest/session compatibility drives runtime path | repeated start restores only when compatible | PASSED |
| layout-manifest-001 | manifest layout transformation | mux receives manifest-derived layout | runtime tabs/panes match manifest intent | PASSED |
| env-manifest-001 | service/test/log command selection | manifest commands drive runtime artifacts | manifest commands are materialized and executed | PASSED |
| agents-manifest-001 | agent declaration validation and runner resolution | declared agents are reflected in runtime state | manifest-declared agents appear in active session/runtime artifacts | PASSED |
| context-engine-001 | context assembly from manifest/memory/repo scan | context artifact generation | runner startup prompt references generated context artifact | PASSED |
| manifest-bootstrap-001 | manifest generation from legacy config | migration from `.project/config.yaml` | first start in legacy repo creates manifest | PASSED |
| cli-runtime-002 | parsing for `resume`, `reset`, `workspace clone` | CLI wiring to manifest runtime services | manifest lifecycle commands work end-to-end | PASSED |
| plugins-runtime-002 | plugin context includes manifest/runtime metadata | plugins execute after manifest resolution | Telegram/advice flows still work under manifest runtime | PASSED |
| workspace-branch-001 | branch manifest derivation rules | cloned workspace gets isolated manifest/session | `optid workspace clone <name>` creates isolated branch workspace | PASSED |
