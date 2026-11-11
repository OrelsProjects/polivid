/**
 * Builds the request for one Kling clip. Nothing here touches the network,
 * so the shape each model is sent can be tested.
 */

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
