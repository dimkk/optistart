# Task 14

## goal
Create the long-lived `test` branch from the current working branch state, carry the current OptiDev changes into it, and document how to install a nightly build from the `test` branch for cross-machine verification, including Windows.

## architecture
- Keep the current feature work on the existing feature branch until the worktree is clean enough to promote.
- Document nightly installation as a branch-aware install flow:
  - stable install remains the default `main`/tag-based remote installer path
  - nightly install from `test` must support both:
    - branch checkout plus local installer
    - remote one-liner install using the shipped installer scripts with an explicit branch ref
- Publish `test` as a long-lived integration branch so another machine can install exactly the branch state being tested.

## atomic features
- `cli-launch-001`:
  Extend installer behavior and operator documentation so nightly installs from the long-lived `test` branch are explicit and usable on Windows and Unix, including remote one-liners.
- `repo-release-001`:
  Promote the current repository state into the long-lived `test` branch for pre-release verification.

## test plan
- Verify the repository worktree is committed before branch promotion.
- Verify the `test` branch exists locally and remotely after promotion.
- Re-run the targeted runner CLI verification before promotion so the branch carries a known-good state.
- Validate installer syntax/entrypoints after branch-aware installer changes.
- Review the README install section to ensure stable vs nightly install paths are explicit, including remote one-liners.

## approvals / notes
- User requested on 2026-03-13 to create the `test` branch, merge the current branch state into it, clean the worktree if needed, and add README instructions for installing a nightly build from `test` on a Windows machine.
- This task is operational and documentation-heavy; the user explicitly asked to proceed.
