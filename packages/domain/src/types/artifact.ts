import type {
  CHART_FORMAT,
  CHART_KIND,
  CHART_THEME,
  MISSING_VALUES_POLICY,
} from "../constants/artifact.js";

export type ChartKind = (typeof CHART_KIND)[keyof typeof CHART_KIND];
export type ChartFormat = (typeof CHART_FORMAT)[keyof typeof CHART_FORMAT];
export type ChartTheme = (typeof CHART_THEME)[keyof typeof CHART_THEME];
export type MissingValuesPolicy = (typeof MISSING_VALUES_POLICY)[keyof typeof MISSING_VALUES_POLICY];

export interface ChartRequest {
  readonly datasetId: string;
  readonly datasetVersion: number;
  readonly kind: ChartKind;
  readonly x: string;
  readonly y: string;
  readonly series: string | null;
  readonly title: string;
  readonly missingValues: MissingValuesPolicy;
  readonly formats: readonly ChartFormat[];
  readonly width: number;
  readonly height: number;
  readonly theme: ChartTheme;
}

export interface ArtifactVersion {
  readonly id: string;
  readonly datasetId: string;
  readonly datasetVersion: number;
  readonly rendererVersion: string;
  readonly specVersion: string;
  readonly outputHashes: Readonly<Record<string, string>>;
  readonly accessibilityText: string;
  readonly sourceManifestId: string;
}
