import {
  AudioWaveform,
  BarChart3,
  BookOpen,
  Film,
  FlipHorizontal2,
  GraduationCap,
  ImagePlay,
  Landmark,
  Link2,
  ListOrdered,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Newspaper,
  Package,
  Quote,
  RectangleVertical,
  Repeat,
  Repeat2,
  RotateCw,
  Rss,
  ScrollText,
  ShoppingBag,
  Smile,
  Store,
  UserRoundCheck,
  VenetianMask,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { VIDEO_MODES, videoModeById, type VideoMode, type VideoModeId, type VideoTier } from "./modes";
import type { EditOp } from "./edit-ops";
import type { VideoFormat } from "./schema";
import type { VisualMedia } from "./stills";

export const TOOL_CATEGORIES = [
  { id: "creation", label: "Creation" },
  { id: "social", label: "Social" },
  { id: "marketing", label: "Marketing" },
  { id: "education", label: "Education" },
  { id: "music", label: "Music" },
  { id: "editing", label: "Editing" },
] as const;
export type ToolCategoryId = (typeof TOOL_CATEGORIES)[number]["id"];

/** Parts of the create form a tool can switch off. */
export const FORM_SECTIONS = [
  "references",
  "look",
  "showText",
  "visualDirection",
  "format",
  "length",
  "tier",
  "model",
  "character",
  "improve",
  "media",
  "verbatim",
  "link",
  "op",
] as const;
export type FormSection = (typeof FORM_SECTIONS)[number];

/** Starting values a tool puts in the form. The person can change every one of them. */
export interface ToolDefaults {
  format?: VideoFormat;
  length?: number;
  tier?: VideoTier;
  presetId?: string;
  visualDirection?: string;
  showText?: boolean;
  characterId?: string;
  /** `stills` starts the tool on drawn, animated pictures instead of filmed clips. */
  media?: VisualMedia;
  /** Start with the script read word for word. */
  verbatim?: boolean;
  /** Built-in clip a loop video starts on. */
  backgroundId?: string;
  /** The quick edit a tool opens on, and its setting. */
  op?: EditOp;
  opValue?: string;
}

/**
 * One card in the gallery. A tool is a Create mode plus copy, starting values, and a
 * narrowed form. It never changes how the video is made: the mode does that.
 */
export interface CreateTool {
  slug: string;
  mode: VideoModeId;
  title: string;
  description: string;
  category: ToolCategoryId;
  featured?: boolean;
  keywords: readonly string[];
  icon: LucideIcon;
  tint: string;
  placeholder?: string;
  /** An outline the person can drop into an empty prompt. */
  scaffold?: string;
  defaults?: ToolDefaults;
  /** Looks offered for this tool. Unset means every look the mode allows. */
  presets?: readonly string[];
  hide?: readonly FormSection[];
  /** The tool starts from a pasted link, so the link field leads the form. */
  input?: "link";
  /** The tool does one quick edit only, so the choice of edit is not shown. */
  lockOp?: boolean;
  referenceLabel?: string;
  referenceHint?: string;
}

const MODE_CATEGORY: Record<VideoModeId, ToolCategoryId> = {
  shorts: "social",
  voiceover: "creation",
  prompt: "creation",
  "motion-graphics": "creation",
  music: "music",
  avatar: "creation",
  image: "creation",
  "av-to-video": "editing",
  lyrics: "music",
  captions: "editing",
  edit: "editing",
  direct: "creation",
};

const MODE_KEYWORDS: Record<VideoModeId, readonly string[]> = {
  shorts: ["tiktok", "reels", "presenter", "talking head", "vertical"],
  voiceover: ["script", "narration", "narrator", "article", "faceless"],
  prompt: ["idea", "text to video", "scene", "clip"],
  "motion-graphics": ["animation", "explainer", "charts", "kinetic text"],
  music: ["song", "track", "mp3", "music video"],
  avatar: ["photo", "talking", "speaker", "headshot"],
  image: ["photo", "picture", "animate", "still"],
  "av-to-video": ["podcast", "interview", "long video", "clips"],
  lyrics: ["song", "lyrics", "singer", "karaoke"],
  captions: ["subtitles", "transcribe", "words on screen"],
  edit: ["rotate", "flip", "resize", "crop", "loop", "volume", "mute", "mirror"],
  direct: ["raw", "exact", "as typed", "no planning", "untouched", "model prompt", "one clip"],
};

const FEATURED_MODES: readonly VideoModeId[] = ["prompt", "voiceover", "shorts"];

/** Every mode is also a tool, under its own id, so `/create/<modeId>` keeps working. */
const modeAsTool = (mode: VideoMode): CreateTool => ({
  slug: mode.id,
  mode: mode.id,
  title: mode.title,
  description: mode.description,
  category: MODE_CATEGORY[mode.id],
  featured: FEATURED_MODES.includes(mode.id),
  keywords: MODE_KEYWORDS[mode.id],
  icon: mode.icon,
  tint: mode.tint,
});

const REALISM_LOOKS = ["default", "ultra-realism", "realist", "photography", "movie"] as const;

const VARIANTS: readonly CreateTool[] = [
  {
    slug: "cinematic-scene",
    mode: "prompt",
    title: "Cinematic Scene",
    description: "One wide, film-style scene from a description. Good for openers and mood shots.",
    category: "creation",
    keywords: ["film", "movie", "trailer", "wide", "mood"],
    icon: Film,
    tint: "from-slate-700 to-amber-200",
    placeholder: "Describe the scene: who is in it, where, the light, and how the camera moves.",
    defaults: { format: "16:9", length: 10, tier: "ultra", presetId: "movie" },
    presets: ["movie", "modern-noir", "ultra-realism", "photography", "raytraced"],
  },
  {
    slug: "cartoon-short",
    mode: "prompt",
    title: "Cartoon Short",
    description: "A short animated scene in a 3D or hand-drawn look.",
    category: "creation",
    keywords: ["animation", "animated", "kids", "3d", "drawn"],
    icon: Smile,
    tint: "from-amber-300 to-rose-200",
    placeholder: "Describe the characters and what happens. Keep it to one small story beat.",
    defaults: { format: "9:16", length: 10, tier: "pro" },
    presets: [
      "pixar",
      "low-poly",
      "claymation",
      "felt-craft",
      "papercraft",
      "retro-cartoon",
      "paper-collage",
      "kids",
      "creative",
    ],
  },
  {
    slug: "b-roll",
    mode: "prompt",
    title: "B-roll Loop",
    description: "A short clip with no words or voice, to sit behind text or narration.",
    category: "creation",
    keywords: ["background", "loop", "footage", "stock", "texture"],
    icon: Repeat,
    tint: "from-teal-300 to-sky-100",
    placeholder: "Describe the footage: the subject, the place, and a slow, steady camera move.",
    defaults: { length: 5, tier: "low", showText: false, characterId: "off" },
    hide: ["showText", "character"],
  },
  {
    slug: "photo-animator",
    mode: "image",
    title: "Bring a Photo to Life",
    description: "Add gentle movement to a photo: hair, light, water, a slow push in.",
    category: "creation",
    keywords: ["photo", "memory", "portrait", "animate", "old photo"],
    icon: ImagePlay,
    tint: "from-emerald-300 to-lime-100",
    placeholder: "Say what should move. Small movements look most natural.",
    scaffold: "Subtle natural movement. The camera pushes in slowly. Nothing in the picture changes shape.",
    defaults: { length: 5, tier: "low" },
  },
  {
    slug: "product-ad",
    mode: "prompt",
    title: "Product Ad",
    description: "A short ad built around your product photos: hook, benefit, call to action.",
    category: "marketing",
    featured: true,
    keywords: ["advert", "commercial", "ecommerce", "shop", "promo"],
    icon: ShoppingBag,
    tint: "from-orange-300 to-yellow-100",
    placeholder: "Name the product, who it is for, and the one thing it does best.",
    scaffold:
      "Hook: the problem in one line.\nBenefit: what the product does about it.\nProof: one detail that shows it works.\nCall to action: what to do next.",
    defaults: { format: "9:16", length: 15, tier: "pro" },
    presets: REALISM_LOOKS,
    referenceLabel: "Product photos",
    referenceHint: "Optional. Clear photos of the product on a plain background work best.",
  },
  {
    slug: "creator-ad",
    mode: "shorts",
    title: "Creator-style Ad",
    description: "Your character talks to camera about a product, the way a creator would.",
    category: "marketing",
    keywords: ["ugc", "testimonial", "review", "advert", "presenter"],
    icon: Megaphone,
    tint: "from-pink-300 to-orange-100",
    placeholder: "Write what your character says. Start with the problem, then the product.",
    scaffold:
      "I kept running into this problem: …\nThen I tried … and here is what changed.\nIf that sounds like you, …",
    defaults: { format: "9:16", length: 20 },
  },
  {
    slug: "app-promo",
    mode: "motion-graphics",
    title: "App Promo",
    description: "An animated promo that walks through what your app does.",
    category: "marketing",
    keywords: ["saas", "software", "launch", "feature", "demo"],
    icon: Package,
    tint: "from-indigo-300 to-sky-100",
    placeholder: "Name the app, who uses it, and the three things it does.",
    defaults: { format: "9:16", length: 30, presetId: "bold" },
  },
  {
    slug: "product-photo-video",
    mode: "image",
    title: "Product Photo to Video",
    description: "Turn one product photo into a short clip with a slow turn or push in.",
    category: "marketing",
    keywords: ["ecommerce", "listing", "shop", "turntable", "packshot"],
    icon: Package,
    tint: "from-yellow-200 to-stone-100",
    placeholder: "Say how the camera should move around the product.",
    scaffold: "The camera circles the product slowly. Studio light. The product keeps its exact shape and label.",
    defaults: { format: "1:1", length: 5 },
  },
  {
    slug: "spokesperson",
    mode: "avatar",
    title: "Spokesperson Video",
    description: "A person in a photo you upload delivers your message to camera.",
    category: "marketing",
    keywords: ["announcement", "welcome", "message", "talking", "founder"],
    icon: UserRoundCheck,
    tint: "from-stone-300 to-rose-100",
    placeholder: "Write the message. Keep it under about 50 words for 20 seconds.",
    defaults: { format: "16:9", length: 20 },
  },
  {
    slug: "explainer",
    mode: "voiceover",
    title: "Explainer Video",
    description: "A narrated walk-through of one idea, in three clear points.",
    category: "education",
    featured: true,
    keywords: ["lesson", "teach", "how it works", "tutorial", "guide"],
    icon: GraduationCap,
    tint: "from-sky-300 to-emerald-100",
    placeholder: "Name the idea and who you are explaining it to.",
    scaffold: "The question: …\nPoint one: …\nPoint two: …\nPoint three: …\nThe takeaway: …",
    defaults: { format: "16:9", length: 60, presetId: "educational" },
  },
  {
    slug: "data-story",
    mode: "motion-graphics",
    title: "Data Story",
    description: "Numbers with sources, drawn as animated charts and callouts.",
    category: "education",
    keywords: ["chart", "statistics", "numbers", "report", "sources"],
    icon: BarChart3,
    tint: "from-cyan-300 to-slate-100",
    placeholder: "Name the topic and the figures you want on screen. Ultra looks up and cites sources.",
    defaults: { format: "16:9", length: 60, tier: "ultra", presetId: "editorial" },
  },
  {
    slug: "news-recap",
    mode: "motion-graphics",
    title: "News Recap",
    description: "What happened, why it matters, and what comes next, in under a minute.",
    category: "education",
    keywords: ["headline", "current events", "summary", "briefing"],
    icon: Newspaper,
    tint: "from-red-300 to-slate-100",
    placeholder: "Name the story. Add the date if it matters.",
    scaffold: "What happened: …\nWhy it matters: …\nWhat comes next: …",
    defaults: { format: "9:16", length: 45, tier: "ultra", presetId: "editorial" },
  },
  {
    slug: "quote-card",
    mode: "motion-graphics",
    title: "Quote Video",
    description: "One line of text, animated on a clean background.",
    category: "social",
    keywords: ["saying", "motivation", "text", "typography"],
    icon: Quote,
    tint: "from-zinc-300 to-white",
    placeholder: "Paste the line, and who said it.",
    defaults: { format: "1:1", length: 10, tier: "low", presetId: "minimal" },
  },
  {
    slug: "song-visualizer",
    mode: "music",
    title: "Song Visualizer",
    description: "Moving visuals for a track, with no words on screen.",
    category: "music",
    keywords: ["audio", "spotify", "lofi", "cover", "loop"],
    icon: AudioWaveform,
    tint: "from-violet-400 to-cyan-200",
    placeholder: "Describe the world the music lives in. Leave blank to follow the track.",
    defaults: { format: "1:1", length: 30, showText: false },
    presets: ["sci-fi", "fantasy", "environment", "movie", "raytraced"],
    hide: ["showText"],
  },
];

const ILLUSTRATION_LOOKS = ["ghibli", "retro-cartoon", "paper-collage", "kids", "creative", "papercraft"] as const;

/** Tools that open on animated stills: drawn pictures, a voice, and captions. */
const STILLS_VARIANTS: readonly CreateTool[] = [
  {
    slug: "script-to-video",
    mode: "voiceover",
    title: "Script to Video",
    description: "Your script, read exactly as written, over pictures drawn for each part.",
    category: "creation",
    featured: true,
    keywords: ["script", "word for word", "narration", "slideshow", "pictures"],
    icon: ScrollText,
    tint: "from-indigo-300 to-rose-100",
    placeholder: "Paste the script. Every word is read as written, at about 150 words a minute.",
    defaults: { media: "stills", verbatim: true },
  },
  {
    slug: "faceless-short",
    mode: "voiceover",
    title: "Faceless Short",
    description: "A narrated vertical short with pictures and captions, and no one on camera.",
    category: "social",
    featured: true,
    keywords: ["no face", "narrated", "vertical", "channel", "captions"],
    icon: VenetianMask,
    tint: "from-slate-400 to-violet-200",
    placeholder: "Name the topic and the angle. We write a short script and illustrate it.",
    defaults: { media: "stills", format: "9:16", length: 30 },
  },
  {
    slug: "illustrated-story",
    mode: "voiceover",
    title: "Illustrated Story",
    description: "A story told by a narrator over hand-drawn pictures.",
    category: "creation",
    keywords: ["bedtime", "tale", "storybook", "fable", "children"],
    icon: BookOpen,
    tint: "from-amber-200 to-emerald-100",
    placeholder: "Tell the story in a few lines, or paste the whole thing.",
    defaults: { media: "stills", format: "9:16", length: 60, presetId: "kids" },
    presets: ILLUSTRATION_LOOKS,
  },
  {
    slug: "history-minute",
    mode: "voiceover",
    title: "History in a Minute",
    description: "One moment from the past, narrated over period pictures.",
    category: "education",
    keywords: ["past", "documentary", "event", "era", "timeline"],
    icon: Landmark,
    tint: "from-stone-400 to-amber-100",
    placeholder: "Name the event, the place, and the year.",
    scaffold: "What happened: …\nWho was there: …\nWhy it mattered: …",
    defaults: { media: "stills", format: "16:9", length: 60, presetId: "photography" },
    presets: ["photography", "movie", "realist", "ultra-realism"],
  },
  {
    slug: "top-list",
    mode: "voiceover",
    title: "Top 5 List",
    description: "A countdown of five things, one picture each, with captions.",
    category: "social",
    keywords: ["countdown", "ranking", "best", "listicle", "five"],
    icon: ListOrdered,
    tint: "from-lime-300 to-sky-100",
    placeholder: "Name the list, for example the five quietest beaches in Portugal.",
    scaffold: "Number five: …\nNumber four: …\nNumber three: …\nNumber two: …\nNumber one: …",
    defaults: { media: "stills", format: "9:16", length: 45 },
  },
];

/** Tools that start from a web page: we read it, write the script, and narrate it. */
const LINK_VARIANTS: readonly CreateTool[] = [
  {
    slug: "article-to-video",
    mode: "voiceover",
    title: "Article to Video",
    description: "Paste a link to an article. We read it and turn the main point into a narrated video.",
    category: "creation",
    featured: true,
    keywords: ["link", "url", "news", "post", "web page", "summary"],
    icon: Link2,
    tint: "from-sky-400 to-indigo-100",
    input: "link",
    placeholder: "Read a link above, or paste the article text here.",
    defaults: { media: "stills", format: "9:16", length: 60 },
  },
  {
    slug: "blog-to-short",
    mode: "voiceover",
    title: "Blog Post to Short",
    description: "Turn one of your blog posts into a 30-second vertical short.",
    category: "marketing",
    keywords: ["link", "url", "newsletter", "repurpose", "content"],
    icon: Rss,
    tint: "from-orange-300 to-pink-100",
    input: "link",
    placeholder: "Read your post's link above, or paste the post here.",
    defaults: { media: "stills", format: "9:16", length: 30 },
  },
  {
    slug: "product-page-ad",
    mode: "voiceover",
    title: "Product Page to Ad",
    description: "Paste a product page. We pull out what it sells and write a short ad for it.",
    category: "marketing",
    keywords: ["link", "url", "shop", "store", "landing page", "advert"],
    icon: Store,
    tint: "from-emerald-300 to-yellow-100",
    input: "link",
    placeholder: "Read the product page above. Then add who the ad is for, if it matters.",
    defaults: { media: "stills", format: "9:16", length: 20, presetId: "photography" },
    presets: REALISM_LOOKS,
  },
];

/** Tools that read text over a looping background: the cheapest way to make a narrated video. */
const LOOP_VARIANTS: readonly CreateTool[] = [
  {
    slug: "story",
    mode: "voiceover",
    title: "Story Video",
    description: "Your story, read aloud over a calm moving background, with captions that follow every word.",
    category: "social",
    featured: true,
    keywords: ["narrated", "background", "captions", "text story", "read aloud"],
    icon: MessageSquareText,
    tint: "from-teal-400 to-indigo-200",
    placeholder: "Paste the story. It is read exactly as written.",
    defaults: { media: "loop", verbatim: true, format: "9:16", backgroundId: "aurora" },
    hide: ["look", "visualDirection"],
  },
  {
    slug: "post-to-video",
    mode: "voiceover",
    title: "Forum Post to Video",
    description: "Paste a post or its link. A voice reads it over a background loop, with captions.",
    category: "social",
    keywords: ["thread", "post", "confession", "question", "link", "read aloud"],
    icon: MessagesSquare,
    tint: "from-orange-400 to-rose-200",
    input: "link",
    placeholder: "Paste the post, or read its link above. Check the text before you generate.",
    defaults: { media: "loop", verbatim: true, format: "9:16", backgroundId: "midnight" },
    hide: ["look", "visualDirection"],
  },
  {
    slug: "quote-loop",
    mode: "voiceover",
    title: "Quotes over a Loop",
    description: "A few lines, spoken slowly over a soft background. Good for a daily quote.",
    category: "social",
    keywords: ["quote", "affirmation", "motivation", "calm", "daily"],
    icon: Quote,
    tint: "from-emerald-300 to-amber-100",
    placeholder: "Paste the lines, one thought per sentence.",
    defaults: { media: "loop", verbatim: true, format: "9:16", backgroundId: "meadow" },
    hide: ["look", "visualDirection"],
  },
];

/** One quick edit each, so the tool can be found by what it does. */
const EDIT_VARIANTS: readonly CreateTool[] = [
  {
    slug: "make-vertical",
    mode: "edit",
    title: "Make it Vertical",
    description: "Turn a wide video into a 9:16 one. The whole picture is kept, over a blurred copy of itself.",
    category: "editing",
    featured: true,
    keywords: ["9:16", "portrait", "reels", "shorts", "resize", "crop"],
    icon: RectangleVertical,
    tint: "from-violet-300 to-sky-100",
    defaults: { op: "resize", opValue: "9:16:pad" },
    lockOp: true,
  },
  {
    slug: "rotate-video",
    mode: "edit",
    title: "Rotate Video",
    description: "Fix a video filmed sideways or upside down.",
    category: "editing",
    keywords: ["sideways", "upside down", "turn", "orientation"],
    icon: RotateCw,
    tint: "from-sky-300 to-slate-100",
    defaults: { op: "rotate", opValue: "90" },
    lockOp: true,
  },
  {
    slug: "flip-video",
    mode: "edit",
    title: "Flip Video",
    description: "Mirror a video left to right, or top to bottom.",
    category: "editing",
    keywords: ["mirror", "reverse", "selfie"],
    icon: FlipHorizontal2,
    tint: "from-emerald-300 to-slate-100",
    defaults: { op: "flip", opValue: "horizontal" },
    lockOp: true,
  },
  {
    slug: "loop-video",
    mode: "edit",
    title: "Loop Video",
    description: "Play a short clip several times in a row, as one file.",
    category: "editing",
    keywords: ["repeat", "gif", "longer"],
    icon: Repeat2,
    tint: "from-amber-300 to-slate-100",
    defaults: { op: "loop", opValue: "3" },
    lockOp: true,
  },
  {
    slug: "change-volume",
    mode: "edit",
    title: "Volume and Mute",
    description: "Make a video louder or quieter, or take the sound out.",
    category: "editing",
    keywords: ["sound", "audio", "quiet", "loud", "silent"],
    icon: Volume2,
    tint: "from-rose-300 to-slate-100",
    defaults: { op: "volume", opValue: "150" },
    lockOp: true,
  },
];

export const CREATE_TOOLS: readonly CreateTool[] = [
  ...VIDEO_MODES.map(modeAsTool),
  ...VARIANTS,
  ...STILLS_VARIANTS,
  ...LINK_VARIANTS,
  ...LOOP_VARIANTS,
  ...EDIT_VARIANTS,
];

const bySlug = new Map(CREATE_TOOLS.map((tool) => [tool.slug, tool]));

export const toolBySlug = (slug: string | null | undefined) => (slug ? (bySlug.get(slug) ?? null) : null);

/** A tool is usable when the mode behind it is. */
export const isToolLive = (tool: CreateTool) => videoModeById(tool.mode)?.status === "live";

export const liveTools = () => CREATE_TOOLS.filter(isToolLive);

export const toolsByCategory = (category: ToolCategoryId) =>
  CREATE_TOOLS.filter((tool) => tool.category === category);

export const featuredTools = () => CREATE_TOOLS.filter((tool) => tool.featured);

export const toolCategoryLabel = (id: ToolCategoryId) =>
  TOOL_CATEGORIES.find((category) => category.id === id)?.label ?? id;

/** Matches a search box entry against a tool's name, description, and keywords. */
export const toolMatches = (tool: CreateTool, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [tool.title, tool.description, toolCategoryLabel(tool.category), ...tool.keywords].some((text) =>
    text.toLowerCase().includes(needle),
  );
};

/** The tool that best stands in for a mode: the one whose slug is the mode id. */
export const toolForMode = (mode: VideoModeId) => bySlug.get(mode) ?? null;
