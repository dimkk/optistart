# task-049 release tag publication report

## implemented behavior
- Updated `.github/workflows/release-main-stable.yml` so the stable workflow creates an annotated release tag, pushes the tag explicitly with `refs/tags/<tag>`, and passes the prepared release commit SHA into downstream build/release jobs.
- Updated `.github/workflows/release-test-nightly.yml` with the same annotated-tag and explicit-push behavior so nightly releases do not carry the same hidden failure mode.
- Switched build and release jobs in both workflows to check out and archive the prepared release commit SHA instead of looking up the remote tag immediately, while still publishing the GitHub release under the intended tag.

## tests added or updated
- Re-read the release workflow definitions after the change to confirm job outputs and downstream refs are wired through the new `release_sha`.
- Reproduced the tag publication bug locally with a temporary Git remote:
  - lightweight `git tag v0.0.4` plus `git push --follow-tags` did not publish `refs/tags/v0.0.4`
  - annotated `git tag -a v0.0.4` plus `git push origin HEAD:main refs/tags/v0.0.4` did publish the tag

## important decisions
- Fixed both `main` and `test` workflows together because the nightly path used the same broken lightweight-tag pattern.
- Kept the GitHub release contract tag-based, but removed downstream job dependence on tag lookup timing by pinning them to the prepared commit SHA.
- Used explicit remote tag push in addition to annotated tags so the workflow does not rely on `--follow-tags` semantics.

## open loops or known limits
- The already failed historical workflow runs remain failed; only new `main` / `test` pushes will exercise the corrected release path.
- This change hardens tag publication and downstream checkout, but platform-specific signing/build failures can still occur independently if secrets or runner capabilities are missing.
