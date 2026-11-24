import type { CSSProperties } from "react";
import type { Focus, Region, TextHighlight, TextStyle } from "./schema";

/** The whole frame, as a region. */
export const FULL_REGION: Region = { x: 0, y: 0, w: 100, h: 100 };

/**
 * The box a picture or clip is drawn in, when it has a region or rounded corners.
 * Null when it has neither, so a timeline saved before regions existed draws exactly as before.
 * The radius is a share of the box's shorter side, turned into CSS percentages of each side,
 * so it stays the same shape at any preview size.
 */
export const regionBoxStyle = (
  item: { region?: Region; radius?: number },
  frame: { width: number; height: number },
): CSSProperties | null => {
  if (!item.region && !item.radius) return null;
  const region = item.region ?? FULL_REGION;
  const style: CSSProperties = {
    position: "absolute",
    left: `${region.x}%`,
    top: `${region.y}%`,
    width: `${region.w}%`,
    height: `${region.h}%`,
    overflow: "hidden",
    // Keeps the rounded clip on a video, which Chrome otherwise draws on its own layer.
    isolation: "isolate",
  };
  if (item.radius) {
    const boxWidth = (region.w / 100) * frame.width;
    const boxHeight = (region.h / 100) * frame.height;
    const pixels = (item.radius / 100) * Math.min(boxWidth, boxHeight);
    style.borderRadius = `${(pixels / boxWidth) * 100}% / ${(pixels / boxHeight) * 100}%`;
  }
  return style;
};

/**
 * With object-fit cover, object-position puts the focus point of the media on the same point of
 * the box, so a crop keeps it in view and a zoom with this origin moves toward it.
 */
export const focusPosition = (focus: Focus | undefined) => (focus ? `${focus.x}% ${focus.y}%` : undefined);

/** A region in frame percent, with a box placed inside it in region percent, as frame percent. */
export const insideRegion = (
  region: Region | undefined,
  box: { left: number; top: number; width: number; height: number },
) => {
  const outer = region ?? FULL_REGION;
  return {
    left: outer.x + (box.left / 100) * outer.w,
    top: outer.y + (box.top / 100) * outer.h,
    width: (box.width / 100) * outer.w,
    height: (box.height / 100) * outer.h,
  };
};

/** The look of a text box, shared by the render and the paused preview. */
export const textBoxStyle = (style: TextStyle): CSSProperties => ({
  maxWidth: "86%",
  padding: style.background ? "16px 28px" : 0,
  background: style.background ?? "transparent",
  color: style.color,
  fontFamily: style.fontFamily,
  fontSize: style.fontSize,
  fontWeight: style.fontWeight,
  textAlign: style.align,
  lineHeight: 1.15,
  ...(style.uppercase ? { textTransform: "uppercase" as const } : {}),
  ...(style.italic ? { fontStyle: "italic" as const } : {}),
  ...(style.letterSpacing ? { letterSpacing: style.letterSpacing } : {}),
  ...(style.shadow ? { textShadow: style.shadow } : {}),
  ...(style.radius ? { borderRadius: style.radius } : {}),
  ...(style.outline && style.outline.width > 0
    ? {
        WebkitTextStroke: `${style.outline.width}px ${style.outline.color}`,
        // The stroke goes behind the fill, so a thick outline doesn't eat the letters.
        paintOrder: "stroke fill",
      }
    : {}),
});

/** The text cut around its first highlighted match, case-insensitive. No match means one plain part. */
export const highlightParts = (text: string, highlight: TextHighlight | undefined) => {
  if (!highlight?.text.trim()) return [{ text, color: null as string | null }];
  const needle = highlight.text.trim();
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return [{ text, color: null as string | null }];
  return [
    { text: text.slice(0, at), color: null },
    { text: text.slice(at, at + needle.length), color: highlight.color },
    { text: text.slice(at + needle.length), color: null },
  ].filter((part) => part.text.length > 0);
};
