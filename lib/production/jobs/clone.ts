export const cloneProductionSettings = (source: {
  title: string;
  mode: string;
  creativeDelegation: boolean;
  plannerProvider: string;
  budgetUsd: number;
  format: string;
  targetDurationSec: number;
  characterId?: string | null;
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
  characterId: source.characterId ?? null,
});
