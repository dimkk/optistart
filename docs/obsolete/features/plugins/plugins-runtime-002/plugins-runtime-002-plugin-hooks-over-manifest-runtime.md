# plugins-runtime-002: Plugin hooks over manifest runtime

## description
Run startup plugins after manifest/session/runtime state has been resolved so plugins extend the runtime instead of defining it.

## current implementation state
- Implemented by passing manifest, runtime mode, project session, and active agents into plugin startup context.

## implementation plan
1. Completed: manifest/runtime context injection into plugins.
2. Completed: workspace bootstrap plugin consumes manifest data.
3. Completed: advice/telegram flows continue under manifest-native startup.
