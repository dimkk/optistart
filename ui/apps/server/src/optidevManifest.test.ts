import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  describeOptiDevManifestRuntime,
  previewOptiDevManifestImpact,
  saveOptiDevManifest,
} from "./optidevManifest";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function seedProjectRoot() {
  const projectRoot = makeTempDir("optidev-manifest-project-");
  fs.mkdirSync(path.join(projectRoot, ".optidev"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, ".optidev", "workspace.yaml"),
    [
      "project: demo",
      "workspace:",
      "  active_task: runtime-ts-002",
      "  branch: main",
      "  head_commit: abcdef123456",
      "  mux: zellij",
      "agents:",
      "  - name: coder",
      "    runner: codex",
      "layout:",
      "  - name: Chat",
      "    pane: chat",
      "services:",
      "  - name: web",
      "    command: bun run dev",
      "tests:",
      "  command: bun test --watch",
      "logs:",
      "  command: tail -f logs/dev.log",
      "context:",
      "  agents_dir: .agents/agents",
      "  skills_dir: .agents/skills",
      "  mcp_dir: .agents/mcp",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectRoot, ".optidev", "session.json"),
    JSON.stringify({ manifest_fingerprint: "placeholder" }, null, 2),
    "utf8",
  );
  return projectRoot;
}

describe("optidevManifest", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads manifest content, parsed structure, and runtime notes", async () => {
    const projectRoot = seedProjectRoot();

    const manifest = await describeOptiDevManifestRuntime(projectRoot, { cwd: projectRoot });

    expect(manifest.path).toBe(path.join(projectRoot, ".optidev", "workspace.yaml"));
    expect(manifest.content).toContain("active_task: runtime-ts-002");
    expect(manifest.manifest.workspace.branch).toBe("main");
    expect(manifest.impacts.some((item) => item.field === "workspace.active_task")).toBe(true);
    expect(manifest.runtimeNotes[0]).toContain("Runtime controls are secondary");
  });

  it("previews and saves manifest changes with impact summaries", async () => {
    const projectRoot = seedProjectRoot();
    const nextContent = [
      "project: demo",
      "workspace:",
      "  active_task: ui-shell-003",
      "  branch: feature/manifest-ui",
      "  head_commit: 999999999999",
      "  mux: textual",
      "agents:",
      "  - name: reviewer",
      "    runner: codex",
      "layout:",
      "  - name: Chat",
      "    pane: chat",
      "  - name: Memory",
      "    pane: logs",
      "services:",
      "  - name: web",
      "    command: bun run dev:web",
      "tests:",
      "  command: bun run test",
      "logs:",
      "  command: tail -f logs/web.log",
      "context:",
      "  agents_dir: .agents/agents",
      "  skills_dir: .agents/skills",
      "  mcp_dir: .agents/mcp",
      "",
    ].join("\n");

    const impact = await previewOptiDevManifestImpact(projectRoot, { cwd: projectRoot }, nextContent);
    const saved = await saveOptiDevManifest(projectRoot, { cwd: projectRoot }, nextContent);

    expect(impact.some((item) => item.field === "workspace.branch")).toBe(true);
    expect(impact.some((item) => item.field === "workspace.head_commit")).toBe(true);
    expect(saved.lines[0]).toContain("Workspace manifest saved");
    expect(saved.payload.manifest.workspace.mux).toBe("textual");
    expect(fs.readFileSync(path.join(projectRoot, ".optidev", "workspace.yaml"), "utf8")).toContain(
      "feature/manifest-ui",
    );
  });
});
