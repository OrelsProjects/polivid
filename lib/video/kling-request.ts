/**
 * Builds the request for one Kling clip. Nothing here touches the network,
 * so the shape each model is sent can be tested.
 */

import { MAX_SWAP_CHARACTERS, SWAP_PROMPT_LIMIT, type SwapOrientation } from "./swap";

export const KLING_API = "https://api-singapore.klingai.com";

/** Kling 3.0 and older read this much of a prompt. */
const PROMPT_LIMIT = 3000;
/** Kling 4.0 reads 26,000 English characters or 11,000 in other scripts. The lower one is safe for both. */
const LONG_PROMPT_LIMIT = 11000;
/** Pictures Kling 4.0 takes in one request. */
const MOST_PICTURES = 10;

interface KlingRoute {
  /** Path segment, such as kling-3.0. */
  path: string;
  /** Omni takes several reference pictures. The others take one start frame. */
  omni?: boolean;
  /** Send settings.audio. Kling 2.6 native audio is 1080p only. */
  audio?: boolean;
  audioResolution?: string;
  /** Kling 3.0 can split a prompt into shots. A single beat stays one shot. */
  multiShot?: boolean;
  /**
   * Kling 4.0 and 4.0 Flash. They always make sound and plan their own shots, so neither
   * is a setting. Pictures go to the omni endpoint, where the start frame and the
   * reference pictures are told apart and the requested shape still applies.
   */
  four?: boolean;
}

const ROUTES: Record<string, KlingRoute> = {
  "kling-4.0": { path: "kling-4.0", four: true },
  "kling-4.0-flash": { path: "kling-4.0-flash", four: true },
  "kling-3.0": { path: "kling-3.0", audio: true, multiShot: true },
  "kling-3.0-turbo": { path: "kling-3.0-turbo" },
  "kling-3.0-omni": { path: "kling-3.0-omni", omni: true, audio: true, multiShot: true },
  "kling-2.6": { path: "kling-2.6", audio: true, audioResolution: "1080p" },
  "kling-2.5-turbo": { path: "kling-2.5-turbo" },
};

export interface KlingVideoRequest {
  /** Stored slug, such as kling-3.0. */
  model: string;
  prompt: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  generateAudio: boolean;
  imageDataUrl?: string;
  inputReferences?: Record<string, unknown>[];
}

export interface KlingCall {
  url: string;
  body: Record<string, unknown>;
}

const routeFor = (slug: string) => {
  const route = ROUTES[slug];
  if (!route) throw new Error(`${slug} is not a Kling model.`);
  return route;
};

const imageUrl = (reference: Record<string, unknown>) => {
  const image = reference.image_url as { url?: unknown } | undefined;
  return reference.type === "image_url" && typeof image?.url === "string" ? image.url : "";
};

const referenceUrls = (request: KlingVideoRequest) => (request.inputReferences ?? []).map(imageUrl).filter(Boolean);

const pictures = (request: KlingVideoRequest) => {
  const urls = [request.imageDataUrl ?? "", ...referenceUrls(request)].filter(Boolean);
  return [...new Set(urls)].slice(0, 7);
};

const settingsFor = (route: KlingRoute, request: KlingVideoRequest) => {
  const audioOn = route.audio === true && request.generateAudio;
  const resolution = audioOn && route.audioResolution ? route.audioResolution : request.resolution;
  const settings: Record<string, unknown> = {
    resolution,
    aspect_ratio: request.aspectRatio,
    duration: request.duration,
  };
  if (route.audio) settings.audio = audioOn ? "native" : "off";
  if (route.multiShot) settings.multi_shot = false;
  return settings;
};

const contentsFor = (route: KlingRoute, request: KlingVideoRequest, images: string[]) => {
  const prompt = { type: "prompt", text: request.prompt.slice(0, PROMPT_LIMIT) };
  if (route.omni) {
    const [first, ...rest] = images;
    return [
      prompt,
      ...(first ? [{ type: "first_frame", url: first }] : []),
      ...rest.map((url) => ({ type: "refer_image", url })),
    ];
  }
  const frame = images[0];
  if (!frame) return null;
  return [prompt, { type: "first_frame", url: frame }];
};

const endpointFor = (route: KlingRoute, hasFrame: boolean) => {
  if (route.omni) return `${KLING_API}/omni-video/${route.path}`;
  if (hasFrame) return `${KLING_API}/image-to-video/${route.path}`;
  return `${KLING_API}/text-to-video/${route.path}`;
};

const OPTIONS = { watermark_info: { enabled: false } };

