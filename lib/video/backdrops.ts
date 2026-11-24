import { backgroundById } from "./backgrounds";

/**
 * Still backdrops that ship with the app, for layouts that place a picture or a clip on top of
 * something: a soft gradient behind a screen window, and paper behind a sketch.
 */
export interface Backdrop {
  id: string;
  name: string;
  /** Path under the site root. */
  file: string;
}

export const BACKDROPS: readonly Backdrop[] = [
  { id: "dusk", name: "Dusk gradient", file: "/backdrops/dusk.jpg" },
  { id: "paper", name: "Paper", file: "/backdrops/paper.jpg" },
];

export const backdropById = (id: string | null | undefined) => BACKDROPS.find((item) => item.id === id) ?? null;

/** The public file for a library asset: a background loop or a still backdrop. */
export const libraryFile = (id: string) => backgroundById(id)?.file ?? backdropById(id)?.file ?? null;
