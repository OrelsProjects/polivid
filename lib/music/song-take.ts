/** Stages of one song take, in the order the server runs them. */
export const SONG_PROGRESS = ["lyrics", "compose", "sing"] as const;

export type SongProgress = (typeof SONG_PROGRESS)[number];

export type SongTakeStreamEvent =
  | { type: "status"; step: SongProgress }
  | { type: "done"; id: string; url: string; seconds: number; voiceName: string | null; credits: number; createdAt: string }
  | { type: "error"; error: string; code?: string; required?: number; balance?: number };

/** The fields every song take carries, used to merge a restored history with fresh takes. */
export type SongTakeLike = { id: string; createdAt: string };

/**
 * Merges takes without ever dropping one: a take already in the list keeps its
 * place, an incoming copy of the same take wins, and the result runs oldest
 * first so "Take 1" always means the first take the user made.
 */
export const mergeSongTakes = <Take extends SongTakeLike>(current: readonly Take[], incoming: readonly Take[]): Take[] => {
  const byId = new Map<string, Take>();
  for (const take of current) byId.set(take.id, take);
  for (const take of incoming) byId.set(take.id, take);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

/** 1-based position of a take in an oldest-first history, for its "Take N" label. */
export const songTakeNumber = (takes: readonly SongTakeLike[], id: string) =>
  takes.findIndex((take) => take.id === id) + 1;
