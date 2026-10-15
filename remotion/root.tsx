import { Composition } from "remotion";
import { TimelineComposition, type TimelineCompositionProps } from "@/components/editor/composition/timeline-composition";
import { emptyTimeline, TimelineSchema, timelineDurationInFrames } from "@/lib/editor/schema";
import { FPS, dimensionsFor } from "@/lib/video/schema";

const fallback: TimelineCompositionProps = {
  timeline: emptyTimeline("9:16"),
  assetUrls: {},
};

const TimelineVideo = (props: Record<string, unknown>) => {
  const parsed = TimelineSchema.safeParse(props.timeline);
  const timeline = parsed.success ? parsed.data : fallback.timeline;
  const assetUrls =
    props.assetUrls && typeof props.assetUrls === "object" && !Array.isArray(props.assetUrls)
      ? (props.assetUrls as Record<string, string>)
      : {};
  return <TimelineComposition timeline={timeline} assetUrls={assetUrls} />;
};

export const RemotionRoot = () => (
  <Composition
    id="Timeline"
    component={TimelineVideo}
    durationInFrames={FPS}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={fallback}
    calculateMetadata={({ props }) => {
      const parsed = TimelineSchema.safeParse(props.timeline);
      const timeline = parsed.success ? parsed.data : fallback.timeline;
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
