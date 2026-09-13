#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const SCHEMA_VERSION = 1;
const GIT_ENV_BLOCKLIST = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_PREFIX",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
];

export function gitEnv(base = process.env) {
  const env = { ...base };
  for (const key of GIT_ENV_BLOCKLIST) delete env[key];
  return env;
}

async function runGit(root, args) {
  return execFile("git", ["-C", root, ...args], { cwd: root, env: gitEnv() });
}
const HARNESS = "docs/harness";
const STATE_FILES = {
  config: `${HARNESS}/config.json`,
  tasks: `${HARNESS}/tasks.json`,
  handoff: `${HARNESS}/handoff.json`,
  install: `${HARNESS}/install.json`,
  lock: `${HARNESS}/state.lock`,
  handoffMarkdown: `${HARNESS}/SESSION_HANDOFF.md`,
};
const ID_RE = /^F\d{3,}$/;
const TASK_STATES = new Set(["not_started", "active", "blocked", "verified", "passing"]);
const EXCLUDED_WALK_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "runs",
  "archive",
]);
const EXCLUDED_WALK_FILES = new Set([
  "state.lock",
  "handoff.json",
  "install.json",
  "SESSION_HANDOFF.md",
]);

export class HarnessError extends Error {
  constructor(message, exitCode = 2, details = undefined) {
    super(message);
    this.name = "HarnessError";
    this.exitCode = exitCode;
    this.details = details;
  }
}

export function json(value) {
  return `${JSON.stringify(value)}\n`;
}

export function utcNow() {
  return new Date().toISOString();
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function emit(value, exitCode = 0) {
  process.stdout.write(json(value));
  process.exitCode = exitCode;
}

export function parseCli(argv) {
  if (argv[0] !== "--root" || !argv[1] || !argv[2]) {
    throw new HarnessError("usage: harness-runner --root PATH COMMAND [arguments]", 2);
  }
  return { root: path.resolve(argv[1]), command: argv[2], rest: argv.slice(3) };
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function statOrNull(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function realRoot(root) {
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) throw new HarnessError(`root is not a directory: ${root}`);
  return fs.realpath(root);
}

export function relativeStoredPath(value) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) {
    throw new HarnessError(`path must be a non-empty relative path: ${String(value)}`, 2);
  }
  const normalized = path.posix.normalize(value.split(path.sep).join(path.posix.sep));
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new HarnessError(`path escapes root: ${value}`, 2);
  }
  return normalized;
}

export async function safePath(root, stored, { allowMissing = true } = {}) {
  const relative = relativeStoredPath(stored);
  const candidate = path.resolve(root, relative);
  const rootPrefix = `${root}${path.sep}`;
  if (candidate !== root && !candidate.startsWith(rootPrefix)) {
    throw new HarnessError(`path escapes root: ${stored}`, 2);
  }
  let probe = candidate;
  while (true) {
    const stat = await statOrNull(probe);
    if (stat) break;
    if (probe === root) break;
    probe = path.dirname(probe);
  }
  const resolvedProbe = await fs.realpath(probe);
  if (resolvedProbe !== root && !resolvedProbe.startsWith(rootPrefix)) {
    throw new HarnessError(`symlink escapes root: ${stored}`, 2);
  }
  if (!allowMissing && !(await exists(candidate))) {
    throw new HarnessError(`missing path: ${stored}`, 2);
  }
  return candidate;
}

async function readJson(root, stored, { allowMissing = false } = {}) {
  const file = await safePath(root, stored, { allowMissing });
  if (!(await exists(file))) return null;
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    throw new HarnessError(`cannot read ${stored}: ${error.message}`, 2);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new HarnessError(`malformed JSON in ${stored}: ${error.message}`, 1);
  }
}

async function atomicWrite(root, stored, value) {
  const file = await safePath(root, stored);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  const body = typeof value === "string" ? value : json(value);
  await fs.writeFile(temporary, body, "utf8");
  await fs.rename(temporary, file);
}

