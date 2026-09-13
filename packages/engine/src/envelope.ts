import {
  COVERAGE_STATUS,
  type CoverageManifest,
  type ResultEnvelope,
  type SourceLocator,
  type Warning,
} from "@sec-research/domain";

export function envelope<T>(input: {
  requestId: string;
  data: T;
  sources?: readonly SourceLocator[];
  coverage?: CoverageManifest;
  warnings?: readonly Warning[];
}): ResultEnvelope<T> {
  return {
    schemaVersion: "1.0",
    requestId: input.requestId,
    data: input.data,
    sources: input.sources ?? [],
    coverage: input.coverage ?? {
      status: COVERAGE_STATUS.UNKNOWN,
      scope: "unspecified",
      sourceBounds: null,
      scannedCount: null,
      indexedCount: null,
      exclusions: [],
      failures: [],
      watermark: null,
      lastCheckedAt: null,
      latestSourceAvailableAt: null,
    },
    warnings: input.warnings ?? [],
  };
}
