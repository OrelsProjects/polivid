"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { TimelineComposition } from "@/components/editor/composition/timeline-composition";
import { assetUrlMap, browserAssetUrl } from "@/lib/editor/asset-url";
import { timelineDurationInFrames } from "@/lib/editor/schema";
import { FPS, dimensionsFor } from "@/lib/video/schema";
import { prefetchScrubFrames } from "@/lib/editor/scrub-preview";
import { loadWaveform } from "@/lib/editor/waveform-preview";
import { useEditorActions, useEditorPlayback, useEditorState, useEditorTimeline } from "./editor-provider";
import { ScrubOverlay } from "./scrub-overlay";
import { TransformOverlay } from "./transform-overlay";

const PreviewStage = ({ playerRef }: { playerRef: RefObject<PlayerRef | null> }) => {
  const timeline = useEditorTimeline();
  const { selection } = useEditorState();
  const { width, height } = dimensionsFor(timeline.format);
  const durationInFrames = timelineDurationInFrames(timeline);
  const inputProps = useMemo(
    () => ({ timeline, assetUrls: assetUrlMap(timeline, browserAssetUrl) }),
    [timeline],
  );

  useEffect(() => {
    for (const asset of timeline.assets) {
      if (asset.kind === "video" && asset.source.type === "video") {
        void prefetchScrubFrames(asset.source.videoId);
        void loadWaveform(asset.source.videoId);
      }
    }
  }, [timeline]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 items-center justify-center p-3 [container-type:size]">
      <div
        className="relative overflow-hidden rounded-lg bg-black shadow-sm"
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100cqw, 100cqh * ${width / height})`,
        }}
      >
        <Player
          ref={playerRef}
          component={TimelineComposition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          fps={FPS}
          compositionWidth={width}
          compositionHeight={height}
          style={{ width: "100%", height: "100%" }}
          controls={false}
          initiallyMuted
          clickToPlay={false}
        />
        <ScrubOverlay />
        {selection && <TransformOverlay />}
      </div>
    </div>
  );
};

const usePreviewSync = (playerRef: RefObject<PlayerRef | null>) => {
  const { playheadFrame, isPlaying } = useEditorPlayback();
  const actions = useEditorActions();
  const playingRef = useRef(isPlaying);
  const playheadRef = useRef(playheadFrame);
  playingRef.current = isPlaying;
  playheadRef.current = playheadFrame;

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      if (player.getCurrentFrame() !== playheadRef.current) player.seekTo(playheadRef.current);
      player.play();
      return;
    }
    player.pause();
  }, [isPlaying, playerRef]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const handleFrame = ({ detail }: { detail: { frame: number } }) => {
      if (!playingRef.current) return;
      actions.setPlayhead(detail.frame);
    };
    const handleEnded = () => actions.setPlaying(false);
    player.addEventListener("frameupdate", handleFrame);
    player.addEventListener("ended", handleEnded);
    return () => {
      player.removeEventListener("frameupdate", handleFrame);
      player.removeEventListener("ended", handleEnded);
    };
  }, [actions, playerRef]);
};

export function PreviewPlayer() {
  const playerRef = useRef<PlayerRef>(null);
  usePreviewSync(playerRef);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PreviewStage playerRef={playerRef} />
    </div>
  );
}
