import fs from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type {
  OptiDevActionResponse,
  OptiDevMemoryGraphEdgePayload,
  OptiDevMemoryGraphNodePayload,
  OptiDevMemoryGraphPayload,
} from "./optidevContract";

interface FeatureRecord {
  featureId: string;
  title: string;
  component: string;
  status: string;
  releases: string[];
  decisions: Array<{
    title: string;
    decision: string;
    rationale: string;
    alternatives: string;
  }>;
}

interface TaskRecord {
  taskId: string;
  title: string;
  features: string[];
}

interface ReleaseRecord {
  releaseId: string;
  title: string;
  features: string[];
}

interface OpenLoopRecord {
  featureId: string;
  description: string;
  status: string;
}

interface MemoryModel {
  project: string;
  activeFeature: string;
  features: Map<string, FeatureRecord>;
  tasks: Map<string, TaskRecord>;
  releases: Map<string, ReleaseRecord>;
  openLoops: OpenLoopRecord[];
  recentDecisionTitles: string[];
}

const FEATURE_RE = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d+\b/g;

function extractFeatureIds(text: string): string[] {
  FEATURE_RE.lastIndex = 0;
  return [...new Set(text.match(FEATURE_RE) ?? [])].sort();
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function readHeading(filePath: string): Promise<string> {
  const text = await readText(filePath);
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("# ")) {
      return line.slice(2).trim();
    }
  }
  return "";
}

async function parseMapping(filePath: string): Promise<Record<string, unknown>> {
  const text = await readText(filePath);
  let parsed: unknown;
  try {
    parsed = YAML.parse(text);
  } catch {
    parsed = JSON.parse(text);
  }
  if (parsed == null) {
    return {};
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`config root must be mapping: ${filePath}`);
  }
  return parsed as Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function sectionBullets(text: string, title: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let capture = false;
  for (const line of lines) {
    if (line.trim().toLowerCase() === `## ${title}`.toLowerCase()) {
      capture = true;
      continue;
    }
    if (capture && line.startsWith("## ")) {
      break;
    }
    if (capture && line.trim().startsWith("- ")) {
      out.push(line.trim().slice(2).trim());
    }
  }
  return out;
}

async function latestFeatureStatuses(projectRoot: string): Promise<Map<string, string>> {
  const docsDir = path.join(projectRoot, "docs");
  if (!(await exists(docsDir))) {
    return new Map();
  }
  const entries = await fs.readdir(docsDir, { withFileTypes: true });
  const releaseDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("v"))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  const statuses = new Map<string, string>();
  for (const releaseDir of releaseDirs) {
    const matrixPath = path.join(docsDir, releaseDir, "features-matrix.md");
    if (!(await exists(matrixPath))) {
      continue;
    }
    const text = await readText(matrixPath);
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("| ") || line.startsWith("| Feature ID")) {
        continue;
      }
      const parts = line
        .split("|")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (parts.length < 3) {
        continue;
      }
      const [featureId, , status] = parts;
      if (featureId !== "---" && !statuses.has(featureId)) {
        statuses.set(featureId, status);
      }
    }
  }
  return statuses;
}

