import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("./runner.mjs", import.meta.url));

async function invoke(root, args, { env = process.env, timeoutMs = 15_000 } = {}) {
  const child = spawn(process.execPath, [runner, "--root", root, ...args], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
  const [code] = await once(child, "close");
  clearTimeout(timer);
  let payload = null;
  try { payload = JSON.parse(stdout); } catch { payload = null; }
  return { code, payload, stdout, stderr };
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function baseConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    checks: [
      { id: "pass", argv: [process.execPath, "-e", "process.exit(0)"], cwd: ".", timeoutSeconds: 5, required: true },
      { id: "fail", argv: [process.execPath, "-e", "process.exit(7)"], cwd: ".", timeoutSeconds: 5, required: false },
      { id: "sleep", argv: [process.execPath, "-e", "setTimeout(() => {}, 5000)"], cwd: ".", timeoutSeconds: 1, required: false },
    ],
    fingerprintPaths: ["src", "docs/harness/config.json"],
    delivery: { provider: "github", defaultBranch: "main", requirePR: true, ...overrides.delivery },
    ...overrides,
  };
}

function tasksFile(tasks, nextId = 10) {
  return { schemaVersion: 1, nextId, tasks };
}

function task(id, extra = {}) {
  return {
    id,
    behavior: `${id} behavior`,
    acceptance: [`${id} works`],
    dependsOn: [],
    state: "not_started",
    spec: null,
    plan: null,
    verification: ["pass"],
    blockedReason: null,
    evidence: null,
    delivery: null,
    acceptanceMap: { [`${id} works`]: "check:pass" },
    ...extra,
  };
}

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "harness-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "docs/harness/runs"), { recursive: true });
  await fs.mkdir(path.join(root, "docs/harness/archive"), { recursive: true });
  await fs.writeFile(path.join(root, "src/input.txt"), "v1\n");
  await writeJson(path.join(root, "docs/harness/config.json"), baseConfig());
  await writeJson(path.join(root, "docs/harness/tasks.json"), tasksFile([
    task("F001"),
    task("F002", { dependsOn: ["F001"], verification: ["fail"], acceptanceMap: { "F002 works": "check:fail" } }),
  ]));
  await writeJson(path.join(root, "docs/harness/handoff.json"), {
    schemaVersion: 1,
    taskId: null,
    plan: null,
    git: null,
    evidenceRefs: [],
    decisions: [],
    rejectedApproaches: [],
    blockers: [],
    nextAction: "start",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  return root;
}

describe("harness runner", () => {
  it("rejects missing --root usage", async () => {
    const child = spawn(process.execPath, [runner, "context"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    const [code] = await once(child, "close");
    assert.equal(code, 2);
    assert.equal(JSON.parse(stdout).ok, false);
  });

  it("validates a well-formed fixture", async () => {
    const root = await makeRoot();
    const result = await invoke(root, ["validate"]);
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.payload.ok, true);
    const context = await invoke(root, ["context"]);
    assert.equal(context.code, 0);
    assert.deepEqual(context.payload.readyTaskIds, ["F001"]);
  });

  it("rejects malformed, duplicate, missing dependency, and cyclic state", async () => {
    const root = await makeRoot();
    await fs.writeFile(path.join(root, "docs/harness/tasks.json"), "{invalid");
    const malformed = await invoke(root, ["validate"]);
    assert.notEqual(malformed.code, 0);
    assert.equal(malformed.payload.ok, false);

    await writeJson(path.join(root, "docs/harness/tasks.json"), tasksFile([task("F001"), task("F001")]));
    const duplicate = await invoke(root, ["validate"]);
    assert.notEqual(duplicate.code, 0);

    await writeJson(path.join(root, "docs/harness/tasks.json"), tasksFile([task("F001", { dependsOn: ["F999"] })]));
    const missing = await invoke(root, ["validate"]);
    assert.notEqual(missing.code, 0);
    const blockedActivation = await invoke(root, ["transition", "F001", "active"]);
    assert.notEqual(blockedActivation.code, 0);

    await writeJson(path.join(root, "docs/harness/tasks.json"), tasksFile([
      task("F001", { dependsOn: ["F002"] }),
      task("F002", { dependsOn: ["F001"] }),
    ]));
    const cycle = await invoke(root, ["validate"]);
    assert.notEqual(cycle.code, 0);
  });

  it("enforces legal transitions and the one-active WIP limit", async () => {
    const root = await makeRoot();
    assert.equal((await invoke(root, ["transition", "F001", "verified"])).code, 1);
    assert.equal((await invoke(root, ["transition", "F001", "passing"])).code, 1);
    assert.equal((await invoke(root, ["transition", "F001", "active"])).code, 0);
    assert.equal((await invoke(root, ["transition", "F003", "active"])).code, 2);
    const second = task("F003");
    const tasks = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8"));
    tasks.tasks.push(second);
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    const wip = await invoke(root, ["transition", "F003", "active"]);
    assert.equal(wip.code, 1);
    const blocked = await invoke(root, ["transition", "F001", "blocked"]);
    assert.equal(blocked.code, 2);
    const withReason = await invoke(root, ["transition", "F001", "blocked", "--reason", "waiting"]);
    assert.equal(withReason.code, 0);
    assert.equal((await invoke(root, ["transition", "F001", "active"])).code, 0);
  });

  it("refuses empty verification, missing executables, failures, and timeouts", async () => {
    const root = await makeRoot();
    const tasks = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8"));
    tasks.tasks[0].state = "active";
    tasks.tasks[0].verification = [];
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    const empty = await invoke(root, ["verify", "F001"]);
    assert.notEqual(empty.code, 0);
    assert.notEqual(JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8")).tasks[0].state, "verified");

    tasks.tasks[0].verification = ["pass"];
    tasks.tasks[0].state = "active";
    const config = baseConfig();
    config.checks[0].argv = ["missing-harness-executable-9d137"];
    await writeJson(path.join(root, "docs/harness/config.json"), config);
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    const missingExec = await invoke(root, ["verify", "F001"]);
    assert.equal(missingExec.code, 1);
    assert.equal(missingExec.payload.ok, false);

    config.checks[0].argv = [process.execPath, "-e", "process.exit(0)"];
    tasks.tasks[0].verification = ["fail"];
    tasks.tasks[0].acceptanceMap = { "F001 works": "check:fail" };
    tasks.tasks[0].notApplicable = [{ check: "pass", rationale: "failure probe uses fail check" }];
    await writeJson(path.join(root, "docs/harness/config.json"), config);
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    const failed = await invoke(root, ["verify", "F001"]);
    assert.equal(failed.code, 1);
    const afterFail = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8")).tasks[0];
    assert.equal(afterFail.state, "active");
    assert.equal(afterFail.evidence.status, "failed");

    tasks.tasks[0].verification = ["sleep"];
    tasks.tasks[0].acceptanceMap = { "F001 works": "check:sleep" };
    tasks.tasks[0].notApplicable = [{ check: "pass", rationale: "timeout probe uses sleep" }, { check: "fail", rationale: "timeout probe uses sleep" }];
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    const timeout = await invoke(root, ["verify", "F001"]);
    assert.equal(timeout.code, 1);
    assert.equal(timeout.payload.checks[0].status, "timeout");
  });

  it("verifies a passing task, then treats source and acceptance drift as stale", async () => {
    const root = await makeRoot();
    assert.equal((await invoke(root, ["transition", "F001", "active"])).code, 0);
    const verified = await invoke(root, ["verify", "F001"]);
    assert.equal(verified.code, 0, verified.stdout);
    assert.equal(verified.payload.ok, true);
    assert.equal(verified.payload.taskState, "verified");

    await fs.writeFile(path.join(root, "src/input.txt"), "changed\n");
    const staleSource = await invoke(root, ["validate"]);
    assert.equal(staleSource.code, 1);
    assert.match(staleSource.payload.errors.join("\n"), /stale/);

    await fs.writeFile(path.join(root, "src/input.txt"), "v1\n");
    const tasks = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8"));
    tasks.tasks[0].acceptance.push("new requirement");
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    const staleAcceptance = await invoke(root, ["validate"]);
    assert.equal(staleAcceptance.code, 1);

    const config = JSON.parse(await fs.readFile(path.join(root, "docs/harness/config.json"), "utf8"));
    // restore acceptance then change config
    tasks.tasks[0].acceptance = ["F001 works"];
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    config.checks[0].timeoutSeconds += 1;
    await writeJson(path.join(root, "docs/harness/config.json"), config);
    const staleConfig = await invoke(root, ["validate"]);
    assert.equal(staleConfig.code, 1);
  });

  it("fails when inputs change during verification", async () => {
    const root = await makeRoot();
    const config = baseConfig();
    const mutator = path.join(root, "mutate.mjs");
    await fs.writeFile(mutator, `import { writeFileSync } from "node:fs"; writeFileSync(new URL("./src/input.txt", import.meta.url), "mutated\\n");`);
    config.checks.push({
      id: "mutate",
      argv: [process.execPath, mutator],
      cwd: ".",
      timeoutSeconds: 5,
      required: false,
    });
    await writeJson(path.join(root, "docs/harness/config.json"), config);
    const tasks = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8"));
    tasks.tasks[0].state = "active";
    tasks.tasks[0].verification = ["pass", "mutate"];
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    const result = await invoke(root, ["verify", "F001"]);
    assert.equal(result.code, 1);
    assert.notEqual(JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8")).tasks[0].state, "verified");
  });

  it("preserves handoff prose while refreshing objective facts", async () => {
    const root = await makeRoot();
    await writeJson(path.join(root, "docs/harness/handoff.json"), {
      schemaVersion: 1,
      taskId: null,
      plan: "PLAN.md",
      git: null,
      evidenceRefs: [],
      decisions: ["keep native runner"],
      rejectedApproaches: ["copy eval fixture as production"],
      blockers: ["no product implementation yet"],
      nextAction: "activate F001",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal((await invoke(root, ["transition", "F001", "active"])).code, 0);
    const result = await invoke(root, ["handoff"]);
    assert.equal(result.code, 0, result.stdout);
    const saved = JSON.parse(await fs.readFile(path.join(root, "docs/harness/handoff.json"), "utf8"));
    assert.deepEqual(saved.decisions, ["keep native runner"]);
    assert.deepEqual(saved.rejectedApproaches, ["copy eval fixture as production"]);
    assert.equal(saved.nextAction, "activate F001");
    assert.equal(saved.taskId, "F001");
    assert.notEqual(saved.updatedAt, "2026-01-01T00:00:00.000Z");
  });

  it("recovers unfinished attempts as interrupted", async () => {
    const root = await makeRoot();
    await writeJson(path.join(root, "docs/harness/runs/run-open.json"), {
      schemaVersion: 1,
      id: "run-open",
      taskId: "F001",
      status: "running",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      checks: [],
      errors: [],
    });
    const result = await invoke(root, ["validate"]);
    assert.equal(result.code, 0);
    const recovered = JSON.parse(await fs.readFile(path.join(root, "docs/harness/runs/run-open.json"), "utf8"));
    assert.equal(recovered.status, "interrupted");
    assert.notEqual(recovered.endedAt, null);
  });

  it("archives a passing task and treats the archived dependency as satisfied", async () => {
    const root = await makeRoot();
    const tasks = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8"));
    tasks.tasks[0].state = "passing";
    tasks.tasks[0].evidence = { status: "passed", attemptId: "run-1", fingerprintBefore: "x", fingerprintAfter: "x" };
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasks);
    // freshness will fail validate; archive validates with freshness. Seed fingerprint by verifying instead.
    await writeJson(path.join(root, "docs/harness/tasks.json"), tasksFile([
      task("F001", { state: "not_started" }),
      task("F002", { dependsOn: ["F001"], verification: ["pass"], acceptanceMap: { "F002 works": "check:pass" } }),
    ]));
    assert.equal((await invoke(root, ["transition", "F001", "active"])).code, 0);
    assert.equal((await invoke(root, ["verify", "F001"])).code, 0);
    const afterVerify = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8"));
    afterVerify.tasks[0].state = "passing";
    afterVerify.tasks[0].delivery = { implementationRevision: "abc", remote: "local", prUrl: "http://example.test/pr/1", checkRuns: [], observedAt: "2026-01-01T00:00:00.000Z" };
    await writeJson(path.join(root, "docs/harness/tasks.json"), afterVerify);
    const dry = await invoke(root, ["archive", "F001", "--dry-run"]);
    assert.equal(dry.code, 0);
    assert.equal(JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8")).tasks[0].id, "F001");
    const archived = await invoke(root, ["archive", "F001"]);
    assert.equal(archived.code, 0, archived.stdout);
    const live = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8"));
    assert.equal(live.tasks.some((item) => item.id === "F001"), false);
    const activate = await invoke(root, ["transition", "F002", "active"]);
    assert.equal(activate.code, 0, activate.stdout);
  });

  it("refuses concurrent writers and reports missing git/auth on deliver", async () => {
    const root = await makeRoot();
    await fs.writeFile(path.join(root, "docs/harness/state.lock"), `${JSON.stringify({ pid: process.pid, startedAt: "2026-01-01T00:00:00.000Z" })}\n`);
    const locked = await invoke(root, ["transition", "F001", "active"]);
    assert.equal(locked.code, 1);
    await fs.unlink(path.join(root, "docs/harness/state.lock"));

    const deadLock = path.join(root, "docs/harness/state.lock");
    await fs.writeFile(deadLock, `${JSON.stringify({ pid: 99999999, startedAt: "2026-01-01T00:00:00.000Z" })}\n`);
    const recoveredLock = await invoke(root, ["transition", "F001", "active"]);
    assert.equal(recoveredLock.code, 0, recoveredLock.stdout);

    const noGit = await fs.mkdtemp(path.join(os.tmpdir(), "harness-nogit-"));
    await fs.mkdir(path.join(noGit, "src"), { recursive: true });
    await fs.mkdir(path.join(noGit, "docs/harness/runs"), { recursive: true });
    await fs.mkdir(path.join(noGit, "docs/harness/archive"), { recursive: true });
    await fs.writeFile(path.join(noGit, "src/input.txt"), "v1\n");
    await writeJson(path.join(noGit, "docs/harness/config.json"), baseConfig());
    await writeJson(path.join(noGit, "docs/harness/tasks.json"), tasksFile([task("F001", { state: "verified", evidence: { status: "passed", attemptId: "a", fingerprintBefore: "x", fingerprintAfter: "x" } })]));
    await writeJson(path.join(noGit, "docs/harness/handoff.json"), {
      schemaVersion: 1, taskId: null, plan: null, git: null, evidenceRefs: [], decisions: [], rejectedApproaches: [], blockers: [], nextAction: "x", updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const deliver = await invoke(noGit, ["deliver", "F001", "--dry-run"]);
    assert.notEqual(deliver.code, 0);
  });

  it("simulates GitHub delivery success, CI failure, and closeout without publishing", async () => {
    const root = await makeRoot();
    const bin = path.join(root, "fake-bin");
    await fs.mkdir(bin, { recursive: true });
    const gh = path.join(bin, "gh");
    await fs.writeFile(gh, `#!/bin/sh
cmd="$1"
shift
case "$cmd" in
  auth) exit 0 ;;
  pr)
    sub="$1"; shift
    if [ "$sub" = "view" ]; then echo '{"url":"https://example.test/pr/1","number":1,"isDraft":true}'; exit 0; fi
    if [ "$sub" = "create" ]; then echo '{"url":"https://example.test/pr/1"}'; exit 0; fi
    if [ "$sub" = "checks" ]; then
      if [ -n "$GH_FAIL_CHECKS" ]; then echo '[{"name":"ci","state":"FAILURE","conclusion":"failure","link":"https://example.test/check"}]'; exit 0; fi
      echo '[{"name":"ci","state":"SUCCESS","conclusion":"success","link":"https://example.test/check"}]'
      exit 0
    fi
    ;;
esac
exit 0
`);
    await fs.chmod(gh, 0o755);
    await execGit(root, ["init", "-b", "main"]);
    await execGit(root, ["config", "user.email", "harness@example.test"]);
    await execGit(root, ["config", "user.name", "Harness"]);
    const remote = await fs.mkdtemp(path.join(os.tmpdir(), "harness-remote-"));
    await execGit(remote, ["init", "--bare", "-b", "main"]);
    await execGit(root, ["remote", "add", "origin", remote]);
    await execGit(root, ["add", "."]);
    await execGit(root, ["commit", "-m", "init"]);
    await execGit(root, ["checkout", "-b", "feat/f001"]);
    assert.equal((await invoke(root, ["transition", "F001", "active"])).code, 0);
    assert.equal((await invoke(root, ["verify", "F001"])).code, 0);
    await execGit(root, ["add", "-A"]);
    await execGit(root, ["commit", "-m", "verified F001", "--allow-empty"]);

    const failEnv = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GH_FAIL_CHECKS: "1" };
    const failedCi = await invoke(root, ["deliver", "F001"], { env: failEnv });
    assert.equal(failedCi.code, 1);
    assert.equal(JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8")).tasks[0].state, "verified");

    const okEnv = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` };
    const delivered = await invoke(root, ["deliver", "F001"], { env: okEnv });
    assert.equal(delivered.code, 0, delivered.stdout);
    const passing = JSON.parse(await fs.readFile(path.join(root, "docs/harness/tasks.json"), "utf8")).tasks[0];
    assert.equal(passing.state, "passing");
    assert.equal(passing.delivery.prUrl, "https://example.test/pr/1");
  });
});

function gitEnv() {
  const env = { ...process.env };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_PREFIX",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ]) {
    delete env[key];
  }
  return env;
}

async function execGit(cwd, args) {
  const child = spawn("git", ["-C", cwd, ...args], {
    cwd,
    env: gitEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const [code] = await once(child, "close");
  if (code !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
}
