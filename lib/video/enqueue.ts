import "server-only";

/**
 * Hands a queued job to the workflow engine.
 * Trigger.dev is not connected yet, so this records nothing and leaves the row queued.
 * The sweeper will re-trigger any queued job that still has no run id.
 */
export const enqueueVideoJob = async (jobId: string): Promise<string | null> => {
  if (!process.env.TRIGGER_SECRET_KEY) {
    console.info("Video job queued. Trigger.dev is not configured yet.", { jobId });
    return null;
  }
  console.info("Video job queued. The Trigger.dev task is not wired yet.", { jobId });
  return null;
};
