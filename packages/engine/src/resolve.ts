import { ENTITY_KIND, ERROR_CODE, type Entity } from "@sec-research/domain";

export interface TickerRow {
  cik_str: number | string;
  ticker: string;
  title: string;
}

export function padCik(value: number | string): string {
  return String(value).replace(/^0+/, "").padStart(10, "0");
}

export function loadTickerMap(payload: unknown): TickerRow[] {
  if (!payload || typeof payload !== "object") return [];
  return Object.values(payload as Record<string, TickerRow>).filter(
    (row) => row && typeof row === "object" && "ticker" in row,
  );
}

export function resolveCompany(query: string, rows: readonly TickerRow[]): Entity[] | Entity {
  const q = query.trim();
  if (!q) throw Object.assign(new Error("empty company query"), { code: ERROR_CODE.ENTITY_AMBIGUOUS });
  const digits = q.replace(/^CIK/i, "").replace(/\D/g, "");
  const upper = q.toUpperCase();
  const exactTicker = rows.filter((row) => row.ticker.toUpperCase() === upper);
  if (exactTicker.length === 1) return toEntity(exactTicker[0]!);
  const exactCik = digits.length > 0 ? rows.filter((row) => padCik(row.cik_str) === padCik(digits)) : [];
  if (exactCik.length === 1) return toEntity(exactCik[0]!);
  const named = rows.filter((row) => row.title.toUpperCase().includes(upper));
  if (named.length === 1) return toEntity(named[0]!);
  const candidates = [...exactTicker, ...exactCik, ...named].slice(0, 8);
  if (candidates.length === 0) {
    throw Object.assign(new Error(`entity not found: ${q}`), { code: ERROR_CODE.METRIC_UNAVAILABLE });
  }
  throw Object.assign(new Error(`entity_ambiguous: ${q}`), {
    code: ERROR_CODE.ENTITY_AMBIGUOUS,
    candidates: candidates.map(toEntity),
  });
}

function toEntity(row: TickerRow): Entity {
  const cik = padCik(row.cik_str);
  return {
    id: `entity_${cik}`,
    cik,
    kind: ENTITY_KIND.REGISTRANT,
    names: [{ value: row.title, kind: "legal", validFrom: null, validTo: null }],
    identifiers: [
      { scheme: "cik", value: cik, validFrom: null, validTo: null, sourceIds: [] },
      { scheme: "ticker", value: row.ticker, validFrom: null, validTo: null, sourceIds: [] },
    ],
    seriesId: null,
    classId: null,
    parentEntityId: null,
  };
}
