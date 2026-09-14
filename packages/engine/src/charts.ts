import { PNG } from "pngjs";
import { DERIVATION, PERIOD_KIND } from "@sec-research/domain";
import { axisUnit, formatFact } from "./format.js";
import type { FactPoint } from "./financials.js";

export interface ChartBundle {
  svg: string;
  png: Buffer;
  vegaLite: Record<string, unknown>;
  csv: string;
  description: string;
}

export function selectPlotPoints(points: readonly FactPoint[]): FactPoint[] {
  const numbered = points.filter((point) => point.value !== null && point.periodEnd);
  const reportedQuarters = numbered.filter(
    (point) => point.derivation === DERIVATION.REPORTED && point.periodKind === PERIOD_KIND.DISCRETE_QUARTER,
  );
  const reported = numbered.filter((point) => point.derivation === DERIVATION.REPORTED);
  const chosen = reportedQuarters.length >= 4 ? reportedQuarters : reported.length >= 2 ? reported : numbered.filter((point) => Number(point.value) >= 0);
  return [...chosen].sort((a, b) => String(a.periodEnd).localeCompare(String(b.periodEnd)));
}

export function renderLineChart(title: string, points: readonly FactPoint[]): ChartBundle {
  const plotted = selectPlotPoints(points);
  const width = 1200;
  const height = 675;
  const left = 92;
  const right = 36;
  const top = 88;
  const bottom = 72;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const unit = plotted[0]?.unit ?? points[0]?.unit ?? "USD";
  const axis = axisUnit(unit);
  const scaled = plotted.map((point) => Number(point.value) * axis.scale);
  const min = 0;
  const max = scaled.length ? Math.max(...scaled, 1) : 1;
  const span = max - min || 1;
  const times = plotted.map((point) => Date.parse(point.periodEnd ?? "") || 0);
  const tMin = times.length ? Math.min(...times) : 0;
  const tMax = times.length ? Math.max(...times) : 1;
  const tSpan = tMax - tMin || 1;
  const coords = plotted.map((point, index) => {
    const t = times[index] ?? 0;
    const x = left + ((t - tMin) / tSpan) * innerW;
    const y = top + innerH - ((scaled[index]! - min) / span) * innerH;
    return { x, y, point, scaled: scaled[index]! };
  });
  const yTicks = 4;
  const yTickEls: string[] = [];
  for (let i = 0; i <= yTicks; i += 1) {
    const v = min + (span * i) / yTicks;
    const y = top + innerH - (i / yTicks) * innerH;
    yTickEls.push(
      `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#ececec" stroke-width="1"/>` +
        `<text x="${left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#444" font-family="ui-sans-serif, system-ui">${axis.tick(v)}</text>`,
    );
  }
  const yearSeen = new Set<string>();
  const xTickEls: string[] = [];
  for (const coord of coords) {
    const year = (coord.point.periodEnd ?? "").slice(0, 4);
    if (!year || yearSeen.has(year)) continue;
    yearSeen.add(year);
    xTickEls.push(
      `<text x="${coord.x}" y="${height - 28}" text-anchor="middle" font-size="12" fill="#444" font-family="ui-sans-serif, system-ui">${year}</text>`,
    );
  }
  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const dots = coords
    .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="#fff" stroke="#1f4e3d" stroke-width="2"/>`)
    .join("");
  const last = coords.at(-1);
  const lastLabel = last
    ? `<text x="${Math.min(last.x + 8, width - right)}" y="${last.y - 10}" font-size="13" fill="#1f4e3d" font-family="ui-sans-serif, system-ui">${escapeXml(formatFact(last.point.value, unit))}</text>`
    : "";
  const subtitle = `${axis.label} · reported ${plotted[0]?.periodKind === "discrete_quarter" ? "quarters" : "periods"} · SEC companyfacts · missing omitted, not zero`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <rect width="100%" height="100%" fill="#f7f4ee"/>
  <text x="${left}" y="36" font-size="22" font-family="Georgia, 'Times New Roman', serif" fill="#1a1a1a">${escapeXml(title)}</text>
  <text x="${left}" y="58" font-size="13" fill="#555" font-family="ui-sans-serif, system-ui">${escapeXml(subtitle)}</text>
  ${yTickEls.join("\n  ")}
  <line x1="${left}" y1="${top}" x2="${left}" y2="${top + innerH}" stroke="#bbb" stroke-width="1"/>
  <line x1="${left}" y1="${top + innerH}" x2="${width - right}" y2="${top + innerH}" stroke="#bbb" stroke-width="1"/>
  ${coords.length ? `<polyline fill="none" stroke="#1f4e3d" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${polyline}"/>` : ""}
  ${dots}
  ${lastLabel}
  ${xTickEls.join("\n  ")}
  <text x="${left}" y="${height - 10}" font-size="11" fill="#777" font-family="ui-sans-serif, system-ui">Exact decimal strings are in the CSV. Derived Q4 remainders are not plotted.</text>
</svg>`;
  const png = rasterize(width, height, coords, left, top, innerW, innerH);
  const csv = [
    "period_end,value,display,unit,derivation,missingness,period_kind",
    ...points.map((point) =>
      [
        point.periodEnd ?? "",
        point.value ?? "",
        formatFact(point.value, point.unit),
        point.unit ?? "",
        point.derivation,
        point.missingness ?? "",
        point.periodKind,
      ].join(","),
    ),
  ].join("\n");
  return {
    svg,
    png,
    csv,
    description: `${title}. ${plotted.length} reported points plotted of ${points.length} rows. Y axis is ${axis.label}.`,
    vegaLite: {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title,
      data: { values: plotted.map((point) => ({ period_end: point.periodEnd, value: point.value, display: formatFact(point.value, point.unit) })) },
      mark: { type: "line", point: true },
      encoding: {
        x: { field: "period_end", type: "temporal", title: "Period end" },
        y: { field: "value", type: "quantitative", title: axis.label },
      },
    },
  };
}

function rasterize(
  width: number,
  height: number,
  coords: { x: number; y: number }[],
  left: number,
  top: number,
  innerW: number,
  innerH: number,
): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 247;
    png.data[i + 1] = 244;
    png.data[i + 2] = 238;
    png.data[i + 3] = 255;
  }
  const axis = (x: number, y: number) => set(png, x, y, 187, 187, 187);
  for (let x = left; x < left + innerW; x += 1) axis(x, top + innerH);
  for (let y = top; y < top + innerH; y += 1) axis(left, y);
  for (let i = 1; i < coords.length; i += 1) {
    drawLine(png, coords[i - 1]!.x, coords[i - 1]!.y, coords[i]!.x, coords[i]!.y);
  }
  return PNG.sync.write(png);
}

function set(png: PNG, x: number, y: number, r: number, g: number, b: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= png.width || yi >= png.height) return;
  const idx = (png.width * yi + xi) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = 255;
}

function drawLine(png: PNG, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i += 1) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    set(png, x, y, 31, 78, 61);
  }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
