/** How many times one clip is sent to the same model before we ask for another. */
export const CLIP_ATTEMPTS = 3;

export const MODEL_CHOICE_CODE = "choose-model";

export class ModelChoiceNeeded extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelChoiceNeeded";
  }
}

export const isModelChoice = (detail: unknown) =>
  Boolean(
    detail &&
      typeof detail === "object" &&
      !Array.isArray(detail) &&
      (detail as { code?: unknown }).code === MODEL_CHOICE_CODE,
  );

/** `stop` leaves the job running. `ask` pauses it so the person can pick another model. */
export const clipFailureAction = (attempt: number, stop: boolean) => {
  if (stop) return "stop" as const;
  return attempt >= CLIP_ATTEMPTS ? ("ask" as const) : ("retry" as const);
};
