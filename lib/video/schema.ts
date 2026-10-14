import { z } from "zod";

/**
 * The contract between the LLM and the renderer.
 *
 * The LLM picks facts and arranges scenes. It never writes a number into
 * on-screen text or narration: it writes `{fact_id}` placeholders, and code
 * fills them in from the fact's source value (see lib/video/lint.ts).
 */

export const VIDEO_FORMATS = ["9:16", "16:9", "1:1"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

/** Preset lengths on the Create page. Any whole number in the range below is also allowed. */
export const VIDEO_LENGTHS = [30, 60, 90] as const;
export type VideoLength = (typeof VIDEO_LENGTHS)[number];

export const MIN_VIDEO_LENGTH = 2;
export const MAX_VIDEO_LENGTH = 90;

export const isVideoLength = (value: number) =>
  Number.isInteger(value) && value >= MIN_VIDEO_LENGTH && value <= MAX_VIDEO_LENGTH;

export const FACT_FORMATS = [
  "percent",
  "points",
  "currency",
  "compact_currency",
  "number",
  "compact_number",
] as const;

export const FactSchema = z.object({
  id: z
    .string()
    .describe("snake_case id used in {placeholders}, e.g. cpi_yoy"),
  label: z.string().describe("Short on-screen label, no digits"),
  kind: z.enum(["number", "series"]),
  value: z
    .number()
    .nullable()
    .describe("The number, exactly as the source states it. Null for series"),
  points: z
    .array(z.object({ label: z.string(), value: z.number() }))
    .nullable()
    .describe("Ordered points for a series (time or categories). Null for a single number"),
  format: z.enum(FACT_FORMATS),
  unitLabel: z
    .string()
    .nullable()
    .describe('Trailing unit word when needed, e.g. "hours", "people"'),
  asOf: z.string().describe('Period the number refers to, e.g. "September 2026"'),
  sourceTitle: z.string(),
  sourceUrl: z.string(),
  sourceQuote: z
    .string()
    .describe("The exact sentence from the source that contains the number"),
});
export type Fact = z.infer<typeof FactSchema>;

export const SourcedQuoteSchema = z.object({
  text: z.string().describe("Verbatim words of a named person, copied from the source"),
  speaker: z.string().describe('Name and role, e.g. "Dr. Maya Chen, sleep researcher"'),
  sourceUrl: z.string(),
});
export type SourcedQuote = z.infer<typeof SourcedQuoteSchema>;

export const ResearchSchema = z.object({
  topic: z.string().describe("One-line description of the video"),
  facts: z.array(FactSchema),
  quotes: z.array(SourcedQuoteSchema).describe("0-3 verbatim quotes from people relevant to the topic"),
});
export type Research = z.infer<typeof ResearchSchema>;

export const SCENE_TYPES = [
  "hook",
  "text",
  "footage",
  "big_number",
  "bars",
  "line",
  "quote",
  "sources",
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const SceneSchema = z.object({
  type: z.enum(SCENE_TYPES),
  headline: z
    .string()
    .describe("On-screen title. Use {fact_id} for any number, never digits"),
  narration: z
    .string()
    .describe("One or two spoken sentences. Use {fact_id} for any number"),
  factIds: z
    .array(z.string())
    .describe("big_number: one number fact. line: one series fact. bars: one series or 2+ number facts"),
  quote: z
    .object({ text: z.string(), speaker: z.string(), sourceUrl: z.string() })
    .nullable()
    .describe("Only for quote scenes: a verbatim quote from a source"),
  durationSec: z.number().min(2).max(12),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ScenePlanSchema = z.object({
  title: z.string().describe("Video title, no digits"),
  scenes: z.array(SceneSchema),
});
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

export type VideoStatus = "ready" | "failed";

export interface SearchSource {
  url: string;
  title: string | null;
}

export interface VideoRecord {
  id: string;
  prompt: string;
  format: VideoFormat;
  /** Seconds the clip actually plays. A model may snap 60s down to its maximum. */
  length: number;
  status: VideoStatus;
  createdAt: string;
  title: string;
  facts: Fact[];
  quotes: SourcedQuote[];
  plan: ScenePlan | null;
  /** URLs the web search actually returned, used to flag invented sources. */
  searchSources: SearchSource[];
  /** Facts whose source URL was not among the search results. Shown as unverified. */
  unverifiedFactIds: string[];
  model: string;
  demo: boolean;
  error: string | null;
}

export const FPS = 30;

export const dimensionsFor = (format: VideoFormat) => {
  switch (format) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
  }
};

export const durationInFrames = (plan: ScenePlan) =>
  Math.max(
    FPS,
    plan.scenes.reduce((sum, s) => sum + Math.round(s.durationSec * FPS), 0),
  );
