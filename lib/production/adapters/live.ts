import { defaultVideoCapability } from "../capabilities";
import { createElevenMusicAdapter, createElevenSfxAdapter, createElevenSpeechAdapter, createScribeAdapter } from "./elevenlabs";
import { createGoogleOmniAdapter } from "./google-omni";
import { createImageAdapter } from "./images";
import { createOpenRouterVideoAdapter } from "./openrouter-video";
import { createReviewAdapter } from "./review";
import { createPassthroughLipsyncAdapter, createSyncAdapter } from "./sync";
import type { AdapterSet } from "./runtime";

export const getLiveAdapters = (): AdapterSet => ({
  image: createImageAdapter(),
  video: defaultVideoCapability().id === "video-omni" ? createGoogleOmniAdapter() : createOpenRouterVideoAdapter(),
  speech: createElevenSpeechAdapter(),
  music: createElevenMusicAdapter(),
  sfx: createElevenSfxAdapter(),
  lipsync: process.env.SYNC_API_KEY ? createSyncAdapter() : createPassthroughLipsyncAdapter(),
  review: createReviewAdapter(),
  transcribe: createScribeAdapter(),
});