async function sha256File(file) {
  return createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

function shouldSkipWalk(relative, name) {
  if (EXCLUDED_WALK_NAMES.has(name)) return true;
  if (EXCLUDED_WALK_FILES.has(name)) return true;
  if (relative === `${HARNESS}/runs` || relative.startsWith(`${HARNESS}/runs/`)) return true;
  if (relative === `${HARNESS}/archive` || relative.startsWith(`${HARNESS}/archive/`)) return true;
  if (name.endsWith(".tsbuildinfo") || name.startsWith(".tmp-") || name.includes(".tmp-")) return true;
  return false;
}

async function walkFiles(root, stored) {
  const file = await safePath(root, stored, { allowMissing: true });
  const stat = await statOrNull(file);
  if (!stat) throw new HarnessError(`fingerprint input is missing: ${stored}`, 1);
  if (stat.isSymbolicLink()) {
    await safePath(root, stored, { allowMissing: false });
    const target = await fs.realpath(file);
    const rootPrefix = `${root}${path.sep}`;
    if (target !== root && !target.startsWith(rootPrefix)) {
      throw new HarnessError(`fingerprint symlink escapes root: ${stored}`, 1);
    }
    const targetStat = await fs.stat(target);
    if (targetStat.isDirectory()) return walkResolvedDirectory(root, stored, target);
    return [{ path: stored, sha256: await sha256File(file) }];
  }
  if (stat.isFile()) return [{ path: stored, sha256: await sha256File(file) }];
  if (!stat.isDirectory()) throw new HarnessError(`unsupported fingerprint input: ${stored}`, 1);
  return walkResolvedDirectory(root, stored, file);
}

async function walkResolvedDirectory(root, stored, directory) {
  const names = (await fs.readdir(directory)).sort();
  const records = [];
  for (const name of names) {
    const childStored = `${stored}/${name}`;
    if (shouldSkipWalk(childStored, name)) continue;
    records.push(...await walkFiles(root, childStored));
  }
  return records;
}

function taskIdentity(task) {
  return {
    id: task.id,
    behavior: task.behavior,
    acceptance: task.acceptance,
    spec: task.spec ?? null,
    plan: task.plan ?? null,
    verification: task.verification,
    acceptanceMap: task.acceptanceMap ?? null,
    notApplicable: task.notApplicable ?? null,
  };
}

export async function fingerprint(root, config, tasks) {
  const records = [];
  for (const stored of config.fingerprintPaths ?? []) {
    records.push(...await walkFiles(root, stored));
  }
  records.sort((a, b) => a.path.localeCompare(b.path));
  const projection = {
    config,
    files: records,
    tasks: (tasks?.tasks ?? []).map((task) => taskIdentity(task)),
  };
  return { digest: createHash("sha256").update(canonicalJson(projection)).digest("hex"), files: records };
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

export async function acquireLock(root) {
  const lock = await safePath(root, STATE_FILES.lock);
  await fs.mkdir(path.dirname(lock), { recursive: true });
  const payload = json({ pid: process.pid, startedAt: utcNow() });

  async function tryCreate() {
    try {
      const handle = await fs.open(lock, "wx");
      await handle.writeFile(payload);
      await handle.close();
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      return false;
    }
  }

  if (await tryCreate()) {
    return async () => fs.unlink(lock).catch(() => {});
  }

  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(lock, "utf8"));
  } catch {
    existing = {};
  }
  if (!processAlive(existing.pid)) {
    await fs.unlink(lock).catch(() => {});
    if (await tryCreate()) return async () => fs.unlink(lock).catch(() => {});
  }
  throw new HarnessError("harness state is locked by another writer", 1);
}

async function loadState(root) {
  const config = await readJson(root, STATE_FILES.config);
  const tasks = await readJson(root, STATE_FILES.tasks);
  const handoff = await readJson(root, STATE_FILES.handoff, { allowMissing: true });
  if (!config || !tasks) throw new HarnessError("harness is not initialized", 2);
  return { config, tasks, handoff };
}

function taskById(tasks, id) {
  return tasks.tasks.find((task) => task.id === id);
}

async function archivedTasks(root) {
  const directory = await safePath(root, `${HARNESS}/archive`);
  if (!(await exists(directory))) return [];
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const result = [];
  for (const name of names) {
    const value = await readJson(root, `${HARNESS}/archive/${name}`);
    if (value?.task?.id) result.push(value.task);
    else if (value?.id) result.push(value);
  }
  return result;
}

function checkMap(config) {
  return new Map((config.checks ?? []).map((check) => [check.id, check]));
}

