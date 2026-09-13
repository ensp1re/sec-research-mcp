import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { SecBroker } from "./broker.js";
import { padCik } from "./resolve.js";

export interface EdgarClient {
  getText(url: string): Promise<{ body: string; hash: string; fromCache: boolean; retrievedAt: string }>;
}

export function tickerMapUrl(): string {
  return "https://www.sec.gov/files/company_tickers.json";
}
export function companyFactsUrl(cik: string): string {
  return `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
}
export function submissionsUrl(cik: string): string {
  return `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`;
}
export function filingDocumentUrl(cik: string, accession: string, primary: string): string {
  const bareCik = String(Number(padCik(cik)));
  const accn = accession.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${bareCik}/${accn}/${primary}`;
}

export async function cachedGet(
  cacheDir: string,
  broker: SecBroker,
  url: string,
): Promise<{ body: string; hash: string; fromCache: boolean; retrievedAt: string }> {
  await mkdir(cacheDir, { recursive: true });
  const key = createHash("sha256").update(url).digest("hex");
  const file = path.join(cacheDir, `${key}.txt`);
  const meta = path.join(cacheDir, `${key}.json`);
  try {
    const body = await readFile(file, "utf8");
    const info = JSON.parse(await readFile(meta, "utf8")) as { hash: string; retrievedAt: string };
    return { body, hash: info.hash, fromCache: true, retrievedAt: info.retrievedAt };
  } catch {
    const got = await broker.getText(url);
    const hash = createHash("sha256").update(got.body).digest("hex");
    await writeFile(file, got.body);
    await writeFile(meta, JSON.stringify({ url, hash, retrievedAt: got.retrievedAt }));
    return { body: got.body, hash, fromCache: false, retrievedAt: got.retrievedAt };
  }
}

export function makeBroker(userAgent: string, fetchImpl?: typeof fetch): SecBroker {
  return fetchImpl
    ? new SecBroker({ userAgent, fetchImpl, minIntervalMs: 125 })
    : new SecBroker({ userAgent, minIntervalMs: 125 });
}
