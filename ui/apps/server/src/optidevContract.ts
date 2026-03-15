import { existsSync } from "node:fs";
import path from "node:path";

export interface OptiDevProjectRecord {
  name: string;
  path: string;
}

export type OptiDevFileScope = "repo" | "agents" | "skills";

export interface OptiDevFileEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  size: number | null;
}

export interface OptiDevDirectoryPayload {
  scope: OptiDevFileScope;
  path: string;
  entries: OptiDevFileEntry[];
}

export interface OptiDevFilePayload {
  scope: OptiDevFileScope;
  path: string;
  name: string;
  kind: "markdown" | "image" | "code" | "text" | "binary";
  language: string | null;
  content: string | null;
  size: number;
  editable: boolean;
}

export interface OptiDevWorkspaceManifestPayload {
  project: string;
  workspace: {
    active_task: string;
    branch: string;
    head_commit: string;
    mux: string;
  };
  agents: Array<{
    name: string;
    runner: string;
  }>;
  layout: Array<{
    name: string;
    pane: string;
  }>;
  services: Array<{
    name: string;
    command: string;
  }>;
  tests: {
    command: string;
  };
  logs: {
    command: string;
  };
  context: {
    agents_dir: string;
    skills_dir: string;
    mcp_dir: string;
  };
}

export interface OptiDevManifestImpactPayload {
  field: string;
  before: string;
  after: string;
  effect: string;
}

export interface OptiDevManifestPayload {
  path: string;
  content: string;
  manifest: OptiDevWorkspaceManifestPayload;
  impacts: OptiDevManifestImpactPayload[];
  runtimeNotes: string[];
}

export interface OptiDevMemoryGraphNodePayload {
  id: string;
  kind: "project" | "release" | "task" | "feature" | "decision" | "open_loop";
  label: string;
  status: string | null;
  group: string;
  highlight: boolean;
}

export interface OptiDevMemoryGraphEdgePayload {
  source: string;
  target: string;
  kind: string;
}

export interface OptiDevMemoryGraphPayload {
  project: string;
  focusNodeId: string | null;
  nodes: OptiDevMemoryGraphNodePayload[];
  edges: OptiDevMemoryGraphEdgePayload[];
  stats: {
    features: number;
    tasks: number;
    releases: number;
    decisions: number;
    openLoops: number;
  };
  implementationNotes: string[];
}

export interface OptiDevPluginInventoryEntryPayload {
  id: string;
  title: string;
  category: "analysis" | "integration" | "catalog";
  enabled: boolean;
  summary: string;
  details: string[];
}

export interface OptiDevSessionPayload {
  project: string | null;
  projectPath: string | null;
  status: string;
  muxBackend: string | null;
  sessionName: string | null;
  runner: string | null;
  hooksRunning: number;
  hooksTotal: number;
  mode: string | null;
  branch: string | null;
  headCommit: string | null;
  activeTask: string | null;
  agentsCount: number;
  manifestValid: boolean;
}

export interface OptiDevTelegramConfigPayload {
  botToken: string;
  chatId: string;
  bridge?: OptiDevTelegramBridgeStatusPayload;
}

export interface OptiDevTelegramBridgeStatusPayload {
  enabled: boolean;
  chatId: string;
  tokenHint: string;
  targetThreadId: string | null;
  targetUpdatedAt: string | null;
  statusLine: string;
}

export interface OptiDevRunnerInventoryEntry {
  alias: number;
  runner: string;
  guid: string;
  cwd: string | null;
  latestUserPhrase: string | null;
  runtimeStatus: string;
  sessionStatus: string | null;
  lastSeenAt: string;
  manifestStatus: "present" | "missing";
  manifestNote: string | null;
}

export interface OptiDevBuildInfoPayload {
  localT3Version: string | null;
  upstreamT3Version: string | null;
  upstreamT3Subject: string | null;
  optidProdVersion: string | null;
  optidNightlyVersion: string | null;
}

export interface OptiDevStatePayload {
  repoRoot: string;
  status: string;
  logs: string;
  projects: OptiDevProjectRecord[];
  memorySummary: string[];
  session: OptiDevSessionPayload;
}

export interface OptiDevActionPayload {
  action?: string;
  target?: string;
  cwd?: string;
  advice?: boolean;
  name?: string;
  kind?: string;
  identifier?: string;
  command?: string;
  args?: string[];
  scope?: OptiDevFileScope;
  path?: string;
  content?: string;
  botToken?: string;
  chatId?: string;
  threadId?: string;
  threadTitle?: string;
}

export interface OptiDevActionResponse {
  ok: boolean;
  lines: string[];
  state?: OptiDevStatePayload;
  data?: unknown;
}

export interface OptiDevRouteContext {
  cwd: string;
  homeDir?: string | undefined;
}

function isRepoRoot(candidate: string): boolean {
  return (
    existsSync(path.join(candidate, "scripts", "optid")) &&
    existsSync(path.join(candidate, "ui", "apps", "server")) &&
    existsSync(path.join(candidate, "ui", "apps", "web"))
  );
}

export function resolveOptiDevProjectRoot(startCwd: string): string {
  let current = path.resolve(startCwd);

  for (;;) {
    if (isRepoRoot(current)) {
      return current;
    }

    if (
      existsSync(path.join(current, "apps", "server")) &&
      existsSync(path.join(current, "apps", "web"))
    ) {
      const parent = path.dirname(current);
      if (isRepoRoot(parent)) {
        return parent;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startCwd);
    }
    current = parent;
  }
}
