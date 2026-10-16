"use client";

import { LoaderCircle, Music } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCharacters } from "@/components/characters/use-characters";
import { Button } from "@/components/ui/button";
import { songCredits } from "@/lib/billing/estimate";
import { apiErrorMessage, apiErrorStatus, insufficientCredits, loginPath } from "@/lib/store/api-errors";
import { useMakeSongTakeMutation, type SongTake, type SongTakeBody } from "@/lib/store/endpoints/videos";

/** Make a song take, listen, retry, and approve it before any video is filmed. */
export const SongTakeStep = ({
  request,
  take,
  onTake,
  onShortfall,
  returnPath,
  disabled,
  demo,
}: {
  /** Null until the lyrics and length are ready. */
  request: SongTakeBody | null;
  take: SongTake | null;
  onTake: (take: SongTake) => void;
  onShortfall: (shortfall: { required: number; balance: number }) => void;
  returnPath: string;
  disabled: boolean;
  demo: boolean;
}) => {
  const router = useRouter();
  const characters = useCharacters();
  const [makeTake, { isLoading }] = useMakeSongTakeMutation();
  const [error, setError] = useState<string | null>(null);
  const singer = characters.find((character) => character.id === request?.characterId && character.hasVoice) ?? null;
  const takeCredits = request && !demo ? songCredits(request.length, Boolean(singer)) : 0;

  const handleMake = async () => {
    if (!request || isLoading || disabled) return;
    setError(null);
    try {
      onTake(await makeTake(request).unwrap());
    } catch (cause) {
      if (apiErrorStatus(cause) === 401) {
        router.push(loginPath(returnPath));
        return;
      }
      const shortfall = insufficientCredits(cause);
      if (shortfall) {
        onShortfall(shortfall);
        return;
      }
      setError(apiErrorMessage(cause, "Couldn't make the song."));
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm" aria-labelledby="song-take-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="song-take-heading" className="text-sm font-semibold">
          5 · Song
        </h2>
        {takeCredits > 0 ? (
          <span className="text-xs text-muted-foreground">About {takeCredits.toLocaleString()} credits a take</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {singer
          ? `Hear the song sung by ${singer.name} first. Filming starts only after you like it.`
          : "Hear the song first. Filming starts only after you like it."}
      </p>

      {take ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Music className="size-4 text-primary" aria-hidden />
            {take.voiceName ? `Sung by ${take.voiceName}` : "Sung by the composed singer"}
            <span className="text-xs font-normal text-muted-foreground">· {take.seconds}s</span>
          </p>
          <audio key={take.id} src={take.url} controls preload="metadata" className="h-9 w-full" aria-label="Play the song take">
            <a href={take.url}>Download the song</a>
          </audio>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={take ? "outline" : "default"}
          disabled={!request || disabled || isLoading}
          aria-busy={isLoading}
          onClick={() => {
            void handleMake();
          }}
        >
          {isLoading ? (
            <>
              <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
              Making the song…
            </>
          ) : take ? (
            "Try another take"
          ) : (
            "Make the song"
          )}
        </Button>
        {!request ? <span className="text-xs text-muted-foreground">Add the lyrics and a length first.</span> : null}
      </div>
      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {singer ? `Writing the song, then re-singing it as ${singer.name}. About a minute.` : "Writing the song. About half a minute."}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
};
