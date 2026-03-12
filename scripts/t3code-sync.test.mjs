import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { T3CodeSyncError, bootstrapMetadata, refreshVendor, shouldIgnoreVendorPath } from "./t3code-sync-lib.mjs";

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [`command failed: ${command} ${args.join(" ")}`, result.stderr?.trim(), result.stdout?.trim()]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.stdout.trim();
}

async function withTempDirectory(prefix, operation) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await operation(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeFiles(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = path.join(root, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }
}

function initRepo(repoPath) {
  run("git", ["init", "--quiet", "--initial-branch=main"], repoPath);
  run("git", ["config", "user.name", "Codex"], repoPath);
  run("git", ["config", "user.email", "codex@example.com"], repoPath);
}

function commitAll(repoPath, message) {
  run("git", ["add", "-A"], repoPath);
  run("git", ["commit", "--quiet", "-m", message], repoPath);
  return run("git", ["rev-parse", "HEAD"], repoPath);
}

async function createUpstreamRepo(basePath) {
  const upstreamPath = path.join(basePath, "upstream");
  await mkdir(upstreamPath, { recursive: true });
  initRepo(upstreamPath);

  await writeFiles(upstreamPath, {
    "AGENTS.md": "# upstream instructions\n",
    "README.md": "# T3 Code\n",
    "apps/server/src/index.ts": [
      'export const version = "base";',
      "",
      "export function startServer() {",
      '  return "server";',
      "}",
      "",
    ].join("\n"),
    "apps/web/src/routes/home.tsx": 'export const Home = () => "base";\n',
    "bun.lock": "lock-a\n",
  });
  await symlink("AGENTS.md", path.join(upstreamPath, "CLAUDE.md"));

  const baseCommit = commitAll(upstreamPath, "base upstream");

  await writeFiles(upstreamPath, {
    "apps/server/src/index.ts": [
      'export const version = "upstream-next";',
      "",
      "export function startServer() {",
      '  return "server";',
      "}",
      "",
    ].join("\n"),
    "apps/web/src/routes/home.tsx": 'export const Home = () => "upstream-next";\n',
    "apps/server/src/upstreamOnly.ts": 'export const upstreamOnly = true;\n',
    "bun.lock": "lock-b\n",
  });

  const targetCommit = commitAll(upstreamPath, "next upstream");
  return { upstreamPath, baseCommit, targetCommit };
}

async function createOuterRepo(basePath, upstreamPath, baseCommit) {
  const repoRoot = path.join(basePath, "outer");
  await mkdir(repoRoot, { recursive: true });
  initRepo(repoRoot);

  const uiPath = path.join(repoRoot, "ui");
  run("git", ["clone", "--quiet", upstreamPath, uiPath], repoRoot);
  run("git", ["checkout", "--quiet", baseCommit], uiPath);
  await rm(path.join(uiPath, ".git"), { recursive: true, force: true });

  await writeFiles(repoRoot, {
    "ui/apps/server/src/index.ts":
      [
        'export const version = "base";',
        "",
        "export function startServer() {",
        '  return "server";',
        "}",
        "",
        'export const optiDevOverlay = "present";',
        "",
      ].join("\n"),
    "ui/apps/server/src/optidev.ts": 'export const optidev = "overlay";\n',
  });

  commitAll(repoRoot, "vendor base with overlay");
  return repoRoot;
}

async function createConflictUpstreamRepo(basePath) {
  const upstreamPath = path.join(basePath, "conflict-upstream");
  await mkdir(upstreamPath, { recursive: true });
  initRepo(upstreamPath);

  await writeFiles(upstreamPath, {
    "apps/server/src/wsServer.ts": [
      'import { expandHomePath } from "./os-jank.ts";',
      "",
      "export function createServer(req, res, port, requestBody, cwd) {",
      "  const handleRequest = () => {",
      '    const url = new URL(req.url ?? "/", `http://localhost:${port}`);',
      "    if (tryHandleProjectFaviconRequest(url, res)) {",
      "      return;",
      "    }",
      "  };",
      "  return handleRequest;",
      "}",
      "",
    ].join("\n"),
    "apps/web/src/components/Sidebar.tsx": [
      'import { ChevronRightIcon, FolderIcon, GitPullRequestIcon } from "lucide-react";',
      'import { useNavigate, useParams } from "@tanstack/react-router";',
      "",
      "export default function Sidebar() {",
      "  const navigate = useNavigate();",
      "  return (",
      "    <>",
      '      <SidebarContent className="gap-0">',
      '        <SidebarGroup className="px-2 py-2">',
      '          <div>Projects</div>',
      "        </SidebarGroup>",
      "      </SidebarContent>",
      "    </>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "apps/web/vitest.browser.config.ts": [
      'import { fileURLToPath } from "node:url";',
      'import { playwright } from "@vitest/browser-playwright";',
      'import { defineConfig, mergeConfig } from "vitest/config";',
      "",
      'import viteConfig from "./vite.config";',
      "",
      'const srcPath = fileURLToPath(new URL("./src", import.meta.url));',
      "",
      "export default mergeConfig(",
      "  viteConfig,",
      "  defineConfig({",
      "    resolve: {",
      "      alias: {",
      '        "~": srcPath,',
      "      },",
      "    },",
      "    test: {",
      '      include: ["src/components/ChatView.browser.tsx"],',
      "      browser: {",
      "        enabled: true,",
      "        provider: playwright(),",
      '        instances: [{ browser: "chromium" }],',
      "        headless: true,",
      "      },",
      "    },",
      "  }),",
      ");",
      "",
    ].join("\n"),
  });

  const baseCommit = commitAll(upstreamPath, "conflict base");

  await writeFiles(upstreamPath, {
    "apps/server/src/wsServer.ts": [
      'import { expandHomePath } from "./os-jank.ts";',
      'import { makeServerPushBus } from "./wsServer/pushBus.ts";',
      "",
      "export function createServer(req, res, port, requestBody, cwd) {",
      "  const handleRequest = () => {",
      '    const url = new URL(req.url ?? "/", `http://localhost:${port}`);',
      "    const pushBus = makeServerPushBus();",
      "    void pushBus;",
      "    if (tryHandleProjectFaviconRequest(url, res)) {",
      "      return;",
      "    }",
      "  };",
      "  return handleRequest;",
      "}",
      "",
    ].join("\n"),
    "apps/web/src/components/Sidebar.tsx": [
      'import { ChevronRightIcon, FolderIcon, GitPullRequestIcon, SettingsIcon, TriangleAlertIcon } from "lucide-react";',
      'import { useLocation, useNavigate, useParams } from "@tanstack/react-router";',
      "",
      "export default function Sidebar() {",
      "  const navigate = useNavigate();",
      '  const isOnSettings = useLocation({ select: (loc) => loc.pathname === "/settings" });',
      "  void isOnSettings;",
      "  return (",
      "    <>",
      '      <SidebarContent className="gap-0">',
      '        <SidebarGroup className="px-2 pt-2 pb-0">',
      '          <div className="warning">Warning</div>',
      "        </SidebarGroup>",
      '        <SidebarGroup className="px-2 py-2">',
      '          <div>Projects</div>',
      "        </SidebarGroup>",
      "      </SidebarContent>",
      "    </>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "apps/web/vitest.browser.config.ts": [
      'import { fileURLToPath } from "node:url";',
      'import { playwright } from "@vitest/browser-playwright";',
      'import { defineConfig, mergeConfig } from "vitest/config";',
      "",
      'import viteConfig from "./vite.config";',
      "",
      'const srcPath = fileURLToPath(new URL("./src", import.meta.url));',
      "",
      "export default mergeConfig(",
      "  viteConfig,",
      "  defineConfig({",
      "    resolve: {",
      "      alias: {",
      '        "~": srcPath,',
      "      },",
      "    },",
      "    test: {",
      "      include: [",
      '        "src/components/ChatView.browser.tsx",',
      '        "src/components/KeybindingsToast.browser.tsx",',
      "      ],",
      "      browser: {",
      "        enabled: true,",
      "        provider: playwright(),",
      '        instances: [{ browser: "chromium" }],',
      "        headless: true,",
      "      },",
      "    },",
      "  }),",
      ");",
      "",
    ].join("\n"),
  });

  const targetCommit = commitAll(upstreamPath, "conflict target");
  return { upstreamPath, baseCommit, targetCommit };
}

async function createConflictOuterRepo(basePath, upstreamPath, baseCommit) {
  const repoRoot = path.join(basePath, "conflict-outer");
  await mkdir(repoRoot, { recursive: true });
  initRepo(repoRoot);

  const uiPath = path.join(repoRoot, "ui");
  run("git", ["clone", "--quiet", upstreamPath, uiPath], repoRoot);
  run("git", ["checkout", "--quiet", baseCommit], uiPath);
  await rm(path.join(uiPath, ".git"), { recursive: true, force: true });

  await writeFiles(repoRoot, {
    "ui/apps/server/src/wsServer.ts": [
      'import { expandHomePath } from "./os-jank.ts";',
      'import { tryHandleOptiDevRequest } from "./optidevRoute";',
      "",
      "export function createServer(req, res, port, requestBody, cwd) {",
      "  const handleRequest = () => {",
      '    const url = new URL(req.url ?? "/", `http://localhost:${port}`);',
      "    if (",
      "      tryHandleOptiDevRequest(req, url, requestBody, res, {",
      "        cwd,",
      "        homeDir: process.env.OPTIDEV_HOME,",
      "      })",
      "    ) {",
      "      return;",
      "    }",
      "    if (tryHandleProjectFaviconRequest(url, res)) {",
      "      return;",
      "    }",
      "  };",
      "  return handleRequest;",
      "}",
      "",
    ].join("\n"),
    "ui/apps/web/src/components/Sidebar.tsx": [
      'import { ChevronRightIcon, FolderIcon, FolderOpenIcon, GitPullRequestIcon } from "lucide-react";',
      'import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";',
      "",
      "export default function Sidebar() {",
      "  const navigate = useNavigate();",
      '  const pathname = useRouterState({ select: (state) => state.location.pathname });',
      "  return (",
      "    <>",
      '      <SidebarContent className="gap-0">',
      '        <SidebarGroup className="px-2 pb-0 pt-2">',
      "          <SidebarMenu>",
      "            <SidebarMenuItem>",
      '              <SidebarMenuButton data-testid="sidebar-optidev" data-active={pathname === "/optidev"} onClick={() => { void navigate({ to: "/optidev" }); }}>',
      '                <FolderOpenIcon className="size-3.5 shrink-0" />',
      "                <span>OptiDev Workspace</span>",
      "              </SidebarMenuButton>",
      "            </SidebarMenuItem>",
      "          </SidebarMenu>",
      "        </SidebarGroup>",
      '        <SidebarGroup className="px-2 py-2">',
      '          <div>Projects</div>',
      "        </SidebarGroup>",
      "      </SidebarContent>",
      "    </>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "ui/apps/web/vitest.browser.config.ts": [
      'import { fileURLToPath } from "node:url";',
      'import { playwright } from "@vitest/browser-playwright";',
      'import { defineConfig, mergeConfig } from "vitest/config";',
      "",
      'import viteConfig from "./vite.config";',
      "",
      'const srcPath = fileURLToPath(new URL("./src", import.meta.url));',
      "",
      "export default mergeConfig(",
      "  viteConfig,",
      "  defineConfig({",
      "    resolve: {",
      "      alias: {",
      '        "~": srcPath,',
      "      },",
      "    },",
      "    test: {",
      '      include: ["src/components/ChatView.browser.tsx", "src/routes/-optidev.browser.tsx"],',
      "      browser: {",
      "        enabled: true,",
      "        provider: playwright(),",
      '        instances: [{ browser: "chromium" }],',
      "        headless: true,",
      "      },",
      "    },",
      "  }),",
      ");",
      "",
    ].join("\n"),
  });

  commitAll(repoRoot, "conflict overlay");
  return repoRoot;
}

test("shouldIgnoreVendorPath filters transient paths", () => {
  assert.equal(shouldIgnoreVendorPath("node_modules/react/index.js"), true);
  assert.equal(shouldIgnoreVendorPath("apps/web/playwright-report/index.html"), true);
  assert.equal(shouldIgnoreVendorPath("apps/server/src/index.ts"), false);
});

test("refreshVendor replays the local OptiDev overlay onto a newer upstream commit", async () => {
  await withTempDirectory("t3code-sync-test-", async (tempDir) => {
    const { upstreamPath, baseCommit, targetCommit } = await createUpstreamRepo(tempDir);
    const repoRoot = await createOuterRepo(tempDir, upstreamPath, baseCommit);

    await bootstrapMetadata({
      repoRoot,
      vendorDir: "ui",
      metadataPath: "ui/.t3code-upstream.json",
      upstreamUrl: upstreamPath,
      baseRef: baseCommit,
      bootstrapReason: "test bootstrap",
    });
    commitAll(repoRoot, "record metadata");

    await refreshVendor({
      repoRoot,
      vendorDir: "ui",
      metadataPath: "ui/.t3code-upstream.json",
      upstreamUrl: upstreamPath,
      targetRef: targetCommit,
    });

    const serverIndex = await readFile(path.join(repoRoot, "ui/apps/server/src/index.ts"), "utf8");
    const optidevOverlay = await readFile(path.join(repoRoot, "ui/apps/server/src/optidev.ts"), "utf8");
    const upstreamOnly = await readFile(path.join(repoRoot, "ui/apps/server/src/upstreamOnly.ts"), "utf8");
    const claudeLink = await readFile(path.join(repoRoot, "ui/CLAUDE.md"), "utf8");
    const metadata = JSON.parse(
      await readFile(path.join(repoRoot, "ui/.t3code-upstream.json"), "utf8"),
    );

    assert.match(serverIndex, /upstream-next/);
    assert.match(serverIndex, /optiDevOverlay/);
    assert.equal(optidevOverlay.trim(), 'export const optidev = "overlay";');
    assert.equal(upstreamOnly.trim(), "export const upstreamOnly = true;");
    assert.equal(claudeLink.trim(), "# upstream instructions");
    assert.equal(metadata.upstream.baseCommit, targetCommit);
    assert.equal(metadata.vendor.metadataUpdatedFrom, "refresh");
  });
});

test("refreshVendor rejects a dirty vendored tree without --allow-dirty", async () => {
  await withTempDirectory("t3code-sync-dirty-", async (tempDir) => {
    const { upstreamPath, baseCommit, targetCommit } = await createUpstreamRepo(tempDir);
    const repoRoot = await createOuterRepo(tempDir, upstreamPath, baseCommit);

    await bootstrapMetadata({
      repoRoot,
      vendorDir: "ui",
      metadataPath: "ui/.t3code-upstream.json",
      upstreamUrl: upstreamPath,
      baseRef: baseCommit,
      bootstrapReason: "test bootstrap",
    });
    commitAll(repoRoot, "record metadata");

    await writeFile(path.join(repoRoot, "ui/README.md"), "# modified locally\n", "utf8");

    await assert.rejects(
      () =>
        refreshVendor({
          repoRoot,
          vendorDir: "ui",
          metadataPath: "ui/.t3code-upstream.json",
          upstreamUrl: upstreamPath,
          targetRef: targetCommit,
        }),
      (error) => error instanceof T3CodeSyncError && error.code === "DIRTY_VENDOR_TREE",
    );
  });
});

test("refreshVendor auto-resolves known vendored refresh conflicts", async () => {
  await withTempDirectory("t3code-sync-resolvers-", async (tempDir) => {
    const { upstreamPath, baseCommit, targetCommit } = await createConflictUpstreamRepo(tempDir);
    const repoRoot = await createConflictOuterRepo(tempDir, upstreamPath, baseCommit);

    await bootstrapMetadata({
      repoRoot,
      vendorDir: "ui",
      metadataPath: "ui/.t3code-upstream.json",
      upstreamUrl: upstreamPath,
      baseRef: baseCommit,
      bootstrapReason: "conflict test bootstrap",
    });
    commitAll(repoRoot, "record metadata");

    const result = await refreshVendor({
      repoRoot,
      vendorDir: "ui",
      metadataPath: "ui/.t3code-upstream.json",
      upstreamUrl: upstreamPath,
      targetRef: targetCommit,
    });

    const wsServer = await readFile(path.join(repoRoot, "ui/apps/server/src/wsServer.ts"), "utf8");
    const sidebar = await readFile(path.join(repoRoot, "ui/apps/web/src/components/Sidebar.tsx"), "utf8");
    const vitestBrowserConfig = await readFile(
      path.join(repoRoot, "ui/apps/web/vitest.browser.config.ts"),
      "utf8",
    );

    assert.deepEqual(result.resolvedConflicts.sort(), [
      "apps/server/src/wsServer.ts",
      "apps/web/src/components/Sidebar.tsx",
      "apps/web/vitest.browser.config.ts",
    ]);
    assert.match(wsServer, /makeServerPushBus/);
    assert.match(wsServer, /tryHandleOptiDevRequest/);
    assert.match(sidebar, /data-testid="sidebar-optidev"/);
    assert.match(sidebar, /const pathname = useLocation/);
    assert.match(vitestBrowserConfig, /KeybindingsToast\.browser/);
    assert.match(vitestBrowserConfig, /-optidev\.browser\.tsx/);
  });
});
