/** Appended when the user turns off on-screen text. Video models often invent letters otherwise. */
export const NO_ON_SCREEN_TEXT =
  "No on-screen text. Do not render titles, captions, subtitles, watermarks, logos, letters, numbers, or any writing in the video.";

const MODES_THAT_NEED_TEXT = new Set(["lyrics", "captions"]);

export const withOnScreenText = (prompt: string, showText: boolean, mode?: string) => {
  if (showText || (mode && MODES_THAT_NEED_TEXT.has(mode))) return prompt;
  const trimmed = prompt.trim();
  if (trimmed.includes(NO_ON_SCREEN_TEXT)) return trimmed;
  return trimmed ? `${trimmed}\n\n${NO_ON_SCREEN_TEXT}` : NO_ON_SCREEN_TEXT;
};
