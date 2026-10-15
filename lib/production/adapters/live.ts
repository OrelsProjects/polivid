import { createElevenMusicAdapter, createElevenSfxAdapter, createElevenSpeechAdapter, createScribeAdapter } from "./elevenlabs";
import { createGoogleOmniAdapter } from "./google-omni";
import { createImageAdapter } from "./images";
import { createOpenRouterVideoAdapter } from "./openrouter-video";
import { createReviewAdapter } from "./review";
import { createSyncAdapter } from "./sync";
import type { AdapterSet } from "./runtime";

export const getLiveAdapters = (): AdapterSet => ({
  image: createImageAdapter(),
  video: process.env.GEMINI_API_KEY ? createGoogleOmniAdapter() : createOpenRouterVideoAdapter(),
  speech: createElevenSpeechAdapter(),
  music: createElevenMusicAdapter(),
  sfx: createElevenSfxAdapter(),
  lipsync: createSyncAdapter(),
  review: createReviewAdapter(),
  transcribe: createScribeAdapter(),
});
