/** A concept saved on a source. `videoId` is set once a real job is queued. */
export type SavedConcept = {
  id: string;
  title: string;
  shape: string;
  angle: string;
  passage: string;
  script: string;
  videoId: string | null;
};

export type SourceView = {
  id: string;
  title: string;
  body: string;
  words: number;
  createdAt: string;
  concepts: SavedConcept[];
};

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const MIN_CONCEPT_WORDS = 80;

export const isSavedConcept = (value: unknown): value is SavedConcept => {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SavedConcept>;
  return typeof row.id === "string" && typeof row.title === "string" && typeof row.script === "string";
};

export const parseConcepts = (value: unknown): SavedConcept[] =>
  Array.isArray(value) ? value.filter(isSavedConcept) : [];
