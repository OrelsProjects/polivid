import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import type { Transition } from "@/lib/editor/schema";

const progressFor = (frame: number, durationInFrames: number, transition: Transition | null, edge: "in" | "out") => {
  if (!transition) return 1;
  const length = Math.max(1, Math.min(transition.durationInFrames, durationInFrames));
  if (edge === "in") {
    return interpolate(frame, [0, length], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
  return interpolate(frame, [durationInFrames - length, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

const layerStyle = (type: Transition["type"], progress: number, edge: "in" | "out"): CSSProperties => {
  const amount = 1 - progress;
  if (type === "fade") return { opacity: progress };
  if (type === "zoom") {
    const scale = edge === "in" ? 0.85 + 0.15 * progress : 1 + 0.12 * amount;
    return { opacity: progress, transform: `scale(${scale})` };
  }
  if (type === "slide") {
    const x = (edge === "in" ? 1 : -1) * amount * 100;
    return { transform: `translateX(${x}%)` };
  }
  const wipe = edge === "in" ? `inset(0 ${amount * 100}% 0 0)` : `inset(0 0 0 ${amount * 100}%)`;
  return { clipPath: wipe };
};

export function ItemTransition({
  transitionIn,
  transitionOut,
  durationInFrames,
  children,
}: {
  transitionIn: Transition | null;
  transitionOut: Transition | null;
  durationInFrames: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const incoming = progressFor(frame, durationInFrames, transitionIn, "in");
  const outgoing = progressFor(frame, durationInFrames, transitionOut, "out");
  const inStyle = transitionIn ? layerStyle(transitionIn.type, incoming, "in") : {};
  const outStyle = transitionOut ? layerStyle(transitionOut.type, outgoing, "out") : {};

  return (
    <AbsoluteFill
      style={{
        opacity: Number(inStyle.opacity ?? 1) * Number(outStyle.opacity ?? 1),
        transform: [inStyle.transform, outStyle.transform].filter(Boolean).join(" ") || undefined,
        clipPath: outStyle.clipPath ?? inStyle.clipPath,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
