import "server-only";
import { transcribeMedia } from "@/lib/ai/transcribe";
import { writeVoiceover } from "@/lib/ai/voiceover";
import { getUpload, toDataUrl } from "@/lib/storage/s3";
import { isAudioKey, isImageKey, isOwnedUploadKey, isVideoKey } from "@/lib/storage/upload-key";
import type { FootageRequest } from "./footage";
import { defaultPromptForMode, videoModeById } from "./modes";
import { withOnScreenText } from "./on-screen-text";
import type { VideoFormat } from "./schema";

export interface PreparedJob {
  prompt: string;
  format: VideoFormat;
  length: number;
  model: string;
  resolution?: string;
  imageDataUrl?: string;
  inputReferences?: Record<string, unknown>[];
  transcript?: string;
  reuseUploadAsFootage?: boolean;
  mediaBytes?: Uint8Array;
}

export const prepareModeJob = async (
  userId: string,
  input: {
    prompt: string;
    format: VideoFormat;
    length: number;
    model: string;
    mode?: string;
    resolution?: string;
    mediaKey?: string;
    referenceKeys?: string[];
    showText?: boolean;
  },
): Promise<PreparedJob> => {
  const mode = input.mode ? videoModeById(input.mode) : null;
  const media = input.mediaKey ? await readOwnedMedia(userId, input.mediaKey) : null;
  const prompt = withOnScreenText(
    (input.prompt.trim() || (mode ? defaultPromptForMode(mode) : "")).trim(),
    input.showText !== false,
    mode?.id,
  );
  const base = {
    prompt,
    format: input.format,
    length: input.length,
    model: input.model,
    resolution: input.resolution,
  };

  if (!mode || mode.id === "prompt") {
    if (!input.referenceKeys?.length) return base;
    const inputReferences = [];
    for (const key of input.referenceKeys) {
      if (!isImageKey(key)) throw new Error("Upload a reference picture.");
      const reference = await readOwnedMedia(userId, key);
      inputReferences.push({ type: "image_url", image_url: { url: reference.dataUrl } });
    }
    return { ...base, inputReferences };
  }

  if (mode.id === "voiceover") {
    return { ...base, prompt: await writeVoiceover(prompt, input.length) };
  }

  if (mode.id === "image") {
    if (!media || !isImageKey(input.mediaKey ?? "")) throw new Error("Upload a starting picture.");
    return { ...base, imageDataUrl: media.dataUrl };
  }

  if (mode.id === "avatar") {
    if (!media || !isImageKey(input.mediaKey ?? "")) throw new Error("Upload a photo of the speaker.");
    return {
      ...base,
      prompt: `The person in the reference photo speaks this to camera, looking at the lens, with natural lip sync and a matching voice:\n${prompt}`,
      imageDataUrl: media.dataUrl,
    };
  }

  if (mode.id === "lyrics") {
    return {
      ...base,
      prompt: `A lyrics music video. Sing these lyrics and show them on screen:\n${prompt}`,
    };
  }

  if (mode.id === "music") {
    if (!media || !isAudioKey(input.mediaKey ?? "")) throw new Error("Upload a song.");
    return {
      ...base,
      prompt: `A music video that follows this track. ${prompt}`,
      inputReferences: [audioReference(media)],
    };
  }

  if (mode.id === "av-to-video") {
    if (!media) throw new Error("Upload an audio or video file.");
    return {
      ...base,
      prompt: `Edit this source into a short video. ${prompt}`,
      inputReferences: [mediaReference(media)],
    };
  }

  if (mode.id === "captions") {
    if (!media || !isVideoKey(input.mediaKey ?? "")) throw new Error("Upload a video to caption.");
    let transcript = prompt;
    try {
      transcript = await transcribeMedia(media.dataUrl, media.contentType);
    } catch (error) {
      console.error("Transcription failed; using the prompt as captions.", error);
      if (transcript === defaultPromptForMode(mode)) transcript = "";
    }
    return {
      ...base,
      prompt: transcript || prompt,
      transcript: transcript || prompt,
      reuseUploadAsFootage: true,
      mediaBytes: media.bytes,
    };
  }

  return base;
};

const readOwnedMedia = async (userId: string, key: string) => {
  if (!isOwnedUploadKey(userId, key)) throw new Error("That upload is not available.");
  const { bytes, contentType } = await getUpload(key);
  return { bytes, contentType, dataUrl: toDataUrl(bytes, contentType) };
};

const audioReference = (media: { dataUrl: string; contentType: string }) => ({
  type: "input_audio",
  input_audio: {
    data: media.dataUrl.replace(/^data:[^;]+;base64,/, ""),
    format: formatFromType(media.contentType),
  },
});

const mediaReference = (media: { dataUrl: string; contentType: string }) => {
  if (media.contentType.startsWith("audio/")) return audioReference(media);
  return { type: "video_url", video_url: { url: media.dataUrl } };
};

const formatFromType = (contentType: string) => {
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("aac") || contentType.includes("mp4")) return "wav";
  return "mp3";
};

export const footageFromPrepared = (prepared: PreparedJob): FootageRequest => ({
  prompt: prepared.prompt,
  format: prepared.format,
  length: prepared.length,
  model: prepared.model,
  resolution: prepared.resolution,
  imageDataUrl: prepared.imageDataUrl,
  inputReferences: prepared.inputReferences,
});
