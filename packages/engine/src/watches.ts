import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { WATCH_EVENT_KIND } from "@sec-research/domain";

export interface WatchRecord {
  id: string;
  workspaceId: string;
  query: string;
  forms: string[];
  enabled: boolean;
  revision: number;
}

export interface WatchEventRecord {
  id: string;
  watchId: string;
  deduplicationKey: string;
  kind: string;
  accession: string;
  observedAt: string;
}

interface WatchStoreFile {
  watches: WatchRecord[];
  events: WatchEventRecord[];
}

function storePath(dir: string): string {
  return path.join(dir, "watches.json");
}

export async function loadWatchStore(dir: string): Promise<WatchStoreFile> {
  try {
    return JSON.parse(await readFile(storePath(dir), "utf8")) as WatchStoreFile;
  } catch {
    return { watches: [], events: [] };
  }
}

async function saveWatchStore(dir: string, file: WatchStoreFile): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(storePath(dir), JSON.stringify(file, null, 2));
}

export async function createWatch(dir: string, input: { workspaceId: string; query: string; forms?: string[] }): Promise<WatchRecord> {
  const file = await loadWatchStore(dir);
  const watch: WatchRecord = {
    id: `watch_${randomUUID().slice(0, 8)}`,
    workspaceId: input.workspaceId,
    query: input.query,
    forms: input.forms ?? ["10-K", "10-Q", "8-K"],
    enabled: true,
    revision: 1,
  };
  file.watches.push(watch);
  await saveWatchStore(dir, file);
  return watch;
}

export async function listWatches(dir: string, workspaceId: string): Promise<WatchRecord[]> {
  const file = await loadWatchStore(dir);
  return file.watches.filter((watch) => watch.workspaceId === workspaceId);
}

export function evaluateFilings(
  watch: WatchRecord,
  filings: { accession: string; form: string }[],
  existingKeys: Set<string>,
): WatchEventRecord[] {
  const events: WatchEventRecord[] = [];
  for (const filing of filings) {
    if (watch.forms.length && !watch.forms.includes(filing.form)) continue;
    const deduplicationKey = `${watch.id}:${filing.accession}`;
    if (existingKeys.has(deduplicationKey)) continue;
    existingKeys.add(deduplicationKey);
    events.push({
      id: `evt_${randomUUID().slice(0, 8)}`,
      watchId: watch.id,
      deduplicationKey,
      kind: WATCH_EVENT_KIND.FIRST_DISCOVERY,
      accession: filing.accession,
      observedAt: new Date().toISOString(),
    });
  }
  return events;
}

export async function evaluateWatch(
  dir: string,
  watchId: string,
  filings: { accession: string; form: string }[],
  workspaceId?: string,
): Promise<WatchEventRecord[]> {
  const file = await loadWatchStore(dir);
  const watch = file.watches.find((item) => item.id === watchId);
  if (!watch || !watch.enabled) return [];
  if (workspaceId && watch.workspaceId !== workspaceId) {
    throw new Error("permission_denied: cross-workspace read");
  }
  const existing = new Set(file.events.filter((event) => event.watchId === watchId).map((event) => event.deduplicationKey));
  const created = evaluateFilings(watch, filings, existing);
  file.events.push(...created);
  await saveWatchStore(dir, file);
  return created;
}

export async function listWatchEvents(dir: string, watchId: string): Promise<WatchEventRecord[]> {
  const file = await loadWatchStore(dir);
  return file.events.filter((event) => event.watchId === watchId);
}
