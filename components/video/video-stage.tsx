"use client";

import {
  CircleAlert,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The one filmed-video player for the whole app, replacing the browser's
 * native <video controls> (a different gray bar in every browser).
 *
 * Design: the film fills a black stage; controls live on a bottom scrim that
 * fades away while the film plays. One violet family throughout — a primary
 * play disc and a light-violet seek fill that stays readable on black.
 * Click the film to play or pause, double-click for fullscreen. While the
 * stage has keyboard focus: space plays, arrows seek, M mutes, F goes full.
 */

const RATES = [1, 1.25, 1.5, 2] as const;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const rest = whole % 3600;
  return hours > 0
    ? `${hours}:${String(Math.floor(rest / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`
    : `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")}`;
};

const ACCENT = "bg-[oklch(0.52_0.23_294)]";

export function VideoStage({
  src,
  title,
  className,
  fit = "cover",
  autoPlay = false,
  loop = false,
  initiallyMuted = false,
  preload = "metadata",
  videoRef,
  onPlay,
  onPause,
  onEnded,
  onSeeked,
  onTimeUpdate,
  onVolumeChange,
}: {
  src: string;
  /** Names the player for screen readers; also shown as a chip on the stage. */
  title?: string;
  /** Sizing for the stage, e.g. "aspect-[9/16] w-full rounded-xl". */
  className?: string;
  fit?: "cover" | "contain";
  autoPlay?: boolean;
  loop?: boolean;
  initiallyMuted?: boolean;
  preload?: "none" | "metadata" | "auto";
  /** Hands the underlying element to callers that sync other media to it. */
  videoRef?: (element: HTMLVideoElement | null) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onSeeked?: () => void;
  onTimeUpdate?: () => void;
  onVolumeChange?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const ownRef = useRef<HTMLVideoElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(initiallyMuted);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState<number>(1);
  const [full, setFull] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [barVisible, setBarVisible] = useState(true);

  const ended = !playing && duration > 0 && current >= duration - 0.05;
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const label = title ?? "video";

  const setVideoRef = (element: HTMLVideoElement | null) => {
    ownRef.current = element;
    videoRef?.(element);
  };

  const showBar = (stay = false) => {
    setBarVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (!stay) {
      hideTimer.current = window.setTimeout(() => {
        if (!ownRef.current?.paused) setBarVisible(false);
      }, 2600);
    }
  };

  // Keep the clock and seek fill locked to the film, frame by frame.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const video = ownRef.current;
      if (video) {
        setCurrent(video.currentTime);
        if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const toggle = async () => {
    const video = ownRef.current;
    if (!video || failed) return;
    showBar();
    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      try {
        await video.play();
      } catch {
        // The browser refused (e.g. unmuted autoplay); the disc stays up.
      }
    } else {
      video.pause();
    }
  };

  const skip = (seconds: number) => {
    const video = ownRef.current;
    if (!video || duration <= 0) return;
    video.currentTime = Math.min(duration, Math.max(0, video.currentTime + seconds));
    showBar();
  };

  const seek = (value: number) => {
    const video = ownRef.current;
    if (!video || duration <= 0) return;
    const next = (value / 1000) * duration;
    video.currentTime = next;
    setCurrent(next);
    showBar();
  };

  const toggleMute = () => {
    const video = ownRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    showBar();
  };

  const changeVolume = (value: number) => {
    const video = ownRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(video.muted);
  };

  const cycleRate = () => {
    const video = ownRef.current;
    if (!video) return;
    const next = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length] ?? 1;
    video.playbackRate = next;
    setRate(next);
    showBar();
  };

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void frameRef.current?.requestFullscreen().catch(() => undefined);
    showBar();
  };

  const retry = () => {
    const video = ownRef.current;
    setFailed(false);
    video?.load();
    showBar(true);
  };

  const handleKeys = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a")) return;
    if (event.key === " " || event.key.toLowerCase() === "k") {
      event.preventDefault();
      void toggle();
    } else if (event.key === "ArrowRight") skip(5);
    else if (event.key === "ArrowLeft") skip(-5);
    else if (event.key.toLowerCase() === "m") toggleMute();
    else if (event.key.toLowerCase() === "f") toggleFull();
  };

  const barButton =
    "grid size-10 cursor-pointer place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:opacity-50";

  return (
    <div
      ref={frameRef}
      tabIndex={0}
      role="group"
      aria-label={label}
      onKeyDown={handleKeys}
      onMouseMove={() => showBar()}
      onTouchStart={() => showBar()}
      onFocus={() => showBar(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) showBar();
      }}
      className={cn(
        "relative overflow-hidden bg-black text-white select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        !barVisible && playing && "cursor-none",
        className,
      )}
    >
      <video
        ref={setVideoRef}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        muted={initiallyMuted}
        playsInline
        preload={preload}
        aria-label={label}
        className={cn("size-full bg-black", fit === "cover" ? "object-cover" : "object-contain")}
        onClick={() => void toggle()}
        onDoubleClick={toggleFull}
        onPlay={() => {
          setPlaying(true);
          setWaiting(false);
          showBar();
          onPlay?.();
        }}
        onPause={() => {
          setPlaying(false);
          showBar(true);
          onPause?.();
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrent(duration);
          showBar(true);
          onEnded?.();
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onDurationChange={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
        }}
        onProgress={(event) => {
          const video = event.currentTarget;
          if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
        }}
        onTimeUpdate={() => onTimeUpdate?.()}
        onSeeked={() => onSeeked?.()}
        onVolumeChange={(event) => {
          setMuted(event.currentTarget.muted);
          setVolume(event.currentTarget.volume);
          onVolumeChange?.();
        }}
        onError={() => {
          setFailed(true);
          setWaiting(false);
        }}
      />

      {/* Title chip */}
      {title ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3.5 pt-3 pb-8 transition-opacity duration-200",
            barVisible || !playing ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="truncate text-xs font-medium text-white/90">{title}</p>
        </div>
      ) : null}

      {/* Center: play / replay disc, spinner, or error */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {failed ? (
          <div className="pointer-events-auto flex flex-col items-center gap-2 px-6 text-center">
            <CircleAlert className="size-8 text-white/80" aria-hidden />
            <p className="text-sm text-white/90">This video couldn&apos;t load.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-1 cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Try again
            </button>
          </div>
        ) : waiting ? (
          <LoaderCircle className="size-10 animate-spin text-white/90" aria-label="Loading video" />
        ) : !playing ? (
          <button
            type="button"
            onClick={() => void toggle()}
            aria-label={ended ? `Play ${label} again` : `Play ${label}`}
            className="pointer-events-auto grid size-16 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ended ? (
              <RotateCcw className="size-7" aria-hidden />
            ) : (
              <Play className="ml-1 size-7 fill-current" aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      {/* Bottom control bar */}
      {!failed ? (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2.5 pt-10 pb-2 transition-opacity duration-200 sm:px-3",
            barVisible || !playing ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {/* Seek */}
          <div className="group/seek relative h-5">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25" aria-hidden>
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                style={{ width: `${duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0}%` }}
              />
              <div className={cn("absolute inset-y-0 left-0 rounded-full", ACCENT)} style={{ width: `${progress * 100}%` }} />
            </div>
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-focus-within/seek:opacity-100 group-hover/seek:opacity-100",
                ACCENT,
              )}
              style={{ left: `${progress * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              disabled={duration <= 0}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label={`Seek in ${label}`}
              aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed [&::-moz-range-thumb]:h-full [&::-moz-range-thumb]:w-4 [&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-4"
            />
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button type="button" onClick={() => void toggle()} aria-label={playing ? `Pause ${label}` : `Play ${label}`} className={barButton}>
              {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="ml-0.5 size-5 fill-current" aria-hidden />}
            </button>
            <button type="button" onClick={() => skip(-10)} aria-label="Back 10 seconds" className={cn(barButton, "relative hidden sm:grid")}>
              <RotateCcw className="size-[18px]" aria-hidden />
              <span className="absolute inset-0 grid place-items-center pt-[9px] text-[6.5px] font-bold" aria-hidden>
                10
              </span>
            </button>
            <button type="button" onClick={() => skip(10)} aria-label="Forward 10 seconds" className={cn(barButton, "relative hidden sm:grid")}>
              <RotateCw className="size-[18px]" aria-hidden />
              <span className="absolute inset-0 grid place-items-center pt-[9px] text-[6.5px] font-bold" aria-hidden>
                10
              </span>
            </button>
            <button type="button" onClick={toggleMute} aria-label={muted ? `Unmute ${label}` : `Mute ${label}`} className={barButton}>
              {muted || volume === 0 ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              aria-label={`Volume for ${label}`}
              className="hidden w-16 cursor-pointer accent-[oklch(0.52_0.23_294)] md:block"
            />
            <span className="ml-1 text-xs whitespace-nowrap tabular-nums" aria-hidden>
              {formatTime(current)} / {formatTime(duration)}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={cycleRate}
              aria-label={`Playback speed ${rate} times. Change speed`}
              className="grid h-10 min-w-10 cursor-pointer place-items-center rounded-full px-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            >
              {rate}×
            </button>
            <button type="button" onClick={toggleFull} aria-label={full ? "Exit fullscreen" : `Watch ${label} fullscreen`} className={barButton}>
              {full ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
