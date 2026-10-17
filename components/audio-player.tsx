"use client";

import { CircleAlert, Download, LoaderCircle, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { analyzeWaveform, type Waveform } from "@/lib/audio/waveform";
import { cn } from "@/lib/utils";

/**
 * The one player for every song, voice sample, and recording in the app.
 * Replaces the browser's native <audio controls>, which looked different in
 * every browser and ignored the app's colors entirely.
 *
 * Design: a violet play disc, a seekable waveform drawn from the decoded
 * audio, tabular times, and an equalizer that only
 * dances while sound is actually playing. Only one player sounds at a time —
 * starting one pauses the rest, like every music app people already know.
 */

const PLAY_EVENT = "polivid:audio-play";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** Placeholder bars until the real waveform decodes, stable per source so they never reshuffle. */
const placeholderBars = (seedText: string, count: number) => {
  let seed = 0;
  for (let index = 0; index < seedText.length; index += 1) seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const wave = 0.45 + 0.35 * Math.sin(index * 0.55) * Math.sin(index * 0.13 + 1.2);
    return Math.min(1, Math.max(0.22, wave + (seed / 4294967295) * 0.45));
  });
};

/** Decodes the track once to draw its real loudness and find where the sound actually stops. */
const useWaveform = (src: string, barCount: number) => {
  const [result, setResult] = useState<{ key: string; waveform: Waveform | null } | null>(null);
  const key = `${barCount}:${src}`;

  useEffect(() => {
    if (typeof OfflineAudioContext === "undefined") return;
    const controller = new AbortController();
    const decode = async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(await response.arrayBuffer());
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
        if (!controller.signal.aborted) setResult({ key, waveform: analyzeWaveform(channels, buffer.sampleRate, barCount) });
      } catch {
        if (!controller.signal.aborted) setResult({ key, waveform: null });
      }
    };
    void decode();
    return () => controller.abort();
  }, [src, barCount, key]);

  return result?.key === key ? result.waveform : null;
};

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-3.5 items-end gap-[2.5px]" aria-hidden>
      {[0, 1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn("w-[3px] rounded-full bg-primary", playing ? "audio-eq-bar" : "opacity-50")}
          style={{
            height: playing ? "100%" : `${40 + bar * 14}%`,
            animationDelay: `${bar * 0.13}s`,
            animationDuration: `${0.72 + bar * 0.09}s`,
          }}
        />
      ))}
    </span>
  );
}

