export const CHART_KIND = {
  LINE: "line",
  GROUPED_BAR: "grouped_bar",
  SCATTER: "scatter",
  HEATMAP: "heatmap",
  SMALL_MULTIPLES: "small_multiples",
} as const;

export const CHART_FORMAT = {
  PNG: "png",
  SVG: "svg",
  VEGA_LITE: "vega_lite",
  CSV: "csv",
} as const;

export const CHART_THEME = {
  LIGHT: "light",
  DARK: "dark",
} as const;

export const MISSING_VALUES_POLICY = {
  GAP: "gap",
} as const;
