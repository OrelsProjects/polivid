import "server-only";
import { randomUUID } from "node:crypto";
import { refundCredits, reserveCredits } from "@/lib/billing/credits";
import { songCredits } from "@/lib/billing/estimate";
import { listVideoMediaKeys, putVideoMedia, readVideoMedia } from "@/lib/video/media-store";
import { generationModelBySlug } from "@/lib/video/models";
import { lyricsClipDurations } from "@/lib/video/singer-models";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";
import { resolveCharacterVoice } from "@/lib/voice/speak";
import { composeSong } from "./compose";
import { singAs } from "./sing-as";
import { extractSongBrief } from "./song-brief";
import { planSongSections, splitLyricSections, type SongSectionPlan, type SongWord } from "./song-plan";
import type { SongProgress } from "./song-take";

/** A song take made on the create page, before any video exists. */
export interface SongDraft {
  id: string;
  userId: string;
  prompt: string;
  length: number;
  model: string;
  characterId: string;
  hasSinger: boolean;
  style: string;
  sections: SongSectionPlan[];
  words: SongWord[];
  voiceName: string | null;
  seconds: number;
  createdAt: string;
}

const SONG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSongId = (id: string) => SONG_ID.test(id);

/** A saved character sings the take. No voice and the studio narrator leave the composed singer. */
export const songCharacterId = (characterId: string | undefined) =>
  !characterId || characterId === OFF_VOICE_ID || characterId === STUDIO_VOICE_ID ? "" : characterId;

const metaKey = (id: string) => `songs/${id}.json`;
export const songDraftAudioKey = (id: string) => `songs/${id}.mp3`;

export const readSongDraft = async (userId: string, id: string): Promise<SongDraft | null> => {
  if (!isSongId(id)) return null;
  const bytes = await readVideoMedia(metaKey(id));
  if (!bytes) return null;
  try {
    const draft = JSON.parse(Buffer.from(bytes).toString("utf8")) as SongDraft;
    return draft.userId === userId ? draft : null;
  } catch {
    return null;
  }
};

export const readSongDraftAudio = (id: string) => readVideoMedia(songDraftAudioKey(id));

/** How many past takes one user can browse at once. */
const MAX_LISTED_SONG_DRAFTS = 50;

/**
 * Every take the user has made, newest first. Takes are never deleted when a
 * new one is made, so this is how an earlier take stays reachable after the
 * user tries another one.
 */
export const listSongDrafts = async (userId: string): Promise<SongDraft[]> => {
  const keys = await listVideoMediaKeys("songs/");
  const ids = keys
    .filter((key) => key.startsWith("songs/") && key.endsWith(".json"))
    .map((key) => key.slice("songs/".length, -".json".length))
    .filter(isSongId);
  const drafts = await Promise.all(ids.map((id) => readSongDraft(userId, id)));
  return drafts
    .filter((draft): draft is SongDraft => draft !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, MAX_LISTED_SONG_DRAFTS);
};

/** True when the video settings still match the take, so its timings fit the clips. */
export const songDraftFits = (
  draft: SongDraft,
  video: { prompt: string; length: number; model: string; characterId: string; hasSinger: boolean },
) =>
  draft.prompt === video.prompt.trim() &&
  draft.length === video.length &&
  draft.model === video.model &&
  draft.characterId === video.characterId &&
  draft.hasSinger === video.hasSinger;

/**
 * Composes one song take, re-sung by the character when it has a voice, and charges for it.
 * The credits are spent even if the user makes another take.
 */
export const createSongDraft = async (
  userId: string,
  input: { prompt: string; length: number; model: string; characterId: string; hasSinger: boolean; demo: boolean },
  onStatus?: (step: SongProgress) => void,
) => {
  const model = generationModelBySlug(input.model);
  if (!model) throw new Error("Pick a video model.");
  onStatus?.("lyrics");
  const brief = await extractSongBrief(input.prompt);
  if (!brief.lyrics) throw new Error("Add the lyrics first.");
  const voice = input.characterId ? await resolveCharacterVoice(userId, input.characterId) : null;
  const sections = planSongSections(splitLyricSections(brief.lyrics), input.length, lyricsClipDurations(model, input.hasSinger));
  const seconds = sections.reduce((total, section) => total + section.durationSec, 0);
  const id = randomUUID();
  const credits = input.demo ? 0 : songCredits(seconds, Boolean(voice));
  const move = { reason: "song", refType: "song", refId: id, idempotencyKey: `song_hold:${id}` };
  await reserveCredits(userId, credits, move);
  try {
    onStatus?.("compose");
    const composed = await composeSong({ sections, style: brief.style || "pop", idempotencyKey: `song:${id}` });
    let audio = composed.bytes;
    if (voice) {
      onStatus?.("sing");
      audio = (await singAs(composed.bytes, voice.providerVoiceId)).mix;
    }
    const draft: SongDraft = {
      id,
      userId,
      prompt: input.prompt.trim(),
      length: input.length,
      model: model.slug,
      characterId: input.characterId,
      hasSinger: input.hasSinger,
      style: brief.style,
      sections,
      words: composed.words,
      voiceName: voice?.name ?? null,
      seconds,
      createdAt: new Date().toISOString(),
    };
    await putVideoMedia(songDraftAudioKey(id), audio, "audio/mpeg");
    await putVideoMedia(metaKey(id), new TextEncoder().encode(JSON.stringify(draft)), "application/json");
    return { draft, credits };
  } catch (error) {
    await refundCredits(userId, credits, {
      reason: "song_refund",
      refType: "song",
      refId: id,
      idempotencyKey: `song_refund:${id}`,
      holdKey: move.idempotencyKey,
    }).catch((refundError) => console.error("Could not refund the song", refundError));
    throw error;
  }
};
