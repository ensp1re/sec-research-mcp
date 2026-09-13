import type { ERROR_CODE } from "../constants/error.js";
import type { WARNING_CODE } from "../constants/warning.js";
import type { CoverageManifest } from "./dataset.js";
import type { SourceLocator } from "./source.js";

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
export type WarningCode = (typeof WARNING_CODE)[keyof typeof WARNING_CODE];

export interface Warning {
  readonly code: WarningCode;
  readonly message: string;
  readonly affectedFields: readonly string[];
  readonly affectedRows: readonly number[];
}

export interface ResultEnvelope<T> {
  readonly schemaVersion: string;
  readonly requestId: string;
  readonly data: T;
  readonly sources: readonly SourceLocator[];
  readonly coverage: CoverageManifest;
  readonly warnings: readonly Warning[];
}

export interface ToolError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;
}
