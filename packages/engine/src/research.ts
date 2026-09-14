import { DERIVATION } from "@sec-research/domain";
import { renderLineChart } from "./charts.js";
import { formatFact } from "./format.js";
import { coverageFor, type FactPoint } from "./financials.js";
import { METRICS, parseMetricId } from "./metrics.js";
import type { Entity } from "@sec-research/domain";

export function evidencePacket(input: {
  question: string;
  entity: Entity;
  metricId: string;
  points: readonly FactPoint[];
}): {
  markdown: string;
  chart: ReturnType<typeof renderLineChart>;
  coverage: ReturnType<typeof coverageFor>;
} {
  const spec = METRICS[parseMetricId(input.metricId)];
  const coverage = coverageFor(input.points, `${input.entity.cik}:${input.metricId}`);
  const name = input.entity.names[0]?.value ?? input.entity.cik ?? "unknown";
  const chart = renderLineChart(`${name} ${spec.definition}`, input.points);
  const reported = input.points
    .filter((point) => point.derivation === DERIVATION.REPORTED && point.value !== null)
    .sort((a, b) => String(a.periodEnd).localeCompare(String(b.periodEnd)));
  const latest = reported.at(-1);
  const prior = latest
    ? [...reported].reverse().find((point) => point.periodEnd && latest.periodEnd && point.periodEnd < latest.periodEnd && point.periodKind === latest.periodKind)
    : undefined;
  const unit = latest?.unit ?? spec.unit;
  const latestDisplay = formatFact(latest?.value ?? null, unit);
  const priorDisplay = prior ? formatFact(prior.value, unit) : null;
  const change = latest && prior && latest.value && prior.value ? describeChange(prior.value, latest.value, unit) : null;
  const preview = reported.slice(-8);
  const previewRows = preview
    .map(
      (point) =>
        `| ${point.periodEnd ?? ""} | ${formatFact(point.value, point.unit)} | \`${point.value}\` | ${point.periodKind} | ${point.sourceAccession ?? ""} |`,
    )
    .join("\n");
  const markdown = `# ${name} — ${spec.definition}

${input.question}

## What this number is

**${spec.definition}** from SEC companyfacts (the XBRL the company files in its 10-K / 10-Q). It is not a share price and not a forecast.

Unit: ${unit === "USD" ? "US dollars" : unit === "ratio" ? "ratio (shown as percent)" : unit}.
The tools keep the **exact decimal string** from the filing. \`${latest?.value ?? "null"}\` means ${latestDisplay}.

## Latest reported figure

${
  latest
    ? `For the period ending **${latest.periodEnd}** (${latest.periodKind.replaceAll("_", " ")}), ${name} reported **${latestDisplay}**.
Source filing accession \`${latest.sourceAccession ?? "unknown"}\`${latest.filedAt ? `, filed ${latest.filedAt}` : ""}.`
    : "No reported value in this series."
}

${change ? `Compared with ${prior?.periodEnd} (${priorDisplay}): ${change}.` : ""}

Coverage: **${coverage.status.replaceAll("_", " ")}**. Missing values stay missing; they are not written as 0.

## Recent reported periods

| period ended | as money / percent | exact filing value | kind | accession |
| --- | --- | --- | --- | --- |
${previewRows}

## How to read derived rows

Rows marked \`derived\` were computed here (for example gross margin = gross profit / revenue, or a Q4 remainder = full year minus year-to-date). A negative derived remainder is **not** a loss; it is leftover arithmetic when the periods do not line up. Those remainders are in the CSV. The chart plots **reported** quarters only.

${chart.description}
`;
  return { markdown, chart, coverage };
}

function describeChange(from: string, to: string, unit: string | null): string {
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return `now ${formatFact(to, unit)}`;
  const pct = ((b - a) / Math.abs(a)) * 100;
  const direction = b > a ? "up" : b < a ? "down" : "unchanged";
  return `${direction} ${Math.abs(pct).toFixed(1)}% (${formatFact(from, unit)} → ${formatFact(to, unit)})`;
}

export { COVERAGE_STATUS } from "@sec-research/domain";
