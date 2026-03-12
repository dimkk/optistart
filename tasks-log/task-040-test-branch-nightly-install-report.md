# Task 040

## implemented behavior
- Added `README.md` instructions for installing a nightly OptiDev build from the long-lived `test` branch on Unix/macOS and Windows.
- Kept stable install guidance pointed at the default `main`/tag-based installer flow and explicitly separated it from nightly branch installs.
- Prepared the repository state for promotion into the `test` branch so another machine can install and validate the exact branch snapshot.

## tests added or updated
- No new product tests were required for the branch-promotion step itself.
- The promoted branch carries the already-verified runner CLI changes from Task 039.

## important decisions
- Nightly branch installs use `git clone --branch test` plus the local installer scripts instead of the remote `curl` / PowerShell bootstrap path.
- This keeps nightly testing aligned with the exact branch contents because the remote installer still resolves the stable release manifest and tagged archives by default.

## open loops or known limits
- Nightly install instructions assume `git`, `bun`, and `node` are already available on the target machine.
- The `test` branch must be pushed to `origin` before another machine can install from it.
