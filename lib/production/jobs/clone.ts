export const cloneProductionSettings = (source: {
  title: string;
  mode: string;
  creativeDelegation: boolean;
  plannerProvider: string;
  budgetUsd: number;
  format: string;
  targetDurationSec: number;
}) => ({
  title: source.title,
  status: "preview" as const,
  stage: "preview" as const,
  mode: source.mode,
  creativeDelegation: source.creativeDelegation,
  plannerProvider: source.plannerProvider,
  budgetUsd: source.budgetUsd,
  format: source.format,
  targetDurationSec: source.targetDurationSec,
});
