import { z } from "zod";
import { auth } from "@/auth";
import { composeSong } from "@/lib/music/compose";
import { singAs } from "@/lib/music/sing-as";
import { planSongSections, splitLyricSections } from "@/lib/music/song-plan";
import { resolveCharacterVoice } from "@/lib/voice/speak";

export const maxDuration = 300;

const ANY_LENGTH = Array.from({ length: 28 }, (_, index) => index + 3);

const Schema = z.object({
  characterId: z.string().min(1),
  style: z.string().trim().max(400).default(""),
  lyrics: z.string().trim().min(1).max(2000),
  length: z.number().int().min(5).max(30),
});

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/** Composes a short song and re-sings it as a character. Nothing is filmed or saved. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to test a voice." }, { status: 401 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Add lyrics and pick a character." }, { status: 400 });

  try {
    const voice = await resolveCharacterVoice(userId, parsed.data.characterId);
    if (!voice) return Response.json({ error: "This character has no voice yet." }, { status: 400 });
    const sections = planSongSections(splitLyricSections(parsed.data.lyrics), parsed.data.length, ANY_LENGTH);
    const song = await composeSong({
      sections,
      style: parsed.data.style || "pop",
      idempotencyKey: `voice-test:${userId}:${crypto.randomUUID()}`,
    });
    const result = await singAs(song.bytes, voice.providerVoiceId);
    return Response.json({
      original: toBase64(song.bytes),
      vocal: toBase64(result.vocal),
      sung: toBase64(result.sung),
      mix: toBase64(result.mix),
    });
  } catch (error) {
    console.error("Voice test failed", error);
    const message =
      error instanceof Error && error.constructor === Error ? error.message : "Couldn't make the test song. Try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
