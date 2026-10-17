"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
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

const takeTime = (createdAt: string) => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const isSongTake = (value: unknown): value is SongTake => {
  if (!value || typeof value !== "object") return false;
  const take = value as Record<string, unknown>;
  return (
    typeof take.id === "string" &&
    typeof take.url === "string" &&
    typeof take.seconds === "number" &&
    typeof take.createdAt === "string" &&
    (typeof take.voiceName === "string" || take.voiceName === null)
  );
};

const restoredTakes = (value: unknown): SongTake[] => {
  if (!value || typeof value !== "object") return [];
  const takes = (value as { takes?: unknown }).takes;
  if (!Array.isArray(takes)) return [];
  return takes.filter(isSongTake).map((take) => ({ ...take, credits: typeof take.credits === "number" ? take.credits : 0 }));
};

/** Make a song take, listen, retry, and approve it before any video is filmed. */
export const SongTakeStep = ({
  request,
  takes,
  take,
  onTake,
  onSelect,
  onRestore,
  onShortfall,
  returnPath,
  disabled,
  demo,
}: {
  /** Null until the lyrics and length are ready. */
  request: SongTakeBody | null;
  /** Every take that fits the current settings, oldest first. Never replaced by a new take. */
  takes: SongTake[];
  /** The take filming will use. */
  take: SongTake | null;
  /** Reports the request the take was actually made for, which may no longer be the current one. */
  onTake: (take: SongTake, request: SongTakeBody) => void;
  onSelect: (take: SongTake) => void;
  /** Reports the request these takes were restored for, for the same reason as `onTake`. */
  onRestore: (takes: SongTake[], request: SongTakeBody) => void;
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
  const requestKey = request ? JSON.stringify(request) : "";
  const onRestoreRef = useRef(onRestore);
  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  // Takes live on the server, so the ones from earlier visits — and the ones a
  // new take replaced on screen — come back whenever their settings return.
  useEffect(() => {
    if (!requestKey) return;
    const body = JSON.parse(requestKey) as SongTakeBody;
    const params = new URLSearchParams({
      prompt: body.prompt,
      length: String(body.length),
      tier: body.tier,
      characterId: body.characterId,
      hasSinger: String(body.hasSinger),
    });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/songs?${params}`, { cache: "no-store", signal: controller.signal });
          if (!response.ok) return;
          const restored = restoredTakes(await response.json().catch(() => null));
          if (restored.length > 0) onRestoreRef.current(restored, body);
        } catch {
          // A failed restore only means the history stays as it is on screen.
        }
      })();
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey]);

  const handleMake = async () => {
    if (!request || busy || disabled) return;
    // The settings can change while a take is being made, so the finished
    // take is reported against the request it was made for, not the current one.
    const madeFor: SongTakeBody = request;
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
          onTake(
            {
              id: event.id,
              url: event.url,
              seconds: event.seconds,
              voiceName: event.voiceName,
              credits: event.credits,
              createdAt: event.createdAt,
            },
            madeFor,
          );
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
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-labelledby="song-take-heading">
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
        <AudioPlayer
          key={take.id}
          src={take.url}
          variant="full"
          download
          durationSeconds={take.seconds}
          title={take.voiceName ? `Sung by ${take.voiceName}` : "Sung by the composed singer"}
          subtitle="Listen all the way through — filming starts only after you like it"
          className="mt-3"
        />
      ) : null}

      {takes.length > 1 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-foreground">
            Your takes <span className="font-normal text-muted-foreground">· {takes.length} saved, newest first</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Earlier takes stay here. Listen through them and film with the one you like.
          </p>
          <ol className="mt-2 flex flex-col gap-2">
            {[...takes].reverse().map((item) => {
              const number = takes.findIndex((candidate) => candidate.id === item.id) + 1;
              const selected = item.id === take?.id;
              const when = takeTime(item.createdAt);
              return (
                <li
                  key={item.id}
                  aria-current={selected || undefined}
                  className={cn(
                    "rounded-xl border p-2",
                    selected ? "border-primary bg-primary/5" : "border-border bg-background",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <span className="flex items-center gap-2 text-xs font-medium">
                      Take {number}
                      {when ? <span className="font-normal text-muted-foreground">{when}</span> : null}
                    </span>
                    {selected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <Check className="size-3.5" aria-hidden />
                        Filming with this one
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => onSelect(item)}
                      >
                        Film with this take
                      </Button>
                    )}
                  </div>
                  <AudioPlayer
                    src={item.url}
                    variant="compact"
                    durationSeconds={item.seconds}
                    title={`Take ${number}`}
                    hideTitle
                  />
                </li>
              );
            })}
          </ol>
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
        {take && takes.length > 1 ? (
          <span className="text-xs text-muted-foreground">A new take won&apos;t erase the ones above.</span>
        ) : null}
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
