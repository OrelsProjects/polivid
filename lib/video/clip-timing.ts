export interface ClipClock {
  startedAt: Date | null;
  createdAt: Date;
  model: string | null;
  finishedAt: Date | null;
}

const modelOrNull = (model: string | undefined) => {
  const trimmed = model?.trim();
  return trimmed ? trimmed : null;
};

/** Fields written when a provider accepts a clip. */
export const clipStartData = (model: string | undefined, now: Date) => ({
  status: "in_progress" as const,
  model: modelOrNull(model),
  startedAt: now,
});

/**
 * Fields written when a clip finishes. Null when this attempt was already recorded,
 * so a later pass cannot move the clock.
 */
export const clipFinishData = (
  existing: ClipClock,
  status: "completed" | "failed",
  model: string | undefined,
  now: Date,
) => {
  if (existing.finishedAt) return null;
  return {
    status,
    lastPolledAt: now,
    finishedAt: now,
    startedAt: existing.startedAt ?? existing.createdAt,
    model: existing.model ?? modelOrNull(model),
  };
};
