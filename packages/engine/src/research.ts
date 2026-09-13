import { COVERAGE_STATUS } from "@sec-research/domain";
import { renderLineChart } from "./charts.js";
import { coverageFor, type FactPoint } from "./financials.js";
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
  const coverage = coverageFor(input.points, `${input.entity.cik}:${input.metricId}`);
  const chart = renderLineChart(`${input.entity.names[0]?.value ?? input.entity.cik} ${input.metricId}`, input.points);
  const rows = input.points
    .map((point) => `| ${point.periodEnd ?? ""} | ${point.value ?? point.missingness ?? ""} | ${point.derivation} | ${point.sourceAccession ?? ""} |`)
    .join("\n");
  const markdown = `# Evidence packet

Question: ${input.question}

Entity: ${input.entity.names[0]?.value ?? "unknown"} (CIK ${input.entity.cik})

Metric: ${input.metricId}

Coverage: ${coverage.status}

| period_end | value | derivation | accession |
| --- | --- | --- | --- |
${rows}

Missing values are not zero. Chart data is in the CSV export.
`;
  return { markdown, chart, coverage };
}

export { COVERAGE_STATUS };
