import { z } from "zod";
import { defineTool } from "@/lib/tools/define";
import { VIDEO_MODE_IDS } from "@/lib/video/modes";

const READ = { readOnly: true, spendsCredits: false, destructive: false, longRunning: false } as const;

/** Discovery tools. They describe what can be chosen, so an agent never has to guess an id. */
export const catalogTools = [
  defineTool({
    name: "list_modes",
    title: "List video modes",
    category: "library",
    summary: "Every Create mode, the make_* tool that queues it, what it needs, and which model each tier films with.",
    whenToUse: [
      "Before choosing how to make a video, or when they ask what kinds of videos PoliVid makes.",
      "To see which tier maps to which footage model and resolution.",
    ],
    inputSchema: z.object({}),
    effects: READ,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "list_models",
    title: "List footage models",
    category: "library",
    summary: "Footage models you can pass as model: clip lengths, resolutions, native audio, reference pictures, and price.",
    whenToUse: [
      "Before passing model to a make_* tool or estimate_credits.",
      "They ask which model is best, cheapest, longest, or has sound.",
    ],
    avoidWhen: ["Motion graphics, captions, and quick edits film nothing and take no model."],
    inputSchema: z.object({
      mode: z.enum(VIDEO_MODE_IDS).optional().describe("Only models that suit this mode, e.g. those that take reference pictures for lyrics."),
    }),
    effects: READ,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "list_templates",
    title: "List templates",
    category: "library",
    summary: "Ready-made Create templates (product ad, explainer, top list…) with their mode and default settings.",
    whenToUse: [
      "They name a kind of video (an ad, a listicle, a quote card) and you want a starting point.",
      "Pass the slug as template on that mode's make_* tool, and copy its defaults into the call.",
    ],
    inputSchema: z.object({
      query: z.string().trim().max(80).optional().describe("Search words matched against name, description, and keywords."),
      mode: z.enum(VIDEO_MODE_IDS).optional().describe("Only templates for this mode."),
    }),
    effects: READ,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "list_voices",
    title: "List voices",
    category: "library",
    summary: "Voices that can speak: the studio narrator, saved characters with a voice, and the speech library used by productions.",
    whenToUse: [
      "Before passing characterId for narration, or a voiceId to a production.",
      "They ask what voices are available.",
    ],
    avoidWhen: ["They want a new voice. Use design_voice or create_character."],
    inputSchema: z.object({}),
    effects: READ,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "list_backgrounds",
    title: "List backgrounds",
    category: "library",
    summary: "Built-in looping backgrounds for a voiceover read over a loop (media loop).",
    whenToUse: ["Before passing backgroundId to make_voiceover_video with media loop."],
    inputSchema: z.object({}),
    effects: READ,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "list_options",
    title: "List options",
    category: "library",
    summary: "Every fixed choice in one call: formats, length limits, tiers, visual media, quick-edit ops and values, attachment roles, caption and edit limits.",
    whenToUse: ["You need the allowed values for a field and the tool description doesn't list them."],
    inputSchema: z.object({}),
    effects: READ,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
];
