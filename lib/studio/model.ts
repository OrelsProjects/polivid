// FOR DELETION: Unused leftover of the first Studio preview. Only lib/store/studio-slice.ts imports it. See "For deletion" in docs/STUDIO.md.
/** Sample Studio state. Nothing here calls a provider or spends credits. */

export const STUDIO_VERSION = 1;

export type InputKind = "idea" | "script" | "writing" | "music" | "media";
export type PresentationId = "motion" | "scenes" | "illustration" | "media";
export type StyleId = "auto" | "bold" | "editorial" | "minimal" | "rounded" | "realism";
export type FormatId = "9:16" | "1:1" | "16:9";
export type VoiceId = "narrator" | "recorded" | "captions";
export type CreateStage = "configure" | "script" | "render" | "output";
export type Tone = "ready" | "attention" | "rendering" | "draft" | "batch" | "approved";

export interface DraftScene {
  title: string;
  text: string;
  onscreen: string;
  visual: string;
  seconds: number;
}

export interface EditableScene extends DraftScene {
  changed: boolean;
}

export interface VideoProject {
  id: string;
  title: string;
  format: FormatId;
  seconds: number;
  presentation: string;
  style: string;
  voice: VoiceId;
  inputLabel: string;
  engine: string;
  charged: number;
  version: number;
  ago: string;
  scenes: EditableScene[];
  selected: number;
  sim: string;
  downloaded: boolean;
  /** Rendering projects have not produced an MP4. */
  rendering: boolean;
}

export interface BatchItem {
  title: string;
  shape: string;
  cost: number;
  approved: boolean;
  gen: "none" | "rendering" | "ready" | "failed";
  version: number;
  passages: string[];
  script: string;
}

export interface RecoveryState {
  scene2: "failed" | "rendering" | "rendered";
  exportState: "none" | "failed" | "ready" | "partial";
  balance: number;
  lowCredits: boolean;
  sim: string;
}

export interface StudioState {
  version: number;
  hydrated: boolean;
  creditsLow: boolean;
  homeInput: InputKind;
  homeBrief: string;
  create: {
    stage: CreateStage;
    input: InputKind;
    brief: string;
    presentation: PresentationId;
    style: StyleId;
    format: FormatId;
    length: 30 | 60 | 90;
    voice: VoiceId;
    reference: boolean;
    scenes: DraftScene[];
    selectedScene: number;
    progress: number;
    downloaded: boolean;
    status: string;
  };
  videos: Record<string, VideoProject>;
  batch: { selected: number; sim: string; items: BatchItem[] };
  sources: { selected: string; checked: Record<string, boolean>; draft: string; notice: string };
  projectFilter: string;
  publish: { selected: number; caption: string; sim: string };
  automation: {
    selected: number;
    paused: boolean;
    approval: "review" | "auto";
    permission: boolean;
    capRun: number;
    capMonth: number;
  };
  recovery: RecoveryState;
}

export const INPUTS: { id: InputKind; label: string; hint: string }[] = [
  { id: "idea", label: "Idea", hint: "Describe what the video is about" },
  { id: "script", label: "Exact script", hint: "Paste the words. They will be used as written" },
  { id: "writing", label: "Article or link", hint: "Paste a post or a URL. Up to three concepts are suggested" },
  { id: "music", label: "Music or audio", hint: "Upload a track. Scenes follow the beat" },
];

export const HOME_INPUTS: { id: InputKind; label: string }[] = [
  ...INPUTS.map(({ id, label }) => ({ id, label })),
  { id: "media", label: "Your media" },
];

export const PRESENTATIONS: {
  id: PresentationId;
  label: string;
  hint: string;
  rate: number;
  rateLabel: string;
  disabled?: boolean;
}[] = [
  { id: "motion", label: "Motion graphics", hint: "Text, charts, quotes, sources", rate: 2, rateLabel: "2 credits / s" },
  { id: "scenes", label: "Generated scenes", hint: "Filmed by the model", rate: 10, rateLabel: "10 credits / s" },
  { id: "illustration", label: "Illustration", hint: "Stills that start to move", rate: 4, rateLabel: "4 credits / s" },
  {
    id: "media",
    label: "Your media",
    hint: "Add footage or images first",
    rate: 1,
    rateLabel: "Needs supplied media",
    disabled: true,
  },
];

