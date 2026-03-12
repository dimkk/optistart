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