function detectCycles(tasks, archived) {
  const all = new Map([...tasks, ...archived].map((task) => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];
  function visit(id, stack = []) {
    if (visiting.has(id)) {
      const index = stack.indexOf(id);
      cycles.push([...stack.slice(index), id].join(" -> "));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const task = all.get(id);
    for (const dependency of task?.dependsOn ?? []) visit(dependency, [...stack, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of tasks) visit(task.id);
  return cycles;
}

export function validateConfig(config) {
  const errors = [];
  if (config?.schemaVersion !== SCHEMA_VERSION) errors.push("config schemaVersion must be 1");
  if (!Array.isArray(config?.checks)) errors.push("config checks must be an array");
  const ids = new Set();
  for (const check of config?.checks ?? []) {
    if (!check || typeof check !== "object") {
      errors.push("check must be an object");
      continue;
    }
    if (typeof check.id !== "string" || !check.id) errors.push("check id must be non-empty");
    if (ids.has(check.id)) errors.push(`duplicate check id: ${check.id}`);
    ids.add(check.id);
    if (!Array.isArray(check.argv) || check.argv.length === 0 || check.argv.some((part) => typeof part !== "string" || !part)) {
      errors.push(`check ${check.id} argv must be a non-empty argv array`);
    }
    if (typeof check.cwd !== "string" || path.isAbsolute(check.cwd) || check.cwd.includes("..")) {
      errors.push(`check ${check.id} cwd must be relative`);
    }
    if (typeof check.timeoutSeconds !== "number" || check.timeoutSeconds <= 0) {
      errors.push(`check ${check.id} timeoutSeconds must be positive`);
    }
    if (typeof check.required !== "boolean") errors.push(`check ${check.id} required must be boolean`);
  }
  if (!Array.isArray(config?.fingerprintPaths) || config.fingerprintPaths.length === 0) {
    errors.push("config fingerprintPaths must be non-empty");
  }
  if (config?.delivery && typeof config.delivery !== "object") errors.push("config delivery must be an object");
  return errors;
}

export async function validateState(root, state, { includeFreshness = true } = {}) {
  const { config, tasks, handoff } = state;
  const errors = [...validateConfig(config)];
  const archived = await archivedTasks(root).catch(() => []);
  const allIds = new Set();
  let maxNumericId = 0;
  let activeCount = 0;
  if (tasks?.schemaVersion !== SCHEMA_VERSION) errors.push("tasks schemaVersion must be 1");
  if (!Array.isArray(tasks?.tasks)) errors.push("tasks tasks must be an array");
  for (const task of tasks?.tasks ?? []) {
    if (!task || typeof task !== "object") {
      errors.push("task must be an object");
      continue;
    }
    if (!ID_RE.test(task.id ?? "")) errors.push(`invalid task id: ${task.id}`);
    if (allIds.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
    allIds.add(task.id);
    maxNumericId = Math.max(maxNumericId, Number(String(task.id).slice(1)) || 0);
    if (typeof task.behavior !== "string" || !task.behavior.trim()) errors.push(`${task.id} behavior is required`);
    if (!Array.isArray(task.acceptance) || task.acceptance.length === 0 || task.acceptance.some((item) => typeof item !== "string" || !item.trim())) {
      errors.push(`${task.id} acceptance must be non-empty`);
    }
    if (!Array.isArray(task.dependsOn)) errors.push(`${task.id} dependsOn must be an array`);
    if (!TASK_STATES.has(task.state)) errors.push(`${task.id} has invalid state ${task.state}`);
    if (task.state === "active") activeCount += 1;
    if (task.state === "blocked" && (!task.blockedReason || typeof task.blockedReason !== "string")) {
      errors.push(`${task.id} blocked state requires blockedReason`);
    }
    if (task.spec != null && (typeof task.spec !== "string" || path.isAbsolute(task.spec))) {
      errors.push(`${task.id} spec must be relative or null`);
    }
    if (task.plan != null && (typeof task.plan !== "string" || path.isAbsolute(task.plan))) {
      errors.push(`${task.id} plan must be relative or null`);
    }
    if (!Array.isArray(task.verification)) errors.push(`${task.id} verification must be an array`);
    for (const checkId of task.verification ?? []) {
      if (!checkMap(config).has(checkId)) errors.push(`${task.id} references unknown check ${checkId}`);
    }
    if (task.evidence != null && typeof task.evidence !== "object") errors.push(`${task.id} evidence must be an object or null`);
    if (task.state === "verified" || task.state === "passing") {
      if (task.evidence?.status !== "passed") errors.push(`${task.id} ${task.state} requires passed evidence`);
      if (!task.evidence?.attemptId) errors.push(`${task.id} ${task.state} requires an attemptId`);
      if (includeFreshness && task.evidence?.status === "passed") {
        try {
          const current = await fingerprint(root, config, tasks);
          const expected = task.evidence.fingerprintAfter ?? task.evidence.fingerprintBefore;
          if (current.digest !== expected) errors.push(`${task.id} evidence is stale`);
        } catch (error) {
          errors.push(`${task.id} freshness unavailable: ${error.message}`);
        }
      }
    }
  }
  for (const task of archived) {
    if (allIds.has(task.id)) errors.push(`duplicate live/archive task id: ${task.id}`);
    allIds.add(task.id);
    maxNumericId = Math.max(maxNumericId, Number(String(task.id).slice(1)) || 0);
  }
  if (!Number.isInteger(tasks?.nextId) || tasks.nextId <= maxNumericId) {
    errors.push("tasks nextId must exceed every allocated numeric id");
  }
  if (activeCount > 1) errors.push("at most one task may be active");
  const liveIds = new Set((tasks?.tasks ?? []).map((task) => task.id));
  const archivedIds = new Set(archived.map((task) => task.id));
  for (const task of tasks?.tasks ?? []) {
    for (const dependency of task.dependsOn ?? []) {
      if (!liveIds.has(dependency) && !archivedIds.has(dependency)) {
        errors.push(`${task.id} depends on missing task ${dependency}`);
      }
    }
  }
  errors.push(...detectCycles(tasks?.tasks ?? [], archived).map((cycle) => `dependency cycle: ${cycle}`));
  for (const task of tasks?.tasks ?? []) {
    for (const stored of [task.spec, task.plan]) {
      if (stored && !(await exists(await safePath(root, stored)))) {
        errors.push(`${task.id} references missing artifact ${stored}`);
      }
    }
  }
  if (handoff?.taskId != null && handoff.taskId !== "" && !allIds.has(handoff.taskId)) {
    errors.push(`handoff references missing task ${handoff.taskId}`);
  }
  return { errors, archived };
}

async function recoverRunningAttempts(root) {
  const directory = await safePath(root, `${HARNESS}/runs`);
  if (!(await exists(directory))) return [];
  const recovered = [];
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith(".json"));
  for (const name of names) {
    const stored = `${HARNESS}/runs/${name}`;
    const record = await readJson(root, stored);
    if (record?.status === "running") {
      record.status = "interrupted";
      record.endedAt = utcNow();
      record.errors = [...(record.errors ?? []), "recovered unfinished attempt as interrupted"];
      await atomicWrite(root, stored, record);
      recovered.push(record.id ?? name);
    }
  }
  return recovered;
}

export async function gitInfo(root) {
  try {
    const [branch, revision, status] = await Promise.all([
      runGit(root, ["branch", "--show-current"]),
      runGit(root, ["rev-parse", "HEAD"]),
      runGit(root, ["status", "--porcelain"]),
    ]);
    return {
      available: true,
      branch: branch.stdout.trim() || null,
      revision: revision.stdout.trim() || null,
      dirty: Boolean(status.stdout.trim()),
    };
  } catch {
    return null;
  }
}

function passingIds(tasks, archived) {
  const ids = new Set(tasks.tasks.filter((task) => task.state === "passing").map((task) => task.id));
  for (const task of archived) {
    if (task.state === "passing") ids.add(task.id);
  }
  return ids;
}

export function readyTaskIds(tasks, archived = []) {
  const passing = passingIds(tasks, archived);
  return tasks.tasks
    .filter((task) => task.state === "not_started" && (task.dependsOn ?? []).every((id) => passing.has(id)))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
    .map((task) => task.id);
}

function defaultHandoff() {
  return {
    schemaVersion: SCHEMA_VERSION,
    taskId: null,
    plan: "PLAN.md",
    git: null,
    evidenceRefs: [],
    decisions: [],
    rejectedApproaches: [],
    blockers: [],
    nextAction: "Activate F001 and record the pinned public-reference baseline in local-only notes.",
    updatedAt: utcNow(),
  };
}

function renderHandoffMarkdown(handoff) {
  const bullets = (items) => (Array.isArray(items) && items.length ? items.map((item) => `- ${item}`).join("\n") : "- None recorded");
  const git = handoff.git;
  const gitLine = git
    ? `${git.branch ?? "unknown"} @ ${git.revision ?? "unknown"}${git.dirty ? " (dirty)" : ""}`
    : "unavailable";
  return `# Session handoff

This is a readable view of \`docs/harness/handoff.json\`. Update decisions, rejected approaches, blockers, and nextAction in that JSON source. The handoff command preserves them while refreshing objective facts.

## Current checkpoint

- Updated at: ${handoff.updatedAt}
- Task: ${handoff.taskId ?? "none"}
- Plan: ${handoff.plan ?? "none"}
- Git: ${gitLine}
- Evidence refs:
${bullets(handoff.evidenceRefs)}

## Next action

${handoff.nextAction || "Inspect the ready queue."}

## Decisions

${bullets(handoff.decisions)}

## Rejected approaches

${bullets(handoff.rejectedApproaches)}

## Blockers

${bullets(handoff.blockers)}
`;
}

export async function commandContext(root) {
  const state = await loadState(root);
  await recoverRunningAttempts(root);
  const validation = await validateState(root, state);
  const freshness = {};
  for (const task of state.tasks.tasks) {
    if (task.evidence?.status === "passed") {
      try {
        const current = await fingerprint(root, state.config, state.tasks);
        freshness[task.id] = {
          fresh: current.digest === (task.evidence.fingerprintAfter ?? task.evidence.fingerprintBefore),
          digest: current.digest,
          expected: task.evidence.fingerprintAfter ?? task.evidence.fingerprintBefore,
        };
      } catch (error) {
        freshness[task.id] = { fresh: false, reason: error.message };
      }
    }
  }
  const active = state.tasks.tasks.find((task) => task.state === "active") ?? null;
  const archived = validation.archived;
  emit({
    ok: validation.errors.length === 0,
    schemaVersion: SCHEMA_VERSION,
    git: await gitInfo(root),
    activeTask: active?.id ?? null,
    readyTaskIds: readyTaskIds(state.tasks, archived),
    blockers: state.tasks.tasks.filter((task) => task.state === "blocked").map((task) => ({ id: task.id, reason: task.blockedReason })),
    evidenceFreshness: freshness,
    nextAction: state.handoff?.nextAction ?? null,
    errors: validation.errors,
  }, validation.errors.length ? 1 : 0);
}

export async function commandTasks(root) {
  const state = await loadState(root);
  const validation = await validateState(root, state, { includeFreshness: false });
  emit({
    ok: validation.errors.length === 0,
    tasks: state.tasks.tasks,
    readyTaskIds: readyTaskIds(state.tasks, validation.archived),
    errors: validation.errors,
  }, validation.errors.length ? 1 : 0);
}

export async function commandValidate(root) {
  try {
    const state = await loadState(root);
    await recoverRunningAttempts(root);
    const validation = await validateState(root, state);
    emit({ ok: validation.errors.length === 0, errors: validation.errors }, validation.errors.length ? 1 : 0);
  } catch (error) {
    const code = error instanceof HarnessError ? error.exitCode : 2;
    emit({ ok: false, errors: [error.message] }, code);
  }
}

function parseFlag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

export async function commandTransition(root, args) {
  const id = args[0];
  const target = args[1];
  if (!id || !target) throw new HarnessError("usage: transition ID STATE", 2);
  const release = await acquireLock(root);
  try {
    const state = await loadState(root);
    const validation = await validateState(root, state, { includeFreshness: false });
    if (validation.errors.length) throw new HarnessError("state is invalid; transition refused", 1, validation.errors);
    const task = taskById(state.tasks, id);
    if (!task) throw new HarnessError(`unknown live task: ${id}`, 2);
    if (target === "active") {
      if (!["not_started", "blocked", "verified"].includes(task.state)) {
        throw new HarnessError(`${id} cannot transition ${task.state} -> active`, 1);
      }
      if (task.state !== "verified" && state.tasks.tasks.some((item) => item.state === "active" && item.id !== id)) {
        throw new HarnessError("WIP limit reached: another task is active", 1);
      }
      const passing = passingIds(state.tasks, validation.archived);
      if (!(task.dependsOn ?? []).every((dependency) => passing.has(dependency))) {
        throw new HarnessError(`${id} has unsatisfied dependencies`, 1);
      }
      task.state = "active";
      task.blockedReason = null;
    } else if (target === "blocked") {
      if (task.state !== "active") throw new HarnessError(`${id} can only become blocked from active`, 1);
      const reason = parseFlag(args, "--reason");
      if (!reason) throw new HarnessError("blocked transition requires --reason TEXT", 2);
      task.state = "blocked";
      task.blockedReason = reason;
    } else if (target === "verified") {
      throw new HarnessError("verified is produced only by verify ID", 1);
    } else if (target === "passing") {
      throw new HarnessError("passing is produced only by deliver ID", 1);
    } else {
      throw new HarnessError(`unsupported transition target: ${target}`, 2);
    }
    await atomicWrite(root, STATE_FILES.tasks, state.tasks);
    emit({ ok: true, command: "transition", id, state: task.state });
  } finally {
    await release();
  }
}

function runtimeFacts() {
  return { node: process.version, platform: process.platform, arch: process.arch };
}

async function runCheck(root, check, logFile) {
  const cwd = await safePath(root, check.cwd ?? ".");
  const started = Date.now();
  return new Promise((resolve) => {
    let child;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({
        id: check.id,
        argv: check.argv,
        cwd: check.cwd ?? ".",
        status: result.status,
        exitCode: result.exitCode ?? null,
        logPath: logFile,
        durationMs: Date.now() - started,
        error: result.error,
        stdout,
        stderr,
      });
    };
    try {
      child = spawn(check.argv[0], check.argv.slice(1), {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
    } catch (error) {
      finish({ status: error.code === "ENOENT" ? "missing_executable" : "failed", error: error.message, exitCode: null });
      return;
    }
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
      setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } }, 250);
    }, Math.max(1, Number(check.timeoutSeconds ?? 120)) * 1000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      finish({ status: error.code === "ENOENT" ? "missing_executable" : "failed", error: error.message, exitCode: null });
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (timedOut) finish({ status: "timeout", error: "check timed out", exitCode: code });
      else if (code === 0) finish({ status: "passed", exitCode: code });
      else finish({ status: "failed", error: `exit ${code ?? "null"}${signal ? ` signal ${signal}` : ""}`, exitCode: code });
    });
  });
}

