# Features Tests v1-0

| Feature ID | Unit | Integration | E2E | Status |
| --- | --- | --- | --- | --- |
| cli-core-001 | command parsing and output assertions | handler wiring with workspace service | `optid <project>`, `optid status`, `optid stop` smoke | PASSED |
| prj-discovery-001 | discovery path generation | scan on temp tree | `optid projects` discovery output | PASSED |
| cfg-load-001 | schema defaults and validation | global+project config merge | startup failure on invalid config | PASSED |
| ws-session-001 | lifecycle transitions | session persistence | restart restore smoke | PASSED |
| mux-abst-001 | interface contract | workspace uses abstraction | CLI path independent of backend | PASSED |
| mux-zellij-001 | `layout.kdl` rendering | zellij process invocation | workspace opens zellij layout | PASSED |
| runner-api-001 | adapter contract tests | adapter selection | runner bootstrap smoke | PASSED |
| memory-sql-001 | schema and CRUD tests | sqlite file init/migration | resume history smoke | PASSED |
| hooks-dev-001 | command normalization | process startup/stop | hooks run on start | PASSED |
| plugins-core-001 | plugin loading validation | callback ordering | sample plugin events | PASSED |
| plugins-tele-001 | telegram config helpers and bridge status | CLI to plugin dispatch | active chat bridge smoke with saved telegram config | PASSED |
| plugins-skills-001 | output parsing and project install | CLI to plugin dispatch | `optid skills search/install` smoke with mocked subprocess | PASSED |
| plugins-agents-001 | agent page parsing and file generation | CLI to plugin dispatch | `optid agents search/install` smoke with mocked HTTP | PASSED |
| plugins-advice-001 | repo summary and startup prompt generation | plugin startup hook aggregation | `optid start --advice` creates startup prompt for runner | PASSED |
| plugins-workspace-001 | layout resolution and context artifact generation | startup plugin to app/mux handoff | `optid start/go` renders plugin-owned tabs and bootstrap command files | PASSED |
| status-obsv-001 | status formatting | log source lookup | status/logs runtime smoke | PASSED |
| cli-init-001 | command parsing for `init` | project directory init and registration | `optid init <name|.>` smoke | PASSED |
