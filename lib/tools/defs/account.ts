import { z } from "zod";
import { defineTool } from "@/lib/tools/define";
import { idField, lengthField, tierField } from "@/lib/tools/fields";
import { VIDEO_MODE_IDS } from "@/lib/video/modes";

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
    ],
    avoidWhen: ["You are only checking the balance. Use get_credit_balance."],
    inputSchema: z.object({
      mode: z.enum(VIDEO_MODE_IDS).optional().describe("Create mode to price. Ignored when productionId is set."),
      tier: tierField(),
      length: lengthField(1, 180).optional().describe("Seconds to price for a Create video. Required unless productionId is set."),
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
