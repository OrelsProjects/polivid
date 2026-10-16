import { z } from "zod";
import { auth } from "@/auth";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { getPickableCharacter } from "@/lib/characters/store";
import { createSongDraft, songCharacterId } from "@/lib/music/song-draft";
import { resolveModeTier, VIDEO_TIERS } from "@/lib/video/modes";
import { MAX_PROMPT_LENGTH, MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH } from "@/lib/video/schema";

export const maxDuration = 300;

const Schema = z.object({
  prompt: z.string().trim().min(3).max(MAX_PROMPT_LENGTH),
  length: z.number().int().min(MIN_VIDEO_LENGTH).max(MAX_VIDEO_LENGTH),
  tier: z.enum(VIDEO_TIERS),
  characterId: z.string().trim().max(80).optional().default(""),
  hasSinger: z.boolean().optional().default(false),
});

/** Makes one song take for a lyrics video. Nothing is filmed yet. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to make a song." }, { status: 401 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Add the lyrics first." }, { status: 400 });
  const resolved = resolveModeTier("lyrics", parsed.data.tier);
  if (!resolved?.model) return Response.json({ error: "Pick a quality tier." }, { status: 400 });
  const characterId = songCharacterId(parsed.data.characterId);

  try {
    const character = characterId ? await getPickableCharacter(userId, characterId) : null;
    if (characterId && !character) return Response.json({ error: "Pick a character from your library." }, { status: 400 });
    const hasSinger = parsed.data.hasSinger || Boolean(character?.imageKey && resolved.model.referenceImages);
    const { draft, credits } = await createSongDraft(userId, {
      prompt: parsed.data.prompt,
      length: parsed.data.length,
      model: resolved.model.slug,
      characterId,
      hasSinger,
      demo: !hasOpenRouterKey(),
    });
    return Response.json({
      id: draft.id,
      url: `/api/songs/${draft.id}`,
      seconds: draft.seconds,
      voiceName: draft.voiceName,
      credits,
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    console.error("Song take failed", error);
    const message =
      error instanceof Error && error.constructor === Error ? error.message : "Couldn't make the song. Try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