export const STYLES: { id: StyleId; label: string; hint: string; mark: string; swatch: string; swatchFg: string }[] = [
  { id: "auto", label: "Auto", hint: "From the brief", mark: "Auto", swatch: "#E9E8F1", swatchFg: "#3F3D4F" },
  { id: "bold", label: "Bold", hint: "Big type, amber on navy", mark: "BOLD", swatch: "#141321", swatchFg: "#F5B342" },
  { id: "editorial", label: "Editorial", hint: "Serif, cream, magazine", mark: "Ed.", swatch: "#FBF4E7", swatchFg: "#141321" },
  { id: "minimal", label: "Minimal", hint: "Light, quiet, lots of air", mark: "—", swatch: "#FFFFFF", swatchFg: "#6B6A7B" },
  { id: "rounded", label: "Rounded 3D", hint: "Soft animated characters", mark: "3D", swatch: "#DDEBFF", swatchFg: "#1D5FD6" },
  { id: "realism", label: "Ultra realism", hint: "Believable light", mark: "Real", swatch: "#D9E6D2", swatchFg: "#2F5A2B" },
];

export const FORMATS: { id: FormatId; label: string; hint: string }[] = [
  { id: "9:16", label: "Vertical", hint: "9:16 · Shorts, Reels" },
  { id: "1:1", label: "Square", hint: "1:1 · Feeds" },
  { id: "16:9", label: "Wide", hint: "16:9 · YouTube, Substack" },
];

export const VOICES: { id: VoiceId; label: string }[] = [
  { id: "narrator", label: "Narrator" },
  { id: "recorded", label: "Orel · recorded" },
  { id: "captions", label: "Captions only" },
];

export const VOICE_LABEL: Record<VoiceId, string> = {
  narrator: "Narrator voice",
  recorded: "Orel · recorded voice",
  captions: "No voice · captions only",
};

const sleepScenes = (): DraftScene[] => [
  {
    title: "Hook",
    text: "You forget forty percent of what you learned today unless you sleep on it.",
    onscreen: "40% gone by tomorrow",
    visual: "Big number, counting down",
    seconds: 7,
  },
  {
    title: "Replay",
    text: "While you are out cold, the hippocampus replays the day and files the keepers into long-term storage.",
    onscreen: "Replay → file → keep",
    visual: "Three-step diagram",
    seconds: 13,
  },
  {
    title: "Takeaway",
    text: "Study, then sleep. One night is worth more than one more hour of cramming.",
    onscreen: "Study. Then sleep.",
    visual: "Closing card with the line",
    seconds: 10,
  },
];

const clickScenes = (): EditableScene[] => [
  {
    title: "Hook",
    text: "Every night your brain decides what to keep. Most of today is already on the list to delete.",
    onscreen: "Tonight decides",
    visual: "Big line, slow push-in",
    seconds: 5,
    changed: false,
  },
  {
    title: "Mechanism",
    text: "Sleep replays the day in fast forward and files the parts you used twice.",
    onscreen: "Replay → keep",
    visual: "Two-step diagram",
    seconds: 6,
    changed: false,
  },
  {
    title: "Close",
    text: "Click save. Then sleep.",
    onscreen: "Click. Then sleep.",
    visual: "Closing card",
    seconds: 4,
    changed: false,
  },
];

