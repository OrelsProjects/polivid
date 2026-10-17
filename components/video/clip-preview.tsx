"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipPreviewSlot } from "@/lib/video/clip-preview";
import { VideoStage } from "@/components/video/video-stage";
import { cn } from "@/lib/utils";

const frameClass = (format: string) => {
  if (format === "16:9") return "aspect-video";
  if (format === "1:1") return "aspect-square";
  return "aspect-[9/16]";
};

const nextReady = (clips: readonly ClipPreviewSlot[], after: number) =>
  clips.find((clip) => clip.ready && clip.index > after)?.index ?? null;

/**
 * Plays the shots that have already been filmed. Missing shots stay as gaps.
 * Nothing is stitched or re-encoded here.
 */
export const ClipPreview = ({
  jobId,
  title,
  format,
  clips,
  songUrl,
}: {
  jobId: string;
  title: string;
  format: string;
  clips: readonly ClipPreviewSlot[];
  songUrl: string | null;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const continueRef = useRef(false);
  const cutAt = useRef<number | null>(null);
  const [current, setCurrent] = useState<number | null>(() => clips.find((clip) => clip.ready)?.index ?? null);
  const slot = clips.find((clip) => clip.index === current && clip.ready) ?? null;
  const waiting = clips.some((clip) => !clip.ready);

  useEffect(() => {
    setCurrent((selected) => {
      if (selected != null && clips.some((clip) => clip.index === selected && clip.ready)) return selected;
      return clips.find((clip) => clip.ready)?.index ?? null;
    });
  }, [clips]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || current == null) return;
    let cancel = false;
    let started = false;
    const showFrame = () => {
      if (cancel || started) return;
      started = true;
      video.currentTime = 0;
      if (!continueRef.current) return;
      void video.play().catch(() => {
        continueRef.current = false;
        audioRef.current?.pause();
      });
    };
    video.addEventListener("loadeddata", showFrame);
    if (video.readyState >= 2) showFrame();
    return () => {
      cancel = true;
      video.removeEventListener("loadeddata", showFrame);
    };
  }, [current, jobId]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const choose = (index: number) => {
    if (index === current) return;
    const video = videoRef.current;
    continueRef.current = Boolean(video && !video.paused && !video.ended);
    cutAt.current = null;
    setCurrent(index);
  };

  const followSong = (playing: boolean) => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !songUrl || !slot) return;
    if (video) {
      audio.muted = video.muted;
      audio.volume = video.volume;
    }
    if (!playing) {
      audio.pause();
      return;
    }
    const at = slot.startSec + (video?.currentTime ?? 0);
    if (Number.isFinite(at) && Math.abs(audio.currentTime - at) > 0.35) audio.currentTime = Math.max(0, at);
    void audio.play().catch(() => undefined);
  };

  const goNext = () => {
    if (!slot || cutAt.current === slot.index) return;
    const next = nextReady(clips, slot.index);
    cutAt.current = slot.index;
    if (next == null) {
      videoRef.current?.pause();
      return;
    }
    continueRef.current = true;
    videoRef.current?.pause();
    setCurrent(next);
  };

  if (!slot) return null;

  const shotLabel = `Shot ${slot.index + 1} of ${clips.length}`;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <VideoStage
        key={slot.index}
        videoRef={(element) => {
          videoRef.current = element;
        }}
        src={`/api/videos/${jobId}/clips/${slot.index}`}
        fit="contain"
        preload="auto"
        className={cn("w-full rounded-2xl", frameClass(format))}
        title={`${shotLabel} for ${title}`}
        onPlay={() => {
          continueRef.current = false;
          cutAt.current = null;
          followSong(true);
        }}
        onPause={() => {
          if (continueRef.current) return;
          followSong(false);
        }}
        onVolumeChange={() => {
          const audio = audioRef.current;
          const video = videoRef.current;
          if (!audio || !video || !songUrl) return;
          audio.muted = video.muted;
          audio.volume = video.volume;
        }}
        onSeeked={() => {
          if (videoRef.current?.paused) return;
          followSong(true);
        }}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (!video || video.paused || slot.durationSec <= 0) return;
          if (video.currentTime < slot.durationSec) {
            if (cutAt.current === slot.index) cutAt.current = null;
            return;
          }
          goNext();
        }}
        onEnded={goNext}
      />
      {songUrl ? <audio ref={audioRef} src={songUrl} preload="metadata" className="hidden" /> : null}
      <p className="text-xs text-muted-foreground">
        {shotLabel}
        {songUrl ? ". Play to hear the song with this shot." : ""}
      </p>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Shots filmed so far">
        {clips.map((clip) => {
          const number = clip.index + 1;
          const selected = clip.index === slot.index;
          return (
            <button
              key={clip.index}
              type="button"
              disabled={!clip.ready}
              aria-pressed={selected}
              aria-label={clip.ready ? `Play shot ${number}` : `Shot ${number}, still filming`}
              className={cn(
                "size-11 rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "bg-primary text-primary-foreground"
                  : clip.ready
                    ? "bg-muted text-foreground"
                    : "border border-dashed border-border text-muted-foreground",
              )}
              onClick={() => choose(clip.index)}
            >
              {number}
            </button>
          );
        })}
      </div>
      {waiting ? <p className="text-center text-xs text-muted-foreground">Empty shots are still filming.</p> : null}
    </div>
  );
};
