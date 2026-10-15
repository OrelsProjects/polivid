import { Composition } from "remotion";
import { TimelineComposition, type TimelineCompositionProps } from "@/components/editor/composition/timeline-composition";
import { emptyTimeline, timelineDurationInFrames } from "@/lib/editor/schema";
import { FPS, dimensionsFor } from "@/lib/video/schema";

const fallback: TimelineCompositionProps = {
  timeline: emptyTimeline("9:16"),
  assetUrls: {},
};

export const RemotionRoot = () => (
  <Composition
    id="Timeline"
    component={TimelineComposition}
    durationInFrames={FPS}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={fallback}
    calculateMetadata={({ props }) => {
      const timeline = props.timeline ?? fallback.timeline;
      const { width, height } = dimensionsFor(timeline.format);
      return {
        durationInFrames: timelineDurationInFrames(timeline),
        fps: FPS,
        width,
        height,
      };
    }}
  />
);
