import type { RETENTION_MODE } from "../constants/dataset.js";
import type { COVERAGE_STATUS, ROW_COUNT_KIND } from "../constants/coverage.js";

export type RetentionMode = (typeof RETENTION_MODE)[keyof typeof RETENTION_MODE];
export type CoverageStatus = (typeof COVERAGE_STATUS)[keyof typeof COVERAGE_STATUS];
export type RowCountKind = (typeof ROW_COUNT_KIND)[keyof typeof ROW_COUNT_KIND];

export interface ColumnSchema {
  readonly name: string;
  readonly type: string;
  readonly unit: string | null;
  readonly nullable: boolean;
}

export interface RetentionPolicy {
  readonly mode: RetentionMode;
  readonly expiresAt: string | null;
}

export interface CoverageManifest {
  readonly status: CoverageStatus;
  readonly scope: string;
  readonly sourceBounds: string | null;
  readonly scannedCount: number | null;
  readonly indexedCount: number | null;
  readonly exclusions: readonly string[];
  readonly failures: readonly string[];
  readonly watermark: string | null;
  readonly lastCheckedAt: string | null;
  readonly latestSourceAvailableAt: string | null;
}

export interface DatasetVersion {
  readonly datasetId: string;
  readonly version: number;
  readonly workspaceId: string | null;
  readonly schema: readonly ColumnSchema[];
  readonly contentHash: string;
  readonly rowCount: number;
  readonly rowCountKind: RowCountKind;
  readonly coverage: CoverageManifest;
  readonly lineage: readonly string[];
  readonly retention: RetentionPolicy;
}
