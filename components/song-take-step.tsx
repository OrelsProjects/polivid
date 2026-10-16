"use client";

import { Check, LoaderCircle, Music } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCharacters } from "@/components/characters/use-characters";
import { Button } from "@/components/ui/button";
import { songCredits } from "@/lib/billing/estimate";
import { isNdjson, readNdjson } from "@/lib/http/ndjson";
import { SONG_PROGRESS, type SongProgress, type SongTakeStreamEvent } from "@/lib/music/song-take";
import { api } from "@/lib/store/api";
import { loginPath } from "@/lib/store/api-errors";
import type { SongTake, SongTakeBody } from "@/lib/store/endpoints/videos";
import { useAppDispatch } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";

const stepState = (step: SongProgress, current: SongProgress) => {
  const at = SONG_PROGRESS.indexOf(current);
  const index = SONG_PROGRESS.indexOf(step);
  if (index < at) return "done" as const;
  if (index === at) return "current" as const;
  return "upcoming" as const;
};

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
  const dispatch = useAppDispatch();
  const characters = useCharacters();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<SongProgress>("lyrics");
  const [error, setError] = useState<string | null>(null);
  const singer = characters.find((character) => character.id === request?.characterId && character.hasVoice) ?? null;
  const takeCredits = request && !demo ? songCredits(request.length, Boolean(singer)) : 0;
  const steps: { id: SongProgress; label: string }[] = [
    { id: "lyrics", label: "Reading the lyrics out of your prompt" },
    { id: "compose", label: "Writing the song" },
    ...(singer ? [{ id: "sing" as const, label: `Re-singing it as ${singer.name}` }] : []),
  ];

  const handleMake = async () => {
    if (!request || busy || disabled) return;
    setError(null);
    setStep("lyrics");
    setBusy(true);
    try {
      const response = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(request),
      });
      if (response.status === 401) {
        router.push(loginPath(returnPath));
        return;
      }
      if (!isNdjson(response)) {
        const json = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
          required?: number;
          balance?: number;
        } | null;
        if (response.status === 402 && json?.code === "insufficient_credits") {
          onShortfall({ required: json.required ?? 0, balance: json.balance ?? 0 });
          return;
        }
        setError(json?.error ?? "Couldn't make the song.");
        return;
      }
      for await (const event of readNdjson<SongTakeStreamEvent>(response)) {
        if (event.type === "status") {
          setStep(event.step);
          continue;
        }
        if (event.type === "done") {
          dispatch(api.util.invalidateTags(["Credits"]));
          onTake({
            id: event.id,
            url: event.url,
            seconds: event.seconds,
            voiceName: event.voiceName,
            credits: event.credits,
          });
          return;
        }
        if (event.code === "insufficient_credits") {
          onShortfall({ required: event.required ?? 0, balance: event.balance ?? 0 });
          return;
        }
        setError(event.error || "Couldn't make the song.");
        return;
      }
      setError("Couldn't make the song.");
    } catch {
      setError("Couldn't make the song.");
    } finally {
      setBusy(false);
    }
  };

  const currentLabel = steps.find((item) => item.id === step)?.label ?? steps[0]?.label;

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
          disabled={!request || disabled || busy}
          aria-busy={busy}
          onClick={() => {
            void handleMake();
          }}
        >
          {busy ? (
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
      {busy ? (
        <ol className="mt-3 flex flex-col gap-1.5" aria-label="Song progress">
          {steps.map((item) => {
            const state = stepState(item.id, step);
            return (
              <li
                key={item.id}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2",
                  state === "current" ? "text-sm font-medium text-foreground" : "text-xs text-muted-foreground",
                )}
              >
                <span className="grid size-4 shrink-0 place-items-center" aria-hidden>
                  {state === "done" ? (
                    <Check className="size-3.5 text-primary" />
                  ) : (
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        state === "current" ? "bg-primary" : "border border-current bg-transparent",
                      )}
                    />
                  )}
                </span>
                <span>{item.label}</span>
                {state === "current" ? <span className="text-xs font-medium text-primary">Now</span> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {busy ? currentLabel : ""}
      </p>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
};
