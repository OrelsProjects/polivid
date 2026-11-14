import { z } from "zod";
import { defineTool } from "@/lib/tools/define";
import { cutsField, idField, lengthField, modelField, tierField } from "@/lib/tools/fields";
import { VIDEO_MODE_IDS } from "@/lib/video/modes";
import { VISUAL_MEDIA } from "@/lib/video/stills";

export const accountTools = [
  defineTool({
    name: "get_credit_balance",
    title: "Credit balance",
    category: "account",
    summary: "Read remaining credits.",
    whenToUse: ["The person asks what they can afford, or you are about to propose a video that spends credits."],
    inputSchema: z.object({}).describe("No input."),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "estimate_credits",
    title: "Estimate credits",
    category: "account",
    summary: "Estimate credits for a Create video or an existing staged production.",
    whenToUse: [
      "You are writing a brief and want a price before they approve.",
      "They ask what a production will cost. Pass its productionId.",
      "To compare models or media, call it once per option. It is free.",
    ],
    avoidWhen: ["You are only checking the balance. Use get_credit_balance."],
    inputSchema: z.object({
      tool: z
        .string()
        .trim()
        .max(60)
        .optional()
        .describe("Name of any tool that spends credits, e.g. make_prompt_video. Pass its arguments in arguments to get the exact price that call would hold."),
      arguments: z.record(z.string(), z.unknown()).optional().describe("The arguments you would send to that tool."),
      mode: z.enum(VIDEO_MODE_IDS).optional().describe("Create mode to price. Ignored when tool or productionId is set."),
      tier: tierField(),
      model: modelField(),
      media: z.enum(VISUAL_MEDIA).optional().describe("video, stills, or loop. Stills and loop are much cheaper than filming."),
      length: lengthField(1, 180).optional().describe("Seconds to price for a Create video. Required unless tool or productionId is set."),
      cuts: cutsField(),
      productionId: idField("Existing production to price.").optional(),
    }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    examples: [
      { request: "How many credits is a 30 second pro reel?", input: { mode: "prompt", tier: "pro", length: 30 } },
    ],
  }),
];
