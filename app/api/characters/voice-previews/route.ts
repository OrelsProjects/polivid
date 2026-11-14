import { z } from "zod";
import { auth } from "@/auth";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { MAX_VOICE_DESCRIPTION, MIN_VOICE_DESCRIPTION } from "@/lib/characters/constants";
import { spendCharacterCredit } from "@/lib/characters/spend";
import { designVoicePreviews } from "@/lib/production/adapters/elevenlabs";
import { DESIGN_PREVIEW_LINE } from "@/lib/voice/constants";

export const maxDuration = 60;

const Schema = z.object({
  description: z.string().trim().min(MIN_VOICE_DESCRIPTION).max(MAX_VOICE_DESCRIPTION),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to design a voice." }, { status: 401 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe the voice in at least 20 characters: age, accent, tone, pace." }, { status: 400 });
  try {
    const spend = await spendCharacterCredit(userId, "character_voice");
    try {
      const previews = await designVoicePreviews(parsed.data.description, DESIGN_PREVIEW_LINE);
      return Response.json({ previews });
    } catch (error) {
      await spend.refund().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    const message = error instanceof Error ? error.message : "Couldn't design that voice.";
    return Response.json({ error: message }, { status: 400 });
  }
}
