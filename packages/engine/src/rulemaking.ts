import { MISSINGNESS } from "@sec-research/domain";

export interface RulemakingRow {
  title: string;
  identifier: string | null;
  publishedAt: string | null;
  status: string | null;
  sourceUrl: string;
  missingness: string | null;
}

export function parseRulemaking(payload: unknown, sourceUrl: string): RulemakingRow[] {
  const rows = (payload as { documents?: unknown[] }).documents;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const row = item as { title?: unknown; identifier?: unknown; publishedAt?: unknown; status?: unknown };
    const title = String(row.title ?? "");
    return {
      title,
      identifier: row.identifier == null ? null : String(row.identifier),
      publishedAt: row.publishedAt == null ? null : String(row.publishedAt),
      status: row.status == null ? null : String(row.status),
      sourceUrl,
      missingness: title ? null : MISSINGNESS.MISSING,
    };
  });
}

export function rulemakingUrl(): string {
  return "https://www.sec.gov/rules-regulations";
}
