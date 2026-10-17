/** The latest video this chat queued. Export jobs are not included. */
export const videoJobIdFromMessages = (
  messages: readonly { parts: readonly { type?: string; output?: unknown }[] }[],
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    for (const part of messages[index]?.parts ?? []) {
      if (typeof part.type !== "string" || !part.type.startsWith("tool-")) continue;
      const name = part.type.slice("tool-".length);
      if (name !== "create_video" && !name.startsWith("make_")) continue;
      if (!part.output || typeof part.output !== "object") continue;
      const jobId = (part.output as { jobId?: unknown }).jobId;
      if (typeof jobId === "string" && jobId) return jobId;
    }
  }
  return null;
};
