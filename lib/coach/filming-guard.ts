import type { ToolDefinition } from "@/lib/tools/types";

/** What the Coach says when someone asks to change a video that is still being made. */
export const FILMING_CHANGE_REPLY =
  "Changes are only available when this video finishes or you stop it.";

export const isFilmingStatus = (status: string | null | undefined) => status === "queued" || status === "running";

/** A tool that would change the video, start another one, or spend credits. Navigation stays open. */
export const blocksChangeWhileFilming = (definition: Pick<ToolDefinition, "effects" | "category">) =>
  !definition.effects.readOnly && definition.category !== "navigate" && definition.category !== "ask";
