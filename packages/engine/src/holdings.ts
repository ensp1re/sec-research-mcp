import { MISSINGNESS } from "@sec-research/domain";

export interface HoldingRow {
  issuer: string;
  cusip: string | null;
  shares: string | null;
  value: string | null;
  missingness: string | null;
  sourceUrl: string;
}

export function parse13F(payload: unknown, sourceUrl: string): HoldingRow[] {
  const rows = (payload as { holdings?: unknown[] }).holdings;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const row = item as { issuer?: unknown; cusip?: unknown; shares?: unknown; value?: unknown };
    const shares = lexeme(row.shares);
    const value = lexeme(row.value);
    return {
      issuer: String(row.issuer ?? ""),
      cusip: row.cusip == null || row.cusip === "" ? null : String(row.cusip),
      shares,
      value,
      missingness: shares === null && value === null ? MISSINGNESS.MISSING : null,
      sourceUrl,
    };
  });
}

function lexeme(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export function holdingsUrl(cik: string): string {
  const padded = String(cik).replace(/\D/g, "").padStart(10, "0");
  return `https://data.sec.gov/submissions/CIK${padded}.json`;
}

export function thirteenFAccessions(payload: unknown): string[] {
  const recent = (payload as { filings?: { recent?: { form?: unknown[]; accessionNumber?: unknown[] } } }).filings?.recent;
  if (!recent?.form || !recent.accessionNumber) return [];
  const out: string[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    if (!String(recent.form[i]).startsWith("13F")) continue;
    const accession = recent.accessionNumber[i];
    if (accession != null && accession !== "") out.push(String(accession));
  }
  return out;
}
