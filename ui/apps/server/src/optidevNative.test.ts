import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildNativeState,
  discoverProjectsNative,
  nativeLogsText,
  nativeStatusText,
} from "./optidevNative";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function seedHome(homeDir: string) {
  const projectPath = path.join(homeDir, "projects", "demo");
  const scanRoot = path.join(homeDir, "scan-root");
  const linkedPath = path.join(homeDir, "linked-project");

  fs.mkdirSync(path.join(homeDir, "projects"), { recursive: true });
  fs.mkdirSync(path.join(homeDir, "sessions", "demo"), { recursive: true });
  fs.mkdirSync(path.join(projectPath, ".optidev"), { recursive: true });
  fs.mkdirSync(path.join(scanRoot, "linked"), { recursive: true });
  fs.mkdirSync(linkedPath, { recursive: true });

  fs.writeFileSync(
    path.join(homeDir, "config.yaml"),
    JSON.stringify({
      projects_path: path.join(homeDir, "projects"),
      scan_paths: [scanRoot],
      default_runner: "codex",
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(homeDir, "active_session.json"),
    JSON.stringify({ project: "demo" }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(homeDir, "sessions", "demo", "session.json"),
    JSON.stringify(
      {
        project: "demo",
        status: "running",
        mux_backend: "zellij",
        mux_session_name: "optid-demo",
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(homeDir, "sessions", "demo", "runner.json"),
    JSON.stringify({ runner: "codex" }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(homeDir, "sessions", "demo", "hooks.json"),
    JSON.stringify([{ group: "logs.sources", command: "npm run dev", status: "running" }], null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectPath, ".optidev", "workspace.yaml"),
    "project: demo\nworkspace:\n  active_task: feature-x\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectPath, ".optidev", "session.json"),
    JSON.stringify(
      {
        branch: "main",
        head_commit: "1234567890abcdef",
        agents: ["coder", "reviewer"],
        last_mode: "resume",
        active_task: "feature-x",
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(path.join(scanRoot, "linked", ".optid-target"), linkedPath, "utf8");
  return { projectPath, linkedPath };
}

describe("optidevNative", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discovers projects from configured roots and resolves .optid-target pointers", async () => {
    const homeDir = makeTempDir("optidev-native-home-");
    const { linkedPath } = seedHome(homeDir);

    const projects = await discoverProjectsNative({
      cwd: "/repo",
      homeDir,
    });

    expect(projects).toEqual([
      { name: "demo", path: path.join(homeDir, "projects", "demo") },
      { name: "linked", path: linkedPath },
    ]);
  });

  it("builds native status and logs text from OptiDev session files", async () => {
    const homeDir = makeTempDir("optidev-native-home-");
    seedHome(homeDir);

    const status = await nativeStatusText({
      cwd: "/repo",
      homeDir,
    });
    const logs = await nativeLogsText({
      cwd: "/repo",
      homeDir,
    });

    expect(status).toContain("Project: demo");
    expect(status).toContain("Runner: codex");
    expect(status).toContain("Agents: 2");
    expect(status).toContain("Task: feature-x");
    expect(logs).toContain("Log sources:");
    expect(logs).toContain("npm run dev [running]");
  });

  it("builds native state and merges native memory summary", async () => {
    const homeDir = makeTempDir("optidev-native-home-");
    seedHome(homeDir);

    const response = await buildNativeState(
      { cwd: "/repo", homeDir },
      async () => ({ ok: true, lines: ["Memory summary"] }),
    );

    expect(response.ok).toBe(true);
    expect(response.lines).toEqual([]);
    expect(response.state?.status).toContain("Project: demo");
    expect(response.state?.memorySummary).toEqual(["Memory summary"]);
    expect(response.state?.projects).toEqual(
      expect.arrayContaining([{ name: "demo", path: path.join(homeDir, "projects", "demo") }]),
    );
  });
});