function evaluateAcceptance(task, checkResults) {
  const errors = [];
  const byId = new Map(checkResults.map((item) => [item.id, item]));
  const mapping = task.acceptanceMap && typeof task.acceptanceMap === "object" ? task.acceptanceMap : null;
  const manualResults = task.evidence?.manualResults && typeof task.evidence.manualResults === "object"
    ? task.evidence.manualResults
    : {};
  for (const criterion of task.acceptance ?? []) {
    if (!mapping) {
      const failed = checkResults.filter((item) => item.status !== "passed");
      if (failed.length) errors.push(`acceptance unmet for ${criterion}`);
      continue;
    }
    const reference = mapping[criterion];
    if (typeof reference !== "string") {
      errors.push(`no evidence mapping for acceptance criterion: ${criterion}`);
      continue;
    }
    if (reference.startsWith("check:")) {
      const checkId = reference.slice("check:".length);
      const result = byId.get(checkId);
      if (!result || result.status !== "passed") errors.push(`acceptance check did not pass: ${checkId}`);
    } else if (reference.startsWith("manual:")) {
      const key = reference.slice("manual:".length);
      if (manualResults[key] !== "passed") errors.push(`manual evidence is not established: ${reference}`);
    } else {
      errors.push(`unsupported evidence reference: ${reference}`);
    }
  }
  return errors;
}

