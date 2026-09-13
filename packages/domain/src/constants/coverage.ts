export const COVERAGE_STATUS = {
  COMPLETE_WITHIN_SCOPE: "complete_within_scope",
  INCOMPLETE: "incomplete",
  UNAVAILABLE: "unavailable",
  UNKNOWN: "unknown",
} as const;

export const ROW_COUNT_KIND = {
  EXACT: "exact",
  LOWER_BOUND: "lower_bound",
  ESTIMATE: "estimate",
  UNKNOWN: "unknown",
} as const;

export const SOURCE_FAMILY = {
  ENTITY_MAPS: "entity_maps",
  SUBMISSIONS: "submissions",
  COMPANY_FACTS: "company_facts",
  COMPANY_CONCEPT: "company_concept",
  FRAMES: "frames",
  FILING_ARCHIVES: "filing_archives",
  INDEXES: "indexes",
  SEARCH_SERVICE: "search_service",
  FINANCIAL_STATEMENT_DATASETS: "financial_statement_datasets",
  REGULATORY_PAGES: "regulatory_pages",
} as const;
