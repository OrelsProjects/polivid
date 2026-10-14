/** Video palette: neutral navy with an amber accent, no party colors. */
export const VIDEO_THEME = {
  background: "#0A0E1A",
  panel: "#131A2B",
  grid: "rgba(255,255,255,0.08)",
  text: "#F5F6FA",
  muted: "#9AA3B8",
  accent: "#FFB020",
  accentSoft: "rgba(255,176,32,0.18)",
  secondary: "#4FD1C5",
  slate: "#7C8AA8",
  fontFamily: "var(--font-geist-sans), 'Helvetica Neue', Arial, sans-serif",
} as const;

export const BAR_COLORS = [VIDEO_THEME.accent, VIDEO_THEME.secondary, VIDEO_THEME.slate];
