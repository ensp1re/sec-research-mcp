import { PNG } from "pngjs";
import type { FactPoint } from "./financials.js";

export interface ChartBundle {
  svg: string;
  png: Buffer;
  vegaLite: Record<string, unknown>;
  csv: string;
  description: string;
}

export function renderLineChart(title: string, points: readonly FactPoint[]): ChartBundle {
  const plotted = points.filter((point) => point.value !== null);
  const width = 1200;
  const height = 675;
  const values = plotted.map((point) => Number(point.value));
  const min = values.length ? Math.min(...values, 0) : 0;
  const max = values.length ? Math.max(...values, 1) : 1;
  const span = max - min || 1;
  const coords = plotted.map((point, index) => {
    const x = 80 + (index * (width - 140)) / Math.max(plotted.length - 1, 1);
    const y = height - 80 - ((Number(point.value) - min) / span) * (height - 160);
    return { x, y, point };
  });
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="40" y="40" font-size="22" font-family="system-ui">${escapeXml(title)}</text>
  <text x="40" y="62" font-size="14" fill="#444">Missing periods are omitted; values are decimal strings in the CSV.</text>
  ${coords.length ? `<polyline fill="none" stroke="#111" stroke-width="3" points="${polyline}"/>` : ""}
</svg>`;
  const png = rasterize(width, height, coords);
  const csv = ["period_end,value,unit,derivation,missingness", ...points.map((point) =>
    [point.periodEnd ?? "", point.value ?? "", point.unit ?? "", point.derivation, point.missingness ?? ""].join(","),
  )].join("\n");
  return {
    svg,
    png,
    csv,
    description: `${title}. ${plotted.length} plotted points, ${points.length - plotted.length} missing.`,
    vegaLite: {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title,
      data: { values: points.map((point) => ({ period_end: point.periodEnd, value: point.value })) },
      mark: { type: "line", point: true },
      encoding: {
        x: { field: "period_end", type: "temporal" },
        y: { field: "value", type: "quantitative" },
      },
    },
  };
}

function rasterize(width: number, height: number, coords: { x: number; y: number }[]): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255;
    png.data[i + 1] = 255;
    png.data[i + 2] = 255;
    png.data[i + 3] = 255;
  }
  for (let i = 1; i < coords.length; i += 1) {
    drawLine(png, coords[i - 1]!.x, coords[i - 1]!.y, coords[i]!.x, coords[i]!.y);
  }
  return PNG.sync.write(png);
}

function drawLine(png: PNG, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
    const idx = (png.width * y + x) << 2;
    png.data[idx] = 17;
    png.data[idx + 1] = 17;
    png.data[idx + 2] = 17;
    png.data[idx + 3] = 255;
  }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
