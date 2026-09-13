import { DatabaseSync } from "node:sqlite";
import { AUTH_SCOPE, WORKSPACE_ROLE, type AuthScope, type WorkspaceRole } from "@sec-research/domain";

export interface Principal {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  scopes: AuthScope[];
  apiKey: string;
}

export interface JobRecord {
  id: string;
  workspaceId: string;
  state: string;
  kind: string;
}

export interface WorkspaceState {
  principals: Principal[];
  jobs: JobRecord[];
  datasetOwners: Record<string, string>;
  watchOwners: Record<string, string>;
  quotas: Record<string, number>;
}

export interface MetadataStore {
  authenticate(apiKey: string): Principal;
  upsertJob(job: JobRecord): Promise<void>;
  getJob(id: string): Promise<JobRecord | undefined>;
  listJobs(workspaceId: string): Promise<JobRecord[]>;
  setDatasetOwner(datasetId: string, workspaceId: string): Promise<void>;
  datasetOwner(datasetId: string): Promise<string | undefined>;
  setWatchOwner(watchId: string, workspaceId: string): Promise<void>;
  watchOwner(watchId: string): Promise<string | undefined>;
  setQuota(workspaceId: string, cap: number): Promise<void>;
  getQuota(workspaceId: string): Promise<number>;
  close?(): void;
}

