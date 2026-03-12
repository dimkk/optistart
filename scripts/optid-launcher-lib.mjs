import path from "node:path";

import { RELEASE_MANIFEST_PATH } from "./release-lib.mjs";

export function resolveOptidInvocation(args) {
  const [first, second, ...rest] = args;

  if (first === undefined) {
    return { kind: "ui", forwardedArgs: [] };
  }

  if (first === "--version" || first === "-v" || first === "version") {
    return { kind: "version", forwardedArgs: [] };
  }

  if (first === "ui" || first === "app" || first === "open") {
    return { kind: "ui", forwardedArgs: [second, ...rest].filter((value) => value !== undefined) };
  }

  if (first === "t3code") {
    return {
      kind: "t3code",
      forwardedArgs: second === undefined ? ["status"] : [second, ...rest],
    };
  }

  return { kind: "cli", forwardedArgs: args };
}

export function isInstalledReleaseRoot(rootDir, hasGitDirectory) {
  return !hasGitDirectory;
}

export function shouldCheckForUpdates({ env, installedReleaseRoot }) {
  if (env.OPTID_DISABLE_UPDATE_CHECK === "1") {
    return false;
  }
  if (env.OPTID_CHECK_UPDATES === "1") {
    return true;
  }
  return installedReleaseRoot;
}

export function resolveReleaseManifestPath(rootDir) {
  return path.join(rootDir, RELEASE_MANIFEST_PATH);
}
