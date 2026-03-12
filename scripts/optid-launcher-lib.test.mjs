import test from "node:test";
import assert from "node:assert/strict";

import {
  isInstalledReleaseRoot,
  resolveOptidInvocation,
  shouldCheckForUpdates,
} from "./optid-launcher-lib.mjs";

test("resolveOptidInvocation routes no-arg calls to UI startup", () => {
  assert.deepEqual(resolveOptidInvocation([]), {
    kind: "ui",
    forwardedArgs: [],
  });
});

test("resolveOptidInvocation routes explicit ui alias to UI startup", () => {
  assert.deepEqual(resolveOptidInvocation(["ui", "--host", "0.0.0.0"]), {
    kind: "ui",
    forwardedArgs: ["--host", "0.0.0.0"],
  });
});

test("resolveOptidInvocation routes vendored t3code maintenance commands", () => {
  assert.deepEqual(resolveOptidInvocation(["t3code"]), {
    kind: "t3code",
    forwardedArgs: ["status"],
  });
  assert.deepEqual(resolveOptidInvocation(["t3code", "refresh", "--target-ref", "main"]), {
    kind: "t3code",
    forwardedArgs: ["refresh", "--target-ref", "main"],
  });
});

test("resolveOptidInvocation routes status to native CLI", () => {
  assert.deepEqual(resolveOptidInvocation(["status"]), {
    kind: "cli",
    forwardedArgs: ["status"],
  });
});

test("resolveOptidInvocation routes version flags to version output", () => {
  assert.equal(resolveOptidInvocation(["--version"]).kind, "version");
  assert.equal(resolveOptidInvocation(["version"]).kind, "version");
});

test("update checks are automatic only for installed releases unless forced", () => {
  assert.equal(isInstalledReleaseRoot("/tmp/release", false), true);
  assert.equal(isInstalledReleaseRoot("/tmp/repo", true), false);
  assert.equal(
    shouldCheckForUpdates({ env: {}, installedReleaseRoot: true }),
    true,
  );
  assert.equal(
    shouldCheckForUpdates({ env: {}, installedReleaseRoot: false }),
    false,
  );
  assert.equal(
    shouldCheckForUpdates({ env: { OPTID_CHECK_UPDATES: "1" }, installedReleaseRoot: false }),
    true,
  );
});
