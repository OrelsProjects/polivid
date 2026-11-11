"use client";

import { useState } from "react";
import { ModelPicker } from "@/components/model-picker";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useContinueWithModelMutation } from "@/lib/store/endpoints/videos";
import type { VideoJobView } from "@/lib/video/job-status";
import { GENERATION_MODELS, generationModelLabel, type GenerationModelId } from "@/lib/video/models";

/** Shown when a model has failed three times and filming is waiting. */
export function ModelContinue({ job, models }: { job: VideoJobView; models?: readonly GenerationModelId[] }) {
  const allowed = new Set(models ?? GENERATION_MODELS.map((model) => model.id));
  const choices = GENERATION_MODELS.filter(
    (model) =>
      allowed.has(model.id) && model.slug !== job.model && (model.aspectRatios as readonly string[]).includes(job.format),
  );
  const [modelId, setModelId] = useState<GenerationModelId | null>(choices[0]?.id ?? null);
  const [continueWithModel, { isLoading }] = useContinueWithModelMutation();
  const [error, setError] = useState<string | null>(null);
  const failedName = generationModelLabel(job.model);

  const handleContinue = async () => {
    if (!modelId || isLoading) return;
    setError(null);
    try {
      await continueWithModel({ id: job.id, model: modelId }).unwrap();
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't continue with that model."));
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-3 text-sm">
      <p>
        {failedName} failed 3 times. Pick another model to continue. Clips that already filmed stay.
      </p>
      {job.error ? <p className="text-destructive">{job.error}</p> : null}
      {choices.length > 0 && modelId ? (
        <ModelPicker value={modelId} onChange={setModelId} models={choices.map((model) => model.id)} disabled={isLoading} />
      ) : (
        <p className="text-muted-foreground">No other model can film this shape.</p>
      )}
      <Button type="button" className="h-10 w-fit" disabled={!modelId || isLoading} onClick={() => void handleContinue()}>
        {isLoading ? "Continuing…" : "Continue"}
      </Button>
      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  );
}