export async function buildMemoryModel(projectRoot: string): Promise<MemoryModel> {
  const project = path.basename(projectRoot);
  const features = new Map<string, FeatureRecord>();
  const tasks = new Map<string, TaskRecord>();
  const releases = new Map<string, ReleaseRecord>();
  const openLoops: OpenLoopRecord[] = [];
  const recentDecisionTitles: string[] = [];
  const featureStatuses = await latestFeatureStatuses(projectRoot);

  const tasksDir = path.join(projectRoot, "docs", "tasks");
  if (await exists(tasksDir)) {
    const taskEntries = (await fs.readdir(tasksDir)).sort();
    for (const entry of taskEntries) {
      if (entry.startsWith("task") && entry.endsWith("-init.md")) {
        const filePath = path.join(tasksDir, entry);
        const taskId = entry.split("-")[0];
        const existing = tasks.get(taskId);
        tasks.set(taskId, {
          taskId,
          title: (await readHeading(filePath)) || path.parse(entry).name,
          features: existing?.features ?? [],
        });
      }
      if (entry.startsWith("task") && entry.endsWith("-init-features.md")) {
        const filePath = path.join(tasksDir, entry);
        const taskId = entry.split("-")[0];
        const task = tasks.get(taskId) ?? {
          taskId,
          title: taskId,
          features: [],
        };
        tasks.set(taskId, task);
        const text = await readText(filePath);
        task.features = extractFeatureIds(text);
      }
    }
  }

  const featuresDir = path.join(projectRoot, "docs", "features");
  if (await exists(featuresDir)) {
    const stack = [featuresDir];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".md")) {
          continue;
        }
        const heading = await readHeading(fullPath);
        if (!heading) {
          continue;
        }
        const featureId = heading.split(":", 1)[0].replace("#", "").trim();
        const title = heading.includes(":") ? heading.split(":").slice(1).join(":").trim() : featureId;
        features.set(featureId, {
          featureId,
          title: title || featureId,
          component: featureId.split("-", 1)[0],
          status: featureStatuses.get(featureId) ?? "UNKNOWN",
          releases: [],
          decisions: [],
        });
      }
    }
  }

  const docsDir = path.join(projectRoot, "docs");
  if (await exists(docsDir)) {
    const entries = await fs.readdir(docsDir, { withFileTypes: true });
    const releaseDirs = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("v"))
      .map((entry) => entry.name)
      .sort();
    for (const releaseId of releaseDirs) {
      const releaseDir = path.join(docsDir, releaseId);
      const releaseDocPath = path.join(projectRoot, "docs", "releases", `${releaseId}.md`);
      releases.set(releaseId, {
        releaseId,
        title: (await exists(releaseDocPath)) ? (await readHeading(releaseDocPath)) || releaseId : releaseId,
        features: [],
      });
      const matrixPath = path.join(releaseDir, "features-matrix.md");
      if (!(await exists(matrixPath))) {
        continue;
      }
      const text = await readText(matrixPath);
      for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith("| ") || line.startsWith("| Feature ID")) {
          continue;
        }
        const parts = line
          .split("|")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        if (parts.length < 3) {
          continue;
        }
        const featureId = parts[0];
        if (featureId === "---") {
          continue;
        }
        const release = releases.get(releaseId);
        if (release && !release.features.includes(featureId)) {
          release.features.push(featureId);
        }
        const feature = features.get(featureId);
        if (feature && !feature.releases.includes(releaseId)) {
          feature.releases.push(releaseId);
        }
      }
    }
  }

  const reportsDir = (await exists(path.join(projectRoot, "tasks-log")))
    ? path.join(projectRoot, "tasks-log")
    : path.join(projectRoot, "tasks");
  if (await exists(reportsDir)) {
    const entries = (await fs.readdir(reportsDir)).filter((entry) => entry.startsWith("task-") && entry.endsWith("-report.md")).sort();
    for (const entry of entries) {
      const filePath = path.join(reportsDir, entry);
      const text = await readText(filePath);
      const featureIds = extractFeatureIds(text);
      if (featureIds.length === 0) {
        featureIds.push("");
      }
      const decisions = sectionBullets(text, "Decisions");
      const loopItems = [...sectionBullets(text, "Open loops"), ...sectionBullets(text, "Open issues")];

      for (const featureId of featureIds) {
        const feature = featureId ? features.get(featureId) : undefined;
        for (const decision of decisions) {
          if (feature) {
            feature.decisions.unshift({
              title: decision,
              decision,
              rationale: "",
              alternatives: "",
            });
          }
          recentDecisionTitles.unshift(decision);
        }
        for (const loop of loopItems) {
          openLoops.unshift({
            featureId,
            description: loop,
            status: "open",
          });
        }
      }
    }
  }

  const localSessionPath = path.join(projectRoot, ".optidev", "session.json");
  let activeFeature = "";
  if (await exists(localSessionPath)) {
    const session = asObject(JSON.parse(await readText(localSessionPath)));
    activeFeature = asString(session?.active_task);
  }

  return {
    project,
    activeFeature,
    features,
    tasks,
    releases,
    openLoops,
    recentDecisionTitles,
  };
}

