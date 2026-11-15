import type { ToolDefinition } from "@/lib/tools/types";
import { videoCardToolMeta } from "./video-card";

/** Tools whose results the video card can show, besides every make_* (video mode) tool. */
const VIDEO_CARD_TOOLS = new Set(["get_video", "retry_video", "continue_video_with_model", "resume_video"]);

export const hasVideoCard = (definition: Pick<ToolDefinition, "name" | "videoMode">) =>
  Boolean(definition.videoMode) || VIDEO_CARD_TOOLS.has(definition.name);

export const cardToolMeta = (definition: Pick<ToolDefinition, "name" | "videoMode">) =>
  hasVideoCard(definition) ? videoCardToolMeta() : undefined;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/**
 * Adds what the card needs to a tool result: the video id, a link to it in PoliVid, and, once it is
 * ready, a short-lived playback link (the card runs without the person's PoliVid session).
 * Quotes and errors pass through unchanged; the card renders them as they are.
 */
export const withVideoCard = (output: unknown, origin: string, signPlayback: (videoId: string) => string) => {
  const row = record(output);
  if (!row || typeof row.error === "string" || row.needsConfirmation) return output;
  const videoId = typeof row.jobId === "string" ? row.jobId : typeof row.id === "string" ? row.id : "";
  if (!videoId) return output;
  const ready = row.ready === true || row.status === "succeeded" || row.status === "ready";
  return {
    ...row,
    card: {
      videoId,
      pageUrl: `${origin}/videos/${encodeURIComponent(videoId)}`,
      ...(ready ? { playUrl: signPlayback(videoId) } : {}),
    },
  };
};
