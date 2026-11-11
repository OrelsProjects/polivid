/**
 * Loop clips that ship with the app. They sit behind narrated text, so they are
 * abstract, slow, and silent. Each file ends on the frame it starts with.
 */
export interface BackgroundLoop {
  id: string;
  name: string;
  /** Path under the site root. */
  file: string;
  poster: string;
  /** Length of one pass. */
  seconds: number;
}

export const BACKGROUND_LOOPS: readonly BackgroundLoop[] = [
  { id: "aurora", name: "Aurora", file: "/backgrounds/aurora.mp4", poster: "/backgrounds/aurora.jpg", seconds: 9 },
  { id: "ember", name: "Ember", file: "/backgrounds/ember.mp4", poster: "/backgrounds/ember.jpg", seconds: 9 },
  { id: "midnight", name: "Midnight", file: "/backgrounds/midnight.mp4", poster: "/backgrounds/midnight.jpg", seconds: 9 },
  { id: "meadow", name: "Meadow", file: "/backgrounds/meadow.mp4", poster: "/backgrounds/meadow.jpg", seconds: 9 },
];

export const BACKGROUND_IDS = ["aurora", "ember", "midnight", "meadow"] as const;

export const DEFAULT_BACKGROUND_ID = "aurora";

export const backgroundById = (id: string | null | undefined) =>
  BACKGROUND_LOOPS.find((loop) => loop.id === id) ?? null;
