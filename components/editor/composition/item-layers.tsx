import { useState, type ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Html5Video,
  Img,
  OffthreadVideo,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame } from "@/components/video/composition";
import { SketchFrame } from "@/components/video/sketch";
import { CaptionText } from "./caption-text";
import { coverFrame } from "@/lib/editor/framing";
import { focusPosition, regionBoxStyle, textBoxStyle } from "@/lib/editor/layout-box";
import type {
  Asset,
  AudioItem,
  ImageItem,
  ImageMotion,
  SceneItem,
  TextItem,
  Transform,
  VideoItem,
} from "@/lib/editor/schema";

const transformStyle = (transform: Transform, opacity: number) => ({
  position: "absolute" as const,
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  opacity,
  transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
});

/** Puts a layer inside its region box, or leaves it full-frame when it has none. */
function InRegion({ box, children }: { box: ReturnType<typeof regionBoxStyle>; children: ReactNode }) {
  return box ? <div style={box}>{children}</div> : <>{children}</>;
}

export function VideoLayer({
  item,
  asset,
  src,
  muted,
}: {
  item: VideoItem;
  asset: Asset | null;
  src: string | null;
  muted: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (!src || failed) {
    return (
      <AbsoluteFill style={{ background: "#111", color: "#fff", alignItems: "center", justifyContent: "center" }}>
        {failed ? "This clip isn't playable." : (asset?.name ?? "Missing clip")}
      </AbsoluteFill>
    );
  }
  const media = {
    src,
    trimBefore: item.trimStart,
    volume: muted ? 0 : item.volume,
    muted,
    style: {
      width: "100%",
      height: "100%",
      objectFit: item.transform.fit,
      // Set only when the clip has them, so older clips draw exactly as before.
      ...(item.focus ? { objectPosition: focusPosition(item.focus), transformOrigin: focusPosition(item.focus) } : {}),
      ...(item.motion
        ? { transform: imageMotionTransform(item.motion, frame / Math.max(1, item.durationInFrames - 1)) }
        : {}),
    },
    onError: () => setFailed(true),
  };
  // In a region, the clip covers its box instead of the frame. The transform is relative to that box.
  const layer = { ...transformStyle(coverFrame(item.transform), item.opacity), ...(item.focus ? { transformOrigin: focusPosition(item.focus) } : {}) };
  return (
    <InRegion box={regionBoxStyle(item, { width, height })}>
      <AbsoluteFill style={layer}>
        {getRemotionEnvironment().isPlayer ? <Html5Video {...media} /> : <OffthreadVideo {...media} />}
      </AbsoluteFill>
    </InRegion>
  );
}

/**
 * Where a moving still sits at `progress` (0 at its first frame, 1 at its last).
 * Pans stay zoomed in by the travel distance, so the edge of the picture never shows.
 */
export const imageMotionTransform = (motion: ImageMotion | undefined, progress: number) => {
  if (!motion || motion.amount <= 0) return "none";
  const t = Math.min(1, Math.max(0, progress));
  const { kind, amount } = motion;
  if (kind === "zoom-in") return `scale(${1 + amount * t})`;
  if (kind === "zoom-out") return `scale(${1 + amount * (1 - t)})`;
  const travel = amount * 50 * (1 - 2 * t);
  const shift =
    kind === "pan-left"
      ? `translateX(${travel}%)`
      : kind === "pan-right"
        ? `translateX(${-travel}%)`
        : kind === "pan-up"
          ? `translateY(${travel}%)`
          : `translateY(${-travel}%)`;
  return `${shift} scale(${1 + amount})`;
};

export function ImageLayer({ item, src, name }: { item: ImageItem; src: string | null; name?: string }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (!src) {
    return (
      <AbsoluteFill style={{ background: "#222", color: "#fff", alignItems: "center", justifyContent: "center" }}>
        {name ?? "Missing picture"}
      </AbsoluteFill>
    );
  }
  const focus = focusPosition(item.focus);
  return (
    <InRegion box={regionBoxStyle(item, { width, height })}>
      <AbsoluteFill style={{ ...transformStyle(item.transform, item.opacity), overflow: "hidden", ...(focus ? { transformOrigin: focus } : {}) }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: item.transform.fit,
            ...(focus ? { objectPosition: focus, transformOrigin: focus } : {}),
            transform: imageMotionTransform(item.motion, frame / Math.max(1, item.durationInFrames - 1)),
          }}
        />
      </AbsoluteFill>
    </InRegion>
  );
}

