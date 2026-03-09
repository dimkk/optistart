import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildMemoryModel,
  nativeMemoryOpenLoops,
  nativeMemoryShow,
  nativeMemorySummary,
} from "./optidevMemory";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function seedProject(projectRoot: string) {
  fs.mkdirSync(path.join(projectRoot, "docs", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "docs", "features", "runtime", "runtime-ts-002"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(projectRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "docs", "v1-2"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "tasks-log"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".optidev"), { recursive: true });

  fs.writeFileSync(
    path.join(projectRoot, "docs", "tasks", "task7-init.md"),
    "# Task 7\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectRoot, "docs", "tasks", "task7-init-features.md"),
    "runtime-ts-002\nui-t3code-001\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectRoot, "docs", "features", "runtime", "runtime-ts-002", "runtime-ts-002-staged-ts-runtime-migration.md"),
    "# runtime-ts-002: staged TS runtime migration\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectRoot, "docs", "releases", "v1-2.md"),
    "# Release v1-2\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectRoot, "docs", "v1-2", "features-matrix.md"),
    [
      "# Features v1-2",
      "",
      "| Feature ID | Title | Status |",
      "| --- | --- | --- |",
      "| runtime-ts-002 | Runtime migration | DONE |",
      "| ui-t3code-001 | UI | DONE |",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectRoot, "tasks-log", "task-022-runtime-ts-slice1-report.md"),
    [
      "# Task 022 Report",
      "",
      "## Decisions",
      "- runtime-ts-002 uses staged migration",
      "",
      "## Open loops",
      "- runtime-ts-002 still needs native memory queries",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectRoot, ".optidev", "session.json"),
    JSON.stringify({ active_task: "runtime-ts-002" }, null, 2),
    "utf8",
  );
}

describe("optidevMemory", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds memory model from project docs and reports", async () => {
    const projectRoot = makeTempDir("optidev-memory-project-");
    seedProject(projectRoot);

    const model = await buildMemoryModel(projectRoot);

    expect(model.project).toBe(path.basename(projectRoot));
    expect(model.activeFeature).toBe("runtime-ts-002");
    expect(model.features.get("runtime-ts-002")?.status).toBe("DONE");
    expect(model.features.get("runtime-ts-002")?.releases).toEqual(["v1-2"]);
    expect(model.tasks.get("task7")?.features).toEqual(["runtime-ts-002", "ui-t3code-001"]);
    expect(model.releases.get("v1-2")?.features).toEqual(["runtime-ts-002", "ui-t3code-001"]);
    expect(model.openLoops[0]?.description).toContain("native memory queries");
  });

  it("renders summary and open loops with OptiDev-compatible text", async () => {
    const projectRoot = makeTempDir("optidev-memory-project-");
    seedProject(projectRoot);

    const summary = await nativeMemorySummary(projectRoot);
    const openLoops = await nativeMemoryOpenLoops(projectRoot);

    expect(summary.ok).toBe(true);
    expect(summary.lines).toContain("Project memory:");
    expect(summary.lines.join("\n")).toContain("active feature: runtime-ts-002");
    expect(openLoops.ok).toBe(true);
    expect(openLoops.lines[0]).toContain("runtime-ts-002 | open |");
  });

  it("renders typed memory show output", async () => {
    const projectRoot = makeTempDir("optidev-memory-project-");
    seedProject(projectRoot);

    const feature = await nativeMemoryShow(projectRoot, "feature", "runtime-ts-002");
    const task = await nativeMemoryShow(projectRoot, "task", "task7");
    const release = await nativeMemoryShow(projectRoot, "release", "v1-2");

    expect(feature.ok).toBe(true);
    expect(feature.lines).toContain("Feature: runtime-ts-002");
    expect(feature.lines.join("\n")).toContain("Decisions:");
    expect(task.ok).toBe(true);
    expect(task.lines).toContain("Task: task7");
    expect(task.lines.join("\n")).toContain("Features: runtime-ts-002, ui-t3code-001");
    expect(release.ok).toBe(true);
    expect(release.lines).toContain("Release: v1-2");
    expect(release.lines.join("\n")).toContain("Features: runtime-ts-002, ui-t3code-001");
  });
});
