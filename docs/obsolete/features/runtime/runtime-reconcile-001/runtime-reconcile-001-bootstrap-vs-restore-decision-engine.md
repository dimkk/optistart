# runtime-reconcile-001: Bootstrap vs restore decision engine

## description
Decide whether runtime startup should bootstrap from manifest or restore an existing compatible session.

## current implementation state
- Implemented through `optidev/runtime_reconcile.py` and app startup mode selection.

## implementation plan
1. Completed: compatibility-based decision helper.
2. Completed: forced resume behavior.
3. Completed: runtime mode surfaced to startup flow and status output.
