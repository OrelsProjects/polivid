import { generationModelBySlug, type GenerationModel } from "./models";

/** Takes a real person's photo and a song slice together. */
export const SINGER_FALLBACK_SLUG = "minimax/hailuo-3";

/** Models that can hear the song, best first. The chosen model leads when it can. Real-photo refusers go last. */
export const singerModelsFor = (chosenSlug: string) => {
  const candidates = [chosenSlug, SINGER_FALLBACK_SLUG]
    .map((slug) => generationModelBySlug(slug))
    .filter((model): model is GenerationModel => Boolean(model?.referenceAudio));
  const ordered = [
    ...candidates.filter((model) => !model.refusesRealPeople),
    ...candidates.filter((model) => model.refusesRealPeople),
  ];
  return [...new Map(ordered.map((model) => [model.slug, model])).values()];
};

/** Clip lengths for a lyrics video, shared by the chosen model and the singer model when a singer photo is set. */
export const lyricsClipDurations = (chosen: GenerationModel, hasSinger: boolean) => {
  if (!hasSinger) return chosen.durations;
  const singer = singerModelsFor(chosen.slug)[0];
  if (!singer) return chosen.durations;
  const both = chosen.durations.filter((duration) => singer.durations.includes(duration));
  return both.length > 0 ? both : chosen.durations;
};
