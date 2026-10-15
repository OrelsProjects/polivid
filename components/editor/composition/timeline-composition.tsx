import { AbsoluteFill, Sequence } from "remotion";
import { assetById, type Timeline } from "@/lib/editor/schema";
import { AudioLayer, ImageLayer, SceneLayer, TextLayer, VideoLayer } from "./item-layers";
import { ItemTransition } from "./item-transition";

export interface TimelineCompositionProps {
  timeline: Timeline;
  assetUrls: Record<string, string>;
}

export function TimelineComposition({ timeline, assetUrls }: TimelineCompositionProps) {
  return (
    <AbsoluteFill style={{ background: "#0C1222" }}>
      {timeline.tracks.map((track) => {
        if (track.hidden) return null;
        return track.items.map((item) => {
          const asset = "assetId" in item ? assetById(timeline, item.assetId) : null;
          const src = asset ? (assetUrls[asset.id] ?? null) : null;
          return (
            <Sequence key={item.id} from={item.from} durationInFrames={item.durationInFrames} name={item.kind}>
              <ItemTransition
                transitionIn={item.transitionIn}
                transitionOut={item.transitionOut}
                durationInFrames={item.durationInFrames}
              >
                {item.kind === "video" && <VideoLayer item={item} asset={asset} src={src} muted={track.muted} />}
                {item.kind === "image" && <ImageLayer item={item} src={src} name={asset?.name} />}
                {item.kind === "scene" && <SceneLayer item={item} />}
                {item.kind === "text" && <TextLayer item={item} />}
                {item.kind === "audio" && <AudioLayer item={item} src={src} muted={track.muted} />}
              </ItemTransition>
            </Sequence>
          );
        });
      })}
    </AbsoluteFill>
  );
}
