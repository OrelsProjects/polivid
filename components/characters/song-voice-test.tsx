"use client";

import { LoaderCircle } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCharacters } from "@/components/characters/use-characters";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useTestCharacterSongMutation, type SongTestResult } from "@/lib/store/endpoints/characters";

const LENGTHS = [5, 10, 15] as const;
const MUSIC_USD_PER_SECOND = 0.02;

const DEFAULT_STYLE = "upbeat indie pop, 124 BPM, bright acoustic guitar, punchy drums, warm confident male vocal";
const DEFAULT_LYRICS = "[Chorus]\nWrite it once\nPost everywhere with WriteStack";

type Track = { key: keyof SongTestResult; label: string; hint: string };

const TRACKS: readonly Track[] = [
  { key: "mix", label: "Song in the character's voice", hint: "What a video would use." },
  { key: "sung", label: "Character vocal only", hint: "The re-sung vocal, without music." },
  { key: "original", label: "Original song", hint: "The voice ElevenLabs Music made up." },
  { key: "vocal", label: "Original vocal only", hint: "The vocal that was re-sung." },
];

const audioSrc = (base64: string) => `data:audio/mpeg;base64,${base64}`;

const fieldClass =
  "min-h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function SongVoiceTest() {
  const characters = useCharacters();
  const voiced = useMemo(() => characters.filter((character) => character.hasVoice), [characters]);
  const [characterId, setCharacterId] = useState("");
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [lyrics, setLyrics] = useState(DEFAULT_LYRICS);
  const [length, setLength] = useState<number>(LENGTHS[0]);
  const [result, setResult] = useState<SongTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testSong, { isLoading }] = useTestCharacterSongMutation();
  const ids = { character: useId(), style: useId(), lyrics: useId(), length: useId() };
  const selected = characterId || voiced[0]?.id || "";
  const ready = Boolean(selected) && lyrics.trim().length > 0 && !isLoading;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    setResult(null);
    try {
      setResult(await testSong({ characterId: selected, style, lyrics, length }).unwrap());
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't make the test song."));
    }
  };

  if (characters.length > 0 && voiced.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        None of your characters has a voice yet. Record or design one on the Characters page first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.character} className="text-sm font-medium">
              Character
            </label>
            <select
              id={ids.character}
              value={selected}
              onChange={(event) => setCharacterId(event.target.value)}
              className={fieldClass}
            >
              {voiced.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.length} className="text-sm font-medium">
              Length
            </label>
            <select
              id={ids.length}
              value={length}
              onChange={(event) => setLength(Number(event.target.value))}
              className={fieldClass}
            >
              {LENGTHS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds} seconds
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.style} className="text-sm font-medium">
            Music style
          </label>
          <input id={ids.style} value={style} onChange={(event) => setStyle(event.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.lyrics} className="text-sm font-medium">
            Lyrics
          </label>
          <Textarea
            id={ids.lyrics}
            value={lyrics}
            onChange={(event) => setLyrics(event.target.value)}
            rows={5}
            className="bg-card"
          />
          <p className="text-xs text-muted-foreground">Use [Verse] or [Chorus] tags to split sections.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!ready} aria-busy={isLoading}>
            {isLoading ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
                Making the song…
              </>
            ) : (
              "Make test song"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            About ${(length * MUSIC_USD_PER_SECOND).toFixed(2)} of music, plus a small voice change. No video is filmed.
          </p>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Writing the song, splitting the vocal, then re-singing it. This takes about a minute.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {result ? (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Test song tracks">
          {TRACKS.map((track) => (
            <li key={track.key} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{track.label}</p>
                <p className="text-xs text-muted-foreground">{track.hint}</p>
              </div>
              <AudioPlayer src={audioSrc(result[track.key])} title={track.label} hideTitle />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
