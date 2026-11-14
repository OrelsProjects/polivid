import { z } from "zod";
import { MAX_CHARACTER_NAME, MAX_IMAGE_PROMPT, MAX_VOICE_DESCRIPTION } from "@/lib/characters/constants";
import { defineTool } from "@/lib/tools/define";
import { characterField, formatField, lengthField, promptField, referenceKeysField, tierField } from "@/lib/tools/fields";

const picture = (description: string) => z.string().trim().min(1).max(200).describe(description);

export const assetTools = [
  defineTool({
    name: "generate_image",
    title: "Generate a picture",
    category: "assets",
    summary: "Generate a picture and save it to their uploads. Spends 1 credit. The key can feed a video.",
    whenToUse: [
      "They need a still before make_image_video, make_avatar_video, or as a reference picture.",
      "Pass referenceKeys when an attached picture should guide the style.",
    ],
    avoidWhen: [
      "They want an existing picture changed. Use edit_image.",
      "They want a character portrait with the portrait framing. Use create_character_portrait.",
      "A suggested look is still unconfirmed. Stop and wait for the card.",
    ],
    inputSchema: z.object({
      prompt: z.string().trim().min(3).max(MAX_IMAGE_PROMPT).describe("What the picture shows."),
      format: formatField().optional().describe("Frame of the still. Defaults to 1:1."),
      referenceKeys: referenceKeysField(),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: (input) => `picture · ${String(input.format ?? "1:1")}`,
    examples: [
      { request: "Make a portrait I can animate.", input: { prompt: "A woman in a red coat, soft window light", format: "9:16" } },
    ],
  }),
  defineTool({
    name: "edit_image",
    title: "Edit a picture",
    category: "assets",
    summary: "Change a picture they already uploaded and save the result. Spends 1 credit.",
    whenToUse: [
      "They want a fix: lighting, wardrobe, background, or a small change to a person who is already in the picture.",
      "sourceKey is the picture to edit. The edit is sent as a subject reference, which is the path the image model accepts.",
    ],
    avoidWhen: [
      "They want a brand new picture. Use generate_image.",
      "They want the picture animated. Use make_image_video.",
    ],
    inputSchema: z.object({
      prompt: z.string().trim().min(3).max(MAX_IMAGE_PROMPT).describe("What to change. Say what must stay the same."),
      sourceKey: picture("Upload key of the picture to edit. Omit to use the attached picture.").optional(),
      format: formatField().optional().describe("Frame of the result. Defaults to the source's closest frame, or 1:1."),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: () => "edit picture",
  }),
  defineTool({
    name: "compose_song",
    title: "Compose a song",
    category: "assets",
    summary: "Compose one song take from lyrics. A character with a voice re-sings it. Spends credits.",
    whenToUse: [
      "A lyrics video needs a song and list_songs has no take that fits.",
      "Pass the returned songId to make_lyrics_video.",
    ],
    avoidWhen: ["They uploaded a finished track. Use make_music_video with that file."],
    inputSchema: z.object({
      prompt: promptField("Lyrics, plus any style note. The lyrics themselves are required."),
      style: z
        .string()
        .trim()
        .max(300)
        .optional()
        .describe("Musical direction as a short comma list: genre, mood, tempo, instruments, vocal type. E.g. lo-fi hip hop, mellow, 80 bpm, female vocal."),
      length: lengthField(),
      tier: tierField(),
      characterId: characterField(),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: (input) => `song · ${String(input.length ?? "")}s`,
  }),
  defineTool({
    name: "create_character_portrait",
    title: "Character portrait",
    category: "assets",
    summary: "Generate a front-facing portrait and save it. Spends 1 credit. Use the key in create_character.",
    whenToUse: ["They are making a character and do not already have a picture."],
    avoidWhen: ["They already uploaded a photo. Pass that key to create_character."],
    inputSchema: z.object({
      description: z.string().trim().min(8).max(MAX_IMAGE_PROMPT).describe("Who this person is, in a few words."),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: () => "character portrait",
  }),
  defineTool({
    name: "design_voice",
    title: "Design a voice",
    category: "assets",
    summary: "Design voice previews from a description. Spends 1 credit. Returns ids, not the audio.",
    whenToUse: [
      "They want a new voice for a character.",
      "Pass one returned generatedVoiceId to create_character with voiceMode designed.",
    ],
    avoidWhen: ["They want the studio narrator or a character that already has a voice. Use list_characters."],
    inputSchema: z.object({
      description: z.string().trim().min(8).max(MAX_VOICE_DESCRIPTION).describe("How the voice should sound."),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: () => "design a voice",
  }),
  defineTool({
    name: "create_character",
    title: "Create a character",
    category: "assets",
    summary: "Save a character from a picture and an optional designed voice. Does not spend credits.",
    whenToUse: [
      "They asked to keep a person for later videos.",
      "imageKey is a portrait you generated or a picture they uploaded. voiceMode none skips the voice. designed uses a generatedVoiceId from design_voice.",
    ],
    avoidWhen: [
      "They want to record a voice in the browser. Send them to the Characters page. This tool cannot take a recording.",
      "The character already exists. Use list_characters and pass that id.",
    ],
    inputSchema: z.object({
      name: z.string().trim().min(2).max(MAX_CHARACTER_NAME).describe("Name they will recognize."),
      imageKey: picture("Upload key of the character's picture."),
      imagePrompt: z.string().trim().max(MAX_IMAGE_PROMPT).optional().describe("The prompt that made the picture, if you have it."),
      voiceMode: z.enum(["none", "designed"]).optional().describe("none keeps them silent. designed needs generatedVoiceId. Defaults to none."),
      generatedVoiceId: z.string().trim().min(1).optional().describe("Id from design_voice. Required when voiceMode is designed."),
      voiceDescription: z
        .string()
        .trim()
        .min(8)
        .max(MAX_VOICE_DESCRIPTION)
        .optional()
        .describe("The voice description you passed to design_voice. Required when voiceMode is designed."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: true },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "import_media_from_url",
    title: "Import media from a link",
    category: "assets",
    summary: "Download a public picture, song, or clip into the person's uploads and get its key.",
    whenToUse: [
      "You have a file as a public https link and a tool needs an upload key (mediaKey, referenceKeys, backgroundKey, edit_add_media).",
      "Over MCP this is how you attach your own media: there is no chat composer.",
    ],
    avoidWhen: ["The file is already uploaded. Use list_uploads to find its key."],
    inputSchema: z.object({
      url: z.string().trim().url().max(2000).describe("Public http(s) link straight to the file."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
];
