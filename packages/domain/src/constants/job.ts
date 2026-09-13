export const JOB_STATE = {
  QUEUED: "queued",
  RUNNING: "running",
  RETRY_WAIT: "retry_wait",
  CANCEL_REQUESTED: "cancel_requested",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export const DEPLOYMENT_PROFILE = {
  LOCAL: "local",
  SELF_HOSTED_TEAM: "self_hosted_team",
  MANAGED_SERVICE: "managed_service",
} as const;
