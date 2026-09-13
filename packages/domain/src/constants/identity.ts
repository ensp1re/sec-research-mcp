export const ENTITY_KIND = {
  REGISTRANT: "registrant",
  FUND_SERIES: "fund_series",
  FUND_CLASS: "fund_class",
  REPORTING_OWNER: "reporting_owner",
  OTHER: "other",
} as const;

export const IDENTIFIER_SCHEME = {
  CIK: "cik",
  TICKER: "ticker",
  LEI: "lei",
  CUSIP: "cusip",
  ISIN: "isin",
  SERIES_ID: "series_id",
  CLASS_ID: "class_id",
} as const;

export const FILING_RELATIONSHIP = {
  FILER: "filer",
  SUBJECT: "subject",
  ISSUER: "issuer",
  REPORTING_OWNER: "reporting_owner",
} as const;

export const ENTITY_NAME_KIND = {
  LEGAL: "legal",
  CURRENT: "current",
  FORMER: "former",
} as const;
