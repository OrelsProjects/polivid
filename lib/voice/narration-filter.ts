const pictureDuration = (durationSec: number) => Math.max(0.5, durationSec).toFixed(3);

/** Pads or trims one audio stream so it lasts exactly as long as the picture. */
export const fittedNarrationFilter = (durationSec: number, input = "0:a") => {
  const duration = pictureDuration(durationSec);
  return `[${input}]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${duration},atrim=0:${duration}`;
};

/** Pads or trims narration so it lasts exactly as long as the picture. */
export const narrationFilter = (durationSec: number) => `${fittedNarrationFilter(durationSec, "1:a")}[a]`;

/** Footage sound stays under the voice. The voice is fitted to the picture. */
export const mixAudioFilter = (durationSec: number) => {
  const duration = pictureDuration(durationSec);
  const bed = `[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.35,apad=whole_dur=${duration},atrim=0:${duration}[bed]`;
  const voice = `${fittedNarrationFilter(durationSec, "1:a")}[voice]`;
  return `${bed};${voice};[bed][voice]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`;
};

export const replaceAudioArgs = (video: string, audio: string, output: string, durationSec: number) => [
  "-y",
  "-i",
  video,
  "-i",
  audio,
  "-filter_complex",
  narrationFilter(durationSec),
  "-map",
  "0:v:0",
  "-map",
  "[a]",
  "-c:v",
  "copy",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  output,
];

export const mixAudioArgs = (video: string, audio: string, output: string, durationSec: number) => [
  "-y",
  "-i",
  video,
  "-i",
  audio,
  "-filter_complex",
  mixAudioFilter(durationSec),
  "-map",
  "0:v:0",
  "-map",
  "[a]",
  "-c:v",
  "copy",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  output,
];

/** Fits speech to the picture and writes an mp3 the editor can play on its own. */
export const fitNarrationArgs = (audio: string, output: string, durationSec: number) => [
  "-y",
  "-i",
  audio,
  "-filter_complex",
  `${fittedNarrationFilter(durationSec, "0:a")}[a]`,
  "-map",
  "[a]",
  "-c:a",
  "libmp3lame",
  "-q:a",
  "2",
  output,
];

/**
 * Adds silence after one spoken beat. The sample rate and channels stay as they came,
 * so the padded beat still joins the others without re-encoding them.
 */
export const pausedNarrationArgs = (audio: string, output: string, pauseSec: number) => [
  "-y",
  "-i",
  audio,
  "-af",
  `apad=pad_dur=${Math.max(0, pauseSec).toFixed(3)}`,
  "-c:a",
  "libmp3lame",
  "-b:a",
  "128k",
  output,
];
