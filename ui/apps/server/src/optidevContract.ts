import { existsSync } from "node:fs";
import path from "node:path";

export interface OptiDevProjectRecord {
  name: string;
  path: string;
}

export interface OptiDevStatePayload {
  status: string;
  logs: string;
  projects: OptiDevProjectRecord[];
  memorySummary: string[];
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
