import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { listScopedDirectory, readScopedFile, writeScopedTextFile } from "./optidevFiles";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createMockRepoRoot() {
  const repoRoot = makeTempDir("optidev-files-root-");
  fs.mkdirSync(path.join(repoRoot, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "scripts", "optid"), "#!/usr/bin/env bash\n", "utf8");
  const uiRoot = path.join(repoRoot, "ui");
  fs.mkdirSync(path.join(uiRoot, "apps", "server"), { recursive: true });
  fs.mkdirSync(path.join(uiRoot, "apps", "web"), { recursive: true });
  return { repoRoot, uiRoot };
}

describe("optidevFiles", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists repository entries with directories first and files after", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    fs.mkdirSync(path.join(repoRoot, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# Demo\n", "utf8");

    const directory = await listScopedDirectory({ cwd: uiRoot }, "repo", "");

    expect(directory.entries.slice(0, 2)).toEqual([
      expect.objectContaining({ name: "docs", kind: "directory" }),
      expect.objectContaining({ name: "scripts", kind: "directory" }),
    ]);
    expect(directory.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "README.md", kind: "file" })]),
    );
  });

  it("reads markdown and code files with the correct viewer kind", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# Demo\n", "utf8");
    fs.writeFileSync(path.join(repoRoot, "src", "index.ts"), "export const value = 1;\n", "utf8");

    const markdown = await readScopedFile({ cwd: uiRoot }, "repo", "README.md");
    const code = await readScopedFile({ cwd: uiRoot }, "repo", "src/index.ts");

    expect(markdown.kind).toBe("markdown");
    expect(markdown.content).toContain("# Demo");
    expect(code.kind).toBe("code");
    expect(code.language).toBe("typescript");
  });

  it("writes plugin files only inside the scoped agents or skills roots", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    fs.mkdirSync(path.join(repoRoot, ".agents"), { recursive: true });

    const saved = await writeScopedTextFile(
      { cwd: uiRoot },
      "agents",
      "reviewer/SKILL.md",
      "# Reviewer\n",
    );

    expect(saved.editable).toBe(true);
    expect(saved.content).toContain("# Reviewer");
    expect(
      fs.readFileSync(path.join(repoRoot, ".agents", "agents", "reviewer", "SKILL.md"), "utf8"),
    ).toContain("# Reviewer");
  });

  it("rejects paths that escape the allowed scope root", async () => {
    const { uiRoot } = createMockRepoRoot();

    await expect(readScopedFile({ cwd: uiRoot }, "repo", "../secret.txt")).rejects.toThrow(
      "Path escapes the allowed OptiDev scope.",
    );
  });
});
