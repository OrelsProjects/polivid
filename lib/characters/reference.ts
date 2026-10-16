import { MAX_REFERENCE_IMAGES } from "@/lib/video/schema";

/** Puts the character picture first, without duplicates, and stays under the cap. */
export const mergeCharacterImage = (keys: readonly string[], imageKey?: string | null, max = MAX_REFERENCE_IMAGES) => {
  const owned = keys.filter((key) => key.trim().length > 0);
  if (!imageKey) return [...new Set(owned)].slice(0, max);
  return [imageKey, ...owned.filter((key) => key !== imageKey)].slice(0, max);
};
