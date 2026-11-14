import { AUTO_APPROVE_UNDER_CREDITS, spendNeedsApproval } from "@/lib/billing/auto-approve";
import { songCredits, videoJobCredits } from "@/lib/billing/estimate";
import { storyboardCreditsFor } from "@/lib/coach/storyboard";
import { toolByName } from "@/lib/tools/registry";
import { resolveFilming, resolveModeTier } from "@/lib/video/modes";
import { MIN_VIDEO_LENGTH } from "@/lib/video/schema";
import { scriptSize, stillPictureCount } from "@/lib/video/script-markup";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";

export { AUTO_APPROVE_UNDER_CREDITS, spendNeedsApproval };

/** Pictures, a designed voice, and starting a production each hold one credit. */
const ONE_CREDIT = 1;

/**
 * These spends depend on a saved job or production, so the price is looked up
 * on the server. Anything else that spends credits is priced from the tool input.
 */
export const LOOKUP_CREDIT_TOOLS = ["retry_video", "approve_production", "regenerate_production", "production_refilm_shot"] as const;

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
  /** Footage model picked on an approved brief. */
  generationModelId?: string;
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

const videoCredits = (mode: string, input: Record<string, unknown>, options: ToolCreditOptions) => {
  // A quick edit has one price and takes its length from the upload.
  if (mode === "edit") return videoJobCredits({ demo: options.demo, mode, length: 0 });
  if (typeof input.length !== "number" || !Number.isInteger(input.length)) return null;
  const tier = typeof input.tier === "string" && input.tier.trim() ? input.tier.trim() : "pro";
  if (mode !== "motion-graphics" && !resolveModeTier(mode, tier)) return null;
  const referenceCount = Array.isArray(input.referenceKeys)
    ? input.referenceKeys.filter((key) => typeof key === "string" && key.trim().length > 0).length
    : 0;
  // A model picked on the approval card wins, then the one in the tool call, then the tier's.
  const requestedModel = typeof input.model === "string" && input.model.trim() ? input.model.trim() : undefined;
  const filming = resolveFilming({ mode, tier, modelId: options.generationModelId || requestedModel });
  const media = input.media === "stills" || input.media === "loop" ? input.media : undefined;
  // A script read word for word runs as long as it takes to say, whatever length was passed.
  const verbatim = input.verbatim === true && mode === "voiceover" && typeof input.prompt === "string";
  const length = verbatim
    ? Math.max(MIN_VIDEO_LENGTH, scriptSize(input.prompt as string).seconds)
    : input.length;
  return videoJobCredits({
    demo: options.demo,
    mode,
    media,
    pictures: verbatim ? stillPictureCount({ prompt: input.prompt as string, verbatim, media, length }) : undefined,
    tier,
    length,
    ...(filming.model ? { modelId: filming.model.id, resolution: filming.resolution } : {}),
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
  if (name === "make_storyboard") return storyboardCreditsFor(input);
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
  return videoCredits(mode, input, options);
};

export const creditsForToolCall = (name: string, input: unknown, options?: ToolCreditOptions) =>
  creditsForToolInput(name, record(input), options);

/** Whether this call should wait for the person. Destructive work always waits. An unknown price waits. */
export const approvalForSpend = (input: {
  asksApproval: boolean;
  destructive: boolean;
  credits: number | null;
  /** Ask at this price instead of the standard line. */
  threshold?: number;
}): "approved" | "user-approval" | "not-applicable" => {
  if (!input.asksApproval) return "not-applicable";
  if (input.destructive) return "user-approval";
  if (input.credits === null || spendNeedsApproval(input.credits, input.threshold)) return "user-approval";
  return "approved";
};

/**
 * The Coach's approval decision for one call.
 * A video or production waits unless the person approved a brief or asked to run wild.
 * Run wild and an approved brief still wait at the price line.
 */
export const approvalForCoachCall = (input: {
  approval: "none" | "user";
  destructive: boolean;
  /** Queues a video or a production. */
  films: boolean;
  credits: number | null;
  runWild: boolean;
  briefApproved: boolean;
  threshold?: number;
}): "approved" | "user-approval" | "not-applicable" => {
  if (input.approval !== "user") return "not-applicable";
  if (input.destructive) return "user-approval";
  if (input.films && !input.runWild && !input.briefApproved) return "user-approval";
  return approvalForSpend({
    asksApproval: true,
    destructive: false,
    credits: input.credits,
    threshold: input.threshold,
  });
};
