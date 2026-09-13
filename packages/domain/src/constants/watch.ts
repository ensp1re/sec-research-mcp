export const WATCH_EVENT_KIND = {
  FIRST_DISCOVERY: "first_discovery",
  CORRECTION: "correction",
  STRUCTURED_EXTRACTION_AVAILABLE: "structured_extraction_available",
} as const;

export const WORKSPACE_ROLE = {
  OWNER: "owner",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export const AUTH_SCOPE = {
  DATA_READ: "data:read",
  ANALYSIS_RUN: "analysis:run",
  ARTIFACTS_WRITE: "artifacts:write",
  RESEARCH_WRITE: "research:write",
  WATCHES_WRITE: "watches:write",
} as const;
