"use client";

import { coverFrame } from "@/lib/editor/framing";
import { assetById, findItem, hasTransform, type Asset, type FitMode, type Timeline } from "@/lib/editor/schema";
import { dimensionsFor } from "@/lib/video/schema";
import { useEditorSelection, useEditorTimeline } from "./editor-provider";

type Box = { width: number; height: number };

const TEXT_BOX: Box = { width: 80, height: 40 };
const FULL_FRAME: Box = { width: 100, height: 100 };

/** Size of the media's unscaled box as a percentage of the frame. */
const mediaBox = (asset: Asset | null, fit: FitMode, timeline: Timeline): Box => {
  if (fit === "cover" || !asset?.width || !asset.height) return FULL_FRAME;
  const frame = dimensionsFor(timeline.format);
  const mediaRatio = asset.width / asset.height;
  const frameRatio = frame.width / frame.height;
  if (mediaRatio > frameRatio) return { width: 100, height: (frameRatio / mediaRatio) * 100 };
  return { width: (mediaRatio / frameRatio) * 100, height: 100 };
};

export function TransformOverlay() {
  const timeline = useEditorTimeline();
  const selection = useEditorSelection();
  if (!selection) return null;
  const found = findItem(timeline, selection.itemId);
  if (!found || !hasTransform(found.item)) return null;
  const { item } = found;
  const { x, y, scale, rotation, fit } = item.kind === "video" ? coverFrame(item.transform) : item.transform;
  const box = item.kind === "text" ? TEXT_BOX : mediaBox(assetById(timeline, item.assetId), fit, timeline);
  const width = box.width * scale;
  const height = box.height * scale;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute border-2 border-sky-400"
        style={{
          left: `${50 + x - width / 2}%`,
          top: `${50 + y - height / 2}%`,
          width: `${width}%`,
          height: `${height}%`,
          transform: `rotate(${rotation}deg)`,
        }}
      />
    </div>
  );
}
