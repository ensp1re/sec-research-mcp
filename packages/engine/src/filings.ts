export interface FilingRecord {
  accession: string;
  form: string;
  filedAt: string;
  reportPeriod: string | null;
  acceptedAt: string | null;
  primaryDocument: string;
  primaryDocDescription: string | null;
  cik: string;
}

export function parseSubmissions(payload: unknown, cik: string): FilingRecord[] {
  const recent = (payload as { filings?: { recent?: Record<string, unknown[]> } }).filings?.recent;
  if (!recent) return [];
  const accn = asStringArray(recent.accessionNumber);
  const form = asStringArray(recent.form);
  const filed = asStringArray(recent.filingDate);
  const report = asStringArray(recent.reportDate);
  const accepted = asStringArray(recent.acceptanceDateTime);
  const primary = asStringArray(recent.primaryDocument);
  const desc = asStringArray(recent.primaryDocDescription);
  const out: FilingRecord[] = [];
  for (let i = 0; i < accn.length; i += 1) {
    out.push({
      accession: accn[i] ?? "",
      form: form[i] ?? "",
      filedAt: filed[i] ?? "",
      reportPeriod: report[i] ?? null,
      acceptedAt: accepted[i] ?? null,
      primaryDocument: primary[i] ?? "",
      primaryDocDescription: desc[i] ?? null,
      cik,
    });
  }
  return out;
}

export function searchFilings(
  filings: readonly FilingRecord[],
  opts: { forms?: readonly string[] | undefined; from?: string | undefined; to?: string | undefined; limit?: number | undefined },
): FilingRecord[] {
  let rows = [...filings];
  if (opts.forms?.length) {
    const allow = new Set(opts.forms.map((form) => form.toUpperCase()));
    rows = rows.filter((row) => allow.has(row.form.toUpperCase()));
  }
  if (opts.from) rows = rows.filter((row) => row.filedAt >= opts.from!);
  if (opts.to) rows = rows.filter((row) => row.filedAt <= opts.to!);
  rows.sort((a, b) => (a.filedAt === b.filedAt ? b.accession.localeCompare(a.accession) : b.filedAt.localeCompare(a.filedAt)));
  return rows.slice(0, opts.limit ?? 50);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? ""));
}
