/** Pads or trims narration so it lasts exactly as long as the picture. */
export const narrationFilter = (durationSec: number) => {
  const duration = Math.max(0.5, durationSec).toFixed(3);
  return `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${duration},atrim=0:${duration}[a]`;
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
