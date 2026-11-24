/**
 * Fonts that ship with the app for captions and titles. They are served from /fonts, so a render
 * never waits on the network for a font, and the export looks like the preview.
 */
export interface CaptionFontFile {
  weight: number;
  style: "normal" | "italic";
  /** Path under the site root. */
  file: string;
}

export interface CaptionFont {
  family: string;
  /** The CSS font-family value, with a fallback. */
  stack: string;
  files: readonly CaptionFontFile[];
}

const font = (family: string, fallback: string, files: [number, "normal" | "italic"][]): CaptionFont => {
  const slug = family.toLowerCase().replace(/\s+/g, "-");
  return {
    family,
    stack: `'${family}', ${fallback}`,
    files: files.map(([weight, style]) => ({ weight, style, file: `/fonts/${slug}-${weight}${style === "italic" ? "-italic" : ""}.woff2` })),
  };
};

export const CAPTION_FONTS: readonly CaptionFont[] = [
  font("Montserrat", "sans-serif", [[800, "normal"], [900, "normal"]]),
  font("Poppins", "sans-serif", [[700, "normal"], [800, "normal"]]),
  font("Lexend", "sans-serif", [[600, "normal"], [700, "normal"]]),
  font("Bebas Neue", "sans-serif", [[400, "normal"]]),
  font("Anton", "sans-serif", [[400, "normal"]]),
  font("Playfair Display", "serif", [[700, "normal"], [700, "italic"]]),
  font("Bangers", "cursive", [[400, "normal"]]),
  font("Permanent Marker", "cursive", [[400, "normal"]]),
];

/** The bundled font a CSS font-family names first, or null for a system font. */
export const bundledFont = (fontFamily: string) => {
  const first = fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  return CAPTION_FONTS.find((item) => item.family.toLowerCase() === first) ?? null;
};

/** Weights a bundled font has, for the weight picker. */
export const fontWeights = (fontFamily: string) => bundledFont(fontFamily)?.files.map((file) => file.weight) ?? [400, 700, 800, 900];
