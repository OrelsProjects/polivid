import "server-only";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { lookupCredits } from "@/lib/tools/lookup-credits";
import { approvalForCoachCall, creditsForToolCall } from "@/lib/tools/tool-credits";
import { toolByName } from "@/lib/tools/registry";

const asRecord = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

/**
 * The Coach asks before a destructive action, before any video that was not approved or sent run-wild,
 * and before a credit spend at the tool's price line (200, or 30 for a storyboard).
 * A cheaper allowed spend is approved here, so the chat does not show an approval card.
 */
export const coachToolApproval = async (input: {
  userId: string;
  toolName: string;
  toolInput: unknown;
  attachedCharacterId?: string;
  /** The person asked the Coach to decide and start, with no storyboard. */
  runWild?: boolean;
  /** The person pressed Approve on a brief. */
  briefApproved?: boolean;
  /** Footage model named on that approval. */
  generationModelId?: string;
}) => {
  const definition = toolByName(input.toolName);
  if (!definition || definition.approval !== "user") return "not-applicable" as const;
  const row = asRecord(input.toolInput);
  const films = definition.category === "make";
  const blocked = films && !input.runWild && !input.briefApproved;
  let credits: number | null = null;
  if (!definition.effects.destructive && !blocked) {
    credits = creditsForToolCall(input.toolName, row, {
      demo: !hasOpenRouterKey(),
      attachedCharacterId: input.attachedCharacterId,
      generationModelId: input.generationModelId,
    });
    if (credits === null && definition.effects.spendsCredits) {
      try {
        credits = await lookupCredits(input.userId, input.toolName, row);
      } catch (error) {
        console.error("Could not price a Coach tool", error);
        credits = null;
      }
    }
  }
  return approvalForCoachCall({
    approval: definition.approval,
    destructive: definition.effects.destructive,
    films,
    credits,
    runWild: input.runWild === true,
    briefApproved: input.briefApproved === true,
    threshold: definition.approvalCredits,
  });
};
