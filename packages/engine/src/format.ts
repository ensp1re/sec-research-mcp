export function formatFact(value: string | null, unit: string | null): string {
  if (value === null || value === "") return "missing (not 0)";
  if (unit === "ratio") {
    const pct = Number(value) * 100;
    if (!Number.isFinite(pct)) return value;
    return `${pct.toFixed(1)}%`;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (unit === "USD" || unit === "USD_per_share" || unit == null) {
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (unit === "USD_per_share") return `${sign}$${abs.toFixed(2)}`;
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)} trillion`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)} billion`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)} million`;
    return `${sign}$${abs.toLocaleString("en-US")}`;
  }
  if (unit === "shares") {
    const abs = Math.abs(Number(value));
    if (abs >= 1e9) return `${(abs / 1e9).toFixed(2)} billion shares`;
    if (abs >= 1e6) return `${(abs / 1e6).toFixed(1)} million shares`;
    return `${abs.toLocaleString("en-US")} shares`;
  }
  return value;
}

export function axisUnit(unit: string | null): { scale: number; label: string; tick: (n: number) => string } {
  if (unit === "ratio") {
    return { scale: 100, label: "percent", tick: (n) => `${n.toFixed(0)}%` };
  }
  if (unit === "USD" || unit == null) {
    return { scale: 1e-9, label: "USD billions", tick: (n) => `$${n.toFixed(0)}B` };
  }
  return { scale: 1, label: unit ?? "value", tick: (n) => String(n) };
}