export async function commandVerify(root, args) {
  const id = args[0];
  if (!id) throw new HarnessError("usage: verify ID", 2);
  const release = await acquireLock(root);
  let attemptStored;
  try {
    const state = await loadState(root);
    const validation = await validateState(root, state, { includeFreshness: false });
    if (validation.errors.length) throw new HarnessError("state is invalid; verification refused", 1, validation.errors);
    const task = taskById(state.tasks, id);
    if (!task) throw new HarnessError(`unknown live task: ${id}`, 2);
    if (task.state !== "active") throw new HarnessError(`${id} must be active before verify`, 1);
    if (!Array.isArray(task.verification) || task.verification.length === 0) {
      throw new HarnessError("verification list is empty; product readiness cannot be established", 1);
    }
    const requiredChecks = (state.config.checks ?? []).filter((check) => check.required);
    const notApplicable = new Map((task.notApplicable ?? []).map((item) => [item.check, item.rationale]));
    for (const check of requiredChecks) {
      if (!task.verification.includes(check.id) && !notApplicable.has(check.id)) {
        throw new HarnessError(`required check ${check.id} is neither listed nor marked not applicable`, 1);
      }
      if (notApplicable.has(check.id) && (!notApplicable.get(check.id) || !String(notApplicable.get(check.id)).trim())) {
        throw new HarnessError(`notApplicable for ${check.id} requires rationale`, 1);
      }
    }
    const attemptId = `run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    attemptStored = `${HARNESS}/runs/${attemptId}.json`;
    const logStored = `${HARNESS}/runs/${attemptId}.log`;
    const attempt = {
      schemaVersion: SCHEMA_VERSION,
      id: attemptId,
      taskId: id,
      status: "running",
      startedAt: utcNow(),
      endedAt: null,
      fingerprintBefore: null,
      fingerprintAfter: null,
      checks: [],
      runtime: runtimeFacts(),
      errors: [],
    };
    await atomicWrite(root, attemptStored, attempt);
    await atomicWrite(root, logStored, `attempt ${attemptId} started\n`);
    try {
      attempt.fingerprintBefore = (await fingerprint(root, state.config, state.tasks)).digest;
    } catch (error) {
      attempt.status = "failed";
      attempt.endedAt = utcNow();
      attempt.errors.push(error.message);
      task.evidence = { status: "failed", attemptId, failure: { classification: "input_error", message: error.message } };
      await atomicWrite(root, attemptStored, attempt);
      await atomicWrite(root, STATE_FILES.tasks, state.tasks);
      emit({ ok: false, id, attemptId, status: attempt.status, failure: attempt.errors }, 1);
      return;
    }
    const checks = checkMap(state.config);
    for (const checkId of task.verification) {
      const check = checks.get(checkId);
      if (!check) {
        attempt.checks.push({ id: checkId, argv: [], cwd: ".", status: "missing_check", exitCode: null, logPath: logStored });
        continue;
      }
      const result = await runCheck(root, check, logStored);
      attempt.checks.push({
        id: result.id,
        argv: result.argv,
        cwd: result.cwd,
        status: result.status,
        exitCode: result.exitCode,
        logPath: result.logPath,
      });
      await fs.appendFile(await safePath(root, logStored), `\n[${checkId}] ${result.argv.join(" ")}\n${result.stdout}${result.stderr}\nstatus=${result.status}\n`, "utf8");
      await atomicWrite(root, attemptStored, attempt);
    }
    try {
      attempt.fingerprintAfter = (await fingerprint(root, state.config, state.tasks)).digest;
    } catch (error) {
      attempt.status = "failed";
      attempt.errors.push(error.message);
    }
    const acceptanceErrors = evaluateAcceptance(task, attempt.checks);
    const failedChecks = attempt.checks.filter((result) => result.status !== "passed");
    if (attempt.fingerprintAfter && attempt.fingerprintBefore !== attempt.fingerprintAfter) {
      attempt.errors.push("configured inputs changed while checks ran");
    }
    attempt.errors.push(...acceptanceErrors);
    const passed = attempt.errors.length === 0 && failedChecks.length === 0 && Boolean(attempt.fingerprintAfter);
    attempt.status = passed ? "passed" : "failed";
    attempt.endedAt = utcNow();
    if (passed) {
      task.state = "verified";
      task.evidence = {
        status: "passed",
        attemptId,
        fingerprintBefore: attempt.fingerprintBefore,
        fingerprintAfter: attempt.fingerprintAfter,
        checks: attempt.checks.map(({ id: checkId, status }) => ({ id: checkId, status })),
        verifiedAt: attempt.endedAt,
      };
    } else {
      task.evidence = {
        status: "failed",
        attemptId,
        failure: { classification: failedChecks.length ? "check_failed" : "verification_failed", errors: attempt.errors },
        checks: attempt.checks.map(({ id: checkId, status }) => ({ id: checkId, status })),
      };
    }
    await atomicWrite(root, attemptStored, attempt);
    await atomicWrite(root, STATE_FILES.tasks, state.tasks);
    emit({
      ok: passed,
      id,
      attemptId,
      status: attempt.status,
      taskState: task.state,
      checks: attempt.checks.map(({ id: checkId, status }) => ({ id: checkId, status })),
      errors: attempt.errors,
    }, passed ? 0 : 1);
  } finally {
    await release();
  }
}

export async function commandHandoff(root) {
  const release = await acquireLock(root);
  try {
    const state = await loadState(root);
    const validation = await validateState(root, state, { includeFreshness: false });
    if (state.handoff?.taskId && !state.tasks.tasks.some((task) => task.id === state.handoff.taskId) && !(await archivedTasks(root)).some((task) => task.id === state.handoff.taskId)) {
      throw new HarnessError(`handoff references missing task ${state.handoff.taskId}`, 1);
    }
    const previous = state.handoff ?? defaultHandoff();
    const active = state.tasks.tasks.find((task) => task.state === "active") ?? null;
    const evidenceRefs = [];
    if (active?.evidence?.attemptId) evidenceRefs.push(`${HARNESS}/runs/${active.evidence.attemptId}.json`);
    const next = {
      schemaVersion: SCHEMA_VERSION,
      taskId: active?.id ?? previous.taskId ?? null,
      plan: active?.plan ?? previous.plan ?? "PLAN.md",
      git: await gitInfo(root),
      evidenceRefs,
      decisions: previous.decisions ?? [],
      rejectedApproaches: previous.rejectedApproaches ?? [],
      blockers: previous.blockers ?? [],
      nextAction: previous.nextAction ?? "",
      updatedAt: utcNow(),
    };
    if (validation.errors.length && next.taskId) {
      // still refresh objective facts; caller sees errors in payload
    }
    await atomicWrite(root, STATE_FILES.handoff, next);
    await atomicWrite(root, STATE_FILES.handoffMarkdown, renderHandoffMarkdown(next));
    emit({ ok: true, handoff: next });
  } finally {
    await release();
  }
}

export async function commandArchive(root, args) {
  const id = args.find((item) => item !== "--dry-run");
  const dryRun = args.includes("--dry-run");
  if (!id) throw new HarnessError("usage: archive ID [--dry-run]", 2);
  const release = await acquireLock(root);
  try {
    const state = await loadState(root);
    const validation = await validateState(root, state);
    if (validation.errors.length) throw new HarnessError("state is invalid; archive refused", 1, validation.errors);
    const index = state.tasks.tasks.findIndex((task) => task.id === id);
    if (index === -1) throw new HarnessError(`unknown live task: ${id}`, 2);
    const task = state.tasks.tasks[index];
    if (task.state !== "passing") throw new HarnessError(`${id} must be passing before archive`, 1);
    const archived = { schemaVersion: SCHEMA_VERSION, archivedAt: utcNow(), task };
    if (dryRun) {
      emit({ ok: true, dryRun: true, id, archive: archived });
      return;
    }
    const dest = `${HARNESS}/archive/${id}.json`;
    if (await exists(await safePath(root, dest))) {
      const existing = await readJson(root, dest);
      if (existing?.task?.id && existing.task.id !== id) {
        throw new HarnessError(`refusing to overwrite a different archived record at ${dest}`, 1);
      }
    }
    await atomicWrite(root, dest, archived);
    state.tasks.tasks.splice(index, 1);
    await atomicWrite(root, STATE_FILES.tasks, state.tasks);
    emit({ ok: true, id, archived: true });
  } finally {
    await release();
  }
}

async function runGh(root, config, args) {
  const argv = config.delivery?.ghArgv ?? ["gh"];
  try {
    const result = await execFile(argv[0], [...argv.slice(1), ...args], { cwd: root, timeout: 30_000 });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (error.code === "ENOENT") return { ok: false, unavailable: true, error: "GitHub CLI not available" };
    return { ok: false, error: error.stderr?.trim() || error.message, stdout: error.stdout };
  }
}

async function commandDeliver(root, args) {
  const id = args.find((item) => item !== "--dry-run");
  const dryRun = args.includes("--dry-run");
  if (!id) throw new HarnessError("usage: deliver ID [--dry-run]", 2);
  const state = await loadState(root);
  const validation = await validateState(root, state);
  const task = taskById(state.tasks, id);
  if (!task) throw new HarnessError(`unknown live task: ${id}`, 2);
  const git = await gitInfo(root);
  const defaultBranch = state.config.delivery?.defaultBranch ?? "master";
  const missing = [];
  if (task.state !== "verified") missing.push(`${id} must be verified before deliver`);
  if (validation.errors.length) missing.push(...validation.errors);
  if (!git) missing.push("git is unavailable");
  if (git?.dirty) missing.push("working tree is dirty");
  if (git?.branch && git.branch === defaultBranch) missing.push(`refusing to deliver from default branch ${defaultBranch}`);
  let current = null;
  try {
    current = await fingerprint(root, state.config, state.tasks);
  } catch (error) {
    missing.push(error.message);
  }
  const expected = task.evidence?.fingerprintAfter ?? task.evidence?.fingerprintBefore;
  const fresh = Boolean(current && expected && current.digest === expected && task.evidence?.status === "passed");
  if (task.state === "verified" && !fresh) missing.push(`${id} evidence is stale`);

  const report = {
    ok: false,
    command: "deliver",
    dryRun,
    id,
    git,
    evidenceFresh: fresh,
    remote: null,
    prUrl: task.delivery?.prUrl ?? null,
    missing,
    proposedActions: [],
  };

  if (dryRun) {
    if (!missing.length) report.proposedActions.push("push feature branch", "open or reuse draft PR", "wait for required CI", "record delivery evidence");
    report.ok = missing.length === 0;
    emit(report, report.ok ? 0 : 1);
    return;
  }

  if (missing.length) {
    emit(report, 1);
    return;
  }

  const release = await acquireLock(root);
  try {
    const remoteResult = await runGit(root, ["remote", "get-url", "origin"]).catch(() => null);
    if (!remoteResult) {
      report.missing.push("git remote origin is unavailable");
      emit(report, 1);
      return;
    }
    report.remote = remoteResult.stdout.trim();
    const push = await runGit(root, ["push", "-u", "origin", git.branch]).catch((error) => error);
    if (push instanceof Error) {
      report.missing.push(`git push failed: ${push.stderr?.trim() || push.message}`);
      emit(report, 1);
      return;
    }
    const auth = await runGh(root, state.config, ["auth", "status"]);
    if (!auth.ok) {
      report.missing.push(auth.unavailable ? "GitHub CLI not available" : `GitHub auth failed: ${auth.error}`);
      emit({ ...report, unavailable: Boolean(auth.unavailable) }, 1);
      return;
    }
    let prUrl = null;
    const viewed = await runGh(root, state.config, ["pr", "view", "--json", "url,number,isDraft"]);
    if (viewed.ok) {
      try { prUrl = JSON.parse(viewed.stdout).url; } catch { prUrl = null; }
    }
    if (!prUrl) {
      const created = await runGh(root, state.config, [
        "pr", "create", "--draft", "--title", `${id}`, "--body", `Harness delivery for ${id}`,
      ]);
      if (!created.ok) {
        report.missing.push(`draft PR creation failed: ${created.error}`);
        emit(report, 1);
        return;
      }
      try { prUrl = JSON.parse(created.stdout).url; } catch { prUrl = created.stdout.trim(); }
    }
    const checks = await runGh(root, state.config, ["pr", "checks", "--json", "name,state,conclusion,link"]);
    let checkRuns = [];
    if (checks.ok) {
      try {
        const parsed = JSON.parse(checks.stdout);
        checkRuns = (Array.isArray(parsed) ? parsed : []).map((item) => ({
          name: item.name,
          revision: git.revision,
          conclusion: item.conclusion ?? item.state,
          url: item.link ?? null,
        }));
      } catch {
        checkRuns = [];
      }
    } else {
      report.missing.push(`CI observation failed: ${checks.error}`);
      emit(report, 1);
      return;
    }
    const failed = checkRuns.filter((item) => item.conclusion && !["success", "pass", "passed", "SKIPPED", "neutral"].includes(String(item.conclusion).toLowerCase()));
    const pending = checkRuns.filter((item) => ["pending", "queued", "in_progress"].includes(String(item.conclusion).toLowerCase()));
    if (failed.length || pending.length || (state.config.delivery?.requirePR && checkRuns.length === 0)) {
      report.missing.push(failed.length ? "required CI checks failed" : "required CI checks are not successful");
      report.checkRuns = checkRuns;
      report.prUrl = prUrl;
      emit(report, 1);
      return;
    }
    const latest = await loadState(root);
    const live = taskById(latest.tasks, id);
    const after = await fingerprint(root, latest.config, latest.tasks);
    if (after.digest !== expected) {
      report.missing.push("inputs changed during delivery");
      emit(report, 1);
      return;
    }
    live.delivery = {
      implementationRevision: git.revision,
      remote: report.remote,
      prUrl,
      checkRuns,
      observedAt: utcNow(),
    };
    live.state = "passing";
    await atomicWrite(root, STATE_FILES.tasks, latest.tasks);
    emit({
      ok: true,
      command: "deliver",
      id,
      state: live.state,
      delivery: live.delivery,
    });
  } finally {
    await release();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { root: requestedRoot, command, rest } = parseCli(argv);
  const root = await realRoot(requestedRoot);
  if (command === "context") await commandContext(root);
  else if (command === "tasks") await commandTasks(root);
  else if (command === "validate") await commandValidate(root);
  else if (command === "verify") await commandVerify(root, rest);
  else if (command === "handoff") await commandHandoff(root);
  else if (command === "archive") await commandArchive(root, rest);
  else if (command === "transition") await commandTransition(root, rest);
  else if (command === "deliver") await commandDeliver(root, rest);
  else throw new HarnessError(`unsupported command: ${command}`, 2);
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch((error) => {
    const code = error instanceof HarnessError ? error.exitCode : 2;
    emit({ ok: false, error: error.message, details: error.details ?? null }, code);
  });
}