/** The page a sketch card is drawn at, then scaled into its box, so it reads the same at any size. */
const SKETCH_PAGE_WIDTH = 1200;
/** A sketch card's paper and its pencil edge. */
const SKETCH_CARD_PAPER = "#FBF7EE";
const SKETCH_CARD_EDGE = "#1F2937";

export function SceneLayer({ item }: { item: SceneItem }) {
  const { width, height } = useVideoConfig();
  if (item.sketch && item.region) {
    // A paper card over the video: the page is laid out wide and scaled down into the card.
    const box = regionBoxStyle(item, { width, height });
    const boxWidth = (item.region.w / 100) * width;
    const boxHeight = (item.region.h / 100) * height;
    const scale = boxWidth / SKETCH_PAGE_WIDTH;
    return (
      <div style={{ ...box, background: SKETCH_CARD_PAPER, border: `6px solid ${SKETCH_CARD_EDGE}` }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: SKETCH_PAGE_WIDTH, height: boxHeight / scale, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <SketchFrame sketch={item.sketch} vertical={false} padding="36px 50px" />
        </div>
      </div>
    );
  }
  if (item.sketch) return <SketchFrame sketch={item.sketch} vertical={height > width} />;
  return (
    <AbsoluteFill>
      <SceneFrame scene={item.scene} facts={item.facts} quotes={item.quotes} vertical={height > width} />
    </AbsoluteFill>
  );
}

export function TextLayer({ item }: { item: TextItem }) {
  const frame = useCurrentFrame();
  const inLen = item.animationIn.durationInFrames;
  const outLen = item.animationOut.durationInFrames;
  const incoming =
    item.animationIn.type === "none" || inLen <= 0
      ? 1
      : interpolate(frame, [0, inLen], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outgoing =
    item.animationOut.type === "none" || outLen <= 0
      ? 1
      : interpolate(frame, [item.durationInFrames - outLen, item.durationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const progress = incoming * outgoing;
  const slide = item.animationIn.type === "slide" ? (1 - incoming) * 40 : item.animationOut.type === "slide" ? (1 - outgoing) * -40 : 0;
  // Pop grows in from 60% with a small overshoot, and shrinks away the same way.
  const popIn = item.animationIn.type === "pop" ? popScale(frame, inLen) : 1;
  const popOut = item.animationOut.type === "pop" ? popScale(item.durationInFrames - frame, outLen) : 1;
  const opacity = item.animationIn.type === "pop" || item.animationOut.type === "pop"
    ? Math.min(item.animationIn.type === "pop" ? Math.min(1, incoming * 2) : incoming, item.animationOut.type === "pop" ? Math.min(1, outgoing * 2) : outgoing)
    : progress;
  const scale = popIn * popOut;

  return (
    <AbsoluteFill style={transformStyle(item.transform, opacity)}>
      <div
        style={{
          ...textBoxStyle(item.style),
          transform: scale === 1 ? `translateY(${slide}px)` : `translateY(${slide}px) scale(${scale})`,
        }}
      >
        <CaptionText item={item} frame={frame} />
      </div>
    </AbsoluteFill>
  );
}

const popScale = (frame: number, length: number) =>
  length <= 0
    ? 1
    : interpolate(frame, [0, length], [0.6, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.back(2)),
      });

export function AudioLayer({ item, src, muted }: { item: AudioItem; src: string | null; muted: boolean }) {
  if (!src || muted) return null;
  return (
    <Audio
      src={src}
      trimBefore={item.trimStart}
      volume={(frame) => {
        let volume = item.volume;
        if (item.fadeIn > 0 && frame < item.fadeIn) volume *= frame / item.fadeIn;
        if (item.fadeOut > 0 && frame > item.durationInFrames - item.fadeOut) {
          volume *= Math.max(0, (item.durationInFrames - frame) / item.fadeOut);
        }
        return volume;
      }}
    />
  );
}
