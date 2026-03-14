import fs from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type {
  OptiDevManifestImpactPayload,
  OptiDevManifestPayload,
  OptiDevRouteContext,
} from "./optidevContract";
import type { WorkspaceManifest } from "./optidevPersistence";
import { normalizeWorkspaceManifest, writeYaml } from "./optidevPersistence";

interface LocalProjectSession {
  active_task?: string;
  branch?: string;
  head_commit?: string;
  last_mode?: string;
}

function workspaceManifestPath(projectRoot: string): string {
  return path.join(projectRoot, ".optidev", "workspace.yaml");
}

function projectSessionPath(projectRoot: string): string {
  return path.join(projectRoot, ".optidev", "session.json");
}

async function readLocalSession(projectRoot: string): Promise<LocalProjectSession | null> {
  try {
    return JSON.parse(await fs.readFile(projectSessionPath(projectRoot), "utf8")) as LocalProjectSession;
  } catch {
    return null;
  }
}

function parseManifestContent(content: string, filePath: string): WorkspaceManifest {
  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch {
    parsed = JSON.parse(content);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Manifest root must be a mapping: ${filePath}`);
  }
  return normalizeWorkspaceManifest(parsed as Record<string, unknown>, path.basename(path.dirname(filePath)));
}

function manifestToPayload(filePath: string, content: string, manifest: WorkspaceManifest): OptiDevManifestPayload {
  return {
    path: filePath,
    content,
    manifest,
    impacts: [],
    runtimeNotes: [],
  };
}

function buildImpactEntries(
  before: WorkspaceManifest,
  after: WorkspaceManifest,
): OptiDevManifestImpactPayload[] {
  const entries: OptiDevManifestImpactPayload[] = [];
  const pushIfChanged = (field: string, previous: string, next: string, effect: string) => {
    if (previous === next) {
      return;
    }
    entries.push({
      field,
      before: previous,
      after: next,
      effect,
    });
  };

  pushIfChanged(
    "workspace.active_task",
    before.workspace.active_task,
    after.workspace.active_task,
    "Changes bootstrap focus, restore context, and the active task shown in memory/session views after the next lifecycle action.",
  );
  pushIfChanged(
    "workspace.branch",
    before.workspace.branch,
    after.workspace.branch,
    "Changes the branch OptiDev expects this workspace to align with on the next start/resume/reset flow.",
  );
  pushIfChanged(
    "workspace.head_commit",
    before.workspace.head_commit,
    after.workspace.head_commit,
    "Changes the pinned repository snapshot used for restore bookkeeping and can invalidate the current local session contract.",
  );
  pushIfChanged(
    "workspace.mux",
    before.workspace.mux,
    after.workspace.mux,
    "Changes only the declared workspace intent right now; the live runtime backend is not fully switched by this field alone yet.",
  );
  pushIfChanged(
    "agents",
    `${before.agents.length} configured`,
    `${after.agents.length} configured`,
    "Changes which repo-local agents are resolved and which runner becomes primary at startup.",
  );
  pushIfChanged(
    "layout",
    `${before.layout.length} panes`,
    `${after.layout.length} panes`,
    "Changes the generated workspace tab layout on the next bootstrap.",
  );
  pushIfChanged(
    "services",
    `${before.services.length} hooks`,
    `${after.services.length} hooks`,
    "Changes which dev services OptiDev launches on the next start/reset.",
  );
  pushIfChanged(
    "tests.command",
    before.tests.command,
    after.tests.command,
    "Changes the tests hook command used on the next workspace bootstrap.",
  );
  pushIfChanged(
    "logs.command",
    before.logs.command,
    after.logs.command,
    "Changes the logs hook source used on the next workspace bootstrap.",
  );
  pushIfChanged(
    "context",
    `${before.context.agents_dir} | ${before.context.skills_dir} | ${before.context.mcp_dir}`,
    `${after.context.agents_dir} | ${after.context.skills_dir} | ${after.context.mcp_dir}`,
    "Changes where OptiDev loads repo-local agents, skills, and MCP configs from.",
  );

  return entries;
}

function buildManifestLevers(manifest: WorkspaceManifest): OptiDevManifestImpactPayload[] {
  return [
    {
      field: "workspace.active_task",
      before: manifest.workspace.active_task || "unset",
      after: manifest.workspace.active_task || "unset",
      effect: "Changes bootstrap focus, restore context, and the active task shown in memory/session views after the next lifecycle action.",
    },
    {
      field: "workspace.branch",
      before: manifest.workspace.branch || "unset",
      after: manifest.workspace.branch || "unset",
      effect: "Changes the branch OptiDev expects this workspace to align with on the next start/resume/reset flow.",
    },
    {
      field: "workspace.mux",
      before: manifest.workspace.mux || "unset",
      after: manifest.workspace.mux || "unset",
      effect: "Keeps the declared runtime intent visible even before the live backend fully changes.",
    },
    {
      field: "agents",
      before: `${manifest.agents.length} configured`,
      after: `${manifest.agents.length} configured`,
      effect: "Declares which repo-local agents are resolved and which runner becomes primary at startup.",
    },
    {
      field: "services",
      before: `${manifest.services.length} hooks`,
      after: `${manifest.services.length} hooks`,
      effect: "Declares which dev services OptiDev can launch and surface beside the chat session.",
    },
  ];
}

function buildRuntimeNotes(
  manifest: WorkspaceManifest,
  session: LocalProjectSession | null,
): string[] {
  const lines = [
    "Runtime controls are secondary. They apply the saved manifest to start, resume, reset, stop, or clone workspace state.",
    "Save the manifest first when you want the next runtime action to honor new branch/task/hook/layout settings.",
    "Stop only affects the live session. It does not modify the manifest.",
    "Workspace clone creates another manifest under .optidev/workspaces/<name>/workspace.yaml instead of mutating the current one.",
  ];

  if (!session) {
    lines.push("No local .optidev/session.json exists yet. The next start will materialize runtime state from this manifest.");
    return lines;
  }

  if ((session.active_task ?? "") !== manifest.workspace.active_task) {
    lines.push(
      `Current local session still records active_task='${session.active_task ?? ""}', so save + start/resume is needed to align with '${manifest.workspace.active_task}'.`,
    );
  }
  if ((session.branch ?? "") !== manifest.workspace.branch) {
    lines.push(
      `Current local session branch is '${session.branch ?? ""}', while the manifest expects '${manifest.workspace.branch}'.`,
    );
  }
  if ((session.head_commit ?? "") !== manifest.workspace.head_commit) {
    lines.push("Current local session head_commit differs from the manifest, so restore compatibility can change after the next lifecycle action.");
  }
  if (manifest.workspace.mux.trim().length > 0) {
    lines.push(
      "workspace.mux is currently a declared preference/intention field; it is not yet a complete live backend switch by itself.",
    );
  }

  return lines;
}

export async function describeOptiDevManifestRuntime(
  projectRoot: string,
  _context: OptiDevRouteContext,
): Promise<OptiDevManifestPayload> {
  const filePath = workspaceManifestPath(projectRoot);
  const content = await fs.readFile(filePath, "utf8");
  const manifest = parseManifestContent(content, filePath);
  const session = await readLocalSession(projectRoot);
  const sessionManifest: WorkspaceManifest = {
    ...manifest,
    workspace: {
      ...manifest.workspace,
      active_task: session?.active_task ?? manifest.workspace.active_task,
      branch: session?.branch ?? manifest.workspace.branch,
      head_commit: session?.head_commit ?? manifest.workspace.head_commit,
    },
  };
  const impacts = buildImpactEntries(sessionManifest, manifest);
  return {
    ...manifestToPayload(filePath, content, manifest),
    impacts: impacts.length > 0 ? impacts : buildManifestLevers(manifest),
    runtimeNotes: buildRuntimeNotes(manifest, session),
  };
}

export async function previewOptiDevManifestImpact(
  projectRoot: string,
  _context: OptiDevRouteContext,
  content: string,
): Promise<OptiDevManifestImpactPayload[]> {
  const filePath = workspaceManifestPath(projectRoot);
  const currentContent = await fs.readFile(filePath, "utf8");
  const currentManifest = parseManifestContent(currentContent, filePath);
  const draftManifest = parseManifestContent(content, filePath);
  return buildImpactEntries(currentManifest, draftManifest);
}

export async function saveOptiDevManifest(
  projectRoot: string,
  context: OptiDevRouteContext,
  content: string,
): Promise<{ lines: string[]; payload: OptiDevManifestPayload }> {
  const filePath = workspaceManifestPath(projectRoot);
  const manifest = parseManifestContent(content, filePath);
  await writeYaml(filePath, manifest);
  return {
    lines: ["Workspace manifest saved. Start, resume, or reset to apply the updated contract."],
    payload: await describeOptiDevManifestRuntime(projectRoot, context),
  };
}
