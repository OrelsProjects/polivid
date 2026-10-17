import { z } from "zod";
import { defineTool } from "@/lib/tools/define";
import { formatField, lengthField, presetField, tierField, visualDirectionField } from "@/lib/tools/fields";
import { MAX_LYRICS_NOTE, MAX_REFERENCE_IMAGES } from "@/lib/video/schema";
import { MAX_PRESET_FRAGMENT, MAX_PRESET_NAME } from "@/lib/video/presets";

const note = (description: string) => z.string().trim().max(MAX_LYRICS_NOTE).optional().describe(description);

export const planTools = [
  defineTool({
    name: "plan_shots",
    title: "Plan shots",
    category: "plan",
    summary: "Plan the cuts for a prompt or lyrics video and price them. Nothing is filmed or charged.",
    whenToUse: [
      "They want to see the shot list or the price before approving a prompt or lyrics video.",
      "You are about to write a brief and want the cut count to match the length.",
    ],
    avoidWhen: ["The mode is not prompt or lyrics. Those are the only modes with this planner."],
    inputSchema: z.object({
      prompt: z.string().trim().min(3).describe("The prompt or the lyric lines to plan."),
      length: lengthField(),
      mode: z.enum(["prompt", "lyrics"]).optional().describe("Which planner. Defaults to lyrics."),
      tier: tierField(),
      format: formatField().optional(),
      direction: note("Camera and performance notes for lyrics."),
      scene: note("Location and wardrobe notes for lyrics."),
      visualDirection: visualDirectionField(),
      presetId: presetField(),
      referenceCount: z
        .number()
        .int()
        .min(0)
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe("How many reference pictures. Omit to use the number attached in chat."),
      songReady: z.boolean().optional().describe("True when a song take already exists, so the price skips composing one."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: true },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    examples: [
      { request: "Plan a 30 second lyrics video before we film it.", input: { prompt: "First line\nSecond line", length: 30, mode: "lyrics", tier: "pro" } },
    ],
  }),
  defineTool({
    name: "improve_narration",
    title: "Improve narration",
    category: "plan",
    summary: "Rewrite a short description into one spoken narration paragraph. Does not spend credits.",
    whenToUse: ["They have a rough idea and the next step is a voiceover script."],
    avoidWhen: ["They already have the script. Pass it to make_voiceover_video."],
    inputSchema: z.object({
      description: z.string().trim().min(3).describe("The rough idea to turn into spoken narration."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: true },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "polish_look",
    title: "Polish a look",
    category: "plan",
    summary: "Rewrite a loose style note into a render description. Does not spend credits or save it.",
    whenToUse: ["They described a look in casual words and you need a preset fragment before save_preset."],
    avoidWhen: ["They want a catalog preset. Use suggest_preset."],
    inputSchema: z.object({
      description: z.string().trim().min(3).describe("The look, in their words."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: true },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "save_preset",
    title: "Save a preset",
    category: "plan",
    summary: "Save a visual preset on their account so later videos can use its id.",
    whenToUse: ["They asked to keep a look, and you have a name plus a render description."],
    avoidWhen: ["The description is still casual. Call polish_look first."],
    inputSchema: z.object({
      name: z.string().trim().min(2).max(MAX_PRESET_NAME).describe("Short name they will recognize."),
      promptFragment: z
        .string()
        .trim()
        .min(8)
        .max(MAX_PRESET_FRAGMENT)
        .describe("Render description: materials, light, camera, and mood. No studio names."),
      negativeFragment: z
        .string()
        .trim()
        .max(MAX_PRESET_FRAGMENT)
        .optional()
        .describe("What the look should avoid."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
];
