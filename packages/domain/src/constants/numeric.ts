export const DERIVATION = {
  REPORTED: "reported",
  DERIVED: "derived",
} as const;

export const MISSINGNESS = {
  MISSING: "missing",
  NOT_APPLICABLE: "not_applicable",
  SOURCE_ABSENT: "source_absent",
  PARSE_FAILED: "parse_failed",
  EXCLUDED_BY_POLICY: "excluded_by_policy",
  COVERAGE_INCOMPLETE: "coverage_incomplete",
} as const;

export const SIGN_POLICY = {
  AS_REPORTED: "as_reported",
  NORMALIZE_CREDIT_POSITIVE: "normalize_credit_positive",
  NORMALIZE_DEBIT_POSITIVE: "normalize_debit_positive",
} as const;
