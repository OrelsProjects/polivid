import type { Fact, ScenePlan, SourcedQuote } from "./schema";

/**
 * Sample data for the landing page and for demo mode (no OPENROUTER_API_KEY).
 * The study is fictional, and every frame says "Sample data".
 */

const SAMPLE_SOURCE = {
  asOf: "Sample",
  sourceTitle: "PoliVid sample data (fictional)",
  sourceUrl: "https://polivid.io/sample-data",
  sourceQuote: "Fictional numbers used to demo PoliVid.",
} as const;

export const DEMO_FACTS: Fact[] = [
  {
    id: "recall_boost",
    label: "More remembered after sleep",
    kind: "number",
    value: 40,
    points: null,
    format: "percent",
    unitLabel: null,
    ...SAMPLE_SOURCE,
  },
  {
    id: "sleep_hours",
    label: "Hours asleep in the sample",
    kind: "number",
    value: 7.5,
    points: null,
    format: "number",
    unitLabel: "hours",
    ...SAMPLE_SOURCE,
  },
  {
    id: "sleep_stages",
    label: "Share of the night",
    kind: "series",
    value: null,
    points: [
      { label: "Light", value: 50 },
      { label: "Deep", value: 20 },
      { label: "REM", value: 25 },
      { label: "Awake", value: 5 },
    ],
    format: "percent",
    unitLabel: null,
    ...SAMPLE_SOURCE,
  },
  {
    id: "recall_week",
    label: "Words recalled",
    kind: "series",
    value: null,
    points: [
      { label: "Mon", value: 12 },
      { label: "Tue", value: 18 },
      { label: "Wed", value: 21 },
      { label: "Thu", value: 27 },
      { label: "Fri", value: 31 },
    ],
    format: "number",
    unitLabel: "words",
    ...SAMPLE_SOURCE,
  },
];

export const DEMO_QUOTES: SourcedQuote[] = [
  {
    text: "Sleep is when the day's learning gets filed.",
    speaker: "Sample researcher (fictional)",
    sourceUrl: SAMPLE_SOURCE.sourceUrl,
  },
];

export const DEMO_PLAN: ScenePlan = {
  title: "Why sleep matters for memory",
  scenes: [
    {
      type: "hook",
      headline: "Why sleep matters for memory",
      narration: "After one night of sleep, people remembered {recall_boost} more of what they had studied.",
      factIds: ["recall_boost"],
      quote: null,
      durationSec: 4,
    },
    {
      type: "big_number",
      headline: "Remembered after sleep",
      narration: "They slept {sleep_hours}. The gain showed up the next morning.",
      factIds: ["recall_boost"],
      quote: null,
      durationSec: 5,
    },
    {
      type: "bars",
      headline: "How the night was split",
      narration: "Light sleep took half the night. Deep sleep and REM split most of the rest.",
      factIds: ["sleep_stages"],
      quote: null,
      durationSec: 6,
    },
    {
      type: "line",
      headline: "Recall across the week",
      narration: "Words recalled climbed through the week, ending at {recall_week}.",
      factIds: ["recall_week"],
      quote: null,
      durationSec: 6,
    },
    {
      type: "quote",
      headline: "How a researcher put it",
      narration: "One way to say it: sleep is when the day's learning gets filed.",
      factIds: [],
      quote: DEMO_QUOTES[0],
      durationSec: 5,
    },
    {
      type: "sources",
      headline: "Sources",
      narration: "The numbers in this video come from these sources.",
      factIds: [],
      quote: null,
      durationSec: 4,
    },
  ],
};
