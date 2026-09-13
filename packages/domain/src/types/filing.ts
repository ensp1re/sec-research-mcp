import type { FilingRelationship } from "./identity.js";

export interface FilingParty {
  readonly entityId: string;
  readonly relationship: FilingRelationship;
}

export interface Filing {
  readonly id: string;
  readonly accession: string;
  readonly parties: readonly FilingParty[];
  readonly form: string;
  readonly filedAt: string | null;
  readonly acceptedAt: string | null;
  readonly reportPeriod: string | null;
  readonly amendmentOfFilingId: string | null;
  readonly sourceStatus: string;
}
