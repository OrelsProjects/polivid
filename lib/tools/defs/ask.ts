import { z } from "zod";
import { defineTool } from "@/lib/tools/define";

export const askTools = [
  defineTool({
    name: "app_ask_question",
    title: "Ask a question",
    category: "ask",
    summary: "Ask the person a structured question in the chat.",
    whenToUse: [
      "A choice is a short list, such as format, length, or which character.",
      "You need at most one or two answers before you can write a brief.",
    ],
    avoidWhen: [
      "You can assume a sensible default and mention it.",
      "You are about to spend credits. Write a brief instead of another question.",
    ],
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
