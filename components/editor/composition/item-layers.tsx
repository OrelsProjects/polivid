import { useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Html5Video,
  Img,
  OffthreadVideo,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame } from "@/components/video/composition";
import { coverFrame } from "@/lib/editor/framing";
import type { Asset, AudioItem, ImageItem, SceneItem, TextItem, Transform, VideoItem } from "@/lib/editor/schema";

const transformStyle = (transform: Transform, opacity: number) => ({
  position: "absolute" as const,
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  opacity,
  transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
});

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
    style: { width: "100%", height: "100%", objectFit: item.transform.fit },
    onError: () => setFailed(true),
  };
  return (
    <AbsoluteFill style={transformStyle(coverFrame(item.transform), item.opacity)}>
      {getRemotionEnvironment().isPlayer ? <Html5Video {...media} /> : <OffthreadVideo {...media} />}
    </AbsoluteFill>
  );
}

export function ImageLayer({ item, src, name }: { item: ImageItem; src: string | null; name?: string }) {
  if (!src) {
    return (
      <AbsoluteFill style={{ background: "#222", color: "#fff", alignItems: "center", justifyContent: "center" }}>
        {name ?? "Missing picture"}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={transformStyle(item.transform, item.opacity)}>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: item.transform.fit }} />
    </AbsoluteFill>
  );
}

export function SceneLayer({ item }: { item: SceneItem }) {
  const { width, height } = useVideoConfig();
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

  return (
    <AbsoluteFill style={transformStyle(item.transform, progress)}>
      <div
        style={{
          maxWidth: "86%",
          padding: item.style.background ? "16px 28px" : 0,
          background: item.style.background ?? "transparent",
          color: item.style.color,
          fontFamily: item.style.fontFamily,
          fontSize: item.style.fontSize,
          fontWeight: item.style.fontWeight,
          textAlign: item.style.align,
          lineHeight: 1.15,
          transform: `translateY(${slide}px)`,
        }}
      >
        {item.text}
      </div>
    </AbsoluteFill>
  );
}

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