export async function nativeMemorySummary(projectRoot: string): Promise<OptiDevActionResponse> {
  const model = await buildMemoryModel(projectRoot);
  const latestRelease = [...model.releases.keys()].sort().at(-1) ?? "";
  const lastCompletedFeature =
    [...model.features.values()]
      .filter((feature) => feature.status === "DONE")
      .map((feature) => feature.featureId)
      .sort()
      .at(-1) ?? "";
  const openLoopDescriptions = model.openLoops.slice(0, 3).map((item) => item.description);
  const nextAction = model.openLoops.length > 0
    ? `address open loop: ${model.openLoops[0]?.description ?? ""}`
    : model.activeFeature
      ? `continue ${model.activeFeature}`
      : lastCompletedFeature
        ? `build on ${lastCompletedFeature}`
        : "inspect current project state";

  const lines = ["Project memory:"];
  if (latestRelease) {
    lines.push(`- release: ${latestRelease}`);
  }
  if (model.activeFeature) {
    lines.push(`- active feature: ${model.activeFeature}`);
  }
  if (lastCompletedFeature) {
    lines.push(`- last completed: ${lastCompletedFeature}`);
  }
  if (openLoopDescriptions.length > 0) {
    lines.push(`- open loops: ${openLoopDescriptions.join(", ")}`);
  }
  if (model.recentDecisionTitles.slice(0, 2).length > 0) {
    lines.push(`- key decisions: ${model.recentDecisionTitles.slice(0, 2).join(", ")}`);
  }
  if (nextAction) {
    lines.push(`- next suggested action: ${nextAction}`);
  }
  return { ok: true, lines };
}

export async function nativeMemoryOpenLoops(projectRoot: string): Promise<OptiDevActionResponse> {
  const model = await buildMemoryModel(projectRoot);
  const unresolved = model.openLoops.filter(
    (item) => !["closed", "resolved", "done"].includes(item.status),
  );
  if (unresolved.length === 0) {
    return { ok: true, lines: ["No open loops."] };
  }
  return {
    ok: true,
    lines: unresolved.map(
      (item) => `${item.featureId || "unscoped"} | ${item.status} | ${item.description}`,
    ),
  };
}

export async function nativeMemoryShow(
  projectRoot: string,
  kind: string,
  identifier: string,
): Promise<OptiDevActionResponse> {
  const model = await buildMemoryModel(projectRoot);

  if (kind === "feature") {
    const feature = model.features.get(identifier);
    if (!feature) {
      return { ok: false, lines: [`Feature '${identifier}' not found.`] };
    }
    const lines = [
      `Feature: ${feature.featureId}`,
      `Title: ${feature.title}`,
      `Component: ${feature.component}`,
      `Status: ${feature.status}`,
    ];
    if (feature.releases.length > 0) {
      lines.push(`Releases: ${feature.releases.join(", ")}`);
    }
    if (feature.decisions.length > 0) {
      lines.push("Decisions:");
      for (const item of feature.decisions) {
        lines.push(`- ${item.title}: ${item.decision}`);
        if (item.rationale) {
          lines.push(`  rationale: ${item.rationale}`);
        }
        if (item.alternatives) {
          lines.push(`  alternatives: ${item.alternatives}`);
        }
      }
    }
    return { ok: true, lines };
  }

  if (kind === "task") {
    const task = model.tasks.get(identifier);
    if (!task) {
      return { ok: false, lines: [`Task '${identifier}' not found.`] };
    }
    const lines = [`Task: ${task.taskId}`, `Title: ${task.title}`];
    if (task.features.length > 0) {
      lines.push(`Features: ${task.features.join(", ")}`);
    }
    return { ok: true, lines };
  }

  if (kind === "release") {
    const release = model.releases.get(identifier);
    if (!release) {
      return { ok: false, lines: [`Release '${identifier}' not found.`] };
    }
    const lines = [`Release: ${release.releaseId}`, `Title: ${release.title}`];
    if (release.features.length > 0) {
      lines.push(`Features: ${release.features.join(", ")}`);
    }
    return { ok: true, lines };
  }

  return { ok: false, lines: ["Usage: optid memory show [feature|task|release] <id>"] };
}

