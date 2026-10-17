export type ToolResultTone = "done" | "working" | "error";

export interface ToolResultView {
  state: string;
  tone: ToolResultTone;
  href?: string;
  linkLabel?: string;
  /** Saved picture. The chat shows this image instead of a link. */
  imageUrl?: string;
  /** Upload key for that picture, when the tool returned one. */
  imageKey?: string;
}

/** How a finished tool looks in the chat. Client-safe: it only reads the result object. */
export const toolResultView = (output: unknown): ToolResultView => {
  if (!output || typeof output !== "object") return { state: "Done", tone: "done" };
  const row = output as Record<string, unknown>;
  if (typeof row.error === "string" && row.error) return { state: row.error, tone: "error" };
  if (typeof row.jobId === "string") {
    return { state: "Queued", tone: "done", href: `/videos/${row.jobId}`, linkLabel: "Open video" };
  }
  if (typeof row.productionId === "string") {
    return { state: "Started", tone: "done", href: `/productions/${row.productionId}`, linkLabel: "Open production" };
  }
  if (row.project && typeof row.summary === "string" && row.summary) {
    return { state: row.summary, tone: "done" };
  }
  if (typeof row.projectId === "string") {
    return { state: "Ready", tone: "done", href: `/editor/${row.projectId}`, linkLabel: "Open editor" };
  }
  if (typeof row.url === "string" && row.url.startsWith("/")) {
    if (!row.songId && row.url.startsWith("/api/uploads/")) {
      return {
        state: "Ready",
        tone: "done",
        imageUrl: row.url,
        imageKey: typeof row.imageKey === "string" && row.imageKey ? row.imageKey : undefined,
      };
    }
    return { state: "Ready", tone: "done", href: row.url, linkLabel: row.songId ? "Play song" : "Open picture" };
  }
  if (typeof row.status === "string") return { state: row.status, tone: "done" };
  return { state: "Done", tone: "done" };
};
