import { execFile } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function repoRoot(): string {
  return path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
}

describe("optidevCli shim", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs the root scripts/optid shim through the native Bun CLI", async () => {
    const root = repoRoot();
    const homeDir = makeTempDir("optidev-cli-shim-home-");
    const cwd = makeTempDir("optidev-cli-shim-root-");
    const scriptPath = path.join(root, "scripts", "optid");

    const init = await execFileAsync(scriptPath, ["init", "demo"], {
      cwd,
      env: {
        ...process.env,
        OPTIDEV_HOME: homeDir,
      },
      encoding: "utf8",
    });

    const status = await execFileAsync(scriptPath, ["status"], {
      cwd,
      env: {
        ...process.env,
        OPTIDEV_HOME: homeDir,
      },
      encoding: "utf8",
    });

    expect(init.stdout).toContain("Initialized project 'demo'");
    expect(status.stdout).toContain("No active session.");
    expect(fs.existsSync(path.join(cwd, "demo", ".optidev", "workspace.yaml"))).toBe(true);
  });

  it("runs telegram lifecycle through the root scripts/optid shim", async () => {
    const root = repoRoot();
    const homeDir = makeTempDir("optidev-cli-shim-home-");
    const cwd = makeTempDir("optidev-cli-shim-root-");
    const scriptPath = path.join(root, "scripts", "optid");
    const env = {
      ...process.env,
      OPTIDEV_HOME: homeDir,
    };

    const start = await execFileAsync(scriptPath, ["telegram", "start", "--token", "123456:ABCDEF", "--chat-id", "42"], {
      cwd,
      env,
      encoding: "utf8",
    });
    const status = await execFileAsync(scriptPath, ["telegram", "status"], {
      cwd,
      env,
      encoding: "utf8",
    });
    const stop = await execFileAsync(scriptPath, ["telegram", "stop"], {
      cwd,
      env,
      encoding: "utf8",
    });

    expect(start.stdout).toContain("Telegram bridge enabled for chat 42.");
    expect(status.stdout).toContain("Telegram bridge is enabled for chat 42");
    expect(stop.stdout).toContain("Telegram bridge disabled.");
  });

  it("runs memory commands through the root scripts/optid shim", async () => {
    const root = repoRoot();
    const homeDir = makeTempDir("optidev-cli-shim-home-");
    const projectDir = makeTempDir("optidev-cli-shim-project-");
    const scriptPath = path.join(root, "scripts", "optid");
    const env = {
      ...process.env,
      OPTIDEV_HOME: homeDir,
    };

    fs.mkdirSync(path.join(projectDir, "docs", "tasks"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "docs", "features", "runtime", "runtime-ts-002"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "docs", "v1-2"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "tasks-log"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "docs", "tasks", "task7-init.md"), "# Task 7\n", "utf8");
    fs.writeFileSync(path.join(projectDir, "docs", "tasks", "task7-init-features.md"), "runtime-ts-002\n", "utf8");
    fs.writeFileSync(
      path.join(projectDir, "docs", "features", "runtime", "runtime-ts-002", "runtime-ts-002-staged-ts-runtime-migration.md"),
      "# runtime-ts-002: staged TS runtime migration\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(projectDir, "docs", "v1-2", "features-matrix.md"),
      [
        "# Features v1-2",
        "",
        "| Feature ID | Title | Status |",
        "| --- | --- | --- |",
        "| runtime-ts-002 | Runtime migration | DONE |",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(projectDir, "tasks-log", "task-029-runtime-ts-native-only-report.md"),
      ["# Task 029", "", "## Decisions", "- native CLI only"].join("\n"),
      "utf8",
    );

    const summary = await execFileAsync(scriptPath, ["memory"], {
      cwd: projectDir,
      env,
      encoding: "utf8",
    });
    const show = await execFileAsync(scriptPath, ["memory", "show", "feature", "runtime-ts-002"], {
      cwd: projectDir,
      env,
      encoding: "utf8",
    });

    expect(summary.stdout).toContain("Project memory:");
    expect(show.stdout).toContain("Feature: runtime-ts-002");
  });
});
