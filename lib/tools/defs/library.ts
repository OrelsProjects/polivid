import { z } from "zod";
import { defineTool } from "@/lib/tools/define";
import { idField } from "@/lib/tools/fields";

const none = z.object({}).describe("No input.");

export const libraryTools = [
  defineTool({
    name: "list_characters",
    title: "List characters",
    category: "library",
    summary: "List saved characters plus studio and off.",
    whenToUse: [
      "You need a characterId for a video, a production, a song, or a new character's voice.",
      "The person asks who they can put on screen or which voices they have.",
    ],
    avoidWhen: ["You already have the character id from an attached-character note. Use that id."],
    inputSchema: none,
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    examples: [{ request: "Who can narrate this?", input: {} }],
  }),
  defineTool({
    name: "list_presets",
    title: "List presets",
    category: "library",
    summary: "List visual presets the person can apply to a video.",
    whenToUse: [
      "You need a real preset id before making a video or saving a look.",
      "The person asks what styles exist, including looks they saved.",
    ],
    avoidWhen: ["You only need one recommendation. Use suggest_preset."],
    inputSchema: z.object({
      engine: z
        .enum(["footage", "motion", "both"])
        .optional()
        .default("footage")
        .describe("Which preset list. footage for filmed clips, motion for motion graphics, both for everything. Defaults to footage."),
    }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    examples: [{ request: "What looks can I use?", input: { engine: "footage" } }],
  }),
  defineTool({
    name: "suggest_preset",
    title: "Suggest a preset",
    category: "library",
    summary: "Recommend one visual preset from a short brief.",
    whenToUse: ["The person described a look and you should pick one preset instead of listing them all."],
    avoidWhen: ["They already named a preset, or the video is captions. Captions ignore presets."],
    inputSchema: z.object({
      brief: z.string().trim().min(3).describe("What the video should look and feel like."),
      engine: z
        .enum(["footage", "motion"])
        .optional()
        .default("footage")
        .describe("footage for filmed clips, motion for motion graphics. Defaults to footage."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: true },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    examples: [{ request: "Make it feel like a Pixar short.", input: { brief: "Warm 3D animated short", engine: "footage" } }],
  }),
  defineTool({
    name: "list_my_videos",
    title: "List videos",
    category: "library",
    summary: "List the person's generated videos and active jobs.",
    whenToUse: [
      "They ask what they have made, or you need a video id before opening, retrying, or editing one.",
    ],
    inputSchema: none,
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    examples: [{ request: "What videos do I have?", input: {} }],
  }),
  defineTool({
    name: "get_video",
    title: "Read a video",
    category: "library",
    summary: "Read one of the person's videos.",
    whenToUse: ["You have a video id and need its prompt, status, format, or error before acting on it."],
    inputSchema: z.object({
      videoId: idField("Id from list_my_videos or from a link the person pasted."),
    }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "list_my_productions",
    title: "List productions",
    category: "library",
    summary: "List staged productions.",
    whenToUse: ["They ask about a multi-scene film, or you need a production id."],
    avoidWhen: ["They mean a short Create video. Use list_my_videos."],
    inputSchema: none,
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "get_production",
    title: "Read a production",
    category: "library",
    summary: "Read one staged production.",
    whenToUse: ["You have a production id and need its stage, status, or error before answering or approving it."],
    inputSchema: z.object({
      productionId: idField("Id from list_my_productions."),
    }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "list_uploads",
    title: "List uploads",
    category: "library",
    summary: "List pictures, audio, and video the person has uploaded.",
    whenToUse: [
      "A make tool needs a file and they did not attach one in this chat.",
      "They say to use a photo, song, or clip they uploaded earlier.",
    ],
    avoidWhen: ["They attached the file in this chat. Use that key."],
    inputSchema: none,
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    examples: [{ request: "Use the song I uploaded yesterday.", input: {} }],
  }),
  defineTool({
    name: "list_songs",
    title: "List songs",
    category: "library",
    summary: "List song takes already composed for this person.",
    whenToUse: ["A lyrics video should reuse a song instead of composing a new one. Pass the id as songId."],
    avoidWhen: ["No take fits the lyrics. Use compose_song."],
    inputSchema: none,
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
];
