import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { OptiDevRouteContext } from "./optidevContract";
import { nativeInitAction, nativeWorkspaceCloneAction } from "./optidevPersistence";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeContext(homeDir: string, cwd: string): OptiDevRouteContext {
  return { homeDir, cwd };
}

describe("optidevPersistence", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("initializes a project with default config, manifest, and registry entry", async () => {
    const repoRoot = makeTempDir("optidev-persist-root-");
    const homeDir = makeTempDir("optidev-persist-home-");
    const projectPath = path.join(repoRoot, "demo");
    const context = makeContext(homeDir, repoRoot);

    const result = await nativeInitAction(context, "demo", repoRoot);

    expect(result.ok).toBe(true);
    expect(result.lines[0]).toContain("Initialized project 'demo'");
    expect(fs.existsSync(path.join(projectPath, ".project", "config.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, ".optidev", "workspace.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, ".agents", "agents"))).toBe(true);
    const registryEntry = path.join(homeDir, "projects", "demo");
    expect(fs.existsSync(registryEntry)).toBe(true);
    if (fs.existsSync(path.join(registryEntry, ".optid-target"))) {
      expect(fs.readFileSync(path.join(registryEntry, ".optid-target"), "utf8")).toBe(projectPath);
    }
  });

  it("clones the workspace manifest with the clone branch", async () => {
    const repoRoot = makeTempDir("optidev-persist-root-");
    const homeDir = makeTempDir("optidev-persist-home-");
    const projectPath = path.join(repoRoot, "demo");
    const context = makeContext(homeDir, repoRoot);

    await nativeInitAction(context, "demo", repoRoot);
    const result = await nativeWorkspaceCloneAction(context, "sandbox", projectPath);

    const cloneManifestPath = path.join(projectPath, ".optidev", "workspaces", "sandbox", "workspace.yaml");
    expect(result.ok).toBe(true);
    expect(result.lines[0]).toContain("Workspace clone created");
    expect(fs.existsSync(cloneManifestPath)).toBe(true);
    expect(fs.readFileSync(cloneManifestPath, "utf8")).toContain("branch: sandbox");
    expect(fs.readFileSync(cloneManifestPath, "utf8")).toContain("project: demo");
  });
});
