"use client";

import { Player, Thumbnail } from "@remotion/player";
import {
  FPS,
  dimensionsFor,
  durationInFrames,
  type Fact,
  type ScenePlan,
  type SourcedQuote,
  type VideoFormat,
} from "@/lib/video/schema";
import { PoliVidComposition } from "./composition";

export interface RemotionVideoProps {
  plan: ScenePlan;
  facts: Fact[];
  quotes: SourcedQuote[];
  format: VideoFormat;
  demo: boolean;
}

const fill = { width: "100%", height: "100%" };

/** Remotion reads the clock while rendering, so these only run in the browser. */
export function RemotionPlayer({
  plan,
  facts,
  quotes,
  format,
  demo,
  autoPlay,
  controls,
}: RemotionVideoProps & { autoPlay: boolean; controls: boolean }) {
  const { width, height } = dimensionsFor(format);
  return (
    <Player
      component={PoliVidComposition}
      inputProps={{ plan, facts, quotes, demo }}
      durationInFrames={durationInFrames(plan)}
      fps={FPS}
      compositionWidth={width}
      compositionHeight={height}
      style={fill}
      controls={controls}
      autoPlay={autoPlay}
      loop
      initiallyMuted
      clickToPlay={controls}
    />
  );
}

export function RemotionThumbnail({ plan, facts, quotes, format, demo }: RemotionVideoProps) {
  const { width, height } = dimensionsFor(format);
  return (
    <Thumbnail
      component={PoliVidComposition}
      inputProps={{ plan, facts, quotes, demo }}
      durationInFrames={durationInFrames(plan)}
      frameToDisplay={Math.round(FPS * 1.5)}
      fps={FPS}
      compositionWidth={width}
      compositionHeight={height}
      style={fill}
    />
  );
}
