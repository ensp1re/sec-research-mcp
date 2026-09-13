import type { LOCATOR_KIND } from "../constants/dataset.js";
import type { SOURCE_FAMILY } from "../constants/coverage.js";

export type LocatorKind = (typeof LOCATOR_KIND)[keyof typeof LOCATOR_KIND];
export type SourceFamily = (typeof SOURCE_FAMILY)[keyof typeof SOURCE_FAMILY];

export interface SourceObject {
  readonly id: string;
  readonly canonicalUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly mediaType: string;
  readonly byteSize: number;
  readonly family: SourceFamily;
  readonly validators: readonly string[];
  readonly version: string;
}

export interface SourceLocator {
  readonly sourceId: string;
  readonly locatorKind: LocatorKind;
  readonly locator: string;
  readonly accession: string | null;
  readonly documentId: string | null;
  readonly contentHash: string;
  readonly parserVersion: string | null;
}

export interface Document {
  readonly id: string;
  readonly filingId: string;
  readonly sourceObjectId: string;
  readonly originalFilename: string;
  readonly documentType: string;
  readonly parserVersion: string;
  readonly textHash: string;
}
