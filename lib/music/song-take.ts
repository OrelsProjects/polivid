/** Stages of one song take, in the order the server runs them. */
export const SONG_PROGRESS = ["lyrics", "compose", "sing"] as const;

export type SongProgress = (typeof SONG_PROGRESS)[number];

export type SongTakeStreamEvent =
  | { type: "status"; step: SongProgress }
  | { type: "done"; id: string; url: string; seconds: number; voiceName: string | null; credits: number }
  | { type: "error"; error: string; code?: string; required?: number; balance?: number };
