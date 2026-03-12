#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import { readReleaseManifest } from "./release-lib.mjs";
import {
  isInstalledReleaseRoot,
  resolveOptidInvocation,
  shouldCheckForUpdates,
} from "./optid-launcher-lib.mjs";
import { checkForReleaseUpdate } from "./optid-update-check.mjs";

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function ensureCommand(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 0);
    });
  });
}

function parseRunnerArgs(argv) {
  const args = [...argv];
  let rootDir = null;

  if (args[0] === "--root") {
    rootDir = args[1] ?? null;
    args.splice(0, 2);
  }

  return {
    rootDir: rootDir ?? process.cwd(),
    args,
  };
}

async function maybePrintUpdateSuggestion(rootDir, env) {
  const installedReleaseRoot = isInstalledReleaseRoot(
    rootDir,
    await pathExists(path.join(rootDir, ".git")),
  );

  if (!shouldCheckForUpdates({ env, installedReleaseRoot })) {
    return;
  }

  const update = await checkForReleaseUpdate({
    repoRoot: rootDir,
    optidevHome: env.OPTIDEV_HOME,
  });

  if (update.updateAvailable && update.suggestion) {
    process.stderr.write(`${update.suggestion}\n`);
  }
}

async function ensureBuiltUi(rootDir) {
  const serverDist = path.join(rootDir, "ui/apps/server/dist/index.mjs");
  const webDist = path.join(rootDir, "ui/apps/web/dist/index.html");
  if ((await pathExists(serverDist)) && (await pathExists(webDist))) {
    return;
  }

  if (!ensureCommand("node")) {
    throw new Error("optid error: missing required command: node");
  }

  const exitCode = await runCommand("bun", ["run", "build"], {
    cwd: path.join(rootDir, "ui"),
    env: process.env,
  });
  if (exitCode !== 0) {
    throw new Error(`optid error: failed to build bundled UI (exit ${exitCode})`);
  }
}

async function main() {
  const invocationCwd = process.cwd();
  const { rootDir, args } = parseRunnerArgs(process.argv.slice(2));
  if (!ensureCommand("bun")) {
    throw new Error("optid error: missing required command: bun");
  }

  const manifest = await readReleaseManifest(rootDir);
  const invocation = resolveOptidInvocation(args);
  await maybePrintUpdateSuggestion(rootDir, process.env);

  if (invocation.kind === "version") {
    process.stdout.write(`optid v${manifest.version}\n`);
    return 0;
  }

  if (invocation.kind === "ui") {
    await ensureBuiltUi(rootDir);
    if (!ensureCommand("node")) {
      throw new Error("optid error: missing required command: node");
    }
    return runCommand("node", [path.join(rootDir, "ui/apps/server/dist/index.mjs"), ...invocation.forwardedArgs], {
      cwd: path.join(rootDir, "ui/apps/server"),
      env: process.env,
    });
  }

  if (invocation.kind === "t3code") {
    if (!ensureCommand("node")) {
      throw new Error("optid error: missing required command: node");
    }
    return runCommand("node", [path.join(rootDir, "scripts/t3code-sync.mjs"), ...invocation.forwardedArgs], {
      cwd: rootDir,
      env: process.env,
    });
  }

  return runCommand("bun", [path.join(rootDir, "ui/apps/server/src/optidevCli.ts"), ...invocation.forwardedArgs], {
    cwd: invocationCwd,
    env: process.env,
  });
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