const fourCall = (route: KlingRoute, request: KlingVideoRequest): KlingCall => {
  const text = request.prompt.slice(0, LONG_PROMPT_LIMIT);
  const settings = {
    resolution: request.resolution,
    aspect_ratio: request.aspectRatio,
    duration: request.duration,
  };
  const frame = request.imageDataUrl ?? "";
  const references = [...new Set(referenceUrls(request))]
    .filter((url) => url !== frame)
    .slice(0, MOST_PICTURES - (frame ? 1 : 0));
  if (!frame && references.length === 0) {
    return {
      url: `${KLING_API}/text-to-video/${route.path}`,
      body: { prompt: text, settings, options: OPTIONS },
    };
  }
  return {
    url: `${KLING_API}/omni-video/${route.path}`,
    body: {
      contents: [
        { type: "prompt", text },
        // The start frame has to come ahead of the reference pictures.
        ...(frame ? [{ type: "first_frame", url: frame }] : []),
        // Kling asks for an id on each picture once there is more than one.
        ...references.map((url, index) => ({ type: "refer_image", url, id: `image_${index + 1}` })),
      ],
      settings,
      options: OPTIONS,
    },
  };
};

/** Where to send the clip and what to send. */
export const klingCall = (request: KlingVideoRequest): KlingCall => {
  const route = routeFor(request.model);
  if (route.four) return fourCall(route, request);
  const contents = contentsFor(route, request, pictures(request));
  return {
    url: endpointFor(route, Boolean(contents)),
    body: {
      ...(contents ? { contents } : { prompt: request.prompt.slice(0, PROMPT_LIMIT) }),
      settings: settingsFor(route, request),
      options: OPTIONS,
    },
  };
};

export interface KlingSwapRequest {
  /** The character picture, as a URL Kling can fetch or a data URL. */
  imageUrl: string;
  /** The performance video, as a URL Kling can fetch. */
  videoUrl: string;
  /** Optional notes on wardrobe, setting, or style. Empty sends none. */
  prompt?: string;
  orientation: SwapOrientation;
  resolution: string;
  /** Keep the performance video's sound. */
  keepSound: boolean;
}

/** Motion Control: the character in the picture performs the moves in the video. */
export const klingSwapCall = (request: KlingSwapRequest): KlingCall => {
  const prompt = request.prompt?.trim().slice(0, SWAP_PROMPT_LIMIT) ?? "";
  return {
    url: `${KLING_API}/motion-control/kling-3.0`,
    body: {
      contents: [
        ...(prompt ? [{ type: "prompt", text: prompt }] : []),
        { type: "image", url: request.imageUrl },
        { type: "video", url: request.videoUrl },
      ],
      settings: {
        character_orientation: request.orientation,
        resolution: request.resolution,
        audio: request.keepSound ? "original" : "off",
      },
      options: OPTIONS,
    },
  };
};

export interface KlingSwapEditRequest {
  /** The character pictures, in order, cited in the prompt as @image_1, @image_2 and on. Kling takes up to four. */
  imageUrls: readonly string[];
  /** The video to edit, cited in the prompt as @video_1. */
  videoUrl: string;
  /** The full instruction, already naming each picture. */
  prompt: string;
  resolution: string;
  /** Seconds to make. Kling takes 3 to 15. */
  duration: number;
  /** Keep the video's sound. */
  keepSound: boolean;
}

/** Kling 3.0 Omni edits the video itself: what the prompt names is replaced, the rest is kept. */
export const klingSwapEditCall = (request: KlingSwapEditRequest): KlingCall => ({
  url: `${KLING_API}/omni-video/kling-3.0-omni`,
  body: {
    contents: [
      { type: "prompt", text: request.prompt.slice(0, SWAP_PROMPT_LIMIT) },
      { type: "base_video", url: request.videoUrl, id: "video_1" },
      ...request.imageUrls.slice(0, MAX_SWAP_CHARACTERS).map((url, index) => ({ type: "refer_image", url, id: `image_${index + 1}` })),
    ],
    settings: {
      resolution: request.resolution,
      duration: Math.min(15, Math.max(3, Math.round(request.duration))),
      // An edited video can't make new sound. It keeps the original or has none.
      audio: request.keepSound ? "original" : "off",
      multi_shot: false,
    },
    options: OPTIONS,
  },
});

/**
 * Kling answers an empty or expired account with a "try again" status, the same as when it is busy.
 * Waiting never fixes this one, so it is told apart by its message.
 */
export const isKlingOutOfCredit = (message: string) =>
  /balance|insufficient|quota|arrear|resource pack|package (?:has )?expired/i.test(message);

/** What the person sees. The account's state is for the owner's log, not the video card. */
export const KLING_UNAVAILABLE = "Kling can't take new videos right now. Your credits were returned. Try again later.";

/**
 * What a Kling task that failed after it was accepted says to the person. Kling can take a task and then
 * fail it for the account's balance, so that case gets the same wording as a refused submission.
 */
export const klingTaskFailure = (message: string | undefined, status: string) => {
  const text = message?.trim() || `Kling ${status}.`;
  const outOfCredit = isKlingOutOfCredit(text);
  return { message: outOfCredit ? KLING_UNAVAILABLE : text, outOfCredit, detail: text };
};
