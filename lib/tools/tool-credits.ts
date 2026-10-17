import { AUTO_APPROVE_UNDER_CREDITS, spendNeedsApproval } from "@/lib/billing/auto-approve";
import { songCredits, videoJobCredits } from "@/lib/billing/estimate";
import { toolByName } from "@/lib/tools/registry";
import { resolveModeTier } from "@/lib/video/modes";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";

export { AUTO_APPROVE_UNDER_CREDITS, spendNeedsApproval };

/** Pictures, a designed voice, and starting a production each hold one credit. */
const ONE_CREDIT = 1;

/**
 * These spends depend on a saved job or production, so the price is looked up
 * on the server. Anything else that spends credits is priced from the tool input.
 */
export const LOOKUP_CREDIT_TOOLS = ["retry_video", "approve_production", "regenerate_production"] as const;

const ONE_CREDIT_TOOLS = new Set([
  "generate_image",
  "edit_image",
  "create_character_portrait",
  "design_voice",
  "start_production",
]);

export interface ToolCreditOptions {
  /** Demo video and song jobs are free. Pictures still cost one credit. */
  demo?: boolean;
  /** Character chosen in the chat, used when a song tool omits characterId. */
  attachedCharacterId?: string;
}

const record = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

const voicedCharacter = (id: string) => id !== "" && id !== OFF_VOICE_ID && id !== STUDIO_VOICE_ID;

const cutsFrom = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const cuts = value.filter(
    (cut): cut is { seconds: number; camera?: string } =>
      Boolean(cut) && typeof cut === "object" && typeof (cut as { seconds?: unknown }).seconds === "number",
  );
  return cuts.length > 0 ? cuts : undefined;
};

const videoCredits = (mode: string, input: Record<string, unknown>, demo: boolean) => {
  if (typeof input.length !== "number" || !Number.isInteger(input.length)) return null;
  const tier = typeof input.tier === "string" && input.tier.trim() ? input.tier.trim() : "pro";
  if (mode !== "motion-graphics" && !resolveModeTier(mode, tier)) return null;
  const referenceCount = Array.isArray(input.referenceKeys)
    ? input.referenceKeys.filter((key) => typeof key === "string" && key.trim().length > 0).length
    : 0;
  return videoJobCredits({
    demo,
    mode,
    tier,
    length: input.length,
    referenceCount,
    songReady: typeof input.songId === "string" && input.songId.trim().length > 0,
    cuts: cutsFrom(input.cuts),
  });
};

/**
 * Credits this tool call will hold, from its input alone.
 * `null` means the price is unknown here: a lookup tool, or a video with no length.
 */
export const creditsForToolInput = (
  name: string,
  input: Record<string, unknown>,
  options: ToolCreditOptions = {},
): number | null => {
  if (name === "export_edit") return 0;
  if (ONE_CREDIT_TOOLS.has(name)) return ONE_CREDIT;
  if (name === "compose_song") {
    if (options.demo) return 0;
    if (typeof input.length !== "number" || !Number.isInteger(input.length)) return null;
    const requested = typeof input.characterId === "string" ? input.characterId.trim() : "";
    const character = requested || options.attachedCharacterId?.trim() || "";
    return songCredits(input.length, voicedCharacter(character));
  }
  if ((LOOKUP_CREDIT_TOOLS as readonly string[]).includes(name)) return null;
  const definition = toolByName(name);
  const mode =
    definition?.videoMode ??
    (name === "create_video"
      ? typeof input.mode === "string" && input.mode.trim()
        ? input.mode.trim()
        : "prompt"
      : null);
  if (!mode) return null;
  return videoCredits(mode, input, options.demo === true);
};

export const creditsForToolCall = (name: string, input: unknown, options?: ToolCreditOptions) =>
  creditsForToolInput(name, record(input), options);

/** Whether this call should wait for the person. Destructive work always waits. An unknown price waits. */
export const approvalForSpend = (input: {
  asksApproval: boolean;
  destructive: boolean;
  credits: number | null;
}): "approved" | "user-approval" | "not-applicable" => {
  if (!input.asksApproval) return "not-applicable";
  if (input.destructive) return "user-approval";
  if (input.credits === null || spendNeedsApproval(input.credits)) return "user-approval";
  return "approved";
};
