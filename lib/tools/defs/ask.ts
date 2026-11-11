import { z } from "zod";
import { defineTool } from "@/lib/tools/define";

const presetId = z.string().trim().min(1).max(80);

export const askTools = [
  defineTool({
    name: "app_confirm_preset",
    title: "Confirm a look",
    category: "ask",
    summary: "Ask the person to confirm a visual preset, or pick a different one, before any picture is generated.",
    whenToUse: [
      "You just called suggest_preset. Pass its preset id, reason, and engine, then stop.",
      "The result is presetId. Pass that exact id to make_storyboard. Do not generate pictures before it returns.",
    ],
    avoidWhen: [
      "They already named a preset. Use that id.",
      "They already confirmed this look.",
      "They asked you to run wild or to just make it.",
      "The video is captions. Captions ignore presets.",
    ],
    inputSchema: z.object({
      presetId: presetId.describe("Preset id from suggest_preset. They can switch it before confirming."),
      reason: z.string().trim().max(600).optional().describe("Why you suggested it, from suggest_preset."),
      engine: z
        .enum(["footage", "motion"])
        .optional()
        .describe("footage or motion, matching suggest_preset. Defaults to footage."),
    }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "client",
    awaitsPerson: true,
    surfaces: ["coach"],
    examples: [
      {
        request: "Use a cinematic look, and let me switch it before the pictures.",
        input: { presetId: "movie", reason: "Anamorphic drama fits the chase.", engine: "footage" },
      },
    ],
  }),
  defineTool({
    name: "app_ask_question",
    title: "Ask a question",
    category: "ask",
    summary: "Ask the person a structured question in the chat.",
    whenToUse: [
      "A choice is a short list, such as format, length, which story, or which character.",
      "You need at most one or two answers before a storyboard or a brief.",
    ],
    avoidWhen: ["You can assume a sensible default and mention it."],
    inputSchema: z.object({
      question: z.string().trim().min(1).describe("The question, in the person's language."),
      options: z.array(z.string().trim().min(1)).max(6).optional().describe("Up to six choices. Omit for a free-text answer."),
    }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "client",
    awaitsPerson: true,
    surfaces: ["coach"],
    examples: [{ request: "Vertical or horizontal?", input: { question: "Which frame?", options: ["9:16", "16:9", "1:1"] } }],
  }),
];