export class WorkspaceError extends Error {
  constructor(
    message: string,
    readonly code: "permission_denied" | "budget_exceeded",
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export function emptyWorkspaceState(): WorkspaceState {
  return { principals: [], jobs: [], datasetOwners: {}, watchOwners: {}, quotas: {} };
}

export function authorize(principal: Principal, scope: AuthScope, workspaceId: string): void {
  if (principal.workspaceId !== workspaceId) {
    throw new WorkspaceError("permission_denied: workspace mismatch", "permission_denied");
  }
  if (principal.role === WORKSPACE_ROLE.VIEWER && scope !== AUTH_SCOPE.DATA_READ) {
    throw new WorkspaceError(`permission_denied: viewer cannot ${scope}`, "permission_denied");
  }
  if (!principal.scopes.includes(scope) && principal.role !== WORKSPACE_ROLE.OWNER) {
    throw new WorkspaceError(`permission_denied: missing ${scope}`, "permission_denied");
  }
}

export function assertOwned(ownerMap: Record<string, string>, id: string, workspaceId: string): void {
  if (ownerMap[id] !== workspaceId) {
    throw new WorkspaceError("permission_denied: cross-workspace read", "permission_denied");
  }
}

export function assertQuota(state: WorkspaceState, workspaceId: string, used: number): void {
  const cap = state.quotas[workspaceId] ?? 100;
  if (used >= cap) throw new WorkspaceError("budget_exceeded", "budget_exceeded");
}

export async function assertStoreQuota(store: MetadataStore, workspaceId: string, used: number): Promise<void> {
  const cap = await store.getQuota(workspaceId);
  if (used >= cap) throw new WorkspaceError("budget_exceeded", "budget_exceeded");
}

export async function assertStoreOwned(
  lookup: (id: string) => Promise<string | undefined>,
  id: string,
  workspaceId: string,
): Promise<void> {
  const owner = await lookup(id);
  if (owner !== workspaceId) {
    throw new WorkspaceError("permission_denied: cross-workspace read", "permission_denied");
  }
}

export function postgresUpsertJob(_job: JobRecord): string {
  return `INSERT INTO jobs (id, workspace_id, state, kind) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state`;
}

export function authenticate(state: WorkspaceState, apiKey: string): Principal {
  const principal = state.principals.find((item) => item.apiKey === apiKey);
  if (!principal) throw new WorkspaceError("permission_denied: bad key", "permission_denied");
  return principal;
}

export function allScopes(): AuthScope[] {
  return Object.values(AUTH_SCOPE);
}

export function seedOwner(apiKey: string, workspaceId = "ws_local"): Principal {
  return {
    id: `user_${workspaceId}`,
    workspaceId,
    role: WORKSPACE_ROLE.OWNER,
    scopes: allScopes(),
    apiKey,
  };
}

export class MemoryMetadataStore implements MetadataStore {
  constructor(readonly state: WorkspaceState = emptyWorkspaceState()) {}

  seed(principal: Principal): void {
    this.state.principals.push(principal);
  }

  authenticate(apiKey: string): Principal {
    return authenticate(this.state, apiKey);
  }

  async upsertJob(job: JobRecord): Promise<void> {
    const index = this.state.jobs.findIndex((item) => item.id === job.id);
    if (index >= 0) this.state.jobs[index] = job;
    else this.state.jobs.push(job);
  }

  async getJob(id: string): Promise<JobRecord | undefined> {
    return this.state.jobs.find((item) => item.id === id);
  }

  async listJobs(workspaceId: string): Promise<JobRecord[]> {
    return this.state.jobs.filter((item) => item.workspaceId === workspaceId);
  }

  async setDatasetOwner(datasetId: string, workspaceId: string): Promise<void> {
    this.state.datasetOwners[datasetId] = workspaceId;
  }

  async datasetOwner(datasetId: string): Promise<string | undefined> {
    return this.state.datasetOwners[datasetId];
  }

  async setWatchOwner(watchId: string, workspaceId: string): Promise<void> {
    this.state.watchOwners[watchId] = workspaceId;
  }

  async watchOwner(watchId: string): Promise<string | undefined> {
    return this.state.watchOwners[watchId];
  }

  async setQuota(workspaceId: string, cap: number): Promise<void> {
    this.state.quotas[workspaceId] = cap;
  }

  async getQuota(workspaceId: string): Promise<number> {
    return this.state.quotas[workspaceId] ?? 100;
  }
}

type SqlQuery = (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

export class PostgresMetadataStore implements MetadataStore {
  constructor(
    private readonly query: SqlQuery,
    private readonly principals: Principal[] = [],
    private readonly quotas: Record<string, number> = {},
  ) {}

  authenticate(apiKey: string): Principal {
    const principal = this.principals.find((item) => item.apiKey === apiKey);
    if (!principal) throw new WorkspaceError("permission_denied: bad key", "permission_denied");
    return principal;
  }

  async upsertJob(job: JobRecord): Promise<void> {
    await this.query(postgresUpsertJob(job), [job.id, job.workspaceId, job.state, job.kind]);
  }

  async getJob(id: string): Promise<JobRecord | undefined> {
    const result = await this.query(
      "SELECT id, workspace_id, state, kind FROM jobs WHERE id = $1",
      [id],
    );
    return mapJob(result.rows[0]);
  }

  async listJobs(workspaceId: string): Promise<JobRecord[]> {
    const result = await this.query(
      "SELECT id, workspace_id, state, kind FROM jobs WHERE workspace_id = $1",
      [workspaceId],
    );
    return result.rows.map((row) => mapJob(row)!);
  }

  async setDatasetOwner(datasetId: string, workspaceId: string): Promise<void> {
    await this.query(
      "INSERT INTO dataset_owners (id, workspace_id) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id",
      [datasetId, workspaceId],
    );
  }

  async datasetOwner(datasetId: string): Promise<string | undefined> {
    const result = await this.query("SELECT workspace_id FROM dataset_owners WHERE id = $1", [datasetId]);
    const owner = result.rows[0]?.workspace_id ?? result.rows[0]?.workspaceId;
    return owner == null ? undefined : String(owner);
  }

  async setWatchOwner(watchId: string, workspaceId: string): Promise<void> {
    await this.query(
      "INSERT INTO watch_owners (id, workspace_id) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id",
      [watchId, workspaceId],
    );
  }

  async watchOwner(watchId: string): Promise<string | undefined> {
    const result = await this.query("SELECT workspace_id FROM watch_owners WHERE id = $1", [watchId]);
    const owner = result.rows[0]?.workspace_id ?? result.rows[0]?.workspaceId;
    return owner == null ? undefined : String(owner);
  }

  async setQuota(workspaceId: string, cap: number): Promise<void> {
    this.quotas[workspaceId] = cap;
    await this.query(
      "INSERT INTO quotas (workspace_id, cap) VALUES ($1, $2) ON CONFLICT (workspace_id) DO UPDATE SET cap = EXCLUDED.cap",
      [workspaceId, cap],
    );
  }

  async getQuota(workspaceId: string): Promise<number> {
    return this.quotas[workspaceId] ?? 100;
  }
}

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, state TEXT NOT NULL, kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS principals (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, role TEXT NOT NULL, scopes TEXT NOT NULL, api_key TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS dataset_owners (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS watch_owners (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quotas (workspace_id TEXT PRIMARY KEY, cap INTEGER NOT NULL);
`;

export class SqliteMetadataStore implements MetadataStore {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(SQLITE_SCHEMA);
  }

  seed(principal: Principal): void {
    this.db
      .prepare(
        "INSERT INTO principals (id, workspace_id, role, scopes, api_key) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET api_key = EXCLUDED.api_key",
      )
      .run(principal.id, principal.workspaceId, principal.role, JSON.stringify(principal.scopes), principal.apiKey);
  }

  authenticate(apiKey: string): Principal {
    const row = this.db.prepare("SELECT id, workspace_id, role, scopes, api_key FROM principals WHERE api_key = ?").get(apiKey) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new WorkspaceError("permission_denied: bad key", "permission_denied");
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      role: row.role as WorkspaceRole,
      scopes: JSON.parse(String(row.scopes)) as AuthScope[],
      apiKey: String(row.api_key),
    };
  }

  async upsertJob(job: JobRecord): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO jobs (id, workspace_id, state, kind) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, kind = EXCLUDED.kind",
      )
      .run(job.id, job.workspaceId, job.state, job.kind);
  }

  async getJob(id: string): Promise<JobRecord | undefined> {
    const row = this.db.prepare("SELECT id, workspace_id, state, kind FROM jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return mapJob(row);
  }

  async listJobs(workspaceId: string): Promise<JobRecord[]> {
    const rows = this.db.prepare("SELECT id, workspace_id, state, kind FROM jobs WHERE workspace_id = ?").all(workspaceId) as Record<
      string,
      unknown
    >[];
    return rows.map((row) => mapJob(row)!);
  }

  async setDatasetOwner(datasetId: string, workspaceId: string): Promise<void> {
    this.db
      .prepare("INSERT INTO dataset_owners (id, workspace_id) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id")
      .run(datasetId, workspaceId);
  }

  async datasetOwner(datasetId: string): Promise<string | undefined> {
    const row = this.db.prepare("SELECT workspace_id FROM dataset_owners WHERE id = ?").get(datasetId) as Record<string, unknown> | undefined;
    return row ? String(row.workspace_id) : undefined;
  }

  async setWatchOwner(watchId: string, workspaceId: string): Promise<void> {
    this.db
      .prepare("INSERT INTO watch_owners (id, workspace_id) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id")
      .run(watchId, workspaceId);
  }

  async watchOwner(watchId: string): Promise<string | undefined> {
    const row = this.db.prepare("SELECT workspace_id FROM watch_owners WHERE id = ?").get(watchId) as Record<string, unknown> | undefined;
    return row ? String(row.workspace_id) : undefined;
  }

  async setQuota(workspaceId: string, cap: number): Promise<void> {
    this.db
      .prepare("INSERT INTO quotas (workspace_id, cap) VALUES (?, ?) ON CONFLICT (workspace_id) DO UPDATE SET cap = EXCLUDED.cap")
      .run(workspaceId, cap);
  }

  async getQuota(workspaceId: string): Promise<number> {
    const row = this.db.prepare("SELECT cap FROM quotas WHERE workspace_id = ?").get(workspaceId) as Record<string, unknown> | undefined;
    return row ? Number(row.cap) : 100;
  }

  close(): void {
    this.db.close();
  }
}

function mapJob(row: Record<string, unknown> | undefined): JobRecord | undefined {
  if (!row) return undefined;
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id ?? row.workspaceId),
    state: String(row.state),
    kind: String(row.kind),
  };
}

export function defaultMemoryStore(apiKey = process.env.SEC_API_KEY ?? "local-dev"): MemoryMetadataStore {
  const store = new MemoryMetadataStore();
  store.seed(seedOwner(apiKey));
  return store;
}
