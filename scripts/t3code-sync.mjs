#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_METADATA_PATH,
  DEFAULT_UPSTREAM_URL,
  DEFAULT_VENDOR_DIR,
  T3CodeSyncError,
  bootstrapMetadata,
  currentStatus,
  refreshVendor,
} from "./t3code-sync-lib.mjs";

function usage() {
  return `Usage:
  node scripts/t3code-sync.mjs status [--repo-root <path>] [--vendor-dir <path>] [--metadata-path <path>]
  node scripts/t3code-sync.mjs bootstrap --base-ref <ref> [--repo-root <path>] [--vendor-dir <path>] [--metadata-path <path>] [--upstream-url <url>] [--bootstrap-reason <text>]
  node scripts/t3code-sync.mjs refresh [--target-ref <ref>] [--base-ref <ref>] [--dry-run] [--allow-dirty] [--repo-root <path>] [--vendor-dir <path>] [--metadata-path <path>] [--upstream-url <url>]`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command) {
    throw new T3CodeSyncError(usage(), { code: "USAGE" });
  }

  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new T3CodeSyncError(`unexpected argument: ${token}\n\n${usage()}`, {
        code: "USAGE",
      });
    }

    const name = token.slice(2);
    if (name === "dry-run" || name === "allow-dirty") {
      flags[name] = true;
      continue;
    }

    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new T3CodeSyncError(`missing value for --${name}\n\n${usage()}`, {
        code: "USAGE",
      });
    }
    flags[name] = value;
    index += 1;
  }

  return { command, flags };
}

function baseOptions(flags) {
  const repoRoot = flags["repo-root"] ? path.resolve(flags["repo-root"]) : process.cwd();
  return {
    repoRoot,
    vendorDir: flags["vendor-dir"] ?? DEFAULT_VENDOR_DIR,
    metadataPath: flags["metadata-path"] ?? DEFAULT_METADATA_PATH,
    upstreamUrl: flags["upstream-url"] ?? DEFAULT_UPSTREAM_URL,
  };
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === "status") {
    const result = await currentStatus(baseOptions(flags));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "bootstrap") {
    if (!flags["base-ref"]) {
      throw new T3CodeSyncError(`bootstrap requires --base-ref\n\n${usage()}`, {
        code: "USAGE",
      });
    }

    const result = await bootstrapMetadata({
      ...baseOptions(flags),
      baseRef: flags["base-ref"],
      bootstrapReason:
        flags["bootstrap-reason"] ??
        "Initial vendored t3code base inferred from the existing ui tree before the first managed refresh.",
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "refresh") {
    const result = await refreshVendor({
      ...baseOptions(flags),
      baseRef: flags["base-ref"],
      targetRef: flags["target-ref"] ?? "main",
      dryRun: Boolean(flags["dry-run"]),
      allowDirty: Boolean(flags["allow-dirty"]),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  throw new T3CodeSyncError(`unknown command: ${command}\n\n${usage()}`, {
    code: "USAGE",
  });
}

main().catch((error) => {
  if (error instanceof T3CodeSyncError) {
    process.stderr.write(`${error.message}\n`);
    if (error.details && Object.keys(error.details).length > 0) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`${error.stack ?? String(error)}\n`);
  process.exitCode = 1;
});
