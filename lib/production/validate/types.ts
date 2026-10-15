export type { DevelopOutput, ExactDialogue, ProductionPlan, StructureOutput } from "../schema";

export interface ValidationIssue {
  severity: "error" | "warn";
  code: string;
  message: string;
  path?: string;
}
