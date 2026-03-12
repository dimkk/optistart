# Task 040

## implemented behavior
- Added `README.md` instructions for installing a nightly OptiDev build from the long-lived `test` branch on Unix/macOS and Windows.
- Added branch-aware remote installer support so `OPTID_GIT_REF=test` downloads the `test` branch snapshot instead of the stable tagged release archive.
- Kept stable install guidance pointed at the default `main`/tag-based installer flow and explicitly separated it from nightly branch installs.
- Prepared the repository state for promotion into the `test` branch so another machine can install and validate the exact branch snapshot.

## tests added or updated
- No new product tests were required for the branch-promotion step itself.
- The promoted branch carries the already-verified runner CLI changes from Task 039.

## important decisions
- Stable remote install remains unchanged and still uses the release manifest plus tagged archives from `main`.
- Nightly branch installs now support both:
  - `git clone --branch test` plus local installer
  - remote `curl` / PowerShell bootstrap with `OPTID_GIT_REF=test`
- This keeps nightly testing aligned with the exact branch contents without breaking the stable release installer path.

## open loops or known limits
- Nightly install instructions assume `git`, `bun`, and `node` are already available on the target machine.
- The `test` branch must exist on `origin` before another machine can install from it with `OPTID_GIT_REF=test`.
