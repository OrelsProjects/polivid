import { z } from "zod";
import { auth } from "@/auth";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { InsufficientCreditsError } from "@/lib/billing/errors";
import { getPickableCharacter } from "@/lib/characters/store";
import { ndjsonResponse } from "@/lib/http/ndjson";
import { createSongDraft, listSongDrafts, songCharacterId, songDraftFits, type SongDraft } from "@/lib/music/song-draft";
import type { SongTakeStreamEvent } from "@/lib/music/song-take";
import { isVideoTier, resolveModeTier, VIDEO_TIERS } from "@/lib/video/modes";
import { isVideoLength, MAX_PROMPT_LENGTH, MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH } from "@/lib/video/schema";

export const maxDuration = 300;

const Schema = z.object({
  prompt: z.string().trim().min(3).max(MAX_PROMPT_LENGTH),
  length: z.number().int().min(MIN_VIDEO_LENGTH).max(MAX_VIDEO_LENGTH),
  tier: z.enum(VIDEO_TIERS),
  characterId: z.string().trim().max(80).optional().default(""),
  hasSinger: z.boolean().optional().default(false),
});

const takeView = (draft: SongDraft) => ({
  id: draft.id,
  url: `/api/songs/${draft.id}`,
  seconds: draft.seconds,
  voiceName: draft.voiceName,
  credits: 0,
  createdAt: draft.createdAt,
});

/**
 * Lists the takes the user can still pick from. With the current lyrics and
 * settings in the query, only takes that still fit them come back, so an old
 * take reappears when the user returns to the settings it was made with.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to hear your songs." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const prompt = params.get("prompt") ?? "";
  const length = Number(params.get("length"));
  const tier = params.get("tier") ?? "";
  const drafts = await listSongDrafts(userId);
  const model = prompt && isVideoLength(length) && isVideoTier(tier) ? resolveModeTier("lyrics", tier)?.model : null;
  const takes = model
    ? drafts.filter((draft) =>
        songDraftFits(draft, {
          prompt,
          length,
          model: model.slug,
          characterId: songCharacterId(params.get("characterId") ?? ""),
          hasSinger: params.get("hasSinger") === "true",
        }),
      )
    : drafts;
  return Response.json({ takes: takes.map(takeView) });
}

/** Makes one song take for a lyrics video. Nothing is filmed yet. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to make a song." }, { status: 401 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Add the lyrics first." }, { status: 400 });
  const model = resolveModeTier("lyrics", parsed.data.tier)?.model;
  if (!model) return Response.json({ error: "Pick a quality tier." }, { status: 400 });
  const characterId = songCharacterId(parsed.data.characterId);

  let character: Awaited<ReturnType<typeof getPickableCharacter>> = null;
  try {
    character = characterId ? await getPickableCharacter(userId, characterId) : null;
  } catch (error) {
    console.error("Song take failed", error);
    return Response.json({ error: "Couldn't make the song. Try again." }, { status: 500 });
  }
  if (characterId && !character) return Response.json({ error: "Pick a character from your library." }, { status: 400 });
  const hasSinger = parsed.data.hasSinger || Boolean(character?.imageKey && model.referenceImages);

  return ndjsonResponse(async (send) => {
    const emit = (event: SongTakeStreamEvent) => send(event);
    try {
      const { draft, credits } = await createSongDraft(
        userId,
        {
          prompt: parsed.data.prompt,
          length: parsed.data.length,
          model: model.slug,
          characterId,
          hasSinger,
          demo: !hasOpenRouterKey(),
        },
        (step) => emit({ type: "status", step }),
      );
      emit({
        type: "done",
        id: draft.id,
        url: `/api/songs/${draft.id}`,
        seconds: draft.seconds,
        voiceName: draft.voiceName,
        credits,
        createdAt: draft.createdAt,
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        emit({
          type: "error",
          error: error.message,
          code: "insufficient_credits",
          required: error.required,
          balance: error.balance,
        });
        return;
      }
      console.error("Song take failed", error);
      const message =
        error instanceof Error && error.constructor === Error ? error.message : "Couldn't make the song. Try again.";
      emit({ type: "error", error: message });
    }
  });
}
