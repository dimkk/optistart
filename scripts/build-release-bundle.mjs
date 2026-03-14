#!/usr/bin/env node

import { mkdtemp, mkdir, readdir, readFile, rm, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildReleaseBundleFileName,
  buildReleaseServerPackageJson,
  readReleaseManifest,
} from "./release-lib.mjs";

const SCRIPT_FILES = [
  "optid",
  "optid.cmd",
  "optid.ps1",
  "optid-runner.mjs",
  "optid-launcher-lib.mjs",
  "optid-update-check.mjs",
  "release-lib.mjs",
  "release-manifest.json",
  "t3code-sync.mjs",
  "t3code-sync-lib.mjs",
];

function parseArgs(argv) {
  const args = [...argv];
  let repoRoot = process.cwd();
  let outputDir = path.join(repoRoot, "release-assets");

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--repo-root") {
      repoRoot = path.resolve(args.shift() ?? repoRoot);
      continue;
    }
    if (arg === "--output-dir") {
      outputDir = path.resolve(args.shift() ?? outputDir);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { repoRoot, outputDir };
}

async function assertExists(targetPath, label) {
  try {
    await readFile(targetPath);
  } catch {
    throw new Error(`Missing ${label}: ${targetPath}`);
  }
}

async function copyScriptFiles(repoRoot, stageRoot) {
  const targetDir = path.join(stageRoot, "scripts");
  await mkdir(targetDir, { recursive: true });
  for (const fileName of SCRIPT_FILES) {
    await cp(path.join(repoRoot, "scripts", fileName), path.join(targetDir, fileName));
  }
}

async function copyReleaseDist(repoRoot, stageRoot) {
  const sourceDir = path.join(repoRoot, "ui", "apps", "server", "dist");
  const targetDir = path.join(stageRoot, "ui", "apps", "server", "dist");
  await mkdir(targetDir, { recursive: true });

  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    if (entry.name.endsWith(".cjs") || entry.name.endsWith(".map")) {
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name !== "client") {
        continue;
      }
      await cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
        recursive: true,
      });
      continue;
    }
    if (!entry.name.endsWith(".mjs")) {
      continue;
    }
    await cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  }
}

async function writeReleaseServerPackage(repoRoot, stageRoot, version) {
  const rootPackageJson = JSON.parse(
    await readFile(path.join(repoRoot, "ui", "package.json"), "utf8"),
  );
  const serverPackageJson = JSON.parse(
    await readFile(path.join(repoRoot, "ui", "apps", "server", "package.json"), "utf8"),
  );
  const releasePackageJson = buildReleaseServerPackageJson({
    rootPackageJson,
    serverPackageJson,
    version,
  });

  const targetDir = path.join(stageRoot, "ui", "apps", "server");
  await mkdir(targetDir, { recursive: true });
  await writeFile(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(releasePackageJson, null, 2)}\n`,
    "utf8",
  );
}

function createTarball(bundleRootDir, outputPath) {
  const result = spawnSync("tar", ["-czf", outputPath, "-C", path.dirname(bundleRootDir), path.basename(bundleRootDir)], {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`tar failed with exit code ${result.status}`);
  }
}

async function main() {
  const { repoRoot, outputDir } = parseArgs(process.argv.slice(2));
  const manifest = await readReleaseManifest(repoRoot);
  const bundleName = `optid-${manifest.version}`;
  const tarballName = buildReleaseBundleFileName(manifest.version);
  const serverDist = path.join(repoRoot, "ui", "apps", "server", "dist", "index.mjs");
  const clientDist = path.join(repoRoot, "ui", "apps", "server", "dist", "client", "index.html");
  const cliDist = path.join(repoRoot, "ui", "apps", "server", "dist", "optidevCli.mjs");

  await assertExists(serverDist, "bundled server runtime");
  await assertExists(clientDist, "bundled web client");
  await assertExists(cliDist, "bundled OptiDev CLI runtime");

  const tempRoot = await mkdtemp(path.join(tmpdir(), "optid-release-bundle-"));
  const stageRoot = path.join(tempRoot, bundleName);

  try {
    await copyScriptFiles(repoRoot, stageRoot);
    await copyReleaseDist(repoRoot, stageRoot);
    await writeReleaseServerPackage(repoRoot, stageRoot, manifest.version);

    await mkdir(outputDir, { recursive: true });
    createTarball(stageRoot, path.join(outputDir, tarballName));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