export const initialStudioState = (): StudioState => ({
  version: STUDIO_VERSION,
  hydrated: false,
  creditsLow: false,
  homeInput: "idea",
  homeBrief: "",
  create: {
    stage: "configure",
    input: "idea",
    brief:
      "Why sleep matters for memory. Three things that happen while you are out cold, for a general audience.",
    presentation: "motion",
    style: "bold",
    format: "9:16",
    length: 30,
    voice: "narrator",
    reference: false,
    scenes: sleepScenes(),
    selectedScene: 0,
    progress: 0,
    downloaded: false,
    status: "",
  },
  videos: {
    click: {
      id: "click",
      title: "Click, Then Sleep",
      format: "9:16",
      seconds: 15,
      presentation: "Motion graphics",
      style: "Bold",
      voice: "narrator",
      inputLabel: "Idea",
      engine: "Scene plan → editor render",
      charged: 60,
      version: 1,
      ago: "2 h ago",
      scenes: clickScenes(),
      selected: 0,
      sim: "",
      downloaded: false,
      rendering: false,
    },
    boombap: {
      id: "boombap",
      title: "Boom-bap studio promo",
      format: "9:16",
      seconds: 10,
      presentation: "Generated scenes",
      style: "Ultra realism",
      voice: "captions",
      inputLabel: "Music or audio",
      engine: "Footage model",
      charged: 0,
      version: 0,
      ago: "rendering",
      scenes: [
        {
          title: "Loop",
          text: "A drum kit in a small room, one take.",
          onscreen: "One take",
          visual: "Push-in on the kit",
          seconds: 10,
          changed: false,
        },
      ],
      selected: 0,
      sim: "",
      downloaded: false,
      rendering: true,
    },
    scifi: {
      id: "scifi",
      title: "Sci-fi chase, three cuts",
      format: "1:1",
      seconds: 10,
      presentation: "Generated scenes",
      style: "Ultra realism",
      voice: "captions",
      inputLabel: "Idea",
      engine: "Footage model",
      charged: 100,
      version: 2,
      ago: "Oct 17",
      scenes: [
        {
          title: "Cut 1",
          text: "A runner hits the corner.",
          onscreen: "Don't look back",
          visual: "Wide, then whip",
          seconds: 3,
          changed: false,
        },
        {
          title: "Cut 2",
          text: "The alley floods with light.",
          onscreen: "Hold",
          visual: "Low angle",
          seconds: 4,
          changed: false,
        },
        {
          title: "Cut 3",
          text: "They make the door.",
          onscreen: "Through",
          visual: "Close on the handle",
          seconds: 3,
          changed: false,
        },
      ],
      selected: 0,
      sim: "",
      downloaded: false,
      rendering: false,
    },
  },
  batch: {
    selected: 2,
    sim: "",
    items: [
      {
        title: "Why newsletters die in month three",
        shape: "45s",
        cost: 90,
        approved: true,
        gen: "ready",
        version: 1,
        passages: ["Most newsletters die in month three. Not from lack of ideas, from lack of a system."],
        script:
          "Most newsletters do not die from a lack of ideas. They die in month three, when the system that should carry them does not exist. Here is the system that carried mine.",
      },
      {
        title: "The swipe file habit",
        shape: "30s",
        cost: 60,
        approved: true,
        gen: "failed",
        version: 0,
        passages: ["a swipe file"],
        script:
          "A swipe file is a folder of lines you wish you had written. Three steps: capture the line, note why it works, steal the structure when you are stuck.",
      },
      {
        title: "End every issue with one question",
        shape: "30s",
        cost: 60,
        approved: false,
        gen: "none",
        version: 0,
        passages: ["a rule that every issue ends with one question"],
        script:
          "Every issue ends with one question. Not a survey, one question. The replies become next issue, and the reader becomes a co-writer.",
      },
    ],
  },
  sources: {
    selected: "oct",
    checked: { "oct-1": true, "oct-2": true, "oct-3": false, "corp-1": true, "corp-2": true },
    draft: "",
    notice: "",
  },
  projectFilter: "all",
  publish: { selected: 0, caption: "", sim: "" },
  automation: {
    selected: 0,
    paused: true,
    approval: "review",
    permission: false,
    capRun: 200,
    capMonth: 1500,
  },
  recovery: { scene2: "failed", exportState: "none", balance: 12, lowCredits: false, sim: "" },
});

export const presentationById = (id: PresentationId) =>
  PRESENTATIONS.find((item) => item.id === id) ?? PRESENTATIONS[0];

export const styleById = (id: StyleId) => STYLES.find((item) => item.id === id) ?? STYLES[1];

export const createCost = (presentation: PresentationId, length: number) =>
  length * (presentationById(presentation).rate || 1);

export interface SourceConcept {
  id: string;
  title: string;
  shape: string;
  angle: string;
  passage: string;
}

export interface SourceRecord {
  id: string;
  title: string;
  meta: string;
  status: string;
  tone: Tone;
  excerpt: string;
  conceptNote?: string;
  words?: number;
  concepts: SourceConcept[];
}

export const SOURCES: SourceRecord[] = [
  {
    id: "oct",
    title: "Our October newsletter",
    meta: "Pasted article · 1,840 words · saved Oct 16",
    status: "Batch in progress",
    tone: "batch",
    excerpt:
      "Most newsletters die in month three. Not from lack of ideas, from lack of a system. This issue is about the three habits that kept mine alive: a fixed publishing day, a swipe file, and a rule that every issue ends with one question.",
    conceptNote: "Three distinct angles found",
    concepts: [
      {
        id: "oct-1",
        title: "Why newsletters die in month three",
        shape: "45s · talking point",
        angle: "The hook is the failure, the payoff is the system.",
        passage: "Most newsletters die in month three. Not from lack of ideas, from lack of a system.",
      },
      {
        id: "oct-2",
        title: "The swipe file habit",
        shape: "30s · how-to",
        angle: "One concrete habit, shown as three steps.",
        passage: "a swipe file",
      },
      {
        id: "oct-3",
        title: "End every issue with one question",
        shape: "30s · tip",
        angle: "A single rule with one example reply.",
        passage: "a rule that every issue ends with one question",
      },
    ],
  },
  {
    id: "corp",
    title: "Why I left corporate",
    meta: "Pasted article · 1,120 words · saved Oct 12",
    status: "2 concepts",
    tone: "rendering",
    excerpt:
      "In August 2023 I handed in my badge with no plan beyond one rule: build something people pay for before the savings run out. Two years later the rule still runs the company.",
    conceptNote: "Only two angles hold up on their own; no third was invented",
    concepts: [
      {
        id: "corp-1",
        title: "One rule to leave with",
        shape: "40s · story",
        angle: "The badge moment, then the rule.",
        passage: "build something people pay for before the savings run out",
      },
      {
        id: "corp-2",
        title: "Two years later",
        shape: "30s · reflection",
        angle: "What the rule changed, in one example.",
        passage: "the rule still runs the company",
      },
    ],
  },
  {
    id: "note",
    title: "Quick note about pricing",
    meta: "Pasted note · 118 words · saved today",
    status: "Too short",
    tone: "draft",
    excerpt:
      "Thinking of moving the Growth plan to 2,000 credits and adding a yearly discount. Need to say this without sounding like a price hike.",
    words: 118,
    concepts: [],
  },
];

