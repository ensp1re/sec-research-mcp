import type { DEPLOYMENT_PROFILE, JOB_STATE } from "../constants/job.js";

export type JobState = (typeof JOB_STATE)[keyof typeof JOB_STATE];
export type DeploymentProfile = (typeof DEPLOYMENT_PROFILE)[keyof typeof DEPLOYMENT_PROFILE];

export interface Job {
  readonly id: string;
  readonly state: JobState;
  readonly attempt: number;
  readonly leaseOwner: string | null;
  readonly fencingToken: string | null;
  readonly cancelRequested: boolean;
  readonly error: string | null;
}
