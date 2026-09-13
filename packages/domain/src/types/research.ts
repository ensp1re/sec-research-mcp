import type { RESEARCH_WORKFLOW } from "../constants/research.js";

export type ResearchWorkflow = (typeof RESEARCH_WORKFLOW)[keyof typeof RESEARCH_WORKFLOW];

export interface ResearchRun {
  readonly id: string;
  readonly question: string;
  readonly workflow: ResearchWorkflow;
  readonly workflowVersion: string;
  readonly jobIds: readonly string[];
  readonly outputDatasetIds: readonly string[];
  readonly outputArtifactIds: readonly string[];
  readonly warnings: readonly string[];
  readonly modelProvider: string | null;
  readonly modelId: string | null;
}
