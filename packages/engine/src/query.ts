import type { FactPoint } from "./financials.js";

export interface QueryInput {
  select?: readonly string[] | undefined;
  metricId?: string | undefined;
  limit?: number | undefined;
}

export function queryFacts(rows: readonly FactPoint[], input: QueryInput): FactPoint[] {
  let out = [...rows];
  if (input.metricId) out = out.filter((row) => row.metricId === input.metricId);
  if (input.limit !== undefined) out = out.slice(0, input.limit);
  return out;
}

export function assertSafeSql(sql: string): void {
  const text = sql.trim();
  if (!/^select\b/i.test(text)) throw new Error("invalid_sql: only a single SELECT is allowed");
  if (/;|\b(insert|update|delete|drop|attach|copy|pragma|call)\b/i.test(text)) {
    throw new Error("unsafe_query: statement not permitted");
  }
}
