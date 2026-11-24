import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { bundledFont, type CaptionFont } from "@/lib/editor/caption-fonts";

const loaded = new Map<string, Promise<void>>();

/** Loads every file of a bundled font into the page once. */
export const loadFont = (font: CaptionFont, resolve: (file: string) => string = (file) => file) => {
  const existing = loaded.get(font.family);
  if (existing) return existing;
  const loading = Promise.all(
    font.files.map(async (file) => {
      const face = new FontFace(font.family, `url(${resolve(file.file)}) format("woff2")`, {
        weight: String(file.weight),
        style: file.style,
      });
      document.fonts.add(await face.load());
    }),
  ).then(
    () => undefined,
    (error: unknown) => {
      loaded.delete(font.family);
      console.error(`Could not load the ${font.family} font`, error);
    },
  );
  loaded.set(font.family, loading);
  return loading;
};

/**
 * Loads the bundled fonts these text clips use before a frame is drawn, so a render never
 * captures a frame in the fallback font. Files resolve through staticFile, which points at the
 * site root in the player and at the bundle's copy of /public in a render.
 */
export function useTimelineFonts(fontFamilies: readonly string[]) {
  const key = [...new Set(fontFamilies)].sort().join("|");
  const [handle] = useState(() => (key ? delayRender("Loading caption fonts") : null));
  useEffect(() => {
    const fonts = key
      .split("|")
      .map((family) => bundledFont(family))
      .filter((font): font is CaptionFont => font !== null);
    void Promise.all(fonts.map((font) => loadFont(font, (file) => staticFile(file.replace(/^\//, ""))))).finally(() => {
      if (handle !== null) continueRender(handle);
    });
  }, [key, handle]);
}