export async function buildMemoryGraphPayload(projectRoot: string): Promise<OptiDevMemoryGraphPayload> {
  const model = await buildMemoryModel(projectRoot);
  const nodes: OptiDevMemoryGraphNodePayload[] = [];
  const edges: OptiDevMemoryGraphEdgePayload[] = [];
  let decisionCount = 0;

  nodes.push({
    id: `project:${model.project}`,
    kind: "project",
    label: model.project,
    status: null,
    group: "project",
    highlight: true,
  });

  for (const release of [...model.releases.values()].sort((left, right) => left.releaseId.localeCompare(right.releaseId))) {
    nodes.push({
      id: `release:${release.releaseId}`,
      kind: "release",
      label: release.releaseId,
      status: null,
      group: "release",
      highlight: false,
    });
    edges.push({
      source: `project:${model.project}`,
      target: `release:${release.releaseId}`,
      kind: "tracks-release",
    });
  }

  for (const task of [...model.tasks.values()].sort((left, right) => left.taskId.localeCompare(right.taskId))) {
    nodes.push({
      id: `task:${task.taskId}`,
      kind: "task",
      label: task.taskId,
      status: null,
      group: "task",
      highlight: false,
    });
    edges.push({
      source: `project:${model.project}`,
      target: `task:${task.taskId}`,
      kind: "tracks-task",
    });
  }

  for (const feature of [...model.features.values()].sort((left, right) => left.featureId.localeCompare(right.featureId))) {
    nodes.push({
      id: `feature:${feature.featureId}`,
      kind: "feature",
      label: feature.featureId,
      status: feature.status,
      group: feature.component,
      highlight: feature.featureId === model.activeFeature,
    });
    edges.push({
      source: `project:${model.project}`,
      target: `feature:${feature.featureId}`,
      kind: feature.featureId === model.activeFeature ? "active-feature" : "tracks-feature",
    });

    for (const releaseId of feature.releases) {
      edges.push({
        source: `release:${releaseId}`,
        target: `feature:${feature.featureId}`,
        kind: "ships",
      });
    }

    for (const [taskId, task] of model.tasks.entries()) {
      if (task.features.includes(feature.featureId)) {
        edges.push({
          source: `task:${taskId}`,
          target: `feature:${feature.featureId}`,
          kind: "implements",
        });
      }
    }

    feature.decisions.forEach((decision, index) => {
      const nodeId = `decision:${feature.featureId}:${index}`;
      decisionCount += 1;
      nodes.push({
        id: nodeId,
        kind: "decision",
        label: decision.title,
        status: null,
        group: feature.component,
        highlight: false,
      });
      edges.push({
        source: `feature:${feature.featureId}`,
        target: nodeId,
        kind: "decides",
      });
    });
  }

  model.openLoops.forEach((loop, index) => {
    const featureId = loop.featureId || model.activeFeature;
    const nodeId = `open_loop:${index}`;
    nodes.push({
      id: nodeId,
      kind: "open_loop",
      label: loop.description,
      status: loop.status,
      group: featureId || "unscoped",
      highlight: false,
    });
    if (featureId) {
      edges.push({
        source: `feature:${featureId}`,
        target: nodeId,
        kind: "open-loop",
      });
    } else {
      edges.push({
        source: `project:${model.project}`,
        target: nodeId,
        kind: "open-loop",
      });
    }
  });

  return {
    project: model.project,
    focusNodeId: model.activeFeature ? `feature:${model.activeFeature}` : null,
    nodes,
    edges,
    stats: {
      features: model.features.size,
      tasks: model.tasks.size,
      releases: model.releases.size,
      decisions: decisionCount,
      openLoops: model.openLoops.length,
    },
    implementationNotes: [
      "Keep ingestion artifact-backed: every node should be traceable to docs, reports, releases, or session state.",
      "Start with deterministic lane layout by node kind, then add force or dagre-style layout only after filters and pinning exist.",
      "Preserve graph IDs across refreshes so selection, expansion, and future persisted user state stay stable.",
      "Use the graph as navigation over memory, not as a separate source of truth.",
    ],
  };
}
