import type { DERIVATION, MISSINGNESS, SIGN_POLICY } from "../constants/numeric.js";
import type { ReportingPeriod, RevisionSelection, TemporalProvenance } from "./period.js";

export type Derivation = (typeof DERIVATION)[keyof typeof DERIVATION];
export type Missingness = (typeof MISSINGNESS)[keyof typeof MISSINGNESS];
export type SignPolicy = (typeof SIGN_POLICY)[keyof typeof SIGN_POLICY];

export interface RawFact {
  readonly id: string;
  readonly conceptQName: string;
  readonly numericLexeme: string | null;
  readonly unit: string | null;
  readonly context: string;
  readonly period: ReportingPeriod;
  readonly precision: string | null;
  readonly sourceIds: readonly string[];
}

export interface NormalizedFact {
  readonly id: string;
  readonly rawFactIds: readonly string[];
  readonly metricId: string;
  readonly value: string | null;
  readonly missingness: Missingness | null;
  readonly unit: string | null;
  readonly currency: string | null;
  readonly period: ReportingPeriod;
  readonly derivation: Derivation;
  readonly revision: RevisionSelection;
  readonly temporal: TemporalProvenance;
  readonly sourceIds: readonly string[];
}

export interface MetricDefinition {
  readonly id: string;
  readonly version: string;
  readonly definition: string;
  readonly acceptedTags: readonly string[];
  readonly unit: string | null;
  readonly periodKind: ReportingPeriod["kind"] | null;
  readonly additive: boolean;
  readonly signPolicy: SignPolicy;
  readonly formula: string | null;
  readonly reviewer: string;
  readonly effectiveDate: string;
  readonly limitations: readonly string[];
}