export const PUBLISH_MEDIA = [
  { title: "Click, Then Sleep", meta: "9:16 · 15s", version: "v1" },
  { title: "Why newsletters die in month three", meta: "9:16 · 45s · batch 1 of 3", version: "v1" },
  { title: "Sci-fi chase, three cuts", meta: "1:1 · 10s", version: "v2" },
];

export const SERIES = [
  {
    title: "New post on The Indiepreneur → 3 shorts",
    meta: "Per saved source · review first · cap 200 per run",
    trigger: "Each new source saved with the tag “Indiepreneur”. Up to three concepts per post, never padded.",
    creative: "9:16 · Motion graphics · Bold · Narrator",
  },
  {
    title: "Weekly tip from saved sources",
    meta: "Mondays · review first · draft only",
    trigger: "Every Monday 09:00 Asia/Jerusalem, one concept from the newest unused source.",
    creative: "9:16 · Illustration · Minimal · Orel (recorded)",
  },
];

export const SHOWCASE_CARDS = [
  {
    mark: "BOLD",
    swatch: "#141321",
    swatchFg: "#FFFFFF",
    serif: false,
    title: "What is a transformer?",
    meta: "Topic · 60s · 9:16 · Motion graphics",
    brief: "What is a transformer, explained for a general audience in about a minute.",
    style: "bold" as StyleId,
    length: 60 as const,
    format: "9:16" as FormatId,
  },
  {
    mark: "Editorial",
    swatch: "#FBF4E7",
    swatchFg: "#141321",
    serif: true,
    title: "A short history of the espresso",
    meta: "Topic · 60s · 9:16 · Motion graphics",
    brief: "A short history of the espresso, told as a magazine piece.",
    style: "editorial" as StyleId,
    length: 60 as const,
    format: "9:16" as FormatId,
  },
  {
    mark: "Minimal",
    swatch: "#E9E8F1",
    swatchFg: "#3F3D4F",
    serif: false,
    title: "Our October newsletter, as a video",
    meta: "Article · 90s · 16:9 · Motion graphics",
    brief: "Turn our October newsletter into a 90-second video.",
    style: "minimal" as StyleId,
    length: 90 as const,
    format: "16:9" as FormatId,
  },
];

export const isStudioState = (value: unknown): value is StudioState => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StudioState>;
  return record.version === STUDIO_VERSION && !!record.create && !!record.batch && !!record.recovery && !!record.videos;
};

export const batchCounts = (items: BatchItem[]) => {
  const ready = items.filter((item) => item.gen === "ready").length;
  const failed = items.filter((item) => item.gen === "failed").length;
  const waiting = items.filter((item) => !item.approved).length;
  const rendering = items.filter((item) => item.gen === "rendering").length;
  return { ready, failed, waiting, rendering };
};

export const recoveryHead = (recovery: RecoveryState) => {
  const allGood = recovery.scene2 === "rendered" && recovery.exportState === "ready";
  const partial = recovery.exportState === "partial";
  const exportFailed = recovery.exportState === "failed";
  if (allGood) return { label: "Ready · v1", tone: "ready" as Tone };
  if (partial) return { label: "Partial export · v1 (2 scenes)", tone: "batch" as Tone };
  if (exportFailed) return { label: "Export failed", tone: "attention" as Tone };
  if (recovery.scene2 === "rendering") return { label: "Rendering scene 2", tone: "rendering" as Tone };
  return { label: "1 scene failed", tone: "attention" as Tone };
};
