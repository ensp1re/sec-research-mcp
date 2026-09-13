import type {
  ENTITY_KIND,
  ENTITY_NAME_KIND,
  FILING_RELATIONSHIP,
  IDENTIFIER_SCHEME,
} from "../constants/identity.js";

export type EntityKind = (typeof ENTITY_KIND)[keyof typeof ENTITY_KIND];
export type IdentifierScheme = (typeof IDENTIFIER_SCHEME)[keyof typeof IDENTIFIER_SCHEME];
export type FilingRelationship = (typeof FILING_RELATIONSHIP)[keyof typeof FILING_RELATIONSHIP];
export type EntityNameKind = (typeof ENTITY_NAME_KIND)[keyof typeof ENTITY_NAME_KIND];

export interface DatedIdentifierAssertion {
  readonly scheme: IdentifierScheme | string;
  readonly value: string;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly sourceIds: readonly string[];
}

export interface EntityName {
  readonly value: string;
  readonly kind: EntityNameKind;
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

export interface Entity {
  readonly id: string;
  readonly cik: string | null;
  readonly kind: EntityKind;
  readonly names: readonly EntityName[];
  readonly identifiers: readonly DatedIdentifierAssertion[];
  readonly seriesId: string | null;
  readonly classId: string | null;
  readonly parentEntityId: string | null;
}