function Bars({ heights, className, style }: { heights: number[]; className: string; style?: CSSProperties }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center gap-[2.5px]" style={style} aria-hidden>
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn("min-w-px flex-1 rounded-full", className)}
          style={{ height: `${Math.round(height * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function AudioPlayer({
  src,
  title,
  subtitle,
  variant = "compact",
  autoPlay = false,
  durationSeconds,
  download = false,
  hideTitle = false,
  className,
}: {
  src: string;
  /** e.g. "Sung by Orel". Also names the play button for screen readers. */
  title?: string;
  /** Keep the title for screen readers only, when the card around the player already shows it. */
  hideTitle?: boolean;
  /** e.g. "Song take · ready to film". Full variant only. */
  subtitle?: string;
  /** `full` is the hero player for a finished song; `compact` fits in lists and cards. */
  variant?: "full" | "compact";
  autoPlay?: boolean;
  /** Shown until the file's real length loads, and for streams that never report one. */
  durationSeconds?: number;
  download?: boolean;
  className?: string;
}) {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const full = variant === "full";
  const barCount = full ? 48 : 36;
  const placeholder = useMemo(() => placeholderBars(src, barCount), [src, barCount]);
  const waveform = useWaveform(src, barCount);
  const bars = waveform?.bars ?? placeholder;
  // Generated songs fade out and then run on in near-silence. The player ends
  // where the sound does, so the UI isn't still moving after the song is over.
  const end = waveform ? (duration > 0 ? Math.min(duration, waveform.audibleEnd) : waveform.audibleEnd) : duration;
  const ended = !playing && end > 0 && current >= end - 0.05;
  const progress = end > 0 ? Math.min(1, current / end) : 0;
  const label = title ?? "audio";

  // `timeupdate` only fires about 4 times a second, so the waveform trailed
  // the sound. While playing, read the playhead every frame instead.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (end > 0 && audio.currentTime >= end) {
        audio.pause();
        setCurrent(end);
        return;
      }
      setCurrent(audio.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, end]);

  // A new take replaces the old file: rewind and forget the old length.
  // Adjusted during render (React's pattern for prop-derived state) so the
  // new track never flashes the previous track's progress for one frame.
  const [loadedSrc, setLoadedSrc] = useState(src);
  if (loadedSrc !== src) {
    setLoadedSrc(src);
    setPlaying(false);
    setCurrent(0);
    setFailed(false);
    setDuration(durationSeconds ?? 0);
  }

  // One song at a time, app-wide.
  useEffect(() => {
    const pauseOthers = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== playerId) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, pauseOthers);
    return () => window.removeEventListener(PLAY_EVENT, pauseOthers);
  }, [playerId]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || failed) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (ended) audio.currentTime = 0;
    window.dispatchEvent(new CustomEvent<string>(PLAY_EVENT, { detail: playerId }));
    setLoading(true);
    try {
      await audio.play();
    } catch {
      setLoading(false);
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || end <= 0) return;
    const next = (value / 1000) * end;
    audio.currentTime = next;
    setCurrent(next);
  };

  const playIcon = failed ? (
    <CircleAlert className="size-5" aria-hidden />
  ) : loading ? (
    <LoaderCircle className="size-5 animate-spin" aria-hidden />
  ) : playing ? (
    <Pause className="size-5 fill-current" aria-hidden />
  ) : ended ? (
    <RotateCcw className="size-5" aria-hidden />
  ) : (
    <Play className={cn("size-5 fill-current", full ? "ml-0.5" : "ml-px")} aria-hidden />
  );

  return (
    <div
      className={cn(
        // Flat, no shadow or card of its own — the player sits on whatever
        // surface contains it, tinted only enough to group its controls.
        full ? "rounded-2xl bg-muted/60 p-3 sm:p-3.5" : "bg-transparent px-1 py-1",
        "flex items-center gap-3",
        className,
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        autoPlay={autoPlay}
        onPlay={() => {
          setPlaying(true);
          setLoading(false);
          window.dispatchEvent(new CustomEvent<string>(PLAY_EVENT, { detail: playerId }));
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(end);
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onDurationChange={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onError={() => {
          setFailed(true);
          setPlaying(false);
          setLoading(false);
        }}
      >
        <a href={src}>Download the audio</a>
      </audio>

      <button
        type="button"
        onClick={() => void toggle()}
        disabled={failed}
        aria-label={failed ? `Couldn't load ${label}` : playing ? `Pause ${label}` : ended ? `Play ${label} again` : `Play ${label}`}
        className={cn(
          "grid shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          full ? "size-12" : "size-10",
        )}
      >
        {playIcon}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && !hideTitle ? (
          <div className="flex items-center gap-2">
            <p className={cn("min-w-0 flex-1 truncate font-medium", full ? "text-[15px]" : "text-xs")}>{title}</p>
            {playing || current > 0 ? <Equalizer playing={playing} /> : null}
            {full && end > 0 ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground tabular-nums">
                {formatTime(end)}
              </span>
            ) : null}
          </div>
        ) : null}
        {full && subtitle ? <p className="-mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}

        <div className="flex items-center gap-2.5">
          <div className={cn("relative flex-1", full ? "h-9" : "h-6")}>
            <Bars heights={bars} className="bg-foreground/15" />
            {/* The played layer is clipped at the exact playhead, so the fill
                moves continuously instead of jumping a whole bar at a time. */}
            <Bars
              heights={bars}
              className="bg-primary"
              style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
            />
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              disabled={failed || end <= 0}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label={`Seek in ${label}`}
              aria-valuetext={`${formatTime(Math.min(current, end))} of ${formatTime(end)}`}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-3 [&::-moz-range-thumb]:h-full [&::-moz-range-thumb]:w-3"
            />
          </div>
          <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums" aria-hidden>
            {formatTime(Math.min(current, end))} / {formatTime(end)}
          </span>
          {download ? (
            <a
              href={src}
              download
              aria-label={`Download ${label}`}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Download className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>

        {failed ? (
          <p className="text-xs text-destructive" role="alert">
            Couldn&apos;t load this audio.{" "}
            <a href={src} className="font-medium underline underline-offset-2">
              Try downloading it
            </a>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
