import type { GenerationJobStatus } from "../schema";

export type SubmitDecision = "submit" | "poll" | "needs_reconcile";

export const decideSubmit = (job: {
  status: GenerationJobStatus | string;
  providerJobId: string | null;
}): SubmitDecision => {
  if (job.providerJobId && (job.status === "in_progress" || job.status === "submitting")) return "poll";
  return "submit";
};

export const applyExtension = (
  existingAssetIds: string[],
  newAssetId: string,
  span: "full" | "new_only" | undefined,
) => {
  if (span === "full") {
    return { keep: [] as string[], replace: existingAssetIds, selected: newAssetId, duplicated: false };
  }
  return { keep: existingAssetIds, replace: [] as string[], selected: newAssetId, duplicated: false };
};

export const lipsyncOrder = ["speech", "shot_video", "lipsync"] as const;

export const nextLipsyncStep = (done: readonly string[]) =>
  lipsyncOrder.find((step) => !done.includes(step)) ?? null;
