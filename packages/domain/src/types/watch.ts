import type { AUTH_SCOPE, WATCH_EVENT_KIND, WORKSPACE_ROLE } from "../constants/watch.js";

export type WatchEventKind = (typeof WATCH_EVENT_KIND)[keyof typeof WATCH_EVENT_KIND];
export type WorkspaceRole = (typeof WORKSPACE_ROLE)[keyof typeof WORKSPACE_ROLE];
export type AuthScope = (typeof AUTH_SCOPE)[keyof typeof AUTH_SCOPE];

export interface Watch {
  readonly id: string;
  readonly workspaceId: string;
  readonly ownerId: string;
  readonly scope: string;
  readonly ruleVersion: string;
  readonly schedule: string;
  readonly baseline: string | null;
  readonly checkpoint: string | null;
  readonly deliveryPreference: string;
  readonly enabled: boolean;
  readonly revision: number;
}

export interface WatchEvent {
  readonly id: string;
  readonly watchId: string;
  readonly sourceVersion: string;
  readonly kind: WatchEventKind;
  readonly evidenceIds: readonly string[];
  readonly observedAt: string;
  readonly deduplicationKey: string;
}
